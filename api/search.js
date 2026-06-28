const scraper = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const q = req.query.q||'';
    if (!q) return res.status(400).json({ok:false,error:'Missing query'});
    res.json(await scraper.search(q, parseInt(req.query.page)||1));
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
};
