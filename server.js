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
    const tipoPub = tab === 'a' ? 'ADJ' : 'ALL';

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const rango = `${fmt(from)}+00:00:00_${fmt(now)}+23:59:59`;

    // Usar el RSS oficial de ARCE
    const url = `https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/${tipoPub}/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${rango}/page/1`;

    const response = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, text/xml' }
    });
    const xml = await response.text();

    // Parsear RSS — formato simple de items
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1];
      const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';

      // El título tiene formato "Tipo Nro/Año | Organismo"
      const partes = title.split('|');
      const tipoNro = partes[0]?.trim() || '';
      const organismo = partes[1]?.trim() || '';
      const unidad = partes[2]?.trim() || '';

      const tipoMatch = tipoNro.match(/^(.*?)(\d+\/\d{4})$/);
      const tipo = tipoMatch ? tipoMatch[1].trim() : tipoNro;
      const nro = tipoMatch ? tipoMatch[2] : '';

      // ID desde el link
      const idMatch = link.match(/\/id\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';

      // Fecha publicación desde pubDate
      const fechaPub = pubDate ? new Date(pubDate).toLocaleDateString('es-UY') : '';

      // Descripción limpia
      const descLimpia = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      if (tipoNro || descLimpia) {
        items.push({ id, tipo, nro, organismo: organismo + (unidad ? ' - ' + unidad : ''), desc: descLimpia || tipoNro, fechaPub, fechaCierre: '', url: link || 'https://www.comprasestatales.gub.uy' });
      }
    }

    res.json({ ok: true, total: items.length, items });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/debug', async (req, res) => {
  try {
    const url = 'https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/ALL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-06-01+00:00:00_2026-06-05+23:59:59/page/1';
    const response = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await response.text();
    res.send('<pre>' + text.substring(0, 5000).replace(/</g, '&lt;') + '</pre>');
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v6 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
