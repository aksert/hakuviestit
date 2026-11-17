# Hakuviestit iPhoneen

Hakuviestit on web-sovellus (PWA), joka asennetaan iPhonen Koti-valikkoon Safarilla. Ei Apple ID:tä, ei sivulataamista, ei 7 päivän uusintaa.

## Asennus (suositeltu)

1. Avaa Safarilla **https://aksert.github.io/hakuviestit/**
2. Paina **Jaa** (neliö ja nuoli) → **Lisää Koti-valikkoon**.
3. Avaa Hakuviestit Koti-valikon kuvakkeesta.

## Tietosuoja ja varmuuskopiot

- Tiedot tallentuvat **vain tähän puhelimeen**, salattuina. Sovellus ei lähetä niitä minnekään eikä tee pyyntöjä kolmansille osapuolille (fontitkin ovat sovelluksen mukana).
- Jos Safarin tiedot tyhjennetään tai sovellus poistetaan, tiedot katoavat. Ota siksi **salattu varmuuskopio** säännöllisesti: Omat tilit → **Lataa salattu varmuuskopio** → **Tallenna tiedostoihin**. Varmuuskopio avautuu vain salasanallasi.
- **Gmail-yhteys** toimii vain claude.ai-versiossa. Web-sovelluksessa tuo viestit **.eml- tai .mbox-tiedostoina** (Tuo-välilehti) ja lähetä vastaukset puhelimen sähköpostisovelluksella.

## Valinnainen: .ipa (edistynyt)

Natiivisovelluksen .ipa rakennetaan vain käsin: **Actions → Build iOS IPA → Run workflow**. Lataa valmis **Hakuviestit-ipa**-artifakti ja asenna se Windowsissa Sideloadlyllä ([sideloadly.io](https://sideloadly.io)). Tämä vaatii Apple ID:n, kehittäjätilan puhelimessa ja uusinnan 7 päivän välein ilmaisella tunnuksella; älä poista sovellusta uusinnan välissä, koska tiedot poistuvat sen mukana. Face ID toimii vain tässä natiiviversiossa.

## Julkaisu (ylläpitäjälle)

`main`-haaraan tehty muutos kansioihin `app/` tai `public/` ajaa workflow'n **Julkaise GitHub Pagesiin**. Pagesin lähteeksi pitää asettaa repon asetuksissa **GitHub Actions**.

## Tekninen yhteenveto

| Tiedosto | Tehtävä |
|---|---|
| `app/hakuviestit.html` | Itse sovellus (yksi HTML-tiedosto) |
| `scripts/build-web.mjs` | Rakentaa `www/index.html`:n (CSP, fontit, service worker) |
| `public/` | Staattiset tiedostot: ikonit, manifesti, `sw.js`, `fonts/` (SIL OFL 1.1) |
| `.github/workflows/pages.yml` | Julkaisee `www/`-kansion GitHub Pagesiin |
| `.github/workflows/ios-ipa.yml` | Käsin ajettava allekirjoittamattoman .ipa:n rakennus |
| `scripts/set-ios-icon.mjs`, `capacitor.config.json` | Vain .ipa-rakennusta varten |
