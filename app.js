import express, { json, response, urlencoded } from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAPIParser from '@readme/openapi-parser';
import swaggerUI from 'swagger-ui-express';

import authRouter from './routes/auth.js';
import albumsRouter from './routes/albums.js';
import ratingsRouter from './routes/ratings.js';
import searchRouter from './routes/search.js';
import tracksRouter from './routes/tracks.js';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
app.set('port', port);

// If your app is served through a proxy
// trust the proxy to allow us to read the `X-Forwarded-*` headers
app.set("trust proxy", true);
// Disable caching
app.disable('etag');
app.disable('cache');
app.use(logger('dev'));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser());

// get the name of the root directory on the filesystem
const fsRootDir = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(fsRootDir, 'public')));

let apiDoc = await OpenAPIParser.validate('./routes/api-definition.yaml');
app.use('/api/api-docs', swaggerUI.serve, swaggerUI.setup(apiDoc));

app.use('/api/auth', authRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/search', searchRouter);

// Handles /something/something.. request for the single page app
app.use('*', (_req, res) => {
  res.sendFile(fsRootDir + '/public/index.html');
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err.stack);
  const response = process.env.NODE_ENV === "development"
    ? { message: err.message, stack: err.stack, source: "chunes" }
    : { message: "Internal server error", source: "chunes" };

  res.status(500).send(response);
})

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});

export default app;

