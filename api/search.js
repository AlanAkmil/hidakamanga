const scraper = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!req.query.q) return res.status(400).json({ ok:false, error:'Missing query' });
    res.json(await scraper.search(req.query.q));
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
