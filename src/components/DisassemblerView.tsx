import React, { useState } from 'react';
import { Cpu, Search, Filter, Hash, Sparkles, CornerDownRight, Download, FileText } from 'lucide-react';
import { MipsInstruction, DecompiledFunction } from '../types/n64';
import { formatHex32 } from '../utils/n64Parser';
import { downloadTextFile } from '../utils/fileDownloader';
import { generateFullMipsAsmFile } from '../utils/mipsToCDecompiler';

interface DisassemblerViewProps {
  instructions: MipsInstruction[];
  functions: DecompiledFunction[];
  onSelectFunction: (fn: DecompiledFunction) => void;
  selectedFn: DecompiledFunction | null;
  onDecompileAi: (mipsCode: string, funcName: string) => Promise<void>;
  isAiDecompiling: boolean;
  header?: any;
}

export const DisassemblerView: React.FC<DisassemblerViewProps> = ({
  instructions,
  functions,
  onSelectFunction,
  selectedFn,
  onDecompileAi,
  isAiDecompiling,
  header,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [opcodeFilter, setOpcodeFilter] = useState('ALL');

  const handleExportAsm = () => {
    const asmContent = generateFullMipsAsmFile(header, instructions);
    downloadTextFile('n64_disassembly_full.asm', asmContent, 'text/x-asm');
  };

  if (instructions.length === 0) {

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950 text-slate-400 font-mono">
        <Cpu size={48} className="text-slate-700 mb-4" />
        <h2 className="text-lg font-bold text-slate-200 mb-2">No Disassembled Instructions</h2>
        <p className="text-xs max-w-md text-slate-500">
          Load an N64 ROM or sample ROM to disassemble MIPS R4300i machine code into assembly instructions.
        </p>
      </div>
    );
  }

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 300;

  // Filter instructions
  const filteredInstructions = instructions.filter((inst) => {
    if (opcodeFilter !== 'ALL' && inst.opcodeName !== opcodeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const addrHex = formatHex32(inst.address).toLowerCase();
      return (
        addrHex.includes(term) ||
        inst.asm.toLowerCase().includes(term) ||
        inst.rawHex.toLowerCase().includes(term) ||
        (inst.comment && inst.comment.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredInstructions.length / pageSize) || 1;
  const paginatedInstructions = filteredInstructions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const uniqueOpcodes = Array.from(new Set(instructions.map((i) => i.opcodeName))).sort();

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-950 font-mono text-slate-200 overflow-hidden">
      {/* Subroutine List Sidebar */}
      <div className="w-full lg:w-72 max-h-48 lg:max-h-none bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
            <Cpu size={14} />
            <span>MIPS Subroutines ({functions.length})</span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">R4300i ABI</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {functions.map((fn) => {
            const isSelected = selectedFn?.id === fn.id;
            return (
              <button
                key={fn.id}
                onClick={() => onSelectFunction(fn)}
                className={`w-full text-left p-2.5 rounded transition text-xs font-mono cursor-pointer border ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 truncate">{fn.name}</span>
                  <span className="text-[10px] text-amber-400/90">{fn.instructionCount} inst</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{formatHex32(fn.entryAddress)}</span>
                  {fn.hardwareAccessed.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      HW: {fn.hardwareAccessed[0].split(' ')[0]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Assembly Inspection Table */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Disassembly Search Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address (0x8000...), mnemonic (lui, sw), or hex..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-500" />
            <select
              value={opcodeFilter}
              onChange={(e) => setOpcodeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2.5 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Opcodes ({instructions.length})</option>
              {uniqueOpcodes.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportAsm}
              className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded shadow transition cursor-pointer"
              title="Export complete Full-ROM MIPS Assembly (.asm file)"
            >
              <Download size={13} />
              <span>Export .ASM</span>
            </button>
          </div>
        </div>

        {/* Selected Function Details Header Banner */}
        {selectedFn && (
          <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold">Active Subroutine: </span>
              <span className="font-bold text-cyan-300">{selectedFn.name}</span>
              <span className="text-slate-500 mx-2">|</span>
              <span className="text-slate-400">Entry: {formatHex32(selectedFn.entryAddress)}</span>
            </div>

            <button
              onClick={() => {
                const sampleMips = instructions.slice(0, 20).map((i) => `${formatHex32(i.address)}: ${i.asm}`).join('\n');
                onDecompileAi(sampleMips, selectedFn.name);
              }}
              disabled={isAiDecompiling}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-semibold rounded shadow transition cursor-pointer"
            >
              <Sparkles size={13} />
              <span>{isAiDecompiling ? 'AI Processing...' : 'AI Decompile Subroutine'}</span>
            </button>
          </div>
        )}

        {/* Assembly Instruction Listing Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
          <div className="grid grid-cols-12 gap-2 text-slate-500 font-bold pb-2 border-b border-slate-800 text-[11px] select-none">
            <span className="col-span-2">Address</span>
            <span className="col-span-2">Opcode Hex</span>
            <span className="col-span-5">MIPS Assembly Instruction</span>
            <span className="col-span-3">Disassembly Notes</span>
          </div>

          {paginatedInstructions.map((inst, index) => {
            const isEntry = inst.address === selectedFn?.entryAddress;
            return (
              <div
                key={index}
                className={`grid grid-cols-12 gap-2 py-1 px-2 rounded transition font-mono ${
                  isEntry
                    ? 'bg-cyan-950/90 border border-cyan-500/80 text-cyan-100 shadow-sm'
                    : inst.isBranchOrJump
                    ? 'bg-purple-950/30 text-purple-200'
                    : 'hover:bg-slate-900 text-slate-300'
                }`}
              >
                <span className="col-span-2 text-cyan-400 font-bold">{formatHex32(inst.address)}</span>
                <span className="col-span-2 text-slate-500 font-mono">{inst.rawHex}</span>
                <span className={`col-span-5 font-medium ${inst.isBranchOrJump ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                  {inst.asm}
                </span>
                <span className="col-span-3 text-slate-400 text-[11px] truncate">
                  {inst.comment && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CornerDownRight size={11} /> {inst.comment}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredInstructions.length)} of {filteredInstructions.length.toLocaleString()} instructions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded border border-slate-800 transition cursor-pointer"
            >
              Prev Page
            </button>
            <span className="text-cyan-400 font-bold">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-200 rounded border border-slate-800 transition cursor-pointer"
            >
              Next Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
