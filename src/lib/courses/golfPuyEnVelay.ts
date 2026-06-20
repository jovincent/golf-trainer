// Golf du Puy-en-Velay — Le Puy-en-Velay (43), Auvergne, France.
// Real per-hole geometry from OpenStreetMap via the Overpass API
// (© OpenStreetMap contributors, ODbL), projected to a local tee-origin metric
// frame (y = toward pin, x = lateral, +x = right). Pars inferred from hole length
// where not tagged in OSM. Bunkers and water assigned to the nearest hole.
//
// Geometry: https://www.openstreetmap.org/way/479418805

import type { Hole } from "../course";

export const GOLF_PUY_META = {
  id: "golf-puy-en-velay",
  name: "Golf du Puy-en-Velay",
  location: "Le Puy-en-Velay (43)",
  region: "Auvergne, France",
  source: "OpenStreetMap (ODbL)",
  par: 37,
  holes: 9,
};

export const GOLF_PUY: Hole[] = [{"number":1,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":40.4,"y":171.9},{"x":0.0,"y":255.8}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":2,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":-0.0},{"x":-23.6,"y":201.6},{"x":0.0,"y":322.6}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":3,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":-17.6,"y":189.8},{"x":-0.0,"y":374.8}],"hazards":[{"type":"water","cx":-48.3,"cy":210.5,"r":28.0}],"wind":{"wx":0,"wy":0}},{"number":4,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":-0.0},{"x":41.8,"y":164.4},{"x":18.3,"y":318.0},{"x":0.0,"y":405.6}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":5,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":-0.0,"y":0.0},{"x":-22.4,"y":160.6},{"x":0.0,"y":210.7}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":6,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":-0.0},{"x":0.0,"y":286.8}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":7,"par":5,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":73.6,"y":162.4},{"x":18.7,"y":334.6},{"x":-0.0,"y":410.4}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":8,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":123.8}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":9,"par":5,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":-0.0},{"x":-82.9,"y":231.0},{"x":-33.2,"y":391.3},{"x":0.0,"y":452.8}],"hazards":[],"wind":{"wx":0,"wy":0}}];
