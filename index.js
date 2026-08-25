const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// 1. Extracción directa con API Android InnerTube
async function getAndroidInnerTubeAudio(videoId) {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.02.39 (Linux; U; Android 11; US)'
      },
      body: JSON.stringify({
        videoId: videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.02.39',
            androidSdkVersion: 30
          }
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const formats = data.streamingData?.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
      
      // Buscar formato con URL directa activa
      const directFormat = audioFormats.find(f => f.url);
      if (directFormat && directFormat.url) {
        return directFormat.url;
      }
    }
  } catch (e) {}
  return null;
}

// 2. Extracción mediante red de nodos Invidious / Piped (Respaldo)
async function getPipedInvidiousAudio(videoId) {
  const endpoints = [
    `https://api.piped.private.coffee/streams/${videoId}`,
    `https://pipedapi.kavin.rocks/streams/${videoId}`,
    `https://inv.nadeko.net/api/v1/videos/${videoId}`,
    `https://invidious.nerqv.ai/api/v1/videos/${videoId}`,
    `https://vid.puffyan.us/api/v1/videos/${videoId}`
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(ep, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const streams = data.audioStreams || data.adaptiveFormats;
        if (Array.isArray(streams) && streams.length > 0) {
          const audio = streams.filter(s => (s.mimeType || s.type || '').includes('audio'));
          if (audio.length > 0 && audio[0].url) {
            return audio[0].url;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

// 3. Extracción mediante motor Cobalt (Respaldo final)
async function getCobaltAudio(videoId) {
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
        })
      });
      if (res.ok) {
        const json = await res.json();
        const streamUrl = json.url || (json.picker && json.picker[0]?.url);
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
    // Probar métodos en cascada
    let audioUrl = await getAndroidInnerTubeAudio(videoId);
    if (!audioUrl) audioUrl = await getPipedInvidiousAudio(videoId);
    if (!audioUrl) audioUrl = await getCobaltAudio(videoId);

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