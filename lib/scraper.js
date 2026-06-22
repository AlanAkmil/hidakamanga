const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://s2.animekuindo.life';
let uaIndex = 0;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
];

function getHeaders(referer) {
  const ua = userAgents[uaIndex % userAgents.length];
  uaIndex++;
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer || BASE_URL + '/',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="131", "Chromium";v="131"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0'
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Retry dengan exponential backoff + random delay (jitter) ala animekuindo.js
async function fetchHTML(url, attempt = 1) {
  const MAX_ATTEMPTS = 3; // dijaga kecil supaya gak nabrak time limit serverless function
  try {
    const response = await axios({
      url,
      method: 'GET',
      headers: getHeaders(url),
      timeout: 8000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      maxRedirects: 5,
      decompress: true,
      validateStatus: status => status >= 200 && status < 400
    });
    return response.data;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    const backoff = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, ...
    const jitter = Math.random() * 300;
    await sleep(backoff + jitter);
    return fetchHTML(url, attempt + 1);
  }
}

function clean(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const cleaned = obj.map(i => clean(i)).filter(i => i !== undefined);
    return cleaned.length ? cleaned : undefined;
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      const val = clean(obj[key]);
      if (val !== undefined) result[key] = val;
    }
    return Object.keys(result).length ? result : undefined;
  }
  return obj;
}

function decodeBase64Iframe(encoded) {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const match = decoded.match(/src=["']([^"']*)["']/);
    if (match) return match[1];
    return null;
  } catch {
    return null;
  }
}

class AnimekuindoScraper {
  constructor() {
    this.creator = 'rynaqrtz';
    this.baseUrl = BASE_URL;
  }

  async list(url) {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const items = [];
    $('article.bs').each((i, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const link = linkEl.attr('href');
      const title = $el.find('.tt').text().trim() || linkEl.attr('title') || '';
      if (!link || !title) return;

      const poster = $el.find('img').first().attr('src') || null;
      const status = $el.find('.status').text().trim() || null;
      const type = $el.find('.typez').text().trim() || null;
      const epx = $el.find('.bt .epx').text().trim() || null;
      const sub = $el.find('.bt .sb').text().trim() || null;

      items.push({
        title,
        link: link.startsWith('http') ? link : this.baseUrl + link,
        poster,
        status,
        type,
        episode: epx,
        sub
      });
    });

    let next = null;
    const nextEl = $('.pagination .next, a.next.page-numbers');
    if (nextEl.length) next = nextEl.attr('href');

    const currentPage = parseInt($('.pagination .current, .page-numbers.current').text()) || 1;

    return clean({
      creator: this.creator,
      page: 'list',
      data: {
        url,
        count: items.length,
        currentPage,
        items,
        next: next ? (next.startsWith('http') ? next : this.baseUrl + next) : null
      }
    });
  }

  async home(page = 1) {
    const url = page === 1 ? this.baseUrl + '/' : this.baseUrl + `/page/${page}/`;
    return this.list(url);
  }

  async new(page = 1) {
    const url = page === 1 ? this.baseUrl + '/anime-baru-dirilis/' : this.baseUrl + `/anime-baru-dirilis/page/${page}/`;
    return this.list(url);
  }

  async top(page = 1) {
    const url = page === 1 ? this.baseUrl + '/top-rating/' : this.baseUrl + `/top-rating/page/${page}/`;
    return this.list(url);
  }

  async search(query, page = 1) {
    const url = page === 1
      ? this.baseUrl + `/?s=${encodeURIComponent(query)}`
      : this.baseUrl + `/page/${page}/?s=${encodeURIComponent(query)}`;
    return this.list(url);
  }

  async genresList() {
    const html = await fetchHTML(this.baseUrl + '/genres/');
    const $ = cheerio.load(html);
    const items = [];
    $('ul.taxindex li a').each((i, el) => {
      const $el = $(el);
      const name = $el.find('.name').text().trim();
      const count = $el.find('.count').text().trim();
      const link = $el.attr('href');
      if (name && link) {
        items.push({
          name,
          count: count ? parseInt(count) : null,
          link: link.startsWith('http') ? link : this.baseUrl + link
        });
      }
    });
    return clean({
      creator: this.creator,
      page: 'genres_list',
      data: { url: this.baseUrl + '/genres/', count: items.length, items }
    });
  }

