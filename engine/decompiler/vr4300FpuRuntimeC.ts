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


/* NaN classification and IEEE exception flags are modeled. For arithmetic NaN
 * results, payload selection follows the host C implementation and is not
 * guaranteed to be bit-identical to every VR4300 silicon revision. */
static inline bool vr4300_fpu_commit_arithmetic_exceptions(vr4300_fpu_state *fpu, int raised)
{
    static const int host_flags[5] = { FE_INEXACT, FE_UNDERFLOW, FE_OVERFLOW, FE_DIVBYZERO, FE_INVALID };
    const uint32_t cause_mask = UINT32_C(0x1f) << 12;
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

static inline int vr4300_fpu_host_rounding(uint32_t fcsr)
{
    switch (fcsr & 3u) {
        case 0: return FE_TONEAREST;
        case 1: return FE_TOWARDZERO;
        case 2: return FE_UPWARD;
        default: return FE_DOWNWARD;
    }
}

static inline bool vr4300_fpu_arithmetic_s(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned ft, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t left_bits = vr4300_fpu_read_s(fpu, fs);
    uint32_t right_bits = vr4300_fpu_read_s(fpu, ft);
    if (operation == 5u || operation == 6u || operation == 7u) {
        if (operation == 5u) left_bits &= UINT32_C(0x7fffffff);
        else if (operation == 7u) left_bits ^= UINT32_C(0x80000000);
        return vr4300_fpu_write_s(fpu, fd, left_bits);
    }
    float left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    int old_round = fegetround();
    if (old_round == -1 || fesetround(vr4300_fpu_host_rounding(fpu->fcsr)) != 0) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u;
        return false;
    }
    feclearexcept(FE_ALL_EXCEPT);
    volatile float result;
    switch (operation) {
        case 0: result = left + right; break;
        case 1: result = left - right; break;
        case 2: result = left * right; break;
        case 3: result = left / right; break;
        case 4: result = sqrtf(left); break;
        default:
            fesetround(old_round);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
    }
    int raised = fetestexcept(FE_INEXACT | FE_UNDERFLOW | FE_OVERFLOW | FE_DIVBYZERO | FE_INVALID);
    fesetround(old_round);
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint32_t result_bits;
    float rounded = result;
    memcpy(&result_bits, &rounded, sizeof(result_bits));
    return vr4300_fpu_write_s(fpu, fd, result_bits);
}

static inline bool vr4300_fpu_arithmetic_d(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned ft, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint64_t left_bits, right_bits;
    if (!vr4300_fpu_read_compare_d(fpu, fs, &left_bits) ||
        !vr4300_fpu_read_compare_d(fpu, ft, &right_bits)) return false;
    if (operation == 5u || operation == 6u || operation == 7u) {
        if (operation == 5u) left_bits &= UINT64_C(0x7fffffffffffffff);
        else if (operation == 7u) left_bits ^= UINT64_C(0x8000000000000000);
        return vr4300_fpu_write_d_register(fpu, fd, left_bits);
    }
    double left, right;
    memcpy(&left, &left_bits, sizeof(left));
    memcpy(&right, &right_bits, sizeof(right));
    int old_round = fegetround();
    if (old_round == -1 || fesetround(vr4300_fpu_host_rounding(fpu->fcsr)) != 0) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u;
        return false;
    }
    feclearexcept(FE_ALL_EXCEPT);
    volatile double result;
    switch (operation) {
        case 0: result = left + right; break;
        case 1: result = left - right; break;
        case 2: result = left * right; break;
        case 3: result = left / right; break;
        case 4: result = sqrt(left); break;
        default:
            fesetround(old_round);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
    }
    int raised = fetestexcept(FE_INEXACT | FE_UNDERFLOW | FE_OVERFLOW | FE_DIVBYZERO | FE_INVALID);
    fesetround(old_round);
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    uint64_t result_bits;
    double rounded = result;
    memcpy(&result_bits, &rounded, sizeof(result_bits));
    return vr4300_fpu_write_d_register(fpu, fd, result_bits);
}


/* Convert S/D to the 32-bit integer format stored in an FPR. Operations:
 * 0 CVT.W (FCSR RM), 1 ROUND.W (nearest-even), 2 TRUNC.W,
 * 3 CEIL.W, 4 FLOOR.W. Out-of-range and non-finite inputs raise Invalid.
 * The destination is not committed when an enabled exception traps. */
static inline bool vr4300_fpu_convert_word(
    vr4300_fpu_state *fpu, unsigned operation, double input, unsigned fd)
{
    int old_round = fegetround();
    int requested = operation == 0u ? vr4300_fpu_host_rounding(fpu->fcsr)
        : operation == 1u ? FE_TONEAREST
        : operation == 2u ? FE_TOWARDZERO
        : operation == 3u ? FE_UPWARD
        : operation == 4u ? FE_DOWNWARD : -1;
    if (old_round == -1 || requested == -1 || fesetround(requested) != 0) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u;
        return false;
    }
    feclearexcept(FE_ALL_EXCEPT);
    volatile double rounded;
    switch (operation) {
        case 0: case 1: rounded = rint(input); break;
        case 2: rounded = trunc(input); break;
        case 3: rounded = ceil(input); break;
        case 4: rounded = floor(input); break;
        default:
            fesetround(old_round);
            fpu->exception_pending = true;
            fpu->exception_code = 10u;
            return false;
    }
    int raised = fetestexcept(FE_INEXACT | FE_UNDERFLOW | FE_OVERFLOW | FE_DIVBYZERO | FE_INVALID);
    fesetround(old_round);
    if (!isfinite(input) || rounded < -2147483648.0 || rounded >= 2147483648.0)
        raised |= FE_INVALID;
    if (!vr4300_fpu_commit_arithmetic_exceptions(fpu, raised)) return false;
    int32_t integer = (raised & FE_INVALID) ? INT32_MIN : (int32_t)rounded;
    return vr4300_fpu_write_s(fpu, fd, (uint32_t)integer);
}

static inline bool vr4300_fpu_convert_word_s(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    if (!vr4300_fpu_check_cop1(fpu)) return false;
    uint32_t bits = vr4300_fpu_read_s(fpu, fs);
    float value;
    memcpy(&value, &bits, sizeof(value));
    return vr4300_fpu_convert_word(fpu, operation, (double)value, fd);
}

static inline bool vr4300_fpu_convert_word_d(
    vr4300_fpu_state *fpu, unsigned operation, unsigned fs, unsigned fd)
{
    uint64_t bits;
    if (!vr4300_fpu_read_compare_d(fpu, fs, &bits)) return false;
    double value;
    memcpy(&value, &bits, sizeof(value));
    return vr4300_fpu_convert_word(fpu, operation, value, fd);
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
    fpu->fcsr = value;
    return true;
}
`;
