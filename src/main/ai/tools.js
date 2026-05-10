const { ipcMain } = require('electron');

async function executeTool(toolName, args) {
  const { setVolume, setBrightness, getVolume, powerAction, takeScreenshot } = require('../pc-control/system');
  const { launchApp, closeApp, listRunningApps } = require('../pc-control/apps');
  const { createFile, readFile, deleteFile } = require('../pc-control/files');
  const { createTask, saveMemory, getAllMemories, deleteMemory } = require('../db/db');
  const { shell } = require('electron');
  const os = require('os');
  const Store = require('electron-store');
  const store = new Store();

  try {
    switch (toolName) {
      case 'set_volume': {
        const result = await setVolume(args.level);
        return { success: true, message: `Volume réglé à ${args.level}%`, result };
      }

      case 'get_volume': {
        const level = await getVolume();
        return { success: true, volume: level };
      }

      case 'set_brightness': {
        const result = await setBrightness(args.level);
        return { success: true, message: `Luminosité réglée à ${args.level}%`, result };
      }

      case 'launch_app': {
        const result = await launchApp(args.name);
        return { success: true, message: `Application "${args.name}" lancée`, result };
      }

      case 'close_app': {
        const result = await closeApp(args.name);
        return { success: true, message: `Application "${args.name}" fermée`, result };
      }

      case 'list_apps': {
        const apps = await listRunningApps();
        return { success: true, apps };
      }

      case 'create_file': {
        const result = await createFile(args.filePath, args.content || '');
        return { success: true, message: `Fichier créé : ${args.filePath}`, result };
      }

      case 'read_file': {
        const content = await readFile(args.filePath);
        return { success: true, content };
      }

      case 'delete_file': {
        const result = await deleteFile(args.filePath);
        return { success: true, message: `Fichier supprimé : ${args.filePath}`, result };
      }

      case 'open_url': {
        await shell.openExternal(args.url);
        return { success: true, message: `URL ouverte : ${args.url}` };
      }

      case 'get_system_info': {
        return {
          success: true,
          info: {
            platform: process.platform,
            cpus: os.cpus().length,
            totalMemGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
            freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
            uptimeHours: (os.uptime() / 3600).toFixed(1),
            hostname: os.hostname(),
            username: os.userInfo().username,
          },
        };
      }

      case 'create_task': {
        const task = createTask({
          title: args.title,
          description: args.description || '',
          priority: args.priority || 'P2',
          deadline: args.deadline || null,
          status: 'todo',
        });
        return { success: true, message: `Tâche créée : "${args.title}"`, task };
      }

      case 'power_action': {
        const result = await powerAction(args.action);
        return { success: true, message: `Action: ${args.action}`, result };
      }

      case 'take_screenshot': {
        const result = await takeScreenshot();
        return { success: true, message: 'Capture d\'écran prise', path: result };
      }

      case 'web_search': {
        const { webSearch } = require('../integrations/tavily-search');
        const apiKey = process.env.TAVILY_API_KEY || store.get('tavilyApiKey', '');
        const result = await webSearch(args.query, apiKey);
        if (result.error) return { success: false, error: result.error };
        return {
          success: true,
          query  : result.query,
          results: result.results,
          summary: result.results.map((r, i) =>
            `${i + 1}. **${r.title}**\n${r.description}\n${r.url}`
          ).join('\n\n'),
        };
      }

      case 'notion_search': {
        const { searchPages } = require('../integrations/notion');
        const token = store.get('notionToken', '');
        const result = await searchPages(token, args.query || '');
        if (result.error) return { success: false, error: result.error };
        return {
          success: true,
          pages: result.pages,
          summary: result.pages.map(p => `- ${p.title} (${p.url})`).join('\n'),
        };
      }

      case 'notion_create_page': {
        const { createPage } = require('../integrations/notion');
        const token = store.get('notionToken', '');
        const parentPageId = store.get('notionParentPageId', '');
        const result = await createPage(token, parentPageId, args.title, args.content || '');
        if (result.error) return { success: false, error: result.error };
        return { success: true, message: `Page Notion créée : "${args.title}"`, url: result.url };
      }

      case 'remember': {
        saveMemory(args.key, args.value);
        return { success: true, message: `Mémorisé : "${args.key}" = ${JSON.stringify(args.value)}` };
      }

      case 'recall': {
        const memories = getAllMemories();
        if (!memories.length) return { success: true, memories: [], summary: 'Aucune mémoire enregistrée.' };
        return {
          success: true,
          memories,
          summary: memories.map(m => `- **${m.key}** : ${JSON.stringify(m.value)}`).join('\n'),
        };
      }

      case 'forget': {
        deleteMemory(args.key);
        return { success: true, message: `Oublié : "${args.key}"` };
      }

      default:
        return { success: false, error: `Outil inconnu : ${toolName}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { executeTool };
