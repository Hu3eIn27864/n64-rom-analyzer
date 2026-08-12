import React from 'react';
import { Terminal, Cpu, FileCode2, Binary, MonitorPlay, Download, RefreshCw, Upload, Code2, Trash2, Disc, ShieldCheck, Zap } from 'lucide-react';
import { RomHeader } from '../types/n64';

interface HeaderBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  header: RomHeader | null;
  romLoaded: boolean;
  onUploadClick: () => void;
  onLoadSampleClick: () => void;
  onResetWorkspace: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  setActiveTab,
  header,
  romLoaded,
  onUploadClick,
  onLoadSampleClick,
  onResetWorkspace,
}) => {
  const tabs = [
    { id: 'cli', label: 'CLI Console', icon: Terminal },
    { id: 'rom', label: 'ROM Header & Byteswap', icon: Binary },
    { id: 'disasm', label: 'MIPS Disassembler', icon: Cpu },
    { id: 'mips_c', label: 'MIPS to C Lifter', icon: Code2 },
    { id: 'compiler', label: 'C-to-MIPS Compiler', icon: Zap },
    { id: 'cpp', label: 'C++ Recompiler Studio', icon: FileCode2 },
    { id: 'verify', label: 'Byte Match Verifier', icon: ShieldCheck },
    { id: 'virtual', label: 'Virtual Execution', icon: MonitorPlay },
    { id: 'export', label: 'Rebuild N64 ROM / Export', icon: Disc },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-200 select-none">
      {/* Top Windows CMD Title Bar */}
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between px-3 py-1.5 bg-slate-950 text-xs border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2 font-mono min-w-0">
          <div className="w-3 h-3 rounded-full bg-cyan-500/30 border border-cyan-400/60 flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          </div>
          <span className="text-slate-300 font-semibold tracking-wider truncate text-[11px] sm:text-xs">
            N64DecompEXE.exe — Command Line [v10.0.19045]
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          {romLoaded && header && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[11px] font-mono">
              <span className="text-emerald-400 font-bold max-w-[100px] truncate">{header.imageName}</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-300 font-semibold">.{header.rawEndian}</span>
            </div>
          )}

          {romLoaded && (
            <>
              <button
                onClick={() => setActiveTab('export')}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 text-[11px] font-semibold transition cursor-pointer shadow-sm shadow-amber-950 touch-manipulation"
                title="Rebuild and download N64 cartridge ROM (.z64 / .n64 / .v64)"
              >
                <Disc size={13} className="text-amber-400 shrink-0" />
                <span className="hidden xs:inline">Rebuild ROM</span>
              </button>

              <button
                onClick={onResetWorkspace}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] transition cursor-pointer touch-manipulation"
                title="Clean decompiled cache and unload current ROM workspace"
              >
                <Trash2 size={13} className="text-rose-400 shrink-0" />
                <span className="hidden sm:inline">Clean</span>
              </button>
            </>
          )}

          <button
            onClick={onLoadSampleClick}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] transition cursor-pointer touch-manipulation"
            title="Load built-in N64 sample ROMs"
          >
            <RefreshCw size={13} className="text-cyan-400 shrink-0" />
            <span className="hidden xs:inline">Samples</span>
          </button>

          <button
            onClick={onUploadClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-[11px] transition shadow-sm shadow-cyan-900/30 cursor-pointer touch-manipulation shrink-0"
            title="Upload custom .z64, .v64, or .n64 file"
          >
            <Upload size={13} className="shrink-0" />
            <span>Open ROM</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex items-center px-2 pt-1 gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 touch-pan-x whitespace-nowrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-t border-t border-x transition-all cursor-pointer shrink-0 touch-manipulation ${
                isActive
                  ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 border-b-transparent -mb-px z-10 shadow-md'
                  : 'bg-slate-950/60 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-cyan-400' : 'text-slate-500'} />
              <span>{tab.label}</span>
              {tab.id === 'cpp' && romLoaded && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
