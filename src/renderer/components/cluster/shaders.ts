/**
 * NEXUS — Cluster GLSL Shaders
 *
 * core   : particules nettes avec scintillement + flash
 * glow   : halos larges pour le bloom
 * lines  : connexions synaptiques avec pulse animé par état
 */

/* ── Particules — noyau net ──────────────────────────────────────────────── */
export const CORE_VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aTwinkle;
  varying   vec3  vColor;
  varying   float vAlpha;

  uniform float uTime;
  uniform float uDPR;
  uniform vec3  uTint;
  uniform float uTintStr;
  uniform float uGlowMult;

  void main() {
    vColor = mix(aColor, uTint, uTintStr);

    // Scintillement de base lent
    float base  = 0.62 + 0.38 * sin(aTwinkle + uTime * 0.45);
    // Flash bref et intense (scintillement net)
    float flash = pow(abs(sin(aTwinkle * 3.1 + uTime * 0.32)), 28.0) * 5.5;
    float tw    = base + flash;

    vAlpha = clamp(tw * uGlowMult, 0.0, 2.5);

    vec4 mv   = modelViewMatrix * vec4(position, 1.0);
    // Taille grossit légèrement sur le flash
    gl_PointSize = aSize * uDPR * (260.0 / -mv.z) * (base + flash * 0.12);
    gl_Position  = projectionMatrix * mv;
  }
`;

/* ── Particules — halo diffus (bloom feed) ───────────────────────────────── */
export const GLOW_VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aTwinkle;
  varying   vec3  vColor;
  varying   float vAlpha;

  uniform float uTime;
  uniform float uDPR;
  uniform vec3  uTint;
  uniform float uTintStr;
  uniform float uGlowMult;

  void main() {
    vColor = mix(aColor, uTint, uTintStr);

    float base  = 0.50 + 0.50 * sin(aTwinkle + uTime * 0.45);
    float flash = pow(abs(sin(aTwinkle * 3.1 + uTime * 0.32)), 28.0) * 3.5;
    float tw    = base + flash;

    // Halo très large, opacité plus faible — nourrit le bloom
    vAlpha = tw * 0.22 * uGlowMult;

    vec4 mv   = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDPR * (520.0 / -mv.z) * (0.85 + 0.15 * base + flash * 0.04);
    gl_Position  = projectionMatrix * mv;
  }
`;

/* ── Particules — fragment commun ────────────────────────────────────────── */
export const PARTICLE_FS = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  uniform sampler2D uTex;

  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.005) discard;
    gl_FragColor = vec4(vColor, t.a * vAlpha);
  }
`;

/* ── Connexions synaptiques — vertex ─────────────────────────────────────── */
export const LINE_VS = /* glsl */`
  attribute float aPhase;   // phase aléatoire par segment [0, 2π]
  varying   float vAlpha;

  uniform float uTime;
  uniform float uBaseOpacity;
  uniform float uPulseIntensity;  // 0 = repos, 1 = full pulse (speaking)
  uniform float uFlickerIntensity; // 0-1 (thinking)

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    // Pulse neuronal : vague d'activité avec phase par connexion
    float pulse   = 0.5 + 0.5 * sin(uTime * 3.2 + aPhase);
    float flicker = abs(sin(uTime * 1.1 + aPhase * 0.5));

    float a = uBaseOpacity;
    // Speaking : connexions pulsent avec intensité variable
    a = a * (1.0 + pulse * uPulseIntensity * 1.8);
    // Thinking : connexions clignotent
    a = a * mix(1.0, 0.15 + 0.85 * flicker, uFlickerIntensity);

    vAlpha = clamp(a, 0.0, 1.0);
  }
`;

/* ── Connexions — fragment ───────────────────────────────────────────────── */
export const LINE_FS = /* glsl */`
  varying float vAlpha;
  uniform vec3  uLineColor;

  void main() {
    gl_FragColor = vec4(uLineColor, vAlpha);
  }
`;
