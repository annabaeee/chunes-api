import { Router } from "express";
import spotifyController from "../controllers/spotifyController.js";
import { asyncHandler } from "./handlers/async-handler.js";
import { checkToken } from "./handlers/check-token.js";

const searchRouter = Router();

searchRouter.get('/', checkToken, asyncHandler(spotifyController.getSearhResults));

export default searchRouter;