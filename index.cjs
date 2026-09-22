'use strict';

const {SolarCalc} = require('@hebcal/solar-calc');

const ANGLES = Object.freeze({
  alos: 16.9,
  misheyakir: 10.2,
  visibleSunriseSunset: 0.833,
  trueSunriseSunset: 1.583,
  tzeit: 6,
  shabbatEnd: 8.5,
});

function civilDateParts(date) {
  if (date instanceof Date) {
    if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('date must be a Date or a YYYY-MM-DD string');
  }
  const parts = date.split('-').map(Number);
  const check = new Date(parts[0], parts[1] - 1, parts[2], 12);
  if (check.getFullYear() !== parts[0] || check.getMonth() + 1 !== parts[1] || check.getDate() !== parts[2]) {
    throw new RangeError('Invalid civil date');
  }
  return parts;
}

function solarDay(parts, offset, latitude, longitude) {
  // SolarCalc reads local calendar fields, not the Date's UTC instant. Noon
  // stays on the requested civil date through local DST changes.
  const date = new Date(parts[0], parts[1] - 1, parts[2] + offset, 12);
  return new SolarCalc(date, latitude, longitude).sun;
}

function at(sun, angle, rising) {
  const result = sun.timeAtAngle(angle, rising);
  return Number.isFinite(result.getTime()) ? result : null;
}

function between(start, end, fraction) {
  return start && end ? new Date(start.getTime() + (end.getTime() - start.getTime()) * fraction) : null;
}

function shift(date, minutes) {
  return date ? new Date(date.getTime() + minutes * 60000) : null;
}

function coordinate(value, limit, name) {
  if (value === null || value === undefined || value === '') throw new RangeError(`Invalid ${name}`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < -limit || number > limit) throw new RangeError(`Invalid ${name}`);
  return number;
}

/**
 * Calculate Chabad.org's published default zmanim for a civil date and point.
 * The Date input uses its local calendar fields; prefer YYYY-MM-DD when the
 * caller's machine time zone differs from the location's time zone.
 * All returned Date values are real instants. Missing solar events are null.
 */
function calculateChabadZmanim({date, latitude, longitude, candleLightingMinutes = 18}) {
  const lat = coordinate(latitude, 90, 'latitude');
  const lon = coordinate(longitude, 180, 'longitude');
  if (!Number.isFinite(candleLightingMinutes) || candleLightingMinutes < 0) {
    throw new RangeError('Invalid candleLightingMinutes');
  }

  const parts = civilDateParts(date);
  const sun = solarDay(parts, 0, lat, lon);
  const previousSun = solarDay(parts, -1, lat, lon);
  const nextSun = solarDay(parts, 1, lat, lon);

  const trueSunrise = at(sun, ANGLES.trueSunriseSunset, true);
  const trueSunset = at(sun, ANGLES.trueSunriseSunset, false);
  const previousTrueSunset = at(previousSun, ANGLES.trueSunriseSunset, false);
  const nextTrueSunrise = at(nextSun, ANGLES.trueSunriseSunset, true);
  const sunrise = at(sun, ANGLES.visibleSunriseSunset, true);
  const sunset = at(sun, ANGLES.visibleSunriseSunset, false);
  const shaahZmanitMs = trueSunrise && trueSunset
    ? (trueSunset.getTime() - trueSunrise.getTime()) / 12
    : null;

  let alos = at(sun, ANGLES.alos, true);
  let alosFallback = false;
  if (!alos) {
    // Chabad.org's high-latitude rule: when the Sun never reaches 16.9°
    // overnight, dawn is the lowest point of the preceding night.
    alos = between(previousTrueSunset, trueSunrise, 0.5);
    alosFallback = Boolean(alos);
  }

  return {
    alos,
    alosFallback,
    misheyakir: at(sun, ANGLES.misheyakir, true),
    sunrise,
    trueSunrise,
    shaahZmanitMs,
    latestShema: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 3 * shaahZmanitMs / 60000) : null,
    latestTefila: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 4 * shaahZmanitMs / 60000) : null,
    latestBiurChametz: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 5 * shaahZmanitMs / 60000) : null,
    midday: between(trueSunrise, trueSunset, 0.5),
    minchaGedola: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 6.5 * shaahZmanitMs / 60000) : null,
    minchaKetana: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 9.5 * shaahZmanitMs / 60000) : null,
    plag: trueSunrise && shaahZmanitMs !== null ? shift(trueSunrise, 10.75 * shaahZmanitMs / 60000) : null,
    sunset,
    trueSunset,
    tzeit: at(sun, ANGLES.tzeit, false),
    shabbatEnds: at(sun, ANGLES.shabbatEnd, false),
    candleLighting: shift(sunset, -candleLightingMinutes),
    midnight: between(trueSunset, nextTrueSunrise, 0.5),
  };
}

