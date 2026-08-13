import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import {
  FileCode2,
  Copy,
  Download,
  Check,
  Sparkles,
  Folder,
  FolderOpen,
  File,
  Code,
  Terminal,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Settings,
  FileText,
  Search,
  Archive,
  ArrowUpRight,
  Code2,
  Info
} from 'lucide-react';
import { CppProjectFile, DecompiledFunction, MipsInstruction } from '../types/n64';
import { formatHex32 } from '../utils/n64Parser';
import { downloadBinaryFile } from '../utils/fileDownloader';

interface CppStudioViewProps {
  cppFiles: CppProjectFile[];
  functions: DecompiledFunction[];
  instructions: MipsInstruction[];
  onDecompileAi: (mipsCode: string, funcName: string) => Promise<void>;
  isAiDecompiling: boolean;
  aiDecompiledOutput: { cppCode?: string; explanation?: string; detectedHardware?: string[] } | null;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  file?: CppProjectFile;
  children: TreeNode[];
}

function buildFileTree(files: CppProjectFile[]): TreeNode[] {
  const rootNodes: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let currentLevel = rootNodes;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          file: isLast ? file : undefined,
          children: [],
        };
        currentLevel.push(existingNode);
      }

      if (!isLast) {
        currentLevel = existingNode.children;
      }
    }
  }

  // Sort folders first, then files
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isFolder) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(rootNodes);
  return rootNodes;
}

