const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function getAudioUrl(videoId) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const cobaltNodes = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kwippy.com',
    'https://co.wuk.sh'
  ];

  for (const node of cobaltNodes) {
    try {
      const res = await fetchWithTimeout(
        node,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: youtubeUrl,
            downloadMode: 'audio',
            audioBitrate: '128'
          })
        },
        6000
      );
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
    `https://inv.tux.pizza/api/v1/videos/${videoId}`,
    `https://invidious.privacydev.net/api/v1/videos/${videoId}`
  ];

  for (const endpoint of streamEndpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, {}, 5000);
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
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Falta videoId' });

  try {
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