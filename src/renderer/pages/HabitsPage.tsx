/**
 * NEXUS — HabitsPage
 * Suivi d'habitudes : cocher le jour, voir les streaks.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Flame, Check } from 'lucide-react';
import { PageWrapper } from './PageWrapper';

const nx = () => (window as any).nexus;

const CYAN   = '#00d4ff';
const BORDER = 'rgba(0,212,255,0.10)';
const CARD   : React.CSSProperties = {
  background    : 'rgba(255,255,255,0.025)',
  border        : `1px solid ${BORDER}`,
  borderRadius  : '12px',
  backdropFilter: 'blur(12px)',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function HabitsPage() {
  const [habits,    setHabits]   = useState<any[]>([]);
  const [entries,   setEntries]  = useState<Record<string, boolean>>({});
  const [loading,   setLoading]  = useState(true);
  const [showAdd,   setShowAdd]  = useState(false);
  const [newHabit,  setNewHabit] = useState('');
  const [newFreq,   setNewFreq]  = useState<'daily' | 'weekly'>('daily');

  const load = async () => {
    try {
      const h = await nx()?.habits.getAll() || [];
      setHabits(h);
      // Vérifier quelles habitudes sont faites aujourd'hui
      const today = todayStr();
      const map: Record<string, boolean> = {};
      for (const hab of h) {
        // L'entrée du jour est dans les logs de l'habitude
        if (hab.entries) {
          map[hab.id] = hab.entries.some((e: any) => e.date === today && e.done);
        } else {
          map[hab.id] = false;
        }
      }
      setEntries(map);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (habitId: string) => {
    try {
      await nx()?.habits.toggle(habitId, todayStr());
      setEntries(prev => ({ ...prev, [habitId]: !prev[habitId] }));
      // Rechargement pour les streaks
      const h = await nx()?.habits.getAll() || [];
      setHabits(h);
    } catch {}
  };

  const handleAdd = async () => {
    if (!newHabit.trim()) return;
    try {
      await nx()?.habits.create({ name: newHabit.trim(), frequency: newFreq, color: CYAN });
      setNewHabit(''); setShowAdd(false);
      await load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    // Pas d'endpoint de suppression direct sur habits, on skip ou on met à jour
    // On peut simuler avec un soft-delete si l'API le supporte
    // Pour l'instant, rechargement seulement
    try {
      // window.nexus n'expose pas habits.delete — on garde juste le rechargement
      console.warn('Suppression habitude non supportée via IPC');
    } catch {}
  };

  const doneToday = habits.filter(h => entries[h.id]).length;

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(200,220,240,0.95)' }}>
            Habitudes
          </h1>
          <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', marginTop: '4px' }}>
            {doneToday} / {habits.length} faites aujourd'hui
          </div>
        </div>
        <motion.button
          onClick={() => setShowAdd(v => !v)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            display    : 'flex',
            alignItems : 'center',
            gap        : '8px',
            padding    : '8px 16px',
            borderRadius: '10px',
            border     : `1px solid rgba(0,212,255,0.30)`,
            background : showAdd ? 'rgba(0,212,255,0.10)' : 'transparent',
            color      : CYAN,
            cursor     : 'pointer',
            fontSize   : '13px',
            fontWeight : 500,
          }}
        >
          <Plus size={15} />
          Nouvelle habitude
        </motion.button>
      </div>

      {/* ── Formulaire ajout ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.65, 0, 0.35, 1] }}
            style={{ overflow: 'hidden', marginBottom: '20px' }}
          >
            <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                autoFocus
                value={newHabit}
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Nom de l'habitude… (ex : Méditation, Sport, Lecture)"
                style={{
                  background : 'rgba(255,255,255,0.04)',
                  border     : `1px solid ${BORDER}`,
                  borderRadius: '8px',
                  padding    : '10px 14px',
                  color      : 'rgba(200,220,240,0.9)',
                  fontSize   : '14px',
                  outline    : 'none',
                  width      : '100%',
                  boxSizing  : 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', marginRight: '4px' }}>Fréquence :</span>
                {(['daily', 'weekly'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setNewFreq(f)}
                    style={{
                      padding     : '4px 12px',
                      borderRadius: '20px',
                      border      : `1px solid ${newFreq === f ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      background  : newFreq === f ? 'rgba(0,212,255,0.08)' : 'transparent',
                      color       : newFreq === f ? CYAN : 'rgba(120,155,184,0.5)',
                      fontSize    : '11px',
                      cursor      : 'pointer',
                      transition  : 'all 0.15s ease',
                    }}
                  >
                    {f === 'daily' ? 'Quotidien' : 'Hebdo'}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => { setShowAdd(false); setNewHabit(''); }}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid rgba(255,255,255,0.08)`, background: 'transparent', color: 'rgba(120,155,184,0.5)', fontSize: '12px', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <motion.button
                  onClick={handleAdd}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding     : '6px 16px',
                    borderRadius: '8px',
                    border      : `1px solid rgba(0,212,255,0.35)`,
                    background  : 'rgba(0,212,255,0.10)',
                    color       : CYAN,
                    fontSize    : '12px',
                    fontWeight  : 600,
                    cursor      : 'pointer',
                  }}
                >
                  Créer
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Liste des habitudes ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(120,155,184,0.4)', fontSize: '13px' }}>
          Chargement…
        </div>
      ) : habits.length === 0 ? (
        <div style={{ ...CARD, padding: '48px', textAlign: 'center', color: 'rgba(120,155,184,0.4)', fontSize: '13px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌱</div>
          Aucune habitude. Créez-en une pour commencer votre suivi.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {habits.map((hab: any) => {
            const done = entries[hab.id] ?? false;
            const streak = hab.streak ?? hab.current_streak ?? 0;
            return (
              <motion.div
                key={hab.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  ...CARD,
                  padding   : '16px 18px',
                  display   : 'flex',
                  alignItems: 'center',
                  gap       : '16px',
                  borderColor: done ? 'rgba(0,255,157,0.20)' : BORDER,
                  background : done ? 'rgba(0,255,157,0.03)' : 'rgba(255,255,255,0.025)',
                  transition : 'all 0.2s ease',
                }}
              >
                {/* Bouton cocher */}
                <motion.button
                  onClick={() => handleToggle(hab.id)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.90 }}
                  style={{
                    width       : '36px',
                    height      : '36px',
                    borderRadius: '10px',
                    border      : `1.5px solid ${done ? '#00ff9d' : 'rgba(0,212,255,0.30)'}`,
                    background  : done ? 'rgba(0,255,157,0.14)' : 'rgba(255,255,255,0.03)',
                    display     : 'flex',
                    alignItems  : 'center',
                    justifyContent: 'center',
                    cursor      : 'pointer',
                    flexShrink  : 0,
                    transition  : 'all 0.2s ease',
                    boxShadow   : done ? '0 0 14px rgba(0,255,157,0.20)' : 'none',
                  }}
                >
                  <AnimatePresence>
                    {done && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      >
                        <Check size={18} color="#00ff9d" strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Nom + fréquence */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize     : '14px',
                    fontWeight   : 500,
                    color        : done ? 'rgba(0,255,157,0.70)' : 'rgba(200,220,240,0.85)',
                    marginBottom : '3px',
                    transition   : 'color 0.2s ease',
                  }}>
                    {hab.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)', letterSpacing: '0.06em' }}>
                    {hab.frequency === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                  </div>
                </div>

                {/* Streak */}
                {streak > 0 && (
                  <div style={{
                    display     : 'flex',
                    alignItems  : 'center',
                    gap         : '4px',
                    background  : 'rgba(255,107,0,0.10)',
                    border      : '1px solid rgba(255,107,0,0.25)',
                    borderRadius: '20px',
                    padding     : '3px 10px',
                    flexShrink  : 0,
                  }}>
                    <Flame size={12} color="#ff6b00" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#ff6b00' }}>
                      {streak}j
                    </span>
                  </div>
                )}

                {/* Statut aujourd'hui */}
                <div style={{
                  fontSize    : '11px',
                  padding     : '3px 10px',
                  borderRadius: '20px',
                  background  : done ? 'rgba(0,255,157,0.08)' : 'rgba(255,255,255,0.04)',
                  color       : done ? '#00ff9d' : 'rgba(120,155,184,0.40)',
                  border      : `1px solid ${done ? 'rgba(0,255,157,0.22)' : 'rgba(255,255,255,0.07)'}`,
                  flexShrink  : 0,
                  transition  : 'all 0.2s ease',
                }}>
                  {done ? '✓ Fait' : 'À faire'}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageWrapper>
  );
}
