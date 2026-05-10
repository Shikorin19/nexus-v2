/**
 * NEXUS — ChatOverlay
 *
 * Expérience conversationnelle immersive — IA réelle branchée :
 *   • Streaming Gemini 2.5 Flash token par token via IPC
 *   • Historique 10 messages chargé depuis la DB au mount
 *   • Persistance DB (user + assistant) après chaque échange
 *   • Fallback Ollama local si Gemini indisponible (géré côté router)
 *   • Tools/function calling transparent (géré côté main)
 *
 * z-index 25 — au-dessus de la sidebar (z-20)
 */

import {
  useState, useRef, useEffect, useCallback,
  type FC, type KeyboardEvent, type ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, ArrowUp, Loader2 } from 'lucide-react';

import { useClusterStore } from '../cluster/useClusterStore';
import { easing }          from '../../theme';

// ─── Types window.nexus (Electron preload) ────────────────────────────────────

declare const window: Window & typeof globalThis & {
  nexus: {
    ai: {
      streamChat   : (messages: ChatMessage[]) => Promise<void>;
      onStreamChunk: (cb: (chunk: StreamChunk) => void) => void;
      onStreamDone : (cb: () => void) => void;
      offStream    : () => void;
    };
    chat: {
      getHistory  : (limit: number) => Promise<DBMessage[]>;
      saveMessage : (msg: { role: string; content: string }) => Promise<unknown>;
    };
  };
};

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface DBMessage   { role: string; content: string; id?: number; created_at?: string; }
interface StreamChunk { type: 'text' | 'tool_result' | 'done' | 'error'; content?: string; }
interface UserMsg     { id: string; text: string; createdAt: number; }

// ─── Tokens UI ────────────────────────────────────────────────────────────────

const STAR_BLUE   = '#4da6ff';
const CYAN        = '#00d4ff';
const EASE_SMOOTH = easing.smooth;

// ─── Message utilisateur flottant ─────────────────────────────────────────────

interface FloatingMsgProps { text: string; index: number; onDismiss: () => void; }

const FloatingUserMessage: FC<FloatingMsgProps> = ({ text, index, onDismiss }) => {
  const stableDismiss = useCallback(onDismiss, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(stableDismiss, 6000);
    return () => clearTimeout(t);
  }, [stableDismiss]);

  const offsetY = index * -48;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: offsetY, scale: 1, filter: 'blur(0px)' }}
      exit={{
        opacity: 0, y: offsetY - 40, scale: 0.94, filter: 'blur(8px)',
        transition: { duration: 0.5, ease: EASE_SMOOTH },
      }}
      transition={{ duration: 0.4, ease: easing.cinematic }}
      style={{
        maxWidth     : '520px',
        padding      : '10px 20px',
        background   : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border       : '1px solid rgba(255,255,255,0.07)',
        borderRadius : '20px',
        textAlign    : 'center',
        pointerEvents: 'none',
        userSelect   : 'none',
      }}
    >
      <p style={{
        fontSize  : '17px', fontWeight: 300, lineHeight: 1.55,
        color     : 'rgba(230,240,255,0.90)',
        textShadow: '0 0 16px rgba(255,255,255,0.20)',
        letterSpacing: '0.01em',
      }}>
        {text}
      </p>
    </motion.div>
  );
};

const UserMessageZone: FC<{ messages: UserMsg[]; onDismiss: (id: string) => void }> = ({ messages, onDismiss }) => (
  <div style={{
    position     : 'absolute',
    bottom       : '200px',
    left         : '64px',
    right        : '0',
    display      : 'flex',
    flexDirection: 'column-reverse',
    alignItems   : 'center',
    gap          : '0',
    pointerEvents: 'none',
  }}>
    <AnimatePresence mode="popLayout">
      {messages.map((msg, i) => (
        <FloatingUserMessage
          key={msg.id}
          text={msg.text}
          index={i}
          onDismiss={() => onDismiss(msg.id)}
        />
      ))}
    </AnimatePresence>
  </div>
);

// ─── Réponse IA — affichage direct (le streaming = l'animation) ───────────────

