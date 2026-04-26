# NRGY App

NRGY App on Vue 3 + Vite -pohjainen energiadata-dashboard, joka visualisoi ja analysoi:

- verkosta ostettua energiaa
- verkkoon myytyä energiaa
- aurinkosähkön tuotantoa
- spot-hintaa
- tariffipohjaisia kustannuksia ja säästöjä

Sovellus käyttää valmiiksi yhdistettyä kuukausidataa (`public/combined-data`) ja laskee selaimessa yhteenvetoja, tunnuslukuja ja kaavioita.

## Mitä projekti tekee

Projektin tarkoitus on tarjota käyttäjälle yksi näkymä oman energiankäytön ja aurinkotuotannon analysointiin:

- aikavälin valinta (päivä, viikko, kuukausi, vuosi, kaikki)
- synkronoidut kaaviot kulutuksesta, tuotannosta ja hinnasta
- summary-näkymä, jossa on jakaumat, huippuarvot ja kustannuserittelyt
- tariffien (siirto, vero, ALV, marginaalit) vaikutuksen arviointi

Arkkitehtuuri perustuu staattiseen dataan: raakadata validoidaan ja yhdistetään etukäteen skripteillä, jonka jälkeen frontend lukee JSON-tiedostoja ilman erillistä backend-API:a.

## Teknologiat

- Vue 3
- Vite
- TypeScript
- Pinia
- Highcharts
- Sass
- Vitest
- Playwright

## Vaatimukset

- Node.js: `^20.19.0` tai `>=22.12.0`
- npm

Suositus: käytä Node 22 LTS -versiota tai projektin `engines`-määritykseen sopivaa versiota.

## Asennus

Asenna riippuvuudet projektin juuressa (`nrgy-app`):

```sh
npm install
```

Vaihtoehtoisesti voit käyttää puhdasta asennusta:

```sh
npm clean-install
```

## Kehitystila

Käynnistä kehityspalvelin:

```sh
npm run dev
```

Tämän jälkeen sovellus aukeaa Viten ilmoittamaan osoitteeseen (yleensä `http://localhost:5173`).

## Build / kääntö

Luo tuotantobuildi:

```sh
npm run build
```

Tuotantobuildi edellyttää, että riippuvuudet on ensin asennettu (`npm install` tai `npm clean-install`). Build-komento käyttää `run-p`-komentoa, joka tulee projektin npm-riippuvuuksista.

Build-komento tekee ennen varsinaista kääntöä datan validoinnin (`scripts/validate-data.mjs`).

Jos validointi epäonnistuu, build keskeytyy. Tämä estää virheellisen datan päätymisen julkaisuun.

## Tuotantobuildin esikatselu

```sh
npm run preview
```

## Muut hyödylliset komennot

Type-check:

```sh
npm run type-check
```

Unit-testit:

```sh
npm run test:unit
```

E2E-testit:

```sh
# Asenna selaimet ensimmäisellä kerralla
npx playwright install

# Asenna selaintestien tarvitsemat järjestelmäkirjastot
npx playwright install-deps

# Aja E2E-testit
npm run test:e2e
```

Lint:

```sh
npm run lint
```

Huom: nykytilassa `npm run lint` ei ole puhdas tarkistusajo, vaan se ajaa ESLintin `--fix`-lipulla. Komento raportoi tällä hetkellä noin 100 virhettä.

Formatointi:

```sh
npm run format
```

## Datan ja dokumentaation kokonaiskuva

Projektin datavirta menee pääpiirteittäin näin:

1. Raakadata luetaan hakemistoista `raw-data/*`.
2. Skriptit validoivat ja yhdistävät datan (`scripts/*.mjs`).
3. Tuotettu data kirjoitetaan hakemistoon `public/combined-data`.
4. Frontend lataa indeksin ja tarvittavat kuukausitiedostot valitulle aikavälille.

## Yhteenveto käyttöön

Nopea aloitus:

```sh
npm install
npm run dev
```

Tuotantobuild:

```sh
npm run build
npm run preview
```

## License

Tämä projekti on lisensoitu MIT-lisenssillä.
Katso lisenssiehdot tiedostosta `LICENSE`.
