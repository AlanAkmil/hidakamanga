const axios = require('axios');
const SCRAPER_KEY = 'faf505e9086550d5e17bde08ff977606';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const url = req.query.url || 'https://v2.samehadaku.how/ongoing-anime/';
    // render=true = pakai headless browser, bypass JS rendering
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}&render=true&follow_redirect=true`;
    const response = await axios.get(scraperUrl, { timeout: 30000 });
    const html = response.data;
    const bodyStart = html.indexOf('<body');
    const snippet = html.substring(bodyStart > 0 ? bodyStart : 0, (bodyStart > 0 ? bodyStart : 0) + 8000);
    res.setHeader('Content-Type', 'text/plain');
    res.send(snippet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};