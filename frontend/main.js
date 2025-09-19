import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { fetchPhase } from './api.js';

// ----- Renderer -----
const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// ----- Scene & Camera -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.position.set(3, 2, 3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ----- Light -----
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(5, 6, 5);
key.castShadow = true;
scene.add(key);

// ----- Model Load -----
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.165/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let panelMesh;

loader.load('./models/scene.glb', (gltf) => {
  const root = gltf.scene;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(root);

  const bbox = new THREE.Box3().setFromObject(root);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  panelMesh = createPanel();
  panelMesh.position.set(center.x, bbox.max.y + size.y * 0.2, center.z);
  panelMesh.scale.setScalar(Math.max(size.x, size.z) * 0.25);
  scene.add(panelMesh);

  controls.target.copy(center);
});

// ----- Panel Functions -----
function createPanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const geo = new THREE.PlaneGeometry(1.2, 0.6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { canvas, ctx, tex };
  return mesh;
}

function drawPanel(mesh, angle, status="OK") {
  if (!mesh) return;
  const { canvas, ctx, tex } = mesh.userData;
  const w = canvas.width, h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = (status==="ALARM") ? "rgba(220,32,32,0.9)"
                 : (status==="WARN") ? "rgba(255,165,0,0.9)"
                 : "rgba(20,24,36,0.92)";
  ctx.fillRect(0,0,w,h);

  ctx.fillStyle="#fff";
  ctx.font="bold 64px system-ui";
  const text = angle!==null ? `${angle.toFixed(2)}°` : "--";
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, (w-tw)/2, h/2+20);

  ctx.font="28px system-ui";
  ctx.fillText("PHASE ANGLE", 30, 40);

  tex.needsUpdate = true;
}

// ----- Data Fetch Loop -----
async function updatePhase() {
  const angle = await fetchPhase();
  let status = "OK";
  if (angle !== null) {
    const abs = Math.abs(angle);
    if (abs > 2 && abs <= 3) status = "WARN";
    if (abs > 3) status = "ALARM";
  } else {
    status = "DISCONNECTED";
  }
  drawPanel(panelMesh, angle, status);
}
setInterval(updatePhase, 1000);

// ----- Render Loop -----
function tick() {
  controls.update();
  if (panelMesh) panelMesh.lookAt(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
