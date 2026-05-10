/**
 * NEXUS — WeatherWidget
 *
 * Données réelles via OpenWeatherMap + IP géolocation automatique.
 * Refresh toutes les 30 minutes.
 * Fallback gracieux si API down ou clé manquante.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import {
  Cloud, CloudRain, CloudSnow, CloudLightning,
  Sun, CloudSun, Wind, Droplets, Thermometer,
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { Widget, type WidgetProps, CYAN } from './Widget';

const nx = () => (window as any).nexus;

const REFRESH_MS = 30 * 60 * 1000; // 30 minutes

// ── Icône selon code OWM ──────────────────────────────────────────────────────

function codeToIcon(code?: number) {
  if (!code) return Cloud;
  if (code >= 200 && code < 300) return CloudLightning;
  if (code >= 300 && code < 500) return CloudRain;
  if (code >= 500 && code < 600) return CloudRain;
  if (code >= 600 && code < 700) return CloudSnow;
  if (code >= 700 && code < 800) return Cloud;
  if (code === 800)               return Sun;
  return CloudSun;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeatherData {
  city       : string;
  country    : string;
  temp       : number;
  feels_like : number;
  temp_min   : number;
  temp_max   : number;
  description: string;
  humidity   : number;
  wind       : number;
  code       : number;
  emoji      : string;
  fetchedAt  : number;
}

type FetchState = 'idle' | 'loading' | 'ok' | 'no_key' | 'error';

// ── Skeleton loading ──────────────────────────────────────────────────────────

function PulseLine({ w, h = 12, mb = 0 }: { w: string; h?: number; mb?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.25, 0.55, 0.25] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width       : w,
        height      : `${h}px`,
        borderRadius: '6px',
        background  : 'rgba(0,212,255,0.15)',
        marginBottom: mb ? `${mb}px` : undefined,
      }}
    />
  );
}

// ── Composant ─────────────────────────────────────────────────────────────────

type Props = Omit<WidgetProps, 'title' | 'icon' | 'children'>;

export function WeatherWidget(props: Props) {
  const [data,   setData]   = useState<WeatherData | null>(null);
  const [state,  setState]  = useState<FetchState>('loading');
  const [lastOk, setLastOk] = useState<WeatherData | null>(null); // cache de la dernière réussite

  const fetchWeather = useCallback(async () => {
    setState(s => s === 'ok' ? 'ok' : 'loading'); // si déjà ok, pas de flash loading
    try {
      const res = await nx()?.weather.get();
      if (!res) { setState('error'); return; }

      if (res.error === 'no_key' || res.error === 'invalid_key') {
        setState('no_key');
        return;
      }
      if (res.error) {
        setState('error');
        return;
      }

      setData(res as WeatherData);
      setLastOk(res as WeatherData);
      setState('ok');
    } catch {
      setState('error');
    }
  }, []);

  // Fetch initial + refresh toutes les 30min
  useEffect(() => {
    fetchWeather();
    const id = setInterval(fetchWeather, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchWeather]);

  // ── Icône météo dynamique ──
  const d = data ?? lastOk;
  const WeatherIcon = codeToIcon(d?.code);

  return (
    <Widget {...props} title="Météo" icon={Cloud} minWidth={220} maxWidth={265}>

      <AnimatePresence mode="wait">

        {/* ── Loading ── */}
        {state === 'loading' && !d && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '14px' }}>
              <PulseLine w="64px" h={42} />
              <PulseLine w="20px" h={20} />
              <div style={{ marginLeft: 'auto' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCw size={20} color="rgba(0,212,255,0.25)" />
                </motion.div>
              </div>
            </div>
            <PulseLine w="70%" mb={16} />
            <div style={{ display: 'flex', gap: '20px' }}>
              <PulseLine w="48px" />
              <PulseLine w="52px" />
            </div>
          </motion.div>
        )}

        {/* ── Pas de clé API ── */}
        {state === 'no_key' && (
          <motion.div
            key="no_key"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '6px 0' }}
          >
            <AlertCircle size={22} color="rgba(255,214,10,0.55)" strokeWidth={1.5} />
            <span style={{ fontSize: '12px', color: 'rgba(120,155,184,0.55)', textAlign: 'center', lineHeight: 1.5 }}>
              Ajoutez votre clé OpenWeather<br/>dans les <span style={{ color: CYAN, opacity: 0.8 }}>Paramètres</span>
            </span>
          </motion.div>
        )}

        {/* ── Données réelles (ok + fallback sur lastOk si erreur passagère) ── */}
        {d && (state === 'ok' || state === 'error') && (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Indicateur d'erreur passagère */}
            {state === 'error' && (
              <div style={{
                display     : 'flex',
                alignItems  : 'center',
                gap         : '5px',
                marginBottom: '10px',
                padding     : '4px 8px',
                borderRadius: '6px',
                background  : 'rgba(255,45,85,0.08)',
                border      : '1px solid rgba(255,45,85,0.18)',
              }}>
                <AlertCircle size={11} color="rgba(255,45,85,0.60)" />
                <span style={{ fontSize: '10px', color: 'rgba(255,45,85,0.55)', letterSpacing: '0.05em' }}>
                  Dernière donnée connue
                </span>
              </div>
            )}

            {/* Ville */}
            <div style={{
              fontSize     : '11px',
              color        : 'rgba(0,212,255,0.45)',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              marginBottom : '6px',
              fontWeight   : 500,
            }}>
              {d.city}{d.country ? `, ${d.country}` : ''}
            </div>

            {/* Température principale */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '4px' }}>
              <motion.span
                key={d.temp}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{
                  fontSize    : '42px',
                  fontWeight  : 200,
                  lineHeight  : 1,
                  color       : 'rgba(230,240,255,0.92)',
                  letterSpacing: '-0.02em',
                }}
              >
                {d.temp}
              </motion.span>
              <span style={{ fontSize: '20px', color: 'rgba(180,210,230,0.50)', marginBottom: '6px' }}>°C</span>

              {/* Icône météo flottante */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ marginLeft: 'auto', color: 'rgba(0,212,255,0.55)' }}
              >
                <WeatherIcon size={32} strokeWidth={1} />
              </motion.div>
            </div>

            {/* Ressenti + min/max */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Thermometer size={11} color="rgba(0,212,255,0.35)" strokeWidth={1.5} />
                <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.45)' }}>
                  Ressenti&nbsp;{d.feels_like}°
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(80,110,140,0.40)' }}>·</span>
              <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.40)' }}>
                {d.temp_min}° / {d.temp_max}°
              </span>
            </div>

            {/* Description */}
            <motion.p
              key={d.description}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize    : '13px',
                color       : 'rgba(180,210,230,0.55)',
                marginBottom: '14px',
                fontWeight  : 300,
                textTransform: 'capitalize',
                margin      : '0 0 14px',
              }}
            >
              {d.description}
            </motion.p>

            {/* Humidité + Vent */}
            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                { icon: Droplets, val: `${d.humidity}%`,   label: 'Humidité' },
                { icon: Wind,     val: `${d.wind} km/h`,   label: 'Vent'     },
              ].map(({ icon: Icon, val, label }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(0,212,255,0.45)' }}>
                    <Icon size={12} strokeWidth={1.5} />
                    <span style={{ fontSize: '11px', color: 'rgba(120,155,184,0.50)', letterSpacing: '0.08em' }}>
                      {label}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', color: 'rgba(200,220,240,0.80)', fontWeight: 300 }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Horodatage discret */}
            {d.fetchedAt && (
              <div style={{
                marginTop  : '10px',
                fontSize   : '10px',
                color      : 'rgba(80,110,140,0.35)',
                textAlign  : 'right',
                letterSpacing: '0.04em',
              }}>
                MAJ {new Date(d.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Erreur sans données de fallback ── */}
        {state === 'error' && !d && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '6px 0' }}
          >
            <Cloud size={28} color="rgba(120,155,184,0.25)" strokeWidth={1} />
            <span style={{ fontSize: '12px', color: 'rgba(120,155,184,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
              Météo indisponible
            </span>
            <button
              onClick={fetchWeather}
              style={{
                display     : 'flex',
                alignItems  : 'center',
                gap         : '5px',
                padding     : '4px 10px',
                borderRadius: '6px',
                border      : '1px solid rgba(0,212,255,0.20)',
                background  : 'transparent',
                color       : 'rgba(0,212,255,0.45)',
                fontSize    : '11px',
                cursor      : 'pointer',
              }}
            >
              <RefreshCw size={11} />
              Réessayer
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </Widget>
  );
}
