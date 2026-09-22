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
