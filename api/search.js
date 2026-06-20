import { search } from './_luvyaa.js';

export default async function handler(req, res) {
  try {
    const { q = '' } = req.query;
    if (!q.trim()) {
      return res.status(200).json({ success: true, data: { query: '', total: 0, results: [] } });
    }
    const data = await search(q);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}