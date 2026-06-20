import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('url required');

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).send('invalid url');
    }
    if (!parsed.hostname.endsWith('luvyaa.co')) {
      return res.status(403).send('domain not allowed');
    }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:150.0) Gecko/20100101 Firefox/150.0',
        'Referer': 'https://v4.luvyaa.co/',
        'Accept': 'image/webp,image/*'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('upstream error');
    }

    const contentType = upstream.headers.get('content-type') || 'image/webp';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).send('proxy error: ' + e.message);
  }
}