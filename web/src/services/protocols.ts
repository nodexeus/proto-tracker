/**
 * Protocol service for managing protocol CRUD operations
 */

import { ApiService } from './api';
import type { 
  Protocol, 
  ProtocolCreate, 
  ProtocolUpdateData, 
  ProtocolUpdate,
  ProtocolUpdateCreate,
  Client,
  ClientCreate,
  ClientUpdate,
  Snapshot,
  SnapshotScanResult,
  ApiConfig 
} from '../types';

export class ProtocolService extends ApiService {
  constructor(config: ApiConfig) {
    super(config);
  }

  // Protocol CRUD operations
  
  /**
   * Get all protocols
   */
  async getProtocols(): Promise<Protocol[]> {
    return this.get<Protocol[]>('/protocol/');
  }

  /**
   * Get a specific protocol by ID
   */
  async getProtocol(id: number): Promise<Protocol> {
    return this.get<Protocol>(`/protocol/${id}`);
  }

  /**
   * Create a new protocol
   */
  async createProtocol(data: ProtocolCreate): Promise<Protocol> {
    return this.post<Protocol>('/protocol/', data);
  }

  /**
   * Update an existing protocol
   */
  async updateProtocol(id: number, data: ProtocolUpdateData): Promise<Protocol> {
    return this.patch<Protocol>(`/protocol/${id}`, data);
  }

  /**
   * Delete a protocol
   */
  async deleteProtocol(id: number): Promise<void> {
    return this.delete<void>(`/protocol/${id}`);
  }

  // Protocol Updates operations

  /**
   * Get all updates for a specific protocol via client associations
   */
  async getProtocolUpdates(protocolId: number): Promise<ProtocolUpdate[]> {
    try {
      // First get all clients associated with this protocol
      const clientService = new (await import('./clients')).ClientService(this.config);
      const protocolClients = await clientService.getProtocolClients(protocolId);
      
      if (protocolClients.length === 0) {
        return [];
      }

      // Get all updates for all associated clients
      const allUpdates = await this.getAllProtocolUpdates();
      
      // Filter updates to only include those from clients associated with this protocol
      const clientIds = protocolClients.map(client => client.id);
      const protocolUpdates = allUpdates.filter(update => 
        update.client && protocolClients.some(client => 
          client.client === update.client || client.name === update.client
        )
      );

      // Sort by date descending (newest first)
      return protocolUpdates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get protocol updates via client associations:', error);
      // Fallback to empty array
      return [];
    }
  }

  /**
   * Get all protocol updates (across all protocols)
   */
  async getAllProtocolUpdates(): Promise<ProtocolUpdate[]> {
    return this.get<ProtocolUpdate[]>('/protocol_updates/');
  }

  /**
   * Get a specific protocol update
   */
  async getProtocolUpdate(updateId: number): Promise<ProtocolUpdate> {
    return this.get<ProtocolUpdate>(`/protocol_updates/${updateId}`);
  }

  /**
   * Create a new protocol update
   */
  async createProtocolUpdate(data: ProtocolUpdateCreate): Promise<ProtocolUpdate> {
    return this.post<ProtocolUpdate>('/protocol_updates/', data);
  }

  // Snapshot operations

  /**
   * Get all snapshots for a specific protocol
   */
  async getProtocolSnapshots(protocolId: number): Promise<Snapshot[]> {
    return this.get<Snapshot[]>(`/protocols/${protocolId}/snapshots`);
  }

  /**
   * Get a specific snapshot
   */
  async getSnapshot(protocolId: number,snapshotId: number): Promise<Snapshot> {
    return this.get<Snapshot>(`/protocols/${protocolId}/snapshot-files/${snapshotId}`);
  }

  /**
   * Trigger snapshot scanning for a protocol
   */
  async scanSnapshots(protocolId: number): Promise<SnapshotScanResult> {
    return this.post<SnapshotScanResult>(`/protocols/${protocolId}/snapshots/scan`);
  }

  /**
   * Trigger snapshot scanning for a protocol (alias for scanSnapshots)
   */
  async scanProtocolSnapshots(protocolId: number): Promise<SnapshotScanResult> {
    return this.scanSnapshots(protocolId);
  }

  /**
   * Get snapshot file tree
   */
  async getSnapshotFileTree(protocolId: number, snapshotId: string): Promise<Record<string, unknown>> {
    const response = await this.get<{
      snapshot_id: string;
      created_at: string | null;
      indexed_at: string | null;
      metadata_summary: {
        client?: string;
        network?: string;
        node_type?: string;
        version?: number;
      };
      file_tree: Record<string, unknown>;
      files: string[];
      total_files: number;
    }>(`/protocols/${protocolId}/snapshot-files/${encodeURIComponent(snapshotId)}`);
    
    return response.file_tree || {};
  }

  // Client operations

  /**
   * Get all clients
   */
  async getClients(): Promise<Client[]> {
    return this.get<Client[]>('/client/');
  }

  /**
   * Get a specific client by ID
   */
  async getClient(id: number): Promise<Client> {
    return this.get<Client>(`/client/${id}`);
  }

