// =========================================================
//  Effectenmotor – alles wat beweegt, op één plek
// =========================================================
import {S, reduceMotion as RM} from "./settings.js";
import {SFX} from "./sound.js";

const $ = id => document.getElementById(id), root = document.documentElement;
const rnd = (a, b) => a + Math.random() * (b - a);
const vib = p => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };
let NR = "56,243,255";

/* ---------- kleur volgt temperatuur ---------- */
const STOPS = [[-10,[200,90,80],[230,90,70]],[0,[190,100,62],[250,95,70]],[10,[184,100,61],[272,100,71]],[17,[160,100,58],[190,100,60]],[23,[45,100,60],[15,100,60]],[30,[350,100,62],[310,100,60]]];
function hsl2rgb(h, s, l){ s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map(x => Math.round(x * 255)); }
const FIXED = {cyan:[[186,100,60],[200,100,72]], green:[[150,90,55],[165,90,70]], orange:[[30,100,58],[42,100,70]], purple:[[270,90,68],[285,90,78]]};
function hue(t){
  if(FIXED[S.accent]){ const [a, b] = FIXED[S.accent].map(x => hsl2rgb(...x)); NR = a.join(","); root.style.setProperty("--nr", NR); root.style.setProperty("--nr2", b.join(",")); return; }
  let i = 0; while(i < STOPS.length - 2 && t > STOPS[i + 1][0]) i++;
  const [t0, a0, b0] = STOPS[i], [t1, a1, b1] = STOPS[i + 1], k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  const mix = (x, y) => { let dh = y[0] - x[0]; if(dh > 180) dh -= 360; if(dh < -180) dh += 360; return [(x[0] + dh * k + 360) % 360, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]; };
  const m1 = mix(a0, a1), n1 = hsl2rgb(...m1), n2 = S.fx.show ? hsl2rgb(...mix(b0, b1)) : hsl2rgb((m1[0] + 18) % 360, m1[1], Math.min(80, m1[2] + 14));
  NR = n1.join(","); root.style.setProperty("--nr", NR); root.style.setProperty("--nr2", n2.join(","));
}

/* =========================================================
   1. Achtergrond-canvas: regen, onweer, sneeuw, mist, sterren, zon
   ========================================================= */
