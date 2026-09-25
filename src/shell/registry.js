// Every selectable piece. Order here is the order in the dropdown.

import fractalTree from '../sketches/fractal-tree.js';
import voronoi from '../sketches/voronoi.js';
import terrain from '../sketches/terrain.js';
import treePatterns from '../sketches/tree-patterns.js';
import { dailyMinimal } from '../sketches/daily-minimal/index.js';
import bicycleGalaxy from '../sketches/bicycle-galaxy.js';
import gameOfLife from '../sketches/game-of-life.js';
import spaceBlocks from '../sketches/space-blocks.js';
import flowPipes from '../sketches/flow-pipes.js';
import quadTree from '../sketches/quad-tree.js';
import flocking from '../sketches/flocking.js';
import flowField from '../sketches/flow-field.js';
import spinodal from '../sketches/spinodal.js';
import { mountPhotos } from '../sketches/photos.js';
import lSystem from '../sketches/l-system.js';

export const DAILY_MINIMAL = 'daily-minimal';

export const entries = [
  { id: 'fractal-tree', label: 'Fractal Tree', sketch: fractalTree },
  { id: 'voronoi', label: 'Voronoi Images', sketch: voronoi },
  { id: 'terrain', label: 'Procedural Terrain', sketch: terrain },
  { id: 'tree-patterns', label: 'Tree Patterns', sketch: treePatterns },
  { id: DAILY_MINIMAL, label: 'Daily Minimal', group: dailyMinimal },
  { id: 'bicycle-galaxy', label: 'Bicycle Galaxy', sketch: bicycleGalaxy },
  { id: 'game-of-life', label: 'Game of Life', sketch: gameOfLife },
  { id: 'space-blocks', label: 'Space Blocks', sketch: spaceBlocks },
  { id: 'flow-pipes', label: 'Flow Pipes', sketch: flowPipes },
  { id: 'quad-tree', label: 'Quad Tree', sketch: quadTree },
  { id: 'flocking', label: 'Flocking', sketch: flocking },
  { id: 'flow-field', label: 'Flow Field', sketch: flowField },
  { id: 'spinodal', label: 'Spinodal Decomposition', sketch: spinodal },
  { id: 'photos', label: 'Traditional Wallpaper', mount: mountPhotos },
  { id: 'l-system', label: 'L-System Tool', sketch: lSystem },
];

export const DEFAULT_SELECTION = { id: DAILY_MINIMAL, sub: 'S02-404' };

export function findEntry(id) {
  return entries.find((e) => e.id === id);
}

// Coerce anything (URL params, stale shared state) into a valid selection.
export function normalizeSelection(sel) {
  const entry = sel && findEntry(sel.id);
  if (!entry) return { ...DEFAULT_SELECTION };
  if (entry.group) {
    const sub = entry.group.find((d) => d.id === sel.sub) ? sel.sub : entry.group[0].id;
    return { id: entry.id, sub };
  }
  return { id: entry.id };
}
