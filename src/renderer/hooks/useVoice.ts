/**
 * NEXUS — useVoice
 *
 * Pipeline :
 *   Mic → VAD (silence 1.2s) → STT (Groq Whisper) → callback(text)
 *   + TTS (msedge-tts via IPC) → blob URL + Web Audio amplitude → cluster speaking
 *
 * TTS utilise l'approche V1 : blob URL + <audio> + createMediaElementSource
 * pour garantir la compatibilité Electron.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../components/cluster/useClusterStore';

// ─── Config VAD (identique V1) ────────────────────────────────────────────────
const VAD_FFT_SIZE  = 512;
const VAD_THRESHOLD = 10;    // round(30 - 0.8 * 25) = 10, sensitivity=0.8 V1
const SILENCE_MS    = 1200;  // ms silence avant auto-stop

// ─── Types preload ────────────────────────────────────────────────────────────
interface TTSResult {
  audio : string;  // base64 MP3
  words : { word: string; timeMs: number }[];
}

interface STTResult {
  text  ?: string;
  error ?: string;
}

declare const window: Window & typeof globalThis & {
  nexus?: {
    voice: {
      speak     : (text: string, opts?: object) => Promise<TTSResult>;
      stop      : () => void;
      transcribe: (buf: ArrayBuffer) => Promise<STTResult>;
    };
  };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoice() {
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const { setAmplitude, setClusterState } = useClusterStore();

  // ── Mic / VAD refs ───────────────────────────────────────────────────────
  const streamRef           = useRef<MediaStream | null>(null);
  const recorderRef         = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);
  const vadCtxRef           = useRef<AudioContext | null>(null);
  const vadRafRef           = useRef<number>(0);
  const lastSpeechRef       = useRef<number>(0);
  const vadActiveRef        = useRef(false);
  const shouldTranscribeRef = useRef(false);
  const onTranscribeRef     = useRef<((text: string) => void) | null>(null);

  // ── TTS refs ─────────────────────────────────────────────────────────────
  const audioElRef     = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const ampAnalyserRef = useRef<AnalyserNode | null>(null);
  const ampRafRef      = useRef<number>(0);
  const blobUrlRef     = useRef<string | null>(null);
  const ttsResolveRef  = useRef<(() => void) | null>(null);  // pour résoudre depuis stop

  // ─────────────────────────────────────────────────────────────────────────
  // VAD
  // ─────────────────────────────────────────────────────────────────────────

  function _startVAD(stream: MediaStream) {
    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = VAD_FFT_SIZE;
    source.connect(analyser);

    vadCtxRef.current    = ctx;
    lastSpeechRef.current = Date.now();
    vadActiveRef.current  = true;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      if (!vadActiveRef.current) return;

      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;

      if (avg > VAD_THRESHOLD) {
        lastSpeechRef.current = Date.now();
      } else if (Date.now() - lastSpeechRef.current > SILENCE_MS) {
        _stopMic(true);
        return;
      }

      vadRafRef.current = requestAnimationFrame(tick);
    }

    vadRafRef.current = requestAnimationFrame(tick);
  }

  function _stopVAD() {
    vadActiveRef.current = false;
    cancelAnimationFrame(vadRafRef.current);
    if (vadCtxRef.current && vadCtxRef.current.state !== 'closed') {
      vadCtxRef.current.close().catch(() => {});
    }
    vadCtxRef.current = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Microphone
  // ─────────────────────────────────────────────────────────────────────────

  const startListening = useCallback(async (onTranscribe: (text: string) => void) => {
    if (isListening || isTranscribing) return;

    onTranscribeRef.current = onTranscribe;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl : true,
        },
      });
      streamRef.current = stream;

      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm'             :
        'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current         = recorder;
      chunksRef.current           = [];
      shouldTranscribeRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (shouldTranscribeRef.current) {
          await _transcribe();
        } else {
          chunksRef.current = [];
        }
      };

      recorder.start(100);
      _startVAD(stream);

      setIsListening(true);
      setClusterState('listening');

    } catch (e) {
      console.error('[Voice] Erreur microphone:', e);
    }
  }, [isListening, isTranscribing, setClusterState]);

  function _stopMic(autoTranscribe: boolean) {
    shouldTranscribeRef.current = autoTranscribe;
    _stopVAD();

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setIsListening(false);

    if (!autoTranscribe) {
      onTranscribeRef.current = null;
      setClusterState('idle');
    }
  }

  const stopListening = useCallback(() => {
    _stopMic(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // STT — Groq Whisper
  // ─────────────────────────────────────────────────────────────────────────

  async function _transcribe() {
    if (!chunksRef.current.length || !onTranscribeRef.current) {
      setClusterState('idle');
      chunksRef.current = [];
      return;
    }

    const cb = onTranscribeRef.current;
    onTranscribeRef.current = null;

    setIsTranscribing(true);
    setClusterState('thinking');

    try {
      const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await window.nexus?.voice.transcribe(buffer);

      console.log('[STT] résultat:', result);

      if (result?.text?.trim()) {
        cb(result.text.trim());
      } else {
        console.warn('[STT] Aucun texte', result?.error);
        setClusterState('idle');
      }
    } catch (e) {
      console.error('[STT] Erreur:', e);
      setClusterState('idle');
    } finally {
      setIsTranscribing(false);
      chunksRef.current = [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — approche V1 : blob URL + <audio> + createMediaElementSource
  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    try {
      console.log('[TTS] Appel IPC speak…');
      const result = await window.nexus?.voice.speak(text);
      if (!result?.audio) {
        console.warn('[TTS] Pas de données audio dans la réponse');
        return;
      }
      console.log('[TTS] Audio reçu, longueur base64:', result.audio.length);

      // ── Blob URL (identique V1 _mp3BlobUrl) ─────────────────────────────
      const bytes = atob(result.audio);
      const arr   = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'audio/mpeg' });
      const url  = URL.createObjectURL(blob);

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;

      // ── Élément audio ────────────────────────────────────────────────────
      const audio = new Audio(url);
      audioElRef.current = audio;

      // ── Web Audio API pour amplitude (identique V1) ──────────────────────
      const ctx      = new AudioContext();
      await ctx.resume();  // déverrouille l'autoplay
      const source   = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);  // ← son vers les haut-parleurs

      audioCtxRef.current    = ctx;
      ampAnalyserRef.current = analyser;

      setIsSpeaking(true);

      // ── Loop amplitude → cluster ─────────────────────────────────────────
      const data = new Uint8Array(analyser.frequencyBinCount);
      function ampTick() {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        if (!audioElRef.current || audioElRef.current.ended) {
          setAmplitude(0);
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setAmplitude(Math.min(1, avg / 60));
        ampRafRef.current = requestAnimationFrame(ampTick);
      }
      audio.addEventListener('play', () => {
        ampRafRef.current = requestAnimationFrame(ampTick);
      });

      // ── Attente fin TTS (ou stop) ────────────────────────────────────────
      await new Promise<void>((resolve) => {
        ttsResolveRef.current = resolve;
        audio.addEventListener('ended', () => { ttsResolveRef.current = null; resolve(); });
        audio.addEventListener('error', (e) => {
          console.error('[TTS] Erreur audio element:', e);
          ttsResolveRef.current = null;
          resolve();
        });
        audio.play().catch((e) => {
          console.error('[TTS] play() refusé:', e);
          ttsResolveRef.current = null;
          resolve();
        });
      });

    } catch (e) {
      console.error('[TTS] Exception:', e);
    } finally {
      _cleanupTTS();
    }
  }, [setAmplitude]);

  const stopSpeaking = useCallback(() => {
    window.nexus?.voice.stop();
    audioElRef.current?.pause();
    ttsResolveRef.current?.();   // résout la promesse speak() pour débloquer
    ttsResolveRef.current = null;
    _cleanupTTS();
  }, []);

  function _cleanupTTS() {
    cancelAnimationFrame(ampRafRef.current);
    setAmplitude(0);
    setIsSpeaking(false);

    audioElRef.current = null;
    ampAnalyserRef.current = null;

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup au unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      _stopMic(false);
      _cleanupTTS();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  return {
    isListening,
    isSpeaking,
    isTranscribing,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
