/**
 * NEXUS — ChatOverlay
 *
 * Pipeline texte  : input → window.nexus.ai.chat() → affichage mot par mot
 * Pipeline voix   : Mic → VAD → STT → ai.chat() → TTS → cluster speaking
 *
 * Logique IA identique à V1 (sendMessage).
 * Voix identique à V1 (startListening / TTSSpeaker).
 */

import {
  useState, useRef, useEffect, useCallback,
  type FC, type KeyboardEvent, type ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ArrowUp, Loader2 } from 'lucide-react';

import { useClusterStore }  from '../cluster/useClusterStore';
import { useVoice }         from '../../hooks/useVoice';
import { easing }           from '../../theme';

// ─── window.nexus (Electron preload) ─────────────────────────────────────────

declare const window: Window & typeof globalThis & {
  nexus?: {
    ai: {
      chat: (messages: ChatMsg[], useCloud?: boolean) => Promise<AIResponse>;
    };
    chat: {
      getHistory  : (limit: number) => Promise<DBMsg[]>;
      saveMessage : (msg: { role: string; content: string; model?: string }) => Promise<unknown>;
    };
    voice: {
      speak     : (text: string, opts?: object) => Promise<{ audio: string; words: { word: string; timeMs: number }[] }>;
      stop      : () => void;
      transcribe: (buf: ArrayBuffer) => Promise<{ text?: string; error?: string }>;
    };
  };
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg    { role: 'user' | 'assistant'; content: string; }
interface DBMsg      { role: string; content: string; id?: number; }
interface AIResponse { content: string; model?: string; isLocal?: boolean; toolsUsed?: { name: string }[]; }
interface UserMsg    { id: string; text: string; }

// ─── Tokens ───────────────────────────────────────────────────────────────────

const STAR_BLUE   = '#4da6ff';
const CYAN        = '#00d4ff';
const EASE_SMOOTH = easing.smooth;

// ─── Hook — révélation mot par mot ────────────────────────────────────────────

function useWordReveal(text: string, wordsPerSec = 5) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!text) return;
    const words = text.split(/\s+/).filter(Boolean);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setCount(i);
      if (i >= words.length) clearInterval(iv);
    }, 1000 / wordsPerSec);
    return () => clearInterval(iv);
  }, [text, wordsPerSec]);

  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  return { words, count, isDone: count >= words.length && words.length > 0 };
}

// ─── Message utilisateur flottant ─────────────────────────────────────────────

const FloatingUserMessage: FC<{ text: string; index: number; onDismiss: () => void }> = ({
  text, index, onDismiss,
}) => {
  const cb = useCallback(onDismiss, []); // eslint-disable-line
  useEffect(() => { const t = setTimeout(cb, 6000); return () => clearTimeout(t); }, [cb]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: index * -48, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: index * -48 - 40, scale: 0.94, filter: 'blur(8px)',
        transition: { duration: 0.5, ease: EASE_SMOOTH } }}
      transition={{ duration: 0.4, ease: easing.cinematic }}
      style={{
        maxWidth: '520px', padding: '10px 20px',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px',
        textAlign: 'center', pointerEvents: 'none', userSelect: 'none',
      }}
    >
      <p style={{ fontSize: '17px', fontWeight: 300, lineHeight: 1.55,
        color: 'rgba(230,240,255,0.90)', textShadow: '0 0 16px rgba(255,255,255,0.20)',
        letterSpacing: '0.01em' }}>
        {text}
      </p>
    </motion.div>
  );
};

const UserMessageZone: FC<{ messages: UserMsg[]; onDismiss: (id: string) => void }> = ({
  messages, onDismiss,
}) => (
  <div style={{
    position: 'absolute', bottom: '200px', left: '64px', right: '0',
    display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
    gap: '0', pointerEvents: 'none',
  }}>
    <AnimatePresence mode="popLayout">
      {messages.map((msg, i) => (
        <FloatingUserMessage key={msg.id} text={msg.text} index={i}
          onDismiss={() => onDismiss(msg.id)} />
      ))}
    </AnimatePresence>
  </div>
);

