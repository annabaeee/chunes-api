import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ogkwiaqotzckkzkqvofd.supabase.co', process.env.SUPABASE_KEY);

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_SECRET,
})

const apiResult = (result) => {
  if (result.status && (result.error || result.status < 200 || result.status >= 300)) {
    // Supabase errors
    return { status: result.status, data: { ...(result.error ?? result.data), source: "supabase" }, ok: false };
  } else if (result.status) {
    // Supabase result
    return { status: result.status, data: result.data, ok: true };
  } else {
    // Chunes result
    return { status: 200, data: result, ok: true };
  }
}

const quoteItems = (items) => items.map(item => `"${item}"`).join(',');

// Filters the query to match the ids to the correct item types
const addItemFilters = ({ query, items }) => {
  const albums = items.filter(item => item.type === 'album').map(album => album.id);
  const tracks = items.filter(item => item.type === 'track').map(track => track.id);
  if (albums.length && tracks.length) {
    query = query.or(
      `and(item_type.eq.0, item_id.in.(${quoteItems(albums)}))`,
      `and(item_type.eq.1, item_id.in.(${quoteItems(tracks)}))`
    );
  } else if (albums.length) {
    query = query
      .eq('item_type', 0)
      .in('item_id', albums);
  } else if (tracks.length) {
    query = query
      .eq('item_type', 1)
      .in('item_id', tracks);
  }

  return query;
}

// Turns database results into api response
const toChunesRating = (rating) => ({
  id: rating.id,
  itemId: rating.item_id,
  type: rating.item_type === 0 ? 'album' : 'track',
  userId: rating.user_id,
  userName: rating.Users.user_name ?? rating.account_id,
  profileUrl: rating.Users.avatar_url,
  score: rating.score,
  review: rating.Reviews?.review,
  createdAt: rating.created_at
});

export const chunesModel = {

  deleteUserRating: async ({ userId, type, itemId }) => {
    const result = await supabase
      .from('Ratings')
      .delete()
      .eq('item_id', itemId)
      .eq('item_type', type === 'album' ? 0 : 1)
      .eq('user_id', userId);
    return apiResult(result);
  },

  rateItem: async (rating) => {
    // Upsert rating only first
    const ratings = await supabase
      .from('Ratings')
      .upsert({
        user_id: rating.userId,
        item_id: rating.itemId,
        item_type: rating.type === 'album' ? 0 : 1,
        score: rating.score,
        created_at: new Date().toISOString()
      }, { onConflict: 'item_id, item_type, user_id' })
      .select('*, Users ( user_name, avatar_url )');
    if (ratings.error) return apiResult(rating);

    const result = ratings.data.map(toChunesRating)[0];
    // If a review was written upsert it too
    if (rating.review) {
      const reviewResult = await supabase
        .from('Reviews')
        .upsert({
          id: result.id,
          review: rating.review
        });
      if (reviewResult.error) {
        return apiResult(reviewResult);
      }
      result.review = rating.review;
    } else {
      // Else delete the review (if it exists)
      const reviewResult = await supabase
        .from('Reviews')
        .delete()
        .eq('id', result.id);
      if (reviewResult.error) {
        return apiResult(reviewResult);
      }
    }

    return apiResult(result);
  },

  addRatingAverages: async ({ items }) => {
    let query = supabase.from('Ratings')
      .select(`item_id, item_type, avg_score:score.avg()`);
    query = addItemFilters({ query, items });

    const ratings = await query;
    if (ratings.error) return apiResult(ratings);

    const typeNames = ['album', 'track'];
    const ratingsById = new Map(ratings.data.map(item => [item.item_id + typeNames[item.item_type], item.avg_score]));
    items.forEach(item => item.averageScore = ratingsById.get(item.id + item.type) ?? 0);
    return apiResult(items);
  },

  getLastRatings: async ({ userId, items, limit }) => {
    let query = supabase
      .from('Ratings')
      .select('*, Users ( user_name, avatar_url ), Reviews ( review )');
    if (items) {
      query = addItemFilters({ query, items });
    }
    if (userId) {
      query = query
        .eq('user_id', userId)
    }
    query = query
      .order('created_at', { ascending: false })
      .limit(limit ?? 50);
    const ratings = await query;
    if (ratings.error) {
      return apiResult(ratings);
    }

    const result = ratings.data.map(toChunesRating);
    return apiResult(result);
  },

  upsertUser: async ({id, avatar_url, user_name}) => {
    const result = await supabase
      .from('Users')
      .upsert({
        id,
        avatar_url,
        user_name
      });
    if (result.error) return apiResult(result);
  }

}