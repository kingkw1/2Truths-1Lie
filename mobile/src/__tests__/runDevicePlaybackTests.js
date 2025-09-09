#!/usr/bin/env node

/**
 * Device Playback Testing Runner
 * Orchestrates comprehensive device testing for playback UI and network resilience
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  devices: [
    'IPHONE_13',
    'ANDROID_PIXEL', 
    'LOW_END_ANDROID',
    'TABLET_IPAD',
    'FOLDABLE_SAMSUNG'
  ],
  networkStates: [
    'online',
    'offline', 
    'slow',
    'unstable',
    'limited'
  ],
  testSuites: [
    'DevicePlaybackUITesting',
    'NetworkResilienceTesting'
  ],
  scenarios: [
    'NORMAL',
    'LOAD_ERROR',
    'PLAYBACK_ERROR',
    'NETWORK_INTERRUPTION',
    'PLAYBACK_INTERRUPTION'
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubHeader(message) {
  log('\n' + '-'.repeat(40), 'blue');
  log(message, 'blue');
  log('-'.repeat(40), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    device: null,
    network: null,
    suite: null,
    scenario: null,
    verbose: false,
    coverage: false,
    listDevices: false,
    listNetworks: false,
    listSuites: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--device':
        options.device = args[++i];
        break;
      case '--network':
        options.network = args[++i];
        break;
      case '--suite':
        options.suite = args[++i];
        break;
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--list-devices':
        options.listDevices = true;
        break;
      case '--list-networks':
        options.listNetworks = true;
        break;
      case '--list-suites':
        options.listSuites = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        logWarning(`Unknown option: ${arg}`);
    }
  }

  return options;
}

// Display help information
function showHelp() {
  logHeader('Device Playback Testing Runner');
  
  log('\nUsage:', 'bright');
  log('  node runDevicePlaybackTests.js [options]');
  
  log('\nOptions:', 'bright');
  log('  --device <device>      Run tests for specific device type');
  log('  --network <state>      Run tests for specific network state');
  log('  --suite <suite>        Run specific test suite');
  log('  --scenario <scenario>  Run specific test scenario');
  log('  --verbose, -v          Enable verbose output');
  log('  --coverage, -c         Generate coverage report');
  log('  --list-devices         List available device types');
  log('  --list-networks        List available network states');
  log('  --list-suites          List available test suites');
  log('  --help, -h             Show this help message');
  
  log('\nExamples:', 'bright');
  log('  node runDevicePlaybackTests.js --device IPHONE_13');
  log('  node runDevicePlaybackTests.js --network offline');
  log('  node runDevicePlaybackTests.js --suite DevicePlaybackUITesting');
  log('  node runDevicePlaybackTests.js --device LOW_END_ANDROID --network slow');
  log('  node runDevicePlaybackTests.js --coverage');
}

// List available options
function listOptions(options) {
  if (options.listDevices) {
    logHeader('Available Device Types');
    TEST_CONFIG.devices.forEach(device => {
      log(`  ${device}`, 'green');
    });
  }
  
  if (options.listNetworks) {
    logHeader('Available Network States');
    TEST_CONFIG.networkStates.forEach(state => {
      log(`  ${state}`, 'green');
    });
  }
  
  if (options.listSuites) {
    logHeader('Available Test Suites');
    TEST_CONFIG.testSuites.forEach(suite => {
      log(`  ${suite}`, 'green');
    });
  }
}

// Validate options
function validateOptions(options) {
  const errors = [];
  
  if (options.device && !TEST_CONFIG.devices.includes(options.device)) {
    errors.push(`Invalid device: ${options.device}`);
  }
  
  if (options.network && !TEST_CONFIG.networkStates.includes(options.network)) {
    errors.push(`Invalid network state: ${options.network}`);
  }
  
  if (options.suite && !TEST_CONFIG.testSuites.includes(options.suite)) {
    errors.push(`Invalid test suite: ${options.suite}`);
  }
  
  if (options.scenario && !TEST_CONFIG.scenarios.includes(options.scenario)) {
    errors.push(`Invalid scenario: ${options.scenario}`);
  }
  
  return errors;
}

// Run Jest tests with specific configuration
function runJestTests(testPattern, environment = {}, options = {}) {
  const jestArgs = [
    '--testPathPattern=' + testPattern,
    '--testTimeout=30000',
    '--maxWorkers=1', // Prevent race conditions in device testing
  ];
  
  if (options.verbose) {
    jestArgs.push('--verbose');
  }
  
  if (options.coverage) {
    jestArgs.push('--coverage');
    jestArgs.push('--coverageDirectory=coverage/device-tests');
  }
  
  // Set environment variables
  const env = {
    ...process.env,
    ...environment,
    NODE_ENV: 'test'
  };
  
  try {
    const command = `npx jest ${jestArgs.join(' ')}`;
    logInfo(`Running: ${command}`);
    
    if (options.verbose) {
      logInfo('Environment variables:');
      Object.keys(environment).forEach(key => {
        log(`  ${key}=${environment[key]}`, 'cyan');
      });
    }
    
    execSync(command, {
      stdio: 'inherit',
      env,
      cwd: process.cwd()
    });
    
    return true;
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    return false;
  }
}

// Run device-specific tests
function runDeviceTests(device, options) {
  logSubHeader(`Testing Device: ${device}`);
  
  const environment = {
    __DEVICE_TYPE__: device
  };
  
  const testPattern = 'DevicePlaybackUITesting';
  return runJestTests(testPattern, environment, options);
}

// Run network-specific tests
function runNetworkTests(networkState, options) {
  logSubHeader(`Testing Network State: ${networkState}`);
  
  const environment = {
    __NETWORK_STATE__: networkState
  };
  
  const testPattern = 'NetworkResilienceTesting';
  return runJestTests(testPattern, environment, options);
}

// Run scenario-specific tests
function runScenarioTests(scenario, options) {
  logSubHeader(`Testing Scenario: ${scenario}`);
  
  const environment = {
    __PLAYBACK_SCENARIO__: scenario,
    __NETWORK_SCENARIO__: scenario
  };
  
  const testPattern = options.suite || '(DevicePlaybackUITesting|NetworkResilienceTesting)';
  return runJestTests(testPattern, environment, options);
}

// Run comprehensive test matrix
function runTestMatrix(options) {
  logHeader('Running Comprehensive Device Testing Matrix');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  const devices = options.device ? [options.device] : TEST_CONFIG.devices;
  const networks = options.network ? [options.network] : TEST_CONFIG.networkStates;
  const suites = options.suite ? [options.suite] : TEST_CONFIG.testSuites;
  
  for (const device of devices) {
    for (const network of networks) {
      for (const suite of suites) {
        results.total++;
        
        logSubHeader(`Testing: ${device} + ${network} + ${suite}`);
        
        const environment = {
          __DEVICE_TYPE__: device,
          __NETWORK_STATE__: network
        };
        
        const success = runJestTests(suite, environment, options);
        
        if (success) {
          results.passed++;
          logSuccess(`Passed: ${device} + ${network} + ${suite}`);
        } else {
          results.failed++;
          logError(`Failed: ${device} + ${network} + ${suite}`);
        }
        
        results.details.push({
          device,
          network,
          suite,
          success
        });
      }
    }
  }
  
  return results;
}

// Generate test report
function generateReport(results) {
  logHeader('Test Results Summary');
  
  log(`Total Tests: ${results.total}`, 'bright');
  logSuccess(`Passed: ${results.passed}`);
  logError(`Failed: ${results.failed}`);
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, successRate >= 90 ? 'green' : 'yellow');
  
  if (results.failed > 0) {
    logSubHeader('Failed Tests');
    results.details
      .filter(test => !test.success)
      .forEach(test => {
        logError(`${test.device} + ${test.network} + ${test.suite}`);
      });
  }
  
  // Generate detailed report file
  const reportPath = path.join(process.cwd(), 'device-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: parseFloat(successRate)
    },
    details: results.details
  }, null, 2));
  
  logInfo(`Detailed report saved to: ${reportPath}`);
}

// Main execution function
function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  if (options.listDevices || options.listNetworks || options.listSuites) {
    listOptions(options);
    return;
  }
  
  const validationErrors = validateOptions(options);
  if (validationErrors.length > 0) {
    logError('Validation errors:');
    validationErrors.forEach(error => logError(`  ${error}`));
    process.exit(1);
  }
  
  logHeader('Device Playback Testing Runner');
  logInfo(`Starting tests at ${new Date().toLocaleString()}`);
  
  let results;
  
  if (options.device && !options.network && !options.suite) {
    // Run device-specific tests
    const success = runDeviceTests(options.device, options);
    results = {
      total: 1,
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      details: [{ device: options.device, success }]
    };
  } else if (options.network && !options.device && !options.suite) {
    // Run network-specific tests
    const success = runNetworkTests(options.network, options);
    results = {
      total: 1,
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      details: [{ network: options.network, success }]
    };
  } else if (options.scenario) {
    // Run scenario-specific tests
    const success = runScenarioTests(options.scenario, options);
    results = {
      total: 1,
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      details: [{ scenario: options.scenario, success }]
    };
  } else {
    // Run comprehensive test matrix
    results = runTestMatrix(options);
  }
  
  generateReport(results);
  
  if (results.failed > 0) {
    process.exit(1);
  }
  
  logSuccess('All tests completed successfully!');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runDeviceTests,
  runNetworkTests,
  runScenarioTests,
  runTestMatrix,
  generateReport
};