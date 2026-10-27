// Host stand-in for the firmware's furi.h: just what lib/anim_file and lib/toolbox use.
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

#define furi_assert(x, ...)                                                          \
    do {                                                                             \
        if(!(x)) {                                                                   \
            fprintf(stderr, "assertion failed: %s (%s:%d)\n", #x, __FILE__, __LINE__); \
            abort();                                                                 \
        }                                                                            \
    } while(0)
#define furi_check furi_assert
#define furi_crash(...) abort()
#define FURI_LOG_E(tag, ...)               \
    do {                                   \
        fprintf(stderr, "[%s] ", tag);     \
        fprintf(stderr, __VA_ARGS__);      \
        fputc('\n', stderr);               \
    } while(0)
#define FURI_LOG_D(tag, ...) \
    do {                     \
    } while(0)
#define FURI_PACKED      __attribute__((packed))
#define FURI_WARN_UNUSED __attribute__((warn_unused_result))
#define UNUSED(x)        (void)(x)
#ifndef MIN
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#endif
#ifndef MAX
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#endif
#define COUNT_OF(x)       (sizeof(x) / sizeof(x[0]))
#define ROUND_UP_TO(a, b) (((a) + (b) - 1) / (b))
