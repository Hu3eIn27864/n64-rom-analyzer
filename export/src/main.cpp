#include <iostream>
#include "hardware/n64_hardware.hpp"
#include "engine/recompiled_code.hpp"

int main(int argc, char* argv[]) {
    std::cout << "=========================================================" << std::endl;
    std::cout << " N64 High-Level C++ Reconstructed Project" << std::endl;
    std::cout << " Title: SUPER MARIO 64 [ID: NSME]" << std::endl;
    std::cout << " CRC: 0x635a2bff | Country: North America / NTSC" << std::endl;
    std::cout << "=========================================================" << std::endl << std::endl;

    // Initialize Virtual Hardware Memory Map & Registers
    N64Hardware::InitializeSystem();

    // Execute Recompiled High-Level C++ Game Logic
    recompiled_main();

    std::cout << std::endl << "[SUCCESS] Application finished execution cleanly." << std::endl;
    return 0;
}
