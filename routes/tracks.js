import { Router } from "express";
import spotifyController from "../controllers/spotifyController.js";
import { asyncHandler } from "./handlers/async-handler.js";
import { checkToken } from "./handlers/check-token.js";

const tracksRouter = Router();

tracksRouter.get('/top', checkToken, asyncHandler(spotifyController.getTopTracks));
tracksRouter.get('/:id', checkToken, asyncHandler(spotifyController.getTrackDetails));

export default tracksRouter;