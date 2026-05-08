/**
 * NEXUS — Cinematic Design System
 *
 * Inspiration : JARVIS · Tron Legacy · HUD sci-fi
 * Principe    : présence vivante, espace négatif, lumière active, pas de dashboard
 */

// ─────────────────────────────────────────────────────────────────────────────
// COULEURS
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Fonds — blacks profonds à teinte froide, jamais pur noir
  bg: {
    void:    '#03050d',   // Le néant absolu — fond principal
    deep:    '#060910',   // Couche base UI
    surface: '#0b0f1a',   // Surfaces élevées (panneaux, cartes)
    glass:   'rgba(11, 15, 26, 0.72)',  // Verre sombre (backdrop-blur)
    glassHover: 'rgba(15, 20, 35, 0.88)',
  },

  // Cyan — lumière primaire NEXUS
  cyan: {
    core:    '#00d4ff',   // Identité couleur principale
    bright:  '#00f0ff',   // Hover / focus
    dim:     '#0099bb',   // Texte secondaire, icônes repos
    ghost:   'rgba(0, 212, 255, 0.08)',  // Fond subtle
    glow10:  'rgba(0, 212, 255, 0.10)',
    glow20:  'rgba(0, 212, 255, 0.20)',
    glow40:  'rgba(0, 212, 255, 0.40)',
    glow80:  'rgba(0, 212, 255, 0.80)',
  },

  // Blue électrique — accent secondaire, profondeur
  blue: {
    core:    '#0a6fff',
    bright:  '#2d8fff',
    deep:    '#0044bb',
    glow20:  'rgba(10, 111, 255, 0.20)',
    glow40:  'rgba(10, 111, 255, 0.40)',
  },

  // Violet — accent tertiaire, états spéciaux
  violet: {
    core:    '#7c3aed',
    bright:  '#9d5cff',
    glow20:  'rgba(124, 58, 237, 0.20)',
  },

  // Statuts
  status: {
    online:  '#00ff9d',
    warning: '#ffd60a',
    danger:  '#ff2d55',
    muted:   '#4a6080',
  },

  // Textes
  text: {
    primary:   '#e8f0f8',   // Blanc froid — titres, labels principaux
    secondary: '#7a9bb8',   // Texte secondaire
    muted:     '#3a5070',   // Hints, placeholders
    accent:    '#00d4ff',   // Texte accent cyan
    inverse:   '#03050d',   // Sur fond clair
  },

  // Bordures / séparateurs
  border: {
    subtle:  'rgba(0, 212, 255, 0.08)',
    default: 'rgba(0, 212, 255, 0.15)',
    active:  'rgba(0, 212, 255, 0.40)',
    bright:  'rgba(0, 212, 255, 0.70)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHIE
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  font: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    display: "'Inter', system-ui, sans-serif",  // à remplacer par un display font si dispo
  },
  size: {
    '2xs': '0.625rem',   // 10px
    xs:    '0.75rem',    // 12px
    sm:    '0.875rem',   // 14px
    base:  '1rem',       // 16px
    lg:    '1.125rem',   // 18px
    xl:    '1.25rem',    // 20px
    '2xl': '1.5rem',     // 24px
    '3xl': '1.875rem',   // 30px
    '4xl': '2.25rem',    // 36px
    '5xl': '3rem',       // 48px
    '6xl': '3.75rem',    // 60px
    '7xl': '5rem',       // 80px — titres cinématiques
  },
  weight: {
    light:   300,
    normal:  400,
    medium:  500,
    semi:    600,
    bold:    700,
  },
  tracking: {
    tightest: '-0.04em',
    tight:    '-0.02em',
    normal:   '0em',
    wide:     '0.08em',
    wider:    '0.15em',
    widest:   '0.25em',  // Titres uppercase style HUD
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DURÉES D'ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

export const duration = {
  instant:   0.05,   // Retour d'état immédiat (micro-interaction)
  ultraFast: 0.1,    // Hover, focus rings
  fast:      0.2,    // Transitions UI légères
  normal:    0.4,    // Transitions standard
  slow:      0.7,    // Révélations de panneaux
  cinematic: 1.2,    // Entrées cinématiques
  dramatic:  2.2,    // Intro, splash, présences
  ambient:   4.0,    // Animations de fond en boucle
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// EASINGS CINÉMATIQUES
// ─────────────────────────────────────────────────────────────────────────────

export const easing = {
  // Standard Material / smooth
  smooth:      [0.4, 0, 0.2, 1]     as [number, number, number, number],
  // Démarrage brutal, arrivée douce — mouvement décisif
  power:       [0.86, 0, 0.07, 1]   as [number, number, number, number],
  // Entrée élégante, légèrement overshoot
  cinematic:   [0.16, 1, 0.3, 1]    as [number, number, number, number],
  // Flottement — hologramme, éléments en suspension
  glide:       [0.23, 1, 0.32, 1]   as [number, number, number, number],
  // Snap — réponse rapide, précise
  snap:        [0.4, 0, 0.6, 1]     as [number, number, number, number],
  // Reveal progressif dramatique
  reveal:      [0.77, 0, 0.175, 1]  as [number, number, number, number],
  // Rebond léger — feedback positif
  spring:      { type: 'spring', stiffness: 400, damping: 30 } as const,
  // Spring doux — panneaux, drawers
  springGentle: { type: 'spring', stiffness: 180, damping: 28 } as const,
  // Spring élastique — apparitions flottantes
  springFloat: { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 } as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// EFFETS VISUELS
// ─────────────────────────────────────────────────────────────────────────────

export const glow = {
  // Box-shadows cyan
  xs:     `0 0 8px  rgba(0, 212, 255, 0.25)`,
  sm:     `0 0 16px rgba(0, 212, 255, 0.30)`,
  md:     `0 0 32px rgba(0, 212, 255, 0.35), 0 0 8px rgba(0, 212, 255, 0.20)`,
  lg:     `0 0 60px rgba(0, 212, 255, 0.40), 0 0 20px rgba(0, 212, 255, 0.25)`,
  xl:     `0 0 100px rgba(0, 212, 255, 0.45), 0 0 40px rgba(0, 212, 255, 0.30), 0 0 8px rgba(0, 212, 255, 0.50)`,
  // Text-shadow
  text:   `0 0 20px rgba(0, 212, 255, 0.80), 0 0 40px rgba(0, 212, 255, 0.40)`,
  textSm: `0 0 10px rgba(0, 212, 255, 0.60)`,
  // Blue
  blue:   `0 0 40px rgba(10, 111, 255, 0.35), 0 0 12px rgba(10, 111, 255, 0.20)`,
} as const;

export const blur = {
  xs:  'blur(4px)',
  sm:  'blur(8px)',
  md:  'blur(16px)',
  lg:  'blur(32px)',
  xl:  'blur(60px)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE & ESPACEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  // Multiples de 4px
  px:  '1px',
  0.5: '2px',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
  20:  '80px',
  24:  '96px',
  32:  '128px',
} as const;

export const radius = {
  none:  '0',
  sm:    '4px',
  md:    '8px',
  lg:    '12px',
  xl:    '16px',
  '2xl': '24px',
  full:  '9999px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Z-INDEX
// ─────────────────────────────────────────────────────────────────────────────

export const zIndex = {
  bg:       -1,    // Fond 3D, particules
  base:      0,
  raised:   10,
  overlay:  20,
  modal:    30,
  hud:      40,    // Éléments HUD toujours visibles
  toast:    50,
  cursor:   99,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  colors,
  typography,
  duration,
  easing,
  glow,
  blur,
  spacing,
  radius,
  zIndex,
} as const;

export type Theme = typeof theme;
export default theme;
