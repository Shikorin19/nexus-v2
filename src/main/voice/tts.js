if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}

const { MsEdgeTTS, OUTPUT_FORMAT, MetadataOptions } = require('msedge-tts');

const VOICE  = 'fr-FR-DeniseNeural';
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

let _tts    = null;
let _cancel = null;

async function _getTTS() {
  if (!_tts) {
    _tts = new MsEdgeTTS();
    await _tts.setMetadata(VOICE, FORMAT, MetadataOptions.WORD_BOUNDARY);
  }
  return _tts;
}

async function speak(text) {
  stopSpeaking();

  return new Promise(async (resolve, reject) => {
    let cancelled = false;
    _cancel = () => { cancelled = true; reject(new Error('stopped')); };

    try {
      const tts = await _getTTS();
      const { audioStream, metadataStream } = tts.toStream(text);
      const chunks = [];
      const words  = [];

      if (metadataStream) {
        metadataStream.on('data', (raw) => {
          try {
            const m = JSON.parse(raw.toString());
            if (m.Type === 'WordBoundary') {
              words.push({
                word:   m.Data.text.Text,
                timeMs: Math.round(m.Data.audio.streamOffset / 10000),
              });
            }
          } catch {}
        });
      }

      audioStream.on('data',  (c) => { if (!cancelled) chunks.push(c); });
      audioStream.on('end',   () => {
        if (cancelled) return;
        _cancel = null;
        
        // Contournement: si l'API n'a pas renvoyé de WordBoundary, on simule les mots
        if (words.length === 0) {
          const fakeTokens = text.split(/(\s+)/).filter(s => s.trim().length > 0);
          fakeTokens.forEach((w, i) => {
            words.push({ word: w, timeMs: i * 150 }); // Simule ~150ms par mot
          });
        }
        
        resolve({ audio: Buffer.concat(chunks).toString('base64'), words });
      });
      audioStream.on('error', (e) => {
        _tts = null;
        if (!cancelled) reject(e);
      });

    } catch (e) {
      _tts = null;
      if (!cancelled) reject(e);
    }
  });
}

function stopSpeaking() {
  if (_cancel) { _cancel(); _cancel = null; }
  if (_tts && typeof _tts.close === 'function') {
    try { _tts.close(); } catch (e) {}
  }
  _tts = null;
}

module.exports = { speak, stopSpeaking };
