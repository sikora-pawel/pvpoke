#!/usr/bin/env node

/**
 * CLI tool for generating per-scenario PvPoke rankings
 * Generates: leads, closers, switches, chargers, attackers, overall, consistency
 *
 * This is separate from generate-rankings.js (which generates full matchup SQLite DBs).
 * This script produces the per-role JSON files the mobile app uses for ranking lists.
 *
 * Usage:
 *   node generate-scenario-rankings.js                     # All cups
 *   node generate-scenario-rankings.js --cups=all,love     # Specific cups
 */

const fs = require('fs');
const path = require('path');
const { setupGlobals, DATA_PATH } = require('./mocks');

// Setup browser mocks before loading PvPoke scripts
setupGlobals();

// Paths
const JS_PATH = path.join(__dirname, '../../src/js');
const OUTPUT_BASE = path.join(DATA_PATH, 'rankings');

// Parse command line arguments
const args = process.argv.slice(2);
const cupArg = args.find(a => a.startsWith('--cup=') || a.startsWith('--cups='));
const requestedCups = cupArg ? cupArg.split('=')[1].split(',') : null;

console.log('='.repeat(60));
console.log('PvPoke Per-Scenario Rankings Generator');
console.log('='.repeat(60));
console.log(`Output: ${OUTPUT_BASE}`);
console.log('');

/**
 * Load PvPoke JavaScript files in correct order.
 * Uses Ranker.js (per-scenario) with injected CLI helper methods.
 */
