import jwt from 'jsonwebtoken';
import { fetchJson } from './fetchJson.js';
import { URLSearchParams } from 'node:url';
import { chunesModel } from './chunesModel.js';

// Mainly from https://github.com/spotify/web-api-examples/tree/master/authorization/authorization_code

const client_id = process.env.SPOTIFY_CLIENT_ID; // your clientId
const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
//const redirect_uri = process.env.SPOTIFY_REDIRECT_URI; // Your redirect uri

const { randomBytes } = await import('node:crypto');

const generateRandomString = (length) => {
  return randomBytes(60)
    .toString('hex')
    .slice(0, length);
}

const apiResult = (result) => {
  if (result instanceof Response && !result.ok) {
    // Spotify errors
    return { status: result.status, data: {...result.data, source: "spotify"}, ok: false };
  } else {
    return { status: 200, data: result, ok: true };
  }
}

export const authModel = {
  createLoginParams: function (redirectUri) {

    const state = generateRandomString(16);
    // your application requests authorization
    var scope = 'user-top-read';
    return {
      authUrl: 'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
          response_type: 'code',
          client_id: client_id,
          scope: scope,
          redirect_uri: redirectUri,
          state: state
        }),
      state
    }
  },

  verifyToken: (tokenString) => {
    const token = jwt.verify(tokenString, client_secret);
    return token;
  },

  login: async function (loginRequest) {

    const authResponse = await fetchJson('https://accounts.spotify.com/api/token', {
      method: "POST",
      body: new URLSearchParams({
        code: loginRequest.code,
        redirect_uri: loginRequest.redirect_uri,
        grant_type: 'authorization_code'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        "Authorization": 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
      }
    });

    if (!authResponse.ok) {
      return apiResult(authResponse);
    }

    const userResponse = await fetchJson('https://api.spotify.com/v1/me', {
      headers: {
        "Authorization": `${authResponse.data.token_type} ${authResponse.data.access_token}`
      }
    });

    if (!userResponse.ok){
      return apiResult(userResponse);
    }

    const profileUrl = userResponse.data.images?.length > 0
      ? userResponse.data.images[0].url
      : null;

    const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60)

    const token = jwt.sign({
      ...authResponse.data,
      userId: userResponse.data.id,
      userName: userResponse.data.display_name ?? userResponse.data.id,
      profileUrl,
      exp: expiresAt
    }, client_secret);

    // Insert or refresh user data
    await chunesModel.upsertUser({
      id: userResponse.data.id,
      user_name: userResponse.data.display_name || userResponse.data.user_id,
      avatar_url: profileUrl });

    return apiResult({
      auth_token: token,
      profileUrl: profileUrl,
      userId: userResponse.data.id,
      displayName: userResponse.data.display_name || userResponse.data.user_id,
      expiresAt: expiresAt
    });
  }

}

export default authModel;