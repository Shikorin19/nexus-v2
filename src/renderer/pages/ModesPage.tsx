/**
 * NEXUS — ModesPage
 * Switcher de scènes visuelles + activation du mode IA.
 */
import { motion } from 'framer-motion';
import { PageWrapper } from './PageWrapper';
import { useSceneStore, SCENE_LIST, SCENES, type SceneId } from '../components/scenes/useSceneStore';

const nx = () => (window as any).nexus;

export function ModesPage() {
  const { currentScene, setScene } = useSceneStore();
  const active = SCENES[currentScene];

  const handleActivate = async (id: SceneId) => {
    setScene(id);
    // Synchronise aussi le mode IA si disponible
    try { await nx()?.modes.activate(id); } catch {}
  };

  return (
    <PageWrapper>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'rgba(200,220,240,0.95)' }}>
          Modes
        </h1>
        <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)' }}>
          Chaque mode adapte l'ambiance visuelle et le comportement de l'IA
        </div>
      </div>

      {/* ── Scène active ── */}
      <motion.div
        layout
        style={{
          background    : `${active.accentGhost}`,
          border        : `1px solid ${active.accentDim}`,
          borderRadius  : '16px',
          backdropFilter: 'blur(12px)',
          padding       : '20px 24px',
          display       : 'flex',
          alignItems    : 'center',
          gap           : '18px',
          marginBottom  : '28px',
          boxShadow     : `0 0 40px ${active.accentGhost}, inset 0 1px 0 ${active.accentGhost}`,
        }}
      >
        <div style={{
          fontSize  : '36px',
          lineHeight: 1,
          filter    : `drop-shadow(0 0 12px ${active.accentDim})`,
        }}>
          {active.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: active.accent, marginBottom: '3px' }}>
            {active.label}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.60)' }}>
            {active.desc} — scène active
          </div>
        </div>
        <div style={{
          fontSize    : '11px',
          padding     : '4px 12px',
          borderRadius: '20px',
          background  : `${active.accentGhost}`,
          border      : `1px solid ${active.accentDim}`,
          color       : active.accent,
          fontWeight  : 600,
          letterSpacing: '0.06em',
        }}>
          ACTIF
        </div>
      </motion.div>

      {/* ── Grille des scènes ── */}
      <div style={{
        display              : 'grid',
        gridTemplateColumns  : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap                  : '14px',
      }}>
        {SCENE_LIST.map((scene, i) => {
          const isActive = scene.id === currentScene;
          return (
            <motion.button
              key={scene.id}
              onClick={() => handleActivate(scene.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.30, ease: [0.65, 0, 0.35, 1] }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                position      : 'relative',
                background    : isActive ? scene.accentGhost : 'rgba(255,255,255,0.025)',
                border        : `1px solid ${isActive ? scene.accentDim : 'rgba(255,255,255,0.07)'}`,
                borderRadius  : '14px',
                backdropFilter: 'blur(12px)',
                padding       : '18px',
                cursor        : 'pointer',
                textAlign     : 'left',
                overflow      : 'hidden',
                boxShadow     : isActive ? `0 0 24px ${scene.accentGhost}` : 'none',
                transition    : 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              {/* Indicateur actif */}
              {isActive && (
                <motion.div
                  layoutId="activeScene"
                  style={{
                    position    : 'absolute',
                    top         : '10px',
                    right       : '10px',
                    width       : '7px',
                    height      : '7px',
                    borderRadius: '50%',
                    background  : scene.accent,
                    boxShadow   : `0 0 8px ${scene.accent}`,
                  }}
                />
              )}

              {/* Emoji + nom */}
              <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>
                {scene.emoji}
              </div>
              <div style={{
                fontSize    : '14px',
                fontWeight  : 600,
                color       : isActive ? scene.accent : 'rgba(200,220,240,0.82)',
                marginBottom: '4px',
                transition  : 'color 0.2s ease',
              }}>
                {scene.label}
              </div>
              <div style={{
                fontSize: '11px',
                color   : 'rgba(120,155,184,0.45)',
                lineHeight: 1.4,
              }}>
                {scene.desc}
              </div>

              {/* Swatch couleur */}
              <div style={{
                marginTop   : '12px',
                height      : '3px',
                borderRadius: '4px',
                background  : `linear-gradient(90deg, ${scene.accent}, ${scene.accentDim})`,
                opacity     : isActive ? 1 : 0.35,
                transition  : 'opacity 0.2s ease',
              }} />
            </motion.button>
          );
        })}
      </div>
    </PageWrapper>
  );
}
