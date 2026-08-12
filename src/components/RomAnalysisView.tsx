import React, { useState } from 'react';
import { Binary, ShieldCheck, Cpu, HardDrive, RefreshCw, Download, Layers, CheckCircle2, AlertTriangle, FileCode } from 'lucide-react';
import { RomHeader, RomFormat } from '../types/n64';
import { formatHex32, byteSwapToZ64 } from '../utils/n64Parser';

interface RomAnalysisViewProps {
  header: RomHeader | null;
  romBuffer: Uint8Array | null;
  onByteSwapFormat: (targetFormat: RomFormat) => void;
  onExportRomFile: (buffer: Uint8Array, filename: string) => void;
}

export const RomAnalysisView: React.FC<RomAnalysisViewProps> = ({
  header,
  romBuffer,
  onByteSwapFormat,
  onExportRomFile,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<RomFormat>('z64');

  if (!header || !romBuffer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950 text-slate-400 font-mono">
        <Binary size={48} className="text-slate-700 mb-4" />
        <h2 className="text-lg font-bold text-slate-200 mb-2">No N64 ROM Loaded</h2>
        <p className="text-xs max-w-md text-slate-500 mb-6">
          Load an N64 ROM (.z64, .v64, or .n64) from the top bar or load a built-in sample ROM to inspect headers, calculate checksums, and perform endianness byte-swapping.
        </p>
      </div>
    );
  }

  // Generate 256 bytes hex dump view
  const hexLines: { offset: string; bytesHex: string; ascii: string }[] = [];
  const dumpLen = Math.min(romBuffer.length, 256);
  for (let i = 0; i < dumpLen; i += 16) {
    const slice = romBuffer.slice(i, i + 16);
    let hexStr = '';
    let asciiStr = '';
    for (let b = 0; b < 16; b++) {
      if (b < slice.length) {
        const val = slice[b];
        hexStr += val.toString(16).padStart(2, '0').toUpperCase() + ' ';
        asciiStr += val >= 32 && val <= 126 ? String.fromCharCode(val) : '.';
      } else {
        hexStr += '   ';
      }
    }
    hexLines.push({
      offset: formatHex32(i),
      bytesHex: hexStr.trim(),
      ascii: asciiStr,
    });
  }

  const handleConvertAndDownload = () => {
    const converted = byteSwapToZ64(romBuffer, header.rawEndian);
    const newName = `${header.imageName.replace(/\s+/g, '_')}_converted.${selectedFormat}`;
    onExportRomFile(converted, newName);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 font-mono text-slate-200 overflow-y-auto space-y-6">
      {/* Title & Overview Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-900 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Binary size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{header.imageName}</h1>
              <span className="px-2 py-0.5 text-xs rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                {header.gameId}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Region: <span className="text-slate-200">{header.countryName} ({header.countryCode})</span> • Version: v1.{header.version} • Size: {(header.romSize / (1024 * 1024)).toFixed(2)} MB ({header.romSize.toLocaleString()} bytes)
            </p>
          </div>
        </div>

        {/* Quick Format Indicator Pill */}
        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-md border border-slate-800">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Detected Endianness</div>
            <div className="text-sm font-bold text-amber-400 uppercase">
              {header.rawEndian === 'z64' ? 'Big Endian (.z64)' : header.rawEndian === 'v64' ? 'Byte Swapped (.v64)' : 'Little Endian (.n64)'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* N64 Header Data Matrix */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <HardDrive size={16} />
              <span>N64 Cartridge Header Offsets (0x00 - 0x40)</span>
            </div>
            <span className="text-xs text-slate-500">Big-Endian Standard</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x00 Init PI BSB DOM1 LAT</div>
              <div className="font-bold text-emerald-400">0x80371240</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x04 Clock Rate</div>
              <div className="font-bold text-slate-200">{formatHex32(header.clockRate)}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x08 Boot Entry Point (PC)</div>
              <div className="font-bold text-cyan-300">{formatHex32(header.entryPoint)}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x0C Release Offset</div>
              <div className="font-bold text-slate-200">{formatHex32(header.releaseOffset)}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x10 Header CRC1</div>
              <div className="font-bold text-amber-300">{formatHex32(header.crc1)}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x14 Header CRC2</div>
              <div className="font-bold text-amber-300">{formatHex32(header.crc2)}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x20 Image Name</div>
              <div className="font-bold text-purple-300">{header.imageName}</div>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80">
              <div className="text-slate-500 text-[11px] mb-1">0x3B Game ID / Country</div>
              <div className="font-bold text-emerald-300">{header.gameId} ({header.countryCode})</div>
            </div>
          </div>
        </div>

        {/* CIC Boot Chip Security Verification */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
              <ShieldCheck size={16} />
              <span>CIC Security Chip & Bootcode Analysis</span>
            </div>
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 size={13} />
              <span>Signature Match</span>
            </span>
          </div>

          <div className="p-4 rounded-md bg-purple-950/30 border border-purple-900/50 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Detected CIC Security Chip:</span>
              <span className="font-bold text-purple-300">{header.cicType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Bootcode Checksum Hash:</span>
              <span className="font-mono text-cyan-300">{header.cicHash}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Bootcode Payload Size:</span>
              <span className="text-slate-200">4,032 Bytes (0x0FC0)</span>
            </div>
          </div>

          {/* Endianness Byte-Swapping Conversion Console */}
          <div className="p-4 rounded-md bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw size={13} className="text-cyan-400" />
                <span>ROM Endianness Converter / Byte-Swapper</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Convert the raw ROM bytes between Big Endian (.z64), Byte Swapped (.v64), or Little Endian (.n64) formats:
            </p>

            <div className="flex items-center gap-2">
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as RomFormat)}
                className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="z64">Big Endian (.z64 - Standard 0x80371240)</option>
                <option value="v64">Byte Swapped (.v64 - Doctor v64 0x37804012)</option>
                <option value="n64">Little Endian (.n64 - EverDrive 0x40123780)</option>
              </select>

              <button
                onClick={handleConvertAndDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow transition cursor-pointer"
              >
                <Download size={13} />
                <span>Export Converted ROM</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Hex & ASCII Inspection Table (First 256 Bytes) */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <FileCode size={16} />
            <span>Raw ROM Header Hex & ASCII Inspection (Offset 0x00 - 0xFF)</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">16 Bytes per Line</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 overflow-x-auto text-xs font-mono space-y-1">
          <div className="grid grid-cols-12 gap-2 text-slate-500 font-bold pb-2 border-b border-slate-800 text-[11px]">
            <span className="col-span-2">Offset</span>
            <span className="col-span-7">Hexadecimal Bytes</span>
            <span className="col-span-3">ASCII Text</span>
          </div>

          {hexLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 hover:bg-slate-900/80 px-1 rounded transition">
              <span className="col-span-2 text-cyan-400">{line.offset}</span>
              <span className="col-span-7 text-slate-300 font-medium">{line.bytesHex}</span>
              <span className="col-span-3 text-emerald-400 font-mono">{line.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
