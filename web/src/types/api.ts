/**
 * Base API response types and error handling interfaces
 */

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  apiKey?: string;
}