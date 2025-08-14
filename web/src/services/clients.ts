/**
 * Client service for managing client CRUD operations
 */

import { ApiService } from './api';
import type { 
  Client, 
  ClientCreate, 
  ClientUpdate,
  Protocol,
  ProtocolClientAssociation,
  ProtocolClientAssociationCreate,
  ApiConfig 
} from '../types';

export class ClientService extends ApiService {
  constructor(config: ApiConfig) {
    super(config);
  }

  // Client CRUD operations
  
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
  async updateClient(id: number, data: ClientUpdate): Promise<{ message: string }> {
    const updateData = { ...data, id };
    return this.patch<{ message: string }>(`/client/${id}`, updateData);
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/client/${id}`);
  }

  // Protocol-Client Association operations

  /**
   * Add a client to a protocol
   */
  async addClientToProtocol(
    protocolId: number, 
    data: ProtocolClientAssociationCreate
  ): Promise<{ message: string }> {
    return this.post<{ message: string }>(`/protocols/${protocolId}/clients`, data);
  }

  /**
   * Remove a client from a protocol
   */
  async removeClientFromProtocol(
    protocolId: number, 
    clientId: number
  ): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/protocols/${protocolId}/clients/${clientId}`);
  }

  /**
   * Set a client as the primary client for a protocol
   */
  async setPrimaryClient(
    protocolId: number, 
    clientId: number
  ): Promise<{ message: string }> {
    return this.put<{ message: string }>(`/protocols/${protocolId}/clients/${clientId}/primary`);
  }

  /**
   * Get all clients associated with a protocol
   */
  async getProtocolClients(protocolId: number): Promise<Client[]> {
    return this.get<Client[]>(`/protocols/${protocolId}/clients`);
  }

  /**
   * Get all protocols associated with a client
   */
  async getClientProtocols(clientId: number): Promise<Protocol[]> {
    return this.get<Protocol[]>(`/clients/${clientId}/protocols`);
  }

  /**
   * Search clients by name or repository
   */
  async searchClients(query: string): Promise<Client[]> {
    return this.get<Client[]>(`/clients/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Validate client data before creation/update
   */
  validateClientData(data: ClientCreate | ClientUpdate): string[] {
    const errors: string[] = [];

    if ('name' in data && !data.name?.trim()) {
      errors.push('Client name is required');
    }

    if (data.github_url && !this.isValidUrl(data.github_url)) {
      errors.push('GitHub URL must be a valid URL');
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