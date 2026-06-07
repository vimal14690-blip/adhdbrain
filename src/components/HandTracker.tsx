'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import { Camera, AlertTriangle } from 'lucide-react';

interface HandTrackerProps {
  isActive: boolean;
  onToggle: () => void;
  onStimmingDetected: (intensity: number) => void;
  onHandMove?: (dx: number, dy: number, dz?: number) => void;
}

// Global promise to pre-load the model in the background immediately
let modelPromise: Promise<handpose.HandPose> | null = null;

export default function HandTracker({ isActive, onToggle, onStimmingDetected, onHandMove }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References to track movement for stimming heuristic
  const lastPositions = useRef<{x: number, y: number}[]>([]);
  const lastPinchDist = useRef<number | null>(null);
  const stimmingScore = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);

  // Background Pre-load
  useEffect(() => {
    if (!modelPromise) {
      modelPromise = handpose.load();
    }
    modelPromise.then(() => setIsModelLoaded(true)).catch(err => console.error("Prefetch error", err));
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCameraAndModel = async () => {
      try {
        setErrorMsg(null);
        // Request Camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
              resolve(videoRef.current);
            };
          });
          videoRef.current.play();
        }

        // Wait for pre-loaded model
        if (!modelPromise) modelPromise = handpose.load();
        const model = await modelPromise;
        setIsModelLoaded(true);

        // Start prediction loop
        renderLoop(model);
      } catch (err) {
        console.error("Camera or Model Error:", err);
        setErrorMsg("Failed to access camera or load ML model.");
      }
    };

    const renderLoop = async (activeModel: handpose.HandPose) => {
      if (!videoRef.current || !canvasRef.current || !isActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === 4 && ctx) {
        // Estimate hands
        const predictions = await activeModel.estimateHands(video);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (predictions.length > 0) {
          // Stimming Heuristic: Track rapid movement of the wrist and index tip
          let currentPositions: {x: number, y: number}[] = [];
          
          predictions.forEach((hand) => {
            // Check for FIST gesture
            const wrist = hand.landmarks[0];
            const indexTip = hand.landmarks[8];
            const middleTip = hand.landmarks[12];
            const ringTip = hand.landmarks[16];

            const distIndex = Math.hypot(wrist[0] - indexTip[0], wrist[1] - indexTip[1]);
            const distMiddle = Math.hypot(wrist[0] - middleTip[0], wrist[1] - middleTip[1]);
            const distRing = Math.hypot(wrist[0] - ringTip[0], wrist[1] - ringTip[1]);
            
            const avgDist = (distIndex + distMiddle + distRing) / 3;
            // Less than ~85 pixels distance from fingertips to wrist indicates a closed fist
            const isFist = avgDist < 85;

            // Draw skeleton landmarks. Red for FIST (grab), Cyan for open hand.
            ctx.fillStyle = isFist ? "rgba(239, 68, 68, 1)" : "rgba(0, 242, 254, 1)";
            ctx.strokeStyle = isFist ? "rgba(239, 68, 68, 0.5)" : "rgba(0, 242, 254, 0.5)";
            ctx.lineWidth = 2;

            hand.landmarks.forEach((kp) => {
              ctx.beginPath();
              ctx.arc(kp[0], kp[1], 3, 0, 2 * Math.PI);
              ctx.fill();
            });

            if (wrist && indexTip) {
              currentPositions.push({x: wrist[0], y: wrist[1]});
              currentPositions.push({x: indexTip[0], y: indexTip[1]});
            }

            // 5-finger pinch-to-zoom logic
            const thumbTip = hand.landmarks[4];
            const pinkyTip = hand.landmarks[20];
            const d1 = Math.hypot(thumbTip[0] - indexTip[0], thumbTip[1] - indexTip[1]);
            const d2 = Math.hypot(thumbTip[0] - middleTip[0], thumbTip[1] - middleTip[1]);
            const d3 = Math.hypot(thumbTip[0] - ringTip[0], thumbTip[1] - ringTip[1]);
            const d4 = Math.hypot(thumbTip[0] - pinkyTip[0], thumbTip[1] - pinkyTip[1]);
            const currentPinchDist = (d1 + d2 + d3 + d4) / 4;

            let dz = 0;
            // Only zoom when the hand is generally open (not a tight fist), to separate rotation and zoom
            if (!isFist && lastPinchDist.current !== null) {
              dz = (currentPinchDist - lastPinchDist.current) * 0.01; // Scale factor
            }
            lastPinchDist.current = currentPinchDist;

            // Emit hand movement (rotation + zoom)
            if (onHandMove) {
              let dx = 0;
              let dy = 0;
              
              if (isFist && lastPositions.current.length > 0) {
                const oldWrist = lastPositions.current[0];
                dx = -(wrist[0] - oldWrist.x) * 0.01; 
                dy = (wrist[1] - oldWrist.y) * 0.01;
              }

              if (dx !== 0 || dy !== 0 || dz !== 0) {
                onHandMove(dx, dy, dz);
              }
            }
          });

          // Calculate delta for stimming
          if (lastPositions.current.length === currentPositions.length) {
            let totalDelta = 0;
            for (let i = 0; i < currentPositions.length; i++) {
              const dx = currentPositions[i].x - lastPositions.current[i].x;
              const dy = currentPositions[i].y - lastPositions.current[i].y;
              totalDelta += Math.sqrt(dx * dx + dy * dy);
            }
            
            // If movement is rapid (threshold)
            if (totalDelta > 15) {
              stimmingScore.current += 10; // Increase score
            } else {
              stimmingScore.current = Math.max(0, stimmingScore.current - 2); // Decay
            }

            // If stimming score hits threshold, trigger event
            if (stimmingScore.current > 100) {
              // Normalize to 0.0 - 1.0 range
              const intensity = Math.min(1.0, stimmingScore.current / 200);
              onStimmingDetected(intensity);
              stimmingScore.current = 50; // Cool down
            }
          }
          lastPositions.current = currentPositions;
        } else {
          // Decay if no hands seen
          stimmingScore.current = Math.max(0, stimmingScore.current - 5);
          lastPinchDist.current = null;
        }
      }

      if (isActive) {
        animationFrameId.current = requestAnimationFrame(() => renderLoop(activeModel));
      }
    };

    if (isActive) {
      setupCameraAndModel();
    } else {
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      // Note: We intentionally do NOT reset isModelLoaded because it is cached globally!
      stimmingScore.current = 0;
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isActive, onStimmingDetected, onHandMove]);

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(10, 10, 20, 0.4)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      overflow: 'hidden',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Camera size={14} color="var(--primary)" />
          Live Telemetry Stream
        </h3>
        <button 
          onClick={onToggle}
          style={{
            background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 242, 254, 0.2)',
            border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 242, 254, 0.5)'}`,
            color: isActive ? '#fca5a5' : 'var(--primary)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            cursor: 'pointer'
          }}
        >
          {isActive ? 'Stop Camera' : 'Start Camera'}
        </button>
      </div>

      {isActive && (
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          aspectRatio: '4/3', 
          background: '#000', 
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {errorMsg ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
              <AlertTriangle size={24} color="#fca5a5" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{errorMsg}</span>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef}
                style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirror image
                  opacity: 0.6 // Dim video so skeleton pops
                }}
                playsInline 
                muted
              />
              <canvas 
                ref={canvasRef}
                width={320}
                height={240}
                style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  transform: 'scaleX(-1)' // Mirror canvas
                }}
              />
              {!isModelLoaded && !errorMsg && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Loading ML Models...</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {!isActive && (
        <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            Start the camera to enable live hand-gesture tracking for diagnostic telemetry.
          </p>
        </div>
      )}
    </div>
  );
}
