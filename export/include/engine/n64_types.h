#ifndef N64_RECOVERED_TYPES_H
#define N64_RECOVERED_TYPES_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* Semantic Constant Recovery */
#define M_DEGREES_TO_RADIANS    0.017453292f
#define M_RADIANS_TO_DEGREES    57.2957795f
#define M_PI                    3.14159265f
#define M_TWO_PI                6.28318530f
#define GRAVITY_ACCELERATION    9.81f
#define FRAME_DELTA_TIME_30FPS  0.033333333f

/* Hardware MMIO Register Constants */
#define RCP_VI_BASE_REG         0x04400000
#define RCP_AI_BASE_REG         0x04500000
#define RCP_SP_BASE_REG         0x04000000
#define RCP_DP_BASE_REG         0x04100000
#define RCP_MI_BASE_REG         0x04300000
#define RCP_PI_BASE_REG         0x04600000
#define RCP_SI_BASE_REG         0x04800000

/* Hardware IO Bus Access Macros */
#define N64_READ_32(addr)       (*(volatile uint32_t*)(addr))
#define N64_WRITE_32(addr, val) (*(volatile uint32_t*)(addr) = (uint32_t)(val))

typedef struct {
    float x;
    float y;
    float z;
} Vector3f;

typedef struct {
    float m[4][4];
} Matrix4f;

typedef enum {
    ACT_IDLE = 0,
    ACT_WALKING = 1,
    ACT_JUMPING = 2,
    ACT_FALLING = 3,
} PlayerActionState;

typedef struct {
    Vector3f position;       /* +0x00: Vector3f Position (X, Y, Z) */
    Vector3f velocity;       /* +0x0C: Vector3f Velocity (X,Y,Z) */
    float faceAngle;         /* +0x18: Facing Yaw Angle */
    PlayerActionState action;/* +0x1C: Current Action State */
    uint16_t health;         /* +0x20: Hit points */
    uint16_t animFrame;      /* +0x22: Animation Keyframe Index */
} MarioState;

typedef struct {
    Vector3f pos;            /* +0x00: Camera World Position */
    Vector3f target;         /* +0x0C: Focus Target Point */
    Vector3f up;             /* +0x18: Up Vector */
    float fov;               /* +0x24: Field of View */
} CameraState;

typedef struct {
    Vector3f pos;
    Vector3f vel;
    Vector3f scale;
    uint32_t activeFlags;
    uint32_t behaviorScript;
} GameObject;

typedef struct {
    uint32_t frameBufferAddr;
    uint32_t width;
    uint32_t height;
    uint32_t statusReg;
} ViDisplayConfig;

typedef struct {
    uint32_t dmaAddress;
    uint32_t sampleCount;
    uint32_t frequency;
} AudioBufferHeader;

#endif /* N64_RECOVERED_TYPES_H */
