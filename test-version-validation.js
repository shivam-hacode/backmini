/**
 * Version Validation Test Script
 * Tests strict version validation middleware
 * 
 * Usage: node test-version-validation.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(endpoint, headers = {}) {
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
            body: json,
            rawBody: data,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
            rawBody: data,
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTest(testName, endpoint, headers, expectedStatus, expectedMessage = null) {
  try {
    log(`\n🧪 ${testName}`, 'cyan');
    log(`   Endpoint: ${endpoint}`, 'blue');
    log(`   Headers: ${JSON.stringify(headers)}`, 'blue');

    const result = await makeRequest(endpoint, headers);

    // Check status code
    if (result.statusCode === expectedStatus) {
      log(`   ✅ Status Code: ${result.statusCode} (Expected: ${expectedStatus})`, 'green');
    } else {
      log(`   ❌ Status Code: ${result.statusCode} (Expected: ${expectedStatus})`, 'red');
      return false;
    }

    // Check message if provided
    if (expectedMessage && result.body) {
      if (result.body.message && result.body.message.includes(expectedMessage)) {
        log(`   ✅ Message: ${result.body.message}`, 'green');
      } else {
        log(`   ⚠️  Message: ${JSON.stringify(result.body.message)}`, 'yellow');
      }
    }

    // Check response format
    if (result.statusCode === 426) {
      if (result.body.success === false && result.body.message) {
        log(`   ✅ Response format correct`, 'green');
      } else {
        log(`   ❌ Response format incorrect: ${JSON.stringify(result.body)}`, 'red');
        return false;
      }
    }

    log(`   Response: ${JSON.stringify(result.body, null, 2)}`, 'blue');
    return true;
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    log(`   ℹ️  Make sure server is running on port 5000`, 'yellow');
    return false;
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🚀 Version Validation Test Suite', 'cyan');
  log('='.repeat(70), 'cyan');

  const results = [];

  // Test 1: Valid version (2.0.0)
  results.push(
    await runTest(
      'Test 1: Valid Version (2.0.0)',
      '/api/fetch-result',
      { 'x-app-version': '2.0.0' },
      200 // or whatever your endpoint returns
    )
  );

  // Test 2: Higher version (2.0.10)
  results.push(
    await runTest(
      'Test 2: Higher Version (2.0.10)',
      '/api/fetch-result',
      { 'x-app-version': '2.0.10' },
      200
    )
  );

  // Test 3: Semantic version higher (2.0.10 > 2.0.2)
  results.push(
    await runTest(
      'Test 3: Semantic Version Higher (2.0.10)',
      '/api/fetch-result',
      { 'x-app-version': '2.0.10' },
      200
    )
  );

  // Test 4: Lower version (1.9.9) - should be blocked
  results.push(
    await runTest(
      'Test 4: Lower Version (1.9.9) - Should Be Blocked',
      '/api/fetch-result',
      { 'x-app-version': '1.9.9' },
      426,
      '2.0.0 or above'
    )
  );

  // Test 5: Missing header - should be blocked
  results.push(
    await runTest(
      'Test 5: Missing Header - Should Be Blocked',
      '/api/fetch-result',
      {},
      426,
      '2.0.0 or above'
    )
  );

  // Test 6: Invalid format - should be blocked
  results.push(
    await runTest(
      'Test 6: Invalid Format - Should Be Blocked',
      '/api/fetch-result',
      { 'x-app-version': 'invalid' },
      426,
      '2.0.0 or above'
    )
  );

  // Test 7: Edge case - exactly 2.0.0 (should pass)
  results.push(
    await runTest(
      'Test 7: Edge Case - Exactly 2.0.0',
      '/api/fetch-result',
      { 'x-app-version': '2.0.0' },
      200
    )
  );

  // Test 8: Case insensitive header
  results.push(
    await runTest(
      'Test 8: Case Insensitive Header (X-App-Version)',
      '/api/fetch-result',
      { 'X-App-Version': '2.0.0' },
      200
    )
  );

  // Test 9: App config endpoint (should work without header)
  results.push(
    await runTest(
      'Test 9: App Config Endpoint (Excluded from version check)',
      '/api/app-config',
      {},
      200
    )
  );

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 Test Results Summary', 'cyan');
  log('='.repeat(70), 'cyan');

  const passed = results.filter((r) => r).length;
  const failed = results.filter((r) => !r).length;
  const total = results.length;

  log(`\nTotal Tests: ${total}`, 'blue');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  if (failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the output above.', 'yellow');
  }

  log('\n' + '='.repeat(70) + '\n', 'cyan');
}

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Test suite error: ${error.message}`, 'red');
  process.exit(1);
});
