const V='scooter-v2', TILES='scooter-tiles';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js','https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
 'https://tiles.openfreemap.org/styles/liberty','https://tiles.openfreemap.org/styles/fiord'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('scooter-')&&n!==V&&n!==TILES).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
async function trim(){const c=await caches.open(TILES);const k=await c.keys();if(k.length>4000)for(const r of k.slice(0,k.length-3500))await c.delete(r)}
let n=0;
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname.includes('valhalla')||u.hostname.includes('photon'))return; // route & zoeken: alleen online
  if(u.hostname==='tiles.openfreemap.org'&&!u.pathname.startsWith('/styles/')&&!u.pathname.endsWith('.json')&&!/\/planet\/?$/.test(u.pathname)){
    // kaarttegels, lettertypes, iconen: eerst uit cache
    e.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(r);if(hit)return hit;
      const res=await fetch(r);if(res.ok){c.put(r,res.clone());if(++n%200===0)trim()}return res}));
    return;
  }
  // app, bibliotheek, kaartstijl: eerst netwerk, offline uit cache
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:u.origin===location.origin}).then(h=>h||caches.match('./index.html'))));
});
