/**
 * ============================================================================
 * N64 SUBSYSTEM ARCHITECTURE & COMPLETE MEMORY MAP MODEL
 * ============================================================================
 * Models R4300i Memory Map Regions (KSEG0, KSEG1, KSSEG, KUSEG), Coprocessors,
 * RCP HW MMIO Registers (VI, AI, PI, SI, MI, SP, DP, PIF), RSP DMEM/IMEM, and
 * auto-classifies ROM/RAM address ranges.
 */

export interface MemoryRegionInfo {
  virtualStart: number;
  virtualEnd: number;
  physicalStart: number;
  physicalEnd: number;
  regionType: 'KSEG0_CACHED' | 'KSEG1_UNCACHED' | 'KUSEG' | 'MMIO_BUS' | 'RSP_DMEM' | 'RSP_IMEM';
  domainName: string;
  isWritable: boolean;
  isExecutable: boolean;
}

export interface HardwareRegisterDef {
  address: number;
  symbol: string;
  subsystem: 'VI' | 'AI' | 'PI' | 'SI' | 'MI' | 'SP' | 'DP' | 'PIF';
  description: string;
  accessType: 'R' | 'W' | 'RW';
}

export const N64_HW_REGISTERS: Record<number, HardwareRegisterDef> = {
  // VI Display Interface
  0x04400000: { address: 0x04400000, symbol: 'RCP_VI_STATUS_REG', subsystem: 'VI', description: 'VI Control Status Register', accessType: 'RW' },
  0x04400004: { address: 0x04400004, symbol: 'RCP_VI_DRAM_ADDR_REG', subsystem: 'VI', description: 'VI Framebuffer DRAM Address', accessType: 'RW' },
  0x04400008: { address: 0x04400008, symbol: 'RCP_VI_WIDTH_REG', subsystem: 'VI', description: 'VI Line Width in Pixels', accessType: 'RW' },
  0x0440000c: { address: 0x0440000c, symbol: 'RCP_VI_INTR_REG', subsystem: 'VI', description: 'VI Vertical Interrupt Register', accessType: 'RW' },
  0x04400010: { address: 0x04400010, symbol: 'RCP_VI_CURRENT_REG', subsystem: 'VI', description: 'VI Current Line Counter', accessType: 'RW' },
  
  // AI Audio Interface
  0x04500000: { address: 0x04500000, symbol: 'RCP_AI_DRAM_ADDR_REG', subsystem: 'AI', description: 'AI Audio Buffer DRAM Address', accessType: 'RW' },
  0x04500004: { address: 0x04500004, symbol: 'RCP_AI_LEN_REG', subsystem: 'AI', description: 'AI Buffer Length in Bytes', accessType: 'RW' },
  0x04500008: { address: 0x04500008, symbol: 'RCP_AI_CONTROL_REG', subsystem: 'AI', description: 'AI DMA Control Register', accessType: 'RW' },
  0x0450000c: { address: 0x0450000c, symbol: 'RCP_AI_STATUS_REG', subsystem: 'AI', description: 'AI Status & FIFO Busy', accessType: 'R' },
  0x04500010: { address: 0x04500010, symbol: 'RCP_AI_DACRATE_REG', subsystem: 'AI', description: 'AI DAC Frequency Bitrate Divider', accessType: 'RW' },
  0x04500014: { address: 0x04500014, symbol: 'RCP_AI_BITRATE_REG', subsystem: 'AI', description: 'AI Bitrate Bit Depth', accessType: 'RW' },

  // PI Peripheral Bus Interface
  0x04600000: { address: 0x04600000, symbol: 'RCP_PI_DRAM_ADDR_REG', subsystem: 'PI', description: 'PI DMA DRAM Target Address', accessType: 'RW' },
  0x04600004: { address: 0x04600004, symbol: 'RCP_PI_CART_ADDR_REG', subsystem: 'PI', description: 'PI DMA Cartridge ROM Target Address', accessType: 'RW' },
  0x04600008: { address: 0x04600008, symbol: 'RCP_PI_RD_LEN_REG', subsystem: 'PI', description: 'PI Cartridge Read Length', accessType: 'RW' },
  0x0460000c: { address: 0x0460000c, symbol: 'RCP_PI_WR_LEN_REG', subsystem: 'PI', description: 'PI Cartridge Write Length', accessType: 'RW' },
  0x04600010: { address: 0x04600010, symbol: 'RCP_PI_STATUS_REG', subsystem: 'PI', description: 'PI Status (DMA Busy / IO Error)', accessType: 'RW' },

  // SI Serial Controller Interface (Joybus/PIF)
  0x04800000: { address: 0x04800000, symbol: 'RCP_SI_DRAM_ADDR_REG', subsystem: 'SI', description: 'SI Joybus Transfer DRAM Address', accessType: 'RW' },
  0x04800004: { address: 0x04800004, symbol: 'RCP_SI_PIF_ADDR_RD64B_REG', subsystem: 'SI', description: 'SI PIF RAM Read 64 Bytes', accessType: 'W' },
  0x04800010: { address: 0x04800010, symbol: 'RCP_SI_PIF_ADDR_WR64B_REG', subsystem: 'SI', description: 'SI PIF RAM Write 64 Bytes', accessType: 'W' },
  0x04800018: { address: 0x04800018, symbol: 'RCP_SI_STATUS_REG', subsystem: 'SI', description: 'SI Status (DMA Busy / Read In Progress)', accessType: 'RW' },

  // SP Signal Processor (RSP)
  0x04000000: { address: 0x04000000, symbol: 'RCP_SP_DMEM_REG', subsystem: 'SP', description: 'RSP Data Memory (4KB DMEM)', accessType: 'RW' },
  0x04001000: { address: 0x04001000, symbol: 'RCP_SP_IMEM_REG', subsystem: 'SP', description: 'RSP Instruction Memory (4KB IMEM)', accessType: 'RW' },
  0x04040000: { address: 0x04040000, symbol: 'RCP_SP_MEM_ADDR_REG', subsystem: 'SP', description: 'RSP DMA Memory Address (DMEM/IMEM)', accessType: 'RW' },
  0x04040004: { address: 0x04040004, symbol: 'RCP_SP_DRAM_ADDR_REG', subsystem: 'SP', description: 'RSP DMA Main RDRAM Address', accessType: 'RW' },
  0x04040010: { address: 0x04040010, symbol: 'RCP_SP_STATUS_REG', subsystem: 'SP', description: 'RSP Status & Execution Control', accessType: 'RW' },

  // DP Display Processor (RDP)
  0x04100000: { address: 0x04100000, symbol: 'RCP_DP_START_REG', subsystem: 'DP', description: 'RDP Display List Start Pointer', accessType: 'RW' },
  0x04100004: { address: 0x04100004, symbol: 'RCP_DP_END_REG', subsystem: 'DP', description: 'RDP Display List End Pointer', accessType: 'RW' },
  0x0410000c: { address: 0x0410000c, symbol: 'RCP_DP_STATUS_REG', subsystem: 'DP', description: 'RDP Status Register', accessType: 'RW' },

  // PIF Controller Base
  0x1fc00000: { address: 0x1fc00000, symbol: 'N64_PIF_RAM_START', subsystem: 'PIF', description: 'PIF RAM 64-byte Controller Input Buffer', accessType: 'RW' },
};

