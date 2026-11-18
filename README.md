# Hakuviestit iPhoneen

Hakuviestit on web-sovellus (PWA), joka asennetaan iPhonen Koti-valikkoon Safarilla. Ei Apple ID:tä, ei sivulataamista, ei 7 päivän uusintaa.

## Asennus (suositeltu)

1. Avaa Safarilla **https://aksert.github.io/hakuviestit/**
2. Paina **Jaa** (neliö ja nuoli) → **Lisää Koti-valikkoon**.
3. Avaa Hakuviestit Koti-valikon kuvakkeesta.

## Tietosuoja ja varmuuskopiot

- Tiedot tallentuvat **vain tähän puhelimeen**, salattuina. Sovellus ei lähetä niitä minnekään eikä tee pyyntöjä kolmansille osapuolille (fontitkin ovat sovelluksen mukana). Ainoa poikkeus on Gmail-haku, jos otat sen käyttöön (alla).
- Jos Safarin tiedot tyhjennetään tai sovellus poistetaan, tiedot katoavat. Ota siksi **salattu varmuuskopio** säännöllisesti: Omat tilit → **Lataa salattu varmuuskopio** → **Tallenna tiedostoihin**. Varmuuskopio avautuu vain salasanallasi.

## Gmail-haku (valinnainen)

Sovellus voi hakea työnhaun sähköpostit suoraan Gmailista puhelimeen. Se käyttää vain lukulupaa: sähköposteja ei voi lähettää eikä poistaa. Kirjautumista ei tallenneta, vaan se on voimassa tunnin ja unohtuu, kun sovellus lukittuu. Vastaukset lähetetään puhelimen sähköpostisovelluksella.

Kerran tehtävä asennus (noin 10 min) tarvitsee oman Google-asiakastunnuksen:

1. Avaa **console.cloud.google.com** ja luo projekti (esim. "Hakuviestit").
2. **APIs & Services → Library → Gmail API → Enable**.
3. **OAuth consent screen**: tyyppi *External*, sovelluksen nimi ja oma sähköpostisi. Lisää kohtaan **Test users** oma Gmail-osoitteesi.
4. **Credentials → Create OAuth client ID → Web application**:
   - *Authorized JavaScript origins*: `https://aksert.github.io`
   - *Authorized redirect URIs*: `https://aksert.github.io/hakuviestit/`
5. Kopioi **Client ID** ja liitä se sovelluksessa: **Omat tilit → Gmail → Google-asiakastunnus → Tallenna tunnus**.
6. Paina **Yhdistä Gmail**. Google varoittaa, että sovellusta ei ole vahvistettu (se on vain omassa testikäytössäsi): valitse *Continue*. Palattuasi avaa sovellus salasanalla, jolloin työpaikkakeskustelujen etsintä käynnistyy.

Luvan voi perua milloin tahansa: myaccount.google.com → Tietoturva → Kolmannen osapuolen yhteydet. Outlook-postin voi edelleen tuoda **.eml- tai .mbox-tiedostoina** (Tuo-välilehti).

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
