'use strict';

const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');
const {calculateChabadZmanim, chabadDailyZmanim, roundToNearestMinute, timeAtAngle} = require('..');

const tripoli = {date: '2026-09-22', latitude: 32.8872, longitude: 13.1913};

function wallTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(roundToNearestMinute(date));
}

test('published Chabad.org daily zmanim agree for Tripoli on 2026-09-22', () => {
  const z = calculateChabadZmanim(tripoli);
  const expected = {
    alos: '05:38',
    misheyakir: '06:11',
    sunrise: '06:55',
    latestShema: '09:55',
    latestTefila: '10:57',
    midday: '12:59',
    minchaGedola: '13:31',
    minchaKetana: '16:35',
    plag: '17:52',
    sunset: '19:04',
    tzeit: '19:29',
    midnight: '01:00',
  };
  // Chabad.org displays whole minutes. Its method for some derived deadlines
  // rounds differently from nearest-minute; compare the underlying instant
  // against the published minute with a one-minute tolerance.
  for (const [name, published] of Object.entries(expected)) {
    const [hour, minute] = published.split(':').map(Number);
    const actual = z[name];
    assert.ok(actual instanceof Date, name);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Tripoli', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(actual);
    const actualMinute = Number(parts.find(x => x.type === 'hour').value) * 60
      + Number(parts.find(x => x.type === 'minute').value);
    const expectedMinute = hour * 60 + minute;
    assert.ok(Math.abs(actualMinute - expectedMinute) <= 1, `${name}: ${wallTime(actual, 'Africa/Tripoli')} vs ${published}`);
  }
  assert.equal(z.alosFallback, false);
  assert.equal(z.shaahZmanitMs, (z.trueSunset - z.trueSunrise) / 12);
  assert.equal(z.candleLighting - z.sunset, -18 * 60000);
});

test('daily tzeit, Shabbat end, and optional 6.83° are distinct', () => {
  const z = calculateChabadZmanim(tripoli);
  assert.equal(z.tzeit.getTime(), timeAtAngle({...tripoli, angle: 6, rising: false}).getTime());
  assert.equal(z.shabbatEnds.getTime(), timeAtAngle({...tripoli, angle: 8.5, rising: false}).getTime());
  assert.ok(timeAtAngle({...tripoli, angle: 6.83, rising: false}) > z.tzeit);
  const custom = calculateChabadZmanim({...tripoli, candleLightingMinutes: 40});
  assert.equal(custom.candleLighting - custom.sunset, -40 * 60000);
});

test('Kehila display rows remain sorted and identify optional opinion separately', () => {
  const rows = chabadDailyZmanim(tripoli);
  assert.ok(rows.every((row, i) => i === 0 || rows[i - 1].time <= row.time));
  assert.ok(rows.some(row => row.nom === 'צאת דאורייתא'));
  assert.equal(chabadDailyZmanim(tripoli, {includeDeoraita: false}).some(row => row.nom === 'צאת דאורייתא'), false);
});

test('midnight uses the next morning rather than noon plus twelve hours', () => {
  const z = calculateChabadZmanim(tripoli);
  const tomorrow = calculateChabadZmanim({...tripoli, date: '2026-09-23'});
  assert.equal(z.midnight.getTime(), (z.trueSunset.getTime() + tomorrow.trueSunrise.getTime()) / 2);
  assert.notEqual(z.midnight.getTime(), z.midday.getTime() + 12 * 3600000);
});

test('when 16.9° is not reached, alos falls back to night midpoint', () => {
  const stockholm = calculateChabadZmanim({date: '2026-06-21', latitude: 59.3293, longitude: 18.0686});
  assert.equal(stockholm.alosFallback, true);
  const yesterday = calculateChabadZmanim({date: '2026-06-20', latitude: 59.3293, longitude: 18.0686});
  assert.equal(stockholm.alos.getTime(), yesterday.midnight.getTime());
  const polarDay = calculateChabadZmanim({date: '2026-06-21', latitude: 69.6492, longitude: 18.9553});
  assert.equal(polarDay.alos, null);
  assert.equal(polarDay.tzeit, null);
});

test('civil date string is independent of the machine time zone', () => {
  const code = "const {calculateChabadZmanim}=require('./index.cjs');process.stdout.write(calculateChabadZmanim({date:'2026-09-22',latitude:32.8872,longitude:13.1913}).tzeit.toISOString())";
  const results = ['UTC', 'Pacific/Honolulu', 'Asia/Jerusalem'].map(TZ => {
    const result = spawnSync(process.execPath, ['-e', code], {cwd: __dirname + '/..', env: {...process.env, TZ}, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(results).size, 1);
});

test('invalid dates and coordinates are rejected', () => {
  assert.throws(() => calculateChabadZmanim({...tripoli, date: '2026-02-30'}), RangeError);
  assert.throws(() => calculateChabadZmanim({...tripoli, latitude: ''}), RangeError);
  assert.throws(() => calculateChabadZmanim({...tripoli, candleLightingMinutes: -1}), RangeError);
});
