/**
 * GitHub API service for fetching releases and tags
 */

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  tarball_url: string;
  author: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  tarball_url: string;
  zipball_url: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
}

export class GitHubApiService {
  private apiKey?: string;
  private baseUrl = 'https://api.github.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): GitHubRepository | null {
    console.log(`🔍 Parsing GitHub URL: ${url}`);
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('github.com')) {
        console.warn(`❌ Invalid GitHub hostname: ${urlObj.hostname}`);
        return null;
      }

      const pathParts = urlObj.pathname.split('/').filter(p => p);
      console.log(`📂 Path parts: ${pathParts.join(', ')}`);
      
      if (pathParts.length >= 2) {
        const result = {
          owner: pathParts[0],
          repo: pathParts[1].replace('.git', ''), // Remove .git suffix if present
        };
        console.log(`✅ Parsed: ${result.owner}/${result.repo}`);
        return result;
      } else {
        console.warn(`❌ Insufficient path parts: ${pathParts.length}`);
      }
    } catch (error) {
      console.error('❌ Failed to parse GitHub URL:', error);
    }
    return null;
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    console.log(`🌐 GitHub API Request: ${fullUrl}`);
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Proto-Tracker/1.0',
    };

    if (this.apiKey) {
      headers['Authorization'] = `token ${this.apiKey}`;
      console.log('🔑 Using authenticated request');
    } else {
      console.warn('⚠️ No GitHub API key - using unauthenticated request (rate limited)');
    }

    try {
      const response = await fetch(fullUrl, {
        headers,
      });

      console.log(`📡 GitHub API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ GitHub API Error: ${response.status} - ${errorText}`);
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`📊 GitHub API Data: Found ${Array.isArray(data) ? data.length : 1} items`);
      return data;
    } catch (error) {
      console.error('❌ GitHub API Request Failed:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch from GitHub API: ${error.message}`);
      }
      throw new Error('Unknown error occurred while fetching from GitHub API');
    }
  }

  /**
   * Get releases for a repository
   */
  async getReleases(owner: string, repo: string, page = 1, perPage = 30): Promise<GitHubRelease[]> {
    return this.makeRequest<GitHubRelease[]>(`/repos/${owner}/${repo}/releases?page=${page}&per_page=${perPage}`);
  }

  /**
   * Get tags for a repository
   */
  async getTags(owner: string, repo: string, page = 1, perPage = 30): Promise<GitHubTag[]> {
    return this.makeRequest<GitHubTag[]>(`/repos/${owner}/${repo}/tags?page=${page}&per_page=${perPage}`);
  }

  /**
   * Get the latest release for a repository
   */
  async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease> {
    return this.makeRequest<GitHubRelease>(`/repos/${owner}/${repo}/releases/latest`);
  }

  /**
   * Get all releases since a specific date
   */
  async getReleasesSince(owner: string, repo: string, since: Date): Promise<GitHubRelease[]> {
    const releases = await this.getReleases(owner, repo, 1, 1000);
    console.log(`🗓️ Filtering releases since: ${since.toISOString()}`);
    console.log(`📅 Current date: ${new Date().toISOString()}`);
    
    const filteredReleases = releases.filter(release => {
      const publishedAt = new Date(release.published_at);
      const isNewer = publishedAt > since;
      return isNewer;
    });
    
    console.log(`📊 Releases before filtering: ${releases.length}`);
    console.log(`📊 Releases after filtering: ${filteredReleases.length}`);
    
    if (releases.length > 0) {
      console.log(`📅 Latest release date: ${releases[0]?.published_at}`);
      console.log(`📅 Oldest release date: ${releases[releases.length - 1]?.published_at}`);
    }
    
    return filteredReleases;
  }

  /**
   * Get all tags since a specific date (requires commit info)
   */
  async getTagsSince(owner: string, repo: string, since: Date): Promise<GitHubTag[]> {
    const tags = await this.getTags(owner, repo, 1, 100);
    // Note: For tags, we can't directly filter by date without additional API calls
    // to get commit info. This is a simplified version.
    return tags;
  }

  /**
   * Check rate limit status
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  }> {
    const response = await this.makeRequest<{
      rate: {
        limit: number;
        remaining: number;
        reset: number;
        used: number;
      };
    }>('/rate_limit');
    
    return response.rate;
  }

  /**
   * Test if repository exists and is accessible
   */
  async testRepository(owner: string, repo: string): Promise<boolean> {
    try {
      await this.makeRequest(`/repos/${owner}/${repo}`);
      return true;
    } catch {
      return false;
    }
  }
}