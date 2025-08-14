import { ApiService } from './api';
import type { ApiConfig } from '../types';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  is_active: boolean;
  picture?: string;
  oauth_github?: string;
  oauth_google?: string;
}

export interface AdminUserCreate {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  is_active: boolean;
  password?: string;
}

export interface AdminUserUpdate {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
  is_active?: boolean;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  pages: number;
}

export interface GitHubConfig {
  id: number;
  api_key: string;
  polling_interval_minutes: number;
  poller_enabled: boolean;
  last_poll_time?: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubConfigCreate {
  api_key: string;
  polling_interval_minutes?: number;
  poller_enabled?: boolean;
  last_poll_time?: string;
}

export interface GitHubConfigUpdate {
  api_key?: string;
  polling_interval_minutes?: number;
  poller_enabled?: boolean;
  last_poll_time?: string;
}

export interface BackgroundPollerStatus {
  is_running: boolean;
  database_enabled: boolean;
  last_poll_time: string | null;
  polling_interval_minutes: number;
  task_alive: boolean;
}

export interface BackgroundPollerResult {
  status: string;
  message: string;
  clients_polled?: number;
  updates_created?: number;
  errors?: string[];
  timestamp?: string;
}

export class AdminService extends ApiService {
  constructor(config: ApiConfig) {
    super(config);
  }

  // User management
  async getUsers(page: number = 1, limit: number = 20): Promise<AdminUsersResponse> {
    return this.get<AdminUsersResponse>(`/admin/users?page=${page}&limit=${limit}`);
  }

  async createUser(user: AdminUserCreate): Promise<AdminUser> {
    return this.post<AdminUser>('/admin/users', user);
  }

  async updateUser(userId: number, user: AdminUserUpdate): Promise<AdminUser> {
    return this.patch<AdminUser>(`/admin/users/${userId}`, user);
  }

  async deleteUser(userId: number): Promise<void> {
    await this.delete(`/admin/users/${userId}`);
  }

  async toggleUserStatus(userId: number): Promise<AdminUser> {
    return this.patch<AdminUser>(`/admin/users/${userId}/toggle-status`);
  }

  // GitHub configuration
  async getGitHubConfig(): Promise<GitHubConfig | null> {
    try {
      return await this.get<GitHubConfig>('/admin/github-config');
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createGitHubConfig(config: GitHubConfigCreate): Promise<GitHubConfig> {
    return this.post<GitHubConfig>('/admin/github-config', config);
  }

  async updateGitHubConfig(config: GitHubConfigUpdate): Promise<GitHubConfig> {
    return this.patch<GitHubConfig>('/admin/github-config', config);
  }

  // Server-side background poller methods
  async startBackgroundPoller(): Promise<BackgroundPollerResult> {
    return this.post<BackgroundPollerResult>('/admin/poller/start');
  }

  async stopBackgroundPoller(): Promise<BackgroundPollerResult> {
    return this.post<BackgroundPollerResult>('/admin/poller/stop');
  }

  async getBackgroundPollerStatus(): Promise<BackgroundPollerStatus> {
    return this.get<BackgroundPollerStatus>('/admin/poller/status');
  }

  async pollNowBackground(): Promise<BackgroundPollerResult> {
    return this.post<BackgroundPollerResult>('/admin/poller/poll-now');
  }
}