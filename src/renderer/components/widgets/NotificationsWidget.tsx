import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Mail, Calendar, Zap, X } from 'lucide-react';
import { Widget, type WidgetProps, CYAN } from './Widget';

interface Notif { id: string; icon: typeof Mail; label: string; time: string; unread: boolean; }

const INITIAL: Notif[] = [
  { id: '1', icon: Mail,     label: '3 nouveaux emails',         time: 'il y a 4 min',  unread: true  },
  { id: '2', icon: Calendar, label: 'Réunion dans 45 minutes',   time: 'il y a 12 min', unread: true  },
  { id: '3', icon: Zap,      label: 'Rapport IA disponible',     time: 'il y a 28 min', unread: false },
];

const ICON_COLORS: Record<string, string> = {
  Mail    : '#4da6ff',
  Calendar: '#ffd60a',
  Zap     : '#00d4ff',
};

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function NotificationsWidget(props: Props) {
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL);
  const unread = notifs.filter(n => n.unread).length;

  const dismiss = (id: string) =>
    setNotifs(ns => ns.filter(n => n.id !== id));

  const markRead = (id: string) =>
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, unread: false } : n));

  return (
    <Widget {...props} title="Notifications" icon={Bell} minWidth={220} maxWidth={280}>
      {/* Badge */}
      {unread > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <motion.div
            animate={{ scale: [1, 1.15, 1], boxShadow: ['0 0 0px #00d4ff44', '0 0 10px #00d4ffaa', '0 0 0px #00d4ff44'] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              padding     : '2px 10px',
              background  : 'rgba(0,212,255,0.12)',
              border      : '1px solid rgba(0,212,255,0.30)',
              borderRadius: '10px',
              fontSize    : '11px',
              color       : CYAN,
              fontWeight  : 500,
            }}
          >
            {unread} non lue{unread > 1 ? 's' : ''}
          </motion.div>
        </div>
      )}

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <AnimatePresence initial={false}>
          {notifs.map(n => {
            const Ic  = n.icon;
            const col = ICON_COLORS[n.icon.name] ?? '#4da6ff';
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: 12, height: 0 }}
                animate={{ opacity: 1, x: 0,  height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.28 }}
                onClick={() => markRead(n.id)}
                style={{
                  display   : 'flex',
                  alignItems: 'flex-start',
                  gap       : '10px',
                  cursor    : 'pointer',
                  padding   : '6px 0',
                }}
              >
                {/* Icône */}
                <div style={{
                  width        : '28px',
                  height       : '28px',
                  borderRadius : '8px',
                  background   : `${col}18`,
                  border       : `1px solid ${col}28`,
                  display      : 'flex',
                  alignItems   : 'center',
                  justifyContent: 'center',
                  flexShrink   : 0,
                  color        : col,
                }}>
                  <Ic size={13} strokeWidth={1.5} />
                </div>

                {/* Texte */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize  : '12px',
                    color     : n.unread ? 'rgba(210,230,255,0.85)' : 'rgba(120,155,184,0.45)',
                    fontWeight: n.unread ? 400 : 300,
                    whiteSpace: 'nowrap',
                    overflow  : 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'color 0.25s ease',
                  }}>
                    {n.label}
                  </p>
                  <p style={{ fontSize: '10px', color: 'rgba(120,155,184,0.30)', marginTop: '1px' }}>{n.time}</p>
                </div>

                {/* Dot non lu */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '3px' }}>
                  {n.unread && (
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: CYAN, boxShadow: `0 0 5px ${CYAN}` }} />
                  )}
                  <motion.button
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    whileHover={{ color: '#ff4d6a' }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(120,155,184,0.20)', cursor: 'pointer', padding: '0', lineHeight: 0 }}
                  >
                    <X size={11} strokeWidth={2} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notifs.length === 0 && (
          <p style={{ fontSize: '12px', color: 'rgba(120,155,184,0.28)', textAlign: 'center', padding: '8px 0' }}>
            Aucune notification
          </p>
        )}
      </div>
    </Widget>
  );
}
