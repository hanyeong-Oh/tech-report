// 기술 레포트: 목록(index.html)과 읽기(report.html). 빌드 없음.
var TR = (function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    return fetch('reports/index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); });
  }
  function byDate(a, b) { return (b.date || '').localeCompare(a.date || ''); }

  function list() {
    var box = document.getElementById('list'), q = document.getElementById('q'), all = [];
    function draw() {
      var k = q.value.trim().toLowerCase();
      var rows = all.filter(function (r) {
        return !k || [r.title, r.summary, r.author].concat(r.tags || []).join(' ').toLowerCase().indexOf(k) >= 0;
      });
      box.innerHTML = rows.length ? rows.map(function (r) {
        return '<li><a class="t" href="report.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.title) + '</a>' +
          '<div class="meta">' + esc(r.date) + ' · ' + esc(r.author) + (r.source ? ' · ' + esc(r.source) : '') + '</div>' +
          '<div>' + esc(r.summary) + '</div>' +
          '<div class="tags">' + (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></li>';
      }).join('') : '<li class="muted">찾는 레포트가 없습니다.</li>';
    }
    q.addEventListener('input', draw);
    load().then(function (d) { all = d.sort(byDate); draw(); })
      .catch(function () { box.innerHTML = '<li class="muted">목록을 불러오지 못했습니다.</li>'; });
  }

  function view() {
    var doc = document.getElementById('doc');
    var id = new URLSearchParams(location.search).get('id') || '';
    if (!/^[\w-]+$/.test(id)) { doc.innerHTML = '<p class="muted">레포트를 찾을 수 없습니다.</p>'; return; }
    Promise.all([
      load(),
      fetch('reports/' + id + '.md', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.text(); })
    ]).then(function (res) {
      var meta = res[0].filter(function (r) { return r.id === id; })[0] || { title: id };
      document.title = meta.title + ' · 기술 레포트';
      var head = '<h1>' + esc(meta.title) + '</h1><div class="byline">' +
        '<p>' + esc(meta.date) + ' · ' +
        (meta.author_url ? '<a href="' + esc(meta.author_url) + '" target="_blank" rel="noopener">' + esc(meta.author) + '</a>' : esc(meta.author)) +
        (meta.author_note ? ' (' + esc(meta.author_note) + ')' : '') + '</p>' +
        (meta.source ? '<p>원문: ' + (meta.source_url ? '<a href="' + esc(meta.source_url) + '" target="_blank" rel="noopener">' + esc(meta.source) + '</a>' : esc(meta.source)) + '</p>' : '') +
        '</div>';
      doc.innerHTML = head + DOMPurify.sanitize(marked.parse(res[1]));
      // 그림: 상대 경로는 reports/ 아래에서 찾고, 설명(alt)을 그림 밑 글로. 파일이 없으면 설명만 남긴다.
      doc.querySelectorAll('img').forEach(function (img) {
        var src = img.getAttribute('src') || '';
        if (!/^(https?:)?\/\//.test(src) && src.charAt(0) !== '/') img.src = 'reports/' + src;
        img.loading = 'lazy';
        var fig = document.createElement('figure'), cap = document.createElement('figcaption');
        cap.textContent = img.alt;
        var host = img.parentNode.tagName === 'P' && img.parentNode.childNodes.length === 1 ? img.parentNode : img;
        host.parentNode.replaceChild(fig, host);
        fig.appendChild(img); fig.appendChild(cap);
        img.onerror = function () { img.remove(); fig.classList.add('noimg'); };
      });
      // 출처 목록에 번호표(#ref-n)를 달고, 본문 [n] 을 위첨자 링크로 바꾼다.
      var refs = null;
      doc.querySelectorAll('h2').forEach(function (h) { if (h.textContent.trim() === '출처') refs = h.nextElementSibling; });
      if (refs && refs.tagName === 'OL') {
        Array.prototype.forEach.call(refs.children, function (li, i) { li.id = 'ref-' + (i + 1); });
        doc.querySelectorAll('a').forEach(function (a) { if (!refs.contains(a)) { a.target = '_blank'; a.rel = 'noopener'; } });
        refs.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
        var walk = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT), nodes = [];
        while (walk.nextNode()) if (!refs.contains(walk.currentNode) && /\[\d+\]/.test(walk.currentNode.nodeValue)) nodes.push(walk.currentNode);
        nodes.forEach(function (n) {
          var span = document.createElement('span');
          span.innerHTML = esc(n.nodeValue).replace(/\[(\d+)\]/g, '<sup><a href="#ref-$1">[$1]</a></sup>');
          n.parentNode.replaceChild(span, n);
        });
      }
    }).catch(function () { doc.innerHTML = '<p class="muted">레포트를 불러오지 못했습니다.</p>'; });
  }

  return { list: list, view: view };
})();
