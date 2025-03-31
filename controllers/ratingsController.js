import { chunesModel as model, chunesModel } from "../models/chunesModel.js"; 

// Converts api request to chunes model request
const chunesRatingFrom = (req, res) => ({
  ...req.body,
  itemId: req.params.id,
  type: req.params.type === 'albums' ? 'album' : 'track',
  userId: res.locals.token.userId,
  userName: res.locals.token.userName,
  profileUrl: res.locals.token.profileUrl
});

const ratingsController = {

  rateItem: async (req, res) => {
    const rating = chunesRatingFrom(req, res);
    const result = await chunesModel.rateItem(rating);
    res.status(result.status).send(result.data);
  },

  deleteRating: async (req, res) => {
    const rating = chunesRatingFrom(req, res);
    const result = await chunesModel.deleteUserRating(rating);
    res.status(result.status).send(result.data);
  },

};

export default ratingsController;