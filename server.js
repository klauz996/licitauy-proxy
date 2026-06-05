const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir acceso desde cualquier origen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Ruta principal - consulta ARCE y devuelve el XML
app.get('/arce', async (req, res) => {
  try {
    const params = new URLSearchParams({
      tipo_publicacion: req.query.tipo_publicacion || 'lv',
      anio_inicial: req.query.anio_inicial,
      mes_inicial: req.query.mes_inicial,
      dia_inicial: req.query.dia_inicial,
      anio_final: req.query.anio_final,
      mes_final: req.query.mes_final,
      dia_final: req.query.dia_final,
    });

    if (req.query.tipo_compra) {
      params.set('tipo_compra', req.query.tipo_compra);
    }

    const url = `https://www.comprasestatales.gub.uy/comprasenlinea/jboss/generarReporte?${params}`;
    const response = await fetch(url, { timeout: 15000 });
    const xml = await response.text();

    res.set('Content-Type', 'application/xml');
    res.send(xml);

  } catch (error) {
    res.status(500).json({ error: 'Error consultando ARCE', detalle: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('LicitaUY Proxy - OK');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
