import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

function cleanInput(text: string): string {
  let cleaned = text;
  // Remove email-like strings
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  // Remove phone-like numbers
  cleaned = cleaned.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]');
  // Remove credit card numbers
  cleaned = cleaned.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input text is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'API key missing. Please configure GEMINI_API_KEY in your .env.local file.' 
      }, { status: 500 });
    }

    const cleanedText = cleanInput(input);
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are Xha-Synapto AI, a medical-grade clinical decision support agent for Autism Spectrum Disorder (ASD) diagnostics, multi-modal wearable telemetry, and pose analysis.

Analyze the user's input observation, sensor reading, or behavior log. Map it to:
1. One primary active functional brain network:
   - DMN (Default Mode Network): self-referential thought, introspection, resting baseline.
   - FPN (Frontoparietal Control Network): task planning, sorting games, executive focus.
   - SN (Salience Network): sensory overload, meltdown triggers, autonomic stress/threat response.
   - DAN (Dorsal Attention Network): top-down visual search, voluntary focus.
   - VN (Visual Network): screen time, visual stimming.
   - AN (Auditory Network): decibel spikes, vocal stereotypic sounds.
   - SMN (Sensorimotor Network): repetitive physical stimming (hand-flapping, rocking), tactile inputs.

2. A Meltdown Warning Alert:
   - Set the risk level (low, moderate, high).
   - If risk is moderate/high, estimate the meltdown lead-time (typically between 15 and 45 minutes, averaging a 42-minute lead time based on wearable HRV/activity spikes).

3. Explainable AI (XAI) SHAP Values:
   - Generate five float values between -1.0 and 1.0 indicating feature importance contribution:
     - heartRateVariability (negative indicates higher stress/meltdown risk).
     - repetitiveMotorPose (positive indicates active motor stimming detected).
     - acousticOverload (positive indicates loud decibel environment contribution).
     - wearableActivity (positive indicates high physical agitation/rocking).
     - sleepDisruption (positive indicates previous night sleep deprivation contributing to stress).

