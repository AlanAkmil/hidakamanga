import { getList } from './_luvyaa.js';

export default async function handler(req, res) {
  try {
    const { type = 'manga', status = '', genre = '', order = 'update', page = 1 } = req.query;
    const data = await getList(type, { status, genre, order, page: Number(page) || 1 });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}