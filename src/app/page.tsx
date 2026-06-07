'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/utils/supabase';
import { 
  Brain, 
  Send, 
  RefreshCw, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Clock, 
  Sparkles, 
  Info,
  Stethoscope,
  User,
  Activity,
  AlertTriangle,
  BookOpen,
  RotateCcw,
  Sliders,
  FileText,
  Download
} from 'lucide-react';
import styles from './page.module.css';

// Dynamically import Canvas and HandTracker with SSR disabled to avoid issues during SSR
const HandTracker = dynamic(() => import('@/components/HandTracker'), { ssr: false });
const BrainPopup = dynamic(() => import('@/components/BrainPopup'), { ssr: false });
const BrainCanvas = dynamic(() => import('@/components/BrainCanvas'), {
  ssr: false,
  loading: () => (
    <div className={styles.canvasLoading}>
      <div className={styles.spinner}></div>
      <p>Initializing Neural Engine...</p>
    </div>
  )
});

interface SHAPValues {
  heartRateVariability: number;
  repetitiveMotorPose: number;
  acousticOverload: number;
  wearableActivity: number;
  sleepDisruption: number;
}

interface ADOSScores {
  socialAffect: string;
  restrictedRepetitive: string;
  comparisonScore: string;
}

interface AnalysisResult {
  activeNetwork: string;
  reasoning: string;
  citation: string;
  regions: string[];
  brodmannAreas?: number[];
  neurotransmitters?: string[];
  adosScores?: ADOSScores;
  cognitiveLoad: number;
  confidence: number;
  meltdownRisk: 'low' | 'moderate' | 'high';
  leadTime: number;
  shapValues: SHAPValues;
  parentGuidance: string;
  clinicianNotes: string;
}

interface HistoryItem extends AnalysisResult {
  id: string;
  input: string;
  timestamp: string;
}

const PRESETS = [
  { text: "Wearable alerts: Autonomic spike, drop in HRV (-42%), and elevated wearableActivity.", tag: "SN" },
  { text: "YOLOv8 Pose: Repetitive hand-flapping and rocking behavior detected via camera feed.", tag: "SMN" },
  { text: "Intake sorting game: Child actively engaging in executive visual puzzle-solving therapy.", tag: "FPN" },
  { text: "Acoustic sensor: Sudden high-decibel vacuum cleaner noise triggering distress vocalization.", tag: "AN" },
  { text: "Subject resting: Inactive visual gaze wandering, calm breathing, normal baseline HRV.", tag: "DMN" }
];

const NETWORK_METADATA: { [key: string]: { name: string; desc: string; regions: string } } = {
  DMN: { 
    name: "Default Mode Network (DMN) 💭", 
    desc: "Under-connectivity in ASD often relates to challenges in 'Theory of Mind', social imagination, and internal self-reflection.", 
    regions: "Medial Prefrontal Cortex, Posterior Cingulate, Angular Gyrus"
  },
  FPN: { 
    name: "Frontoparietal Network (FPN) 🧩", 
    desc: "Executive Control. Over-reliance here in ASD often compensates for social-intuitive deficits by forcing 'manual' logical processing of social cues.",
    regions: "Dorsolateral Prefrontal Cortex, Posterior Parietal Cortex"
  },
  SN: { 
    name: "Salience Network (SN) ⚡", 
    desc: "The sensory threat alert system. Hyper-reactivity here causes severe autonomic meltdowns when the environment becomes unpredictable or overwhelming.",
    regions: "Anterior Insula, Dorsal Anterior Cingulate Cortex"
  },
  DAN: { 
    name: "Dorsal Attention Network (DAN) 🔍", 
    desc: "Controls voluntary visual search. In ASD, intensely focused interests or 'hyper-focus' heavily recruits this network.",
    regions: "Frontal Eye Fields, Intraparietal Sulcus"
  },
  VN: { 
    name: "Visual Network (VN) 🎨", 
    desc: "Processes visual input. Atypicalities often cause hyper-fixation on spinning objects, patterns, or extreme sensitivity to fluorescent lighting.",
    regions: "Primary Occipital Cortex, Striate Area"
  },
  AN: { 
    name: "Auditory Network (AN) 🎵", 
    desc: "Processes sound. In ASD, impaired filtering causes painful hypersensitivity to background noises (e.g., vacuums, crowds).",
    regions: "Heschl's Gyrus, Superior Temporal Gyrus"
  },
  SMN: { 
    name: "Somatomotor Network (SMN) 🏃", 
    desc: "Controls movement. In ASD, this drives self-regulating repetitive motor 'stimming' (rocking, hand-flapping) to manage sensory load.",
    regions: "Precentral Gyrus, Postcentral Gyrus, Supplementary Motor Area"
  }
};

const PATIENT_EMOJIS = [
  { emoji: "🧩", title: "Focused Play", desc: "Playing sorting game", network: "FPN" },
  { emoji: "💭", title: "Daydreaming", desc: "Mind-wandering / resting", network: "DMN" },
  { emoji: "⚡", title: "Sensory Spike", desc: "Feeling overwhelmed", network: "SN" },
  { emoji: "🏃", title: "Stimming", desc: "Hand-flapping / rocking", network: "SMN" },
  { emoji: "🎨", title: "Visual Focus", desc: "Watching animation", network: "VN" },
  { emoji: "🎵", title: "Acoustic Focus", desc: "Listening to sound", network: "AN" }
];

const NETWORK_ANALOGIES: { [key: string]: { parent: string; child: string } } = {
  DMN: {
    parent: "The Default Mode Network (DMN) manages 'Theory of Mind'—the ability to intuit what others are thinking or feeling. In ASD, lowered connectivity here explains why social imagination and predicting social cues can feel like a foreign language.",
    child: "Social Imagination! 💭 This part of the brain helps us guess what our friends are feeling. Sometimes it's a bit quiet, so we have to use our logic brain to figure out social puzzles."
  },
  FPN: {
    parent: "The Frontoparietal Network (FPN) is the brain's executive control center. Children with ASD often rely heavily on this logical network to 'manually' process social interactions that neurotypical brains process intuitively via the DMN.",
    child: "Captain Focus Mode! 🧩 Your brain's captain is steering the ship, using super-strong logic and rules to understand the world and solve puzzles."
  },
  SN: {
    parent: "The Salience Network (SN) is the threat-alert system. In ASD, this network is often hyper-reactive, interpreting loud noises or routine changes as physical threats, triggering sudden 'fight or flight' meltdowns.",
    child: "Sensory Alert Mode! ⚡ Your body's alarm system is very sensitive! It acts like a superhero trying to protect you, but sometimes it rings too loudly when it's just a vacuum cleaner."
  },
  DAN: {
    parent: "The Dorsal Attention Network (DAN) handles sustained visual attention. Intense, passionate 'special interests' (hyper-focus) heavily engage this network, allowing the child to study a topic for hours without fatigue.",
    child: "Laser Search Mode! 🔍 Your brain is using its superpower focus to learn everything it can about your favorite special interest!"
  },
  VN: {
    parent: "The Visual Network (VN) processes raw sight. Atypical filtering here can cause the child to seek out highly repetitive visual stims (like spinning fans) or suffer distress from fluorescent lighting.",
    child: "Movie Screen Mode! 🎨 Your brain loves watching beautiful patterns, spinning wheels, and bright colors to feel calm and happy."
  },
  AN: {
    parent: "The Auditory Network (AN) handles sound. Without typical sensory gating, all background sounds (clocks, distant traffic, conversations) are processed at equal volume, leading to rapid sensory exhaustion.",
    child: "Sound Receiver Mode! 🎵 Your ears are super-powered and can hear everything all at once! Sometimes wearing headphones helps give your superpower a rest."
  },
  SMN: {
    parent: "The Somatomotor Network (SMN) controls movement. Repetitive motor behaviors (stimming like hand-flapping or rocking) are driven by this network to self-soothe and disperse overwhelming sensory energy.",
    child: "Movement Engine Mode! 🏃 Your body is moving, rocking, or hand-flapping! This is your body's special way of releasing energy and feeling safe."
  }
};

