const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/arce', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const tab = req.query.tab || 'lv';
    const tipoPub = tab === 'a' ? 'ADJ' : 'VIG';

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const rango = `${fmt(from)}+00:00:00_${fmt(now)}+23:59:59`;
    const url = `https://www.comprasestatales.gub.uy/consultas/buscar/tipo-pub/${tipoPub}/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${rango}/page/1`;

    const response = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
    });
    const html = await response.text();

    const items = [];

    // Buscar todos los links de detalle - son la estructura más confiable
    const linkRe = /href="\/consultas\/detalle\/id\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const id = m[1];
      const contenido = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (contenido.length > 5) {
        items.push({ id, desc: contenido, url: `https://www.comprasestatales.gub.uy/consultas/detalle/id/${id}` });
      }
    }

    // Si no encontró nada, devolver fragmento del HTML para diagnóstico
    if (items.length === 0) {
      const idx = html.indexOf('col-md-9');
      const fragmento = idx >= 0 ? html.substring(idx, idx + 2000) : html.substring(3000, 5000);
      return res.json({ ok: false, total: 0, items: [], debug: fragmento.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,500) });
    }

    res.json({ ok: true, total: items.length, items });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v4 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
