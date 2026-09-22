# @kehila/zmanim

Synchronous Chabad.org default zmanim calculations for Kehila projects. Works with CommonJS (`require`) and ESM (`import`) on Node.js 18+ and in browser bundles.

The formulas follow [Chabad.org's published calculation rules](https://www.chabad.org/library/article_cdo/aid/3209349/jewish/About-Our-Zmanim-Calculations.htm). This is an independent implementation, not an official Chabad.org library. The underlying solar calculation is the MIT-licensed [`@hebcal/solar-calc`](https://github.com/hebcal/solar-calc) NOAA implementation.

```js
const {calculateChabadZmanim, displayChabadZmanim} = require('@kehila/zmanim');

const zmanim = calculateChabadZmanim({
  date: '2026-09-22',
  latitude: 32.8872,
  longitude: 13.1913,
  candleLightingMinutes: 18,
});

console.log(zmanim.tzeit); // Date: the instant when the Sun reaches 6° below the horizon
console.log(displayChabadZmanim({date: '2026-09-22', latitude: 32.8872, longitude: 13.1913}).tzeit); // 19:29 in Tripoli
```

Use a civil `YYYY-MM-DD` date. Passing a JavaScript `Date` is supported for existing callers, but its **local calendar fields** are used; use a string when the server and place have different time zones. Every returned `Date` represents an absolute instant. Format it in the place's IANA time zone with `Intl.DateTimeFormat`.

## Default Chabad.org profile

| Time | Rule |
| --- | --- |
| `alos` | Solar depression 16.9°; if not reached overnight, midpoint of the preceding night |
| `misheyakir` | 10.2° |
| `sunrise`, `sunset` | Sea-level visible sunrise/sunset, 0.833° |
| `trueSunrise`, `trueSunset` | 1.583°; used for proportional day calculations |
| `shaahZmanitMs` | `(trueSunset - trueSunrise) / 12` |
| `latestShema`, `latestTefila`, `latestBiurChametz` | True sunrise + 3, 4, 5 proportional hours |
| `midday`, `minchaGedola`, `minchaKetana`, `plag` | True sunrise + 6, 6.5, 9.5, 10.75 proportional hours |
| `tzeit` | 6° |
| `shabbatEnds` | 8.5° |
| `midnight` | Midpoint from today's true sunset to tomorrow's true sunrise |
| `candleLighting` | Visible sunset minus `candleLightingMinutes` (18 by default) |

Local candle-lighting customs vary. Pass the applicable minutes for a community; an Israel-wide offset cannot reproduce all Chabad.org locations. `timeAtAngle()` is available for additional opinions such as 26° dawn or 6.83° nightfall, but these are **not** default Chabad.org zmanim.

Missing solar events return `null`. In particular, polar regions with no true sunrise or sunset need rabbinic guidance; the library does not invent a time. `calculateChabadZmanim()` returns sub-minute instants for logic. `displayChabadZmanim()` applies the published-minute convention (deadlines down, starting times up, visible sunrise/sunset and candle/Shabbat times nearest; high-latitude dawn fallback nearest). This display convention was inferred from Chabad.org's live tables, not published as a formal specification.

The regression suite checks **all 180 displayed times exactly** against live Chabad.org tables at identical custom GPS points: Tripoli and Jerusalem in September, Paris in September and December, and London in June (including the high-latitude dawn fallback). It also checks one London candle-lighting time. This establishes minute-level agreement for these cases, **not** sub-minute identity or a guarantee for every location/date. Location coordinates, time zone, local candle-lighting custom, and any Chabad.org future changes must still match. Chabad.org recommends leaving at least a two-minute practical margin around published zmanim.

## Installation from GitHub

```sh
npm install '@kehila/zmanim@https://codeload.github.com/mmr94/kehila-zmanim/tar.gz/refs/tags/v1.1.1'
```

Run `npm test` after changing a formula. The test suite includes Chabad.org-published reference times and high-latitude/date-zone cases.
