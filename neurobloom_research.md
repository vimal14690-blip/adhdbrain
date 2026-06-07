# Xha-Synapto AI (formerly NeuroBloom.ai) - Research & Strategy Notes

## 1. Project Vision & Goals
**Vision:** To build India’s first medical-grade, multi-modal clinical AI infrastructure to solve the Autism Diagnosis and Care Gap, moving away from a "tech-first" approach to a "human-first" narrative. 
**Core Goals:**
*   **Close the "Critical Window" Gap:** Reduce the average age of autism diagnosis in India from 4–6 years to under 2 years. Early AI-driven intervention improves long-term outcomes by 40–60%.
*   **Zero-Burn Architecture:** Implement a cost-efficient, local-first architecture using Ollama and edge inference (TFLite/CoreML) to run models locally, ensuring compliance with India's DPDP Act 2023 without burning capital on cloud LLM APIs.
*   **Secure Institutional Funding:** Focus on securing a $1M+ bank procurement by building a 10% functional prototype, alongside non-dilutive government funding via the DST NIDHI Programme and SIDBI SMILE loans.

## 2. Key Takeaways & Technical Moats
*   **Medical-Grade Explainability (XAI):** Solving the AI "Black Box" problem is critical. The platform utilizes Tree-based models (XGBoost) with **SHAP values** for tabular data and **Attention Maps** for video. This "Glass-Box" reasoning ensures clinicians can verify exactly *why* a decision was made.
*   **Meltdown Early Warning System:** The platform's most valuable commercial differentiator. A Transformer-LSTM hybrid time-series model tracks wearable biosignals (heart rate variability, sleep, activity) to predict meltdowns 15–45 minutes in advance (averaging a 42-minute lead time).
*   **3D Volumetric Vision:** Uses standard 2D mobile cameras with YOLOv8 and Pose Estimation to capture the Z-axis (depth) of motor movements, allowing the AI to detect subtle stimming behaviors invisible to flat 2D video.
*   **Multi-Agent RAG System:** A collaborative autonomous pipeline (Intake, RAG, Reasoning, Decision, and Alert agents) that retrieves clinical guidelines from a vector database of over 500,000 neuroscience papers, generating citation-backed clinical hypotheses.

## 3. What We Want to Achieve for Target Users

### For Parents (Solving "Parent Pain")
*   **Provide Proactive Control:** Transition parents from a reactive state of constant hyper-vigilance to proactive care by giving them a 15–45 minute early warning before a meltdown occurs, complete with personalized de-escalation steps.
*   **End the "₹8 Lakh Guesswork":** Families currently spend ₹3L–₹8L annually on therapies while "flying blind" due to siloed data. The platform provides a "Therapy Progress Tracker" and an auto-syncing "Daily Digest" to give parents a clear, data-backed story of their child's progress.
*   **24/7 Support:** A RAG-powered "Ask AI" Parent Co-Pilot offers immediate, evidence-cited answers to daily behavioral questions, culturally adapted for the Indian population.

### For Doctors and Clinicians (Eliminating the "Professional Paradox")
*   **Reduce Administrative Burden:** In India, there are only 2,200 trained behavior therapists for 18 million ASD patients. The AI acts as a clinical efficiency engine, providing digital equivalents to ADOS-2 and CARS-2 scoring, reducing clinician assessment burden by 70%.
*   **Establish Trust via Explainability:** Clinicians will not use tools they cannot trust. By providing a full "Chain-of-Thought" reasoning trace with SHAP values and citations, doctors can confidently use the AI as a verified clinical co-pilot.
*   **Research & Cohort Building:** Clinicians gain access to an AI-assisted literature search and a "Patient Cohort Builder" that queries federated databases, cutting clinical trial assembly time from months to hours.

### For Patients (Children with ASD)
*   **Early & Personalized Intervention:** By catching developmental delays sooner and fusing multi-modal data (video, audio, EMR, wearables), patients receive highly personalized, evidence-based therapy tracks tailored to their unique behavioral and sensory profiles.
*   **Improved Long-Term Potential:** Capitalizing on the high neuroplasticity of the brain before age two, the platform helps ensure patients do not miss their "Critical Window," radically improving their lifelong social, communicative, and adaptive skills.
