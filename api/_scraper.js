const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://v2.samehadaku.how';

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

function randomUA() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHTML(url, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      await delay(300 + Math.random() * 500);
      const res = await axios.get(url, {
        timeout: 12000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false, keepAlive: true }),
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': BASE + '/',
          'DNT': '1',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
        },
      });
      return res.data;
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(500 * Math.pow(2, i));
    }
  }
}

// ── SLUG EXTRACTOR ──
function slugFromUrl(url) {
  if (!url) return '';
  return url.replace(/https?:\/\/[^/]+\//, '').replace(/\/$/, '');
}

// ── HOME / TERBARU ──
async function scrapeList(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  $('.lates-release-body .releaserec, .post-lst article, .animposx article, .animepost').each((_, el) => {
    const a = $(el).find('a').first();
    const img = $(el).find('img');
    const title = $(el).find('.title, h2, .mdl-ripple').text().trim() || a.attr('title') || '';
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const epText = $(el).find('.latestepisode a, .eps, .ep').first().text().trim();
    const epNum = epText.match(/\d+/)?.[0] || '';
    const type = $(el).find('.typeserie, .type').text().trim() || 'TV';
    if (title && href) {
      items.push({ title, slug: slugFromUrl(href), url: href, poster, episode: epNum, type });
    }
  });
  return items;
}

// ── ONGOING / COMPLETED ──
async function scrapeGrid(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  $('.animepost, .bs, article').each((_, el) => {
    const a = $(el).find('a').first();
    const img = $(el).find('img');
    const title = $(el).find('.title, h2, h3').first().text().trim() || a.attr('title') || '';
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const rating = $(el).find('.rating strong, .score').text().trim();
    const status = $(el).find('.typeserie, .type').text().trim() || '';
    const genres = [];
    $(el).find('.genres a, .genre a').each((_, g) => genres.push($(g).text().trim()));
    if (title && href) {
      items.push({ title, slug: slugFromUrl(href), url: href, poster, rating, status, genres });
    }
  });
  return items;
}

// ── SEARCH ──
async function scrapeSearch(q, page = 1) {
  const url = `${BASE}/?s=${encodeURIComponent(q)}&page=${page}`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  $('.animepost, article.bs').each((_, el) => {
    const a = $(el).find('a').first();
    const img = $(el).find('img');
    const title = $(el).find('.title, h2').text().trim() || '';
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const status = $(el).find('.typeserie').text().trim() || '';
    if (title && href) items.push({ title, slug: slugFromUrl(href), url: href, poster, status });
  });
  return items;
}

// ── SCHEDULE ──
async function scrapeSchedule(day) {
  const url = `${BASE}/jadwal-rilis/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const dayMap = { monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis', friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu' };
  const targetDay = dayMap[day] || day;
  const items = [];
  $('.schedule-table, .schedule-list').each((_, table) => {
    const header = $(table).find('h2, .day-title').text().trim();
    if (header.toLowerCase().includes(targetDay.toLowerCase())) {
      $(table).find('li, .sched-item').each((_, item) => {
        const a = $(item).find('a');
        const title = a.text().trim() || $(item).text().trim();
        const href = a.attr('href') || '';
        const img = $(item).find('img');
        const poster = img.attr('src') || img.attr('data-src') || '';
        if (title) items.push({ title, slug: slugFromUrl(href), url: href, poster });
      });
    }
  });
  // fallback: try section with day name
  if (!items.length) {
    $(`[data-day="${day}"], .${day}`).find('li, article').each((_, item) => {
      const a = $(item).find('a').first();
      const title = a.text().trim() || $(item).text().trim();
      const href = a.attr('href') || '';
      if (title) items.push({ title, slug: slugFromUrl(href), url: href });
    });
  }
  return items;
}

// ── DETAIL ──
async function scrapeDetail(slugOrUrl) {
  const url = slugOrUrl.startsWith('http') ? slugOrUrl : `${BASE}/anime/${slugOrUrl}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, .animasi h1, h1').first().text().trim();
  const poster = $('.thumb img, .entry-content img').first().attr('src') || '';
  const synopsis = $('.entry-content > p, .synopsis p, .sinopsis').first().text().trim();
  const rating = $('[itemprop="ratingValue"], .rating strong').first().text().trim();
  const status = $('.spe span:contains("Status"), .infoanime span:contains("Status")').next().text().trim()
    || $('span:contains("Status:")').text().replace('Status:', '').trim();
  const studio = $('span:contains("Studio"), span:contains("Produser")').next('a').text().trim();
  const type = $('span:contains("Tipe"), span:contains("Type")').next('a').text().trim();

  const genres = [];
  $('.genre-info a, .spe a[href*="genre"]').each((_, el) => genres.push($(el).text().trim()));

  const episodes = [];
  $('#list-eps li, .episodelist li, .eplister li').each((_, el) => {
    const a = $(el).find('a');
    const href = a.attr('href') || '';
    const epTitle = a.text().trim();
    const epNum = epTitle.match(/Episode\s+(\d+)/i)?.[1] || epTitle.match(/(\d+)/)?.[1] || '?';
    const date = $(el).find('.episodedate, span').last().text().trim();
    if (href) episodes.push({ episode: epNum, title: epTitle, url: href, releaseDate: date });
  });

  const recommendations = [];
  $('.related-anime article, .recom article').each((_, el) => {
    const a = $(el).find('a').first();
    const img = $(el).find('img');
    const t = $(el).find('.title').text().trim() || a.attr('title') || '';
    if (t) recommendations.push({ title: t, url: a.attr('href') || '', poster: img.attr('src') || '' });
  });

  return { title, poster, synopsis, rating, status, studio, type, genres, episodes, recommendations };
}

// ── EPISODE ──
async function scrapeEpisode(urlOrSlug) {
  const url = urlOrSlug.startsWith('http') ? urlOrSlug : `${BASE}/${urlOrSlug}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();

  // Streams from mirror/server buttons
  const streams = [];
  $('.mirrorstream li a, .server-list a, [data-src], .mirror a').each((_, el) => {
    const name = $(el).text().trim() || $(el).attr('title') || '';
    const href = $(el).attr('href') || $(el).attr('data-src') || '';
    if (href && href.startsWith('http')) {
      streams.push({ name, url: href, resolution: name.match(/\d+p/)?.[0] || '', type: 'embed' });
    }
  });

  // Fallback: iframes
  if (!streams.length) {
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.startsWith('http')) streams.push({ name: 'Server 1', url: src, resolution: '', type: 'embed' });
    });
  }

  // Downloads
  const downloads = [];
  const dlGroups = {};
  $('.download-eps li, .downloadchi li, .dl-res').each((_, el) => {
    const res = $(el).find('strong, .res').text().trim() || 'Unknown';
    if (!dlGroups[res]) dlGroups[res] = [];
    $(el).find('a').each((_, a) => {
      dlGroups[res].push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
    });
  });
  for (const [res, mirrors] of Object.entries(dlGroups)) {
    if (mirrors.length) downloads.push({ resolution: res, mirrors });
  }

  // Nav
  const prevHref = $('.previous-episodes a, .navi-change a:first-child').attr('href') || '#';
  const nextHref = $('.next-episodes a, .navi-change a:last-child').attr('href') || '';
  const allHref = $('.all-episodes a, .navi-change .alleps').attr('href') || '';

  // Other episodes
  const otherEpisodes = [];
  $('#list-eps li a, .other-episode li a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const epNum = $(el).text().trim().match(/(\d+)/)?.[1] || '?';
    const date = $(el).closest('li').find('.episodedate').text().trim();
    if (href) otherEpisodes.push({ episode: epNum, url: href, releaseDate: date });
  });

  return { title, streams, downloads, nav: { prev: prevHref, next: nextHref, all: allHref }, otherEpisodes };
}

module.exports = { scrapeList, scrapeGrid, scrapeSearch, scrapeSchedule, scrapeDetail, scrapeEpisode, BASE };
