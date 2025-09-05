#!/usr/bin/env python3
"""
Integration Test Runner
Executes comprehensive end-to-end integration tests for the complete media upload workflow
"""
import subprocess
import sys
import os
import time
import signal
import json
from pathlib import Path
from typing import Dict, List, Optional

class IntegrationTestRunner:
    """Manages and executes integration tests across mobile and backend"""
    
    def __init__(self):
        self.backend_process = None
        self.test_results = {
            "backend": {"passed": 0, "failed": 0, "errors": []},
            "mobile": {"passed": 0, "failed": 0, "errors": []},
            "total_duration": 0
        }
    
    def start_backend_server(self) -> bool:
        """Start the backend server for integration testing"""
        print("🚀 Starting backend server for integration tests...")
        
        try:
            # Change to backend directory
            backend_dir = Path("backend")
            if not backend_dir.exists():
                print("❌ Backend directory not found")
                return False
            
            # Start the server
            self.backend_process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"],
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for server to start
            max_attempts = 30
            for attempt in range(max_attempts):
                try:
                    import requests
                    response = requests.get("http://localhost:8001/health", timeout=1)
                    if response.status_code == 200:
                        print("✅ Backend server started successfully")
                        return True
                except:
                    pass
                time.sleep(1)
            
            print("❌ Failed to start backend server")
            return False
            
        except Exception as e:
            print(f"❌ Error starting backend server: {e}")
            return False
    
    def stop_backend_server(self):
        """Stop the backend server"""
        if self.backend_process:
            print("🛑 Stopping backend server...")
            self.backend_process.terminate()
            self.backend_process.wait()
            print("✅ Backend server stopped")
    
    def run_backend_tests(self) -> bool:
        """Run backend integration tests"""
        print("\n🧪 Running Backend Integration Tests")
        print("=" * 50)
        
        try:
            backend_dir = Path("backend")
            
            # Install test dependencies
            print("📦 Installing test dependencies...")
            subprocess.run([
                sys.executable, "-m", "pip", "install", "-r", "test-requirements.txt"
            ], cwd=backend_dir, check=True, capture_output=True)
            
            # Run the integration tests
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                "tests/test_end_to_end_integration.py",
                "-v", "--tb=short", "--json-report", "--json-report-file=test_results.json"
            ], cwd=backend_dir, capture_output=True, text=True)
            
            print("Backend Test Output:")
            print(result.stdout)
            
            if result.stderr:
                print("Backend Test Errors:")
                print(result.stderr)
            
            # Parse results
            try:
                results_file = backend_dir / "test_results.json"
                if results_file.exists():
                    with open(results_file) as f:
                        test_data = json.load(f)
                    
                    self.test_results["backend"]["passed"] = test_data.get("summary", {}).get("passed", 0)
                    self.test_results["backend"]["failed"] = test_data.get("summary", {}).get("failed", 0)
                    
                    if test_data.get("summary", {}).get("failed", 0) > 0:
                        for test in test_data.get("tests", []):
                            if test.get("outcome") == "failed":
                                self.test_results["backend"]["errors"].append({
                                    "test": test.get("nodeid", "unknown"),
                                    "error": test.get("call", {}).get("longrepr", "unknown error")
                                })
            except Exception as e:
                print(f"⚠️ Could not parse backend test results: {e}")
            
            return result.returncode == 0
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Backend test execution failed: {e}")
            self.test_results["backend"]["errors"].append({
                "test": "test_execution",
                "error": str(e)
            })
            return False
        except Exception as e:
            print(f"❌ Unexpected error running backend tests: {e}")
            self.test_results["backend"]["errors"].append({
                "test": "unexpected_error",
                "error": str(e)
            })
            return False
    
    def run_mobile_tests(self) -> bool:
        """Run mobile integration tests"""
        print("\n📱 Running Mobile Integration Tests")
        print("=" * 50)
        
        try:
            mobile_dir = Path("mobile")
            if not mobile_dir.exists():
                print("❌ Mobile directory not found")
                return False
            
            # Check if node_modules exists
            if not (mobile_dir / "node_modules").exists():
                print("📦 Installing mobile dependencies...")
                subprocess.run(["npm", "install"], cwd=mobile_dir, check=True)
            
            # Run the integration tests
            result = subprocess.run([
                "npm", "test", "--", 
                "src/__tests__/EndToEndIntegration.test.tsx",
                "--verbose", "--coverage=false", "--watchAll=false"
            ], cwd=mobile_dir, capture_output=True, text=True)
            
            print("Mobile Test Output:")
            print(result.stdout)
            
            if result.stderr:
                print("Mobile Test Errors:")
                print(result.stderr)
            
            # Parse Jest output for results
            output_lines = result.stdout.split('\n')
            for line in output_lines:
                if "Tests:" in line:
                    # Parse Jest summary line like "Tests: 5 passed, 1 failed, 6 total"
                    parts = line.split(',')
                    for part in parts:
                        part = part.strip()
                        if 'passed' in part:
                            try:
                                self.test_results["mobile"]["passed"] = int(part.split()[0])
                            except:
                                pass
                        elif 'failed' in part:
                            try:
                                self.test_results["mobile"]["failed"] = int(part.split()[0])
                            except:
                                pass
            
            # Collect error details if tests failed
            if result.returncode != 0:
                error_collecting = False
                current_error = {"test": "", "error": ""}
                
                for line in output_lines:
                    if "FAIL" in line and "src/__tests__" in line:
                        error_collecting = True
                        current_error["test"] = line.strip()
                    elif error_collecting and line.strip().startswith("●"):
                        if current_error["test"] and current_error["error"]:
                            self.test_results["mobile"]["errors"].append(current_error.copy())
                        current_error = {"test": line.strip(), "error": ""}
                    elif error_collecting and line.strip() and not line.startswith(" "):
                        current_error["error"] += line.strip() + " "
                
                if current_error["test"] and current_error["error"]:
                    self.test_results["mobile"]["errors"].append(current_error)
            
            return result.returncode == 0
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Mobile test execution failed: {e}")
            self.test_results["mobile"]["errors"].append({
                "test": "test_execution",
                "error": str(e)
            })
            return False
        except Exception as e:
            print(f"❌ Unexpected error running mobile tests: {e}")
            self.test_results["mobile"]["errors"].append({
                "test": "unexpected_error",
                "error": str(e)
            })
            return False
    
    def run_cross_platform_validation(self) -> bool:
        """Run cross-platform validation tests"""
        print("\n🔄 Running Cross-Platform Validation Tests")
        print("=" * 50)
        
        try:
            # Test that mobile can communicate with backend
            import requests
            import json
            
            # Test health endpoint
            health_response = requests.get("http://localhost:8001/health", timeout=5)
            if health_response.status_code != 200:
                print("❌ Backend health check failed")
                return False
            
            print("✅ Backend health check passed")
            
            # Test challenge API endpoint (without auth for basic connectivity)
            try:
                challenges_response = requests.get("http://localhost:8001/api/v1/challenges", timeout=5)
                # We expect 401 (unauthorized) which means the endpoint is working
                if challenges_response.status_code in [200, 401]:
                    print("✅ Challenge API endpoint accessible")
                else:
                    print(f"⚠️ Challenge API returned unexpected status: {challenges_response.status_code}")
            except Exception as e:
                print(f"❌ Challenge API test failed: {e}")
                return False
            
            # Test media upload endpoint structure
            try:
                upload_response = requests.post("http://localhost:8001/api/v1/media/upload/initiate", timeout=5)
                # We expect 401 or 422 (validation error) which means the endpoint exists
                if upload_response.status_code in [401, 422]:
                    print("✅ Media upload API endpoint accessible")
                else:
                    print(f"⚠️ Media upload API returned unexpected status: {upload_response.status_code}")
            except Exception as e:
                print(f"❌ Media upload API test failed: {e}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Cross-platform validation failed: {e}")
            return False
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n📊 Integration Test Report")
        print("=" * 60)
        
        total_passed = self.test_results["backend"]["passed"] + self.test_results["mobile"]["passed"]
        total_failed = self.test_results["backend"]["failed"] + self.test_results["mobile"]["failed"]
        total_tests = total_passed + total_failed
        
        print(f"📈 Overall Results:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {total_passed}")
        print(f"   Failed: {total_failed}")
        print(f"   Success Rate: {(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "   Success Rate: N/A")
        
        print(f"\n🔧 Backend Tests:")
        print(f"   Passed: {self.test_results['backend']['passed']}")
        print(f"   Failed: {self.test_results['backend']['failed']}")
        
        print(f"\n📱 Mobile Tests:")
        print(f"   Passed: {self.test_results['mobile']['passed']}")
        print(f"   Failed: {self.test_results['mobile']['failed']}")
        
        # Show errors if any
        all_errors = self.test_results["backend"]["errors"] + self.test_results["mobile"]["errors"]
        if all_errors:
            print(f"\n❌ Errors ({len(all_errors)}):")
            for i, error in enumerate(all_errors[:5]):  # Show first 5 errors
                print(f"   {i+1}. {error['test']}")
                print(f"      {error['error'][:100]}...")
            
            if len(all_errors) > 5:
                print(f"   ... and {len(all_errors) - 5} more errors")
        
        print("\n" + "=" * 60)
        
        # Save detailed report
        report_file = Path("integration_test_report.json")
        with open(report_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        print(f"📄 Detailed report saved to: {report_file}")
        
        return total_failed == 0
    
    def run_all_tests(self) -> bool:
        """Run complete integration test suite"""
        start_time = time.time()
        
        print("🎯 Starting Complete Integration Test Suite")
        print("=" * 60)
        
        try:
            # Start backend server
            if not self.start_backend_server():
                return False
            
            # Wait a moment for server to fully initialize
            time.sleep(2)
            
            # Run cross-platform validation first
            cross_platform_ok = self.run_cross_platform_validation()
            
            # Run backend tests
            backend_ok = self.run_backend_tests()
            
            # Run mobile tests
            mobile_ok = self.run_mobile_tests()
            
            # Calculate duration
            self.test_results["total_duration"] = time.time() - start_time
            
            # Generate report
            all_passed = self.generate_report()
            
            if all_passed and cross_platform_ok and backend_ok and mobile_ok:
                print("\n🎉 All integration tests passed!")
                return True
            else:
                print("\n❌ Some integration tests failed")
                return False
                
        except KeyboardInterrupt:
            print("\n⚠️ Tests interrupted by user")
            return False
        except Exception as e:
            print(f"\n❌ Unexpected error during test execution: {e}")
            return False
        finally:
            self.stop_backend_server()

def main():
    """Main entry point"""
    runner = IntegrationTestRunner()
    
    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print("\n⚠️ Received interrupt signal, cleaning up...")
        runner.stop_backend_server()
        sys.exit(1)
    
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        success = runner.run_all_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()