#!/usr/bin/env node

/**
 * CLI tool for generating PvPoke full rankings without a browser
 *
 * Usage:
 *   node generate-rankings.js                    # Generate all cups
 *   node generate-rankings.js --cup all         # Generate specific cup
 *   node generate-rankings.js --test            # Output to data-test directory
 *   node generate-rankings.js --cups all,aurora # Generate multiple cups
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { setupGlobals, DATA_PATH } = require('./mocks');

// Setup browser mocks before loading PvPoke scripts
setupGlobals();

// Paths
const JS_PATH = path.join(__dirname, '../../src/js');
const PHP_PATH = path.join(__dirname, '../../src/data');

// Parse command line arguments
const args = process.argv.slice(2);
const cupArg = args.find(a => a.startsWith('--cup=') || a.startsWith('--cups='));
const requestedCups = cupArg ? cupArg.split('=')[1].split(',') : null;

// Output directory - always to main data/rankings
const OUTPUT_BASE = path.join(__dirname, '../../src/data/rankings');

console.log('='.repeat(60));
console.log('PvPoke Full Rankings Generator (CLI)');
console.log('='.repeat(60));
console.log(`Output: ${OUTPUT_BASE}`);
console.log('');

/**
 * Load PvPoke JavaScript files in correct order
 * Uses indirect eval to execute in global scope
 */
function loadPvPokeScripts() {
    // Scripts with their export names
    // exports: array of { name, isClass } for each export from the file
    const scripts = [
        { file: 'GameMaster.js', exports: [{ name: 'GameMaster', isClass: false }] },
        { file: 'pokemon/Pokemon.js', exports: [{ name: 'Pokemon', isClass: false }] },
        { file: 'battle/DamageCalculator.js', exports: [
            { name: 'DamageMultiplier', isClass: true },
            { name: 'DamageCalculator', isClass: true }
        ]},
        { file: 'battle/timeline/TimelineEvent.js', exports: [{ name: 'TimelineEvent', isClass: true }] },
        { file: 'battle/timeline/TimelineAction.js', exports: [{ name: 'TimelineAction', isClass: true }] },
        { file: 'battle/actions/ActionLogic.js', exports: [{ name: 'ActionLogic', isClass: true }] },
        { file: 'battle/Battle.js', exports: [{ name: 'Battle', isClass: false }] },
        { file: 'battle/rankers/RankerFull.js', exports: [{ name: 'RankerMasterFull', isClass: false }] }
    ];

    console.log('Loading PvPoke scripts...');

    for (const { file, exports: fileExports } of scripts) {
        const scriptPath = path.join(JS_PATH, file);
        try {
            let code = fs.readFileSync(scriptPath, 'utf8');

            // For ES6 classes, add global assignments at the end
            for (const exp of fileExports) {
                if (exp.isClass) {
                    code = code + `\n;global.${exp.name} = ${exp.name};`;
                }
            }

            // Execute code - indirect eval runs in global scope
            (0, eval)(code);

            // Assign exports to global explicitly (for var/function style)
            for (const exp of fileExports) {
                if (!exp.isClass) {
                    global[exp.name] = (0, eval)(exp.name);
                }
            }

            console.log(`  + ${file}`);
        } catch (err) {
            console.error(`  ! Failed to load ${file}: ${err.message}`);
            console.error(err.stack);
            process.exit(1);
        }
    }

    console.log('');
}

/**
 * Get list of active formats/cups from formats.json
 */
function getActiveCups() {
    const formatsPath = path.join(DATA_PATH, 'gamemaster/formats.json');
    const formats = JSON.parse(fs.readFileSync(formatsPath, 'utf8'));

    // Main leagues (not in formats.json but always needed)
    const mainLeagues = [
        { title: 'Great League', cup: 'all', cp: 1500 },
        { title: 'Ultra League', cup: 'all', cp: 2500 },
        { title: 'Master League', cup: 'all', cp: 10000 }
    ];

    // Filter formats to active cups that should have rankings generated
    const activeCups = formats.filter(f =>
        f.showFormat &&
        !f.hideRankings &&
        f.cup !== 'custom'
    );

    return [...mainLeagues, ...activeCups];
}

