
#include <CascLib.h>
#include <cstdio>
#include <algorithm>
int main(int argc, char **argv) {
    if (argc != 4) { std::fprintf(stderr, "usage: casc-extract STORAGE ASSET OUTPUT\n"); return 2; }
    HANDLE storage = nullptr, file = nullptr;
    if (!CascOpenStorage(argv[1], CASC_LOCALE_ENUS, &storage)) {
        std::fprintf(stderr, "open storage failed: %u\n", GetCascError()); return 1;
    }
    if (!CascOpenFile(storage, argv[2], CASC_LOCALE_ENUS, 0, &file)) {
        std::fprintf(stderr, "open asset failed: %u\n", GetCascError()); CascCloseStorage(storage); return 1;
    }
    ULONGLONG length = 0;
    if (!CascGetFileSize64(file, &length)) { CascCloseFile(file); CascCloseStorage(storage); return 1; }
    FILE *output = std::fopen(argv[3], "wb");
    if (!output) { std::perror(argv[3]); CascCloseFile(file); CascCloseStorage(storage); return 1; }
    unsigned char buffer[65536];
    bool ok = true;
    for (ULONGLONG left = length; left > 0;) {
        DWORD got = 0, count = static_cast<DWORD>(std::min<ULONGLONG>(left, sizeof buffer));
        if (!CascReadFile(file, buffer, count, &got) || got != count || std::fwrite(buffer, 1, got, output) != got) { ok = false; break; }
        left -= got;
    }
    if (std::fclose(output) != 0) ok = false;
    CascCloseFile(file); CascCloseStorage(storage);
    if (!ok) { std::remove(argv[3]); std::fprintf(stderr, "asset read/write failed\n"); return 1; }
    std::printf("extracted %llu bytes: %s\n", static_cast<unsigned long long>(length), argv[3]);
}
