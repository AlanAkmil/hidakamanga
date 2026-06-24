const scraper = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const slug = req.query.slug || '';
    if (!slug) return res.status(400).json({ ok:false, error:'Missing slug' });
    res.json(await scraper.detail(slug));
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};