# Integration Validation API Endpoints

This document describes the validation API endpoints for HubSpot and Google Sheets integrations.

## Overview

The validation endpoints provide a way to check the health and status of integration connections, retrieve account information, and handle authentication requirements. They include built-in caching, rate limiting, and comprehensive error handling.

## Endpoints

### HubSpot Validation

#### `POST /api/integrations/hubspot/validate`

Validates HubSpot connection and retrieves account information.

**Request:**
```json
{
  "maxCacheAge": 900000  // Optional: Cache age in milliseconds (default: 15 minutes)
}
```

**Response (Success):**
```json
{
  "success": true,
  "accountInfo": {
    "portalId": "12345",
    "portalName": "My Company",
    "userEmail": "user@example.com",
    "subscriptionTier": "Professional",
    "availableObjects": ["contacts", "deals", "companies"],
    "permissions": ["contacts", "deals"],
    "apiLimits": {
      "dailyLimit": 40000,
      "currentUsage": 1250
    }
  },
  "availableObjects": [
    {
      "name": "contacts",
      "label": "Contact",
      "properties": [...]
    }
  ],
  "lastValidated": "2024-01-15T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "HubSpot authentication expired",
  "errorCode": "AUTH_EXPIRED",
  "requiresAuth": true,
  "suggestedAction": "Click the 'Reconnect' button to authenticate again."
}
```

#### `GET /api/integrations/hubspot/validate`

Returns cached validation status without performing new validation.

**Response:**
```json
{
  "success": true,
  "cached": true,
  "healthStatus": "healthy",
  "lastValidated": "2024-01-15T10:30:00Z",
  "requiresAuth": false
}
```

### Google Sheets Validation

#### `POST /api/integrations/google/validate`

Validates Google Sheets connection and retrieves account information.

**Request:**
```json
{
  "maxCacheAge": 900000  // Optional: Cache age in milliseconds (default: 15 minutes)
}
```

**Response (Success):**
```json
{
  "success": true,
  "accountInfo": {
    "email": "user@example.com",
    "name": "John Doe",
    "driveQuota": {
      "limit": "15000000000",
      "usage": "1000000000",
      "usageInDrive": "500000000"
    },
    "permissions": {
      "canCreateFiles": true,
      "canEditFiles": true,
      "canShareFiles": true
    }
  },
  "lastValidated": "2024-01-15T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Google authentication expired",
  "errorCode": "AUTH_EXPIRED",
  "requiresAuth": true,
  "suggestedAction": "Click the 'Reconnect' button to authenticate again."
}
```

#### `GET /api/integrations/google/validate`

Returns cached validation status without performing new validation.

## Error Codes

| Code | Description | Requires Auth | Retryable |
|------|-------------|---------------|-----------|
| `AUTH_EXPIRED` | Authentication token expired | Yes | No |
| `AUTH_INVALID` | Authentication token invalid | Yes | No |
| `AUTH_REQUIRED` | No authentication found | Yes | No |
| `INSUFFICIENT_PERMISSIONS` | Missing required permissions | No | No |
| `SCOPE_MISSING` | Required OAuth scopes missing | Yes | No |
| `RATE_LIMITED` | API rate limit exceeded | No | Yes |
| `SERVICE_UNAVAILABLE` | External service unavailable | No | Yes |
| `API_ERROR` | General API error | No | Yes |
| `NETWORK_ERROR` | Network connectivity issue | No | Yes |
| `TIMEOUT` | Request timeout | No | Yes |
| `CONNECTION_FAILED` | General connection failure | No | Yes |

## Rate Limiting

- **Limit:** 10 requests per minute per user
- **Headers:** `Retry-After` header included in 429 responses
- **Key:** Based on user ID from session

## Caching

- **Default TTL:** 15 minutes for validation results
- **Headers:** `Cache-Control: private, max-age=900`
- **Invalidation:** Automatic on authentication changes

## Authentication

All endpoints require user authentication via session. Unauthenticated requests return:

```json
{
  "success": false,
  "error": "Authentication required",
  "errorCode": "AUTH_REQUIRED",
  "requiresAuth": true
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
// Validate HubSpot connection
async function validateHubSpot() {
  const response = await fetch('/api/integrations/hubspot/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      maxCacheAge: 300000 // 5 minutes
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('HubSpot connected:', result.accountInfo);
  } else if (result.requiresAuth) {
    // Redirect to OAuth flow
    window.location.href = '/api/integrations/oauth/authorize?provider=hubspot';
  } else {
    console.error('Validation failed:', result.error);
  }
}

// Check cached status
async function checkCachedStatus() {
  const response = await fetch('/api/integrations/hubspot/validate');
  const result = await response.json();
  
  return {
    isHealthy: result.success,
    needsAuth: result.requiresAuth,
    lastCheck: result.lastValidated
  };
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface ValidationResult {
  success: boolean;
  accountInfo?: any;
  error?: string;
  requiresAuth?: boolean;
  isLoading: boolean;
}

export function useIntegrationValidation(provider: 'hubspot' | 'google') {
  const [result, setResult] = useState<ValidationResult>({ 
    success: false, 
    isLoading: true 
  });

  const validate = async (useCache = true) => {
    setResult(prev => ({ ...prev, isLoading: true }));
    
    try {
      const endpoint = `/api/integrations/${provider}/validate`;
      const response = await fetch(endpoint, {
        method: useCache ? 'GET' : 'POST',
        headers: useCache ? {} : { 'Content-Type': 'application/json' },
        body: useCache ? undefined : JSON.stringify({})
      });
      
      const data = await response.json();
      setResult({ ...data, isLoading: false });
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error',
        isLoading: false
      });
    }
  };

  useEffect(() => {
    validate(true); // Start with cached check
  }, [provider]);

  return { ...result, validate };
}
```

## Security Considerations

1. **Token Encryption:** All access tokens are encrypted in the database
2. **Rate Limiting:** Prevents abuse and protects external APIs
3. **Session Validation:** All requests require valid user sessions
4. **Error Sanitization:** Sensitive information is not exposed in error messages
5. **HTTPS Only:** All endpoints should be accessed over HTTPS in production

## Monitoring

The validation endpoints automatically update integration health status in the database, which can be used for:

- Dashboard health indicators
- Automated alerts for failed integrations
- Usage analytics and reporting
- Performance monitoring