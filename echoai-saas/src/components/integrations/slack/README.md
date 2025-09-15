# Slack Integration Selection and Validation

This implementation adds support for multiple Slack workspace integrations with proper selection and validation.

## Features Implemented

### 1. Integration Selection UI
- **SlackIntegrationSelector**: Component for selecting between multiple Slack workspaces
- Displays workspace names, user information, and health status
- Shows setup instructions when no integrations are available
- Handles single vs multiple integration scenarios

### 2. Integration Status Validation
- Validates integration health status before loading channels/users
- Handles inactive integrations with appropriate warnings
- Shows connection errors with recovery instructions
- Supports integration switching with proper data reloading

### 3. Enhanced API Endpoints
- **GET /api/integrations/slack/integrations**: Lists all user's Slack integrations
- **GET /api/integrations/slack/status?integrationId=**: Checks specific integration status
- **GET /api/integrations/slack/channels?integrationId=**: Loads channels for specific integration
- **GET /api/integrations/slack/users?integrationId=**: Loads users for specific integration

### 4. Updated Hooks
- **useSlackConnection**: Now supports multiple integrations and auto-selection
- **useSlackChannels**: Accepts integrationId parameter for specific workspace
- **useSlackUsers**: Accepts integrationId parameter for specific workspace

### 5. Enhanced Configuration Forms
- **SlackNotificationConfigForm**: Updated to use integration selection
- **SlackThreadReplyConfigForm**: Updated to use integration selection
- Both forms automatically include selected integrationId in configuration

## Usage Example

```tsx
import { useSlackConnection, useSlackChannels } from '@/hooks';
import { SlackConnectionStatusCard } from '@/components/integrations/slack';

function MySlackForm() {
  const connectionState = useSlackConnection();
  const channelsState = useSlackChannels(
    connectionState.status, 
    connectionState.selectedIntegrationId
  );

  return (
    <div>
      <SlackConnectionStatusCard 
        connectionState={connectionState}
        showIntegrationSelector={true}
      />
      
      {connectionState.status === 'connected' && (
        <SlackChannelSelector
          channels={channelsState.channels}
          loading={channelsState.loading}
          value={selectedChannel}
          onChange={setSelectedChannel}
        />
      )}
    </div>
  );
}
```

## Integration Selection Flow

1. **Load Available Integrations**: Hook fetches all user's Slack integrations
2. **Auto-Selection**: Automatically selects the healthiest active integration
3. **Manual Selection**: User can switch between workspaces using dropdown
4. **Validation**: Validates selected integration before loading data
5. **Data Loading**: Loads channels/users for the selected workspace
6. **Error Handling**: Shows appropriate errors and recovery instructions

## Error Scenarios Handled

- **No Integrations**: Shows setup instructions with link to integrations page
- **Multiple Workspaces**: Shows selector with health status indicators
- **Inactive Integration**: Warns user and prevents data loading
- **Connection Errors**: Shows specific error messages with recovery steps
- **Rate Limiting**: Handles Slack API rate limits gracefully

## Backward Compatibility

The implementation maintains backward compatibility:
- Existing single-integration setups continue to work
- API endpoints support both with/without integrationId parameter
- Configuration forms work with existing action configs
- Hooks default to first available integration if none specified

## Testing

- Unit tests for SlackIntegrationSelector component
- Integration tests for hook interactions
- Error scenario testing for various failure modes
- Backward compatibility testing for existing configurations
- API endpoint tests for proper date handling and error scenarios

## Bug Fixes Applied

### Date Handling in API Endpoints
Fixed issue where `lastHealthCheck` field was being treated as a Date object when it could be a string or null from the database. Added proper date formatting helper function to handle all date field types consistently.

### Session Security
Addressed Supabase auth session security warning by properly extracting and using the user ID from the session object for database queries.