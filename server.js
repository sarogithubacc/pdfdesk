const express = require('express'), multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs/promises'), path = require('path'), os = require('os'), crypto = require('crypto');

const MAX = (+process.env.MAX_MB || 100) * 1024 * 1024;
const CONC = +process.env.CONCURRENCY || 2;
const TMO = (+process.env.TIMEOUT_SEC || 180) * 1000;

const app = express();
app.disable('x-powered-by');
const up = multer({ dest: path.join(os.tmpdir(), 'pdfdesk-up'), limits: { fileSize: MAX, files: 1 } });

// limit simultaneous heavy jobs
let active = 0; const waiting = [];
const acquire = () => new Promise(r => { const t = () => active < CONC ? (active++, r()) : waiting.push(t); t(); });
const release = () => { active--; const n = waiting.shift(); n && n(); };

const run = (cmd, args, env) => new Promise((res, rej) =>
  execFile(cmd, args, { timeout: TMO, maxBuffer: 1 << 24, env: env || process.env },
    (e, so, se) => e ? rej(Object.assign(e, { stderr: se })) : res(so)));
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const mb = n => (n / 1048576).toFixed(2) + ' MB';
const isPdf = async p => { const h = await fs.open(p); const b = Buffer.alloc(1024); const { bytesRead } = await h.read(b, 0, 1024, 0); await h.close(); return b.subarray(0, bytesRead).includes('%PDF-'); };

const job = fn => async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'No file uploaded.' });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-'));
  let held = false;
  try {
    await acquire(); held = true;
    const out = await fn(req, f, dir);
    res.set('X-Note', out.note || ''); res.type('pdf');
    await new Promise((ok, no) => res.sendFile(out.file, e => e ? no(e) : ok()));
  } catch (e) {
    console.error('job failed', e.status || e.code, String(e.stderr || e.message).slice(0, 300).replace(/\n/g, ' '));
    if (!res.headersSent) res.status(e.status || 500).json({ error: e.status ? e.message : 'Processing failed. The file may be corrupt, encrypted or unsupported.' });
  } finally {
    if (held) release();
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(f.path, { force: true });
  }
};

app.get('/api/health', (q, r) => r.json({ ok: true }));

app.post('/api/compress', up.single('file'), job(async (req, f, dir) => {
  if (!await isPdf(f.path)) throw bad('That is not a valid PDF.');
  const preset = { low: '/printer', recommended: '/ebook', extreme: '/screen' }[req.body.level] || '/ebook';
  const out = path.join(dir, 'out.pdf');
  await run('gs', ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=' + preset, '-dNOPAUSE', '-dQUIET', '-dBATCH', '-dSAFER', '-sOutputFile=' + out, f.path]);
  const a = (await fs.stat(f.path)).size, b = (await fs.stat(out)).size;
  if (b >= a) return { file: f.path, note: 'This file was already well optimized, so it was returned unchanged.' };
  return { file: out, note: `Reduced from ${mb(a)} to ${mb(b)} (${Math.round(100 - b / a * 100)}% smaller).` };
}));

app.post('/api/office', up.single('file'), job(async (req, f, dir) => {
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (!/^\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/.test(ext)) throw bad('Unsupported file type.');
  const inp = path.join(dir, 'input' + ext);
  await fs.copyFile(f.path, inp);
  await run('soffice', ['-env:UserInstallation=file://' + dir + '/profile', '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, inp], { ...process.env, HOME: dir });
  return { file: path.join(dir, 'input.pdf') };
}));

const LANGS = new Set(['eng', 'spa', 'fra', 'deu', 'ita', 'por']);
app.post('/api/ocr', up.single('file'), job(async (req, f, dir) => {
  if (!await isPdf(f.path)) throw bad('That is not a valid PDF.');
  const lang = LANGS.has(req.body.lang) ? req.body.lang : 'eng';
  const out = path.join(dir, 'out.pdf');
  await run('ocrmypdf', ['--skip-text', '--output-type', 'pdf', '-l', lang, f.path, out], { ...process.env, HOME: dir });
  return { file: out, note: 'Text layer added; the PDF is now searchable.' };
}));

app.post('/api/protect', up.single('file'), job(async (req, f, dir) => {
  if (!await isPdf(f.path)) throw bad('That is not a valid PDF.');
  const pw = String(req.body.password || '');
  if (!pw || pw.length > 127) throw bad('Password must be 1–127 characters.');
  const out = path.join(dir, 'out.pdf');
  try { await run('qpdf', ['--encrypt', pw, crypto.randomBytes(16).toString('hex'), '256', '--', f.path, out]); }
  catch (e) { if (e.code !== 3) throw e; }
  return { file: out, note: 'Encrypted with AES-256.' };
}));

app.post('/api/unlock', up.single('file'), job(async (req, f, dir) => {
  if (!await isPdf(f.path)) throw bad('That is not a valid PDF.');
  const out = path.join(dir, 'out.pdf');
  try { await run('qpdf', ['--password=' + String(req.body.password || ''), '--decrypt', f.path, out]); }
  catch (e) {
    if (/invalid password/i.test(e.stderr || '')) throw bad('Incorrect password.');
    if (e.code !== 3) throw e;
  }
  return { file: out };
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  const big = err.code === 'LIMIT_FILE_SIZE';
  res.status(big ? 413 : 400).json({ error: big ? `File too large (max ${MAX / 1048576} MB).` : 'Upload failed.' });
});
app.listen(3000, () => console.log('PDFDesk listening on :3000'));
