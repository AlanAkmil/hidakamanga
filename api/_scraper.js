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

  async home() {
    const [anime, donghua] = await Promise.all([
      this._fetch('/api/anime/ongoing/1'),
      this._fetch('/api/ongoing/1')
    ]);
    const items = [
      ...(anime?.data||[]).map(i=>({...i,category:'anime'})),
      ...(donghua?.data||[]).map(i=>({...i,category:'donghua'}))
    ];
    return { ok:true, data: items.slice(0,20) };
  }

  async ongoing(page=1) {
    const [anime, donghua] = await Promise.all([
      this._fetch(`/api/anime/ongoing/${page}`),
      this._fetch(`/api/ongoing/${page}`)
    ]);
    return { ok:true, data:[
      ...(anime?.data||[]).map(i=>({...i,category:'anime'})),
      ...(donghua?.data||[]).map(i=>({...i,category:'donghua'}))
    ]};
  }

  async completed(page=1) {
    const [anime, donghua] = await Promise.all([
      this._fetch(`/api/anime/completed/${page}`),
      this._fetch(`/api/completed/${page}`)
    ]);
    return { ok:true, data:[
      ...(anime?.data||[]).map(i=>({...i,category:'anime'})),
      ...(donghua?.data||[]).map(i=>({...i,category:'donghua'}))
    ]};
  }

  async search(query, page=1) {
    const data = await this._fetch(`/api/search/${encodeURIComponent(query)}/${page}`);
    return { ok:true, query, data: data?.data||[] };
  }

  async schedule() {
    const [anime, donghua] = await Promise.all([
      this._fetch('/api/anime/schedule'),
      this._fetch('/api/schedule')
    ]);
    const merged = {};
    const process = (schedule, category) => {
      const s = schedule?.data || schedule || {};
      for (const [day, items] of Object.entries(s)) {
        if (!merged[day]) merged[day] = [];
        (Array.isArray(items)?items:[]).forEach(i => merged[day].push({...i,category}));
      }
    };
    process(anime, 'anime');
    process(donghua, 'donghua');
    return { ok:true, data: merged };
  }

  async detail(slug) {
    const data = await this._fetch(`/api/detail/${slug}`);
    return { ok:true, data: data?.data||data };
  }

  async episode(slug) {
    const data = await this._fetch(`/api/episode/${slug}`);
    return { ok:true, data: data?.data||data };
  }
}

module.exports = new IFILMScraper();
