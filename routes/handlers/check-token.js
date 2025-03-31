import authModel from "../../models/authModel.js";

export const checkToken = (req, res, next) => {
  const authHeader = req.get('authorization');
  if (!authHeader) {
    res.status(401).send({ error: "no authorization header" });
    return;
  }

  const splitHeader = authHeader.split(' ');
  if (splitHeader[0] !== 'Bearer' || splitHeader.length !== 2) {
    res.status(401).send({ error: "wrong authorization header" });
    return;
  }

  const tokenString = splitHeader[1];
  try {
    const token = authModel.verifyToken(tokenString);
    res.locals.token = token;
    next();
  } catch (error) {
    res.status(401).send({ error: "token cannot be verified" });
  }

}