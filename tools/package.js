/* ------------------------------------------------------------------
   package.js — assemble le dossier à remettre au client.

   Ce qui part : les douze créatifs et la page de consignes, rien d'autre.
   Les bandes sonores seules, les aperçus et les sources restent ici : un
   client qui reçoit trente fichiers n'en ouvre aucun.

   La page de consignes est copiée sous le nom LISEZMOI.html pour qu'elle
   soit la première chose qu'on voie en ouvrant le dossier.

   Usage :  node tools/package.js
   ------------------------------------------------------------------ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXPORT = path.join(ROOT, 'export');
const NAME = 'HT-Construction-publicites';
const DEST = path.join(EXPORT, NAME);
const ZIP = path.join(EXPORT, NAME + '.zip');

const VIDEOS = [
  'ht-construction-ad_1080x1920_30fps.mp4',
  'ht-construction-ad-petit_1080x1920_30fps.mp4',
  'ht-construction-ad-long_1080x1920_30fps.mp4'
];

function posters() {
  return fs.readdirSync(EXPORT)
    .filter(f => /^ht-construction-static_c\d_\d+x\d+_.+\.png$/.test(f))
    .sort();
}

/* Recommence à zéro : un dossier qui traîne d'une fois à l'autre finit
   par contenir un fichier périmé que personne ne remarque. */
fs.rmSync(DEST, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(DEST, { recursive: true });

const manquants = [];
const copie = [];
for (const f of [...VIDEOS, ...posters()]) {
  const src = path.join(EXPORT, f);
  if (!fs.existsSync(src)) { manquants.push(f); continue; }
  fs.copyFileSync(src, path.join(DEST, f));
  copie.push(f);
}
if (manquants.length) {
  console.error('Fichiers absents — lancer `npm run render` d\'abord :');
  manquants.forEach(f => console.error('  ' + f));
  process.exit(1);
}

const consignes = path.join(ROOT, 'ht-construction-livraison', 'index.html');
if (!fs.existsSync(consignes)) { console.error('page de livraison introuvable'); process.exit(1); }
fs.copyFileSync(consignes, path.join(DEST, 'LISEZMOI.html'));

/* Compress-Archive est fourni avec Windows : pas de dépendance de plus. */
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  `Compress-Archive -Path '${DEST}' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });

const mo = fs.statSync(ZIP).size / 1048576;
const clair = copie.reduce((s, f) => s + fs.statSync(path.join(DEST, f)).size, 0) / 1048576;

console.log(`\n${NAME}/`);
console.log(`  LISEZMOI.html          la page de consignes`);
console.log(`  ${VIDEOS.length} vidéos, ${posters().length} affiches   ${clair.toFixed(1)} Mo`);
console.log(`\n-> ${path.relative(ROOT, ZIP)}   ${mo.toFixed(1)} Mo compressé`);
console.log(mo > 25
  ? '\nPlus de 25 Mo : passer par un dossier partagé ou un transfert de fichiers, pas par courriel.'
  : '\nSous 25 Mo : peut passer en pièce jointe.');
