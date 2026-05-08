import { useState, useEffect } from 'react';
import { motion }              from 'framer-motion';
import { Cloud, Wind, Droplets } from 'lucide-react';
import { Widget, type WidgetProps, CYAN } from './Widget';

// Micro-données simulées (à remplacer par l'API météo réelle via IPC)
const CONDITIONS = [
  { label: 'Partiellement nuageux', temp: 22, humidity: 61, wind: 14 },
  { label: 'Clair',                 temp: 25, humidity: 48, wind: 8  },
  { label: 'Couvert',               temp: 18, humidity: 78, wind: 21 },
];

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function WeatherWidget(props: Props) {
  const [idx, setIdx] = useState(0);
  const d = CONDITIONS[idx];

  // Simule un changement toutes les 30s
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % CONDITIONS.length), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Widget {...props} title="Météo" icon={Cloud} minWidth={220} maxWidth={260}>
      {/* Température */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '14px' }}>
        <motion.span
          key={d.temp}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            fontSize  : '42px',
            fontWeight: 200,
            lineHeight: 1,
            color     : 'rgba(230,240,255,0.92)',
            letterSpacing: '-0.02em',
          }}
        >
          {d.temp}
        </motion.span>
        <span style={{ fontSize: '20px', color: 'rgba(180,210,230,0.50)', marginBottom: '6px' }}>°C</span>

        {/* Icône animée (flottement ambiant) */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ marginLeft: 'auto', color: 'rgba(0,212,255,0.55)' }}
        >
          <Cloud size={32} strokeWidth={1} />
        </motion.div>
      </div>

      {/* Condition */}
      <motion.p
        key={d.label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ fontSize: '13px', color: 'rgba(180,210,230,0.55)', marginBottom: '16px', fontWeight: 300 }}
      >
        {d.label}
      </motion.p>

      {/* Humidité + vent */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {[
          { icon: Droplets, val: `${d.humidity}%`,  label: 'Humidité' },
          { icon: Wind,     val: `${d.wind} km/h`, label: 'Vent' },
        ].map(({ icon: Icon, val, label }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(0,212,255,0.45)' }}>
              <Icon size={12} strokeWidth={1.5} />
              <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.50)', letterSpacing: '0.08em' }}>{label}</span>
            </div>
            <span style={{ fontSize: '14px', color: 'rgba(200,220,240,0.80)', fontWeight: 300 }}>{val}</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}
