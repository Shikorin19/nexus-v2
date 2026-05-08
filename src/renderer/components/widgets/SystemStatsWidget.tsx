import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { Widget, type WidgetProps, CYAN, STAR_BLUE } from './Widget';

interface Stats { cpu: number; ram: number; ramUsed: number; ramTotal: number; }

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function BarStat({ label, value, color }: { label: string; value: number; color: string }) {
  const danger = value > 80;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.55)', letterSpacing: '0.10em' }}>{label}</span>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            fontSize  : '12px',
            fontWeight: 500,
            color     : danger ? '#ff4d6a' : color,
            textShadow: danger ? '0 0 8px rgba(255,45,85,0.5)' : `0 0 8px ${color}66`,
          }}
        >
          {value}%
        </motion.span>
      </div>

      {/* Track */}
      <div style={{
        width: '100%', height: '3px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '2px', overflow: 'hidden',
      }}>
        <motion.div
          animate={{ scaleX: value / 100 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height         : '100%',
            transformOrigin: 'left',
            borderRadius   : '2px',
            background     : danger
              ? 'linear-gradient(to right, #ff4d6a, #ff8fa3)'
              : `linear-gradient(to right, ${color}99, ${color})`,
            boxShadow      : `0 0 6px ${danger ? '#ff4d6a' : color}66`,
          }}
        />
      </div>
    </div>
  );
}

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function SystemStatsWidget(props: Props) {
  const [stats, setStats] = useState<Stats>({ cpu: 28, ram: 54, ramUsed: 8.6, ramTotal: 16 });

  useEffect(() => {
    const t = setInterval(() => {
      const cpu = rnd(15, 70);
      const ramPct = rnd(40, 72);
      setStats({ cpu, ram: ramPct, ramUsed: +(16 * ramPct / 100).toFixed(1), ramTotal: 16 });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <Widget {...props} title="Système" icon={Cpu} minWidth={230} maxWidth={270}>
      <BarStat label="CPU"    value={stats.cpu} color={CYAN}      />
      <BarStat label="RAM"    value={stats.ram} color={STAR_BLUE} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.40)' }}>
          {stats.ramUsed} / {stats.ramTotal} GB
        </span>
      </div>
    </Widget>
  );
}
