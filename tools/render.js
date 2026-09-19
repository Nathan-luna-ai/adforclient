/* ------------------------------------------------------------------
   render.js — transforme une publicité HTML animée en MP4 livrable.

   Le rendu n'est PAS une capture d'écran en temps réel : la page est
   avancée image par image et la bande son est calculée hors ligne, puis
   les deux sont assemblés. Conséquences, qui sont tout l'intérêt :

     - aucune image perdue, quelle que soit la charge de la machine ;
     - son et image calés au sample, pas « à peu près » ;
     - reproductible : après une retouche de copie, une commande suffit
       pour régénérer le master.

   Usage :  node tools/render.js [dossier ...] [--fps 30] [--sd]
   Sans argument, rend les deux publicités vidéo.
   ------------------------------------------------------------------ */
const puppeteer = require('puppeteer');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'export');
const SR = 48000;                       // 48 kHz : la norme de livraison

const args = process.argv.slice(2);
const fps = num('--fps', 30);
const scale = args.includes('--sd') ? 0.5 : 1;   // aperçu rapide en 540x960
const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
const dirs = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
const targets = dirs.length ? dirs : ['ht-construction-ad', 'ht-construction-ad-petit', 'ht-construction-ad-long'];

function num(flag, dflt) {
  const i = args.indexOf(flag);
  return i > -1 && args[i + 1] ? Number(args[i + 1]) : dflt;
}

async function render(dir) {
  const page_url = 'file:///' + path.join(ROOT, dir, 'index.html').split(path.sep).join('/');
  const label = path.basename(dir);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required',
           '--force-device-scale-factor=1', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  /* Sans cela, un navigateur sans tête peut se déclarer « mouvement
     réduit » — et la publicité se rendrait sans zoom ni punch. */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  page.on('pageerror', e => { throw new Error(label + ' — erreur dans la page : ' + e.message); });

  await page.goto(page_url, { waitUntil: 'networkidle0' });
  const DUR = await page.evaluate(() => window.AD.DUR);
  const nFx = await page.evaluate(() => window.AD.scanFx());
  console.log(`\n${label} — ${DUR}s, ${Math.round(DUR * fps)} images, ${nFx} accents visuels`);

  /* ---- 1. la bande son, hors ligne ---- */
  process.stdout.write('  son     ... ');
  const a = await page.evaluate(sr => window.AD.renderAudio(sr), SR);
  const wavPath = path.join(OUT, label + '.wav');
  fs.writeFileSync(wavPath, Buffer.from(a.b64, 'base64'));
  const dbfs = v => (20 * Math.log10(v)).toFixed(1);
  console.log((fs.statSync(wavPath).size / 1048576).toFixed(1) + ' Mo'
    + '  (crête brute ' + dbfs(a.peak) + ' dBFS'
    + (a.gain < 1 ? ', ramenée à -1 dBFS' : ', intacte') + ')');

  /* ---- 2. les images, une par une ---- */
  await page.evaluate((w, h) => window.AD.framePage(w, h), W, H);
  const total = Math.round(DUR * fps);
  const mp4 = path.join(OUT, `${label}_${W}x${H}_${fps}fps.mp4`);

  const ff = spawn(ffmpeg, [
    '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
    '-i', wavPath,
    '-t', String(DUR),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    /* Cible de diffusion sociale : -14 LUFS, crête vraie -1 dBTP. Meta et
       TikTok renormalisent de toute façon ; livrer déjà au niveau évite
       qu'ils le fassent à leur façon. */
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11',
    '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR),
    '-movflags', '+faststart',
    '-shortest', mp4
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let ffErr = '';
  ff.stderr.on('data', d => { ffErr += d.toString(); });
  const done = new Promise((res, rej) => {
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c + '\n' + ffErr.slice(-1500))));
  });

  for (let i = 0; i < total; i++) {
    await page.evaluate(sec => window.AD.seekExport(sec), i / fps);
    const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0 || i === total - 1) {
      process.stdout.write(`\r  images  ... ${i + 1}/${total} (${Math.round((i + 1) / total * 100)}%)`);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();

  console.log(`\n  -> ${path.relative(ROOT, mp4)}  ${(fs.statSync(mp4).size / 1048576).toFixed(1)} Mo`);
  return mp4;
}

(async () => {
  const t0 = Date.now();
  for (const d of targets) await render(d);
  console.log(`\nTerminé en ${Math.round((Date.now() - t0) / 1000)}s. Fichiers dans export/\n`);
})().catch(e => { console.error('\nÉchec :', e.message); process.exit(1); });
