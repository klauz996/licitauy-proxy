const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ── RUTA: /arce ──────────────────────────────────────────────────────
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
      const titleRaw = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const title = titleRaw.replace('<![CDATA[','').replace(']]>','').trim();
      const guionIdx = title.indexOf(' - ');
      const tipoNro = guionIdx >= 0 ? title.substring(0, guionIdx).trim() : title;
      const orgFull = guionIdx >= 0 ? title.substring(guionIdx + 3).trim() : '';
      const tipoMatch = tipoNro.match(/^(.*?)\s+(\S+\/\d{4})$/);
      const tipo = tipoMatch ? tipoMatch[1].trim() : tipoNro;
      const nro = tipoMatch ? tipoMatch[2] : '';
      const organismo = orgFull.split('|')[0].trim();
      const descRaw = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
      const descLimpia = descRaw.replace(/<br\/>/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
      const cierreMatch = descLimpia.match(/Recepci[oó]n de ofertas hasta:\s*([\d\/]+ [\d:]+)/i);
      const fechaCierre = cierreMatch ? cierreMatch[1] : '';
      const pubMatch = descLimpia.match(/Publicado:\s*([\d\/]+)/);
      const fechaPub = pubMatch ? pubMatch[1] : '';
      const desc = descLimpia.split(' Recepción')[0].split(' Publicado:')[0].trim();
      const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
      const idMatch = link.match(/\/id\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';
      if (tipo || desc) {
        items.push({ id, tipo, nro, organismo, desc: desc || tipoNro, fechaPub, fechaCierre, url: link || 'https://www.comprasestatales.gub.uy' });
      }
    }
    res.json({ ok: true, total: items.length, items });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── RUTA: /detalle ───────────────────────────────────────────────────
app.get('/detalle', async (req, res) => {
  const id = req.query.id;
  if (!id || !/^\d+$/.test(id)) return res.json({ ok: false, error: 'ID invalido' });
  try {
    const url = `https://www.comprasestatales.gub.uy/consultas/detalle/id/${id}/mostrar-llamado/1`;
    const response = await fetch(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return res.json({ ok: false, error: response.status });
    const html = await response.text();

    // Limpiar HTML a texto plano (incluyendo entidades HTML)
    const txt = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&oacute;/g, 'o')
      .replace(/&aacute;/g, 'a')
      .replace(/&eacute;/g, 'e')
      .replace(/&iacute;/g, 'i')
      .replace(/&uacute;/g, 'u')
      .replace(/&ntilde;/g, 'n')
      .replace(/&Oacute;/g, 'O')
      .replace(/&Aacute;/g, 'A')
      .replace(/&Eacute;/g, 'E')
      .replace(/&Iacute;/g, 'I')
      .replace(/&Uacute;/g, 'U')
      .replace(/&Ntilde;/g, 'N')
      .replace(/&sol;/g, '/')
      .replace(/&#[0-9]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Items: "Item No N NOMBRE (Cod. Articulo XXXX)"
    const items = [];
    const itemRe = /[IÍ]tem\s+N[oº°]\s*(\d+)\s+(.+?)\s*\(C[oó]d\.?\s*Art[ií]culo\s*(\d+)\)/gi;
    let m;
    while ((m = itemRe.exec(txt)) !== null) {
      items.push({ nro: parseInt(m[1]), nombre: m[2].trim(), cod: parseInt(m[3]) });
    }

    // Fecha publicacion
    let fechaPub = null;
    const pubM = txt.match(/(?:Fecha\s+Publicaci[oó]n|Fecha\s+Publicacion|Publicado)\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+[\d:]+(?:hs)?)?)/i);
    if (pubM) fechaPub = pubM[1].trim();

    // Fecha cierre
    let fechaCierre = null;
    const cieM = txt.match(/Recepci[oó]n\s+de\s+ofertas\s+hasta\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+[\d:]+(?:hs)?)?)/i);
    if (cieM) fechaCierre = cieM[1].trim().replace('hs','').trim();

    res.json({ ok: true, id, items, fechaPub, fechaCierre });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

// ── RUTA: /debug ─────────────────────────────────────────────────────
// Temporal para ver el HTML crudo que devuelve ARCE
app.get('/debug', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.send('Falta ?id=XXXX');
  try {
    const url = `https://www.comprasestatales.gub.uy/consultas/detalle/id/${id}/mostrar-llamado/1`;
    const response = await fetch(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();
    // Devolver los primeros 3000 chars como texto plano
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(html.substring(0, 3000));
  } catch(e) {
    res.send('ERROR: ' + e.message);
  }
});

// ── HEALTH CHECK ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('LicitaUY Proxy v10 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