// ─── Réponse IA ───────────────────────────────────────────────────────────────

const AIResponseDisplay: FC<{ text: string; isVisible: boolean; isThinking: boolean }> = ({
  text, isVisible, isThinking,
}) => {
  const { words, count } = useWordReveal(text);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.4 } }}
          transition={{ duration: 0.5, ease: easing.cinematic }}
          style={{
            position: 'absolute', bottom: '124px', left: '64px', right: '0',
            display: 'flex', justifyContent: 'center', padding: '0 32px',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{ opacity: isThinking ? [0.4, 0.7, 0.4] : 0.6 }}
            transition={{ duration: 2.5, repeat: isThinking ? Infinity : 0 }}
            style={{
              position: 'absolute', inset: '-40px -80px',
              background: 'radial-gradient(ellipse at center, rgba(77,166,255,0.07) 0%, transparent 70%)',
              filter: 'blur(20px)', pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', maxWidth: '600px', textAlign: 'center' }}>
            {isThinking ? (
              <motion.div
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', color: 'rgba(77,166,255,0.55)' }}
              >
                <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1.2s linear infinite' }} />
                <span style={{ fontSize: '13px', letterSpacing: '0.15em', fontWeight: 300 }}>
                  ANALYSE EN COURS
                </span>
              </motion.div>
            ) : (
              <p style={{ fontSize: '16px', fontWeight: 300, lineHeight: 1.7,
                letterSpacing: '0.01em', color: STAR_BLUE,
                textShadow: '0 0 20px rgba(77,166,255,0.45), 0 0 40px rgba(77,166,255,0.18)' }}>
                {words.slice(0, count).map((word, i) => (
                  <motion.span key={i}
                    initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {word}{' '}
                  </motion.span>
                ))}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Indicateur voix (listening / transcribing) ───────────────────────────────

const VoiceIndicator: FC<{ isListening: boolean; isTranscribing: boolean }> = ({
  isListening, isTranscribing,
}) => (
  <AnimatePresence>
    {(isListening || isTranscribing) && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'absolute', bottom: '96px', left: '64px', right: '0',
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px',
          background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.18)',
          borderRadius: '20px',
          backdropFilter: 'blur(12px)',
        }}>
          {isTranscribing ? (
            <>
              <Loader2 size={12} strokeWidth={1.5}
                style={{ color: CYAN, animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '11px', letterSpacing: '0.12em',
                color: 'rgba(0,212,255,0.7)', fontWeight: 400 }}>
                TRANSCRIPTION…
              </span>
            </>
          ) : (
            <>
              {/* Orbes pulsantes */}
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay }}
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: CYAN,
                    boxShadow: `0 0 6px ${CYAN}`,
                  }}
                />
              ))}
              <span style={{ fontSize: '11px', letterSpacing: '0.12em',
                color: 'rgba(0,212,255,0.7)', fontWeight: 400 }}>
                ÉCOUTE
              </span>
            </>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Barre de saisie ──────────────────────────────────────────────────────────

