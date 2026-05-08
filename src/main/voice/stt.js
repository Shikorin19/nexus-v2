const path = require('path');
const fs = require('fs');
const os = require('os');

async function transcribeAudio(audioBuffer, apiKey) {
  if (!apiKey) {
    return { error: 'no_key', text: '', message: 'Clé API Groq non configurée. Ajoutez-la dans Paramètres → Voix.' };
  }

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey });

  // Write audio buffer to temp file (webm format from MediaRecorder)
  const tmpPath = path.join(os.tmpdir(), `nexus_stt_${Date.now()}.webm`);

  try {
    fs.writeFileSync(tmpPath, Buffer.from(audioBuffer));

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'text',
      temperature: 0,
    });

    // groq-sdk returns the text directly for 'text' format
    const text = typeof transcription === 'string' ? transcription : transcription?.text || '';
    console.log('[STT] Transcription:', text);
    return { text: text.trim() };

  } catch (err) {
    console.error('[STT] Groq Whisper error:', err.message);
    return { error: err.message, text: '' };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

module.exports = { transcribeAudio };
