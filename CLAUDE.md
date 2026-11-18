# Hakuviestit – kehitysohjeet

Työnhaun viestit (sähköposti, puhelin, WhatsApp) keskusteluina. Käyttöliittymä ja kommentit suomeksi.

## Rakenne
- `dev/src/*.js, *.css` – sovelluksen lähteet (ei bundleria). `dev/build.js` kokoaa ne yhdeksi tiedostoksi `hakuviestit.html` repon juureen ja kopioi sen `app/hakuviestit.html`:ksi.
- `app/hakuviestit.html` – rakennettu sovellus (commitoidaan; Pages ja iOS rakennetaan tästä).
- `scripts/build-web.mjs` – kääri `app/`-tiedoston PWA:ksi `www/`-kansioon (CSP, manifest, service worker, omat fontit).
- `.github/workflows/pages.yml` – julkaisee PWA:n osoitteeseen https://aksert.github.io/hakuviestit/ jokaisesta pushista mainiin.
- `.github/workflows/ios-ipa.yml` – allekirjoittamaton .ipa, vain käsin (`workflow_dispatch`), `macos-15-intel`.

## Työnkulku
```
cd dev
node build.js
node test-pure.js ../hakuviestit.html
node test-crypto.js ../hakuviestit.html
node test-dom.js            # myös: gmail, gmail-null, standalone, standalone-gmail, layout, disc, disc-nosample, native
node e2e-gmail.js ../hakuviestit.html   # Playwright
node e2e-sec.js ../hakuviestit.html     # Playwright
```
Kaikkien sarjojen pitää olla 0 fail ennen commitia. Commitoi myös päivittynyt `app/hakuviestit.html`.

## Säännöt
- Mitään ei lähetetä Claudelle/tekoälylle (ei `sample`-kyvykkyyttä).
- Tallennettavat tiedot salataan (PBKDF2-SHA256 600k + AES-GCM). Diagnostiikkaan (`diag/*`) ei koskaan viestin sisältöä, aihetta tai vastaanottajia.
- Testeissä ja sivulla ei koskaan oikeaa Gmail-dataa tai henkilötietoja – repo on julkinen.
- Ei kolmannen osapuolen pyyntöjä PWA:ssa (CSP `'self'`).
- Actionit pinnataan commit-SHA:han; vain GitHubin omat actionit sallittu.