4. Detailed Neurobiological Markers:
   - Identify the exact Brodmann Areas (BA) involved in the mapped network:
     - DMN: BA 10 (medial PFC), BA 31/23 (PCC), BA 39 (angular gyrus).
     - FPN: BA 9/46 (dlPFC), BA 7/40 (parietal).
     - SN: BA 47 (insula), BA 24 (dACC).
     - DAN: BA 8 (frontal eye fields), BA 7 (intraparietal sulcus).
     - VN: BA 17 (primary visual), BA 18/19 (secondary visual).
     - AN: BA 41/42 (primary auditory / Heschl's gyrus).
     - SMN: BA 4 (primary motor), BA 1/2/3 (somatosensory), BA 6 (premotor).
   - Specify 2-3 hypothesized Neurotransmitter dynamics (e.g. "GABAergic signaling down-regulation", "Glutamatergic excitation spike", "Dopaminergic focus modulation", "Serotonergic sensory gating delta").

5. Digital ADOS-2 & CARS-2 Impact Metrics:
   - socialAffect: Specific rating impact on the Social Affect domain (e.g. "+1 rating: diminished social engagement").
   - restrictedRepetitive: Rating impact on the Restricted/Repetitive Behaviors domain (e.g. "+2 rating: active motor stereotypy").
   - comparisonScore: Summary of clinical diagnostic significance (e.g. "Severity scale shift from Moderate to High").

6. Practical Parent Guidance: Actionable, empathetic, and culturally sensitive de-escalation tips (e.g. noise reduction, weighted vest, sensory escape, deep pressure).

7. Clinician Notes: Clinical-grade notes detailing diagnostic hypothesis, citing supporting literature.

Observation to analyze:
"${cleanedText}"`;

    const requestConfig = {
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            activeNetwork: { 
              type: 'string', 
              enum: ['FPN', 'DMN', 'SN', 'DAN', 'VN', 'AN', 'SMN'],
              description: 'The short name code for the activated functional brain network'
            },
            reasoning: { 
              type: 'string',
              description: 'A brief, clinical explanation of how the behavior maps to the active network.' 
            },
            citation: {
              type: 'string',
              description: 'A scientific journal citation supporting this network role or diagnostic observation.'
            },
            regions: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'List of specific brain regions involved in this activity (max 3).'
            },
            brodmannAreas: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of specific Brodmann Area (BA) numbers involved in this network (max 3).'
            },
            neurotransmitters: {
              type: 'array',
              items: { type: 'string' },
              description: 'Hypothesized neurotransmitter pathway dynamics (e.g. ["GABA down-regulation", "Glutamate spike"]) (max 2).'
            },
            adosScores: {
              type: 'object',
              properties: {
                socialAffect: { type: 'string', description: 'ADOS-2 Social Affect domain rating change / assessment' },
                restrictedRepetitive: { type: 'string', description: 'ADOS-2 Restricted/Repetitive Behavior rating change / assessment' },
                comparisonScore: { type: 'string', description: 'ADOS-2 Overall Comparison Score assessment' }
              },
              required: ['socialAffect', 'restrictedRepetitive', 'comparisonScore'],
              description: 'Digital equivalents to ADOS-2 scoring variations.'
            },
            cognitiveLoad: { 
              type: 'number',
              description: 'An estimated value representing intensity of mental effort, between 0.0 and 1.0.'
            },
            confidence: { 
              type: 'number',
              description: 'Confidence in this AI classification, between 0.0 and 1.0.'
            },
            meltdownRisk: {
              type: 'string',
              enum: ['low', 'moderate', 'high'],
              description: 'Sensory or emotional meltdown risk level.'
            },
            leadTime: {
              type: 'number',
              description: 'Predicted minutes (15-45) before meltdown onset (0 if low risk).'
            },
            shapValues: {
              type: 'object',
              properties: {
                heartRateVariability: { type: 'number', description: 'SHAP value for HRV (typically negative for stress/risk)' },
                repetitiveMotorPose: { type: 'number', description: 'SHAP value for hand flapping / stimming pose' },
                acousticOverload: { type: 'number', description: 'SHAP value for environmental audio spike' },
                wearableActivity: { type: 'number', description: 'SHAP value for wearable physical agitation' },
                sleepDisruption: { type: 'number', description: 'SHAP value for sleep deprivation metrics' }
              },
              required: ['heartRateVariability', 'repetitiveMotorPose', 'acousticOverload', 'wearableActivity', 'sleepDisruption'],
              description: 'SHAP feature importance values between -1.0 and 1.0 indicating how each metric contributed to this decision.'
            },
            parentGuidance: {
              type: 'string',
              description: 'Actionable, empathetic support and sensory de-escalation advice for parents.'
            },
            clinicianNotes: {
              type: 'string',
              description: 'Clinical notes detailing implications for ADOS-2 or CARS-2 scoring and diagnostic hypothesis.'
            }
          },
          required: [
            'activeNetwork', 'reasoning', 'citation', 'regions', 'brodmannAreas', 'neurotransmitters', 
            'adosScores', 'cognitiveLoad', 'confidence', 'meltdownRisk', 'leadTime', 'shapValues', 
            'parentGuidance', 'clinicianNotes'
          ]
        }
      }
    };

    let response;
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          ...requestConfig
        });
        if (response) {
          console.log(`Success: Inference resolved using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed or busy. Retrying next model in cascade... Error: ${err.message || err}`);
        lastError = err;
      }
    }

    if (!response) {
      console.error('All cascading fallback models failed.');
      throw lastError || new Error('All Gemini model endpoints are currently experiencing high demand. Please try again in a moment.');
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in reason route:', error);
    
    let message = 'Internal server error';
    if (error && typeof error === 'object') {
      if (error.message) {
        message = error.message;
        try {
          const parsed = JSON.parse(error.message);
          if (parsed && parsed.error && parsed.error.message) {
            message = parsed.error.message;
          }
        } catch (_) {}
      } else if (error.statusText) {
        message = error.statusText;
      }
    } else if (typeof error === 'string') {
      message = error;
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
