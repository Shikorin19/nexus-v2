/**
 * NEXUS — WidgetLayer
 *
 * Orchestre les 7 widgets flottants autour du cluster.
 *
 * - Position initiale calculée selon la taille de la fenêtre (mount)
 * - Stagger 80ms en entrée (variants appliquées par <Widget>)
 * - z-index 12 : au-dessus du contenu (z-10), sous la sidebar (z-20)
 *   et sous le chat overlay (z-25)
 * - pointer-events: none sur le container ; auto sur les widgets (drag)
 *
 * Architecture drag & drop :
 *   Les positions sont stockées dans un état local (useReducer).
 *   Pour persister → remplacer par Zustand + localStorage dans un second temps.
 */

import { useEffect, useReducer } from 'react';

import { WeatherWidget }       from './WeatherWidget';
import { SystemStatsWidget }   from './SystemStatsWidget';
import { ActiveModeWidget }    from './ActiveModeWidget';
import { TasksWidget }         from './TasksWidget';
import { MusicWidget }         from './MusicWidget';
import { MemoryWidget }        from './MemoryWidget';
import { NotificationsWidget } from './NotificationsWidget';
import type { WidgetPosition } from './Widget';

// ─── Stagger d'entrée (0.4s base + 80ms par widget) ─────────────────────────

const D = (i: number) => 0.4 + i * 0.08;

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetId =
  | 'weather' | 'stats' | 'mode' | 'tasks'
  | 'music'   | 'memory' | 'notifs';

type Positions = Record<WidgetId, WidgetPosition>;

// ─── Positions initiales (calculées au mount, relatives à la viewport) ────────

function computeDefaultPositions(W: number, H: number): Positions {
  const L = 88;                        // colonne gauche (64 sidebar + 24 marge)
  const R = (w: number) => W - w - 20; // colonne droite

  // Hauteurs fixes pour les 3 widgets par colonne — gap de ~20px entre eux
  // Colonne gauche  : weather(~180px) | mode(~190px) | music(~220px)
  // Colonne droite  : stats(~170px)   | tasks(~200px)| memory(~150px) | notifs(~160px)
  const top  = Math.max(20, H * 0.04);
  const mid1 = top + 220;   // après weather (~200px) + gap 20px
  const mid2 = mid1 + 230;  // après mode    (~210px) + gap 20px

  const rtop  = Math.max(20, H * 0.04);
  const rmid1 = rtop + 200; // après stats   (~180px) + gap 20px
  const rmid2 = rmid1 + 235;// après tasks   (~215px) + gap 20px
  const rmid3 = rmid2 + 185;// après memory  (~165px) + gap 20px

  return {
    // Colonne gauche — 3 widgets empilés proprement
    weather : { x: L,       y: top   },
    mode    : { x: L,       y: mid1  },
    music   : { x: L,       y: mid2  },
    // Colonne droite — 4 widgets empilés proprement
    stats   : { x: R(260),  y: rtop  },
    tasks   : { x: R(288),  y: rmid1 },
    memory  : { x: R(268),  y: rmid2 },
    notifs  : { x: R(278),  y: rmid3 },
  };
}

// ─── Reducer de positions ─────────────────────────────────────────────────────

type PosAction =
  | { type: 'init';   positions: Positions }
  | { type: 'update'; id: WidgetId; pos: WidgetPosition };

function positionsReducer(state: Positions, action: PosAction): Positions {
  switch (action.type) {
    case 'init':   return action.positions;
    case 'update': return { ...state, [action.id]: action.pos };
    default:       return state;
  }
}

const INIT: Positions = computeDefaultPositions(1400, 900);

// ─── Composant ────────────────────────────────────────────────────────────────

export function WidgetLayer() {
  const [positions, dispatch] = useReducer(positionsReducer, INIT);

  // Recalcule au mount selon la vraie taille de fenêtre
  useEffect(() => {
    dispatch({
      type     : 'init',
      positions: computeDefaultPositions(window.innerWidth, window.innerHeight),
    });
  }, []);

  const updatePos = (id: string, pos: WidgetPosition) =>
    dispatch({ type: 'update', id: id as WidgetId, pos });

  // Props communes
  const wp = (id: WidgetId) => ({
    id,
    position         : positions[id],
    onPositionChange : updatePos,
  });

  return (
    <div
      style={{
        position     : 'fixed',
        inset        : '0',
        zIndex       : 12,
        pointerEvents: 'none',
        overflow     : 'hidden',
      }}
    >
      {/* Colonne gauche */}
      <WeatherWidget     {...wp('weather')} animDelay={D(0)} />
      <ActiveModeWidget  {...wp('mode')}    animDelay={D(1)} />
      <MusicWidget       {...wp('music')}   animDelay={D(2)} />

      {/* Colonne droite */}
      <SystemStatsWidget   {...wp('stats')}  animDelay={D(3)} />
      <TasksWidget         {...wp('tasks')}  animDelay={D(4)} />
      <MemoryWidget        {...wp('memory')} animDelay={D(5)} />
      <NotificationsWidget {...wp('notifs')} animDelay={D(6)} />
    </div>
  );
}
