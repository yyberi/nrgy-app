# NRGY App

NRGY App on Vue 3 + Vite -pohjainen energiadata-dashboard, joka visualisoi ja analysoi:

- verkosta ostettua energiaa
- verkkoon myytya energiaa
- aurinkosahkon tuotantoa
- spot-hintaa
- tariffipohjaisia kustannuksia ja saastoja

Sovellus kayttaa valmiiksi yhdistettya kuukausidataa (`public/combined-data`) ja laskee selaimessa yhteenvetoja, tunnuslukuja ja kaavioita.

## Mita projekti tekee

Projektin tarkoitus on tarjota kayttajalle yksi nakyma oman energiankayton ja aurinkotuotannon analysointiin:

- aikavalin valinta (paiva, viikko, kuukausi, vuosi, kaikki)
- synkronoidut kaaviot kulutuksesta, tuotannosta ja hinnasta
- summary-nakyma, jossa on jakaumat, huippuarvot ja kustannuserittelyt
- tariffien (siirto, vero, ALV, marginaalit) vaikutuksen arviointi

Arkkitehtuuri perustuu staattiseen dataan: raakadata validoidaan ja yhdistetaan etukateen skripteilla, jonka jalkeen frontend lukee JSON-tiedostoja ilman erillista backend-API:a.

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

Suositus: kayta Node 22 LTS -versiota tai projektin `engines`-maaritykseen sopivaa versiota.

## Asennus

Asenna riippuvuudet projektin juuressa (`nrgy-app`):

```sh
npm install
```

## Kehitystila

Kaynnista kehityspalvelin:

```sh
npm run dev
```

Taman jalkeen sovellus aukeaa Viten ilmoittamaan osoitteeseen (yleensa `http://localhost:5173`).

## Build / kaanto

Luo tuotantobuildi:

```sh
npm run build
```

Build-komento tekee ennen varsinaista kaantoa datan validoinnin (`scripts/validate-data.mjs`).

Jos validointi epaonnistuu, build keskeytyy. Tama estaa virheellisen datan paatymisen julkaisuun.

## Tuotantobuildin esikatselu

```sh
npm run preview
```

## Muut hyodylliset komennot

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
# Asenna selaimet ensimmaisella kerralla
npx playwright install

# Aja E2E-testit
npm run test:e2e
```

Lint:

```sh
npm run lint
```

Formatointi:

```sh
npm run format
```

## Datan ja dokumentaation kokonaiskuva

Projektin datavirta menee paapiirteittain nain:

1. Raakadata luetaan hakemistoista `raw-data/*`.
2. Skriptit validoivat ja yhdistavat datan (`scripts/*.mjs`).
3. Tuotettu data kirjoitetaan hakemistoon `public/combined-data`.
4. Frontend lataa indeksin ja tarvittavat kuukausitiedostot valitulle aikavalille.


## Yhteenveto kayttoon

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

Tama projekti on lisensoitu MIT-lisenssilla.
Katso lisenssiehdot tiedostosta `LICENSE`.
