const { fetchHTML } = require('./_scraper');
const BASE = 'https://v2.samehadaku.how';

// Export fetchHTML temporarily for debug
const axios = require('axios');
const SCRAPER_KEY = 'faf505e9086550d5e17bde08ff977606';

async function fetchHTML(url) {
  const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}`;
  const res = await axios.get(scraperUrl, { timeout: 20000 });
  return res.data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const url = req.query.url || `${BASE}/ongoing-anime/`;
    const html = await fetchHTML(url);
    // Kirim 2000 karakter pertama buat debug
    res.json({ length: html.length, preview: html.substring(0, 3000) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};