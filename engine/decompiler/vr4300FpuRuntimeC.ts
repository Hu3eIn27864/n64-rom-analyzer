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
#include <fenv.h>
#include <math.h>
#include <stdint.h>
#include <string.h>

#pragma STDC FENV_ACCESS ON

typedef struct vr4300_fpu_state {
    uint32_t words[32];
    uint64_t wide[32];
    uint64_t hi;
    uint64_t lo;
    uint32_t fcsr;
    uint32_t fir; /* FCR0: implementation-defined FPU identification value */
    uint32_t status;
    bool mode64_or_kernel;
    bool gpr64_mode;
    bool cop1_usable;
    bool reverse_endian_enabled;
    bool exception_pending;
    uint32_t exception_code;
} vr4300_fpu_state;

static inline uint64_t vr4300_hilo_read_hi(const vr4300_fpu_state *fpu)
{
    return fpu->hi;
}

static inline uint64_t vr4300_hilo_read_lo(const vr4300_fpu_state *fpu)
{
    return fpu->lo;
}

static inline void vr4300_hilo_write_hi(vr4300_fpu_state *fpu, uint64_t value)
{
    fpu->hi = value;
}

static inline void vr4300_hilo_write_lo(vr4300_fpu_state *fpu, uint64_t value)
{
    fpu->lo = value;
}

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

/* Integer memory accesses use target big-endian byte order. RE reverses
 * byte/halfword/word lanes within their containing 64-bit doubleword; an
 * eight-byte access keeps its address lane. */
static inline uintptr_t vr4300_memory_adjust_address(vr4300_fpu_state *fpu, uintptr_t address, unsigned size)
{
    if (!fpu->reverse_endian_enabled) return address;
    if (size == 2u) return address ^ 2u;
    if (size == 4u) return address ^ 4u;
    return address;
}

static inline bool vr4300_memory_load(vr4300_fpu_state *fpu, uintptr_t address, unsigned size, bool is_signed, uint64_t *result)
{
    address = vr4300_memory_adjust_address(fpu, address, size);
    if (size > 1u && !vr4300_fpu_memory_alignment(fpu, address, size, false)) return false;

    const uint8_t *bytes = (const uint8_t *)address;
    uint64_t value;
    switch (size) {
    case 1u:
        value = bytes[0];
        if (is_signed) value = (uint64_t)(int64_t)(int8_t)value;
        break;
    case 2u:
        value = ((uint16_t)bytes[0] << 8) | bytes[1];
        if (is_signed) value = (uint64_t)(int64_t)(int16_t)value;
        break;
    case 4u:
        value = vr4300_fpu_read_be32(address);
        if (is_signed) value = (uint64_t)(int64_t)(int32_t)value;
        break;
    case 8u:
        value = vr4300_fpu_read_be64(address);
        break;
    default:
        return false;
    }
    *result = value;
    return true;
}

static inline bool vr4300_memory_store(vr4300_fpu_state *fpu, uintptr_t address, unsigned size, uint64_t value)
{
    address = vr4300_memory_adjust_address(fpu, address, size);
    if (size > 1u && !vr4300_fpu_memory_alignment(fpu, address, size, true)) return false;

    uint8_t *bytes = (uint8_t *)address;
    switch (size) {
    case 1u:
        bytes[0] = (uint8_t)value;
        return true;
    case 2u:
        bytes[0] = (uint8_t)(value >> 8);
        bytes[1] = (uint8_t)value;
        return true;
    case 4u:
        vr4300_fpu_write_be32(address, (uint32_t)value);
        return true;
    case 8u:
        vr4300_fpu_write_be64(address, value);
        return true;
    default:
        return false;
    }
}

static inline bool vr4300_signed_overflow(vr4300_fpu_state *fpu)
{
    fpu->exception_pending = true;
    fpu->exception_code = 12u; /* Integer Overflow */
    return false;
}

