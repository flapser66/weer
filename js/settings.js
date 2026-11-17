// Instellingen: worden in de telefoon zelf bewaard (localStorage)
const KEY = "weer.settings";
export const CARDS = {
  rain:  "Neerslag komende 2 uur",
  hours: "Per uur",
  curve: "Temperatuurcurve",
  bike:  "Fietsweer",
  days:  "10-daagse verwachting",
  radar: "Regenradar",
  tiles: "Details (wind, UV, zon…)"
};
const DEF = {
  fx: {bg:true, touch:true, boot:true, hud:true, cards:true},
  sound: true,
  wind: "bft",                       // bft | kmh | ms
  order: Object.keys(CARDS),
  hidden: [],
  push: {on:false, rain:true, warn:true, quietFrom:"23:00", quietTo:"07:00"}
};
function load(){
  let s = {};
  try{ s = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
  // oude losse instellingen overnemen
  try{
    if(localStorage.getItem("fx") === "0") s.fx = {bg:false, touch:false, boot:false, hud:false, cards:false};
    if(localStorage.getItem("snd") === "0") s.sound = false;
  }catch(e){}
  const out = {...DEF, ...s, fx:{...DEF.fx, ...(s.fx || {})}, push:{...DEF.push, ...(s.push || {})}};
  // nieuwe kaarten aanvullen, onbekende weghalen
  out.order = out.order.filter(k => CARDS[k]).concat(Object.keys(CARDS).filter(k => !out.order.includes(k)));
  return out;
}
export const S = load();
const listeners = [];
export function onChange(fn){ listeners.push(fn); }
export function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  apply(); listeners.forEach(f => f(S));
}
export function apply(){
  const c = document.documentElement.classList;
  c.toggle("no-bg", !S.fx.bg); c.toggle("no-touch", !S.fx.touch); c.toggle("no-hud", !S.fx.hud); c.toggle("no-cards", !S.fx.cards);
}
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
