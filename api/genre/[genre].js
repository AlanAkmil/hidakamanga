const scraper = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const genre = req.query.genre || '';
    if (!genre) return res.status(400).json({ ok:false, error:'Missing genre' });
    res.json(await scraper.genre(genre, parseInt(req.query.page)||1));
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
