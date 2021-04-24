import { PrismaClient } from "@prisma/client";
import express from "express";
import {router as imageRouter} from "./routers/images";
import {router as uiRouter} from "./routers/ui";
import * as bodyParser from "body-parser";
import { join } from "path";
import rmrf from "rimraf";
import session from "express-session";
import {FileStorage} from "./storage";
let prisma = new PrismaClient();
let storage = new FileStorage(join(__dirname, "..", "storage"));


let app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '..', 'views'));
app.set('trust proxy', 1);

app.use(session({
    secret: "ourhardworkbythesewordsguardedpleasedontsteal(c)sascha"
}))
app.use(bodyParser.urlencoded({ extended: true }))
async function main() {
    rmrf.sync(join(__dirname, "..", "tmp"));

    app.use(await imageRouter(prisma, storage));

    app.get("/", (req, res) => {
        res.redirect("ui/");
    })
    app.use(await uiRouter(prisma, storage));

}

app.listen(8080,() => {
    console.log("Listening on :8080");
    main();
})
