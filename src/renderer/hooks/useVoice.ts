/**
 * NEXUS — useVoice
 *
 * STT : VAD (V1 exact) → Groq Whisper
 * TTS : new Audio(fileUrl) — fichier temp écrit par le main process
 *       file:// URL → zéro URL safety check
 *       Amplitude via createMediaElementSource + AnalyserNode (V1 exact)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../components/cluster/useClusterStore';

// ─── Config VAD (V1 exact) ────────────────────────────────────────────────────
const VAD_FFT_SIZE     = 512;
const VAD_SENSITIVITY  = 0.8;
const VAD_THRESHOLD    = Math.round(30 - VAD_SENSITIVITY * 25); // = 10
const SILENCE_MS       = 1200;

// ─── Types ────────────────────────────────────────────────────────────────────
interface TTSResult {
  audio   : string;
  fileUrl ?: string;
  words   : { word: string; timeMs: number }[];
}

declare const window: Window & typeof globalThis & {
  nexus?: {
    voice: {
      speak     : (text: string, opts?: object) => Promise<TTSResult>;
      stop      : () => void;
      transcribe: (buf: ArrayBuffer) => Promise<{ text?: string; error?: string }>;
    };
    rlog: (msg: string) => void;
  };
};

const rlog = (msg: string) => { try { window.nexus?.rlog(msg); } catch {} };

// ─────────────────────────────────────────────────────────────────────────────

export function useVoice() {
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const { setAmplitude, setClusterState } = useClusterStore();

  // ── Mic / VAD ────────────────────────────────────────────────────────────
  const streamRef            = useRef<MediaStream | null>(null);
  const recorderRef          = useRef<MediaRecorder | null>(null);
  const chunksRef            = useRef<Blob[]>([]);
  const vadCtxRef            = useRef<AudioContext | null>(null);
  const vadRafRef            = useRef<number>(0);
  const vadSpeechDetectedRef = useRef(false);
  const vadLastSpeechRef     = useRef<number>(0);
  const vadActiveRef         = useRef(false);
  const shouldTranscribeRef  = useRef(false);
  const onTranscribeRef      = useRef<((text: string) => void) | null>(null);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const audioElRef    = useRef<HTMLAudioElement | null>(null);
  const stoppedRef    = useRef(false);
  const resolveTTSRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — _cleanupTTS
  // ─────────────────────────────────────────────────────────────────────────

  function _cleanupTTS() {
    setAmplitude(0);
    setIsSpeaking(false);

    if (audioElRef.current) {
      const el = audioElRef.current;
      audioElRef.current = null;   // null EN PREMIER pour éviter re-entrée
      el.onended = null;
      el.onerror = null;
      el.pause();
      el.src = '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — speak
  // new Audio(file:// URL) + createMediaElementSource pour amplitude (V1)
  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    stoppedRef.current = true;
    window.nexus?.voice.stop();
    _cleanupTTS();
    stoppedRef.current = false;

    let result: TTSResult | undefined;
    try { result = await window.nexus?.voice.speak(text); }
    catch (e) { rlog('TTS IPC error: ' + String(e)); return; }

    if (!result?.fileUrl || stoppedRef.current) {
      rlog('TTS: pas de fileUrl ou stopped. fileUrl=' + result?.fileUrl);
      return;
    }

    rlog('TTS: fileUrl=' + result.fileUrl);

    const el = new Audio(result.fileUrl);
    audioElRef.current = el;

    // Pas d'amplitude custom — le cluster speaking naturel est déjà bien

    el.oncanplay = () => rlog('TTS: canplay');
    el.onplaying = () => { rlog('TTS: playing'); setIsSpeaking(true); };
    el.onpause   = () => rlog('TTS: pause t=' + el.currentTime.toFixed(2));
    el.onended   = () => {
      rlog('TTS: ended t=' + el.currentTime.toFixed(2));
      _cleanupTTS();
      const cb = resolveTTSRef.current; resolveTTSRef.current = null; cb?.();
    };
    el.onerror   = () => {
      rlog('TTS: onerror code=' + (el.error?.code ?? '?') + ' msg=' + (el.error?.message ?? '?'));
      _cleanupTTS();
      const cb = resolveTTSRef.current; resolveTTSRef.current = null; cb?.();
    };

    setIsSpeaking(true);

    await new Promise<void>((resolve) => {
      resolveTTSRef.current = resolve;
      el.play()
        .then(() => rlog('TTS: play() OK'))
        .catch((e) => {
          rlog('TTS: play() rejected: ' + String(e));
          _cleanupTTS();
          resolveTTSRef.current = null;
          resolve();
        });
    });
  }, [setAmplitude]);

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — stopSpeaking
  // ─────────────────────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    window.nexus?.voice.stop();
    _cleanupTTS();
    const cb = resolveTTSRef.current;
    resolveTTSRef.current = null;
    cb?.();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // VAD — identique V1 checkSilence (avec vadSpeechDetected flag)
  // ─────────────────────────────────────────────────────────────────────────

  function _startVAD(stream: MediaStream) {
    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = VAD_FFT_SIZE;
    source.connect(analyser);

    vadCtxRef.current            = ctx;
    vadActiveRef.current         = true;
    vadSpeechDetectedRef.current = false;
    vadLastSpeechRef.current     = 0;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function checkSilence() {
      if (!vadActiveRef.current) return;

      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avgVolume = sum / data.length;

      if (avgVolume > VAD_THRESHOLD) {
        vadSpeechDetectedRef.current = true;
        vadLastSpeechRef.current     = Date.now();
      } else if (
        vadSpeechDetectedRef.current &&
        Date.now() - vadLastSpeechRef.current > SILENCE_MS
      ) {
        _stopMic(true);
        return;
      }

      vadRafRef.current = requestAnimationFrame(checkSilence);
    }

    vadRafRef.current = requestAnimationFrame(checkSilence);
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
  // Microphone (V1 startListening exact)
  // ─────────────────────────────────────────────────────────────────────────

  const startListening = useCallback(async (onTranscribe: (text: string) => void) => {
    rlog('[Voice] startListening appelé, isListening=' + isListening + ' isTranscribing=' + isTranscribing);
    if (isListening || isTranscribing) return;
    onTranscribeRef.current = onTranscribe;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current         = recorder;
      chunksRef.current           = [];
      shouldTranscribeRef.current = false;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (shouldTranscribeRef.current) await _transcribe();
        else chunksRef.current = [];
      };

      recorder.start();
      _startVAD(stream);
      setIsListening(true);
      setClusterState('listening');
    } catch (e) {
      rlog('[Voice] getUserMedia refusé: ' + String(e));
      console.error('[Voice] Micro refusé:', e);
    }
  }, [isListening, isTranscribing, setClusterState]);

  function _stopMic(autoTranscribe: boolean) {
    shouldTranscribeRef.current = autoTranscribe;
    _stopVAD();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsListening(false);
    if (!autoTranscribe) { onTranscribeRef.current = null; setClusterState('idle'); }
  }

  const stopListening = useCallback(() => { _stopMic(false); }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // STT (V1 onstop exact)
  // ─────────────────────────────────────────────────────────────────────────

  async function _transcribe() {
    if (!chunksRef.current.length || !onTranscribeRef.current) {
      setClusterState('idle'); chunksRef.current = []; return;
    }
    const cb = onTranscribeRef.current;
    onTranscribeRef.current = null;
    setIsTranscribing(true);
    setClusterState('thinking');
    try {
      const blob   = new Blob(chunksRef.current);
      const buffer = await blob.arrayBuffer();
      const result = await window.nexus?.voice.transcribe(buffer);
      if (result?.text?.trim()) {
        cb(result.text.trim());
      } else {
        rlog('[STT] vide ou erreur: ' + (result?.error ?? 'no text'));
        setClusterState('idle');
      }
    } catch (e) {
      rlog('[STT] erreur: ' + String(e));
      setClusterState('idle');
    } finally {
      setIsTranscribing(false);
      chunksRef.current = [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { _stopMic(false); _cleanupTTS(); };
  }, []);

  return { isListening, isSpeaking, isTranscribing, startListening, stopListening, speak, stopSpeaking };
}
