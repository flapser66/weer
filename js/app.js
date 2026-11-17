// =========================================================
//  WEER//OS – data ophalen, tekenen, plaatsen, instellingen
// =========================================================
import {S, save, apply, CARDS, onChange} from "./settings.js";
import {SFX, unlock} from "./sound.js";
import * as FX from "./fx.js";
import {pushHost, pushSupported, enablePush, disablePush, syncPush} from "./push.js";

const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const esc = s => String(s).replace(/[&<>"']/g, m => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[m]));
const R = Math.round, pad = n => String(n).padStart(2, "0"), hm = iso => iso.slice(11, 16);
const ICON = (p, a = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a}>${p}</svg>`;

/* ---------- weercodes ---------- */
const WMO = {
  0:["Onbewolkt","☀️","🌙","clear"], 1:["Overwegend zonnig","🌤️","🌙","clear"], 2:["Half bewolkt","⛅","☁️","cloud"], 3:["Bewolkt","☁️","☁️","cloud"],
  45:["Mist","🌫️","🌫️","fog"], 48:["Rijpmist","🌫️","🌫️","fog"],
  51:["Lichte motregen","🌦️","🌧️","rain"], 53:["Motregen","🌦️","🌧️","rain"], 55:["Dichte motregen","🌧️","🌧️","rain"], 56:["Ijzel (motregen)","🌧️","🌧️","rain"], 57:["Ijzel","🌧️","🌧️","rain"],
  61:["Lichte regen","🌦️","🌧️","rain"], 63:["Regen","🌧️","🌧️","rain"], 65:["Zware regen","🌧️","🌧️","rain"], 66:["Ijzel","🌧️","🌧️","rain"], 67:["Zware ijzel","🌧️","🌧️","rain"],
  71:["Lichte sneeuw","🌨️","🌨️","snow"], 73:["Sneeuw","🌨️","🌨️","snow"], 75:["Zware sneeuw","❄️","❄️","snow"], 77:["Sneeuwkorrels","🌨️","🌨️","snow"],
  80:["Lichte buien","🌦️","🌧️","rain"], 81:["Buien","🌧️","🌧️","rain"], 82:["Zware buien","⛈️","⛈️","rain"], 85:["Sneeuwbuien","🌨️","🌨️","snow"], 86:["Zware sneeuwbuien","❄️","❄️","snow"],
  95:["Onweer","⛈️","⛈️","storm"], 96:["Onweer met hagel","⛈️","⛈️","storm"], 99:["Zwaar onweer met hagel","⛈️","⛈️","storm"]
};
const wmo = c => WMO[c] || ["Onbekend","🌡️","🌡️","cloud"];
const icon = (c, day) => day === 0 ? wmo(c)[2] : wmo(c)[1];
const BG = {clear:["#2a64a8","#0b1834"], cloud:["#46576b","#1c2430"], rain:["#38475a","#111923"], snow:["#566c86","#24303f"], fog:["#575e68","#262b31"], storm:["#2a2c40","#141522"]};

/* ---------- eenheden ---------- */
const DIRS = ["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
const dirName = d => DIRS[Math.round(d / 22.5) % 16];
const BFT = [1,6,12,20,29,39,50,62,75,89,103,118];
const bft = kmh => { const i = BFT.findIndex(x => kmh < x); return i < 0 ? 12 : i; };
const wind = kmh => S.wind === "kmh" ? `${R(kmh)} km/u` : S.wind === "ms" ? `${R(kmh / 3.6)} m/s` : `${bft(kmh)} Bft`;
const uvTxt = u => u < 3 ? "Laag" : u < 6 ? "Matig" : u < 8 ? "Hoog" : u < 11 ? "Zeer hoog" : "Extreem";
const aqTxt = a => a <= 20 ? "Goed" : a <= 40 ? "Redelijk" : a <= 60 ? "Matig" : a <= 80 ? "Slecht" : a <= 100 ? "Zeer slecht" : "Extreem slecht";
const dateOf = iso => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const dayName = (iso, i) => i === 0 ? "Vandaag" : dateOf(iso).toLocaleDateString("nl-NL", {weekday:"short"}).replace(".", "").replace(/^./, s => s.toUpperCase());

/* ---------- netwerk ---------- */
async function get(url, ms = 12000, text){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try{ const r = await fetch(url, {signal:ctl.signal}); if(!r.ok) throw new Error(r.status); return text ? await r.text() : await r.json(); }
  finally{ clearTimeout(t); }
}
function forecastURL(lat, lon){
  return "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude:lat.toFixed(4), longitude:lon.toFixed(4), timezone:"auto", forecast_days:"10",
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m",
    hourly:"temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,uv_index,visibility,wind_speed_10m,wind_gusts_10m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant",
    minutely_15:"precipitation", forecast_minutely_15:"12"
  });
}
async function buienradar(lat, lon){
  const t = await get(`https://gpsgadget.buienradar.nl/data/raintext?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, 6000, true);
  const rows = t.trim().split(/\r?\n/).map(l => l.split("|")).filter(a => a.length === 2);
  if(rows.length < 6) throw new Error("leeg");
  return rows.map(([v, time]) => ({time:time.trim(), mm:Number(v) > 0 ? Math.pow(10, (Number(v) - 109) / 32) : 0}));
}
const airQuality = (lat, lon) => get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,grass_pollen,birch_pollen&timezone=auto`, 8000).then(j => j.current).catch(() => null);
function inPoly(lat, lon, poly){
  const p = poly.trim().split(/\s+/).map(x => x.split(",").map(Number)); let inside = false;
  for(let i = 0, j = p.length - 1; i < p.length; j = i++){ const [yi, xi] = p[i], [yj, xj] = p[j]; if(((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
async function warnings(lat, lon){
  if(!(lat > 50.6 && lat < 53.7 && lon > 3.2 && lon < 7.3)) return [];
  if(pushHost) return get(`/api/warnings?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, 12000).catch(() => null);
  try{
    const j = await get("https://feeds.meteoalarm.org/api/v1/warnings/feeds-netherlands", 9000), now = Date.now(), out = [], seen = new Set();
    for(const w of j.warnings || []){
      const a = w.alert || {}; if(a.msgType === "Cancel" || a.status !== "Actual") continue;
      const infos = a.info || [], info = infos.find(i => /^nl/i.test(i.language)) || infos[0];
      if(!info || Date.parse(info.expires) < now) continue;
      const par = k => ((info.parameter || []).find(p => p.valueName === k) || {}).value || "";
      const level = parseInt(par("awareness_level")) || 1; if(level < 2) continue;
      if(!(info.area || []).some(ar => ar.polygon && [].concat(ar.polygon).some(pg => inPoly(lat, lon, pg)))) continue;
      const key = level + (par("awareness_type") || info.event) + info.onset; if(seen.has(key)) continue; seen.add(key);
      out.push({level, event:info.event, headline:info.headline || "", desc:info.description || "", onset:info.onset, expires:info.expires});
    }
    return out.sort((x, y) => y.level - x.level || Date.parse(x.onset) - Date.parse(y.onset));
  }catch(e){ return null; }
}

