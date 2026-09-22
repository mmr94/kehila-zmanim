import * as chabadModule from './index.js';
import * as hebcalCore from '@hebcal/core';
import * as periodsModule from './periods.js';

// Interop CommonJS -> ESM, selon qui lit ce fichier.
//
// Node rend `module.exports` pour un `import x from './y.cjs'`. webpack, lui,
// rend l'ESPACE DE NOMS, qui porte `module.exports` sous `default` : tous les
// `chabad.*` ci-dessous valaient alors `undefined`, et l'appel à
// `createPeriodFunctions` jetait « is not a function » au CHARGEMENT du module
// — donc page blanche dans le backoffice et sur le site public, qui sont tous
// deux empaquetés par webpack. On accepte les deux formes.
const chabad = chabadModule.default || chabadModule;
const periods = periodsModule.default || periodsModule;

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
