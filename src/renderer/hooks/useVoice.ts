/**
 * NEXUS — useVoice
 *
 * STT : VAD (V1 exact) → Groq Whisper
 * TTS : new Audio(blobUrl).play() — SANS Web Audio API
 *       (createMediaElementSource coupe le playback sur pages HTTP)
 *       Amplitude simulée pour les visuels cluster.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../components/cluster/useClusterStore';

// ─── Config VAD (V1 exact) ────────────────────────────────────────────────────
const VAD_FFT_SIZE     = 512;
const VAD_SENSITIVITY  = 0.8;
const VAD_THRESHOLD    = Math.round(30 - VAD_SENSITIVITY * 25); // = 10
const SILENCE_MS       = 1200;

// ─── Types ────────────────────────────────────────────────────────────────────
interface TTSResult { audio: string; words: { word: string; timeMs: number }[]; }

declare const window: Window & typeof globalThis & {
  nexus?: {
    voice: {
      speak     : (text: string, opts?: object) => Promise<TTSResult>;
      stop      : () => void;
      transcribe: (buf: ArrayBuffer) => Promise<{ text?: string; error?: string }>;
    };
  };
};

// ─────────────────────────────────────────────────────────────────────────────

export function useVoice() {
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const { setAmplitude, setClusterState } = useClusterStore();

  // ── Mic / VAD ────────────────────────────────────────────────────────────
  const streamRef           = useRef<MediaStream | null>(null);
  const recorderRef         = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);
  const vadCtxRef           = useRef<AudioContext | null>(null);
  const vadRafRef           = useRef<number>(0);
  const vadSpeechDetectedRef = useRef(false);  // V1 : vadSpeechDetected
  const vadLastSpeechRef    = useRef<number>(0);
  const vadActiveRef        = useRef(false);
  const shouldTranscribeRef = useRef(false);
  const onTranscribeRef     = useRef<((text: string) => void) | null>(null);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const audioElRef    = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef    = useRef<string | null>(null);
  const ampTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef    = useRef(false);
  const resolveTTSRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — _cleanupTTS
  // Null l'élément EN PREMIER pour éviter la récursion via onended/onerror
  // ─────────────────────────────────────────────────────────────────────────

  function _cleanupTTS() {
    if (ampTimerRef.current) { clearInterval(ampTimerRef.current); ampTimerRef.current = null; }
    setAmplitude(0);
    setIsSpeaking(false);

    if (audioElRef.current) {
      const el = audioElRef.current;
      audioElRef.current = null;  // null AVANT tout pour éviter re-entrée
      el.onended = null;
      el.onerror = null;
      el.pause();
      el.src = '';
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — speak
  // Lecture directe new Audio(blobUrl).play() — pas de Web Audio API
  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    // Stop précédent (V1 : stop() en début de speak)
    stoppedRef.current = true;
    window.nexus?.voice.stop();
    _cleanupTTS();
    stoppedRef.current = false;

    let result: TTSResult | undefined;
    try { result = await window.nexus?.voice.speak(text); }
    catch (e) { console.error('[TTS] IPC error:', e); return; }

    if (!result?.audio || stoppedRef.current) {
      console.warn('[TTS] Pas de données ou stopped');
      return;
    }

    // Base64 → Blob URL (V1 _mp3BlobUrl)
    const bin = atob(result.audio);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
    blobUrlRef.current = url;

    const el = new Audio(url);
    audioElRef.current = el;
    setIsSpeaking(true);

    // Amplitude simulée 0.3–0.75 @ 120ms pour les visuels cluster
    ampTimerRef.current = setInterval(() => {
      if (!stoppedRef.current) setAmplitude(0.3 + Math.random() * 0.45);
    }, 120);

    // Attente fin lecture — résolution via onended/_fire ou stopSpeaking
    await new Promise<void>((resolve) => {
      resolveTTSRef.current = resolve;

      el.onended = () => {
        console.log('[TTS] ended');
        _cleanupTTS();
        const cb = resolveTTSRef.current;
        resolveTTSRef.current = null;
        cb?.();
      };

      el.onerror = () => {
        console.error('[TTS] audio element error');
        _cleanupTTS();
        const cb = resolveTTSRef.current;
        resolveTTSRef.current = null;
        cb?.();
      };

      el.play().catch((e) => {
        console.error('[TTS] play() refusé:', e);
        _cleanupTTS();
        resolveTTSRef.current = null;
        resolve();
      });
    });
  }, [setAmplitude]);

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — stopSpeaking (V1 TTSSpeaker.stop + _fire)
  // ─────────────────────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    window.nexus?.voice.stop();
    _cleanupTTS();
    // _fire() → résout le Promise await dans speak() si interrompu
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

    vadCtxRef.current          = ctx;
    vadActiveRef.current       = true;
    vadSpeechDetectedRef.current = false;  // V1 : vadSpeechDetected = false
    vadLastSpeechRef.current   = 0;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function checkSilence() {
      if (!vadActiveRef.current) return;

      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avgVolume = sum / data.length;

      if (avgVolume > VAD_THRESHOLD) {
        vadSpeechDetectedRef.current = true;  // V1 : vadSpeechDetected = true
        vadLastSpeechRef.current     = Date.now();
      } else if (
        vadSpeechDetectedRef.current &&                              // V1 : && vadSpeechDetected
        Date.now() - vadLastSpeechRef.current > SILENCE_MS
      ) {
        // Silence suffisant après parole → arrêt + transcription
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

      recorder.start();  // V1 : start() sans timeslice
      _startVAD(stream);
      setIsListening(true);
      setClusterState('listening');
    } catch (e) {
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
        console.warn('[STT] vide ou erreur:', result?.error);
        setClusterState('idle');
      }
    } catch (e) {
      console.error('[STT] erreur:', e);
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
