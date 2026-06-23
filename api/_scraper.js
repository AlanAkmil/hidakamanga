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

// Proxy list - rotasi otomatis
const PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://proxy.cors.sh/',
  'https://api.codetabs.com/v1/proxy?quest=',
];

function randomUA() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHTML(url, retries = 4) {
  // Coba langsung dulu
  for (let i = 0; i < retries; i++) {
    // Pilih proxy secara rotasi
    const proxyBase = PROXIES[i % PROXIES.length];
    const proxyUrl = proxyBase + encodeURIComponent(url);

    try {
      await delay(300 + Math.random() * 400);
      const res = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          'x-requested-with': 'XMLHttpRequest',
        },
      });
      if (res.data && typeof res.data === 'string' && res.data.length > 500) {
        return res.data;
      }
      // Kalau response JSON (allorigins format)
      if (res.data && res.data.contents) {
        return res.data.contents;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(600 * (i + 1));
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
  const dayMap = { monday: 'senin', tuesday: 'selasa', wednesday: 'rabu', thursday: 'kamis', friday: 'jumat', saturday: 'sabtu', sunday: 'minggu' };
  const targetDay = dayMap[day] || day;
  const items = [];

  // Coba berbagai selector jadwal
  $(`[data-day], .schedule-item, .kgsr`).each((_, section) => {
    const dayAttr = ($(section).attr('data-day') || '').toLowerCase();
    const dayText = $(section).find('h2, .day').text().toLowerCase();
    if (dayAttr === targetDay || dayText.includes(targetDay)) {
      $(section).find('li, .sched-anime').each((_, item) => {
        const a = $(item).find('a');
        const title = a.text().trim() || $(item).text().trim();
        const href = a.attr('href') || '';
        const img = $(item).find('img');
        const poster = img.attr('src') || img.attr('data-src') || '';
        if (title) items.push({ title, slug: slugFromUrl(href), url: href, poster });
      });
    }
  });

  // Fallback: cari section yg ada text hari
  if (!items.length) {
    $('h2, h3').each((_, h) => {
      if ($(h).text().toLowerCase().includes(targetDay)) {
        $(h).nextUntil('h2, h3').find('a').each((_, a) => {
          const title = $(a).text().trim();
          const href = $(a).attr('href') || '';
          if (title) items.push({ title, slug: slugFromUrl(href), url: href });
        });
      }
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
  const status = $('span:contains("Status:")').text().replace('Status:', '').trim()
    || $('.spe span:contains("Status")').next().text().trim();
  const studio = $('span:contains("Studio")').next('a').text().trim();
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

  const streams = [];
  $('.mirrorstream li a, .server-list a, .mirror a').each((_, el) => {
    const name = $(el).text().trim() || $(el).attr('title') || '';
    const href = $(el).attr('href') || $(el).attr('data-src') || '';
    if (href && href.startsWith('http')) {
      streams.push({ name, url: href, resolution: name.match(/\d+p/)?.[0] || '', type: 'embed' });
    }
  });

  if (!streams.length) {
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.startsWith('http')) streams.push({ name: 'Server 1', url: src, resolution: '', type: 'embed' });
    });
  }

  const downloads = [];
  const dlGroups = {};
  $('.download-eps li, .downloadchi li').each((_, el) => {
    const res = $(el).find('strong').text().trim() || 'Unknown';
    if (!dlGroups[res]) dlGroups[res] = [];
    $(el).find('a').each((_, a) => {
      dlGroups[res].push({ name: $(a).text().trim(), url: $(a).attr('href') || '' });
    });
  });
  for (const [res, mirrors] of Object.entries(dlGroups)) {
    if (mirrors.length) downloads.push({ resolution: res, mirrors });
  }

  const prevHref = $('.previous-episodes a, .navi-change a:first-child').attr('href') || '#';
  const nextHref = $('.next-episodes a, .navi-change a:last-child').attr('href') || '';
  const allHref = $('.all-episodes a').attr('href') || '';

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
