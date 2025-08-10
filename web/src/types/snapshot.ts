/**
 * Snapshot-related type definitions
 */

export interface Snapshot {
  id: number;
  protocol_id: number;
  snapshot_id: string;
  index_file_path: string;
  file_count: number;
  total_size: number;
  created_at: string;
  indexed_at: string;
  metadata_summary?: SnapshotMetadata;
}

export interface SnapshotMetadata {
  version?: number;
  client?: string;
  network?: string;
  node_type?: string;
  file_tree?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SnapshotCreate {
  protocol_id: number;
  snapshot_id: string;
  index_file_path: string;
  file_count: number;
  total_size: number;
  created_at: string;
  snapshot_metadata?: SnapshotMetadata;
}

export interface S3Config {
  id: number;
  bucket_name: string;
  endpoint_url: string;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface S3ConfigCreate {
  bucket_name: string;
  endpoint_url: string;
  access_key_id: string;
  secret_access_key: string;
  region?: string;
}

export interface S3ConfigUpdate {
  bucket_name?: string;
  endpoint_url?: string;
  access_key_id?: string;
  secret_access_key?: string;
  region?: string;
}

export interface S3ConnectionTest {
  status: string;
  message: string;
}

export interface SnapshotScanResult {
  message: string;
  new_snapshots_found?: number;
  total_snapshots?: number;
  scan_duration?: number;
}