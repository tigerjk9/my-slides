/**
 * slides/ 폴더를 읽어 발표용 웹앱을 만든다.
 *
 *   node build.js
 *
 * 하는 일
 *   1. slides/ 안의 HTML 파일을 번호 순으로 모은다
 *   2. 각 파일에서 제목을 뽑아 목차를 만든다
 *   3. 넘겨보는 뷰어(index.html)를 새로 쓴다
 *
 * 설치할 것이 없다. Node 만 있으면 돈다.
 * 슬라이드를 고치거나 추가한 뒤 다시 돌리면 그만큼 반영된다.
 */
const fs = require('fs');
const path = require('path');

const SLIDES = 'slides';
const CONFIG = 'deck.config.json';

function loadConfig() {
  const fallback = {
    title: '발표 제목',
    subtitle: '',
    speaker: '',
    date: '',
    footer: '',
  };
  if (!fs.existsSync(CONFIG)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) };
  } catch (e) {
    console.error(`${CONFIG} 를 읽지 못했습니다 — 쉼표나 따옴표를 확인해 주세요.`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }
}

// 슬라이드 파일에서 제목을 찾는다: <h1> → <title> → 파일명 순
function titleOf(file, html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return clean(h1[1]);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return clean(t[1]);
  return file.replace(/\.html?$/i, '').replace(/^\d+[-_.\s]*/, '');
}
function clean(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function main() {
  if (!fs.existsSync(SLIDES)) {
    console.error(`${SLIDES}/ 폴더가 없습니다. 만들고 슬라이드 HTML 을 넣어 주세요.`);
    process.exit(1);
  }
  const files = fs.readdirSync(SLIDES)
    .filter(f => /\.html?$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));

  if (!files.length) {
    console.error(`${SLIDES}/ 에 슬라이드가 없습니다. 01-표지.html 처럼 번호를 붙여 넣어 주세요.`);
    process.exit(1);
  }

  const cfg = loadConfig();
  const deck = files.map(f => ({
    file: f,
    title: titleOf(f, fs.readFileSync(path.join(SLIDES, f), 'utf8')),
  }));

  fs.writeFileSync('index.html', render(cfg, deck), 'utf8');

  console.log(`슬라이드 ${deck.length}장으로 발표 웹앱을 만들었습니다.`);
  deck.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2, '0')}  ${d.title}`));
  console.log('\nindex.html 을 브라우저로 열어 보세요. 좌우 화살표로 넘깁니다.');
}

function render(cfg, deck) {
  const slidesJson = JSON.stringify(deck.map(d => ({ f: `${SLIDES}/${d.file}`, t: d.title })));
  const toc = deck.map((d, i) => `
      <button class="toc-item" data-go="${i}">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <span class="t">${esc(d.title)}</span>
      </button>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.subtitle || cfg.title)}">
