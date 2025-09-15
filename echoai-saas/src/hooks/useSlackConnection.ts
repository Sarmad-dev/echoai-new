import { useState, useCallback, useEffect } from 'react';
import { SlackConnectionState, SlackIntegration } from '@/types/slack';
import { SlackConnectionUtils, SlackError } from '@/lib/integrations/slack-utils';

/**
 * Hook for managing Slack connection status with multiple integration support
 */
export function useSlackConnection(): SlackConnectionState {
  const [status, setStatus] = useState<SlackConnectionState['status']>('checking');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>();
  const [availableIntegrations, setAvailableIntegrations] = useState<SlackIntegration[]>([]);
  const [connectionData, setConnectionData] = useState<SlackConnectionState['connectionData']>();
  const [error, setError] = useState<string>();
  const [errorType, setErrorType] = useState<SlackConnectionState['errorType']>();
  const [retryAfter, setRetryAfter] = useState<number>();
  const [recoveryInstructions, setRecoveryInstructions] = useState<string[]>();
  const [isRetryable, setIsRetryable] = useState<boolean>();

  const loadAvailableIntegrations = useCallback(async () => {
    try {
      const integrations = await SlackConnectionUtils.getAvailableIntegrations();
      setAvailableIntegrations(integrations);
      
      // Auto-select the first active integration if none is selected
      if (!selectedIntegrationId && integrations.length > 0) {
        const activeIntegration = integrations.find(i => i.isActive && i.healthStatus === 'HEALTHY') 
          || integrations.find(i => i.isActive)
          || integrations[0];
        
        if (activeIntegration) {
          setSelectedIntegrationId(activeIntegration.id);
        }
      }
      
      return integrations;
    } catch (error) {
      console.error('Error loading Slack integrations:', error);
      setAvailableIntegrations([]);
      return [];
    }
  }, [selectedIntegrationId]);

  const checkConnection = useCallback(async (integrationId?: string) => {
    const targetIntegrationId = integrationId || selectedIntegrationId;
    
    setStatus('checking');
    setError(undefined);
    setErrorType(undefined);
    setRetryAfter(undefined);
    setRecoveryInstructions(undefined);
    setIsRetryable(undefined);

    // Load integrations first if we don't have any
    if (availableIntegrations.length === 0) {
      await loadAvailableIntegrations();
    }

    // If no integrations available, show setup instructions
    if (availableIntegrations.length === 0) {
      setStatus('disconnected');
      setError('No Slack integrations found. Please connect your Slack account first.');
      setErrorType('integration_not_found');
      setRecoveryInstructions(SlackConnectionUtils.getRecoveryInstructions('integration_not_found'));
      setIsRetryable(false);
      return;
    }

    // If no specific integration selected and we have multiple, require selection
    if (!targetIntegrationId && availableIntegrations.length > 1) {
      setStatus('disconnected');
      setError('Multiple Slack workspaces available. Please select a workspace.');
      setErrorType('workspace_mismatch');
      setRecoveryInstructions(['Select a Slack workspace from the dropdown above']);
      setIsRetryable(false);
      return;
    }

    try {
      const response = await SlackConnectionUtils.checkConnection(targetIntegrationId);
      
      if (response.connected) {
        setStatus('connected');
        setConnectionData({
          teamId: response.teamId!,
          teamName: response.teamName!,
          userId: response.userId!,
          userName: response.userName!,
          botId: response.botId
        });
      } else {
        // Handle different error states
        const errorTypeValue = response.errorType || 'unknown';
        
        if (errorTypeValue === 'rate_limited') {
          setStatus('rate_limited');
        } else {
          setStatus('disconnected');
        }
        
        setError(response.error);
        setErrorType(errorTypeValue);
        setRetryAfter(response.retryAfter);
        setRecoveryInstructions(SlackConnectionUtils.getRecoveryInstructions(errorTypeValue));
        setIsRetryable(SlackConnectionUtils.shouldRetryConnection(errorTypeValue));
      }
    } catch (err) {
      let errorTypeValue: string;
      let errorMessage: string;
      let retryAfterValue: number | undefined;
      let isRetryableValue: boolean;

      if (err instanceof SlackError) {
        errorTypeValue = err.errorType;
        errorMessage = err.message;
        retryAfterValue = err.retryAfter;
        isRetryableValue = err.isRetryable;
        
        if (err.errorType === 'rate_limited') {
          setStatus('rate_limited');
        } else {
          setStatus('error');
        }
      } else {
        const error = err as Error;
        errorTypeValue = SlackConnectionUtils.categorizeError(error);
        errorMessage = SlackConnectionUtils.getConnectionErrorMessage(errorTypeValue);
        isRetryableValue = SlackConnectionUtils.shouldRetryConnection(errorTypeValue);
        setStatus('error');
      }
      
      setError(errorMessage);
      setErrorType(errorTypeValue as SlackConnectionState['errorType']);
      setRetryAfter(retryAfterValue);
      setRecoveryInstructions(SlackConnectionUtils.getRecoveryInstructions(errorTypeValue));
      setIsRetryable(isRetryableValue);
    }
  }, [selectedIntegrationId, availableIntegrations, loadAvailableIntegrations]);

  const selectIntegration = useCallback(async (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    // Automatically check connection for the selected integration
    await checkConnection(integrationId);
  }, [checkConnection]);

  // Load integrations and check connection on mount
  useEffect(() => {
    const initializeConnection = async () => {
      const integrations = await loadAvailableIntegrations();
      
      // Only check connection if we have integrations
      if (integrations.length > 0) {
        await checkConnection();
      }
    };
    
    initializeConnection();
  }, []); // Remove dependencies to prevent infinite loop

  return {
    status,
    selectedIntegrationId,
    availableIntegrations,
    connectionData,
    error,
    errorType,
    retryAfter,
    recoveryInstructions,
    isRetryable,
    checkConnection,
    selectIntegration
  };
}