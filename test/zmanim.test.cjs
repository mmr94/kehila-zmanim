'use strict';

const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');
const {calculateChabadZmanim, displayChabadZmanim, chabadDailyZmanim, roundChabadZman, timeAtAngle} = require('..');

const tripoli = {date: '2026-09-22', latitude: 32.8872, longitude: 13.1913};

function wallTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

// Read from Chabad.org's live Halachic Times page using these exact custom GPS
// coordinates and the named time zone. Each row contains 12 displayed times:
// alos, misheyakir, sunrise, Shema, Shacharit, midday, mincha gedola,
// mincha ketana, plag, sunset, tzeit (or holiday/Shabbat end), midnight.
const references = [
  ['Tripoli', 'Africa/Tripoli', 32.8872, 13.1913, '2026-09-21', '05:37 06:10 06:55 09:55 10:57 13:00 13:31 16:36 17:53 19:06 19:42 01:00', true],
  ['Tripoli', 'Africa/Tripoli', 32.8872, 13.1913, '2026-09-22', '05:38 06:11 06:55 09:55 10:57 12:59 13:31 16:35 17:52 19:04 19:29 01:00'],
  ['Tripoli', 'Africa/Tripoli', 32.8872, 13.1913, '2026-09-23', '05:38 06:12 06:56 09:55 10:57 12:59 13:30 16:34 17:50 19:03 19:28 00:59'],
  ['Jerusalem', 'Asia/Jerusalem', 31.7683, 35.2137, '2026-09-21', '05:10 05:43 06:27 09:27 10:29 12:32 13:03 16:08 17:25 18:37 19:14 00:32', true],
  ['Jerusalem', 'Asia/Jerusalem', 31.7683, 35.2137, '2026-09-22', '05:11 05:44 06:27 09:27 10:29 12:31 13:03 16:07 17:23 18:36 19:01 00:31'],
  ['Jerusalem', 'Asia/Jerusalem', 31.7683, 35.2137, '2026-09-23', '05:11 05:44 06:28 09:27 10:28 12:31 13:02 16:06 17:22 18:35 19:00 00:31'],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-09-21', '05:55 06:38 07:36 10:37 11:39 13:43 14:15 17:21 18:38 19:51 20:38 01:43', true],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-09-22', '05:56 06:40 07:37 10:37 11:39 13:42 14:14 17:19 18:37 19:49 20:21 01:43'],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-09-23', '05:58 06:41 07:38 10:38 11:39 13:42 14:14 17:18 18:35 19:47 20:19 01:43'],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-12-20', '06:51 07:35 08:41 10:41 11:23 12:48 13:10 15:16 16:09 16:56 17:33 00:48'],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-12-21', '06:51 07:36 08:41 10:42 11:24 12:48 13:10 15:17 16:09 16:56 17:34 00:48'],
  ['Paris', 'Europe/Paris', 48.8566, 2.3522, '2026-12-22', '06:52 07:36 08:42 10:42 11:24 12:49 13:11 15:17 16:10 16:57 17:34 00:49'],
  ['London', 'Europe/London', 51.5074, -0.1278, '2026-06-20', '01:02 03:07 04:43 08:49 10:13 13:02 13:45 17:58 19:43 21:21 22:36 01:02', true],
  ['London', 'Europe/London', 51.5074, -0.1278, '2026-06-21', '01:02 03:08 04:43 08:49 10:13 13:02 13:45 17:58 19:43 21:22 22:10 01:02'],
  ['London', 'Europe/London', 51.5074, -0.1278, '2026-06-22', '01:02 03:08 04:43 08:49 10:13 13:02 13:45 17:58 19:43 21:22 22:10 01:02'],
];

test('all 180 displayed minutes match Chabad.org for 4 cities and 3 seasons', () => {
  const baseNames = ['alos', 'misheyakir', 'sunrise', 'latestShema', 'latestTefila', 'midday', 'minchaGedola', 'minchaKetana', 'plag', 'sunset'];
  for (const [city, timeZone, latitude, longitude, date, expected, ending] of references) {
    const z = displayChabadZmanim({date, latitude, longitude});
    const names = [...baseNames, ending ? 'shabbatEnds' : 'tzeit', 'midnight'];
    for (const [index, name] of names.entries()) {
      assert.equal(wallTime(z[name], timeZone), expected.split(' ')[index], `${city} ${date} ${name}`);
    }
  }
  const z = calculateChabadZmanim(tripoli);
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

test('London candle lighting matches Chabad.org on 2026-06-19', () => {
  const options = {date: '2026-06-19', latitude: 51.5074, longitude: -0.1278};
  assert.equal(wallTime(displayChabadZmanim(options).candleLighting, 'Europe/London'), '21:03');
  assert.equal(roundChabadZman('candleLighting', calculateChabadZmanim(options).candleLighting).getSeconds(), 0);
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
