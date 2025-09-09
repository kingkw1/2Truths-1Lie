#!/usr/bin/env python3
"""
End-to-End Test Runner
Executes comprehensive end-to-end tests covering the complete user workflow
from video capture through upload, merge, challenge creation, and playback
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def run_command(command, description, cwd=None):
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print(f"✅ SUCCESS: {description}")
            if result.stdout:
                print("STDOUT:")
                print(result.stdout)
        else:
            print(f"❌ FAILED: {description}")
            print("STDERR:")
            print(result.stderr)
            if result.stdout:
                print("STDOUT:")
                print(result.stdout)
        
        return result.returncode == 0
    
    except subprocess.TimeoutExpired:
        print(f"⏰ TIMEOUT: {description} took longer than 5 minutes")
        return False
    except Exception as e:
        print(f"💥 ERROR: {description} failed with exception: {e}")
        return False

def main():
    """Main test runner function"""
    print("🚀 Starting End-to-End Test Suite")
    print("Testing complete workflow from video capture to challenge playback")
    
    # Get project root directory
    project_root = Path(__file__).parent.parent
    backend_dir = project_root / "backend"
    mobile_dir = project_root / "mobile"
    
    # Track test results
    test_results = []
    
    # Backend E2E Tests
    print("\n🔧 Running Backend End-to-End Tests")
    
    # Install backend test dependencies
    backend_deps_success = run_command(
        "pip install -r test-requirements.txt",
        "Installing backend test dependencies",
        cwd=backend_dir
    )
    test_results.append(("Backend Dependencies", backend_deps_success))
    
    if backend_deps_success:
        # Run complete E2E workflow tests
        backend_e2e_success = run_command(
            "python -m pytest tests/test_complete_e2e_workflow.py -v --tb=short",
            "Backend Complete E2E Workflow Tests",
            cwd=backend_dir
        )
        test_results.append(("Backend E2E Workflow", backend_e2e_success))
        
        # Run multi-video integration tests
        backend_multi_video_success = run_command(
            "python -m pytest tests/test_multi_video_upload_merge_integration.py -v --tb=short",
            "Backend Multi-Video Integration Tests",
            cwd=backend_dir
        )
        test_results.append(("Backend Multi-Video Integration", backend_multi_video_success))
        
        # Run challenge video API tests
        backend_api_success = run_command(
            "python -m pytest tests/test_challenge_video_api.py -v --tb=short",
            "Backend Challenge Video API Tests",
            cwd=backend_dir
        )
        test_results.append(("Backend Challenge Video API", backend_api_success))
        
        # Run video merge service tests
        backend_merge_success = run_command(
            "python -m pytest tests/test_video_merge_service.py -v --tb=short",
            "Backend Video Merge Service Tests",
            cwd=backend_dir
        )
        test_results.append(("Backend Video Merge Service", backend_merge_success))
        
        # Run existing end-to-end integration tests
        backend_existing_e2e_success = run_command(
            "python -m pytest tests/test_end_to_end_integration.py -v --tb=short",
            "Backend Existing E2E Integration Tests",
            cwd=backend_dir
        )
        test_results.append(("Backend Existing E2E Integration", backend_existing_e2e_success))
    
    # Mobile E2E Tests
    print("\n📱 Running Mobile End-to-End Tests")
    
    # Check if mobile directory exists and has package.json
    if mobile_dir.exists() and (mobile_dir / "package.json").exists():
        # Install mobile test dependencies
        mobile_deps_success = run_command(
            "npm install",
            "Installing mobile test dependencies",
            cwd=mobile_dir
        )
        test_results.append(("Mobile Dependencies", mobile_deps_success))
        
        if mobile_deps_success:
            # Run complete E2E workflow tests
            mobile_e2e_success = run_command(
                "npm test -- --testPathPattern=CompleteE2EWorkflow.test.tsx --verbose",
                "Mobile Complete E2E Workflow Tests",
                cwd=mobile_dir
            )
            test_results.append(("Mobile E2E Workflow", mobile_e2e_success))
            
            # Run existing end-to-end integration tests
            mobile_existing_e2e_success = run_command(
                "npm test -- --testPathPattern=EndToEndIntegration.test.tsx --verbose",
                "Mobile Existing E2E Integration Tests",
                cwd=mobile_dir
            )
            test_results.append(("Mobile Existing E2E Integration", mobile_existing_e2e_success))
            
            # Run mobile camera integration tests
            mobile_camera_success = run_command(
                "npm test -- --testPathPattern=MobileCameraIntegration.test.tsx --verbose",
                "Mobile Camera Integration Tests",
                cwd=mobile_dir
            )
            test_results.append(("Mobile Camera Integration", mobile_camera_success))
            
            # Run upload integration tests
            mobile_upload_success = run_command(
                "npm test -- --testPathPattern=UploadIntegrationComprehensive.test.tsx --verbose",
                "Mobile Upload Integration Tests",
                cwd=mobile_dir
            )
            test_results.append(("Mobile Upload Integration", mobile_upload_success))
    else:
        print("⚠️  Mobile directory not found or missing package.json, skipping mobile tests")
        test_results.append(("Mobile Tests", False))
    
    # Integration Tests (Backend + Mobile)
    print("\n🔗 Running Cross-Platform Integration Tests")
    
    # Run tests that verify backend-mobile integration
    if backend_deps_success:
        integration_success = run_command(
            "python -m pytest tests/ -k 'integration' -v --tb=short",
            "Cross-Platform Integration Tests",
            cwd=backend_dir
        )
        test_results.append(("Cross-Platform Integration", integration_success))
    
    # Performance and Load Tests
    print("\n⚡ Running Performance Tests")
    
    if backend_deps_success:
        # Run concurrent upload tests
        concurrent_success = run_command(
            "python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow::test_concurrent_multi_user_upload_and_merge -v",
            "Concurrent Multi-User Upload Tests",
            cwd=backend_dir
        )
        test_results.append(("Concurrent Upload Tests", concurrent_success))
        
        # Run upload failure recovery tests
        recovery_success = run_command(
            "python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow::test_upload_failure_recovery_and_resume -v",
            "Upload Failure Recovery Tests",
            cwd=backend_dir
        )
        test_results.append(("Upload Recovery Tests", recovery_success))
    
    # Generate Test Report
    print("\n📊 Test Results Summary")
    print("="*80)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for _, success in test_results if success)
    failed_tests = total_tests - passed_tests
    
    for test_name, success in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status:<10} {test_name}")
    
    print("="*80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    # Final status
    if failed_tests == 0:
        print("\n🎉 ALL TESTS PASSED! End-to-end workflow is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {failed_tests} TEST(S) FAILED. Please review the failures above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)