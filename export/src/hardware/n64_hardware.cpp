#include "hardware/n64_hardware.hpp"

namespace N64Hardware {

u8 RDRAM[8 * 1024 * 1024];
CPU_Registers CPU;
ViHardwareDevice VI;

void InitializeSystem() {
    std::memset(RDRAM, 0, sizeof(RDRAM));
    std::memset(&CPU, 0, sizeof(CPU));
    CPU.PC = 0x80246000;
    CPU.GPR[29] = 0x803C0000; // Default $sp Stack Pointer
    std::cout << "[N64 Engine] Initialized RDRAM (8MB) & CPU State at entry " << std::hex << CPU.PC << std::dec << std::endl;
}

} // namespace N64Hardware
