/**
 * NEXUS — App root
 *
 * Stack de layers (z-index) :
 *   z-0   NeuralCluster  — fond 3D permanent, pointer-events: none
 *   z-9   Glass overlay  — fond givré sur les pages (hors home)
 *   z-10  #nexus-ui      — contenu des vues (pages)
 *   z-12  WidgetLayer    — widgets flottants holographiques (cachés hors home)
 *   z-20  Sidebar        — nav holographique, fixed left
 *   z-21  Back button    — bouton retour (visible hors home)
 *   z-25  ChatOverlay    — saisie + messages flottants + réponse IA
 *   z-45  SceneToast     — toast cinématique "scène activée"
 *   z-50  SceneFlash     — flash plein-écran lors du switch de scène
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

import { NeuralCluster }  from './components/cluster/NeuralCluster';
import { Sidebar }        from './components/sidebar/Sidebar';
import { WidgetLayer }    from './components/widgets/WidgetLayer';
import { ChatOverlay }    from './components/chat/ChatOverlay';
import { SceneManager }   from './components/scenes/SceneManager';

import { HomePage }       from './pages/HomePage';
import { TasksPage }      from './pages/TasksPage';
import { HabitsPage }     from './pages/HabitsPage';
import { StatsPage }      from './pages/StatsPage';
import { ModesPage }      from './pages/ModesPage';
import { SettingsPage }   from './pages/SettingsPage';

const PAGES = {
  home    : HomePage,
  tasks   : TasksPage,
  habits  : HabitsPage,
  stats   : StatsPage,
  modes   : ModesPage,
  settings: SettingsPage,
};

const EASE = [0.65, 0, 0.35, 1];

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const PageComponent = PAGES[activePage] ?? HomePage;
  const isHome = activePage === 'home';

  return (
    <>
      {/* ── z-0 : Cluster neural ───────────────────────────────────── */}
      <NeuralCluster />

      {/* ── z-9 : Glass overlay (pages hors home) ─────────────────── */}
      <AnimatePresence>
        {!isHome && (
          <motion.div
            key="glass-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.40, ease: EASE }}
            style={{
              position            : 'fixed',
              inset               : 0,
              zIndex              : 9,
              backdropFilter      : 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              background          : 'rgba(3, 5, 13, 0.62)',
              pointerEvents       : 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── z-20 : Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        activeId={activePage}
        onNavigate={setActivePage}
      />

      {/* ── z-21 : Bouton retour (hors home) ──────────────────────── */}
      <AnimatePresence>
        {!isHome && (
          <motion.button
            key="back-btn"
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.30, ease: EASE }}
            onClick={() => setActivePage('home')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position            : 'fixed',
              top                 : '14px',
              left                : '80px',
              zIndex              : 21,
              display             : 'flex',
              alignItems          : 'center',
              gap                 : '7px',
              padding             : '7px 14px',
              borderRadius        : '10px',
              border              : '1px solid rgba(0,212,255,0.22)',
              background          : 'rgba(3, 5, 13, 0.70)',
              backdropFilter      : 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              color               : 'rgba(0,212,255,0.80)',
              cursor              : 'pointer',
              fontSize            : '13px',
              fontWeight          : 500,
              fontFamily          : "'Inter', sans-serif",
              letterSpacing       : '0.01em',
              boxShadow           : '0 2px 16px rgba(0,0,0,0.35)',
            }}
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Accueil
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── z-10 : Contenu principal (pages) ──────────────────────── */}
      <div
        id="nexus-ui"
        style={{
          position  : 'relative',
          zIndex    : 10,
          paddingLeft: '64px',
          minHeight : '100vh',
          overflowX : 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          <PageComponent key={activePage} />
        </AnimatePresence>
      </div>

      {/* ── z-12 : Widgets — visibles seulement sur la page home ──── */}
      <WidgetLayer visible={isHome} />

      {/* ── z-25 : Chat immersif ────────────────────────────────────── */}
      <ChatOverlay />

      {/* ── z-45/50 : Scènes (flash + toast) ───────────────────────── */}
      <SceneManager />
    </>
  );
}