static inline bool vr4300_signed_add32(vr4300_fpu_state *fpu, uint32_t left, uint32_t right, uint64_t *result)
{
    const uint32_t sum = left + right;
    if (((~(left ^ right) & (left ^ sum)) & UINT32_C(0x80000000)) != 0u)
        return vr4300_signed_overflow(fpu);
    *result = (sum & UINT32_C(0x80000000)) != 0u ? (UINT64_C(0xffffffff00000000) | sum) : (uint64_t)sum;
    return true;
}

static inline bool vr4300_signed_sub32(vr4300_fpu_state *fpu, uint32_t left, uint32_t right, uint64_t *result)
{
    const uint32_t difference = left - right;
    if ((((left ^ right) & (left ^ difference)) & UINT32_C(0x80000000)) != 0u)
        return vr4300_signed_overflow(fpu);
    *result = (difference & UINT32_C(0x80000000)) != 0u ? (UINT64_C(0xffffffff00000000) | difference) : (uint64_t)difference;
    return true;
}

static inline bool vr4300_signed_add64(vr4300_fpu_state *fpu, uint64_t left, uint64_t right, uint64_t *result)
{
    const uint64_t sum = left + right;
    if (((~(left ^ right) & (left ^ sum)) & (UINT64_C(1) << 63)) != 0u)
        return vr4300_signed_overflow(fpu);
    *result = sum;
    return true;
}

static inline bool vr4300_signed_sub64(vr4300_fpu_state *fpu, uint64_t left, uint64_t right, uint64_t *result)
{
    const uint64_t difference = left - right;
    if ((((left ^ right) & (left ^ difference)) & (UINT64_C(1) << 63)) != 0u)
        return vr4300_signed_overflow(fpu);
    *result = difference;
    return true;
}

static inline uint64_t vr4300_sext32(uint32_t value)
{
    return (value & UINT32_C(0x80000000)) != 0u
        ? (UINT64_C(0xffffffff00000000) | value) : (uint64_t)value;
}

static inline uint32_t vr4300_sra32(uint32_t value, unsigned shift)
{
    shift &= 31u;
    if (shift == 0u) return value;
    const uint32_t sign_fill = (value & UINT32_C(0x80000000)) != 0u
        ? (UINT32_MAX << (32u - shift)) : 0u;
    return (value >> shift) | sign_fill;
}

