#!/usr/bin/env node
// Data must be generated with the official battle engine. Fork-specific changes
// belong in the data loader/rankers, not in battle mechanics or action selection.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
function verifySimulatorSource(ref = fs.readFileSync(path.join(root, '.last-upstream-sync'), 'utf8').trim()) {
    const files = [
        'pokemon/Pokemon.js', 'battle/actions/ActionLogic.js', 'battle/DamageCalculator.js',
        'battle/Battle.js', 'battle/timeline/TimelineAction.js', 'battle/timeline/TimelineEvent.js'
    ];
    let failed = false;
    for (const file of files) {
        const upstream = execFileSync('git', ['show', `${ref}:src/js/${file}`], { cwd: root, encoding: 'utf8' });
        const local = fs.readFileSync(path.join(root, 'src/js', file), 'utf8');
        if (local.replace(/\r\n/g, '\n') !== upstream.replace(/\r\n/g, '\n')) {
            console.error(`Simulator differs from official ${ref}: ${file}`);
            failed = true;
        }
    }
    if (failed) throw new Error("Refusing to generate data with a modified battle engine");
    console.log(`Official simulator verified: ${ref} (${files.length} files)`);

}
module.exports = verifySimulatorSource;
if (require.main === module) verifySimulatorSource(process.argv[2]);
