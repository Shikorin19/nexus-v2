const axios = require('axios');

function getHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };
}

async function searchPages(token, query = '') {
  if (!token) return { error: 'no_token' };

  try {
    const res = await axios.post('https://api.notion.com/v1/search', {
      query,
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 10,
    }, { headers: getHeaders(token), timeout: 10000 });

    return {
      pages: res.data.results.map(p => {
        const titleProp = p.properties?.title?.title || p.properties?.Name?.title || [];
        const title = titleProp[0]?.text?.content || 'Sans titre';
        return {
          id: p.id,
          title,
          url: p.url,
          lastEdited: p.last_edited_time,
        };
      }),
    };
  } catch (err) {
    console.error('[Notion]', err.message);
    return { error: err.response?.data?.message || err.message };
  }
}

async function createPage(token, parentPageId, title, content) {
  if (!token) return { error: 'no_token' };
  if (!parentPageId) return { error: 'parent_page_id required — configure it in Settings' };

  try {
    const children = [];
    if (content) {
      const paragraphs = content.split('\n').filter(Boolean);
      for (const para of paragraphs) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: para } }] },
        });
      }
    }

    const res = await axios.post('https://api.notion.com/v1/pages', {
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ text: { content: title } }] },
      },
      children,
    }, { headers: getHeaders(token), timeout: 10000 });

    return { id: res.data.id, url: res.data.url, title };
  } catch (err) {
    console.error('[Notion createPage]', err.message);
    return { error: err.response?.data?.message || err.message };
  }
}

async function appendToPage(token, pageId, content) {
  if (!token) return { error: 'no_token' };

  try {
    await axios.patch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content } }] },
      }],
    }, { headers: getHeaders(token), timeout: 10000 });

    return { success: true };
  } catch (err) {
    return { error: err.response?.data?.message || err.message };
  }
}

module.exports = { searchPages, createPage, appendToPage };