static inline uint64_t vr4300_sra64(uint64_t value, unsigned shift)
{
    shift &= 63u;
    if (shift == 0u) return value;
    const uint64_t sign_fill = (value & (UINT64_C(1) << 63)) != 0
        ? (UINT64_MAX << (64u - shift)) : 0u;
    return (value >> shift) | sign_fill;
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

/* The VR4300 reports QNaN and denormal operands as Unimplemented
 * Operation (E), except in compare instructions. Signaling NaNs continue
 * through the IEEE Invalid path. */
static inline bool vr4300_fpu_raise_unimplemented(vr4300_fpu_state *fpu)
{
    fpu->fcsr &= ~(UINT32_C(0x3f) << 12);
    fpu->fcsr |= UINT32_C(1) << 17;
    fpu->exception_pending = true;
    fpu->exception_code = 15u; /* Floating Point */
    return false;
}

static inline bool vr4300_fpu_check_operand_s(vr4300_fpu_state *fpu, uint32_t bits)
{
    const uint32_t exponent = bits & UINT32_C(0x7f800000);
    const uint32_t fraction = bits & UINT32_C(0x007fffff);
    const bool denormal = exponent == 0 && fraction != 0;
    const bool quiet_nan = exponent == UINT32_C(0x7f800000) &&
        fraction != 0 && (fraction & UINT32_C(0x00400000)) != 0;
    return denormal || quiet_nan ? vr4300_fpu_raise_unimplemented(fpu) : true;
}

static inline bool vr4300_fpu_check_operand_d(vr4300_fpu_state *fpu, uint64_t bits)
{
    const uint64_t exponent = bits & UINT64_C(0x7ff0000000000000);
    const uint64_t fraction = bits & UINT64_C(0x000fffffffffffff);
    const bool denormal = exponent == 0 && fraction != 0;
    const bool quiet_nan = exponent == UINT64_C(0x7ff0000000000000) &&
        fraction != 0 && (fraction & UINT64_C(0x0008000000000000)) != 0;
    return denormal || quiet_nan ? vr4300_fpu_raise_unimplemented(fpu) : true;
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

static inline bool vr4300_fpu_read_compare_d(vr4300_fpu_state *fpu, unsigned reg, uint64_t *bits)
{
    return vr4300_fpu_read_d_register(fpu, reg, bits);
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

/* Compare IEEE-754 encodings as integers. Using host floating-point
 * comparisons here can raise FE_INVALID for signaling NaNs and leak that
 * host exception into the embedding process. The sign/magnitude ordering
 * below is exact for all non-NaN values, including infinities and signed zero. */
static inline void vr4300_fpu_compare_bits32(
    uint32_t left, uint32_t right, bool *unordered, bool *equal, bool *less)
{
    const uint32_t exponent = UINT32_C(0x7f800000);
    const uint32_t fraction = UINT32_C(0x007fffff);
    const uint32_t sign = UINT32_C(0x80000000);
    const uint32_t magnitude = UINT32_C(0x7fffffff);
    *unordered = ((left & exponent) == exponent && (left & fraction) != 0) ||
        ((right & exponent) == exponent && (right & fraction) != 0);
    *equal = !*unordered && (left == right ||
        ((left & magnitude) == 0 && (right & magnitude) == 0));
    if (*unordered || *equal) { *less = false; return; }
    if ((left & sign) != (right & sign)) *less = (left & sign) != 0;
    else if (left & sign) *less = left > right;
    else *less = left < right;
}

static inline void vr4300_fpu_compare_bits64(
    uint64_t left, uint64_t right, bool *unordered, bool *equal, bool *less)
{
    const uint64_t exponent = UINT64_C(0x7ff0000000000000);
    const uint64_t fraction = UINT64_C(0x000fffffffffffff);
    const uint64_t sign = UINT64_C(0x8000000000000000);
    const uint64_t magnitude = UINT64_C(0x7fffffffffffffff);
    *unordered = ((left & exponent) == exponent && (left & fraction) != 0) ||
        ((right & exponent) == exponent && (right & fraction) != 0);
    *equal = !*unordered && (left == right ||
        ((left & magnitude) == 0 && (right & magnitude) == 0));
    if (*unordered || *equal) { *less = false; return; }
    if ((left & sign) != (right & sign)) *less = (left & sign) != 0;
    else if (left & sign) *less = left > right;
    else *less = left < right;
}

static inline bool vr4300_fpu_compare_s(
    vr4300_fpu_state *fpu, unsigned cc, unsigned predicate, unsigned left_reg, unsigned right_reg)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t left_bits = vr4300_fpu_read_s(fpu, left_reg);
    uint32_t right_bits = vr4300_fpu_read_s(fpu, right_reg);
    bool unordered, equal, less;
    vr4300_fpu_compare_bits32(left_bits, right_bits, &unordered, &equal, &less);
    return vr4300_fpu_commit_compare(fpu, cc, predicate, unordered, equal, less);
}

static inline bool vr4300_fpu_compare_d(
    vr4300_fpu_state *fpu, unsigned cc, unsigned predicate, unsigned left_reg, unsigned right_reg)
{
    uint64_t left_bits, right_bits;
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (!vr4300_fpu_read_compare_d(fpu, left_reg, &left_bits) ||
        !vr4300_fpu_read_compare_d(fpu, right_reg, &right_bits)) return false;
    bool unordered, equal, less;
    vr4300_fpu_compare_bits64(left_bits, right_bits, &unordered, &equal, &less);
    return vr4300_fpu_commit_compare(fpu, cc, predicate, unordered, equal, less);
}


/* NaN classification and IEEE exception flags are modeled. For arithmetic NaN
 * results, payload selection follows the host C implementation and is not
 * guaranteed to be bit-identical to every VR4300 silicon revision. */
static inline bool vr4300_fpu_commit_arithmetic_exceptions(vr4300_fpu_state *fpu, int raised)
{
    static const int host_flags[5] = { FE_INEXACT, FE_UNDERFLOW, FE_OVERFLOW, FE_DIVBYZERO, FE_INVALID };
    const uint32_t cause_mask = UINT32_C(0x3f) << 12;
    fpu->fcsr &= ~cause_mask;
    bool enabled = false;
    for (unsigned i = 0; i < 5; ++i) {
        if ((raised & host_flags[i]) == 0) continue;
        fpu->fcsr |= UINT32_C(1) << (12 + i);
        fpu->fcsr |= UINT32_C(1) << (2 + i);
        if (fpu->fcsr & (UINT32_C(1) << (7 + i))) enabled = true;
    }
    if (enabled) {
        fpu->exception_pending = true;
        fpu->exception_code = 15u; /* Floating Point */
        return false;
    }
    return true;
}

/* VR4300 FS handling for denormalized and underflow results. */
static inline uint32_t vr4300_fpu_flush_result_s(vr4300_fpu_state *fpu, uint32_t bits)
{
    const bool negative = (bits & UINT32_C(0x80000000)) != 0;
    const unsigned rounding = fpu->fcsr & 3u;
    const bool minimum_normal = (rounding == 2u && !negative) || (rounding == 3u && negative);
    return (negative ? UINT32_C(0x80000000) : 0u) | (minimum_normal ? UINT32_C(0x00800000) : 0u);
}

static inline uint64_t vr4300_fpu_flush_result_d(vr4300_fpu_state *fpu, uint64_t bits)
{
    const bool negative = (bits & UINT64_C(0x8000000000000000)) != 0;
    const unsigned rounding = fpu->fcsr & 3u;
    const bool minimum_normal = (rounding == 2u && !negative) || (rounding == 3u && negative);
    return (negative ? UINT64_C(0x8000000000000000) : 0u) | (minimum_normal ? UINT64_C(0x0010000000000000) : 0u);
}

static inline bool vr4300_fpu_commit_result_s(vr4300_fpu_state *fpu, int raised, uint32_t *bits)
{
    const bool denormal = (*bits & UINT32_C(0x7f800000)) == 0 && (*bits & UINT32_C(0x007fffff)) != 0;
    if (!denormal && (raised & FE_UNDERFLOW) == 0) return vr4300_fpu_commit_arithmetic_exceptions(fpu, raised);
    if ((fpu->fcsr & ((UINT32_C(1) << 8) | (UINT32_C(1) << 7))) != 0 || (fpu->fcsr & (UINT32_C(1) << 24)) == 0)
        return vr4300_fpu_raise_unimplemented(fpu);
    fpu->fcsr &= ~(UINT32_C(0x3f) << 12);
    fpu->fcsr |= (UINT32_C(1) << 13) | (UINT32_C(1) << 12) | (UINT32_C(1) << 3) | (UINT32_C(1) << 2);
    *bits = vr4300_fpu_flush_result_s(fpu, *bits);
    return true;
}

static inline bool vr4300_fpu_commit_result_d(vr4300_fpu_state *fpu, int raised, uint64_t *bits)
{
    const bool denormal = (*bits & UINT64_C(0x7ff0000000000000)) == 0 && (*bits & UINT64_C(0x000fffffffffffff)) != 0;
    if (!denormal && (raised & FE_UNDERFLOW) == 0) return vr4300_fpu_commit_arithmetic_exceptions(fpu, raised);
    if ((fpu->fcsr & ((UINT32_C(1) << 8) | (UINT32_C(1) << 7))) != 0 || (fpu->fcsr & (UINT32_C(1) << 24)) == 0)
        return vr4300_fpu_raise_unimplemented(fpu);
    fpu->fcsr &= ~(UINT32_C(0x3f) << 12);
    fpu->fcsr |= (UINT32_C(1) << 13) | (UINT32_C(1) << 12) | (UINT32_C(1) << 3) | (UINT32_C(1) << 2);
    *bits = vr4300_fpu_flush_result_d(fpu, *bits);
    return true;
}

static inline int vr4300_fpu_host_rounding(uint32_t fcsr)
{
    switch (fcsr & 3u) {
        case 0: return FE_TONEAREST;
        case 1: return FE_TOWARDZERO;
        case 2: return FE_UPWARD;
        default: return FE_DOWNWARD;
    }
}

static inline bool vr4300_fpu_begin_host_fenv(vr4300_fpu_state *fpu, fenv_t *saved, int rounding)
{
    if (fegetenv(saved) != 0) {
        fpu->exception_pending = true; fpu->exception_code = 10u; return false;
    }
    if (fesetround(rounding) != 0 || feclearexcept(FE_ALL_EXCEPT) != 0) {
        (void)fesetenv(saved);
        fpu->exception_pending = true; fpu->exception_code = 10u; return false;
    }
    return true;
}

static inline bool vr4300_fpu_end_host_fenv(vr4300_fpu_state *fpu, fenv_t *saved, int *raised)
{
    *raised = fetestexcept(FE_INEXACT | FE_UNDERFLOW | FE_OVERFLOW | FE_DIVBYZERO | FE_INVALID);
    if (fesetenv(saved) != 0) {
        fpu->exception_pending = true; fpu->exception_code = 10u; return false;
    }
    return true;
}

static inline bool vr4300_fpu_arithmetic_s(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned ft, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t left_bits = vr4300_fpu_read_s(fpu, fs);
    uint32_t right_bits = 0;
    if (operation <= 3u) right_bits = vr4300_fpu_read_s(fpu, ft);
    if (operation == 6u) return vr4300_fpu_write_s(fpu, fd, left_bits); /* MOV is a bitwise transfer. */
    if (!vr4300_fpu_check_operand_s(fpu, left_bits) ||
        (operation <= 3u && !vr4300_fpu_check_operand_s(fpu, right_bits))) return false;
    if (operation == 5u || operation == 7u) {
        fpu->fcsr &= ~(UINT32_C(0x3f) << 12);
        if (operation == 5u) left_bits &= UINT32_C(0x7fffffff);
        else left_bits ^= UINT32_C(0x80000000);
        return vr4300_fpu_write_s(fpu, fd, left_bits);
    }
    float left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile float result;
    switch (operation) {
        case 0: result = left + right; break;
        case 1: result = left - right; break;
        case 2: result = left * right; break;
        case 3: result = left / right; break;
        case 4: result = sqrtf(left); break;
        default: {
            int ignored;
            (void)vr4300_fpu_end_host_fenv(fpu, &saved_env, &ignored);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
        }
    }
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    uint32_t result_bits;
    float rounded = result;
    memcpy(&result_bits, &rounded, sizeof(result_bits));
    if (!vr4300_fpu_commit_result_s(fpu, raised, &result_bits)) return false;
    return vr4300_fpu_write_s(fpu, fd, result_bits);
}

static inline bool vr4300_fpu_arithmetic_d(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned ft, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint64_t left_bits, right_bits = 0;
    if (!vr4300_fpu_read_compare_d(fpu, fs, &left_bits)) return false;
    if (operation <= 3u && !vr4300_fpu_read_compare_d(fpu, ft, &right_bits)) return false;
    if (operation == 6u) return vr4300_fpu_write_d_register(fpu, fd, left_bits); /* MOV is a bitwise transfer. */
    if (!vr4300_fpu_check_operand_d(fpu, left_bits) ||
        (operation <= 3u && !vr4300_fpu_check_operand_d(fpu, right_bits))) return false;
    if (operation == 5u || operation == 7u) {
        fpu->fcsr &= ~(UINT32_C(0x3f) << 12);
        if (operation == 5u) left_bits &= UINT64_C(0x7fffffffffffffff);
        else left_bits ^= UINT64_C(0x8000000000000000);
        return vr4300_fpu_write_d_register(fpu, fd, left_bits);
    }
    double left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile double result;
    switch (operation) {
        case 0: result = left + right; break;
        case 1: result = left - right; break;
        case 2: result = left * right; break;
        case 3: result = left / right; break;
        case 4: result = sqrt(left); break;
        default: {
            int ignored;
            (void)vr4300_fpu_end_host_fenv(fpu, &saved_env, &ignored);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
        }
    }
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    uint64_t result_bits;
    double rounded = result;
    memcpy(&result_bits, &rounded, sizeof(result_bits));
    if (!vr4300_fpu_commit_result_d(fpu, raised, &result_bits)) return false;
    return vr4300_fpu_write_d_register(fpu, fd, result_bits);
}


/* Convert S/D to the 32-bit integer format stored in an FPR. Operations:
 * 0 CVT.W (FCSR RM), 1 ROUND.W (nearest-even), 2 TRUNC.W,
 * 3 CEIL.W, 4 FLOOR.W. Out-of-range and non-finite inputs raise Invalid.
 * The destination is not committed when an enabled exception traps. */
static inline bool vr4300_fpu_convert_word(
    vr4300_fpu_state *fpu, unsigned operation, double input, unsigned fd, int initial_raised)
{
    int requested = operation == 0u ? vr4300_fpu_host_rounding(fpu->fcsr)
        : operation == 1u ? FE_TONEAREST
        : operation == 2u ? FE_TOWARDZERO
        : operation == 3u ? FE_UPWARD
        : operation == 4u ? FE_DOWNWARD : -1;
    if (requested == -1) {
        fpu->exception_pending = true; fpu->exception_code = 10u; return false;
    }
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, requested)) return false;
    volatile double rounded;
    switch (operation) {
        case 0: case 1: rounded = rint(input); break;
        case 2: rounded = trunc(input); break;
        case 3: rounded = ceil(input); break;
        case 4: rounded = floor(input); break;
        default: {
            int ignored;
            (void)vr4300_fpu_end_host_fenv(fpu, &saved_env, &ignored);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
        }
    }
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    raised |= initial_raised;
    if (!isfinite(input) || rounded < -2147483648.0 || rounded >= 2147483648.0)
        return vr4300_fpu_raise_unimplemented(fpu);
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    const int32_t integer = (int32_t)rounded;
    return vr4300_fpu_write_s(fpu, fd, (uint32_t)integer);
}

