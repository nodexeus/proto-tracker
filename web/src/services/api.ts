/**
 * Base API service class with Axios configuration and error handling
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import type { ApiError, ApiConfig } from '../types';

export class ApiService {
  protected axiosInstance: AxiosInstance;
  private apiKey?: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.apiKey;
    
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add API key
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers['x-api-key'] = this.apiKey;
          console.log('API Request:', config.method?.toUpperCase(), config.url, 'with API key:', this.apiKey);
        } else {
          console.warn('API Request:', config.method?.toUpperCase(), config.url, 'WITHOUT API KEY');
        }
        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log('API Response:', response.config.method?.toUpperCase(), response.config.url, 'Status:', response.status);
        return response;
      },
      (error: AxiosError) => {
        console.error('API Error:', error.config?.method?.toUpperCase(), error.config?.url, 'Status:', error.response?.status, 'Headers sent:', error.config?.headers);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as { message?: string; detail?: string } | undefined;
      const message = data?.message || error.message || 'An error occurred';
      const details = data?.detail || error.response.statusText;

      return {
        status,
        message,
        details,
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        status: 0,
        message: 'Network error - no response received',
        details: 'Please check your internet connection',
      };
    } else {
      // Something else happened
      return {
        status: -1,
        message: error.message || 'Unknown error occurred',
        details: 'An unexpected error occurred',
      };
    }
  }

  /**
   * Update the API key for authenticated requests
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Remove the API key
   */
  public clearApiKey(): void {
    this.apiKey = undefined;
  }

  /**
   * Generic GET request
   */
  protected async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(endpoint, config);
    return response.data;
  }

  /**
   * Generic POST request
   */
  protected async post<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  protected async patch<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch<T>(endpoint, data, config);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(endpoint, config);
    return response.data;
  }

  /**
   * Check if the service is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get current API configuration
   */
  public getConfig(): { baseURL: string; timeout: number; hasApiKey: boolean } {
    return {
      baseURL: this.axiosInstance.defaults.baseURL || '',
      timeout: this.axiosInstance.defaults.timeout || 0,
      hasApiKey: !!this.apiKey,
    };
  }
}