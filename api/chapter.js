import { getChapter } from './_luvyaa.js';

export default async function handler(req, res) {
  try {
    const { slug, chapter } = req.query;
    if (!slug || !chapter) return res.status(400).json({ success: false, error: 'slug and chapter required' });
    const data = await getChapter(slug, parseInt(chapter));
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}