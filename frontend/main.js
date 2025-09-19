import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { fetchPhase } from './api.js';

//==================================================
// 3D 렌더링 기본 설정
//==================================================

// ----- 렌더러 (Renderer) -----
// 렌더러는 씬(Scene)과 카메라(Camera)를 기반으로 이미지를 그리는 역할을 합니다.
// WebGL 렌더러를 사용하며, antialias 옵션으로 모델의 가장자리를 부드럽게 처리합니다.
const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
// 화면 크기에 맞게 렌더러 크기를 조절하고, 고해상도 디스플레이를 위해 픽셀 비율을 설정합니다.
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// 렌더러의 결과물(canvas 엘리먼트)을 HTML에 추가합니다.
container.appendChild(renderer.domElement);

// ----- 씬 (Scene) -----
// 씬은 3D 객체, 조명, 카메라 등 모든 요소를 담는 가상의 공간입니다.
const scene = new THREE.Scene();
// 씬의 배경색을 설정합니다.
scene.background = new THREE.Color(0x0b1020);

// ----- 카메라 (Camera) -----
// 카메라는 씬의 어느 부분을 어떻게 보여줄지 결정합니다.
// PerspectiveCamera는 원근감이 있는 카메라입니다 (가까운 것은 크게, 먼 것은 작게).
// (시야각, 종횡비, 근접 평면, 원거리 평면)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
// 카메라의 초기 위치를 설정합니다.
camera.position.set(3, 2, 3);

// ----- 컨트롤 (Controls) -----
// OrbitControls는 마우스로 3D 씬을 회전, 확대/축소, 이동할 수 있게 해줍니다.
const controls = new OrbitControls(camera, renderer.domElement);
// Damping을 활성화하여 컨트롤에 관성을 부여합니다. (더 부드러운 움직임)
controls.enableDamping = true;

//==================================================
// 조명 설정
//==================================================

// ----- 조명 (Light) -----
// AmbientLight는 씬 전체에 고르게 빛을 비춰주는 역할을 합니다. (그림자 없음)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
// DirectionalLight는 특정 방향에서 오는 빛을 시뮬레이션합니다. (태양광과 유사)
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(5, 6, 5); // 빛의 위치 설정
key.castShadow = true; // 이 조명이 그림자를 만들도록 설정
scene.add(key);

//==================================================
// 3D 모델 로딩
//==================================================

// ----- 모델 로더 (Model Loader) -----
// GLTFLoader는 .glb 또는 .gltf 형식의 3D 모델을 불러옵니다.
const loader = new GLTFLoader();
// DRACOLoader는 Draco 압축된 모델을 해제하는 역할을 합니다. 모델 파일 크기를 줄여줍니다.
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.165/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let panelMesh; // 위상각을 표시할 정보 패널 (메쉬)

// 모델 파일을 비동기적으로 로드합니다.
loader.load('./scene.glb', (gltf) => {
  const root = gltf.scene; // 로드된 모델의 최상위 객체
  // 모델의 모든 메쉬(3D 객체의 표면)가 그림자를 생성하고 받을 수 있도록 설정합니다.
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(root);

  // 로드된 모델을 감싸는 경계 상자(Bounding Box)를 계산하여 크기와 중심점을 구합니다.
  const bbox = new THREE.Box3().setFromObject(root);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  // 정보 패널을 생성하고 모델의 위쪽에 배치합니다.
  panelMesh = createPanel();
  panelMesh.position.set(center.x, bbox.max.y + size.y * 0.2, center.z);
  panelMesh.scale.setScalar(Math.max(size.x, size.z) * 0.25); // 모델 크기에 비례하여 패널 크기 조절
  scene.add(panelMesh);

  // 카메라 컨트롤의 타겟을 모델의 중심으로 설정합니다.
  controls.target.copy(center);

  // 초기 패널 내용을 그립니다.
  drawPanel(panelMesh, 0, "OK");
});

//==================================================
// 정보 패널 기능
//==================================================

// ----- 패널 생성 (createPanel) -----
// Canvas에 2D 텍스트를 그린 다음, 이를 3D 공간의 평면(Plane)에 텍스처로 입히는 방식입니다.
function createPanel() {
  const canvas = document.createElement("canvas"); // 2D 그림을 그릴 캔버스 생성
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d"); // 캔버스에 그림을 그릴 때 사용하는 2D 컨텍스트
  
  // CanvasTexture는 캔버스의 내용을 Three.js 텍스처로 사용할 수 있게 해줍니다.
  const tex = new THREE.CanvasTexture(canvas);
  // MeshBasicMaterial은 조명에 영향을 받지 않는 기본 재질입니다.
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  // PlaneGeometry는 평평한 사각형 메쉬를 생성합니다.
  const geo = new THREE.PlaneGeometry(1.2, 0.6);
  // 최종적으로 메쉬(형상+재질)를 생성합니다.
  const mesh = new THREE.Mesh(geo, mat);
  // 나중에 캔버스에 다시 접근할 수 있도록 관련 객체들을 userData에 저장합니다.
  mesh.userData = { canvas, ctx, tex };
  return mesh;
}

