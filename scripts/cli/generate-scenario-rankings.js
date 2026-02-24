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
        computeOverallAndConsistency(cup, cp, speciesScores, pokemonList, statsMap);

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
 * Matches the real RankerOverall.js algorithm including:
 * - Correct weighted geometric mean with max(switches, chargers)
 * - Consistency via Pokemon.calculateConsistency()
 * - Editor score blending (75% editor / 25% algorithmic)
 * - Penalty for low attacker + consistency scores
 */
function computeOverallAndConsistency(cup, cp, speciesScores, pokemonList, statsMap) {
    const battle = new Battle();
    battle.setCP(cp);
    battle.setCup(cup.cup);

    // Load overrides for editor scores
    let overrideData = null;
    const overridePath = path.join(DATA_PATH, `overrides/${cup.cup}/${cp}.json`);
    if (fs.existsSync(overridePath)) {
        try {
            overrideData = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
        } catch (e) { /* ignore */ }
    }
    const overrideMap = new Map();
    if (overrideData) {
        for (const o of overrideData) {
            overrideMap.set(o.speciesId, o);
        }
    }

    // --- Overall ---
    const overallRankings = [];

    for (const [id, data] of speciesScores) {
        // scores order: [leads, closers, switches, chargers, attackers]
        const scores = data.scores;
        if (scores.length < 5) continue;

        // Calculate consistency via Pokemon.calculateConsistency()
        let consistencyScore = 100;
        try {
            const pokemon = new Pokemon(data.speciesId, 0, battle);
            if (pokemon.initialize) {
                pokemon.initialize(true);
                pokemon.selectMove("fast", data.moveset[0]);
                pokemon.selectMove("charged", data.moveset[1], 0);
                if (data.moveset.length > 2) {
                    pokemon.selectMove("charged", data.moveset[2], 1);
                }
                consistencyScore = pokemon.calculateConsistency();
            }
        } catch (e) {
            // Fallback: use simple average
            consistencyScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // RankerOverall formula: take 4 scores from 5 scenarios
        // leads, closers, max(switches, chargers), attackers → sort descending
        const fourScores = [
            scores[0],                          // leads
            scores[1],                          // closers
            Math.max(scores[2], scores[3]),     // max(switches, chargers)
            scores[4]                           // attackers
        ];
        fourScores.sort((a, b) => b - a);

        // Weighted geometric mean: s[0]^12 * s[1]^6 * s[2]^4 * s[3]^2 * consistency^2 → ^(1/26)
        let overall = Math.pow(
            Math.pow(fourScores[0], 12) *
            Math.pow(fourScores[1], 6) *
            Math.pow(fourScores[2], 4) *
            Math.pow(fourScores[3], 2) *
            Math.pow(consistencyScore, 2),
            1/26
        );

        // Penalty for low attackers AND low consistency
        if (scores[4] <= 75 && consistencyScore <= 75) {
            overall = Math.pow(
                Math.pow(overall, 14) *
                Math.pow(scores[4], 1) *
                Math.pow(consistencyScore, 1),
                1/16
            );
        }

        // Apply editor score blending (75% editor / 25% algorithmic)
        const override = overrideMap.get(data.speciesId);
        let editorScore = null;
        let editorNotes = null;
        if (override) {
            if (override.editorScore) {
                editorScore = override.editorScore;
                overall = (overall * 0.25) + (editorScore * 0.75);
            }
            if (override.editorNotes) {
                editorNotes = override.editorNotes;
            }
        }

        const entry = {
            speciesId: data.speciesId,
            speciesName: data.speciesName,
            rating: Math.floor(overall * 10),
            score: Math.floor(overall * 10) / 10,
            moveset: data.moveset,
            matchups: data.matchups || [],
            counters: data.counters || [],
            moves: data.moves,
            scores: [
                ...scores.map(s => Math.floor(s * 10) / 10),
                Math.floor(consistencyScore * 10) / 10
            ]
        };

        if (editorScore) entry.editorScore = editorScore;
        if (editorNotes) entry.editorNotes = editorNotes;

        const stats = statsMap.get(data.speciesId);
        if (stats) entry.stats = stats;

        overallRankings.push(entry);
    }

    overallRankings.sort((a, b) => b.score - a.score);

    // --- Consistency rankings (from calculateConsistency scores already computed) ---
    const consistencyRankings = overallRankings.map(r => ({
        speciesId: r.speciesId,
        speciesName: r.speciesName,
        rating: 0,
        score: r.scores[5], // consistency is the 6th element
        moveset: r.moveset,
        matchups: r.matchups,
        counters: r.counters,
        moves: r.moves
    }));

    consistencyRankings.sort((a, b) => b.score - a.score);

    // Scale consistency to 0-100
    if (consistencyRankings.length > 0) {
        const highest = consistencyRankings[0].score;
        for (const r of consistencyRankings) {
            r.score = highest > 0 ? Math.floor((r.score / highest) * 1000) / 10 : 0;
            r.rating = Math.floor(r.score * 10);
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
