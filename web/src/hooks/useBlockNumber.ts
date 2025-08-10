/**
 * Hook for fetching current block number from protocol RPC endpoint
 */

import { useQuery } from '@tanstack/react-query';
import { EthRpcService } from '../services/rpc';
import type { Protocol } from '../types/protocol';

export interface BlockNumberData {
  blockNumber: number;
  blockNumberHex: string;
  isHealthy: boolean;
  corsSupported?: boolean;
}

/**
 * Hook to fetch current block number for a protocol
 */
export function useBlockNumber(protocol: Protocol | undefined, options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['blockNumber', protocol?.id, protocol?.public_rpc],
    queryFn: async (): Promise<BlockNumberData> => {
      if (!protocol?.public_rpc) {
        throw new Error('No RPC endpoint configured for this protocol');
      }

      const rpcService = new EthRpcService(protocol.public_rpc);
      
      try {
        // Get block number in both formats
        const blockNumberHex = await rpcService.getBlockNumber();
        const blockNumber = await rpcService.getBlockNumberDecimal();

        return {
          blockNumber,
          blockNumberHex,
          isHealthy: true,
          corsSupported: true,
        };
      } catch (error) {
        // If it fails, check if it's a CORS issue
        if (error instanceof Error && error.message.includes('CORS')) {
          const corsTest = await rpcService.testCors();
          throw new Error(
            corsTest.error || 'CORS error - The RPC endpoint does not allow cross-origin requests from this domain. Consider configuring CORS on the RPC server or using a proxy.'
          );
        }
        throw error;
      }
    },
    enabled: !!protocol?.public_rpc && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? 30000, // Refetch every 30 seconds by default
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook to check RPC health status
 */
export function useRpcHealth(rpcUrl: string | undefined) {
  return useQuery({
    queryKey: ['rpcHealth', rpcUrl],
    queryFn: async (): Promise<boolean> => {
      if (!rpcUrl) return false;
      const rpcService = new EthRpcService(rpcUrl);
      return rpcService.isHealthy();
    },
    enabled: !!rpcUrl,
    refetchInterval: 60000, // Check health every minute
    retry: 1,
  });
}