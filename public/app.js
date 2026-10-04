const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* navigation privée */ } },
};

let me = store.get('panorama:user') || '';
let posts = [];
let filterAuthor = '';
let openId = null;

// ── Utilitaires ───────────────────────────────────────────────────────────
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...children);
  return n;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  const units = [['an', 31536000], ['mois', 2592000], ['j', 86400], ['h', 3600], ['min', 60]];
  for (const [u, v] of units) if (s >= v) return `il y a ${Math.floor(s / v)} ${u}`;
  return "à l'instant";
}

// ── Pseudo ────────────────────────────────────────────────────────────────
function askName() {
  $('nameInput').value = me;
  $('nameDlg').showModal();
}

function renderWho() {
  $('whoBtn').textContent = me ? `👤 ${me}` : 'Choisir un pseudo';
}

$('nameForm').addEventListener('submit', () => {
  const v = $('nameInput').value.trim().replace(/[<>]/g, '').slice(0, 24);
  if (!v) return;
  me = v;
  store.set('panorama:user', me);
  renderWho();
  load();
});
$('whoBtn').onclick = askName;

// ── Fil ───────────────────────────────────────────────────────────────────
async function load() {
  const q = new URLSearchParams({ me });
  if (filterAuthor) q.set('author', filterAuthor);
  try {
    posts = await api('/api/posts?' + q);
  } catch (e) {
    return toast(e.message);
  }
  renderGrid();
  if (openId) {
    const p = posts.find((x) => x.id === openId);
    if (p) renderLightbox(p);
  }
}

function renderGrid() {
  const grid = $('grid');
  grid.replaceChildren(...posts.map((p, i) => {
    const card = el('article', { className: 'card', tabIndex: 0 });
    card.style.animationDelay = Math.min(i, 12) * 45 + 'ms';
    const img = el('img', { src: p.image, alt: p.caption || `Photo de ${p.author}`, loading: 'lazy' });
    const meta = el('div', { className: 'meta' },
      el('span', { className: 'by' }, p.author),
      el('span', { className: 'stats' }, `${p.liked ? '❤' : '♡'} ${p.likeCount}`, `💬 ${p.comments.length}`));
    card.append(img, meta);
    card.onclick = () => openLightbox(p.id);
    card.onkeydown = (e) => { if (e.key === 'Enter') openLightbox(p.id); };
    return card;
  }));
  $('empty').hidden = posts.length > 0;
  $('filter').hidden = !filterAuthor;
  $('filterName').textContent = filterAuthor;
}

function setFilter(author) {
  filterAuthor = author;
  if ($('lightbox').open) closeLightbox();
  load();
}
$('clearFilter').onclick = () => setFilter('');
$('logo').onclick = (e) => { e.preventDefault(); setFilter(''); };

// ── Lightbox ──────────────────────────────────────────────────────────────
function openLightbox(id) {
  openId = id;
  renderLightbox(posts.find((p) => p.id === id));
  if (!$('lightbox').open) $('lightbox').showModal();
}

function closeLightbox() {
  openId = null;
  $('lightbox').close();
}

function renderLightbox(p) {
  $('lbImg').src = p.image;
  $('lbImg').alt = p.caption || `Photo de ${p.author}`;
  $('lbAuthor').textContent = p.author;
  $('lbAuthor').onclick = () => setFilter(p.author);
  $('lbTime').textContent = ago(p.createdAt);
  $('lbCaption').textContent = p.caption;
  $('lbCaption').hidden = !p.caption;
  $('lbLikes').textContent = `${p.likeCount} j'aime`;
  const like = $('lbLike');
  like.textContent = p.liked ? '❤' : '♡';
  like.classList.toggle('on', p.liked);
  $('lbDelete').hidden = p.author !== me;
  const list = $('lbComments');
  list.replaceChildren(...p.comments.map((c) => el('li', {}, el('b', {}, c.author), c.text)));
  if (!p.comments.length) list.append(el('li', { style: 'color:var(--muted);border:0' }, 'Pas encore de commentaire.'));
  list.scrollTop = list.scrollHeight;
}

async function toggleLike(id) {
  if (!me) return askName();
  try {
    const updated = await api(`/api/posts/${id}/like`, json({ user: me }));
    const i = posts.findIndex((p) => p.id === id);
    posts[i] = updated;
    renderGrid();
    if (openId === id) renderLightbox(updated);
    return updated;
  } catch (e) { toast(e.message); }
}

$('lbLike').onclick = () => toggleLike(openId);
$('lbImg').ondblclick = async () => {
  const p = posts.find((x) => x.id === openId);
  const b = $('lbBurst');
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  if (p && !p.liked) toggleLike(openId);
};
$('lbClose').onclick = closeLightbox;
$('lightbox').addEventListener('click', (e) => { if (e.target === $('lightbox')) closeLightbox(); });
$('lightbox').addEventListener('close', () => { openId = null; });

$('cForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!me) return askName();
  const text = $('cInput').value.trim();
  if (!text) return;
  try {
    const updated = await api(`/api/posts/${openId}/comments`, json({ user: me, text }));
    posts[posts.findIndex((p) => p.id === openId)] = updated;
    $('cInput').value = '';
    renderLightbox(updated);
    renderGrid();
  } catch (err) { toast(err.message); }
});

$('lbDelete').onclick = async () => {
  if (!confirm('Supprimer cette photo ?')) return;
  try {
    await api(`/api/posts/${openId}?me=${encodeURIComponent(me)}`, { method: 'DELETE' });
    closeLightbox();
    toast('Photo supprimée');
    load();
  } catch (err) { toast(err.message); }
};

// ── Upload ────────────────────────────────────────────────────────────────
let chosen = null;

function setFile(f) {
  if (!f) return;
  if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) return toast('Format non supporté (jpg, png, gif, webp)');
  if (f.size > 10 * 1024 * 1024) return toast('Photo trop lourde (10 Mo max)');
  chosen = f;
  const pv = $('preview');
  if (pv.src) URL.revokeObjectURL(pv.src);
  pv.src = URL.createObjectURL(f);
  pv.hidden = false;
  $('dropHint').hidden = true;
  $('upSubmit').disabled = false;
}

function resetUpload() {
  chosen = null;
  $('upForm').reset();
  $('preview').hidden = true;
  $('dropHint').hidden = false;
  $('upSubmit').disabled = true;
}

$('addBtn').onclick = () => {
  if (!me) return askName();
  resetUpload();
  $('upDlg').showModal();
};
$('upCancel').onclick = () => $('upDlg').close();
$('file').onchange = (e) => setFile(e.target.files[0]);
const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

$('upForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!chosen) return;
  const fd = new FormData();
  fd.append('author', me);
  fd.append('caption', $('caption').value);
  fd.append('photo', chosen);
  $('upSubmit').disabled = true;
  $('upSubmit').textContent = 'Envoi…';
  try {
    await api('/api/posts', { method: 'POST', body: fd });
    $('upDlg').close();
    toast('Photo publiée ✨');
    filterAuthor = '';
    load();
  } catch (err) {
    toast(err.message);
    $('upSubmit').disabled = false;
  } finally {
    $('upSubmit').textContent = 'Publier';
  }
});

// ── Démarrage ─────────────────────────────────────────────────────────────
renderWho();
load();
if (!me) askName();
