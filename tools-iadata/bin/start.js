#!/usr/bin/env node

/**
 * start.js - Tools IADATA Docker Environment Manager (Cross-Platform)
 * Usage: node start.js [dev|stg|prd]
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const readline = require('readline');

// 1. Determine Project Root
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// Helper: ANSI colors
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

// Helper: Prompt
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));
const pause = async () => {
    await ask("\nPress Enter to continue...");
};
const clear = () => console.clear();

// 2. Argument Parsing / Environment Detection
let targetEnv = process.argv[2];

async function detectEnv() {
    if (targetEnv) return targetEnv.toLowerCase();

    const envFiles = [
        { id: 'dev', path: path.join(PROJECT_ROOT, '.env.dev') },
        { id: 'stg', path: path.join(PROJECT_ROOT, '.env.stg') },
        { id: 'prd', path: path.join(PROJECT_ROOT, '.env.prd') }
    ];

    const found = envFiles.filter(f => fs.existsSync(f.path));

    if (found.length === 1) {
        console.log(`${colors.cyan}Auto-detected environment: ${found[0].id}${colors.reset}`);
        return found[0].id;
    }

    if (found.length === 0) {
        console.error(`${colors.red}❌ No .env files found in ${PROJECT_ROOT}${colors.reset}`);
        console.error("Please copy .env.example to .env.dev, .env.stg, or .env.prd");
        process.exit(1);
    }

    console.log("Multiple environments found. Select one:");
    found.forEach((f, i) => console.log(`${i + 1}) ${f.id.toUpperCase()}`));

    const ans = await ask('Select option: ');
    const idx = parseInt(ans) - 1;
    if (found[idx]) return found[idx].id;

    console.error("Invalid option");
    process.exit(1);
}

// 3. Main Logic
(async () => {
    targetEnv = await detectEnv();

    const config = {
        composeFile: path.join(PROJECT_ROOT, `docker-compose.${targetEnv}.yml`),
        envFile: path.join(PROJECT_ROOT, `.env.${targetEnv}`),
    };

    if (!fs.existsSync(config.envFile)) {
        console.error(`${colors.red}❌ Environment file not found: ${config.envFile}${colors.reset}`);
        process.exit(1);
    }

    // Load Env Vars needed for setup
    const envContent = fs.readFileSync(config.envFile, 'utf8');
    const getVar = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
    };

    const PROJ_NAME = getVar('COMPOSE_PROJECT_NAME') || 'tools-iadata';
    const DEPLOY_SUFFIX = (getVar('DEPLOY_SUFFIX') || '').toLowerCase();
    let BACKUP_DIR = getVar('BACKUP_DIR') || `./backups_${DEPLOY_SUFFIX}`;
    let IMPORT_DIR = getVar('IMPORT_DIR') || `./data/import`;
    let USE_LOCAL_EMBEDDING = (getVar('USE_LOCAL_EMBEDDING') || 'false').toLowerCase() === 'true';

    // Enable Docker Compose Profile for LLM if enabled
    if (USE_LOCAL_EMBEDDING) {
        process.env.COMPOSE_PROFILES = 'local-llm';
        console.log(`${colors.green}🟢 Local LLM Stack Enabled${colors.reset}`);
    }

    // Resolve relative paths
    if (!path.isAbsolute(BACKUP_DIR)) BACKUP_DIR = path.resolve(PROJECT_ROOT, BACKUP_DIR);
    if (!path.isAbsolute(IMPORT_DIR)) IMPORT_DIR = path.resolve(PROJECT_ROOT, IMPORT_DIR);

    const VOL_PREFIX = `${PROJ_NAME}_`;
    const PG_VOLUME = `${VOL_PREFIX}plpg_data`;
    const QDRANT_VOLUME = `${VOL_PREFIX}qdrant_data`;

    // Detect Docker Compose Command
    let DOCKER_COMPOSE = 'docker';
    let DOCKER_ARGS = ['compose'];
    try {
        execSync('docker compose version', { stdio: 'ignore' });
    } catch {
        try {
            execSync('docker-compose version', { stdio: 'ignore' });
            DOCKER_COMPOSE = 'docker-compose';
            DOCKER_ARGS = [];
        } catch {
            console.error("ERROR: Neither 'docker compose' nor 'docker-compose' found.");
            process.exit(1);
        }
    }

    // --- Actions ---

    const ensureDirectories = () => {
        [BACKUP_DIR, IMPORT_DIR].forEach(d => {
            if (!fs.existsSync(d)) {
                console.log(`Creating directory: ${d}`);
                fs.mkdirSync(d, { recursive: true });
            }
        });
    };

    const ensureVolumes = () => {
        console.log("Checking external volumes...");
        [PG_VOLUME, QDRANT_VOLUME].forEach(vol => {
            try {
                execSync(`docker volume inspect ${vol}`, { stdio: 'ignore' });
                console.log(`${colors.green}✓ Volume exists: ${vol}${colors.reset}`);
            } catch {
                console.log(`Creating missing external volume: ${vol}`);
                execSync(`docker volume create ${vol}`);
                console.log(`${colors.green}✓ Volume created: ${vol}${colors.reset}`);
            }
        });
    };

    const pruneAnonymous = () => {
        console.log("Pruning unused anonymous volumes...");
        try {
            const protectedVols = [PG_VOLUME, QDRANT_VOLUME, 'plpg_data', 'qdrant_data'];
            const dangling = execSync('docker volume ls -q -f dangling=true').toString().split('\n').filter(Boolean);

            dangling.forEach(vol => {
                if (protectedVols.some(p => vol.includes(p))) {
                    console.log(`⚠️  PROTECTED: Skipping critical volume: ${vol}`);
                    return;
                }
                execSync(`docker volume rm ${vol}`, { stdio: 'ignore' });
                console.log(`Removed: ${vol}`);
            });
        } catch (e) {
            // ignore
        }
        console.log("Pruning complete.");
    };

    const runCompose = (cmd, args = [], capture = false) => {
        const allArgs = [...DOCKER_ARGS, '-f', config.composeFile, '--env-file', config.envFile, cmd, ...args];
        if (capture) {
            return execSync(`${DOCKER_COMPOSE} ${allArgs.join(' ')}`).toString();
        }
        // Inherit stdio
        const proc = spawn(DOCKER_COMPOSE, allArgs, { stdio: 'inherit', shell: true });
        return new Promise((resolve, reject) => {
            proc.on('close', resolve);
            proc.on('error', reject);
        });
    };

    // Pre-acquire LLM models before starting app stack
    const ensureLlmModels = async () => {
        if (!USE_LOCAL_EMBEDDING) return;

        console.log(`\n${colors.cyan}🤖 Pre-acquiring LLM models...${colors.reset}`);

        const EMBED_MODEL = getVar('LOCAL_EMBEDDING_MODEL_NAME') || 'bge-m3';
        const CHAT_MODEL = getVar('LOCAL_MODEL_NAME') || 'qwen2.5:7b';
        const LLM_CONTAINER = `iadata_llm_${DEPLOY_SUFFIX}`;

        // Step 1: Start only llm-dl
        console.log('Starting Ollama container...');
        await runCompose('up', ['-d', 'llm-dl']);

        // Step 2: Wait for Ollama to be healthy
        console.log('Waiting for Ollama to become ready...');
        const maxWait = 120;
        let waited = 0;
        while (waited < maxWait) {
            try {
                execSync(`docker exec ${LLM_CONTAINER} curl -sf http://localhost:11434/api/tags`, { stdio: 'ignore' });
                console.log(`${colors.green}✓ Ollama is ready.${colors.reset}`);
                break;
            } catch {
                await new Promise(r => setTimeout(r, 2000));
                waited += 2;
                console.log(`  ... waiting (${waited}/${maxWait} seconds)`);
            }
        }

        if (waited >= maxWait) {
            console.log(`${colors.yellow}⚠️  Warning: Ollama did not become ready in time. Continuing anyway...${colors.reset}`);
            return;
        }

        // Step 3: Pull models
        console.log(`Pulling embedding model: ${EMBED_MODEL}...`);
        try {
            execSync(`docker exec ${LLM_CONTAINER} ollama pull ${EMBED_MODEL}`, { stdio: 'inherit' });
        } catch {
            console.log(`${colors.yellow}⚠️  Failed to pull ${EMBED_MODEL}${colors.reset}`);
        }

        console.log(`Pulling chat model: ${CHAT_MODEL}...`);
        try {
            execSync(`docker exec ${LLM_CONTAINER} ollama pull ${CHAT_MODEL}`, { stdio: 'inherit' });
        } catch {
            console.log(`${colors.yellow}⚠️  Failed to pull ${CHAT_MODEL}${colors.reset}`);
        }

        console.log(`${colors.green}✅ LLM models pre-acquired.${colors.reset}\n`);
    };

    // --- Menus ---

    const up = async () => {
        clear();
        ensureDirectories();
        ensureVolumes();
        await ensureLlmModels();
        console.log(`Bringing up environment (${targetEnv})...`);
        await runCompose('up', ['-d', '--build']);
        pruneAnonymous();
        console.log(`\n${colors.green}✅ Environment is up!${colors.reset}`);
        await runCompose('ps');
        await pause();
    };

    const build = async () => {
        clear();
        console.log("Building images...");
        await runCompose('build');
        console.log("Build complete.");
        await pause();
    };

    const down = async () => {
        clear();
        console.log("Stopping environment...");
        await runCompose('down', ['--remove-orphans']);
        pruneAnonymous();
        console.log("Environment stopped.");
        await pause();
    };

    const restart = async () => {
        clear();
        console.log("Restarting environment...");
        await runCompose('restart');
        console.log("Restart complete.");
        await pause();
    };

    const logs = async () => {
        clear();
        console.log("Logs (Ctrl+C to exit)...");
        try {
            await runCompose('logs', ['-f', '--tail=100']);
        } catch (e) {
            // ignore
        }
    };

    // --- Main Loop ---
    while (true) {
        clear();
        console.log("=========================================");
        console.log(`   IADATA Manager: ${targetEnv}`);
        console.log("=========================================");
        console.log(" 1. Up (Build & Start)");
        console.log(" 2. Down (Stop)");
        console.log(" 3. Build (No Start)");
        console.log(" 4. Restart");
        console.log(" 5. View Logs");
        console.log(" 0. Exit");
        console.log("=========================================");

        const opt = await ask("Select: ");
        switch (opt) {
            case '1': await up(); break;
            case '2': await down(); break;
            case '3': await build(); break;
            case '4': await restart(); break;
            case '5': await logs(); break;
            case '0': process.exit(0); break;
        }
    }

})();
