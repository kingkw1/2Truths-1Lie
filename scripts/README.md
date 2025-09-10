# 🛠 Development Scripts

This folder contains shell scripts for development workflow automation and project setup.

## Available Scripts

### Setup & Demo
- **`demo-setup.sh`** - Quick demo setup for hackathon judges and presentations
  ```bash
  ./scripts/demo-setup.sh
  ```

### Development Workflow  
- **`dev-guide.sh`** - Development menu and workflow guide
  ```bash
  ./scripts/dev-guide.sh
  ```

### Testing & Integration
- **`run_complete_e2e_tests.sh`** - Comprehensive end-to-end test runner
  ```bash
  ./scripts/run_complete_e2e_tests.sh
  ```

- **`test_complete_workflow.sh`** - Complete challenge creation workflow test
  ```bash
  ./scripts/test_complete_workflow.sh
  ```

## Usage

All scripts should be run from the project root directory:

```bash
# From project root
./scripts/script-name.sh
```

Or via npm scripts (where available):

```bash
npm run demo  # Runs ./scripts/demo-setup.sh
```

## Requirements

- **Bash shell** (Linux/macOS/WSL)
- **Project dependencies** installed (npm, Python packages)
- **Backend and mobile** environments configured

## Script Permissions

Make sure scripts are executable:

```bash
chmod +x scripts/*.sh
```
