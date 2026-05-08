/**
 * NEXUS — SceneFlash
 *
 * Overlay plein-écran qui pulse lors d'un changement de scène.
 * Opacité 0 → 1 → 0 en 500ms. pointer-events: none.
 * z-index 50 : au-dessus de tout sauf le curseur.
 */

import { useEffect }          from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSceneStore, SCENES }   from './useSceneStore';

export function SceneFlash() {
  const isFlashing   = useSceneStore(s => s.isFlashing);
  const currentScene = useSceneStore(s => s.currentScene);
  const clearFlash   = useSceneStore(s => s.clearFlash);

  const scene = SCENES[currentScene];

  return (
    <AnimatePresence>
      {isFlashing && (
        <motion.div
          key={`flash-${currentScene}`}
          aria-hidden
          initial   ={{ opacity: 0 }}
          animate   ={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.50, times: [0, 0.25, 1], ease: 'easeOut' }}
          onAnimationComplete={() => clearFlash()}
          style={{
            position     : 'fixed',
            inset        : 0,
            zIndex       : 50,
            background   : scene.flashColor,
            pointerEvents: 'none',
          }}
        />
      )}
    </AnimatePresence>
  );
}
