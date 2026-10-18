import rocketObjText from "./rocket.obj" with { type: "text" };
import { FloatingBox, Vehicle } from "./vehicle";
import { makeBody } from "../../lib3d/bodies";
import {
  beginScene,
  drawMesh,
  DrawStyle,
  init,
  isMouseDown,
  makeCubeMesh,
  makeGridMesh,
  makeScene,
  parseObj,
  randomFloat,
  scaleMesh,
  setBatchSort,
  startAnimation,
  Vec3,
  type ShapeStyle,
} from "../../lib3d/lib3d";

// ====================================================================
// Rocket-Schwarm (1:1-Port von s3d_go/apps/rocket, basiert auf boids)
//
// 80 Vehicles starten mit zufaelligen Positionen und Geschwindigkeiten. Pro
// Frame wirken die drei Flocking-Regeln (separate, align, cohesion) als
// Steering-Kraefte; applyBoundary reflektiert die Geschwindigkeit an den
// Weltgrenzen. Sieben grosse, verschiedenfarbige Hindernis-Boxen an festen
// Positionen werden ueber avoidObstacles umflogen.
//
// Unterschied zu boids: Die Vehicles sind KEINE prozedurale Pyramide, sondern
// ein externes Raketen-Mesh (rocket.obj), das per Text-Import eingebettet und
// geladen wird. Hindernis-Wuerfel und Gitter bleiben prozedural.
// ====================================================================

const scene = makeScene();
scene.cam.pos = new Vec3(0, 320, 520);
scene.cam.target = new Vec3(0, 0, 0);
scene.cam.up = new Vec3(0, 1, 0);
scene.cam.fovY = 1.2;
scene.cam.near = 0.1;
scene.cam.far = 2000;
scene.sunDir = new Vec3(0.5, 1.0, 0.3);
scene.fog = { enabled: true, near: 400, far: 1400, color: { r: 0.25, g: 0.25, b: 0.25, a: 1 } };

const gridStyle: ShapeStyle = {
  stroke: "#777774",
  lineWidth: 1,
};

// Bodengitter EINMAL erzeugen und wiederverwenden (prozedural).
const gridMesh = makeGridMesh(600, 24);
// Vehicle: geladenes Raketen-Mesh (Text-Import + Mesh-Daten-Skalierung).
const rocketScale = 2;
const vehicleMesh = scaleMesh(parseObj(rocketObjText), rocketScale);
// Hindernis-Box (um den Ursprung zentriert), prozedural erzeugt.
const boxMesh = makeCubeMesh(120, 120, 120);

const obstacleCount = 7;

// Jede Hindernis-Box bekommt eine eigene Fuellfarbe.
const obstacleStyles: ShapeStyle[] = [
  { stroke: "#101010", fill: "#3a6ea5", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#c0392b", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#27ae60", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#8e44ad", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#e67e22", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#16a085", lineWidth: 2, mode: DrawStyle.Both },
  { stroke: "#101010", fill: "#d4a017", lineWidth: 2, mode: DrawStyle.Both },
];

// Schwebende Hindernisse an FESTEN, deterministischen Positionen.
const obstaclePositions: Vec3[] = [
  new Vec3(-160.0, -120.0, -240.0),
  new Vec3(0.0, 120.0, -240.0),
  new Vec3(160.0, -120.0, -240.0),
  new Vec3(-240.0, 120.0, 0.0),
  new Vec3(240.0, 120.0, 0.0),
  new Vec3(-240.0, -120.0, 240.0),
  new Vec3(0.0, -40.0, 240.0),
];

const obstacles: FloatingBox[] = [];
for (let i = 0; i < obstacleCount; i++) {
  obstacles.push(new FloatingBox(makeBody(boxMesh, obstaclePositions[i]), i * 1.3, 0.01));
}

const vehicleCount = 80;
// Spawn-Bereich liegt innerhalb der Weltgrenzen aus applyBoundary.
const spawnX = 180.0;
const spawnY = 110.0;
const spawnZ = 110.0;

// Farbe der Vehicles (Render-Info, gehoert nicht in den Body).
const vehicleStyle: ShapeStyle = {
  stroke: "#7a3b00",
  fill: "#ff8800",
  lineWidth: 1,
  mode: DrawStyle.Both,
};

// Vehicles starten mit zufaelliger Position und zufaelliger Geschwindigkeit.
const vehicles: Vehicle[] = [];
for (let i = 0; i < vehicleCount; i++) {
  const pos = new Vec3(
    randomFloat(-spawnX, spawnX),
    randomFloat(-spawnY, spawnY),
    randomFloat(-spawnZ, spawnZ),
  );
  const velocity = new Vec3(
    randomFloat(-1.0, 1.0),
    randomFloat(-1.0, 1.0),
    randomFloat(-1.0, 1.0),
  ).mag(1.0);

  const v = new Vehicle(makeBody(vehicleMesh, pos), velocity);
  v.alignToVelocity();
  vehicles.push(v);
}

let timeAccum = 0;

/* Loop */
function draw(): void {
  beginScene(scene);

  timeAccum += 0.02;

  // Bodengitter (XZ-Ebene bei y=0) aus dem geteilten Mesh.
  drawMesh(gridMesh, gridStyle);

  // Hindernisse animieren (Schweben + Rotation).
  for (const o of obstacles) {
    o.update(timeAccum);
  }

  // Flocking: erst die Kraefte sammeln, dann integrieren.
  const center = scene.cam.target;
  for (const v of vehicles) {
    // Bei gedrueckter Maustaste wirkt zusaetzlich eine Kraft zum
    // Szenenzentrum (scene.cam.target) auf jedes Boid.
    if (isMouseDown()) {
      const toCenter = center.sub(v.body.pos).normalize();
      v.applyForce(toCenter.scale(0.05));
    }
    v.separate(vehicles);
    v.align(vehicles);
    v.cohesion(vehicles);
    // margin = harte Sicherheitsdistanz, detect = Vorausschau-Radius
    v.avoidObstacles(obstacles, 6.0, 30.0);
    v.applyBoundary();
    v.update();
    v.alignToVelocity();
  }

  for (let i = 0; i < obstacles.length; i++) {
    drawMesh(obstacles[i].body.geometry, obstacleStyles[i], obstacles[i].body.modelMatrix());
  }
  for (const v of vehicles) {
    drawMesh(v.body.geometry, vehicleStyle, v.body.modelMatrix());
  }
}

/* Start */
try {
  init();
} catch (e) {
  console.error(String(e));
}

setBatchSort(true);
startAnimation(draw);
