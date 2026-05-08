const Anthropic = require('@anthropic-ai/sdk');
const Store = require('electron-store');

const store = new Store();

function getClient() {
  const apiKey = store.get('anthropicApiKey') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée');
  return new Anthropic({ apiKey });
}

const BASE_SYSTEM_PROMPT = `Tu es NEXUS, un agent IA personnel desktop ultra-complet. Tu es l'assistant personnel de l'utilisateur sur son PC Windows.

Personnalité : Pro et efficace — direct, structuré, sans bla-bla, type "consultant business" qui anticipe les besoins.

Capacités :
- Contrôle du PC (volume, luminosité, lancement d'apps, gestion fichiers)
- Gestion de tâches et productivité
- Suivi des habitudes quotidiennes
- Analyse de statistiques de productivité
- Modes de travail intelligents (Focus, Gaming, Étude, Détente, Créatif, Sport, Lecture, Streaming)
- Recherche web (Brave Search) via l'outil web_search
- Gestion de pages Notion via notion_search et notion_create_page
- Mémoire persistante via remember/recall/forget

Quand l'utilisateur demande une action PC, utilise les outils. Pour une recherche web, utilise web_search. Pour mémoriser quelque chose d'important, utilise remember.

Réponds toujours en français sauf si l'utilisateur parle anglais.
Sois concis et actionnable. Pas de longues introductions.`;

function buildSystemPrompt() {
  try {
    const { getAllMemories, getRecentSummaries } = require('../db/db');
    const memories = getAllMemories();
    const summaries = getRecentSummaries(3);

    let prompt = BASE_SYSTEM_PROMPT;

    if (memories.length) {
      prompt += '\n\n## Mémoire persistante\n';
      prompt += memories.map(m => `- **${m.key}** : ${JSON.stringify(m.value)}`).join('\n');
    }

    if (summaries.length) {
      prompt += '\n\n## Résumés de conversations récentes\n';
      prompt += summaries.map(s => `- ${s.date} : ${s.summary}`).join('\n');
    }

    return prompt;
  } catch {
    return BASE_SYSTEM_PROMPT;
  }
}

async function chat(messages, { model = 'claude-sonnet-4-5', stream = false } = {}) {
  const client = getClient();

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const systemPrompt = buildSystemPrompt();

  if (stream) {
    return client.messages.stream({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: formattedMessages,
    });
  }

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: formattedMessages,
    tools: getTools(),
  });

  return response;
}

async function* chatStream(messages, model = 'claude-sonnet-4-5') {
  const client = getClient();

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const stream = await client.messages.stream({
    model,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: formattedMessages,
    tools: getTools(),
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { type: 'text', content: event.delta.text };
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      yield { type: 'tool_input', content: event.delta.partial_json };
    } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      yield { type: 'tool_start', toolName: event.content_block.name, toolId: event.content_block.id };
    } else if (event.type === 'message_stop') {
      yield { type: 'done' };
    }
  }
}

function getTools() {
  return [
    {
      name: 'set_volume',
      description: "Modifier le volume sonore du système (0-100)",
      input_schema: {
        type: 'object',
        properties: { level: { type: 'number', description: 'Volume 0-100' } },
        required: ['level'],
      },
    },
    {
      name: 'launch_app',
      description: "Lancer une application Windows",
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Nom ou chemin de l\'application' } },
        required: ['name'],
      },
    },
    {
      name: 'create_file',
      description: "Créer un fichier avec du contenu",
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Chemin du fichier à créer' },
          content: { type: 'string', description: 'Contenu du fichier' },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'open_url',
      description: "Ouvrir une URL dans le navigateur par défaut",
      input_schema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL à ouvrir' } },
        required: ['url'],
      },
    },
    {
      name: 'set_brightness',
      description: "Modifier la luminosité de l'écran (0-100)",
      input_schema: {
        type: 'object',
        properties: { level: { type: 'number', description: 'Luminosité 0-100' } },
        required: ['level'],
      },
    },
    {
      name: 'get_system_info',
      description: "Obtenir les informations système (RAM, CPU, disque)",
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'create_task',
      description: "Créer une nouvelle tâche dans le gestionnaire de tâches",
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          deadline: { type: 'string', description: 'Date ISO 8601' },
        },
        required: ['title'],
      },
    },
    {
      name: 'close_app',
      description: "Fermer une application Windows en cours",
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
    {
      name: 'web_search',
      description: "Rechercher sur le web avec Brave Search. Utilise cet outil quand l'utilisateur demande des informations récentes, des actualités, ou toute question nécessitant une recherche internet.",
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche' },
          count: { type: 'number', description: 'Nombre de résultats (1-10, défaut 5)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'notion_search',
      description: "Rechercher des pages dans Notion",
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Terme de recherche (laisser vide pour tout voir)' } },
      },
    },
    {
      name: 'notion_create_page',
      description: "Créer une nouvelle page dans Notion",
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titre de la page' },
          content: { type: 'string', description: 'Contenu de la page (texte simple, sauts de ligne possibles)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'remember',
      description: "Mémoriser une information importante de façon persistante. Utilise cet outil quand l'utilisateur dit 'souviens-toi', 'mémorise', 'retiens', etc.",
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Clé courte descriptive (ex: préférence_café, projet_actuel)' },
          value: { description: 'Valeur à mémoriser (texte, nombre, objet)' },
        },
        required: ['key', 'value'],
      },
    },
    {
      name: 'recall',
      description: "Rappeler toutes les informations mémorisées. Utilise quand l'utilisateur demande ce que tu sais, ce que tu as mémorisé, etc.",
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'forget',
      description: "Oublier une information mémorisée",
      input_schema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Clé à supprimer' } },
        required: ['key'],
      },
    },
  ];
}

module.exports = { chat, chatStream, getTools };