/**
 * Convert Virtual Address (0x80000000..0xA0000000) to Physical Address (0x00000000..)
 */
function virtualToPhysicalAddress(virtAddr: number): number {
  if (virtAddr >= 0x80000000 && virtAddr < 0xc0000000) {
    return virtAddr & 0x1fffffff;
  }
  return virtAddr;
}

/**
 * Classify a MIPS virtual address into its N64 subsystem domain
 */
export function classifyN64MemoryAddress(virtAddr: number): MemoryRegionInfo {
  const physAddr = virtualToPhysicalAddress(virtAddr);

  if (virtAddr >= 0x80000000 && virtAddr < 0xa0000000) {
    return {
      virtualStart: virtAddr,
      virtualEnd: virtAddr + 4,
      physicalStart: physAddr,
      physicalEnd: physAddr + 4,
      regionType: 'KSEG0_CACHED',
      domainName: physAddr < 0x00800000 ? 'N64::RDRAM::Cached' : 'N64::Cartridge::ROM',
      isWritable: physAddr < 0x00800000,
      isExecutable: true,
    };
  }

  if (virtAddr >= 0xa0000000 && virtAddr < 0xc0000000) {
    return {
      virtualStart: virtAddr,
      virtualEnd: virtAddr + 4,
      physicalStart: physAddr,
      physicalEnd: physAddr + 4,
      regionType: 'KSEG1_UNCACHED',
      domainName: physAddr >= 0x04000000 && physAddr < 0x05000000 ? 'N64::RCP::MMIO' : 'N64::RDRAM::Uncached',
      isWritable: true,
      isExecutable: false,
    };
  }

  if (physAddr >= 0x04000000 && physAddr < 0x04001000) {
    return {
      virtualStart: virtAddr,
      virtualEnd: virtAddr + 4,
      physicalStart: physAddr,
      physicalEnd: physAddr + 4,
      regionType: 'RSP_DMEM',
      domainName: 'N64::RSP::DMEM',
      isWritable: true,
      isExecutable: false,
    };
  }

  if (physAddr >= 0x04001000 && physAddr < 0x04002000) {
    return {
      virtualStart: virtAddr,
      virtualEnd: virtAddr + 4,
      physicalStart: physAddr,
      physicalEnd: physAddr + 4,
      regionType: 'RSP_IMEM',
      domainName: 'N64::RSP::IMEM',
      isWritable: true,
      isExecutable: true,
    };
  }

  return {
    virtualStart: virtAddr,
    virtualEnd: virtAddr + 4,
    physicalStart: physAddr,
    physicalEnd: physAddr + 4,
    regionType: 'MMIO_BUS',
    domainName: 'N64::System::MMIO',
    isWritable: true,
    isExecutable: false,
  };
}
