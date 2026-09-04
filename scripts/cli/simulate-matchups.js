#!/usr/bin/env node

/**
 * CLI tool for running individual PvPoke matchups headlessly.
 *
 * Produces reference numbers (battle ratings, winner, duration, turns to win,
 * timeline) for a list of matchups, so the iOS/Android ports can be verified
 * against the pvpoke simulator itself.
 *
 * Usage:
 *   node simulate-matchups.js --cases=path/to/cases.json --out=path/to/out.json
 *   node simulate-matchups.js --cases=cases.json --timeline   # include full timeline
 *
 * Case file format (array):
 *   [
 *     { "id": "mgl_malamar_mega_vs_lickilicky_1_1",
 *       "cup": "mega", "cp": 1500,
 *       "pokemon1": "malamar_mega", "pokemon2": "lickilicky",
 *       "shields1": 1, "shields2": 1 }
 *   ]
 *
 * Movesets are taken from src/data/rankings/<cup>/overall/rankings-<cp>.json
 * exactly the way GameMaster.generateFilteredPokemonList does it (fast, two
 * charged, and the mega-exclusive third one in the extra-charged slot), so the
 * numbers correspond to what the app gets from the shipped rankings.
 */

const fs = require('fs');
const path = require('path');
const { setupGlobals, DATA_PATH } = require('./mocks');

setupGlobals();

const JS_PATH = path.join(__dirname, '../../src/js');

const args = process.argv.slice(2);
const argValue = (name) => {
	const arg = args.find(a => a.startsWith(`--${name}=`));
	return arg ? arg.split('=').slice(1).join('=') : null;
};

const casesPath = argValue('cases');
const outPath = argValue('out');
const includeTimeline = args.includes('--timeline');
const includeDecisionLog = args.includes('--decision-log');

if (!casesPath) {
	console.error('Usage: node simulate-matchups.js --cases=<file.json> [--out=<file.json>] [--timeline] [--decision-log]');
	process.exit(1);
}

/**
 * Load PvPoke JavaScript files in correct order (same list as generate-rankings.js).
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
		{ file: 'battle/Battle.js', exports: [{ name: 'Battle', isClass: false }] }
	];

	for (const { file, exports: fileExports } of scripts) {
		const scriptPath = path.join(JS_PATH, file);
		try {
			let code = fs.readFileSync(scriptPath, 'utf8');

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
		} catch (err) {
			console.error(`  ! Failed to load ${file}: ${err.message}`);
			console.error(err.stack);
			process.exit(1);
		}
	}
}

const rankingCache = {};

function getRankings(cup, cp) {
	const key = `${cup}:${cp}`;
	if (!(key in rankingCache)) {
		const file = path.join(DATA_PATH, `rankings/${cup}/overall/rankings-${cp}.json`);
		rankingCache[key] = fs.existsSync(file)
			? JSON.parse(fs.readFileSync(file, 'utf8'))
			: null;
	}
	return rankingCache[key];
}

/**
 * Apply the ranking moveset to a Pokemon, mirroring GameMaster.generateFilteredPokemonList.
 */
function applyMoveset(pokemon, cup, cp) {
	const rankings = getRankings(cup, cp);
	const entry = rankings ? rankings.find(e => e.speciesId === pokemon.speciesId) : null;
	const moveset = entry ? entry.moveset : null;

	if (moveset && moveset.length >= 2) {
		pokemon.selectMove('fast', moveset[0]);
		pokemon.selectMove('charged', moveset[1], 0);

		if (moveset.length > 2) {
			pokemon.selectMove('charged', moveset[2], 1);
		}

		if (moveset.length > 3 && pokemon.hasThirdChargedMove()) {
			pokemon.selectMove('extra-charged', moveset[3], 2);
		}
	} else {
		pokemon.autoSelectMoves();
	}

	return moveset;
}

