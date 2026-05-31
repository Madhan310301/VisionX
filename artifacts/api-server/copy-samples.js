import fs from "fs";
import path from "path";

const targetDir = "a:\\BrailleVision Hackathon\\Neuro-Dot\\sample_scans";
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const sourceFiles = [
  { name: "nemeth_math_braille.png", src: "C:\\Users\\maddy\\.gemini\\antigravity\\brain\\2dbd2614-f3d7-4554-b373-93aa5daa373a\\nemeth_math_braille_1779903052819.png" },
  { name: "music_braille_score.png", src: "C:\\Users\\maddy\\.gemini\\antigravity\\brain\\2dbd2614-f3d7-4554-b373-93aa5daa373a\\music_braille_score_1779903076908.png" },
  { name: "computer_eight_dot_braille.png", src: "C:\\Users\\maddy\\.gemini\\antigravity\\brain\\2dbd2614-f3d7-4554-b373-93aa5daa373a\\computer_braille_char_1779903101408.png" }
];

for (const file of sourceFiles) {
  const dest = path.join(targetDir, file.name);
  if (fs.existsSync(file.src)) {
    fs.copyFileSync(file.src, dest);
    console.log(`Copied ${file.name} to sample_scans/`);
  } else {
    console.error(`Source file not found: ${file.src}`);
  }
}
