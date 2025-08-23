#!/usr/bin/env node

/**
 * Device Camera Testing Runner
 * 
 * This script runs comprehensive device-specific tests for camera recording,
 * playback, and re-recording flows. It simulates different device scenarios
 * and validates the mobile camera integration works correctly across platforms.
 */

const { execSync } = require('child_process');
const path = require('path');

// Test configurations for different device scenarios
const deviceScenarios = [
  {
    name: 'iPhone 13 Pro',
    scenario: 'IPHONE_13',
    description: 'High-end iOS device with excellent camera and storage',
  },
  {
    name: 'Android Pixel 6',
    scenario: 'ANDROID_PIXEL',
    description: 'Modern Android device with good performance',
  },
  {
    name: 'Low-end Android',
    scenario: 'LOW_END_ANDROID',
    description: 'Budget Android device with limited resources',
  },
  {
    name: 'iPad Pro',
    scenario: 'TABLET_IPAD',
    description: 'Tablet form factor with large screen',
  },
];

// Test suites to run
const testSuites = [
  {
    file: 'DeviceCameraRecordingFlow.test.tsx',
    description: 'Camera recording functionality and error handling',
  },
  {
    file: 'DevicePlaybackReRecordingFlow.test.tsx',
    description: 'Video playback and re-recording workflows',
  },
  {
    file: 'DeviceEndToEndCameraFlow.test.tsx',
    description: 'Complete end-to-end device workflows',
  },
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTestSuite(testFile, deviceScenario = null) {
  const testPath = path.join(__dirname, testFile);
  
  try {
    log(`\n📱 Running ${testFile}${deviceScenario ? ` (${deviceScenario.name})` : ''}`, 'cyan');
    
    const env = { ...process.env };
    if (deviceScenario) {
      env.DEVICE_SCENARIO = deviceScenario.scenario;
    }
    
    const command = `npm test -- --testPathPattern="${testFile}" --verbose`;
    
    execSync(command, {
      stdio: 'inherit',
      env,
      cwd: path.join(__dirname, '../../..'),
    });
    
    log(`✅ ${testFile} passed`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${testFile} failed`, 'red');
    console.error(error.message);
    return false;
  }
}

function runAllTests() {
  log('🚀 Starting Device Camera Testing Suite', 'bright');
  log('=' .repeat(60), 'blue');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };
  
  // Run basic tests first
  log('\n📋 Running Basic Test Suites', 'yellow');
  
  for (const testSuite of testSuites) {
    results.total++;
    log(`\n🔍 ${testSuite.description}`, 'magenta');
    
    if (runTestSuite(testSuite.file)) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Run device-specific tests
  log('\n📱 Running Device-Specific Tests', 'yellow');
  
  for (const device of deviceScenarios) {
    log(`\n🔧 Testing on ${device.name}`, 'magenta');
    log(`   ${device.description}`, 'reset');
    
    for (const testSuite of testSuites) {
      results.total++;
      
      if (runTestSuite(testSuite.file, device)) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  }
  
  // Print summary
  log('\n' + '=' .repeat(60), 'blue');
  log('📊 Test Results Summary', 'bright');
  log('=' .repeat(60), 'blue');
  
  log(`Total Tests: ${results.total}`, 'cyan');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
      results.failed === 0 ? 'green' : 'yellow');
  
  if (results.failed === 0) {
    log('\n🎉 All device camera tests passed!', 'green');
    log('✅ Mobile camera integration is working correctly across all tested devices.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.', 'red');
    process.exit(1);
  }
}

function runSpecificDevice(deviceName) {
  const device = deviceScenarios.find(d => 
    d.name.toLowerCase().includes(deviceName.toLowerCase()) ||
    d.scenario.toLowerCase().includes(deviceName.toLowerCase())
  );
  
  if (!device) {
    log(`❌ Device "${deviceName}" not found.`, 'red');
    log('Available devices:', 'yellow');
    deviceScenarios.forEach(d => log(`  - ${d.name} (${d.scenario})`, 'cyan'));
    process.exit(1);
  }
  
  log(`🔧 Running tests for ${device.name}`, 'cyan');
  log(`   ${device.description}`, 'reset');
  
  let allPassed = true;
  
  for (const testSuite of testSuites) {
    if (!runTestSuite(testSuite.file, device)) {
      allPassed = false;
    }
  }
  
  if (allPassed) {
    log(`\n✅ All tests passed for ${device.name}`, 'green');
  } else {
    log(`\n❌ Some tests failed for ${device.name}`, 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('📱 Device Camera Testing Runner', 'bright');
  log('=' .repeat(40), 'blue');
  log('\nUsage:', 'yellow');
  log('  node runDeviceTests.js [options]', 'cyan');
  log('\nOptions:', 'yellow');
  log('  --device <name>    Run tests for specific device', 'cyan');
  log('  --list-devices     Show available devices', 'cyan');
  log('  --help             Show this help message', 'cyan');
  log('\nExamples:', 'yellow');
  log('  node runDeviceTests.js', 'cyan');
  log('  node runDeviceTests.js --device iphone', 'cyan');
  log('  node runDeviceTests.js --device android', 'cyan');
  log('  node runDeviceTests.js --device low-end', 'cyan');
}

function listDevices() {
  log('📱 Available Device Scenarios', 'bright');
  log('=' .repeat(40), 'blue');
  
  deviceScenarios.forEach(device => {
    log(`\n🔧 ${device.name} (${device.scenario})`, 'cyan');
    log(`   ${device.description}`, 'reset');
  });
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  showHelp();
} else if (args.includes('--list-devices')) {
  listDevices();
} else if (args.includes('--device')) {
  const deviceIndex = args.indexOf('--device');
  const deviceName = args[deviceIndex + 1];
  
  if (!deviceName) {
    log('❌ Please specify a device name after --device', 'red');
    process.exit(1);
  }
  
  runSpecificDevice(deviceName);
} else {
  runAllTests();
}