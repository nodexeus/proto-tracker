/**
 * Ethereum JSON-RPC client service
 */

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

  constructor(rpcUrl: string) {
    // In development mode, use the proxy to avoid CORS issues
    if (import.meta.env.DEV && rpcUrl.includes('rpc.nodexeus.io')) {
      // Convert direct RPC URL to use the proxy
      this.rpcUrl = `/api/rpc-proxy${rpcUrl.replace('http://rpc.nodexeus.io', '')}`;
    } else {
      this.rpcUrl = rpcUrl;
    }
  }

  private async makeRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: RpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    try {
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
        // Check if it's a CORS error specifically
        if (response.status === 0 || response.status === 400) {
          throw new Error(`CORS error - RPC endpoint may not allow cross-origin requests. Status: ${response.status}`);
        }
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
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error - likely CORS issue. The RPC endpoint "${this.rpcUrl}" may not allow cross-origin requests from this domain.`);
      }
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