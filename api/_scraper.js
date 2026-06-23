const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://v2.samehadaku.how';
const SCRAPER_KEY = 'faf505e9086550d5e17bde08ff977606';

async function fetchHTML(url, retries = 3) {
  const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}&render=false`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(scraperUrl, { timeout: 25000 });
      if (res.data && typeof res.data === 'string' && res.data.length > 200) return res.data;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw new Error('fetchHTML failed');
}

function slugFromUrl(url) {
  if (!url) return '';
  return url.replace(/https?:\/\/[^/]+\//, '').replace(/\/$/, '');
}

function cleanTitle(t) {
  if (!t) return '';
  // Hapus duplikat: "Naruto KecilNaruto Kecil" → "Naruto Kecil"
  const half = Math.ceil(t.length / 2);
  const first = t.substring(0, half).trim();
  const second = t.substring(half).trim();
  if (second.startsWith(first) || first === second) return first;
  return t.trim();
}

// ── HOME / TERBARU ──
// Selector: ul li dengan h2 a (title) + img + "Episode X"
async function scrapeList(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  // Homepage: section "Anime Terbaru" → ul > li
  $('ul li').each((_, el) => {
    const a = $(el).find('h2 a, a').first();
    const img = $(el).find('img');
    const title = cleanTitle(a.attr('title') || a.text().trim());
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const epText = $(el).find('strong, b').first().text().trim();
    const epNum = epText.match(/\d+/)?.[0] || '';
    if (title && href && href.includes('/anime/')) {
      items.push({ title, slug: slugFromUrl(href), url: href, poster, episode: epNum, type: 'TV' });
    }
  });
  return items;
}

// ── ONGOING / COMPLETED / GENRE ──
async function scrapeGrid(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  // Samehadaku daftar anime: artikel/li dengan gambar dan judul
  $('ul li, .animepost, article').each((_, el) => {
    const a = $(el).find('h2 a, h3 a, a[href*="/anime/"]').first();
    const img = $(el).find('img');
    const title = cleanTitle(a.attr('title') || a.text().trim());
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const rating = $(el).find('.score, .rating strong').text().trim();
    const genres = [];
    $(el).find('a[href*="/genre/"]').each((_, g) => genres.push($(g).text().trim()));
    if (title && href && href.includes('/anime/')) {
      items.push({ title, slug: slugFromUrl(href), url: href, poster, rating, genres });
    }
  });
  // dedupe by url
  const seen = new Set();
  return items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
}

// ── SEARCH ──
async function scrapeSearch(q, page = 1) {
  const url = `${BASE}/?s=${encodeURIComponent(q)}&page=${page}`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  $('ul li, .animepost, article').each((_, el) => {
    const a = $(el).find('h2 a, a[href*="/anime/"]').first();
    const img = $(el).find('img');
    const title = cleanTitle(a.attr('title') || a.text().trim());
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    if (title && href && href.includes('/anime/')) {
      items.push({ title, slug: slugFromUrl(href), url: href, poster });
    }
  });
  const seen = new Set();
  return items.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
}

// ── SCHEDULE ──
async function scrapeSchedule(day) {
  const url = `${BASE}/jadwal-rilis/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const dayMap = { monday:'senin', tuesday:'selasa', wednesday:'rabu', thursday:'kamis', friday:'jumat', saturday:'sabtu', sunday:'minggu' };
  const targetDay = dayMap[day] || day;
  const items = [];

  $('h2, h3').each((_, h) => {
    if ($(h).text().toLowerCase().includes(targetDay)) {
      $(h).nextUntil('h2, h3').find('a[href*="/anime/"]').each((_, a) => {
        const title = cleanTitle($(a).attr('title') || $(a).text().trim());
        const href = $(a).attr('href') || '';
        const poster = $(a).find('img').attr('src') || '';
        if (title) items.push({ title, slug: slugFromUrl(href), url: href, poster });
      });
    }
  });

  return items;
}

