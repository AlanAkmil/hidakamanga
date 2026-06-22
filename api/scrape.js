const OtakuDesuScraper = require('../lib/scraper');

const scraper = new OtakuDesuScraper();

function extractSlug(url, base) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/|\/$/g, '').split('/');
    return parts[parts.length - 1] || null;
  } catch {
    return url.replace(/^\/|\/$/g, '').split('/').pop() || null;
  }
}

function extractEpSlugAndNum(url) {
  if (!url) return { slug: null, num: null };
  try {
    const u = new URL(url);
    const path = u.pathname; // /episode/slug-episode-1-sub-indo/
    const match = path.match(/\/episode\/(.+?)-episode-(\d+)-sub-indo/i);
    if (match) return { slug: match[1], num: parseInt(match[2]) };
  } catch {}
  // fallback: raw string
  const match = url.match(/\/episode\/(.+?)-episode-(\d+)-sub-indo/i);
  if (match) return { slug: match[1], num: parseInt(match[2]) };
  return { slug: null, num: null };
}

// Normalize scraper output to what index.html expects:
// { data: { items: [...], next: url|null } }
// or { data: { ...detail fields } }
// or { data: { ...episode fields } }

function normalizeList(scraperResult, page) {
  const d = scraperResult?.data || {};
  const raw = d.items || [];
  const items = raw.map(a => ({
    title: a.title || '',
    link: a.link || '',
    poster: a.img || a.poster || '',
    episode: a.eps || a.episode || '',
    rating: a.score || a.rating || '',
    type: a.type || 'TV',
    sub: a.sub || 'Sub Indo',
    status: a.status || '',
    description: a.description || '',
  }));
  return {
    data: {
      items,
      next: d.pagination?.hasNext ? d.pagination.next || true : null,
      page: d.pagination?.current || page,
      total: d.pagination?.total || null,
    }
  };
}

function normalizeDetail(scraperResult) {
  const d = scraperResult?.data || {};
  const info = d.info || {};

  // Map info keys (bisa bahasa indo/inggris tergantung situs)
  const get = (...keys) => {
    for (const k of keys) {
      const found = Object.keys(info).find(ik => ik.toLowerCase().includes(k.toLowerCase()));
      if (found) return info[found];
    }
    return null;
  };

  const genres = [];
  const genreKey = Object.keys(info).find(k => k.toLowerCase().includes('genre'));
  if (genreKey) {
    info[genreKey].split(',').forEach(g => { const t = g.trim(); if (t) genres.push(t); });
  }

  const episodes = (d.episodes || []).map((ep, i) => {
    const { slug, num } = extractEpSlugAndNum(ep.url);
    const epNum = num || (d.episodes.length - i);
    return {
      title: ep.title || `Episode ${epNum}`,
      number: epNum,
      url: ep.url || '',
      date: ep.releaseDate || '',
    };
  });

  return {
    data: {
      title: d.title || '',
      poster: get('poster', 'image') || '',
      synopsis: get('sinopsis', 'synopsis', 'deskripsi') || d.synopsis || '',
      rating: d.score || get('score', 'rating', 'skor') || '',
      status: get('status') || '',
      type: get('tipe', 'type', 'jenis') || '',
      studio: get('studio', 'produser') || '',
      released: get('dirilis', 'released', 'tahun', 'year') || '',
      duration: get('durasi', 'duration') || '',
      season: get('season', 'musim') || '',
      totalEps: get('total episode', 'episodes', 'total ep') || episodes.length || '',
      genres,
      episodes,
      firstEpisode: episodes.length ? { url: episodes[episodes.length - 1].url } : null,
    }
  };
}

