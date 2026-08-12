import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, CornerDownLeft, Sparkles, Copy, Check, Trash2, HelpCircle } from 'lucide-react';
import { CliLogEntry, RomHeader, DecompiledFunction, MipsInstruction } from '../types/n64';
import { formatHex32 } from '../utils/n64Parser';

interface TerminalViewProps {
  logs: CliLogEntry[];
  onExecuteCommand: (cmd: string) => void;
  header: RomHeader | null;
  functions: DecompiledFunction[];
  instructions: MipsInstruction[];
  onClearLogs: () => void;
  onDecompileAi: (mipsCode: string, funcName: string) => Promise<void>;
  isAiDecompiling: boolean;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  onExecuteCommand,
  header,
  functions,
  instructions,
  onClearLogs,
  onDecompileAi,
  isAiDecompiling,
}) => {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onExecuteCommand(input.trim());
    setInput('');
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleCommands = [
    'n64decomp analyze',
    'n64decomp decompile --out-dir ./src --lang cpp17',
    'n64decomp disasm --count 15',
    'n64decomp byteswap -o output.z64',
    'n64decomp ai-decompile',
    'help',
    'samples',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-sm text-slate-200">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyan-400" />
          <span className="font-semibold text-slate-300">C:\N64Decompiler\n64decomp.exe</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-mono">
            {header ? `${header.imageName} (${header.rawEndian.toUpperCase()})` : 'No ROM Loaded'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied Log' : 'Copy Output'}</span>
          </button>
          <button
            onClick={onClearLogs}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 rounded border border-slate-700 transition cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Interactive Command Suggestions Pills */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto text-xs scrollbar-none">
        <span className="text-slate-500 font-semibold flex items-center gap-1 shrink-0">
          <HelpCircle size={12} className="text-cyan-400" /> Quick Commands:
        </span>
        {sampleCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onExecuteCommand(cmd)}
            className="px-2.5 py-1 bg-slate-800/90 hover:bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 rounded border border-slate-700 hover:border-cyan-700 font-mono transition shrink-0 cursor-pointer shadow-sm"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Output Log Console */}
      <div className="flex-1 p-4 overflow-y-auto space-y-1.5 font-mono text-xs leading-relaxed selection:bg-cyan-900 selection:text-cyan-100">
        {logs.map((log) => {
          let textClass = 'text-slate-300';
          if (log.type === 'cmd') textClass = 'text-cyan-300 font-bold';
          if (log.type === 'info') textClass = 'text-slate-300';
          if (log.type === 'success') textClass = 'text-emerald-400 font-medium';
          if (log.type === 'warn') textClass = 'text-amber-400 font-medium';
          if (log.type === 'error') textClass = 'text-rose-400 font-bold';
          if (log.type === 'system') textClass = 'text-purple-400 font-semibold';

          return (
            <div key={log.id} className="flex items-start gap-2 group">
              <span className="text-slate-600 select-none text-[10px] pt-0.5">{log.timestamp}</span>
              {log.type === 'cmd' && <span className="text-cyan-400 select-none">$</span>}
              <pre className={`whitespace-pre-wrap break-all ${textClass}`}>{log.message}</pre>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Quick AI Decompile CTA Bar if functions exist */}
      {functions.length > 0 && (
        <div className="px-4 py-2 bg-gradient-to-r from-purple-950/60 via-slate-900 to-cyan-950/60 border-t border-purple-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400 animate-pulse" />
            <span className="text-purple-200 font-semibold">Gemini Server Decompiler Engine</span>
            <span className="text-purple-400/80">({functions.length} MIPS subroutines mapped)</span>
          </div>

          <button
            onClick={() => {
              if (functions[0]) {
                const sampleMips = instructions.slice(0, 16).map((i) => `${formatHex32(i.address)}: ${i.asm}`).join('\n');
                onDecompileAi(sampleMips, functions[0].name);
              }
            }}
            disabled={isAiDecompiling}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white rounded font-medium shadow transition cursor-pointer"
          >
            {isAiDecompiling ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span>Decompiling via Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>AI Decompile Entry Subroutine</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Terminal Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 bg-slate-900 border-t border-slate-800">
        <span className="text-cyan-400 font-bold select-none text-sm">C:\N64Decomp&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type command (e.g., 'n64decomp analyze', 'help', 'load sample_hello_n64')..."
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none font-mono text-sm"
          autoFocus
        />
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded shadow transition cursor-pointer"
        >
          <span>Run</span>
          <CornerDownLeft size={13} />
        </button>
      </form>
    </div>
  );
};
