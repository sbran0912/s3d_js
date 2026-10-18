import {
  beginScene,
  drawMesh,
  DrawStyle,
  init,
  makeGridMesh,
  makeScene,
  makeSphereMesh,
  multMatrix,
  rotateMatrix,
  setBatchSort,
  startAnimation,
  translateMatrix,
  Vec3,
  type ShapeStyle,
} from "../../lib3d/lib3d";

// ====================================================================
// Vorlage ohne Physik: Bodengitter und eine Kugel. Kugel und Gitter werden
// ueber einmal erzeugte Meshes (drawMesh) gezeichnet.
// ====================================================================

const scene = makeScene();
scene.cam.pos = new Vec3(50, 100, 200);
scene.cam.target = new Vec3(0, 0, 0);
scene.cam.up = new Vec3(0, 1, 0);
scene.cam.fovY = 1.2;
scene.cam.near = 0.1;
scene.cam.far = 1000;
scene.sunDir = new Vec3(0.5, 1.0, 0.3);
scene.fog = { enabled: true, near: 100, far: 400, color: { r: 0.25, g: 0.25, b: 0.25, a: 1 } };

const gridStyle: ShapeStyle = {
  stroke: "#777774",
  lineWidth: 1,
};
const ballStyle: ShapeStyle = {
  stroke: "#2f3a00",
  fill: "#d3ff44",
  lineWidth: 1,
  mode: DrawStyle.Both,
};

// Mesh EINMAL erzeugen und wiederverwenden (statt pro Frame).
const ballMesh = makeSphereMesh(40, 40, 40);

// Bodengitter EINMAL erzeugen und wiederverwenden.
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

  // Bodengitter (XZ-Ebene bei y=0) aus dem geteilten Mesh.
  drawMesh(gridMesh, gridStyle);

  // Kugel rotieren lassen: Szene-Rotation * Verschiebung an (0,40,0).
  angle += 0.01;
  const ballModel = multMatrix(rotateMatrix(0, angle, 0), translateMatrix(0, 40, 0));
  drawMesh(ballMesh, ballStyle, ballModel);
}

/* Start */
try {
  init();
} catch (e) {
  console.error(String(e));
}

setBatchSort(true);

startAnimation(draw);
