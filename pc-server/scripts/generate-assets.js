const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
const mediaDir = path.join(__dirname, '..', 'public', 'media');

if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

// 1. Generate Melodic Chime WAV Audio (C6 -> E6 -> G6 -> C7 sparkle)
const sampleRate = 44100;
const duration = 1.4;
const numSamples = Math.floor(sampleRate * duration);
const dataSize = numSamples * 2;

const wavBuffer = Buffer.alloc(44 + dataSize);
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(36 + dataSize, 4);
wavBuffer.write('WAVE', 8);
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20); // PCM
wavBuffer.writeUInt16LE(1, 22); // mono
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * 2, 28);
wavBuffer.writeUInt16LE(2, 32);
wavBuffer.writeUInt16LE(16, 34);
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const env1 = Math.exp(-t * 7.5);
  const note1 = Math.sin(2 * Math.PI * 1046.5 * t) * 0.45 * env1;

  const t2 = t - 0.12;
  const env2 = t2 > 0 ? Math.exp(-t2 * 6.5) : 0;
  const note2 = t2 > 0 ? Math.sin(2 * Math.PI * 1318.5 * t2) * 0.5 * env2 : 0;

  const t3 = t - 0.24;
  const env3 = t3 > 0 ? Math.exp(-t3 * 5.0) : 0;
  const note3 = t3 > 0 ? Math.sin(2 * Math.PI * 1567.98 * t3) * 0.65 * env3 : 0;

  const t4 = t - 0.36;
  const env4 = t4 > 0 ? Math.exp(-t4 * 4.0) : 0;
  const note4 = t4 > 0 ? Math.sin(2 * Math.PI * 2093.0 * t4) * 0.55 * env4 : 0;

  let val = note1 + note2 + note3 + note4;
  val = Math.max(-1, Math.min(1, val));
  wavBuffer.writeInt16LE(Math.floor(val * 32767), 44 + i * 2);
}

fs.writeFileSync(path.join(soundsDir, 'notification.wav'), wavBuffer);
fs.writeFileSync(path.join(soundsDir, 'notification.mp3'), wavBuffer);
console.log('✅ Generated sound: public/sounds/notification.wav (' + wavBuffer.length + ' bytes)');

