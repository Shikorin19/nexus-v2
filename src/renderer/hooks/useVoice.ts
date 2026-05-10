/**
 * NEXUS — useVoice
 *
 * Pipeline complet :
 *   Mic → VAD (silence 1.2s) → STT (Groq Whisper) → callback(text)
 *   + TTS (msedge-tts via IPC) → Web Audio amplitude → cluster speaking
 *
 * Identique à la logique V1 index.html (startListening / TTSSpeaker)
 * portée en hook React propre.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../components/cluster/useClusterStore';

// ─── Config VAD (identique V1) ────────────────────────────────────────────────
const VAD_FFT_SIZE  = 512;
const VAD_THRESHOLD = 10;    // round(30 - 0.8 * 25) comme V1 sensitivity=0.8
const SILENCE_MS    = 1200;  // ms de silence avant auto-stop

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
  const streamRef          = useRef<MediaStream | null>(null);
  const recorderRef        = useRef<MediaRecorder | null>(null);
  const chunksRef          = useRef<Blob[]>([]);
  const vadCtxRef          = useRef<AudioContext | null>(null);
  const vadRafRef          = useRef<number>(0);
  const lastSpeechRef      = useRef<number>(0);
  const vadActiveRef       = useRef(false);
  const shouldTranscribeRef = useRef(false);
  const onTranscribeRef    = useRef<((text: string) => void) | null>(null);

  // ── TTS refs ─────────────────────────────────────────────────────────────
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const ampAnalyserRef = useRef<AnalyserNode | null>(null);
  const ampRafRef      = useRef<number>(0);
  const sourceNodeRef  = useRef<AudioBufferSourceNode | null>(null);
  const ttsCleanedRef  = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // VAD
  // ─────────────────────────────────────────────────────────────────────────

  function _startVAD(stream: MediaStream) {
    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = VAD_FFT_SIZE;
    source.connect(analyser);

    vadCtxRef.current  = ctx;
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
        // Silence détecté → arrêt auto avec transcription
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

      // Sélection du mimeType (identique V1)
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
        'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current    = recorder;
      chunksRef.current      = [];
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

      recorder.start(100);  // chunks 100ms comme V1
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
      recorderRef.current.stop();  // → déclenche onstop
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
    setClusterState('thinking');  // en attente du STT

    try {
      const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await window.nexus?.voice.transcribe(buffer);

      if (result?.text?.trim()) {
        // Ne pas setter idle ici — ChatOverlay reprend la main avec thinking (IA)
        cb(result.text.trim());
      } else {
        console.warn('[STT] Aucun texte transcrit', result?.error);
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
  // TTS — msedge-tts via IPC + amplitude Web Audio
  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    ttsCleanedRef.current = false;

    try {
      const result = await window.nexus?.voice.speak(text);
      if (!result?.audio) return;

      // Décoder le base64 MP3
      const raw = atob(result.audio);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);

      // Créer AudioContext
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);

      audioCtxRef.current    = ctx;
      ampAnalyserRef.current = analyser;

      // Décoder le buffer audio
      const audioBuffer = await ctx.decodeAudioData(arr.buffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      sourceNodeRef.current = source;

      setIsSpeaking(true);

      // Loop amplitude → cluster
      const data = new Uint8Array(analyser.frequencyBinCount);
      function ampTick() {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        // avg ~20-80 pour de la parole → normalise sur ~60
        setAmplitude(Math.min(1, avg / 60));
        ampRafRef.current = requestAnimationFrame(ampTick);
      }
      ampRafRef.current = requestAnimationFrame(ampTick);

      source.start(0);

      // Attendre fin naturelle OU interruption (source.stop() fire aussi onended)
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });

    } catch (e) {
      console.error('[TTS] Erreur:', e);
    } finally {
      _cleanupTTS();
    }
  }, [setAmplitude]);

  const stopSpeaking = useCallback(() => {
    window.nexus?.voice.stop();
    try { sourceNodeRef.current?.stop(); } catch {}
    _cleanupTTS();
  }, []);

  function _cleanupTTS() {
    if (ttsCleanedRef.current) return;  // éviter double-cleanup
    ttsCleanedRef.current = true;

    cancelAnimationFrame(ampRafRef.current);
    setAmplitude(0);
    setIsSpeaking(false);
    sourceNodeRef.current = null;
    ampAnalyserRef.current = null;

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
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
