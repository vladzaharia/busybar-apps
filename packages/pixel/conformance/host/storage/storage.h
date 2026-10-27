// Host stand-in for the firmware's storage API, over stdio.
#pragma once
#include <furi.h>

typedef struct Storage Storage;
typedef struct {
    FILE* f;
} File;
typedef enum { FSAM_READ = 1 } FS_AccessMode;
typedef enum { FSOM_OPEN_EXISTING = 1 } FS_OpenMode;

static inline File* storage_file_alloc(Storage* storage) {
    UNUSED(storage);
    return calloc(1, sizeof(File));
}
static inline void storage_file_free(File* file) {
    if(file->f) fclose(file->f);
    free(file);
}
static inline bool storage_file_open(File* file, const char* path, FS_AccessMode a, FS_OpenMode m) {
    UNUSED(a);
    UNUSED(m);
    file->f = fopen(path, "rb");
    return file->f != NULL;
}
static inline bool storage_file_seek(File* file, uint32_t offset, bool from_start) {
    UNUSED(from_start);
    return fseek(file->f, offset, SEEK_SET) == 0;
}
static inline size_t storage_file_read(File* file, void* buffer, size_t size) {
    return fread(buffer, 1, size, file->f);
}
static inline uint64_t storage_file_size(File* file) {
    long pos = ftell(file->f);
    fseek(file->f, 0, SEEK_END);
    long size = ftell(file->f);
    fseek(file->f, pos, SEEK_SET);
    return size;
}
