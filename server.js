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

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const fmt = d => d.toISOString().split('T')[0];

    // API OCDS oficial de datos abiertos de Uruguay
    const url = `https://catalogodatos.gub.uy/api/3/action/datastore_search?resource_id=6a3075be-3338-4cec-91b1-6f66a88a1839&limit=100&filters={}`;

    const response = await fetch(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();

    if (!json.success || !json.result || !json.result.records) {
      return res.json({ ok: false, error: 'Sin datos', total: 0, items: [] });
    }

    const records = json.result.records;
    const fromDate = from.getTime();

    const items = records
      .filter(r => {
        // Filtrar por fecha si es posible
        const f = r.fecha_publicacion || r.fechaPublicacion || '';
        if (!f) return true;
        const d = new Date(f);
        return d.getTime() >= fromDate;
      })
      .filter(r => tab !== 'a' || (r.estado||'').toLowerCase().includes('adjud'))
      .map(r => ({
        id: r.id_compra || r.idCompra || '',
        tipo: r.tipo_compra || r.tipoCompra || '',
        nro: r.nro_compra || r.nroCompra || '',
        organismo: r.organismo || r.nombre_organismo || '',
        desc: r.objeto || r.descripcion || r.objeto_compra || '',
        fechaPub: r.fecha_publicacion || r.fechaPublicacion || '',
        fechaCierre: r.fecha_limite || r.fechaLimite || '',
        url: r.id_compra ? `https://www.comprasestatales.gub.uy/consultas/detalle/id/${r.id_compra}` : 'https://www.comprasestatales.gub.uy'
      }))
      .filter(i => i.desc || i.tipo);

    res.json({ ok: true, total: items.length, items });

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/debug3', async (req, res) => {
  try {
    const url = 'https://catalogodatos.gub.uy/api/3/action/datastore_search?resource_id=6a3075be-3338-4cec-91b1-6f66a88a1839&limit=2';
    const response = await fetch(url, { timeout: 15000 });
    const json = await response.json();
    res.json(json);
  } catch(e) {
    res.json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send('LicitaUY Proxy v5 - OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
