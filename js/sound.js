// Sci-fi geluiden, live gemaakt met Web Audio (geen bestanden)
import {S} from "./settings.js";

let ac = null, unlocked = false;
function A(){
  if(!S.sound) return null;
  if(!ac){ try{ ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
  if(ac.state === "suspended") ac.resume();
  return ac;
}
// Telefoons staan geluid pas toe na een echte tik (touchend/click)
export function unlock(force){
  if((unlocked && !force) || !S.sound) return;
  try{ if(navigator.audioSession) navigator.audioSession.type = "playback"; }catch(e){}
  try{ const au = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="); au.play().catch(() => {}); }catch(e){}
  const a = A(); if(!a) return;
  const src = a.createBufferSource(); src.buffer = a.createBuffer(1, 1, 22050); src.connect(a.destination); src.start(0);
  a.resume().then(() => { unlocked = a.state === "running"; });
}
["touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, () => unlock(), {passive:true}));

function tone(f1, f2, dur, vol, type){
  const a = A(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type || "sine"; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, f1, f2){
  const a = A(); if(!a) return;
  const n = a.sampleRate * dur, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
  const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = b; fl.type = "lowpass"; fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.value = vol; s.connect(fl).connect(g).connect(a.destination); s.start(t);
}
export const SFX = {
  blip: (f, v) => tone(f || 1400, (f || 1400) * .5, .08, v || .07),
  warp: () => { tone(120, 1800, .7, .05, "sawtooth"); noise(.8, .25, 400, 6000); },
  zap: () => { tone(1800, 80, .35, .06, "square"); noise(.3, .2, 5000, 300); },
  thunder: () => setTimeout(() => noise(2.6, .9, 900, 60), 400),
  swoosh: () => noise(.35, .18, 3000, 400),
  alarm: () => { const a = () => { tone(880, 860, .15, .08); setTimeout(() => tone(660, 640, .15, .08), 180); }; a(); setTimeout(a, 420); },
  tune: () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, f * .5, .1, .09), i * 90))
};
