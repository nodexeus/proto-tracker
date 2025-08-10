/**
 * Client-related type definitions
 */

/**
 * Base client interface
 */
export interface Client {
  id: number;
  name?: string;
  client?: string;
  github_url?: string;
  repo_type?: string;
  protocols?: Protocol[];
}

/**
 * Client creation data
 */
export interface ClientCreate {
  name: string;
  client?: string;
  github_url?: string;
  repo_type?: string;
}

/**
 * Client update data
 */
export interface ClientUpdate extends Partial<ClientCreate> {
  id: number;
}

/**
 * Protocol-Client association
 */
export interface ProtocolClientAssociation {
  protocol_id: number;
  client_id: number;
  is_primary?: boolean;
  created_at?: string;
}

/**
 * Create Protocol-Client association data
 */
export interface ProtocolClientAssociationCreate {
  client_id: number;
  is_primary?: boolean;
}

// Import Protocol type (will be resolved via index.ts)
import type { Protocol } from './protocol';