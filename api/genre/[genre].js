const { scrapeGrid, BASE } = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const genre = req.query.genre || '';
    const page = req.query.page || 1;
    if (!genre) return res.status(400).json({ ok: false, error: 'Missing genre' });
    const data = await scrapeGrid(`${BASE}/genres/${genre}/page/${page}/`);
    res.json({ ok: true, genre, page: Number(page), data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
