import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const VOICES = [
  { id: 'alloy', description: 'Neutral & Clear' },
  { id: 'echo', description: 'Warm & Friendly' },
  { id: 'fable', description: 'British & Whimsical' },
  { id: 'onyx', description: 'Deep & Engaging' },
  { id: 'nova', description: 'Energetic & Young' },
  { id: 'shimmer', description: 'Gentle & Soothing' }
];

const PREVIEW_TEXT = "Hi! I'll be your storyteller today.";
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'assets', 'sounds', 'voices');

async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function downloadVoicePreview(voice) {
  console.log(`Downloading preview for ${voice.id}...`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice.id,
        input: PREVIEW_TEXT,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${JSON.stringify(error)}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const outputPath = path.join(OUTPUT_DIR, `${voice.id}_preview.mp3`);
    await fs.writeFile(outputPath, Buffer.from(audioBuffer));
    
    console.log(`Successfully saved ${voice.id} preview to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to download ${voice.id} preview:`, error);
    return false;
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment variables');
    process.exit(1);
  }

  await ensureDirectoryExists(OUTPUT_DIR);
  console.log(`Saving previews to: ${OUTPUT_DIR}`);

  const results = await Promise.all(VOICES.map(downloadVoicePreview));
  const successCount = results.filter(Boolean).length;
  
  console.log(`\nDownload complete:`);
  console.log(`Successfully downloaded: ${successCount}/${VOICES.length} previews`);
  
  if (successCount === VOICES.length) {
    console.log('All voice previews were downloaded successfully!');
  } else {
    console.log('Some downloads failed. Check the logs above for details.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 