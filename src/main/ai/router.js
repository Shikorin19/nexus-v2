const ollamaClient = require('./ollama-client');
const geminiClient = require('./gemini-client');

// Simple keyword-based local routing (fast, no Ollama needed)
const LOCAL_KEYWORDS = [
  /^(monte|baisse|règle|mets?|set|volume|son)\s*(le\s*)?(volume|son)/i,
  /^(lance|ouvre|démarre|start|open)\s+\w+/i,
  /^(ferme|quitte|close|kill|arrête)\s+\w+/i,
  /^(crée?|create|nouveau|new)\s+(un\s+)?(fichier|file|dossier|folder)/i,
  /^(luminosité|brightness|écran|screen)\s+/i,
  /^(verrouille|lock|éteins?|shutdown|redémarre|restart|veille|sleep)/i,
  /^(capture|screenshot|printscreen)/i,
  /^(heure|date|quel\s+jour|quelle\s+heure)/i,
];

function isLocalRequest(text) {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.split(' ').length <= 5) {
    for (const pattern of LOCAL_KEYWORDS) {
      if (pattern.test(trimmed)) return true;
    }
  }
  return false;
}

async function routeMessage(messages, forceCloud = false) {
  const lastMessage = messages[messages.length - 1];
  const userText = lastMessage?.content || '';

  // Try Ollama for simple local requests first
  if (!forceCloud) {
    const shouldTryLocal = isLocalRequest(userText);
    if (shouldTryLocal) {
      try {
        const ollamaAvailable = await ollamaClient.isAvailable();
        if (ollamaAvailable) {
          const response = await ollamaClient.chat(messages);
          return { content: response, model: 'ollama-local', isLocal: true };
        }
      } catch (err) {
        console.error('[Router] Ollama failed, falling back to Gemini:', err.message);
      }
    }
  }

  // Cloud: Gemini 2.0 Flash
  try {
    return await geminiClient.chat(messages);
  } catch (err) {
    console.error('[Router] Gemini error:', err.message);

    // Last resort: try Ollama even if not in local-request mode
    if (!forceCloud) {
      try {
        const ollamaAvailable = await ollamaClient.isAvailable();
        if (ollamaAvailable) {
          const response = await ollamaClient.chat(messages);
          return { content: response, model: 'ollama-local', isLocal: true };
        }
      } catch {}
    }

    return {
      content: `Erreur IA : ${err.message}. Vérifiez votre clé API Gemini dans les Paramètres.`,
      model: 'error',
      isLocal: false,
      error: true,
    };
  }
}

async function* routeMessageStream(messages) {
  try {
    yield* geminiClient.chatStream(messages);
  } catch (err) {
    console.error('[Router Stream] Gemini error:', err.message);
    yield { type: 'error', content: `Erreur: ${err.message}` };
    yield { type: 'done' };
  }
}

module.exports = { routeMessage, routeMessageStream };
