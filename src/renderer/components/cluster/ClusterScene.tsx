/**
 * NEXUS — ClusterScene
 *
 * Scène R3F complète du cluster neural.
 * Toute la logique Three.js vit ici : particules, connexions, ondes, bloom.
 *
 * États :
 *   idle      — respiration organique lente, connexions quasi invisibles
 *   listening — convergence, connexions lumineuses, ondes d'écoute douces
 *   speaking  — nœuds réactifs, pulse synaptique sur les connexions, ondes rapides
 *   thinking  — rotation plus rapide, teinte violette, connexions qui clignotent
 */

import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree }         from '@react-three/fiber';
import { EffectComposer, Bloom }      from '@react-three/postprocessing';
import { KernelSize, BlendFunction }  from 'postprocessing';
import * as THREE                     from 'three';

import { CORE_VS, GLOW_VS, PARTICLE_FS, LINE_VS, LINE_FS } from './shaders';
import { useClusterStore }                                   from './useClusterStore';

// ─── Configuration ──────────────────────────────────────────────────────────

const STAR_COUNT  = 300;   // V1 : 300
const CLUSTER_R   = 5.2;   // V1 : 5.2
const CONN_THRESH = 2.4;   // V1 : 2.4
const CAMERA_Z    = 14;
const LERP_K      = 0.035; // V1 : 0.035

type StateName = 'idle' | 'thinking' | 'speaking' | 'listening';

interface StateCfg {
  rotSpeed         : number;
  tint             : [number, number, number];
  tintStr          : number;
  glowMult         : number;
  baseScale        : number;
  lineOpacity      : number;
  pulseIntensity   : number;   // speaking pulse on connections
  flickerIntensity : number;   // thinking flicker on connections
  driftMult        : number;
  emitWaves        : boolean;
  emitListenWaves  : boolean;
  waveInterval     : number;   // frames between waves
}

const STATE_CFG: Record<StateName, StateCfg> = {
  idle: {
    rotSpeed         : 0.0004,            // V1 exact
    tint             : [0.80, 0.80, 0.80],// V1 : légèrement désaturé
    tintStr          : 0.30,              // V1 exact
    glowMult         : 0.11,             // V1 exact — clé : très discret au repos
    baseScale        : 0.98,             // V1 exact
    lineOpacity      : 0.02,             // V1 exact — presque invisibles
    pulseIntensity   : 0.0,
    flickerIntensity : 0.0,
    driftMult        : 1.0,
    emitWaves        : false,
    emitListenWaves  : false,
    waveInterval     : 999,
  },
  thinking: {
    rotSpeed         : 0.0015,
    tint             : [0.65, 0.05, 1.0],
    tintStr          : 0.80,
    glowMult         : 1.25,
    baseScale        : 0.95,
    lineOpacity      : 0.15,
    pulseIntensity   : 0.0,
    flickerIntensity : 1.0,
    driftMult        : 0.30,
    emitWaves        : false,
    emitListenWaves  : false,
    waveInterval     : 999,
  },
  speaking: {
    rotSpeed         : 0.0020,
    tint             : [0.80, 0.95, 1.0],
    tintStr          : 0.30,
    glowMult         : 1.60,
    baseScale        : 1.05,
    lineOpacity      : 0.22,
    pulseIntensity   : 1.0,
    flickerIntensity : 0.0,
    driftMult        : 0.05,
    emitWaves        : true,
    emitListenWaves  : false,
    waveInterval     : 45,
  },
  listening: {
    rotSpeed         : 0.0003,
    tint             : [0.0, 0.96, 1.0],
    tintStr          : 0.32,
    glowMult         : 1.45,
    baseScale        : 0.55,
    lineOpacity      : 0.35,
    pulseIntensity   : 0.0,
    flickerIntensity : 0.0,
    driftMult        : 0.0,
    emitWaves        : false,
    emitListenWaves  : true,
    waveInterval     : 175,
  },
};

// ─── Texture radiale (simule le bloom par point) ─────────────────────────────

