"""
Pytest configuration for backend tests.
"""
import pytest
import asyncio
from pathlib import Path


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_data_dir():
    """Return path to test data directory."""
    return Path(__file__).parent / "data"


@pytest.fixture
def sample_text() -> str:
    """Sample text content for testing."""
    return "This is sample text content for testing document extraction."


@pytest.fixture
def sample_html() -> str:
    """Sample HTML content for testing."""
    return """<!DOCTYPE html>
<html>
<head><title>Test Document</title></head>
<body>
    <h1>Test Heading</h1>
    <p>This is a paragraph of text.</p>
    <script>console.log('ignore this');</script>
</body>
</html>"""
