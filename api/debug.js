const axios = require('axios');
const SCRAPER_KEY = 'faf505e9086550d5e17bde08ff977606';
const BASE = 'https://v2.samehadaku.how';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const url = req.query.url || `${BASE}/`;
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(scraperUrl, { timeout: 25000 });
    const html = response.data;
    res.setHeader('Content-Type', 'text/plain');
    res.send(html.substring(0, 5000));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};