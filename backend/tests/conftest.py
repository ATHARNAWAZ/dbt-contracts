"""
conftest.py — pytest fixtures shared across all backend tests.

We set required env vars here so tests run without a .env file present.
All external API calls (Anthropic, Supabase) are mocked — tests must not
make real network requests.
"""

import os

import pytest

# Set all required settings before importing any app modules.
# These are dummy values — the test suite mocks all external calls.
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-key-for-testing")
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
