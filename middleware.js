// 로그인 (Vercel Routing Middleware, 프로젝트 루트에 둘 것)
// 주소는 누구나 열 수 있지만, 로그인 전에는 로그인 화면과 계정 만들기 도구 말고는 아무것도 보이지 않습니다.
// 계정: Vercel 환경변수 USERS = "아이디:소금:해시" 를 공백·줄바꿈으로 나열 (tools/new-user.html 로 만듦).
//       비밀번호 자체는 어디에도 저장하지 않습니다. 계정을 빼거나 비밀번호를 바꾸면 그 사람의 기존 로그인도 끊깁니다.
// 서명: Vercel 환경변수 SESSION_SECRET (긴 임의 문자열). 바꾸면 모두 다시 로그인.
// 환경변수를 바꾼 뒤에는 Vercel 에서 다시 배포해야 반영됩니다.
const COOKIE = 'tr_session';
const DAYS = 30;
const ITER = 100000;   // tools/new-user.html 과 같아야 함
const OPEN = ['/login', '/login.html', '/tools/new-user', '/tools/new-user.html', '/assets/style.css', '/robots.txt', '/favicon.ico'];

const enc = new TextEncoder();
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
function same(a, b) {   // 시간 차 없이 비교
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function users() {
  const map = {};
  String(process.env.USERS || '').split(/\s+/).forEach(line => {
    const [id, salt, hash] = line.split(':');
    if (id && salt && hash) map[id.toLowerCase()] = { salt, hash };
  });
  return map;
}
async function pbkdf2(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, key, 256));
}
async function sign(text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
// 쿠키 값 = 아이디.만료시각.서명 (서명에 해시 앞부분을 섞어 비밀번호가 바뀌면 무효)
async function session(id, exp, u) { return id + '.' + exp + '.' + await sign(id + '.' + exp + '.' + u.hash.slice(0, 16)); }
async function whoami(request, list) {
  const c = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!c) return null;
  const val = c.slice(COOKIE.length + 1);
  const [id, exp] = val.split('.');
  const u = list[id];
  if (!u || !(Number(exp) > Date.now())) return null;
  return same(val, await session(id, exp, u)) ? id : null;
}
const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') && !n.startsWith('/login')) ? n : '/';
const go = (to, cookie) => new Response(null, { status: 303, headers: Object.assign(
  { location: to, 'cache-control': 'no-store' }, cookie ? { 'set-cookie': cookie } : {}) });

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!process.env.SESSION_SECRET || !process.env.USERS) {
    if (path.startsWith('/tools/new-user') || path === '/assets/style.css') return;   // 첫 계정은 만들 수 있게
    return new Response('<!doctype html><meta charset="utf-8"><title>설정 필요</title><p style="font-family:system-ui;padding:24px">' +
      'Vercel 환경변수 USERS · SESSION_SECRET 이 아직 없습니다. README 의 \'계정\' 장을 보세요.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const list = users();

  if (path === '/logout') return go('/login', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

  if (path === '/login' && request.method === 'POST') {
    const f = await request.formData();
    const id = String(f.get('id') || '').trim().toLowerCase();
    const pw = String(f.get('pw') || '');
    const next = safeNext(f.get('next'));
    const u = list[id];
    // 없는 아이디도 같은 계산을 해서 응답 시간으로 계정 유무를 알 수 없게
    const h = await pbkdf2(pw, u ? u.salt : 'no-such-user');
    if (!u || !same(h, u.hash)) return go('/login?e=1&next=' + encodeURIComponent(next));
    const exp = Date.now() + DAYS * 86400000;
    return go(next, `${COOKIE}=${await session(id, exp, u)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`);
  }

  if (OPEN.includes(path)) return;
  if (await whoami(request, list)) return;   // 로그인됨 → 원래 파일

  const wantsPage = (request.headers.get('accept') || '').includes('text/html');
  if (wantsPage) return go('/login?next=' + encodeURIComponent(path + url.search));
  return new Response('로그인이 필요합니다.', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
