const { GoogleGenerativeAI } = require('@google/generative-ai');
const Store = require('electron-store');

const store = new Store();

function getApiKey() {
  const key = store.get('geminiApiKey') || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Clé API Gemini non configurée. Ajoutez-la dans Paramètres → Intelligence Artificielle.');
  return key;
}

const BASE_SYSTEM_PROMPT = `Tu es NEXUS, un agent IA personnel desktop ultra-complet. Tu es l'assistant personnel de l'utilisateur sur son PC Windows.

Personnalité : Pro et efficace — direct, structuré, sans bla-bla, type "consultant business" qui anticipe les besoins.

Capacités :
- Contrôle du PC (volume, luminosité, lancement d'apps, gestion fichiers)
- Gestion de tâches et productivité
- Suivi des habitudes quotidiennes
- Analyse de statistiques de productivité
- Modes de travail intelligents (Focus, Gaming, Étude, Détente, Créatif, Sport, Lecture, Streaming)
- Réponses sur l'actualité et le web depuis ta base de connaissance (pas d'outil de recherche externe)
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

// Convert JSON Schema type to Gemini type string
function toGeminiType(type) {
  if (!type) return 'STRING';
  const map = { string: 'STRING', number: 'NUMBER', integer: 'NUMBER', boolean: 'BOOLEAN', object: 'OBJECT', array: 'ARRAY' };
  return map[type.toLowerCase()] || 'STRING';
}

// Convert Anthropic-style input_schema to Gemini parameters schema
function convertSchema(schema) {
  if (!schema || !schema.properties) return { type: 'OBJECT', properties: {} };

  const properties = {};
  for (const [key, val] of Object.entries(schema.properties)) {
    const prop = { type: toGeminiType(val.type), description: val.description || '' };
    if (val.enum) prop.enum = val.enum;
    if (val.type === 'object' && val.properties) prop.properties = convertSchema(val).properties;
    properties[key] = prop;
  }

  const result = { type: 'OBJECT', properties };
  if (schema.required && schema.required.length) result.required = schema.required;
  return result;
}

// Build Gemini-compatible tool declarations from the tool list
function getGeminiTools() {
  const { getTools } = require('./tools-list');
  return [
    // Google Search grounding — gratuit, temps réel, natif Gemini 2.x
    { googleSearch: {} },
    {
      functionDeclarations: getTools().map(t => ({
        name: t.name,
        description: t.description,
        parameters: convertSchema(t.input_schema),
      })),
    },
  ];
}

// Convert message array to Gemini history format (all but last)
function toGeminiHistory(messages) {
  const history = [];
  for (const m of messages) {
    if (typeof m.content !== 'string') continue; // skip tool-result arrays
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  return history;
}

function getModel(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel(
    {
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemPrompt(),
      tools: getGeminiTools(),
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { maxOutputTokens: 2048 },
    }
  );
}

async function chat(messages) {
  const { executeTool } = require('./tools');
  const apiKey = getApiKey();
  const model = getModel(apiKey);

  const history = toGeminiHistory(messages.slice(0, -1));
  const lastMsg = messages[messages.length - 1];

  const chatSession = model.startChat({ history });
  let result = await chatSession.sendMessage(lastMsg.content || '');
  let response = result.response;

  const toolsUsed = [];

  // Tool use loop (max 5 rounds)
  for (let round = 0; round < 5; round++) {
    const functionCalls = response.functionCalls ? response.functionCalls() : [];
    if (!functionCalls || !functionCalls.length) break;

    const toolResponses = [];
    for (const fc of functionCalls) {
      console.log(`[Gemini] Tool call: ${fc.name}`, fc.args);
      const toolResult = await executeTool(fc.name, fc.args || {});
      toolsUsed.push({ name: fc.name, args: fc.args });
      toolResponses.push({
        functionResponse: { name: fc.name, response: toolResult },
      });
    }

    const continueResult = await chatSession.sendMessage(toolResponses);
    response = continueResult.response;
  }

  return {
    content: response.text(),
    model: 'gemini-2.5-flash',
    isLocal: false,
    toolsUsed,
  };
}

async function* chatStream(messages) {
  const { executeTool } = require('./tools');
  const apiKey = getApiKey();
  const model = getModel(apiKey);

  const history = toGeminiHistory(messages.slice(0, -1));
  const lastMsg = messages[messages.length - 1];

  const chatSession = model.startChat({ history });
  const streamResult = await chatSession.sendMessageStream(lastMsg.content || '');

  for await (const chunk of streamResult.stream) {
    try {
      const text = chunk.text();
      if (text) yield { type: 'text', content: text };
    } catch {
      // Chunk may not have text (e.g. function call chunk)
    }
  }

  const response = await streamResult.response;
  const functionCalls = response.functionCalls ? response.functionCalls() : [];

  if (functionCalls && functionCalls.length) {
    const toolResponses = [];
    for (const fc of functionCalls) {
      const toolResult = await executeTool(fc.name, fc.args || {});
      yield { type: 'tool_result', toolName: fc.name, result: toolResult };
      toolResponses.push({
        functionResponse: { name: fc.name, response: toolResult },
      });
    }

    // Get final response after tools
    const finalResult = await chatSession.sendMessage(toolResponses);
    const finalText = finalResult.response.text();
    if (finalText) yield { type: 'text', content: finalText };
  }

  yield { type: 'done' };
}

module.exports = { chat, chatStream };
