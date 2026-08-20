import { readFile } from 'node:fs/promises';
import { analyzeRomReal } from '../engine/pipeline';

function usage(): never {
  console.error('Usage: npm exec tsx scripts/analyze-rom.ts <rom-file>');
  process.exit(2);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

const file = process.argv[2];
if (!file) usage();

const input = new Uint8Array(await readFile(file));
let lastStage = '';

const result = await analyzeRomReal(input, (stage, percent) => {
  if (stage !== lastStage) {
    lastStage = stage;
    console.error(`[${percent.toString().padStart(3, ' ')}%] ${stage}`);
  }
});

const header = result.header;
console.log(JSON.stringify({
  file,
  inputBytes: input.byteLength,
  romSize: header.romSize,
  romSizeFormatted: formatBytes(header.romSize),
  entryPoint: `0x${(header.entryPoint >>> 0).toString(16).padStart(8, '0')}`,
  instructionCount: result.instructions.length,
  recoveredFunctionCount: result.functions.length,
  cfgCount: result.cfgs.size,
  semanticAnalysis: {
    stage: result.semanticAnalysis?.stage ?? 'unknown',
    status: result.semanticAnalysis?.status ?? 'unknown',
  },
}, null, 2));
