'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface BrainModelProps {
  activeNetwork: string | null;
  hoveredNetwork: string | null;
  autoRotate: boolean;
  isBaseline?: boolean;
  position?: [number, number, number];
  headphonesOn?: boolean;
  deepPressureOn?: boolean;
  calmBreathingOn?: boolean;
  onSelectHotspot?: (id: string) => void;
  simNoiseLevel?: number;
  simScreenLight?: number;
  simBodyAgitation?: number;
  selectedHotspot?: string | null;
  handRotationRef?: React.MutableRefObject<{ x: number, y: number, z: number }>;
}

const networkIds: { [key: string]: number } = {
  DMN: 1,
  FPN: 2,
  SN: 3,
  DAN: 4,
  VN: 5,
  AN: 6,
  SMN: 7,
};

const LOBE_HOTSPOTS = [
  { id: 'frontal', normalizedId: 'frontal', name: 'Frontal Lobe (Captain Focus 🧩)', pos: [0, 0.6, 0.8], color: '#22d3ee' },
  { id: 'temporal_left', normalizedId: 'temporal', name: 'Left Temporal Lobe (Sound Receiver 🎵)', pos: [-1.15, 0.25, 0], color: '#facc15' },
  { id: 'temporal_right', normalizedId: 'temporal', name: 'Right Temporal Lobe (Sound Receiver 🎵)', pos: [1.15, 0.25, 0], color: '#facc15' },
  { id: 'occipital', normalizedId: 'occipital', name: 'Occipital Lobe (Movie Screen 🎨)', pos: [0, 0.1, -1.2], color: '#f472b6' },
  { id: 'parietal', normalizedId: 'parietal', name: 'Parietal Lobe (Movement Engine 🏃)', pos: [0, 0.8, -0.4], color: '#34d399' },
  { id: 'limbic', normalizedId: 'limbic', name: 'Limbic Core (Sensory Alert Hub ⚡)', pos: [0, 0.25, 0], color: '#fb923c' }
];

const pointsVertexShader = `
  uniform float uTime;
  uniform int uActiveNetwork;
  uniform int uHoveredNetwork;
  uniform int uIsBaseline;
  uniform int uCalmBreathing;
  uniform int uSelectedLobe;
  
  attribute float aNetwork;
  attribute float aPhase;
  attribute float aSize;
  
  varying vec3 vColor;
  varying float vOpacity;
  
  void main() {
    vColor = color;
    vOpacity = 0.42;
    
    float sizeMultiplier = 1.0;
    int netInt = int(aNetwork);
    
    vec3 displacedPosition = position;
    
    if (uCalmBreathing == 1) {
      // Calming overlay: overrides high stress alert network, bringing it to a calm respiration rhythm
      float breathe = sin(uTime * 1.8 + position.y * 2.0 + aPhase) * 0.25;
      sizeMultiplier = 1.1 + breathe;
      if (netInt == uActiveNetwork && uActiveNetwork > 0) {
        vOpacity = 0.7 + 0.15 * sin(uTime * 1.8 + aPhase);
        sizeMultiplier *= 1.4;
        displacedPosition += normalize(position) * (0.05 * breathe);
      } else {
        vOpacity = 0.3 + 0.1 * sin(uTime * 1.8 + aPhase);
      }
    } else if (uIsBaseline == 1) {
      // Slow, calm resting DMN pulse on baseline typical brain
      float pulse = sin(uTime * 1.5 + position.y * 2.0 + aPhase) * 0.4;
      sizeMultiplier = 1.1 + pulse;
      if (netInt == 1) { // DMN is resting active
        vOpacity = 0.58 + 0.22 * sin(uTime * 1.5 + aPhase);
        sizeMultiplier *= 1.3;
      } else {
        vOpacity = 0.22 + 0.1 * sin(uTime * 1.5 + aPhase);
      }
    } else if (uActiveNetwork > 0) {
      if (netInt == uActiveNetwork) {
        // High-performance biological pulsing and expansion wave in active nodes
        float wave = sin(uTime * 6.5 + position.y * 3.5 + aPhase) * 0.08;
        displacedPosition += normalize(position) * wave;
        
        sizeMultiplier = 2.2 + 0.9 * sin(uTime * 7.0 + aPhase);
        vOpacity = 0.95;
      } else {
        vOpacity = 0.24; // High baseline opacity so the brain structure is preserved!
      }
    } else if (uHoveredNetwork > 0) {
      if (netInt == uHoveredNetwork) {
        sizeMultiplier = 1.5 + 0.3 * sin(uTime * 9.0 + aPhase);
        vOpacity = 0.85;
      } else {
        vOpacity = 0.2;
      }
    }
    
    // Selected Lobe Highlighting
    if (uSelectedLobe > 0) {
      bool inLobe = false;
      if (uSelectedLobe == 1) { // Frontal
        if (position.z > 0.4 && position.y > 0.1) inLobe = true;
      } else if (uSelectedLobe == 2) { // Temporal
        if (abs(position.x) > 0.75 && abs(position.y) < 0.2) inLobe = true;
      } else if (uSelectedLobe == 3) { // Occipital
        if (position.z < -0.5) inLobe = true;
      } else if (uSelectedLobe == 4) { // Parietal/Somatosensory
        if (position.y > 0.4 && abs(position.x) < 0.55) inLobe = true;
      } else if (uSelectedLobe == 5) { // Limbic Core
        float distCenter = length(position - vec3(0.0, 0.25, 0.0));
        if (distCenter < 0.6) inLobe = true;
      }
      
      if (inLobe) {
        sizeMultiplier *= 2.0;
        vOpacity = 1.0;
        displacedPosition += normalize(position) * (0.04 * sin(uTime * 8.0));
      } else {
        vOpacity *= 0.45; // Soft dimming of non-selected points to preserve brain shape
      }
    }
    
    vOpacity = max(vOpacity, 0.25); // Baseline clamp to preserve shape
    
    vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = min(aSize * sizeMultiplier * (380.0 / -mvPosition.z), 18.0);
  }
`;

const pointsFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = exp(-dist * dist * 9.0);
    gl_FragColor = vec4(vColor, alpha * vOpacity);
  }
`;

const linesVertexShader = `
  uniform float uTime;
  uniform int uActiveNetwork;
  uniform int uIsBaseline;
  uniform int uCalmBreathing;
  uniform int uSelectedLobe;
  
  attribute float aNetwork;
  
  varying vec3 vColor;
  varying float vOpacity;
  
  void main() {
    vColor = color;
    int netInt = int(aNetwork);
    
    vec3 displacedPosition = position;
    
    if (uCalmBreathing == 1) {
      float pulse = sin(uTime * 1.8);
      vOpacity = 0.2 + 0.1 * pulse;
      if (netInt == uActiveNetwork && uActiveNetwork > 0) {
        vOpacity = 0.45 + 0.15 * pulse;
      }
    } else if (uIsBaseline == 1) {
      float pulse = sin(uTime * 1.5);
      vOpacity = 0.1 + 0.06 * pulse;
      if (netInt == 1) {
        vOpacity = 0.24 + 0.1 * pulse;
      }
    } else if (uActiveNetwork > 0) {
      if (netInt == uActiveNetwork) {
        // Radial line waving
        float wave = sin(uTime * 6.5 + position.y * 3.5) * 0.06;
        displacedPosition += normalize(position) * wave;
        
        vOpacity = 0.7 + 0.3 * sin(uTime * 7.0);
      } else {
        vOpacity = 0.10; // High baseline line opacity
      }
    } else {
      vOpacity = 0.18;
    }
    
    // Selected Lobe Highlighting for lines
    if (uSelectedLobe > 0) {
      bool inLobe = false;
      if (uSelectedLobe == 1) { // Frontal
        if (position.z > 0.4 && position.y > 0.1) inLobe = true;
      } else if (uSelectedLobe == 2) { // Temporal
        if (abs(position.x) > 0.75 && abs(position.y) < 0.2) inLobe = true;
      } else if (uSelectedLobe == 3) { // Occipital
        if (position.z < -0.5) inLobe = true;
      } else if (uSelectedLobe == 4) { // Parietal/Somatosensory
        if (position.y > 0.4 && abs(position.x) < 0.55) inLobe = true;
      } else if (uSelectedLobe == 5) { // Limbic Core
        float distCenter = length(position - vec3(0.0, 0.25, 0.0));
        if (distCenter < 0.6) inLobe = true;
      }
      
      if (inLobe) {
        vOpacity = 0.8;
      } else {
        vOpacity *= 0.35; // Soft dimming of non-selected region lines
      }
    }
    
    vOpacity = max(vOpacity, 0.15); // Baseline clamp to preserve shape
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const linesFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  
  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`;

const flowVertexShader = `
  attribute float aOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    vColor = color;
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = min(0.075 * (380.0 / -mvPosition.z), 12.0);
  }
`;

const flowFragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = exp(-dist * dist * 9.0);
    gl_FragColor = vec4(vColor, alpha * vOpacity);
  }
`;


