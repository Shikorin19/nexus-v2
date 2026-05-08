/**
 * NEXUS — Scene Store
 *
 * 8 scènes d'ambiance qui transforment l'intégralité du look & feel.
 * Chaque scène définit :
 *   - CSS custom properties (couleur accent, teinte de fond)
 *   - Comportement du cluster (vitesse, glow, tint shader)
 *   - Opacité des widgets
 *   - Couleur du flash de transition
 */

import { create }        from 'zustand';
import {
  Target, Gamepad2, Cloud, BookOpen,
  Palette, Dumbbell, BookMarked, Tv2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SceneId =
  | 'focus' | 'gaming' | 'relax' | 'study'
  | 'creative' | 'sport' | 'reading' | 'streaming';

export interface SceneConfig {
  id           : SceneId;
  label        : string;
  emoji        : string;
  icon         : LucideIcon;
  desc         : string;

  /* ── CSS custom properties  ──────────────────────────────────────────── */
  accent       : string;   // hex principal        → --scene-accent
  accentDim    : string;   // rgba dim              → --scene-accent-dim
  accentGhost  : string;   // rgba très transparent → --scene-accent-ghost
  bgTint       : string;   // rgba teinte fond      → --scene-bg-tint

  /* ── Cluster ─────────────────────────────────────────────────────────── */
  clusterTint  : string;   // hex pour le shader
  clusterSpeed : number;   // mult sur rotSpeed (1 = normal)
  clusterGlow  : number;   // mult sur bloom intensity (1 = normal)

  /* ── Widgets ─────────────────────────────────────────────────────────── */
  widgetOpacity: number;   // 0-1

  /* ── Transition ──────────────────────────────────────────────────────── */
  flashColor   : string;   // rgba du flash de switch
}

// ─── Définitions des 8 scènes ─────────────────────────────────────────────────

export const SCENES: Record<SceneId, SceneConfig> = {
  focus: {
    id: 'focus', label: 'Focus', emoji: '🎯',
    icon: Target,
    desc: 'Concentration maximale',
    accent      : '#00d4ff',
    accentDim   : 'rgba(0,212,255,0.40)',
    accentGhost : 'rgba(0,212,255,0.07)',
    bgTint      : 'rgba(0,0,0,0)',
    clusterTint : '#4da6ff', clusterSpeed: 0.65, clusterGlow: 0.75,
    widgetOpacity: 0.60,
    flashColor  : 'rgba(0,212,255,0.14)',
  },
  gaming: {
    id: 'gaming', label: 'Gaming', emoji: '🎮',
    icon: Gamepad2,
    desc: 'Mode compétitif',
    accent      : '#ff2d6b',
    accentDim   : 'rgba(255,45,107,0.48)',
    accentGhost : 'rgba(255,45,107,0.08)',
    bgTint      : 'rgba(40,0,15,0.10)',
    clusterTint : '#ff4488', clusterSpeed: 1.85, clusterGlow: 2.20,
    widgetOpacity: 0.88,
    flashColor  : 'rgba(255,45,107,0.18)',
  },
  relax: {
    id: 'relax', label: 'Relax', emoji: '☁️',
    icon: Cloud,
    desc: 'Ambiance douce',
    accent      : '#4da6ff',
    accentDim   : 'rgba(77,166,255,0.32)',
    accentGhost : 'rgba(77,166,255,0.06)',
    bgTint      : 'rgba(0,5,20,0.04)',
    clusterTint : '#88bbff', clusterSpeed: 0.32, clusterGlow: 0.52,
    widgetOpacity: 0.52,
    flashColor  : 'rgba(77,166,255,0.10)',
  },
  study: {
    id: 'study', label: 'Étude', emoji: '📚',
    icon: BookOpen,
    desc: 'Apprentissage actif',
    accent      : '#ffd60a',
    accentDim   : 'rgba(255,214,10,0.38)',
    accentGhost : 'rgba(255,214,10,0.07)',
    bgTint      : 'rgba(15,10,0,0.05)',
    clusterTint : '#ffcc44', clusterSpeed: 0.55, clusterGlow: 0.88,
    widgetOpacity: 0.70,
    flashColor  : 'rgba(255,214,10,0.12)',
  },
  creative: {
    id: 'creative', label: 'Créatif', emoji: '🎨',
    icon: Palette,
    desc: 'Flux créatif',
    accent      : '#b026ff',
    accentDim   : 'rgba(176,38,255,0.42)',
    accentGhost : 'rgba(176,38,255,0.08)',
    bgTint      : 'rgba(20,0,30,0.08)',
    clusterTint : '#cc55ff', clusterSpeed: 1.10, clusterGlow: 1.60,
    widgetOpacity: 0.75,
    flashColor  : 'rgba(176,38,255,0.16)',
  },
  sport: {
    id: 'sport', label: 'Sport', emoji: '💪',
    icon: Dumbbell,
    desc: 'Entraînement intensif',
    accent      : '#ff6b00',
    accentDim   : 'rgba(255,107,0,0.42)',
    accentGhost : 'rgba(255,107,0,0.08)',
    bgTint      : 'rgba(25,5,0,0.08)',
    clusterTint : '#ff8800', clusterSpeed: 2.00, clusterGlow: 2.50,
    widgetOpacity: 0.82,
    flashColor  : 'rgba(255,107,0,0.18)',
  },
  reading: {
    id: 'reading', label: 'Lecture', emoji: '📖',
    icon: BookMarked,
    desc: 'Immersion tranquille',
    accent      : '#e8b86d',
    accentDim   : 'rgba(232,184,109,0.36)',
    accentGhost : 'rgba(232,184,109,0.06)',
    bgTint      : 'rgba(15,8,0,0.06)',
    clusterTint : '#ddaa55', clusterSpeed: 0.28, clusterGlow: 0.42,
    widgetOpacity: 0.44,
    flashColor  : 'rgba(232,184,109,0.10)',
  },
  streaming: {
    id: 'streaming', label: 'Stream', emoji: '📺',
    icon: Tv2,
    desc: 'Live en cours',
    accent      : '#9333ea',
    accentDim   : 'rgba(147,51,234,0.42)',
    accentGhost : 'rgba(147,51,234,0.08)',
    bgTint      : 'rgba(15,0,25,0.10)',
    clusterTint : '#aa44ff', clusterSpeed: 1.40, clusterGlow: 1.90,
    widgetOpacity: 0.88,
    flashColor  : 'rgba(147,51,234,0.16)',
  },
};

export const SCENE_LIST = Object.values(SCENES) as SceneConfig[];

// ─── Store ────────────────────────────────────────────────────────────────────

interface SceneStore {
  currentScene : SceneId;
  isFlashing   : boolean;
  toastScene   : SceneConfig | null;

  setScene   : (id: SceneId) => void;
  clearFlash : () => void;
  clearToast : () => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  currentScene : 'focus',
  isFlashing   : false,
  toastScene   : null,

  setScene(id) {
    if (get().currentScene === id) return;
    set({ currentScene: id, isFlashing: true, toastScene: SCENES[id] });
  },

  clearFlash : () => set({ isFlashing: false }),
  clearToast : () => set({ toastScene: null }),
}));
