# Hakuviestit iPhoneen (natiivisovellus, ei Macia)

Tämä kansio on yksityinen GitHub-repo, jonka Claude on jo valmistellut. Sovelluksen .ipa rakennetaan GitHubin Mac-koneella, ja asennat sen Windows-koneelta Sideloadly-ohjelmalla. Face ID ja varmuuskopion tallennus toimivat natiivisovelluksessa omilla iOS-toiminnoillaan.

## 1. Hae valmis .ipa GitHubista

Rakennus käynnistyy automaattisesti aina, kun `main`-haaraan tulee muutos (tai käsin: **Actions → Build iOS IPA → Run workflow**).

1. Avaa repon **Actions**-välilehti ja valitse viimeisin **Build iOS IPA** -ajo.
2. Odota vihreää rastia (noin 5–15 minuuttia).
3. Vieritä alas kohtaan **Artifacts** ja lataa **Hakuviestit-ipa**.
4. Pura zip (oikea painike → **Pura kaikki**). Sisällä on **Hakuviestit.ipa**.

## 2. Asenna Windowsissa Sideloadlyllä

1. Lataa Sideloadly vain osoitteesta [sideloadly.io](https://sideloadly.io).
2. Asenna puhelimen ajurit: **iTunes** (Applen omilta sivuilta) tai Windows 11:ssä Microsoft Storen **Apple Devices** -sovellus. Jos Sideloadly ei löydä puhelinta, asenna iTunes Applen omilta sivuilta.
3. Kytke iPhone kaapelilla, avaa lukitus ja valitse **Luota tähän tietokoneeseen**.
4. Avaa Sideloadly ja vedä **Hakuviestit.ipa** sen ikkunaan.
5. Kirjoita **Apple ID** (suositus: erillinen tunnus, jolla ei ole muuta käyttöä). Paina **Start** ja anna salasana ja tarvittaessa kaksivaiheisen tunnistuksen koodi.
6. Odota viestiä **Done**.

## 3. Asetukset iPhonessa

1. **Kehittäjätila:** Asetukset → Tietosuoja ja turvallisuus → Kehittäjätila → päälle (puhelin käynnistyy uudelleen, vahvista sen jälkeen). Kohta ilmestyy vasta ensimmäisen sivulatauksen jälkeen.
2. **Luota profiiliin:** Asetukset → Yleiset → VPN ja laitehallinta → Apple ID:si profiili → **Luota**.
3. Avaa Hakuviestit Koti-valikosta. Ota Face ID käyttöön, kun sovellus sitä tarjoaa (tai myöhemmin Omat tilit -välilehdeltä).

## 4. Voimassaolo: uusi 7 päivän välein

Ilmaisella Apple ID:llä sovellus lakkaa avautumasta 7 päivän päästä. Uusi se ajamalla Sideloadly uudelleen **samalla .ipa-tiedostolla ja samalla Apple ID:llä**.

- **Älä poista sovellusta.** Poistaminen poistaa myös tiedot; uusiminen päälle säilyttää ne.
- Ota **salattu varmuuskopio** säännöllisesti: Omat tilit → **Lataa salattu varmuuskopio**. Valitse jakamisvalikosta **Tallenna tiedostoihin**. Varmuuskopio avautuu vain salasanallasi.
- Enintään 3 sivuladattua sovellusta kerrallaan ilmaisella Apple ID:llä.

## 5. Huomioita

- **Gmail-yhteys** toimii vain claude.ai-versiossa. Natiivisovelluksessa tuo viestit **.eml- tai .mbox-tiedostoina** (Tuo-välilehti) ja lähetä vastaukset puhelimen sähköpostisovelluksella.
- **Face ID:** salasana tallentuu vain iOS:n suojattuun Keychainiin, jonka Face ID avaa. Salasanalla pääsee aina sisään. Jos Face ID lakkaa toimimasta, sovellus kertoo siitä; ota se silloin uudelleen käyttöön Tietosuoja-osiossa.

## Tekninen yhteenveto

| Tiedosto | Tehtävä |
|---|---|
| `app/hakuviestit.html` | Itse sovellus (yksi HTML-tiedosto) |
| `scripts/build-web.mjs` | Rakentaa `www/index.html`:n |
| `scripts/set-ios-icon.mjs` | Asettaa ikonin iOS-projektiin rakennuksessa |
| `capacitor.config.json` | Capacitor-asetukset (appId `fi.hakuviestit.app`) |
| `.github/workflows/ios-ipa.yml` | Rakentaa allekirjoittamattoman .ipa:n macOS-koneella ja lisää Face ID -käyttöoikeusselitteen |

Liitännäiset: `@capgo/capacitor-native-biometric` (Face ID), `@capacitor/filesystem` ja `@capacitor/share` (varmuuskopion tallennus).