const BG = (() => {
  const cv = $("fx"), ctx = cv.getContext("2d"), flash = $("flash");
  let W, H, parts = [], mode = "clear", day = true, heavy = false, wind = [10, 240], last = 0, bolt = null, nextBolt = 0, shoot = null, running = false, touch = null;
  function size(){ const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener("resize", size); size();
  const windX = () => -Math.sin(wind[1] * Math.PI / 180) * Math.min(.9, .08 + wind[0] / 45);
  const wet = () => mode === "rain" || mode === "storm";
  function spawn(init){
    const p = {x:rnd(0, W), y:init ? rnd(0, H) : -20, z:rnd(.3, 1)};
    if(wet()){ p.v = rnd(12, 20) * p.z; p.l = rnd(10, 22) * p.z; }
    else if(mode === "snow"){ p.v = rnd(.4, 1.3) * p.z; p.r = rnd(1, 3.2) * p.z; p.ph = rnd(0, 6.3); }
    else if(mode === "fog"){ p.r = rnd(120, 260); p.v = rnd(.1, .35); p.y = rnd(0, H); p.x = init ? rnd(-200, W) : -260; }
    else if(!day && mode === "clear"){ p.y = rnd(0, H * .7); p.r = rnd(.4, 1.6); p.ph = rnd(0, 6.3); p.sp = rnd(.5, 2); }
    else { p.v = rnd(.15, .5) * p.z; p.r = rnd(.8, 2.4) * p.z; p.ph = rnd(0, 6.3); if(!init) p.y = H + 10; }
    return p;
  }
  function make(){
    const n = wet() ? (heavy ? 260 : 150) : mode === "snow" ? 120 : mode === "fog" ? 14 : (!day && mode === "clear") ? 140 : 50;
    parts = Array.from({length:n}, () => spawn(true));
  }
  function shield(p, R, k){ if(!touch || !S.fx.touch) return; const dx = p.x - touch.x, dy = p.y - touch.y, d = Math.hypot(dx, dy);
    if(d < R && d > .1){ const f = (R - d) / R * k; p.x += dx / d * f; p.y += dy / d * f * (dy < 0 ? .4 : 1); } }
  function frame(ts){
    if(!S.fx.bg || document.hidden){ ctx.clearRect(0, 0, W, H); running = false; return; }
    const dt = Math.min(3, (ts - last) / 16.7 || 1); last = ts;
    ctx.clearRect(0, 0, W, H);
    if(wet()){
      const sl = windX(); ctx.lineCap = "round";
      for(const p of parts){
        ctx.strokeStyle = `rgba(120,240,255,${.25 + .45 * p.z})`; ctx.lineWidth = p.z * 1.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * sl, p.y - p.l); ctx.stroke();
        p.y += p.v * dt; p.x += p.v * sl * dt; shield(p, 95, 14);
        if(p.y > H){
          if(p.z > .75){ ctx.strokeStyle = "rgba(120,240,255,.5)"; ctx.beginPath(); ctx.ellipse(p.x, H - 4, 6 * p.z, 1.5, 0, 0, 6.3); ctx.stroke(); }
          Object.assign(p, spawn(false)); p.x = rnd(-80, W + 80); if(p.x < 0 && sl < 0) p.x += W; if(p.x > W && sl > 0) p.x -= W;
        }
      }
      if(touch && S.fx.touch){ ctx.strokeStyle = `rgba(${NR},.7)`; ctx.lineWidth = 2; ctx.shadowColor = `rgb(${NR})`; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(touch.x, touch.y, 80, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.shadowBlur = 0; }
      if(mode === "storm"){
        if(ts > nextBolt){
          const pts = [[rnd(W * .2, W * .8), 0]]; while(pts[pts.length - 1][1] < H * rnd(.45, .7)){ const [x, y] = pts[pts.length - 1]; pts.push([x + rnd(-40, 40), y + rnd(20, 50)]); }
          bolt = {pts, t:0}; nextBolt = ts + rnd(4000, 11000);
          flash.classList.remove("on"); void flash.offsetWidth; flash.classList.add("on"); SFX.thunder();
          setTimeout(() => { document.body.classList.add("shake"); vib([30, 40, 60]); setTimeout(() => document.body.classList.remove("shake"), 600); }, rnd(300, 1200));
        }
        if(bolt){ bolt.t += dt; const a = Math.max(0, 1 - bolt.t / 18);
          ctx.strokeStyle = `rgba(220,240,255,${a})`; ctx.lineWidth = 2.5; ctx.shadowColor = "#9fd8ff"; ctx.shadowBlur = 20;
          ctx.beginPath(); bolt.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.shadowBlur = 0;
          if(a <= 0) bolt = null; }
      }
    }else if(mode === "snow"){
      const wx = windX();
      for(const p of parts){
        p.ph += .02 * dt; p.y += p.v * dt; p.x += (Math.sin(p.ph) * .5 + wx * 2) * dt;
        if(p.x > W + 10) p.x = -10; if(p.x < -10) p.x = W + 10; shield(p, 110, 6);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3); g.addColorStop(0, "rgba(230,250,255,.95)"); g.addColorStop(1, "rgba(56,243,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, 6.3); ctx.fill();
        if(p.y > H + 10) Object.assign(p, spawn(false));
      }
    }else if(mode === "fog"){
      for(const p of parts){
        p.x += p.v * dt; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, "rgba(160,220,240,.10)"); g.addColorStop(1, "rgba(160,220,240,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
        if(p.x - p.r > W) Object.assign(p, spawn(false));
      }
    }else if(!day && mode === "clear"){
      for(let b = 0; b < 3; b++){ // noorderlicht
        const y0 = H * (.12 + b * .07), g = ctx.createLinearGradient(0, y0 - 60, 0, y0 + 90);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(.5, b === 1 ? "rgba(178,107,255,.13)" : "rgba(60,255,180,.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H * .5);
        for(let x = 0; x <= W; x += 12) ctx.lineTo(x, y0 + Math.sin(x / 90 + ts / 2200 + b * 2) * 26 + Math.sin(x / 37 + ts / 1300) * 8);
        ctx.lineTo(W, y0 + 140); ctx.lineTo(0, y0 + 140); ctx.fill();
      }
      for(const p of parts){ p.ph += .03 * p.sp * dt; ctx.fillStyle = `rgba(210,245,255,${.25 + .6 * Math.abs(Math.sin(p.ph))})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
      if(!shoot && Math.random() < .002 * dt) shoot = {x:rnd(W * .3, W), y:rnd(0, H * .3), t:0};
      if(shoot){ shoot.t += dt; const L = 90, x = shoot.x - shoot.t * 9, y = shoot.y + shoot.t * 4, a = Math.max(0, 1 - shoot.t / 40);
        const g = ctx.createLinearGradient(x, y, x + L, y - L * .45); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(56,243,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y - L * .45); ctx.stroke(); if(a <= 0) shoot = null; }
    }else{
      if(mode === "clear" && day){ const g = ctx.createRadialGradient(W * .85, H * .06, 0, W * .85, H * .06, W * .7); g.addColorStop(0, "rgba(255,230,160,.22)"); g.addColorStop(.3, `rgba(${NR},.06)`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      for(const p of parts){
        p.ph += .02 * dt; p.y -= p.v * dt; p.x += Math.sin(p.ph) * .3 * dt;
        if(touch && S.fx.touch){ const dx = touch.x - p.x, dy = touch.y - p.y, d = Math.hypot(dx, dy); if(d < 220 && d > 1){ p.x += dx / d * 1.6 * dt; p.y += dy / d * 1.6 * dt; } }
        ctx.fillStyle = `rgba(${NR},${.25 + .35 * Math.abs(Math.sin(p.ph))})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
        if(p.y < -10) Object.assign(p, spawn(false));
      }
    }
    requestAnimationFrame(frame);
  }
  function start(){ if(!running && !RM && S.fx.bg){ running = true; last = 0; requestAnimationFrame(frame); } }
  document.addEventListener("visibilitychange", () => { if(!document.hidden) start(); });
  document.addEventListener("pointerdown", e => { touch = {x:e.clientX, y:e.clientY}; }, {passive:true});
  document.addEventListener("pointermove", e => { if(touch) touch = {x:e.clientX, y:e.clientY}; }, {passive:true});
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, () => { touch = null; }, {passive:true}));
  return {
    start,
    set(k, isDay, code, w){ if(w) wind = w; const key = k + isDay + [65,67,82,95,96,99].includes(code);
      if(key !== mode + day + heavy || !parts.length){ mode = k; day = !!isDay; heavy = [65,67,82,95,96,99].includes(code); nextBolt = performance.now() + 2500; make(); } start(); }
  };
})();

