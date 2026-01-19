// middleware/versionMiddleware.js
const appConfig = require('../config/appConfig');

/**
 * Middleware to check app version from request header
 * Only applies version check to mobile app requests (with x-app-version header)
 * Web UI requests (without x-app-version header) bypass this check
 * Returns HTTP 426 Upgrade Required if version doesn't match
 */
const versionCheckMiddleware = (req, res, next) => {
	// Get app version from header
	const appVersion = req.headers['x-app-version'];

	// If no version header provided, it's likely a web UI request
	// Skip version check and allow the request to proceed
	if (!appVersion) {
		return next();
	}

	// If version header exists, it's a mobile app request
	// Check if version is allowed
	const isAllowed = appConfig.isVersionAllowed(appVersion);

	if (!isAllowed) {
		return res.status(426).json({
			message: 'Please update app',
			error: `App version ${appVersion} is not supported. Minimum required: ${appConfig.getRequiredVersion()}`,
			updateRequired: true,
			config: appConfig.getAppConfig(),
		});
	}

	// Version is valid, proceed to next middleware
	next();
};

module.exports = versionCheckMiddleware;
