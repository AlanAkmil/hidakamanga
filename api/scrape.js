const AnimekuindoScraper = require('../lib/scraper');

const scraper = new AnimekuindoScraper();

// CORS helper
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, query, page, slug, url, genre } = req.query;
  const pageNum = parseInt(page) || 1;

  try {
    let result;

    switch (action) {
      case 'home':
        result = await scraper.home(pageNum);
        break;

      case 'new':
        result = await scraper.new(pageNum);
        break;

      case 'top':
        result = await scraper.top(pageNum);
        break;

      case 'search':
        if (!query) return res.status(400).json({ error: 'query param required' });
        result = await scraper.search(query, pageNum);
        break;

      case 'genres':
        result = await scraper.genresList();
        break;

      case 'genre':
        if (!genre) return res.status(400).json({ error: 'genre param required' });
        result = await scraper.genre(genre, pageNum);
        break;

      case 'schedule':
        result = await scraper.schedule();
        break;

      case 'detail':
        if (!slug && !url) return res.status(400).json({ error: 'slug or url param required' });
        result = await scraper.detail(url || slug);
        break;

      case 'episode':
        if (!url) return res.status(400).json({ error: 'url param required' });
        result = await scraper.episode(url);
        break;

      default:
        return res.status(400).json({
          error: 'Invalid action',
          available: ['home', 'new', 'top', 'search', 'genres', 'genre', 'schedule', 'detail', 'episode']
        });
    }

    // Cache 5 menit untuk home/new/top, 1 jam untuk detail
    const cacheTime = ['home', 'new', 'top'].includes(action) ? 300 : 3600;
    res.setHeader('Cache-Control', `s-maxage=${cacheTime}, stale-while-revalidate`);

    return res.status(200).json(result);

  } catch (err) {
    console.error(`[API Error] action=${action}`, err.message);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      action,
      timestamp: new Date().toISOString()
    });
  }
}; 