static inline bool vr4300_fpu_convert_word_s(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t bits = vr4300_fpu_read_s(fpu, fs);
    if (!vr4300_fpu_check_operand_s(fpu, bits)) return false;
    float value;
    memcpy(&value, &bits, sizeof(value));
    int host_rounding = fegetround();
    if (host_rounding == -1) { fpu->exception_pending = true; fpu->exception_code = 10u; return false; }
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, host_rounding)) return false;
    volatile double promoted = (double)value;
    int promotion_raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &promotion_raised)) return false;
    return vr4300_fpu_convert_word(fpu, operation, promoted, fd, promotion_raised);
}

static inline bool vr4300_fpu_convert_word_d(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    uint64_t bits;
    if (!vr4300_fpu_read_compare_d(fpu, fs, &bits)) return false;
    if (!vr4300_fpu_check_operand_d(fpu, bits)) return false;
    double value;
    memcpy(&value, &bits, sizeof(value));
    return vr4300_fpu_convert_word(fpu, operation, value, fd, 0);
}


/* CVT.S.W and CVT.D.W interpret the source FPR as a signed 32-bit word.
 * CVT.S.W obeys FCSR rounding and can raise Inexact; every int32 is exact
 * when widened to binary64 for CVT.D.W. */
static inline bool vr4300_fpu_convert_word_to_s(
    vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    uint32_t source_bits = vr4300_fpu_read_s(fpu, fs);
    int32_t input;
    memcpy(&input, &source_bits, sizeof(input));
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile float converted = (float)input;
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint32_t result;
    float value = converted;
    memcpy(&result, &value, sizeof(result));
    return vr4300_fpu_write_s(fpu, fd, result);
}

