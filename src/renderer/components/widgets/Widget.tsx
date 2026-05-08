/**
 * NEXUS — Widget base
 *
 * Conteneur glassmorphism draggable.
 * Chaque widget spécialisé l'utilise comme shell.
 *
 * Positionnement : position absolute {x, y} via Framer Motion MotionValues.
 * Drag : libre, avec clampage post-drag pour ne pas passer derrière la sidebar.
 *
 * NOTE FM12 : la propagation de variants via un élément draggable est cassée
 * en Framer Motion 12. On utilise initial/animate objects + delay explicite.
 */

import {
  useState, useEffect, type ReactNode, type FC,
} from 'react';
import { motion, useMotionValue } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const CYAN      = '#00d4ff';
export const STAR_BLUE = '#4da6ff';

const SIDEBAR_W = 64;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WidgetPosition { x: number; y: number; }

export interface WidgetProps {
  id               : string;
  title            : string;
  icon             : LucideIcon;
  iconColor       ?: string;
  position         : WidgetPosition;
  onPositionChange?: (id: string, pos: WidgetPosition) => void;
  animDelay       ?: number;   // stagger d'entrée en secondes (ex: 0.4, 0.48...)
  minWidth        ?: number;
  maxWidth        ?: number;
  children         : ReactNode;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const Widget: FC<WidgetProps> = ({
  id, title, icon: Icon, iconColor = CYAN,
  position, onPositionChange,
  animDelay = 0.4,
  minWidth = 200, maxWidth = 360,
  children,
}) => {
  const [hovered, setHovered]   = useState(false);
  const [dragging, setDragging] = useState(false);

  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);

  // Sync position quand WidgetLayer recalcule (resize / init réel)
  useEffect(() => {
    if (!dragging) {
      x.set(position.x);
      y.set(position.y);
    }
  }, [position.x, position.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragEnd = () => {
    setDragging(false);
    const cx = Math.max(SIDEBAR_W + 8, x.get());
    const cy = Math.max(8, Math.min(window.innerHeight - 80, y.get()));
    if (cx !== x.get()) x.set(cx);
    if (cy !== y.get()) y.set(cy);
    onPositionChange?.(id, { x: x.get(), y: y.get() });
  };

  return (
    <motion.div
      /* ── Animation d'entrée — explicite, pas de propagation variants ── */
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.55,
        delay   : animDelay,
        ease    : [0.16, 1, 0.3, 1],
      }}

      /* ── Drag ─────────────────────────────────────────────────────── */
      drag
      dragMomentum={false}
      dragElastic={0.04}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileDrag={{ scale: 1.025, cursor: 'grabbing' }}

      /* ── Position ─────────────────────────────────────────────────── */
      style={{
        x,
        y,
        position     : 'absolute',
        top          : 0,
        left         : 0,
        minWidth,
        maxWidth,
        zIndex       : dragging ? 200 : hovered ? 15 : 12,
        cursor       : 'grab',
        userSelect   : 'none',
        willChange   : 'transform',
        pointerEvents: 'auto',
      }}
    >
      {/* Shell glassmorphism */}
      <div
        style={{
          background          : 'rgba(20, 25, 40, 0.40)',
          backdropFilter      : 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border              : `1px solid ${hovered
            ? 'rgba(0,212,255,0.14)'
            : 'rgba(255,255,255,0.07)'}`,
          borderRadius        : '20px',
          padding             : '20px 24px 24px',
          boxShadow           : hovered
            ? '0 12px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(0,212,255,0.18), 0 0 32px rgba(0,212,255,0.08)'
            : '0 8px 32px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(0,212,255,0.05)',
          transition          : 'border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display      : 'flex',
          alignItems   : 'center',
          gap          : '9px',
          marginBottom : '16px',
          pointerEvents: 'none',
        }}>
          <motion.div
            animate={{ color: hovered ? iconColor : 'rgba(120,155,184,0.55)' }}
            transition={{ duration: 0.2 }}
          >
            <Icon size={15} strokeWidth={1.5} />
          </motion.div>
          <span style={{
            fontSize     : '10px',
            letterSpacing: '0.14em',
            fontWeight   : 500,
            textTransform: 'uppercase',
            color        : hovered ? 'rgba(180,210,230,0.70)' : 'rgba(120,155,184,0.45)',
            transition   : 'color 0.2s ease',
          }}>
            {title}
          </span>
        </div>

        {children}
      </div>
    </motion.div>
  );
};
