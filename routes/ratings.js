import { Router } from "express";
import spotifyController from "../controllers/spotifyController.js";
import ratingsController from "../controllers/ratingsController.js";
import { asyncHandler } from "./handlers/async-handler.js";
import { checkToken } from "./handlers/check-token.js";

const ratingsRouter = Router();

ratingsRouter.get('/', checkToken, asyncHandler(spotifyController.getLatestRatings));
ratingsRouter.get('/me', checkToken, asyncHandler(spotifyController.getRatedItemsForUser));
ratingsRouter.post('/:type(albums|tracks)/:id', checkToken, asyncHandler(ratingsController.rateItem));
ratingsRouter.delete('/:type(albums|tracks)/:id', checkToken, asyncHandler(ratingsController.deleteRating));

export default ratingsRouter;