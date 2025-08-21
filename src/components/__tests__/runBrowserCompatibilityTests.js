#!/usr/bin/env node

/**
 * Browser Compatibility Test Runner
 * Runs media capture tests across different browser environments
 * Usage: node runBrowserCompatibilityTests.js [--browser=chrome|firefox|safari|all]
 */

const { execSync } = require('child_process');
const path = require('path');

// Browser configurations for testing
const browserConfigs = {
  chrome: {
    name: 'Chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    testEnv: {
      BROWSER_NAME: 'chrome',
      USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  },
  firefox: {
    name: 'Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    testEnv: {
      BROWSER_NAME: 'firefox',
      USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    }
  },
  safari: {
    name: 'Safari',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    testEnv: {
      BROWSER_NAME: 'safari',
      USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    }
  },
  edge: {
    name: 'Edge',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    testEnv: {
      BROWSER_NAME: 'edge',
      USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    }
  },
  mobileSafari: {
    name: 'Mobile Safari',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    testEnv: {
      BROWSER_NAME: 'mobileSafari',
      USER_AGENT: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    }
  },
  androidChrome: {
    name: 'Android Chrome',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    testEnv: {
      BROWSER_NAME: 'androidChrome',
      USER_AGENT: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    }
  }
};

// Test files to run
const testFiles = [
  'MediaCaptureBrowserCompatibility.test.tsx',
  'MediaCaptureAccessibility.test.tsx',
  'MediaAPICompatibility.test.tsx',
];

// Parse command line arguments
const args = process.argv.slice(2);
const browserArg = args.find(arg => arg.startsWith('--browser='));
const targetBrowser = browserArg ? browserArg.split('=')[1] : 'all';
const verbose = args.includes('--verbose');
const coverage = args.includes('--coverage');

// Helper functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function runTestsForBrowser(browserName, config) {
  log(`Running tests for ${config.name}...`);
  
  try {
    const testCommand = [
      'npm test',
      '--',
      ...testFiles.map(file => `src/components/__tests__/${file}`),
      '--testNamePattern=".*"',
      '--verbose=' + (verbose ? 'true' : 'false'),
      coverage ? '--coverage' : '',
      '--silent=false'
    ].filter(Boolean).join(' ');

    // Set environment variables for the test
    const env = {
      ...process.env,
      ...config.testEnv,
      NODE_ENV: 'test',
      CI: 'true'
    };

    log(`Executing: ${testCommand}`);
    
    const result = execSync(testCommand, {
      env,
      stdio: verbose ? 'inherit' : 'pipe',
      encoding: 'utf8',
      cwd: process.cwd()
    });

    if (verbose && result) {
      console.log(result);
    }

    log(`Tests completed successfully for ${config.name}`, 'success');
    return { browser: browserName, success: true, output: result };
    
  } catch (error) {
    log(`Tests failed for ${config.name}: ${error.message}`, 'error');
    if (verbose && error.stdout) {
      console.log('STDOUT:', error.stdout);
    }
    if (verbose && error.stderr) {
      console.log('STDERR:', error.stderr);
    }
    return { browser: browserName, success: false, error: error.message };
  }
}

function generateReport(results) {
  log('\n📊 Test Results Summary');
  console.log('=' .repeat(50));
  
  let totalTests = 0;
  let passedTests = 0;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const browserName = browserConfigs[result.browser]?.name || result.browser;
    console.log(`${status} ${browserName}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    totalTests++;
    if (result.success) passedTests++;
  });
  
  console.log('=' .repeat(50));
  console.log(`Total: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    log('🎉 All browser compatibility tests passed!', 'success');
  } else {
    log(`⚠️  ${totalTests - passedTests} browser(s) failed tests`, 'error');
  }
  
  return passedTests === totalTests;
}

function showUsage() {
  console.log(`
Usage: node runBrowserCompatibilityTests.js [options]

Options:
  --browser=<name>    Run tests for specific browser (chrome, firefox, safari, edge, mobileSafari, androidChrome, all)
  --verbose           Show detailed test output
  --coverage          Generate test coverage report
  --help              Show this help message

Examples:
  node runBrowserCompatibilityTests.js --browser=chrome --verbose
  node runBrowserCompatibilityTests.js --browser=all --coverage
  node runBrowserCompatibilityTests.js --browser=safari
`);
}

// Main execution
async function main() {
  if (args.includes('--help')) {
    showUsage();
    return;
  }

  log('🚀 Starting Browser Compatibility Tests');
  log(`Target: ${targetBrowser}`);
  log(`Test files: ${testFiles.join(', ')}`);
  
  const results = [];
  
  if (targetBrowser === 'all') {
    // Run tests for all browsers
    for (const [browserName, config] of Object.entries(browserConfigs)) {
      const result = runTestsForBrowser(browserName, config);
      results.push(result);
      
      // Add delay between browser tests to avoid resource conflicts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else if (browserConfigs[targetBrowser]) {
    // Run tests for specific browser
    const result = runTestsForBrowser(targetBrowser, browserConfigs[targetBrowser]);
    results.push(result);
  } else {
    log(`Unknown browser: ${targetBrowser}`, 'error');
    log(`Available browsers: ${Object.keys(browserConfigs).join(', ')}`);
    process.exit(1);
  }
  
  // Generate and display report
  const allPassed = generateReport(results);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at ${promise}: ${reason}`, 'error');
  process.exit(1);
});

// Run the main function
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});