/**
 * Ethereum JSON-RPC client service
 */

import { ApiService } from './api';

export interface RpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[];
  id: number | string;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class EthRpcService {
  private rpcUrl: string;
  private requestId = 1;
  private apiService: ApiService;
  private useProxy = false;
  private apiKey: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.apiKey = localStorage.getItem('proto_tracker_api_key') || '';
    
    this.apiService = new ApiService({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
      timeout: 30000,
      apiKey: this.apiKey
    });
    
    // Use proxy for external RPC calls to avoid CORS issues
    this.useProxy = rpcUrl.includes('rpc.nodexeus.io') || !rpcUrl.startsWith(window.location.origin);
  }

  private async makeRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: RpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    try {
      // Use the API proxy for external RPC calls to avoid CORS issues
      if (this.useProxy) {
        const config = this.apiService.getConfig();
        const response = await fetch(`${config.baseURL}/rpc/proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': this.apiKey,
            'X-RPC-URL': this.rpcUrl,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Proxy request failed: ${response.status} - ${errorText}`);
        }

        const data: RpcResponse<T> = await response.json();
        
        if (data.error) {
          throw new Error(`RPC error: ${data.error.message} (code: ${data.error.code})`);
        }

        if (data.result === undefined) {
          throw new Error('RPC response missing result');
        }

        return data.result;
      } else {
        // Direct RPC call for same-origin requests
        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          mode: 'cors',
          credentials: 'omit',
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: RpcResponse<T> = await response.json();

        if (data.error) {
          throw new Error(`RPC error: ${data.error.message} (code: ${data.error.code})`);
        }

        if (data.result === undefined) {
          throw new Error('RPC response missing result');
        }

        return data.result;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to call RPC method ${method}: ${error.message}`);
      }
      throw new Error(`Failed to call RPC method ${method}: Unknown error`);
    }
  }

  /**
   * Get the current block number
   * Returns the block number as a hex string
   */
  async getBlockNumber(): Promise<string> {
    return this.makeRequest<string>('eth_blockNumber');
  }

  /**
   * Get the current block number as a decimal number
   */
  async getBlockNumberDecimal(): Promise<number> {
    const hexBlockNumber = await this.getBlockNumber();
    return parseInt(hexBlockNumber, 16);
  }

  /**
   * Get block information by block number or hash
   */
  async getBlock(blockHashOrNumber: string | number, fullTransactions = false): Promise<unknown> {
    const params = [
      typeof blockHashOrNumber === 'number' 
        ? `0x${blockHashOrNumber.toString(16)}`
        : blockHashOrNumber,
      fullTransactions,
    ];
    return this.makeRequest('eth_getBlockByNumber', params);
  }

  /**
   * Get the chain ID
   */
  async getChainId(): Promise<string> {
    return this.makeRequest<string>('eth_chainId');
  }

  /**
   * Check if the RPC endpoint is responding
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getBlockNumber();
      return true;
    } catch (error) {
      console.warn(`RPC health check failed for ${this.rpcUrl}:`, error);
      return false;
    }
  }

  /**
   * Test CORS support for the RPC endpoint
   */
  async testCors(): Promise<{ supported: boolean; error?: string }> {
    try {
      // Try a simple OPTIONS request first
      const optionsResponse = await fetch(this.rpcUrl, {
        method: 'OPTIONS',
        mode: 'cors',
      });
      
      if (optionsResponse.ok) {
        return { supported: true };
      }
    } catch (error) {
      // If OPTIONS fails, try the actual RPC call
      try {
        await this.getBlockNumber();
        return { supported: true };
      } catch (rpcError) {
        return { 
          supported: false, 
          error: rpcError instanceof Error ? rpcError.message : 'Unknown CORS error'
        };
      }
    }
    
    return { 
      supported: false, 
      error: 'CORS preflight check failed'
    };
  }
}