import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, CheckCircle2, Circle } from 'lucide-react';
import { Widget, type WidgetProps, CYAN } from './Widget';

interface Task { id: string; label: string; done: boolean; priority: 'high' | 'med' | 'low'; }

const PRIORITY_COLOR = { high: '#ff4d6a', med: '#ffd60a', low: '#4da6ff' };

const INITIAL: Task[] = [
  { id: '1', label: 'Brief matinal IA',           done: true,  priority: 'high' },
  { id: '2', label: 'Résumer les emails',          done: false, priority: 'high' },
  { id: '3', label: 'Préparer la réunion 14h',    done: false, priority: 'med'  },
  { id: '4', label: 'Mise à jour modules',        done: false, priority: 'low'  },
];

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function TasksWidget(props: Props) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL);
  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const pct   = total ? (done / total) * 100 : 0;

  const toggle = (id: string) =>
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));

  return (
    <Widget {...props} title="Tâches actives" icon={ListTodo} minWidth={240} maxWidth={290}>
      {/* Progression globale */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)', letterSpacing: '0.08em' }}>PROGRESSION</span>
          <span style={{ fontSize: '11px', color: CYAN, fontWeight: 500 }}>{done}/{total}</span>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden' }}>
          <motion.div
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            style={{
              height         : '100%',
              transformOrigin: 'left',
              borderRadius   : '1px',
              background     : `linear-gradient(to right, ${CYAN}88, ${CYAN})`,
              boxShadow      : `0 0 6px ${CYAN}55`,
            }}
          />
        </div>
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map(task => (
          <motion.button
            key={task.id}
            onClick={() => toggle(task.id)}
            whileTap={{ scale: 0.97 }}
            style={{
              display    : 'flex',
              alignItems : 'center',
              gap        : '10px',
              background : 'transparent',
              border     : 'none',
              cursor     : 'pointer',
              padding    : '4px 0',
              textAlign  : 'left',
              width      : '100%',
            }}
          >
            <motion.div
              animate={{
                color : task.done ? CYAN : 'rgba(120,155,184,0.35)',
                filter: task.done ? `drop-shadow(0 0 4px ${CYAN}88)` : 'none',
              }}
              transition={{ duration: 0.25 }}
            >
              {task.done
                ? <CheckCircle2 size={15} strokeWidth={1.5} />
                : <Circle       size={15} strokeWidth={1.5} />}
            </motion.div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <motion.span
                animate={{
                  color: task.done ? 'rgba(120,155,184,0.30)' : 'rgba(200,220,240,0.80)',
                  textDecoration: task.done ? 'line-through' : 'none',
                }}
                transition={{ duration: 0.25 }}
                style={{ fontSize: '13px', fontWeight: 300 }}
              >
                {task.label}
              </motion.span>

              {/* Point de priorité */}
              {!task.done && (
                <div style={{
                  width       : '5px',
                  height      : '5px',
                  borderRadius: '50%',
                  background  : PRIORITY_COLOR[task.priority],
                  flexShrink  : 0,
                  marginLeft  : 'auto',
                  boxShadow   : `0 0 5px ${PRIORITY_COLOR[task.priority]}88`,
                }} />
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </Widget>
  );
}