<style>
  :root { --bg:#1E1B2E; --panel:#2A2640; --ink:#F4F2F8; --ink-2:#B8B2CC; --ink-3:#7C74A8;
          --purple:#6256A2; --magenta:#E75297; --line:rgba(255,255,255,.08); }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { height:100%; }
  body { background:var(--bg); color:var(--ink-2); overflow:hidden;
         font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;
         word-break:keep-all; }

  /* 상단 바 */
  .bar { position:fixed; top:0; left:0; right:0; height:52px; z-index:20;
         background:rgba(30,27,46,.92); backdrop-filter:blur(8px);
         border-bottom:1px solid var(--line);
         display:flex; align-items:center; gap:12px; padding:0 14px; }
  .bar .title { font-size:14px; font-weight:700; color:var(--ink);
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
  .bar .meta { font-size:11.5px; color:var(--ink-3); white-space:nowrap; }
  .bar button { background:transparent; border:1px solid var(--line); color:var(--ink-2);
                border-radius:8px; padding:6px 11px; font:inherit; font-size:12px;
                cursor:pointer; white-space:nowrap; }
  .bar button:hover { background:var(--panel); color:var(--ink); }

  /* 슬라이드 무대 — 16:9 를 화면에 맞춘다 */
  .stage { position:fixed; inset:52px 0 46px; display:flex;
           align-items:center; justify-content:center; padding:14px; }
  .frame { position:relative; width:100%; max-width:calc((100vh - 130px) * 16 / 9);
           aspect-ratio:16/9; background:#fff; border-radius:10px; overflow:hidden;
           box-shadow:0 14px 48px rgba(0,0,0,.45); }
  .frame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }

  /* 하단 바 */
  .foot { position:fixed; bottom:0; left:0; right:0; height:46px; z-index:20;
          background:rgba(30,27,46,.92); backdrop-filter:blur(8px);
          border-top:1px solid var(--line);
          display:flex; align-items:center; gap:10px; padding:0 14px; }
  .foot .nav { display:flex; gap:6px; }
  .foot .page { font-size:12.5px; color:var(--ink-2); min-width:62px; text-align:center;
                font-variant-numeric:tabular-nums; }
  .foot .cap { font-size:12px; color:var(--ink-3); flex:1;
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .foot button { background:var(--panel); border:1px solid var(--line); color:var(--ink);
                 border-radius:8px; width:34px; height:30px; font-size:15px; cursor:pointer; }
  .foot button:hover { background:var(--purple); }
  .progress { position:fixed; bottom:46px; left:0; height:2px; background:var(--magenta);
              z-index:21; transition:width .2s ease; }

  /* 목차 */
  .toc { position:fixed; inset:0; z-index:30; background:rgba(20,18,32,.97);
         padding:70px 20px 24px; overflow:auto; display:none; }
  .toc.open { display:block; }
  .toc h2 { color:var(--ink); font-size:17px; margin-bottom:16px; text-align:center; }
  .toc-grid { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:7px; }
  .toc-item { display:flex; align-items:center; gap:14px; width:100%; text-align:left;
              background:var(--panel); border:1px solid var(--line); border-radius:10px;
              padding:12px 15px; color:var(--ink-2); font:inherit; cursor:pointer; }
  .toc-item:hover { border-color:var(--purple); color:var(--ink); }
  .toc-item.now { border-color:var(--magenta); }
  .toc-item .n { color:var(--ink-3); font-size:12.5px; font-weight:700;
                 font-variant-numeric:tabular-nums; }
  .toc-item .t { font-size:13.5px; }

  /* QR */
  .qr { position:fixed; inset:0; z-index:40; background:rgba(20,18,32,.97);
        display:none; align-items:center; justify-content:center; flex-direction:column; gap:16px; }
  .qr.open { display:flex; }
  .qr .box { background:#fff; padding:18px; border-radius:14px; }
  .qr .box img { display:block; width:232px; height:232px; }
  .qr p { color:var(--ink-2); font-size:13.5px; text-align:center; }
  .qr code { color:var(--ink-3); font-size:12px; word-break:break-all; max-width:320px;
             display:block; margin-top:6px; }

  @media (max-width:640px) {
    .bar .meta { display:none; }
    .stage { inset:52px 0 46px; padding:8px; }
    .foot .cap { display:none; }
  }
</style>
</head>
<body>

<div class="bar">
  <span class="title">${esc(cfg.title)}</span>
  <span class="meta">${esc([cfg.speaker, cfg.date].filter(Boolean).join(' · '))}</span>
  <button id="btn-toc">목차</button>
  <button id="btn-qr">QR</button>
  <button id="btn-full">전체화면</button>
</div>

<div class="stage">
  <div class="frame"><iframe id="slide" title="슬라이드"></iframe></div>
</div>

<div class="progress" id="progress"></div>
<div class="foot">
  <div class="nav">
    <button id="btn-prev" aria-label="이전">‹</button>
    <button id="btn-next" aria-label="다음">›</button>
  </div>
  <span class="page" id="page">1 / ${deck.length}</span>
  <span class="cap" id="cap"></span>
</div>

<div class="toc" id="toc">
  <h2>목차</h2>
  <div class="toc-grid">${toc}
  </div>
</div>

<div class="qr" id="qr">
  <div class="box"><img id="qr-img" alt="이 발표자료 주소 QR"></div>
  <p>휴대폰으로 찍으면 같은 자료가 열립니다<code id="qr-url"></code></p>
</div>

<script src="vendor/qrcode.js"></script>
<script>
const SLIDES = ${slidesJson};
let i = 0;

const $ = id => document.getElementById(id);
function show(n) {
  i = Math.max(0, Math.min(SLIDES.length - 1, n));
  $('slide').src = SLIDES[i].f;
  $('page').textContent = (i + 1) + ' / ' + SLIDES.length;
  $('cap').textContent = SLIDES[i].t;
  $('progress').style.width = ((i + 1) / SLIDES.length * 100) + '%';
  document.querySelectorAll('.toc-item').forEach((el, k) => el.classList.toggle('now', k === i));
  location.hash = '#' + (i + 1);
}

$('btn-prev').onclick = () => show(i - 1);
$('btn-next').onclick = () => show(i + 1);
$('btn-toc').onclick = () => $('toc').classList.toggle('open');
$('btn-full').onclick = () => document.fullscreenElement
  ? document.exitFullscreen() : document.documentElement.requestFullscreen();

document.querySelectorAll('.toc-item').forEach(el => {
  el.onclick = () => { show(Number(el.dataset.go)); $('toc').classList.remove('open'); };
});

// 오버레이는 바깥을 눌러도 닫힌다. 안 그러면 화면을 덮은 채로 버튼을 못 누른다.
$('toc').onclick = e => { if (e.target === $('toc')) $('toc').classList.remove('open'); };
$('qr').onclick = () => $('qr').classList.remove('open');

// QR — 페이지가 스스로 자기 주소를 담는다. 저장소 이름이 바뀌어도 맞는다.
$('btn-qr').onclick = () => {
  const box = $('qr');
  if (!box.classList.contains('open')) {
    const url = location.href.split('#')[0];
    const q = qrcode(0, 'M');
    q.addData(url); q.make();
    $('qr-img').src = q.createDataURL(6, 8);
    $('qr-url').textContent = url;
  }
  box.classList.toggle('open');
};

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); show(i + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
  else if (e.key === 'Home') show(0);
  else if (e.key === 'End') show(SLIDES.length - 1);
  else if (e.key === 'Escape') { $('toc').classList.remove('open'); $('qr').classList.remove('open'); }
  else if (e.key.toLowerCase() === 't') $('btn-toc').click();
});

// 휴대폰 스와이프
let x0 = null;
addEventListener('touchstart', e => { x0 = e.changedTouches[0].clientX; }, { passive: true });
addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 55) show(i + (dx < 0 ? 1 : -1));
  x0 = null;
}, { passive: true });

show(Number(location.hash.slice(1)) - 1 || 0);
</script>
</body>
</html>
`;
}

main();
