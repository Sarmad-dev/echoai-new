import { useState, useCallback, useEffect } from 'react';
import { SlackChannelsState } from '@/types/slack';
import { SlackConnectionUtils, SlackError } from '@/lib/integrations/slack-utils';

/**
 * Hook for loading and managing Slack channels data with integration support
 */
export function useSlackChannels(connectionStatus: string, integrationId?: string): SlackChannelsState {
  const [channels, setChannels] = useState<SlackChannelsState['channels']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorType, setErrorType] = useState<string>();
  const [isRetryable, setIsRetryable] = useState<boolean>();
  const [recoveryInstructions, setRecoveryInstructions] = useState<string[]>();

  const loadChannels = useCallback(async (targetIntegrationId?: string) => {
    if (connectionStatus !== 'connected') {
      return;
    }

    const finalIntegrationId = targetIntegrationId || integrationId;

    setLoading(true);
    setError(undefined);
    setErrorType(undefined);
    setIsRetryable(undefined);
    setRecoveryInstructions(undefined);

    try {
      const channelsData = await SlackConnectionUtils.loadChannels(finalIntegrationId);
      setChannels(channelsData);
    } catch (err) {
      let errorTypeValue: string;
      let errorMessage: string;
      let isRetryableValue: boolean;

      if (err instanceof SlackError) {
        errorTypeValue = err.errorType;
        errorMessage = err.message;
        isRetryableValue = err.isRetryable;
      } else {
        const error = err as Error;
        errorTypeValue = SlackConnectionUtils.categorizeError(error);
        errorMessage = SlackConnectionUtils.getConnectionErrorMessage(errorTypeValue);
        isRetryableValue = SlackConnectionUtils.isRetryableSlackError(error);
      }

      setError(errorMessage);
      setErrorType(errorTypeValue);
      setIsRetryable(isRetryableValue);
      setRecoveryInstructions(SlackConnectionUtils.getRecoveryInstructions(errorTypeValue));
      
      console.error('Error loading Slack channels:', {
        error: err,
        errorType: errorTypeValue,
        isRetryable: isRetryableValue
      });

      // For retryable errors, attempt graceful degradation
      if (isRetryableValue && SlackConnectionUtils.shouldUseCachedData(errorTypeValue)) {
        // Could implement cached data retrieval here
        console.info('Error is retryable, consider using cached data if available');
      }
    } finally {
      setLoading(false);
    }
  }, [connectionStatus, integrationId]);

  // Load channels when connection is established or integration changes
  useEffect(() => {
    if (connectionStatus === 'connected' && integrationId) {
      loadChannels();
    } else {
      // Clear channels if not connected or no integration selected
      setChannels([]);
      setError(undefined);
      setErrorType(undefined);
      setIsRetryable(undefined);
      setRecoveryInstructions(undefined);
    }
  }, [connectionStatus, integrationId, loadChannels]);

  return {
    channels,
    loading,
    error,
    errorType,
    isRetryable,
    recoveryInstructions,
    loadChannels
  };
}