function loadPvPokeScripts() {
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
        // Ranker.js produces compact per-scenario format (top 5 matchups/counters)
        // We inject CLI helper methods (setCP, setCup, etc.) at load time
        { file: 'battle/rankers/Ranker.js', exports: [{ name: 'RankerMaster', isClass: false }], inject: true }
    ];

    console.log('Loading PvPoke scripts...');

    for (const { file, exports: fileExports, inject } of scripts) {
        const scriptPath = path.join(JS_PATH, file);
        try {
            let code = fs.readFileSync(scriptPath, 'utf8');

            // Inject CLI helper methods into Ranker.js to expose private battle/rankingData
            if (inject) {
                code = code.replace(
                    'var self = this;',
                    `var self = this;
                    this.setCP = function(cp){ battle.setCP(cp); };
                    this.setCup = function(cupName){ battle.setCup(cupName); };
                    this.setRankingData = function(data){ rankingData = data; };
                    this.setLevelCap = function(lc){ battle.setLevelCap(lc); };
                    this.getPokemonList = function(){ return pokemonList; };`
                );
            }

            for (const exp of fileExports) {
                if (exp.isClass) {
                    code = code + `\n;global.${exp.name} = ${exp.name};`;
                }
            }

            (0, eval)(code);

            for (const exp of fileExports) {
                if (!exp.isClass) {
                    global[exp.name] = (0, eval)(exp.name);
                }
            }

            console.log(`  + ${file}${inject ? ' (with CLI helpers)' : ''}`);
        } catch (err) {
            console.error(`  ! Failed to load ${file}: ${err.message}`);
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

    const mainLeagues = [
        { title: 'Great League', cup: 'all', cp: 1500 },
        { title: 'Ultra League', cup: 'all', cp: 2500 },
        { title: 'Master League', cup: 'all', cp: 10000 }
    ];

    const activeCups = formats.filter(f =>
        f.showFormat && !f.hideRankings && f.cup !== 'custom'
    );

    return [...mainLeagues, ...activeCups];
}

function discoverCupVariants(cupName) {
    const cupDir = path.join(DATA_PATH, 'rankings', cupName, 'overall');
    const variants = [];
    if (fs.existsSync(cupDir)) {
        for (const file of fs.readdirSync(cupDir)) {
            const match = file.match(/^rankings-(\d+)\.json$/);
            if (match) {
                variants.push({ title: `${cupName} (${match[1]} CP)`, cup: cupName, cp: parseInt(match[1]) });
            }
        }
    }
    return variants;
}

function parseCupArg(arg, allCups) {
    if (arg === 'all') return allCups;
    if (arg.includes(':')) {
        const [cup, cpStr] = arg.split(':');
        return [{ title: `${cup} (${cpStr} CP)`, cup, cp: parseInt(cpStr) }];
    }
    const variants = discoverCupVariants(arg);
    if (variants.length > 0) return variants;
    return allCups.filter(c => c.cup === arg);
}

/**
 * Generate per-scenario rankings for a single cup/league combination
 */
function generateScenarioRankings(cup, cp) {
    console.log(`\nGenerating: ${cup.title || cup.cup} (CP: ${cp})`);
    const startTime = Date.now();

    try {
        const ranker = RankerMaster.getInstance();
        const gm = GameMaster.getInstance();

        // Load existing overall rankings for moveset selection
        const existingPath = path.join(DATA_PATH, `rankings/${cup.cup}/overall/rankings-${cp}.json`);
        let rankingData = null;
        if (fs.existsSync(existingPath)) {
            try {
                rankingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
                console.log(`  Loaded existing rankings (${rankingData.length} Pokemon) for moveset selection`);
            } catch (e) {
                console.log('  (No existing rankings data)');
            }
        }

        // Configure ranker
        ranker.setCP(cp);
        ranker.setCup(cup.cup);
        if (cup.levelCap) ranker.setLevelCap(cup.levelCap);
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

        ranker.initPokemonList(cp);

        const scenarios = gm.data.rankingScenarios;
        if (!scenarios || scenarios.length === 0) {
            throw new Error('No ranking scenarios found in gamemaster');
        }

        // Track per-scenario scores for overall computation
        const speciesScores = new Map();

        // Generate each scenario
        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            console.log(`  Scenario: ${scenario.slug}`);

            const rankings = ranker.rank(cp, scenario);

            // Save per-scenario file
            const outputDir = path.join(OUTPUT_BASE, cup.cup, scenario.slug);
            fs.mkdirSync(outputDir, { recursive: true });
            const jsonPath = path.join(outputDir, `rankings-${cp}.json`);
            const jsonData = JSON.stringify(rankings);
            fs.writeFileSync(jsonPath, jsonData);

            const sizeMB = (Buffer.byteLength(jsonData) / 1024 / 1024).toFixed(2);
            console.log(`    ${rankings.length} Pokemon (${sizeMB} MB)`);

            // Collect scores for overall computation
            for (const entry of rankings) {
                if (!speciesScores.has(entry.speciesId)) {
                    speciesScores.set(entry.speciesId, {
                        scores: [],
                        speciesId: entry.speciesId,
                        speciesName: entry.speciesName,
                        moveset: entry.moveset,
                        matchups: entry.matchups,
                        counters: entry.counters,
                        moves: entry.moves
                    });
                }
                speciesScores.get(entry.speciesId).scores.push(entry.score);
            }
        }

        // Build stats map from Pokemon objects
        const statsMap = new Map();
        const pokemonList = ranker.getPokemonList();
        for (const pokemon of pokemonList) {
            statsMap.set(pokemon.speciesId, {
                product: Math.round(pokemon.stats.atk * pokemon.stats.def * pokemon.stats.hp * (1/1000)),
                atk: Math.floor(pokemon.stats.atk * 10) / 10,
                def: Math.floor(pokemon.stats.def * 10) / 10,
                hp: pokemon.stats.hp
            });
        }

        // Compute overall and consistency
        computeOverallAndConsistency(cup, cp, speciesScores, statsMap);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Done in ${elapsed}s`);
        return true;
    } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        return false;
    }
}

/**
 * Compute overall and consistency rankings from per-scenario scores.
 * Simplified version of RankerOverall.js logic.
 */
function computeOverallAndConsistency(cup, cp, speciesScores, statsMap) {
    // --- Overall ---
    const overallRankings = [];

    for (const [id, data] of speciesScores) {
        const scores = data.scores;
        if (scores.length < 2) continue;

        // Sort scores descending for weighted geometric mean
        const sorted = [...scores].sort((a, b) => b - a);

        // Weighted geometric mean (approximation of RankerOverall formula)
        // Top scores weighted more heavily: exponents 12, 6, 4, 2
        let overall;
        if (sorted.length >= 4) {
            overall = Math.pow(
                Math.pow(Math.max(sorted[0], 0.1), 12) *
                Math.pow(Math.max(sorted[1], 0.1), 6) *
                Math.pow(Math.max(sorted[2], 0.1), 4) *
                Math.pow(Math.max(sorted[3], 0.1), 2),
                1/24
            );
        } else {
            overall = Math.pow(
                scores.reduce((acc, s) => acc * Math.max(s, 0.1), 1),
                1/scores.length
            );
        }

        overallRankings.push({
            speciesId: data.speciesId,
            speciesName: data.speciesName,
            rating: Math.floor(overall * 10),
            score: Math.floor(overall * 10) / 10,
            moveset: data.moveset,
            matchups: data.matchups || [],
            counters: data.counters || [],
            moves: data.moves
        });
    }

    overallRankings.sort((a, b) => b.score - a.score);

    // Scale to 0-100
    if (overallRankings.length > 0) {
        const highest = overallRankings[0].score;
        for (const r of overallRankings) {
            r.score = Math.floor((r.score / highest) * 1000) / 10;
            r.rating = Math.floor(r.score * 10);
        }
    }

    // --- Consistency ---
    const consistencyRankings = [];
    for (const [id, data] of speciesScores) {
        const scores = data.scores;
        if (scores.length < 2) continue;

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, s) => a + Math.pow(s - avg, 2), 0) / scores.length;
        const consistency = Math.max(0, avg - Math.sqrt(variance) * 0.5);

        consistencyRankings.push({
            speciesId: data.speciesId,
            speciesName: data.speciesName,
            rating: Math.floor(consistency * 10),
            score: Math.floor(consistency * 10) / 10,
            moveset: data.moveset,
            matchups: data.matchups || [],
            counters: data.counters || [],
            moves: data.moves
        });
    }

    consistencyRankings.sort((a, b) => b.score - a.score);

    if (consistencyRankings.length > 0) {
        const highest = consistencyRankings[0].score;
        for (const r of consistencyRankings) {
            r.score = Math.floor((r.score / highest) * 1000) / 10;
            r.rating = Math.floor(r.score * 10);
        }
    }

    // --- Build scores arrays for overall rankings ---
    // scores = [leads, closers, switches, chargers, attackers, consistency]
    const consistencyMap = new Map();
    for (const r of consistencyRankings) {
        consistencyMap.set(r.speciesId, r.score);
    }
    for (const r of overallRankings) {
        const data = speciesScores.get(r.speciesId);
        if (data) {
            const scenarioScores = data.scores.map(s => Math.floor(s * 10) / 10);
            r.scores = [...scenarioScores, consistencyMap.get(r.speciesId) || 0];
        }
        const stats = statsMap.get(r.speciesId);
        if (stats) {
            r.stats = stats;
        }
    }

    // --- Write files ---
    const overallDir = path.join(OUTPUT_BASE, cup.cup, 'overall');
    fs.mkdirSync(overallDir, { recursive: true });
    fs.writeFileSync(path.join(overallDir, `rankings-${cp}.json`), JSON.stringify(overallRankings));
    console.log(`  overall: ${overallRankings.length} Pokemon`);

    const consistencyDir = path.join(OUTPUT_BASE, cup.cup, 'consistency');
    fs.mkdirSync(consistencyDir, { recursive: true });
    fs.writeFileSync(path.join(consistencyDir, `rankings-${cp}.json`), JSON.stringify(consistencyRankings));
    console.log(`  consistency: ${consistencyRankings.length} Pokemon`);
}

/**
 * Main execution
 */
async function main() {
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });
    loadPvPokeScripts();

    console.log('Waiting for GameMaster to load...');
    const gm = GameMaster.getInstance();

    await new Promise(resolve => {
        const check = () => {
            if (gm.data && gm.data.pokemon && gm.data.pokemon.length > 0) {
                console.log(`GameMaster loaded: ${gm.data.pokemon.length} Pokemon\n`);
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        setTimeout(check, 10);
    });

    const allCups = getActiveCups();
    let cupsToGenerate = [];

    if (!requestedCups || requestedCups.includes('all')) {
        cupsToGenerate = allCups;
    } else {
        for (const arg of requestedCups) {
            cupsToGenerate.push(...parseCupArg(arg, allCups));
        }
    }

    // Deduplicate
    const seen = new Set();
    cupsToGenerate = cupsToGenerate.filter(c => {
        const key = `${c.cup}:${c.cp}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`Cups to generate: ${cupsToGenerate.length}`);
    cupsToGenerate.forEach(c => console.log(`  - ${c.cup} (${c.cp})`));

    const results = [];
    for (const cup of cupsToGenerate) {
        const success = generateScenarioRankings(cup, cup.cp);
        results.push({ cup: cup.cup, cp: cup.cp, success });
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
        results.filter(r => !r.success).forEach(r => console.log(`  - ${r.cup} (${r.cp})`));
    }

    console.log('\nDone!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
