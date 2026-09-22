'use strict';

const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');
const {
  displayChabadZmanim, getNextRestPeriod, getRestPeriods,
} = require('..');

const CLUJ = {latitude: 46.77, longitude: 23.59, israel: false};
const PARIS = {latitude: 48.8566, longitude: 2.3522, israel: false};
const JERUSALEM = {latitude: 31.778, longitude: 35.235, israel: true};

function at(civil, hour = '12:00:00', offset = '+03:00') {
  return new Date(`${civil}T${hour}${offset}`);
}

function next(place, from, extras = {}) {
  return getNextRestPeriod({...place, ...extras, from});
}

function scheduleKinds(period) {
  return period.schedule.map(item => item.kind);
}

function wall(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {timeZone, hour: '2-digit', minute: '2-digit', hour12: false}).format(date);
}

test('Cluj: Shabbat + two Sukkot days is one Friday-Sunday period, never an 18:58 exit', () => {
  const period = next(CLUJ, at('2026-09-22'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['SUKKOT']);
  assert.equal(period.occasion.hasShabbat, true);
  assert.equal(period.occasion.parasha, null);
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'exit']);
  assert.equal(period.schedule[0].holiday, 'SUKKOT');
  assert.equal(period.schedule[0].shabbat, true);
  assert.equal(period.schedule[1].holiday, 'SUKKOT');
  assert.equal(period.schedule[1].afterNightfall, true);
  assert.equal(period.schedule[2].holiday, 'SUKKOT');
  assert.equal(period.schedule[2].shabbat, false);
  assert.deepEqual(period.schedule.map(item => wall(item.at, period.timeZone)), ['19:00', '20:01', '19:58']);
  assert.deepEqual(period.schedule.map(item => item.at.toISOString().slice(0, 10)),
    ['2026-09-25', '2026-09-26', '2026-09-27']);
  const saturday = displayChabadZmanim({...CLUJ, date: '2026-09-26'});
  assert.equal(period.schedule[1].at.getTime(), saturday.shabbatEnds.getTime());
  assert.ok(period.schedule[1].at > saturday.sunset);
  assert.equal(period.end.getTime(), period.schedule[2].at.getTime());
});

test('Cluj: Shmini Atzeret and Simchat Torah do not inherit Hoshana Raba/Sukkot', () => {
  const period = next(CLUJ, at('2026-09-29'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['SHMINI_ATZERET', 'SIMCHAT_TORAH']);
  assert.equal(period.occasion.parasha, null);
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'exit']);
  assert.deepEqual(period.schedule.map(item => wall(item.at, period.timeZone)), ['18:46', '19:47', '19:45']);
  assert.ok(period.schedule[1].at > displayChabadZmanim({...CLUJ, date: '2026-10-03'}).sunset);
});

test('ordinary Shabbat has its own parasha and no holiday', () => {
  const period = next(CLUJ, at('2026-10-06'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, []);
  assert.equal(period.occasion.hasShabbat, true);
  assert.equal(period.occasion.parasha.latin, 'Bereshit');
  assert.deepEqual(scheduleKinds(period), ['entry', 'exit']);
  assert.deepEqual(period.schedule.map(item => wall(item.at, period.timeZone)), ['18:32', '19:33']);
});

test('Yom Kippur is a named non-Shabbat period', () => {
  const period = next(CLUJ, at('2026-09-20', '10:00:00'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['YOM_KIPPUR']);
  assert.equal(period.occasion.hasShabbat, false);
  assert.equal(period.occasion.parasha, null);
  assert.deepEqual(scheduleKinds(period), ['entry', 'exit']);
});

test('Rosh Hashana in diaspora has a later second-night lighting and a Sunday exit', () => {
  const period = next(PARIS, at('2026-09-11', '12:00:00', '+02:00'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['ROSH_HASHANA']);
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'exit']);
  assert.ok(period.schedule[1].at > displayChabadZmanim({...PARIS, date: '2026-09-12'}).sunset);
  assert.equal(period.end.toISOString().slice(0, 10), '2026-09-13');
});

test('Sukkot in Israel lasts one day, even when it begins on Friday', () => {
  const period = next(JERUSALEM, at('2026-09-22', '12:00:00', '+03:00'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['SUKKOT']);
  assert.equal(period.occasion.hasShabbat, true);
  assert.deepEqual(scheduleKinds(period), ['entry', 'exit']);
  assert.equal(period.schedule[1].holiday, 'SUKKOT');
  assert.equal(period.schedule[1].shabbat, true);
  assert.equal(period.end.toISOString().slice(0, 10), '2026-09-26');
});

test('Pesach attached to Shabbat preserves all intermediate candles in order', () => {
  const period = next(PARIS, at('2027-04-21', '12:00:00', '+02:00'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['PESACH']);
  assert.equal(period.occasion.hasShabbat, true);
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'candles', 'exit']);
  assert.equal(period.schedule[0].holiday, 'PESACH');
  assert.equal(period.schedule[0].shabbat, false);
  assert.equal(period.schedule[2].holiday, null);
  assert.equal(period.schedule[2].shabbat, true);
  assert.equal(period.schedule[3].holiday, null);
  assert.equal(period.schedule[3].shabbat, true);
  assert.equal(period.schedule[1].at.getTime(), displayChabadZmanim({...PARIS, date: '2027-04-22'}).shabbatEnds.getTime());
  assert.equal(period.schedule[2].at.getTime(), displayChabadZmanim({...PARIS, date: '2027-04-23'}).candleLighting.getTime());
});

test('Shabbat followed by Shavuot labels its Friday entry as Shabbat only', () => {
  const period = next(PARIS, at('2029-05-17', '12:00:00', '+02:00'), {useChabad: true});
  assert.deepEqual(period.occasion.holidays, ['SHAVUOT']);
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'candles', 'exit']);
  assert.equal(period.schedule[0].holiday, null);
  assert.equal(period.schedule[0].shabbat, true);
  assert.equal(period.schedule[1].holiday, 'SHAVUOT');
  assert.equal(period.schedule[1].afterNightfall, true);
  assert.equal(period.schedule[1].at.getTime(),
    displayChabadZmanim({...PARIS, date: '2029-05-19'}).shabbatEnds.getTime());
});

