const scraper = require('../_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const data = await scraper.jadwal();
    const dayMap = { monday:'Senin', tuesday:'Selasa', wednesday:'Rabu', thursday:'Kamis', friday:'Jumat', saturday:'Sabtu', sunday:'Minggu' };
    const day = req.query.day || 'monday';
    const key = dayMap[day] || day;
    const result = data.data[key] || data.data[Object.keys(data.data).find(k=>k.toLowerCase().includes(day))] || [];
    res.json({ ok:true, day, data: result });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
