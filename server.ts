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
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', tool: 'N64 Decompiler & C++ Recompiler CLI' });
});

// AI-Assisted Decompilation API Route
app.post('/api/decompile/ai', async (req, res) => {
  try {
    const { mipsCode, functionName, entryAddress, contextInfo } = req.body;

    if (!mipsCode) {
      res.status(400).json({ error: 'MIPS code snippet is required.' });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert N64 reverse engineer and C++ software architect specializing in MIPS R4300i assembly decompilation and static recompilation.
Decompile the following MIPS R4300i assembly block into clean, modern, highly readable idiomatic C++17 code.

Function Context:
- Function Name: ${functionName || 'func_unknown'}
- Address / Entry: ${entryAddress || '0x80000400'}
${contextInfo ? `- Additional Context: ${contextInfo}` : ''}

MIPS R4300i Assembly Input:
\`\`\`mips
${mipsCode}
\`\`\`

Requirements:
1. Reconstruct structured high-level control flow (if/else conditionals, while/for loops, switch statements).
2. Infer meaningful parameter types, return type, and local variable names (e.g. use size_t, uint32_t, N64 Hardware Register definitions if accessing memory locations like 0x04400000 for VI, 0x04000000 for SP, etc.).
3. Abstract raw memory reads/writes into expressive functions or hardware structure calls (e.g., \`IO_WRITE(VI_STATUS_REG, val)\` or \`N64Memory::Read32(addr)\`).
4. Provide inline comments explaining the N64 hardware logic or algorithmic steps.
5. Provide response in JSON format with fields:
   - "cppCode": string (Complete C++ function code)
   - "explanation": string (High-level analysis of what this code does)
   - "parameters": array of strings (inferred parameters)
   - "returnType": string
   - "detectedHardware": array of strings (e.g. ["VI (Video Interface)", "RSP", "RDRAM"])`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let resultJson = {};
    try {
      resultJson = JSON.parse(responseText);
    } catch {
      resultJson = { cppCode: responseText, explanation: 'Decompiled result' };
    }

    res.json({ success: true, data: resultJson });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown AI error';
    console.error('AI Decompile Error:', errMessage);
    res.status(500).json({ success: false, error: errMessage });
  }
});

app.post('/api/analyze-rom', (req, res) => {
  try {
    const encoded = req.body?.rom;

    if (typeof encoded !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Expected ROM as base64 string.',
      });
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

    const result = analyzeRom(
      new Uint8Array(buffer),
    );

    res.json({
      success: true,

      header: result.header,

      romSize: result.romSize,

      instructions: result.instructions,

      functions: result.functions.map((fn) => ({
        address: fn.address,
        name: fn.name,
        endAddress: fn.endAddress,
        calls: fn.calls,
        branches: fn.branches,
        instructionCount: fn.instructions.length,
      })),
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

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`N64 Decompiler CLI Server running at http://localhost:${PORT}`);
  });
}

startServer();
