import { spotifyModel as model } from "../models/spotifyModel.js";

const spotifyController = {
  getNewReleases: async (req, res) => {
    const result = await model.getNewReleases(res.locals.token);
    res.status(result.status).send(result.data);
  },
  getRecommendedAlbums: async (req, res) => {
    const result = await model.getRecommendedAlbums(res.locals.token);
    res.set('Cache-Control', 'private, max-age=60');
    res.status(result.status).send(result.data);
  },
  getAlbumDetails: async (req, res) => {
    const result = await model.getAlbumDetails(res.locals.token, req.params.id);
    res.status(result.status).send(result.data);
  },
  getTopTracks: async (req, res) => {
    const result = await model.getTopTracks(res.locals.token);
    res.status(result.status).send(result.data);
  },
  getTrackDetails: async (req, res) => {
    const result = await model.getTrackDetails(res.locals.token, req.params.id);
    res.status(result.status).send(result.data);
  },
  getRatedItemsForUser: async (req, res) => {
    const result = await model.getRatedItemsForUser(res.locals.token);
    res.status(result.status).send(result.data);
  },
  getLatestRatings: async(req, res) => {
    const result = await model.getLatestRatings(res.locals.token);
    res.status(result.status).send(result.data);
  },
  getSearhResults: async(req, res) => {
    const result = await model.getSearchResults({token: res.locals.token, query: req.query.query});
    res.status(result.status).send(result.data);
  }
};

export default spotifyController;