static inline bool vr4300_fpu_convert_word_to_d(
    vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    uint32_t source_bits = vr4300_fpu_read_s(fpu, fs);
    int32_t input;
    memcpy(&input, &source_bits, sizeof(input));
    double converted = (double)input;
    uint64_t result;
    memcpy(&result, &converted, sizeof(result));
    return vr4300_fpu_write_d_register(fpu, fd, result);
}

/* CVT.S.D and CVT.D.S. Conversion is performed under the FCSR RM mode;
 * the host floating environment is restored before returning. */
static inline bool vr4300_fpu_convert_d_to_s(vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    uint64_t bits;
    if (!vr4300_fpu_read_compare_d(fpu, fs, &bits)) return false;
    if (!vr4300_fpu_check_operand_d(fpu, bits)) return false;
    double input;
    memcpy(&input, &bits, sizeof(input));
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile float converted = (float)input;
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    uint32_t result;
    float value = converted;
    memcpy(&result, &value, sizeof(result));
    if (!vr4300_fpu_commit_result_s(fpu, raised, &result)) return false;
    return vr4300_fpu_write_s(fpu, fd, result);
}

static inline bool vr4300_fpu_convert_s_to_d(vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    uint32_t bits = vr4300_fpu_read_s(fpu, fs);
    if (!vr4300_fpu_check_operand_s(fpu, bits)) return false;
    float input;
    memcpy(&input, &bits, sizeof(input));
    int host_rounding = fegetround();
    if (host_rounding == -1) { fpu->exception_pending = true; fpu->exception_code = 10u; return false; }
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, host_rounding)) return false;
    volatile double converted = (double)input;
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint64_t result;
    double value = converted;
    memcpy(&result, &value, sizeof(result));
    return vr4300_fpu_write_d_register(fpu, fd, result);
}

