# Rule Engine - Personal Laws System

This dataset task involves building a full-stack Next.js application where users can define their own laws as IF-THEN rules. The system evaluates scenarios, detects conflicts, and provides explainable reasoning paths.

## Folder Layout

- `repository_before/` - Empty baseline (no implementation)
- `repository_after/` - Complete Next.js rule engine implementation
- `tests/` - Test suite validating all requirements
- `patches/` - Diff between before/after
- `evaluation/` - Evaluation runner with report generation

## Problem Statement

A full-stack application is needed to allow users to define customizable IF-THEN rules as personal "laws," which can conflict and override each other, creating a dynamic rule engine. This system must algorithmically evaluate any user-provided scenario by applying all relevant rules, detecting conflicts, and resolving overrides to produce a single, deterministic outcome. Furthermore, the application must clearly present the complete reasoning path, explaining which rules fired and how any conflicts were resolved, to provide users with transparent, explainable decision-making.

## Prompt Used

```
Build a full-stack Next.js application where users can define their own laws as IF-THEN rules. 
Each law has a condition and a consequence, and rules can override or conflict with each other. 
The system evaluates a scenario by applying all relevant rules, detects conflicts, and outputs 
a deterministic, explainable result showing which rules applied and which were overridden. 
The app is essentially a rule engine for personal decision-making, where the reasoning path 
is visible to the user.
```

## Example Scenario

**User defines the following rules:**
- **Law A**: IF it's raining, THEN carry an umbrella
- **Law B**: IF it's raining AND it's windy, THEN do not carry an umbrella
- **Law C**: IF it's a weekend, THEN relax

**Scenario Evaluation:**
Today is raining, windy, and a weekend.

**Applied Rules:**
- Law B overrides Law A → do not carry an umbrella
- Law C → relax

**Result:**
Do not carry an umbrella. Relax.

System shows conflict resolution (Law B overrides Law A) and reasoning path.

## Functional Requirements

1. Users can create laws as IF-THEN rules with conditions and consequences
2. Rules can override or conflict with other rules
3. The system evaluates a scenario by applying all relevant rules
4. Conflicts between rules must be detected and resolved deterministically
5. The system produces a reasoning path showing which rules were applied or overridden
6. Users can view the final outcome and explanation
7. No auth required
8. Minimal User Interface

## Technical Stack

- **Language**: TypeScript
- **Framework**: Next.js
- **Database**: MongoDB
- **Testing**: Jest, React Testing Library
- **Styling**: Tailwind CSS (minimal UI)

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before – expected N/A since no implementation)
```bash
# repository_before has no implementation, so no tests to run
```

### Run tests (after – expected pass)
```bash
docker compose run --rm app-after
```
*Expected: All requirement-based tests PASS.*

### Run evaluation
```bash
docker compose run --rm evaluation
```

### Run the application
```bash
docker compose up app
```
*Visit: http://localhost:3000*

## Run Locally

```bash
# Navigate to repository_after
cd repository_after

# Install dependencies
npm install

# Set up MongoDB (or use MongoDB Atlas connection string)
# Create .env.local file:
# MONGODB_URI=mongodb://localhost:27017/rule-engine

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Run Evaluation Locally

```bash
# Install dependencies
npm install

# Run evaluation
npm run evaluate
```

```bash
git diff --no-index repository_before repository_after > patches/task_001.patch
