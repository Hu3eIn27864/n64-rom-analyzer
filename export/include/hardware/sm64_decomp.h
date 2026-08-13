#ifndef SM64_DECOMP_H
#define SM64_DECOMP_H

#include "types.h"

// Ultra64 Libultra OS Definitions
typedef struct {
    u32 stat;
    u32 width;
    u32 framep;
} OSViMode;

void osInitialize(void);
void osCreateThread(void* t, u32 id, void (*entry)(void*), void* arg, void* sp, u32 pri);
void osStartThread(void* t);
void osViSetMode(OSViMode* mode);

#endif // SM64_DECOMP_H
