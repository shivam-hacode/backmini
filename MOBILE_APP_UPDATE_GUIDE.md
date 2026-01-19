# Mobile App Update Popup Integration Guide

यह guide mobile app में update popup को properly implement करने के लिए है।

## Response Format

जब version old हो (जैसे 1.0.0), तो backend से यह response आएगा:

```json
{
  "status": "update_required",
  "message": "Please update your app to continue",
  "error": "App version 1.0.0 is not supported. Minimum required: 2.0.0",
  "updateRequired": true,
  "forceUpdate": true,
  "config": {
    "minimumRequiredVersion": "2.0.0",
    "latestVersion": "2.0.0",
    "forceUpdate": true,
    "apkUrl": "https://mydomain.com/app-v2.apk"
  }
}
```

**HTTP Status Code:** `426 Upgrade Required`

## Mobile App Implementation

### React Native Example

```javascript
// API Interceptor या fetch wrapper में
const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-app-version': DeviceInfo.getVersion(), // या app version
        ...options.headers,
      },
    });

    // Check for update required (426 status)
    if (response.status === 426) {
      const data = await response.json();
      
      if (data.updateRequired) {
        // Update popup दिखाएं
        showUpdatePopup({
          message: data.message,
          forceUpdate: data.forceUpdate,
          apkUrl: data.config.apkUrl,
          minimumVersion: data.config.minimumRequiredVersion,
        });
        
        // Request को block करें - response return न करें
        throw new Error('UPDATE_REQUIRED');
      }
    }

    // Normal response handle करें
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message === 'UPDATE_REQUIRED') {
      // Update required error - popup already shown
      throw error;
    }
    // Other errors
    throw error;
  }
};

// Update Popup Component
const showUpdatePopup = ({ message, forceUpdate, apkUrl, minimumVersion }) => {
  Alert.alert(
    'Update Required',
    message || `Please update to version ${minimumVersion} to continue using the app.`,
    [
      {
        text: 'Update Now',
        onPress: () => {
          // APK download और install करें
          Linking.openURL(apkUrl);
        },
        style: 'default',
      },
      ...(forceUpdate
        ? []
        : [
            {
              text: 'Later',
              onPress: () => {
                // App को exit करें या limited access दें
              },
              style: 'cancel',
            },
          ]),
    ],
    { cancelable: !forceUpdate }
  );
};
```

### Android (Kotlin) Example

```kotlin
// OkHttp Interceptor
class VersionCheckInterceptor(private val context: Context) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
            .newBuilder()
            .addHeader("x-app-version", BuildConfig.VERSION_NAME)
            .build()

        val response = chain.proceed(request)

        // Check for 426 status code
        if (response.code == 426) {
            try {
                val responseBody = response.body?.string()
                val jsonObject = JSONObject(responseBody ?: "")
                
                if (jsonObject.optBoolean("updateRequired", false)) {
                    val forceUpdate = jsonObject.optBoolean("forceUpdate", true)
                    val config = jsonObject.getJSONObject("config")
                    val apkUrl = config.getString("apkUrl")
                    val message = jsonObject.getString("message")
                    
                    // Main thread पर popup दिखाएं
                    Handler(Looper.getMainLooper()).post {
                        showUpdateDialog(message, forceUpdate, apkUrl)
                    }
                    
                    // Request fail करें
                    return response.newBuilder()
                        .code(426)
                        .body(ResponseBody.create(null, responseBody ?: ""))
                        .build()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        return response
    }
    
    private fun showUpdateDialog(message: String, forceUpdate: Boolean, apkUrl: String) {
        val builder = AlertDialog.Builder(context)
            .setTitle("Update Required")
            .setMessage(message)
            .setPositiveButton("Update Now") { _, _ ->
                // Open APK URL
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl))
                context.startActivity(intent)
                
                if (forceUpdate) {
                    // Force update होने पर app exit करें
                    (context as? Activity)?.finish()
                }
            }
        
        if (!forceUpdate) {
            builder.setNegativeButton("Later") { dialog, _ ->
                dialog.dismiss()
            }
        }
        
        builder.setCancelable(!forceUpdate)
        builder.show()
    }
}

// Usage in OkHttpClient
val client = OkHttpClient.Builder()
    .addInterceptor(VersionCheckInterceptor(context))
    .build()
```

