/**
 * NEXUS — SceneManager
 *
 * Cerveau du système de scènes :
 *   1. Écoute `currentScene` (Zustand)
 *   2. Applique les CSS custom properties sur :root (aucun re-render)
 *   3. Met à jour useClusterStore.sceneMult pour que le cluster réagisse
 *   4. Rend SceneFlash + SceneToast
 *
 * Performance : setProperty() sur document.documentElement → batch DOM unique.
 * Les éléments qui lisent var(--scene-*) transitionnent via CSS (@property),
 * sans aucun code JS supplémentaire.
 */

import { useEffect }       from 'react';
import { useSceneStore, SCENES } from './useSceneStore';
import { useClusterStore } from '../cluster/useClusterStore';
import { SceneFlash }      from './SceneFlash';
import { SceneToast }      from './SceneToast';

export function SceneManager() {
  const currentScene  = useSceneStore(s => s.currentScene);
  const setSceneMult  = useClusterStore(s => s.setSceneMult);

  useEffect(() => {
    const scene = SCENES[currentScene];
    const root  = document.documentElement;

    // ── CSS custom properties ────────────────────────────────────────────
    // Transitionnées automatiquement grâce aux @property dans globals.css
    root.style.setProperty('--scene-accent',        scene.accent);
    root.style.setProperty('--scene-accent-dim',    scene.accentDim);
    root.style.setProperty('--scene-accent-ghost',  scene.accentGhost);
    root.style.setProperty('--scene-bg-tint',       scene.bgTint);
    root.style.setProperty('--scene-cluster-tint',  scene.clusterTint);
    root.style.setProperty('--scene-speed',         String(scene.clusterSpeed));
    root.style.setProperty('--scene-glow',          String(scene.clusterGlow));
    root.style.setProperty('--scene-widget-opacity',String(scene.widgetOpacity));

    // ── Cluster mult (lu par ClusterScene sans re-render) ────────────────
    setSceneMult({ speed: scene.clusterSpeed, glow: scene.clusterGlow });

  }, [currentScene, setSceneMult]);

  return (
    <>
      <SceneFlash />
      <SceneToast />
    </>
  );
}