/**
 * Discover all CP variants for a cup by scanning existing rankings directory
 */
function discoverCupVariants(cupName) {
    const cupDir = path.join(DATA_PATH, 'rankings', cupName, 'overall');
    const variants = [];

    if (fs.existsSync(cupDir)) {
        const files = fs.readdirSync(cupDir);
        for (const file of files) {
            const match = file.match(/^rankings-(\d+)\.json$/);
            if (match) {
                variants.push({
                    title: `${cupName} (${match[1]} CP)`,
                    cup: cupName,
                    cp: parseInt(match[1])
                });
            }
        }
    }

    return variants;
}

/**
 * Parse cup argument - supports:
 *   "premier" -> all CP variants of premier
 *   "premier:2500" -> specific cup:cp pair
 *   "all" -> all active cups
 */
function parseCupArg(arg, allCups) {
    if (arg === 'all') {
        return allCups;
    }

    if (arg.includes(':')) {
        // Specific cup:cp pair
        const [cup, cpStr] = arg.split(':');
        const cp = parseInt(cpStr);
        return [{ title: `${cup} (${cp} CP)`, cup, cp }];
    }

    // Cup name only - discover all variants
    const variants = discoverCupVariants(arg);
    if (variants.length > 0) {
        return variants;
    }

    // Fallback: check if it's in allCups
    return allCups.filter(c => c.cup === arg);
}

/**
 * Generate rankings for a single cup/league combination
 */
function generateRankings(cup, cp) {
    console.log(`\nGenerating: ${cup.title || cup.cup} (CP: ${cp})`);
    const startTime = Date.now();

    try {
        // Get ranker instance
        const ranker = RankerMasterFull.getInstance();
        const gm = GameMaster.getInstance();

        // Configure ranker's internal battle for this cup
        ranker.setCP(cp);
        if (cup.cup !== 'custom') {
            ranker.setCup(cup.cup);
        }
        if (cup.levelCap) {
            ranker.setLevelCap(cup.levelCap);
        }

        // Load existing rankings for moveset data (if available)
        const existingRankingsPath = path.join(DATA_PATH, `rankings/${cup.cup}/overall/rankings-${cp}.json`);
        let rankingData = null;
        if (fs.existsSync(existingRankingsPath)) {
            try {
                rankingData = JSON.parse(fs.readFileSync(existingRankingsPath, 'utf8'));
                console.log(`  Loaded existing rankings (${rankingData.length} Pokemon) for moveset selection`);
            } catch (e) {
                console.log('  (No existing rankings data)');
            }
        }

        // Pass ranking data to ranker so it can select correct movesets for _b variants
        ranker.setRankingData(rankingData);

        // Load moveset overrides (if available)
        const overridePath = path.join(DATA_PATH, `overrides/${cup.cup}/${cp}.json`);
        if (fs.existsSync(overridePath)) {
            try {
                const overrideData = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
                ranker.setMoveOverrides(cp, cup.cup, overrideData);
                console.log(`  Loaded overrides (${overrideData.length} Pokemon)`);
            } catch (e) {
                console.log(`  (Failed to load overrides: ${e.message})`);
            }
        }

        // Initialize Pokemon list
        ranker.initPokemonList(cp);

        // Get scenarios
        const scenarios = gm.data.rankingScenarios;
        if (!scenarios || scenarios.length === 0) {
            throw new Error('No ranking scenarios found in gamemaster');
        }

        // Generate rankings (using first scenario - typically "leads" with 1v1 shields)
        console.log(`  Scenario: ${scenarios[0].slug}`);
        const rankings = ranker.rank(cp, scenarios[0]);

        // Prepare output
        const outputDir = path.join(OUTPUT_BASE, cup.cup, 'full');
        fs.mkdirSync(outputDir, { recursive: true });

        const jsonPath = path.join(outputDir, `rankings-${cp}.json`);
        const jsonData = JSON.stringify(rankings);
        fs.writeFileSync(jsonPath, jsonData);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const sizeMB = (Buffer.byteLength(jsonData) / 1024 / 1024).toFixed(2);
        console.log(`  Done in ${elapsed}s (${sizeMB} MB)`);

        return jsonPath;
    } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        return null;
    }
}

