# DigitalTwin3js

## 구성
- backend/ : Flask + cx_Oracle → Oracle DB에서 최신 위상각을 REST API로 제공
- frontend/ : Three.js 웹 UI → 캠샤프트 위상각 측정기 3D 모델 + 알람 패널

## 실행 방법
1. Oracle Instant Client 설치 & cx_Oracle 설정
2. Python 백엔드 실행
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
