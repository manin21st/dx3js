# DigitalTwin3js

## 1. 프로젝트 설명

Three.js를 사용하여 캠샤프트 위상각 측정기 3D 모델을 웹에서 보여주는 디지털 트윈 프로젝트입니다.

Flask 기반의 백엔드 서버가 Oracle 데이터베이스와 연동하여 실시간으로 위상각 데이터를 가져오며, 프론트엔드는 이 데이터를 주기적으로 받아 3D 모델의 정보 패널에 동적으로 표시합니다.

## 2. 주요 기능

- **실시간 데이터 연동**: 백엔드 API를 통해 DB에서 조회한 위상각 데이터를 5초 주기로 화면에 업데이트합니다.
- **동적 정보 패널**: 위상각 값의 범위에 따라 'OK', 'WARN', 'ALARM' 상태와 색상이 변경됩니다.
- **데이터 랜덤 조회**: 현재 백엔드는 DB의 `ZSCORE` 테이블에서 랜덤한 데이터를 조회하여 값이 계속 변하는 것을 시뮬레이션합니다.
- **두 가지 작동 모드**:
  - **Auto**: 5초마다 백엔드에서 데이터를 자동으로 가져와 표시합니다.
  - **Manual**: 사용자가 직접 입력 필드에 값을 넣고 'Apply' 버튼을 눌러 패널을 업데이트할 수 있습니다.

## 3. 시스템 요구사항 및 사전 준비

프로젝트를 실행하기 위해 다음 프로그램 및 설정이 필요합니다.

1.  **Python**: `py --version` 명령어로 설치 및 경로 설정을 확인합니다.
2.  **Oracle Instant Client**:
    - `oracledb` 라이브러리가 'Thick' 모드로 작동하기 위해 필요합니다.
    - `backend/app.py`의 19번째 줄에 있는 `oracledb.init_oracle_client(lib_dir=r"...")` 부분에 실제 설치된 경로를 정확하게 입력해야 합니다.
3.  **데이터베이스 접속 정보**:
    - `backend/config.ini` 파일에 실제 접속하려는 Oracle DB의 `DB_HOST`, `DB_USER`, `DB_PASSWORD` 등을 정확하게 입력해야 합니다.

## 4. 설치 및 실행 방법

### 1. 백엔드 서버 실행

1.  **터미널(명령 프롬프트)을 엽니다.**

2.  **필요 라이브러리를 설치합니다.**
    ```shell
    py -m pip install -r backend/requirements.txt
    ```

3.  **백엔드 서버를 시작합니다.**
    ```shell
    py backend/app.py
    ```
    서버가 `http://127.0.0.1:5000`에서 실행되는 것을 확인합니다.

### 2. 프론트엔드 실행

1.  **VS Code의 `Live Server` 확장 프로그램을 사용**하는 것을 권장합니다.
2.  `frontend/index.html` 파일 위에서 마우스 오른쪽 버튼을 클릭하고 **`Open with Live Server`**를 선택하여 브라우저에서 엽니다.
3.  화면 우측 하단의 토글을 'Auto'로 변경하면 백엔드와 연동하여 작동하는 것을 확인할 수 있습니다.

## 5. 프로젝트 구성

- **`frontend/`**: Three.js 기반의 3D 뷰어 UI
  - `index.html`: 기본 HTML 구조
  - `main.js`: 3D 렌더링, 모델 로딩, UI 상호작용 등 핵심 로직
  - `api.js`: 백엔드 API(`http://localhost:5000/api/phase`)를 호출하는 모듈
  - `scene.glb`: 3D 모델 파일

- **`backend/`**: Flask 기반의 API 서버
  - `app.py`: API 엔드포인트 및 DB 연결 로직
  - `config.ini`: DB 접속 정보를 저장하는 설정 파일
  - `requirements.txt`: Python 필요 라이브러리 목록
