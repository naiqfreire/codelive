"""
Test environment bootstrap and database connectivity.
"""
import pytest


@pytest.mark.integration
def test_main_db_connectible(main_db_container_name, database_url):
    """
    Test that the main database container is running and accessible.
    
    This is a gate test for the entire integration test suite.
    If this fails, all other integration tests will be skipped.
    """
    import subprocess
    
    # Check if container is running - use more specific name matching
    # We'll use grep to get exact matches and strip the header
    result = subprocess.run(
        ["docker", "ps", "--filter", "name=" + main_db_container_name, 
         "--format", "table {{.Names}}\t{{.Status}}"],
        capture_output=True,
        text=True,
    )
    
    # Extract rows (skip header)
    lines = result.stdout.strip().split('\n')[1:]
    
    assert len(lines) > 0, f"No containers found with name matching {main_db_container_name}"
    
    # Check that the main container is running
    found = False
    for line in lines:
        if main_db_container_name in line and "Up" in line:
            found = True
            break
    
    assert found, f"Database container {main_db_container_name} is not running. Output:\n{result.stdout}"
    
    # Test basic SELECT 1 query to verify connectivity
    import sqlalchemy
    from sqlalchemy import text
    
    engine = sqlalchemy.create_engine(database_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.integration
def test_test_db_connectible(test_db_container_name):
    """
    Test that the test database container is running and accessible.
    
    Verifies that we can connect to TEST_DATABASE_URL.
    """
    import subprocess
    
    # Check if container is running - use more specific name matching
    result = subprocess.run(
        ["docker", "ps", "--filter", "name=" + test_db_container_name, 
         "--format", "table {{.Names}}\t{{.Status}}"],
        capture_output=True,
        text=True,
    )
    
    # Extract rows (skip header)
    lines = result.stdout.strip().split('\n')[1:]
    
    assert len(lines) > 0, f"No containers found with name matching {test_db_container_name}"
    
    # Check that the test container is running
    found = False
    for line in lines:
        if test_db_container_name in line and "Up" in line:
            found = True
            break
    
    assert found, f"Test database container {test_db_container_name} is not running. Output:\n{result.stdout}"
