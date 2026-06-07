'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import BrainModel from './BrainModel';
import styles from '../app/page.module.css';

interface BrainCanvasProps {
  activeNetwork: string | null;
  hoveredNetwork: string | null;
  autoRotate: boolean;
  compareMode: boolean;
  // Coping tools for Child Simulator
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

const networkColors: { [key: string]: string } = {
  DMN: '#c084fc',
  FPN: '#22d3ee',
  SN: '#fb923c',
  DAN: '#60a5fa',
  VN: '#f472b6',
  AN: '#facc15',
  SMN: '#34d399',
};

// Spectrometer shaking background grid helper
function SpectrometerGrid({ color, noiseLevel }: { color: string; noiseLevel: number }) {
  const gridRef = useRef<THREE.GridHelper>(null);
  useFrame((state) => {
    if (!gridRef.current) return;
    const elapsed = state.clock.getElapsedTime();
    if (noiseLevel > 35) {
      // Moves up and down like an audio spectrometer wave
      const intensity = (noiseLevel - 35) * 0.007;
      gridRef.current.position.y = -1.7 + Math.sin(elapsed * 18.0) * intensity;
    } else {
      gridRef.current.position.y = -1.7;
    }
  });
  return <gridHelper ref={gridRef} args={[10, 20, color, '#070714']} position={[0, -1.7, 0]} />;
}

// Alarm ambient light that flashes on overload
function PulsingAlarmLight({ active }: { active: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!lightRef.current) return;
    if (active) {
      const elapsed = state.clock.getElapsedTime();
      // Wave intensity quickly
      lightRef.current.intensity = 1.8 + 1.5 * Math.sin(elapsed * 9.0);
    } else {
      lightRef.current.intensity = 0;
    }
  });
  return <pointLight ref={lightRef} position={[0, 3.5, 0]} color="#ef4444" distance={9} decay={1.3} />;
}

export default function BrainCanvas({ 
  activeNetwork, 
  hoveredNetwork, 
  autoRotate, 
  compareMode,
  headphonesOn = false,
  deepPressureOn = false,
  calmBreathingOn = false,
  onSelectHotspot,
  simNoiseLevel = 20,
  simScreenLight = 20,
  simBodyAgitation = 20,
  selectedHotspot,
  handRotationRef
}: BrainCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const backgroundStyle = useMemo(() => {
    if (activeNetwork) {
      switch (activeNetwork) {
        case 'SN':
          return { background: 'radial-gradient(circle, rgba(60, 15, 10, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'FPN':
          return { background: 'radial-gradient(circle, rgba(10, 35, 45, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'DMN':
          return { background: 'radial-gradient(circle, rgba(35, 15, 45, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'DAN':
          return { background: 'radial-gradient(circle, rgba(15, 25, 45, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'VN':
          return { background: 'radial-gradient(circle, rgba(45, 15, 35, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'AN':
          return { background: 'radial-gradient(circle, rgba(45, 40, 15, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
        case 'SMN':
          return { background: 'radial-gradient(circle, rgba(15, 45, 35, 0.95) 0%, rgba(7, 7, 20, 1) 100%)' };
      }
    }
    return { background: 'radial-gradient(circle, rgba(10, 25, 35, 0.9) 0%, rgba(7, 7, 20, 1) 100%)' };
  }, [activeNetwork]);

  const gridColor = useMemo(() => {
    if (simNoiseLevel > 55) {
      return '#ef4444'; // Flashing sensory alert grid color
    }
    if (activeNetwork) {
      switch (activeNetwork) {
        case 'DMN': return '#4a1d6d';
        case 'FPN': return '#0e4a50';
        case 'SN': return '#602e0b';
        case 'DAN': return '#12305c';
        case 'VN': return '#5c1d43';
        case 'AN': return '#54460d';
        case 'SMN': return '#0d5c3b';
      }
    }
    return '#002528';
  }, [activeNetwork, simNoiseLevel]);

  const activeColorValue = useMemo(() => {
    return activeNetwork ? networkColors[activeNetwork] : '#22e5ff';
  }, [activeNetwork]);

  // Alert triggers alarm light on salience overload (SN) or high agitation
  const isStorm = simNoiseLevel > 80 || simBodyAgitation > 80 || simScreenLight > 80;
  const isAlarmActive = activeNetwork === 'SN' || isStorm;

  return (
    <div className={`${styles.canvasContainer} ${isStorm ? styles.stormBackground : ''}`} style={isStorm ? {} : backgroundStyle}>
      {/* Side-by-side Overlay Labels in Compare Mode */}
      {compareMode && (
        <div className={styles.compareHeader}>
          <div className={styles.compareHeaderLabel}>
            <span className={styles.compareBaselineTag}>Typical Baseline</span>
            <span className={styles.compareSubtext}>Synchronous Resting DMN</span>
          </div>
          <div className={styles.compareHeaderLabel} style={{ borderRight: `2px solid ${activeColorValue}` }}>
            <span className={styles.compareSubjectTag} style={{ color: activeColorValue }}>
              Subject Telemetry
            </span>
            <span className={styles.compareSubtext}>
              {activeNetwork ? `${activeNetwork} Active` : 'Resting State'}
            </span>
          </div>
        </div>
      )}

      <Canvas
        camera={{ 
          position: [0, 0.2, isMobile ? (compareMode ? 6.5 : 5.0) : (compareMode ? 4.8 : 4.2)], 
          fov: 55 
        }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.6} />
        
        {/* Pulsing Alarm Glow in 3D Scene */}
        <PulsingAlarmLight active={isAlarmActive} />

        {/* Waving Spectrometer Grid Helper */}
        <SpectrometerGrid color={gridColor} noiseLevel={simNoiseLevel} />
        
        {compareMode ? (
          <>
            <group position={[-1.4, 0, 0]} scale={[0.72, 0.72, 0.72]}>
              <BrainModel
                activeNetwork={null}
                hoveredNetwork={null}
                autoRotate={autoRotate}
                isBaseline={true}
              />
            </group>
            <group position={[1.4, 0, 0]} scale={[0.72, 0.72, 0.72]}>
              <BrainModel
                activeNetwork={activeNetwork}
                hoveredNetwork={hoveredNetwork}
                autoRotate={autoRotate}
                isBaseline={false}
                headphonesOn={headphonesOn}
                deepPressureOn={deepPressureOn}
                calmBreathingOn={calmBreathingOn}
                onSelectHotspot={onSelectHotspot}
                simNoiseLevel={simNoiseLevel}
                simScreenLight={simScreenLight}
                simBodyAgitation={simBodyAgitation}
                selectedHotspot={selectedHotspot}
                handRotationRef={handRotationRef}
              />
            </group>
          </>
        ) : (
          <group position={[0, 0, 0]} scale={[1.0, 1.0, 1.0]}>
            <BrainModel
              activeNetwork={activeNetwork}
              hoveredNetwork={hoveredNetwork}
              autoRotate={autoRotate}
              isBaseline={false}
              headphonesOn={headphonesOn}
              deepPressureOn={deepPressureOn}
              calmBreathingOn={calmBreathingOn}
              onSelectHotspot={onSelectHotspot}
              simNoiseLevel={simNoiseLevel}
              simScreenLight={simScreenLight}
              simBodyAgitation={simBodyAgitation}
              selectedHotspot={selectedHotspot}
              handRotationRef={handRotationRef}
            />
          </group>
        )}
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxDistance={8}
          minDistance={2}
          enablePan={true}
        />
      </Canvas>
    </div>
  );
}