export default function BrainModel({ 
  activeNetwork, 
  hoveredNetwork, 
  autoRotate, 
  isBaseline = false, 
  position = [0, 0, 0],
  headphonesOn = false,
  deepPressureOn = false,
  calmBreathingOn = false,
  onSelectHotspot,
  simNoiseLevel = 20,
  simScreenLight = 20,
  simBodyAgitation = 20,
  selectedHotspot,
  handRotationRef
}: BrainModelProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const pointsMatRef = useRef<THREE.ShaderMaterial>(null);
  const linesMatRef = useRef<THREE.ShaderMaterial>(null);
  const flowPointsRef = useRef<THREE.Points>(null);
  
  const rightShellRef = useRef<THREE.Mesh>(null);
  const leftShellRef = useRef<THREE.Mesh>(null);
  const shakeGroupRef = useRef<THREE.Group>(null);
  
  // Ref for smoothed physical momentum
  const smoothedRot = useRef<{x: number, y: number, scale: number}>({ x: 0, y: 0, scale: 1.0 });

  const breathingRingsRef = useRef<THREE.Group>(null);
  const hotspotsGroupRef = useRef<THREE.Group>(null);

  // Map selected hotspot to uniform integer
  const selectedLobeId = useMemo(() => {
    switch (selectedHotspot) {
      case 'frontal': return 1;
      case 'temporal': return 2;
      case 'occipital': return 3;
      case 'parietal': return 4;
      case 'limbic': return 5;
      default: return 0;
    }
  }, [selectedHotspot]);

  // Map network code to int
  const activeNetId = useMemo(() => (activeNetwork ? networkIds[activeNetwork] || 0 : 0), [activeNetwork]);
  const hoveredNetId = useMemo(() => (hoveredNetwork ? networkIds[hoveredNetwork] || 0 : 0), [hoveredNetwork]);

  // Generate 150 flow particles
  const flowData = useMemo(() => {
    const count = 150;
    const startPositions = new Float32Array(count * 3);
    const endPositions = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const progresses = new Float32Array(count);
    const networkIds = new Float32Array(count); // 5 = VN, 6 = AN, 7 = SMN

    const vnColor = new THREE.Color('#f472b6');  // Pink
    const anColor = new THREE.Color('#facc15');  // Yellow
    const snColor = new THREE.Color('#fb923c');  // Orange

    for (let i = 0; i < count; i++) {
      let startX = 0, startY = 0, startZ = 0;
      let netId = 5;
      let color = vnColor;

      if (i < 50) {
        // Visual (VN) - occipital lobe (z < -0.8)
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * 0.5 + 2.2;
        const r = 1.1 + Math.random() * 0.35;
        startX = r * Math.sin(theta) * Math.cos(phi);
        startY = r * Math.sin(theta) * Math.sin(phi) + 0.25;
        startZ = r * Math.cos(theta);
        netId = 5;
        color = vnColor;
      } else if (i < 100) {
        // Auditory (AN) - lateral temporal lobes
        const side = Math.random() > 0.5 ? 1 : -1;
        startX = side * (1.1 + Math.random() * 0.35);
        startY = 0.1 + 0.3 * (Math.random() - 0.5) + 0.25;
        startZ = 0.2 * (Math.random() - 0.5);
        netId = 6;
        color = anColor;
      } else {
        // Somatosensory/Salience (SMN/SN) - central superior strip
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * 0.8;
        const r = 1.1 + Math.random() * 0.35;
        startX = r * Math.sin(theta) * Math.cos(phi);
        startY = r * Math.sin(theta) * Math.sin(phi) + 0.25;
        startZ = r * Math.cos(theta);
        netId = 7;
        color = snColor;
      }

      // Target subcortical core center
      const endX = 0.15 * (Math.random() - 0.5);
      const endY = 0.25 + 0.15 * (Math.random() - 0.5);
      const endZ = 0.15 * (Math.random() - 0.5);

      startPositions[i * 3] = startX;
      startPositions[i * 3 + 1] = startY;
      startPositions[i * 3 + 2] = startZ;

      endPositions[i * 3] = endX;
      endPositions[i * 3 + 1] = endY;
      endPositions[i * 3 + 2] = endZ;

      positions[i * 3] = startX;
      positions[i * 3 + 1] = startY;
      positions[i * 3 + 2] = startZ;

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      speeds[i] = 0.45 + Math.random() * 0.55;
      progresses[i] = Math.random();
      networkIds[i] = netId;
    }

    return {
      startPositions,
      endPositions,
      positions,
      colors,
      speeds,
      progresses,
      networkIds
    };
  }, []);

  const flowOpacities = useMemo(() => new Float32Array(150), []);

  // Generate brain particles
  const pointsData = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const networks: number[] = [];
    const phases: number[] = [];
    const sizes: number[] = [];

    const networkColors: { [key: string]: THREE.Color } = {
      DMN: new THREE.Color('#c084fc'), // Purple
      FPN: new THREE.Color('#22d3ee'), // Cyan
      SN: new THREE.Color('#fb923c'),  // Orange
      DAN: new THREE.Color('#60a5fa'), // Blue
      VN: new THREE.Color('#f472b6'),  // Pink
      AN: new THREE.Color('#facc15'),  // Yellow
      SMN: new THREE.Color('#34d399'), // Green
    };

    const getNetwork = (x: number, y: number, z: number, isCerebellum: boolean, isStem: boolean, isCore: boolean): string => {
      if (isStem) return 'SN';
      if (isCore) {
        // Core/limbic maps mostly to Salience (SN) and Default Mode (DMN)
        return Math.random() > 0.5 ? 'SN' : 'DMN';
      }
      if (isCerebellum) return Math.random() > 0.5 ? 'SMN' : 'DAN';

      // Spatial cortex regions mapping
      if (z > 0.4 && y > 0.1) {
        return Math.random() > 0.6 ? 'FPN' : 'DAN';
      }
      if (z < -0.5) {
        return 'VN';
      }
      if (Math.abs(x) > 0.75 && Math.abs(y) < 0.2) {
        return 'AN';
      }
      if (y > 0.4 && Math.abs(x) < 0.55) {
        return 'SMN';
      }
      if (Math.abs(x) < 0.3 && Math.abs(y) < 0.3 && Math.abs(z) < 0.3) {
        return 'SN';
      }
      return 'DMN';
    };

    // 1. Generate Cortex Hemispheres (3,000 points)
    const cortexCount = 3000;
    for (let i = 0; i < cortexCount; i++) {
      const theta = Math.acos(Math.random() * 2 - 1);
      const phi = Math.random() * Math.PI * 2;
      const hemi = Math.random() > 0.5 ? 1 : -1;

      // Ellipsoid base
      let bx = 1.35 * Math.sin(theta) * Math.cos(phi);
      let by = 1.15 * Math.sin(theta) * Math.sin(phi);
      let bz = 1.65 * Math.cos(theta);

      // Hemispheres push
      bx += hemi * 0.16;

      // Mathematical sulci / gyri convolutions
      const freq = 6.5;
      const amp = 0.15;
      const wave = Math.sin(bx * freq) * Math.cos(by * freq) * Math.sin(bz * freq);
      const scale = 1.0 + amp * wave;

      const x = bx * scale;
      const y = by * scale + 0.25; // shift up
      const z = bz * scale;

      const net = getNetwork(x, y, z, false, false, false);
      const color = networkColors[net];

      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      networks.push(networkIds[net]);
      phases.push(Math.random() * Math.PI * 2);
      sizes.push(0.045 + Math.random() * 0.045);
    }

    // 2. Generate Subcortical Limbic Core (800 points)
    const coreCount = 800;
    for (let i = 0; i < coreCount; i++) {
      const theta = Math.acos(Math.random() * 2 - 1);
      const phi = Math.random() * Math.PI * 2;
      
      // Smaller interior sphere
      const r = 0.1 + Math.random() * 0.45;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi) + 0.25; // aligned to cortex center
      const z = r * Math.cos(theta);

      const net = getNetwork(x, y, z, false, false, true);
      const color = networkColors[net];

      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      networks.push(networkIds[net]);
      phases.push(Math.random() * Math.PI * 2);
      sizes.push(0.025 + Math.random() * 0.03); // smaller, denser core points
    }

    // 3. Generate Cerebellum (500 points)
    const cerebellumCount = 500;
    for (let i = 0; i < cerebellumCount; i++) {
      const theta = Math.acos(Math.random() * 2 - 1);
      const phi = Math.random() * Math.PI * 2;

      // Squashed ellipsoid
      const bx = 0.95 * Math.sin(theta) * Math.cos(phi);
      const by = 0.45 * Math.sin(theta) * Math.sin(phi);
      const bz = 0.75 * Math.cos(theta);

      const x = bx;
      const y = by - 0.75;
      const z = bz - 0.95;

      const net = getNetwork(x, y, z, true, false, false);
      const color = networkColors[net];

      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      networks.push(networkIds[net]);
      phases.push(Math.random() * Math.PI * 2);
      sizes.push(0.03 + Math.random() * 0.025);
    }

    // 4. Generate Stem (200 points)
    const stemCount = 200;
    for (let i = 0; i < stemCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.22 + Math.random() * 0.08;
      const y = -0.55 - Math.random() * 0.75;

      const x = Math.cos(angle) * radius;
      const z = -0.15 + Math.sin(angle) * radius;

      const net = 'SN';
      const color = networkColors[net];

      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      networks.push(networkIds[net]);
      phases.push(Math.random() * Math.PI * 2);
      sizes.push(0.035 + Math.random() * 0.025);
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      networks: new Float32Array(networks),
      phases: new Float32Array(phases),
      sizes: new Float32Array(sizes)
    };
  }, []);

  // Generate connection lines (Neural white matter pathways)
  const connectionsData = useMemo(() => {
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const lineNetworks: number[] = [];

    const hubIndices: number[] = [];
    const totalPoints = pointsData.positions.length / 3;

    // Pick hub indices (higher density connections)
    for (let i = 0; i < totalPoints; i += 18) {
      hubIndices.push(i);
    }

    const networkColors: { [key: number]: THREE.Color } = {
      1: new THREE.Color('#c084fc'),
      2: new THREE.Color('#22d3ee'),
      3: new THREE.Color('#fb923c'),
      4: new THREE.Color('#60a5fa'),
      5: new THREE.Color('#f472b6'),
      6: new THREE.Color('#facc15'),
      7: new THREE.Color('#34d399'),
    };

    // Calculate connections between nearby hubs of the same network
    for (let i = 0; i < hubIndices.length; i++) {
      const idxA = hubIndices[i];
      const xa = pointsData.positions[idxA * 3];
      const ya = pointsData.positions[idxA * 3 + 1];
      const za = pointsData.positions[idxA * 3 + 2];
      const netA = pointsData.networks[idxA];

      for (let j = i + 1; j < hubIndices.length; j++) {
        const idxB = hubIndices[j];
        const xb = pointsData.positions[idxB * 3];
        const yb = pointsData.positions[idxB * 3 + 1];
        const zb = pointsData.positions[idxB * 3 + 2];
        const netB = pointsData.networks[idxB];

        if (netA === netB) {
          const dist = Math.sqrt((xa - xb) ** 2 + (ya - yb) ** 2 + (za - zb) ** 2);
          // Slightly tighter connect radius for denser mesh look
          if (dist < 0.75) {
            linePositions.push(xa, ya, za);
            linePositions.push(xb, yb, zb);

            const col = networkColors[netA];
            lineColors.push(col.r, col.g, col.b);
            lineColors.push(col.r, col.g, col.b);

            lineNetworks.push(netA, netA);
          }
        }
      }
    }

    return {
      positions: new Float32Array(linePositions),
      colors: new Float32Array(lineColors),
      networks: new Float32Array(lineNetworks)
    };
  }, [pointsData]);

  // Sync uniforms on active/hover network change
  useEffect(() => {
    const isBaseInt = isBaseline ? 1 : 0;
    const isCalmInt = calmBreathingOn ? 1 : 0;
    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.uActiveNetwork.value = activeNetId;
      pointsMatRef.current.uniforms.uHoveredNetwork.value = hoveredNetId;
      pointsMatRef.current.uniforms.uIsBaseline.value = isBaseInt;
      pointsMatRef.current.uniforms.uCalmBreathing.value = isCalmInt;
      pointsMatRef.current.uniforms.uSelectedLobe.value = selectedLobeId;
    }
    if (linesMatRef.current) {
      linesMatRef.current.uniforms.uActiveNetwork.value = activeNetId;
      linesMatRef.current.uniforms.uIsBaseline.value = isBaseInt;
      linesMatRef.current.uniforms.uCalmBreathing.value = isCalmInt;
      linesMatRef.current.uniforms.uSelectedLobe.value = selectedLobeId;
    }
  }, [activeNetId, hoveredNetId, isBaseline, calmBreathingOn, selectedLobeId]);

  // Rotate brain gently and animate flow particles using useFrame
  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();

    const baseRotY = autoRotate ? elapsed * 0.05 : 0;
    const baseRotX = autoRotate ? Math.sin(elapsed * 0.02) * 0.08 : 0;
    
    // Read raw target values from ref
    const targetManualRotY = handRotationRef ? handRotationRef.current.x * 3.5 : 0;
    const targetManualRotX = handRotationRef ? handRotationRef.current.y * 3.5 : 0;
    const targetScale = handRotationRef ? handRotationRef.current.z : 1.0;

    // Apply Linear Interpolation (Lerp) for physical momentum and smoothness
    smoothedRot.current.y = THREE.MathUtils.lerp(smoothedRot.current.y, targetManualRotY, 0.1);
    smoothedRot.current.x = THREE.MathUtils.lerp(smoothedRot.current.x, targetManualRotX, 0.1);
    smoothedRot.current.scale = THREE.MathUtils.lerp(smoothedRot.current.scale, targetScale, 0.1);

    const targetRotY = baseRotY + smoothedRot.current.y;
    const targetRotX = baseRotX + smoothedRot.current.x;
    const currentScale = smoothedRot.current.scale;

    if (leftShellRef.current && rightShellRef.current) {
      leftShellRef.current.rotation.y = targetRotY;
      leftShellRef.current.rotation.x = targetRotX;
      leftShellRef.current.scale.setScalar(currentScale);
      
      rightShellRef.current.rotation.y = targetRotY;
      rightShellRef.current.rotation.x = targetRotX;
      rightShellRef.current.scale.setScalar(currentScale);
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y = targetRotY;
      pointsRef.current.rotation.x = targetRotX;
      pointsRef.current.scale.setScalar(currentScale);
    }

    if (linesRef.current) {
      linesRef.current.rotation.y = targetRotY;
      linesRef.current.rotation.x = targetRotX;
      linesRef.current.scale.setScalar(currentScale);
    }

    if (flowPointsRef.current) {
      flowPointsRef.current.rotation.y = targetRotY;
      flowPointsRef.current.rotation.x = targetRotX;
      flowPointsRef.current.scale.setScalar(currentScale);
    }

    if (hotspotsGroupRef.current) {
      hotspotsGroupRef.current.rotation.y = targetRotY;
      hotspotsGroupRef.current.rotation.x = targetRotX;
      hotspotsGroupRef.current.scale.setScalar(currentScale);
    }

    // Update flow particles positions and opacities
    if (flowPointsRef.current) {
      const geom = flowPointsRef.current.geometry;
      const posAttr = geom.attributes.position as THREE.BufferAttribute;
      const opacityAttr = geom.attributes.aOpacity as THREE.BufferAttribute;
      const count = flowData.progresses.length;

      // Active flow triggers: SN (Salience overload) triggers all, others trigger specific flows.
      // Baseline has no flow.
      const isVNActive = !isBaseline && (activeNetwork === 'VN' || activeNetwork === 'SN');
      const isANActive = !isBaseline && (activeNetwork === 'AN' || activeNetwork === 'SN');
      const isSMNActive = !isBaseline && (activeNetwork === 'SMN' || activeNetwork === 'SN');

      for (let i = 0; i < count; i++) {
        const netId = flowData.networkIds[i];
        let isFlowActive = false;
        if (netId === 5 && isVNActive) isFlowActive = true;
        if (netId === 6 && isANActive) isFlowActive = true;
        if (netId === 7 && isSMNActive) isFlowActive = true;

        // Animate opacity transition
        const targetOpacity = isFlowActive ? 0.75 + 0.25 * Math.sin(elapsed * 12.0 + i) : 0.0;
        const currentOpacity = opacityAttr.getX(i);
        const nextOpacity = THREE.MathUtils.lerp(currentOpacity, targetOpacity, 0.15);
        opacityAttr.setX(i, nextOpacity);

        // Progress flow along path
        if (isFlowActive) {
          const dt = Math.min(delta, 0.05);
          flowData.progresses[i] += dt * flowData.speeds[i] * 0.65;
          if (flowData.progresses[i] > 1.0) {
            flowData.progresses[i] = 0.0;
          }
        } else {
          // If inactive, slowly decay progress or reset
          flowData.progresses[i] = 0.0;
        }

        const p = flowData.progresses[i];
        const sIdx = i * 3;
        const startX = flowData.startPositions[sIdx];
        const startY = flowData.startPositions[sIdx + 1];
        const startZ = flowData.startPositions[sIdx + 2];
        const endX = flowData.endPositions[sIdx];
        const endY = flowData.endPositions[sIdx + 1];
        const endZ = flowData.endPositions[sIdx + 2];

        // Linear interpolation path
        let x = startX + (endX - startX) * p;
        let y = startY + (endY - startY) * p;
        let z = startZ + (endZ - startZ) * p;

        // Spiral vortex offset
        if (isFlowActive && p > 0.02) {
          const angle = p * Math.PI * 2.5 + elapsed * 3.5 + i;
          const waveAmp = 0.16 * Math.sin(p * Math.PI);
          x += Math.cos(angle) * waveAmp;
          z += Math.sin(angle) * waveAmp;
        }

        posAttr.setXYZ(i, x, y, z);
      }

      posAttr.needsUpdate = true;
      opacityAttr.needsUpdate = true;
    }

    // Dynamic Brain Shaking (high body agitation with coping tools damping)
    if (shakeGroupRef.current && !isBaseline) {
      const effectiveAgitation = simBodyAgitation * (deepPressureOn ? 0.25 : 1.0) * (calmBreathingOn ? 0.35 : 1.0);
      if (effectiveAgitation > 35) {
        const intensity = (effectiveAgitation - 35) * 0.0012; // Shake amplitude
        // Organic spring-like shake using smooth LERPing
        const targetX = (Math.sin(elapsed * 25.0) + (Math.random() - 0.5) * 0.3) * intensity;
        const targetY = (Math.cos(elapsed * 22.0) + (Math.random() - 0.5) * 0.3) * intensity;
        const targetZ = (Math.sin(elapsed * 18.0) + (Math.random() - 0.5) * 0.3) * intensity;

        shakeGroupRef.current.position.x = THREE.MathUtils.lerp(shakeGroupRef.current.position.x, targetX, 0.15);
        shakeGroupRef.current.position.y = THREE.MathUtils.lerp(shakeGroupRef.current.position.y, targetY, 0.15);
        shakeGroupRef.current.position.z = THREE.MathUtils.lerp(shakeGroupRef.current.position.z, targetZ, 0.15);
      } else {
        shakeGroupRef.current.position.x = THREE.MathUtils.lerp(shakeGroupRef.current.position.x, 0, 0.1);
        shakeGroupRef.current.position.y = THREE.MathUtils.lerp(shakeGroupRef.current.position.y, 0, 0.1);
        shakeGroupRef.current.position.z = THREE.MathUtils.lerp(shakeGroupRef.current.position.z, 0, 0.1);
      }
    }

    // Animate concentric respiration rings
    if (breathingRingsRef.current && !isBaseline && calmBreathingOn) {
      const children = breathingRingsRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const mesh = children[i] as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        
        // Loop phases offset by ring index
        const phase = (elapsed * 0.4 + i * 0.33) % 1.0; // Slow 2.5 second expansion loop
        const scaleVal = 0.9 + phase * 1.5;
        mesh.scale.set(scaleVal, scaleVal, scaleVal);
        mat.opacity = (1.0 - phase) * 0.18; // Fade out as it expands
      }
    }

    // Update time uniform for shaders
    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.uTime.value = elapsed;
    }
    if (linesMatRef.current) {
      linesMatRef.current.uniforms.uTime.value = elapsed;
    }
  });

  // Shader Materials configuration
  const shaders = useMemo(() => {
    return {
      points: {
        vertexShader: pointsVertexShader,
        fragmentShader: pointsFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uActiveNetwork: { value: 0 },
          uHoveredNetwork: { value: 0 },
          uIsBaseline: { value: 0 },
          uCalmBreathing: { value: 0 },
          uSelectedLobe: { value: 0 },
        }
      },
      lines: {
        vertexShader: linesVertexShader,
        fragmentShader: linesFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uActiveNetwork: { value: 0 },
          uIsBaseline: { value: 0 },
          uCalmBreathing: { value: 0 },
          uSelectedLobe: { value: 0 },
        }
      },
      flow: {
        vertexShader: flowVertexShader,
        fragmentShader: flowFragmentShader
      }
    };
  }, []);

  // Compute active border color for wireframe mesh
  const activeColor = useMemo(() => {
    if (isBaseline) {
      return new THREE.Color('#c084fc'); // Baseline resting DMN purple
    }
    if (activeNetwork) {
      switch (activeNetwork) {
        case 'DMN': return new THREE.Color('#c084fc');
        case 'FPN': return new THREE.Color('#22d3ee');
        case 'SN': return new THREE.Color('#fb923c');
        case 'DAN': return new THREE.Color('#60a5fa');
        case 'VN': return new THREE.Color('#f472b6');
        case 'AN': return new THREE.Color('#facc15');
        case 'SMN': return new THREE.Color('#34d399');
      }
    }
    return new THREE.Color('#00f2fe');
  }, [activeNetwork, isBaseline]);

  const showHotspots = !isBaseline && onSelectHotspot;

  return (
    <group position={position}>
      {/* Structural & Neural Core held inside Shaking Group */}
      <group ref={shakeGroupRef}>
        {/* Structural Low-Poly Wireframe Cortical Boundary Shells */}
        <mesh 
          ref={leftShellRef}
          position={[-0.16, 0.25, 0]} 
          scale={[1.15, 0.95, 1.45]}
        >
          <dodecahedronGeometry args={[1.05, 2]} />
          <meshBasicMaterial 
            color={activeNetwork || isBaseline ? activeColor : '#22e5ff'} 
            wireframe 
            transparent 
            opacity={activeNetwork || isBaseline ? 0.18 : 0.08} 
            depthWrite={false}
          />
        </mesh>

        <mesh 
          ref={rightShellRef}
          position={[0.16, 0.25, 0]} 
          scale={[1.15, 0.95, 1.45]}
        >
          <dodecahedronGeometry args={[1.05, 2]} />
          <meshBasicMaterial 
            color={activeNetwork || isBaseline ? activeColor : '#22e5ff'} 
            wireframe 
            transparent 
            opacity={activeNetwork || isBaseline ? 0.18 : 0.08} 
            depthWrite={false}
          />
        </mesh>

        {/* 3D Neural Points (Particles) */}
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pointsData.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[pointsData.colors, 3]}
            />
            <bufferAttribute
              attach="attributes-aNetwork"
              args={[pointsData.networks, 1]}
            />
            <bufferAttribute
              attach="attributes-aPhase"
              args={[pointsData.phases, 1]}
            />
            <bufferAttribute
              attach="attributes-aSize"
              args={[pointsData.sizes, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={pointsMatRef}
            vertexColors
            transparent
            depthWrite={false}
            vertexShader={shaders.points.vertexShader}
            fragmentShader={shaders.points.fragmentShader}
            uniforms={shaders.points.uniforms}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* 3D Connecting Neural Tracts */}
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[connectionsData.positions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[connectionsData.colors, 3]}
            />
            <bufferAttribute
              attach="attributes-aNetwork"
              args={[connectionsData.networks, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={linesMatRef}
            vertexColors
            transparent
            depthWrite={false}
            vertexShader={shaders.lines.vertexShader}
            fragmentShader={shaders.lines.fragmentShader}
            uniforms={shaders.lines.uniforms}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        {/* Sensory Flow Particle Stream */}
        {!isBaseline && (
          <points ref={flowPointsRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[flowData.positions, 3]}
              />
              <bufferAttribute
                attach="attributes-color"
                args={[flowData.colors, 3]}
              />
              <bufferAttribute
                attach="attributes-aOpacity"
                args={[flowOpacities, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              vertexColors
              transparent
              depthWrite={false}
              vertexShader={shaders.flow.vertexShader}
              fragmentShader={shaders.flow.fragmentShader}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}

        {/* 3D Interactive Hotspot Spheres */}
        {showHotspots && (
          <group ref={hotspotsGroupRef}>
            {LOBE_HOTSPOTS.map((hotspot) => (
              <mesh 
                key={hotspot.id} 
                position={hotspot.pos as [number, number, number]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectHotspot(hotspot.normalizedId);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'auto';
                }}
              >
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial 
                  color={hotspot.color} 
                  transparent 
                  opacity={0.65} 
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
                {/* Outer pulsing ring halo */}
                <mesh scale={[1.4, 1.4, 1.4]}>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshBasicMaterial
                    color={hotspot.color}
                    transparent
                    opacity={0.28}
                    wireframe
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                  />
                </mesh>
                
                {/* Glowing HTML Label */}
                <Html position={[0, 0.15, 0]} center zIndexRange={[100, 0]}>
                  <div style={{
                    background: selectedHotspot === hotspot.normalizedId ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: `1px solid ${selectedHotspot === hotspot.normalizedId ? hotspot.color : 'rgba(255,255,255,0.1)'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: selectedHotspot === hotspot.normalizedId ? '13px' : '10px',
                    fontWeight: selectedHotspot === hotspot.normalizedId ? 'bold' : 'normal',
                    opacity: selectedHotspot === hotspot.normalizedId ? 1 : 0.5,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: selectedHotspot === hotspot.normalizedId ? 'translateY(-20px) scale(1.1)' : 'translateY(0px)',
                    boxShadow: selectedHotspot === hotspot.normalizedId ? `0 4px 20px ${hotspot.color}60` : 'none',
                    pointerEvents: 'none' // Let the 3D mesh handle clicks
                  }}>
                    {hotspot.name.split(' (')[0]}
                  </div>
                </Html>
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Coping Tool 3D Visual Indicators (Stable filters outside of shake group) */}
      {!isBaseline && headphonesOn && (
        <mesh position={[0, 0.25, 0]} scale={[1.4, 1.1, 1.4]}>
          <torusGeometry args={[0.9, 0.04, 8, 24]} />
          <meshBasicMaterial 
            color="#22d3ee" 
            transparent 
            opacity={0.35 + 0.15 * Math.sin(Date.now() * 0.005)} 
            wireframe 
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {!isBaseline && deepPressureOn && (
        <mesh position={[0, 0.25, 0]} scale={[0.65, 0.65, 0.65]}>
          <dodecahedronGeometry args={[1.0, 1]} />
          <meshBasicMaterial 
            color="#34d399" 
            transparent 
            opacity={0.25 + 0.1 * Math.sin(Date.now() * 0.004)} 
            wireframe 
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Concentric Respiration Guides (Stable breathing rings) */}
      {!isBaseline && calmBreathingOn && (
        <group ref={breathingRingsRef}>
          <mesh>
            <sphereGeometry args={[1.2, 24, 24]} />
            <meshBasicMaterial 
              color="#c084fc" 
              transparent 
              wireframe
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.4, 24, 24]} />
            <meshBasicMaterial 
              color="#a855f7" 
              transparent 
              wireframe
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.6, 24, 24]} />
            <meshBasicMaterial 
              color="#d8b4fe" 
              transparent 
              wireframe
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
