// Golf de Briailles — Avermes (03), Auvergne, France.
// Real per-hole geometry from OpenStreetMap via the Overpass API
// (© OpenStreetMap contributors, ODbL), projected to a local tee-origin metric
// frame (y = toward pin, x = lateral, +x = right). Pars inferred from hole length
// where not tagged in OSM. Bunkers and water assigned to the nearest hole.
//
// Geometry: https://www.openstreetmap.org/way/1394230256

import type { Hole } from "../course";

export const GOLF_BRIAILLES_META = {
  id: "golf-briailles",
  name: "Golf de Briailles",
  location: "Avermes (03)",
  region: "Auvergne, France",
  source: "OpenStreetMap (ODbL)",
  par: 41,
  holes: 12,
};

export const GOLF_BRIAILLES: Hole[] = [{"number":1,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":-0.0,"y":0.0},{"x":-8.0,"y":99.7},{"x":0.0,"y":205.2}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":2,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":-0.0},{"x":0.0,"y":132.1}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":3,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":138.0}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":4,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":-0.0},{"x":-0.0,"y":152.4}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":5,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":-0.0,"y":0.0},{"x":-13.9,"y":163.1},{"x":0.0,"y":388.0}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":6,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":34.9,"y":136.5},{"x":-0.0,"y":235.9}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":7,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":-0.0,"y":0.0},{"x":-142.0,"y":167.8},{"x":0.0,"y":266.2}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":8,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":0.0,"y":243.7}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":9,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":0.0},{"x":34.0,"y":102.2},{"x":0.0,"y":155.0}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":10,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":0.0,"y":-0.0},{"x":0.0,"y":103.5}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":11,"par":3,"name":"","fairwayHalf":16.0,"greenRadius":11.0,"obHalf":41.0,"centerline":[{"x":-0.0,"y":0.0},{"x":0.0,"y":83.5}],"hazards":[],"wind":{"wx":0,"wy":0}},{"number":12,"par":4,"name":"","fairwayHalf":18.0,"greenRadius":11.0,"obHalf":43.0,"centerline":[{"x":0.0,"y":0.0},{"x":-29.0,"y":159.5},{"x":0.0,"y":261.1}],"hazards":[],"wind":{"wx":0,"wy":0}}];
