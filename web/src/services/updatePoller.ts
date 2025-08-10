/**
 * Background service for polling GitHub repositories and detecting updates
 */

import { GitHubApiService, type GitHubRelease, type GitHubTag } from './github';
import { ReleaseNotesParser, type ParsedRelease } from './releaseParser';
import type { Client } from '../types/client';
import type { ProtocolUpdateCreate } from '../types/protocol';

export interface PollResult {
  client: Client;
  updates: DetectedUpdate[];
  errors: string[];
  lastPolled: Date;
}

export interface DetectedUpdate {
  type: 'release' | 'tag';
  data: GitHubRelease | GitHubTag;
  parsed: ParsedRelease;
  protocolUpdate: ProtocolUpdateCreate;
  confidenceScore: number;
}

export interface PollingStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  totalClients: number;
  processedClients: number;
  errors: string[];
}

export class UpdatePollerService {
  private githubService: GitHubApiService;
  private pollingInterval: number;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private lastRunData: Map<number, Date> = new Map();

  constructor(githubApiKey?: string, pollingIntervalMinutes = 30) {
    this.githubService = new GitHubApiService(githubApiKey);
    this.pollingInterval = pollingIntervalMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Start the polling service
   */
  start(): void {
    if (this.isRunning) {
      console.log('Update poller is already running');
      return;
    }

    console.log(`Starting update poller with ${this.pollingInterval / 60000} minute interval`);
    this.isRunning = true;
    
    // Run immediately, then on interval
    this.runPollingCycle();
    this.intervalId = setInterval(() => {
      this.runPollingCycle();
    }, this.pollingInterval);
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    console.log('Stopping update poller');
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Get current polling status
   */
  getStatus(): PollingStatus {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRunData.size > 0 ? new Date(Math.max(...Array.from(this.lastRunData.values()).map(d => d.getTime()))) : undefined,
      nextRun: this.intervalId ? new Date(Date.now() + this.pollingInterval) : undefined,
      totalClients: this.lastRunData.size,
      processedClients: this.lastRunData.size,
      errors: [],
    };
  }

  /**
   * Poll a single client for updates
   */
  async pollClient(client: Client): Promise<PollResult> {
    const result: PollResult = {
      client,
      updates: [],
      errors: [],
      lastPolled: new Date(),
    };

    if (!client.github_url) {
      result.errors.push('No GitHub URL configured');
      return result;
    }

    try {
      const repoInfo = this.githubService.parseGitHubUrl(client.github_url);
      if (!repoInfo) {
        result.errors.push('Invalid GitHub URL format');
        return result;
      }

      // Determine what to fetch based on repo_type
      const shouldFetchReleases = !client.repo_type || client.repo_type.toLowerCase() === 'releases';
      const shouldFetchTags = client.repo_type?.toLowerCase() === 'tags';
      
      console.log(`🎯 Client ${client.name} repo_type: ${client.repo_type || 'undefined (default: releases)'}`);
      console.log(`📋 Will fetch - Releases: ${shouldFetchReleases}, Tags: ${shouldFetchTags}`);
      console.log(`🔧 DEBUG: Full import logic loaded - v3 - ${new Date().getTime()}`);

      // Get the last poll time for this client
      const storedLastPoll = this.lastRunData.get(client.id);
      const currentTime = new Date();
      const isFirstPoll = !storedLastPoll;
      
      console.log(`🗂️ Stored last poll for client ${client.id}: ${storedLastPoll?.toISOString() || 'none'}`);
      console.log(`🆕 Is first poll (no stored timestamp): ${isFirstPoll}`);
      console.log(`⏱️ Current time: ${currentTime.toISOString()}`);
      
      if (storedLastPoll && storedLastPoll > currentTime) {
        console.warn(`⚠️ Stored poll time is in the future! Treating as first poll.`);
      }

      if (shouldFetchReleases) {
        try {
          let releases;
          console.log(`🔍 Decision logic: isFirstPoll=${isFirstPoll}, storedLastPoll=${!!storedLastPoll}, futureDate=${storedLastPoll && storedLastPoll > currentTime}`);
          
          if (isFirstPoll || (storedLastPoll && storedLastPoll > currentTime)) {
            console.log(`📦 TAKING FIRST POLL PATH: Fetching ALL releases for initial import`);
            releases = await this.githubService.getReleases(repoInfo.owner, repoInfo.repo, 1, 100);
          } else {
            console.log(`🔄 TAKING SUBSEQUENT POLL PATH: Fetching releases since ${storedLastPoll?.toISOString()}`);
            releases = await this.githubService.getReleasesSince(repoInfo.owner, repoInfo.repo, storedLastPoll);
          }
          
          for (const release of releases) {
            const detectedUpdate = await this.processRelease(client, release);
            if (detectedUpdate) {
              result.updates.push(detectedUpdate);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to fetch releases: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (shouldFetchTags) {
        try {
          let tags;
          if (isFirstPoll || (storedLastPoll && storedLastPoll > currentTime)) {
            console.log(`📦 First poll: Fetching ALL tags for initial import`);
            tags = await this.githubService.getTags(repoInfo.owner, repoInfo.repo, 1, 100);
          } else {
            console.log(`🔄 Subsequent poll: Fetching tags since ${storedLastPoll?.toISOString()}`);
            tags = await this.githubService.getTagsSince(repoInfo.owner, repoInfo.repo, storedLastPoll);
          }
          
          for (const tag of tags) {
            const detectedUpdate = await this.processTag(client, tag, repoInfo);
            if (detectedUpdate) {
              result.updates.push(detectedUpdate);
            }
          }
        } catch (error) {
          result.errors.push(`Failed to fetch tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update last poll time
      this.lastRunData.set(client.id, result.lastPolled);

    } catch (error) {
      result.errors.push(`General error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Process a GitHub release
   */
  private async processRelease(client: Client, release: GitHubRelease): Promise<DetectedUpdate | null> {
    try {
      const publishedAt = new Date(release.published_at);
      const parsed = ReleaseNotesParser.parseReleaseNotes(
        release.name || release.tag_name,
        release.body || '',
        release.tag_name,
        publishedAt
      );

      const confidenceScore = ReleaseNotesParser.calculateConfidenceScore(parsed, release.tag_name);

      const protocolUpdate: ProtocolUpdateCreate = {
        name: client.name || client.client || 'Unknown Client',
        title: release.name || release.tag_name,
        client: client.client || client.name || 'Unknown',
        tag: release.tag_name,
        date: release.published_at,
        url: release.html_url,
        notes: release.body || '',
        github_url: release.html_url,
        is_draft: release.draft,
        is_prerelease: release.prerelease,
        release_name: release.name || undefined,
        tarball: release.tarball_url || undefined,
        hard_fork: parsed.hasHardFork,
        fork_date: parsed.forkDate?.toISOString(),
        is_closed: true, // Releases are considered closed by default
      };

      return {
        type: 'release',
        data: release,
        parsed,
        protocolUpdate,
        confidenceScore,
      };
    } catch (error) {
      console.error('Error processing release:', error);
      return null;
    }
  }

  /**
   * Process a GitHub tag
   */
  private async processTag(client: Client, tag: GitHubTag, repoInfo: { owner: string; repo: string }): Promise<DetectedUpdate | null> {
    try {
      // For tags, we have limited information, so we make assumptions
      const publishedAt = new Date(); // We don't have published date for tags
      const parsed = ReleaseNotesParser.parseReleaseNotes(
        tag.name,
        '', // No body for tags
        tag.name,
        publishedAt
      );

      const confidenceScore = ReleaseNotesParser.calculateConfidenceScore(parsed, tag.name);

      const protocolUpdate: ProtocolUpdateCreate = {
        name: client.name || client.client || 'Unknown Client',
        title: tag.name,
        client: client.client || client.name || 'Unknown',
        tag: tag.name,
        date: new Date().toISOString(), // Current date since we don't have tag date
        url: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/releases/tag/${tag.name}`,
        notes: `Tagged release ${tag.name}`,
        github_url: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/releases/tag/${tag.name}`,
        is_draft: false,
        is_prerelease: false,
        tarball: tag.tarball_url || undefined,
        hard_fork: parsed.hasHardFork,
        fork_date: parsed.forkDate?.toISOString(),
        is_closed: true,
      };

      return {
        type: 'tag',
        data: tag,
        parsed,
        protocolUpdate,
        confidenceScore,
      };
    } catch (error) {
      console.error('Error processing tag:', error);
      return null;
    }
  }

  /**
   * Run a complete polling cycle for all clients
   */
  private async runPollingCycle(): Promise<void> {
    console.log('Starting polling cycle...');
    
    try {
      // In a real implementation, you would fetch clients from your API
      // For now, this is a placeholder that would integrate with your client service
      const clients = await this.getClientsToPolll();
      
      for (const client of clients) {
        try {
          const result = await this.pollClient(client);
          
          if (result.updates.length > 0) {
            console.log(`Found ${result.updates.length} updates for client ${client.name}`);
            // Here you would save the updates to your database
            await this.saveUpdates(result.updates);
          }
          
          if (result.errors.length > 0) {
            console.warn(`Errors polling client ${client.name}:`, result.errors);
          }
        } catch (error) {
          console.error(`Failed to poll client ${client.id}:`, error);
        }
        
        // Small delay between clients to be respectful to GitHub API
        await this.delay(1000);
      }
      
    } catch (error) {
      console.error('Error in polling cycle:', error);
    }
    
    console.log('Polling cycle completed');
  }

  /**
   * Get clients that should be polled (placeholder)
   */
  private async getClientsToPolll(): Promise<Client[]> {
    // This would integrate with your actual client service
    // For now, return empty array
    return [];
  }

  /**
   * Save detected updates (placeholder)
   */
  private async saveUpdates(updates: DetectedUpdate[]): Promise<void> {
    // This would integrate with your actual protocol update service
    for (const update of updates) {
      console.log('Would save update:', {
        client: update.protocolUpdate.client,
        tag: update.protocolUpdate.tag,
        hardFork: update.protocolUpdate.hard_fork,
        confidence: update.confidenceScore,
      });
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set GitHub API key
   */
  setGitHubApiKey(apiKey: string): void {
    this.githubService = new GitHubApiService(apiKey);
  }

  /**
   * Update polling interval
   */
  setPollingInterval(minutes: number): void {
    this.pollingInterval = minutes * 60 * 1000;
    
    // Restart if currently running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Reset poll timestamps to fix future date issues
   */
  resetPollTimestamps(): void {
    console.log('🔄 Resetting all poll timestamps to fix future date issues');
    this.lastRunData.clear();
  }
}