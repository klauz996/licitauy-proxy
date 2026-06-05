const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/debug2', async (req, res) => {
  try {
    const url = 'https://www.comprasestatales.gub.uy/consultas/buscar/tipo-pub/VIG/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-06-01+00:00:00_2026-06-05+23:59:59/page/1';
    const response = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    // Mostrar desde el medio del HTML donde están los resultados
    res.send('<pre>' + html.substring(5000, 10000).replace(/</g,'&lt;') + '</pre>');
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.get('/arce', async (req, res) => {
  res.json({ ok: true, total: 0, items: [] });
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v4 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
