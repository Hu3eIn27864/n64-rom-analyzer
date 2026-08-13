#ifndef N64_TYPES_H
#define N64_TYPES_H

#include <cstdint>
#include <cstddef>

typedef uint8_t   u8;
typedef uint16_t  u16;
typedef uint32_t  u32;
typedef uint64_t  u64;

typedef int8_t    s8;
typedef int16_t   s16;
typedef int32_t   s32;
typedef int64_t   s64;

typedef float     f32;
typedef double    f64;

struct alignas(16) v128 {
    u32 w[4];
};

#endif // N64_TYPES_H
