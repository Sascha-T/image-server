import {PrismaClient} from "@prisma/client";
import * as express from "express";
import {Router} from "express";
import {join} from "path";
import multer from "multer";
import {body, validationResult} from 'express-validator';
import argon from "argon2";
import {OBSCURE_EMAIL} from "../util";
import bodyParser from "body-parser";
import {randomBytes} from "crypto";
import {FileStorage} from "../storage";

let isSetup = false;

async function getIfSetup(db: PrismaClient): Promise<boolean> {
    try {
        let admins = await db.user.findMany({
            where: {
                isAdmin: true
            }
        });
        if (admins.length != 0)
            return true;
    } catch (e) {
        console.error(e);
    }
    return false;
}

const LOGIN_PATH = "/ui/login"
const LOGOUT_PATH = "/ui/logout"
const SETUP_PATH = "/ui/setup"
const USER_PATH = "/ui/user"

const TOKEN_PATH = "/ui/api/token"
const FILE_PATH = "/ui/api/file"
let paths = {
    LOGIN: LOGIN_PATH,
    LOGOUT: LOGOUT_PATH,
    SETUP: SETUP_PATH,
    USER: USER_PATH,
    TOKEN: TOKEN_PATH,
    FILE: FILE_PATH
}

export async function router(db: PrismaClient, storage: FileStorage) {
    let router = Router();
    let form = multer();

    isSetup = await getIfSetup(db);

    router.use(express.static(join(__dirname, '..', '..', 'static')))

    router.get("/ui/", (req, res) => {
        if (isSetup) {
            res.render("index.ejs");
        } else {
            res.redirect(SETUP_PATH);
        }
    })
    router.get(SETUP_PATH, (req, res) => {
        if (isSetup) {
            res.redirect("/");
        } else {

            res.render("setup.ejs", {
                session: req.session,
                paths
            });
            req.session["setupErrorB"] = false;
            req.session.save(console.error);
        }
    })
    router.get(LOGIN_PATH, (req, res) => {
        if (!isSetup)
            res.redirect(SETUP_PATH)
        else {
            res.render("login.ejs", {
                session: req.session,
                paths
            })
            req.session["loginErrorB"] = false;
            req.session.save(console.error);
        }
    })
    router.get(USER_PATH, async (req, res) => {
        if (!isSetup)
            res.redirect(SETUP_PATH)
        else if (req.session["loggedIn"]) {

            try {
                let userObject = await db.user.findUnique({
                    where: {
                        id: req.session["userId"]
                    },
                    include: {
                        tokens: true,
                        files: true
                    }
                })

                if (userObject == null)
                    throw "Yeah, hard pass.";

                res.render("user.ejs", {
                    session: req.session,
                    paths,
                    user: userObject,
                    email: OBSCURE_EMAIL(userObject.email)
                })
            } catch (e) {
                console.error(e);
                req.session["loggedIn"] = false;
                req.session["loginErrorB"] = true;
                req.session["loginError"] = "Something unexpected happened. Please try again later.";
                res.redirect(LOGIN_PATH);
            }
        } else
            res.redirect(LOGIN_PATH);
    });
    router.delete(FILE_PATH, bodyParser.json(), async (req, res) => {
        let id = req.body.id;
        res.status(400);
        if(id) {
            if (req.session["loggedIn"] && req.session["userId"]) {
                let files = await db.file.findMany({
                    where: {
                        id: id,
                        userId: req.session["userId"]
                    }
                });
                if(files.length == 1) {
                    try {
                        let a = await db.file.delete({
                            where: {
                                id: id
                            }
                        });
                        await storage.deleteFile(files[0].code);
                        res.status(200);
                        res.json({ok: true, msg: "Success!"})
                        return;
                    } catch (e) {
                        console.error(e);
                        res.json({ok: false, msg: "DB Error."})
                        return;
                    }
                } else {
                    res.json({ok: false, msg: "File not found."})
                    return;
                }
            }
        }
        res.json({ok: false, msg: "Not logged in."})
        return;
    })
    router.delete(TOKEN_PATH, bodyParser.json(), async (req, res) => {
        let id: number = req.body.id;
        res.status(400);
        if (id) {
            // Good.
            if (req.session["loggedIn"] && req.session["userId"]) {
                // Let's go, then :D

                try {
                    let tokens = await db.token.findMany({
                        where: {
                            id: id,
                            userId: req.session["userId"]
                        }
                    });
                    if (tokens.length == 1) {
                        let token = tokens[0];
                        let del = await db.token.delete({
                            where: {
                                id: token.id
                            }
                        });
                        res.status(200);
                        res.json({ok: false, msg: "Success!"})
                        return;
                    } else {
                        res.json({ok: false, msg: "Token not found."})
                        return;
                    }
                } catch (e) {
                    res.json({ok: false, msg: "DB Error."})
                    return;
                }
            }
        }
        res.json({ok: false, msg: "Not logged in."})
        return;
    });
    router.put(TOKEN_PATH, bodyParser.json(), async (req, res) => {
        res.status(400);
        let name = req.body.name;
        let optimizeVideo = req.body.optimizeVideo;
        let optimizeImages = req.body.optimizeImages;
        if (!optimizeVideo)
            optimizeVideo = false;
        if (!optimizeImages)
            optimizeImages = false;

        if (name) {
            // Good.
            if (req.session["loggedIn"] && req.session["userId"]) {
                // Let's go, then :D
                let random = randomBytes(16).toString("hex");
                try {
                    await db.token.create({
                        data: {
                            name,
                            optimizeImages: false,
                            optimizeVideo: false,
                            token: random,
                            userId: req.session["userId"]
                        }
                    });
                } catch (e) {
                    res.json({ok: false, msg: "DB Error"})
                    return;
                }
                res.status(200);
                res.json({ok: true, msg: "Success!"})
                return;
            }
        }
        res.json({ok: false, msg: "Not logged in."})
        return;
    });
    router.get(LOGOUT_PATH, (req, res) => {
        req.session["loggedIn"] = false;
        req.session["userId"] = undefined;
        res.redirect("/");
    })
    router.post(LOGIN_PATH,
        form.none(),
        body("email").isLength({min: 1}),
        body("password").isLength({min: 1}),
        async (req, res) => {
            let val = validationResult(req);
            if (req.session["loggedIn"]) {
                res.redirect(USER_PATH);
                return;
            }
            if (!val.isEmpty()) {
                req.session["loginErrorB"] = true;
                req.session["loginError"] = "Invalid login details.";
                res.redirect(LOGIN_PATH);
                return;
            }
            try {
                let email = req.body["email"];
                let password = req.body["password"];
                let user = await db.user.findUnique({
                    where: {
                        email
                    }
                });
                if (user != null) {
                    let yes = await argon.verify(user.password, password);
                    if (yes) {
                        req.session["userId"] = user.id;
                        req.session["loggedIn"] = true;
                        res.redirect(USER_PATH);
                        return;
                    } else {
                        throw "Failed to log in";
                    }
                } else {
                    throw "User not found";
                }
            } catch (e) {
                req.session["loginErrorB"] = true;
                req.session["loginError"] = "Invalid login details.";
                res.redirect(LOGIN_PATH);
                return;
            }

        })
    router.post(SETUP_PATH,
        form.none(),
        body("username").isLength({min: 1}),
        body("email").isEmail(),
        body("password").isLength({min: 6}),
        body("password_confirm").isLength({min: 6}),
        async (req, res) => {
            if (isSetup) {
                console.error(req.ip + " attempted to re-setup server?");
                req.session["setupErrorB"] = true;
                req.session["setupError"] = "Server is already set up.";
                res.end("Invalid request. Access violation, reporting to owner.")
                res.status(403);
                res.redirect(SETUP_PATH);
                return;
            } else {
                let val = validationResult(req);
                if (!val.isEmpty()) {
                    req.session["setupErrorB"] = true;
                    req.session["setupError"] = "Form is invalid. (Check email validity and password length)";
                    res.redirect(SETUP_PATH);
                    console.warn("Invalid setup form submitted. (0x01);")
                    return;
                } else {
                    if (req.body.password != req.body.password_confirm) {
                        req.session["setupErrorB"] = true;
                        req.session["setupError"] = "Passwords do not match.";
                        res.redirect(SETUP_PATH);
                        console.warn("Invalid setup form submitted. (0x02);")
                        return;
                    } else {
                        let hash = await argon.hash(req.body.password, {
                            timeCost: 32,
                            raw: false
                        });
                        console.log("Hashing password...");
                        try {
                            await db.user.create({
                                data: {
                                    name: req.body.username,
                                    email: req.body.email,
                                    password: hash,
                                    isAdmin: true
                                }
                            });
                            console.log("Created DB entry!");
                            isSetup = await getIfSetup(db);
                            res.redirect("/");
                            return;
                        } catch (e) {
                            console.error("DB Error:");
                            console.error(e);
                            req.session["setupErrorB"] = true;
                            req.session["setupError"] = "Database error.";
                            res.redirect(SETUP_PATH);
                            return;
                        }
                    }

                }
            }
        })

    return router;
}