// ── DETAIL ──
async function scrapeDetail(slugOrUrl) {
  const url = slugOrUrl.startsWith('http') ? slugOrUrl : `${BASE}/anime/${slugOrUrl}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();
  const poster = $('.thumb img, .poster img').first().attr('src')
    || $('img[src*="wp-content/uploads"]').first().attr('src') || '';
  const synopsis = $('p').filter((_, el) => $(el).text().length > 100).first().text().trim();
  const rating = $('[itemprop="ratingValue"], .score, .rating strong').first().text().trim();

  // Info dari tabel/list info anime
  const infoText = $('.infox, .spe, .info').text();
  const statusMatch = infoText.match(/Status[:\s]+([^\n]+)/i);
  const studioMatch = infoText.match(/Studio[:\s]+([^\n]+)/i);
  const typeMatch = infoText.match(/Type[:\s]+([^\n]+)/i);

  const genres = [];
  $('a[href*="/genre/"]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  const episodes = [];
  $('#list-eps li, .episodelist li, .eplister li, ul li').each((_, el) => {
    const a = $(el).find('a[href*="-episode-"]');
    if (!a.length) return;
    const href = a.attr('href') || '';
    const epTitle = cleanTitle(a.attr('title') || a.text().trim());
    const epNum = href.match(/episode-(\d+)/i)?.[1] || epTitle.match(/(\d+)/)?.[1] || '?';
    const date = $(el).find('.episodedate, span').last().text().trim();
    if (href) episodes.push({ episode: epNum, title: epTitle, url: href, releaseDate: date });
  });

  return {
    title,
    poster,
    synopsis,
    rating,
    status: statusMatch?.[1]?.trim() || '',
    studio: studioMatch?.[1]?.trim() || '',
    type: typeMatch?.[1]?.trim() || '',
    genres,
    episodes
  };
}

// ── EPISODE ──
async function scrapeEpisode(urlOrSlug) {
  const url = urlOrSlug.startsWith('http') ? urlOrSlug : `${BASE}/${urlOrSlug}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();

  const streams = [];
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.startsWith('http')) {
      const name = src.includes('vidhide') ? 'Vidhide' : src.includes('pixeldrain') ? 'Pixeldrain' : src.includes('wibufile') ? 'Wibufile' : 'Server';
      streams.push({ name, url: src, resolution: '', type: 'embed' });
    }
  });

  $('a[href*="vidhide"], a[href*="pixeldrain"], a[href*="wibufile"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim() || 'Mirror';
    const res = name.match(/\d+p/)?.[0] || '';
    if (href) streams.push({ name, url: href, resolution: res, type: 'embed' });
  });

  const downloads = [];
  const dlGroups = {};
  $('.download-eps li, .downloadchi li, li').each((_, el) => {
    const strong = $(el).find('strong').text().trim();
    if (!strong.match(/\d+p/i)) return;
    if (!dlGroups[strong]) dlGroups[strong] = [];
    $(el).find('a').each((_, a) => {
      const name = $(a).text().trim();
      const href = $(a).attr('href') || '';
      if (href && name) dlGroups[strong].push({ name, url: href });
    });
  });
  for (const [res, mirrors] of Object.entries(dlGroups)) {
    if (mirrors.length) downloads.push({ resolution: res, mirrors });
  }

  const prevHref = $('a[href*="-episode-"]:contains("Prev"), .prev-ep a').attr('href') || '#';
  const nextHref = $('a[href*="-episode-"]:contains("Next"), .next-ep a').attr('href') || '';
  const allHref = $('a[href*="/anime/"]:contains("All"), .all-ep a').attr('href') || '';

  const otherEpisodes = [];
  $('a[href*="-episode-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const epNum = href.match(/episode-(\d+)/i)?.[1] || '?';
    if (href && !otherEpisodes.find(e => e.url === href)) {
      otherEpisodes.push({ episode: epNum, url: href });
    }
  });

  return { title, streams, downloads, nav: { prev: prevHref, next: nextHref, all: allHref }, otherEpisodes };
}

module.exports = { fetchHTML, scrapeList, scrapeGrid, scrapeSearch, scrapeSchedule, scrapeDetail, scrapeEpisode, BASE };
