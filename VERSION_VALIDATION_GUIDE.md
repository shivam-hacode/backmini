# Mobile App Version Validation Guide

## Overview

Backend APIs enforce strict mobile app version validation. Only apps with version **2.0.0 or higher** can access the APIs.

## Rules

1. ✅ **Header Required**: `x-app-version` header must be present in every request
2. ✅ **Minimum Version**: Only versions >= `2.0.0` are allowed
3. ✅ **Semantic Comparison**: Versions compared semantically (2.0.10 > 2.0.2)
4. ✅ **Block Invalid**: Requests with missing header or lower version are blocked
5. ✅ **HTTP 426**: Returns Upgrade Required status code

## Request Header

Every mobile app request must include:

```
x-app-version: 2.0.0
```

**Case-insensitive**: `X-App-Version` or `X-APP-VERSION` also works

## Response Format

### Blocked Request (426 Upgrade Required)

```json
{
  "success": false,
  "message": "Please update the app to version 2.0.0 or above to continue"
}
```

### Valid Request (Normal Response)

Request proceeds normally, returns your API's standard response.

## Version Comparison Examples

Using semantic versioning comparison:

| App Version | Minimum Required | Result | Reason |
|------------|------------------|--------|--------|
| 2.0.0      | 2.0.0            | ✅ Allowed | Equal to minimum |
| 2.0.1      | 2.0.0            | ✅ Allowed | Higher patch version |
| 2.0.10     | 2.0.2            | ✅ Allowed | Higher patch (semantic) |
| 2.1.0      | 2.0.0            | ✅ Allowed | Higher minor version |
| 3.0.0      | 2.0.0            | ✅ Allowed | Higher major version |
| 1.9.9      | 2.0.0            | ❌ Blocked | Lower than minimum |
| 1.0.0      | 2.0.0            | ❌ Blocked | Lower than minimum |
| (missing)  | 2.0.0            | ❌ Blocked | Header missing |

## Implementation

### Middleware Location

`src/middleware/versionMiddleware.js`

### Global Application

Applied globally to all `/api/*` routes in `index.js`:

```javascript
// Version check middleware - applies to all routes except /app-config
app.use('/api', (req, res, next) => {
  // Skip version check for app-config endpoint
  if (req.path === '/app-config' || req.originalUrl === '/api/app-config') {
    return next();
  }
  // Apply version check for all other routes
  versionCheckMiddleware(req, res, next);
});
```

### Configuration

Minimum required version configured in `.env`:

```env
MINIMUM_REQUIRED_VERSION=2.0.0
```

Or defaults to `2.0.0` if not set.

## Testing

### Test 1: Valid Version (Should Pass)

```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 2.0.0" \
  -H "Authorization: Bearer <token>"
```

**Expected**: Normal API response (200 OK, etc.)

### Test 2: Higher Version (Should Pass)

```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 2.0.10" \
  -H "Authorization: Bearer <token>"
```

**Expected**: Normal API response (200 OK, etc.)

### Test 3: Lower Version (Should Be Blocked)

```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: 1.9.9" \
  -H "Authorization: Bearer <token>"
```

**Expected Response (426)**:
```json
{
  "success": false,
  "message": "Please update the app to version 2.0.0 or above to continue"
}
```

### Test 4: Missing Header (Should Be Blocked)

```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "Authorization: Bearer <token>"
```

**Expected Response (426)**:
```json
{
  "success": false,
  "message": "Please update the app to version 2.0.0 or above to continue"
}
```

### Test 5: Invalid Format (Should Be Blocked)

```bash
curl -X GET http://localhost:5000/api/fetch-result \
  -H "x-app-version: invalid" \
  -H "Authorization: Bearer <token>"
```

**Expected Response (426)**:
```json
{
  "success": false,
  "message": "Please update the app to version 2.0.0 or above to continue"
}
```

## Mobile App Integration

Mobile app must send `x-app-version` header with every API request:

### React Native / Expo Example

```javascript
import axios from 'axios';
import Constants from 'expo-constants';

const apiClient = axios.create({
  baseURL: 'https://your-api.com/api',
});

// Automatically add version header
apiClient.interceptors.request.use((config) => {
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  config.headers['x-app-version'] = appVersion;
  return config;
});
```

### Android (Kotlin) Example

```kotlin
val client = OkHttpClient.Builder()
    .addInterceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("x-app-version", BuildConfig.VERSION_NAME)
            .build()
        chain.proceed(request)
    }
    .build()
```

### iOS (Swift) Example

```swift
var request = URLRequest(url: url)
request.setValue(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0", 
                 forHTTPHeaderField: "x-app-version")
```

## Excluded Endpoints

The following endpoint is excluded from version checking (to allow apps to check version requirements):

- `GET /api/app-config` - Returns current version requirements

## Production Checklist

- ✅ Minimum version set in `.env` file
- ✅ Middleware applied globally to all `/api/*` routes
- ✅ `/api/app-config` endpoint excluded
- ✅ Error response format matches specification
- ✅ Semantic version comparison working correctly
- ✅ Logging enabled for debugging
- ✅ Mobile apps updated to send `x-app-version` header

## Updating Minimum Version

To change the minimum required version:

1. Update `.env` file:
   ```env
   MINIMUM_REQUIRED_VERSION=2.1.0
   ```

2. Restart the server

3. All apps with version < 2.1.0 will now receive 426 responses

## Troubleshooting

### Version not being checked

- Check middleware is applied in `index.js`
- Check route path matches `/api/*` pattern
- Check `/api/app-config` is excluded

### Version comparison not working

- Verify semantic versioning format (e.g., "2.0.0")
- Check `compareVersions` method in `appConfig.js`
- Test with different version combinations

### False positives

- Check minimum version in `.env`
- Verify version format from mobile app
- Check server logs for version values
