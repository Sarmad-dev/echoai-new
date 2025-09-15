'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export type ConnectionStatus = 'validating' | 'connected' | 'disconnected' | 'error';

export interface HubSpotAccountInfo {
  portalId: string;
  portalName: string;
  userEmail: string;
  subscriptionTier: string;
  availableObjects: string[];
  permissions: string[];
  apiLimits: {
    dailyLimit: number;
    currentUsage: number;
  };
}

export interface GoogleAccountInfo {
  email: string;
  name: string;
  driveQuota: {
    limit: string;
    usage: string;
    usageInDrive: string;
  };
  permissions: {
    canCreateFiles: boolean;
    canEditFiles: boolean;
    canShareFiles: boolean;
  };
}

export interface ValidationResult {
  success: boolean;
  accountInfo?: HubSpotAccountInfo | GoogleAccountInfo;
  error?: string;
  errorCode?: string;
  requiresAuth?: boolean;
  suggestedAction?: string;
  lastValidated?: string;
  isRetryable?: boolean;
  retryDelay?: number;
}

export interface UseNodeIntegrationOptions {
  autoValidate?: boolean;
  cacheTimeout?: number;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onAccountInfoUpdate?: (info: HubSpotAccountInfo | GoogleAccountInfo) => void;
  onError?: (error: string) => void;
}

export interface UseNodeIntegrationReturn {
  connectionStatus: ConnectionStatus;
  accountInfo: HubSpotAccountInfo | GoogleAccountInfo | null;
  error: string | null;
  errorCode: string | null;
  isLoading: boolean;
  isValidating: boolean;
  isAuthenticating: boolean;
  suggestedAction: string | null;
  lastValidated: Date | null;
  validateConnection: () => Promise<void>;
  initiateAuth: () => Promise<void>;
  clearError: () => void;
  retryValidation: () => Promise<void>;
}

export function useNodeIntegration(
  provider: 'hubspot' | 'google',
  nodeId: string,
  options: UseNodeIntegrationOptions = {}
): UseNodeIntegrationReturn {
  const {
    autoValidate = true,
    cacheTimeout = 15 * 60 * 1000, // 15 minutes
    onConnectionChange,
    onAccountInfoUpdate,
    onError
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('validating');
  const [accountInfo, setAccountInfo] = useState<HubSpotAccountInfo | GoogleAccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [suggestedAction, setSuggestedAction] = useState<string | null>(null);
  const [lastValidated, setLastValidated] = useState<Date | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setSuggestedAction(null);
  }, []);

  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionChange?.(status);
  }, [onConnectionChange]);

  const updateAccountInfo = useCallback((info: HubSpotAccountInfo | GoogleAccountInfo | null) => {
    setAccountInfo(info);
    if (info) {
      onAccountInfoUpdate?.(info);
    }
  }, [onAccountInfoUpdate]);

  const handleError = useCallback((errorMessage: string, code?: string, action?: string) => {
    setError(errorMessage);
    setErrorCode(code || null);
    setSuggestedAction(action || null);
    onError?.(errorMessage);
  }, [onError]);

  const validateConnection = useCallback(async () => {
    setIsValidating(true);
    clearError();
    
    try {
      const response = await fetch(`/api/integrations/${provider}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodeId,
          maxCacheAge: cacheTimeout
        })
      });

      const result: ValidationResult = await response.json();

      if (result.success) {
        updateConnectionStatus('connected');
        updateAccountInfo(result.accountInfo || null);
        setLastValidated(new Date());
        
        // Clear any previous errors
        clearError();
      } else {
        const status = result.requiresAuth ? 'disconnected' : 'error';
        updateConnectionStatus(status);
        updateAccountInfo(null);
        
        handleError(
          result.error || 'Connection validation failed',
          result.errorCode,
          result.suggestedAction
        );
      }
    } catch (err) {
      console.error(`${provider} validation error:`, err);
      updateConnectionStatus('error');
      updateAccountInfo(null);
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate connection';
      handleError(errorMessage, 'CONNECTION_FAILED', 'Please check your internet connection and try again.');
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  }, [provider, nodeId, cacheTimeout, clearError, updateConnectionStatus, updateAccountInfo, handleError]);

  const retryValidation = useCallback(async () => {
    // Add a small delay for retries to avoid hammering the API
    await new Promise(resolve => setTimeout(resolve, 1000));
    await validateConnection();
  }, [validateConnection]);

  const initiateAuth = useCallback(async () => {
    setIsAuthenticating(true);
    clearError();
    
    try {
      const response = await fetch('/api/integrations/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          provider,
          nodeId,
          returnUrl: window.location.href
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const { authUrl } = await response.json();
      
      if (!authUrl) {
        throw new Error('No authorization URL received');
      }

      // Open OAuth in a popup window
      const popup = window.open(
        authUrl, 
        `${provider}_oauth`, 
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'oauth_success' && event.data.provider === provider) {
          window.removeEventListener('message', handleMessage);
          popup.close();
          
          // Automatically retry validation after successful auth
          toast.success(`${provider === 'hubspot' ? 'HubSpot' : 'Google'} connected successfully!`);
          validateConnection();
        } else if (event.data.type === 'oauth_error') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          
          const errorMessage = event.data.error || 'Authentication failed';
          handleError(errorMessage, 'AUTH_FAILED', 'Please try connecting again.');
          toast.error('Authentication failed', { description: errorMessage });
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsAuthenticating(false);
        }
      }, 1000);

    } catch (err) {
      console.error(`${provider} auth error:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate authentication';
      handleError(errorMessage, 'AUTH_FAILED', 'Please try again or contact support.');
      toast.error('Authentication failed', { description: errorMessage });
    } finally {
      setIsAuthenticating(false);
    }
  }, [provider, nodeId, clearError, handleError, validateConnection]);

  // Auto-validate on mount if enabled
  useEffect(() => {
    if (autoValidate) {
      validateConnection();
    } else {
      setIsLoading(false);
    }
  }, [autoValidate, validateConnection]);

  return {
    connectionStatus,
    accountInfo,
    error,
    errorCode,
    isLoading,
    isValidating,
    isAuthenticating,
    suggestedAction,
    lastValidated,
    validateConnection,
    initiateAuth,
    clearError,
    retryValidation
  };
}