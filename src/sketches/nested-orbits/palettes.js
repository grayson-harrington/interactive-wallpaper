// Ball / wall palette pairs. One pair is picked at random on every reseed.
// colors: [hex, weight]; gap: the dark ground showing between circles.

export const PALETTES = [
  {
    name: 'Tide / Dusk',
    ball: {
      colors: [
        ['#0f4c5c', 3], ['#1d7a8c', 3], ['#5fb3b3', 2.5], ['#a9d6cf', 2],
        ['#eef5ef', 1.2], ['#0a2e3a', 1.5], ['#e07a5f', 0.9], ['#f2cc8f', 0.6],
      ],
      gap: '#06141a',
    },
    wall: {
      colors: [
        ['#241a3d', 3], ['#3e2a63', 3], ['#6b4f8f', 2], ['#9c86b8', 1.2],
        ['#151029', 2], ['#2f4868', 1.5], ['#a14d7d', 0.6],
      ],
      gap: '#07050d',
    },
  },
  {
    name: 'Ember / Charcoal',
    ball: {
      colors: [
        ['#8c2f1b', 3], ['#c4561f', 3], ['#e08e2b', 2.5], ['#e9b949', 1.5],
        ['#f3e3c3', 1.2], ['#5a1a12', 1.8], ['#2b1a14', 1],
      ],
      gap: '#140a06',
    },
    wall: {
      colors: [
        ['#2a2624', 3], ['#3b3431', 3], ['#4d403a', 2], ['#1c1917', 2.5],
        ['#5e4a3c', 1.2], ['#7a5a3e', 0.6],
      ],
      gap: '#0b0a09',
    },
  },
  {
    name: 'Moss / Stone',
    ball: {
      colors: [
        ['#3f5a2e', 3], ['#6b8a47', 3], ['#9fb07a', 2.5], ['#d9d4bd', 1.5],
        ['#2a3b22', 2], ['#c9a227', 0.8], ['#7d6b3d', 1],
      ],
      gap: '#0e140b',
    },
    wall: {
      colors: [
        ['#2f3a44', 3], ['#455565', 3], ['#5f7282', 2], ['#8796a2', 1],
        ['#1d252c', 2.5], ['#3c4a3f', 1],
      ],
      gap: '#0a0d10',
    },
  },
  {
    name: 'Ink / Paper',
    ball: {
      colors: [
        ['#16181d', 3], ['#22324a', 2.5], ['#3b4f6e', 1.5], ['#e8e2d4', 2.5],
        ['#cfc6b3', 2], ['#d2452c', 0.7],
      ],
      gap: '#0b0c0e',
    },
    wall: {
      colors: [
        ['#2d2b28', 3], ['#3d3a36', 3], ['#54504a', 2], ['#6e6961', 1],
        ['#1f1e1c', 2.5],
      ],
      gap: '#0c0b0a',
    },
  },
];
