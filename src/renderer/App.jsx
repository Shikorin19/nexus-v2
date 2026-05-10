/**
 * NEXUS — App root
 *
 * Stack de layers (z-index) :
 *   z-0   NeuralCluster  — fond 3D permanent, pointer-events: none
 *   z-10  #nexus-ui      — contenu des vues (pages)
 *   z-12  WidgetLayer    — widgets flottants holographiques
 *   z-20  Sidebar        — nav holographique, fixed left
 *   z-25  ChatOverlay    — saisie + messages flottants + réponse IA
 *   z-45  SceneToast     — toast cinématique "scène activée"
 *   z-50  SceneFlash     — flash plein-écran lors du switch de scène
 */

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

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

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const PageComponent = PAGES[activePage] ?? HomePage;

  return (
    <>
      {/* ── z-0 : Cluster neural ───────────────────────────────────── */}
      <NeuralCluster />

      {/* ── z-20 : Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        activeId={activePage}
        onNavigate={setActivePage}
      />

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

      {/* ── z-12 : Widgets flottants holographiques ────────────────── */}
      <WidgetLayer />

      {/* ── z-25 : Chat immersif ────────────────────────────────────── */}
      <ChatOverlay />

      {/* ── z-45/50 : Scènes (flash + toast) ───────────────────────── */}
      <SceneManager />
    </>
  );
}
