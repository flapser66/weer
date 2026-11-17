// Pushmeldingen (alleen op de Firebase-versie van de app)
import {S, save} from "./settings.js";

export const pushHost = /\.web\.app$|\.firebaseapp\.com$/.test(location.hostname);
export const pushSupported = () => pushHost && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
const post = (url, body) => fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)}).then(r => { if(!r.ok) throw new Error(r.status); return r.json().catch(() => ({})); });

async function subscription(create){
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub && create){
    const {key} = await fetch("/api/vapid").then(r => r.json());
    sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64(key)});
  }
  return sub;
}
const prefs = () => ({rain:S.push.rain, warn:S.push.warn, quietFrom:S.push.quietFrom, quietTo:S.push.quietTo});

export async function enablePush(place){
  if(!pushSupported()) throw new Error("Meldingen werken hier niet");
  const perm = await Notification.requestPermission();
  if(perm !== "granted") throw new Error("Je hebt meldingen niet toegestaan");
  const sub = await subscription(true);
  await post("/api/subscribe", {sub:sub.toJSON(), lat:place.lat, lon:place.lon, name:place.name, prefs:prefs()});
  S.push.on = true; S.push.lat = place.lat; S.push.lon = place.lon; S.push.at = Date.now(); save();
}
export async function disablePush(){
  try{ const sub = await subscription(false); if(sub){ await post("/api/unsubscribe", {endpoint:sub.endpoint}).catch(() => {}); await sub.unsubscribe(); } }catch(e){}
  S.push.on = false; save();
}
// Locatie/voorkeuren bijwerken als je je verplaatst (max 1x per 30 min of bij >2 km)
export async function syncPush(place, force){
  if(!S.push.on || !pushSupported() || Notification.permission !== "granted") return;
  const moved = S.push.lat == null || Math.hypot(place.lat - S.push.lat, (place.lon - S.push.lon) * .62) > .018;
  if(!force && !moved && Date.now() - (S.push.at || 0) < 30 * 60 * 1000) return;
  try{
    const sub = await subscription(true);
    await post("/api/subscribe", {sub:sub.toJSON(), lat:place.lat, lon:place.lon, name:place.name, prefs:prefs()});
    S.push.lat = place.lat; S.push.lon = place.lon; S.push.at = Date.now(); save();
  }catch(e){}
}
