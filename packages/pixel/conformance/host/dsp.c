// The firmware's toolbox/dsp.c is ARM assembly, and only the sub-pixel cutout path uses it, which these harnesses
// never enable (AnimFileOptionNone). Identity stand-ins keep the rest of the decoder untouched.
#include <toolbox/dsp.h>

bool dsp_2d_kernel_is_normalized(size_t kernel_sz, float kernel[kernel_sz][kernel_sz]) {
    UNUSED(kernel);
    return true;
}

void dsp_2d_kernel_subpixel_translate(size_t kernel_sz, float kernel[kernel_sz][kernel_sz], float x, float y) {
    UNUSED(kernel);
    UNUSED(x);
    UNUSED(y);
}

void dsp_2d_kernel_apply(
    size_t kernel_sz,
    const float* kernel,
    DspImageBuffer src,
    DspImageBuffer dst,
    int offs_x,
    int offs_y) {
    UNUSED(kernel_sz);
    UNUSED(kernel);
    UNUSED(src);
    UNUSED(dst);
    UNUSED(offs_x);
    UNUSED(offs_y);
    furi_crash();
}
