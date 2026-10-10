# 기술 레포트

기술 레포트를 웹에서 읽는 정적 사이트입니다. 빌드 없이 HTML·CSS·JS 만 씁니다. Vercel 로 배포합니다.

## 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 레포트 목록과 검색(제목·태그·요약·글쓴이) |
| `report.html?id=<id>` | 레포트 읽기 |
| `reports/index.json` | 레포트 목록(제목·글쓴이·날짜·태그·요약·원문 주소) |
| `reports/<id>.md` | 레포트 본문(Markdown) |
| `reports/img/<id>/` | 레포트 그림 |
| `assets/app.js` · `style.css` | 화면 코드 · 모양 |
| `middleware.js` | 로그인 검사(공용 비밀번호, 로그인 전에는 모두 막음) |
| `login.html` | 로그인 화면 |
| `assets/vendor/` | marked 12.0.2(Markdown 변환), DOMPurify 3.1.6(안전 처리) |

## 레포트 추가

1. `reports/<id>.md` 에 본문을 씁니다. `id` 는 `2026-09-주제` 처럼 영문·숫자·`-` 만 씁니다.
2. `reports/index.json` 에 한 줄을 추가합니다.
3. 그림은 `reports/img/<id>/fig-1.jpg` 처럼 올리고 본문에 `![그림 설명](img/<id>/fig-1.jpg)` 로 넣습니다. 그림 설명은 그림 밑에 나옵니다. 파일이 없으면 설명만 보입니다.
4. 본문의 `[4]` 같은 번호는 맨 아래 `## 출처` 목록의 4번으로 자동 연결됩니다.

## 로그인

주소는 누구나 열 수 있지만 공용 비밀번호를 넣기 전에는 로그인 화면만 보입니다. 목록 · 본문 · 그림 모두 막힙니다(`middleware.js`).

- 비밀번호는 Vercel → 프로젝트 → Settings → Environment Variables 의 `SITE_PASSWORD` 하나뿐입니다(Type: Secret).
- 바꾸려면 `SITE_PASSWORD` 를 새로 넣고 Deployments 에서 **Redeploy** 합니다. 바꾸면 모두 다시 로그인해야 합니다.
- 로그인은 30일 유지되고, 화면 오른쪽 위 '로그아웃'으로 끝낼 수 있습니다.

## 공개 범위

다른 곳에서 가져온 유료 글이 들어갈 수 있으므로 내부용으로만 씁니다.
- 저장소는 비공개로 둡니다.
- 비밀번호(`SITE_PASSWORD`)는 코드 · 문서 · 대화에 적지 않습니다.
- 검색엔진이 모으지 않도록 `robots.txt` 와 `noindex` 를 걸어 두었습니다.
- 각 레포트에는 글쓴이와 원문을 밝힙니다. 다른 독자의 댓글은 옮기지 않습니다.