function describeMoveset(pokemon) {
	return {
		fast: pokemon.fastMove ? pokemon.fastMove.moveId : null,
		charged: pokemon.chargedMoves.filter(m => m).map(m => m.moveId),
		active: pokemon.activeChargedMoves.filter(m => m).map(m => `${m.moveId}(e${m.energy},d${m.damage},dpe${(m.dpe || 0).toFixed(2)})`)
	};
}

function runCase(testCase) {
	const cp = testCase.cp || 1500;
	const cup = testCase.cup || 'all';

	const battle = new Battle();
	battle.setCP(cp);
	battle.setCup(cup);

	const poke1 = new Pokemon(testCase.pokemon1, 0, battle);
	const poke2 = new Pokemon(testCase.pokemon2, 1, battle);

	if (!poke1.speciesId || !poke2.speciesId) {
		return { id: testCase.id, error: 'Pokemon not found' };
	}

	applyMoveset(poke1, cup, cp);
	applyMoveset(poke2, cup, cp);

	battle.setNewPokemon(poke1, 0, true);
	battle.setNewPokemon(poke2, 1, true);

	poke1.setShields(testCase.shields1);
	poke2.setShields(testCase.shields2);

	if (includeDecisionLog) {
		battle.setDebugMode(true);
	}

	battle.simulate();

	const winner = battle.getWinner();
	const winnerIndex = winner && winner.pokemon ? winner.pokemon.index : null;

	const result = {
		id: testCase.id,
		cup,
		cp,
		shields: [testCase.shields1, testCase.shields2],
		pokemon: [
			{
				speciesId: poke1.speciesId,
				level: poke1.level,
				ivs: [poke1.ivs.atk, poke1.ivs.def, poke1.ivs.hp],
				cp: poke1.cp,
				hp: poke1.startHp,
				megaLevel: poke1.hasTag('mega') ? poke1.megaLevel : 0,
				moveset: describeMoveset(poke1)
			},
			{
				speciesId: poke2.speciesId,
				level: poke2.level,
				ivs: [poke2.ivs.atk, poke2.ivs.def, poke2.ivs.hp],
				cp: poke2.cp,
				hp: poke2.startHp,
				megaLevel: poke2.hasTag('mega') ? poke2.megaLevel : 0,
				moveset: describeMoveset(poke2)
			}
		],
		battleRatings: battle.getBattleRatings(),
		winnerIndex,
		winnerHp: winner && winner.pokemon ? winner.pokemon.hp : null,
		winnerEnergy: winner && winner.pokemon ? winner.pokemon.energy : null,
		duration: battle.getDuration(),
		displayTime: battle.getDisplayTime(),
		turnsToWin: battle.getTurnsToWin()
	};

	if (includeDecisionLog) {
		const lines = [];
		const originalLog = console.log;
		console.log = (...args) => lines.push(args.join(' '));
		battle.debug();
		console.log = originalLog;
		result.decisionLog = lines;
	}

	if (includeTimeline) {
		result.timeline = battle.getTimeline().map(e => ({
			type: e.type,
			name: e.name,
			actor: e.actor,
			time: e.time,
			turn: e.turn,
			values: e.values
		}));
	}

	return result;
}

async function main() {
	loadPvPokeScripts();

	const gm = GameMaster.getInstance();

	await new Promise(resolve => {
		const checkLoaded = () => {
			if (gm.data && gm.data.pokemon && gm.data.pokemon.length > 0) {
				resolve();
			} else {
				setTimeout(checkLoaded, 50);
			}
		};
		setTimeout(checkLoaded, 10);
	});

	const testCases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
	const results = testCases.map(runCase);

	const json = JSON.stringify(results, null, 2);

	if (outPath) {
		fs.writeFileSync(outPath, json);
		console.error(`Wrote ${results.length} results to ${outPath}`);
	} else {
		console.log(json);
	}

	const failed = results.filter(r => r.error);
	if (failed.length > 0) {
		console.error(`\n${failed.length} case(s) failed:`);
		failed.forEach(r => console.error(`  - ${r.id}: ${r.error}`));
		process.exit(1);
	}
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});