  async genre(slug, page = 1) {
    const url = page === 1
      ? this.baseUrl + `/genres/${slug}/`
      : this.baseUrl + `/genres/${slug}/page/${page}/`;
    return this.list(url);
  }

  async schedule() {
    const html = await fetchHTML(this.baseUrl + '/jadwal/');
    const $ = cheerio.load(html);
    const schedule = {};

    $('.schedulepage').each((i, el) => {
      const $el = $(el);
      const dayHeader = $el.find('.releases h3 span').text().trim();
      if (!dayHeader) return;
      const day = dayHeader.toLowerCase();

      const items = [];
      $el.find('.bs').each((j, item) => {
        const $item = $(item);
        const linkEl = $item.find('a').first();
        const link = linkEl.attr('href');
        const title = $item.find('.tt').text().trim() || '';
        const time = $item.find('.cndwn').text().trim() || null;
        const img = $item.find('img').first().attr('src') || null;
        if (link) {
          items.push({
            title,
            link: link.startsWith('http') ? link : this.baseUrl + link,
            time,
            poster: img
          });
        }
      });
      schedule[day] = items;
    });

    return clean({
      creator: this.creator,
      page: 'schedule',
      data: { url: this.baseUrl + '/jadwal/', schedule }
    });
  }

  async detail(slug) {
    let url = slug.startsWith('http') ? slug : this.baseUrl + '/anime/' + slug.replace(/^\/+/, '');

    // Kalau URL adalah halaman episode (bukan /anime/slug/), ambil link seri dari sana dulu
    const looksLikeEpisode = slug.startsWith('http') && !slug.includes('/anime/');
    if (looksLikeEpisode) {
      try {
        const epHtml = await fetchHTML(url);
        const $ep = cheerio.load(epHtml);
        let seriesLink = null;
        // Cari link /anime/slug/ di breadcrumb atau seriestitle
        $ep('.seriestitle a, .breadcrumb a, #crumbs a, .nvs a, .infolimit a').each((i, el) => {
          const href = ($ep(el).attr('href') || '');
          const full = href.startsWith('http') ? href : this.baseUrl + href;
          if (/\/anime\/[a-z0-9-]+\/$/.test(full) && !seriesLink) {
            seriesLink = full;
            return false;
          }
        });
        // Fallback: scan semua link di halaman
        if (!seriesLink) {
          $ep('a[href]').each((i, el) => {
            const href = ($ep(el).attr('href') || '');
            const full = href.startsWith('http') ? href : this.baseUrl + href;
            if (/\/anime\/[a-z0-9][a-z0-9-]+\/$/.test(full) && !seriesLink) {
              seriesLink = full;
              return false;
            }
          });
        }
        if (seriesLink) url = seriesLink;
      } catch (e) { /* pakai url asli kalau gagal */ }
    }

    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title').text().trim() || $('h1[itemprop="name"]').text().trim() || '';
    const poster = $('.thumb img, .thumbook .thumb img').first().attr('src') || null;

    let rating = null;
    const ratingText = $('.rating strong').text().trim();
    if (ratingText) {
      const match = ratingText.match(/([\d.]+)/);
      if (match) rating = parseFloat(match[1]);
    }

    const info = {};
    $('.spe span').each((i, el) => {
      const text = $(el).text().trim();
      const parts = text.split(':');
      if (parts.length >= 2) {
        const label = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();
        if (label && value) info[label] = value;
      }
    });

    const status = info['status'] || null;
    const studio = info['studio'] || null;
    const released = info['dirilis'] || null;
    const duration = info['durasi'] || null;
    const season = info['season'] || null;
    const country = info['negara'] || null;
    const type = info['tipe'] || null;
    const totalEps = info['episode'] || null;
    const producers = info['producers'] || null;
    const casts = info['casts'] || null;

    const genres = [];
    $('.genxed a').each((i, el) => {
      genres.push($(el).text().trim());
    });

    let synopsis = null;
    $('.desc, .synopsis, .entry-content p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 50 && !text.includes('Show more')) {
        synopsis = text;
        return false;
      }
    });

    const episodes = [];
    $('.eplister ul li a').each((i, el) => {
      const $el = $(el);
      const link = $el.attr('href');
      const num = $el.find('.epl-num').text().trim() || null;
      const title = $el.find('.epl-title').text().trim() || null;
      const date = $el.find('.epl-date').text().trim() || null;
      if (link) {
        episodes.push({
          number: num,
          title,
          url: link.startsWith('http') ? link : this.baseUrl + link,
          date
        });
      }
    });

    const firstEp = episodes.length > 0 ? episodes[episodes.length - 1] : null;
    const lastEp = episodes.length > 0 ? episodes[0] : null;

    return clean({
      creator: this.creator,
      page: 'detail',
      data: {
        url,
        slug,
        title,
        poster,
        rating,
        status,
        studio,
        released,
        duration,
        season,
        country,
        type,
        totalEps,
        producers,
        casts,
        genres,
        synopsis,
        episodes,
        firstEpisode: firstEp,
        lastEpisode: lastEp
      }
    });
  }

  async episode(url) {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title').text().trim() || '';
    const poster = $('.tb img').first().attr('src') || null;
    const seriesName = $('.infolimit h2').text().trim() || null;
    const altTitle = $('.alter').text().trim() || null;
    const rating = $('.rating strong').text().trim() || null;
    const status = $('.spe span:contains("Status")').text().trim() || null;
    const studio = $('.spe span:contains("Studio") a').text().trim() || null;
    const type = $('.epx').text().trim() || null;
    const released = $('.year .updated').text().trim() || null;

    let iframeUrl = null;
    let videoUrl = null;
    const mirrors = [];

    $('.player-embed iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src) { iframeUrl = src; videoUrl = src; mirrors.push({ label: 'Default', iframeUrl: src }); return false; }
    });

    if (!iframeUrl) {
      $('select.mirror option').each((i, el) => {
        const $opt = $(el);
        const value = $opt.attr('value');
        const label = $opt.text().trim() || `Server ${i + 1}`;
        if (!value) return;
        const decoded = decodeBase64Iframe(value);
        if (decoded) {
          mirrors.push({ label, iframeUrl: decoded });
          if (!iframeUrl) { iframeUrl = decoded; videoUrl = decoded; }
        }
      });
    }

    if (!videoUrl) {
      $('video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src) { videoUrl = src; return false; }
      });
    }

    let prevEpisode = null;
    const prevEl = $('.nvs a:contains("Prev")');
    if (prevEl.length) prevEpisode = prevEl.attr('href');

    let nextEpisode = null;
    const nextEl = $('.nvs a:contains("Next")');
    if (nextEl.length) nextEpisode = nextEl.attr('href');

    const episodeList = [];
    $('#singlepisode .episodelist ul li a').each((i, el) => {
      const $el = $(el);
      const link = $el.attr('href');
      const title = $el.find('h3').text().trim() || '';
      const info = $el.find('span').text().trim() || '';
      if (link) {
        episodeList.push({
          title,
          url: link.startsWith('http') ? link : this.baseUrl + link,
          info
        });
      }
    });

    return clean({
      creator: this.creator,
      page: 'episode',
      data: {
        url,
        title,
        poster,
        seriesName,
        altTitle,
        rating,
        status,
        studio,
        type,
        released,
        videoUrl,
        iframeUrl,
        mirrors,
        prevEpisode: prevEpisode ? (prevEpisode.startsWith('http') ? prevEpisode : this.baseUrl + prevEpisode) : null,
        nextEpisode: nextEpisode ? (nextEpisode.startsWith('http') ? nextEpisode : this.baseUrl + nextEpisode) : null,
        episodeList
      }
    });
  }
}

module.exports = AnimekuindoScraper;