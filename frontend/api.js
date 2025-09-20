// API 호출 모듈
export async function fetchPhase() {
  try {
    const res = await fetch("/api/phase"); // Flask 백엔드
    const data = await res.json();
    return data.angle;
  } catch (e) {
    console.error("데이터 수신 실패:", e);
    return null;
  }
}
