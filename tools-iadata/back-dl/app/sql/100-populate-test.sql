-- 100-populate-test.sql
-- POPULATES REALISTIC TEST DATA FOR 4 DIVERSE ENVIRONMENTS
-- Uses ON CONFLICT DO NOTHING for idempotency

-- =========================================================================
-- 1. ENVIRONMENTS
-- =========================================================================

-- Env 1: Operations / Personal Sandbox
INSERT INTO environments (id, name, description, owner_id, settings, created_at) VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Personal Sandbox', 
    'A general workspace for casual queries, personal tasks, and local document processing.',
    '655e8840-7546-4cb0-9a4f-1234567890ab',
    '{"default_model": "gpt-4o", "temperature": 0.7}',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Env 2: Engineering (Backend Focus)
INSERT INTO environments (id, name, description, owner_id, settings, created_at) VALUES (
    '22222222-2222-2222-2222-222222222222', 
    'Backend Engineering', 
    'High-context technical environment for API development, database architecture, and system design.',
    '655e8840-7546-4cb0-9a4f-1234567890ab',
    '{"default_model": "claude-3-5-sonnet", "temperature": 0.2}',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Env 3: Financial Audit (Data Heavy)
INSERT INTO environments (id, name, description, owner_id, settings, created_at) VALUES (
    '33333333-3333-3333-3333-333333333333', 
    'Financial Audit 2024', 
    'Secure environment for analyzing fiscal reports, invoices, and compliance documentation.',
    '655e8840-7546-4cb0-9a4f-1234567890ab',
    '{"default_model": "gpt-4-turbo-preview", "temperature": 0.0}',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Env 4: Market Research (Web & Creative)
INSERT INTO environments (id, name, description, owner_id, settings, created_at) VALUES (
    '44444444-4444-4444-4444-444444444444', 
    'Market Research', 
    'Exploratory environment for trend analysis, competitor tracking, and creative strategy generation.',
    '655e8840-7546-4cb0-9a4f-1234567890ab',
    '{"default_model": "claude-3-opus", "temperature": 0.9}',
    NOW()
) ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- 2. DATA SOURCES
-- =========================================================================

-- Env 1: Personal Docs
INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', '11111111-1111-1111-1111-111111111111', 'LOCAL',
    'My Documents', '{"path": "/mnt/host_data/personal", "glob": "**/*.pdf"}', '{"chunk_size": 1000}'
) ON CONFLICT (id) DO NOTHING;

-- Env 2: Tech Docs
INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a', '22222222-2222-2222-2222-222222222222', 'WEB',
    'FastAPI Documentation', '{"url": "https://fastapi.tiangolo.com", "depth": 3}', '{"chunk_size": 500}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b', '22222222-2222-2222-2222-222222222222', 'LOCAL',
    'Source Code (Architecture)', '{"path": "/mnt/host_data/projects/backend", "glob": "**/*.py"}', '{"chunk_size": 2000}'
) ON CONFLICT (id) DO NOTHING;

-- Env 3: Spreadsheets & Sharepoint
INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a', '33333333-3333-3333-3333-333333333333', 'SHAREPOINT',
    'Q3 Financial Reports', '{"site_url": "https://company.sharepoint.com/sites/finance", "folder": "Q3-2024"}', '{"chunk_size": 4000}'
) ON CONFLICT (id) DO NOTHING;

-- Env 4: Competitor Sites
INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '44444444-4444-4444-4444-444444444444', 'WEB',
    'Competitor News', '{"url": "https://techcrunch.com", "depth": 1}', '{"chunk_size": 500}'
) ON CONFLICT (id) DO NOTHING;

-- Env 1: Google Drive Integration
INSERT INTO data_sources (id, env_id, type, name, config, indexing_config) VALUES (
    '1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b', '11111111-1111-1111-1111-111111111111', 'GOOGLE_DRIVE',
    'Shared Drive - Projects', '{"folder_id": "root", "google_drive_name": "My Drive"}', '{"chunk_size": 1000}'
) ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- 3. MCP SERVERS
-- =========================================================================

-- Env 2: Git Integration
INSERT INTO mcp_servers (id, env_id, name, transport_type, command, env_vars, enabled) VALUES (
    '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c', '22222222-2222-2222-2222-222222222222',
    'Git Ops', 'STDIO', 'npx -y @modelcontextprotocol/server-git .', '{}', true
) ON CONFLICT (id) DO NOTHING;

-- Env 2: Postgres Debugger
INSERT INTO mcp_servers (id, env_id, name, transport_type, command, env_vars, enabled) VALUES (
    '2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d', '22222222-2222-2222-2222-222222222222',
    'Postgres Insights', 'STDIO', 'npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost/db', '{}', true
) ON CONFLICT (id) DO NOTHING;

-- Env 3: Excel Analyzer
INSERT INTO mcp_servers (id, env_id, name, transport_type, command, env_vars, enabled) VALUES (
    '3c3c3c3c-3c3c-3c3c-3c3c-3c3c3c3c3c3c', '33333333-3333-3333-3333-333333333333',
    'Data Analysis Tool', 'STDIO', 'python scripts/mcp_pandas.py', '{}', true
) ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- 4. AGENTS
-- =========================================================================

-- Env 1: General
INSERT INTO agents (id, env_id, name, role, system_prompt, model_override) VALUES (
    '1d1d1d1d-1d1d-1d1d-1d1d-1d1d1d1d1d1d', '11111111-1111-1111-1111-111111111111',
    'Navigator', 'General Assistant', 'Help the user with daily tasks and organizing files.', '{}'
) ON CONFLICT (id) DO NOTHING;

-- Env 2: Specialized Tech
INSERT INTO agents (id, env_id, name, role, system_prompt, model_override) VALUES (
    '2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e', '22222222-2222-2222-2222-222222222222',
    'Systems Architect', 'Senior Engineer', 'Analyze code patterns and enforce clean architecture.', '{"model": "claude-3-opus"}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO agents (id, env_id, name, role, system_prompt, model_override) VALUES (
    '2f2f2f2f-2f2f-2f2f-2f2f-2f2f2f2f2f2f', '22222222-2222-2222-2222-222222222222',
    'Security Auditor', 'Security Specialist', 'Review code for vulnerabilities and OWASP Top 10 risks.', '{"model": "gpt-4"}'
) ON CONFLICT (id) DO NOTHING;

-- Env 4: Creative
INSERT INTO agents (id, env_id, name, role, system_prompt, model_override) VALUES (
    '4d4d4d4d-4d4d-4d4d-4d4d-4d4d4d4d4d4d', '44444444-4444-4444-4444-444444444444',
    'Trend Scouter', 'Market Analyst', 'Identify emerging trends from the provided news sources.', '{}'
) ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 5. ACCESS CONTROL (Sharing)
-- =========================================================================
-- Share Engineering Env with another user (simulated)
INSERT INTO environment_access (env_id, user_id, role) VALUES (
    '22222222-2222-2222-2222-222222222222', 'another-user-uuid', 'VIEWER'
) ON CONFLICT DO NOTHING;
