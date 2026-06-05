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

    const url = `https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/${tipoPub}/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/${rango}/page/1`;

    const response = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const xml = await response.text();

    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;

    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1];

      // Título: "Compra Directa 7943/2026 - Organismo | Unidad"
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace('<![CDATA[','').replace(']]>','').trim() : '';

      // Separar por primer " - "
      const guionIdx = title.indexOf(' - ');
      const tipoNro = guionIdx >= 0 ? title.substring(0, guionIdx).trim() : title;
      const orgFull = guionIdx >= 0 ? title.substring(guionIdx + 3).trim() : '';

      // Separar tipo y número: "Compra Directa 7943/2026"
      const tipoMatch2 = tipoNro.match(/^(.*?)(\d+\/\d{4})$/);
      const tipo = tipoMatch2 ? tipoMatch2[1].trim() : tipoNro;
      const nro = tipoMatch2 ? tipoMatch2[2] : '';

      // Organismo: separar por "|"
      const orgPartes = orgFull.split('|');
      const organismo = orgPartes[0]?.trim() || '';
      const unidad = orgPartes[1]?.trim() || '';

      // Descripción (CDATA)
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
      const descRaw = descMatch ? descMatch[1] : '';
      const descLimpia = descRaw.replace(/<br\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      // Fecha cierre desde descripción
      const cierreMatch = descLimpia.match(/Recepci[oó]n de ofertas hasta:\s*([\d\/]+ [\d:]+)/i);
      const fechaCierre = cierreMatch ? cierreMatch[1] : '';

      // Fecha publicación
      const pubMatch = descLimpia.match(/Publicado:\s*([\d\/]+)/);
      const fechaPub = pubMatch ? pubMatch[1] : '';

      // Descripción sin las fechas al final
      const desc = descLimpia.split(' Recepción')[0].split(' Publicado:')[0].trim();

      // Link e ID
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const link = linkMatch ? linkMatch[1].trim() : ''
