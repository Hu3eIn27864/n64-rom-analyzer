/**
 * Self-contained C helpers used by structured VR4300 FPU lowering.
 *
 * The caller supplies Status.FR, the user-mode reverse-endian state, COP1
 * usability, whether the executing context is kernel or 64-bit mode (for
 * DMFC1/DMTC1), and whether the current GPR addressing mode is 64-bit (for
 * MFC1 sign extension). LDC1/SDC1 and double-precision comparisons do not
 * inherit the DMFC1/DMTC1 privilege restriction.
 * Memory pointers must already be mapped to target big-endian bytes. Reverse
 * endian lane selection is enabled only when Status.RE applies in user mode.
 * Helpers record architectural exception codes in the state and return false;
 * generated code returns immediately so later operations do not execute.
 */
export const VR4300_FPU_C_RUNTIME = `#include <stdbool.h>
#include <math.h>
#include <stdint.h>
#include <string.h>

typedef struct vr4300_fpu_state {
    uint32_t words[32];
    uint64_t wide[32];
    uint32_t fcsr;
    uint32_t status;
    bool mode64_or_kernel;
    bool gpr64_mode;
    bool cop1_usable;
    bool reverse_endian_enabled;
    bool exception_pending;
    uint32_t exception_code;
} vr4300_fpu_state;

static inline uint32_t vr4300_fpu_read_be32(uintptr_t address)
{
    const uint8_t *bytes = (const uint8_t *)address;
    return ((uint32_t)bytes[0] << 24) | ((uint32_t)bytes[1] << 16) |
        ((uint32_t)bytes[2] << 8) | (uint32_t)bytes[3];
}

static inline uint64_t vr4300_fpu_read_be64(uintptr_t address)
{
    const uint8_t *bytes = (const uint8_t *)address;
    uint64_t value = 0;
    for (unsigned i = 0; i < 8; ++i) value = (value << 8) | bytes[i];
    return value;
}

static inline void vr4300_fpu_write_be32(uintptr_t address, uint32_t value)
{
    uint8_t *bytes = (uint8_t *)address;
    bytes[0] = (uint8_t)(value >> 24);
    bytes[1] = (uint8_t)(value >> 16);
    bytes[2] = (uint8_t)(value >> 8);
    bytes[3] = (uint8_t)value;
}

static inline void vr4300_fpu_write_be64(uintptr_t address, uint64_t value)
{
    uint8_t *bytes = (uint8_t *)address;
    for (unsigned i = 0; i < 8; ++i) bytes[i] = (uint8_t)(value >> (56 - 8 * i));
}

static inline bool vr4300_fpu_memory_alignment(vr4300_fpu_state *fpu, uintptr_t address, unsigned alignment, bool store)
{
    if ((address & (alignment - 1u)) == 0) return true;
    fpu->exception_pending = true;
    fpu->exception_code = store ? 5u : 4u; /* Address Error Store / Load */
    return false;
}

static inline bool vr4300_fpu_check_cop1(vr4300_fpu_state *fpu)
{
    if (!fpu->cop1_usable) {
        fpu->exception_pending = true;
        fpu->exception_code = 11u; /* Coprocessor Unusable */
        return false;
    }
    return true;
}

static inline uint32_t vr4300_fpu_read_s(vr4300_fpu_state *fpu, unsigned reg)
{
    if (!vr4300_fpu_check_cop1(fpu)) return 0;
    return (fpu->status & (1u << 26))
        ? (uint32_t)fpu->wide[reg]
        : fpu->words[reg];
}

static inline bool vr4300_fpu_write_s(vr4300_fpu_state *fpu, unsigned reg, uint32_t bits)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (fpu->status & (1u << 26)) {
        fpu->wide[reg] = (fpu->wide[reg] & UINT64_C(0xffffffff00000000)) | bits;
    } else {
        fpu->words[reg] = bits;
    }
    return true;
}

static inline bool vr4300_fpu_check_d_register(vr4300_fpu_state *fpu, unsigned reg)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (reg >= 32 || (!(fpu->status & (1u << 26)) && ((reg & 1u) != 0))) {
        fpu->exception_pending = true;
        fpu->exception_code = UINT32_MAX; /* FR=0 odd-register use is unpredictable */
        return false;
    }
    return true;
}

static inline bool vr4300_fpu_check_d(vr4300_fpu_state *fpu, unsigned reg)
{
    if (!vr4300_fpu_check_d_register(fpu, reg)) return false;
    if (!fpu->mode64_or_kernel) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u; /* Reserved Instruction */
        return false;
    }
    return true;
}

static inline bool vr4300_fpu_read_d_register(vr4300_fpu_state *fpu, unsigned reg, uint64_t *bits)
{
    if (!vr4300_fpu_check_d_register(fpu, reg)) return false;
    if (fpu->status & (1u << 26)) *bits = fpu->wide[reg];
    else *bits = ((uint64_t)fpu->words[reg + 1] << 32) | fpu->words[reg];
    return true;
}

static inline bool vr4300_fpu_write_d_register(vr4300_fpu_state *fpu, unsigned reg, uint64_t bits)
{
    if (!vr4300_fpu_check_d_register(fpu, reg)) return false;
    if (fpu->status & (1u << 26)) fpu->wide[reg] = bits;
    else {
        fpu->words[reg] = (uint32_t)bits;
        fpu->words[reg + 1] = (uint32_t)(bits >> 32);
    }
    return true;
}

static inline bool vr4300_fpu_read_d(vr4300_fpu_state *fpu, unsigned reg, uint64_t *bits)
{
    if (!vr4300_fpu_check_d(fpu, reg)) return false;
    return vr4300_fpu_read_d_register(fpu, reg, bits);
}

static inline bool vr4300_fpu_write_d(vr4300_fpu_state *fpu, unsigned reg, uint64_t bits)
{
    if (!vr4300_fpu_check_d(fpu, reg)) return false;
    return vr4300_fpu_write_d_register(fpu, reg, bits);
}
static inline bool vr4300_fpu_load_s(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (fpu->reverse_endian_enabled) address ^= 4u;
    if (!vr4300_fpu_memory_alignment(fpu, address, 4, false)) return false;
    return vr4300_fpu_write_s(fpu, reg, vr4300_fpu_read_be32(address));
}

static inline bool vr4300_fpu_load_d(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    if (!vr4300_fpu_check_d_register(fpu, reg)) return false;
    if (!vr4300_fpu_memory_alignment(fpu, address, 8, false)) return false;
    return vr4300_fpu_write_d_register(fpu, reg, vr4300_fpu_read_be64(address));
}

static inline bool vr4300_fpu_store_s(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (fpu->reverse_endian_enabled) address ^= 4u;
    if (!vr4300_fpu_memory_alignment(fpu, address, 4, true)) return false;
    vr4300_fpu_write_be32(address, vr4300_fpu_read_s(fpu, reg));
    return true;
}

static inline bool vr4300_fpu_store_d(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    uint64_t bits;
    if (!vr4300_fpu_read_d_register(fpu, reg, &bits)) return false;
    if (!vr4300_fpu_memory_alignment(fpu, address, 8, true)) return false;
    vr4300_fpu_write_be64(address, bits);
    return true;
}

static inline bool vr4300_fpu_commit_compare(
    vr4300_fpu_state *fpu, unsigned cc, unsigned predicate,
    bool unordered, bool equal, bool less)
{
    const uint32_t cause_mask = UINT32_C(0x3f) << 12;
    const uint32_t cc_mask = UINT32_C(1) << (cc == 0 ? 23 : 24 + cc);
    const bool invalid = unordered && ((predicate & 8u) != 0);
    unsigned relation = unordered ? 1u : equal ? 2u : less ? 4u : 0u;
    bool condition = (predicate & relation) != 0;

    fpu->fcsr &= ~cause_mask;
    if (invalid) {
        fpu->fcsr |= UINT32_C(1) << 16;
        fpu->fcsr |= UINT32_C(1) << 6;
        if (fpu->fcsr & (UINT32_C(1) << 11)) {
            fpu->exception_pending = true;
            fpu->exception_code = 15u; /* Floating Point */
            return false;
        }
    }
    if (condition) fpu->fcsr |= cc_mask;
    else fpu->fcsr &= ~cc_mask;
    return true;
}

static inline bool vr4300_fpu_compare_s(
    vr4300_fpu_state *fpu, unsigned cc, unsigned predicate, unsigned left_reg, unsigned right_reg)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t left_bits = vr4300_fpu_read_s(fpu, left_reg);
    uint32_t right_bits = vr4300_fpu_read_s(fpu, right_reg);
    float left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    bool unordered = isnan(left) || isnan(right);
    return vr4300_fpu_commit_compare(
        fpu, cc, predicate, unordered, !unordered && left == right, !unordered && left < right);
}

static inline bool vr4300_fpu_compare_d(
    vr4300_fpu_state *fpu, unsigned cc, unsigned predicate, unsigned left_reg, unsigned right_reg)
{
    uint64_t left_bits, right_bits;
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (!vr4300_fpu_read_compare_d(fpu, left_reg, &left_bits) ||
        !vr4300_fpu_read_compare_d(fpu, right_reg, &right_bits)) return false;
    double left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    bool unordered = isnan(left) || isnan(right);
    return vr4300_fpu_commit_compare(
        fpu, cc, predicate, unordered, !unordered && left == right, !unordered && left < right);
}

static inline bool vr4300_fpu_write_fcsr(vr4300_fpu_state *fpu, uint32_t value)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    fpu->fcsr = value;
    return true;
}
`;
