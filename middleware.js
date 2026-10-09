// 접속 제한 (Vercel Routing Middleware, 프로젝트 루트). guro-db middleware.js 와 같은 방식 — 사무실 IP 를 바꾸면 둘 다 고칩니다.
// 1) 사무실 공인 IP (ALLOWED) 에서는 그대로 허용
// 2) 사무실 밖의 특정 사람: 초대 링크 (…/?pass=열쇠) 로 한 번 들어오면 쿠키가 남아 이후엔 그냥 접속
//    열쇠는 Vercel 환경변수 ACCESS_KEY 에만 있습니다 (코드·문서에 넣지 않음). 열쇠를 바꾸면 이전 초대는 모두 무효.
const ALLOWED = ['106.242.74.235', '106.242.74.236', '182.222.66.251'];   // 사무실 2곳 + 담당자 맥북(Devin, 2026-10-02 추가)
const COOKIE = 'tr_pass';
const DAYS = 180;

export default function middleware(request) {
  const ip = (request.headers.get('x-real-ip') ||
              request.headers.get('x-vercel-forwarded-for') ||
              request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ALLOWED.includes(ip)) return; // 사무실 → 원래 페이지 표시

  const key = (typeof process !== 'undefined' && process.env && process.env.ACCESS_KEY) || '';
  if (key) {
    const url = new URL(request.url);
    // 초대 링크로 들어온 경우: 쿠키를 심고 같은 주소(열쇠 제거)로 보냄
    if (url.searchParams.get('pass') === key) {
      url.searchParams.delete('pass');
      return new Response(null, { status: 302, headers: {
        location: url.pathname + (url.search || '') + (url.hash || ''),
        'set-cookie': `${COOKIE}=${key}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store' } });
    }
    const cookies = request.headers.get('cookie') || '';
    if (cookies.split(';').some(c => c.trim() === `${COOKIE}=${key}`)) return; // 초대받은 사람 → 허용
  }

  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>접속 제한 · 기술 레포트</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;' +
    'background:linear-gradient(135deg,#0F3E9E,#2566CF);color:#fff;font-family:system-ui,sans-serif">' +
    '<div style="padding:24px"><h1 style="font-size:22px;margin:0 0 8px">사무실 네트워크에서만 접속할 수 있습니다</h1>' +
    '<p style="opacity:.8;margin:0">IBK창공 구로 사무실 와이파이에 연결한 뒤 다시 접속해 주세요.</p>' +
    '<p style="opacity:.55;font-size:12px;margin-top:16px">접속 IP: ' + (ip || '확인 불가') + '</p></div></body>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}
