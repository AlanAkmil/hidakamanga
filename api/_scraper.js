const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://otakudesu.blog';
const SCRAPER_KEY = 'faf505e9086550d5e17bde08ff977606';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.104 Mobile Safari/537.36',
];

let uaIndex = 0;

class CookieJar {
  constructor() { this.cookies = {}; }
  update(headers) {
    const setCookie = headers['set-cookie'];
    if (!setCookie) return;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookies) {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) this.cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  getString() { return Object.entries(this.cookies).map(([k,v]) => `${k}=${v}`).join('; '); }
  clear() { this.cookies = {}; }
}

function randomDelay(min=300, max=800) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random()*(max-min+1))+min));
}

function getHeaders(ref=BASE_URL, cookie='') {
  const ua = USER_AGENTS[uaIndex++ % USER_AGENTS.length];
  const isMobile = ua.includes('Mobile')||ua.includes('iPhone')||ua.includes('Android');
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': ref||BASE_URL,
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Sec-Ch-Ua-Mobile': isMobile?'?1':'?0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
    ...(cookie ? {'Cookie': cookie} : {})
  };
}

async function request(method, url, data=null, headers={}, retries=5) {
  for (let i=0; i<retries; i++) {
    try {
      await randomDelay(300,800);
      const config = {
        method, url, headers, timeout: 30000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: true }),
        maxRedirects: 5, decompress: true,
        validateStatus: s => s>=200 && s<400
      };
      if (data && (method==='POST'||method==='PUT')) config.data = data;
      return await axios(config);
    } catch(e) {
      if (i<retries-1) await randomDelay(1500,4000);
      else throw e;
    }
  }
}

class OtakudesuScraper {
  constructor() {
    this.base = BASE_URL;
    this.cookieJar = new CookieJar();
  }

