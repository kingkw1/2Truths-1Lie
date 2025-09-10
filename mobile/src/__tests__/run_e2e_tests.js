#!/usr/bin/env node
/**
 * Mobile End-to-End Test Runner
 * Executes comprehensive mobile end-to-end tests covering the complete user workflow
 * from video capture through upload, challenge creation, and playback
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
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

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function runCommand(command, args, description, options = {}) {
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(60));
    console.log(colorize(`Running: ${description}`, 'cyan'));
    console.log(colorize(`Command: ${command} ${args.join(' ')}`, 'blue'));
    console.log('='.repeat(60));

    const startTime = Date.now();
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    });

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      console.log(colorize(`⏰ TIMEOUT: ${description} took longer than 5 minutes`, 'yellow'));
      resolve(false);
    }, 300000); // 5 minutes

    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        console.log(colorize(`✅ SUCCESS: ${description} (${duration}s)`, 'green'));
        resolve(true);
      } else {
        console.log(colorize(`❌ FAILED: ${description} (${duration}s) - Exit code: ${code}`, 'red'));
        resolve(false);
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(colorize(`💥 ERROR: ${description} failed with exception: ${error.message}`, 'red'));
      resolve(false);
    });
  });
}

async function checkDependencies() {
  console.log(colorize('🔍 Checking dependencies...', 'cyan'));
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.log(colorize('❌ package.json not found', 'red'));
    return false;
  }

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log(colorize('⚠️  node_modules not found, installing dependencies...', 'yellow'));
    return await runCommand('npm', ['install'], 'Installing dependencies');
  }

  console.log(colorize('✅ Dependencies check passed', 'green'));
  return true;
}

async function main() {
  console.log(colorize('🚀 Starting Mobile End-to-End Test Suite', 'bright'));
  console.log(colorize('Testing complete mobile workflow from video capture to challenge playback', 'cyan'));

  const testResults = [];

  // Check dependencies
  const depsSuccess = await checkDependencies();
  testResults.push(['Dependencies Check', depsSuccess]);

  if (!depsSuccess) {
    console.log(colorize('❌ Cannot proceed without dependencies', 'red'));
    return 1;
  }

  // Core E2E Tests
  console.log(colorize('\n📱 Running Core Mobile E2E Tests', 'magenta'));

  // Complete E2E Workflow Tests
  const completeE2ESuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=CompleteE2EWorkflow.test.tsx', '--verbose', '--no-cache'],
    'Complete E2E Workflow Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Complete E2E Workflow', completeE2ESuccess]);

  // Existing End-to-End Integration Tests
  const existingE2ESuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=EndToEndIntegration.test.tsx', '--verbose', '--no-cache'],
    'Existing E2E Integration Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Existing E2E Integration', existingE2ESuccess]);

  // Component Integration Tests
  console.log(colorize('\n🧩 Running Component Integration Tests', 'magenta'));

  // Mobile Camera Integration Tests
  const cameraIntegrationSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=MobileCameraIntegration.test.tsx', '--verbose', '--no-cache'],
    'Mobile Camera Integration Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Mobile Camera Integration', cameraIntegrationSuccess]);

  // Upload Integration Tests
  const uploadIntegrationSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=UploadIntegrationComprehensive.test.tsx', '--verbose', '--no-cache'],
    'Upload Integration Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Upload Integration', uploadIntegrationSuccess]);

  // Mobile Redux Integration Tests
  const reduxIntegrationSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=MobileReduxIntegration.test.tsx', '--verbose', '--no-cache'],
    'Mobile Redux Integration Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Mobile Redux Integration', reduxIntegrationSuccess]);

  // Cross-Device Tests
  console.log(colorize('\n📲 Running Cross-Device Tests', 'magenta'));

  // Cross-Device Media Accessibility Tests
  const crossDeviceSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=CrossDeviceMediaAccessibility.test.tsx', '--verbose', '--no-cache'],
    'Cross-Device Media Accessibility Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Cross-Device Accessibility', crossDeviceSuccess]);

  // Device-Specific Tests
  console.log(colorize('\n🔧 Running Device-Specific Tests', 'magenta'));

  // Device Camera Recording Flow Tests
  const deviceCameraSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=DeviceCameraRecordingFlow.test.tsx', '--verbose', '--no-cache'],
    'Device Camera Recording Flow Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Device Camera Recording', deviceCameraSuccess]);

  // Device End-to-End Camera Flow Tests
  const deviceE2ECameraSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=DeviceEndToEndCameraFlow.test.tsx', '--verbose', '--no-cache'],
    'Device End-to-End Camera Flow Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Device E2E Camera Flow', deviceE2ECameraSuccess]);

  // Error Handling Tests
  console.log(colorize('\n⚠️  Running Error Handling Tests', 'magenta'));

  // Error Handling Tests
  const errorHandlingSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=ErrorHandling.test.tsx', '--verbose', '--no-cache'],
    'Error Handling Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Error Handling', errorHandlingSuccess]);

  // Upload Error Handling Tests
  const uploadErrorSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=UploadErrorHandlingComprehensive.test.ts', '--verbose', '--no-cache'],
    'Upload Error Handling Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Upload Error Handling', uploadErrorSuccess]);

  // Performance Tests
  console.log(colorize('\n⚡ Running Performance Tests', 'magenta'));

  // Mobile Media Capture Scenarios Tests
  const mediaCaptureSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=MobileMediaCaptureScenarios.test.tsx', '--verbose', '--no-cache'],
    'Mobile Media Capture Scenarios Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Mobile Media Capture Scenarios', mediaCaptureSuccess]);

  // Permission Flow Tests
  const permissionFlowSuccess = await runCommand(
    'npm',
    ['test', '--', '--testPathPattern=PermissionFlows.test.tsx', '--verbose', '--no-cache'],
    'Permission Flow Tests',
    { env: { CI: 'true' } }
  );
  testResults.push(['Permission Flows', permissionFlowSuccess]);

  // Generate Test Coverage Report
  console.log(colorize('\n📊 Generating Test Coverage Report', 'magenta'));

  const coverageSuccess = await runCommand(
    'npm',
    ['run', 'test:coverage', '--', '--testPathPattern=.*E2E.*', '--verbose'],
    'Test Coverage Report Generation',
    { env: { CI: 'true' } }
  );
  testResults.push(['Test Coverage Report', coverageSuccess]);

  // Generate Test Results Summary
  console.log(colorize('\n📊 Test Results Summary', 'bright'));
  console.log('='.repeat(80));

  const totalTests = testResults.length;
  const passedTests = testResults.filter(([, success]) => success).length;
  const failedTests = totalTests - passedTests;

  testResults.forEach(([testName, success]) => {
    const status = success ? colorize('✅ PASS', 'green') : colorize('❌ FAIL', 'red');
    console.log(`${status.padEnd(20)} ${testName}`);
  });

  console.log('='.repeat(80));
  console.log(colorize(`Total Tests: ${totalTests}`, 'cyan'));
  console.log(colorize(`Passed: ${passedTests}`, 'green'));
  console.log(colorize(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green'));
  console.log(colorize(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 'cyan'));

  // Final status
  if (failedTests === 0) {
    console.log(colorize('\n🎉 ALL TESTS PASSED! Mobile end-to-end workflow is working correctly.', 'green'));
    return 0;
  } else {
    console.log(colorize(`\n⚠️  ${failedTests} TEST(S) FAILED. Please review the failures above.`, 'yellow'));
    return 1;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(colorize('\n🛑 Test execution interrupted by user', 'yellow'));
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n🛑 Test execution terminated', 'yellow'));
  process.exit(1);
});

// Run the main function
main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(colorize(`💥 Unexpected error: ${error.message}`, 'red'));
    console.error(error.stack);
    process.exit(1);
  });