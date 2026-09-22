import chabad from './index.cjs';
import * as hebcalCore from '@hebcal/core';
import periods from './periods.cjs';

export const ANGLES = chabad.ANGLES;
export const calculateChabadZmanim = chabad.calculateChabadZmanim;
export const displayChabadZmanim = chabad.displayChabadZmanim;
export const chabadDailyZmanim = chabad.chabadDailyZmanim;
export const timeAtAngle = chabad.timeAtAngle;
export const roundToNearestMinute = chabad.roundToNearestMinute;
export const roundChabadZman = chabad.roundChabadZman;
const periodFunctions = periods.createPeriodFunctions(() => hebcalCore, chabad.displayChabadZmanim);
export const getRestPeriods = periodFunctions.getRestPeriods;
export const getNextRestPeriod = periodFunctions.getNextRestPeriod;
