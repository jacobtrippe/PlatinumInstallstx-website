// api/reviews.js
// Vercel serverless function — fetches live Google reviews for Platinum Installs
// Uses Google Places API (findplacefromtext + place details)

let cachedPlaceId = null;   // persists across warm invocations
let cachedData    = null;
let cacheExpiry   = 0;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set' });
  }

  // Return in-process cache if still fresh (5 min; CDN handles the rest)
  const now = Date.now();
  if (cachedData && now < cacheExpiry) {
    return res.status(200).json(cachedData);
  }

  try {
    // ── Step 1: resolve Place ID if we don't have it yet ──────────────────
    if (!cachedPlaceId) {
      const findUrl =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=%28214%29%20813-7474&inputtype=phonenumber&fields=place_id&key=${API_KEY}`;

      const findRes  = await fetch(findUrl);
      const findData = await findRes.json();

      if (findData.candidates && findData.candidates.length > 0) {
        cachedPlaceId = findData.candidates[0].place_id;
      } else {
        throw new Error(`findplacefromtext failed: ${findData.status}`);
      }
    }

    // ── Step 2: fetch reviews + aggregate rating ──────────────────────────
    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${cachedPlaceId}` +
      `&fields=reviews,rating,user_ratings_total` +
      `&key=${API_KEY}`;

    const detailsRes  = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK') {
      throw new Error(`place/details failed: ${detailsData.status}`);
    }

    const result = detailsData.result || {};
    const data = {
      rating:           result.rating            || 5.0,
      userRatingsTotal: result.user_ratings_total || 0,
      reviews: (result.reviews || []).map(r => ({
        authorName:              r.author_name,
        rating:                  r.rating,
        text:                    r.text,
        relativeTimeDescription: r.relative_time_description,
        time:                    r.time,
      })),
    };

    // Cache in process memory for 5 min
    cachedData   = data;
    cacheExpiry  = now + 5 * 60 * 1000;

    return res.status(200).json(data);

  } catch (err) {
    console.error('[reviews]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
