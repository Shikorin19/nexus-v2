/**
 * NEXUS — HomePage
 * Dashboard : heure, stats rapides, scène active, tâches du jour.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageWrapper } from './PageWrapper';
import { useSceneStore, SCENES } from '../components/scenes/useSceneStore';

const nx = () => (window as any).nexus;

// ─── Styles partagés ──────────────────────────────────────────────────────────
const CYAN   = '#00d4ff';
const BORDER = 'rgba(0,212,255,0.10)';
const CARD   : React.CSSProperties = {
  background    : 'rgba(255,255,255,0.025)',
  border        : `1px solid ${BORDER}`,
  borderRadius  : '12px',
  backdropFilter: 'blur(12px)',
  padding       : '20px',
};

// ─── Composants locaux ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize     : '10px',
      fontWeight   : 600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color        : 'rgba(0,212,255,0.45)',
      marginBottom : '12px',
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color = CYAN }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{ ...CARD, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', color: 'rgba(120,155,184,0.6)', marginBottom: '8px', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1, marginBottom: '4px' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const [time, setTime]     = useState(new Date());
  const [tasks, setTasks]   = useState<any[]>([]);
  const [xp, setXp]         = useState<any>(null);
  const [sysInfo, setSys]   = useState<any>(null);

  const { currentScene, setScene } = useSceneStore();
  const scene = SCENES[currentScene];

  // Horloge
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data
  useEffect(() => {
    nx()?.tasks.getAll().then((t: any[]) => setTasks(t || [])).catch(() => {});
    nx()?.xp.get().then(setXp).catch(() => {});
    nx()?.system.info().then(setSys).catch(() => {});
  }, []);

  const pending  = tasks.filter(t => !t.completed).length;
  const done     = tasks.filter(t => t.completed).length;

  const greetHour = time.getHours();
  const greet = greetHour < 12 ? 'Bonjour' : greetHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const dateStr = time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div style={{ marginBottom: '32px' }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ fontSize: '11px', color: 'rgba(0,212,255,0.45)', letterSpacing: '0.12em', marginBottom: '6px', textTransform: 'uppercase' }}
        >
          {dateStr}
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            style={{
              fontSize    : '32px',
              fontWeight  : 700,
              color       : 'rgba(200,220,240,0.95)',
              letterSpacing: '0.01em',
              margin      : 0,
            }}
          >
            {greet}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            style={{
              fontSize  : '24px',
              fontWeight: 200,
              color     : CYAN,
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 20px rgba(0,212,255,0.5)`,
            }}
          >
            {timeStr}
          </motion.div>
        </div>
      </div>

      {/* ── Stats rapides ── */}
      <div style={{ marginBottom: '28px' }}>
        <SectionLabel>Aperçu</SectionLabel>
        <div style={{ display: 'flex', gap: '14px' }}>
          <StatCard label="Tâches en cours" value={pending} sub={`${done} terminées`} />
          <StatCard
            label="Niveau XP"
            value={xp ? `Lv ${xp.level ?? 1}` : '—'}
            sub={xp ? `${xp.xp ?? 0} XP total` : undefined}
            color="#b026ff"
          />
          <StatCard
            label="RAM libre"
            value={sysInfo ? `${sysInfo.freeMemGB} Go` : '—'}
            sub={sysInfo ? `/ ${sysInfo.totalMemGB} Go` : undefined}
            color="#00ff9d"
          />
        </div>
      </div>

      {/* ── Scène active + switcher rapide ── */}
      <div style={{ marginBottom: '28px' }}>
        <SectionLabel>Scène active</SectionLabel>
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Badge scène */}
          <div style={{
            width        : '48px',
            height       : '48px',
            borderRadius : '12px',
            background   : `${scene.accentGhost}`,
            border       : `1px solid ${scene.accentDim}`,
            display      : 'flex',
            alignItems   : 'center',
            justifyContent: 'center',
            fontSize     : '22px',
            flexShrink   : 0,
          }}>
            {scene.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: scene.accent, marginBottom: '2px' }}>
              {scene.label}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.6)' }}>
              {scene.desc}
            </div>
          </div>
          {/* Switcher rapide */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.values(SCENES).map(s => (
              <motion.button
                key={s.id}
                onClick={() => setScene(s.id)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                title={s.label}
                style={{
                  width       : '32px',
                  height      : '32px',
                  borderRadius: '8px',
                  border      : `1px solid ${s.id === currentScene ? s.accentDim : 'rgba(255,255,255,0.06)'}`,
                  background  : s.id === currentScene ? s.accentGhost : 'transparent',
                  cursor      : 'pointer',
                  fontSize    : '16px',
                  display     : 'flex',
                  alignItems  : 'center',
                  justifyContent: 'center',
                  boxShadow   : s.id === currentScene ? `0 0 12px ${s.accentDim}` : 'none',
                  transition  : 'all 0.18s ease',
                }}
              >
                {s.emoji}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tâches du jour ── */}
      <div>
        <SectionLabel>Tâches du jour</SectionLabel>
        {tasks.length === 0 ? (
          <div style={{ ...CARD, color: 'rgba(120,155,184,0.45)', fontSize: '13px', textAlign: 'center', padding: '32px' }}>
            Aucune tâche — naviguez vers Tâches pour en créer.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.slice(0, 5).map((t: any) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  ...CARD,
                  display    : 'flex',
                  alignItems : 'center',
                  gap        : '12px',
                  padding    : '14px 16px',
                  opacity    : t.completed ? 0.45 : 1,
                }}
              >
                <div style={{
                  width       : '8px',
                  height      : '8px',
                  borderRadius: '50%',
                  background  : t.completed ? '#00ff9d' : CYAN,
                  flexShrink  : 0,
                  boxShadow   : t.completed ? '0 0 8px #00ff9d' : `0 0 8px ${CYAN}`,
                }} />
                <span style={{
                  fontSize      : '13px',
                  flex          : 1,
                  textDecoration: t.completed ? 'line-through' : 'none',
                  color         : t.completed ? 'rgba(120,155,184,0.45)' : 'rgba(200,220,240,0.85)',
                }}>
                  {t.title}
                </span>
                {t.priority && (
                  <span style={{
                    fontSize    : '10px',
                    padding     : '2px 8px',
                    borderRadius: '20px',
                    background  : t.priority === 'high'
                      ? 'rgba(255,45,85,0.15)'
                      : t.priority === 'medium'
                        ? 'rgba(255,214,10,0.12)'
                        : 'rgba(0,212,255,0.08)',
                    color       : t.priority === 'high'
                      ? '#ff2d55'
                      : t.priority === 'medium'
                        ? '#ffd60a'
                        : CYAN,
                    border      : `1px solid ${t.priority === 'high' ? 'rgba(255,45,85,0.3)' : t.priority === 'medium' ? 'rgba(255,214,10,0.25)' : 'rgba(0,212,255,0.2)'}`,
                  }}>
                    {t.priority}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
