<div align="center">

# 👁️ VisionX

<img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=700&size=34&pause=1000&color=00D9FF&center=true&vCenter=true&width=900&lines=VisionX;AI-Powered+Braille+Vision+System;Dot-Wise+Braille+Recognition;Accessibility+Through+Artificial+Intelligence" alt="Typing SVG" />

<br>

![GitHub stars](https://img.shields.io/github/stars/Madhan310301/VisionX?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/Madhan310301/VisionX?style=for-the-badge)
![GitHub license](https://img.shields.io/github/license/Madhan310301/VisionX?style=for-the-badge)

### Transforming Braille Into Understanding

</div>

---

## About VisionX

VisionX is an AI-powered Braille interpretation project designed to convert handwritten and embossed Braille into readable text through a dot-wise detection pipeline.

It is built for real-world Braille documents, including noisy scans, tilted images, uneven lighting, and paper-based handwritten Braille.

The project focuses on accurate Braille dot analysis, structured cell reconstruction, and clean text output for accessibility-driven applications.

---

## How It Works

```text
Upload Image or PDF
        ↓
Preprocess Document
        ↓
Detect Braille Region
        ↓
Detect Individual Dots
        ↓
Group Dots into Cells
        ↓
Decode Braille Pattern
        ↓
Validate Uncertain Cells
        ↓
Return Final Text
```

---

## 🚀 How to Run VisionX on a New Machine (Step-by-Step)

Follow these exact steps to clone, configure, and access the application locally on any laptop.

---

### Step 1: Install System Prerequisites

Make sure the machine has the following tools installed:

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) — install via `npm install -g pnpm`
- [Python 3.10+](https://www.python.org/downloads/) — make sure **"Add Python to PATH"** is checked during installation

---

### Step 2: Configure the Python Virtual Environment

Because virtual environments are ignored by Git, you must initialize the local Python environment on the new machine.

1. Open your terminal in the project root directory and run:

   ```bash
   python -m venv .venv
   ```

2. Install the required Python dependencies:

   **On Windows (PowerShell):**

   ```powershell
   .venv\Scripts\pip install opencv-python numpy fastapi uvicorn pydantic
   ```

   **On macOS / Linux:**

   ```bash
   source .venv/bin/activate
   pip install opencv-python numpy fastapi uvicorn pydantic
   ```

---

### Step 3: Install Node.js Packages & Build

Install the project packages and compile the TypeScript codebases:

```bash
# Install all package dependencies
pnpm install

# Compile the monorepo packages
pnpm build
```

---

### Step 4: Start the Application

You will need **two terminal windows** open simultaneously.

#### 🖥️ Terminal 1 — Start the Backend Server (API + CV Engine)

This boots both the Node gateway and the Python image processing microservice:

```bash
pnpm --filter @workspace/api-server start
```

#### 🖥️ Terminal 2 — Start the Frontend Dev Server

In a new terminal window, boot the local web client:

```bash
pnpm --filter @workspace/braillevision dev
```

---

### Step 5: Access the Application

Open your web browser and navigate to:

👉 **http://localhost:5173/**

> **Note:** VisionX is designed to run **100% offline**. If no cloud database keys are detected, it automatically falls back to secure, local in-memory storage — so you can test all features immediately without any additional configuration.

---

