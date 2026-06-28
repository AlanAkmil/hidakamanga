const https = require('https');

const API_BASE = 'vps-donghuawatch.vercel.app';

class IFILMScraper {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*'
    };
  }

  _fetch(path) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: API_BASE, port: 443, path, method: 'GET', headers: this.headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk.toString());
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  _normalizeAnime(i, category) {
    return {
      title: i.title,
      slug: i.anime_slug || i.slug,
      poster: i.poster || i.image,
      episode: i.ep || i.episode,
      rating: i.score || i.rating,
      type: i.type,
      category
    };
  }

  async home() {
    const [anime, donghua] = await Promise.all([
      this._fetch('/api/anime/ongoing/1'),
      this._fetch('/api/ongoing/1')
    ]);
    const items = [
      ...(anime?.ongoing_anime||anime?.data||[]).map(i=>this._normalizeAnime(i,'anime')),
      ...(donghua?.ongoing_donghua||donghua?.data||[]).map(i=>this._normalizeAnime(i,'donghua'))
    ];
    return { ok:true, data: items.slice(0,20) };
  }

  async ongoing(page=1) {
    const [anime, donghua] = await Promise.all([
      this._fetch(`/api/anime/ongoing/${page}`),
      this._fetch(`/api/ongoing/${page}`)
    ]);
    return { ok:true, data:[
      ...(anime?.ongoing_anime||anime?.data||[]).map(i=>this._normalizeAnime(i,'anime')),
      ...(donghua?.ongoing_donghua||donghua?.data||[]).map(i=>this._normalizeAnime(i,'donghua'))
    ]};
  }

  async completed(page=1) {
    const [anime, donghua] = await Promise.all([
      this._fetch(`/api/anime/completed/${page}`),
      this._fetch(`/api/completed/${page}`)
    ]);
    return { ok:true, data:[
      ...(anime?.completed_anime||anime?.data||[]).map(i=>this._normalizeAnime(i,'anime')),
      ...(donghua?.completed_donghua||donghua?.data||[]).map(i=>this._normalizeAnime(i,'donghua'))
    ]};
  }

  async search(query, page=1) {
    const data = await this._fetch(`/api/search/${encodeURIComponent(query)}/${page}`);
    const items = data?.results||data?.data||data?.search_results||[];
    return { ok:true, query, data: items.map(i=>this._normalizeAnime(i, i.type==='Donghua'?'donghua':'anime')) };
  }

  async schedule() {
    const [anime, donghua] = await Promise.all([
      this._fetch('/api/anime/schedule'),
      this._fetch('/api/schedule')
    ]);
    const merged = {};
    const process = (schedule, category) => {
      const s = schedule?.schedule||schedule?.data||schedule||{};
      if (typeof s !== 'object') return;
      for (const [day, items] of Object.entries(s)) {
        if (!Array.isArray(items)) continue;
        if (!merged[day]) merged[day] = [];
        items.forEach(i => merged[day].push({...this._normalizeAnime(i, category)}));
      }
    };
    process(anime, 'anime');
    process(donghua, 'donghua');
    return { ok:true, data: merged };
  }

  async detail(slug) {
    const data = await this._fetch(`/api/detail/${slug}`);
    const d = data?.detail||data?.data||data;
    return { ok:true, data: d };
  }

  async episode(slug) {
    const data = await this._fetch(`/api/episode/${slug}`);
    const d = data?.episode||data?.data||data;
    return { ok:true, data: d };
  }
}

module.exports = new IFILMScraper();