/* ---------- plaatsen ---------- */
let current = store.get("weer.active", null);     // {lat, lon, name, gps}
let saved = store.get("weer.saved", []);
const places = () => [{gps:true, name:"Mijn locatie"}, ...saved];
const placeIndex = () => current && !current.gps ? 1 + saved.findIndex(p => Math.abs(p.lat - current.lat) < .01 && Math.abs(p.lon - current.lon) < .01) : 0;
function gps(){
  return new Promise((res, rej) => {
    if(!navigator.geolocation) return rej(new Error("geen gps"));
    navigator.geolocation.getCurrentPosition(p => res({lat:p.coords.latitude, lon:p.coords.longitude}), rej, {enableHighAccuracy:true, timeout:12000, maximumAge:5 * 60 * 1000});
  });
}
const placeName = (lat, lon) => get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=nl`, 6000)
  .then(j => j.city || j.locality || j.principalSubdivision || "Mijn locatie").catch(() => "Mijn locatie");

/* ---------- laden ---------- */
let busy = false, lastData = null, lastLoad = 0;
async function load(){
  if(busy) return; busy = true; lastLoad = Date.now(); $("btnRefresh").classList.add("spin");
  try{
    if(!current || current.gps){
      try{
        const pos = await gps();
        const same = current && current.gps && Math.abs(current.lat - pos.lat) < .01 && Math.abs(current.lon - pos.lon) < .01;
        current = {lat:pos.lat, lon:pos.lon, name:same ? current.name : await placeName(pos.lat, pos.lon), gps:true};
        store.set("weer.active", current);
      }catch(e){ if(!current || current.lat == null){ msg("Ik kan je locatie niet bepalen. Sta locatietoegang toe, of kies een plaats.", true); return; } }
    }
    const p = current;
    const [fc, rain, aq, warn] = await Promise.all([get(forecastURL(p.lat, p.lon)), buienradar(p.lat, p.lon).catch(() => null), airQuality(p.lat, p.lon), warnings(p.lat, p.lon)]);
    const data = {fc, rain, aq, warn, place:p, at:Date.now()};
    store.set("weer.last", data); render(data);
    if(p.gps) syncPush(p);
  }catch(e){
    const last = store.get("weer.last", null);
    if(last) render(last, true); else msg("Geen verbinding met de weerdienst. Probeer het zo opnieuw.", true);
  }finally{ busy = false; $("btnRefresh").classList.remove("spin"); }
}
function msg(t, retry){
  $("main").classList.add("hidden"); $("status").classList.remove("hidden");
  $("status").innerHTML = esc(t) + (retry ? '<br><button id="retry">Opnieuw proberen</button> <button id="pick">Plaats kiezen</button>' : "");
  if(retry){ $("retry").onclick = load; $("pick").onclick = openPlaces; }
}

/* =========================================================
   Berekeningen
   ========================================================= */
function rainPoints(d){
  if(d.rain && d.rain.length) return {pts:d.rain.slice(0, 24), step:5, src:"Buienradar · per 5 minuten"};
  const m = d.fc.minutely_15 || {time:[], precipitation:[]};
  return {pts:m.time.map((t, i) => ({time:hm(t), mm:(m.precipitation[i] || 0) * 4})), step:15, src:"Open-Meteo · per kwartier"};
}
const rainKind = mm => mm >= 2.5 ? "flinke regen" : mm < .5 ? "lichte regen" : "regen";
function rainSpans(pts){
  const n = pts.length, wet = pts.map(p => p.mm >= .1), spans = [];
  for(let i = 0; i < n; i++) if(wet[i] && (i === 0 || !wet[i - 1])){
    let e = i; while(e + 1 < n && wet[e + 1]) e++;
    spans.push({s:i, e, from:i === 0 ? "nu" : pts[i].time, to:e + 1 < n ? pts[e + 1].time : null, peak:Math.max(...pts.slice(i, e + 1).map(p => p.mm))}); i = e;
  }
  return spans;
}
function rainText(spans, hrs){
  if(!spans.length) return `Droog de komende ${hrs} uur.`;
  let s = spans.map((sp, k) => {
    const k1 = k === 0 ? rainKind(sp.peak).replace(/^./, x => x.toUpperCase()) : rainKind(sp.peak);
    if(sp.s === 0) return sp.to ? `${k1} tot ${sp.to}` : `${k1} de komende ${hrs} uur`;
    return sp.to ? `${k1} van ${sp.from} tot ${sp.to}` : `${k1} vanaf ${sp.from}`;
  }).join(", daarna ");
  return s + (spans[spans.length - 1].to ? ", daarna droog." : ".");
}
// Fietsweer: 0–10 per uur
function bikeScore(h, i){
  let s = 10;
  s -= Math.min(6, (h.precipitation[i] || 0) * 6);
  s -= Math.min(3, (h.precipitation_probability[i] || 0) / 30);
  const w = h.wind_speed_10m ? h.wind_speed_10m[i] : 10, g = h.wind_gusts_10m ? h.wind_gusts_10m[i] : w;
  if(w > 18) s -= (w - 18) / 5; if(g > 45) s -= (g - 45) / 10;
  const t = h.apparent_temperature ? h.apparent_temperature[i] : h.temperature_2m[i];
  if(t < 5) s -= (5 - t) / 2.5; if(t > 27) s -= (t - 27) / 2;
  if(h.is_day[i] === 0) s -= 2;
  return Math.max(0, Math.min(10, Math.round(s)));
}
function advice(c, h, hi, dy, spans){
  const out = [], feels = c.apparent_temperature, next3 = [hi, hi + 1, hi + 2].filter(i => i < h.time.length);
  const prob = Math.max(...next3.map(i => h.precipitation_probability[i] || 0));
  if(feels < 3) out.push("🧥 Dikke jas"); else if(feels < 12) out.push("🧥 Jas"); else if(feels < 17) out.push("👕 Vest"); else if(feels >= 22) out.push("🩳 Korte broek");
  if(feels <= 1) out.push("🧤 Handschoenen");
  if(spans.length || prob >= 50) out.push("☂️ Paraplu");
  if(c.temperature_2m <= 1 && (spans.length || prob >= 40)) out.push("⚠️ Kans op gladheid");
  if((dy.uv_index_max[0] || 0) >= 5 && c.is_day) out.push("🕶️ Zonnebril & insmeren");
  if(c.wind_gusts_10m >= 50) out.push("💨 Harde windstoten");
  if((h.visibility[hi] || 99999) < 1000) out.push("🌫️ Mist, rij voorzichtig");
  return out.slice(0, 5);
}

/* =========================================================
   Tekenen
   ========================================================= */
const H2 = (svg, title) => `<h2>${ICON(svg)}<span>${title}</span></h2>`;
function render(d, stale){
  lastData = d;
  const {fc, place} = d, c = fc.current, h = fc.hourly, dy = fc.daily;
  $("status").classList.add("hidden"); $("main").classList.remove("hidden");
  let hi = h.time.findIndex(x => x.slice(0, 13) === c.time.slice(0, 13)); if(hi < 0) hi = 0;
  const kind = c.weather_code === 2 ? "cloud" : wmo(c.weather_code)[3];

  // thema + effecten
  document.documentElement.style.setProperty("--bg1", BG[kind][c.is_day ? 0 : 1]);
  FX.weather({kind, isDay:c.is_day, code:c.weather_code, wind:[c.wind_speed_10m || 0, c.wind_direction_10m || 0], t:c.temperature_2m});

  // dashboard
  $("place").innerHTML = (place.gps ? ICON('<path d="M21 3L3 10.5l7.5 3L13.5 21z" fill="currentColor"/>') : "") + `<span>${esc(place.name)}</span>`;
  $("dots").innerHTML = places().length > 1 ? places().map((p, i) => `<i class="${i === placeIndex() ? "on" : ""}"></i>`).join("") : "";
  FX.count($("temp"), R(c.temperature_2m));
  FX.decode($("cond"), wmo(c.weather_code)[0]);
  $("hilo").textContent = `H:${R(dy.temperature_2m_max[0])}°  L:${R(dy.temperature_2m_min[0])}°  ·  voelt als ${R(c.apparent_temperature)}°`;
  const t = new Date(d.at);
  $("updated").textContent = (stale ? "Offline · laatst bijgewerkt " : "Bijgewerkt ") + pad(t.getHours()) + ":" + pad(t.getMinutes());
  $("updated").classList.toggle("off", !!stale);
  FX.drawSolar($("solar"), {now:c.time, rise:dy.sunrise[0], set:dy.sunset[0], rise2:dy.sunrise[1]});
  const rp = rainPoints(d), spans = rainSpans(rp.pts), hrs = R(rp.pts.length * rp.step / 60);
  FX.type($("now"), rainText(spans, hrs));
  $("chips").innerHTML = advice(c, h, hi, dy, spans).map(a => `<span class="chip">${a}</span>`).join("");

  // waarschuwingen
  const names = {2:"Code geel", 3:"Code oranje", 4:"Code rood"};
  const fdt = iso => { const x = new Date(iso), same = x.toDateString() === new Date().toDateString(); return (same ? "" : x.toLocaleDateString("nl-NL", {weekday:"short"}) + " ") + pad(x.getHours()) + ":" + pad(x.getMinutes()); };
  $("warnings").innerHTML = (d.warn || []).map(w => `<div class="warn l${w.level}"><div class="wt">⚠️ ${names[w.level]}: ${esc(w.event)}</div><div class="ws">${Date.parse(w.onset) > Date.now() ? "Van " + fdt(w.onset) + " " : ""}tot ${fdt(w.expires)} · tik voor details</div><div class="wd">${esc(w.headline)}${w.desc ? "<br>" + esc(w.desc) : ""}</div></div>`).join("");
  if((d.warn || []).length && !stale) FX.alarm();

  // kaarten in jouw volgorde
  const box = $("cards"), radar = $("radarCard");
  [...box.children].forEach(el => { if(el !== radar) el.remove(); });
  for(const id of S.order){
    if(S.hidden.includes(id)) continue;
    if(id === "radar"){ box.appendChild(radar); continue; }
    const html = CARD[id](d, c, h, dy, hi, rp, spans); if(!html) continue;
    const tpl = document.createElement("template"); tpl.innerHTML = html.trim(); box.appendChild(tpl.content);
  }
  radar.classList.toggle("hidden", S.hidden.includes("radar"));
  if(!radar.isConnected) $("park").appendChild(radar);
  FX.cards(box);
  wireRain(rp, spans);
  const hb = $("hours"); if(hb){ hb.scrollLeft = 0; requestAnimationFrame(() => FX.coverflow(hb)); hb.addEventListener("scroll", () => FX.coverflow(hb), {passive:true}); }
  if(!S.hidden.includes("radar")) initRadar(place.lat, place.lon);
}

const CARD = {
  rain(d, c, h, dy, hi, rp, spans){
    const {pts, step, src} = rp, n = pts.length; if(!n) return "";
    const pos = i => (i / n * 100).toFixed(2) + "%", max = Math.max(2, ...pts.map(p => p.mm)), every = Math.max(1, R(30 / step));
    let ticks = "", axis = `<span class="first" style="left:0">Nu</span>`;
    for(let i = every; i < n; i += every){ ticks += `<div style="left:${pos(i)}"></div>`; if(i <= n - every / 2) axis += `<span style="left:${pos(i)}">${pts[i].time}</span>`; }
    const label = sp => (sp.e - sp.s + 1) * step >= 20 ? (sp.to ? `${sp.from}–${sp.to}` : `${sp.from}–…`) : "";
    return `<section class="card" id="c-rain">${H2('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', `Neerslag komende ${R(n * step / 60)} uur`)}
      <div class="summary">${esc(rainText(spans, R(n * step / 60)))}</div>
      <div class="rainpick" id="rainPick">Tik op de grafiek voor tijd en hoeveelheid</div>
      <div class="rainchart" id="rainChart"><div class="rainlines"><div style="top:0">${max > 5 ? "zwaar" : "matig"}</div><div style="top:50%">licht</div></div><div class="rainticks">${ticks}</div>
      ${pts.map((p, i) => `<div class="bar${p.mm < .05 ? " zero" : ""}" style="height:${p.mm < .05 ? 2 : Math.max(6, Math.min(100, Math.sqrt(p.mm / max) * 100))}%;animation-delay:${i * 25}ms"></div>`).join("")}</div>
      <div class="rainaxis">${axis}</div>
      ${spans.length ? `<div class="rainspans">${spans.map(sp => `<div style="left:${pos(sp.s)};width:calc(${pos(sp.e + 1)} - ${pos(sp.s)})">${label(sp)}</div>`).join("")}</div>` : ""}
      <div class="src">${src}</div></section>`;
  },
  hours(d, c, h, dy, hi){
    const rainH = []; for(let i = hi; i < hi + 12 && i < h.time.length; i++) if(h.precipitation_probability[i] >= 50) rainH.push(i);
    let s = `${wmo(c.weather_code)[0]}. ` + (rainH.length ? `Kans op regen rond ${hm(h.time[rainH[0]])}. ` : "Komende 12 uur waarschijnlijk droog. ") +
      `Wind ${dirName(c.wind_direction_10m)} ${wind(c.wind_speed_10m)}` + (c.wind_gusts_10m >= 50 ? `, windstoten tot ${R(c.wind_gusts_10m)} km/u.` : ".");
    const suns = []; for(let i = 0; i < 2; i++){ suns.push({t:dy.sunrise[i], k:"Zon op", ic:"🌅"}); suns.push({t:dy.sunset[i], k:"Zon onder", ic:"🌇"}); }
    let html = "";
    for(let i = hi; i < hi + 25 && i < h.time.length; i++){
      const p = h.precipitation_probability[i];
      html += `<div class="hour"><div class="t">${i === hi ? "Nu" : h.time[i].slice(11, 13)}</div><div class="p">${p >= 20 ? R(p / 10) * 10 + "%" : ""}</div><div class="ic">${icon(h.weather_code[i], h.is_day[i])}</div><div class="mm">${h.precipitation[i] >= .1 ? h.precipitation[i].toFixed(1).replace(".", ",") + " mm" : ""}</div><div class="v">${R(i === hi ? c.temperature_2m : h.temperature_2m[i])}°</div></div>`;
      const sn = suns.find(x => x.t && x.t.slice(0, 13) === h.time[i].slice(0, 13) && (i > hi || x.t > c.time));
      if(sn) html += `<div class="hour sun"><div class="t">${hm(sn.t)}</div><div class="p"></div><div class="ic">${sn.ic}</div><div class="mm"></div><div class="v">${sn.k}</div></div>`;
    }
    return `<section class="card" id="c-hours">${H2('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', "Per uur")}<div class="summary">${esc(s)}</div><div class="hours" id="hours">${html}</div></section>`;
  },
  curve(d, c, h, dy, hi){
    const T = h.temperature_2m.slice(hi, hi + 25), P = h.precipitation.slice(hi, hi + 25), n = T.length; if(n < 3) return "";
    const lo = Math.min(...T), top = Math.max(...T), span = Math.max(3, top - lo), W = 320, Hh = 100, y0 = 16;
    const X = i => 6 + i * (W - 12) / (n - 1), Y = v => y0 + (1 - (v - lo) / span) * (Hh - y0 - 10);
    let p = `M${X(0)},${Y(T[0])}`;
    for(let i = 0; i < n - 1; i++){ const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 2);
      p += ` C${X(i) + (X(i + 1) - X(a)) / 6},${Y(T[i]) + (Y(T[i + 1]) - Y(T[a])) / 6} ${X(i + 1) - (X(b) - X(i)) / 6},${Y(T[i + 1]) - (Y(T[b]) - Y(T[i])) / 6} ${X(i + 1)},${Y(T[i + 1])}`; }
    const iMax = T.indexOf(top), iMin = T.indexOf(lo);
    let labs = "", rain = "";
    for(let i = 0; i < n; i += 6) labs += `<text x="${X(i)}" y="${Hh + 14}" text-anchor="middle">${i ? h.time[hi + i].slice(11, 13) + ":00" : "NU"}</text><line x1="${X(i)}" y1="${y0}" x2="${X(i)}" y2="${Hh}" style="stroke:rgba(var(--nr),.12)"/>`;
    P.forEach((v, i) => { if(v >= .1) rain += `<rect x="${X(i) - 3}" y="${Hh - Math.min(30, v * 12)}" width="6" height="${Math.min(30, v * 12)}" rx="1" style="fill:rgba(var(--nr2),.45)"/>`; });
    return `<section class="card curve" id="c-curve">${H2('<path d="M3 17l5-6 4 3 8-9"/>', "Temperatuurcurve 24 uur")}
      <svg viewBox="0 0 ${W} ${Hh + 18}"><defs><linearGradient id="tca" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:rgba(var(--nr),.35)"/><stop offset="1" style="stop-color:rgba(var(--nr),0)"/></linearGradient>
      <filter id="tcg" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${labs}${rain}<path class="ar" d="${p} L${X(n - 1)},${Hh} L${X(0)},${Hh} Z" fill="url(#tca)"/>
      <path id="tcp" class="ln" pathLength="1" d="${p}" style="stroke:var(--neon)" filter="url(#tcg)"/>
      <circle r="4" fill="#fff" filter="url(#tcg)"><animateMotion dur="6s" repeatCount="indefinite" begin="2s"><mpath href="#tcp"/></animateMotion></circle>
      <circle cx="${X(iMax)}" cy="${Y(top)}" r="3" style="fill:var(--neon)"/><text class="tv" x="${X(iMax)}" y="${Y(top) - 6}" text-anchor="middle">${R(top)}°</text>
      <circle cx="${X(iMin)}" cy="${Y(lo)}" r="3" style="fill:var(--neon2)"/><text class="tv" x="${X(iMin)}" y="${Y(lo) + 13}" text-anchor="middle">${R(lo)}°</text></svg></section>`;
  },
  bike(d, c, h, dy, hi){
    const idx = []; for(let i = hi; i < hi + 14 && i < h.time.length; i++) idx.push(i);
    const sc = idx.map(i => bikeScore(h, i)); let best = 0, bestV = -1;
    for(let k = 0; k < sc.length - 1; k++){ const hr = +h.time[idx[k]].slice(11, 13); if(hr < 6 || hr > 22) continue; const v = (sc[k] + sc[k + 1]) / 2 - (h.is_day[idx[k]] === 0 ? 1 : 0); if(v > bestV){ bestV = v; best = k; } }
    if(bestV < 0) return "";
    const col = s => `hsl(${s * 12},85%,55%)`, now = sc[0];
    const txt = bestV >= 7 ? `Beste fietsmoment: ${hm(h.time[idx[best]])}–${hm(h.time[idx[best] + 2] || h.time[idx[best] + 1])} (${R((sc[best] + sc[best + 1]) / 2)}/10).`
      : bestV >= 4 ? `Matig fietsweer. Het minst slecht: ${hm(h.time[idx[best]])}–${hm(h.time[idx[best] + 2] || h.time[idx[best] + 1])}.` : "De komende uren geen goed fietsweer.";
    return `<section class="card" id="c-bike">${H2('<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l4-8h5l4 8M9.5 9L8 6h3M14.5 9l-3 8"/>', "Fietsweer")}
      <div style="display:flex;align-items:baseline;gap:10px"><div class="score">${now}<span style="font-size:14px;color:var(--muted)">/10</span></div><div style="font-size:14px">nu · ${now >= 8 ? "prima" : now >= 6 ? "redelijk" : now >= 4 ? "matig" : "slecht"}</div></div>
      <div class="note" style="margin:6px 0 4px;padding:0">${esc(txt)}</div>
      <div class="bike">${sc.map((s, k) => `<div class="${k === best || k === best + 1 ? "best" : ""}" style="height:${10 + s * 9}%;background:${col(s)};box-shadow:0 0 8px ${col(s)}"></div>`).join("")}</div>
      <div class="bikeax">${idx.map((i, k) => `<span>${k % 2 ? "" : (k ? h.time[i].slice(11, 13) : "nu")}</span>`).join("")}</div></section>`;
  },
  days(d, c, h, dy){
    const lo = Math.min(...dy.temperature_2m_min), top = Math.max(...dy.temperature_2m_max), span = Math.max(1, top - lo);
    return `<section class="card" id="c-days">${H2('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>', "10-daagse verwachting")}` + dy.time.map((t, i) => {
      const a = (dy.temperature_2m_min[i] - lo) / span * 100, b = (dy.temperature_2m_max[i] - lo) / span * 100, p = dy.precipitation_probability_max[i];
      const dot = i === 0 ? `<b style="left:${Math.min(100, Math.max(0, (c.temperature_2m - lo) / span * 100))}%"></b>` : "";
      const det = `${wmo(dy.weather_code[i])[0]} · ${(dy.precipitation_sum[i] || 0).toFixed(1)} mm · wind ${dirName(dy.wind_direction_10m_dominant[i])} ${wind(dy.wind_speed_10m_max[i])} · UV ${R(dy.uv_index_max[i] || 0)} · zon ${hm(dy.sunrise[i])}–${hm(dy.sunset[i])}`;
      return `<div class="day"><div class="d">${dayName(t, i)}</div><div class="ic">${icon(dy.weather_code[i], 1)}</div><div class="p">${p >= 20 ? R(p / 10) * 10 + "%" : ""}</div><div class="lo">${R(dy.temperature_2m_min[i])}°</div><div class="range"><i style="left:${a}%;width:${Math.max(4, b - a)}%;animation-delay:${i * 60}ms"></i>${dot}</div><div class="hi">${R(dy.temperature_2m_max[i])}°</div><div class="daydetail">${det}</div></div>`;
    }).join("") + "</section>";
  },
  tiles(d, c, h, dy, hi){
    const aq = d.aq, uv = h.uv_index[hi] || 0, vis = h.visibility[hi], feels = R(c.apparent_temperature), tmp = R(c.temperature_2m);
    const nextRain = (() => { for(let i = 1; i < dy.time.length; i++) if((dy.precipitation_sum[i] || 0) >= 1) return i; return -1; })();
    const sunUp = c.time < dy.sunrise[0] ? dy.sunrise[0] : c.time < dy.sunset[0] ? null : dy.sunrise[1];
    const mins = iso => +iso.slice(11, 13) * 60 + +iso.slice(14, 16), dlen = mins(dy.sunset[0]) - mins(dy.sunrise[0]), rot = (c.wind_direction_10m + 180) % 360;
    const tile = (title, svg, body) => `<section class="card">${H2(svg, title)}${body}</section>`;
    let t = "";
    t += tile("Voelt als", '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>', `<div class="big">${feels}°</div><div class="note">${feels < tmp - 1 ? (c.wind_speed_10m >= 10 ? "Voelt kouder door de wind." : "Voelt kouder door de droge lucht.") : feels > tmp + 1 ? (c.is_day && c.cloud_cover < 60 ? "Voelt warmer door zon en weinig wind." : "Voelt warmer door de vochtige lucht.") : "Voelt zoals de echte temperatuur."}</div>`);
    t += tile("Wind", '<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h9"/>', `<div class="compass"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.25)"/>
      ${[0, 90, 180, 270].map((a, i) => `<text x="${50 + 38 * Math.sin(a * Math.PI / 180)}" y="${53 - 38 * Math.cos(a * Math.PI / 180)}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.7)" font-weight="600">${"NOZW"[i]}</text>`).join("")}
      <g transform="rotate(${rot} 50 50)"><path d="M50 12 L55 24 L50 21 L45 24 Z" fill="#fff"/><line x1="50" y1="22" x2="50" y2="82" stroke="#fff" stroke-width="2"/><circle cx="50" cy="84" r="3" fill="none" stroke="#fff" stroke-width="2"/></g><circle cx="50" cy="50" r="22" fill="#0b1422"/></svg>
      <div class="c"><b>${S.wind === "bft" ? bft(c.wind_speed_10m) : S.wind === "kmh" ? R(c.wind_speed_10m) : R(c.wind_speed_10m / 3.6)}</b><span>${S.wind === "bft" ? "Bft" : S.wind === "kmh" ? "km/u" : "m/s"}</span></div></div>
      <div class="note">${dirName(c.wind_direction_10m)} · ${R(c.wind_speed_10m)} km/u<br>Stoten ${R(c.wind_gusts_10m)} km/u</div>`);
    t += tile("Neerslag", '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', `<div class="big">${(dy.precipitation_sum[0] || 0).toFixed(1)} mm</div><div class="sub">vandaag</div><div class="note">${nextRain < 0 ? "Daarna geen noemenswaardige regen in de komende 10 dagen." : nextRain === 1 ? `Morgen ${dy.precipitation_sum[1].toFixed(1)} mm verwacht.` : `Volgende regen: ${dayName(dy.time[nextRain], nextRain).toLowerCase()} (${dy.precipitation_sum[nextRain].toFixed(1)} mm).`}</div>`);
    t += tile("UV-index", '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', `<div class="big">${R(uv)}</div><div class="sub">${uvTxt(uv)}</div><div class="meter uvm"><b style="left:${Math.min(100, uv / 11 * 100)}%"></b></div><div class="note">Vandaag max ${R(dy.uv_index_max[0] || 0)}.</div>`);
    t += tile(sunUp ? "Zonsopkomst" : "Zonsondergang", '<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>', `<div class="big">${hm(sunUp || dy.sunset[0])}</div><div class="note">${sunUp ? "Zonsondergang " + hm(dy.sunset[0] > c.time ? dy.sunset[0] : dy.sunset[1]) : "Zonsopkomst morgen " + hm(dy.sunrise[1])}<br>Daglicht ${Math.floor(dlen / 60)}u ${pad(R(dlen % 60))}m</div>`);
    t += tile("Vochtigheid", '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 15h6"/>', `<div class="big">${R(c.relative_humidity_2m)}%</div><div class="note">Dauwpunt is nu ${R(c.dew_point_2m)}°.</div>`);
    t += tile("Zicht", '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>', `<div class="big">${vis == null ? "–" : vis >= 10000 ? R(vis / 1000) + " km" : (vis / 1000).toFixed(1) + " km"}</div><div class="note">${vis == null ? "" : vis < 1000 ? "Mist. Let op in het verkeer." : vis < 5000 ? "Heiig of nevelig." : "Goed zicht."}</div>`);
    t += tile("Luchtdruk", '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-4"/>', `<div class="big">${R(c.pressure_msl)}</div><div class="sub">hPa</div><div class="note">${c.pressure_msl < 1000 ? "Lage druk: wisselvallig." : c.pressure_msl > 1020 ? "Hoge druk: stabiel weer." : "Normale luchtdruk."}</div>`);
    if(aq && aq.european_aqi != null){
      const pol = Math.max(aq.grass_pollen || 0, aq.birch_pollen || 0);
      t += tile("Luchtkwaliteit", '<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3"/>', `<div class="big">${R(aq.european_aqi)}</div><div class="sub">${aqTxt(aq.european_aqi)}</div><div class="meter aqm"><b style="left:${Math.min(100, aq.european_aqi)}%"></b></div><div class="note">Fijnstof ${R(aq.pm2_5 || 0)} µg/m³${pol >= 10 ? " · pollen " + (pol >= 50 ? "veel" : "matig") : ""}</div>`);
      t += tile("Bewolking", '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>', `<div class="big">${R(c.cloud_cover)}%</div><div class="note">${c.cloud_cover < 20 ? "Vrijwel onbewolkt." : c.cloud_cover < 70 ? "Wisselend bewolkt." : "Grotendeels bewolkt."}</div>`);
    }
    return `<div class="grid" id="c-tiles">${t}</div>`;
  }
};

function wireRain(rp, spans){
  const chart = $("rainChart"), pick = $("rainPick"); if(!chart) return;
  const {pts} = rp, n = pts.length;
  const show = ev => {
    const r = chart.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.floor((ev.clientX - r.left) / r.width * n)));
    chart.querySelectorAll(".bar.sel").forEach(b => b.classList.remove("sel")); chart.querySelectorAll(".bar")[i].classList.add("sel");
    const p = pts[i], end = i + 1 < n ? pts[i + 1].time : "";
    pick.textContent = `${i === 0 ? "Nu" : p.time}${end ? "–" + end : ""} · ` + (p.mm < .05 ? "droog" : `${p.mm.toFixed(1).replace(".", ",")} mm/u (${rainKind(p.mm)})`);
  };
  chart.onpointerdown = show; chart.onpointermove = e => { if(e.pointerType !== "mouse" || e.buttons) show(e); };
}
document.addEventListener("click", e => {
  const w = e.target.closest(".warn,.day"); if(w) w.classList.toggle("open");
});

/* =========================================================
   Radar
   ========================================================= */
let map, me, frames = [], layers = {}, fi = 0, timer = null, radarSrc = "", radarVisible = false, userStopped = false;
const PLAY = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
const BRURL = "https://image.buienradar.nl/2.0/metadata/sprite/RadarMapRainWebMercatorNL?width=1058&height=915&history=12&forecast=24&skip=0";
const BR_BOUNDS = [[54.8, 0], [49.5, 10]], inNL = (lat, lon) => lat > 49.8 && lat < 54.5 && lon > .5 && lon < 9.5;
async function initRadar(lat, lon){
  if(typeof L === "undefined"){ $("radarCard").classList.add("hidden"); return; }
  const nl = inNL(lat, lon);
  if(!map){
    map = L.map("map", {zoomControl:false, attributionControl:true, scrollWheelZoom:false}).setView([lat, lon], nl ? 9 : 7);
    L.tileLayer(ESRI + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {attribution:"Esri", maxZoom:13}).addTo(map);
    map.createPane("labels"); map.getPane("labels").style.zIndex = 450; map.getPane("labels").style.pointerEvents = "none";
    L.tileLayer(ESRI + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {pane:"labels", maxZoom:13}).addTo(map);
    me = L.marker([lat, lon], {icon:L.divIcon({className:"", html:'<div class="me"></div>', iconSize:[14, 14], iconAnchor:[7, 7]}), pane:"labels"}).addTo(map);
    $("radarPlay").innerHTML = PLAY;
    $("radarPlay").onclick = () => { if(timer){ stop(); userStopped = true; } else { userStopped = false; play(); } };
    $("radarSlider").oninput = e => { stop(); userStopped = true; show(+e.target.value); };
    $("radarFs").onclick = () => { $("radarWrap").classList.toggle("full"); setTimeout(() => map.invalidateSize(), 50); };
    new IntersectionObserver(es => es.forEach(e => {
      radarVisible = e.isIntersecting;
      if(radarVisible && !userStopped && !timer && frames.length) play(); else if(!radarVisible && timer){ stop(); userStopped = false; }
    }), {threshold:.6}).observe($("radarWrap"));
  }else{ map.setView([lat, lon], map.getZoom()); me.setLatLng([lat, lon]); }
  setTimeout(() => map.invalidateSize(), 100);
  try{
    let fresh, now = 0;
    if(nl){
      const j = await get(BRURL, 8000), nowT = Date.parse(j.stilltimestamp + "Z");
      fresh = (j.times || []).filter((t, i) => i % 2 === 0 || Date.parse(t.timestamp + "Z") === nowT).map(t => ({time:Date.parse(t.timestamp + "Z") / 1000, url:t.url, fc:Date.parse(t.timestamp + "Z") > nowT}));
      now = fresh.findIndex(f => f.time * 1000 === nowT); if(now < 0) now = fresh.filter(f => !f.fc).length - 1;
    }else{
      const j = await get("https://api.rainviewer.com/public/weather-maps.json", 8000);
      fresh = (j.radar.past || []).map(f => ({time:f.time, url:`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, tiles:true})); now = fresh.length - 1;
    }
    if(!fresh.length) return;
    stop(); Object.values(layers).forEach(l => map.removeLayer(l)); layers = {};
    frames = fresh; radarSrc = nl ? "Buienradar" : "RainViewer"; $("radarSlider").max = frames.length - 1; show(now);
    if(radarVisible && !userStopped) play();
  }catch(e){}
}
function layer(i){
  if(!layers[i]){ const f = frames[i];
    layers[i] = f.tiles ? L.tileLayer(f.url, {opacity:0, maxNativeZoom:7, maxZoom:13, attribution:"RainViewer"}).addTo(map) : L.imageOverlay(f.url, BR_BOUNDS, {opacity:0, attribution:"Buienradar"}).addTo(map); }
  return layers[i];
}
function show(i){
  if(!frames.length) return; if(layers[fi]) layers[fi].setOpacity(0);
  fi = i; layer(fi).setOpacity(.9); $("radarSlider").value = fi;
  const d = new Date(frames[fi].time * 1000); $("radarTime").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
  $("radarSrc").textContent = frames[fi].fc ? "verwachting" : radarSrc; $("radarSrc").style.color = frames[fi].fc ? "#ffd25e" : "";
}
function play(){ frames.forEach((f, i) => layer(i)); $("radarPlay").innerHTML = PAUSE; timer = setInterval(() => show((fi + 1) % frames.length), 450); }
function stop(){ $("radarPlay").innerHTML = PLAY; clearInterval(timer); timer = null; }

