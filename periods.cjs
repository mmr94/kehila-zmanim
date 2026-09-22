'use strict';

const tzlookup = require('tz-lookup');

const DAY_MS = 86400000;

function holidayFromDescription(description) {
  if (!description) return null;
  if (description.includes('Rosh Hashana')) return 'ROSH_HASHANA';
  if (description.includes('Yom Kippur')) return 'YOM_KIPPUR';
  if (description.includes('Shmini Atzeret')) return 'SHMINI_ATZERET';
  if (description.includes('Simchat Torah')) return 'SIMCHAT_TORAH';
  if (description.includes('Sukkot')) return 'SUKKOT';
  if (description.includes('Pesach')) return 'PESACH';
  if (description.includes('Shavuot')) return 'SHAVUOT';
  return null;
}

function civilDate(event) {
  const day = event.getDate().greg();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function followingCivilDate(event) {
  const day = event.getDate().greg();
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + 1)).toISOString().slice(0, 10);
}

function eventInstant(event, options, displayChabadZmanim, core) {
  if (!options.useChabad) {
    const instant = new Date(event.eventTime);
    return Number.isFinite(instant.getTime()) ? instant : null;
  }
  const times = displayChabadZmanim({
    date: civilDate(event),
    latitude: options.latitude,
    longitude: options.longitude,
    candleLightingMinutes: options.candleLightingMinutes,
  });
  // Hebcal marks a second-night lighting with LIGHT_CANDLES_TZEIS. It is
  // permitted only after nightfall, never before sunset as on Friday.
  const afterNightfall = event instanceof core.HavdalahEvent ||
    (event.getFlags() & core.flags.LIGHT_CANDLES_TZEIS) !== 0 ||
    event.getDate().greg().getDay() === 6;
  return afterNightfall ? times.shabbatEnds : times.candleLighting;
}

function parashaOf(event) {
  const latin = Array.isArray(event.parsha) ? event.parsha.join('-') :
    event.getDesc().replace(/^Parashat\s+/i, '');
  let hebrew = null;
  try {
    const rendered = event.render('he');
    if (rendered && rendered !== event.render('en')) {
      hebrew = rendered.replace(/^פָּרָשַׁת\s+|^פרשת\s+/, '');
    }
  } catch (_) { /* Hebrew locale is optional for the host application. */ }
  return {latin, hebrew};
}

function validCoordinate(value, limit, name) {
  if (value === null || value === undefined || value === '') throw new RangeError(`Invalid ${name}`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < -limit || number > limit) throw new RangeError(`Invalid ${name}`);
  return number;
}

/** The complete, non-overlapping Shabbat/Yom Tov periods near `from`. */
function createPeriodFunctions(loadCore, displayChabadZmanim) {
  function getRestPeriods({
    from = new Date(), latitude, longitude, israel = false,
    useChabad = false, candleLightingMinutes,
    daysBefore = 14, daysAfter = 28,
  }) {
    const {CandleLightingEvent, HavdalahEvent, HebrewCalendar, Location, ParshaEvent, flags} = loadCore();
    if (!(from instanceof Date) || !Number.isFinite(from.getTime())) throw new RangeError('Invalid from date');
    const lat = validCoordinate(latitude, 90, 'latitude');
    const lon = validCoordinate(longitude, 180, 'longitude');
    const minutes = candleLightingMinutes == null ? (israel ? 22 : 18) : Number(candleLightingMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError('Invalid candleLightingMinutes');
    if (!Number.isInteger(daysBefore) || daysBefore < 1 || !Number.isInteger(daysAfter) || daysAfter < 1) {
      throw new RangeError('Invalid calendar window');
    }
    const timeZone = tzlookup(lat, lon);
    const location = new Location(lat, lon, Boolean(israel), timeZone,
      israel ? 'Israel' : 'Diaspora', israel ? 'IL' : undefined);
    const start = new Date(from.getTime() - daysBefore * DAY_MS);
    const end = new Date(from.getTime() + daysAfter * DAY_MS);
    const events = HebrewCalendar.calendar({
      start, end, location, il: Boolean(israel), candlelighting: true,
      noModern: true, sedrot: true, omer: false, molad: false,
    });
    const holidayByDay = new Map();
    for (const event of events) {
      if ((event.getFlags() & flags.CHAG) === 0) continue;
      const holiday = holidayFromDescription(event.getDesc());
      if (holiday) holidayByDay.set(civilDate(event), holiday);
    }
    const options = {latitude: lat, longitude: lon, useChabad, candleLightingMinutes: minutes};
    const periods = [];
    let opened = null;

    for (const event of events) {
      if (event instanceof CandleLightingEvent) {
        const at = eventInstant(event, options, displayChabadZmanim, {HavdalahEvent, flags});
        const following = followingCivilDate(event);
        const holiday = holidayByDay.get(following) || null;
        const shabbat = new Date(`${following}T12:00:00Z`).getUTCDay() === 6;
        if (!opened) {
          opened = {start: at, schedule: [], holidays: new Set(), parasha: null, hasShabbat: false};
        }
        if (holiday) opened.holidays.add(holiday);
        opened.schedule.push({
          kind: opened.schedule.length ? 'candles' : 'entry', at,
          afterNightfall: (event.getFlags() & flags.LIGHT_CANDLES_TZEIS) !== 0 ||
            event.getDate().greg().getDay() === 6,
          holiday, shabbat,
        });
        continue;
      }
      if (!opened) continue;

      if (event.getDate().greg().getDay() === 6) opened.hasShabbat = true;
      if ((event.getFlags() & flags.CHAG) !== 0) {
        const holiday = holidayFromDescription(event.getDesc());
        if (holiday) opened.holidays.add(holiday);
      }
      if (event instanceof ParshaEvent) opened.parasha = parashaOf(event);

      if (event instanceof HavdalahEvent) {
        const holiday = event.linkedEvent && (event.linkedEvent.getFlags() & flags.CHAG) !== 0
          ? holidayFromDescription(event.linkedEvent.getDesc()) : null;
        if (holiday) opened.holidays.add(holiday);
        const at = eventInstant(event, options, displayChabadZmanim, {HavdalahEvent, flags});
        opened.schedule.push({kind: 'exit', at});
        if (opened.start && at && opened.schedule.every(item => item.at instanceof Date && Number.isFinite(item.at.getTime())) && at > opened.start) {
          periods.push({
            start: opened.start, end: at, schedule: opened.schedule,
            occasion: {holidays: [...opened.holidays], parasha: opened.parasha, hasShabbat: opened.hasShabbat},
            timeZone,
          });
        }
        opened = null;
      }
    }
    return periods.sort((a, b) => a.start - b.start);
  }

  /** The current period if active, otherwise the next complete period. */
  function getNextRestPeriod(options) {
    const from = options?.from || new Date();
    const periods = getRestPeriods({...options, from});
    return periods.find(period => period.end > from) || null;
  }

  return {getRestPeriods, getNextRestPeriod};
}

module.exports = {createPeriodFunctions};
