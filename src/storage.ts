import mkdirp from "mkdirp";
import {constants, createBrotliCompress, createGzip} from "zlib";
import {createReadStream, createWriteStream, existsSync, rmSync, statSync} from "fs";
import { join } from "path";

export class FileStorage {
    path: string;

    constructor(path) {
        this.path = path;
        mkdirp.sync(path);
    }

    existsFile(code) {
        return existsSync(join(this.path, code + ".gz"));
    }

    async getFileSize(code) {
        if (this.existsFile(code))
            return statSync(join(this.path, code + ".gz")).size;
        else
            return -1;
    }

    async addFile(originalPath, code, size) {
        if (existsSync(originalPath)) {
            let brotli = createGzip();
            let read = createReadStream(originalPath);
            let write = createWriteStream(join(this.path, code + ".gz"))
            read.pipe(brotli);
            brotli.pipe(write);
            await new Promise<void>((res, rej) => {
                brotli.on("end", () => {
                    res();
                });
            })
        } else {
            throw "File not found!";
        }

    }

    async deleteFile(code) {
        let path = join(this.path, code + ".gz")
        if (existsSync(path)) {
            rmSync(path);
        }
    }
    getPath(code): string {
        return join(this.path, code + ".gz")
    }

    async openRead(code) {
        let path = join(this.path, code + ".gz")
        return createReadStream(path);
    }
}


