/**
 * NEXUS — useVoice
 *
 * Port exact de la V1 :
 *   TTSSpeaker  → speak() / stopSpeaking()
 *   startListening / stopListening → VAD + Groq Whisper STT
 *
 * TTS = new Audio(blobUrl) + AudioContext + createMediaElementSource
 *       + getByteTimeDomainData (identique V1 _pollAmp)
 *       + await ctx.resume() AVANT play (identique V1)
 *       + _fire() pattern via resolveTTSRef
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClusterStore } from '../components/cluster/useClusterStore';

// ─── VAD Config (V1) ─────────────────────────────────────────────────────────
const VAD_FFT_SIZE  = 512;
const VAD_THRESHOLD = 10;    // round(30 - 0.8*25) = 10
const SILENCE_MS    = 1200;

// ─── Types ────────────────────────────────────────────────────────────────────
interface TTSResult {
  audio : string;
  words : { word: string; timeMs: number }[];
}

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
  const lastSpeechRef       = useRef<number>(0);
  const vadActiveRef        = useRef(false);
  const shouldTranscribeRef = useRef(false);
  const onTranscribeRef     = useRef<((text: string) => void) | null>(null);

  // ── TTS (V1 TTSSpeaker) ──────────────────────────────────────────────────
  const audioElRef     = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef     = useRef<string | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const ampAnalyserRef = useRef<AnalyserNode | null>(null);
  const ampRafRef      = useRef<number>(0);
  const stoppedRef     = useRef(false);
  const resolveTTSRef  = useRef<(() => void) | null>(null); // _fire() V1

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — _pollAmp (identique V1 getByteTimeDomainData)
  // ─────────────────────────────────────────────────────────────────────────

  function _pollAmp() {
    if (!ampAnalyserRef.current || stoppedRef.current) return;
    const buf = new Uint8Array(ampAnalyserRef.current.frequencyBinCount);
    ampAnalyserRef.current.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += Math.abs(v - 128);
    const amp = (sum / buf.length) / 128;
    setAmplitude(amp);
    ampRafRef.current = requestAnimationFrame(_pollAmp);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — _cleanup (identique V1 _cleanup)
  // ─────────────────────────────────────────────────────────────────────────

  function _cleanupTTS() {
    cancelAnimationFrame(ampRafRef.current);
    ampRafRef.current = 0;

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (ampAnalyserRef.current) {
      ampAnalyserRef.current.disconnect();
      ampAnalyserRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAmplitude(0);
    setIsSpeaking(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — speak (port exact V1 TTSSpeaker.speak)
  // ─────────────────────────────────────────────────────────────────────────

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    // Stop toute instance précédente (V1 : stop() en début de speak)
    stoppedRef.current = true;
    window.nexus?.voice.stop();
    _cleanupTTS();
    stoppedRef.current = false;

    let result: TTSResult | undefined;
    try {
      result = await window.nexus?.voice.speak(text);
    } catch (e) {
      console.error('[TTS] IPC speak error:', e);
      return;
    }

    if (!result?.audio || stoppedRef.current) {
      console.warn('[TTS] Pas de données audio ou stopped');
      return;
    }

    console.log('[TTS] Audio reçu, base64 length:', result.audio.length);

    // Base64 → Blob URL (V1 _mp3BlobUrl)
    const bin = atob(result.audio);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
    blobUrlRef.current = url;

    const el = new Audio(url);
    audioElRef.current = el;

    // AudioContext + AnalyserNode (identique V1)
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const src = ctx.createMediaElementSource(el);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current    = ctx;
    ampAnalyserRef.current = analyser;

    // play event → _pollAmp (V1 exact)
    el.addEventListener('play', () => { _pollAmp(); }, { once: true });

    // onended → setAmplitude(0) + cleanup + _fire() (V1 exact)
    el.onended = () => {
      setAmplitude(0);
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

    // resume AVANT play (V1 : await _ctx.resume().catch(() => {}))
    await ctx.resume().catch(() => {});
    setIsSpeaking(true);

    // Attente fin TTS via _fire() callback (pattern V1 exact)
    await new Promise<void>((resolve) => {
      resolveTTSRef.current = resolve;
      el.play().catch((e) => {
        console.error('[TTS] play() refusé:', e);
        _cleanupTTS();
        resolveTTSRef.current = null;
        resolve();
      });
    });
  }, [setAmplitude]);

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — stopSpeaking (V1 TTSSpeaker.stop)
  // ─────────────────────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    stoppedRef.current = true;
    setAmplitude(0);
    window.nexus?.voice.stop();
    _cleanupTTS();
    // _fire() — résout le Promise await si interrompu
    const cb = resolveTTSRef.current;
    resolveTTSRef.current = null;
    cb?.();
  }, [setAmplitude]);

  // ─────────────────────────────────────────────────────────────────────────
  // VAD
  // ─────────────────────────────────────────────────────────────────────────

  function _startVAD(stream: MediaStream) {
    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = VAD_FFT_SIZE;
    source.connect(analyser);

    vadCtxRef.current     = ctx;
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
        if (shouldTranscribeRef.current) await _transcribe();
        else chunksRef.current = [];
      };

      recorder.start(100);
      _startVAD(stream);
      setIsListening(true);
      setClusterState('listening');
    } catch (e) {
      console.error('[Voice] Micro:', e);
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
  // STT
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
      const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const result = await window.nexus?.voice.transcribe(buffer);
      console.log('[STT] résultat:', result);
      if (result?.text?.trim()) cb(result.text.trim());
      else { console.warn('[STT] vide', result?.error); setClusterState('idle'); }
    } catch (e) {
      console.error('[STT] erreur:', e); setClusterState('idle');
    } finally {
      setIsTranscribing(false); chunksRef.current = [];
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
