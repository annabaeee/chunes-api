import { Router } from "express";
import authController from "../controllers/authController.js";
import { asyncHandler } from "./handlers/async-handler.js";
const authRouter = Router();

authRouter.post('/spotify-auth-url', authController.createSpotifyLoginUrl);
authRouter.post('/login', asyncHandler(authController.login));
//authRouter.post('/refresh', checkToken, asyncHandler(authController.refresh));

export default authRouter;