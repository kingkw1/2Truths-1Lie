---
include: always
---

# Project Structure

## General Layout  

The project uses a modular structure to clearly separate concerns between gameplay logic, UI components, backend API, and utilities to ensure maintainability and scalability.

2Truths-1Lie/
├── .git/ # Git version control metadata
├── .kiro/ # Kiro AI assistant configurations and steering files
│ └── steering/ # Contains all steering markdowns
├── src/ # Source code for frontend and backend
│ ├── components/ # Reusable UI components (React/JSX)
│ ├── pages/ # Main pages/views of the application
│ ├── game/ # Core game logic and rules
│ ├── api/ # Backend API routes, database interfacing
│ └── utils/ # Helper functions and utilities
├── public/ # Static assets: images, fonts, icons
├── tests/ # Unit and integration test suites
├── docs/ # Documentation including API specs and guides
├── package.json # Dependencies and build scripts
└── README.md # Project overview and setup instructions

text

## Naming Conventions  
- Use kebab-case for folder names and JS utility filenames (e.g., `game-logic/`, `auth-utils.js`)  
- PascalCase for React components (e.g., `GameBoard.jsx`)  
- camelCase for helper functions and variables  
- Lowercase for config files (e.g., `.env`, `package.json`)  

## Architectural Principles  
- Keep UI and business logic separated  
- Encapsulate game rules strictly within `src/game/`  
- API endpoints must be RESTful, stateless, and clearly documented  
- Follow consistent import ordering and avoid anti-patterns  
- Tests located near implementation code for easy maintenance