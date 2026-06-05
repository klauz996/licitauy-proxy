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
    const tipoPub = tab === 'a' ? 'ADJ' : 'LL';

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

    // Extraer bloques de cada compra — separados por "compra-titulo"
    const bloqueRe = /class="compra-titulo">([\s\S]*?)(?=class="compra-titulo"|$)/g;
    let bloque;
    while ((bloque = bloqueRe.exec(html)) !== null) {
      const b = bloque[1];

      // Tipo y número: "Compra Directa 1234/2026"
      const tipoMatch = b.match(/href="[^"]*"[^>]*>\s*([^<]+\d{1,6}\/\d{4})/);
      const tipoFull = tipoMatch ? tipoMatch[1].trim() : '';
      const partes = tipoFull.match(/^(.*?)(\d+\/\d{4})$/);
      const tipo = partes ? partes[1].trim() : tipoFull;
      const nro = partes ? partes[2] : '';

      // Organismo
      const orgMatch = b.match(/class="compra-organismo[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
      const organismo = orgMatch ? orgMatch[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';

      // Descripción
      const descMatch = b.match(/class="compra-descripcion[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
      const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';

      // Fecha publicación
      const pubMatch = b.match(/Publicado[^:]*:\s*([\d\/]+)/);
      const fechaPub = pubMatch ? pubMatch[1].trim() : '';

      // Fecha cierre
      const cierreMatch = b.match(/Recepci[oó]n de ofertas hasta[^:]*:\s*([\d\/]+ [\d:]+)/i);
      const fechaCierre = cierreMatch ? cierreMatch[1].trim() : '';

      // ID para URL
      const idMatch = b.match(/\/consultas\/detalle\/id\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';

      if (tipo || desc) {
        items.push({
          id, tipo, nro, organismo, desc, fechaPub, fechaCierre,
          url: id ? `https://www.comprasestatales.gub.uy/consultas/detalle/id/${id}` : 'https://www.comprasestatales.gub.uy'
        });
      }
    }

    res.json({ ok: true, total: items.length, items });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/debug', async (req, res) => {
  try {
    const url = 'https://www.comprasestatales.gub.uy/consultas/buscar/tipo-pub/LL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-06-01+00:00:00_2026-06-05+23:59:59/page/1';
    const response = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    res.send('<pre>' + html.substring(0, 5000).replace(/</g,'&lt;') + '</pre>');
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v3 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
