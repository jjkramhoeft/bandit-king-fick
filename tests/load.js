// Loads the engine scripts into Node in the same order as index.html.
const path = require('path');
const files = [
  'js/core/ns.js', 'js/core/mapgeo.js',
  'js/data/map.js', 'js/data/heroes.js', 'js/data/scenarios.js',
  'js/engine/world.js', 'js/engine/econ.js', 'js/engine/actions.js', 'js/engine/battle.js',
  'js/engine/war.js', 'js/engine/ai.js', 'js/engine/setup.js', 'js/engine/game.js',
  'js/engine/flows.js', 'js/engine/save.js'
];
for (const f of files) {
  try { require(path.join(__dirname, '..', f)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
module.exports = globalThis.BK;
