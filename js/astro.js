// Zon en maan berekenen (gebaseerd op het SunCalc-algoritme van Vladimir Agafonkin, BSD-licentie)
const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
const toJulian = d => d.valueOf() / dayMs - .5 + J1970, fromJulian = j => new Date((j + .5 - J1970) * dayMs), toDays = d => toJulian(d) - J2000;
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const altitude = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
const solarMeanAnomaly = d => rad * (357.5291 + .98560028 * d);
const eclipticLongitude = M => M + rad * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
function sunCoords(d){ const L = eclipticLongitude(solarMeanAnomaly(d)); return {dec:declination(L, 0), ra:rightAscension(L, 0)}; }

// Gouden uur, blauw uur, schemering
export function sunTimes(date, lat, lng){
  const lw = rad * -lng, phi = rad * lat, d = toDays(date), n = Math.round(d - .0009 - lw / (2 * Math.PI));
  const ds = .0009 + lw / (2 * Math.PI) + n, M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0);
  const Jnoon = J2000 + ds + .0053 * Math.sin(M) - .0069 * Math.sin(2 * L);
  const at = h => { const w = Math.acos((Math.sin(h * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const a = .0009 + (w + lw) / (2 * Math.PI) + n, Jset = J2000 + a + .0053 * Math.sin(M) - .0069 * Math.sin(2 * L); return [fromJulian(Jnoon - (Jset - Jnoon)), fromJulian(Jset)]; };
  const [goldenEndMorning, goldenStartEvening] = at(6), [blueStartMorning, blueEndEvening] = at(-6), [, ] = [];
  const [riseApprox, setApprox] = at(-.833), [blueEndMorning, blueStartEvening] = at(-4);
  return {noon:fromJulian(Jnoon), rise:riseApprox, set:setApprox, goldenEndMorning, goldenStartEvening, blueStartMorning, blueEndMorning, blueStartEvening, blueEndEvening};
}

function moonCoords(d){
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F), dt = 385001 - 20905 * Math.cos(M);
  return {ra:rightAscension(l, b), dec:declination(l, b), dist:dt};
}
export function moonIllumination(date){
  const d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return {fraction:(1 + Math.cos(inc)) / 2, phase:.5 + .5 * inc * (angle < 0 ? -1 : 1) / Math.PI};
}
function moonAltitude(date, lat, lng){
  const lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d), H = siderealTime(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec); h = h + rad * .017 / Math.tan(h + rad * 10.26 / (h + rad * 5.10)); return h;
}
export function moonTimes(date, lat, lng){
  const t = new Date(date); t.setHours(0, 0, 0, 0);
  const hc = .133 * rad, hoursLater = (d, h) => new Date(d.valueOf() + h * dayMs / 24);
  let h0 = moonAltitude(t, lat, lng) - hc, rise, set, ye;
  for(let i = 1; i <= 24; i += 2){
    const h1 = moonAltitude(hoursLater(t, i), lat, lng) - hc, h2 = moonAltitude(hoursLater(t, i + 1), lat, lng) - hc;
    const a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a); ye = (a * xe + b) * xe + h1;
    const dd = b * b - 4 * a * h1; let roots = 0, x1 = 0, x2 = 0;
    if(dd >= 0){ const dx = Math.sqrt(dd) / (Math.abs(a) * 2); x1 = xe - dx; x2 = xe + dx; if(Math.abs(x1) <= 1) roots++; if(Math.abs(x2) <= 1) roots++; if(x1 < -1) x1 = x2; }
    if(roots === 1){ if(h0 < 0) rise = i + x1; else set = i + x1; }
    else if(roots === 2){ rise = i + (ye < 0 ? x2 : x1); set = i + (ye < 0 ? x1 : x2); }
    if(rise && set) break; h0 = h2;
  }
  return {rise:rise ? hoursLater(t, rise) : null, set:set ? hoursLater(t, set) : null};
}
export function phaseName(p){
  if(p < .03 || p > .97) return "Nieuwe maan"; if(p < .22) return "Wassende sikkel"; if(p < .28) return "Eerste kwartier"; if(p < .47) return "Wassende maan";
  if(p < .53) return "Volle maan"; if(p < .72) return "Afnemende maan"; if(p < .78) return "Laatste kwartier"; return "Afnemende sikkel";
}
export function nextPhase(date, target){ // target .5 = volle maan, 0 = nieuwe maan
  let d = new Date(date);
  for(let i = 0; i < 31 * 4; i++){ const p = moonIllumination(d).phase, q = moonIllumination(new Date(d.valueOf() + 6 * 36e5)).phase;
    const hit = target === 0 ? q < p : (p <= .5 && q > .5); if(hit) return d; d = new Date(d.valueOf() + 6 * 36e5); }
  return null;
}
