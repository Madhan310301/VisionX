import fs from "fs";
import path from "path";

const brainDir = "C:\\Users\\maddy\\.gemini\\antigravity\\brain\\2dbd2614-f3d7-4554-b373-93aa5daa373a";

const files = fs.readdirSync(brainDir).filter(f => f.startsWith("media__"));

for (const file of files) {
  const filePath = path.join(brainDir, file);
  const stats = fs.statSync(filePath);
  console.log(`File: ${file}, Size: ${stats.size} bytes`);
  
  // Read first few bytes to check if JPEG or PNG
  const buffer = fs.readFileSync(filePath);
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
  
  let dimensions = "Unknown";
  if (isPng) {
    // Read PNG width/height from IHDR chunk
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    dimensions = `${width}x${height} (PNG)`;
  } else if (isJpg) {
    // Read JPEG width/height
    let offset = 2;
    while (offset < buffer.length) {
      const marker = buffer.readUInt16BE(offset);
      offset += 2;
      if (marker === 0xffc0 || marker === 0xffc2) {
        // SOF0 or SOF2
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        dimensions = `${width}x${height} (JPEG)`;
        break;
      } else {
        const length = buffer.readUInt16BE(offset);
        offset += length;
      }
    }
  }
  console.log(`  Type: ${isPng ? "PNG" : isJpg ? "JPEG" : "Other"}, Dimensions: ${dimensions}`);
}
