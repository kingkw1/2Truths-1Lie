#!/usr/bin/env node
/**
 * Comprehensive Mobile Upload Test Runner
 * Executes all mobile upload-related tests and generates reports
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class UploadTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        successRate: 0
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, description, options = {}) {
    this.log(`Running: ${description}`, 'info');
    this.log(`Command: ${command}`, 'info');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      try {
        const result = execSync(command, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: options.timeout || 300000, // 5 minutes default
          ...options
        });
        
        const duration = Date.now() - startTime;
        this.log(`Completed in ${duration}ms`, 'success');
        
        resolve({
          success: true,
          output: result,
          duration,
          error: null
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        this.log(`Failed after ${duration}ms: ${error.message}`, 'error');
        
        resolve({
          success: false,
          output: error.stdout || '',
          duration,
          error: error.message
        });
      }
    });
  }

  async runTest(testConfig) {
    const { name, command, file, type = 'unit' } = testConfig;
    
    console.log('\n' + '='.repeat(80));
    this.log(`Starting: ${name}`, 'info');
    console.log('='.repeat(80));
    
    const result = await this.runCommand(command, name);
    
    this.results.tests[name] = {
      ...result,
      file,
      type,
      name
    };
    
    this.results.summary.total++;
    if (result.success) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
    
    return result.success;
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Mobile Upload Test Suite', 'info');
    
    // Define test configurations
    const testConfigs = [
      // Core Upload Service Tests
      {
        name: 'Upload Service Core Tests',
        command: 'npm test -- src/services/__tests__/uploadService.test.ts --watchAll=false --verbose',
        file: 'uploadService.test.ts',
        type: 'unit'
      },
      
      // Validation Tests
      {
        name: 'Upload Service Validation Tests',
        command: 'npm test -- src/services/__tests__/uploadServiceValidation.test.ts --watchAll=false --verbose',
        file: 'uploadServiceValidation.test.ts',
        type: 'unit'
      },
      
      // Hook Tests
      {
        name: 'Upload Manager Hook Tests',
        command: 'npm test -- src/hooks/__tests__/useUploadManager.test.ts --watchAll=false --verbose',
        file: 'useUploadManager.test.ts',
        type: 'unit'
      },
      
      // Component Tests
      {
        name: 'Enhanced Upload UI Tests',
        command: 'npm test -- src/components/__tests__/EnhancedUploadUI.test.tsx --watchAll=false --verbose',
        file: 'EnhancedUploadUI.test.tsx',
        type: 'component'
      },
      
      // Integration Tests
      {
        name: 'Upload Integration Comprehensive Tests',
        command: 'npm test -- src/__tests__/UploadIntegrationComprehensive.test.tsx --watchAll=false --verbose',
        file: 'UploadIntegrationComprehensive.test.tsx',
        type: 'integration'
      },
      
      // Error Handling Tests
      {
        name: 'Upload Error Handling Comprehensive Tests',
        command: 'npm test -- src/__tests__/UploadErrorHandlingComprehensive.test.ts --watchAll=false --verbose',
        file: 'UploadErrorHandlingComprehensive.test.ts',
        type: 'integration'
      },
      
      // Cross-Device Tests
      {
        name: 'Cross-Device Media Integration Tests',
        command: 'npm test -- src/__tests__/CrossDeviceMediaIntegration.test.ts --watchAll=false --verbose',
        file: 'CrossDeviceMediaIntegration.test.ts',
        type: 'integration'
      },
      
      // Mobile Camera Integration
      {
        name: 'Mobile Camera Integration Tests',
        command: 'npm test -- src/__tests__/MobileCameraIntegration.test.tsx --watchAll=false --verbose',
        file: 'MobileCameraIntegration.test.tsx',
        type: 'integration'
      }
    ];
    
    // Run all tests
    let allPassed = true;
    for (const config of testConfigs) {
      const success = await this.runTest(config);
      if (!success) {
        allPassed = false;
      }
    }
    
    // Generate coverage report
    await this.generateCoverageReport();
    
    // Generate performance report
    await this.runPerformanceTests();
    
    // Generate final report
    this.generateSummaryReport();
    
    return allPassed;
  }

  async generateCoverageReport() {
    console.log('\n' + '='.repeat(80));
    this.log('📊 Generating Coverage Report', 'info');
    console.log('='.repeat(80));
    
    const coverageCommand = `npm test -- --coverage --watchAll=false --collectCoverageFrom="src/services/uploadService.ts" --collectCoverageFrom="src/hooks/useUploadManager.ts" --collectCoverageFrom="src/components/EnhancedUploadUI.tsx" --coverageReporters=html --coverageReporters=text-summary`;
    
    const result = await this.runCommand(coverageCommand, 'Coverage Report Generation');
    
    this.results.coverage = {
      success: result.success,
      output: result.output,
      duration: result.duration
    };
    
    if (result.success) {
      this.log('Coverage report generated in coverage/ directory', 'success');
    } else {
      this.log('Failed to generate coverage report', 'error');
    }
  }

  async runPerformanceTests() {
    console.log('\n' + '='.repeat(80));
    this.log('⚡ Running Performance Tests', 'info');
    console.log('='.repeat(80));
    
    // Run performance-specific tests
    const performanceTests = [
      {
        name: 'Large File Upload Performance',
        command: 'npm test -- src/__tests__/UploadIntegrationComprehensive.test.tsx --testNamePattern="large file uploads" --watchAll=false'
      },
      {
        name: 'Memory Usage Tests',
        command: 'npm test -- src/__tests__/UploadIntegrationComprehensive.test.tsx --testNamePattern="memory" --watchAll=false'
      },
      {
        name: 'Concurrent Upload Performance',
        command: 'npm test -- src/__tests__/UploadErrorHandlingComprehensive.test.ts --testNamePattern="concurrent" --watchAll=false'
      }
    ];
    
    let performanceResults = [];
    for (const test of performanceTests) {
      const result = await this.runCommand(test.command, test.name);
      performanceResults.push({
        name: test.name,
        success: result.success,
        duration: result.duration
      });
    }
    
    this.results.performance = performanceResults;
  }

  generateSummaryReport() {
    console.log('\n' + '='.repeat(80));
    this.log('📈 TEST SUMMARY REPORT', 'info');
    console.log('='.repeat(80));
    
    // Calculate success rate
    this.results.summary.successRate = this.results.summary.total > 0 
      ? (this.results.summary.passed / this.results.summary.total) * 100 
      : 0;
    
    // Print summary
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Success Rate: ${this.results.summary.successRate.toFixed(1)}%`);
    
    // Print detailed results by type
    const testsByType = {};
    Object.values(this.results.tests).forEach(test => {
      if (!testsByType[test.type]) {
        testsByType[test.type] = { passed: 0, total: 0 };
      }
      testsByType[test.type].total++;
      if (test.success) {
        testsByType[test.type].passed++;
      }
    });
    
    console.log('\n📋 Results by Type:');
    Object.entries(testsByType).forEach(([type, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`  ${type}: ${stats.passed}/${stats.total} (${rate}%)`);
    });
    
    // Print failed tests
    const failedTests = Object.values(this.results.tests).filter(test => !test.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.name} (${test.file})`);
        if (test.error) {
          console.log(`    Error: ${test.error.substring(0, 200)}...`);
        }
      });
    }
    
    // Print performance results
    if (this.results.performance) {
      console.log('\n⚡ Performance Results:');
      this.results.performance.forEach(perf => {
        const status = perf.success ? '✅' : '❌';
        console.log(`  ${status} ${perf.name} (${perf.duration}ms)`);
      });
    }
    
    // Save results to file
    const resultsFile = path.join(__dirname, '..', '..', 'upload_test_results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    this.log(`Results saved to: ${resultsFile}`, 'info');
    
    // Final status
    if (this.results.summary.failed === 0) {
      this.log('🎉 ALL TESTS PASSED!', 'success');
    } else {
      this.log(`⚠️ ${this.results.summary.failed} tests failed`, 'warning');
    }
  }
}

// Main execution
async function main() {
  const runner = new UploadTestRunner();
  
  try {
    const allPassed = await runner.runAllTests();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = UploadTestRunner;