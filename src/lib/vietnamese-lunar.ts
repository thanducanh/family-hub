// Vietnamese Lunar Calendar Algorithm (Ho Ngoc Duc)
// Ported/Adapted for TypeScript

const PI = Math.PI;

function INT(d: number): number {
  return Math.floor(d);
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function jdToDate(jd: number): number[] {
  let a, b, c, d, e, m, day, month, year;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((146097 * b) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  d = INT((4 * c + 3) / 1461);
  e = c - INT((1461 * d) / 4);
  m = INT((5 * e + 2) / 153);
  day = e - INT((153 * m + 2) / 5) + 1;
  month = m + 3 - 12 * INT(m / 10);
  year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

function SunLongitude(jdn: number): number {
  return (jdn - 2451545.0) * 0.98564736;
}

function NewMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  const jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
    + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  return jd;
}

function SunLongitudeAtJD(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  let L = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
  let C = (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * dr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr)
    + 0.000289 * Math.sin(3 * M * dr);
  let theta = L + C;
  while (theta < 0) theta += 360;
  while (theta > 360) theta -= 360;
  return theta;
}

function getSunLongitude(dayNumber: number, timeZone: number): number {
  return SunLongitudeAtJD(dayNumber - 0.5 - timeZone / 24);
}

function getNewMoonDay(k: number, timeZone: number): number {
  return INT(NewMoon(k) + 0.5 + timeZone / 24);
}

function getLunarMonth11(yy: number, timeZone: number): number {
  let off = jdFromDate(31, 12, yy) - 2415021.076998695;
  let k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  let sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  let k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let arc = 0;
  let i = 1;
  let isLeap = 0;
  let arc_last = getSunLongitude(getNewMoonDay(k, timeZone), timeZone);
  for (i = 1; i <= 14; i++) {
    let nm = getNewMoonDay(k + i, timeZone);
    arc = getSunLongitude(nm, timeZone);
    if (INT((arc - arc_last) / 30) === 0) {
      isLeap = i;
      break;
    }
    arc_last = arc;
  }
  return isLeap;
}

export function getLunarDate(dd: number, mm: number, yy: number, timeZone: number = 7): [number, number, number, number] {
  let dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  if (a11 >= monthStart) {
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  let day = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11) / 29);
  let leapMonthDiff = getLeapMonthOffset(a11, timeZone);
  let month = diff - 1;
  let isLeap = 0;
  if (diff >= leapMonthDiff && leapMonthDiff > 0) {
    if (diff === leapMonthDiff) isLeap = 1;
    month = diff - 2;
  }
  let lunarYear = yy;
  if (month <= 0) {
    month += 12;
    lunarYear--;
  }
  return [day, month, lunarYear, isLeap];
}
