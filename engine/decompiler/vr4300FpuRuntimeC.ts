/**
 * Self-contained C helpers used by structured VR4300 FPU lowering.
 *
 * The caller supplies the current Status.FR bit and whether the executing
 * context is kernel or 64-bit mode. Doubleword operations report a pending
 * Reserved Instruction condition and return false when the mode/register
 * constraints are not met; generated code returns immediately on that path.
 */
export const VR4300_FPU_C_RUNTIME = `#include <stdbool.h>
#include <stdint.h>

typedef struct vr4300_fpu_state {
    uint32_t words[32];
    uint64_t wide[32];
    uint32_t fcsr;
    uint32_t status;
    bool mode64_or_kernel;
    bool exception_pending;
    uint32_t exception_code;
} vr4300_fpu_state;

static inline uint32_t vr4300_fpu_read_s(const vr4300_fpu_state *fpu, unsigned reg)
{
    return (fpu->status & (1u << 26))
        ? (uint32_t)fpu->wide[reg]
        : fpu->words[reg];
}

static inline void vr4300_fpu_write_s(vr4300_fpu_state *fpu, unsigned reg, uint32_t bits)
{
    if (fpu->status & (1u << 26)) {
        fpu->wide[reg] = (fpu->wide[reg] & UINT64_C(0xffffffff00000000)) | bits;
    } else {
        fpu->words[reg] = bits;
    }
}

static inline bool vr4300_fpu_check_d(vr4300_fpu_state *fpu, unsigned reg)
{
    if (reg >= 32 || !fpu->mode64_or_kernel ||
        (!(fpu->status & (1u << 26)) && ((reg & 1u) != 0))) {
        fpu->exception_pending = true;
        fpu->exception_code = 10u; /* Reserved Instruction */
        return false;
    }
    return true;
}

static inline bool vr4300_fpu_read_d(vr4300_fpu_state *fpu, unsigned reg, uint64_t *bits)
{
    if (!vr4300_fpu_check_d(fpu, reg)) return false;
    if (fpu->status & (1u << 26)) {
        *bits = fpu->wide[reg];
    } else {
        *bits = ((uint64_t)fpu->words[reg] << 32) | fpu->words[reg + 1];
    }
    return true;
}

static inline bool vr4300_fpu_write_d(vr4300_fpu_state *fpu, unsigned reg, uint64_t bits)
{
    if (!vr4300_fpu_check_d(fpu, reg)) return false;
    if (fpu->status & (1u << 26)) {
        fpu->wide[reg] = bits;
    } else {
        fpu->words[reg] = (uint32_t)(bits >> 32);
        fpu->words[reg + 1] = (uint32_t)bits;
    }
    return true;
}

static inline void vr4300_fpu_load_s(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    vr4300_fpu_write_s(fpu, reg, *(const volatile uint32_t *)address);
}

static inline bool vr4300_fpu_load_d(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    if (!vr4300_fpu_check_d(fpu, reg)) return false;
    return vr4300_fpu_write_d(fpu, reg, *(const volatile uint64_t *)address);
}

static inline void vr4300_fpu_store_s(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    *(volatile uint32_t *)address = vr4300_fpu_read_s(fpu, reg);
}

static inline bool vr4300_fpu_store_d(vr4300_fpu_state *fpu, unsigned reg, uintptr_t address)
{
    uint64_t bits;
    if (!vr4300_fpu_read_d(fpu, reg, &bits)) return false;
    *(volatile uint64_t *)address = bits;
    return true;
}

static inline void vr4300_fpu_write_fcsr(vr4300_fpu_state *fpu, uint32_t value)
{
    fpu->fcsr = value;
}
`;
