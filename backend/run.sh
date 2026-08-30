#!/usr/bin/env bash
# Convenience script to start the FastAPI backend.
set -e
uvicorn app.main:app --reload --port 8000
