import { fetchJson as fetchJsonBase } from "./fetchJson.js";
import { chunesModel } from "./chunesModel.js";

const fetchJson = (path, options) =>
  fetchJsonBase("https://api.spotify.com/v1/" + path, options);

const createHeaders = (token) => {
  return { headers: { "Authorization": `Bearer ${token.access_token}` } };
};

const apiResult = (result) => {
  if (result instanceof Response && !result.ok) {
    // Spotify errors
    return { status: result.status, data: { ...result.data, source: "spotify" }, ok: false };
  } else if (result.status) {
    return result;
  } else {
    return { status: 200, data: result, ok: true };
  }
};

// Convert spotify track to chunes api response
const toChunesTrack = (track) => ({
  id: track.id,
  name: track.name,
  image: track.album?.images?.length > 0 ? track.album.images[0].url : undefined,
  url: track.external_urls?.spotify,
  type: track.type,
  releaseYear: track.album?.release_date ? parseInt(track.album.release_date.substring(0, 4)) : undefined,
  artists: track.album?.artists?.map(toChunesArtist),
  album: track.album && toChunesAlbum(track.album),
  previewUrl: track.preview_url
});

// Convert spotify artist to chunes api response
const toChunesArtist = (artist) => ({
  id: artist.id,
  name: artist.name,
  url: artist.external_urls?.spotify
});

// Convert spotify album to chunes api response
const toChunesAlbum = (album) => ({
  id: album.id,
  name: album.name,
  image: album.images?.length > 0 ? album.images[0].url : null,
  url: album.external_urls?.spotify,
  type: album.type,
  releaseYear: parseInt(album.release_date.substring(0, 4)),
  artists: album.artists?.map(toChunesArtist),
  tracks: album.tracks?.items.map(toChunesTrack)
});

const addLastRatingToItem = (item, rating) => {
  item.ratings = item.ratings || [];
  item.ratings.push(rating);
};

const addMyRatingToItem = (item, rating) => {
  item.myRating = rating;
};

// Returns items with ratings in the order they appeared first in the ratings list
const addRatingsToItems = ({ ratings, items, addRating = addLastRatingToItem }) => {
  const itemsByIdType = new Map(items.map(item => [item.id + item.type, item]));
  const results = [];
  const added = new Set();
  ratings.forEach((rating) => {
    const item = itemsByIdType.get(rating.itemId + rating.type);
    if (!item) return;
    addRating(item, rating);
    if (added.has(item.id)) return;
    results.push(item);
    added.add(item.id);
  });

  return results;
};

