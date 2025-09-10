#!/usr/bin/env python3
"""
Comprehensive Upload Test Runner
Executes all upload-related tests and generates coverage report
"""
import subprocess
import sys
import os
from pathlib import Path
import json
import time
from datetime import datetime

def run_command(command, description):
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    end_time = time.time()
    
    print(f"Duration: {end_time - start_time:.2f} seconds")
    
    if result.returncode == 0:
        print("✅ SUCCESS")
        if result.stdout:
            print("STDOUT:", result.stdout[-500:])  # Last 500 chars
    else:
        print("❌ FAILED")
        if result.stderr:
            print("STDERR:", result.stderr)
        if result.stdout:
            print("STDOUT:", result.stdout)
    
    return result.returncode == 0

def main():
    """Run all upload tests"""
    print("🚀 Starting Comprehensive Upload Test Suite")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    test_results = {}
    
    # Backend Unit Tests
    backend_tests = [
        {
            "name": "Upload Service Core Tests",
            "command": "python -m pytest tests/test_upload_service.py -v --tb=short",
            "file": "test_upload_service.py"
        },
        {
            "name": "Upload Service Error Handling Tests", 
            "command": "python -m pytest tests/test_upload_service_error_handling.py -v --tb=short",
            "file": "test_upload_service_error_handling.py"
        },
        {
            "name": "Media Upload API Tests",
            "command": "python -m pytest tests/test_media_upload_api.py -v --tb=short", 
            "file": "test_media_upload_api.py"
        },
        {
            "name": "Upload Regression Tests",
            "command": "python -m pytest tests/test_upload_regression.py -v --tb=short",
            "file": "test_upload_regression.py"
        },
        {
            "name": "Upload End-to-End Tests",
            "command": "python -m pytest tests/test_upload_end_to_end.py -v --tb=short",
            "file": "test_upload_end_to_end.py"
        },
        {
            "name": "Cloud Storage Integration Tests",
            "command": "python -m pytest tests/test_cloud_storage_integration.py -v --tb=short",
            "file": "test_cloud_storage_integration.py"
        },
        {
            "name": "Validation Integration Tests",
            "command": "python -m pytest tests/test_validation_integration.py -v --tb=short",
            "file": "test_validation_integration.py"
        }
    ]
    
    print("\n📋 Backend Test Suite")
    backend_success_count = 0
    
    for test in backend_tests:
        success = run_command(test["command"], test["name"])
        test_results[test["name"]] = {
            "success": success,
            "file": test["file"],
            "type": "backend"
        }
        if success:
            backend_success_count += 1
    
    # Mobile Tests (if mobile directory exists)
    mobile_dir = backend_dir.parent / "mobile"
    mobile_success_count = 0
    mobile_tests = []
    
    if mobile_dir.exists():
        print("\n📱 Mobile Test Suite")
        os.chdir(mobile_dir)
        
        mobile_tests = [
            {
                "name": "Upload Service Tests",
                "command": "npm test -- src/services/__tests__/uploadService.test.ts --watchAll=false",
                "file": "uploadService.test.ts"
            },
            {
                "name": "Upload Service Validation Tests",
                "command": "npm test -- src/services/__tests__/uploadServiceValidation.test.ts --watchAll=false",
                "file": "uploadServiceValidation.test.ts"
            },
            {
                "name": "Upload Manager Hook Tests",
                "command": "npm test -- src/hooks/__tests__/useUploadManager.test.ts --watchAll=false",
                "file": "useUploadManager.test.ts"
            },
            {
                "name": "Upload Integration Comprehensive Tests",
                "command": "npm test -- src/__tests__/UploadIntegrationComprehensive.test.tsx --watchAll=false",
                "file": "UploadIntegrationComprehensive.test.tsx"
            },
            {
                "name": "Upload Error Handling Comprehensive Tests",
                "command": "npm test -- src/__tests__/UploadErrorHandlingComprehensive.test.ts --watchAll=false",
                "file": "UploadErrorHandlingComprehensive.test.ts"
            },
            {
                "name": "Enhanced Upload UI Tests",
                "command": "npm test -- src/components/__tests__/EnhancedUploadUI.test.tsx --watchAll=false",
                "file": "EnhancedUploadUI.test.tsx"
            }
        ]
        
        for test in mobile_tests:
            success = run_command(test["command"], test["name"])
            test_results[test["name"]] = {
                "success": success,
                "file": test["file"],
                "type": "mobile"
            }
            if success:
                mobile_success_count += 1
    
    # Generate Coverage Report
    print("\n📊 Generating Coverage Report")
    os.chdir(backend_dir)
    
    coverage_command = (
        "python -m pytest "
        "tests/test_upload_service.py "
        "tests/test_upload_service_error_handling.py "
        "tests/test_media_upload_api.py "
        "tests/test_upload_regression.py "
        "tests/test_upload_end_to_end.py "
        "--cov=services.upload_service "
        "--cov=services.media_upload_service "
        "--cov=api.media_endpoints "
        "--cov-report=html:htmlcov/upload_coverage "
        "--cov-report=term-missing "
        "--cov-fail-under=80"
    )
    
    coverage_success = run_command(coverage_command, "Coverage Report Generation")
    
    # Performance Tests
    print("\n⚡ Performance Tests")
    performance_command = (
        "python -m pytest tests/test_upload_end_to_end.py::TestUploadPerformance "
        "-v --tb=short"
    )
    performance_success = run_command(performance_command, "Upload Performance Tests")
    
    # Generate Summary Report
    print("\n" + "="*80)
    print("📈 TEST SUMMARY REPORT")
    print("="*80)
    
    total_tests = len(backend_tests) + len(mobile_tests)
    total_success = backend_success_count + mobile_success_count
    
    print(f"Backend Tests: {backend_success_count}/{len(backend_tests)} passed")
    print(f"Mobile Tests: {mobile_success_count}/{len(mobile_tests)} passed")
    print(f"Total Tests: {total_success}/{total_tests} passed")
    print(f"Success Rate: {(total_success/total_tests)*100:.1f}%")
    
    # Detailed Results
    print(f"\n📋 Detailed Results:")
    for test_name, result in test_results.items():
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"  {status} {test_name} ({result['file']})")
    
    # Coverage Results
    if coverage_success:
        print(f"\n📊 Coverage Report: Generated in htmlcov/upload_coverage/")
    else:
        print(f"\n⚠️  Coverage Report: Failed to generate")
    
    # Performance Results
    if performance_success:
        print(f"⚡ Performance Tests: PASSED")
    else:
        print(f"⚠️  Performance Tests: FAILED")
    
    # Save results to JSON
    results_file = backend_dir / "test_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": total_tests,
                "total_success": total_success,
                "success_rate": (total_success/total_tests)*100,
                "backend_success": backend_success_count,
                "mobile_success": mobile_success_count,
                "coverage_success": coverage_success,
                "performance_success": performance_success
            },
            "detailed_results": test_results
        }, indent=2)
    
    print(f"\n💾 Results saved to: {results_file}")
    
    # Exit with appropriate code
    if total_success == total_tests and coverage_success and performance_success:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_tests - total_success} tests failed")
        sys.exit(1)

if __name__ == "__main__":
    main()