/** Additional opinion, not part of Chabad.org's default daily zmanim. */
function timeAtAngle({date, latitude, longitude, angle, rising}) {
  const lat = coordinate(latitude, 90, 'latitude');
  const lon = coordinate(longitude, 180, 'longitude');
  if (!Number.isFinite(angle) || angle < -90 || angle > 90) throw new RangeError('Invalid angle');
  return at(solarDay(civilDateParts(date), 0, lat, lon), angle, Boolean(rising));
}

function roundToNearestMinute(date) {
  return date ? new Date(Math.round(date.getTime() / 60000) * 60000) : null;
}

const ROUND_DOWN = new Set(['alos', 'latestShema', 'latestTefila', 'latestBiurChametz', 'midday', 'midnight']);
const ROUND_UP = new Set(['misheyakir', 'minchaGedola', 'minchaKetana', 'plag', 'tzeit']);

/** Chabad.org's displayed-minute convention, inferred from its live tables. */
function roundChabadZman(name, date, {alosFallback = false} = {}) {
  if (!date) return null;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Invalid zman date');
  const minute = date.getTime() / 60000;
  const rounding = name === 'alos' && alosFallback ? Math.round
    : ROUND_DOWN.has(name) ? Math.floor
      : ROUND_UP.has(name) ? Math.ceil : Math.round;
  return new Date(rounding(minute) * 60000);
}

/** Whole-minute values as displayed by Chabad.org; use raw values for scheduling. */
function displayChabadZmanim(options) {
  const raw = calculateChabadZmanim(options);
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [
    name, value instanceof Date ? roundChabadZman(name, value, {alosFallback: raw.alosFallback}) : value,
  ]));
}

/** Kehila's existing Hebrew display rows, including two optional opinions. */
function chabadDailyZmanim(options, {includeDeoraita = true} = {}) {
  const times = displayChabadZmanim(options);
  const rows = [
    {nom: 'עלות השחר 120 דקות', time: roundChabadZman('alos', timeAtAngle({...options, angle: 26, rising: true}))},
    {nom: 'עלות השחר 72 דקות', time: times.alos},
    {nom: 'תפילין ושמע', time: times.misheyakir},
    {nom: 'נץ החמה', time: times.sunrise},
    {nom: 'סוף זמן ק״ש', time: times.latestShema},
    {nom: 'סוף זמן תפילה', time: times.latestTefila},
    {nom: 'חצות היום', time: times.midday},
    {nom: 'מנחה גדולה', time: times.minchaGedola},
    {nom: 'מנחה קטנה', time: times.minchaKetana},
    {nom: 'פלג המנחה', time: times.plag},
    {nom: 'שקיעת החמה', time: times.sunset},
    {nom: 'צאת הכוכבים', time: times.tzeit},
    {nom: 'חצות לילה', time: times.midnight},
  ];
  if (includeDeoraita) {
    rows.push({nom: 'צאת דאורייתא', time: roundChabadZman('tzeit', timeAtAngle({...options, angle: 6.83, rising: false}))});
  }
  return rows.filter(row => row.time instanceof Date && Number.isFinite(row.time.getTime()))
    .sort((a, b) => a.time - b.time);
}

const {createPeriodFunctions} = require('./periods.cjs');
module.exports = {
  ANGLES, calculateChabadZmanim, displayChabadZmanim, chabadDailyZmanim,
  timeAtAngle, roundToNearestMinute, roundChabadZman,
  ...createPeriodFunctions(() => require('@hebcal/core'), displayChabadZmanim),
};