const InputBar: FC<{
  value: string;
  isListening: boolean;
  isSpeaking : boolean;
  isDisabled : boolean;
  onChange    : (v: string) => void;
  onSend      : () => void;
  onMicToggle : () => void;
}> = ({ value, isListening, isSpeaking, isDisabled, onChange, onSend, onMicToggle }) => {
  const [focused, setFocused] = useState(false);
  const hasContent = value.trim().length > 0;
  const micActive  = isListening || isSpeaking;

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && hasContent) { e.preventDefault(); onSend(); }
  };

  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? '0 0 0 1px rgba(0,212,255,0.35), 0 4px 32px rgba(0,212,255,0.12), 0 8px 48px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.3)',
      }}
      transition={{ duration: 0.25, ease: EASE_SMOOTH }}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        width: '100%', maxWidth: '600px', height: '56px', padding: '0 8px 0 20px',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${focused ? 'rgba(0,212,255,0.40)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '28px', transition: 'border-color 0.25s ease',
        pointerEvents: 'auto', willChange: 'box-shadow',
      }}
    >
      <input
        type="text" value={value} disabled={isDisabled}
        placeholder={isListening ? 'Écoute en cours…' : isSpeaking ? 'NEXUS parle…' : 'Parlez à NEXUS…'}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: 'rgba(230,240,255,0.90)', fontSize: '15px', fontWeight: 300,
          letterSpacing: '0.01em', caretColor: CYAN,
        }}
      />

      {/* Bouton micro — cyan si actif (écoute ou TTS), s'arrête au clic */}
      <motion.button
        onClick={onMicToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={{
          color : micActive ? CYAN : 'rgba(120,155,184,0.5)',
          filter: micActive ? 'drop-shadow(0 0 6px rgba(0,212,255,0.7))' : 'none',
        }}
        transition={{ duration: 0.18 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '50%',
          background: micActive ? 'rgba(0,212,255,0.10)' : 'transparent',
          border: 'none', cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.2s ease', pointerEvents: 'auto',
        }}
      >
        {micActive ? <MicOff size={18} strokeWidth={1.5} /> : <Mic size={18} strokeWidth={1.5} />}
      </motion.button>

      <motion.button
        onClick={onSend}
        disabled={!hasContent || isDisabled}
        whileHover={hasContent && !isDisabled ? { scale: 1.06 } : {}}
        whileTap={hasContent && !isDisabled ? { scale: 0.94 } : {}}
        animate={{
          background : hasContent && !isDisabled ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.04)',
          borderColor: hasContent && !isDisabled ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.06)',
          color      : hasContent && !isDisabled ? CYAN : 'rgba(120,155,184,0.30)',
          boxShadow  : hasContent && !isDisabled ? '0 0 14px rgba(0,212,255,0.20)' : 'none',
          filter     : hasContent && !isDisabled ? 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' : 'none',
        }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '38px', height: '38px', borderRadius: '50%', border: '1px solid',
          cursor: hasContent && !isDisabled ? 'pointer' : 'default',
          flexShrink: 0, pointerEvents: 'auto',
        }}
      >
        <ArrowUp size={17} strokeWidth={2} />
      </motion.button>
    </motion.div>
  );
};

// ─── ChatOverlay ──────────────────────────────────────────────────────────────