function normalizeEpisode(scraperResult) {
  const d = scraperResult?.data || {};

  // Cari embed URL terbaik: prioritas 720p > 480p > 360p, server acefile > mega > kfiles
  let iframeUrl = d.defaultPlayer || null;
  const serverPriority = ['acefile', 'mega', 'kfiles'];
  const qualityPriority = ['720', '480', '1080', '360'];

  const embedPlayers = d.embedPlayers || [];

  // Cari embed terbaik
  outer:
  for (const q of qualityPriority) {
    for (const srv of serverPriority) {
      for (const qBlock of embedPlayers) {
        if (qBlock.quality && qBlock.quality.includes(q)) {
          const found = (qBlock.servers || []).find(s =>
            s.server?.toLowerCase().includes(srv) && s.embedUrl
          );
          if (found) { iframeUrl = found.embedUrl; break outer; }
        }
      }
    }
  }

  // Fallback: ambil embed pertama yang ada
  if (!iframeUrl && embedPlayers.length) {
    for (const qBlock of embedPlayers) {
      if (qBlock.servers?.length) {
        iframeUrl = qBlock.servers[0].embedUrl || null;
        if (iframeUrl) break;
      }
    }
  }

  // Build mirrors list untuk semua server yang tersedia
  const mirrors = [];
  for (const qBlock of embedPlayers) {
    for (const srv of (qBlock.servers || [])) {
      if (srv.embedUrl) {
        mirrors.push({
          label: `${srv.server} ${qBlock.quality}`,
          iframeUrl: srv.embedUrl,
        });
      }
    }
  }

  return {
    data: {
      title: d.title || '',
      poster: d.poster || '',
      iframeUrl,
      videoUrl: iframeUrl,
      mirrors,
      prevEpisode: d.prevEpisode || null,
      nextEpisode: d.nextEpisode || null,
      downloadLinks: d.downloadLinks || [],
    }
  };
}

function normalizeSchedule(scraperResult) {
  const d = scraperResult?.data || {};
  const raw = d.schedule || {};
  // Normalize key hari ke lowercase
  const schedule = {};
  for (const [day, items] of Object.entries(raw)) {
    const key = day.toLowerCase().replace(/['']/g, "'");
    schedule[key] = (items || []).map(a => ({
      title: a.title || '',
      link: a.link || '',
      poster: a.img || a.poster || '',
      time: a.time || '',
    }));
  }
  return { data: { schedule } };
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, page = 1, query, genre, url } = req.query;
  const pageNum = parseInt(page) || 1;

  try {
    let result;

    switch (action) {

      case 'home':
        result = normalizeList(await scraper.home(pageNum), pageNum);
        break;

      case 'new':
        result = normalizeList(await scraper.terbaru(pageNum), pageNum);
        break;

      case 'ongoing':
        result = normalizeList(await scraper.ongoing(pageNum), pageNum);
        break;

      case 'complete':
        result = normalizeList(await scraper.complete(pageNum), pageNum);
        break;

      case 'top':
        // Otakudesu ga ada endpoint "top rating" tersendiri,
        // fallback ke complete page 1 sorted — atau bisa diganti ongoing
        result = normalizeList(await scraper.complete(pageNum), pageNum);
        break;

      case 'search': {
        if (!query) return res.status(400).json({ error: 'query required' });
        result = normalizeList(await scraper.search(query, pageNum), pageNum);
        break;
      }

      case 'genre': {
        if (!genre) return res.status(400).json({ error: 'genre required' });
        result = normalizeList(await scraper.genre(genre, pageNum), pageNum);
        break;
      }

      case 'schedule': {
        result = normalizeSchedule(await scraper.jadwalRilis());
        break;
      }

      case 'detail': {
        if (!url) return res.status(400).json({ error: 'url required' });
        const slug = extractSlug(url, scraper.baseUrl);
        if (!slug) return res.status(400).json({ error: 'invalid url' });
        result = normalizeDetail(await scraper.detail(slug));
        break;
      }

      case 'episode': {
        if (!url) return res.status(400).json({ error: 'url required' });
        const { slug, num } = extractEpSlugAndNum(url);
        if (!slug || !num) return res.status(400).json({ error: 'invalid episode url' });
        result = normalizeEpisode(await scraper.episode(slug, num));
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('[scrape.js error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