### Android (Java) Example

```java
public class VersionCheckInterceptor implements Interceptor {
    private Context context;

    public VersionCheckInterceptor(Context context) {
        this.context = context;
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request request = chain.request().newBuilder()
            .addHeader("x-app-version", BuildConfig.VERSION_NAME)
            .build();

        Response response = chain.proceed(request);

        // Check for 426 status
        if (response.code() == 426) {
            try {
                String responseBody = response.body().string();
                JSONObject json = new JSONObject(responseBody);

                if (json.optBoolean("updateRequired", false)) {
                    boolean forceUpdate = json.optBoolean("forceUpdate", true);
                    JSONObject config = json.getJSONObject("config");
                    String apkUrl = config.getString("apkUrl");
                    String message = json.getString("message");

                    // Show dialog on main thread
                    new Handler(Looper.getMainLooper()).post(() -> {
                        showUpdateDialog(message, forceUpdate, apkUrl);
                    });

                    return response.newBuilder()
                        .code(426)
                        .body(ResponseBody.create(null, responseBody))
                        .build();
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }

        return response;
    }

    private void showUpdateDialog(String message, boolean forceUpdate, String apkUrl) {
        AlertDialog.Builder builder = new AlertDialog.Builder(context)
            .setTitle("Update Required")
            .setMessage(message)
            .setPositiveButton("Update Now", (dialog, which) -> {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
                context.startActivity(intent);
                if (forceUpdate && context instanceof Activity) {
                    ((Activity) context).finish();
                }
            });

        if (!forceUpdate) {
            builder.setNegativeButton("Later", (dialog, which) -> dialog.dismiss());
        }

        builder.setCancelable(!forceUpdate);
        builder.show();
    }
}
```

## Testing

### Manual Test

1. Server को restart करें
2. Mobile app में version 1.0.0 set करें
3. किसी भी API call करें (जैसे login, fetch data, etc.)
4. Server console में यह log दिखना चाहिए:
   ```
   [Version Check] Request from /api/fetch-result - Version: 1.0.0, Minimum: 2.0.0, Allowed: false
   [Version Check] Blocking version 1.0.0 - Sending update required response
   ```
5. Mobile app में update popup दिखना चाहिए

### Test Script

```bash
# Server running होना चाहिए
node test-version-check.js
```

## Important Points

1. **हर API call में `x-app-version` header भेजें** - यह header mobile app से आना चाहिए
2. **Status code 426 check करें** - यह update required का indicator है
3. **`updateRequired: true` check करें** - यह confirm करता है कि update जरूरी है
4. **`forceUpdate` field check करें** - यह बताता है कि update mandatory है या optional
5. **`config.apkUrl` use करें** - यह latest APK का URL है जो download करना है

## Troubleshooting

### Popup नहीं दिख रहा

1. **Check करें कि status code 426 handle हो रहा है या नहीं**
   ```javascript
   console.log('Response status:', response.status);
   if (response.status === 426) {
     console.log('Update required!');
   }
   ```

2. **Response JSON parse करें**
   ```javascript
   const data = await response.json();
   console.log('Update data:', data);
   ```

3. **Server logs check करें** - version check logs दिखनी चाहिए

4. **Header check करें** - mobile app में `x-app-version` header भेजा जा रहा है या नहीं

### API call block नहीं हो रही

1. **Version header check करें** - header properly भेजा जा रहा है या नहीं
2. **Server console logs check करें** - version check middleware trigger हो रहा है या नहीं
3. **Endpoint check करें** - सभी endpoints `/api/` से start होने चाहिए (except `/api/app-config`)
