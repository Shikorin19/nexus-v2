/**
 * NEXUS — Sidebar
 *
 * Navigation OS futuriste : fond holographique, bloom cyan, expand/collapse fluide.
 *
 * Closed  64px  → icônes seules, hover déclenche l'expand après 200ms
 * Open   220px  → icônes + labels, mouse-leave collapse après 400ms
 * Toggle manuel via bouton bas-de-sidebar (verrouille l'état)
 */

import {
  useState, useRef, useCallback, useEffect, type FC,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, ListTodo, Calendar,
  FolderOpen, Zap, Settings, ChevronsRight, Cpu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Tokens inline (évite l'import du theme qui peut gêner le tree-shaking) ──

const C = {
  bg       : 'rgba(3, 5, 13, 0.78)',
  border   : 'rgba(0, 212, 255, 0.13)',
  glow     : 'rgba(0, 212, 255, 0.06)',
  cyan     : '#00d4ff',
  cyanDim  : 'rgba(0, 212, 255, 0.45)',
  cyanGhost: 'rgba(0, 212, 255, 0.07)',
  text     : 'rgba(120, 155, 184, 0.75)',
  textHover: 'rgba(0, 212, 255, 0.90)',
  textActive: '#00d4ff',
} as const;

const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

// ─── Définition de la navigation ─────────────────────────────────────────────

interface NavItem {
  id    : string;
  label : string;
  icon  : LucideIcon;
}

const NAV_MAIN: NavItem[] = [
  { id: 'home',      label: 'Accueil',       icon: LayoutDashboard },
  { id: 'chat',      label: 'Chat IA',        icon: MessageSquare   },
  { id: 'tasks',     label: 'Tâches',         icon: ListTodo        },
  { id: 'calendar',  label: 'Agenda',         icon: Calendar        },
  { id: 'files',     label: 'Fichiers',       icon: FolderOpen      },
  { id: 'modules',   label: 'Modules',        icon: Zap             },
];

const NAV_BOTTOM: NavItem[] = [
  { id: 'settings',  label: 'Paramètres',     icon: Settings        },
];

// ─── Composant item de navigation ────────────────────────────────────────────

interface SidebarItemProps {
  item       : NavItem;
  isActive   : boolean;
  isExpanded : boolean;
  onClick    : (id: string) => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ item, isActive, isExpanded, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <motion.button
      onClick={() => onClick(item.id)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        position      : 'relative',
        display       : 'flex',
        alignItems    : 'center',
        gap           : '12px',
        width         : '100%',
        height        : '44px',
        padding       : '0 20px',
        border        : 'none',
        borderRadius  : '0',
        cursor        : 'pointer',
        overflow      : 'hidden',
        flexShrink    : 0,
        background    : isActive
          ? 'rgba(0, 212, 255, 0.08)'
          : hovered
            ? 'rgba(0, 212, 255, 0.04)'
            : 'transparent',
        transition    : 'background 0.2s ease',
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Barre lumineuse gauche — active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="activeBar"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            style={{
              position    : 'absolute',
              left        : 0,
              top         : '18%',
              bottom      : '18%',
              width       : '2px',
              borderRadius: '0 2px 2px 0',
              background  : `linear-gradient(to bottom, transparent, ${C.cyan}, transparent)`,
              boxShadow   : `0 0 10px ${C.cyan}, 0 0 4px ${C.cyan}`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Halo de survol (blur derrière l'icône) */}
      <AnimatePresence>
        {(hovered || isActive) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position    : 'absolute',
              left        : '10px',
              top         : '50%',
              transform   : 'translateY(-50%)',
              width       : '32px',
              height      : '32px',
              borderRadius: '8px',
              background  : isActive ? 'rgba(0,212,255,0.12)' : 'rgba(0,212,255,0.07)',
              filter      : 'blur(4px)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Icône */}
      <motion.div
        animate={{
          color: isActive ? C.textActive : hovered ? C.textHover : C.text,
          filter: isActive
            ? 'drop-shadow(0 0 6px rgba(0,212,255,0.8))'
            : hovered
              ? 'drop-shadow(0 0 4px rgba(0,212,255,0.5))'
              : 'none',
        }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </motion.div>

      {/* Label — glisse à l'ouverture */}
      <AnimatePresence>
        {isExpanded && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, delay: 0.10, ease: 'easeOut' }}
            style={{
              fontSize      : '13px',
              fontWeight    : 500,
              letterSpacing : '0.02em',
              whiteSpace    : 'nowrap',
              color         : isActive ? C.textActive : hovered ? C.textHover : C.text,
              textShadow    : isActive ? `0 0 12px rgba(0,212,255,0.6)` : 'none',
              transition    : 'color 0.18s ease, text-shadow 0.18s ease',
              userSelect    : 'none',
            }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ─── Logo NEXUS ───────────────────────────────────────────────────────────────

interface LogoProps {
  isExpanded: boolean;
  onClick   : () => void;
}

const NexusLogo: FC<LogoProps> = ({ isExpanded, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display        : 'flex',
      alignItems     : 'center',
      gap            : '12px',
      width          : '100%',
      height         : '64px',
      padding        : '0 20px',
      border         : 'none',
      background     : 'transparent',
      cursor         : 'pointer',
      flexShrink     : 0,
      borderBottom   : '1px solid rgba(0,212,255,0.07)',
      marginBottom   : '8px',
    }}
  >
    {/* Icône animée */}
    <motion.div
      style={{
        flexShrink : 0,
        color      : C.cyan,
        display    : 'flex',
        alignItems : 'center',
        filter     : 'drop-shadow(0 0 8px rgba(0,212,255,0.6))',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
    >
      <Cpu size={22} strokeWidth={1.25} />
    </motion.div>

    {/* Texte NEXUS */}
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          key="nexus-text"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.20, delay: 0.08, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
        >
          <motion.span
            style={{
              fontSize     : '15px',
              fontWeight   : 600,
              letterSpacing: '0.22em',
              color        : C.cyan,
              textShadow   : `0 0 18px rgba(0,212,255,0.7), 0 0 36px rgba(0,212,255,0.25)`,
              userSelect   : 'none',
              lineHeight   : 1,
            }}
            animate={{
              textShadow: [
                '0 0 18px rgba(0,212,255,0.70), 0 0 36px rgba(0,212,255,0.25)',
                '0 0 28px rgba(0,212,255,0.95), 0 0 60px rgba(0,212,255,0.40)',
                '0 0 18px rgba(0,212,255,0.70), 0 0 36px rgba(0,212,255,0.25)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            NEXUS
          </motion.span>
          <span style={{
            fontSize     : '9px',
            letterSpacing: '0.18em',
            color        : 'rgba(0,212,255,0.38)',
            marginTop    : '3px',
            userSelect   : 'none',
          }}>
            AGENT IA
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  </button>
);

// ─── Bouton toggle bas ────────────────────────────────────────────────────────

interface ToggleBtnProps {
  isExpanded : boolean;
  isLocked   : boolean;
  onToggle   : () => void;
}

const ToggleButton: FC<ToggleBtnProps> = ({ isExpanded, isLocked, onToggle }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isExpanded ? 'Réduire la barre' : 'Épingler la barre'}
      style={{
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : isExpanded ? 'flex-end' : 'center',
        gap            : '8px',
        width          : '100%',
        height         : '40px',
        padding        : isExpanded ? '0 18px' : '0',
        border         : 'none',
        background     : 'transparent',
        cursor         : 'pointer',
        borderTop      : '1px solid rgba(0,212,255,0.07)',
        flexShrink     : 0,
        transition     : 'background 0.2s ease',
      }}
    >
      <AnimatePresence>
        {isExpanded && (
          <motion.span
            key="toggle-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              fontSize     : '11px',
              letterSpacing: '0.08em',
              color        : isLocked ? C.cyanDim : 'rgba(0,212,255,0.28)',
              userSelect   : 'none',
            }}
          >
            {isLocked ? 'Épinglée' : 'Épingler'}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          rotate : isExpanded ? 180 : 0,
          color  : hovered ? C.cyanDim : 'rgba(0,212,255,0.25)',
          filter : hovered
            ? 'drop-shadow(0 0 4px rgba(0,212,255,0.5))'
            : 'none',
        }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <ChevronsRight size={16} strokeWidth={1.5} />
      </motion.div>
    </button>
  );
};

// ─── Ligne de scan holographique ──────────────────────────────────────────────

const ScanLine: FC = () => (
  <motion.div
    aria-hidden
    style={{
      position       : 'absolute',
      left           : 0,
      right          : 0,
      height         : '1px',
      background     : 'linear-gradient(to right, transparent, rgba(0,212,255,0.35), transparent)',
      pointerEvents  : 'none',
      zIndex         : 1,
    }}
    animate={{ y: ['-100%', '120vh'] }}
    transition={{
      duration   : 3.5,
      ease       : 'linear',
      repeat     : Infinity,
      repeatDelay: 8,
    }}
  />
);

// ─── Sidebar principale ───────────────────────────────────────────────────────

interface SidebarProps {
  activeId  ?: string;
  onNavigate?: (id: string) => void;
}

export const Sidebar: FC<SidebarProps> = ({
  activeId   = 'home',
  onNavigate,
}) => {
  const [active,   setActive]   = useState(activeId);
  const [expanded, setExpanded] = useState(false);  // état visuel
  const [locked,   setLocked]   = useState(false);  // épinglé manuellement

  const openTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current)  clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (locked) return;
    clearTimers();
    openTimer.current = setTimeout(() => setExpanded(true), 200);
  }, [locked, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    if (locked) return;
    clearTimers();
    closeTimer.current = setTimeout(() => setExpanded(false), 400);
  }, [locked, clearTimers]);

  const handleToggleLock = useCallback(() => {
    clearTimers();
    const nextLocked = !locked;
    setLocked(nextLocked);
    setExpanded(nextLocked); // épingler = ouvrir, désépingler = fermer
  }, [locked, clearTimers]);

  const handleItemClick = useCallback((id: string) => {
    setActive(id);
    onNavigate?.(id);
  }, [onNavigate]);

  // Nettoyage des timers
  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <motion.aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{ width: expanded ? 220 : 64 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{
        position         : 'fixed',
        left             : 0,
        top              : 0,
        bottom           : 0,
        zIndex           : 20,
        display          : 'flex',
        flexDirection    : 'column',
        overflow         : 'hidden',
        // Fond holographique
        backdropFilter   : 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background       : C.bg,
        // Bordure droite glow
        borderRight      : `1px solid ${C.border}`,
        boxShadow        : `1px 0 24px rgba(0,212,255,0.06), inset -1px 0 0 rgba(0,212,255,0.06)`,
        // Performance
        willChange       : 'width',
      }}
    >
      {/* Ligne de scan */}
      <ScanLine />

      {/* Logo */}
      <NexusLogo
        isExpanded={expanded}
        onClick={() => handleItemClick('home')}
      />

      {/* Navigation principale */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_MAIN.map(item => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={active === item.id}
            isExpanded={expanded}
            onClick={handleItemClick}
          />
        ))}
      </nav>

      {/* Navigation bas */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {NAV_BOTTOM.map(item => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={active === item.id}
            isExpanded={expanded}
            onClick={handleItemClick}
          />
        ))}

        {/* Bouton toggle / pin */}
        <ToggleButton
          isExpanded={expanded}
          isLocked={locked}
          onToggle={handleToggleLock}
        />
      </div>
    </motion.aside>
  );
};

export default Sidebar;
