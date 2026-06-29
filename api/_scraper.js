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

    // Donghua: array of { day, donghua_list }
    const donghuaArr = donghua?.schedule || [];
    donghuaArr.forEach(entry => {
      const day = entry.day?.toLowerCase();
      if (!day) return;
      if (!merged[day]) merged[day] = [];
      (entry.donghua_list||[]).forEach(i => merged[day].push({
        title: i.title,
        slug: i.href?.replace(/.*\/anime\//, ''),
        poster: i.poster,
        episode: i.episode,
        category: 'donghua'
      }));
    });

    // Anime: array of { day, anime_list } atau object
    const animeArr = anime?.schedule || [];
    if (Array.isArray(animeArr)) {
      animeArr.forEach(entry => {
        const day = entry.day?.toLowerCase();
        if (!day) return;
        if (!merged[day]) merged[day] = [];
        (entry.anime_list||entry.donghua_list||[]).forEach(i => merged[day].push({
          title: i.title,
          slug: i.href?.replace(/.*\/anime\//, ''),
          poster: i.poster,
          episode: i.episode,
          category: 'anime'
        }));
      });
    }

    return { ok:true, data: merged };
  }

  async detail(slug, category='auto') {
    // Coba donghua dulu, kalau hasilnya tutorial/broken coba anime
    let data;
    if (category === 'anime') {
      data = await this._fetch(`/api/anime/detail/${slug}`);
    } else if (category === 'donghua') {
      data = await this._fetch(`/api/detail/${slug}`);
    } else {
      // Auto detect: coba donghua dulu
      data = await this._fetch(`/api/detail/${slug}`);
      // Kalau episode_list kosong atau title kayak tutorial, coba anime
      if (!data?.episodes_list?.length || data?.studio === '-' && !data?.info?.studio) {
        const animeData = await this._fetch(`/api/anime/detail/${slug}`);
        if (animeData?.episodes_list?.length > 0) data = animeData;
      }
    }
    return { ok:true, data };
  }

  async episode(slug, category='auto') {
    // Coba donghua dulu, kalau gagal/kosong coba anime
    let data = await this._fetch(`/api/episode/${slug}`);
    if (category === 'anime' || !data?.streaming?.servers?.length) {
      const animeData = await this._fetch(`/api/anime/episode/${slug}`);
      if (animeData?.streaming?.servers?.length) data = animeData;
    }
    const servers = data?.streaming?.servers || [];
    const streams = servers.map(s => ({ name: s.name, url: s.url }));
    const dlRaw = data?.download_url || {};
    const downloads = [];
    for (const [res, mirrors] of Object.entries(dlRaw)) {
      const links = Object.entries(mirrors).map(([host, url]) => ({ host, url }));
      downloads.push({ group: res, items: [{ resolution: res.replace('mp4_',''), links }] });
    }
    const nav = data?.navigation || {};
    const otherEpisodes = (data?.episodes_list || []).map(e => ({ title: e.title, slug: e.slug }));
    return { ok:true, data: {
      title: data?.title || '',
      streams, downloads,
      nav: { prev: nav.prev||null, next: nav.next||null, all: nav.all||null },
      otherEpisodes
    }};
  }
}

module.exports = new IFILMScraper();
