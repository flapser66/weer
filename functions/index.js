// =========================================================
//  WEER//OS server: pushmeldingen voor regen en weerwaarschuwingen
// =========================================================
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions, logger} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const webpush = require("web-push");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({region:"europe-west1", maxInstances:2, memory:"256MiB"});

/* ---------- VAPID-sleutels: worden 1x gemaakt en in de database bewaard ---------- */
let VAPID = null;
async function vapid(){
  if(VAPID) return VAPID;
  const ref = db.doc("config/vapid"), snap = await ref.get();
  if(snap.exists){ VAPID = snap.data(); return VAPID; }
  const k = webpush.generateVAPIDKeys();
  try{ await ref.create(k); VAPID = k; }catch(e){ VAPID = (await ref.get()).data(); }
  return VAPID;
}
const idOf = ep => crypto.createHash("sha256").update(ep).digest("hex").slice(0, 40);
const okEndpoint = ep => typeof ep === "string" && /^https:\/\/[a-z0-9.-]+\//i.test(ep) && ep.length < 1000;
const num = (v, lo, hi) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
const hhmm = v => typeof v === "string" && /^\d\d:\d\d$/.test(v) ? v : null;

/* ---------- API voor de app: /api/vapid, /api/subscribe, /api/unsubscribe ---------- */
exports.api = onRequest({cors:true}, async (req, res) => {
  try{
    const path = req.path.replace(/^\/api/, "");
    if(req.method === "GET" && path === "/vapid") return res.json({key:(await vapid()).publicKey});
    if(req.method !== "POST") return res.status(405).end();
    const b = req.body || {};
    if(path === "/subscribe"){
      const sub = b.sub || {};
      if(!okEndpoint(sub.endpoint) || !sub.keys || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") return res.status(400).json({error:"ongeldig abonnement"});
      if(!num(b.lat, -90, 90) || !num(b.lon, -180, 180)) return res.status(400).json({error:"ongeldige locatie"});
      const p = b.prefs || {};
      await db.collection("subs").doc(idOf(sub.endpoint)).set({
        sub:{endpoint:sub.endpoint, keys:{p256dh:sub.keys.p256dh.slice(0, 200), auth:sub.keys.auth.slice(0, 100)}},
        lat:Math.round(b.lat * 1000) / 1000, lon:Math.round(b.lon * 1000) / 1000,
        name:String(b.name || "je locatie").slice(0, 60),
        prefs:{rain:p.rain !== false, warn:p.warn !== false, quietFrom:hhmm(p.quietFrom) || "23:00", quietTo:hhmm(p.quietTo) || "07:00"},
        updated:Date.now()
      }, {merge:true});
      return res.json({ok:true});
    }
    if(path === "/unsubscribe"){
      if(!okEndpoint(b.endpoint)) return res.status(400).end();
      await db.collection("subs").doc(idOf(b.endpoint)).delete();
      return res.json({ok:true});
    }
    res.status(404).end();
  }catch(e){ logger.error(e); res.status(500).json({error:"serverfout"}); }
});

/* ---------- hulpfuncties ---------- */
const amsNow = () => { const p = new Intl.DateTimeFormat("nl-NL", {timeZone:"Europe/Amsterdam", hour:"2-digit", minute:"2-digit", hour12:false}).formatToParts(new Date());
  return +p.find(x => x.type === "hour").value * 60 + +p.find(x => x.type === "minute").value; };
const toMin = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
function quiet(prefs){ const n = amsNow(), a = toMin(prefs.quietFrom), b = toMin(prefs.quietTo); return a <= b ? (n >= a && n < b) : (n >= a || n < b); }
async function rainFor(lat, lon){
  const r = await fetch(`https://gpsgadget.buienradar.nl/data/raintext?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, {signal:AbortSignal.timeout(8000)});
  if(!r.ok) throw new Error("buienradar " + r.status);
  return (await r.text()).trim().split(/\r?\n/).map(l => l.split("|")).filter(a => a.length === 2)
    .map(([v, t]) => ({time:t.trim(), mm:Number(v) > 0 ? Math.pow(10, (Number(v) - 109) / 32) : 0}));
}
const kind = mm => mm >= 2.5 ? "Flinke regen" : mm < .5 ? "Lichte regen" : "Regen";
function inPoly(lat, lon, poly){
  const p = poly.trim().split(/\s+/).map(x => x.split(",").map(Number)); let inside = false;
  for(let i = 0, j = p.length - 1; i < p.length; j = i++){ const [yi, xi] = p[i], [yj, xj] = p[j]; if(((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
async function warningsFeed(){
  const r = await fetch("https://feeds.meteoalarm.org/api/v1/warnings/feeds-netherlands", {signal:AbortSignal.timeout(10000)});
  if(!r.ok) throw new Error("meteoalarm " + r.status);
  const j = await r.json(), now = Date.now(), out = [];
  for(const w of j.warnings || []){
    const a = w.alert || {}; if(a.msgType === "Cancel" || a.status !== "Actual") continue;
    const infos = a.info || [], info = infos.find(i => /^nl/i.test(i.language)) || infos[0];
    if(!info || Date.parse(info.expires) < now) continue;
    const par = k => ((info.parameter || []).find(p => p.valueName === k) || {}).value || "";
    const level = parseInt(par("awareness_level")) || 1; if(level < 2) continue;
    const polys = (info.area || []).flatMap(ar => ar.polygon ? [].concat(ar.polygon) : []);
    out.push({key:level + "|" + (par("awareness_type") || info.event) + "|" + info.onset, level, event:info.event, headline:info.headline || "", polys});
  }
  return out;
}
const fmtLevel = l => ({2:"Code geel", 3:"Code oranje", 4:"Code rood"})[l] || "Waarschuwing";

/* ---------- elke 5 minuten controleren ---------- */
exports.check = onSchedule({schedule:"every 5 minutes", timeZone:"Europe/Amsterdam", timeoutSeconds:120}, async () => {
  const subs = await db.collection("subs").get(); if(subs.empty) return;
  const k = await vapid(); webpush.setVapidDetails("https://weer-jasper.web.app", k.publicKey, k.privateKey);
  const rainCache = {}; let warns = null;
  const nl = s => s.lat > 50.6 && s.lat < 53.7 && s.lon > 3.2 && s.lon < 7.3;
  if(subs.docs.some(d => d.data().prefs.warn && nl(d.data()))) warns = await warningsFeed().catch(e => { logger.warn(e.message); return null; });

  await Promise.all(subs.docs.map(async doc => {
    const s = doc.data(), upd = {}, msgs = [];
    if(quiet(s.prefs)) return;
    // regen binnenkort?
    if(s.prefs.rain && nl(s)){
      const key = s.lat.toFixed(2) + "," + s.lon.toFixed(2);
      try{
        const pts = rainCache[key] || (rainCache[key] = await rainFor(s.lat, s.lon));
        const dryNow = pts.slice(0, 2).every(p => p.mm < .1);
        const start = pts.findIndex((p, i) => i >= 2 && i <= 5 && p.mm >= .2);   // over 10–25 minuten
        if(dryNow && start >= 0 && Date.now() - (s.lastRain || 0) > 90 * 60 * 1000){
          let e = start; while(e + 1 < pts.length && pts[e + 1].mm >= .1) e++;
          const peak = Math.max(...pts.slice(start, e + 1).map(p => p.mm));
          msgs.push({title:`🌧️ Over ±${start * 5} min regen in ${s.name}`, body:`${kind(peak)} vanaf ${pts[start].time}` + (e + 1 < pts.length ? `, waarschijnlijk droog rond ${pts[e + 1].time}.` : ", voorlopig nog niet droog."), tag:"rain"});
          upd.lastRain = Date.now();
        }
      }catch(e){ logger.warn(e.message); }
    }
    // weerwaarschuwing?
    if(s.prefs.warn && warns){
      const sent = s.sentWarn || [];
      for(const w of warns){
        if(sent.includes(w.key) || !w.polys.some(pg => inPoly(s.lat, s.lon, pg))) continue;
        msgs.push({title:`⚠️ ${fmtLevel(w.level)}: ${w.event}`, body:w.headline || `Geldt voor ${s.name}.`, tag:"warn-" + w.level});
        sent.push(w.key);
      }
      if(sent.length !== (s.sentWarn || []).length) upd.sentWarn = sent.slice(-30);
    }
    for(const m of msgs){
      try{ await webpush.sendNotification(s.sub, JSON.stringify(m), {TTL:1800, urgency:"high"}); }
      catch(e){ if(e.statusCode === 404 || e.statusCode === 410){ await doc.ref.delete(); return; } logger.warn("push " + e.statusCode); }
    }
    if(Object.keys(upd).length) await doc.ref.update(upd);
  }));
});
