/* Vérifie la page de livraison : limites de caractères Meta, présence des
   fichiers annoncés, et absence d'erreur dans la page. Un titre tronqué
   ou un fichier manquant se découvre ici, pas dans le gestionnaire. */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const b = await puppeteer.launch({ headless: 'shell', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///' + path.join(ROOT, 'ht-construction-livraison', 'index.html').split(path.sep).join('/'),
               { waitUntil: 'networkidle0' });

  const champs = await p.evaluate(() =>
    [...document.querySelectorAll('.fld dd[data-max]')].map(dd => {
      const cnt = dd.querySelector('.cnt');
      const txt = cnt ? dd.textContent.slice(0, dd.textContent.length - cnt.textContent.length).trim()
                      : dd.textContent.trim();
      return { max: +dd.dataset.max, n: txt.length, txt };
    }));

  let ko = 0;
  champs.forEach(c => {
    const ok = c.n <= c.max;
    if (!ok) ko++;
    console.log(`  ${ok ? 'ok ' : 'LONG'} ${String(c.n).padStart(3)}/${c.max}  ${c.txt}`);
  });

  /* Les noms de fichiers cités dans la page existent-ils vraiment ? */
  const cites = await p.evaluate(() =>
    [...document.querySelectorAll('code')].map(c => c.textContent.trim())
      .filter(t => /\.(mp4|png)$/.test(t)));
  /* La page cite volontairement des motifs (c1_*.png = les trois formats) :
     un humain lit mieux un motif que neuf lignes. On les développe ici. */
  const dispo = fs.readdirSync(path.join(ROOT, 'export'));
  const manquants = cites.filter(f => {
    if (!f.includes('*')) return !dispo.includes(f);
    const re = new RegExp('^' + f.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return !dispo.some(d => re.test(d));
  });

  console.log(`\n${champs.length} champs limités, ${ko} trop longs`);
  console.log(`${cites.length} fichiers cités, ${manquants.length} introuvables`);
  manquants.forEach(f => console.log('  manquant : ' + f));
  if (errs.length) console.log('erreurs de page : ' + errs.join(' | '));

  await b.close();
  if (ko || manquants.length || errs.length) process.exit(1);
  console.log('\nPage de livraison conforme.');
})();
