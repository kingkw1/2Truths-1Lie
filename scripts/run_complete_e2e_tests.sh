#!/bin/bash
# Complete End-to-End Test Runner
# Executes comprehensive end-to-end tests for both backend and mobile components
# covering the complete user workflow from video capture to challenge playback

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to print section headers
print_header() {
    echo
    print_color $CYAN "============================================================"
    print_color $CYAN "$1"
    print_color $CYAN "============================================================"
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        print_color $GREEN "✅ SUCCESS: $2"
    else
        print_color $RED "❌ FAILED: $2"
    fi
}

# Initialize variables
BACKEND_SUCCESS=0
MOBILE_SUCCESS=0
TOTAL_TESTS=0
PASSED_TESTS=0

print_header "🚀 Starting Complete End-to-End Test Suite"
print_color $BLUE "Testing complete workflow from video capture to challenge playback"

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -f "backend/requirements.txt" ]; then
    print_color $RED "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Backend E2E Tests
print_header "🔧 Running Backend End-to-End Tests"

if [ -d "backend" ] && [ -f "backend/requirements.txt" ]; then
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d ".venv" ] && [ ! -d "venv" ]; then
        print_color $YELLOW "⚠️  No virtual environment found, creating one..."
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        pip install -r test-requirements.txt
    else
        # Activate virtual environment
        if [ -d ".venv" ]; then
            source .venv/bin/activate
        elif [ -d "venv" ]; then
            source venv/bin/activate
        fi
    fi
    
    # Install test dependencies
    print_color $BLUE "📦 Installing backend test dependencies..."
    pip install -r test-requirements.txt > /dev/null 2>&1
    
    # Run backend E2E tests
    print_color $BLUE "🧪 Running backend E2E tests..."
    if python run_e2e_tests.py; then
        BACKEND_SUCCESS=1
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    cd ..
else
    print_color $YELLOW "⚠️  Backend directory not found, skipping backend tests"
fi

print_status $BACKEND_SUCCESS "Backend End-to-End Tests"

# Mobile E2E Tests
print_header "📱 Running Mobile End-to-End Tests"

if [ -d "mobile" ] && [ -f "mobile/package.json" ]; then
    cd mobile
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_color $YELLOW "⚠️  Node modules not found, installing..."
        npm install
    fi
    
    # Run mobile E2E tests
    print_color $BLUE "🧪 Running mobile E2E tests..."
    if node run_e2e_tests.js; then
        MOBILE_SUCCESS=1
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    cd ..
else
    print_color $YELLOW "⚠️  Mobile directory not found, skipping mobile tests"
fi

print_status $MOBILE_SUCCESS "Mobile End-to-End Tests"

# Integration Tests (if both backend and mobile are available)
if [ $BACKEND_SUCCESS -eq 1 ] && [ $MOBILE_SUCCESS -eq 1 ]; then
    print_header "🔗 Running Cross-Platform Integration Tests"
    
    cd backend
    source .venv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null || true
    
    print_color $BLUE "🧪 Running cross-platform integration tests..."
    INTEGRATION_SUCCESS=0
    if python -m pytest tests/ -k "integration" -v --tb=short; then
        INTEGRATION_SUCCESS=1
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status $INTEGRATION_SUCCESS "Cross-Platform Integration Tests"
    
    cd ..
fi

# Performance Tests
if [ $BACKEND_SUCCESS -eq 1 ]; then
    print_header "⚡ Running Performance Tests"
    
    cd backend
    source .venv/bin/activate 2>/dev/null || source venv/bin/activate 2>/dev/null || true
    
    print_color $BLUE "🧪 Running concurrent upload tests..."
    CONCURRENT_SUCCESS=0
    if python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow::test_concurrent_multi_user_upload_and_merge -v; then
        CONCURRENT_SUCCESS=1
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status $CONCURRENT_SUCCESS "Concurrent Upload Tests"
    
    print_color $BLUE "🧪 Running upload recovery tests..."
    RECOVERY_SUCCESS=0
    if python -m pytest tests/test_complete_e2e_workflow.py::TestCompleteE2EWorkflow::test_upload_failure_recovery_and_resume -v; then
        RECOVERY_SUCCESS=1
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_status $RECOVERY_SUCCESS "Upload Recovery Tests"
    
    cd ..
fi

# Generate Final Report
print_header "📊 Final Test Results Summary"

FAILED_TESTS=$((TOTAL_TESTS - PASSED_TESTS))
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo
print_color $CYAN "Total Tests: $TOTAL_TESTS"
print_color $GREEN "Passed: $PASSED_TESTS"
if [ $FAILED_TESTS -gt 0 ]; then
    print_color $RED "Failed: $FAILED_TESTS"
else
    print_color $GREEN "Failed: $FAILED_TESTS"
fi
print_color $CYAN "Success Rate: ${SUCCESS_RATE}%"

echo
if [ $FAILED_TESTS -eq 0 ]; then
    print_color $GREEN "🎉 ALL TESTS PASSED! End-to-end workflow is working correctly."
    print_color $GREEN "✨ The complete user journey from video capture to challenge playback is functional."
    exit 0
else
    print_color $YELLOW "⚠️  $FAILED_TESTS TEST SUITE(S) FAILED. Please review the failures above."
    print_color $YELLOW "🔍 Check the individual test outputs for detailed error information."
    exit 1
fi