export const ChatOverlay: FC = () => {
  const [input,      setInput]      = useState('');
  const [userMsgs,   setUserMsgs]   = useState<UserMsg[]>([]);
  const [aiText,     setAiText]     = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showAI,     setShowAI]     = useState(false);

  // Historique texte (chargé depuis DB, contexte chat)
  const messagesRef     = useRef<ChatMsg[]>([]);
  // Historique voix SÉPARÉ (session seulement, identique V1 _homeMicHistory)
  // Évite la pollution par les anciens messages DB lors des requêtes vocales
  const voiceHistoryRef = useRef<ChatMsg[]>([]);
  const isTypingRef     = useRef(false);
  const currentMsgRef   = useRef('');
  const hideTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setClusterState }                                        = useClusterStore();
  const { isListening, isSpeaking, isTranscribing, startListening,
          stopListening, speak, stopSpeaking }                     = useVoice();

  // ── Chargement historique au mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const history = await window.nexus?.chat.getHistory(10);
        if (history?.length) {
          messagesRef.current = history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .reverse()
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        }
      } catch { /* DB non disponible hors Electron */ }
    })();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // handleSend — cœur V1, accepte texte override (voix) ou input (texte)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isTypingRef.current) return;

    isTypingRef.current = true;
    const isVoice = !!overrideText;

    // 1. Message flottant utilisateur
    const msgId = crypto.randomUUID();
    currentMsgRef.current = msgId;
    setUserMsgs(prev => [...prev, { id: msgId, text }]);
    if (!isVoice) setInput('');

    // 2. Historique :
    //    - voix → voiceHistoryRef (session, identique V1 _homeMicHistory)
    //    - texte → messagesRef (DB chargé)
    if (isVoice) {
      voiceHistoryRef.current.push({ role: 'user', content: text });
      if (voiceHistoryRef.current.length > 20)
        voiceHistoryRef.current.splice(0, voiceHistoryRef.current.length - 20);
    } else {
      messagesRef.current.push({ role: 'user', content: text });
    }

    // 3. Persist
    try {
      await window.nexus?.chat.saveMessage({ role: 'user', content: text });
    } catch {}

    // 4. Cluster thinking
    setClusterState('thinking');
    setIsThinking(true);
    setShowAI(true);
    setAiText('');
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    // 5. Context window 10 — voix = historique session propre, texte = DB
    const recentMessages = isVoice
      ? voiceHistoryRef.current.slice(-10)
      : messagesRef.current.slice(-10);

    try {
      // ── APPEL IDENTIQUE À V1 ────────────────────────────────────────────
      const response = await window.nexus!.ai.chat(recentMessages);
      // ────────────────────────────────────────────────────────────────────

      setIsThinking(false);
      setClusterState('speaking');
      setUserMsgs(prev => prev.filter(m => m.id !== currentMsgRef.current));

      const content = response.content || '';
      setAiText(content);

      // Historique réponse
      if (isVoice) {
        voiceHistoryRef.current.push({ role: 'assistant', content });
        if (voiceHistoryRef.current.length > 20)
          voiceHistoryRef.current.splice(0, voiceHistoryRef.current.length - 20);
      } else {
        messagesRef.current.push({ role: 'assistant', content });
      }
      try {
        await window.nexus?.chat.saveMessage({
          role: 'assistant', content, model: response.model,
        });
      } catch {}

      if (isVoice) {
        // ── Mode voix : TTS puis idle ──────────────────────────────────────
        await speak(content);           // bloque jusqu'à fin TTS
        setClusterState('idle');
        setShowAI(false);
        setAiText('');
        isTypingRef.current = false;

      } else {
        // ── Mode texte : auto-hide 7s ──────────────────────────────────────
        hideTimerRef.current = setTimeout(() => {
          setClusterState('idle');
          setShowAI(false);
          setAiText('');
          isTypingRef.current = false;
        }, 7000);
      }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setIsThinking(false);
      setClusterState('speaking');
      setUserMsgs(prev => prev.filter(m => m.id !== currentMsgRef.current));
      setAiText(`❌ Erreur : ${msg}`);
      hideTimerRef.current = setTimeout(() => {
        setClusterState('idle');
        setShowAI(false);
        setAiText('');
        isTypingRef.current = false;
      }, 6000);
    }
  }, [input, setClusterState, speak]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mic toggle — démarre écoute ou stop
  // ─────────────────────────────────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (isListening || isTranscribing) {
      // Arrêt manuel de l'écoute
      stopListening();
      return;
    }

    if (isSpeaking) {
      // Interruption TTS (barge-in)
      stopSpeaking();
      setClusterState('idle');
      setShowAI(false);
      setAiText('');
      isTypingRef.current = false;
      return;
    }

    // Démarrage écoute : callback appelé par VAD → STT
    startListening((transcribedText) => {
      handleSend(transcribedText);
    });
  }, [isListening, isTranscribing, isSpeaking,
      startListening, stopListening, stopSpeaking,
      setClusterState, handleSend]);

  const handleDismiss = useCallback((id: string) => {
    setUserMsgs(prev => prev.filter(m => m.id !== id));
  }, []);

  const isDisabled = isThinking || isTranscribing;

  return (
    <div
      aria-label="Interface conversationnelle NEXUS"
      style={{ position: 'fixed', inset: '0', zIndex: 25, pointerEvents: 'none' }}
    >
      <UserMessageZone messages={userMsgs} onDismiss={handleDismiss} />

      <AIResponseDisplay text={aiText} isVisible={showAI} isThinking={isThinking} />

      <VoiceIndicator isListening={isListening} isTranscribing={isTranscribing} />

      <div style={{
        position: 'absolute', bottom: '28px', left: '64px', right: '0',
        display: 'flex', justifyContent: 'center', padding: '0 24px',
        pointerEvents: 'none',
      }}>
        <InputBar
          value={input}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isDisabled={isDisabled}
          onChange={setInput}
          onSend={() => handleSend()}
          onMicToggle={handleMicToggle}
        />
      </div>
    </div>
  );
};

export default ChatOverlay;
