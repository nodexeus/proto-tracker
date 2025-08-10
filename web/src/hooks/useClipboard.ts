/**
 * Custom hook for clipboard operations with notifications
 */

import { useState, createElement } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useGetFullApiKey } from './useApiKeys';

/**
 * Hook for clipboard operations with API key support
 */
export function useClipboard() {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const getFullApiKey = useGetFullApiKey();

  /**
   * Fallback method for copying text using document.execCommand
   */
  const fallbackCopyText = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return successful;
    } catch (error) {
      console.error('Fallback copy failed:', error);
      return false;
    }
  };

  /**
   * Copy text directly to clipboard
   */
  const copyText = async (text: string, label?: string): Promise<boolean> => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback to execCommand
        const success = fallbackCopyText(text);
        if (!success) {
          throw new Error('Fallback copy method failed');
        }
      }
      
      notifications.show({
        title: 'Copied!',
        message: `${label || 'Text'} copied to clipboard`,
        color: 'green',
        icon: createElement(IconCheck, { size: 16 }),
        autoClose: 2000,
      });
      
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      notifications.show({
        title: 'Copy Failed',
        message: 'Failed to copy to clipboard. Please try again.',
        color: 'red',
        autoClose: 3000,
      });
      
      return false;
    }
  };

  /**
   * Copy API key to clipboard by fetching the full key first
   */
  const copyApiKey = async (keyId: number, keyName: string): Promise<boolean> => {
    const stateKey = `apikey-${keyId}`;
    
    try {
      // Set copying state
      setCopiedStates(prev => ({ ...prev, [stateKey]: true }));
      
      // Fetch the full API key
      const result = await getFullApiKey.mutateAsync(keyId);
      
      // Copy to clipboard using the same method as copyText
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result.key);
      } else {
        // Fallback to execCommand
        const success = fallbackCopyText(result.key);
        if (!success) {
          throw new Error('Fallback copy method failed');
        }
      }
      
      notifications.show({
        title: 'API Key Copied!',
        message: `API key "${keyName}" copied to clipboard`,
        color: 'green',
        icon: createElement(IconCheck, { size: 16 }),
        autoClose: 3000,
      });
      
      // Reset state after a delay
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [stateKey]: false }));
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('Failed to copy API key:', error);
      
      // Reset state on error
      setCopiedStates(prev => ({ ...prev, [stateKey]: false }));
      
      // Error notification is handled by the useGetFullApiKey hook
      return false;
    }
  };

  /**
   * Get the current copied state for a specific item
   */
  const getCopiedState = (key: string): boolean => {
    return copiedStates[key] || false;
  };

  /**
   * Get the appropriate icon for copy button based on state
   */
  const getCopyIcon = (key: string, size = 16) => {
    return getCopiedState(key) 
      ? createElement(IconCheck, { size }) 
      : createElement(IconCopy, { size });
  };

  return {
    copyText,
    copyApiKey,
    getCopiedState,
    getCopyIcon,
    isLoading: getFullApiKey.isPending,
  };
}