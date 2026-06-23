const { scrapeSchedule } = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const day = req.query.day || 'monday';
    const data = await scrapeSchedule(day);
    res.json({ ok: true, day, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
