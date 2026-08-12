import React, { useState, useEffect } from 'react';
import {
  Code2,
  Cpu,
  Binary,
  Play,
  Check,
  Copy,
  Download,
  AlertCircle,
  Sparkles,
  Zap,
  Disc,
  Layers,
  ArrowRight,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import { DecompiledFunction, MipsInstruction, RomHeader } from '../types/n64';
import { compileCToMipsAsm, OptLevel, CCompileResult } from '../utils/cToMipsCompiler';
import { assembleMipsSource, MipsAssembleResult } from '../utils/mipsAssembler';
import { formatHex32 } from '../utils/n64Parser';

interface MipsCompilerStudioViewProps {
  functions: DecompiledFunction[];
  instructions: MipsInstruction[];
  selectedFn: DecompiledFunction | null;
  header: RomHeader | null;
  romBuffer: Uint8Array | null;
  onPatchRomBuffer?: (patchedBuffer: Uint8Array, message: string) => void;
}

const C_PRESETS = [
  {
    name: 'Hardware MMIO Controller Poll',
    code: `/* N64 Controller Status Polling Routine */
#include <stdint.h>

#define PIF_RAM_STATUS   0xBF0007FC
#define PIF_RAM_COMMAND  0xBF0007C0

void poll_n64_controller(uint32_t channel) {
    uint32_t status = N64_READ_32(PIF_RAM_STATUS);
    if (status == 0) {
        N64_WRITE_32(PIF_RAM_COMMAND, 0x01);
    }
}
`,
  },
  {
    name: 'Fast Vector 3D Dot Product',
    code: `/* Vector 3D Dot Product Computation */
#include <stdint.h>

int32_t vec3_dot_product(int32_t x1, int32_t y1, int32_t z1, int32_t x2, int32_t y2, int32_t z2) {
    int32_t dot = (x1 * x2) + (y1 * y2) + (z1 * z2);
    return dot;
}
`,
  },
  {
    name: 'DMA Memory Block Copy Loop',
    code: `/* Fast MIPS R4300i DMA Copy Loop */
#include <stdint.h>

void dma_block_copy(uint32_t* src, uint32_t* dst, uint32_t wordsCount) {
    uint32_t i = 0;
    while (i < wordsCount) {
        dst[i] = src[i];
        i++;
    }
}
`,
  },
  {
    name: 'Recursive Fibonacci Sequence',
    code: `/* Fibonacci Sequence Calculation */
#include <stdint.h>

uint32_t fibonacci(uint32_t n) {
    if (n == 0) return 0;
    if (n == 1) return 1;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
`,
  },
];

export const MipsCompilerStudioView: React.FC<MipsCompilerStudioViewProps> = ({
  functions,
  instructions,
  selectedFn,
  header,
  romBuffer,
  onPatchRomBuffer,
}) => {
  const [cCode, setCCode] = useState<string>(C_PRESETS[0].code);
  const [optLevel, setOptLevel] = useState<OptLevel>('O2');
  const [mipsAsm, setMipsAsm] = useState<string>('');
  const [compileResult, setCompileResult] = useState<CCompileResult | null>(null);
  const [assembleResult, setAssembleResult] = useState<MipsAssembleResult | null>(null);
  
  const [copiedAsm, setCopiedAsm] = useState(false);
  const [copiedHex, setCopiedHex] = useState(false);
  const [patchSuccess, setPatchSuccess] = useState(false);

  // Auto compile on initial load or preset change
  const handleCompileC = (source: string = cCode, opt: OptLevel = optLevel) => {
    try {
      const baseAddr = selectedFn ? selectedFn.entryAddress : 0x80000400;
      const res = compileCToMipsAsm(source, opt, baseAddr);
      setCompileResult(res);
      setMipsAsm(res.mipsAsm);
      setAssembleResult(res.assembled);
    } catch (err) {
      console.error('Compilation error:', err);
    }
  };

  // Auto update when selectedFn changes from workspace
  useEffect(() => {
    if (selectedFn) {
      const fnCode =
        `/* Decompiled Function: ${selectedFn.name} @ ${formatHex32(selectedFn.entryAddress)} */\n` +
        `#include <stdint.h>\n\n` +
        `${selectedFn.highLevelCCode || selectedFn.pseudoCCode}\n`;
      setCCode(fnCode);
      handleCompileC(fnCode, optLevel);
    } else {
      handleCompileC(cCode, optLevel);
    }
  }, [selectedFn]);

  // Re-assemble custom edited MIPS assembly
  const handleReassembleAsm = (asmText: string = mipsAsm) => {
    try {
      const baseAddr = selectedFn ? selectedFn.entryAddress : 0x80000400;
      const res = assembleMipsSource(asmText, baseAddr);
      setAssembleResult(res);
    } catch (err) {
      console.error('Re-assembly error:', err);
    }
  };

  // Patch assembled machine code into active ROM buffer
  const handlePatchIntoRom = () => {
    if (!romBuffer || !selectedFn || !assembleResult || assembleResult.bytes.length === 0) return;

    const patchedBuf = new Uint8Array(romBuffer);
    const base = header?.entryPoint || 0x80000400;
    let romOffset = (selectedFn.entryAddress - base) + 0x1000;

    if (romOffset < 0x1000 || romOffset + assembleResult.bytes.length > patchedBuf.length) {
      romOffset = 0x1000; // Fallback
    }

    patchedBuf.set(assembleResult.bytes, romOffset);

    if (onPatchRomBuffer) {
      onPatchRomBuffer(
        patchedBuf,
        `Patched recompiled function '${selectedFn.name}' (${assembleResult.bytes.length} bytes) at ROM offset 0x${romOffset.toString(16)}.`
      );
    }

    setPatchSuccess(true);
    setTimeout(() => setPatchSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-slate-200 overflow-hidden">
      {/* Top Toolbar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Zap size={16} />
            <span>C-to-MIPS Compiler & Assembler Studio</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Presets:</span>
            <select
              onChange={(e) => {
                const preset = C_PRESETS.find((p) => p.name === e.target.value);
                if (preset) {
                  setCCode(preset.code);
                  handleCompileC(preset.code, optLevel);
                }
              }}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {C_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Opt Level Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Opt Level:</span>
            <select
              value={optLevel}
              onChange={(e) => {
                const opt = e.target.value as OptLevel;
                setOptLevel(opt);
                handleCompileC(cCode, opt);
              }}
              className="bg-slate-950 border border-slate-700 text-amber-300 font-bold rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="O0">-O0 (Unoptimized)</option>
              <option value="O1">-O1 (Basic)</option>
              <option value="O2">-O2 (SGI IDO 5.3 Matching)</option>
              <option value="O3">-O3 (Aggressive)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCompileC(cCode, optLevel)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold shadow transition cursor-pointer"
          >
            <Play size={13} />
            <span>Compile C → MIPS</span>
          </button>

          <button
            onClick={handleReassembleAsm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold shadow transition cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Re-Assemble MIPS</span>
          </button>

          {romBuffer && selectedFn && (
            <button
              onClick={handlePatchIntoRom}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition shadow cursor-pointer ${
                patchSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {patchSuccess ? <Check size={13} /> : <Disc size={13} />}
              <span>{patchSuccess ? 'Patched into ROM!' : 'Patch into ROM'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 3-Pane Tri-Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
        
        {/* Pane 1: C Source Code Editor */}
        <div className="flex flex-col min-h-0 bg-slate-950">
          <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-cyan-400" />
              <span className="font-bold text-slate-200">1. C Source Code</span>
            </div>
            <span className="text-[10px] text-slate-500">ANSI C / Micro-C</span>
          </div>

          <textarea
            value={cCode}
            onChange={(e) => {
              setCCode(e.target.value);
              handleCompileC(e.target.value, optLevel);
            }}
            placeholder="// Type C function here..."
            className="flex-1 p-3 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-cyan-900"
            spellCheck={false}
          />
        </div>

        {/* Pane 2: Recompiled MIPS R4300i Assembly Editor */}
        <div className="flex flex-col min-h-0 bg-slate-950">
          <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-purple-400" />
              <span className="font-bold text-slate-200">2. Compiled MIPS Assembly</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mipsAsm);
                setCopiedAsm(true);
                setTimeout(() => setCopiedAsm(false), 2000);
              }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              {copiedAsm ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedAsm ? 'Copied' : 'Copy Asm'}</span>
            </button>
          </div>

          <textarea
            value={mipsAsm}
            onChange={(e) => {
              const val = e.target.value;
              setMipsAsm(val);
              handleReassembleAsm(val);
            }}
            placeholder="# MIPS R4300i Assembly output..."
            className="flex-1 p-3 bg-slate-950 text-purple-200 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-purple-900"
            spellCheck={false}
          />
        </div>

        {/* Pane 3: Assembled Machine Code & Verification */}
        <div className="flex flex-col min-h-0 bg-slate-950">
          <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Binary size={14} className="text-emerald-400" />
              <span className="font-bold text-slate-200">3. Assembled Machine Code</span>
            </div>
            <button
              onClick={() => {
                if (assembleResult) {
                  navigator.clipboard.writeText(assembleResult.hexOutput);
                  setCopiedHex(true);
                  setTimeout(() => setCopiedHex(false), 2000);
                }
              }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              {copiedHex ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedHex ? 'Copied' : 'Copy Hex'}</span>
            </button>
          </div>

          {/* Errors or Diagnostics */}
          {assembleResult && assembleResult.errors.length > 0 && (
            <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertCircle size={14} />
                <span>Assembly Errors ({assembleResult.errors.length})</span>
              </div>
              {assembleResult.errors.map((err, idx) => (
                <div key={idx} className="text-[11px] font-mono">
                  Line {err.line}: {err.message}
                </div>
              ))}
            </div>
          )}

          {/* Machine Code Hex Verification View */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-xs">
            {assembleResult && (
              <>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-500">Instructions:</span>{' '}
                    <span className="text-emerald-400 font-bold">{assembleResult.words.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Size:</span>{' '}
                    <span className="text-amber-300 font-bold">{assembleResult.bytes.length} bytes</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-bold border-b border-slate-800 pb-1">
                    Disassembled Verification:
                  </div>
                  <pre className="text-slate-300 text-[11px] leading-relaxed whitespace-pre font-mono selection:bg-emerald-950">
                    {assembleResult.hexOutput}
                  </pre>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="text-[11px] text-slate-400 font-bold border-b border-slate-800 pb-1">
                    Raw 32-Bit Big-Endian Hex Array:
                  </div>
                  <div className="p-2 bg-slate-900/90 rounded border border-slate-800 text-cyan-300 text-[11px] font-mono break-all leading-normal">
                    {assembleResult.words
                      .map((w) => (w >>> 0).toString(16).padStart(8, '0').toUpperCase())
                      .join(' ')}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
