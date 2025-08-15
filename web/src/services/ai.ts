/**
 * AI service for frontend API calls
 */

import { APIConfig } from '../utils/apiConfig';

export interface AIAnalysis {
  summary?: string;
  key_changes?: string[];
  breaking_changes?: string[];
  security_updates?: string[];
  upgrade_priority?: 'critical' | 'high' | 'medium' | 'low';
  risk_assessment?: string;
  technical_summary?: string;
  executive_summary?: string;
  estimated_impact?: string;
  confidence_score?: number;
  is_hard_fork?: boolean;
  hard_fork_details?: string;
  activation_block?: number;
  activation_date?: string;
  coordination_required?: boolean;
  analysis_date?: string;
  provider?: string;
}

export interface AIConfig {
  id: number;
  ai_enabled: boolean;
  provider: string;
  api_key?: string;
  model?: string;
  base_url?: string;
  auto_analyze_enabled: boolean;
  analysis_timeout_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface AIConfigUpdate {
  ai_enabled?: boolean;
  provider?: string;
  api_key?: string;
  model?: string;
  base_url?: string;
  auto_analyze_enabled?: boolean;
  analysis_timeout_seconds?: number;
}

export interface AIFeedback {
  protocol_update_id: number;
  rating: number;
  feedback_text?: string;
  helpful_aspects?: string[];
  improvement_suggestions?: string[];
}

export class AIService {
  constructor(private config: APIConfig) {}

  async getAIConfig(): Promise<AIConfig> {
    const response = await fetch(`${this.config.baseURL}/admin/ai-config`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get AI config: ${response.statusText}`);
    }

    return response.json();
  }

  async updateAIConfig(config: AIConfigUpdate): Promise<AIConfig> {
    const response = await fetch(`${this.config.baseURL}/admin/ai-config`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to update AI config: ${response.statusText}`);
    }

    return response.json();
  }

  async testAIConfig(): Promise<{ status: string; message: string; test_result?: any }> {
    const response = await fetch(`${this.config.baseURL}/admin/ai-config/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to test AI config: ${response.statusText}`);
    }

    return response.json();
  }

  async analyzeProtocolUpdate(updateId: number, forceReanalyze: boolean = false): Promise<AIAnalysis> {
    const params = new URLSearchParams();
    if (forceReanalyze) {
      params.set('force_reanalyze', 'true');
    }

    const response = await fetch(`${this.config.baseURL}/ai/analyze-update/${updateId}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to analyze protocol update: ${response.statusText}`);
    }

    return response.json();
  }

  async getAIAnalysis(updateId: number): Promise<AIAnalysis | null> {
    const response = await fetch(`${this.config.baseURL}/ai/analysis/${updateId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get AI analysis: ${response.statusText}`);
    }

    const data = await response.json();
    return data || null;
  }

  async submitFeedback(feedback: AIFeedback): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/ai/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  }

  async getFeedback(updateId: number): Promise<any[]> {
    const response = await fetch(`${this.config.baseURL}/ai/feedback/${updateId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get feedback: ${response.statusText}`);
    }

    return response.json();
  }
}