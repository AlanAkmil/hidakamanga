const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://v2.samehadaku.how';

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

function randomUA() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHTML(url, retries = 3) {
  const proxies = [
    async (u) => {
      const r = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, { timeout: 15000 });
      return r.data?.contents;
    },
    async (u) => {
      const r = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, { timeout: 15000 });
      return r.data;
    },
    async (u) => {
      const r = await axios.get(`https://corsproxy.io/?${encodeURIComponent(u)}`, {
        timeout: 15000,
        headers: { 'User-Agent': randomUA() }
      });
      return r.data;
    },
  ];

  for (let i = 0; i < proxies.length; i++) {
    try {
      await delay(200 + Math.random() * 300);
      const html = await proxies[i](url);
      if (html && typeof html === 'string' && html.length > 200) return html;
    } catch (e) {
      if (i === proxies.length - 1) throw e;
    }
  }
  throw new Error('All proxies failed');
}

function slugFromUrl(url) {
  if (!url) return '';
  return url.replace(/https?:\/\/[^/]+\//, '').replace(/\/$/, '');
}

async function scrapeList(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const items = [];
  $('.lates-release-body .releaserec, .post-lst article, .animposx article, .animepost').each((_, el) => {
    const a = $(el).find('a').first();
    const img = $(el).find('img');
    const title = $(el).find('.title, h2').text().trim() || a.attr('title') || '';
    const href = a.attr('href') || '';
    const poster = img.attr('src') || img.attr('data-src') || '';
    const epNum = $(el).find('.latestepisode a, .eps, .ep').first().text().trim().match(/\d+/)?.[0] || '';
    const type = $(el).find('.typeserie, .type').text().trim() || 'TV';
    if (title && href) items.push({ title, slug: slugFromUrl(href), url: href, poster, episode: epNum, type });
  });
  return items;
}

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
    if (title && href) items.push({ title, slug: slugFromUrl(href), url: href, poster, rating, status, genres });
  });
  return items;
}

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

async function scrapeSchedule(day) {
  const url = `${BASE}/jadwal-rilis/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const dayMap = { monday:'senin', tuesday:'selasa', wednesday:'rabu', thursday:'kamis', friday:'jumat', saturday:'sabtu', sunday:'minggu' };
  const targetDay = dayMap[day] || day;
  const items = [];

  $('h2, h3, .day-title').each((_, h) => {
    if ($(h).text().toLowerCase().includes(targetDay)) {
      $(h).next('ul, ol, .schedule-list').find('li').each((_, li) => {
        const a = $(li).find('a');
        const title = a.text().trim();
        const href = a.attr('href') || '';
        const poster = $(li).find('img').attr('src') || '';
        if (title) items.push({ title, slug: slugFromUrl(href), url: href, poster });
      });
    }
  });

  return items;
}

async function scrapeDetail(slugOrUrl) {
  const url = slugOrUrl.startsWith('http') ? slugOrUrl : `${BASE}/anime/${slugOrUrl}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();
  const poster = $('.thumb img').first().attr('src') || $('.entry-content img').first().attr('src') || '';
  const synopsis = $('.entry-content > p').first().text().trim();
  const rating = $('[itemprop="ratingValue"], .rating strong').first().text().trim();
  const status = $('span:contains("Status")').parent().text().replace(/Status\s*:/i,'').trim().split('\n')[0].trim();
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

  return { title, poster, synopsis, rating, status, studio, type, genres, episodes };
}

async function scrapeEpisode(urlOrSlug) {
  const url = urlOrSlug.startsWith('http') ? urlOrSlug : `${BASE}/${urlOrSlug}/`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();

  const streams = [];
  $('.mirrorstream li a, .server-list a, .mirror a').each((_, el) => {
    const name = $(el).text().trim();
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

  const prevHref = $('.previous-episodes a').attr('href') || '#';
  const nextHref = $('.next-episodes a').attr('href') || '';
  const allHref = $('.all-episodes a').attr('href') || '';

  const otherEpisodes = [];
  $('#list-eps li a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const epNum = $(el).text().trim().match(/(\d+)/)?.[1] || '?';
    if (href) otherEpisodes.push({ episode: epNum, url: href });
  });

  return { title, streams, downloads, nav: { prev: prevHref, next: nextHref, all: allHref }, otherEpisodes };
}

module.exports = { scrapeList, scrapeGrid, scrapeSearch, scrapeSchedule, scrapeDetail, scrapeEpisode, BASE };