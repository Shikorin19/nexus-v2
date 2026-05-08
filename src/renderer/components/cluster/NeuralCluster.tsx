/**
 * NEXUS — NeuralCluster
 *
 * Canvas natif Three.js (via ClusterV1) — exact portage du star-cluster.js V1.
 * Zéro R3F, zéro post-processing, zéro bloom.
 *
 * pointer-events: none → ne capture jamais les clics
 */

import { useEffect, useRef } from 'react';

import { ClusterV1 }       from './ClusterV1';
import { useClusterStore } from './useClusterStore';

// ─── Composant ───────────────────────────────────────────────────────────────

export function NeuralCluster() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const clusterRef = useRef<ClusterV1 | null>(null);

  const clusterState = useClusterStore(s => s.clusterState);
  const amplitude    = useClusterStore(s => s.amplitude);

  // Initialisation unique
  useEffect(() => {
    if (!canvasRef.current) return;

    const cluster = new ClusterV1(canvasRef.current);
    clusterRef.current = cluster;
    // NOTE: window.nexusCluster est déjà géré par useClusterStore.ts via Zustand

    return () => {
      cluster.destroy();
      clusterRef.current = null;
    };
  }, []);

  // Sync état cluster (idle / thinking / speaking)
  useEffect(() => {
    clusterRef.current?.setState(clusterState);
  }, [clusterState]);

  // Sync amplitude (0-1, pilotée par le volume audio)
  useEffect(() => {
    clusterRef.current?.setAmplitude(amplitude);
  }, [amplitude]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position     : 'fixed',
        inset        : 0,
        zIndex       : 0,
        pointerEvents: 'none',
        width        : '100%',
        height       : '100%',
        display      : 'block',
      }}
    />
  );
}
