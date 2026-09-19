# ADforClient

Publicités pour clients — création, découpage et livrables.

## HT Construction

Entrepreneur en rénovation, [constructionht.com](https://constructionht.com/) —
Montréal et Rive-Sud. Cinq livrables.

| Dossier | Type | Durée / format | Angle |
|---|---|---|---|
| `ht-construction-ad/` | Vidéo | 30 s · 9:16 · 14 plans | Le risque, c'est l'entrepreneur |
| `ht-construction-ad-petit/` | Vidéo | 21 s · 9:16 · 11 plans | Aucun projet n'est trop petit |
| `ht-construction-ad-long/` | Vidéo | 54 s · 9:16 · 15 plans | Format long — mécanisme et preuve |
| `ht-construction-static/` | Affiches | 4:5 · 1:1 · 9:16 | Trois concepts statiques |
| `ht-construction-livraison/` | Livraison | — | Fichiers, textes Meta, placements |

Ouvrir le `index.html` de chaque dossier dans un navigateur. Chaque page contient le
découpage technique complet, les repères sonores et les angles à tester.

### Contraintes communes

- **Français québécois** — « soumission », « chantier », pas d'espace avant `?`
- **Aucune voix, aucune musique** — effets sonores synthétisés via Web Audio,
  rien à libérer de droits
- **Aucune personne à l'écran** — les deux photos du site montrant des travailleurs
  (`cuisine1`, `gypse-900`) ont été écartées
- **Lisible en sourdine** — le texte incrusté porte seul le message ; le son n'ajoute
  que le rythme

### Information client — vérifiée sur le site

| | |
|---|---|
| RBQ | 5823-1101-01 |
| CCQ | er937209 |
| APCHQ | Membre |
| Téléphone | 514 674-8697 |
| Courriel | info@constructionht.com |
| Services | Cuisine · Salle de bain · Plancher · Gypse et finition · Balcons et extérieur |
| Zone | Montréal, Longueuil, Brossard, Saint-Lambert, Boucherville, Saint-Hubert, La Prairie, Candiac, Chambly, Sainte-Julie, Varennes, Châteauguay |
| Paiement | Visa/Mastercard, chèque, virement Interac — aucun comptant |

Citations reprises mot pour mot de la FAQ du site : « aucun projet n'est trop petit »,
« un prix précis après la visite, pas une estimation vague », « soumission détaillée
sans frais », « nous détenons les assurances requises ».

### À valider avant diffusion

- Les numéros RBQ et CCQ sont toujours actifs
- La soumission gratuite s'applique à toute la zone desservie
- L'autorisation d'utiliser le témoignage de Marie-Ève T. en publicité

### Export

```
npm install        # une seule fois : puppeteer + ffmpeg, installés en local
npm run render     # les 3 vidéos + les 9 affiches, dans export/
npm run check      # contrôle les pages et la page de livraison
```

Rien n'est capturé à l'écran. `tools/render.js` avance la ligne de temps image par
image et calcule la bande son hors ligne ; `tools/render-static.js` force chaque
affiche à sa largeur de livraison puis la photographie. D'où : aucune image perdue,
son calé au sample, et un rendu reproductible — après une retouche de copie, une
commande régénère tout au lieu d'une séance de captures à refaire à la main.

| Commande | Effet |
|---|---|
| `npm run render:video` | les trois vidéos seulement |
| `npm run render:static` | les neuf affiches seulement |
| `node tools/render.js ht-construction-ad` | une seule vidéo |
| `--fps 24` | autre cadence (30 par défaut) |
| `--sd` | aperçu rapide en 540×960 |

Vidéo : H.264 High, yuv420p, CRF 18 ; AAC 192 kb/s à 48 kHz ; `+faststart` ; son
normalisé à -14 LUFS avec crête vraie à -1 dBTP, la cible de Meta et de TikTok. Le
cadre livré ne contient que la publicité — bouton de lecture, badge de son et repères
de zone sûre sont retirés au rendu.

Affiches : PNG 1080×1350, 1080×1080 et 1080×1920. L'export **refuse de produire une
affiche dont le contenu déborde** : `overflow:hidden` masque un débordement à l'écran
mais il serait gravé dans le fichier livré, et c'est le pied — licences, logo,
téléphone — qui tombe en premier.

Si `npm install` signale des « install scripts not yet covered by allowScripts », les
deux binaires ne sont pas encore téléchargés :

```
node node_modules/ffmpeg-static/install.js
node node_modules/puppeteer/install.mjs
```

### Livraison

Ouvrir `ht-construction-livraison/index.html`. La page réunit la liste des fichiers à
envoyer, le texte exact à coller dans le gestionnaire de publicités (copiable en un
clic, avec les compteurs de caractères), le plan de placement et ce qui reste à faire
confirmer par le client avant diffusion.

**Le placement est le point critique :** les trois vidéos sont en 9:16, donc destinées
aux Reels et aux Stories. Laissés en « placements Advantage+ », Meta les recadre pour
le fil et coupe le texte incrusté. Le fil se sert des affiches en 4:5.
