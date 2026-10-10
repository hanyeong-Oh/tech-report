// 로그인 (Vercel Routing Middleware, 프로젝트 루트에 둘 것)
// 주소는 누구나 열 수 있지만, 공용 비밀번호를 넣기 전에는 로그인 화면만 보입니다.
// 비밀번호: Vercel 환경변수 SITE_PASSWORD 하나뿐 (코드·문서에 적지 않음).
// 비밀번호를 바꾸면 모두의 로그인이 끊깁니다. 환경변수를 바꾼 뒤에는 Vercel 에서 다시 배포해야 반영됩니다.
const COOKIE = 'tr_session';
const DAYS = 30;
const OPEN = ['/login', '/login.html', '/assets/style.css', '/robots.txt', '/favicon.ico'];

const enc = new TextEncoder();
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
function same(a, b) {   // 시간 차 없이 비교
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sign(text) {   // 비밀번호 자체를 서명 열쇠로 씀 → 비밀번호를 바꾸면 기존 쿠키 무효
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SITE_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
// 쿠키 값 = 만료시각.서명
async function loggedIn(request) {
  const c = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!c) return false;
  const [exp, sig] = c.slice(COOKIE.length + 1).split('.');
  if (!(Number(exp) > Date.now()) || !sig) return false;
  return same(sig, await sign('tr|' + exp));
}
const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') && !n.startsWith('/login')) ? n : '/';
const go = (to, cookie) => new Response(null, { status: 303, headers: Object.assign(
  { location: to, 'cache-control': 'no-store' }, cookie ? { 'set-cookie': cookie } : {}) });

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!process.env.SITE_PASSWORD) {
    if (path === '/assets/style.css') return;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>설정 필요</title><link rel="stylesheet" href="/assets/style.css"><main class="wrap narrow">' +
      '<h1 class="pagetitle">처음 설정이 필요합니다</h1><ol>' +
      '<li>Vercel → 이 프로젝트 → Settings → Environment Variables 에 <code>SITE_PASSWORD</code>(공용 비밀번호)를 넣습니다.</li>' +
      '<li>Deployments 에서 맨 위 배포의 ⋯ → Redeploy 를 누릅니다.</li></ol></main>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  if (path === '/logout') return go('/login', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

  if (path === '/login' && request.method === 'POST') {
    const f = await request.formData();
    const next = safeNext(f.get('next'));
    if (!same(await sha(String(f.get('pw') || '')), await sha(process.env.SITE_PASSWORD))) {
      return go('/login?e=1&next=' + encodeURIComponent(next));
    }
    const exp = Date.now() + DAYS * 86400000;
    return go(next, `${COOKIE}=${exp}.${await sign('tr|' + exp)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`);
  }

  if (OPEN.includes(path)) return;
  if (await loggedIn(request)) return;   // 로그인됨 → 원래 파일

  const wantsPage = (request.headers.get('accept') || '').includes('text/html');
  if (wantsPage) return go('/login?next=' + encodeURIComponent(path + url.search));
  return new Response('로그인이 필요합니다.', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
