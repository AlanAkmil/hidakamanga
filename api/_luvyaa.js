// Shared scraper logic (adapted from Luvyaa scraper by Nimzz)
// Restricted to non-adult types only: manga, manhua, manhwa, novel
import fetch from 'node-fetch';

const BASE = 'https://v4.luvyaa.co';

// Only general/safe types exposed by this app
export const TYPES = ['manga', 'manhua', 'manhwa', 'novel'];
export const STATUSES = ['', 'ongoing', 'completed', 'hiatus'];
export const ORDERS = ['update', 'popular', 'title', 'titlereverse'];

// Genre list with explicit/adult genres removed
export const GENRES = {
  '4': 'Action', '5': 'Fantasy', '6': 'Adventure', '10': 'Drama',
  '25': 'School Life', '29': 'Psychological', '33': 'Time Travel',
  '35': 'Revenge', '43': 'Magic', '51': 'Supernatural',
  '52': 'Romance', '109': 'Thriller', '111': 'Comedy',
  '133': 'Military', '298': 'Mystery', '705': 'Cooking', '818': 'Demons',
  '881': 'Game', '1002': 'Shoujo', '1049': 'Mature', '1119': 'Historical',
  '1153': 'Shounen', '1224': 'Martial Arts', '1326': 'Horror',
  '1454': 'Gender Bender', '1455': 'Isekai', '1842': 'Manhwa',
  '1843': 'Adaptation', '1844': 'Manhua', '1845': 'Webtoon',
  '1846': 'Full Color', '1847': 'Webtoons', '1866': 'Sci-fi',
  '1894': 'Sports', '1984': 'Seinen', '2055': 'Demon',
  '2056': 'Harem', '2089': 'Reincarnation', '2097': 'Comedy',
  '2099': 'Super Power', '2119': 'Josei', '2135': 'Tragedy',
  '2188': 'Crime', '2806': 'Villainess',
  '4951': 'Reverse Harem', '4999': 'Rofan',
  '5089': 'Entertainment', '5408': 'College Life', '5410': 'Office Workers'
};

async function getHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:150.0) Gecko/20100101 Firefox/150.0',
      'Accept': 'text/html',
      'Referer': BASE + '/'
    }
  });
  return res.text();
}

function safeType(type) {
  return TYPES.includes(type) ? type : 'manga';
}

export async function getList(type = 'manga', filters = {}) {
  type = safeType(type);
  const { status = '', genre = '', order = 'update', page = 1 } = filters;
  let url = `${BASE}/manga/?type=${type}&order=${order}`;
  if (status) url += `&status=${status}`;
  if (genre && GENRES[genre]) url += `&genre%5B%5D=${genre}`;
  if (page > 1) url += `&page=${page}`;
  const html = await getHTML(url);
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !m[1].includes('page') && !m[1].includes('manga') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { type, status: status || 'all', genre: genre ? (GENRES[genre] || 'all') : 'all', order, page: Number(page), total: results.length, results };
}

export async function getGenres() {
  return { total: Object.keys(GENRES).length, genres: GENRES };
}

export async function getDetail(slug) {
  const html = await getHTML(BASE + '/' + slug + '/');
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  const imgMatch = html.match(/<img[^>]+width="160"[^>]+height="213"[^>]+src="([^"]+)"/);
  const thumbnail = imgMatch ? imgMatch[1] : '';
  const synopsisMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const synopsis = synopsisMatch ? synopsisMatch[1] : '';
  const chapters = [];
  const chapterRegex = /chapter-(\d+)\//g;
  let m;
  while ((m = chapterRegex.exec(html)) !== null) {
    const num = parseInt(m[1]);
    if (!chapters.includes(num)) chapters.push(num);
  }
  chapters.sort((a, b) => a - b);
  const genres = [];
  const genreRegex = /genres\/([a-z0-9-]+)\/" class="meta-pill">([^<]+)<\/a>/g;
  while ((m = genreRegex.exec(html)) !== null) {
    if (!genres.find(g => g.slug === m[1])) genres.push({ slug: m[1], name: m[2].trim() });
  }
  const statusMatch = html.match(/class="status-text">([^<]+)</);
  const typeMatch = html.match(/class="meta-pill">(Manhua|Manhwa|Manga|Novel)<\/a>/);
  const scoreMatch = html.match(/<span>(\d+\.?\d*)<\/span>/);
  return {
    title, slug, thumbnail, synopsis,
    type: typeMatch ? typeMatch[1].trim() : '',
    status: statusMatch ? statusMatch[1].trim() : '',
    score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
    genres, chapters, totalChapters: chapters.length
  };
}

export async function getChapter(slug, chapterNum) {
  const html = await getHTML(`${BASE}/${slug}-chapter-${chapterNum}/`);
  const imagesMatch = html.match(/"images"\s*:\s*\[([^\]]+)\]/);
  if (!imagesMatch) return { slug, chapter: chapterNum, images: [], error: 'No images found' };
  const images = imagesMatch[1].replace(/\\\//g, '/').replace(/"/g, '').split(',').map(url => url.trim());
  const prevMatch = html.match(/"prevUrl"\s*:\s*"([^"]+)"/);
  const nextMatch = html.match(/"nextUrl"\s*:\s*"([^"]+)"/);
  return {
    slug, chapter: chapterNum, images, totalImages: images.length,
    prev: prevMatch ? prevMatch[1].replace(/\\\//g, '/') : null,
    next: nextMatch ? nextMatch[1].replace(/\\\//g, '/') : null
  };
}

export async function search(query) {
  const html = await getHTML(BASE + '/?s=' + encodeURIComponent(query));
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { query, total: results.length, results };
}

export { BASE };