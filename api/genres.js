import { getGenres } from './_luvyaa.js';

export default async function handler(req, res) {
  try {
    const data = await getGenres();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}