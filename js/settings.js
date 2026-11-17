// Instellingen: worden in de telefoon zelf bewaard (localStorage)
const KEY = "weer.settings";
export const CARDS = {
  rain:   "Neerslag komende 2 uur",
  parts:  "Dagdelen (vandaag & morgen)",
  hours:  "Per uur",
  charts: "Grafieken 48 uur",
  days:   "10-daagse verwachting",
  acts:   "Activiteiten (fietsen, hardlopen…)",
  radar:  "Regenradar",
  pollen: "Pollen & luchtkwaliteit",
  astro:  "Zon & maan",
  models: "Weermodellen vergelijken",
  tiles:  "Details (wind, UV, vocht…)"
};
const DEF = {
  v: 3,
  style: "apple",                    // apple (klassiek, rustig) | future (futuristisch)
  fx: {show:false, bg:true, touch:false, boot:false, hud:false, cards:false},
  accent: "auto",                    // auto (volgt temperatuur) | cyan | green | orange | purple
  sound: false,
  wind: "bft",                       // bft | kmh | ms
  order: Object.keys(CARDS),
  hidden: [],
  push: {on:false, rain:true, warn:true, storm:true, frost:true, morning:true, morningTime:"07:00", quietFrom:"23:00", quietTo:"07:00"}
};
function load(){
  let s = {};
  try{ s = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
  // oude losse instellingen overnemen
  try{
    if(localStorage.getItem("fx") === "0") s.fx = {bg:false, touch:false, boot:false, hud:false, cards:false};
    if(localStorage.getItem("snd") === "0") s.sound = false;
  }catch(e){}
  if(s.v !== 3){ s.v = 3; s.style = "apple"; s.fx = {...DEF.fx}; s.sound = false; }   // overstap naar de rustige stijl
  const out = {...DEF, ...s, fx:{...DEF.fx, ...(s.fx || {})}, push:{...DEF.push, ...(s.push || {})}};
  // nieuwe kaarten aanvullen, onbekende weghalen
  out.order = out.order.filter(k => CARDS[k]).concat(Object.keys(CARDS).filter(k => !out.order.includes(k)));
  return out;
}
export const S = load();
try{ localStorage.removeItem("fx"); localStorage.removeItem("snd"); localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
const listeners = [];
export function onChange(fn){ listeners.push(fn); }
export function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  apply(); listeners.forEach(f => f(S));
}
export function apply(){
  const c = document.documentElement.classList;
  c.toggle("apple", S.style === "apple"); c.toggle("calm", !S.fx.show); c.toggle("no-bg", !S.fx.bg); c.toggle("no-touch", !S.fx.touch); c.toggle("no-hud", !S.fx.hud); c.toggle("no-cards", !S.fx.cards);
}
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
