# =====================================================================================
# Digital Twin 3D Viewer - Backend Server
#
# 역할:
# - Oracle DB에 연결하여 ZSCORE 테이블의 데이터를 조회합니다.
# - 프론트엔드(Three.js 뷰어)에 위상각(phase angle) 데이터를 JSON 형식으로 제공하는 API 서버 역할을 합니다.
#
# 주요 라이브러리:
# - Flask: 경량 웹 프레임워크
# - oracledb: Oracle DB 연결을 위한 최신 드라이버 (기존 cx_Oracle에서 마이그레이션)
# - Flask-Cors: 다른 출처(Origin)의 프론트엔드 요청을 허용하기 위한 라이브러리
# =====================================================================================

import configparser
import oracledb
from flask import Flask, jsonify, g
from flask_cors import CORS
import os
from cryptography.fernet import Fernet

# -------------------------------------------------------------------------------------
# [오류 해결 1] Oracle Instant Client 경로 명시적 초기화
# -------------------------------------------------------------------------------------
# 원인: oracledb 라이브러리가 시스템 환경변수(PATH)에 등록되지 않은 Oracle Client를
#       찾지 못해 'DPI-1047'과 같은 오류를 발생시켰습니다.
# 해결: oracledb.init_oracle_client()를 사용하여 코드 내에서 직접 Instant Client의
#       라이브러리 디렉토리(lib_dir) 경로를 지정해주어 문제를 해결했습니다.
# 주의: 클라우드서버를 사용하는 경우 python-oracledb 는 기본이 Thin 모드라서 주석처리
# -------------------------------------------------------------------------------------
# oracledb.init_oracle_client(lib_dir=r"C:\instantclient_19_27")

app = Flask(__name__)

# -------------------------------------------------------------------------------------
# [오류 해결 2] CORS(Cross-Origin Resource Sharing) 정책 문제 해결
# -------------------------------------------------------------------------------------
# 원인: 웹 브라우저의 보안 정책상, 다른 출처(예: http://127.0.0.1:5500)에서 실행되는
#       프론트엔드가 백엔드 API(http://127.0.0.1:5000)를 호출하는 것이 차단되었습니다.
# 해결: Flask-Cors 라이브러리를 사용하여 app에 대한 모든 외부 출처의 요청을 허용하도록
#       설정하여 문제를 해결했습니다.
# -------------------------------------------------------------------------------------
CORS(app)

# -------------------------------------------------------------------------------------
# [보안 강화] 암호화된 설정 파일(config.ini.enc) 복호화 로직
# -------------------------------------------------------------------------------------
# 기존에는 원본 config.ini 파일을 직접 읽었으나, 보안 강화를 위해 암호화된 파일을
# 읽고 메모리에서 복호화하여 설정값을 사용하도록 변경했습니다.
#
# 1. `secret.key` 파일에서 암호화 키를 불러옵니다.
# 2. `config.ini.enc` 파일을 읽어 암호화된 데이터를 가져옵니다.
# 3. Fernet을 사용하여 데이터를 복호화하고, configparser로 읽어옵니다.
# -------------------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_FILE = os.path.join(BASE_DIR, 'secret.key')
ENCRYPTED_CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini.enc')

def load_key():
    """secret.key 파일에서 암호화 키를 불러옵니다."""
    return open(KEY_FILE, "rb").read()

def decrypt_config():
    """암호화된 설정 파일을 복호화하여 configparser 객체로 반환합니다."""
    key = load_key()
    f = Fernet(key)
    
    with open(ENCRYPTED_CONFIG_FILE, "rb") as file:
        encrypted_data = file.read()
        
    decrypted_data = f.decrypt(encrypted_data)
    
    config = configparser.ConfigParser()
    config.read_string(decrypted_data.decode('utf-8'))
    return config

def get_db_config():
    """복호화된 설정값에서 [database] 섹션을 읽어옵니다."""
    config = decrypt_config()
    return config['database']

def get_db():
    """
    Flask의 Application Context(g)를 사용하여 데이터베이스 커넥션을 관리합니다.
    한번의 요청(request) 안에서는 동일한 커넥션을 재사용하여 효율성을 높입니다.
    """
    if 'db' not in g:
        db_config = get_db_config()
        db_host = db_config.get("DB_HOST")
        db_user = db_config.get("DB_USER")
        db_password = db_config.get("DB_PASSWORD")
        db_service_name = db_config.get("DB_SERVICE_NAME")
        db_port = db_config.getint("DB_PORT")
        
        dsn = f"{db_host}:{db_port}/{db_service_name}"
        g.db = oracledb.connect(user=db_user, password=db_password, dsn=dsn)
    return g.db

@app.teardown_appcontext
def teardown_db(exception):
    """요청(request)이 끝나면 데이터베이스 커넥션을 자동으로 닫습니다."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.route("/api/phase")
def get_phase():
    """ZSCORE 테이블에서 랜덤한 위상각(CAM1) 데이터를 조회하여 JSON으로 반환합니다."""
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()

        # -------------------------------------------------------------------------------------
        # [오류 해결 4 & 기능 개선] 랜덤 데이터 조회 쿼리 수정
        # -------------------------------------------------------------------------------------
        # 1. (기능 개선) 기존 `WHERE ROWNUM = 1`은 항상 동일한 데이터만 반환하여
        #    값이 변하지 않는 문제를 해결하기 위해 랜덤으로 데이터를 가져오도록 변경했습니다.
        # 2. (오류 해결) `ORDER BY ... FETCH FIRST` 구문이 구버전 Oracle과 호환되지 않아
        #    'ORA-00933' 오류를 발생시켰습니다.
        # 3. (해결) `ORDER BY DBMS_RANDOM.VALUE`로 테이블을 무작위 정렬한 후,
        #    바깥쪽 쿼리에서 `WHERE ROWNUM = 1`로 첫번째 행을 선택하는 방식으로 수정하여
        #    호환성 문제를 해결하고 랜덤 조회 기능을 구현했습니다.
        # -------------------------------------------------------------------------------------
        cur.execute('''
            SELECT CAM1 FROM (
                SELECT CAM1
                FROM ZSCORE
                ORDER BY DBMS_RANDOM.VALUE
            )
            WHERE ROWNUM = 1
        ''')

        row = cur.fetchone()
        angle = float(row[0]) if row else None
        return jsonify({"angle": angle})
    except oracledb.Error as e:
        # ORA-01017: invalid username/password 와 같은 DB 관련 오류를 처리합니다.
        print(f"데이터베이스 오류: {e}")
        return jsonify({"error": f"데이터베이스 오류가 발생했습니다: {e}"}), 500
    except Exception as e:
        # KeyError: 'database' 와 같은 예상치 못한 오류를 처리합니다.
        print(f"예상치 못한 오류: {e}")
        return jsonify({"error": f"예상치 못한 오류가 발생했습니다: {e}"}), 500
    finally:
        if cur:
            cur.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
