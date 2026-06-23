const { scrapeList, BASE } = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const page = req.query.page || 1;
    const data = await scrapeList(`${BASE}/terbaru/page/${page}/`);
    res.json({ ok: true, page: Number(page), data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