const LOBE_DETAILS: { [key: string]: { name: string; emoji: string; desc: string; fact: string } } = {
  frontal: {
    name: "Prefrontal Cortex (FPN)",
    emoji: "🧩",
    desc: "The brain's executive control center. In ASD, this area often works overtime to 'manually' process social interactions that neurotypical brains process intuitively.",
    fact: "Intense focus on special interests relies heavily on this lobe's executive power!"
  },
  temporal: {
    name: "Temporal Lobe & Amygdala",
    emoji: "⚡",
    desc: "Houses the auditory cortex and the Amygdala (the threat detector). Hyper-reactivity here explains sudden sensory meltdowns to loud noises.",
    fact: "Noise-cancelling headphones directly reduce stress signals processed in this area."
  },
  occipital: {
    name: "Occipital Lobe",
    emoji: "🎨",
    desc: "Your brain's visual processor. Differences in filtering here can cause distress from fluorescent lights, or a deep love for visually spinning objects.",
    fact: "Visual stimming (like watching a spinning fan) helps self-soothe this lobe."
  },
  parietal: {
    name: "Parietal Lobe",
    emoji: "🏃",
    desc: "The Somatosensory engine. It handles physical touch and proprioception (knowing where your body is in space).",
    fact: "Deep pressure therapy (like a weighted blanket) sends calming signals directly here."
  },
  limbic: {
    name: "Limbic Core & Cerebellum",
    emoji: "🧠",
    desc: "Deep emotion and motor coordination. Atypical cerebellar development is strongly linked to motor stimming (hand-flapping, rocking) as a self-regulation tool.",
    fact: "Rhythmic rocking provides vestibular feedback that calms the entire limbic system."
  }
};

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [hoveredNetwork, setHoveredNetwork] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  
  // Tab selector: 'clinician' | 'parent' | 'patient'
  const [activeTab, setActiveTab] = useState<'clinician' | 'parent' | 'patient'>('clinician');
  
  // Left panel input mode: 'questionnaire' or 'text'
  const [inputMode, setInputMode] = useState<'questionnaire' | 'text'>('questionnaire');

  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [showObsidianInfo, setShowObsidianInfo] = useState(false);
  const [showBrainPopup, setShowBrainPopup] = useState(false);

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Fetch patients if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data: profileData }) => {
          if (profileData) setUserRole(profileData.role);
          
          if (profileData?.role === 'doctor') {
            supabase.from('patients').select('*').eq('doctor_id', session.user.id).then(({ data }) => {
              if (data && data.length > 0) {
                setPatients(data);
                setSelectedPatientId(data[0].id);
              }
            });
          }
        });
      }
    });
  }, []);

  // Computer Vision Hand Tracking State
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [cvStimmingLevel, setCvStimmingLevel] = useState<number>(0);
  // Using useRef to prevent React re-renders which destroy 60fps 3D performance
  const handRotationRef = useRef<{x: number, y: number, z: number}>({ x: 0, y: 0, z: 1.0 });

  const handleStimmingDetected = (intensity: number) => {
    setCvStimmingLevel(intensity);
    if (intensity > 0.5 && !isLoading) {
      const cvPrompt = `Live Computer Vision Alert: The webcam telemetry just detected rhythmic hand-flapping / motor stimming at an intensity of ${(intensity * 100).toFixed(0)}%. Please analyze this motor mannerism.`;
      handleAnalyze(cvPrompt);
    }
  };

  const handleHandMove = (dx: number, dy: number, dz: number = 0) => {
    // We mutate the ref directly. No re-renders!
    handRotationRef.current.x += dx;
    handRotationRef.current.y += dy;
    
    // Clamp zoom scale between 0.5 and 2.0
    handRotationRef.current.z = Math.max(0.5, Math.min(2.0, handRotationRef.current.z + dz));
  };

  const handleTabChange = (tab: 'clinician' | 'parent' | 'patient') => {
    setActiveTab(tab);
    if (tab === 'patient') {
      setInputMode('questionnaire');
    }
  };

  // Clinician Form state variables (Expanded for doctors)
  const [clinicianSAJoint, setClinicianSAJoint] = useState<number>(1); // Joint Attention: 0=Typical, 1=Subtle delay, 2=Severe delay
  const [clinicianSAGaze, setClinicianSAGaze] = useState<number>(1);   // Gaze Regulation: 0=Typical, 1=Unusual contact, 2=Severe avoidance
  const [clinicianSAGesture, setClinicianSAGesture] = useState<number>(1); // Gesture Integration: 0=Typical, 1=Reduced, 2=Absent
  const [clinicianRRBMotor, setClinicianRRBMotor] = useState<number>(0);  // Motor Mannerisms: 0=None, 1=Mild stimming, 2=Severe rocking
  const [clinicianRRBSensory, setClinicianRRBSensory] = useState<number>(0); // Sensory Seeking: 0=None, 1=Auditory/Visual seeking, 2=Severe overload
  const [clinicianRRBRoutine, setClinicianRRBRoutine] = useState<number>(0); // Routine Adherence: 0=Flexible, 1=Mild insistence, 2=Severe distress on change
  const [clinicianSpeech, setClinicianSpeech] = useState<string>('typical'); // typical, stereotypic, non-verbal
  const [clinicianVagalIndex, setClinicianVagalIndex] = useState<string>('normal'); // normal, distress, sleep-deprived-distress

  // Parent Form state variables (Expanded for parents)
  // 1. Environmental Stressors
  const [parentStressNoise, setParentStressNoise] = useState<boolean>(false);
  const [parentStressLight, setParentStressLight] = useState<boolean>(false);
  const [parentStressCrowd, setParentStressCrowd] = useState<boolean>(false);
  // 2. Observable Behaviors
  const [parentBehaveFlapping, setParentBehaveFlapping] = useState<boolean>(false);
  const [parentBehaveEars, setParentBehaveEars] = useState<boolean>(false);
  const [parentBehaveFixation, setParentBehaveFixation] = useState<boolean>(false);
  // 3. Autonomic / Wearable Inputs
  const [parentWearableHrSpike, setParentWearableHrSpike] = useState<boolean>(false);
  const [parentWearableSleepLoss, setParentWearableSleepLoss] = useState<boolean>(false);

  // Child Simulator state variables (Play & Learn)
  const [simNoiseLevel, setSimNoiseLevel] = useState<number>(20); // 0 to 100
  const [simScreenLight, setSimScreenLight] = useState<number>(20); // 0 to 100
  const [simBodyAgitation, setSimBodyAgitation] = useState<number>(20); // 0 to 100
  const [simHeadphones, setSimHeadphones] = useState<boolean>(false);
  const [simDeepPressure, setSimDeepPressure] = useState<boolean>(false);
  const [simCalmBreathing, setSimCalmBreathing] = useState<boolean>(false);

  const [breatheCycle, setBreatheCycle] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (!simCalmBreathing) return;
    const interval = setInterval(() => {
      setBreatheCycle(prev => prev === 'in' ? 'out' : 'in');
    }, 2500);
    return () => clearInterval(interval);
  }, [simCalmBreathing]);

  // Patient Emoji active selection (Fallback for logs)
  const [patientActiveEmoji, setPatientActiveEmoji] = useState<string | null>(null);

  const handleAnalyze = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setActiveNetwork(null);

    try {
      const response = await fetch('/api/reason', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: textToAnalyze }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = typeof data.error === 'object' && data.error !== null
          ? (data.error.message || JSON.stringify(data.error))
          : (data.error || 'Failed to analyze behavior');
        
        setErrorMessage(errMsg);
        if (errMsg.includes('API key') || errMsg.includes('API_KEY')) {
          setIsApiKeyMissing(true);
        }
        setIsLoading(false);
        return;
      }

      setResult(data);
      setActiveNetwork(data.activeNetwork);

      // Add to history list
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        input: textToAnalyze,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...data
      };
      setHistory(prev => [newItem, ...prev.slice(0, 9)]);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
      if (err.message?.includes('API key')) {
        setIsApiKeyMissing(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetClick = (presetText: string) => {
    setInputText(presetText);
    setInputMode('text');
    handleAnalyze(presetText);
  };

  const handleHistoryItemClick = (item: HistoryItem) => {
    setInputText(item.input);
    setInputMode('text');
    setResult({
      activeNetwork: item.activeNetwork,
      reasoning: item.reasoning,
      citation: item.citation,
      regions: item.regions,
      brodmannAreas: item.brodmannAreas,
      neurotransmitters: item.neurotransmitters,
      adosScores: item.adosScores,
      cognitiveLoad: item.cognitiveLoad,
      confidence: item.confidence,
      meltdownRisk: item.meltdownRisk,
      leadTime: item.leadTime,
      shapValues: item.shapValues,
      parentGuidance: item.parentGuidance,
      clinicianNotes: item.clinicianNotes
    });
    setActiveNetwork(item.activeNetwork);
  };

  // Child Simulator Reactivity Loop
  useEffect(() => {
    if (activeTab !== 'patient') return;

    let derivedNet = 'DMN';
    let derivedRisk: 'low' | 'moderate' | 'high' = 'low';
    let derivedLead = 0;
    let derivedLoad = 0.2;
    let derivedConfidence = 0.95;

    // Apply coping tool attenuation
    const effectiveNoise = simNoiseLevel * (simHeadphones ? 0.15 : 1.0);
    const effectiveVisual = simScreenLight * 1.0;
    const effectiveStress = simBodyAgitation * (simDeepPressure ? 0.25 : 1.0) * (simCalmBreathing ? 0.35 : 1.0);

    if (effectiveStress > 55) {
      derivedNet = 'SN'; // Sensory Overload / Alarm
      derivedRisk = 'high';
      derivedLead = Math.max(15, Math.round(45 - (effectiveStress - 55) * 0.45));
      derivedLoad = 0.88;
    } else if (effectiveNoise > 55) {
      derivedNet = 'AN'; // Auditory
      derivedLoad = 0.68;
    } else if (effectiveVisual > 55) {
      derivedNet = 'VN'; // Visual
      derivedLoad = 0.62;
    } else if (simBodyAgitation > 50) {
      derivedNet = 'SMN'; // Sensorimotor
      derivedLoad = 0.58;
    } else if (simNoiseLevel > 30 || simScreenLight > 30) {
      derivedNet = 'FPN'; // Executive Focus
      derivedLoad = 0.48;
    } else {
      derivedNet = 'DMN'; // Rest / Daydreaming
      derivedLoad = 0.22;
    }

    setActiveNetwork(derivedNet);
    
    setResult({
      activeNetwork: derivedNet,
      reasoning: `Child simulator live state dashboard: volume level is ${simNoiseLevel}dB (headphones: ${simHeadphones ? 'ON' : 'OFF'}), screen glare is ${simScreenLight}%, physical rocking is ${simBodyAgitation}% (weighted blanket: ${simDeepPressure ? 'ON' : 'OFF'}, breathing pacing: ${simCalmBreathing ? 'ON' : 'OFF'}).`,
      citation: "Simulator Calibrated Vagal Index Model",
      regions: derivedNet === 'SN' ? ['Anterior Insula', 'dACC'] : derivedNet === 'AN' ? ["Heschl's Gyrus"] : derivedNet === 'VN' ? ['Occipital Cortex'] : derivedNet === 'SMN' ? ['Precentral Gyrus'] : derivedNet === 'FPN' ? ['dlPFC', 'Parietal'] : ['mPFC', 'PCC'],
      brodmannAreas: derivedNet === 'SN' ? [47, 24] : derivedNet === 'AN' ? [41, 42] : derivedNet === 'VN' ? [17, 18] : derivedNet === 'SMN' ? [4, 6] : derivedNet === 'FPN' ? [9, 46] : [10, 31],
      neurotransmitters: derivedNet === 'SN' ? ['Glutamate excitation spike', 'GABA down-regulation'] : derivedNet === 'DMN' ? ['GABA homeostasis'] : ['Dopaminergic regulation'],
      adosScores: {
        socialAffect: derivedNet === 'SN' ? '+2: distressed social interaction withdrawal' : '0: typical reciprocal interactions',
        restrictedRepetitive: derivedNet === 'SMN' || derivedNet === 'SN' ? '+2: motor mannerisms active' : '0: no mannerisms observed',
        comparisonScore: derivedNet === 'SN' ? 'Clinical severity shifts to High' : 'Severity remains stable'
      },
      cognitiveLoad: derivedLoad,
      confidence: derivedConfidence,
      meltdownRisk: derivedRisk,
      leadTime: derivedLead,
      shapValues: {
        heartRateVariability: -1.0 * (effectiveStress / 100),
        repetitiveMotorPose: simBodyAgitation / 100,
        acousticOverload: simNoiseLevel / 100,
        wearableActivity: simBodyAgitation / 100,
        sleepDisruption: 0.1
      },
      parentGuidance: derivedNet === 'SN' 
        ? "Sensory overload alert! Help the child don Ear Defenders, apply the weighted blanket for deep pressure, and practice calm breathing." 
        : "Autonomic state is balanced. Encourage focused visual/cognitive puzzle play.",
      clinicianNotes: "Live simulator feedback loop."
    });
  }, [simNoiseLevel, simScreenLight, simBodyAgitation, simHeadphones, simDeepPressure, simCalmBreathing, activeTab]);

  const submitQuestionnaire = () => {
    let compiledPrompt = '';

    if (activeTab === 'clinician') {
      const jointDesc = clinicianSAJoint === 0 ? 'Typical joint attention' : clinicianSAJoint === 1 ? 'Subtle joint attention delay' : 'Impaired joint attention / low eye gaze';
      const GazeDesc = clinicianSAGaze === 0 ? 'Typical gaze contact' : clinicianSAGaze === 1 ? 'Unusual gaze contact' : 'Severe gaze avoidance';
      const gestureDesc = clinicianSAGesture === 0 ? 'Typical gesture integration' : clinicianSAGesture === 1 ? 'Reduced gesture coordination' : 'Absent gestures';
      const motorDesc = clinicianRRBMotor === 0 ? 'No motor mannerisms' : clinicianRRBMotor === 1 ? 'Mild hand-flapping stims' : 'Severe rhythmic body rocking';
      const sensoryDesc = clinicianRRBSensory === 0 ? 'Typical sensory response' : clinicianRRBSensory === 1 ? 'Mild sensory seeking' : 'Severe sensory overload / hypersensitivity';
      const routineDesc = clinicianRRBRoutine === 0 ? 'Typical routine adherence' : clinicianRRBRoutine === 1 ? 'Mild insistence on patterns' : 'Severe distress upon transition';
      const speechDesc = clinicianSpeech === 'typical' ? 'Typical speech patterns' : clinicianSpeech === 'stereotypic' ? 'Vocal stereotypies and echolalia' : 'Minimally verbal';
      const vagalDesc = clinicianVagalIndex === 'normal' ? 'Normal homeostatic vagal tone' : clinicianVagalIndex === 'distress' ? 'Vagal suppression (autonomic distress)' : 'Sleep-deprived vagal suppression';

      compiledPrompt = `Clinician Diagnostic Intake: [ADOS-2 SA Score] Joint Attention: ${jointDesc}, Gaze: ${GazeDesc}, Gestures: ${gestureDesc}. [CARS-2 RRB Score] Motor Mannerisms: ${motorDesc}, Sensory Response: ${sensoryDesc}, Routine Adherence: ${routineDesc}. [Speech Mode]: ${speechDesc}. [Wearable Telemetry]: ${vagalDesc}.`;
    } else if (activeTab === 'parent') {
      const stressors = [];
      if (parentStressNoise) stressors.push("Loud decibel appliances / household noise");
      if (parentStressLight) stressors.push("Bright flickering TV/Mobile screens");
      if (parentStressCrowd) stressors.push("Crowded family/classroom setting");
      
      const stims = [];
      if (parentBehaveFlapping) stims.push("Rhythmic hand-flapping / rocking body");
      if (parentBehaveEars) stims.push("Covering ears and humming vocal tones");
      if (parentBehaveFixation) stims.push("Wandering eyes / visual fixation on spinning targets");

      const telemetry = [];
      if (parentWearableHrSpike) telemetry.push("Elevated resting heart rate spike / drop in HRV");
      if (parentWearableSleepLoss) telemetry.push("Nighttime sleep disruption and restlessness");

      compiledPrompt = `Parent Observation Log: [Stressors]: ${stressors.length > 0 ? stressors.join(', ') : 'None'}. [Behaviors]: ${stims.length > 0 ? stims.join(', ') : 'Typical baseline behavior'}. [Telemetry Alerts]: ${telemetry.length > 0 ? telemetry.join(', ') : 'Normal HRV homeostasis'}.`;
    }

    if (compiledPrompt) {
      handleAnalyze(compiledPrompt);
    }
  };

  const handlePatientEmojiSelect = (emojiTitle: string, emojiVal: string) => {
    setPatientActiveEmoji(emojiTitle);
    const childPrompt = `Patient visual check-in: Child clicked the visual emoji ${emojiVal} ${emojiTitle}. This represents the child feeling: ${emojiTitle === 'Sensory Spike' ? 'Overwhelmed with sensory overload' : emojiTitle === 'Daydreaming' ? 'Daydreaming and mind-wandering resting state' : emojiTitle === 'Stimming' ? 'Expressing hand-flapping and motor stimming' : 'Active and calm, engaging in visual or acoustic focus'}.`;
    handleAnalyze(childPrompt);
  };

  const clearSession = () => {
    setInputText('');
    setResult(null);
    setActiveNetwork(null);
    setErrorMessage(null);
    setPatientActiveEmoji(null);
    setSelectedHotspot(null);
  };

  // Helper for network colors
  const getNetworkStyle = (net: string) => {
    switch (net) {
      case 'DMN': return { color: 'var(--color-dmn)', borderColor: 'rgba(192, 132, 252, 0.3)' };
      case 'FPN': return { color: 'var(--color-fpn)', borderColor: 'rgba(34, 211, 238, 0.3)' };
      case 'SN': return { color: 'var(--color-sn)', borderColor: 'rgba(251, 146, 60, 0.3)' };
      case 'DAN': return { color: 'var(--color-dan)', borderColor: 'rgba(96, 165, 250, 0.3)' };
      case 'VN': return { color: 'var(--color-vn)', borderColor: 'rgba(244, 114, 182, 0.3)' };
      case 'AN': return { color: 'var(--color-an)', borderColor: 'rgba(250, 204, 21, 0.3)' };
      case 'SMN': return { color: 'var(--color-smn)', borderColor: 'rgba(52, 211, 153, 0.3)' };
      default: return { color: '#fff', borderColor: 'var(--border-color)' };
    }
  };

  // Format SHAP keys into friendly names
  const getFriendlySHAPLabel = (key: string) => {
    switch (key) {
      case 'heartRateVariability': return 'HRV (Wearable)';
      case 'repetitiveMotorPose': return 'Pose Stimming';
      case 'acousticOverload': return 'Acoustic Overload';
      case 'wearableActivity': return 'Activity Agitation';
      case 'sleepDisruption': return 'Sleep Deprivation';
      default: return key;
    }
  };

  const generateObsidianMarkdown = async () => {
    if (!result || !activeNetwork) return;
    if (userRole !== 'doctor') {
      alert("Only clinicians can save clinical notes.");
      return;
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString();
    
    const frontmatter = `---
date: ${dateStr}
time: ${timeStr}
tags:
  - neurobrain
  - clinical_log
  - ${activeNetwork}
meltdownRisk: ${result.meltdownRisk}
cognitiveLoad: ${result.cognitiveLoad}
activeNetwork: ${activeNetwork}
---

# NeuroBrain Clinical Analysis
*Logged on ${dateStr} at ${timeStr}*

## Active Neural Pathway
**Network:** [[${NETWORK_METADATA[activeNetwork]?.name || activeNetwork}]]
**Regions:** ${result.regions.map(r => `[[${r}]]`).join(', ')}

## Clinical Reasoning
> ${result.reasoning}

## Telemetry (SHAP Values)
${Object.entries(result.shapValues).map(([key, val]) => {
  const label = getFriendlySHAPLabel(key);
  return `- **${label}**: ${val > 0 ? '+' : ''}${(Number(val) * 100).toFixed(1)}%`;
}).join('\n')}

## ADOS-2 Context
- **Social Affect:** ${result.adosScores?.socialAffect || 'N/A'}
- **Restricted/Repetitive Behaviors:** ${result.adosScores?.restrictedRepetitive || 'N/A'}
- **Comparison Score:** ${result.adosScores?.comparisonScore || 'N/A'}

## Guidance
${activeTab === 'clinician' ? `**Clinician Notes:**\n${result.clinicianNotes}` : `**Parent Coping Strategy:**\n${result.parentGuidance}`}

## System Confidence
- **Cognitive Intensity:** ${(result.cognitiveLoad * 100).toFixed(0)}%
- **Agent Confidence:** ${(result.confidence * 100).toFixed(0)}%
`;

    if (selectedPatientId) {
      // Save directly to Supabase Brain2
      const title = `NeuroBrain_Analysis_${dateStr}`;
      const { error } = await supabase.from('notes').insert({
        patient_id: selectedPatientId,
        title: title,
        content: frontmatter
      });
      if (!error) {
        alert('Saved to Clinician Vault successfully!');
      } else {
        alert('Error saving to DB: ' + error.message);
      }
    } else {
      alert("Please select a patient to save this clinical note.");
    }
  };

  const generateObsidianCanvas = () => {
    if (!result || !activeNetwork) return;

    // Build Obsidian Canvas JSON structure
    const canvas = {
      nodes: [
        {
          id: "node_network",
          type: "text",
          text: `## Active Network\n[[${NETWORK_METADATA[activeNetwork]?.name || activeNetwork}]]\nRisk: **${result.meltdownRisk.toUpperCase()}**`,
          x: 0,
          y: -200,
          width: 300,
          height: 150,
          color: "3" // Purpleish
        },
        {
          id: "node_reasoning",
          type: "text",
          text: `## AI Reasoning\n${result.reasoning}`,
          x: -400,
          y: 50,
          width: 300,
          height: 250,
          color: "1" // Reddish
        },
        {
          id: "node_coping",
          type: "text",
          text: `## Coping Strategy\n${activeTab === 'clinician' ? result.clinicianNotes : result.parentGuidance}`,
          x: 400,
          y: 50,
          width: 300,
          height: 200,
          color: "4" // Greenish
        }
      ],
      edges: [
        {
          id: "edge_1",
          fromNode: "node_reasoning",
          fromSide: "right",
          toNode: "node_network",
          toSide: "left",
          label: "triggers"
        },
        {
          id: "edge_2",
          fromNode: "node_network",
          fromSide: "right",
          toNode: "node_coping",
          toSide: "left",
          label: "requires"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(canvas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeuroBrain_Map_${new Date().toISOString().split('T')[0]}.canvas`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      {/* Header Panel */}
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.logoContainer}>
            <Brain className={styles.logoIcon} size={28} />
          </div>
          <div>
            <h1 className={styles.title}>Xha-Synapto AI</h1>
            <p className={styles.subtitle}>Neurodiversity-Affirming Exploration & Care Co-Pilot</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          {userRole === 'doctor' && (
             <button onClick={() => setShowBrainPopup(true)} className={styles.obsidianBtn} style={{ marginRight: '15px' }}>
                <Brain size={16} />
                Second Brain
             </button>
          )}
          <div className={styles.statusIndicator}>
            <div className={isApiKeyMissing ? styles.statusDotWarning : styles.statusDot} />
            <span>{isApiKeyMissing ? "API KEY MISSING" : "CLINICAL ENGINE ACTIVE"}</span>
          </div>
        </div>
      </header>

      {/* Core Grid */}
      <main className={styles.dashboardGrid}>
        
        {/* LEFT PANEL: Control Center */}
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>
            <Brain size={18} />
            Observation Center
          </h2>

          {/* Dual Portal Switcher */}
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === 'clinician' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('clinician')}
            >
              <Stethoscope size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Clinician View
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'parent' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('parent')}
            >
              <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Parent View
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'patient' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('patient')}
            >
              🧩 Child View
            </button>
          </div>

          {/* Mode Switch Toggle: Free-Text vs Questionnaire */}
          <div className={styles.toggleContainer} style={{
            '--primary-border': activeNetwork ? getNetworkStyle(activeNetwork).color : 'var(--border-color-glow)'
          } as React.CSSProperties}>
            <button
              className={`${styles.modeSelectButton} ${inputMode === 'questionnaire' ? styles.modeSelectButtonActive : ''}`}
              onClick={() => setInputMode('questionnaire')}
            >
              <Sliders size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Interactive Form
            </button>
            <button
              className={`${styles.modeSelectButton} ${inputMode === 'text' ? styles.modeSelectButtonActive : ''}`}
              onClick={() => setInputMode('text')}
            >
              <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Free-Text Log
            </button>
          </div>

          <HandTracker 
            isActive={isTrackerActive} 
            onToggle={() => setIsTrackerActive(!isTrackerActive)} 
            onStimmingDetected={handleStimmingDetected} 
            onHandMove={handleHandMove}
          />

          <div className={styles.scrollableContent}>
            
            {/* QUESTIONNAIRE MODE */}
            {inputMode === 'questionnaire' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* CLINICIAN INTERACTIVE QUESTIONS */}
                {activeTab === 'clinician' && (
                  <>
                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', margin: '0 0 10px 0' }}>Target 1: Behavioral & Motor (CV Tracking)</h3>
                    
                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Joint Attention Focus</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianSAJoint}
                          onChange={(e) => setClinicianSAJoint(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianSAJoint}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianSAJoint === 0 ? 'Typical joint attention focus' : clinicianSAJoint === 1 ? 'Subtle eye-contact shift delays' : 'Severe joint attention impairment'}
                      </p>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Gaze & Face Integration</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianSAGaze}
                          onChange={(e) => setClinicianSAGaze(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianSAGaze}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianSAGaze === 0 ? 'Typical facial feedback' : clinicianSAGaze === 1 ? 'Reduced gaze frequency' : 'Severe visual avoidance'}
                      </p>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Gesture Coordination</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianSAGesture}
                          onChange={(e) => setClinicianSAGesture(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianSAGesture}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianSAGesture === 0 ? 'Spontaneous gestures active' : clinicianSAGesture === 1 ? 'Reduced pointer actions' : 'No gestures observed'}
                      </p>
                    </div>

                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-sn)', margin: '15px 0 10px 0' }}>Target 2: Physiological & Sensory (Wearables)</h3>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Motor Mannerisms</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianRRBMotor}
                          onChange={(e) => setClinicianRRBMotor(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianRRBMotor}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianRRBMotor === 0 ? 'No motor mannerisms' : clinicianRRBMotor === 1 ? 'Mild hand-flapping / fidget' : 'Severe rhythmic rocking / pacing'}
                      </p>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Sensory Overload Response</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianRRBSensory}
                          onChange={(e) => setClinicianRRBSensory(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianRRBSensory}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianRRBSensory === 0 ? 'Typical sensory response' : clinicianRRBSensory === 1 ? 'Sensory seeking interests' : 'Severe sensory overload alarm'}
                      </p>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Insistence on Sameness</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          value={clinicianRRBRoutine}
                          onChange={(e) => setClinicianRRBRoutine(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>L{clinicianRRBRoutine}</span>
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
                        {clinicianRRBRoutine === 0 ? 'Accepts transitions easily' : clinicianRRBRoutine === 1 ? 'Mild insistence on patterns' : 'Severe distress upon routine change'}
                      </p>
                    </div>

                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff', margin: '15px 0 10px 0' }}>Target 3: Routine & Regulation</h3>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Vocal Speech Patterns</label>
                      <select 
                        className={styles.selectField}
                        value={clinicianSpeech}
                        onChange={(e) => setClinicianSpeech(e.target.value)}
                      >
                        <option value="typical">Typical / Fluent vocalizations</option>
                        <option value="stereotypic">Vocal Stereotypies / Echolalia</option>
                        <option value="non-verbal">Minimally verbal / Visual communications</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Wearable Vagal Index</label>
                      <select 
                        className={styles.selectField}
                        value={clinicianVagalIndex}
                        onChange={(e) => setClinicianVagalIndex(e.target.value)}
                      >
                        <option value="normal">Typical Vagal Tone (Baseline)</option>
                        <option value="distress">Suppressed Vagal Tone (HRV Spike)</option>
                        <option value="sleep-deprived-distress">Sleep Loss Suppressed Vagal Index</option>
                      </select>
                    </div>

                    <button 
                      className={styles.analyzeBtn}
                      onClick={submitQuestionnaire}
                      disabled={isLoading}
                    >
                      {isLoading ? <RefreshCw size={14} className={styles.spinner} /> : 'Submit Clinician Diagnostic Check'}
                    </button>
                  </>
                )}

                {/* PARENT INTERACTIVE QUESTIONS */}
                {activeTab === 'parent' && (
                  <>
                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-sn)', margin: '0 0 10px 0' }}>Target 2: Physiological & Sensory (Environment)</h3>
                    <div className={styles.checkboxLabelGroup}>
                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentStressNoise} 
                          onChange={(e) => setParentStressNoise(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Loud Vacuum / Appliances Noise</span>
                      </label>

                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentStressLight} 
                          onChange={(e) => setParentStressLight(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Bright Flickering Screen Exposure</span>
                      </label>

                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentStressCrowd} 
                          onChange={(e) => setParentStressCrowd(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Crowded Social Setting / Transitions</span>
                      </label>
                    </div>

                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', margin: '15px 0 10px 0' }}>Target 1: Behavioral & Motor (Visual)</h3>
                    <div className={styles.checkboxLabelGroup}>
                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentBehaveFlapping} 
                          onChange={(e) => setParentBehaveFlapping(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Rhythmic Hand-Flapping / Rocking Body</span>
                      </label>

                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentBehaveEars} 
                          onChange={(e) => setParentBehaveEars(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Covering Ears / Humming Vocal Sounds</span>
                      </label>

                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentBehaveFixation} 
                          onChange={(e) => setParentBehaveFixation(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Wandering Eye Fixation / Gaze Avoidance</span>
                      </label>
                    </div>

                    <h3 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff', margin: '15px 0 10px 0' }}>Target 3: Routine & Regulation (Wearables)</h3>
                    <div className={styles.checkboxLabelGroup}>
                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentWearableHrSpike} 
                          onChange={(e) => setParentWearableHrSpike(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Resting Heart Rate Spike / Low HRV Alert</span>
                      </label>

                      <label className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={parentWearableSleepLoss} 
                          onChange={(e) => setParentWearableSleepLoss(e.target.checked)}
                          className={styles.checkboxInput}
                        />
                        <span>Previous Night Sleep Loss / Restlessness</span>
                      </label>
                    </div>

                    <button 
                      className={styles.analyzeBtn}
                      onClick={submitQuestionnaire}
                      disabled={isLoading}
                      style={{ marginTop: '15px' }}
                    >
                      {isLoading ? <RefreshCw size={14} className={styles.spinner} /> : 'Submit Daily Observational Log'}
                    </button>
                  </>
                )}

                {/* PATIENT (CHILD-FRIENDLY) INTERACTIVE QUESTIONS */}
                {activeTab === 'patient' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ padding: '12px', background: 'rgba(0, 242, 254, 0.05)', border: '1px dashed var(--primary)', borderRadius: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '1.4rem' }}>🧑‍🚀</span>
                      <h4 style={{ margin: '4px 0 2px 0', fontSize: '0.85rem', color: 'var(--primary)' }}>Brain Command Control Room</h4>
                      <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)' }}>Adjust the dials and try out the coping tools to see your brain react!</p>
                    </div>

                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444', margin: '0 0 5px 0' }}>Sensory Triggers</h3>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Vacuum & Alarm Noise 🔊</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={simNoiseLevel}
                          onChange={(e) => setSimNoiseLevel(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>{simNoiseLevel}dB</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Mobile Screen Brightness 📺</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={simScreenLight}
                          onChange={(e) => setSimScreenLight(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>{simScreenLight}%</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>Body Agitation / Rocking 🏃</label>
                      <div className={styles.sliderWrapper}>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={simBodyAgitation}
                          onChange={(e) => setSimBodyAgitation(Number(e.target.value))}
                          className={styles.sliderField} 
                        />
                        <span className={styles.sliderValueLabel}>{simBodyAgitation}%</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', margin: '15px 0 5px 0' }}>Coping Tools</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        className={`${styles.copingToolBtn} ${simHeadphones ? styles.copingToolBtnActive : ''}`}
                        onClick={() => setSimHeadphones(!simHeadphones)}
                        style={{ '--tool-color': '#22d3ee' } as React.CSSProperties}
                      >
                        <span style={{ fontSize: '1.1rem' }}>🎧</span>
                        <span>Put on Ear Defenders ({simHeadphones ? 'ON' : 'OFF'})</span>
                      </button>

                      <button
                        className={`${styles.copingToolBtn} ${simDeepPressure ? styles.copingToolBtnActive : ''}`}
                        onClick={() => setSimDeepPressure(!simDeepPressure)}
                        style={{ '--tool-color': '#34d399' } as React.CSSProperties}
                      >
                        <span style={{ fontSize: '1.1rem' }}>🤗</span>
                        <span>Apply Weighted Blanket ({simDeepPressure ? 'ON' : 'OFF'})</span>
                      </button>

                      <button
                        className={`${styles.copingToolBtn} ${simCalmBreathing ? styles.copingToolBtnActive : ''}`}
                        onClick={() => setSimCalmBreathing(!simCalmBreathing)}
                        style={{ '--tool-color': '#c084fc' } as React.CSSProperties}
                      >
                        <span style={{ fontSize: '1.1rem' }}>💨</span>
                        <span>Start Calm Breathing ({simCalmBreathing ? 'ON' : 'OFF'})</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setSimNoiseLevel(20);
                        setSimScreenLight(20);
                        setSimBodyAgitation(20);
                        setSimHeadphones(false);
                        setSimDeepPressure(false);
                        setSimCalmBreathing(false);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '8px',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        marginTop: '10px'
                      }}
                    >
                      Reset Sim Dials 🧑‍🚀
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* FREE-TEXT MODE */}
            {inputMode === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Describe Telemetry or Behavior</label>
                  <textarea
                    className={styles.textArea}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter behavioral observations, mobile video pose telemetry, or biosensor reports (e.g. 'Wearable heart rate spike observed with poor HRV and motor stimming rocking')..."
                    disabled={isLoading}
                  />
                </div>

                <button 
                  className={styles.analyzeBtn}
                  onClick={() => handleAnalyze(inputText)}
                  disabled={isLoading || !inputText.trim()}
                  style={{
                    '--primary-border': activeNetwork ? getNetworkStyle(activeNetwork).color : 'var(--border-color-glow)'
                  } as React.CSSProperties}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={16} className={styles.spinner} />
                      Running Inference Agents...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Analyze Intake
                    </>
                  )}
                </button>

                {/* Presets Grid */}
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Intake Presets (Sensors & Video)</label>
                  <div className={styles.presetsGrid}>
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        className={styles.presetBtn}
                        onClick={() => handlePresetClick(preset.text)}
                        disabled={isLoading}
                      >
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '82%'
                        }}>{preset.text}</span>
                        <span className={styles.presetTag} style={{
                          color: getNetworkStyle(preset.tag).color,
                          border: `1px solid ${getNetworkStyle(preset.tag).color}33`
                        }}>{preset.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error messaging */}
            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#f87171',
                lineHeight: 1.4,
                marginTop: '15px'
              }}>
                <strong>Error: </strong> {errorMessage}
                {isApiKeyMissing && (
                  <div style={{ marginTop: '6px', opacity: 0.85 }}>
                    Please add your <code>GEMINI_API_KEY</code> environment variable in your <code>.env.local</code> file in the project root folder.
                  </div>
                )}
              </div>
            )}

            {/* History logs */}
            {history.length > 0 && (
              <div className={styles.inputGroup} style={{ marginTop: '20px' }}>
                <label className={styles.inputLabel}>
                  <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Session Intake Logs
                </label>
                <div className={styles.historyList}>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={styles.historyItem}
                      onClick={() => handleHistoryItemClick(item)}
                      style={{
                        borderLeft: `3px solid ${getNetworkStyle(item.activeNetwork).color}`
                      }}
                    >
                      <div className={styles.historyItemHeader}>
                        <span className={styles.historyItemNetwork} style={{ color: getNetworkStyle(item.activeNetwork).color }}>
                          {item.activeNetwork}
                        </span>
                        <span className={styles.historyItemTime}>{item.timestamp}</span>
                      </div>
                      <p className={styles.historyItemText}>{item.input}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result && (
            <button 
              onClick={clearSession} 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'center',
                paddingTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={12} />
              Reset Simulation State
            </button>
          )}
        </section>

        {/* CENTER PANEL: Interactive 3D Canvas */}
        <section className={styles.centerPanel}>
          {/* Active Network Label Overlay */}
          {activeNetwork && (
            <div className={styles.canvasTooltip}>
              <Sparkles size={14} style={{ color: getNetworkStyle(activeNetwork).color }} />
              <span>Active Station: <strong style={{ color: getNetworkStyle(activeNetwork).color }}>{NETWORK_METADATA[activeNetwork]?.name || activeNetwork}</strong></span>
            </div>
          )}

          {/* R3F Canvas */}
          <BrainCanvas 
            activeNetwork={activeNetwork}
            hoveredNetwork={hoveredNetwork}
            autoRotate={autoRotate}
            compareMode={compareMode}
            headphonesOn={simHeadphones}
            deepPressureOn={simDeepPressure}
            calmBreathingOn={simCalmBreathing}
            onSelectHotspot={setSelectedHotspot}
            simNoiseLevel={simNoiseLevel}
            simScreenLight={simScreenLight}
            simBodyAgitation={simBodyAgitation}
            selectedHotspot={selectedHotspot}
            handRotationRef={handRotationRef}
          />

          {/* Calming Respiration Text Guide Overlay */}
          {simCalmBreathing && (
            <div className={styles.breathingTextCard}>
              <span className={styles.breathingIcon}>
                {breatheCycle === 'in' ? '💨' : '🌀'}
              </span>
              <span className={styles.breathingText}>
                {breatheCycle === 'in' ? 'Breathe In... (Inhale)' : 'Breathe Out... (Exhale)'}
              </span>
            </div>
          )}

          {/* Floating Hotspot Lobe Card */}
          {selectedHotspot && LOBE_DETAILS[selectedHotspot] && (
            <div className={styles.hotspotCard}>
              <button 
                className={styles.hotspotCloseBtn} 
                onClick={() => setSelectedHotspot(null)}
              >
                ×
              </button>
              <div className={styles.hotspotHeader}>
                <span className={styles.hotspotEmoji}>
                  {LOBE_DETAILS[selectedHotspot].emoji}
                </span>
                <div>
                  <h3 className={styles.hotspotTitle}>
                    {LOBE_DETAILS[selectedHotspot].name}
                  </h3>
                  <p className={styles.hotspotSubtitle}>Brain Exploration Station</p>
                </div>
              </div>
              <p className={styles.hotspotDesc}>
                {LOBE_DETAILS[selectedHotspot].desc}
              </p>
              <div className={styles.hotspotFact}>
                <strong>Fun Fact:</strong> {LOBE_DETAILS[selectedHotspot].fact}
              </div>
            </div>
          )}

          {/* 3D Scene Controls Overlay */}
          <div className={styles.overlayControls} style={{ gap: '8px' }}>
            <button 
              className={`${styles.controlIconBtn} ${compareMode ? styles.controlIconBtnActive : ''}`}
              onClick={() => setCompareMode(!compareMode)}
              title="Toggle Side-by-Side Comparison"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0 10px' }}
            >
              <Activity size={14} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Compare Mode</span>
            </button>
            <button 
              className={`${styles.controlIconBtn} ${autoRotate ? styles.controlIconBtnActive : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto-Rotation"
            >
              {autoRotate ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          {/* Network Color Legend */}
          <div className={styles.canvasOverlay}>
            <span className={styles.overlayTitle}>Brain Exploration Stations</span>
            <div className={styles.legendList}>
              {Object.entries(NETWORK_METADATA).map(([key, data]) => (
                <div 
                  key={key} 
                  className={styles.legendItem}
                  onMouseEnter={() => setHoveredNetwork(key)}
                  onMouseLeave={() => setHoveredNetwork(null)}
                  style={{
                    cursor: 'pointer',
                    opacity: activeNetwork ? (activeNetwork === key ? 1.0 : 0.4) : (hoveredNetwork === key ? 1.0 : 0.85),
                    fontWeight: activeNetwork === key || hoveredNetwork === key ? 600 : 400,
                    transition: 'opacity 0.2s, font-weight 0.2s'
                  }}
                >
                  <div 
                    className={styles.legendColor} 
                    style={{ background: getNetworkStyle(key).color }}
                  />
                  <span>{key} — {data.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: Cognitive Insights */}
        <section className={styles.panel}>
          
          <h2 className={styles.sectionTitle}>
            {activeTab === 'clinician' && <><Stethoscope size={18} /> Clinical Insights Hub</>}
            {activeTab === 'parent' && <><User size={18} /> Parent Co-Pilot Guide</>}
            {activeTab === 'patient' && <>🧩 Space Co-Pilot Space</>}
          </h2>

          <div className={styles.scrollableContent}>
            {result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* ACTIVE NETWORK SUMMARY CARD */}
                <div className={styles.insightCard} style={{
                  borderColor: getNetworkStyle(result.activeNetwork).color + '44'
                }}>
                  <div className={styles.insightHeader}>
                    <div>
                      <span className={styles.networkNameBadge} style={{ color: getNetworkStyle(result.activeNetwork).color }}>
                        {NETWORK_METADATA[result.activeNetwork]?.name || 'Unknown Station'}
                      </span>
                      <p className={styles.networkFullName}>
                        Neural Network: {result.activeNetwork}
                      </p>
                    </div>
                    <span className={styles.badge} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>ACTIVE</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                    {NETWORK_METADATA[result.activeNetwork]?.desc}
                  </p>
                </div>

                {/* CLINICIAN VIEW */}
                {activeTab === 'clinician' && (
                  <>
                    {/* Explainable AI SHAP Chart */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} />
                        SHAP Explainability (XAI)
                      </span>
                      <div className={styles.shapContainer}>
                        <div className={styles.shapZeroLine} />
                        {Object.entries(result.shapValues).map(([key, val]) => {
                          const percent = Math.abs(val) * 50; // Map max 1.0 to 50% left or right
                          const isPos = val >= 0;
                          return (
                            <div key={key} className={styles.shapItem}>
                              <span className={styles.shapLabel} title={getFriendlySHAPLabel(key)}>
                                {getFriendlySHAPLabel(key)}
                              </span>
                              <div className={styles.shapTrack}>
                                <div 
                                  className={`${styles.shapBar} ${isPos ? styles.shapBarPositive : styles.shapBarNegative}`}
                                  style={{
                                    width: `${percent}%`,
                                    left: isPos ? '50%' : 'auto',
                                    right: isPos ? 'auto' : '50%'
                                  }}
                                />
                              </div>
                              <span className={styles.shapValueText} style={{ color: isPos ? 'var(--primary)' : '#ef4444' }}>
                                {isPos ? `+${val.toFixed(2)}` : val.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.35)', marginTop: '4px' }}>
                        Values indicate feature impact weights on neural mapping.
                      </p>
                    </div>

                    {/* Neurobiological Hub */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} style={{ color: 'var(--primary)' }} />
                        Neurobiological Hub
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
                        
                        {/* Brodmann Areas */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Brodmann Areas (BA)</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 600 }}>
                            {result.brodmannAreas && result.brodmannAreas.length > 0 
                              ? result.brodmannAreas.map(ba => `BA ${ba}`).join(', ') 
                              : 'None mapped'}
                          </span>
                        </div>

                        {/* Neurotransmitter Dynamics */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Neurotransmitters</span>
                          <span style={{ color: '#fff', fontWeight: 600, textAlign: 'right' }}>
                            {result.neurotransmitters && result.neurotransmitters.length > 0 
                              ? result.neurotransmitters.join(', ') 
                              : 'Pending mapping'}
                          </span>
                        </div>

                        {/* ADOS-2 Social Affect */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>ADOS-2 Social Affect</span>
                          <span style={{ color: 'var(--color-dan)', fontWeight: 600, textAlign: 'right' }}>
                            {result.adosScores?.socialAffect || 'N/A'}
                          </span>
                        </div>

                        {/* ADOS-2 Restricted/Repetitive */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>ADOS-2 Repetitive Behavior</span>
                          <span style={{ color: 'var(--color-sn)', fontWeight: 600, textAlign: 'right' }}>
                            {result.adosScores?.restrictedRepetitive || 'N/A'}
                          </span>
                        </div>

                        {/* ADOS-2 Comparison Score */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>ADOS-2 Comparison Score</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700, textAlign: 'right' }}>
                            {result.adosScores?.comparisonScore || 'N/A'}
                          </span>
                        </div>

                      </div>
                    </div>

                    {/* Digital ADOS-2 & Clinical Hypothesis */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel}>ADOS-2 / CARS-2 Correlation</span>
                      <div className={styles.clinicalMetrics}>
                        <p style={{ fontSize: '0.78rem', lineHeight: 1.4, color: 'rgba(255,255,255,0.85)' }}>
                          {result.clinicianNotes}
                        </p>
                      </div>
                    </div>

                    {/* Literatue Citation */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={12} /> Supporting Evidence
                      </span>
                      <p className={styles.citationText}>
                        {result.citation}
                      </p>
                    </div>
                  </>
                )}

                {/* PARENT VIEW */}
                {activeTab === 'parent' && (
                  <>
                    {/* Sensory Comfort Meter */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} style={{ color: 'var(--primary)' }} />
                        Sensory Comfort Meter
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Current State:</span>
                          {result.meltdownRisk === 'high' ? (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#f87171',
                              background: 'rgba(239,68,68,0.1)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239,68,68,0.2)'
                            }}>
                              Overload Alert / Needs Quiet Space 🔴
                            </span>
                          ) : result.meltdownRisk === 'moderate' ? (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#fb923c',
                              background: 'rgba(251,146,96,0.1)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(251,146,96,0.2)'
                            }}>
                              Sensory Battery Draining / Active Alert 🟡
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#34d399',
                              background: 'rgba(52,211,153,0.1)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(52,211,153,0.2)'
                            }}>
                              Cozy & Calm 🟢
                            </span>
                          )}
                        </div>

                        {/* Energy Safety Window (Lead Time) */}
                        {result.meltdownRisk !== 'low' && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: 'rgba(251,146,60,0.04)',
                            border: '1px solid rgba(251,146,60,0.15)',
                            borderRadius: '8px',
                            padding: '10px'
                          }}>
                            <Clock size={16} style={{ color: '#fb923c', flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
                                Energy Safety Window: {result.leadTime} minutes
                              </span>
                              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)' }}>
                                Pacing or coping tools can help recharge the sensory battery.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Empathetic Parent Co-Pilot Advice */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                        Parent Co-Pilot Guidance
                      </span>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#fff' }}>
                        {result.parentGuidance}
                      </p>
                    </div>

                    {/* Educational Analogy Card */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={12} style={{ color: 'var(--color-dmn)' }} />
                        Educational Network Digest
                      </span>
                      <p style={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'rgba(255,255,255,0.85)' }}>
                        {NETWORK_ANALOGIES[result.activeNetwork]?.parent || 'No network details mapped yet.'}
                      </p>
                    </div>

                    {/* Therapy Progress Digest */}
                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel}>Therapy Progress Tracker</span>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                        This activity directly engages the <strong>{NETWORK_METADATA[result.activeNetwork]?.name}</strong> hubs: <code>{result.regions.join(', ')}</code>, helping reinforce neuroplastic pathways.
                      </p>
                    </div>
                  </>
                )}

                {/* PATIENT (CHILD) VIEW */}
                {activeTab === 'patient' && (
                  <>
                    {/* Space Co-Pilot Character bubble */}
                    <div className={styles.copilotSpeechBubble}>
                      <div className={styles.copilotAvatar}>🧑‍🚀</div>
                      <div className={styles.copilotText}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--primary)' }}>Space Co-Pilot Leo</h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.4, color: '#fff' }}>
                          {result?.activeNetwork === 'SN' 
                            ? "🚨 Alert! The Sensory Alert Hub ⚡ is flashing red! Things feel a bit too loud or too bright. Put on your Ear Defenders 🎧, apply the Weighted Blanket 🤗, or start Calm Breathing 💨 to feel cozy and calm!" 
                            : result?.activeNetwork === 'AN' 
                            ? "🔊 Whoa! Your Sound Receiver 🎵 is tuning into loud sounds. Click Ear Defenders 🎧 to make it quiet and peaceful!" 
                            : result?.activeNetwork === 'VN' 
                            ? "📺 Light spike! Your Movie Screen 🎨 is glowing bright. Try turning down the Screen Brightness or taking a screen break to rest your eyes!" 
                            : result?.activeNetwork === 'SMN' 
                            ? "🏃 Your Movement Engine is active! Rocking, stretching, or flapping helps you express energy and keep your body feeling safe and comfortable." 
                            : result?.activeNetwork === 'FPN' 
                            ? "🧩 Captain Focus is at the helm! You are doing an awesome job sorting puzzles and focusing on your goals." 
                            : "💭 You are resting at the Dream Station! A peaceful space to daydream, wander, and relax. Great job taking a break!"}
                        </p>
                      </div>
                    </div>

                    {/* Child Analogy Card */}
                    <div className={styles.insightCard} style={{ background: 'rgba(192, 132, 252, 0.04)', borderColor: 'rgba(192, 132, 252, 0.2)' }}>
                      <span className={styles.inputLabel} style={{ color: '#c084fc' }}>What does this mode mean?</span>
                      <p style={{ fontSize: '0.78rem', lineHeight: 1.45, color: '#fff', marginTop: '4px' }}>
                        {NETWORK_ANALOGIES[result?.activeNetwork || 'DMN']?.child || 'Your brain is doing a great job!'}
                      </p>
                    </div>

                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel}>Action Centers Engaged</span>
                      <div className={styles.regionsList}>
                        {result.regions.map((region, idx) => (
                          <span key={idx} className={styles.regionTag} style={{ background: 'rgba(0, 242, 254, 0.08)', borderColor: 'var(--primary-border)' }}>
                            {region}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.insightCard}>
                      <span className={styles.inputLabel}>Sensory Wellness Tip</span>
                      <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                        {result.activeNetwork === 'SN' 
                          ? 'Taking deep breaths like a balloon deflating helps bring calm vibes back!' 
                          : result.activeNetwork === 'FPN' 
                          ? 'Great job focusing! Remember to take a quick stretch break in a few minutes.' 
                          : 'You are doing great! Enjoy exploring your sensory environment.'}
                      </p>
                    </div>
                  </>
                )}

                {/* Diagnostics confidence metrics */}
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Cognitive Intensity</span>
                    <span className={styles.metricValue} style={{ color: 'var(--primary)' }}>
                      {(result.cognitiveLoad * 100).toFixed(0)}%
                    </span>
                    <div className={styles.metricBarContainer}>
                      <div 
                        className={styles.metricBarFill} 
                        style={{ width: `${result.cognitiveLoad * 100}%`, background: 'var(--primary)' }}
                      />
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Agent Confidence</span>
                    <span className={styles.metricValue} style={{ color: getNetworkStyle(result.activeNetwork).color }}>
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                    <div className={styles.metricBarContainer}>
                      <div 
                        className={styles.metricBarFill} 
                        style={{ 
                          width: `${result.confidence * 100}%`, 
                          background: getNetworkStyle(result.activeNetwork).color 
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className={styles.emptyState}>
                <Brain size={48} className={styles.emptyStateIcon} />
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>No Active Diagnostics</p>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', lineHeight: 1.4 }}>
                  Trigger an intake simulation preset on the left, or input clinical telemetry to visualize network activity mapping.
                </p>
              </div>
            )}

            {/* Obsidian Export Widget */}
            {result && (
              <div className={styles.obsidianWidget}>
                <div className={styles.obsidianHeader}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/1/10/2023_Obsidian_logo.svg" alt="Obsidian" width="16" height="16" style={{ opacity: 0.8 }} />
                  <span className={styles.obsidianTitle}>Obsidian Knowledge Graph</span>
                  <div 
                    className={styles.infoIconContainer}
                    onMouseEnter={() => setShowObsidianInfo(true)}
                    onMouseLeave={() => setShowObsidianInfo(false)}
                  >
                    <Info size={14} className={styles.obsidianInfoIcon} />
                    {showObsidianInfo && (
                      <div className={styles.obsidianTooltip}>
                        <strong>How to use:</strong><br />
                        1. <strong>Note:</strong> Opens Obsidian automatically. To see the Knowledge Graph, click the 'Graph view' icon in Obsidian.<br />
                        2. <strong>Canvas:</strong> Downloads a .canvas file. Drag & drop it into Obsidian's left sidebar to view the spatial map.
                      </div>
                    )}
                  </div>
                </div>
                <p className={styles.obsidianDesc}>
                  Export this analysis to your local Obsidian vault or securely save it to your cloud Brain2 vault.
                </p>
                {patients.length > 0 && (
                  <select 
                    value={selectedPatientId} 
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    style={{ marginBottom: '10px', width: '100%', padding: '8px', background: '#334155', color: 'white', border: 'none', borderRadius: '4px' }}
                  >
                    <option value="">Select Patient...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <div className={styles.obsidianActions}>
                  {userRole === 'doctor' ? (
                    <button onClick={generateObsidianMarkdown} className={styles.obsidianBtn}>
                      <BookOpen size={14} />
                      Save to Note
                    </button>
                  ) : (
                    <button disabled className={styles.obsidianBtnOutline} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      <ShieldAlert size={14} />
                      Doctor Access Only
                    </button>
                  )}
                  {userRole === 'doctor' && (
                    <button onClick={generateObsidianCanvas} className={styles.obsidianBtnOutline}>
                      <Download size={14} />
                      Download Canvas Map
                    </button>
                  )}
                  <button onClick={() => setShowBrainPopup(true)} className={styles.obsidianBtn} style={{ background: 'var(--primary)', color: '#000' }}>
                    <Sparkles size={14} />
                    Second Brain
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Compliance Panel */}
            <div className={styles.privacySection}>
              <span className={styles.privacyTitle}>
                <Info size={12} /> Local-First Architecture
              </span>
              <p className={styles.privacyText}>
                <strong>DPDP Act 2023 Compliant:</strong> PII is redacted client-side. Tabular telemetry runs locally via Ollama edge inference, minimizing network exposures.
              </p>
            </div>
          </div>

          {/* Clinical medical disclaimer */}
          <div className={styles.disclaimerBanner}>
            <ShieldAlert size={16} className={styles.disclaimerIcon} />
            <p className={styles.disclaimerText}>
              <strong>Institutional Disclaimer:</strong> Xha-Synapto AI is an investigational clinical decision support system. Automated network mappings and meltdown warnings are clinical hypotheses and <strong>require verification by a licensed neuropsychologist.</strong>
            </p>
          </div>
        </section>
      </main>
      {showBrainPopup && <BrainPopup session={session} onClose={() => setShowBrainPopup(false)} />}
    </div>
  );
}
