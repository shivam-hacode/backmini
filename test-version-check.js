// Test script to verify version check middleware
// Run: node test-version-check.js

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function testAPI(endpoint, headers = {}) {
	return new Promise((resolve, reject) => {
		const url = new URL(endpoint, BASE_URL);
		const options = {
			hostname: url.hostname,
			port: url.port || 5000,
			path: url.pathname,
			method: 'GET',
			headers: headers,
		};

		const req = http.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						body: json,
					});
				} catch (e) {
					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						body: data,
					});
				}
			});
		});

		req.on('error', (e) => {
			reject(e);
		});

		req.end();
	});
}

async function runTests() {
	console.log('🧪 Testing Version Check Middleware\n');
	console.log('='.repeat(60));

	// Test 1: Request without version header (Web UI - should pass)
	console.log('\n1️⃣  Test: Request WITHOUT x-app-version header (Web UI)');
	try {
		const result = await testAPI('/api/fetch-result');
		console.log(`   Status: ${result.statusCode}`);
		console.log(`   Response:`, JSON.stringify(result.body, null, 2));
		if (result.statusCode === 426) {
			console.log('   ❌ FAILED: Web UI request was blocked');
		} else {
			console.log('   ✅ PASSED: Web UI request bypassed version check');
		}
	} catch (error) {
		console.log('   ⚠️  Error:', error.message);
		console.log('   ℹ️  Make sure server is running on port 5000');
	}

	// Test 2: Request with old version (1.0.0) - should be blocked
	console.log('\n2️⃣  Test: Request with version 1.0.0 (OLD - should be BLOCKED)');
	try {
		const result = await testAPI('/api/fetch-result', {
			'x-app-version': '1.0.0',
		});
		console.log(`   Status: ${result.statusCode}`);
		console.log(`   Response:`, JSON.stringify(result.body, null, 2));
		if (result.statusCode === 426 && result.body.updateRequired) {
			console.log('   ✅ PASSED: Old version correctly blocked with update required');
			console.log(`   ✅ APK URL: ${result.body.config?.apkUrl || 'N/A'}`);
			console.log(`   ✅ Force Update: ${result.body.forceUpdate || 'N/A'}`);
		} else {
			console.log('   ❌ FAILED: Old version was not blocked');
		}
	} catch (error) {
		console.log('   ⚠️  Error:', error.message);
	}

	// Test 3: Request with valid version (2.0.0) - should pass
	console.log('\n3️⃣  Test: Request with version 2.0.0 (VALID - should PASS)');
	try {
		const result = await testAPI('/api/fetch-result', {
			'x-app-version': '2.0.0',
		});
		console.log(`   Status: ${result.statusCode}`);
		if (result.statusCode !== 426) {
			console.log('   ✅ PASSED: Valid version allowed through');
		} else {
			console.log('   ❌ FAILED: Valid version was blocked');
			console.log(`   Response:`, JSON.stringify(result.body, null, 2));
		}
	} catch (error) {
		console.log('   ⚠️  Error:', error.message);
	}

	// Test 4: App config endpoint (should always work)
	console.log('\n4️⃣  Test: /api/app-config endpoint (should always work)');
	try {
		const result = await testAPI('/api/app-config');
		console.log(`   Status: ${result.statusCode}`);
		console.log(`   Response:`, JSON.stringify(result.body, null, 2));
		if (result.statusCode === 200 && result.body.minimumRequiredVersion) {
			console.log('   ✅ PASSED: App config accessible without version header');
		} else {
			console.log('   ❌ FAILED: App config endpoint issue');
		}
	} catch (error) {
		console.log('   ⚠️  Error:', error.message);
	}

	console.log('\n' + '='.repeat(60));
	console.log('✅ Testing complete!\n');
}

// Run tests
runTests().catch(console.error);
