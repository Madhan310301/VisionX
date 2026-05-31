# Braille Vision

<p align="center">
  <img src="your-animated-banner.svg" alt="Braille Vision Banner" />
</p>

<p align="center">
  <b>Dot-wise Braille recognition for handwritten and embossed Braille.</b>
</p>

---

## ✨ Features

- **Dot-wise Braille Detection**  
  Detects each Braille dot individually instead of guessing whole words.

- **YOLO-Based Region Detection**  
  Finds Braille areas in images and PDF pages before decoding.

- **OpenCV Dot Extraction**  
  Uses image preprocessing, thresholding, and contour analysis to isolate Braille dots.

- **Braille Cell Reconstruction**  
  Groups detected dots into valid 6-dot Braille cells.

- **CNN Validation Layer**  
  Checks uncertain cells for better accuracy on noisy or handwritten samples.

- **Gemini Text Correction**  
  Refines uncertain decoded output into cleaner final text.

- **Image and PDF Support**  
  Works with uploaded Braille images as well as scanned documents.

- **Confidence Scores**  
  Displays how confident the system is for each detected cell or line.

- **Visual Overlays**  
  Shows detected dots and Braille regions for debugging and verification.

- **Built for Real-World Braille**  
  Designed to handle handwritten paper Braille, blur, skew, shadows, and uneven lighting.

---

## 🔥 Why Braille Vision?

Traditional OCR tools are not built for Braille.  
Braille Vision uses a **dot-first hybrid pipeline** to read Braille the right way:

**Upload → Preprocess → Detect Braille Region → Detect Dots → Group Cells → Decode → Correct → Output Text**

---

## 🛠 Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Vision:** OpenCV, YOLO
- **ML:** CNN
- **AI Correction:** Gemini API
- **Input Formats:** Images, PDFs

---

## 🎯 Output

- Extracted Braille text
- Confidence score
- Dot overlay visualization
- Braille cell detection view
- Uncertain prediction warnings

---

## 🚀 Project Goal

To build an accurate and accessible Braille reader that can convert handwritten Braille into text with strong real-world performance.

---

## 🎨 Optional Animated Header

If you want a more attractive README, use an animated SVG header instead of JavaScript.  
You can place a custom SVG banner or typing-style animation image at the top of the README.

---

## 📌 Note

GitHub README does not run JavaScript, so animation should be added using:
- animated SVG
- GIFs
- badges
- collapsible sections
- Mermaid diagrams
