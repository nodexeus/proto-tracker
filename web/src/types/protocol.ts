/**
 * Protocol-related type definitions
 */

export interface Protocol {
  id: number;
  name: string;
  chain_id: string;
  explorer?: string;
  public_rpc?: string;
  proto_family?: string;
  bpm?: number;
  network: string;
  logo?: string; // Base64 encoded PNG image
  snapshot_prefix?: string;
}

export interface ProtocolCreate {
  name: string;
  chain_id: string;
  network: string;
  explorer?: string;
  public_rpc?: string;
  proto_family?: string;
  bpm?: number;
  logo?: string; // Base64 encoded PNG image
  snapshot_prefix?: string;
  snapshot_prefixes?: string[];
}

export interface ProtocolUpdateData {
  id: number;
  name?: string;
  chain_id?: string;
  network?: string;
  explorer?: string;
  public_rpc?: string;
  proto_family?: string;
  bpm?: number;
  logo?: string; // Base64 encoded PNG image
  snapshot_prefix?: string;
  snapshot_prefixes?: string[];
}

export interface ProtocolUpdate {
  id: number;
  name: string;
  is_draft: boolean;
  is_prerelease: boolean;
  title: string;
  client: string;
  tag: string;
  release_name?: string;
  date: string;
  url: string;
  tarball?: string;
  notes: string;
  ticket?: string;
  is_closed: boolean;
  hard_fork: boolean;
  fork_date?: string;
  github_url: string;
  
  // AI Analysis fields
  ai_summary?: string;
  ai_key_changes?: string[];
  ai_breaking_changes?: string[];
  ai_security_updates?: string[];
  ai_upgrade_priority?: 'critical' | 'high' | 'medium' | 'low';
  ai_risk_assessment?: string;
  ai_technical_summary?: string;
  ai_executive_summary?: string;
  ai_estimated_impact?: string;
  ai_confidence_score?: number;
  ai_analysis_date?: string;
  ai_provider?: string;
  
  // Enhanced hard fork fields
  ai_hard_fork_details?: string;
  activation_block?: number;
  activation_date?: string;
  coordination_required?: boolean;
}

export interface ProtocolUpdateCreate {
  name: string;
  title: string;
  client: string;
  tag: string;
  date: string;
  url: string;
  notes: string;
  github_url: string;
  is_draft?: boolean;
  is_prerelease?: boolean;
  release_name?: string;
  tarball?: string;
  ticket?: string;
  is_closed?: boolean;
  hard_fork?: boolean;
  fork_date?: string;
}

export interface ProtocolUpdateEditData {
  title?: string;
  is_draft?: boolean;
  is_prerelease?: boolean;
  hard_fork?: boolean;
  notes?: string;
}

export interface Client {
  id: number;
  name: string;
  client: string;
  github_url?: string;
  repo_type?: string;
}

export interface ClientCreate {
  name: string;
  client: string;
  github_url?: string;
  repo_type?: string;
}

export interface ClientUpdate {
  id: number;
  name?: string;
  client?: string;
  github_url?: string;
  repo_type?: string;
}

export interface ProtocolSnapshotPrefix {
  id: number;
  protocol_id: number;
  prefix: string;
  client_name?: string;
  network?: string;
  node_type?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProtocolSnapshotPrefixCreate {
  protocol_id: number;
  prefix: string;
  client_name?: string;
  network?: string;
  node_type?: string;
  description?: string;
  is_active?: boolean;
}

export interface ProtocolSnapshotPrefixUpdate {
  prefix?: string;
  client_name?: string;
  network?: string;
  node_type?: string;
  description?: string;
  is_active?: boolean;
}