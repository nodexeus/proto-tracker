/**
 * Validation utility functions
 */

import { VALIDATION_RULES } from './constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate protocol name
 */
export function validateProtocolName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || !name.trim()) {
    errors.push('Protocol name is required');
  } else {
    const trimmedName = name.trim();
    if (trimmedName.length < VALIDATION_RULES.PROTOCOL_NAME.MIN_LENGTH) {
      errors.push(`Protocol name must be at least ${VALIDATION_RULES.PROTOCOL_NAME.MIN_LENGTH} characters`);
    }
    if (trimmedName.length > VALIDATION_RULES.PROTOCOL_NAME.MAX_LENGTH) {
      errors.push(`Protocol name must be no more than ${VALIDATION_RULES.PROTOCOL_NAME.MAX_LENGTH} characters`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate chain ID
 */
export function validateChainId(chainId: string): ValidationResult {
  const errors: string[] = [];
  
  if (!chainId || !chainId.trim()) {
    errors.push('Chain ID is required');
  } else {
    const trimmedChainId = chainId.trim();
    if (trimmedChainId.length < VALIDATION_RULES.CHAIN_ID.MIN_LENGTH) {
      errors.push(`Chain ID must be at least ${VALIDATION_RULES.CHAIN_ID.MIN_LENGTH} character`);
    }
    if (trimmedChainId.length > VALIDATION_RULES.CHAIN_ID.MAX_LENGTH) {
      errors.push(`Chain ID must be no more than ${VALIDATION_RULES.CHAIN_ID.MAX_LENGTH} characters`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate network name
 */
export function validateNetwork(network: string): ValidationResult {
  const errors: string[] = [];
  
  if (!network || !network.trim()) {
    errors.push('Network is required');
  } else {
    const trimmedNetwork = network.trim();
    if (trimmedNetwork.length < VALIDATION_RULES.NETWORK.MIN_LENGTH) {
      errors.push(`Network must be at least ${VALIDATION_RULES.NETWORK.MIN_LENGTH} characters`);
    }
    if (trimmedNetwork.length > VALIDATION_RULES.NETWORK.MAX_LENGTH) {
      errors.push(`Network must be no more than ${VALIDATION_RULES.NETWORK.MAX_LENGTH} characters`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate URL
 */
export function validateUrl(url: string, fieldName: string = 'URL'): ValidationResult {
  const errors: string[] = [];
  
  if (url && url.trim()) {
    const trimmedUrl = url.trim();
    
    if (trimmedUrl.length > VALIDATION_RULES.URL.MAX_LENGTH) {
      errors.push(`${fieldName} must be no more than ${VALIDATION_RULES.URL.MAX_LENGTH} characters`);
    }
    
    try {
      new URL(trimmedUrl);
    } catch {
      errors.push(`${fieldName} must be a valid URL`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate BPM (Blocks Per Minute)
 */
export function validateBpm(bpm: number | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (bpm !== undefined) {
    if (bpm < VALIDATION_RULES.BPM.MIN) {
      errors.push(`BPM must be at least ${VALIDATION_RULES.BPM.MIN}`);
    }
    if (bpm > VALIDATION_RULES.BPM.MAX) {
      errors.push(`BPM must be no more than ${VALIDATION_RULES.BPM.MAX}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please enter a valid email address');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): ValidationResult {
  const errors: string[] = [];
  
  // Check file type
  if (!file.type.startsWith('image/')) {
    errors.push('File must be an image');
  } else if (file.type !== 'image/png') {
    errors.push('Only PNG images are supported');
  }
  
  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    errors.push('Image size must be less than 5MB');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate base64 image string
 */
export function validateBase64Image(base64: string): ValidationResult {
  const errors: string[] = [];
  
  if (!base64) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  // Check if it's a valid base64 string
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,/;
  if (!base64Regex.test(base64)) {
    errors.push('Invalid image format. Must be a valid base64 encoded image.');
  }
  
  // Check if it's PNG specifically
  if (!base64.startsWith('data:image/png;base64,')) {
    errors.push('Only PNG images are supported');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate API key name
 */
export function validateApiKeyName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || !name.trim()) {
    errors.push('API key name is required');
  } else {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      errors.push('API key name must be at least 2 characters');
    }
    if (trimmedName.length > 50) {
      errors.push('API key name must be no more than 50 characters');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(result => result.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    errors.push(`${fieldName} is required`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}