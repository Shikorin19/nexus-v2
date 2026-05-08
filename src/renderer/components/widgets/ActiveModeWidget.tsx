/**
 * NEXUS — ActiveModeWidget  (redesigné en Scene Switcher)
 *
 * Affiche la scène active + grille 4×2 d'icônes pour switcher.
 * L'état du cluster (idle/thinking/…) est affiché comme sous-statut.
 *
 * Utilise var(--scene-accent) pour les couleurs dynamiques → transition CSS auto.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Layers }                   from 'lucide-react';
import { Widget, type WidgetProps } from './Widget';
import { useSceneStore, SCENE_LIST } from '../scenes/useSceneStore';
import { useClusterStore }           from '../cluster/useClusterStore';

const CLUSTER_COLOR: Record<string, string> = {
  idle     : 'rgba(120,155,184,0.50)',
  listening: '#00d4ff',
  speaking : '#4da6ff',
  thinking : '#b026ff',
};

const CLUSTER_LABEL: Record<string, string> = {
  idle     : 'En veille',
  listening: 'Écoute',
  speaking : 'Parole',
  thinking : 'Réflexion',
};

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function ActiveModeWidget(props: Props) {
  const { currentScene, setScene } = useSceneStore();
  const clusterState               = useClusterStore(s => s.clusterState);

  // Trouve la config de la scène active depuis SCENE_LIST
  const scene = SCENE_LIST.find(s => s.id === currentScene)!;
  const Icon  = scene.icon;
  const dotColor = CLUSTER_COLOR[clusterState] ?? CLUSTER_COLOR.idle;

  return (
    <Widget
      {...props}
      title="Scène"
      icon={Layers}
      iconColor="var(--scene-accent)"
      minWidth={200}
      maxWidth={242}
    >
      {/* ── Scène active ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial   ={{ opacity: 0, y: 6 }}
          animate   ={{ opacity: 1, y: 0 }}
          exit      ={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: '14px' }}
        >
          {/* Indicateur + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            {/* Dot pulsant couleur scène */}
            <div style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
              <motion.div
                animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0.12, 0.55] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position    : 'absolute',
                  inset       : '-5px',
                  borderRadius: '50%',
                  background  : 'var(--scene-accent)',
                  opacity     : 0.35,
                }}
              />
              <div style={{
                width       : '8px',
                height      : '8px',
                borderRadius: '50%',
                background  : 'var(--scene-accent)',
                boxShadow   : '0 0 8px var(--scene-accent)',
              }} />
            </div>

            <span style={{
              fontSize     : '20px',
              fontWeight   : 200,
              color        : 'var(--scene-accent)',
              textShadow   : '0 0 16px var(--scene-accent-dim)',
              letterSpacing: '-0.01em',
              transition   : 'color 1.2s, text-shadow 1.2s',
            }}>
              {scene.label}
            </span>

            <span style={{ fontSize: '18px', marginLeft: 'auto', lineHeight: 1 }}>
              {scene.emoji}
            </span>
          </div>

          <p style={{
            fontSize    : '11px',
            color       : 'rgba(120,155,184,0.38)',
            fontWeight  : 300,
            paddingLeft : '18px',
            lineHeight  : 1.3,
          }}>
            {scene.desc}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* ── Grille 4×2 des 8 scènes ───────────────────────────────────── */}
      <div style={{
        display              : 'grid',
        gridTemplateColumns  : 'repeat(4, 1fr)',
        gap                  : '5px',
        marginBottom         : '10px',
      }}>
        {SCENE_LIST.map(s => {
          const SIcon    = s.icon;
          const isActive = s.id === currentScene;
          return (
            <motion.button
              key={s.id}
              onClick={() => setScene(s.id)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.90 }}
              title={s.label}
              style={{
                display        : 'flex',
                alignItems     : 'center',
                justifyContent : 'center',
                aspectRatio    : '1',
                borderRadius   : '9px',
                background     : isActive ? `${s.accent}18` : 'rgba(255,255,255,0.03)',
                border         : isActive
                  ? `1px solid ${s.accent}44`
                  : '1px solid rgba(255,255,255,0.06)',
                cursor         : 'pointer',
                color          : isActive ? s.accent : 'rgba(120,155,184,0.35)',
                transition     : 'background 0.22s, border-color 0.22s, color 0.22s',
              }}
            >
              <SIcon size={13} strokeWidth={isActive ? 2 : 1.5} />
            </motion.button>
          );
        })}
      </div>

      {/* ── Cluster state (sous-statut) ───────────────────────────────── */}
      <div style={{
        display   : 'flex',
        alignItems: 'center',
        gap       : '6px',
        paddingTop: '8px',
        borderTop : '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Dot cluster */}
        <motion.div
          animate={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
          transition={{ duration: 0.4 }}
          style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 }}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={clusterState}
            initial   ={{ opacity: 0 }}
            animate   ={{ opacity: 1 }}
            exit      ={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              fontSize     : '10px',
              color        : 'rgba(120,155,184,0.32)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            {CLUSTER_LABEL[clusterState]}
          </motion.span>
        </AnimatePresence>
      </div>
    </Widget>
  );
}
