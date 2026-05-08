/**
 * NEXUS — SceneToast
 *
 * Toast cinématique affiché 2.5s lors d'un changement de scène.
 * Entrée : opacity+y+blur. Sortie : opacity+y+blur inversés.
 * Position : bas-centre, au-dessus des widgets (z-45) mais sous le chat (z-25)...
 * en fait z-45 est au-dessus du chat (z-25). Chat est à 25, toast à 45.
 */

import { useEffect }               from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneStore }           from './useSceneStore';

const TOAST_DURATION_MS = 2500;

export function SceneToast() {
  const toastScene = useSceneStore(s => s.toastScene);
  const clearToast = useSceneStore(s => s.clearToast);

  useEffect(() => {
    if (!toastScene) return;
    const t = setTimeout(clearToast, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toastScene, clearToast]);

  return (
    <div
      style={{
        position     : 'fixed',
        bottom       : '36px',
        left         : '50%',
        transform    : 'translateX(-50%)',
        zIndex       : 45,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {toastScene && (
          <motion.div
            key={toastScene.id}
            initial   ={{ opacity: 0, y: 16,  scale: 0.94, filter: 'blur(6px)' }}
            animate   ={{ opacity: 1, y: 0,   scale: 1,    filter: 'blur(0px)' }}
            exit      ={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ duration: 0.40, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display            : 'flex',
              alignItems         : 'center',
              gap                : '14px',
              padding            : '11px 22px',
              background         : 'rgba(3,5,13,0.88)',
              backdropFilter     : 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border             : `1px solid ${toastScene.accent}28`,
              borderRadius       : '16px',
              boxShadow          : `0 0 28px ${toastScene.accent}1a, 0 8px 40px rgba(0,0,0,0.45)`,
              whiteSpace         : 'nowrap',
            }}
          >
            {/* Emoji scène */}
            <span style={{ fontSize: '20px', lineHeight: 1 }}>
              {toastScene.emoji}
            </span>

            {/* Textes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                fontSize     : '10px',
                letterSpacing: '0.16em',
                fontWeight   : 600,
                color        : toastScene.accent,
                textTransform: 'uppercase',
              }}>
                Scène activée
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '15px', color: 'rgba(220,235,255,0.92)', fontWeight: 300 }}>
                  {toastScene.label}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)' }}>
                  — {toastScene.desc}
                </span>
              </div>
            </div>

            {/* Barre de progression */}
            <motion.div
              style={{
                position    : 'absolute',
                bottom      : 0,
                left        : '20px',
                right       : '20px',
                height      : '1px',
                background  : `${toastScene.accent}40`,
                borderRadius: '1px',
                transformOrigin: 'left',
              }}
              initial   ={{ scaleX: 1 }}
              animate   ={{ scaleX: 0 }}
              transition={{ duration: TOAST_DURATION_MS / 1000, ease: 'linear', delay: 0.05 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
