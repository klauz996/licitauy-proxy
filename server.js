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

    // Extraer datos del HTML
    const results = [];
    const regex = /Ver detalles de la compra ([^\|]+)\|([^\|]+)\|([^·<]+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const tipo_num = match[1].trim();
      const organismo = match[2].trim();
      const unidad = match[3].trim();
      results.push({ tipo_num, organismo, unidad });
    }

    // También extraemos descripciones y fechas
    const bloques = html.split('Ver detalles de la compra').slice(1);
    const items = bloques.map(b => {
      const tipoNum = (b.match(/^([^\|]+)/) || [])[1]?.trim() || '';
      const org = (b.match(/\|([^\|]+)\|/) || [])[1]?.trim() || '';
      const desc = (b.match(/\n([A-ZÁÉÍÓÚÑ][^\n]{5,})\n/) || [])[1]?.trim() || '';
      const fechaPub = (b.match(/Publicado:\s*([\d\/]+)/) || [])[1] || '';
      const fechaCierre = (b.match(/Recepción de ofertas hasta:\s*([\d\/]+\s[\d:]+)/) || [])[1] || '';
      const idMatch = b.match(/idCompra=(\d+)/);
      const id = idMatch ? idMatch[1] : '';

      // Separar tipo y número
      const partes = tipoNum.split(/(\d+\/\d+)/);
      const tipo = partes[0]?.trim() || tipoNum;
      const nro = partes[1] || '';

      return { id, tipo, nro, organismo: org, desc, fechaPub, fechaCierre,
        url: id ? `https://www.comprasestatales.gub.uy/consultas/detalle/id/${id}` : 'https://www.comprasestatales.gub.uy' };
    }).filter(i => i.tipo);

    res.json({ ok: true, total: items.length, items });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get('/debug', async (req, res) => {
  try {
    const url = 'https://www.comprasestatales.gub.uy/consultas/buscar/tipo-pub/LL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-06-01+00:00:00_2026-06-05+23:59:59/page/1';
    const response = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
    });
    const html = await response.text();
    res.send('<pre>' + html.substring(0, 3000).replace(/</g,'&lt;') + '</pre>');
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v2 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