test('Shavuot differs between diaspora and Israel', () => {
  const diaspora = next(PARIS, at('2028-05-29', '12:00:00', '+02:00'), {useChabad: true});
  const israel = next(JERUSALEM, at('2028-05-29', '12:00:00', '+03:00'), {useChabad: true});
  assert.deepEqual(diaspora.occasion.holidays, ['SHAVUOT']);
  assert.deepEqual(israel.occasion.holidays, ['SHAVUOT']);
  assert.deepEqual(scheduleKinds(diaspora), ['entry', 'candles', 'exit']);
  assert.deepEqual(scheduleKinds(israel), ['entry', 'exit']);
});

test('current period remains selected, then advances after its real final exit', () => {
  const during = next(CLUJ, at('2026-09-26', '21:00:00'), {useChabad: true});
  assert.deepEqual(during.occasion.holidays, ['SUKKOT']);
  const after = next(CLUJ, at('2026-09-27', '21:00:00'), {useChabad: true});
  assert.deepEqual(after.occasion.holidays, ['SHMINI_ATZERET', 'SIMCHAT_TORAH']);
  assert.ok(after.start > during.end);
});

test('Hebcal mode retains its own after-nightfall event time', () => {
  const period = next(CLUJ, at('2026-09-22'));
  assert.deepEqual(scheduleKinds(period), ['entry', 'candles', 'exit']);
  assert.ok(period.schedule[1].at > displayChabadZmanim({...CLUJ, date: '2026-09-26'}).sunset);
});

test('full-year sequences are closed, monotonic and do not overlap', () => {
  for (const place of [PARIS, JERUSALEM, CLUJ]) {
    for (const useChabad of [false, true]) {
      const periods = getRestPeriods({...place, useChabad,
        from: at('2026-07-01', '12:00:00', '+02:00'), daysBefore: 14, daysAfter: 365});
      assert.ok(periods.length > 50);
      for (const [index, period] of periods.entries()) {
        assert.ok(period.start < period.end);
        assert.equal(period.schedule[0].kind, 'entry');
        assert.equal(period.schedule.at(-1).kind, 'exit');
        assert.ok(period.schedule.every((item, i) => i === 0 || item.at > period.schedule[i - 1].at));
        if (index > 0) assert.ok(period.start > periods[index - 1].end);
      }
    }
  }
});

test('one absolute reference instant yields identical results in different process time zones', () => {
  const code = `const {getNextRestPeriod}=require('./index.cjs');const p=getNextRestPeriod({from:new Date('2026-09-22T09:00:00Z'),latitude:46.77,longitude:23.59,israel:false,useChabad:true});process.stdout.write(p.schedule.map(x=>x.at.toISOString()).join(','))`;
  const results = ['UTC', 'Europe/Paris', 'Pacific/Honolulu', 'Asia/Jerusalem'].map(TZ => {
    const result = spawnSync(process.execPath, ['-e', code], {cwd: __dirname + '/..', env: {...process.env, TZ}, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(results).size, 1);
});

test('invalid inputs are rejected and polar locations never receive invented hours', () => {
  assert.throws(() => next({...CLUJ, latitude: 999}, at('2026-09-22')), RangeError);
  assert.throws(() => next(CLUJ, new Date('invalid')), RangeError);
  assert.throws(() => next(CLUJ, at('2026-09-22'), {candleLightingMinutes: -1}), RangeError);
  const polar = next({latitude: 78.22, longitude: 15.65, israel: false}, at('2026-06-20'), {useChabad: true});
  assert.equal(polar, null);
});
