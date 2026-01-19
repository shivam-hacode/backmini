# Expo React Native App Version Setup Guide

यह guide Expo React Native app में automatic app version handling के लिए है।

## Overview

इस setup से:
- App version `app.json` से automatically read होगा
- हर API request में `x-app-version` header automatically add होगा
- Centralized Axios client use होगा
- Production-ready code होगा

## Installation

```bash
cd your-expo-project
npm install axios expo-constants
# या
yarn add axios expo-constants
```

## Project Structure

```
your-expo-project/
├── app.json (or app.config.js)
├── src/
│   ├── services/
│   │   └── apiClient.js       ← Axios client with version header
│   └── utils/
│       └── appVersion.js      ← Version helper (optional)
└── ...
```

## Implementation

### Step 1: App Version Helper (Optional but Recommended)

**File: `src/utils/appVersion.js`**

```javascript
/**
 * App Version Utility
 * Reads app version from Expo constants
 * Always in sync with app.json / app.config.js
 */
import Constants from 'expo-constants';

/**
 * Get the current app version
 * Reads from expo.version in app.json/app.config.js
 * 
 * @returns {string} App version (e.g., "2.0.0")
 */
export const getAppVersion = () => {
  try {
    // expo.version reads from app.json or app.config.js
    const version = Constants.expoConfig?.version || Constants.manifest?.version;
    
    if (!version) {
      console.warn('[AppVersion] Version not found in app.json');
      return '1.0.0'; // Fallback version
    }
    
    return version;
  } catch (error) {
    console.error('[AppVersion] Error reading version:', error);
    return '1.0.0'; // Fallback version
  }
};

/**
 * Get app version with build number (optional)
 * Format: "2.0.0 (123)"
 * 
 * @returns {string} Version with build number
 */
export const getAppVersionWithBuild = () => {
  const version = getAppVersion();
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || 
                      Constants.expoConfig?.android?.versionCode;
  
  if (buildNumber) {
    return `${version} (${buildNumber})`;
  }
  
  return version;
};

export default getAppVersion;
```

### Step 2: Centralized API Client with Version Header

**File: `src/services/apiClient.js`**

```javascript
/**
 * Centralized API Client
 * Automatically adds app version to all requests
 * Uses Axios for HTTP requests
 */
import axios from 'axios';
import { getAppVersion } from '../utils/appVersion';

// Base API URL - Change this to your backend URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api'  // Development
  : 'https://your-production-api.com/api';  // Production

/**
 * Create Axios instance with default configuration
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    // App version will be added by interceptor
  },
});

/**
 * Request Interceptor
 * Automatically adds x-app-version header to every request
 */
apiClient.interceptors.request.use(
  (config) => {
    // Get app version from app.json
    const appVersion = getAppVersion();
    
    // Add app version to request headers
    config.headers['x-app-version'] = appVersion;
    
    // Log in development (optional)
    if (__DEV__) {
      console.log(`[API Client] Request to ${config.url} with version ${appVersion}`);
    }
    
    return config;
  },
  (error) => {
    // Handle request error
    console.error('[API Client] Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handles update required (426) responses
 */
apiClient.interceptors.response.use(
  (response) => {
    // Normal response - pass through
    return response;
  },
  (error) => {
    // Handle response errors
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle 426 Upgrade Required (version check failed)
      if (status === 426) {
        console.warn('[API Client] Update required:', data);
        
        // You can dispatch an event here or show update modal
        // For now, we'll just log it
        // TODO: Show update popup/modal
        if (data.updateRequired && data.config?.apkUrl) {
          // Handle update required in your app
          // Example: Navigation.navigate('UpdateScreen', { updateData: data });
        }
      }
      
      // Log other errors in development
      if (__DEV__) {
        console.error('[API Client] Response error:', {
          status,
          message: data.message || error.message,
          url: error.config?.url,
        });
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('[API Client] No response:', error.request);
    } else {
      // Something else happened
      console.error('[API Client] Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Step 3: Update app.json

**File: `app.json`**

```json
{
  "expo": {
    "name": "Your App Name",
    "version": "2.0.0",
    "slug": "your-app-slug",
    "platforms": ["ios", "android"],
    // ... other config
  }
}
```

**या `app.config.js` (if using dynamic config):**

```javascript
export default {
  expo: {
    name: 'Your App Name',
    version: '2.0.0',
    slug: 'your-app-slug',
    // ... other config
  },
};
```

## Usage Examples

### Basic API Call

```javascript
// In your component or service
import apiClient from '../services/apiClient';