/* CVT.[S,D].L accepts a signed 64-bit FPR value only when bits 63:55
 * are all zero or all one. Other patterns raise Unimplemented Operation
 * (NEC VR4300 UM §§7.5.2, 17.5, Appendix D). */
static inline bool vr4300_fpu_read_long_source(
    vr4300_fpu_state *fpu, unsigned fs, int64_t *value)
{
    uint64_t bits;
    if (!vr4300_fpu_read_d_register(fpu, fs, &bits)) return false;
    const uint64_t upper = bits >> 55;
    if (upper != 0u && upper != UINT64_C(0x1ff))
        return vr4300_fpu_raise_unimplemented(fpu);
    if ((bits & UINT64_C(0x8000000000000000)) != 0)
        *value = -1 - (int64_t)(~bits);
    else
        *value = (int64_t)bits;
    return true;
}

static inline bool vr4300_fpu_convert_long_to_s(
    vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    int64_t input;
    if (!vr4300_fpu_read_long_source(fpu, fs, &input)) return false;
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile float converted = (float)input;
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint32_t result;
    float value = converted;
    memcpy(&result, &value, sizeof(result));
    return vr4300_fpu_write_s(fpu, fd, result);
}

static inline bool vr4300_fpu_convert_long_to_d(
    vr4300_fpu_state *fpu, unsigned fs, unsigned fd)
{
    int64_t input;
    if (!vr4300_fpu_read_long_source(fpu, fs, &input)) return false;
    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, vr4300_fpu_host_rounding(fpu->fcsr))) return false;
    volatile double converted = (double)input;
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint64_t result;
    double value = converted;
    memcpy(&result, &value, sizeof(result));
    return vr4300_fpu_write_d_register(fpu, fd, result);
}