const AIResponseDisplay: FC<{ text: string; isVisible: boolean; isThinking: boolean }> = ({
  text, isVisible, isThinking,
}) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.4 } }}
        transition={{ duration: 0.5, ease: easing.cinematic }}
        style={{
          position      : 'absolute',
          bottom        : '124px',
          left          : '64px',
          right         : '0',
          display       : 'flex',
          justifyContent: 'center',
          padding       : '0 32px',
          pointerEvents : 'none',
        }}
      >
        {/* Halo ambiant */}
        <motion.div
          animate={{ opacity: isThinking ? [0.4, 0.7, 0.4] : 0.6 }}
          transition={{ duration: 2.5, repeat: isThinking ? Infinity : 0 }}
          style={{
            position  : 'absolute',
            inset     : '-40px -80px',
            background: 'radial-gradient(ellipse at center, rgba(77,166,255,0.07) 0%, transparent 70%)',
            filter    : 'blur(20px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', maxWidth: '600px', textAlign: 'center' }}>
          {isThinking ? (
            <motion.div
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                display       : 'flex',
                alignItems    : 'center',
                justifyContent: 'center',
                gap           : '10px',
                color         : 'rgba(77,166,255,0.55)',
              }}
            >
              <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1.2s linear infinite' }} />
              <span style={{ fontSize: '13px', letterSpacing: '0.15em', fontWeight: 300 }}>
                ANALYSE EN COURS
              </span>
            </motion.div>
          ) : (
            /* Texte streamé — apparaît token par token naturellement */
            <p style={{
              fontSize     : '16px',
              fontWeight   : 300,
              lineHeight   : 1.7,
              letterSpacing: '0.01em',
              color        : STAR_BLUE,
              textShadow   : '0 0 20px rgba(77,166,255,0.45), 0 0 40px rgba(77,166,255,0.18)',
              whiteSpace   : 'pre-wrap',
            }}>
              {text}
            </p>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Barre de saisie ──────────────────────────────────────────────────────────

interface InputBarProps {
  value       : string;
  isListening : boolean;
  isDisabled  : boolean;
  onChange    : (v: string) => void;
  onSend      : () => void;
  onMicToggle : () => void;
}

const InputBar: FC<InputBarProps> = ({ value, isListening, isDisabled, onChange, onSend, onMicToggle }) => {
  const [focused, setFocused] = useState(false);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSend();
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? '0 0 0 1px rgba(0,212,255,0.35), 0 4px 32px rgba(0,212,255,0.12), 0 8px 48px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.3)',
      }}
      transition={{ duration: 0.25, ease: EASE_SMOOTH }}
      style={{
        display       : 'flex',
        alignItems    : 'center',
        gap           : '4px',
        width         : '100%',
        maxWidth      : '600px',
        height        : '56px',
        padding       : '0 8px 0 20px',
        background    : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border        : `1px solid ${focused ? 'rgba(0,212,255,0.40)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius  : '28px',
        transition    : 'border-color 0.25s ease',
        pointerEvents : 'auto',
        willChange    : 'box-shadow',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={isDisabled}
        placeholder="Parlez à NEXUS…"
        style={{
          flex         : 1,
          background   : 'transparent',
          border       : 'none',
          outline      : 'none',
          color        : 'rgba(230,240,255,0.90)',
          fontSize     : '15px',
          fontWeight   : 300,
          letterSpacing: '0.01em',
          caretColor   : CYAN,
        }}
      />

      {/* Bouton micro */}
      <motion.button
        onClick={onMicToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={{
          color : isListening ? CYAN : 'rgba(120,155,184,0.5)',
          filter: isListening ? 'drop-shadow(0 0 6px rgba(0,212,255,0.7))' : 'none',
        }}
        transition={{ duration: 0.18 }}
        style={{
          display       : 'flex',
          alignItems    : 'center',
          justifyContent: 'center',
          width         : '36px',
          height        : '36px',
          borderRadius  : '50%',
          background    : isListening ? 'rgba(0,212,255,0.10)' : 'transparent',
          border        : 'none',
          cursor        : 'pointer',
          flexShrink    : 0,
          transition    : 'background 0.2s ease',
          pointerEvents : 'auto',
        }}
      >
        {isListening ? <MicOff size={18} strokeWidth={1.5} /> : <Mic size={18} strokeWidth={1.5} />}
      </motion.button>

      {/* Bouton envoi */}
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
          display       : 'flex',
          alignItems    : 'center',
          justifyContent: 'center',
          width         : '38px',
          height        : '38px',
          borderRadius  : '50%',
          border        : '1px solid',
          cursor        : hasContent && !isDisabled ? 'pointer' : 'default',
          flexShrink    : 0,
          pointerEvents : 'auto',
        }}
      >
        <ArrowUp size={17} strokeWidth={2} />
      </motion.button>
    </motion.div>
  );
};

// ─── ChatOverlay principal ────────────────────────────────────────────────────

export const ChatOverlay: FC = () => {
  const [input,       setInput]       = useState('');
  const [isListening, setIsListening] = useState(false);
  const [userMsgs,    setUserMsgs]    = useState<UserMsg[]>([]);
  const [aiText,      setAiText]      = useState('');
  const [isThinking,  setIsThinking]  = useState(false);
  const [showAI,      setShowAI]      = useState(false);
  const [history,     setHistory]     = useState<ChatMessage[]>([]);

  const { setClusterState } = useClusterStore();

  // Refs pour éviter les stale closures dans les callbacks IPC
  const hideTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMsgIdRef = useRef<string | null>(null);
  const hasFirstChunk   = useRef(false);
  const accumulated     = useRef('');
  const isBusy          = useRef(false);

  // ── Chargement de l'historique au démarrage ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await window.nexus.chat.getHistory(10);
        if (raw?.length) {
          // DB renvoie du plus récent au plus ancien — on inverse
          const msgs: ChatMessage[] = raw
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .reverse()
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          setHistory(msgs);
        }
      } catch {
        // DB non dispo (dev sans Electron) — OK, on démarre vide
      }
    })();

    return () => {
      // Cleanup au démontage
      try { window.nexus.ai.offStream(); } catch {}
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ── Envoi d'un message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isBusy.current) return;
    isBusy.current = true;

    // 1. Message flottant + reset input
    const msgId = crypto.randomUUID();
    currentMsgIdRef.current = msgId;
    setUserMsgs(prev => [...prev, { id: msgId, text, createdAt: Date.now() }]);
    setInput('');

    // 2. Reset UI + cluster thinking
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setClusterState('thinking');
    setIsThinking(true);
    setShowAI(true);
    setAiText('');
    accumulated.current  = '';
    hasFirstChunk.current = false;

    // 3. Contexte : historique + nouveau message utilisateur (fenêtre 10 msg)
    const newHistory: ChatMessage[] = [
      ...history,
      { role: 'user', content: text },
    ].slice(-10);
    setHistory(newHistory);

    // 4. Persistance message utilisateur
    try {
      await window.nexus.chat.saveMessage({ role: 'user', content: text });
    } catch {}

    // 5. Nettoyage des listeners précédents
    try { window.nexus.ai.offStream(); } catch {}

    // 6. Handler chunk — mis à jour au fil du streaming
    window.nexus.ai.onStreamChunk((chunk: StreamChunk) => {
      if (chunk.type === 'text' && chunk.content) {
        // Premier chunk : bascule thinking → speaking
        if (!hasFirstChunk.current) {
          hasFirstChunk.current = true;
          setIsThinking(false);
          setClusterState('speaking');
          // Retire le message flottant utilisateur dès que l'IA commence à répondre
          setUserMsgs(prev => prev.filter(m => m.id !== currentMsgIdRef.current));
        }
        accumulated.current += chunk.content;
        setAiText(accumulated.current);
      }
      // chunk.type === 'tool_result' : géré silencieusement côté main
    });

    // 7. Handler done — appelé quand le stream est terminé
    window.nexus.ai.onStreamDone(async () => {
      const full = accumulated.current;

      // Fallback si aucun texte reçu (ex: réponse tool-only)
      if (!hasFirstChunk.current) {
        setIsThinking(false);
        setClusterState('speaking');
        setUserMsgs(prev => prev.filter(m => m.id !== currentMsgIdRef.current));
        if (!full) setAiText('Action effectuée.');
      }

      // Persistance réponse assistant
      if (full) {
        try {
          await window.nexus.chat.saveMessage({ role: 'assistant', content: full });
        } catch {}
        setHistory(prev =>
          [...prev, { role: 'assistant', content: full }].slice(-10)
        );
      }

      // Auto-masquage après lecture (~7s)
      hideTimerRef.current = setTimeout(() => {
        setClusterState('idle');
        setShowAI(false);
        setAiText('');
        isBusy.current = false;
      }, 7000);
    });

    // 8. Déclenche le stream (IPC invoke → main → routeMessageStream → Gemini)
    try {
      await window.nexus.ai.streamChat(newHistory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vérifiez votre clé API Gemini dans les Paramètres.';
      setIsThinking(false);
      setClusterState('speaking');
      setUserMsgs(prev => prev.filter(m => m.id !== currentMsgIdRef.current));
      setAiText(`Erreur IA : ${msg}`);
      hideTimerRef.current = setTimeout(() => {
        setClusterState('idle');
        setShowAI(false);
        setAiText('');
        isBusy.current = false;
      }, 6000);
    }
  }, [input, history, setClusterState]);

  // ── Toggle micro (voix — prompt suivant) ────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    setIsListening(prev => {
      const next = !prev;
      setClusterState(next ? 'listening' : 'idle');
      return next;
    });
  }, [setClusterState]);

  // ── Dismiss message flottant ─────────────────────────────────────────────────
  const handleDismiss = useCallback((id: string) => {
    setUserMsgs(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      aria-label="Interface conversationnelle NEXUS"
      style={{
        position     : 'fixed',
        inset        : '0',
        zIndex       : 25,
        pointerEvents: 'none',
      }}
    >
      {/* Messages utilisateur flottants */}
      <UserMessageZone messages={userMsgs} onDismiss={handleDismiss} />

      {/* Réponse IA streamée */}
      <AIResponseDisplay
        text={aiText}
        isVisible={showAI}
        isThinking={isThinking}
      />

      {/* Barre de saisie */}
      <div style={{
        position      : 'absolute',
        bottom        : '28px',
        left          : '64px',
        right         : '0',
        display       : 'flex',
        justifyContent: 'center',
        padding       : '0 24px',
        pointerEvents : 'none',
      }}>
        <InputBar
          value={input}
          isListening={isListening}
          isDisabled={isThinking}
          onChange={setInput}
          onSend={handleSend}
          onMicToggle={handleMicToggle}
        />
      </div>
    </div>
  );
};

export default ChatOverlay;