  /**
   * Create a new client
   */
  async createClient(data: ClientCreate): Promise<Client> {
    return this.post<Client>('/client/', data);
  }

  /**
   * Update an existing client
   */
  async updateClient(id: number, data: ClientUpdate): Promise<Client> {
    return this.patch<Client>(`/client/${id}`, data);
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<void> {
    return this.delete<void>(`/client/${id}`);
  }

  // Utility methods

  /**
   * Search protocols by name or network
   */
  async searchProtocols(query: string): Promise<Protocol[]> {
    return this.get<Protocol[]>(`/protocols/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get protocol statistics
   */
  async getProtocolStats(protocolId: number): Promise<{
    total_updates: number;
    recent_updates: number;
    total_snapshots: number;
    latest_snapshot_date?: string;
  }> {
    try {
      return this.get(`/protocols/${protocolId}/stats`);
    } catch {
      // Fallback to calculating from available data
      const updates = await this.getProtocolUpdates(protocolId);
      const snapshots = await this.getProtocolSnapshots(protocolId);
      const recentUpdates = updates.filter(update => {
        const updateDate = new Date(update.date);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return updateDate > thirtyDaysAgo;
      });
      
      return {
        total_updates: updates.length,
        recent_updates: recentUpdates.length,
        total_snapshots: snapshots.length,
        latest_snapshot_date: snapshots.length > 0 
          ? snapshots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : undefined
      };
    }
  }

  /**
   * Get dashboard statistics across all protocols
   */
  async getDashboardStats(): Promise<{
    total_protocols: number;
    total_clients: number;
    total_updates: number;
    recent_updates: number;
    recent_hard_forks: number;
    protocols_by_network: Record<string, number>;
    updates_by_month: Array<{ 
      month: string; 
      updates: number; 
      hard_forks: number;
      updates_by_client: Array<{
        client_name: string;
        client_id: number;
        updates: number;
        hard_forks: number;
      }>;
    }>;
  }> {
    // Calculate from available data using existing endpoints
    const [protocols, allUpdates, clients] = await Promise.all([
      this.getProtocols(),
      this.getAllProtocolUpdates(),
      this.getClients()
    ]).catch(error => {
      console.error('Error fetching dashboard data:', error);
      // Return empty data if requests fail
      return [[], [], []];
    });
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUpdates = allUpdates.filter(update => new Date(update.date) > thirtyDaysAgo);
    const recentHardForks = recentUpdates.filter(update => update.hard_fork);
    
    // Group protocols by network
    const protocolsByNetwork = protocols.reduce((acc, protocol) => {
      acc[protocol.network] = (acc[protocol.network] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group updates by month for the last 12 months
    const updatesByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const monthUpdates = allUpdates.filter(update => {
        const updateDate = new Date(update.date);
        return updateDate.getFullYear() === date.getFullYear() && 
               updateDate.getMonth() === date.getMonth();
      });
      
      // Group updates by client for this month
      const clientUpdatesMap = new Map<string, { updates: number; hard_forks: number }>();
      
      monthUpdates.forEach(update => {
        const clientName = update.client || 'Unknown';
        
        
        if (!clientUpdatesMap.has(clientName)) {
          clientUpdatesMap.set(clientName, { updates: 0, hard_forks: 0 });
        }
        
        const clientData = clientUpdatesMap.get(clientName)!;
        clientData.updates++;
        if (update.hard_fork) {
          clientData.hard_forks++;
        }
      });
      
      const updatesByClient = Array.from(clientUpdatesMap.entries()).map(([clientName, data]) => ({
        client_id: clientName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0), // Generate a consistent ID from name
        client_name: clientName,
        updates: data.updates,
        hard_forks: data.hard_forks
      }));
      
      
      updatesByMonth.push({
        month: monthName,
        updates: monthUpdates.length,
        hard_forks: monthUpdates.filter(update => update.hard_fork).length,
        updates_by_client: updatesByClient
      });
    }
    
    return {
      total_protocols: protocols.length,
      total_clients: clients.length,
      total_updates: allUpdates.length,
      recent_updates: recentUpdates.length,
      recent_hard_forks: recentHardForks.length,
      protocols_by_network: protocolsByNetwork,
      updates_by_month: updatesByMonth
    };
  }

  /**
   * Validate protocol data before creation/update
   */
  validateProtocolData(data: ProtocolCreate | ProtocolUpdateData): string[] {
    const errors: string[] = [];

    if ('name' in data && !data.name?.trim()) {
      errors.push('Protocol name is required');
    }

    if ('chain_id' in data && !data.chain_id?.trim()) {
      errors.push('Chain ID is required');
    }

    if ('network' in data && !data.network?.trim()) {
      errors.push('Network is required');
    }

    if (data.bpm !== undefined && (data.bpm < 0 || data.bpm > 1000)) {
      errors.push('BPM must be between 0 and 1000');
    }

    if (data.explorer && !this.isValidUrl(data.explorer)) {
      errors.push('Explorer must be a valid URL');
    }

    if (data.public_rpc && !this.isValidUrl(data.public_rpc)) {
      errors.push('Public RPC must be a valid URL');
    }

    return errors;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}