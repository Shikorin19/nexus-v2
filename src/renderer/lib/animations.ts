/**
 * NEXUS — Helpers d'animation Framer Motion
 *
 * Variants réutilisables : fadeUp · glowPulse · holographicEnter
 * + helpers de transition + stagger factory
 */

import type { Variants, Transition } from 'framer-motion';
import { duration, easing } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS DE BASE
// ─────────────────────────────────────────────────────────────────────────────

export const t = {
  fast: {
    duration: duration.fast,
    ease: easing.smooth,
  } satisfies Transition,

  normal: {
    duration: duration.normal,
    ease: easing.smooth,
  } satisfies Transition,

  cinematic: {
    duration: duration.cinematic,
    ease: easing.cinematic,
  } satisfies Transition,

  glide: {
    duration: duration.slow,
    ease: easing.glide,
  } satisfies Transition,

  spring: easing.spring satisfies Transition,
  springGentle: easing.springGentle satisfies Transition,
  springFloat: easing.springFloat satisfies Transition,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY : STAGGER ENFANTS
// Usage : <motion.ul variants={stagger(0.08)}> + chaque li utilise un variant enfant
// ─────────────────────────────────────────────────────────────────────────────

export const stagger = (
  staggerChildren = 0.07,
  delayChildren = 0,
): Variants => ({
  hidden:  {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
  exit: {
    transition: { staggerChildren: staggerChildren * 0.5, staggerDirection: -1 },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FADE UP — Apparition douce depuis le bas
// Usages : listes, cartes, paragraphes
// ─────────────────────────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: duration.normal,
      ease: easing.cinematic,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: {
      duration: duration.fast,
      ease: easing.smooth,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FADE IN — Fondu simple, centré
// ─────────────────────────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal, ease: easing.smooth },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast, ease: easing.smooth },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE IN — Glissement latéral (HUD panels)
// ─────────────────────────────────────────────────────────────────────────────

export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -40, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: duration.slow, ease: easing.cinematic },
  },
  exit: {
    opacity: 0,
    x: -24,
    filter: 'blur(4px)',
    transition: { duration: duration.fast, ease: easing.power },
  },
};

export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 40, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: duration.slow, ease: easing.cinematic },
  },
  exit: {
    opacity: 0,
    x: 24,
    filter: 'blur(4px)',
    transition: { duration: duration.fast, ease: easing.power },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOW PULSE — Pulsation de lumière ambiante
// Usage : <motion.div animate="pulse" variants={glowPulse('#00d4ff')} />
// ─────────────────────────────────────────────────────────────────────────────

export const glowPulse = (
  color = '0, 212, 255',
  intensity = 0.5,
): Variants => ({
  idle: {
    boxShadow: `0 0 20px rgba(${color}, ${intensity * 0.4}), 0 0 6px rgba(${color}, ${intensity * 0.2})`,
  },
  pulse: {
    boxShadow: [
      `0 0 20px rgba(${color}, ${intensity * 0.4}), 0 0 6px rgba(${color}, ${intensity * 0.2})`,
      `0 0 50px rgba(${color}, ${intensity}), 0 0 20px rgba(${color}, ${intensity * 0.6}), 0 0 4px rgba(${color}, 0.9)`,
      `0 0 20px rgba(${color}, ${intensity * 0.4}), 0 0 6px rgba(${color}, ${intensity * 0.2})`,
    ],
    transition: {
      duration: duration.ambient,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  hover: {
    boxShadow: `0 0 40px rgba(${color}, ${intensity * 0.8}), 0 0 12px rgba(${color}, ${intensity * 0.5})`,
    transition: { duration: duration.fast, ease: easing.smooth },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEXT GLOW PULSE — Pulsation sur du texte cyan
// ─────────────────────────────────────────────────────────────────────────────

export const textGlowPulse: Variants = {
  idle: {
    textShadow: '0 0 12px rgba(0, 212, 255, 0.50)',
  },
  pulse: {
    textShadow: [
      '0 0 12px rgba(0, 212, 255, 0.50)',
      '0 0 30px rgba(0, 212, 255, 0.90), 0 0 60px rgba(0, 212, 255, 0.40)',
      '0 0 12px rgba(0, 212, 255, 0.50)',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HOLOGRAPHIC ENTER — Entrée holographique
// Combine : scale depuis 0.92, opacity, blur, légère distorsion Y, scan-line opacity
// Usage : panneaux principaux, éléments hero, modales
// ─────────────────────────────────────────────────────────────────────────────

export const holographicEnter: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 12,
    filter: 'blur(12px) brightness(1.8)',
    rotateX: 4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px) brightness(1)',
    rotateX: 0,
    transition: {
      duration: duration.cinematic,
      ease: easing.cinematic,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    filter: 'blur(8px) brightness(1.4)',
    rotateX: -2,
    transition: {
      duration: duration.fast,
      ease: easing.power,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HOLOGRAPHIC FLICKER — Scintillement holographique (instabilité douce)
// Usage : animate="flicker" sur des éléments HUD décoratifs
// ─────────────────────────────────────────────────────────────────────────────

export const holographicFlicker: Variants = {
  stable: { opacity: 1 },
  flicker: {
    opacity: [1, 0.85, 1, 0.92, 0.78, 1, 0.95, 1],
    transition: {
      duration: 0.5,
      times: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.85, 1],
      ease: 'linear',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCAN LINE — Balayage lumineux (effet HUD)
// Usage : pseudo-animation sur un élément overlay absolu
// ─────────────────────────────────────────────────────────────────────────────

export const scanLine: Variants = {
  hidden:  { y: '-100%', opacity: 0.6 },
  visible: {
    y: '120%',
    opacity: [0, 0.5, 0.5, 0],
    transition: {
      duration: 1.8,
      ease: 'linear',
      repeat: Infinity,
      repeatDelay: 3,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC REVEAL — Révélation dramatique d'un bloc entier
// Usage : sections hero, splash screen
// ─────────────────────────────────────────────────────────────────────────────

export const cinematicReveal: Variants = {
  hidden: {
    opacity: 0,
    scale: 1.04,
    filter: 'blur(20px) brightness(2)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px) brightness(1)',
    transition: {
      duration: duration.dramatic,
      ease: easing.reveal,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT FLOAT — Lévitation douce (icônes, logos, éléments en suspension)
// ─────────────────────────────────────────────────────────────────────────────

export const ambientFloat: Variants = {
  float: {
    y: [0, -8, 0],
    transition: {
      duration: 4,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER — Valeur numérique qui monte (chiffres HUD)
// Usage : avec useMotionValue + useTransform + animate()
// ─────────────────────────────────────────────────────────────────────────────

export const counterTransition: Transition = {
  duration: duration.slow,
  ease: easing.power,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS GROUPÉS
// ─────────────────────────────────────────────────────────────────────────────

export const variants = {
  fadeUp,
  fadeIn,
  slideInLeft,
  slideInRight,
  holographicEnter,
  holographicFlicker,
  scanLine,
  cinematicReveal,
  ambientFloat,
  textGlowPulse,
} as const;

export const transitions = t;
