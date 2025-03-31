
import model from "../models/authModel.js";

// Mainly from https://github.com/spotify/web-api-examples/tree/master/authorization/authorization_code

const stateKey = 'spotify_auth_state';

const authController = {
  
  createSpotifyLoginUrl: (req, res) => {
    const redirectUri = req.body.redirectUri;
    const loginParams = model.createLoginParams(redirectUri);
    const result = {
      authUrl: loginParams.authUrl
    }

    res.cookie(stateKey, loginParams.state);
    res.send(result);
  },

  login: async (req, res) => {
    // your application requests refresh and access tokens
    // after checking the state parameter

    var state = req.body.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
    res.clearCookie(stateKey);

    if (state === null || state !== storedState) {
      return res.status(401).send({ reason: "state mismatch" });
    }

    const result = await model.login(req.body);
    res.status(result.status).send(result.data);
  }

};

export default authController;

