// Geanimeerde weericonen (SVG + CSS), in plaats van emoji
const SUN = `<g class="wi-sun"><circle cx="32" cy="32" r="11" fill="#ffd34d"/><g class="wi-rays" stroke="#ffd34d" stroke-width="3" stroke-linecap="round">${[0,45,90,135,180,225,270,315].map(a => `<line x1="32" y1="9" x2="32" y2="15" transform="rotate(${a} 32 32)"/>`).join("")}</g></g>`;
const MOON = `<g class="wi-moon"><path d="M40 14a18 18 0 1 0 10 30A15 15 0 0 1 40 14z" fill="#dfe9ff"/><circle cx="48" cy="16" r="1.4" class="wi-star" fill="#fff"/><circle cx="54" cy="28" r="1" class="wi-star" fill="#fff" style="animation-delay:.8s"/></g>`;
const CLOUD = (y = 0, c = "#eef4ff", cls = "wi-cloud") => `<path class="${cls}" transform="translate(0 ${y})" d="M20 48h26a10 10 0 0 0 0-20 13 13 0 0 0-25-3 9 9 0 0 0-1 23z" fill="${c}"/>`;
const SMALL = (dx, dy, c) => `<path class="wi-cloud2" transform="translate(${dx} ${dy}) scale(.7)" d="M20 48h26a10 10 0 0 0 0-20 13 13 0 0 0-25-3 9 9 0 0 0-1 23z" fill="${c}"/>`;
const DROPS = n => Array.from({length:n}, (_, i) => `<line class="wi-drop" x1="${22 + i * 8}" y1="52" x2="${19 + i * 8}" y2="60" stroke="#6fd3ff" stroke-width="2.6" stroke-linecap="round" style="animation-delay:${i * .25}s"/>`).join("");
const FLAKES = n => Array.from({length:n}, (_, i) => `<circle class="wi-flake" cx="${22 + i * 9}" cy="55" r="2.4" fill="#fff" style="animation-delay:${i * .4}s"/>`).join("");
const BOLT = `<path class="wi-bolt" d="M34 44l-7 11h6l-3 9 10-13h-6l4-7z" fill="#ffd34d"/>`;
const FOG = `<g class="wi-fog" stroke="#cfd8e6" stroke-width="3" stroke-linecap="round"><line x1="14" y1="44" x2="50" y2="44"/><line x1="20" y1="51" x2="56" y2="51" style="animation-delay:.6s"/><line x1="12" y1="58" x2="44" y2="58" style="animation-delay:1.2s"/></g>`;

export function wxIcon(code, isDay = 1, size = 34){
  const day = isDay !== 0;
  let g;
  if(code === 0) g = day ? SUN : MOON;
  else if(code === 1) g = (day ? SUN : MOON) + SMALL(18, 18, "#eef4ff");
  else if(code === 2) g = `<g transform="translate(-6 -6) scale(.8)">${day ? SUN : MOON}</g>` + CLOUD(2);
  else if(code === 3) g = SMALL(14, -6, "#aab6c8") + CLOUD(2);
  else if(code === 45 || code === 48) g = CLOUD(-8, "#cfd8e6") + FOG;
  else if(code >= 51 && code <= 57) g = CLOUD(-6) + DROPS(2);
  else if((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) g = (code === 80 && day ? `<g transform="translate(-8 -10) scale(.7)">${SUN}</g>` : "") + CLOUD(-6, code >= 65 || code === 82 ? "#b9c4d6" : "#eef4ff") + DROPS(code >= 65 || code === 82 ? 4 : 3);
  else if((code >= 71 && code <= 77) || code === 85 || code === 86) g = CLOUD(-6) + FLAKES(3);
  else if(code >= 95) g = CLOUD(-8, "#9aa6ba") + BOLT + DROPS(2);
  else g = CLOUD(0);
  return `<svg class="wi" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
}

// Maanfase-icoontje: fase 0 = nieuwe maan, .5 = volle maan
export function moonIcon(phase, size = 48){
  const r = 20, cx = 24, cy = 24, k = Math.cos(phase * 2 * Math.PI), waxing = phase < .5;
  const rx = Math.abs(k) * r, sweepOuter = waxing ? 1 : 0, lit = `M${cx} ${cy - r} A${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A${rx} ${r} 0 0 ${k > 0 ? 1 - sweepOuter : sweepOuter} ${cx} ${cy - r}z`;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1b2638"/><path d="${lit}" fill="#e8eefc"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(var(--nr),.4)"/></svg>`;
}
