// Batch front end for the firmware's toolbox/rle_encode.
//
// stdin:  records of [op: 'c' (compress) or 'd' (decompress)] [blk: u32le] [len: u32le] [len bytes]
// stdout: per record [ok: u8] [len: u32le] [len bytes]
//
// rle_compress compares the last block with the bytes after the input (it reads one block past the end). That read
// is given bytes that differ from the last block, the only well-defined reading, and what rle.py does.
#include <toolbox/rle_encode.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static uint8_t in[1 << 22], out[1 << 23];

static bool read_u32(uint32_t* v) {
    uint8_t b[4];
    if(fread(b, 1, 4, stdin) != 4) return false;
    *v = b[0] | (b[1] << 8) | (b[2] << 16) | ((uint32_t)b[3] << 24);
    return true;
}

static void write_u32(uint32_t v) {
    uint8_t b[4] = {v, v >> 8, v >> 16, v >> 24};
    fwrite(b, 1, 4, stdout);
}

int main(void) {
    int op;
    while((op = fgetc(stdin)) != EOF) {
        uint32_t blk, len;
        if(!read_u32(&blk) || !read_u32(&len) || len + 16 > sizeof(in)) return 2;
        if(fread(in, 1, len, stdin) != len) return 2;
        for(uint32_t k = 0; k < blk; k++) in[len + k] = len >= blk ? in[len - blk + k] ^ 0xFF : 0;
        size_t result = 0;
        bool ok = op == 'c' ? rle_compress(in, len, out, sizeof(out), blk, &result) :
                              rle_decompress(in, len, out, sizeof(out), blk, &result);
        fputc(ok, stdout);
        write_u32(ok ? result : 0);
        if(ok) fwrite(out, 1, result, stdout);
    }
    return 0;
}
