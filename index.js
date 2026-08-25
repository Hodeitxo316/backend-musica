const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
app.use(cors());

app.get('/stream', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Falta el parámetro query' });

  try {
    const searchRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    const html = await searchRes.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    
    if (!match) return res.status(404).json({ error: 'Video no encontrado' });

    const videoId = match[1];
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

    if (!format || !format.url) return res.status(404).json({ error: 'Stream no disponible' });

    return res.json({ url: format.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));