const axios = require('axios');

async function getGithubSummary(token) {
  if (!token) return { error: 'no_token' };

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    const userRes = await axios.get('https://api.github.com/user', { headers, timeout: 8000 });
    const user = userRes.data;

    const [eventsRes, reposRes, notificationsRes] = await Promise.all([
      axios.get(`https://api.github.com/users/${user.login}/events?per_page=15`, { headers, timeout: 8000 }),
      axios.get('https://api.github.com/user/repos?sort=updated&per_page=6&affiliation=owner', { headers, timeout: 8000 }),
      axios.get('https://api.github.com/notifications?all=false&per_page=10', { headers, timeout: 8000 }),
    ]);

    const events = eventsRes.data;
    const repos = reposRes.data;
    const notifications = notificationsRes.data;

    const recentCommits = events
      .filter(e => e.type === 'PushEvent')
      .slice(0, 5)
      .map(e => ({
        repo: e.repo.name.split('/')[1] || e.repo.name,
        message: e.payload.commits?.[0]?.message?.split('\n')[0] || '(no message)',
        date: e.created_at,
      }));

    const prNotifications = notifications
      .filter(n => n.subject.type === 'PullRequest')
      .slice(0, 5)
      .map(n => ({
        title: n.subject.title,
        repo: n.repository.name,
        updated: n.updated_at,
      }));

    const issueNotifications = notifications
      .filter(n => n.subject.type === 'Issue')
      .slice(0, 5)
      .map(n => ({
        title: n.subject.title,
        repo: n.repository.name,
        updated: n.updated_at,
      }));

    return {
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url,
        publicRepos: user.public_repos,
        followers: user.followers,
        following: user.following,
      },
      repos: repos.map(r => ({
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stars: r.stargazers_count,
        openIssues: r.open_issues_count,
        updatedAt: r.updated_at,
        private: r.private,
      })),
      recentCommits,
      prNotifications,
      issueNotifications,
      totalNotifications: notifications.length,
    };
  } catch (err) {
    console.error('[GitHub]', err.message);
    return { error: err.response?.data?.message || err.message };
  }
}

module.exports = { getGithubSummary };
