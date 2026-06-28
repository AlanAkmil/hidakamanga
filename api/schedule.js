const scraper = require('./_scraper');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const result = await scraper.schedule();
    const day = req.query.day;
    if (day) {
      const dayMap = {monday:'Senin',tuesday:'Selasa',wednesday:'Rabu',thursday:'Kamis',friday:'Jumat',saturday:'Sabtu',sunday:'Minggu'};
      const key = dayMap[day]||day;
      const items = result.data[key]||result.data[Object.keys(result.data).find(k=>k.toLowerCase().includes(day))]||[];
      return res.json({ok:true,day,data:items});
    }
    res.json(result);
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
};