/* The VR4300 implements 64-bit fixed-point conversions only in 64-bit
 * mode or 32-bit Kernel mode. Out-of-range, infinite, and NaN inputs use
 * Unimplemented Operation (NEC VR4300 UM §17.5 and Appendix D). */
static inline bool vr4300_fpu_check_long_conversion(vr4300_fpu_state *fpu)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    if (!fpu->mode64_or_kernel) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u; /* Reserved Instruction */
        return false;
    }
    return true;
}

static inline bool vr4300_fpu_convert_long(
    vr4300_fpu_state *fpu, unsigned operation, double input, unsigned fd)
{
    const int requested = operation == 0u ? vr4300_fpu_host_rounding(fpu->fcsr)
        : operation == 1u ? FE_TONEAREST
        : operation == 2u ? FE_TOWARDZERO
        : operation == 3u ? FE_UPWARD
        : operation == 4u ? FE_DOWNWARD : -1;
    if (requested == -1) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u;
        return false;
    }
    if (!isfinite(input)) return vr4300_fpu_raise_unimplemented(fpu);

    fenv_t saved_env;
    if (!vr4300_fpu_begin_host_fenv(fpu, &saved_env, requested)) return false;
    volatile double rounded;
    switch (operation) {
        case 0: case 1: rounded = rint(input); break;
        case 2: rounded = trunc(input); break;
        case 3: rounded = ceil(input); break;
        case 4: rounded = floor(input); break;
        default: {
            int ignored;
            (void)vr4300_fpu_end_host_fenv(fpu, &saved_env, &ignored);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
        }
    }
    int raised;
    if (!vr4300_fpu_end_host_fenv(fpu, &saved_env, &raised)) return false;
    if (rounded < -9223372036854775808.0 || rounded >= 9223372036854775808.0)
        return vr4300_fpu_raise_unimplemented(fpu);
    const int64_t integer = (int64_t)rounded;
    const uint64_t result_bits = (uint64_t)integer;
    /* VR4300 Appendix D: any set bit in result[62:53] is unimplemented. */
    if ((result_bits & UINT64_C(0x7fe0000000000000)) != 0)
        return vr4300_fpu_raise_unimplemented(fpu);
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    return vr4300_fpu_write_d_register(fpu, fd, result_bits);
}

