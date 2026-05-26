export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, Prefer');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const url = 'https://hrsvcelmwdlcswwagxfa.supabase.co/rest/v1/' + path;

  const response = await fetch(url, {
    method: req.method,
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w',
      'Content-Type': 'application/json',
      'Prefer': req.headers['prefer'] || 'return=representation'
    },
    body: req.method !== 'GET' && req.method !== 'DELETE' ? JSON.stringify(req.body) : undefined
  });

  const text = await response.text();
  res.status(response.status).send(text);
}
