# App Version Control Setup

This document describes the app version control system that blocks all app versions except the configured minimum required version.

## Overview

The system includes:
- **App Config Service**: Manages version requirements and configuration
- **Version Check Middleware**: Validates app version from request headers
- **App Config API**: Endpoint to retrieve version requirements
- **Environment Configuration**: Configurable via environment variables

## Files Created

1. `src/config/appConfig.js` - Configuration service
2. `src/middleware/versionMiddleware.js` - Version validation middleware
3. `src/controller/AppConfigController.js` - App config controller
4. `src/router/appConfigRouter.js` - App config routes

## Environment Variables

Add these to your `.env` file:

```env
# App Version Configuration
MINIMUM_REQUIRED_VERSION=2.0.0
LATEST_VERSION=2.0.0
FORCE_UPDATE=true
APK_URL=https://mydomain.com/app-v2.apk
```

### Default Values
- `MINIMUM_REQUIRED_VERSION`: `2.0.0` (if not set)
- `LATEST_VERSION`: `2.0.0` (if not set)
- `FORCE_UPDATE`: `true` (if not set)
- `APK_URL`: `https://mydomain.com/app-v2.apk` (if not set)

## API Endpoints

### GET `/api/app-config`

Returns app configuration including version requirements.

**Request:**
```bash
curl -X GET http://localhost:5000/api/app-config
```

**Response (200 OK):**
```json
{
  "minimumRequiredVersion": "2.0.0",
  "latestVersion": "2.0.0",
  "forceUpdate": true,
  "apkUrl": "https://mydomain.com/app-v2.apk"
}
```

**Note:** This endpoint does NOT require the `x-app-version` header, allowing clients to check requirements even with old versions.

## Version Check Middleware

All API endpoints (except `/api/app-config`) require the `x-app-version` header.

### How It Works

1. Client sends request with `x-app-version` header
2. Middleware checks if version meets minimum requirement
3. If version is invalid or missing:
   - Returns HTTP 426 (Upgrade Required)
   - Response includes update message and config

### Example: Valid Request

**Request:**
```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 2.0.0" \
  -H "Authorization: Bearer <token>"
```

**Response:** Normal API response (200 OK, etc.)

### Example: Invalid Version

**Request:**
```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 1.9.0" \
  -H "Authorization: Bearer <token>"
```

**Response (426 Upgrade Required):**
```json
{
  "message": "Please update app",
  "error": "App version 1.9.0 is not supported. Minimum required: 2.0.0",
  "updateRequired": true,
  "config": {
    "minimumRequiredVersion": "2.0.0",
    "latestVersion": "2.0.0",
    "forceUpdate": true,
    "apkUrl": "https://mydomain.com/app-v2.apk"
  }
}
```

### Example: Missing Version Header

**Request:**
```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "Authorization: Bearer <token>"
```

**Response (426 Upgrade Required):**
```json
{
  "message": "Please update app",
  "error": "App version header (x-app-version) is required"
}
```

## Version Comparison

The system uses semantic versioning comparison:
- Versions are compared as `MAJOR.MINOR.PATCH`
- Only versions >= minimum required version are allowed
- Example: If minimum is `2.0.0`:
  - ✅ `2.0.0` - Allowed
  - ✅ `2.0.1` - Allowed
  - ✅ `2.1.0` - Allowed
  - ✅ `3.0.0` - Allowed
  - ❌ `1.9.9` - Blocked
  - ❌ `1.0.0` - Blocked

## Mobile App Integration

### Android (Kotlin/Java) Example

```kotlin
// Add to your API client
val client = OkHttpClient.Builder()
    .addInterceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("x-app-version", BuildConfig.VERSION_NAME)
            .build()
        chain.proceed(request)
    }
    .build()
```

### React Native Example

```javascript
// Add to your API client
const headers = {
  'x-app-version': require('./package.json').version,
  'Content-Type': 'application/json',
};

fetch('https://api.example.com/api/fetch-result', {
  method: 'GET',
  headers: headers,
})
  .then(response => {
    if (response.status === 426) {
      // Handle update required
      return response.json().then(data => {
        // Show update dialog with data.apkUrl
      });
    }
    return response.json();
  });
```

## Security Considerations

1. **Header Validation**: The middleware validates the version header on every request
2. **No Bypass**: All routes except `/app-config` are protected
3. **Configurable**: Version requirements can be updated via environment variables without code changes
4. **Production Ready**: Includes error handling and proper HTTP status codes

## Testing

### Test Valid Version
```bash
curl -X GET http://localhost:5000/api/app-config \
  -H "x-app-version: 2.0.0"
```

### Test Invalid Version
```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 1.9.0"
```

### Test Missing Header
```bash
curl -X GET http://localhost:5000/api/fetch-result
```

## Updating Version Requirements

To change the minimum required version:

1. Update `.env` file:
   ```env
   MINIMUM_REQUIRED_VERSION=2.1.0
   LATEST_VERSION=2.1.0
   APK_URL=https://mydomain.com/app-v2.1.apk
   ```

2. Restart the server

3. All clients with version < 2.1.0 will receive 426 responses

## Architecture

```
Request Flow:
1. Client → Express App
2. CORS & Body Parsing Middleware
3. App Config Router (only /app-config route)
4. Version Check Middleware (all routes except /app-config)
5. Other Routers (resultRoutes, authRouter, etc.)
```

## Notes

- The `/api/app-config` endpoint is intentionally excluded from version checking so clients can always check current requirements
- Version comparison supports semantic versioning (MAJOR.MINOR.PATCH)
- All existing routes are automatically protected by the version middleware
- No changes to existing functionality - only adds version checking layer
