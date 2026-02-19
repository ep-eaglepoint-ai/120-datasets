# Robust File Transfer System

## Problem Statement

Create a Python-based file transfer system with a server script to concurrently handle multiple clients over TCP sockets, sending files with progress tracking and logging operations, and a client script to request files with robust error handling, real-time progress display, and integrity verification. The server must use threading to manage simultaneous connections on a configurable port, while the client must implement connection retry logic with exponential backoff and comprehensive error handling for network issues and interrupted transfers.

## Run with Docker

### Run tests on repository_before (expected to fail)

```bash
docker compose run --rm tests-before
```

### Run tests on repository_after (expected to pass)

```bash
docker compose run --rm tests-after
```

### Run evaluation (compares both implementations)

```bash
docker compose run --rm evaluation
```
