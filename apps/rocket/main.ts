import rocketObjText from "./rocket.obj" with { type: "text" };
import {
  beginScene,
  drawMesh,
  DrawStyle,
  init,
  makeCubeMesh,
  makeGridMesh,
  makeScene,
  multMatrix,
  parseObj,
  rotateMatrix,
  scaleMesh,
  setBatchSort,
  startAnimation,
  translateMatrix,
  Vec3,
  type Mesh,
  type ShapeStyle,
} from "../../lib3d/lib3d";

// ====================================================================
// Rocket-Beispiel: geladenes Mesh vs. prozedurales Mesh.
//
// Die Rakete wird als Wavefront-OBJ geladen. Damit sie im Dev-Server UND im
// Build zuverlaessig ankommt, wird die Datei per Text-Import in das Bundle
// eingebettet ("with { type: \"text\" }") und mit parseObj geparst - also
// synchron, ohne fetch.
//
// Wuerfel und Bodengitter werden weiterhin prozedural (make*Mesh) erzeugt -
// so sieht man im selben Fenster direkt den Unterschied zwischen geladenem
// und prozeduralem Mesh.
//
// Die Rakete liegt in Endmassen vor (Y-up, Basis y=0, Spitze y=10), also
// nicht per Modell-Matrix skaliert.
// ====================================================================

const scene = makeScene();
scene.cam.pos = new Vec3(50, 100, 200);
scene.cam.target = new Vec3(0, 0, 0);
scene.cam.up = new Vec3(0, 1, 0);
scene.cam.fovY = 1.2;
scene.cam.near = 0.1;
scene.cam.far = 1000;
scene.sunDir = new Vec3(0.5, 1.0, 0.3);
scene.fog = { enabled: true, near: 150, far: 500, color: { r: 0.25, g: 0.25, b: 0.25, a: 1 } };

const rocketStyle: ShapeStyle = {
  stroke: "#2a1400",
  fill: "#ff8844",
  lineWidth: 1,
  mode: DrawStyle.Both,
};
const cubeStyle: ShapeStyle = {
  stroke: "#1b1b1b",
  fill: "#d3ff44",
  lineWidth: 1,
  mode: DrawStyle.Both,
};
const gridStyle: ShapeStyle = {
  stroke: "#777774",
  lineWidth: 1,
};

// Geladen: die Rakete (OBJ-Text ist Teil des Bundles -> synchrones Parsen),
// anschliessend um rocketScale vergroessert (Mesh-Daten, siehe lib3d.scaleMesh).
const rocketScale = 2;
const rocketMesh: Mesh = scaleMesh(parseObj(rocketObjText), rocketScale);

// Prozedural: Vergleichswuerfel + Bodengitter.
const cubeMesh = makeCubeMesh(30, 30, 30);
const gridMesh = makeGridMesh(600, 24);

let angle = 0;

let fpsFrames = 0;
let fpsLastTime = performance.now();

function updateFps(): void {
  fpsFrames++;
  const now = performance.now();
  const elapsed = now - fpsLastTime;
  if (elapsed >= 500) {
    console.log(`FPS: ${Math.floor((fpsFrames * 1000) / elapsed)}`);
    fpsFrames = 0;
    fpsLastTime = now;
  }
}

/* Loop */
function draw(): void {
  updateFps();

  beginScene(scene);

  // Gesamte Szene im Uhrzeigersinn drehen (von oben gesehen).
  angle -= 0.01;
  const sceneRot = rotateMatrix(0, angle, 0);

  // Bodengitter (prozedural, fest).
  drawMesh(gridMesh, gridStyle);

  // Geladene Rakete (kreist wie der Wuerfel, aber auf der Gegenseite).
  drawMesh(rocketMesh, rocketStyle, multMatrix(sceneRot, translateMatrix(-60, 0, 0)));

  // Prozeduraler Wuerfel zum direkten Vergleich.
  drawMesh(cubeMesh, cubeStyle, multMatrix(sceneRot, translateMatrix(60, 15, 0)));
}

/* Start */
try {
  init();
} catch (e) {
  console.error(String(e));
}

setBatchSort(true);
startAnimation(draw);