/* =========================================================
   2. Voorgrond-canvas: vonken van je vinger, explosies, warp
   ========================================================= */
const TOP = (() => {
  const cv = $("trail"), ctx = cv.getContext("2d"); let W, H, sparks = [], streaks = [], loop = false;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener("resize", size); size();
  function run(){
    if(loop) return; loop = true;
    const f = () => {
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter";
      sparks = sparks.filter(s => (s.l -= .035) > 0);
      for(const s of sparks){ s.x += s.vx; s.y += s.vy; s.vy += .05; ctx.fillStyle = `hsla(${s.h},100%,65%,${s.l})`; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * s.l + .5, 0, 6.3); ctx.fill(); }
      streaks = streaks.filter(s => (s.l -= .022) > 0);
      for(const s of streaks){ s.d += s.v; s.v *= 1.07; const c = Math.cos(s.a), n = Math.sin(s.a);
        ctx.strokeStyle = `hsla(${s.h},100%,70%,${s.l})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(W / 2 + c * s.d * .7, H * .3 + n * s.d * .7); ctx.lineTo(W / 2 + c * s.d, H * .3 + n * s.d); ctx.stroke(); }
      ctx.globalCompositeOperation = "source-over";
      if(sparks.length || streaks.length) requestAnimationFrame(f); else { ctx.clearRect(0, 0, W, H); loop = false; }
    };
    requestAnimationFrame(f);
  }
  let lastT = 0;
  document.addEventListener("pointermove", e => {
    if(RM || !S.fx.touch || (e.pointerType === "mouse" && !e.buttons) || e.target.closest("#map,.panel")) return;
    const now = performance.now(); if(now - lastT < 16) return; lastT = now;
    for(let i = 0; i < 3; i++) sparks.push({x:e.clientX, y:e.clientY, vx:rnd(-1.2, 1.2), vy:rnd(-1.5, .5), l:1, h:rnd(180, 280)});
    if(sparks.length > 260) sparks.splice(0, sparks.length - 260); run();
  }, {passive:true});
  return {
    spark(x, y, n, sp){ if(RM) return; for(let i = 0; i < n; i++){ const a = rnd(0, 6.3), v = rnd(1, sp); sparks.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, l:1, h:rnd(160, 300)}); } run(); },
    warp(){ if(RM) return; for(let i = 0; i < 140; i++) streaks.push({a:rnd(0, 6.3), d:rnd(5, 40), v:rnd(2, 5), l:1, h:rnd(180, 280)}); run(); }
  };
})();

/* =========================================================
   3. Overlays: scanlijnen, datastromen, vorst, hitte
   ========================================================= */
function overlays(){
  const add = (cls, html) => { const d = document.createElement("div"); d.className = cls; if(html) d.innerHTML = html; document.body.appendChild(d); return d; };
  add("scan");
  const CH = "0123456789°%·+-ABCDEF";
  [["left", 3], ["left", 18], ["right", 3], ["right", 18]].forEach(([side, px], i) => {
    let txt = ""; for(let j = 0; j < 160; j++) txt += CH[Math.random() * CH.length | 0];
    const el = add("stream", `<div style="animation-duration:${14 + i * 5}s">${txt}${txt}</div>`); el.style[side] = px + "px";
  });
  return {frost:add("frost"), heat:add("heat")};
}
let OV;

/* =========================================================
   4. Hero: HUD-ring, projectiestraal, zonnebaan
   ========================================================= */
function heroDeco(hero, temp, solar){
  let ticks = ""; for(let a = 0; a < 360; a += 6) ticks += `<line x1="115" y1="${a % 30 ? 6 : 0}" x2="115" y2="12" transform="rotate(${a} 115 115)"/>`;
  const ring = document.createElement("div"); ring.className = "ring"; ringEl = ring;
  ring.innerHTML = `<svg viewBox="0 0 230 230"><defs><radialGradient id="rg"><stop offset="0" style="stop-color:rgba(var(--nr),.16)"/><stop offset="1" style="stop-color:rgba(var(--nr),0)"/></radialGradient></defs>
    <g class="deco"><g class="r3" style="stroke:rgba(var(--nr),.35)" stroke-width="1">${ticks}</g>
    <circle class="r2" cx="115" cy="115" r="108" fill="none" style="stroke:rgba(var(--nr2),.5)" stroke-width="2" stroke-dasharray="2 10"/></g>
    <circle cx="115" cy="115" r="72" fill="url(#rg)"/><g class="nc"></g></svg>`;
  const beam = document.createElement("div"); beam.className = "beam";
  hero.prepend(beam); hero.prepend(ring);
  const place = () => {
    ring.style.top = (temp.offsetTop + temp.offsetHeight / 2 - 125) + "px";
    const top = temp.offsetTop + temp.offsetHeight * .55; beam.style.top = top + "px"; beam.style.height = Math.max(40, solar.offsetTop - top + 40) + "px";
  };
  new ResizeObserver(place).observe(hero); addEventListener("resize", place); place();
  return ring;
}
let ringEl = null;
// Regenring: 2 uur neerslag als segmenten rond de temperatuur (beginnend bovenaan = nu)
export function nowcast(pts, step){
  if(!ringEl) return; const g = ringEl.querySelector(".nc"), n = pts.length; if(!n){ g.innerHTML = ""; return; }
  const cx = 115, cy = 115, r0 = 78, max = Math.max(2, ...pts.map(p => p.mm)), gap = 1.2, seg = 360 / n;
  const pt = (a, r) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  let h = "";
  pts.forEach((p, i) => {
    const a0 = i * seg + gap / 2, a1 = (i + 1) * seg - gap / 2, wet = p.mm >= .05, len = wet ? 6 + Math.sqrt(p.mm / max) * 14 : 2;
    const [x0, y0] = pt(a0, r0), [x1, y1] = pt(a1, r0), [x2, y2] = pt(a1, r0 + len), [x3, y3] = pt(a0, r0 + len);
    h += `<path d="M${x0} ${y0} A${r0} ${r0} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0 + len} ${r0 + len} 0 0 0 ${x3} ${y3}Z" style="fill:${wet ? "var(--neon)" : "rgba(255,255,255,.14)"}" ${wet ? 'filter="drop-shadow(0 0 3px rgba(var(--nr),.8))"' : ""}><title>${p.time}</title></path>`;
  });
  const lab = (i, txt) => { const [x, y] = pt(i * seg, r0 + 30); return `<text class="lab" x="${x}" y="${y + 3}" text-anchor="middle">${txt}</text>`; };
  const q = Math.round(n / 4);
  h += `<circle cx="${cx}" cy="${cy - r0 - 4}" r="3" fill="#fff"/>` + "" + lab(q, pts[q] ? pts[q].time : "") + lab(3 * q, pts[3 * q] ? pts[3 * q].time : "");
  g.innerHTML = h;
}
export function drawSolar(el, x){
  const mins = s => { const [d, hm] = s.split("T"), [h, m] = hm.split(":"); return Date.parse(d + "T00:00Z") / 60000 + (+h) * 60 + (+m); };
  const rise = mins(x.rise), set = mins(x.set), now = mins(x.now), day = now >= rise && now <= set;
  let k;
  if(day) k = (now - rise) / (set - rise);
  else { const r2 = x.rise2 ? mins(x.rise2) : rise + 1440, from = now > set ? set : set - 1440, to = now > set ? r2 : rise; k = (now - from) / (to - from); }
  k = Math.max(0, Math.min(1, k)); const a = Math.PI * (1 - k), cx = 115 + Math.cos(a) * 100, cy = 66 - Math.sin(a) * 58, hm = s => s.slice(11, 16);
  el.innerHTML = `<svg viewBox="0 0 230 74"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" style="stop-color:rgba(var(--nr),.1)"/><stop offset="${k}" style="stop-color:var(--neon)"/><stop offset="${Math.min(1, k + .001)}" style="stop-color:rgba(255,255,255,.15)"/></linearGradient>
    <radialGradient id="sd"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${day ? "#ffd86b" : "#cfe8ff"}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs>
    <line x1="0" y1="66" x2="230" y2="66" style="stroke:rgba(var(--nr),.3)" stroke-dasharray="2 4"/>
    <path d="M15 66 A100 58 0 0 1 215 66" fill="none" stroke="url(#sg)" stroke-width="2" stroke-dasharray="${day ? "none" : "3 5"}"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="url(#sd)"><animate attributeName="r" values="14;18;14" dur="2.5s" repeatCount="indefinite"/></circle>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/></svg>
    <span class="lab" style="left:0">${day ? "↑ " + hm(x.rise) : "↓ " + hm(x.set)}</span><span class="lab" style="right:0">${day ? "↓ " + hm(x.set) : "↑ " + hm(x.rise2 || x.rise)}</span>`;
}

/* =========================================================
   5. Tekst-effecten: optellen, decoderen, typemachine
   ========================================================= */
const jobs = new WeakMap();
const textFx = () => S.fx.cards && !RM;
export function count(el, to, suffix = "°"){
  const from = el._v == null ? to - 12 : el._v; el._v = to;
  if(!textFx() || from === to){ el.textContent = to + suffix; return; }
  const id = (jobs.get(el) || 0) + 1, t0 = performance.now(); jobs.set(el, id);
  const step = now => { if(jobs.get(el) !== id) return; const k = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix; if(k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const CH = "ABCDEFGHJKLMNOPRSTUVWXYZ0123456789#%&@$<>/";
export function decode(el, text){
  if(!textFx()){ el.textContent = text; return; }
  const id = (jobs.get(el) || 0) + 1; jobs.set(el, id); let f = 0; const total = 18;
  const tick = () => { if(jobs.get(el) !== id) return;
    el.textContent = [...text].map((ch, i) => ch === " " ? " " : i < f / total * text.length ? ch : CH[Math.random() * CH.length | 0]).join("");
    if(++f <= total) setTimeout(tick, 35); else el.textContent = text; };
  tick();
}
export function type(el, text){
  if(!textFx() || el._t === text){ el.textContent = text; el._t = text; return; }
  el._t = text; const id = (jobs.get(el) || 0) + 1; jobs.set(el, id); let i = 0; el.classList.add("caret");
  const t = () => { if(jobs.get(el) !== id) return; i += 2; el.textContent = text.slice(0, i);
    if(i < text.length) setTimeout(t, 18); else { el.textContent = text; setTimeout(() => el.classList.remove("caret"), 1200); } };
  t();
}

/* =========================================================
   6. Kaarten: invliegen, glans, energierand, decoderende koppen
   ========================================================= */
const io = new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return; io.unobserve(e.target); const c = e.target;
  if(S.fx.cards && !RM){ c.classList.add("fxin"); const h = c.querySelector("h2 span"); if(h) decode(h, h.textContent); }
}), {threshold:.08});
document.addEventListener("animationend", e => { if(e.animationName === "fxin") e.target.classList.remove("fxin"); });
export function cards(scope){
  scope.querySelectorAll(".card:not([data-fx])").forEach((c, i) => {
    c.dataset.fx = 1;
    const sh = document.createElement("div"); sh.className = "shine"; sh.style.animationDelay = (i * 1.3 % 9) + "s";
    const en = document.createElement("div"); en.className = "energy"; en.style.animationDelay = (-i * 1.7) + "s";
    c.append(sh, en); c.style.animationDelay = Math.min(i, 6) * 70 + "ms"; io.observe(c);
  });
}
export function coverflow(box){
  const r = box.getBoundingClientRect(), mid = r.left + r.width / 2;
  box.querySelectorAll(".hour").forEach((h, i) => {
    h.querySelector(".ic").style.animationDelay = (i * .18) + "s";
    if(!S.fx.cards || RM){ h.style.transform = ""; h.style.opacity = ""; return; }
    const b = h.getBoundingClientRect(), c = Math.max(-1, Math.min(1, (b.left + b.width / 2 - mid) / (r.width / 2)));
    h.style.transform = `rotateY(${(-c * 35).toFixed(1)}deg) scale(${(1 - Math.abs(c) * .15).toFixed(3)})`; h.style.opacity = (1 - Math.abs(c) * .45).toFixed(2);
  });
}

/* =========================================================
   7. Aanraken: ripple, 3D-kantelen, sonar, verende kaarten
   ========================================================= */
function touchFx(){
  document.addEventListener("pointerdown", e => {
    if(!S.fx.touch || RM) return;
    const host = e.target.closest(".card,.iconbtn,.pitem,.warn,.row,.btn"); if(!host || e.target.closest("#map,.rainchart")) return;
    const r = host.getBoundingClientRect(), d = document.createElement("span");
    d.className = "ripple"; d.style.left = (e.clientX - r.left) + "px"; d.style.top = (e.clientY - r.top) + "px";
    host.appendChild(d); setTimeout(() => d.remove(), 650); vib(8);
  }, {passive:true});
  document.addEventListener("click", e => { if(e.target.closest("button,.card,.day,.pitem,.warn,.row")) SFX.blip(1300 + Math.random() * 400); });

  let tc = null;
  document.addEventListener("pointermove", e => {
    if(!S.fx.touch || RM || (e.pointerType === "mouse" && !e.buttons)) return;
    const c = e.target.closest(".card"); if(!c || c.classList.contains("noskew") || c.classList.contains("fxin")) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.classList.remove("untilt"); c.classList.add("tilt"); tc = c;
    c.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) scale(1.01)`;
  }, {passive:true});
  const untilt = () => { if(!tc) return; const c = tc; tc = null; c.classList.remove("tilt"); c.classList.add("untilt"); c.style.transform = ""; setTimeout(() => c.classList.remove("untilt"), 500); };
  ["pointerup", "pointercancel", "scroll"].forEach(ev => addEventListener(ev, untilt, {passive:true}));

  let lp = null, sx = 0, sy = 0;
  document.addEventListener("pointerdown", e => {
    if(e.target.closest("#map,button,input,.rainchart,.hours,.panel")) return; sx = e.clientX; sy = e.clientY; clearTimeout(lp);
    lp = setTimeout(() => {
      if(!S.fx.touch || RM) return;
      const s = document.createElement("div"); s.className = "sonar"; s.style.left = sx + "px"; s.style.top = sy + "px";
      s.innerHTML = '<b></b><i></i><i style="animation-delay:.25s"></i><i style="animation-delay:.5s"></i>'; document.body.appendChild(s); setTimeout(() => s.remove(), 2100);
      SFX.blip(1046, .09); setTimeout(() => SFX.blip(1046, .04), 500); setTimeout(() => SFX.blip(1046, .02), 1000); vib(30);
    }, 550);
  }, {passive:true});
  const cancel = e => { if(e.type !== "pointermove" || Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(lp); };
  ["pointerup", "pointercancel", "pointermove", "scroll"].forEach(ev => addEventListener(ev, cancel, {passive:true}));

  if(!RM){ let ly = scrollY, sk = 0, raf = 0;
    const tick = () => { sk *= .85; root.style.setProperty("--sk", sk.toFixed(2) + "deg"); if(Math.abs(sk) > .05) raf = requestAnimationFrame(tick); else { root.style.setProperty("--sk", "0deg"); raf = 0; } };
    addEventListener("scroll", () => { const v = scrollY - ly; ly = scrollY; if(!S.fx.cards) return; sk = Math.max(-4, Math.min(4, sk + v * .08)); if(!raf) raf = requestAnimationFrame(tick); }, {passive:true}); }
}

/* ---------- telefoon kantelen = parallax, schudden = callback ---------- */
let ring = null;
function sensors(onShake){
  let lastShake = 0;
  const ori = e => { if(e.gamma == null || !S.fx.bg) return; const x = Math.max(-25, Math.min(25, e.gamma)), y = Math.max(-25, Math.min(25, (e.beta || 45) - 45));
    $("fx").style.transform = `translate(${x * .6}px,${y * .6}px)`; if(ring) ring.style.translate = `${-x * .4}px ${-y * .4}px`; };
  const mot = e => { const a = e.accelerationIncludingGravity || e.acceleration; if(!a) return;
    const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = Date.now();
    if(g > 28 && now - lastShake > 3000){ lastShake = now; vib([20, 30, 20]); onShake(); } };
  const on = () => { addEventListener("deviceorientation", ori); addEventListener("devicemotion", mot); };
  if(typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"){
    document.addEventListener("click", function ask(){ document.removeEventListener("click", ask);
      Promise.all([DeviceOrientationEvent.requestPermission(), DeviceMotionEvent.requestPermission ? DeviceMotionEvent.requestPermission() : "granted"]).then(r => { if(r.includes("granted")) on(); }).catch(() => {}); });
  } else on();
}

/* =========================================================
   8. Losse effecten
   ========================================================= */
export function toast(text, small){ const t = document.createElement("div"); t.className = "toast" + (small ? " small" : ""); t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), small ? 2700 : 1900); }
export function warp(){ TOP.warp(); SFX.warp(); }
export function shock(hero, temp){
  const sh = document.createElement("div"); sh.className = "shock"; hero.appendChild(sh);
  sh.style.left = (temp.offsetLeft + temp.offsetWidth / 2) + "px"; sh.style.top = (temp.offsetTop + temp.offsetHeight / 2) + "px"; setTimeout(() => sh.remove(), 850);
  const r = temp.getBoundingClientRect(); TOP.spark(r.left + r.width / 2, r.top + r.height / 2, 90, 9);
  temp.classList.remove("glitch"); void temp.offsetWidth; temp.classList.add("glitch"); setTimeout(() => temp.classList.remove("glitch"), 500);
  document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 500); vib([15, 20, 40]); SFX.zap();
}
export function turbo(){
  if(root.classList.contains("turbo")) return;
  toast("TURBO MODUS"); root.classList.add("turbo"); vib([40, 40, 40, 40, 120]); SFX.tune();
  let k = 0; const iv = setInterval(() => { TOP.warp(); if(++k >= 6) clearInterval(iv); }, 1500);
  setTimeout(() => root.classList.remove("turbo"), 10000);
}
let alarmed = false;
export function alarm(){ try{ if(sessionStorage.getItem("alarm")) return; sessionStorage.setItem("alarm", "1"); }catch(e){ if(alarmed) return; } alarmed = true; SFX.alarm(); vib([100, 60, 100]); }

