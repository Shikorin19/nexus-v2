const { Ollama } = require('ollama');

const client = new Ollama({ host: 'http://localhost:11434' });

const DEFAULT_MODEL = 'llama3.2:3b';

async function isAvailable() {
  try {
    await client.list();
    return true;
  } catch {
    return false;
  }
}

async function classify(text) {
  try {
    const response = await client.generate({
      model: DEFAULT_MODEL,
      prompt: `Classifie cette requête utilisateur en "local" ou "cloud".

LOCAL: commandes système (<30 mots), lancer une app, volume, luminosité, créer fichier, requête très courte et simple.
CLOUD: raisonnement complexe, code, analyse, créativité, questions longues, recherche, explication détaillée.

Requête: "${text}"

Réponds UNIQUEMENT avec le mot "local" ou "cloud".`,
      stream: false,
    });
    const result = response.response.trim().toLowerCase();
    return result.includes('local') ? 'local' : 'cloud';
  } catch {
    return 'cloud';
  }
}

async function chat(messages) {
  try {
    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await client.chat({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Tu es NEXUS, un assistant IA personnel. Sois direct et concis. Réponds en français.',
        },
        ...formattedMessages,
      ],
      stream: false,
    });

    return response.message.content;
  } catch (err) {
    throw new Error(`Ollama error: ${err.message}`);
  }
}

async function* chatStream(messages) {
  const formattedMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const stream = await client.chat({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es NEXUS, un assistant IA personnel. Sois direct et concis. Réponds en français.',
      },
      ...formattedMessages,
    ],
    stream: true,
  });

  for await (const part of stream) {
    if (part.message?.content) {
      yield { type: 'text', content: part.message.content };
    }
    if (part.done) {
      yield { type: 'done' };
    }
  }
}

module.exports = { isAvailable, classify, chat, chatStream };
