#ifndef N64_HARDWARE_HPP
#define N64_HARDWARE_HPP

#include "types.h"
#include <iostream>
#include <vector>
#include <cstring>

namespace N64Hardware {

// RDRAM 8MB Address Space
extern u8 RDRAM[8 * 1024 * 1024];

// MIPS R4300i Registers
struct CPU_Registers {
    u32 GPR[32];
    u32 PC;
    u32 HI;
    u32 LO;
    u32 CP0[32];
};

extern CPU_Registers CPU;

// Vector Physics Math Structure
struct Vector3f {
    float x = 0.0f, y = 0.0f, z = 0.0f;
    Vector3f operator+(const Vector3f& v) const { return {x + v.x, y + v.y, z + v.z}; }
    Vector3f& operator+=(const Vector3f& v) { x += v.x; y += v.y; z += v.z; return *this; }
    Vector3f operator*(float s) const { return {x * s, y * s, z * s}; }
    float dot(const Vector3f& v) const { return x * v.x + y * v.y + z * v.z; }
    Vector3f cross(const Vector3f& v) const { return {y * v.z - z * v.y, z * v.x - x * v.z, x * v.y - y * v.x}; }
};

// Typed MMIO Bitfield Hardware Structures
enum class ViColorDepth : u8 { BPP16_RGBA5551 = 2, BPP32_RGBA8888 = 3 };
enum class ViResampleMode : u8 { NONE = 0, BILINEAR = 1, POINT = 2 };

struct ViStatusRegister {
    ViColorDepth colorDepth = ViColorDepth::BPP16_RGBA5551;
    bool gammaDitherEnable = true;
    ViResampleMode horizontalResample = ViResampleMode::BILINEAR;
    bool serrateEnable = false;
};

struct ViHardwareDevice {
    ViStatusRegister STATUS;
    u32 DRAM_ADDR = 0x00000000;
    u32 WIDTH = 320;
    void SetDisplayMode(u32 mode, ViColorDepth bpp) {
        STATUS.colorDepth = bpp;
        std::cout << "[N64 HW] VI Display Mode Configured: 320x240 @ " << (bpp == ViColorDepth::BPP16_RGBA5551 ? "16bpp" : "32bpp") << std::endl;
    }
};

extern ViHardwareDevice VI;

// Hardware Memory Map Constants
constexpr u32 VI_BASE          = 0x04400000;
constexpr u32 VI_STATUS_REG    = 0x04400000;
constexpr u32 VI_DRAM_ADDR_REG = 0x04400004;
constexpr u32 VI_WIDTH_REG     = 0x04400008;
constexpr u32 VI_V_INTR_REG    = 0x0440000C;

constexpr u32 SP_BASE          = 0x04000000;
constexpr u32 SP_MEM_ADDR_REG  = 0x04000000;
constexpr u32 SP_DRAM_ADDR_REG = 0x04000004;
constexpr u32 SP_RD_LEN_REG    = 0x04000008;
constexpr u32 SP_STATUS_REG    = 0x04000010;

constexpr u32 AI_BASE          = 0x04500000;
constexpr u32 PI_BASE          = 0x04600000;

// Hardware IO Interceptors
inline u32 Read32(u32 physAddr) {
    if (physAddr < 0x00800000) {
        u32 val;
        std::memcpy(&val, &RDRAM[physAddr], sizeof(u32));
        return val;
    }
    if (physAddr == VI_STATUS_REG) return 0x0000320E;
    return 0;
}

inline void Write32(u32 physAddr, u32 value) {
    if (physAddr < 0x00800000) {
        std::memcpy(&RDRAM[physAddr], &value, sizeof(u32));
        return;
    }
    if (physAddr == VI_STATUS_REG) {
        std::cout << "[N64 HW] VI_STATUS_REG write: 0x" << std::hex << value << std::dec << std::endl;
    } else if (physAddr == VI_DRAM_ADDR_REG) {
        std::cout << "[N64 HW] Frame Buffer Address set to: 0x" << std::hex << value << std::dec << std::endl;
    }
}

void InitializeSystem();

} // namespace N64Hardware

#endif // N64_HARDWARE_HPP