/* =========================================================
   Panelen: plaatsen en instellingen
   ========================================================= */
const sheet = (id, on) => { $(id).classList.toggle("open", on); if(on) SFX.swoosh(); };
document.querySelectorAll(".sheet").forEach(s => s.addEventListener("click", e => { if(e.target === s) sheet(s.id, false); }));
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => sheet(b.dataset.close, false));

function openPlaces(){ sheet("places", true); $("search").value = ""; $("results").innerHTML = ""; renderSaved(); }
function renderSaved(){
  $("saved").innerHTML = `<button class="pitem" data-gps="1">${ICON('<path d="M21 3L3 10.5l7.5 3L13.5 21z" fill="currentColor"/>')}<span class="n"><div>Mijn locatie</div><small>Live via gps</small></span></button>` +
    saved.map((p, i) => `<div class="pitem" data-i="${i}"><span class="n"><div>${esc(p.name)}</div><small>${esc(p.region || "")}</small></span><button class="x" data-up="${i}" aria-label="Omhoog"${i ? "" : " disabled"}>▲</button><button class="x" data-del="${i}" aria-label="Verwijderen">✕</button></div>`).join("");
}
$("saved").onclick = e => {
  const del = e.target.closest("[data-del]"), up = e.target.closest("[data-up]");
  if(del){ saved.splice(+del.dataset.del, 1); store.set("weer.saved", saved); renderSaved(); return; }
  if(up){ const i = +up.dataset.up; if(i){ [saved[i - 1], saved[i]] = [saved[i], saved[i - 1]]; store.set("weer.saved", saved); renderSaved(); } return; }
  const it = e.target.closest(".pitem"); if(!it) return;
  goPlace(it.dataset.gps ? 0 : 1 + +it.dataset.i); sheet("places", false);
};
let st;
$("search").oninput = e => {
  clearTimeout(st); const q = e.target.value.trim(); if(q.length < 2){ $("results").innerHTML = ""; return; }
  st = setTimeout(async () => {
    try{
      const res = (await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=nl`)).results || [];
      $("results").innerHTML = res.length ? res.map((r, i) => `<button class="pitem" data-r="${i}"><span class="n"><div>${esc(r.name)}</div><small>${esc([r.admin1, r.country].filter(Boolean).join(", "))}</small></span><span>＋</span></button>`).join("") : '<div class="pitem"><span class="n"><small>Niets gevonden</small></span></div>';
      $("results").onclick = ev => {
        const b = ev.target.closest("[data-r]"); if(!b) return; const r = res[+b.dataset.r];
        const p = {name:r.name, region:[r.admin1, r.country].filter(Boolean).join(", "), lat:r.latitude, lon:r.longitude};
        let i = saved.findIndex(s => Math.abs(s.lat - p.lat) < .01 && Math.abs(s.lon - p.lon) < .01);
        if(i < 0){ saved.push(p); store.set("weer.saved", saved); i = saved.length - 1; }
        goPlace(1 + i); sheet("places", false);
      };
    }catch(err){ $("results").innerHTML = '<div class="pitem"><span class="n"><small>Zoeken lukt nu niet</small></span></div>'; }
  }, 300);
};
function goPlace(i){
  const list = places(); i = (i + list.length) % list.length;
  current = i === 0 ? (current && current.gps ? current : {gps:true}) : {...list[i], gps:false};
  if(i === 0 && current.lat == null) current = null;
  store.set("weer.active", current); load();
}

/* ---------- vegen tussen plaatsen ---------- */
(() => {
  const hero = $("hero"); let x0 = null, y0 = 0, dx = 0, lock = null;
  hero.addEventListener("touchstart", e => { if(places().length < 2) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; hero.classList.remove("swipe"); }, {passive:true});
  hero.addEventListener("touchmove", e => {
    if(x0 === null) return; dx = e.touches[0].clientX - x0; const dy = e.touches[0].clientY - y0;
    if(!lock) lock = Math.abs(dx) > 12 ? "x" : Math.abs(dy) > 12 ? "y" : null;
    if(lock === "x"){ hero.style.transform = `translateX(${dx * .6}px)`; hero.style.opacity = 1 - Math.min(.6, Math.abs(dx) / 400); }
  }, {passive:true});
  hero.addEventListener("touchend", () => {
    if(x0 === null) return; x0 = null; hero.classList.add("swipe");
    if(lock === "x" && Math.abs(dx) > 70){
      const dir = dx < 0 ? 1 : -1; hero.style.transform = `translateX(${-dir * 120}px)`; hero.style.opacity = 0; SFX.swoosh();
      setTimeout(() => { hero.classList.remove("swipe"); hero.style.transform = `translateX(${dir * 120}px)`; goPlace(placeIndex() + dir);
        requestAnimationFrame(() => { hero.classList.add("swipe"); hero.style.transform = ""; hero.style.opacity = ""; }); }, 220);
    }else{ hero.style.transform = ""; hero.style.opacity = ""; }
  });
})();

/* ---------- instellingen ---------- */
const sw = (key, on, label, sub) => `<div class="row"><div class="n">${label}${sub ? `<small>${sub}</small>` : ""}</div><button class="sw${on ? " on" : ""}" data-sw="${key}" aria-label="${label}"></button></div>`;
function renderSettings(){
  const f = S.fx, ph = pushSupported();
  let h = `<div class="label">Effecten</div>` +
    sw("fx.bg", f.bg, "Weer-animaties", "Regen, sneeuw, bliksem, sterren, raster") +
    sw("fx.touch", f.touch, "Aanraak-effecten", "Vonken, rimpels, kantelen, sonar, paraplu") +
    sw("fx.hud", f.hud, "HUD", "Ring, projectiestraal, scanlijnen, datastromen") +
    sw("fx.cards", f.cards, "Kaart-animaties", "Invliegen, glans, decoderen, typen") +
    sw("fx.boot", f.boot, "Opstartscherm") +
    `<div class="label">Geluid</div>` + sw("sound", S.sound, "Sci-fi geluiden") +
    `<div class="label">Eenheden</div><div class="row"><div class="n">Windsnelheid</div><div class="seg">${[["bft", "Bft"], ["kmh", "km/u"], ["ms", "m/s"]].map(([k, l]) => `<button data-wind="${k}" class="${S.wind === k ? "on" : ""}">${l}</button>`).join("")}</div></div>` +
    `<div class="label">Kaarten</div><div class="ptext">Zet kaarten aan/uit en verander de volgorde met de pijltjes.</div>` +
    S.order.map((k, i) => `<div class="row"><div class="mv"><button data-mv="${i}" data-d="-1"${i ? "" : " disabled"}>▲</button><button data-mv="${i}" data-d="1"${i < S.order.length - 1 ? "" : " disabled"}>▼</button></div><div class="n">${CARDS[k]}</div><button class="sw${S.hidden.includes(k) ? "" : " on"}" data-card="${k}"></button></div>`).join("") +
    `<div class="label">Meldingen</div>`;
  if(ph){
    h += sw("push.on", S.push.on, "Meldingen aan", "Ook als de app dicht is") +
      (S.push.on ? sw("push.rain", S.push.rain, "Regen binnen ±15 minuten") + sw("push.warn", S.push.warn, "Weerwaarschuwingen (code geel/oranje/rood)") +
      `<div class="row"><div class="n">Stil tussen</div><input type="time" id="qf" value="${S.push.quietFrom}"> – <input type="time" id="qt" value="${S.push.quietTo}"></div>` : "") +
      `<div class="ptext">Meldingen gaan over je laatst bekende locatie (of de gekozen plaats als je geen gps gebruikt).</div>`;
  }else h += `<div class="ptext">${pushHost ? "Je telefoon of browser ondersteunt hier geen meldingen. Installeer de app via ⋮ → App installeren en probeer het opnieuw." : "Meldingen werken in de nieuwe versie op weer-jasper.web.app."}</div>`;
  h += `<div class="label">App</div><div class="row"><div class="n">Installeren op je telefoon<small>Als app met eigen icoon</small></div><button class="btn" id="inst">INSTALLEER</button></div>
    <div class="ptext">Geheimpje: tik 5× snel op de plaatsnaam 😉</div>`;
  $("settingsBody").innerHTML = h;
  $("inst").style.display = installEv ? "" : "none";
  $("inst").onclick = async () => { if(!installEv) return; installEv.prompt(); await installEv.userChoice; installEv = null; renderSettings(); };
  const qf = $("qf"), qt = $("qt");
  if(qf){ qf.onchange = () => { S.push.quietFrom = qf.value; save(); syncPush(current || {}, true); }; qt.onchange = () => { S.push.quietTo = qt.value; save(); syncPush(current || {}, true); }; }
}
$("settingsBody").addEventListener("click", async e => {
  const s = e.target.closest("[data-sw]"), c = e.target.closest("[data-card]"), m = e.target.closest("[data-mv]"), w = e.target.closest("[data-wind]");
  if(s){
    const [a, b] = s.dataset.sw.split(".");
    if(s.dataset.sw === "push.on"){
      try{ if(S.push.on) await disablePush(); else{ if(!current || current.lat == null) throw new Error("Nog geen locatie bekend"); await enablePush(current); FX.toast("Meldingen staan aan", true); } }
      catch(err){ FX.toast(err.message, true); }
      renderSettings(); return;
    }
    if(b){ S[a][b] = !S[a][b]; } else S[a] = !S[a];
    save(); if(a === "push") syncPush(current || {}, true); if(a === "sound" && S.sound){ unlock(true); setTimeout(() => SFX.blip(1600, .08), 60); }
    if(a === "fx") FX.restart();
    renderSettings(); return;
  }
  if(c){ const k = c.dataset.card; S.hidden = S.hidden.includes(k) ? S.hidden.filter(x => x !== k) : [...S.hidden, k]; save(); renderSettings(); if(lastData) render(lastData); return; }
  if(m){ const i = +m.dataset.mv, j = i + +m.dataset.d; [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; save(); renderSettings(); if(lastData) render(lastData); return; }
  if(w){ S.wind = w.dataset.wind; save(); renderSettings(); if(lastData) render(lastData); }
});
let installEv = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEv = e; });

/* ---------- knoppen, vernieuwen, trekken ---------- */
$("btnPlaces").onclick = openPlaces;
$("btnSettings").onclick = () => { renderSettings(); sheet("settings", true); };
$("btnRefresh").onclick = () => { FX.warp(); load(); };
$("temp").addEventListener("pointerdown", () => FX.shock($("hero"), $("temp")));
let taps = [];
$("place").addEventListener("click", () => { const t = Date.now(); taps = taps.filter(x => t - x < 2000); taps.push(t); if(taps.length >= 5){ taps = []; FX.turbo(); } });
(() => {
  let y0 = null, dy = 0; const ptr = $("ptr");
  const set = (d, o) => { ptr.style.transform = `translateY(${d - 60}px) rotate(${d * 3}deg)`; ptr.style.opacity = o; };
  addEventListener("touchstart", e => { y0 = (scrollY <= 0 && !document.querySelector(".sheet.open") && !e.target.closest("#radarWrap,.hours,#hero")) ? e.touches[0].clientY : null; dy = 0; }, {passive:true});
  addEventListener("touchmove", e => { if(y0 === null) return; dy = Math.max(0, Math.min(110, (e.touches[0].clientY - y0) * .5)); ptr.style.transition = "none"; set(dy, Math.min(1, dy / 60)); }, {passive:true});
  addEventListener("touchend", async () => {
    if(y0 === null) return; y0 = null; ptr.style.transition = "transform .25s, opacity .25s";
    if(dy >= 60){ set(60, 1); ptr.classList.add("spin"); FX.warp(); await load(); ptr.classList.remove("spin"); }
    set(0, 0);
  });
})();

/* ---------- start ---------- */
apply();
if(location.hostname.endsWith("github.io")){ // oude adres: wijs naar de nieuwe versie
  const n = document.createElement("a"); n.href = "https://weer-jasper.web.app/"; n.className = "btn";
  n.style.cssText = "display:block;text-align:center;margin:10px 0 0;text-decoration:none";
  n.textContent = "➜ NIEUWE VERSIE MET MELDINGEN: WEER-JASPER.WEB.APP"; document.querySelector(".topbar").after(n);
}
FX.init({hero:$("hero"), temp:$("temp"), solar:$("solar"), onShake:() => { FX.warp(); load(); }});
FX.boot("Jasper");
onChange(() => {});
const last = store.get("weer.last", null);
if(last && current && last.place && last.place.lat === current.lat) render(last, true);
load();
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible" && Date.now() - lastLoad > 5 * 60 * 1000) load(); });
setInterval(() => { if(document.visibilityState === "visible") load(); }, 10 * 60 * 1000);
if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
