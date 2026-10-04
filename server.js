const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Mini base de données JSON ─────────────────────────────────────────────
let db = { posts: [] };

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    seed();
    save();
  }
}

// Photos de démonstration générées en SVG pour que le fil ne soit jamais vide au premier lancement
function seed() {
  const scenes = [
    { file: 'seed-aurore.svg', a: '#0f2027', b: '#2c5364', c: '#7bffd4', author: 'Luna', caption: 'Aurore au-dessus du fjord', likes: ['Max', 'Zoé'] },
    { file: 'seed-coucher.svg', a: '#ff9966', b: '#ff5e62', c: '#ffe29f', author: 'Max', caption: 'Dernier soleil sur la baie', likes: ['Luna'] },
    { file: 'seed-neon.svg', a: '#1a002e', b: '#6a00f4', c: '#ff2bd6', author: 'Zoé', caption: 'Tokyo, 2h du matin', likes: ['Luna', 'Max', 'Sam'] },
    { file: 'seed-foret.svg', a: '#134e5e', b: '#71b280', c: '#d9f99d', author: 'Sam', caption: 'Brume dans la forêt', likes: [] },
  ];
  scenes.forEach((s, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${i % 2 ? 1000 : 600}" viewBox="0 0 800 ${i % 2 ? 1000 : 600}" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.a}"/><stop offset="1" stop-color="${s.b}"/></linearGradient>
  <radialGradient id="s"><stop offset="0" stop-color="${s.c}"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></radialGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <circle cx="560" cy="${i % 2 ? 420 : 300}" r="220" fill="url(#s)"/>
  <circle cx="560" cy="${i % 2 ? 420 : 300}" r="46" fill="${s.c}"/>
  <path d="M0 ${i % 2 ? 760 : 460} Q200 ${i % 2 ? 640 : 380} 400 ${i % 2 ? 740 : 450} T800 ${i % 2 ? 700 : 430} V1000 H0Z" fill="#000" fill-opacity=".45"/>
  <path d="M0 ${i % 2 ? 860 : 520} Q260 ${i % 2 ? 780 : 470} 520 ${i % 2 ? 850 : 520} T800 ${i % 2 ? 820 : 500} V1000 H0Z" fill="#000" fill-opacity=".6"/>
</svg>`;
    fs.writeFileSync(path.join(UPLOAD_DIR, s.file), svg);
    db.posts.push({
      id: crypto.randomUUID(),
      author: s.author,
      caption: s.caption,
      image: `/uploads/${s.file}`,
      createdAt: new Date(Date.now() - (i + 1) * 3600e3 * 5).toISOString(),
      likes: s.likes,
      comments: i === 2 ? [{ id: crypto.randomUUID(), author: 'Luna', text: 'Cette lumière 😍', createdAt: new Date().toISOString() }] : [],
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const cleanName = (v) => clean(v, 24).replace(/[<>]/g, '');

function view(post, me) {
  return {
    id: post.id,
    author: post.author,
    caption: post.caption,
    image: post.image,
    createdAt: post.createdAt,
    likeCount: post.likes.length,
    liked: !!me && post.likes.includes(me),
    comments: post.comments,
  };
}

const findPost = (id) => db.posts.find((p) => p.id === id);

// ── Upload ────────────────────────────────────────────────────────────────
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(EXT[file.mimetype] ? null : new Error('Format non supporté (jpg, png, gif, webp)'), !!EXT[file.mimetype]),
});

// ── API ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10kb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'") }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/posts', (req, res) => {
  const me = cleanName(req.query.me);
  const author = cleanName(req.query.author);
  const posts = [...db.posts]
    .filter((p) => !author || p.author === author)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => view(p, me));
  res.json(posts);
});

app.post('/api/posts', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune photo reçue' });
  const author = cleanName(req.body.author);
  if (!author) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Choisis un pseudo' });
  }
  const post = {
    id: crypto.randomUUID(),
    author,
    caption: clean(req.body.caption, 280),
    image: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString(),
    likes: [],
    comments: [],
  };
  db.posts.push(post);
  save();
  res.status(201).json(view(post, author));
});

app.post('/api/posts/:id/like', (req, res) => {
  const post = findPost(req.params.id);
  const me = cleanName(req.body.user);
  if (!post) return res.status(404).json({ error: 'Photo introuvable' });
  if (!me) return res.status(400).json({ error: 'Choisis un pseudo' });
  const i = post.likes.indexOf(me);
  if (i === -1) post.likes.push(me);
  else post.likes.splice(i, 1);
  save();
  res.json(view(post, me));
});

app.post('/api/posts/:id/comments', (req, res) => {
  const post = findPost(req.params.id);
  const author = cleanName(req.body.user);
  const text = clean(req.body.text, 500);
  if (!post) return res.status(404).json({ error: 'Photo introuvable' });
  if (!author || !text) return res.status(400).json({ error: 'Pseudo et commentaire requis' });
  post.comments.push({ id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() });
  save();
  res.status(201).json(view(post, author));
});

app.delete('/api/posts/:id', (req, res) => {
  const post = findPost(req.params.id);
  const me = cleanName(req.query.me);
  if (!post) return res.status(404).json({ error: 'Photo introuvable' });
  if (post.author !== me) return res.status(403).json({ error: 'Tu ne peux supprimer que tes photos' });
  db.posts = db.posts.filter((p) => p !== post);
  save();
  if (!path.basename(post.image).startsWith('seed-')) fs.unlink(path.join(UPLOAD_DIR, path.basename(post.image)), () => {});
  res.status(204).end();
});

app.use((err, req, res, next) => {
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (10 Mo max)' : err.message });
});

load();
app.listen(PORT, () => console.log(`Panorama → http://localhost:${PORT}`));