function makePointTexture(sharp: boolean): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const h = S / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  if (sharp) {
    g.addColorStop(0,    'rgba(255,255,255,1.0)');
    g.addColorStop(0.06, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.60, 'rgba(255,255,255,0.08)');
    g.addColorStop(1,    'rgba(255,255,255,0.0)');
  } else {
    g.addColorStop(0,    'rgba(255,255,255,0.60)');
    g.addColorStop(0.40, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.04)');
    g.addColorStop(1,    'rgba(255,255,255,0.0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }

// ─── Composant principal ──────────────────────────────────────────────────────

export function ClusterScene() {
  const { gl, size } = useThree();

  // ── Store global
  const clusterState = useClusterStore(s => s.clusterState);
  const amplitude    = useClusterStore(s => s.amplitude);

  // ── Références impératives (pas de re-render voulu)
  const groupRef      = useRef<THREE.Group>(null);
  const timeRef       = useRef(0);
  const wavesRef      = useRef<Array<{
    mesh : THREE.Line;
    mat  : THREE.LineBasicMaterial;
    scale: number;
    life : number;
    isListen: boolean;
  }>>([]);
  const waveTimerRef  = useRef(0);
  const ampCurrentRef = useRef(0);
  const ampWaveCoolRef= useRef(0);
  const stateRef      = useRef<StateName>('idle');

  // Valeurs interpolées (lerp chaque frame)
  const curRef = useRef({
    rotSpeed         : STATE_CFG.idle.rotSpeed,
    tint             : [...STATE_CFG.idle.tint] as [number, number, number],
    tintStr          : STATE_CFG.idle.tintStr,
    glowMult         : STATE_CFG.idle.glowMult,
    baseScale        : STATE_CFG.idle.baseScale,
    lineOpacity      : STATE_CFG.idle.lineOpacity,
    pulseIntensity   : STATE_CFG.idle.pulseIntensity,
    flickerIntensity : STATE_CFG.idle.flickerIntensity,
    driftMult        : STATE_CFG.idle.driftMult,
  });

  // Sync state ref sans re-render
  useEffect(() => { stateRef.current = clusterState; }, [clusterState]);
  useEffect(() => {
    const store = useClusterStore.getState();
    // amplitude est lu directement depuis store dans useFrame
  }, []);

  // ── Construction de la scène (une seule fois) ────────────────────────────
  const {
    coreMat, glowMat, lineMat,
    corePosAttr, glowPosAttr, linePosAttr,
    basePos, driftPhases, linePairs,
  } = useMemo(() => {
    const dpr = Math.min(gl.getPixelRatio(), 2);

    // Positions + attributs étoiles
    const pos      = new Float32Array(STAR_COUNT * 3);
    const col      = new Float32Array(STAR_COUNT * 3);
    const sizes    = new Float32Array(STAR_COUNT);
    const twinkles = new Float32Array(STAR_COUNT);

    const palette = [0x4da6ff, 0x00f0ff, 0x7ac8ff].map(h => new THREE.Color(h));

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = Math.pow(Math.random(), 0.55) * CLUSTER_R;  // V1: 0.55
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      pos[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sizes[i]    = 0.5 + Math.random() * 2.0;  // V1: max 2.0
      twinkles[i] = Math.random() * Math.PI * 2;
    }

    // Drift phases
    const driftPhases = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT * 3; i++) driftPhases[i] = Math.random() * Math.PI * 2;

    // Uniforms factory
    const mkUniforms = (tex: THREE.Texture) => ({
      uTime    : { value: 0 },
      uDPR     : { value: dpr },
      uTex     : { value: tex },
      uTint    : { value: new THREE.Vector3(1, 1, 1) },
      uTintStr : { value: 0 },
      uGlowMult: { value: 1 },
    });

    // Core geometry
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    coreGeo.setAttribute('aColor',   new THREE.BufferAttribute(col.slice(), 3));
    coreGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes.slice(), 1));
    coreGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles.slice(), 1));
    const coreMat = new THREE.ShaderMaterial({
      uniforms      : mkUniforms(makePointTexture(true)),
      vertexShader  : CORE_VS,
      fragmentShader: PARTICLE_FS,
      transparent   : true,
      blending      : THREE.AdditiveBlending,
      depthWrite    : false,
      depthTest     : false,
    });
    const corePosAttr = coreGeo.attributes.position as THREE.BufferAttribute;

    // Glow geometry
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    glowGeo.setAttribute('aColor',   new THREE.BufferAttribute(col.slice(), 3));
    glowGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes.slice(), 1));
    glowGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles.slice(), 1));
    const glowMat = new THREE.ShaderMaterial({
      uniforms      : mkUniforms(makePointTexture(false)),
      vertexShader  : GLOW_VS,
      fragmentShader: PARTICLE_FS,
      transparent   : true,
      blending      : THREE.AdditiveBlending,
      depthWrite    : false,
      depthTest     : false,
    });
    const glowPosAttr = glowGeo.attributes.position as THREE.BufferAttribute;

    // Connexions synaptiques
    const linePairs: number[] = [];
    const lp: number[]        = [];
    const lphases: number[]   = [];
    const T2 = CONN_THRESH * CONN_THRESH;

    for (let i = 0; i < STAR_COUNT; i++) {
      for (let j = i + 1; j < STAR_COUNT; j++) {
        const dx = pos[i*3] - pos[j*3];
        const dy = pos[i*3+1] - pos[j*3+1];
        const dz = pos[i*3+2] - pos[j*3+2];
        if (dx*dx + dy*dy + dz*dz >= T2) continue;
        linePairs.push(i, j);
        lp.push(pos[i*3], pos[i*3+1], pos[i*3+2], pos[j*3], pos[j*3+1], pos[j*3+2]);
        // Même phase pour les deux extrémités d'un segment
        const phase = Math.random() * Math.PI * 2;
        lphases.push(phase, phase);
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp), 3));
    lineGeo.setAttribute('aPhase',   new THREE.BufferAttribute(new Float32Array(lphases), 1));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime            : { value: 0 },
        uBaseOpacity     : { value: 0.055 },
        uPulseIntensity  : { value: 0 },
        uFlickerIntensity: { value: 0 },
        uLineColor       : { value: new THREE.Vector3(0.30, 0.88, 1.0) },
      },
      vertexShader  : LINE_VS,
      fragmentShader: LINE_FS,
      transparent   : true,
      blending      : THREE.AdditiveBlending,
      depthWrite    : false,
      depthTest     : false,
    });
    const linePosAttr = lineGeo.attributes.position as THREE.BufferAttribute;

    return {
      coreMat, coreGeo, glowMat, glowGeo, lineMat, lineGeo,
      corePosAttr, glowPosAttr, linePosAttr,
      basePos : new Float32Array(pos),
      driftPhases,
      linePairs,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Émettre une onde concentrique ────────────────────────────────────────
  const emitWave = (isListen: boolean) => {
    if (!groupRef.current) return;
    const N   = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color      : isListen ? 0x00e8ff : 0x00f5ff,
      transparent: true,
      opacity    : isListen ? 0.55 : 0.88,
      blending   : THREE.AdditiveBlending,
      depthWrite : false,
      depthTest  : false,
    });
    const ring = new THREE.Line(geo, mat);
    groupRef.current.add(ring);
    wavesRef.current.push({ mesh: ring, mat, scale: 1.0, life: 1.0, isListen });
  };

  // ── Boucle principale ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Avance le temps (stabilisé à 60fps)
    timeRef.current += Math.min(delta, 0.05) * 60 * 0.01;
    const t   = timeRef.current;
    const cfg = STATE_CFG[stateRef.current];
    const cur = curRef.current;

    // SceneMult (vitesse + glow) tirés du store sans subscription re-render
    const { speed: sceneSpeed, glow: sceneGlow } = useClusterStore.getState().sceneMult;

    // Amplitude TTS (tirée du store sans subscription re-render)
    const ampTarget = useClusterStore.getState().amplitude;
    ampCurrentRef.current = lerp(ampCurrentRef.current, ampTarget, 0.18);
    if (ampWaveCoolRef.current > 0) ampWaveCoolRef.current--;

    // ── Interpolation des valeurs vers la cible d'état ──
    const K = LERP_K;
    // rotSpeed modulé par sceneSpeed (clamped pour éviter micro-tremblements)
    const targetRotSpeed  = cfg.rotSpeed * Math.max(0.1, sceneSpeed);
    cur.rotSpeed          = lerp(cur.rotSpeed,          targetRotSpeed,        K);
    cur.tint[0]           = lerp(cur.tint[0],           cfg.tint[0],           K);
    cur.tint[1]           = lerp(cur.tint[1],           cfg.tint[1],           K);
    cur.tint[2]           = lerp(cur.tint[2],           cfg.tint[2],           K);
    cur.tintStr           = lerp(cur.tintStr,           cfg.tintStr,           K);
    cur.glowMult          = lerp(cur.glowMult,          cfg.glowMult,          K);
    cur.lineOpacity       = lerp(cur.lineOpacity,       cfg.lineOpacity,       K);
    cur.pulseIntensity    = lerp(cur.pulseIntensity,    cfg.pulseIntensity,    K);
    cur.flickerIntensity  = lerp(cur.flickerIntensity,  cfg.flickerIntensity,  K);
    cur.driftMult         = lerp(cur.driftMult,         cfg.driftMult,         K);
    // baseScale converge plus lentement — effet de contracture/expansion lent
    cur.baseScale         = lerp(cur.baseScale,         cfg.baseScale,         K * 0.55);

    // ── Dérive des étoiles (wander) ──────────────────────────────────────
    const tDrift  = t * 0.078;
    const dAmp    = cur.driftMult * 2.6;
    const cArr    = corePosAttr.array as Float32Array;
    const gArr    = glowPosAttr.array as Float32Array;
    const lArr    = linePosAttr.array as Float32Array;
    const bp      = basePos;
    const ph      = driftPhases;

    for (let i = 0; i < STAR_COUNT * 3; i++) {
      const offset = Math.sin(tDrift + ph[i]) * dAmp;
      cArr[i] = bp[i] + offset;
      gArr[i] = bp[i] + offset;
    }
    corePosAttr.needsUpdate = true;
    glowPosAttr.needsUpdate = true;

    // Mise à jour des positions de ligne depuis les étoiles
    let li = 0;
    for (let p = 0; p < linePairs.length; p += 2) {
      const a = linePairs[p]   * 3;
      const b = linePairs[p+1] * 3;
      lArr[li++] = cArr[a];   lArr[li++] = cArr[a+1]; lArr[li++] = cArr[a+2];
      lArr[li++] = cArr[b];   lArr[li++] = cArr[b+1]; lArr[li++] = cArr[b+2];
    }
    linePosAttr.needsUpdate = true;

    // ── Rotation + flottaison galactique ──────────────────────────────────
    groupRef.current.rotation.y += cur.rotSpeed;
    groupRef.current.rotation.x  = Math.sin(t * 0.038) * 0.08 + Math.cos(t * 0.014) * 0.038;
    groupRef.current.rotation.z  = Math.sin(t * 0.019) * 0.048;
    groupRef.current.position.y  = Math.sin(t * 0.028) * 0.22;

    // ── Scale global — respiration organique ────────────────────────────
    // Deux fréquences : respiration lente + micro-variation
    let scale = cur.baseScale
      + 0.012 * Math.sin(t * 0.38)   // respiration profonde ~4s
      + 0.004 * Math.sin(t * 1.05);  // micro-variation

    if (cfg.emitWaves) {
      const amp = ampCurrentRef.current;
      if (amp > 0.05) {
        // Piloté par amplitude TTS
        scale += amp * 0.24 + 0.018 * Math.sin(t * 14.0);
        cur.glowMult += amp * 2.2;
        cur.tintStr   = lerp(cur.tintStr, 0.72, amp);
      } else {
        // Fallback sin (TTS inactif)
        scale += 0.028 * Math.sin(t * 3.1) + 0.010 * Math.sin(t * 6.2);
      }
    }
    groupRef.current.scale.setScalar(scale);

    // ── Uniforms particules ───────────────────────────────────────────────
    const updateParticleMat = (mat: THREE.ShaderMaterial) => {
      const u = mat.uniforms;
      u.uTime.value = t;
      u.uTint.value.set(cur.tint[0], cur.tint[1], cur.tint[2]);
      u.uTintStr.value  = cur.tintStr;
      u.uGlowMult.value = cur.glowMult;
    };
    updateParticleMat(coreMat);
    updateParticleMat(glowMat);

    // ── Uniforms connexions ───────────────────────────────────────────────
    const lu = lineMat.uniforms;
    lu.uTime.value             = t;
    lu.uBaseOpacity.value      = cur.lineOpacity;
    lu.uPulseIntensity.value   = cur.pulseIntensity;
    lu.uFlickerIntensity.value = cur.flickerIntensity;

    // ── Émission d'ondes ──────────────────────────────────────────────────
    waveTimerRef.current++;
    if (cfg.emitWaves) {
      const amp = ampCurrentRef.current;
      if (amp > 0.60 && ampWaveCoolRef.current === 0) {
        emitWave(false);
        ampWaveCoolRef.current = 20;
        waveTimerRef.current   = 0;
      } else if (amp <= 0.05 && waveTimerRef.current >= cfg.waveInterval) {
        emitWave(false);
        waveTimerRef.current = 0;
      }
    } else if (cfg.emitListenWaves && waveTimerRef.current >= cfg.waveInterval) {
      emitWave(true);
      waveTimerRef.current = 0;
    } else if (!cfg.emitWaves && !cfg.emitListenWaves) {
      waveTimerRef.current = 0;
    }

    // ── Mise à jour / expiration des ondes ────────────────────────────────
    for (let i = wavesRef.current.length - 1; i >= 0; i--) {
      const w = wavesRef.current[i];
      const expandSpeed = w.isListen ? 0.032 : 0.062;
      const decaySpeed  = w.isListen ? 0.009 : 0.014;
      w.scale += expandSpeed;
      w.life  -= decaySpeed;
      if (w.life <= 0) {
        groupRef.current?.remove(w.mesh);
        w.mat.dispose();
        w.mesh.geometry.dispose();
        wavesRef.current.splice(i, 1);
      } else {
        w.mesh.scale.set(w.scale, w.scale * 0.70, w.scale);
        w.mat.opacity = w.life * (w.isListen ? 0.42 : 0.80);
      }
    }
  });

  // ── Nettoyage ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      wavesRef.current.forEach(w => {
        w.mat.dispose();
        w.mesh.geometry.dispose();
      });
      coreMat.dispose();
      glowMat.dispose();
      lineMat.dispose();
    };
  }, [coreMat, glowMat, lineMat]);

  // ── Rendu JSX ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Fond profond — on ne veut pas le transparent du Canvas par défaut */}
      <color attach="background" args={['#03050d']} />

      {/* Caméra perspective */}
      <perspectiveCamera
        makeDefault
        position={[0, 0, CAMERA_Z]}
        fov={60}
        near={0.1}
        far={1000}
      />

      {/* Groupe principal — toute la rotation se fait ici */}
      <group ref={groupRef}>
        {/* Nœuds — couche core */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[corePosAttr.array as Float32Array, 3]} />
          </bufferGeometry>
          <primitive object={coreMat} attach="material" />
        </points>

        {/* Nœuds — couche halo (bloom feed) */}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[glowPosAttr.array as Float32Array, 3]} />
          </bufferGeometry>
          <primitive object={glowMat} attach="material" />
        </points>

        {/* Connexions synaptiques */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePosAttr.array as Float32Array, 3]} />
          </bufferGeometry>
          <primitive object={lineMat} attach="material" />
        </lineSegments>
      </group>

      {/* Post-processing : bloom cinématique ──────────────────────────── */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.88}
          mipmapBlur
          kernelSize={KernelSize.MEDIUM}
          blendFunction={BlendFunction.ADD}
        />
      </EffectComposer>
    </>
  );
}