export const spotifyModel = {

  getNewReleases: async (token) => {
    const response = await fetchJson('browse/new-releases', createHeaders(token));
    if (!response.ok) {
      return apiResult(response);
    }

    const albums = response.data.albums.items.map(toChunesAlbum);

    const ratingsResult = await chunesModel.addRatingAverages({ items: albums });
    if (!ratingsResult.ok) {
      return apiResult(ratingsResult);
    }

    return apiResult(albums);
  },

  getAlbumDetails: async (token, id) => {
    const response = await fetchJson('albums/' + id, createHeaders(token));
    if (!response.data) {
      return apiResult(response);
    }

    const album = toChunesAlbum(response.data);
    album.tracks = response.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      url: track.external_urls?.spotify,
      previewUrl: track.preview_url
    }));

    const ratingAverages = await chunesModel.addRatingAverages({ items: [album] });
    if (!ratingAverages.ok) {
      return apiResult(ratingAverages);
    }

    const albumRatings = await chunesModel.getLastRatings({ items: [album], limit: 20 });
    if (!albumRatings.ok) {
      return apiResult(albumRatings);
    }
    album.ratings = albumRatings.data;

    const myRatings = await chunesModel.getLastRatings({ userId: token.userId, items: [album], limit: 1 });
    if (!myRatings.ok) {
      return apiResult(myRatings);
    }

    if (myRatings.data.length > 0) {
      album.myRating = myRatings.data[0];
    }

    return apiResult(album);
  },

  getItems: async ({ token, type, keys }) => {
    // Only 20 albums/tracks can be queried in a request: https://developer.spotify.com/documentation/web-api/reference/get-multiple-albums
    const path = type + 's'; // Spotify api is at /albumS, /trackS
    const toChunes = type === 'album' ? toChunesAlbum : toChunesTrack;
    const remainingKeys = [...keys];
    const results = [];
    // Create batches of max 20 ids
    while (remainingKeys.length > 0) {
      let countInBatch = 0;
      let batch = [];
      while (remainingKeys.length > 0 && countInBatch < 20) {
        const key = remainingKeys.pop();
        batch.push(key);
        countInBatch++;
      }

      if (batch.length == 1) {
        const response = await fetchJson(path + '/' + batch[0], createHeaders(token));
        if (response.status === 404) continue;
        if (!response.ok) return apiResult(response);
        results.push(toChunes(response.data));
      } else {
        const queryParams = new URLSearchParams({ ids: batch.join(',') });
        const response = await fetchJson(path + '?' + queryParams, createHeaders(token));
        if (response.status === 404) continue;
        if (!response.ok) return apiResult(response);
        results.push(...response.data[path].map(toChunes));
      }
    }

    return apiResult(results);
  },

  // My ratings
  getRatedItemsForUser: async (token) => {
    const myRatings = await chunesModel.getLastRatings({ userId: token.userId, limit: 1000 });
    if (!myRatings.ok) return apiResult(myRatings);

    const albumsResponse = await spotifyModel.getItems({
      token,
      type: 'album',
      keys: myRatings.data.filter(rating => rating.type === 'album').map(rating => rating.itemId)
    });
    if (!albumsResponse.ok) return apiResult(albumsResponse);
    const tracksResponse = await spotifyModel.getItems({
      token,
      type: 'track',
      keys: myRatings.data.filter(rating => rating.type === 'track').map(rating => rating.itemId)
    });
    if (!tracksResponse.ok) return apiResult(tracksResponse);

    const items = addRatingsToItems({
      ratings: myRatings.data,
      items: [...albumsResponse.data, ...tracksResponse.data],
      addRating: addMyRatingToItem
    });

    const ratingAverages = await chunesModel.addRatingAverages({ items });
    if (!ratingAverages.ok) {
      return apiResult(ratingAverages);
    }

    const lastRatings = await chunesModel.getLastRatings({ items, limit: items.length * 20 });
    if (!lastRatings.ok) return apiResult(lastRatings);
    addRatingsToItems({
      ratings: lastRatings.data,
      items,
      addRating: addLastRatingToItem
    });

    return apiResult(items);
  },

  getLatestRatings: async (token) => {
    const lastRatings = await chunesModel.getLastRatings({ limit: 50 });
    if (!lastRatings.ok) return apiResult(lastRatings);

    const albumsResponse = await spotifyModel.getItems({
      token,
      type: 'album',
      keys: lastRatings.data.filter(rating => rating.type === 'album').map(rating => rating.itemId)
    });
    if (!albumsResponse.ok) return apiResult(albumsResponse);
    const tracksResponse = await spotifyModel.getItems({
      token,
      type: 'track',
      keys: lastRatings.data.filter(rating => rating.type === 'track').map(rating => rating.itemId)
    });
    if (!tracksResponse.ok) return apiResult(tracksResponse);

    const items = addRatingsToItems({
      ratings: lastRatings.data,
      items: [...albumsResponse.data, ...tracksResponse.data],
      addRating: addLastRatingToItem
    });

    const ratingAverages = await chunesModel.addRatingAverages({ items });
    if (!ratingAverages.ok) return apiResult(ratingAverages);

    const myRatings = await chunesModel.getLastRatings({ userId: token.userId, limit: 1000 });
    if (!myRatings.ok) return apiResult(myRatings);
    addRatingsToItems({
      ratings: myRatings.data,
      items,
      addRating: addMyRatingToItem
    });


    return apiResult(items);
  },

  getTopTracks: async (token) => {
    const topTracksResponse = await fetchJson('me/top/tracks?time_range=short_term&limit=30', createHeaders(token));
    if (!topTracksResponse.ok) return apiResult(topTracksResponse);

    const tracks = topTracksResponse.data.items.map(toChunesTrack);

    const ratingAverages = await chunesModel.addRatingAverages({ items: tracks });
    if (!ratingAverages.ok) {
      return apiResult(ratingAverages);
    }

    return apiResult(tracks);
  },

  // "For you"
  getRecommendedAlbums: async (token) => {
    const topArtistResponse = await fetchJson('me/top/artists?limit=5', createHeaders(token));
    if (!topArtistResponse.ok) return apiResult(topArtistResponse);
    
    const artistKeys = topArtistResponse.data.items.map(artist => artist.id).join(',');
    const trackSearchParams = new URLSearchParams({
      limit: 50,
      seed_artists: artistKeys,
    }).toString();
    const recommendedTrackResponse = await fetchJson('recommendations?' + trackSearchParams, createHeaders(token));
    if (!recommendedTrackResponse.ok) return apiResult(recommendedTrackResponse);
    const albumsById = new Map(recommendedTrackResponse.data.tracks.map(track => [track.album.id, track.album]));
    const albums = [...albumsById.values()].map(toChunesAlbum);
    albums.sort((a, b) => b.releaseYear - a.releaseYear);

    const ratingAverages = await chunesModel.addRatingAverages({ items: albums });
    if (!ratingAverages.ok) {
      return apiResult(ratingAverages);
    }

    return apiResult(albums);
  },

  getSearchResults: async ({ token, query }) => {
    const searchParams = new URLSearchParams({
      q: query,
      limit: 50,
      type: "album,track"
    });
    const searchResponse = await fetchJson('search?' + searchParams, createHeaders(token));
    if (!searchResponse.ok) return apiResult(searchResponse);
    const tracks = searchResponse.data.tracks.items.map(toChunesTrack);
    const albums = searchResponse.data.albums.items.map(toChunesAlbum);

    const ratingAveragesResponse = await chunesModel.addRatingAverages({ items: [...albums, ...tracks] });
    if (!ratingAveragesResponse.ok) return apiResult(ratingAveragesResponse);

    const result = { albums, tracks };
    return apiResult(result);
  },

  getTrackDetails: async (token, id) => {
    const response = await fetchJson('tracks/' + id, createHeaders(token));
    if (!response.data) {
      return apiResult(response);
    }

    const track = toChunesTrack(response.data);

    const ratingAverages = await chunesModel.addRatingAverages({ items: [track] });
    if (!ratingAverages.ok) {
      return apiResult(ratingAverages);
    }

    const trackRatings = await chunesModel.getLastRatings({ items: [track], limit: 20 });
    if (!trackRatings.ok) {
      return apiResult(trackRatings);
    }
    track.ratings = trackRatings.data;

    const myRatings = await chunesModel.getLastRatings({ userId: token.userId, items: [track], limit: 1 });
    if (!myRatings.ok) {
      return apiResult(myRatings);
    }

    if (myRatings.data.length > 0) {
      track.myRating = myRatings.data[0];
    }

    return apiResult(track);
  },




}

