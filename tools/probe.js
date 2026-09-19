/* Sonde ponctuelle : à un temps donné, quels éléments datés sont visibles ? */
const puppeteer = require('puppeteer');
const dir = process.argv[2], at = Number(process.argv[3]);

(async () => {
  const b = await puppeteer.launch({ headless: 'shell', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await p.goto('file:///C:/Users/Administrator/Desktop/ADforclient/' + dir + '/index.html',
               { waitUntil: 'networkidle0' });
  await p.evaluate(() => window.AD.scanFx());
  const out = await p.evaluate(sec => {
    window.AD.seekExport(sec);
    return [...document.querySelectorAll('#reel [data-in]')].map(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        cls: el.className || el.tagName,
        in: el.dataset.in, out: el.dataset.out,
        op: el.style.opacity,
        computedOp: cs.opacity,
        vis: cs.visibility, disp: cs.display,
        box: Math.round(r.width) + 'x' + Math.round(r.height) + ' @' + Math.round(r.top),
        txt: (el.textContent || '').trim().slice(0, 34)
      };
    }).filter(e => Number(e.in) <= sec && Number(e.out) >= sec);
  }, at);
  console.log(dir, '@', at + 's');
  out.forEach(e => console.log(JSON.stringify(e)));
  await b.close();
})();
