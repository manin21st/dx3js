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

let currentModel = null;

// GLB 모델 로드 함수
async function loadModel(modelPath) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                resolve(gltf.scene);
            },
            undefined,
            (error) => {
                console.error('모델 로드 중 오류 발생:', error);
                reject(error);
            }
        );
    });
}

// 모델 전환 함수
async function switchModel(modelPath) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        });
    }

    try {
        const newModel = await loadModel(modelPath);
        scene.add(newModel);
        currentModel = newModel;
        console.log(`모델 로드 완료: ${modelPath}`);
    } catch (error) {
        console.error(`모델 ${modelPath} 로드 실패:`, error);
    }
}

// 모델 선택 드롭다운 이벤트 리스너
const modelSelector = document.getElementById('modelSelector');
if (modelSelector) {
    modelSelector.addEventListener('change', (event) => {
        const selectedModel = event.target.value;
        switchModel(selectedModel);
    });
}

// 초기 모델 로드 (드롭다운의 기본값)
const initialModel = modelSelector ? modelSelector.value : 'scene.glb';
switchModel(initialModel);

// 윈도우 리사이즈 이벤트 처리
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// =====================================================================================
// [위상각 데이터 업데이트 및 모델 제어 로직]
// =====================================================================================

// HTML 요소 참조
const phaseInput = document.getElementById('phaseInput');
const applyButton = document.getElementById('applyButton');
const modeToggle = document.getElementById('modeToggle');

// 현재 위상각 값 (초기값)
let currentPhaseAngle = 0;
let autoUpdateInterval = null; // 자동 업데이트 인터벌 ID

// 모델의 특정 부분(예: 컨베이어 벨트)을 회전시키는 함수
function rotateConveyorBelt(angle) {
    if (!currentModel) return;

    // 모델 계층 구조를 탐색하여 'ConveyorBelt'라는 이름의 메쉬를 찾습니다.
    // 실제 모델의 계층 구조에 따라 이름은 달라질 수 있습니다.
    const conveyorBelt = currentModel.getObjectByName('ConveyorBelt'); // 모델 내 컨베이어 벨트 메쉬 이름
    if (conveyorBelt) {
        // 각도를 라디안으로 변환하여 Y축 기준으로 회전
        conveyorBelt.rotation.y = THREE.MathUtils.degToRad(angle);
    } else {
        console.warn("ConveyorBelt 메쉬를 찾을 수 없습니다. 모델의 계층 구조를 확인하세요.");
    }
}

// DB에서 위상각 데이터를 가져와 모델을 업데이트하는 함수
async function updatePhaseFromDB() {
    const angle = await fetchPhase();
    if (angle !== null) {
        currentPhaseAngle = angle;
        phaseInput.value = angle.toFixed(1); // 입력 필드 업데이트
        rotateConveyorBelt(currentPhaseAngle); // 모델 회전
    } else {
        console.warn("DB에서 위상각 데이터를 가져오지 못했습니다.");
        phaseInput.value = '--'; // 데이터 없을 시 '--' 표시
    }
}

// 자동 업데이트 시작/중지 함수
function startAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    // 5초마다 DB에서 데이터 가져와 업데이트
    autoUpdateInterval = setInterval(updatePhaseFromDB, 5000);
    updatePhaseFromDB(); // 즉시 한 번 업데이트
}

function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
    }
}

// 수동 적용 버튼 이벤트 리스너
applyButton.addEventListener('click', () => {
    const angle = parseFloat(phaseInput.value);
    if (!isNaN(angle)) {
        currentPhaseAngle = angle;
        rotateConveyorBelt(currentPhaseAngle);
        stopAutoUpdate(); // 수동 적용 시 자동 업데이트 중지
        modeToggle.checked = false; // 토글 상태 변경
    } else {
        alert("유효한 위상각을 입력하세요.");
    }
});

// 자동/수동 모드 토글 이벤트 리스너
modeToggle.addEventListener('change', () => {
    if (modeToggle.checked) {
        startAutoUpdate();
    } else {
        stopAutoUpdate();
    }
});

// 초기 로드 시 자동 업데이트 시작 (기본값)
modeToggle.checked = true; // 자동 업데이트 모드 활성화
startAutoUpdate();
