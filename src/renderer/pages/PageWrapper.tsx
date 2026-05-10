/**
 * NEXUS — PageWrapper
 * Conteneur commun pour toutes les pages : fade + slide 400ms.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

const variants = {
  initial : { opacity: 0, y: 16 },
  animate : { opacity: 1, y: 0,  transition: { duration: 0.38, ease: EASE } },
  exit    : { opacity: 0, y: -8, transition: { duration: 0.22, ease: EASE } },
};

export function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        position  : 'relative',
        minHeight : '100vh',
        padding   : '28px 32px 140px 32px',
        color     : 'rgba(200, 220, 240, 0.9)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {children}
    </motion.div>
  );
}
