# 🛡️ NeuroDot: 100% Free, Local-First Assistive Reader
## Zero-API Dependency & Offline Verification Report

This repository contains a **fully-functional, production-grade assistive Braille reader** engineered to run **100% locally with zero paid API keys, credit cards, or external cloud dependencies**. 

Judges can clone, install, and run this application completely offline.

---

## 🚀 How We Achieved a $0/Month Offline Stack

Instead of wrapper implementations that break when API keys are missing, we replaced all paid modules with open-source local equivalents:

| Core Pipeline | Legacy Paid Stack | NeuroDot Free Stack | Cost | Local / Offline |
| :--- | :--- | :--- | :--- | :--- |
| **Image Preprocessing** | Paid Vision APIs | **OpenCV (CLAHE Filters)** | **$0** | **100% Local ✓** |
| **Braille Localization** | Custom Cloud Servers | **Local OpenCV Circle fitting** | **$0** | **100% Local ✓** |
| **Natural Speech TTS** | Paid Cloud TTS | **Browser Web Speech API** | **$0** | **100% Local ✓** |
| **Speech Dictation Input** | Paid Speech-to-Text | **Browser Web Speech Recognition**| **$0** | **100% Local ✓** |
| **Language Correction** | Paid Google Gemini API | **Smart Deterministic Rules + Ollama**| **$0** | **100% Local ✓** |

---

## ⚡ Two-Tier Local Post-Correction Engine

Our post-correction API gateway (`/api/braille/correct`) has been refactored into a resilient, two-tiered local post-processor:
1. **Tier 1: Smart Local Rule-Based Corrector (100% Offline):** A high-performance TypeScript translation module built directly into the Express router that expands Grade 2 contracted Braille symbols, maps capitals (`⠠` prefix) and numbers (`⠼` prefix) instantly, and resolves mathematical spacing.
2. **Tier 2: Local Ollama LLM (Optional Enhancement):** If a local Ollama server is running (e.g., Mistral or Llama3), the API automatically enhances the rules using offline LLM inference with a 1.5s timeout. If Ollama is not installed, it falls back silently and instantly to Tier 1 without throwing errors.

---

## 🧪 Zero-API Automated Test Suite

Judges can verify the integrity of the offline stack in one click by running our automated integration verification suite:

```bash
cd artifacts/api-server
node test_no_apis.cjs
```

### Expected Output:
```text
🧪 NeuroDot: Zero-API Verification Suite
=========================================

✓ Health endpoint responds 200 OK
✓ Rule-based corrector translates capitals & spaces perfectly offline
✓ No GOOGLE_API_KEY environment variable required
✓ No GEMINI_API_KEY environment variable required
✓ No OPENAI_API_KEY environment variable required
✓ System runs completely offline with 100% deterministic local rules
✓ Speech synthesis is browser-native & zero cost (Web Speech API)
✓ Speech recognition microphone input is browser-native & zero cost

=========================================
✓ Passed: 8
✗ Failed: 0
=========================================

✅ All tests passed!
Your NeuroDot backend is 100% API-free and works perfectly offline!
```

---

## 🎬 How to Run (Judges Quick Start)

### Step 1: Install Dependencies (100% Free)
```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/neuro-dot.git
cd neuro-dot

# Install pnpm monorepo dependencies
pnpm install
```

### Step 2: Spin Up the Dev Servers Concurrently
```bash
# Spins up React Frontend, Express Gateway, and Python CV Engine concurrently!
pnpm -r --parallel dev
```

### Step 3: Optional - Enhanced Local LLM (Ollama)
If you want to experience the optional Tier 2 LLM enhancement, install Ollama (from [ollama.ai](https://ollama.ai)) and pull Mistral:
```bash
ollama pull mistral
```
The NeuroDot server will automatically detect it on `http://localhost:11434` and use it! No configuration needed.

---

## 🤝 Social Impact & Design Philosophy

NeuroDot is designed for **genuine, real-world accessibility**:
1. **Financial Inclusion:** Visually impaired users, NGOs, and assistive schools cannot afford expensive cloud API subscriptions. Keeping it 100% local guarantees infinite accessibility at $0 cost.
2. **Privacy First:** Braille readers process personal documents, letters, and banking statements. Running local models ensures that all text extraction stays on the user's computer with absolute data privacy.
3. **Connectivity Resilience:** Low-vision users in remote areas with low connectivity can translate books and signs offline.
