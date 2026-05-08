/**
 * NEXUS — ClusterV1
 * Port TypeScript exact de src/renderer/js/star-cluster.js (V1)
 * Zéro changement de logique / valeurs — seul THREE est importé en module.
 */

import * as THREE from 'three';

const STAR_COUNT  = 300;
const CLUSTER_R   = 5.2;
const CONN_THRESH = 2.4;
const CAMERA_Z    = 14;
const LERP_K      = 0.035;

const STATE_CFG: Record<string, any> = {
  idle: {
    rotSpeed   : 0.0004,
    tint       : [0.8, 0.8, 0.8],
    tintStr    : 0.3,
    glowMult   : 0.11,
    baseScale  : 0.98,
    lineFade   : false,
    lineOpacity: 0.02,
    pulse      : false,
    emitWaves  : false,
    driftMult  : 1.0,
  },
  thinking: {
    rotSpeed   : 0.0015,
    tint       : [0.65, 0.05, 1.0],
    tintStr    : 0.80,
    glowMult   : 1.25,
    baseScale  : 0.95,
    lineFade   : true,
    lineOpacity: 0.15,
    pulse      : false,
    emitWaves  : false,
    driftMult  : 0.3,
  },
  speaking: {
    rotSpeed   : 0.0020,
    tint       : [0.8, 0.95, 1.0],
    tintStr    : 0.3,
    glowMult   : 1.6,
    baseScale  : 1.05,
    lineFade   : false,
    lineOpacity: 0.22,
    pulse      : true,
    emitWaves  : true,
    driftMult  : 0.05,
  },
  listening: {
    rotSpeed   : 0.0003,
    tint       : [0.0, 0.96, 1.0],
    tintStr    : 0.32,
    glowMult   : 1.45,
    baseScale  : 0.55,
    lineFade   : false,
    lineOpacity: 0.35,
    pulse      : false,
    emitWaves  : false,
    driftMult  : 0.0,
  },
};

/* ── Vertex shader étoiles (V1 exact) ─────────────────────────────────── */
const VS = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aTwinkle;
  varying   vec3  vColor;
  varying   float vAlpha;
  uniform   float uTime;
  uniform   float uDPR;
  uniform   vec3  uTint;
  uniform   float uTintStr;
  uniform   float uGlowMult;

  void main() {
    vColor       = mix(aColor, uTint, uTintStr);
    float baseTw = 0.60 + 0.40 * sin(aTwinkle + uTime * 0.5);
    float flash  = pow(abs(sin(aTwinkle * 3.0 + uTime * 0.35)), 30.0) * 6.0;
    float tw     = baseTw + flash;
    vAlpha       = clamp(tw * uGlowMult, 0.0, 2.5);
    vec4 mv      = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDPR * (260.0 / -mv.z) * (baseTw + flash * 0.15);
    gl_Position  = projectionMatrix * mv;
  }
`;

/* ── Vertex shader halo glow (V1 exact) ───────────────────────────────── */
const VS_GLOW = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aTwinkle;
  varying   vec3  vColor;
  varying   float vAlpha;
  uniform   float uTime;
  uniform   float uDPR;
  uniform   vec3  uTint;
  uniform   float uTintStr;
  uniform   float uGlowMult;

  void main() {
    vColor       = mix(aColor, uTint, uTintStr);
    float baseTw = 0.50 + 0.50 * sin(aTwinkle + uTime * 0.5);
    float flash  = pow(abs(sin(aTwinkle * 3.0 + uTime * 0.35)), 30.0) * 4.0;
    float tw     = baseTw + flash;
    vAlpha       = tw * 0.18 * uGlowMult;
    vec4 mv      = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDPR * (480.0 / -mv.z) * (0.8 + 0.2 * baseTw + flash * 0.05);
    gl_Position  = projectionMatrix * mv;
  }
`;

/* ── Fragment shader commun (V1 exact) ────────────────────────────────── */
const FS = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  uniform sampler2D uTex;
  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.005) discard;
    gl_FragColor = vec4(vColor, t.a * vAlpha);
  }
