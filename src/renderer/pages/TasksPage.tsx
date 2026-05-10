/**
 * NEXUS — TasksPage
 * Gestionnaire de tâches complet : création, completion, suppression.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check } from 'lucide-react';
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

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  low    : { bg: 'rgba(0,212,255,0.08)',   color: CYAN,       border: 'rgba(0,212,255,0.20)'  },
  medium : { bg: 'rgba(255,214,10,0.10)',  color: '#ffd60a',  border: 'rgba(255,214,10,0.25)' },
  high   : { bg: 'rgba(255,45,85,0.12)',   color: '#ff2d55',  border: 'rgba(255,45,85,0.28)'  },
};

type Priority = 'low' | 'medium' | 'high';

export function TasksPage() {
  const [tasks,   setTasks]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter,  setFilter]  = useState<'all' | 'active' | 'done'>('all');

  // Formulaire nouvelle tâche
  const [title,    setTitle]    = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  const load = async () => {
    try {
      const t = await nx()?.tasks.getAll();
      setTasks(t || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      await nx()?.tasks.create({ title: title.trim(), priority, completed: false });
      setTitle(''); setShowAdd(false);
      await load();
    } catch {}
  };

  const handleToggle = async (task: any) => {
    try {
      await nx()?.tasks.update({ ...task, completed: !task.completed });
      await load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await nx()?.tasks.delete(id);
      await load();
    } catch {}
  };

  const filtered = tasks.filter(t =>
    filter === 'all'    ? true :
    filter === 'active' ? !t.completed :
    t.completed
  );

  const pending = tasks.filter(t => !t.completed).length;
  const done    = tasks.filter(t =>  t.completed).length;

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(200,220,240,0.95)' }}>
            Tâches
          </h1>
          <div style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', marginTop: '4px' }}>
            {pending} en cours · {done} terminées
          </div>
        </div>
        <motion.button
          onClick={() => setShowAdd(v => !v)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            display       : 'flex',
            alignItems    : 'center',
            gap           : '8px',
            padding       : '8px 16px',
            borderRadius  : '10px',
            border        : `1px solid rgba(0,212,255,0.30)`,
            background    : showAdd ? 'rgba(0,212,255,0.10)' : 'transparent',
            color         : CYAN,
            cursor        : 'pointer',
            fontSize      : '13px',
            fontWeight    : 500,
          }}
        >
          <Plus size={15} />
          Nouvelle tâche
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
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Titre de la tâche…"
                style={{
                  background   : 'rgba(255,255,255,0.04)',
                  border       : `1px solid ${BORDER}`,
                  borderRadius : '8px',
                  padding      : '10px 14px',
                  color        : 'rgba(200,220,240,0.9)',
                  fontSize     : '14px',
                  outline      : 'none',
                  width        : '100%',
                  boxSizing    : 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', marginRight: '4px' }}>Priorité :</span>
                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                  const pc = PRIORITY_COLORS[p];
                  const isActive = priority === p;
                  return (
                    <motion.button
                      key={p}
                      onClick={() => setPriority(p)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        padding     : '4px 12px',
                        borderRadius: '20px',
                        border      : `1px solid ${isActive ? pc.border : 'rgba(255,255,255,0.08)'}`,
                        background  : isActive ? pc.bg : 'transparent',
                        color       : isActive ? pc.color : 'rgba(120,155,184,0.5)',
                        fontSize    : '11px',
                        cursor      : 'pointer',
                        fontWeight  : isActive ? 600 : 400,
                        transition  : 'all 0.15s ease',
                      }}
                    >
                      {p}
                    </motion.button>
                  );
                })}
                <div style={{ flex: 1 }} />
                <motion.button
                  onClick={() => { setShowAdd(false); setTitle(''); }}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid rgba(255,255,255,0.08)`, background: 'transparent', color: 'rgba(120,155,184,0.5)', fontSize: '12px', cursor: 'pointer' }}
                >
                  Annuler
                </motion.button>
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
                  Ajouter
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['all', 'active', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding     : '5px 14px',
              borderRadius: '20px',
              border      : `1px solid ${filter === f ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
              background  : filter === f ? 'rgba(0,212,255,0.08)' : 'transparent',
              color       : filter === f ? CYAN : 'rgba(120,155,184,0.5)',
              fontSize    : '12px',
              cursor      : 'pointer',
              fontWeight  : filter === f ? 600 : 400,
              transition  : 'all 0.15s ease',
            }}
          >
            {f === 'all' ? 'Toutes' : f === 'active' ? 'En cours' : 'Terminées'}
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(120,155,184,0.4)', fontSize: '13px' }}>
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center', color: 'rgba(120,155,184,0.4)', fontSize: '13px' }}>
          {filter === 'done' ? 'Aucune tâche terminée.' : 'Aucune tâche. Cliquez sur "Nouvelle tâche" pour commencer.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AnimatePresence>
            {filtered.map((task: any) => {
              const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, transition: { duration: 0.18 } }}
                  style={{
                    ...CARD,
                    padding  : '14px 16px',
                    display  : 'flex',
                    alignItems: 'center',
                    gap      : '12px',
                    opacity  : task.completed ? 0.50 : 1,
                  }}
                >
                  {/* Checkbox */}
                  <motion.button
                    onClick={() => handleToggle(task)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                      width       : '22px',
                      height      : '22px',
                      borderRadius: '6px',
                      border      : `1px solid ${task.completed ? '#00ff9d' : 'rgba(0,212,255,0.30)'}`,
                      background  : task.completed ? 'rgba(0,255,157,0.12)' : 'transparent',
                      display     : 'flex',
                      alignItems  : 'center',
                      justifyContent: 'center',
                      cursor      : 'pointer',
                      flexShrink  : 0,
                    }}
                  >
                    {task.completed && <Check size={13} color="#00ff9d" strokeWidth={2.5} />}
                  </motion.button>

                  {/* Titre */}
                  <span style={{
                    flex          : 1,
                    fontSize      : '13px',
                    color         : task.completed ? 'rgba(120,155,184,0.45)' : 'rgba(200,220,240,0.85)',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    overflow      : 'hidden',
                    textOverflow  : 'ellipsis',
                    whiteSpace    : 'nowrap',
                  }}>
                    {task.title}
                  </span>

                  {/* Badge priorité */}
                  {task.priority && (
                    <span style={{
                      fontSize    : '10px',
                      padding     : '2px 9px',
                      borderRadius: '20px',
                      background  : pc.bg,
                      color       : pc.color,
                      border      : `1px solid ${pc.border}`,
                      flexShrink  : 0,
                      fontWeight  : 500,
                    }}>
                      {task.priority}
                    </span>
                  )}

                  {/* Supprimer */}
                  <motion.button
                    onClick={() => handleDelete(task.id)}
                    whileHover={{ scale: 1.15, color: '#ff2d55' }}
                    style={{
                      background: 'transparent',
                      border    : 'none',
                      cursor    : 'pointer',
                      color     : 'rgba(120,155,184,0.25)',
                      display   : 'flex',
                      alignItems: 'center',
                      padding   : '4px',
                      flexShrink: 0,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    <Trash2 size={14} />
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  );
}
