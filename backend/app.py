from flask import Flask, jsonify
import cx_Oracle

app = Flask(__name__)

# Oracle DB 연결 설정
dsn = cx_Oracle.makedsn("DB_HOST", 1521, service_name="ORCL")
conn = cx_Oracle.connect(user="USER", password="PASSWORD", dsn=dsn)

@app.route("/api/phase")
def get_phase():
    cur = conn.cursor()
    cur.execute("""
        SELECT phase_angle
        FROM PHASE_TABLE
        ORDER BY rdate DESC
        FETCH FIRST 1 ROWS ONLY
    """)
    row = cur.fetchone()
    angle = float(row[0]) if row else None
    return jsonify({"angle": angle})

if __name__ == "__main__":
    # 개발용 실행 (운영시에는 gunicorn, nginx와 연동 권장)
    app.run(host="0.0.0.0", port=5000, debug=True)
