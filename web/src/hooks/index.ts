/**
 * Custom hooks exports
 */

export { useAuth } from './useAuth';
export { 
  useProtocols, 
  useProtocol, 
  useProtocolSnapshots, 
  useProtocolStats,
  useCreateProtocol, 
  useUpdateProtocol, 
  useDeleteProtocol,
  useScanSnapshots,
  protocolKeys 
} from './useProtocols';
export { useProtocolForm } from './useProtocolForm';
export { 
  useClients,
  useClient,
  useClientSearch,
  useClientProtocols,
  useProtocolClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useAddClientToProtocol,
  useRemoveClientFromProtocol,
  useSetPrimaryClient,
  clientKeys,
  protocolClientKeys
} from './useClients';
export {
  useProtocolUpdates,
  useEnrichedProtocolUpdates,
  useProtocolUpdate,
  useProtocolUpdateSearch,
  useProtocolUpdatesByProtocol,
  useUpdateProtocolUpdate,
  updatesKeys
} from './useUpdates';
export { useBlockNumber, useRpcHealth } from './useBlockNumber';
export { useProfile, profileKeys } from './useProfile';
export { 
  useApiKeys, 
  useCreateApiKey, 
  useDeleteApiKey, 
  useGetFullApiKey,
  apiKeysKeys 
} from './useApiKeys';
export { useClipboard } from './useClipboard';
export { 
  useAIConfig, 
  useUpdateAIConfig, 
  useTestAIConfig, 
  useAIAnalysis, 
  useAnalyzeProtocolUpdate, 
  useSubmitAIFeedback, 
  useAIFeedback 
} from './useAI';
export type { BlockNumberData } from './useBlockNumber';