// GET request
const fetchData = async () => {
  try {
    // x-app-version header automatically added!
    const response = await apiClient.get('/fetch-result');
    return response.data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// POST request
const login = async (email, password) => {
  try {
    // x-app-version header automatically added!
    const response = await apiClient.post('/login', {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### With Authentication Token

```javascript
// Add token to existing client
apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Or per request
const response = await apiClient.get('/protected-route', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### Update Required Handler

**File: `src/components/UpdateModal.js` (Example)**

```javascript
import React from 'react';
import { Modal, View, Text, Button, Linking } from 'react-native';

const UpdateModal = ({ visible, updateData, onClose }) => {
  const handleUpdate = () => {
    if (updateData?.config?.apkUrl) {
      Linking.openURL(updateData.config.apkUrl);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>
            {updateData?.message || 'Please update your app to continue'}
          </Text>
          <Text style={styles.version}>
            Minimum version: {updateData?.config?.minimumRequiredVersion}
          </Text>
          <Button title="Update Now" onPress={handleUpdate} />
          {!updateData?.forceUpdate && (
            <Button title="Later" onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default UpdateModal;
```

## Testing

### 1. Local Testing

```javascript
// In your component, test version header
import apiClient from '../services/apiClient';

const TestVersion = () => {
  const testAPI = async () => {
    try {
      const response = await apiClient.get('/app-config');
      console.log('Response:', response.data);
      console.log('Version sent:', response.config.headers['x-app-version']);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Button title="Test API" onPress={testAPI} />
  );
};
```

### 2. Check Server Logs

Server console में version check logs दिखनी चाहिए:
```
[Version Check] Request from /api/fetch-result - Version: 2.0.0, Minimum: 2.0.0, Allowed: true
```

### 3. Test Old Version

Temporarily `app.json` में version `1.0.0` करें:
```json
{
  "expo": {
    "version": "1.0.0"
  }
}
```

अब API call करें - server से 426 response आना चाहिए।

## Complete Example: API Service

**File: `src/services/resultService.js`**

```javascript
/**
 * Result Service
 * Example service using the API client
 */
import apiClient from './apiClient';

export const resultService = {
  /**
   * Fetch results
   * x-app-version header automatically included
   */
  fetchResults: async (category, date) => {
    try {
      const response = await apiClient.get('/fetch-result', {
        params: { category, date },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 426) {
        // Update required - handle in your app
        throw new Error('UPDATE_REQUIRED');
      }
      throw error;
    }
  },

  /**
   * Upload data
   * x-app-version header automatically included
   */
  uploadData: async (data) => {
    try {
      const response = await apiClient.post('/upload-data', data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 426) {
        throw new Error('UPDATE_REQUIRED');
      }
      throw error;
    }
  },
};

export default resultService;
```

## File Placement Guide

```
your-expo-project/
├── app.json                    ← Version defined here
├── package.json
├── App.js                      ← Main app component
└── src/
    ├── services/
    │   ├── apiClient.js        ← Axios client (CREATE THIS)
    │   └── resultService.js    ← Example service
    ├── utils/
    │   └── appVersion.js       ← Version helper (CREATE THIS)
    ├── components/
    │   └── UpdateModal.js      ← Update popup component
    └── screens/
        └── HomeScreen.js       ← Use apiClient here
```

## Key Points

1. **Version Source**: Version `app.json` से automatically read होता है
2. **Automatic Header**: हर request में `x-app-version` automatically add होता है
3. **No Manual Work**: Components में manually header add करने की जरूरत नहीं
4. **Version Sync**: Version हमेशा `app.json` के साथ sync रहता है
5. **Update Handling**: 426 response automatically detect होता है

## Troubleshooting

### Version not being sent

1. Check `app.json` में version field है:
   ```json
   {
     "expo": {
       "version": "2.0.0"
     }
   }
   ```

2. Check `apiClient.js` में interceptor properly setup है

3. Check console logs:
   ```javascript
   console.log('App version:', getAppVersion());
   ```

### Version not updating

1. App restart करें (Expo reload काम नहीं करेगा)
2. Check `app.json` में version change हुआ है
3. Rebuild करें if needed

## Production Checklist

- ✅ Version properly defined in `app.json`
- ✅ API base URL set correctly
- ✅ Error handling implemented
- ✅ Update required (426) handler implemented
- ✅ Console logs removed for production
- ✅ Tested with old and new versions
