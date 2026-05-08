/**
 * NEXUS — Cluster State Store
 *
 * Source unique de vérité pour l'état du cluster neural.
 * Importable depuis n'importe quel composant.
 * Expose aussi window.nexusCluster pour la rétro-compat IPC vanilla JS.
 */
import { create } from 'zustand';

export type ClusterState = 'idle' | 'thinking' | 'speaking' | 'listening';
export type ClusterMode  = 'bg' | 'mini-top' | 'mini-side';

export interface SceneMult {
  speed : number;   // multiplicateur vitesse de rotation (1 = normal)
  glow  : number;   // multiplicateur bloom intensity   (1 = normal)
}

interface ClusterStore {
  clusterState : ClusterState;
  amplitude    : number;
  mode         : ClusterMode;
  sceneMult    : SceneMult;

  setClusterState : (s: ClusterState) => void;
  setAmplitude    : (a: number)       => void;
  setMode         : (m: ClusterMode)  => void;
  setSceneMult    : (m: SceneMult)    => void;
}

export const useClusterStore = create<ClusterStore>((set) => ({
  clusterState : 'idle',
  amplitude    : 0,
  mode         : 'bg',
  sceneMult    : { speed: 0.65, glow: 0.75 },   // focus par défaut

  setClusterState : (s) => set({ clusterState: s }),
  setAmplitude    : (a) => set({ amplitude: Math.max(0, Math.min(1, a)) }),
  setMode         : (m) => set({ mode: m }),
  setSceneMult    : (m) => set({ sceneMult: m }),
}));

/* ── Pont vers le code vanilla JS existant (IPC handlers, preload, etc.) ── */
if (typeof window !== 'undefined') {
  const store = useClusterStore;
  (window as any).nexusCluster = {
    setState    : (s: ClusterState) => store.getState().setClusterState(s),
    setAmplitude: (a: number)       => store.getState().setAmplitude(a),
    getState    : ()                => store.getState().clusterState,
  };
}
