/**
 * Custom hook for clipboard operations with notifications
 */

import { useState, createElement } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useGetFullApiKey } from './useApiKeys';

interface ManualCopyData {
  apiKey: string;
  keyName: string;
}

/**
 * Hook for clipboard operations with API key support
 */
export function useClipboard() {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [manualCopyData, setManualCopyData] = useState<ManualCopyData | null>(null);
  const getFullApiKey = useGetFullApiKey();

  /**
   * Fallback method for copying text using document.execCommand
   */
  const fallbackCopyText = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Make the textarea invisible but not off-screen (some browsers block off-screen copy)
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.left = '0';
      textArea.style.top = '0';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');
      textArea.style.webkitUserSelect = 'text';
      textArea.style.userSelect = 'text';
      
      document.body.appendChild(textArea);
      
      // Focus and select
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);
      
      // Try to copy
      const successful = document.execCommand('copy');
      
      // Clean up
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
        color: '#7fcf00',
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
   * The key insight: we need to maintain user activation context throughout the process
   */
  const copyApiKey = async (keyId: number, keyName: string): Promise<boolean> => {
    const stateKey = `apikey-${keyId}`;
    
    try {
      // Set copying state
      setCopiedStates(prev => ({ ...prev, [stateKey]: true }));
      
      // Create a promise that resolves immediately to preserve user activation context
      // This is a technique to maintain the user gesture through async operations
      const copyPromise = new Promise<boolean>(async (resolve) => {
        try {
          // Fetch the full API key
          const result = await getFullApiKey.mutateAsync(keyId);
          
          // Immediately try to copy while we still might have user context
          const success = await attemptCopy(result.key);
          
          if (!success) {
            // If copy failed, set up data for manual copy modal
            setManualCopyData({
              apiKey: result.key,
              keyName: keyName
            });
          }
          
          resolve(success);
        } catch (error) {
          console.error('Failed in copy promise:', error);
          resolve(false);
        }
      });
      
      const success = await copyPromise;
      
      // Reset state
      setCopiedStates(prev => ({ ...prev, [stateKey]: false }));
      
      if (success) {
        notifications.show({
          title: 'API Key Copied!',
          message: `API key "${keyName}" copied to clipboard`,
          color: '#7fcf00',
          icon: createElement(IconCheck, { size: 16 }),
          autoClose: 3000,
        });
      }
      
      return success;
      
    } catch (error) {
      console.error('Failed to copy API key:', error);
      
      // Reset state on error
      setCopiedStates(prev => ({ ...prev, [stateKey]: false }));
      
      // Show generic error - the getFullApiKey hook should show specific error
      notifications.show({
        title: 'Failed to Retrieve API Key',
        message: 'Please try again or check your permissions',
        color: 'red',
        autoClose: 5000,
      });
      
      return false;
    }
  };

  /**
   * Attempt to copy text using all available methods
   * This function prioritizes methods that are less likely to lose user activation context
   */
  const attemptCopy = async (text: string): Promise<boolean> => {
    // Method 1: Try fallback method first (synchronous, less likely to lose context)
    try {
      const success = fallbackCopyText(text);
      if (success) {
        return true;
      }
    } catch (fallbackError) {
      console.warn('Fallback clipboard method failed:', fallbackError);
    }
    
    // Method 2: Try modern clipboard API (asynchronous, might lose context)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (clipboardError) {
        console.warn('Modern clipboard API failed:', clipboardError);
      }
    }
    
    return false;
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

  const closeManualCopy = () => {
    setManualCopyData(null);
  };

  return {
    copyText,
    copyApiKey,
    getCopiedState,
    getCopyIcon,
    isLoading: getFullApiKey.isPending,
    manualCopyData,
    closeManualCopy,
  };
}