# Trajectory: FileStorage Unit Testing

## What I need to build

I need to write unit tests for the FileStorage class. This class handles saving objects to JSON and loading them back. The tests should use Python's unittest module and go in repository_after/tests/.

## My approach

First, I looked at the FileStorage class in repository_before. It has private attributes using Python's name mangling (_FileStorage__objects and _FileStorage__file_path). The main methods are all(), new(), save(), and reload().

I decided to use a temporary test file instead of the real file.json to avoid side effects. Each test needs to reset the storage state to ensure isolation.

## Key decisions

For test isolation, I reset _FileStorage__objects in setUp and tearDown. This feels a bit hacky since I'm accessing private attributes, but it's necessary because FileStorage uses class-level state.

I added TC-XX markers to each test for requirement traceability. This helps track which requirements each test covers.

## Meta-testing strategy

The meta-tests check if proper unittest files exist in the target repository. They run against both repos:

- repository_before has no tests/ folder, so meta-tests fail immediately
- repository_after has the tests I wrote, so meta-tests pass and actually run the unittests

This validates that the transformation from "no tests" to "working tests" actually happened.

## Commands

To test repository_before (should fail):
docker compose run --rm -e REPO_PATH=repository_before app

To test repository_after (should pass):
docker compose run --rm -e REPO_PATH=repository_after app

To generate the evaluation report:
docker compose run --rm app python evaluation/evaluation.py

## What success looks like

- repository_before fails because there's no tests/ directory
- repository_after passes because it has valid unittest files that all pass
- The evaluation report confirms both behaviors