`;

function makePointTex(sharp: boolean): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const h = S / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  if (sharp) {
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.30, 'rgba(255,255,255,0.40)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.07)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
  } else {
    g.addColorStop(0,    'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }

export class ClusterV1 {
  private canvas      : HTMLCanvasElement;
  private renderer!   : THREE.WebGLRenderer;
  private scene!      : THREE.Scene;
  private camera!     : THREE.PerspectiveCamera;
  private group!      : THREE.Group;
  private _coreMat!   : THREE.ShaderMaterial;
  private _glowMat!   : THREE.ShaderMaterial;
  private _lineMat!   : THREE.LineBasicMaterial;
  private _corePosAttr!: THREE.BufferAttribute;
  private _glowPosAttr!: THREE.BufferAttribute;
  private _linePosAttr!: THREE.BufferAttribute;
  private _linePairs  : number[] = [];
  private _basePos!   : Float32Array;
  private _driftPhases!: Float32Array;
  private _waves      : Array<{ mesh: THREE.Line; mat: THREE.LineBasicMaterial; scale: number; life: number }> = [];
  private _waveTimer  = 0;
  private _ampTarget  = 0;
  private _ampCurrent = 0;
  private _ampWaveCool= 0;
  private _t          = 0;
  private _raf        = 0;
  private _ro         : ResizeObserver | null = null;
  private _state      = 'idle';

  private _cur = {
    rotSpeed   : STATE_CFG.idle.rotSpeed,
    tint       : [...STATE_CFG.idle.tint] as [number, number, number],
    tintStr    : STATE_CFG.idle.tintStr,
    glowMult   : STATE_CFG.idle.glowMult,
    baseScale  : STATE_CFG.idle.baseScale,
    lineOpacity: 0.26,
    driftMult  : STATE_CFG.idle.driftMult,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this._build();
    this._bindResize();
  }

  private _build() {
    const { canvas } = this;
    const dpr = Math.min(window.devicePixelRatio, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias       : true,
      alpha           : false,
      powerPreference : 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000308, 1);
    this._setSize(false);

    this.scene  = new THREE.Scene();
    const W = canvas.clientWidth  || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    this.camera.position.z = CAMERA_Z;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    /* ── Données étoiles ─────────────────────────────────────────────── */
    const pos      = new Float32Array(STAR_COUNT * 3);
    const col      = new Float32Array(STAR_COUNT * 3);
    const sizes    = new Float32Array(STAR_COUNT);
    const twinkles = new Float32Array(STAR_COUNT);
    const parsedC  = [0x4da6ff, 0x00f5ff, 0x80c8ff].map(h => new THREE.Color(h));

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = Math.pow(Math.random(), 0.55) * CLUSTER_R;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      pos[i * 3 + 2] = r * Math.cos(phi);
      const c = parsedC[Math.floor(Math.random() * parsedC.length)];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sizes[i]    = 0.5 + Math.random() * 2.0;
      twinkles[i] = Math.random() * Math.PI * 2;
    }

    const mkUniforms = (tex: THREE.Texture) => ({
      uTime   : { value: 0 },
      uDPR    : { value: dpr },
      uTex    : { value: tex },
      uTint   : { value: new THREE.Vector3(1, 1, 1) },
      uTintStr: { value: 0 },
      uGlowMult: { value: 1 },
    });

    /* ── Particules cœur ─────────────────────────────────────────────── */
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    coreGeo.setAttribute('aColor',   new THREE.BufferAttribute(col.slice(), 3));
    coreGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes.slice(), 1));
    coreGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles.slice(), 1));
    this._coreMat = new THREE.ShaderMaterial({
      uniforms      : mkUniforms(makePointTex(true)),
      vertexShader  : VS,
      fragmentShader: FS,
      transparent   : true,
      blending      : THREE.AdditiveBlending,
      depthWrite    : false,
      depthTest     : false,
    });
    this._corePosAttr = coreGeo.attributes.position as THREE.BufferAttribute;
    this.group.add(new THREE.Points(coreGeo, this._coreMat));

    /* ── Particules halo ─────────────────────────────────────────────── */
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    glowGeo.setAttribute('aColor',   new THREE.BufferAttribute(col.slice(), 3));
    glowGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes.slice(), 1));
    glowGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles.slice(), 1));
    this._glowMat = new THREE.ShaderMaterial({
      uniforms      : mkUniforms(makePointTex(false)),
      vertexShader  : VS_GLOW,
      fragmentShader: FS,
      transparent   : true,
      blending      : THREE.AdditiveBlending,
      depthWrite    : false,
      depthTest     : false,
    });
    this._glowPosAttr = glowGeo.attributes.position as THREE.BufferAttribute;
    this.group.add(new THREE.Points(glowGeo, this._glowMat));

    this._basePos     = new Float32Array(pos);
    this._driftPhases = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT * 3; i++) {
      this._driftPhases[i] = Math.random() * Math.PI * 2;
    }

    this._buildLines(pos, col);
    this._loop();
  }

  private _buildLines(pos: Float32Array, col: Float32Array) {
    const lp: number[] = [], lc: number[] = [];
    const T2 = CONN_THRESH * CONN_THRESH;
    for (let i = 0; i < STAR_COUNT; i++) {
      for (let j = i + 1; j < STAR_COUNT; j++) {
        const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 >= T2) continue;
        this._linePairs.push(i, j);
        const a = 1 - Math.sqrt(d2) / CONN_THRESH;
        lp.push(pos[i*3], pos[i*3+1], pos[i*3+2], pos[j*3], pos[j*3+1], pos[j*3+2]);
        lc.push(col[i*3]*a, col[i*3+1]*a, col[i*3+2]*a, col[j*3]*a, col[j*3+1]*a, col[j*3+2]*a);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(lc), 3));
    this._linePosAttr = geo.attributes.position as THREE.BufferAttribute;
    this._lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent : true,
      opacity     : 0.26,
      blending    : THREE.AdditiveBlending,
      depthWrite  : false,
      depthTest   : false,
    });
    this.group.add(new THREE.LineSegments(geo, this._lineMat));
  }

  private _emitWave() {
    const N = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color      : 0x00f5ff,
      transparent: true,
      opacity    : 0.9,
      blending   : THREE.AdditiveBlending,
      depthWrite : false,
      depthTest  : false,
    });
    const ring = new THREE.Line(geo, mat);
    this.group.add(ring);
    this._waves.push({ mesh: ring, mat, scale: 1.0, life: 1.0 });
  }

  private _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this._t += 0.01;
    const t   = this._t;
    const cfg = STATE_CFG[this._state] || STATE_CFG.idle;
    const cur = this._cur;
    const K   = LERP_K;

    /* ── Amplitude TTS ── */
    this._ampCurrent = lerp(this._ampCurrent, this._ampTarget, 0.20);
    this._ampTarget  = lerp(this._ampTarget, 0, 0.04);
    if (this._ampWaveCool > 0) this._ampWaveCool--;

    /* ── Interpolation ── */
    cur.rotSpeed    = lerp(cur.rotSpeed,    cfg.rotSpeed,    K);
    cur.tint[0]     = lerp(cur.tint[0],     cfg.tint[0],     K);
    cur.tint[1]     = lerp(cur.tint[1],     cfg.tint[1],     K);
    cur.tint[2]     = lerp(cur.tint[2],     cfg.tint[2],     K);
    cur.tintStr     = lerp(cur.tintStr,     cfg.tintStr,     K);
    cur.glowMult    = lerp(cur.glowMult,    cfg.glowMult,    K);
    cur.lineOpacity = lerp(cur.lineOpacity || 0.26, cfg.lineOpacity, K);
    cur.driftMult   = lerp(cur.driftMult   || 0,   cfg.driftMult,   K);
    cur.baseScale   = lerp(cur.baseScale,   cfg.baseScale,   K * 0.55);

    /* ── Dérive libre (Wander) ── */
    const tDrift = t * 0.08;
    const dAmp   = cur.driftMult * 2.5;
    const cArr   = this._corePosAttr.array as Float32Array;
    const gArr   = this._glowPosAttr.array as Float32Array;
    const bp     = this._basePos;
    const ph     = this._driftPhases;

    for (let i = 0; i < STAR_COUNT * 3; i++) {
      const offset = Math.sin(tDrift + ph[i]) * dAmp;
      cArr[i] = bp[i] + offset;
      gArr[i] = bp[i] + offset;
    }
    this._corePosAttr.needsUpdate = true;
    this._glowPosAttr.needsUpdate = true;

    const lArr  = this._linePosAttr.array as Float32Array;
    const pairs = this._linePairs;
    let lIdx = 0;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i]   * 3;
      const b = pairs[i+1] * 3;
      lArr[lIdx++] = cArr[a];   lArr[lIdx++] = cArr[a+1]; lArr[lIdx++] = cArr[a+2];
      lArr[lIdx++] = cArr[b];   lArr[lIdx++] = cArr[b+1]; lArr[lIdx++] = cArr[b+2];
    }
    this._linePosAttr.needsUpdate = true;

    /* ── Rotation + flottaison ── */
    this.group.rotation.y += cur.rotSpeed;
    this.group.rotation.x  = Math.sin(t * 0.04) * 0.08 + Math.cos(t * 0.015) * 0.04;
    this.group.rotation.z  = Math.sin(t * 0.02) * 0.05;
    this.group.position.y  = Math.sin(t * 0.03) * 0.2;

    /* ── Scale + respiration ── */
    let scale = cur.baseScale + 0.015 * Math.sin(t * 0.5);
    if (cfg.pulse) {
      if (this._ampCurrent > 0.05) {
        scale += this._ampCurrent * 0.25 + 0.02 * Math.sin(t * 15.0);
        cur.glowMult += this._ampCurrent * 2.0;
        cur.tintStr   = lerp(cur.tintStr, 0.7, this._ampCurrent);
      } else {
        scale += 0.03 * Math.sin(t * 3.0) + 0.01 * Math.sin(t * 6.0);
      }
    }
    this.group.scale.setScalar(scale);

    /* ── Uniforms core ── */
    const u = this._coreMat.uniforms;
    u.uTime.value = t;
    u.uTint.value.set(cur.tint[0], cur.tint[1], cur.tint[2]);
    u.uTintStr.value  = cur.tintStr;
    u.uGlowMult.value = cur.glowMult;

    /* ── Uniforms glow ── */
    const ug = this._glowMat.uniforms;
    ug.uTime.value = t;
    ug.uTint.value.set(cur.tint[0], cur.tint[1], cur.tint[2]);
    ug.uTintStr.value  = cur.tintStr;
    ug.uGlowMult.value = cur.glowMult;

    /* ── Connexions clignotantes (thinking) ── */
    if (cfg.lineFade) {
      this._lineMat.opacity = cur.lineOpacity * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.2)));
    } else {
      this._lineMat.opacity = cur.lineOpacity;
    }

    /* ── Ondes (speaking) ── */
    if (cfg.emitWaves) {
      if (this._ampCurrent > 0.05) {
        this._waveTimer = 0;
      } else {
        this._waveTimer++;
        if (this._waveTimer >= 45) { this._emitWave(); this._waveTimer = 0; }
      }
    } else {
      this._waveTimer = 0;
    }

    for (let i = this._waves.length - 1; i >= 0; i--) {
      const w = this._waves[i];
      w.scale += 0.06;
      w.life  -= 0.012;
      if (w.life <= 0) {
        this.group.remove(w.mesh);
        w.mat.dispose();
        w.mesh.geometry.dispose();
        this._waves.splice(i, 1);
      } else {
        w.mesh.scale.set(w.scale, w.scale * 0.72, w.scale);
        w.mat.opacity = w.life * 0.8;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private _setSize(doRender = true) {
    const W = this.canvas.clientWidth  || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    if (!W || !H) return;
    this.renderer.setSize(W, H, false);
    if (this.camera) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
    if (doRender) this.renderer.render(this.scene, this.camera);
  }

  private _bindResize() {
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._setSize());
      this._ro.observe(this.canvas.parentElement || document.body);
    } else {
      window.addEventListener('resize', () => this._setSize());
    }
  }

  /* ── API publique ────────────────────────────────────────────────────── */
  setState(s: string) {
    if (!STATE_CFG[s]) { console.warn('[ClusterV1] unknown state:', s); return; }
    this._state     = s;
    this._waveTimer = 0;
    if (s !== 'speaking') {
      this._ampTarget   = 0;
      this._ampWaveCool = 0;
    }
  }

  setAmplitude(v: number) {
    this._ampTarget = Math.max(0, Math.min(1, v));
    if (v > 0.62 && this._ampWaveCool === 0 && STATE_CFG[this._state]?.emitWaves) {
      this._emitWave();
      this._ampWaveCool = 22;
    }
  }

  getState() { return this._state; }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    this._waves.forEach(w => {
      this.group.remove(w.mesh);
      w.mat.dispose();
      w.mesh.geometry.dispose();
    });
    this.renderer.dispose();
  }
}
