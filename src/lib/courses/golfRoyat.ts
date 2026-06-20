// Golf de Royat-Charade — Royat (63), Auvergne, France.
// Real per-hole geometry from OpenStreetMap via the Overpass API
// (© OpenStreetMap contributors, ODbL), projected to a local tee-origin metric
// frame (y = toward pin, x = lateral, +x = right). Pars inferred from hole length
// where not tagged in OSM. Bunkers and water assigned to the nearest hole.
//
// Geometry: https://www.openstreetmap.org/way/236891554

import type { Hole } from "../course";

export const GOLF_ROYAT_META = {
  id: "golf-royat",
  name: "Golf de Royat-Charade",
  location: "Royat (63)",
  region: "Auvergne, France",
  source: "OpenStreetMap (ODbL)",
  par: 32,
  holes: 9,
};

export const GOLF_ROYAT: Hole[] = [{"number":1,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":245.7}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":2,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":206.1}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":3,"par":5,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":2.2,"y":83.2},{"x":13.2,"y":212.9},{"x":-0.0,"y":414.7}],"hazards":[{"type":"water","cx":-0.9,"cy":398.7,"r":6.2},{"type":"water","cx":-0.9,"cy":398.7,"r":6.2}],"wind":{"wx":0,"wy":0}},{"number":4,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":161.5}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":5,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":-0.0,"y":0.0},{"x":0.0,"y":57.6}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":6,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":194.4}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":7,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":-0.0},{"x":-22.9,"y":205.1},{"x":0.0,"y":288.4}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":8,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":-0.0},{"x":0.0,"y":116.1}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":9,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":-0.0,"y":0.0},{"x":17.1,"y":160.7},{"x":0.0,"y":283.1}],"hazards":[],"wind":{"wx":0,"wy":0}}];