static inline bool vr4300_fpu_convert_long_s(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    if (!vr4300_fpu_check_long_conversion(fpu)) return false;
    const uint32_t bits = vr4300_fpu_read_s(fpu, fs);
    if (!vr4300_fpu_check_operand_s(fpu, bits)) return false;
    if ((bits & UINT32_C(0x7f800000)) == UINT32_C(0x7f800000))
        return vr4300_fpu_raise_unimplemented(fpu);
    float value;
    memcpy(&value, &bits, sizeof(value));
    return vr4300_fpu_convert_long(fpu, operation, (double)value, fd);
}

static inline bool vr4300_fpu_convert_long_d(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    if (!vr4300_fpu_check_long_conversion(fpu)) return false;
    uint64_t bits;
    if (!vr4300_fpu_read_d_register(fpu, fs, &bits)) return false;
    if (!vr4300_fpu_check_operand_d(fpu, bits)) return false;
    if ((bits & UINT64_C(0x7ff0000000000000)) == UINT64_C(0x7ff0000000000000))
        return vr4300_fpu_raise_unimplemented(fpu);
    double value;
    memcpy(&value, &bits, sizeof(value));
    return vr4300_fpu_convert_long(fpu, operation, value, fd);
}

static inline bool vr4300_fpu_read_fir(vr4300_fpu_state *fpu, uint32_t *value)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    *value = fpu->fir;
    return true;
}

static inline bool vr4300_fpu_read_fcsr(vr4300_fpu_state *fpu, uint32_t *value)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    *value = fpu->fcsr;
    return true;
}

static inline bool vr4300_fpu_write_fcsr(vr4300_fpu_state *fpu, uint32_t value)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    /* FCSR bits 31:25 are reserved on VR4300 and read as zero. */
    fpu->fcsr = value & UINT32_C(0xfe83ffff);
    const uint32_t cause = fpu->fcsr & (UINT32_C(0x3f) << 12);
    const uint32_t enabled_ieee_causes = (fpu->fcsr & (UINT32_C(0x1f) << 7)) << 5;
    /* CTC1 itself can trigger FPE when it writes an enabled cause bit.
     * Unimplemented-operation (E) has no enable bit and always traps. */
    if ((cause & enabled_ieee_causes) != 0 || (cause & (UINT32_C(1) << 17)) != 0) {
        fpu->exception_pending = true;
        fpu->exception_code = 15u; /* Floating Point */
        return false;
    }
    return true;
}
`;