export function boot(name){
  let seen = false; try{ seen = sessionStorage.getItem("boot") === "1"; sessionStorage.setItem("boot", "1"); }catch(e){}
  if(seen || RM || !S.fx.boot) return;
  const b = document.createElement("div"); b.id = "boot";
  b.innerHTML = '<div class="logo">WEER//OS</div><div id="bl"></div><div class="bar"><i id="bb"></i></div>'; document.body.appendChild(b);
  const hr = new Date().getHours(), groet = hr < 6 ? "GOEDENACHT" : hr < 12 ? "GOEDEMORGEN" : hr < 18 ? "GOEDEMIDDAG" : "GOEDENAVOND";
  const lines = ["VERBINDING SATELLIET", "LOCATIE TRIANGULEREN", "ATMOSFEER SCANNEN", "NEERSLAGRADAR SYNCEN", "HOLOGRAM LADEN"];
  let i = 0; const out = () => { b.classList.add("out"); setTimeout(() => b.remove(), 500); };
  const next = () => {
    if(!b.isConnected) return;
    if(i < lines.length){ $("bl").insertAdjacentHTML("beforeend", `<div>&gt; ${lines[i]}… <span class="ok">OK</span></div>`); $("bb").style.width = ((i + 1) / lines.length * 100) + "%"; SFX.blip(500 + i * 180, .05); i++; setTimeout(next, rnd(180, 320)); }
    else if(i === lines.length){ i++; $("bl").insertAdjacentHTML("beforeend", `<div class="hi">${groet}${name ? ", " + name.toUpperCase() : ""}</div>`); setTimeout(next, 650); }
    else setTimeout(out, 250);
  };
  setTimeout(next, 250); b.addEventListener("pointerdown", out);
}

/* =========================================================
   Publieke ingang
   ========================================================= */
export function init({hero, temp, solar, onShake}){
  OV = overlays(); ring = heroDeco(hero, temp, solar); touchFx(); sensors(onShake);
}
export function weather({kind, isDay, code, wind, t}){
  hue(t); BG.set(kind, isDay, code, wind);
  OV.frost.classList.toggle("on", t <= 0); OV.heat.classList.toggle("on", t >= 25);
}
export function restart(){ BG.start(); }
