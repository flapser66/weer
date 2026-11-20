// Scooter Navigatie – offline: kaart uit geheugen, max. 1x per week bijwerken
const V='scooter-v5',TILES='scooter-tiles',META='scooter-meta',WEEK=7*864e5;
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js','https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('scooter-')&&![V,TILES,META].includes(n)).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
async function trim(){const c=await caches.open(TILES);const k=await c.keys();if(k.length>15000)for(const r of k.slice(0,k.length-13000))await c.delete(r)}
let n=0;
async function tile(r){const c=await caches.open(TILES);const hit=await c.match(r);if(hit)return hit;
  const res=await fetch(r);if(res.ok){c.put(r,res.clone());if(++n%200===0)trim()}return res}
async function weekly(r){ // kaartstijl, tegel-index, iconen-lijst: 1x per week verversen
  const c=await caches.open(META);const hit=await c.match(r);
  if(hit&&Date.now()-(+hit.headers.get('x-sw-t')||0)<WEEK)return hit;
  try{const res=await fetch(r);if(res.ok){const h=new Headers(res.headers);h.set('x-sw-t',String(Date.now()));
      await c.put(r,new Response(await res.clone().blob(),{status:res.status,statusText:res.statusText,headers:h}))}
    return res}catch(e){if(hit)return hit;throw e}
}
async function swr(e,r,same){ // app zelf: direct uit geheugen, op de achtergrond bijwerken
  const c=await caches.open(V);const hit=await c.match(r,{ignoreSearch:same});
  const net=fetch(r).then(res=>{if(res.ok&&!same||res.ok&&!new URL(r.url).search)c.put(r,res.clone());return res}).catch(()=>null);
  e.waitUntil(net);
  return hit||(await net)||(await c.match('./index.html'))||Response.error();
}
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname==='tiles.openfreemap.org'){
    if(/\.(pbf|png|webp)$/.test(u.pathname)||u.pathname.startsWith('/fonts/'))e.respondWith(tile(r));
    else e.respondWith(weekly(r));
    return;
  }
  if(u.origin===location.origin||u.hostname==='unpkg.com')e.respondWith(swr(e,r,u.origin===location.origin));
  // routeplanner, zoeken, flitspalen, weer: altijd live via internet
});
