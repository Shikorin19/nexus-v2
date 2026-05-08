import { useState, useEffect } from 'react';
import { motion }              from 'framer-motion';
import { Brain }               from 'lucide-react';
import { Widget, type WidgetProps, CYAN, STAR_BLUE } from './Widget';

const TOPICS = ['Architecture React', 'Préférences UI', 'Projets en cours', 'Contacts clés'];

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function MemoryWidget(props: Props) {
  const [entries, setEntries] = useState(847);
  const [synced,  setSynced]  = useState('il y a 2 min');
  const capacity = 0.68;

  // Simule un incrément occasionnel
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() > 0.7) setEntries(n => n + Math.floor(Math.random() * 3 + 1));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Widget {...props} title="Mémoire IA" icon={Brain} iconColor={STAR_BLUE} minWidth={230} maxWidth={270}>
      {/* Compteur + capacité */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '14px' }}>
        <motion.span
          key={entries}
          initial={{ opacity: 0.5, y: -4 }}
          animate={{ opacity: 1,   y: 0  }}
          transition={{ duration: 0.3 }}
          style={{ fontSize: '36px', fontWeight: 200, color: 'rgba(230,240,255,0.90)', lineHeight: 1, letterSpacing: '-0.02em' }}
        >
          {entries.toLocaleString('fr-FR')}
        </motion.span>
        <span style={{ fontSize: '12px', color: 'rgba(120,155,184,0.40)', marginBottom: '5px', fontWeight: 300 }}>
          entrées
        </span>
      </div>

      {/* Barre de capacité */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(120,155,184,0.40)', letterSpacing: '0.10em' }}>CAPACITÉ</span>
          <span style={{ fontSize: '10px', color: STAR_BLUE }}>{Math.round(capacity * 100)}%</span>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
          <motion.div
            animate={{ scaleX: capacity }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              height: '100%', transformOrigin: 'left', borderRadius: '1px',
              background: `linear-gradient(to right, ${STAR_BLUE}88, ${STAR_BLUE})`,
              boxShadow: `0 0 5px ${STAR_BLUE}55`,
            }}
          />
        </div>
      </div>

      {/* Thèmes récents */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {TOPICS.map(t => (
          <span key={t} style={{
            fontSize     : '10px',
            padding      : '3px 9px',
            background   : 'rgba(77,166,255,0.08)',
            border       : '1px solid rgba(77,166,255,0.15)',
            borderRadius : '10px',
            color        : 'rgba(120,180,255,0.65)',
            letterSpacing: '0.04em',
          }}>
            {t}
          </span>
        ))}
      </div>

      <p style={{ fontSize: '10px', color: 'rgba(120,155,184,0.30)', letterSpacing: '0.06em' }}>
        Sync {synced}
      </p>
    </Widget>
  );
}
