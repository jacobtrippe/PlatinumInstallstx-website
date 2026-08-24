// api/reviews.js
// Fetches live Google reviews via the Google Business Profile API (OAuth)

// Module-level cache (survives warm Vercel invocations)
let cachedData        = null;
let cacheExpiry       = 0;
let cachedAccessToken = null;
let tokenExpiry       = 0;
let cachedLocationName = null;

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry - 60_000) {
    return cachedAccessToken;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh: ${data.error} – ${data.error_description || ''} [id=${(process.env.GOOGLE_OAUTH_CLIENT_ID||'').slice(0,12)}... secret=${(process.env.GOOGLE_OAUTH_CLIENT_SECRET||'').slice(0,8)}...]`);
  cachedAccessToken = data.access_token;
  tokenExpiry       = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken;
}

// ── GBP location discovery (cached after first call) ─────────────────────────

async function getLocationName(token) {
  if (cachedLocationName) return cachedLocationName;

  const headers = { Authorization: `Bearer ${token}` };

  // 1. List accounts
  const acctRes  = await fetch('https://mybusiness.googleapis.com/v4/accounts', { headers });
  const acctData = await acctRes.json();
  if (acctData.error) throw new Error(`Accounts: ${acctData.error.message}`);
  const account  = acctData.accounts?.[0];
  if (!account)   throw new Error('No GBP accounts found for this Google login');

  // 2. List locations under the account
  const locRes  = await fetch(`https://mybusiness.googleapis.com/v4/${account.name}/locations`, { headers });
  const locData = await locRes.json();
  if (locData.error) throw new Error(`Locations: ${locData.error.message}`);
  const location = locData.locations?.[0];
  if (!location)  throw new Error('No GBP locations found under this account');

  cachedLocationName = location.name;
  return cachedLocationName;
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Cache-Control set on success only; errors must not be cached

  const now = Date.now();
  if (cachedData && now < cacheExpiry) {
    return res.status(200).json(cachedData);
  }

  try {
    const token       = await getAccessToken();
    const locationName = await getLocationName(token);

    // Fetch up to 10 most-recent reviews
    const revRes  = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=10&orderBy=updateTime%20desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const revData = await revRes.json();
    if (revData.error) throw new Error(`Reviews: ${revData.error.message}`);

    const data = {
      rating:           revData.averageRating        || 5.0,
      userRatingsTotal: revData.totalReviewCount     || 0,
      reviews: (revData.reviews || []).map(r => ({
        authorName:              r.reviewer?.displayName || 'Google Reviewer',
        rating:                  STAR_MAP[r.starRating]  || 5,
        text:                    r.comment              || '',
        relativeTimeDescription: new Date(r.createTime).toLocaleDateString('en-US', {
          month: 'long', year: 'numeric',
        }),
      })),
    };

    cachedData   = data;
    cacheExpiry  = now + 5 * 60 * 1000;

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[reviews]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
