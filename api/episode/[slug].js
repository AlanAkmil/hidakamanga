const { scrapeEpisode } = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const slug = req.query.slug || req.query.url || '';
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });
    const data = await scrapeEpisode(slug);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