  async _fetchHTML(url) {
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(url)}`;
    const res = await request('GET', scraperUrl, null, getHeaders(url, this.cookieJar.getString()));
    this.cookieJar.update(res.headers);
    return res.data;
  }

  async _postAjax(payload) {
    const params = new URLSearchParams(payload);
    const url = `${this.base}/wp-admin/admin-ajax.php`;
    const headers = {
      ...getHeaders(this.base, this.cookieJar.getString()),
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const res = await request('POST', url, params.toString(), headers);
    this.cookieJar.update(res.headers);
    return res.data;
  }

  _parseCardDetpost($, el) {
    const $el = $(el);
    const link = $el.find('.thumb a').attr('href');
    const title = $el.find('.jdlflm').text().trim();
    const poster = $el.find('.thumbz img').attr('src') || null;
    const episode = $el.find('.epz').text().trim() || null;
    const day = $el.find('.epztipe').text().trim() || null;
    const date = $el.find('.newnime').text().trim() || null;
    if (!link||!title) return null;
    const slug = link.replace(/.*\/anime\/([^\/]+)\/?$/, '$1');
    return { title, slug, url: link.startsWith('http')?link:this.base+link, poster, episode, day, date };
  }

  _parseEpisodeList($) {
    const episodes = [];
    $('.episodelist ul li').each((i, el) => {
      const $el = $(el);
      const $a = $el.find('a');
      const title = $a.text().trim();
      const href = $a.attr('href');
      const date = $el.find('.zeebr').text().trim() || null;
      if (href&&title) {
        const match = href.match(/\/episode\/([^\/]+)\/?$/);
        episodes.push({
          title, slug: match?match[1]:null,
          url: href.startsWith('http')?href:this.base+href,
          releaseDate: date
        });
      }
    });
    return episodes;
  }

  _parsePagination($) {
    const result = { current:1, next:null, hasNext:false, total:null };
    const pageLinks = [];
    $('.page-numbers, .pagenavix a, .pagenavix span').each((i,el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) pageLinks.push({text,href});
    });
    const numbers = pageLinks.filter(l=>/^\d+$/.test(l.text)).map(l=>parseInt(l.text));
    if (numbers.length) result.total = Math.max(...numbers);
    const cur = $('.page-numbers.current').first().text().trim();
    if (/^\d+$/.test(cur)) result.current = parseInt(cur);
    if (result.total && result.current < result.total) {
      result.hasNext = true;
      const nxt = pageLinks.find(l=>l.text==='Next'||l.text==='»');
      if (nxt) result.next = nxt.href.startsWith('http')?nxt.href:this.base+nxt.href;
    }
    return result;
  }

  async _getNonce() {
    try {
      const res = await this._postAjax({ action: 'aa1208d27f29ca340c92c66d1926f13f' });
      return res?.data || null;
    } catch(e) { return null; }
  }

  async _getStreamUrl(postId, index, quality, nonce) {
    try {
      const res = await this._postAjax({
        action: '2a3505c93b0035d3f455df82bf976b84',
        id: postId, i: index, q: quality, nonce
      });
      if (!res?.data) return null;
      const html = Buffer.from(res.data, 'base64').toString('utf-8');
      const $ = cheerio.load(html);
      return $('iframe').attr('src') || null;
    } catch(e) { return null; }
  }

  async _extractStreams(html) {
    const $ = cheerio.load(html);
    // Extract postId
    let postId = null;
    $('[id^="post-"]').each((i,el) => {
      const m = $(el).attr('id').match(/post-(\d+)/);
      if (m) postId = parseInt(m[1]);
    });
    if (!postId) {
      const m = html.match(/post[_\s]*id[_\s]*[:=]\s*["']?(\d+)/i);
      if (m) postId = parseInt(m[1]);
    }
    if (!postId) return {};
    const nonce = await this._getNonce();
    if (!nonce) return {};
    const streamParams = {};
    $('.mirrorstream ul a[data-content]').each((i,el) => {
      const dc = $(el).attr('data-content');
      if (!dc) return;
      try {
        const parsed = JSON.parse(Buffer.from(dc,'base64').toString('utf-8'));
        if (parsed.id===postId) {
          const key = `${parsed.q}_${$(el).text().trim()}`;
          streamParams[key] = { postId, i: parsed.i, q: parsed.q, nonce };
        }
      } catch(e) {}
    });
    const result = {};
    for (const [key, p] of Object.entries(streamParams)) {
      const url = await this._getStreamUrl(p.postId, p.i, p.q, p.nonce);
      if (url) result[key] = url;
    }
    return result;
  }

  async home() {
    const url = this.base + '/';
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const items = [];
    $('.detpost').each((i,el) => {
      const card = this._parseCardDetpost($,el);
      if (card) items.push(card);
    });
    return { ok:true, page:'home', data: items };
  }

  async ongoing(page=1) {
    const url = page===1 ? `${this.base}/ongoing-anime/` : `${this.base}/ongoing-anime/page/${page}/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const items = [];
    $('.detpost').each((i,el) => {
      const card = this._parseCardDetpost($,el);
      if (card) items.push(card);
    });
    return { ok:true, page:'ongoing', pagination: this._parsePagination($), data: items };
  }

  async complete(page=1) {
    const url = page===1 ? `${this.base}/complete-anime/` : `${this.base}/complete-anime/page/${page}/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const items = [];
    $('.detpost').each((i,el) => {
      const card = this._parseCardDetpost($,el);
      if (card) items.push(card);
    });
    return { ok:true, page:'complete', pagination: this._parsePagination($), data: items };
  }

  async search(query) {
    const url = `${this.base}/?s=${encodeURIComponent(query)}&post_type=anime`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const items = [];
    $('.chivsrc li').each((i,el) => {
      const $el = $(el);
      const link = $el.find('h2 a').attr('href');
      const title = $el.find('h2 a').text().trim();
      const poster = $el.find('img').attr('src') || null;
      const genres = $el.find('.set:first-child a').map((_,a)=>$(a).text()).get();
      const status = $el.find('.set:nth-child(2)').text().replace('Status :','').trim()||null;
      if (link&&title) {
        const slug = link.replace(/.*\/anime\/([^\/]+)\/?$/,'$1');
        items.push({ title, slug, url: link.startsWith('http')?link:this.base+link, poster, genres, status });
      }
    });
    return { ok:true, query, data: items };
  }

  async jadwal() {
    const url = `${this.base}/jadwal-rilis/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const schedule = {};
    $('.kglist321').each((i,el) => {
      const $el = $(el);
      const day = $el.find('h2').text().trim();
      const items = [];
      $el.find('ul li a').each((j,a) => {
        const href = $(a).attr('href')||'';
        items.push({
          title: $(a).text().trim(),
          url: href.startsWith('http')?href:this.base+href
        });
      });
      if (day&&items.length) schedule[day] = items;
    });
    return { ok:true, data: schedule };
  }

  async genreList() {
    const url = `${this.base}/genre-list/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const genres = [];
    $('.genres li a').each((i,el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href')||'';
      const slug = href.replace(/.*\/genres\/([^\/]+)\/?$/,'$1');
      if (name) genres.push({ name, slug, url: href.startsWith('http')?href:this.base+href });
    });
    return { ok:true, data: genres };
  }

  async genre(slug, page=1) {
    const url = page===1 ? `${this.base}/genres/${slug}/` : `${this.base}/genres/${slug}/page/${page}/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const items = [];
    $('.col-anime-con').each((i,el) => {
      const $el = $(el);
      const link = $el.find('.col-anime-title a').attr('href');
      const title = $el.find('.col-anime-title a').text().trim();
      const poster = $el.find('.col-anime-cover img').attr('src')||null;
      const rating = $el.find('.col-anime-rating').text().trim()||null;
      const genres = $el.find('.col-anime-genre a').map((_,a)=>$(a).text()).get();
      if (link&&title) {
        const slug2 = link.replace(/.*\/anime\/([^\/]+)\/?$/,'$1');
        items.push({ title, slug:slug2, url: link.startsWith('http')?link:this.base+link, poster, rating, genres });
      }
    });
    return { ok:true, genre:slug, pagination: this._parsePagination($), data: items };
  }

  async detail(slug) {
    const url = `${this.base}/anime/${slug}/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const title = $('.jdlrx h1').text().trim() || $('h1').first().text().trim();
    const poster = $('.fotoanime img').attr('src')||null;
    const synopsis = $('.sinopc p').text().trim()||null;
    const info = {};
    $('.infozin .infozingle p').each((i,el) => {
      const text = $(el).text().trim();
      if (text.includes('Genre')) {
        info.genres = $(el).find('a').map((_,a)=>$(a).text()).get();
        return;
      }
      const parts = text.split(':');
      if (parts.length>=2) {
        const key = parts[0].trim().toLowerCase().replace(/\s+/g,'_');
        info[key] = parts.slice(1).join(':').trim();
      }
    });
    const episodes = this._parseEpisodeList($);
    return { ok:true, data: { title, poster, synopsis, info, episodes } };
  }

  async episode(slug) {
    const url = `${this.base}/episode/${slug}/`;
    const html = await this._fetchHTML(url);
    const $ = cheerio.load(html);
    const title = $('h1.posttl').text().trim() || $('h1').first().text().trim();
    const streams = await this._extractStreams(html);
    const downloads = [];
    $('.download ul').each((i,ul) => {
      const group = $(ul).prev('h4').text().trim() || $(ul).prev('strong').text().trim() || 'Download';
      const items = [];
      $(ul).find('li').each((j,li) => {
        const resolution = $(li).find('strong').text().trim()||null;
        const size = $(li).find('i').text().trim()||null;
        const links = $(li).find('a').map((_,a)=>({ host:$(a).text().trim(), url:$(a).attr('href') })).get();
        if (links.length) items.push({ resolution, size, links });
      });
      if (items.length) downloads.push({ group, items });
    });
    const nav = {
      prev: $('.prevnext .flir a').first().attr('href')||null,
      all: $('.prevnext .flir a:contains("See All")').attr('href')||null,
      next: $('.prevnext .flir a').last().attr('href')||null
    };
    const otherEpisodes = this._parseEpisodeList($);
    return { ok:true, data: { title, streams, downloads, nav, otherEpisodes } };
  }
}

module.exports = new OtakudesuScraper();