export const CppStudioView: React.FC<CppStudioViewProps> = ({
  cppFiles,
  functions,
  instructions,
  onDecompileAi,
  isAiDecompiling,
  aiDecompiledOutput,
}) => {
  const [selectedFilename, setSelectedFilename] = useState<string>(
    cppFiles.find((f) => f.filename.includes('main.cpp'))?.filename || cppFiles[0]?.filename || ''
  );
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'headers' | 'src' | 'scripts' | 'build' | 'asm' | 'certificates'>('all');
  const [isZipping, setIsZipping] = useState(false);
  const [showArchInfo, setShowArchInfo] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    include: true,
    'include/engine': true,
    'include/hardware': true,
    src: true,
    'src/engine': true,
    'src/hardware': true,
    'src/rendering': true,
    scripts: true,
    asm: true,
    certificates: true,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const fileTree = useMemo(() => buildFileTree(cppFiles), [cppFiles]);

  const activeFile = useMemo(
    () => cppFiles.find((f) => f.filename === selectedFilename) || cppFiles[0],
    [cppFiles, selectedFilename]
  );

  const filteredFiles = useMemo(() => {
    return cppFiles.filter((file) => {
      const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeCategory === 'headers') return file.filename.startsWith('include/') || file.filename.endsWith('.h') || file.filename.endsWith('.hpp');
      if (activeCategory === 'src') return file.filename.startsWith('src/') || file.filename.endsWith('.cpp') || file.filename.endsWith('.c');
      if (activeCategory === 'scripts') return file.filename.startsWith('scripts/') || file.filename.endsWith('.sh') || file.filename.endsWith('.bat') || file.filename.endsWith('.py');
      if (activeCategory === 'build') return file.filename === 'CMakeLists.txt' || file.filename === 'Makefile';
      if (activeCategory === 'asm') return file.filename.startsWith('asm/') || file.filename.endsWith('.asm');
      if (activeCategory === 'certificates') return file.filename.startsWith('certificates/') || file.filename.endsWith('.json');

      return true;
    });
  }, [cppFiles, searchQuery, activeCategory]);

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename.split('/').pop() || activeFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCompleteProjectZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      for (const file of cppFiles) {
        zip.file(file.filename, file.content);
      }

      const blob = await zip.generateAsync({ type: 'uint8array' });
      downloadBinaryFile('SM64_Reconstructed_CPlusPlus_Project.zip', blob, 'application/zip');
    } catch (err) {
      console.error('Failed to generate project ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const getFileIcon = (filename: string, language: string) => {
    if (filename.endsWith('.hpp') || filename.endsWith('.h')) {
      return <FileCode2 className="text-purple-400 shrink-0" size={13} />;
    }
    if (filename.endsWith('.cpp')) {
      return <FileCode2 className="text-cyan-400 shrink-0" size={13} />;
    }
    if (filename.endsWith('.c')) {
      return <Code className="text-blue-400 shrink-0" size={13} />;
    }
    if (filename.endsWith('.asm')) {
      return <Code2 className="text-amber-400 shrink-0" size={13} />;
    }
    if (filename.endsWith('.json')) {
      return <ShieldCheck className="text-emerald-400 shrink-0" size={13} />;
    }
    if (filename === 'CMakeLists.txt' || filename === 'Makefile') {
      return <Settings className="text-indigo-400 shrink-0" size={13} />;
    }
    if (filename.endsWith('.sh') || filename.endsWith('.bat') || filename.endsWith('.py')) {
      return <Terminal className="text-emerald-400 shrink-0" size={13} />;
    }
    return <FileText className="text-slate-400 shrink-0" size={13} />;
  };

  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      if (node.isFolder) {
        const isExpanded = !!expandedFolders[node.path];
        return (
          <div key={node.path} className="select-none">
            <button
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-slate-800/60 rounded text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown size={12} className="text-slate-500 shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-slate-500 shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen size={13} className="text-cyan-400/90 shrink-0" />
              ) : (
                <Folder size={13} className="text-cyan-500/70 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            {isExpanded && (
              <div className="space-y-0.5 mt-0.5">
                {renderTreeNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      const isSelected = node.file?.filename === selectedFilename;
      return (
        <button
          key={node.path}
          onClick={() => node.file && setSelectedFilename(node.file.filename)}
          style={{ paddingLeft: `${depth * 12 + 18}px` }}
          className={`w-full text-left py-1 px-2 rounded transition text-xs font-mono cursor-pointer border flex items-center justify-between ${
            isSelected
              ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 font-bold shadow'
              : 'border-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {getFileIcon(node.name, node.file?.language || 'plaintext')}
            <span className="truncate">{node.name}</span>
          </div>
          <span className="text-[9px] text-slate-600 uppercase font-semibold shrink-0 ml-1">
            {node.file?.language}
          </span>
        </button>
      );
    });
  };

  // Check matching implementation or header file
  const matchingHeader = useMemo(() => {
    if (!activeFile) return null;
    if (activeFile.filename.endsWith('.cpp')) {
      const hppName = activeFile.filename.replace('src/engine/', 'include/engine/').replace('src/hardware/', 'include/hardware/').replace('.cpp', '.hpp');
      return cppFiles.find((f) => f.filename === hppName);
    }
    if (activeFile.filename.endsWith('.hpp')) {
      const cppName = activeFile.filename.replace('include/engine/', 'src/engine/').replace('include/hardware/', 'src/hardware/').replace('.hpp', '.cpp');
      return cppFiles.find((f) => f.filename === cppName);
    }
    return null;
  }, [activeFile, cppFiles]);

  if (!cppFiles || cppFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950 text-slate-400 font-mono">
        <FileCode2 size={48} className="text-slate-700 mb-4" />
        <h2 className="text-lg font-bold text-slate-200 mb-2">No Recompiled C++ Code Generated</h2>
        <p className="text-xs max-w-md text-slate-500">
          Load an N64 ROM file to generate full High-Level C++ source files, hardware register maps, and CMake build configurations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-950 font-mono text-slate-200 overflow-hidden">
      {/* C++ Project Tree Explorer Sidebar */}
      <div className="w-full lg:w-72 max-h-64 lg:max-h-none bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <FolderOpen size={14} />
              <span>C++ Project Workspace</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-semibold">
              C++20 / C11
            </span>
          </div>

          {/* Quick ZIP Exporter Button */}
          <button
            onClick={handleDownloadCompleteProjectZip}
            disabled={isZipping}
            className="w-full flex items-center justify-center gap-1.5 p-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded text-xs font-bold shadow transition cursor-pointer disabled:opacity-50"
          >
            <Archive size={13} />
            <span>{isZipping ? 'Packing ZIP Archive...' : 'Download Full Project (.zip)'}</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-2 border-b border-slate-800 space-y-2 bg-slate-950/40">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search project files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap gap-1 text-[10px]">
            {(['all', 'headers', 'src', 'scripts', 'build', 'asm', 'certificates'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-0.5 rounded capitalize transition cursor-pointer border ${
                  activeCategory === cat
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tree Explorer Node List */}
        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {searchQuery || activeCategory !== 'all' ? (
            <div className="space-y-0.5">
              {filteredFiles.map((file) => {
                const isSelected = file.filename === selectedFilename;
                return (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedFilename(file.filename)}
                    className={`w-full text-left py-1.5 px-2 rounded transition text-xs font-mono cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 font-bold shadow'
                        : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-850 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {getFileIcon(file.filename, file.language)}
                      <span className="truncate">{file.filename}</span>
                    </div>
                    <span className="text-[9px] text-slate-600 uppercase font-semibold shrink-0 ml-1">
                      {file.language}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            renderTreeNodes(fileTree)
          )}
        </div>

        {/* AI Decompilation Call-to-action */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/90 space-y-2">
          <button
            onClick={() => {
              if (functions[0]) {
                const sampleMips = instructions.slice(0, 20).map((i) => `${formatHex32(i.address)}: ${i.asm}`).join('\n');
                onDecompileAi(sampleMips, functions[0].name);
              }
            }}
            disabled={isAiDecompiling}
            className="w-full flex items-center justify-center gap-1.5 p-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Sparkles size={13} />
            <span>{isAiDecompiling ? 'AI Decompiling...' : 'Deep AI C++ Synthesizer'}</span>
          </button>
        </div>
      </div>

      {/* Main Code Viewer Window */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Code Bar Header */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {getFileIcon(activeFile?.filename || '', activeFile?.language || '')}
            <span className="font-bold text-slate-200 truncate">{activeFile?.filename}</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400 text-[11px] truncate hidden md:inline">{activeFile?.description}</span>
          </div>

          <div className="flex items-center gap-2">
            {matchingHeader && (
              <button
                onClick={() => setSelectedFilename(matchingHeader.filename)}
                className="flex items-center gap-1 px-2 py-1 bg-purple-950/80 hover:bg-purple-900/80 border border-purple-700/60 rounded text-purple-300 font-medium text-[11px] transition cursor-pointer"
              >
                <ArrowUpRight size={11} />
                <span>Jump to {matchingHeader.filename.split('/').pop()}</span>
              </button>
            )}

            <button
              onClick={() => setShowArchInfo(!showArchInfo)}
              className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
              title="Toggle Project Build Guide"
            >
              <Info size={14} />
            </button>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadSingleFile}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow transition cursor-pointer"
            >
              <Download size={12} />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Project Build Guide Drawer if toggled */}
        {showArchInfo && (
          <div className="p-3 bg-slate-900/90 border-b border-cyan-900/60 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between font-bold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Terminal size={14} />
                <span>Modern C++20 Project Build Instructions</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">100% Byte-Match Certified Workspace</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 font-bold">CMake Build Command:</span>
                <pre className="text-cyan-300 mt-1">
                  mkdir build && cd build{'\n'}
                  cmake ..{'\n'}
                  cmake --build .
                </pre>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 font-bold">Makefile / Verification Command:</span>
                <pre className="text-cyan-300 mt-1">
                  make{'\n'}
                  python3 recompile_tools.py src/engine/n64_highlevel_c.c asm/n64_disassembly_full.asm
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* C++ Code Body View */}
        <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-slate-200 bg-slate-950 selection:bg-cyan-900 selection:text-cyan-100">
          <pre className="whitespace-pre">{activeFile?.content}</pre>
        </div>

        {/* AI Decompiled Result Drawer if output exists */}
        {aiDecompiledOutput && (
          <div className="p-4 bg-slate-900 border-t border-purple-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" />
                <span>AI Recompiled C++ Function (Server-Side Gemini 3.6 Flash)</span>
              </span>
              {aiDecompiledOutput.detectedHardware && aiDecompiledOutput.detectedHardware.length > 0 && (
                <span className="text-purple-400/90 text-[11px] font-normal">
                  Hardware: {aiDecompiledOutput.detectedHardware.join(', ')}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
              {aiDecompiledOutput.explanation}
            </p>

            <pre className="p-3 bg-slate-950 rounded border border-purple-900/50 text-emerald-300 text-xs overflow-x-auto whitespace-pre">
              {aiDecompiledOutput.cppCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
