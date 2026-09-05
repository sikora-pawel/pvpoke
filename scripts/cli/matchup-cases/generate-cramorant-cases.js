#!/usr/bin/env node

/**
 * Generates the Cramorant parity case list.
 *
 * Where generate-sweep-cases.js casts a wide random net, this one hammers the one
 * Pokemon whose mechanics Phase 6a added: Gulp Missile (an "instant" Charged Move
 * costing 0 energy and dealing percentMaxHP damage), the Gulping/Gorging form
 * changes, and the shield/timing rules that hang off them.
 *
 * Cramorant is put on both sides of the matchup against the top of each league,
 * across several shield configurations:
 *
 *   node generate-cramorant-cases.js > cramorant.json
 *   node ../simulate-matchups.js --cases=cramorant.json --out=cramorant-reference.json
 */

const fs = require('fs');
const path = require('path');

const RANKINGS = path.join(__dirname, '../../../src/data/rankings');

// cup, CP, how many opponents to take off the top of the ranking
const config = [
	['all', 1500, 30],
	['all', 2500, 30],
	['mega', 1500, 30]
];

const SHIELDS = [[0, 0], [1, 1], [2, 2], [1, 2], [2, 0]];

const cases = [];

for (const [cup, cp, count] of config) {
	const rankings = JSON.parse(fs.readFileSync(path.join(RANKINGS, cup, 'overall', `rankings-${cp}.json`), 'utf8'));
	const opponents = rankings
		.map(e => e.speciesId)
		.filter(id => id !== 'cramorant')
		.slice(0, count);

	opponents.forEach((opponent, i) => {
		for (const [s1, s2] of SHIELDS) {
			// Cramorant leading, then receiving — the Gulp Missile trigger only fires
			// on the defending side, so both orders matter
			cases.push({
				id: `cram_${cup}_${cp}_${i}_cramorant_vs_${opponent}_${s1}_${s2}`,
				cup, cp, pokemon1: 'cramorant', pokemon2: opponent, shields1: s1, shields2: s2
			});
			cases.push({
				id: `cram_${cup}_${cp}_${i}_${opponent}_vs_cramorant_${s1}_${s2}`,
				cup, cp, pokemon1: opponent, pokemon2: 'cramorant', shields1: s1, shields2: s2
			});
		}
	});
}

process.stdout.write(JSON.stringify(cases, null, '\t'));
