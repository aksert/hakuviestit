# Tietoturva

Hakuviestit tallentaa tiedot vain käyttäjän omalle laitteelle, salattuna. Sovellus ei lähetä tietoja palvelimelle eikä tee pyyntöjä kolmansille osapuolille. Ainoa poikkeus on valinnainen Gmail-haku: kun käyttäjä yhdistää Gmailin ja painaa hakua, puhelin hakee viestit suoraan osoitteesta `gmail.googleapis.com` vain lukuluvalla (`gmail.readonly`). Kirjautumista ei tallenneta.

## Haavoittuvuuden ilmoittaminen

Ilmoita löydetyt tietoturvaongelmat yksityisesti GitHubin **private vulnerability reporting** -toiminnolla: repon **Security**-välilehti → **Report a vulnerability**. Älä avaa julkista issueta tietoturvaongelmasta.
