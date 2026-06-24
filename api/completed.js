const scraper = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try { res.json(await scraper.complete(parseInt(req.query.page)||1)); }
  catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
