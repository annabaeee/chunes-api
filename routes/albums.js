import { Router } from "express";
import spotifyController from "../controllers/spotifyController.js";
import { asyncHandler } from "./handlers/async-handler.js";
import { checkToken } from "./handlers/check-token.js";

const albumsRouter = Router();

albumsRouter.get('/new-releases', checkToken, asyncHandler(spotifyController.getNewReleases));
albumsRouter.get('/recommended', checkToken, asyncHandler(spotifyController.getRecommendedAlbums));
albumsRouter.get('/:id', checkToken, asyncHandler(spotifyController.getAlbumDetails));

export default albumsRouter;