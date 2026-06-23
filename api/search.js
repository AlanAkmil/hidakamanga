const { scrapeSearch } = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const q = req.query.q || '';
    const page = req.query.page || 1;
    if (!q) return res.status(400).json({ ok: false, error: 'Missing query' });
    const data = await scrapeSearch(q, page);
    res.json({ ok: true, query: q, page: Number(page), data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
