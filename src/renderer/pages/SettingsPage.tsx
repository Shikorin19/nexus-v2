/**
 * NEXUS — SettingsPage
 * Configuration des clés API et préférences de l'application.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from './PageWrapper';
import { Check, Eye, EyeOff } from 'lucide-react';

const nx = () => (window as any).nexus;

const CYAN   = '#00d4ff';
const BORDER = 'rgba(0,212,255,0.10)';
const CARD   : React.CSSProperties = {
  background    : 'rgba(255,255,255,0.025)',
  border        : `1px solid ${BORDER}`,
  borderRadius  : '12px',
  backdropFilter: 'blur(12px)',
  padding       : '24px',
  marginBottom  : '20px',
};

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontSize     : '10px',
      fontWeight   : 600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color        : 'rgba(0,212,255,0.45)',
      marginBottom : '16px',
    }}>
      {children}
    </div>
  );
}

interface ApiFieldProps {
  label    : string;
  settingKey: string;
  placeholder: string;
  hint?    : string;
}

function ApiField({ label, settingKey, placeholder, hint }: ApiFieldProps) {
  const [value,   setValue]   = useState('');
  const [saved,   setSaved]   = useState(false);
  const [visible, setVisible] = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    nx()?.settings.get(settingKey).then((v: string) => {
      if (v) setValue(v);
    }).catch(() => {});
  }, [settingKey]);

  const handleSave = async () => {
    try {
      await nx()?.settings.set(settingKey, value);
      setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', color: 'rgba(160,185,210,0.70)', fontWeight: 500 }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontSize: '10px', color: 'rgba(120,155,184,0.40)' }}>{hint}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={e => { setValue(e.target.value); setDirty(true); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={placeholder}
            style={{
              width        : '100%',
              background   : 'rgba(255,255,255,0.04)',
              border       : `1px solid ${dirty ? 'rgba(0,212,255,0.30)' : BORDER}`,
              borderRadius : '8px',
              padding      : '9px 40px 9px 12px',
              color        : 'rgba(200,220,240,0.85)',
              fontSize     : '13px',
              outline      : 'none',
              boxSizing    : 'border-box',
              fontFamily   : value ? "'JetBrains Mono', monospace" : 'inherit',
              letterSpacing: value && !visible ? '0.1em' : 'normal',
              transition   : 'border-color 0.15s ease',
            }}
          />
          <button
            onClick={() => setVisible(v => !v)}
            style={{
              position  : 'absolute',
              right     : '10px',
              top       : '50%',
              transform : 'translateY(-50%)',
              background: 'transparent',
              border    : 'none',
              cursor    : 'pointer',
              color     : 'rgba(120,155,184,0.40)',
              display   : 'flex',
              padding   : '2px',
            }}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            padding     : '8px 16px',
            borderRadius: '8px',
            border      : `1px solid ${saved ? 'rgba(0,255,157,0.35)' : dirty ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
            background  : saved ? 'rgba(0,255,157,0.08)' : dirty ? 'rgba(0,212,255,0.08)' : 'transparent',
            color       : saved ? '#00ff9d' : dirty ? CYAN : 'rgba(120,155,184,0.40)',
            fontSize    : '12px',
            fontWeight  : 600,
            cursor      : 'pointer',
            display     : 'flex',
            alignItems  : 'center',
            gap         : '5px',
            transition  : 'all 0.15s ease',
            whiteSpace  : 'nowrap',
            flexShrink  : 0,
          }}
        >
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Check size={12} /> Sauvegardé
              </motion.span>
            ) : (
              <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Sauvegarder
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <PageWrapper>
      <h1 style={{ margin: '0 0 28px', fontSize: '24px', fontWeight: 700, color: 'rgba(200,220,240,0.95)' }}>
        Paramètres
      </h1>

      {/* ── IA & Voix ── */}
      <div style={{ ...CARD }}>
        <SectionTitle>IA & Voix</SectionTitle>
        <ApiField
          label="Clé API Groq"
          settingKey="groqApiKey"
          placeholder="gsk_..."
          hint="STT (Whisper) + LLM"
        />
        <ApiField
          label="Clé API Gemini"
          settingKey="geminiApiKey"
          placeholder="AIza..."
          hint="Modèle IA principal"
        />
        <ApiField
          label="Clé API OpenAI"
          settingKey="openaiApiKey"
          placeholder="sk-..."
          hint="Fallback LLM"
        />
      </div>

      {/* ── Intégrations ── */}
      <div style={{ ...CARD }}>
        <SectionTitle>Intégrations</SectionTitle>
        <ApiField
          label="Clé Météo (OpenWeather)"
          settingKey="weatherApiKey"
          placeholder="Votre clé OpenWeatherMap"
          hint="Widget météo"
        />
        <ApiField
          label="Clé Brave Search"
          settingKey="braveSearchKey"
          placeholder="BSA..."
          hint="Recherche web IA"
        />
        <ApiField
          label="Token GitHub"
          settingKey="githubToken"
          placeholder="ghp_..."
          hint="Résumé dépôts"
        />
        <ApiField
          label="Token Notion"
          settingKey="notionToken"
          placeholder="secret_..."
          hint="Intégration Notion"
        />
        <ApiField
          label="Page Notion parente"
          settingKey="notionParentPageId"
          placeholder="ID de la page Notion"
          hint="Pour créer des pages"
        />
      </div>

      {/* ── App ── */}
      <div style={{ ...CARD }}>
        <SectionTitle>Application</SectionTitle>
        <ApiField
          label="Ville météo par défaut"
          settingKey="weatherCity"
          placeholder="Paris"
          hint="Ex : Lyon, Bordeaux, Marseille"
        />
        <ApiField
          label="Clé News API"
          settingKey="newsApiKey"
          placeholder="Votre clé NewsAPI"
          hint="Widget actualités"
        />
      </div>

      {/* ── Note ── */}
      <div style={{
        fontSize  : '12px',
        color     : 'rgba(120,155,184,0.40)',
        textAlign : 'center',
        padding   : '8px',
      }}>
        Les clés sont stockées localement dans Electron Store — jamais transmises à des serveurs tiers.
      </div>
    </PageWrapper>
  );
}
