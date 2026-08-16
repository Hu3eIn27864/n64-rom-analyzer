import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { analyzeRom } from './engine/pipeline';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '128mb' }));

// Shared Gemini AI Client (Server-Side Only)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1beta' },
    });
  }
  return aiClient;
}

// Parse ROM endpoint
app.post('/api/analyze-rom', (req, res) => {
  try {
    const encoded = req.body?.rom;
    if (typeof encoded !== 'string') {
      res.status(400).json({ success: false, error: 'ROM data is required.' });
      return;
    }

    const buffer = Buffer.from(encoded, 'base64');

    if (buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: 'ROM is empty.',
      });
      return;
    }

    const result = analyzeRom(new Uint8Array(buffer));

    res.json({
      success: true,
      header: result.header,
      romSize: result.romSize,
      instructions: result.instructions,
      functions: result.functions.map((fn) => {
        const instructions = result.instructions.filter(
          (instruction) =>
            instruction.address >= fn.entryAddress &&
            instruction.address < fn.endAddress,
        );

        const calls = instructions
          .filter((instruction) =>
            instruction.opcodeName === 'JAL' || instruction.opcodeName === 'JALR',
          )
          .map((instruction) => instruction.targetAddress)
          .filter((address): address is number => address !== undefined);

        const branches = instructions
          .filter(
            (instruction) =>
              instruction.isBranchOrJump &&
              instruction.opcodeName !== 'JAL' &&
              instruction.opcodeName !== 'JALR' &&
              instruction.opcodeName !== 'JR',
          )
          .map((instruction) => instruction.targetAddress)
          .filter((address): address is number => address !== undefined);

        return {
          address: fn.entryAddress,
          name: fn.name,
          endAddress: fn.endAddress,
          calls,
          branches,
          instructionCount: fn.instructionCount,
        };
      }),
    });
  } catch (error) {
    console.error('ROM analysis failed:', error);

    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'ROM analysis failed.',
    });
  }
});

// Gemini analysis endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body ?? {};
    if (typeof prompt !== 'string' || prompt.length === 0) {
      res.status(400).json({ success: false, error: 'Prompt is required.' });
      return;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    res.json({ success: true, text: response.text ?? '' });
  } catch (error) {
    console.error('Gemini request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Gemini request failed.',
    });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
