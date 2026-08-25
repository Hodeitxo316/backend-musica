const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Localizar ID del video en YouTube
async function getVideoId(query) {
  const searchNodes = [
    'https://inv.tux.pizza/api/v1/search?type=video&q=',
    'https://invidious.privacydev.net/api/v1/search?type=video&q=',
    'https://pipedapi.drgns.space/search?filter=music_songs&q='
  ];

  for (const node of searchNodes) {
    try {
      const res = await fetch(node + encodeURIComponent(query), { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data;
        if (Array.isArray(items) && items.length > 0) {
          const first = items[0];
          const id = first.videoId || (first.url ? first.url.split('v=')[1] : null);
          if (id) return id;
        }
      }
    } catch (e) {}
  }

  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000)
    });
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) return match[1];
  } catch (e) {}

  return null;
}

// Extraer el enlace de audio HD directo
async function getAudioUrl(videoId) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const cobaltNodes = ['https://api.cobalt.tools', 'https://cobalt-api.kwippy.com'];

  for (const node of cobaltNodes) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: youtubeUrl,
          downloadMode: 'audio',
          audioBitrate: '128'
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const json = await res.json();
        const streamUrl = json.url || (json.picker && json.picker[0]?.url);
        if (streamUrl) return streamUrl;
      }
    } catch (e) {}
  }

  const streamEndpoints = [
    `https://pipedapi.adminforge.de/streams/${videoId}`,
    `https://pipedapi.privacy.com.de/streams/${videoId}`,
    `https://inv.tux.pizza/api/v1/videos/${videoId}`
  ];

  for (const endpoint of streamEndpoints) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        let streamUrl = null;
        if (json.audioStreams?.length > 0) {
          const best = json.audioStreams.reduce((prev, curr) => ((curr.bitrate || 0) > (prev.bitrate || 0) ? curr : prev));
          streamUrl = best.url;
        } else if (json.adaptiveFormats?.length > 0) {
          const audio = json.adaptiveFormats.filter(f => f.type?.includes('audio'));
          streamUrl = audio[0]?.url;
        }
        if (streamUrl) return streamUrl;
      }
    } catch (e) {}
  }

  return null;
}

app.get('/stream', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Falta query' });

  try {
    const videoId = await getVideoId(query);
    if (!videoId) return res.status(404).json({ error: 'Video no encontrado' });

    const audioUrl = await getAudioUrl(videoId);
    if (!audioUrl) return res.status(500).json({ error: 'Stream no disponible' });

    return res.json({ url: audioUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Backend de música activo');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));