// 2. Generate a Sleek Multi-frame Streamer GIF (Spinning Diamond & Sparkle Alert GIF)
// We construct a standard GIF89a with 6 frames
function createAnimatedGif() {
  const width = 120;
  const height = 120;
  const numFrames = 8;
  
  // GIF Header & Logical Screen Descriptor
  const header = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    width & 0xFF, (width >> 8) & 0xFF,
    height & 0xFF, (height >> 8) & 0xFF,
    0xF7, // Global Color Table Flag (256 colors)
    0x00, // Background color index (0 = transparent)
    0x00  // Pixel Aspect Ratio
  ]);

  // Global Color Table (256 colors)
  // Index 0: Transparent (black placeholder)
  // Index 1-64: Cyan glow palette (#00f4fe to #ffffff)
  // Index 65-128: Purple streamer palette (#9146ff to #c499ff)
  // Index 129-192: Gold spark palette (#ffb703 to #ffe082)
  const gct = Buffer.alloc(256 * 3);
  gct.fill(0);
  
  for (let c = 1; c < 256; c++) {
    const ratio = (c % 64) / 63;
    if (c < 64) {
      // Cyan to White
      gct[c * 3] = Math.floor(ratio * 255);
      gct[c * 3 + 1] = Math.floor(244 + ratio * 11);
      gct[c * 3 + 2] = 254;
    } else if (c < 128) {
      // Purple to Pink
      gct[c * 3] = Math.floor(145 + ratio * 110);
      gct[c * 3 + 1] = Math.floor(70 + ratio * 130);
      gct[c * 3 + 2] = 255;
    } else {
      // Gold to Yellow
      gct[c * 3] = 255;
      gct[c * 3 + 1] = Math.floor(183 + ratio * 72);
      gct[c * 3 + 2] = Math.floor(3 + ratio * 180);
    }
  }

  // Netscape Application Extension (for infinite loop)
  const appExt = Buffer.from([
    0x21, 0xFF, 0x0B,
    0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, // NETSCAPE2.0
    0x03, 0x01, 0x00, 0x00, 0x00 // Loop infinitely
  ]);

  const frameBuffers = [];

  for (let f = 0; f < numFrames; f++) {
    const angle = (f / numFrames) * Math.PI * 2;
    
    // Graphic Control Extension (Transparent index 0, Delay 80ms)
    const gce = Buffer.from([
      0x21, 0xF9, 0x04,
      0x09, // Disposal method: restore to background, transparency flag ON
      0x08, 0x00, // Delay time: 8 (80ms per frame)
      0x00, // Transparent color index = 0
      0x00  // Block terminator
    ]);

    // Image Descriptor
    const imgDesc = Buffer.from([
      0x2C,
      0x00, 0x00, 0x00, 0x00, // Left, Top (0, 0)
      width & 0xFF, (width >> 8) & 0xFF,
      height & 0xFF, (height >> 8) & 0xFF,
      0x00 // No Local Color Table
    ]);

    // Pixel matrix (120x120)
    const pixels = Buffer.alloc(width * height);
    pixels.fill(0); // transparent background

    const cx = 60;
    const cy = 60;
    const size = 32 + Math.sin(angle) * 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        
        // Rotate coords
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

        // Draw diamond
        const dist = Math.abs(rx) + Math.abs(ry);
        if (dist <= size) {
          const colorIdx = dist < size * 0.5 ? 45 : (dist < size * 0.8 ? 20 : 80);
          pixels[y * width + x] = colorIdx;
        }

        // Draw sparkle stars
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > size + 4 && r < size + 14) {
          const sparkAngle = Math.atan2(dy, dx) + angle * 2;
          if (Math.abs(Math.sin(sparkAngle * 2)) > 0.88) {
            pixels[y * width + x] = 140; // gold sparkle
          }
        }
      }
    }

    // Uncompressed LZW Raster Data
    // Minimum LZW code size = 8
    const lzwMinCodeSize = 8;
    const clearCode = 1 << lzwMinCodeSize; // 256
    const endCode = clearCode + 1; // 257

    // Pack into sub-blocks
    const uncompressedData = [];
    uncompressedData.push(clearCode);
    for (let i = 0; i < pixels.length; i++) {
      uncompressedData.push(pixels[i]);
      if (i % 250 === 0 && i > 0) uncompressedData.push(clearCode);
    }
    uncompressedData.push(endCode);

    // Simple LZW bit packer
    let bitBuffer = 0;
    let bitCount = 0;
    const packedBytes = [];
    let curCodeSize = 9;

    for (const code of uncompressedData) {
      bitBuffer |= (code << bitCount);
      bitCount += curCodeSize;
      while (bitCount >= 8) {
        packedBytes.push(bitBuffer & 0xFF);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    }
    if (bitCount > 0) {
      packedBytes.push(bitBuffer & 0xFF);
    }

    // Chunk into GIF sub-blocks (max 255 bytes)
    const blocks = [];
    let offset = 0;
    while (offset < packedBytes.length) {
      const chunkSize = Math.min(254, packedBytes.length - offset);
      blocks.push(chunkSize);
      for (let b = 0; b < chunkSize; b++) {
        blocks.push(packedBytes[offset + b]);
      }
      offset += chunkSize;
    }
    blocks.push(0x00); // Block terminator

    const rasterBlock = Buffer.concat([
      Buffer.from([lzwMinCodeSize]),
      Buffer.from(blocks)
    ]);

    frameBuffers.push(Buffer.concat([gce, imgDesc, rasterBlock]));
  }

  const trailer = Buffer.from([0x3B]); // Trailer
  return Buffer.concat([header, gct, appExt, ...frameBuffers, trailer]);
}

const gifBuffer = createAnimatedGif();
fs.writeFileSync(path.join(mediaDir, 'alert-diamond.gif'), gifBuffer);
console.log('✅ Generated GIF: public/media/alert-diamond.gif (' + gifBuffer.length + ' bytes)');
