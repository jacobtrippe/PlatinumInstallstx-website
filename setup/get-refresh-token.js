#!/usr/bin/env node
// One-time setup script: get a Google OAuth refresh token for the GBP API.
// Usage:
//   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy node setup/get-refresh-token.js

const http = require('http');
const { exec } = require('child_process');

const CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3456/callback';
const SCOPE         = 'https://www.googleapis.com/auth/business.manage';
const PORT          = 3456;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET before running.');
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n🔑  Opening browser for Google authorization...');
console.log('   Sign in with the Google account that manages your GBP listing.\n');
console.log('   If the browser does not open automatically, paste this URL:\n');
console.log('   ' + authUrl + '\n');

exec(`open "${authUrl}"`);

// Local server to receive the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2 style="color:red">Authorization denied: ${error}</h2>`);
    console.error('❌  Authorization denied:', error);
    server.close();
    return;
  }

  if (!code) return; // ignore favicon etc.

  // Exchange code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2 style="font-family:sans-serif">✅ Authorization complete — you can close this tab.</h2>');

    console.log('\n✅  Success!\n');
    console.log('REFRESH TOKEN:');
    console.log('──────────────────────────────────────────────────────────');
    console.log(tokens.refresh_token);
    console.log('──────────────────────────────────────────────────────────');
    console.log('\nNext: add this as GOOGLE_REFRESH_TOKEN in Vercel env vars.\n');

    server.close();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2 style="color:red">Error: ${err.message}</h2>`);
    console.error('❌  Token exchange failed:', err.message);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`   Waiting for authorization on http://localhost:${PORT} ...\n`);
});
