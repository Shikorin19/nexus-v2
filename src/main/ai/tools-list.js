// Shared tool definitions (Anthropic schema format)
// Used by gemini-client.js (converted to Gemini format) and claude-client.js directly

function getTools() {
  return [
    {
      name: 'set_volume',
      description: 'Modifier le volume sonore du système (0-100)',
      input_schema: {
        type: 'object',
        properties: { level: { type: 'number', description: 'Volume 0-100' } },
        required: ['level'],
      },
    },
    {
      name: 'launch_app',
      description: 'Lancer une application Windows',
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string', description: "Nom ou chemin de l'application" } },
        required: ['name'],
      },
    },
    {
      name: 'close_app',
      description: 'Fermer une application Windows en cours',
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string', description: "Nom du processus à fermer" } },
        required: ['name'],
      },
    },
    {
      name: 'create_file',
      description: 'Créer un fichier avec du contenu',
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
      name: 'read_file',
      description: 'Lire le contenu d\'un fichier',
      input_schema: {
        type: 'object',
        properties: { filePath: { type: 'string', description: 'Chemin du fichier' } },
        required: ['filePath'],
      },
    },
    {
      name: 'open_url',
      description: 'Ouvrir une URL dans le navigateur par défaut',
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
      description: 'Obtenir les informations système (RAM, CPU, hostname, uptime)',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'create_task',
      description: 'Créer une nouvelle tâche dans le gestionnaire de tâches NEXUS',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titre de la tâche' },
          description: { type: 'string', description: 'Description détaillée' },
          priority: { type: 'string', description: 'P1 (urgent), P2 (normal), P3 (faible)' },
          deadline: { type: 'string', description: 'Date limite au format ISO 8601' },
        },
        required: ['title'],
      },
    },
    {
      name: 'power_action',
      description: "Effectuer une action d'alimentation système",
      input_schema: {
        type: 'object',
        properties: { action: { type: 'string', description: 'shutdown, restart, sleep, lock' } },
        required: ['action'],
      },
    },
    {
      name: 'take_screenshot',
      description: "Prendre une capture d'écran",
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'web_search',
      description: "Rechercher sur le web avec Brave Search. Utilise cet outil pour des informations récentes, des actualités, ou toute question nécessitant internet.",
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
      description: 'Rechercher des pages dans Notion',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Terme de recherche (laisser vide pour tout lister)' } },
      },
    },
    {
      name: 'notion_create_page',
      description: 'Créer une nouvelle page dans Notion',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titre de la page' },
          content: { type: 'string', description: 'Contenu de la page' },
        },
        required: ['title'],
      },
    },
    {
      name: 'remember',
      description: "Mémoriser une information de façon persistante. Utilise quand l'utilisateur dit souviens-toi, mémorise, retiens.",
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Clé descriptive courte (ex: projet_actuel, préférence_café)' },
          value: { type: 'string', description: 'Valeur à mémoriser' },
        },
        required: ['key', 'value'],
      },
    },
    {
      name: 'recall',
      description: "Rappeler toutes les informations mémorisées.",
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'forget',
      description: 'Oublier une information mémorisée',
      input_schema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Clé à supprimer' } },
        required: ['key'],
      },
    },
  ];
}

module.exports = { getTools };
