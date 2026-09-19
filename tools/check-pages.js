/* Vérifie que la page joue toujours normalement après l'ajout du crochet
   d'export : c'est la lecture dans le navigateur que le client verra. */
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'shell', args: ['--allow-file-access-from-files'] });
  for (const dir of ['ht-construction-ad', 'ht-construction-ad-petit', 'ht-construction-ad-long']) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file:///C:/Users/Administrator/Desktop/ADforclient/' + dir + '/index.html',
                 { waitUntil: 'networkidle0' });
    const r = await p.evaluate(() => {
      const play = document.getElementById('bigplay');
      const before = document.querySelectorAll('.shot').length;
      return {
        hookPresent: typeof window.AD === 'object',
        playButton: !!play && !play.hidden,
        chromeIntact: !!document.getElementById('sndbadge') && !!document.getElementById('safe'),
        shots: before,
        sfx: typeof window.SFX.hit === 'function',
        transport: !!document.getElementById('scrub')
      };
    });
    console.log(dir, JSON.stringify(r), errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
    await p.close();
  }
  await b.close();
})();
