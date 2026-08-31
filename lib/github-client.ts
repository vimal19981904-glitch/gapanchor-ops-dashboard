import { Octokit } from '@octokit/rest';

export function createGitHubClient(token?: string): Octokit | null {
  const t = token || process.env.GITHUB_TOKEN;
  if (!t) return null;
  return new Octokit({ auth: t });
}

export async function fetchRecentCommits(owner: string, repo: string, token?: string, count: number = 20) {
  const client = createGitHubClient(token);
  if (!client) return [];

  try {
    const { data } = await client.repos.listCommits({
      owner,
      repo,
      per_page: count,
    });

    return data.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author?.name || 'Unknown',
      date: commit.commit.author?.date || '',
      url: commit.html_url,
    }));
  } catch (error) {
    console.error('GitHub API error:', error);
    return [];
  }
}

export async function fetchRecentPRs(owner: string, repo: string, token?: string, count: number = 10) {
  const client = createGitHubClient(token);
  if (!client) return [];

  try {
    const { data } = await client.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: count,
      sort: 'updated',
      direction: 'desc',
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged_at !== null,
      author: pr.user?.login || 'Unknown',
      date: pr.updated_at,
      url: pr.html_url,
    }));
  } catch (error) {
    console.error('GitHub API PR error:', error);
    return [];
  }
}

export function isGitHubConfigured(): boolean {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}
