// middleware/versionMiddleware.js
const appConfig = require('../config/appConfig');

/**
 * Middleware to check app version from request header
 * Only applies version check to mobile app requests (with x-app-version header)
 * Web UI requests (without x-app-version header) bypass this check
 * Returns HTTP 426 Upgrade Required if version doesn't match
 */
const versionCheckMiddleware = (req, res, next) => {
	// Get app version from header (case-insensitive)
	const appVersion = req.headers['x-app-version'] || req.headers['X-App-Version'] || req.headers['X-APP-VERSION'];

	// If no version header provided, it's likely a web UI request
	// Skip version check and allow the request to proceed
	if (!appVersion) {
		return next();
	}

	// If version header exists, it's a mobile app request
	// Check if version is allowed
	const isAllowed = appConfig.isVersionAllowed(appVersion);
	const minVersion = appConfig.getRequiredVersion();
	const appConfigData = appConfig.getAppConfig();

	// Debug logging
	console.log(`[Version Check] Request from ${req.path} - Version: ${appVersion}, Minimum: ${minVersion}, Allowed: ${isAllowed}`);

	if (!isAllowed) {
		const response = {
			status: 'update_required',
			message: 'Please update your app to continue',
			error: `App version ${appVersion} is not supported. Minimum required: ${minVersion}`,
			updateRequired: true,
			forceUpdate: appConfigData.forceUpdate,
			config: appConfigData,
		};
		
		console.log(`[Version Check] Blocking version ${appVersion} - Sending update required response`);
		
		return res.status(426).json(response);
	}

	// Version is valid, proceed to next middleware
	next();
};

module.exports = versionCheckMiddleware;
