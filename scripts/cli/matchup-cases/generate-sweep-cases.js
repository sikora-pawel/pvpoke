#!/usr/bin/env node

/**
 * Generates the broad parity sweep case list used to check the iOS/Android
 * battle simulators against pvpoke.
 *
 * Deterministic (fixed seed), so the same 400 matchups come out every time:
 *
 *   node generate-sweep-cases.js > sweep.json
 *   node ../simulate-matchups.js --cases=sweep.json --out=sweep-reference.json
 *
 * The reference output is trimmed and checked into the app repo as
 * android-app/app/src/test/resources/sweep-pvpoke-reference.json.
 */

const fs = require('fs');
const path = require('path');

const RANKINGS = path.join(__dirname, '../../../src/data/rankings');

let seed = 20260904;
const rnd = () => {
	seed = (seed * 1103515245 + 12345) & 0x7fffffff;
	return seed / 0x7fffffff;
};

// cup, CP, how many matchups; the pool is each cup's top 150 by ranking
const config = [
	['mega', 1500, 120],
	['mega', 2500, 90],
	['mega', 10000, 60],
	['all', 1500, 60],
	['all', 2500, 40],
	['all', 10000, 30]
];

const cases = [];

for (const [cup, cp, count] of config) {
	const rankings = JSON.parse(fs.readFileSync(path.join(RANKINGS, cup, 'overall', `rankings-${cp}.json`), 'utf8'));
	const pool = rankings.slice(0, Math.min(150, rankings.length)).map(e => e.speciesId);

	for (let i = 0; i < count; i++) {
		const a = pool[Math.floor(rnd() * pool.length)];
		const b = pool[Math.floor(rnd() * pool.length)];
		const shields1 = Math.floor(rnd() * 3);
		const shields2 = Math.floor(rnd() * 3);

		cases.push({
			id: `sweep_${cup}_${cp}_${i}_${a}_vs_${b}_${shields1}_${shields2}`,
			cup,
			cp,
			pokemon1: a,
			pokemon2: b,
			shields1,
			shields2
		});
	}
}

process.stdout.write(JSON.stringify(cases, null, 1));
