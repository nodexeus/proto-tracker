/**
 * Protocol Updates service for managing protocol release tracking
 */

import { ApiService } from './api';
import type { 
  ProtocolUpdate,
  ProtocolUpdateEditData,
  ApiConfig 
} from '../types';

export class UpdatesService extends ApiService {
  constructor(config: ApiConfig) {
    super(config);
  }

  /**
   * Get all protocol updates
   */
  async getProtocolUpdates(): Promise<ProtocolUpdate[]> {
    const updates = await this.get<ProtocolUpdate[]>('/protocol_updates/');
    // Sort by date descending (newest first)
    return updates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get enriched protocol updates with client and protocol information
   */
  async getEnrichedProtocolUpdates(skip: number = 0, limit: number = 100): Promise<ProtocolUpdate[]> {
    console.log('🔧 UpdatesService v2 - Using fallback to basic endpoint');
    // Fallback to basic endpoint since enriched endpoint has issues
    const allUpdates = await this.getProtocolUpdates();
    return allUpdates.slice(skip, skip + limit);
  }

  /**
   * Get protocol updates by protocol name or ID
   */
  async getProtocolUpdatesByName(nameOrId: string): Promise<ProtocolUpdate[]> {
    return this.get<ProtocolUpdate[]>(`/protocol_updates/${nameOrId}`);
  }

  /**
   * Get a specific protocol update by ID
   */
  async getProtocolUpdate(updateId: number): Promise<ProtocolUpdate> {
    return this.get<ProtocolUpdate>(`/protocol_updates/${updateId}`);
  }

  /**
   * Search protocol updates
   */
  async searchProtocolUpdates(query: string): Promise<ProtocolUpdate[]> {
    const updates = await this.getProtocolUpdates();
    return updates.filter(update => 
      update.name?.toLowerCase().includes(query.toLowerCase()) ||
      update.title?.toLowerCase().includes(query.toLowerCase()) ||
      update.client?.toLowerCase().includes(query.toLowerCase()) ||
      update.tag?.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Update a protocol update
   */
  async updateProtocolUpdate(id: number, data: ProtocolUpdateEditData): Promise<ProtocolUpdate> {
    console.log('UpdatesService.updateProtocolUpdate called with:', { id, data });
    
    // Only send the fields that are provided in the edit data
    // This prevents overwriting fields like protocol associations, client info, etc.
    const updatePayload = {
      id,
      ...data, // Only send the editable fields that were actually provided
    };
    
    console.log('Making PATCH request to /protocol_updates/ with payload:', updatePayload);
    return this.patch<ProtocolUpdate>('/protocol_updates/', updatePayload);
  }
}