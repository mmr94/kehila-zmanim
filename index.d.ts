export type CivilDate = Date | `${number}-${number}-${number}`;

export interface LocationOptions {
  date: CivilDate;
  latitude: number | string;
  longitude: number | string;
}

export interface ChabadOptions extends LocationOptions {
  /** Community custom, in minutes before the published sea-level sunset. Default: 18. */
  candleLightingMinutes?: number;
}

export interface ChabadTimes {
  alos: Date | null;
  alosFallback: boolean;
  misheyakir: Date | null;
  sunrise: Date | null;
  trueSunrise: Date | null;
  shaahZmanitMs: number | null;
  latestShema: Date | null;
  latestTefila: Date | null;
  latestBiurChametz: Date | null;
  midday: Date | null;
  minchaGedola: Date | null;
  minchaKetana: Date | null;
  plag: Date | null;
  sunset: Date | null;
  trueSunset: Date | null;
  tzeit: Date | null;
  shabbatEnds: Date | null;
  candleLighting: Date | null;
  midnight: Date | null;
}

export declare const ANGLES: Readonly<{
  alos: 16.9;
  misheyakir: 10.2;
  visibleSunriseSunset: 0.833;
  trueSunriseSunset: 1.583;
  tzeit: 6;
  shabbatEnd: 8.5;
}>;

export declare function calculateChabadZmanim(options: ChabadOptions): ChabadTimes;
export declare function displayChabadZmanim(options: ChabadOptions): ChabadTimes;
export declare function chabadDailyZmanim(options: ChabadOptions, displayOptions?: {includeDeoraita?: boolean}): Array<{nom: string; time: Date}>;
export declare function timeAtAngle(options: LocationOptions & {angle: number; rising: boolean}): Date | null;
export declare function roundToNearestMinute(date: Date | null): Date | null;
export declare function roundChabadZman(name: keyof ChabadTimes, date: Date | null, options?: {alosFallback?: boolean}): Date | null;

export type RestHoliday = 'ROSH_HASHANA' | 'YOM_KIPPUR' | 'SUKKOT' | 'SHMINI_ATZERET' | 'SIMCHAT_TORAH' | 'PESACH' | 'SHAVUOT';
export interface RestPeriodOptions {
  /** Absolute instant used to select the current or next period. */
  from?: Date;
  latitude: number | string;
  longitude: number | string;
  israel?: boolean;
  /** Apply Chabad.org's displayed-minute convention instead of Hebcal event times. */
  useChabad?: boolean;
  candleLightingMinutes?: number;
  daysBefore?: number;
  daysAfter?: number;
}
export interface RestPeriod {
  start: Date;
  end: Date;
  schedule: Array<{
    kind: 'entry' | 'candles' | 'exit';
    at: Date;
    afterNightfall?: boolean;
    /** Occasion beginning after candles, or ending at an exit, if any. */
    holiday?: RestHoliday | null;
    shabbat?: boolean;
  }>;
  occasion: {
    holidays: RestHoliday[];
    parasha: {latin: string; hebrew: string | null} | null;
    hasShabbat: boolean;
  };
  timeZone: string;
}
export declare function getRestPeriods(options: RestPeriodOptions): RestPeriod[];
export declare function getNextRestPeriod(options: RestPeriodOptions): RestPeriod | null;
