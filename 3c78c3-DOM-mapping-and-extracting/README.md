# DOM Mapping and Extracting

This dataset task involves creating a system that takes any webpage URL and outputs a complete JSON representation of the page's DOM structure.

## Folder Layout

- `repository_before/` - Empty baseline 
- `repository_after/` - Complete DOM extraction implementation
- `tests/` - Test suite validating all requirements
- `patches/` - Diff between before/after
- `evaluation/` - Evaluation runner with report generation

## Problem Statement

Accept a webpage URL as input. Fully load the page, including JavaScript-rendered content. Traverse the entire DOM tree. For each element, extract tag name, text content, attributes, visibility, and DOM depth. Generate a unique absolute XPath for every element. Preserve parent-child hierarchy in the output. Output valid JSON only. Single .json file named with a unique id containing a single JSON object. No explanations or formatting outside JSON.

## Prompt Used

```
You are an advanced web developer specializing in web scraping and DOM analysis.
Create a system that takes any webpage URL and outputs a complete JSON representation 
of the page's DOM. The system must capture every HTML element, the data it contains, 
and a unique XPath for each element. The output should be machine-readable and suitable 
for automation, scraping, and AI agents.
```

## Functional Requirements

1. Accept a webpage URL as input
2. Fully load the page, including JavaScript-rendered content
3. Traverse the entire DOM tree
4. For each element, extract:
   - Tag name
   - Text content
   - Attributes
   - Visibility
   - DOM depth
5. Generate a unique absolute XPath for every element
6. Preserve parent-child hierarchy in the output
7. Output valid JSON only
8. Single .json file named with a unique id containing a single JSON object
9. No explanations or formatting outside JSON

## Expected JSON Structure

```json
{
  "url": "https://example.com",
  "dom": {
    "tag": "html",
    "xpath": "/html",
    "depth": 0,
    "attributes": {},
    "text": "",
    "visible": true,
    "children": [
      {
        "tag": "a",
        "xpath": "/html/body/a[1]",
        "depth": 2,
        "attributes": {
          "href": "/login"
        },
        "text": "Login",
        "visible": true,
        "children": []
      }
    ]
  }
}
```

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

## Run Locally

```bash
# Install dependencies
npm install

# Run tests on repository_after
npm test

# Run evaluation
npm run evaluation
```

# Generate patch
From repo root:


## Generate Patch

From the repository root, run:

```bash
git diff --no-index repository_before repository_after > patches/task_001.patch
