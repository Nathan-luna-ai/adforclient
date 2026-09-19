/* ------------------------------------------------------------------
   render-static.js — exporte les trois affiches aux trois formats.

   Même principe que le rendu vidéo : on ne fait pas de capture d'écran
   à la main. On force la carte à sa largeur de livraison (1080 px), ce
   qui fait résoudre toutes les unités de conteneur (cqw) exactement
   comme dans le fichier final, puis on photographie l'élément. Les
   proportions du texte sont donc identiques à ce que montre la page,
   et l'export est reproductible après n'importe quelle retouche.

   Usage :  node tools/render-static.js [--dir ht-construction-static]
   ------------------------------------------------------------------ */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'export');

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const DIR = dirArg > -1 && args[dirArg + 1] ? args[dirArg + 1] : 'ht-construction-static';

/* Les trois formats que Meta attend, avec leur largeur de livraison. */
const FORMATS = [
  { fmt: '45',  w: 1080, h: 1350, label: '1080x1350_4-5'  },
  { fmt: '11',  w: 1080, h: 1080, label: '1080x1080_1-1'  },
  { fmt: '916', w: 1080, h: 1920, label: '1080x1920_9-16' }
];

(async () => {
  const url = 'file:///' + path.join(ROOT, DIR, 'index.html').split(path.sep).join('/');
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2200, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  page.on('pageerror', e => { throw new Error('erreur dans la page : ' + e.message); });

  await page.goto(url, { waitUntil: 'networkidle0' });

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.ad')].map(el => el.id).filter(Boolean));
  if (!cards.length) throw new Error('aucune affiche trouvée dans ' + DIR);
  console.log(`\n${DIR} — ${cards.length} affiches × ${FORMATS.length} formats`);

  const made = [];
  for (const f of FORMATS) {
    /* Le sélecteur de format de la page pilote les proportions ; les
       repères de zone sûre sont un outil de travail, jamais livrés. */
    await page.evaluate((fmt) => {
      const r = document.getElementById('root');
      r.dataset.fmt = fmt;
      r.dataset.safe = '0';
      const t = document.getElementById('safetog');
      if (t) t.checked = false;
    }, f.fmt);

    for (const id of cards) {
      await page.evaluate((cid, w) => {
        const el = document.getElementById(cid);
        el.style.width = w + 'px';
        el.style.maxWidth = 'none';
      }, id, f.w);

      /* Laisse la mise en page se stabiliser avant la photo. */
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

      /* Garde-fou : overflow:hidden masque un débordement à l'écran, mais
         il serait gravé dans le PNG livré — c'est le pied de l'affiche
         (licences, logo, téléphone) qui tombe en premier. On refuse
         d'exporter plutôt que de livrer une affiche coupée. */
      const debord = await page.evaluate((cid) => {
        const el = document.getElementById(cid);
        const host = el.querySelector('.panel') || el.querySelector('.in');
        return host.scrollHeight - Math.round(host.getBoundingClientRect().height);
      }, id);
      if (debord > 1) {
        throw new Error(`${id} en ${f.label} : le contenu déborde de ${debord} px. ` +
                        `Ajuster --s pour [data-fmt="${f.fmt}"] #${id} dans ${DIR}/index.html.`);
      }

      const el = await page.$('#' + id);
      const box = await el.boundingBox();
      const file = path.join(OUT, `${DIR}_${id}_${f.label}.png`);
      await el.screenshot({ path: file, type: 'png' });

      const got = `${Math.round(box.width)}x${Math.round(box.height)}`;
      const want = `${f.w}x${f.h}`;
      made.push({ file, got, ok: got === want });
      console.log(`  ${id} ${f.label.padEnd(15)} ${got}${got === want ? '' : '  ATTENDU ' + want}`);
    }

    /* Remet la largeur fluide avant de changer de format. */
    await page.evaluate((ids) => ids.forEach(i => {
      const el = document.getElementById(i);
      el.style.width = ''; el.style.maxWidth = '';
    }), cards);
  }

  await browser.close();

  const bad = made.filter(m => !m.ok);
  const mo = made.reduce((s, m) => s + fs.statSync(m.file).size, 0) / 1048576;
  console.log(`\n${made.length} fichiers, ${mo.toFixed(1)} Mo, dans export/`);
  if (bad.length) {
    console.error(`${bad.length} au mauvais format — vérifier le sélecteur de la page.`);
    process.exit(1);
  }
})().catch(e => { console.error('\nÉchec :', e.message); process.exit(1); });
