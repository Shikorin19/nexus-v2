/**
 * NEXUS — StatsPage
 * Statistiques : XP/niveau, focus, tâches, infos système.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageWrapper } from './PageWrapper';
import { Cpu, MemoryStick, Clock, Target, Star, Zap } from 'lucide-react';

const nx = () => (window as any).nexus;

const BORDER = 'rgba(0,212,255,0.10)';
const CARD   : React.CSSProperties = {
  background    : 'rgba(255,255,255,0.025)',
  border        : `1px solid ${BORDER}`,
  borderRadius  : '12px',
  backdropFilter: 'blur(12px)',
  padding       : '20px',
};

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

interface StatRowProps {
  icon : React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

function StatRow({ icon, label, value, color = '#00d4ff' }: StatRowProps) {
  return (
    <div style={{
      display       : 'flex',
      alignItems    : 'center',
      gap           : '12px',
      padding       : '12px 0',
      borderBottom  : '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        width       : '34px',
        height      : '34px',
        borderRadius: '9px',
        background  : `${color}10`,
        border      : `1px solid ${color}22`,
        display     : 'flex',
        alignItems  : 'center',
        justifyContent: 'center',
        color,
        flexShrink  : 0,
      }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: '13px', color: 'rgba(120,155,184,0.70)' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(200,220,240,0.90)' }}>{value}</span>
    </div>
  );
}

export function StatsPage() {
  const [xp,     setXp]     = useState<any>(null);
  const [stats,  setStats]  = useState<any>(null);
  const [sysInfo, setSys]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      nx()?.xp.get().catch(() => null),
      nx()?.stats.get('week').catch(() => null),
      nx()?.system.info().catch(() => null),
    ]).then(([x, s, sys]) => {
      setXp(x);
      setStats(s);
      setSys(sys);
      setLoading(false);
    });
  }, []);

  // XP / Level
  const level    = xp?.level   ?? 1;
  const totalXp  = xp?.xp      ?? 0;
  const todayXp  = xp?.today   ?? 0;
  const xpToNext = 500 * level;   // convention simple
  const xpPct    = Math.min(1, (totalXp % xpToNext) / xpToNext);

  return (
    <PageWrapper>
      <h1 style={{ margin: '0 0 28px', fontSize: '24px', fontWeight: 700, color: 'rgba(200,220,240,0.95)' }}>
        Statistiques
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(120,155,184,0.4)', fontSize: '13px' }}>
          Chargement…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── XP / Niveau ── */}
          <div>
            <SectionLabel>Progression</SectionLabel>
            <div style={{ ...CARD }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                <div style={{
                  width       : '54px',
                  height      : '54px',
                  borderRadius: '14px',
                  background  : 'rgba(176,38,255,0.12)',
                  border      : '1px solid rgba(176,38,255,0.30)',
                  display     : 'flex',
                  alignItems  : 'center',
                  justifyContent: 'center',
                  flexShrink  : 0,
                }}>
                  <Star size={22} color="#b026ff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#b026ff', lineHeight: 1 }}>
                    Niveau {level}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', marginTop: '3px' }}>
                    {totalXp} XP total · +{todayXp} aujourd'hui
                  </div>
                </div>
              </div>

              {/* Barre XP */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(120,155,184,0.45)', marginBottom: '6px' }}>
                  <span>{totalXp % xpToNext} XP</span>
                  <span>{xpToNext} XP pour Lv {level + 1}</span>
                </div>
                <div style={{
                  height      : '6px',
                  borderRadius: '10px',
                  background  : 'rgba(255,255,255,0.06)',
                  overflow    : 'hidden',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPct * 100}%` }}
                    transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
                    style={{
                      height    : '100%',
                      borderRadius: '10px',
                      background: 'linear-gradient(90deg, #7c3aed, #b026ff)',
                      boxShadow : '0 0 10px rgba(176,38,255,0.50)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Activité cette semaine ── */}
          <div>
            <SectionLabel>Cette semaine</SectionLabel>
            <div style={{ ...CARD, padding: '0 20px' }}>
              <StatRow
                icon={<Target size={16} />}
                label="Tâches terminées"
                value={stats?.tasksCompleted != null ? String(stats.tasksCompleted) : '—'}
                color="#00d4ff"
              />
              <StatRow
                icon={<Clock size={16} />}
                label="Sessions focus"
                value={stats?.focusSessions != null ? String(stats.focusSessions) : '—'}
                color="#00ff9d"
              />
              <StatRow
                icon={<Zap size={16} />}
                label="Minutes de focus"
                value={stats?.focusMinutes != null ? `${stats.focusMinutes} min` : '—'}
                color="#ffd60a"
              />
              <div style={{ borderBottom: 'none' }}>
                <StatRow
                  icon={<Star size={16} />}
                  label="XP gagnés"
                  value={stats?.xpEarned != null ? `+${stats.xpEarned}` : '—'}
                  color="#b026ff"
                />
              </div>
            </div>
          </div>

          {/* ── Système ── */}
          {sysInfo && (
            <div>
              <SectionLabel>Système</SectionLabel>
              <div style={{ ...CARD, padding: '0 20px' }}>
                <StatRow
                  icon={<Cpu size={16} />}
                  label="Processeur"
                  value={`${sysInfo.cpuCount} cœurs`}
                  color="#4da6ff"
                />
                <StatRow
                  icon={<MemoryStick size={16} />}
                  label="RAM totale"
                  value={`${sysInfo.totalMemGB} Go`}
                  color="#4da6ff"
                />
                <StatRow
                  icon={<MemoryStick size={16} />}
                  label="RAM libre"
                  value={`${sysInfo.freeMemGB} Go`}
                  color="#00ff9d"
                />
                <div style={{ borderBottom: 'none' }}>
                  <StatRow
                    icon={<Cpu size={16} />}
                    label="Uptime"
                    value={sysInfo.uptime ? `${Math.floor(sysInfo.uptime / 3600)}h ${Math.floor((sysInfo.uptime % 3600) / 60)}m` : '—'}
                    color="#4da6ff"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
