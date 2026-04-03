// src/types/electron-file.d.ts
export {};   // ensure this file is treated as a module

declare global {
    interface File {
        path: string;
    }
}