// ----- 패널 그리기 (drawPanel) -----
// 캔버스에 위상각, 상태 등의 정보를 동적으로 그립니다.
function drawPanel(mesh, angle, status="OK") {
  if (!mesh) return;
  const { canvas, ctx, tex } = mesh.userData;
  const w = canvas.width, h = canvas.height;

  // 캔버스를 깨끗이 지웁니다.
  ctx.clearRect(0, 0, w, h);
  // 상태(ALARM, WARN, OK)에 따라 배경색을 다르게 설정합니다.
  ctx.fillStyle = (status==="ALARM") ? "rgba(220,32,32,0.9)"
                 : (status==="WARN") ? "rgba(255,165,0,0.9)"
                 : "rgba(20,24,36,0.92)";
  ctx.fillRect(0,0,w,h);

  // 텍스트를 그립니다.
  ctx.fillStyle="#fff";
  ctx.font="bold 64px system-ui";
  const text = angle!==null ? `${angle.toFixed(2)}°` : "--";
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, (w-tw)/2, h/2+20);

  ctx.font="28px system-ui";
  ctx.fillText("PHASE ANGLE", 30, 40);

  // 캔버스 내용이 변경되었으므로 텍스처를 업데이트해야 한다고 Three.js에 알려줍니다.
  tex.needsUpdate = true;
}

//==================================================
// 사용자 인터페이스 (UI) 상호작용
//==================================================

const phaseInput = document.getElementById('phaseInput');
const applyButton = document.getElementById('applyButton');
const modeToggle = document.getElementById('modeToggle');

let autoUpdateInterval = null; // 자동 업데이트 setInterval ID를 저장할 변수

// 모드 전환 토글 이벤트 리스너
modeToggle.addEventListener('change', (event) => {
  const isAutoMode = event.target.checked;
  if (isAutoMode) {
    // 자동 모드 시작
    phaseInput.disabled = true;
    applyButton.disabled = true;
    startAutoUpdate();
  } else {
    // 수동 모드 시작
    phaseInput.disabled = false;
    applyButton.disabled = false;
    stopAutoUpdate();
  }
});

// 수동 업데이트 버튼 이벤트 리스너
applyButton.addEventListener('click', () => {
  const angle = parseFloat(phaseInput.value);
  if (!isNaN(angle)) {
    updatePhaseFromValue(angle);
  }
});

// 자동 업데이트 시작 함수
function startAutoUpdate() {
  if (autoUpdateInterval) return; // 이미 실행 중이면 중복 실행 방지
  
  // 즉시 1회 실행하여 빠른 피드백 제공
  updatePhaseFromDB(); 
  
  // 5초마다 DB에서 데이터 가져오기 반복
  autoUpdateInterval = setInterval(updatePhaseFromDB, 5000);
}

// 자동 업데이트 중지 함수
function stopAutoUpdate() {
  clearInterval(autoUpdateInterval);
  autoUpdateInterval = null;
}

// DB에서 데이터를 가져와 패널 업데이트
async function updatePhaseFromDB() {
  const angle = await fetchPhase();
  updatePhaseFromValue(angle);
}

// 주어진 값으로 상태를 결정하고 패널을 다시 그리는 핵심 함수
function updatePhaseFromValue(angle) {
  let status = "OK";
  if (angle !== null) {
    const abs = Math.abs(angle);
    if (abs > 2 && abs <= 3) status = "WARN";
    if (abs > 3) status = "ALARM";
  } else {
    status = "DISCONNECTED"; // API 통신 실패 등
  }
  drawPanel(panelMesh, angle, status);
}

// 초기 상태는 수동 모드로 설정
phaseInput.disabled = false;
applyButton.disabled = false;


//==================================================
// 렌더링 루프 및 창 크기 조절
//==================================================

// ----- 렌더링 루프 (Render Loop) -----
// 매 프레임마다 호출되어 화면을 다시 그리는 함수입니다.
function tick() {
  // OrbitControls를 업데이트하여 부드러운 카메라 움직임을 구현합니다.
  controls.update();
  // 패널이 항상 카메라를 바라보도록 설정합니다. (빌보드 효과)
  if (panelMesh) panelMesh.lookAt(camera.position);
  // 렌더러가 씬과 카메라를 사용하여 화면을 그립니다.
  renderer.render(scene, camera);
  // 다음 프레임에 tick 함수를 다시 호출하도록 요청합니다.
  requestAnimationFrame(tick);
}
tick(); // 렌더링 루프 시작

// ----- 창 크기 조절 (Resize) -----
// 브라우저 창 크기가 변경될 때마다 렌더러와 카메라의 종횡비를 업데이트합니다.
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
