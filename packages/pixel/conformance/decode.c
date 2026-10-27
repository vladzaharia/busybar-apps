// Plays sections of an .anim through the firmware's own decoder (lib/anim_file) and writes the BGRA output buffer
// after every frame.
//
//   decode <file.anim> <out.bin> [section...]      (default: the "default" section)
//
// Each section is played from a freshly loaded file into an output buffer filled with 0xA5, so a section whose first
// frame is not a keyframe shows up as stray 0xA5 pixels.
#include <anim_file.h>

int main(int argc, char** argv) {
    if(argc < 3) {
        fprintf(stderr, "usage: decode <file.anim> <out.bin> [section...]\n");
        return 2;
    }
    FILE* out = fopen(argv[2], "wb");
    if(!out) return 2;
    int sections = argc > 3 ? argc - 3 : 1;

    for(int s = 0; s < sections; s++) {
        const char* name = argc > 3 ? argv[3 + s] : ANIM_FILE_DEFAULT_SECTION;
        AnimFile* anim = anim_file_alloc((Storage*)1, argv[1], AnimFileOptionNone);
        if(!anim) {
            fprintf(stderr, "%s: rejected by the firmware loader\n", argv[1]);
            return 1;
        }
        AnimFileInfo info = anim_file_info(anim);
        size_t bytes = info.width * info.height * ANIM_FILE_OUT_BYTES_PER_PIXEL;
        uint8_t* buffer = malloc(bytes);
        memset(buffer, 0xA5, bytes);
        anim_file_set_out_buf(anim, info.width, info.height, buffer);

        if(!anim_file_set_section(anim, AnimFilePlayFlagNone, name)) {
            fprintf(stderr, "%s: no section \"%s\"\n", argv[1], name);
            return 1;
        }
        for(size_t n = 0;; n++) {
            AnimFileFrameInfo frame = anim_file_frame(anim);
            if(frame.flags & AnimFileFrameFlagError) {
                fprintf(stderr, "%s: section \"%s\" frame %zu: decode error\n", argv[1], name, frame.index);
                return 1;
            }
            fwrite(buffer, 1, bytes, out);
            if(frame.flags & AnimFileFrameFlagLast) break;
            if(n > info.frames) {
                fprintf(stderr, "%s: section \"%s\" never reached its last frame\n", argv[1], name);
                return 1;
            }
        }
        anim_file_free(anim);
        free(buffer);
    }
    fclose(out);
    return 0;
}