/**
 * Convert JSON to SQLite and compress
 */
function convertToSqlite(jsonPath) {
    const dbPath = jsonPath.replace('.json', '.db');
    const phpScript = path.join(PHP_PATH, 'json_to_sqlite.php');
    const phpIni = path.join(__dirname, '../../src/php.ini');

    console.log('  Converting to SQLite...');

    try {
        // Run PHP conversion script
        const cmd = `php -c "${phpIni}" "${phpScript}" "${jsonPath}" "${dbPath}"`;
        execSync(cmd, { stdio: 'pipe' });

        // Compress with gzip
        console.log('  Compressing...');
        execSync(`gzip -f -k "${dbPath}"`, { stdio: 'pipe' });

        const gzSize = fs.statSync(dbPath + '.gz').size;
        console.log(`  SQLite: ${(gzSize / 1024 / 1024).toFixed(2)} MB (compressed)`);

        return dbPath + '.gz';
    } catch (err) {
        console.error(`  Conversion error: ${err.message}`);
        return null;
    }
}

/**
 * Main execution
 */
async function main() {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });

    // Load PvPoke scripts
    loadPvPokeScripts();

    // Wait for GameMaster to load (async ajax call)
    console.log('Waiting for GameMaster to load...');
    const gm = GameMaster.getInstance();

    // Wait until GameMaster has data loaded
    await new Promise(resolve => {
        const checkLoaded = () => {
            if (gm.data && gm.data.pokemon && gm.data.pokemon.length > 0) {
                console.log(`GameMaster loaded: ${gm.data.pokemon.length} Pokemon\n`);
                resolve();
            } else {
                setTimeout(checkLoaded, 50);
            }
        };
        // Start checking after a brief delay to allow setImmediate to run
        setTimeout(checkLoaded, 10);
    });

    // Get cups to generate
    const allCups = getActiveCups();
    let cupsToGenerate = [];

    if (!requestedCups || requestedCups.includes('all')) {
        // No --cup arg or --cup=all means generate all active cups
        cupsToGenerate = allCups;
    } else {
        // Parse each requested cup (supports "premier", "premier:2500", etc.)
        for (const cupArg of requestedCups) {
            const parsed = parseCupArg(cupArg, allCups);
            cupsToGenerate.push(...parsed);
        }
    }

    // Remove duplicates (same cup + cp)
    const seen = new Set();
    cupsToGenerate = cupsToGenerate.filter(c => {
        const key = `${c.cup}:${c.cp}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`\nCups to generate: ${cupsToGenerate.length}`);
    cupsToGenerate.forEach(c => console.log(`  - ${c.cup} (${c.cp})`));

    // Generate rankings for each cup
    const results = [];
    for (const cup of cupsToGenerate) {
        const jsonPath = generateRankings(cup, cup.cp);
        if (jsonPath) {
            const gzPath = convertToSqlite(jsonPath);
            results.push({
                cup: cup.cup,
                cp: cup.cp,
                success: !!gzPath,
                output: gzPath
            });
        } else {
            results.push({
                cup: cup.cup,
                cp: cup.cp,
                success: false
            });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\nFailed cups:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.cup} (${r.cp})`);
        });
        process.exit(1);
    }

    console.log('\nDone!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
