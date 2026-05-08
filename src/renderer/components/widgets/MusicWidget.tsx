import { useState, useEffect } from 'react';
import { motion }              from 'framer-motion';
import { Music, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { Widget, type WidgetProps, CYAN } from './Widget';

const TRACKS = [
  { title: 'Zero-Point Field',  artist: 'Stellardrift',  duration: 237, hue: '195' },
  { title: 'Neural Cascade',    artist: 'Axiom',         duration: 194, hue: '220' },
  { title: 'Deep Architecture', artist: 'Tessellation',  duration: 281, hue: '260' },
];

// Hauteurs et durées fixes des barres waveform (évite Math.random)
const BARS = [
  { h: 0.45, d: 0.80 }, { h: 0.90, d: 0.55 }, { h: 0.60, d: 1.00 },
  { h: 1.00, d: 0.70 }, { h: 0.55, d: 0.90 }, { h: 0.75, d: 0.65 },
  { h: 0.40, d: 1.10 },
];

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function MusicWidget(props: Props) {
  const [trackIdx,  setTrackIdx]  = useState(0);
  const [progress,  setProgress]  = useState(42);
  const [isPlaying, setIsPlaying] = useState(true);

  const track = TRACKS[trackIdx];
  const pct   = progress / track.duration;

  // Avance la progression chaque seconde si en lecture
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= track.duration) {
          setTrackIdx(i => (i + 1) % TRACKS.length);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying, track.duration]);

  const prev = () => { setTrackIdx(i => (i - 1 + TRACKS.length) % TRACKS.length); setProgress(0); };
  const next = () => { setTrackIdx(i => (i + 1) % TRACKS.length); setProgress(0); };

  return (
    <Widget {...props} title="Musique" icon={Music} minWidth={250} maxWidth={290}>
      {/* Artwork + waveform */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
        {/* Faux artwork gradient */}
        <motion.div
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear', paused: !isPlaying }}
          style={{
            width       : '42px',
            height      : '42px',
            borderRadius: '50%',
            background  : `conic-gradient(hsl(${track.hue},80%,55%), hsl(${track.hue},40%,25%), hsl(${track.hue},80%,55%))`,
            flexShrink  : 0,
            boxShadow   : `0 0 16px hsl(${track.hue},70%,45%)44`,
          }}
        />

        {/* Waveform bars */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '28px' }}>
          {BARS.map((b, i) => (
            <motion.div
              key={i}
              animate={isPlaying
                ? { scaleY: [b.h * 0.4, b.h, b.h * 0.6, b.h * 0.9, b.h * 0.4] }
                : { scaleY: 0.2 }}
              transition={isPlaying
                ? { duration: b.d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }
                : { duration: 0.3 }}
              style={{
                width          : '3px',
                height         : '28px',
                borderRadius   : '2px',
                transformOrigin: 'bottom',
                background     : `linear-gradient(to top, ${CYAN}, rgba(0,212,255,0.20))`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Titre + artiste */}
      <motion.div key={trackIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '14px', color: 'rgba(220,235,255,0.88)', fontWeight: 400, marginBottom: '2px' }}>
          {track.title}
        </p>
        <p style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)', letterSpacing: '0.06em' }}>
          {track.artist}
        </p>
      </motion.div>

      {/* Progress bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', overflow: 'hidden' }}>
          <motion.div
            animate={{ scaleX: pct }}
            transition={{ duration: 0.8, ease: 'linear' }}
            style={{ height: '100%', transformOrigin: 'left', background: CYAN, borderRadius: '1px', boxShadow: `0 0 4px ${CYAN}` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(120,155,184,0.40)' }}>{fmt(progress)}</span>
          <span style={{ fontSize: '10px', color: 'rgba(120,155,184,0.40)' }}>{fmt(track.duration)}</span>
        </div>
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
        {[
          { icon: SkipBack,    onClick: prev,                  size: 16 },
          { icon: isPlaying ? Pause : Play, onClick: () => setIsPlaying(p => !p), size: 20 },
          { icon: SkipForward, onClick: next,                  size: 16 },
        ].map(({ icon: Icon, onClick, size }, i) => (
          <motion.button
            key={i}
            onClick={onClick}
            whileHover={{ scale: 1.12, color: CYAN }}
            whileTap={{ scale: 0.92 }}
            style={{
              background: 'transparent',
              border    : 'none',
              color     : 'rgba(120,155,184,0.55)',
              cursor    : 'pointer',
              padding   : '4px',
              display   : 'flex',
            }}
          >
            <Icon size={size} strokeWidth={1.5} />
          </motion.button>
        ))}
      </div>
    </Widget>
  );
}
