import { PrismaClient } from "@prisma/client";
import {Router, Request} from "express";
import {FileStorage} from "../storage";
import multer from "multer";
import { join } from "path";
import {existsSync, rmSync} from "fs";
import {GENERATE_CODE} from "../util";
import {constants, createBrotliDecompress} from "zlib";
import {OutgoingHttpHeader, OutgoingHttpHeaders} from "http";
let regex = /^\/([\w\d]{6})/;
export async function router(db: PrismaClient, storage: FileStorage) {
    let router = Router();
    let upload = multer({ dest: join(__dirname, "..", "..", "tmp"), async fileFilter(req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
        if(!req.body.token) {
            callback(null,false);
            req.session["uploadError"] = "Invalid token.";
            req.session["uploadErrorB"] = true;
            return;
        } else {
            try {
                let token = await db.token.findUnique({
                    where: {
                        token: req.body.token
                    },
                    include: {
                        user: true
                    }
                });
                if(token == null) {
                    callback(null,false);
                    req.session["uploadError"] = "Invalid token.";
                    req.session["uploadErrorB"] = true;
                    return;
                }
                if(file.size > token.user.uploadLimit) {
                    req.session["uploadError"] = "File exceeds maximum size for user.";
                    req.session["uploadErrorB"] = true;
                    callback(null, false);
                    return;
                }
                callback(null, true);
                return;
            } catch(e) {
                console.error(e);
                req.session["uploadError"] = "Database error.";
                req.session["uploadErrorB"] = true;
                callback(null, false);
                return;
            }
        }
        callback(null, false); // Unreachable = Good :)
    }
    });


    router.put("/", upload.single("file"), async (req, res) => {
        if(req.session["uploadErrorB"]) {
            req.session["uploadErrorB"] = false;
            res.status(400);
            res.json({
                ok: false,
                msg: req.session["uploadError"]
            });
            return;
        }
        if(!req.file) {
            res.status(400);
            res.json({
                ok: false,
                msg: "No file attached."
            });
            return;
        }
        if(!req.body.token) {
            res.status(400);
            res.json({
                ok: false,
                msg: "Token not specified."
            });
            return;
        } else {
            // Yes! We are at the end of the roooooooooad boys
            let code = GENERATE_CODE(6);

            try {
                let token = await db.token.findUnique({
                    where: {
                        token: req.body.token
                    },
                    include: {
                        user: true
                    }
                });

                await storage.addFile(req.file.path, code, req.file.size);
                let newSize = await storage.getFileSize(code);


                let file = await db.file.create({
                    data: {
                        filename: req.file.originalname,
                        originalSize: req.file.size,
                        compressedSize: newSize,
                        mimeType: req.file.mimetype,
                        uploaderIdentity: `${req.ip}|${req.header("User-Agent") != null ? req.header("User-Agent") : "NONE"}`,
                        code: code,
                        token: {
                            connect: {
                                token: token.token
                            }
                        },
                        user: {
                            connect: {
                                id: token.user.id
                            }
                        }
                    }
                });

                res.status(200);
                res.json({
                    ok: true,
                    msg: "File successfully created :)",
                    data: code
                });
            } catch (e) {
                console.error(e);
                await storage.deleteFile(code);
                res.json({
                    ok: false,
                    msg: "DB Error 2."
                });
            }




            if(existsSync(req.file.path))
                rmSync(req.file.path);
        }
    })

    router.get(regex, async (req, res) => {
        try {
            let file = await db.file.findUnique({
                where: {
                    code: req.params[0]
                }
            });
            if(file != null) {
                res.header("Content-Type", file.mimeType);
                //res.header("Content-Length", file.originalSize.toString());
                res.header("Transfer-Encoding", "chunked");
                res.header("Content-Encoding", "gzip");
                res.sendFile(storage.getPath(req.params[0]));
            } else {
                res.status(500);
                res.json({
                    ok: false,
                    msg: "File not found."
                })
            }
        } catch (e) {
            res.status(400);
            res.json({
                ok: false,
                msg: "DB Error."
            })
        }
    });

    return router;
}
