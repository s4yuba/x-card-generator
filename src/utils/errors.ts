import { APIError, ErrorCode } from '../types';

// Error messages mapping
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_URL]: 'The provided URL is not a valid X/Twitter profile URL',
  [ErrorCode.PROFILE_NOT_FOUND]: 'Profile not found or may be private',
  [ErrorCode.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again',
  [ErrorCode.PARSING_ERROR]: 'Failed to extract profile information from the page',
  [ErrorCode.GENERATION_ERROR]: 'Failed to generate name tag',
  [ErrorCode.STORAGE_ERROR]: 'Failed to save settings or data',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied. Please check extension permissions',
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred'
};

// Get user-friendly error message
export function getErrorMessage(error: APIError | Error | unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const apiError = error as APIError;
    return ERROR_MESSAGES[apiError.code] || apiError.message || 'An error occurred';
  }
  
  return 'An unexpected error occurred';
}

// Format error for display
export function formatErrorForDisplay(error: APIError): {
  title: string;
  message: string;
  actions?: Array<{ label: string; action: string }>;
} {
  const baseMessage = ERROR_MESSAGES[error.code] || error.message;
  
  switch (error.code) {
    case ErrorCode.INVALID_URL:
      return {
        title: 'Invalid URL',
        message: baseMessage,
        actions: [{
          label: 'View example',
          action: 'show-example-url'
        }]
      };
      
    case ErrorCode.NETWORK_ERROR:
      return {
        title: 'Connection Error',
        message: baseMessage,
        actions: [{
          label: 'Retry',
          action: 'retry'
        }]
      };
      
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return {
        title: 'Rate Limited',
        message: baseMessage,
        actions: [{
          label: 'Try again later',
          action: 'dismiss'
        }]
      };
      
    case ErrorCode.PERMISSION_DENIED:
      return {
        title: 'Permission Required',
        message: baseMessage,
        actions: [{
          label: 'Grant permissions',
          action: 'open-permissions'
        }]
      };
      
    default:
      return {
        title: 'Error',
        message: baseMessage
      };
  }
}

// Chrome extension specific error handling
export function handleChromeError(): APIError | null {
  if (chrome.runtime.lastError) {
    const message = chrome.runtime.lastError.message || 'Chrome extension error';
    
    // Map common Chrome errors to our error codes
    if (message.includes('permission')) {
      return {
        code: ErrorCode.PERMISSION_DENIED,
        message,
        timestamp: new Date(),
        recoverable: true
      };
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message,
        timestamp: new Date(),
        recoverable: true
      };
    }
    
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message,
      timestamp: new Date(),
      recoverable: false
    };
  }
  
  return null;
}

// Error logging utility
export function logError(context: string, error: unknown): void {
  console.error(`[X Profile Name Tag Generator] ${context}:`, error);
  
  // In production, you might want to send this to an error tracking service
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const apiError = error as APIError;
    console.error('Error details:', {
      code: apiError.code,
      timestamp: apiError.timestamp,
      recoverable: apiError.recoverable,
      details: apiError.details
    });
  }
}