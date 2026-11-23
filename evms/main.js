import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs = new URLSearchParams(location.search);
const forcedP = qs.has('p') ? parseFloat(qs.get('p')) : null; // ?p=0..1 freezes the scene

const stage = document.getElementById('stage');
const section = document.querySelector('.scene');
const canvas = document.getElementById('gl');
const caps = [...document.querySelectorAll('.captions li')];
const meterFill = document.getElementById('meterFill');
const meterPct = document.getElementById('meterPct');
const nav = document.querySelector('.nav');

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.7;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xffffff, 0x1d2023, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 7, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
key.shadow.radius = 5; key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffe7a0, 1.2); rim.position.set(-4, 3, -3); scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.material.depthWrite = false;
scene.add(ground);

/* ---------- materials ---------- */
const M = {
  shell: new THREE.MeshPhysicalMaterial({ color: 0xeceeea, roughness: 0.35, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  fascia: new THREE.MeshPhysicalMaterial({ color: 0x1a1d20, roughness: 0.25, metalness: 0.4, clearcoat: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x9a9f9b, roughness: 0.95 }),
  module: new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.45, metalness: 0.8 }),
  moduleLed: new THREE.MeshStandardMaterial({ color: 0xf5c518, emissive: 0xf5c518, emissiveIntensity: 1.6 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.4, metalness: 0.6 }),
  halo: new THREE.MeshStandardMaterial({ color: 0xf5c518, emissive: 0xf5c518, emissiveIntensity: 2.2 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7 }),
  plug: new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.35, metalness: 0.3 }),
  pin: new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.25 }),
  nfc: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fd8ff, emissiveIntensity: 1.2 }),
  paint: new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.8, emissive: 0x3a2c00, emissiveIntensity: 0.4 }),
};
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);
const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

/* ---------- screen texture ---------- */
const scr = document.createElement('canvas'); scr.width = 512; scr.height = 352;
const sctx = scr.getContext('2d');
const screenTex = new THREE.CanvasTexture(scr); screenTex.colorSpace = THREE.SRGBColorSpace;
let lastPct = -1, lastDone = null;
function drawScreen(pct, done) {
  if (pct === lastPct && done === lastDone) return; lastPct = pct; lastDone = done;
  const g = sctx; g.fillStyle = '#0f1214'; g.fillRect(0, 0, 512, 352);
  g.fillStyle = done ? '#38c977' : '#f5c518';
  g.font = '600 30px Barlow, sans-serif'; g.fillText(done ? 'Bay 2 is free' : 'Charging', 34, 62);
  g.fillStyle = '#ffffff'; g.font = '700 150px "Barlow Condensed", sans-serif';
  g.fillText(done ? 'Tap' : `${pct}%`, 30, 214);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(34, 258, 444, 18);
  g.fillStyle = done ? '#38c977' : '#f5c518'; g.fillRect(34, 258, 444 * (done ? 1 : pct / 100), 18);
  g.fillStyle = '#a3aab0'; g.font = '500 26px Barlow, sans-serif';
  g.fillText(done ? 'card or phone to start' : '150 kW DC, CCS2', 34, 322);
  screenTex.needsUpdate = true;
}

/* ---------- charger ---------- */
const rig = new THREE.Group(); scene.add(rig);
const parts = [];
const add = (obj, off, rot, a, b) => { shadowed(obj); rig.add(obj); parts.push({ obj, base: obj.position.clone(), baseRot: obj.rotation.clone(), off: new THREE.Vector3(...off), rot: new THREE.Euler(...rot), a, b }); };

const plinth = rbox(1.25, 0.14, 0.85, 0.03, M.concrete); plinth.position.y = 0.07;
const shell = rbox(0.92, 1.9, 0.56, 0.09, M.shell); shell.position.y = 1.09;
const fascia = new THREE.Group();
const fPanel = rbox(0.8, 1.52, 0.05, 0.03, M.fascia); fascia.add(fPanel);
const stripe = rbox(0.035, 1.3, 0.02, 0.01, M.moduleLed); stripe.position.set(-0.33, -0.02, 0.03); fascia.add(stripe);
fascia.position.set(0, 1.16, 0.29);
const screen = new THREE.Group();
const sBezel = rbox(0.54, 0.38, 0.05, 0.03, M.cap); screen.add(sBezel);
const sFace = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.33), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })); sFace.position.z = 0.027; screen.add(sFace);
screen.position.set(0.03, 1.5, 0.33);
const nfc = new THREE.Group();
const nfcPad = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 40), M.cap); nfcPad.rotation.x = Math.PI / 2; nfc.add(nfcPad);
[0.03, 0.05].forEach((r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 40, Math.PI * 0.6), M.nfc); t.rotation.z = -Math.PI * 0.3; t.position.z = 0.012; nfc.add(t); });
nfc.position.set(0.03, 1.13, 0.33);
const top = new THREE.Group();
const capMesh = rbox(1.02, 0.1, 0.66, 0.04, M.cap); capMesh.position.y = 2.1; top.add(capMesh);
const halo = rbox(0.96, 0.035, 0.6, 0.015, M.halo); halo.position.y = 2.035; top.add(halo);
const holster = rbox(0.12, 0.26, 0.18, 0.04, M.cap); holster.position.set(0.52, 1.0, 0.04);

const connector = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 24), M.plug); connector.add(handle);
const head = rbox(0.13, 0.12, 0.11, 0.03, M.plug); head.position.y = 0.17; connector.add(head);
[[-0.025, 0], [0.025, 0], [0, 0.03]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 10), M.pin); p.position.set(x, 0.24, z); connector.add(p); });
const trigger = rbox(0.03, 0.08, 0.04, 0.01, M.moduleLed); trigger.position.set(0, 0.03, 0.05); connector.add(trigger);
connector.position.set(0.6, 1.02, 0.06); connector.rotation.z = -0.35;

const cablePath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.46, 0.42, -0.12), new THREE.Vector3(0.78, 0.12, 0.0), new THREE.Vector3(1.02, 0.05, 0.34),
  new THREE.Vector3(0.94, 0.3, 0.32), new THREE.Vector3(0.7, 0.72, 0.12), new THREE.Vector3(0.63, 0.88, 0.06),
]);
const cable = new THREE.Mesh(new THREE.TubeGeometry(cablePath, 80, 0.032, 12, false), M.rubber);

const modules = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Group();
  const slab = rbox(0.7, 0.15, 0.44, 0.02, M.module); m.add(slab);
  const led = rbox(0.5, 0.02, 0.01, 0.005, M.moduleLed); led.position.set(0, 0.03, 0.225); m.add(led);
  const fins = rbox(0.6, 0.03, 0.36, 0.01, M.cap); fins.position.y = 0.09; m.add(fins);
  m.position.set(0, 0.42 + i * 0.19, -0.02);
  modules.push(m);
}

// assembly order (exploded offset, exploded rotation, start, end)
add(plinth, [0, -0.35, 0], [0, 0, 0], 0.0, 0.2);
modules.forEach((m, i) => add(m, [(i % 2 ? 1 : -1) * (0.95 + i * 0.06), 0.12 * i, -0.2], [0, (i % 2 ? -1 : 1) * 0.5, 0], 0.06 + i * 0.05, 0.32 + i * 0.05));
add(shell, [0, 0.1, -1.4], [0, 0.3, 0], 0.3, 0.55);
add(fascia, [0, 0, 1.1], [0, 0, 0], 0.42, 0.62);
add(screen, [0, 0.25, 1.4], [0.2, -0.3, 0], 0.5, 0.7);
add(nfc, [0, -0.15, 1.5], [0, 0, 0], 0.55, 0.74);
add(top, [0, 0.8, 0], [0, 0.4, 0], 0.6, 0.8);
add(holster, [0.9, 0, 0], [0, 0, 0], 0.66, 0.82);
add(cable, [0.8, -0.1, 0.6], [0, -0.3, 0], 0.7, 0.88);
add(connector, [1.1, 0.5, 0.6], [0.6, 0, 0.9], 0.76, 0.94);

// painted bay lines that "draw" toward the viewer
const bayLines = [];
[-1.35, 1.35].forEach((x) => {
  const g = new THREE.PlaneGeometry(0.1, 4.6); g.translate(0, -2.3, 0);
  const l = new THREE.Mesh(g, M.paint); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.004, -0.55); l.receiveShadow = true; rig.add(l); bayLines.push(l);
});
const backLine = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.1), M.paint); backLine.rotation.x = -Math.PI / 2; backLine.position.set(0, 0.004, -0.55); rig.add(backLine);
const stop = rbox(1.1, 0.09, 0.16, 0.03, M.paint); stop.position.set(0, 0.045, 1.0); shadowed(stop); rig.add(stop);

/* ---------- motion helpers ---------- */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const yellow = new THREE.Color(0xf5c518), green = new THREE.Color(0x38c977);

function pose(pa, now) {
  for (const p of parts) {
    const k = 1 - ease(clamp((pa - p.a) / (p.b - p.a)));
    p.obj.position.set(p.base.x + p.off.x * k, p.base.y + p.off.y * k, p.base.z + p.off.z * k);
    p.obj.rotation.set(p.baseRot.x + p.rot.x * k, p.baseRot.y + p.rot.y * k, p.baseRot.z + p.rot.z * k);
  }
  rig.position.y = (1 - ease(clamp(pa / 0.5))) * 0.45;
  const lineT = ease(clamp((pa - 0.1) / 0.7));
  bayLines.forEach((l) => { l.scale.y = Math.max(0.001, lineT); });
  backLine.scale.x = Math.max(0.001, ease(clamp(pa / 0.3)));
  stop.scale.set(1, 1, 1); stop.visible = pa > 0.7; stop.position.y = 0.045 + (1 - ease(clamp((pa - 0.7) / 0.2))) * 0.6;
  const done = pa >= 0.999;
  const c = done ? green : yellow;
  M.halo.color.copy(c); M.halo.emissive.copy(c);
  M.halo.emissiveIntensity = done ? 2 + Math.sin(now / 500) * 0.6 : 0.4 + 1.8 * ease(clamp((pa - 0.6) / 0.3));
  M.moduleLed.emissiveIntensity = 0.6 + 1.2 * Math.abs(Math.sin(now / 700));
  drawScreen(Math.round(pa * 100), done);
}

/* ---------- camera ---------- */
const camFar = { pos: new THREE.Vector3(6.6, 3.7, 8.8), look: new THREE.Vector3(0.3, 1.35, 0) };
const camNear = { pos: new THREE.Vector3(4.0, 2.4, 5.7), look: new THREE.Vector3(0.1, 1.05, 0.4) };
const look = new THREE.Vector3();
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.6, maxPolarAngle: 1.45, rotateSpeed: 0.7 });
controls.enabled = false;
canvas.style.touchAction = 'pan-y';

let W = 0, H = 0, mobile = false;
function resize() { W = stage.clientWidth; H = stage.clientHeight; mobile = W < 960; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let p = 0, ps = 0, phase = 'hero', userTurned = false, viewY = 0, t0 = performance.now();
const readScroll = () => { if (forcedP !== null) return forcedP; const r = section.getBoundingClientRect(); return clamp(-r.top / (section.offsetHeight - innerHeight)); };
const toAssembly = (s) => clamp((s - 0.06) / 0.78);
function setPhase(n) { if (n === phase) return; phase = n; stage.dataset.phase = n; controls.enabled = n === 'done'; if (n !== 'done') userTurned = false; }
controls.addEventListener('start', () => { userTurned = true; });

function step(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  p = readScroll();
  ps = reduceMotion || forcedP !== null ? p : lerp(ps, p, 1 - Math.pow(0.0015, dt));
  const pa = reduceMotion ? 1 : toAssembly(ps);
  pose(pa, now);
  setPhase(p < 0.05 ? 'hero' : p < 0.86 ? 'build' : 'done');
  const idx = clamp(Math.floor(((p - 0.06) / 0.78) * 3), 0, 2);
  caps.forEach((li, i) => li.classList.toggle('on', phase === 'build' && i === idx));
  const pct = Math.round(pa * 100);
  meterFill.style.height = pct + '%'; meterPct.textContent = pct + '%';
  nav.classList.toggle('solid', section.getBoundingClientRect().bottom < 70);

  if (!(phase === 'done' && userTurned)) {
    const c = ease(clamp(pa / 0.95));
    const tl = new THREE.Vector3().lerpVectors(camFar.look, camNear.look, c);
    const tp = new THREE.Vector3().lerpVectors(camFar.pos, camNear.pos, c);
    const fit = Math.max(1, 0.95 / Math.min(camera.aspect, 1.6)) * (mobile ? (phase === 'hero' ? 1.2 : phase === 'done' ? 0.85 : 1) : 1);
    tp.sub(tl).multiplyScalar(fit).add(tl);
    const k = forcedP !== null ? 1 : 1 - Math.pow(0.001, dt);
    camera.position.lerp(tp, k); look.lerp(tl, k); camera.lookAt(look); controls.target.copy(look);
    rig.rotation.y = lerp(-0.45, 0.32, ease(pa)) + (phase === 'hero' && !reduceMotion ? Math.sin(now / 2600) * 0.12 : 0);
  }
  const shift = mobile ? 0 : (phase === 'done' ? 0 : 0.2);
  const lift = mobile ? (phase === 'hero' ? 0.36 : phase === 'build' ? -0.16 : 0.04) : 0;
  viewY = lerp(viewY, lift, forcedP !== null ? 1 : 0.08);
  camera.setViewOffset(W, H, -W * shift, H * viewY, W, H);
  controls.update();
  renderer.render(scene, camera);
}
function frame(now) { step(now); requestAnimationFrame(frame); }
document.fonts.ready.then(() => { lastPct = -1; });
requestAnimationFrame(frame);

/* ---------- stations: list ↔ map ---------- */
const data = [
  ['Admiralty Way', '4 of 6 bays free. 150 kW DC. CCS2 and Type 2.'],
  ['Ozumba Mbadiwe', '1 of 4 bays free. 60 kW DC. CCS2.'],
  ['Bourdillon Road', 'All 4 bays in use. Next one free in about 15 minutes.'],
  ['Herbert Macaulay Way', '3 of 8 bays free. 22 kW AC. Type 2.'],
  ['Isaac John Street', '5 of 6 bays free. 150 kW DC. CCS2 and Type 2.'],
];
const pins = [...document.querySelectorAll('.pin')], rows = [...document.querySelectorAll('.st')];
const mcName = document.getElementById('mcName'), mcMeta = document.getElementById('mcMeta');
function select(i) {
  i = String(i);
  pins.forEach((x) => x.classList.toggle('on', x.dataset.i === i));
  rows.forEach((x) => { const on = x.dataset.i === i; x.classList.toggle('on', on); x.setAttribute('aria-current', on ? 'true' : 'false'); });
  mcName.textContent = data[i][0]; mcMeta.textContent = data[i][1];
}
pins.forEach((x) => x.addEventListener('click', () => select(x.dataset.i)));
rows.forEach((x) => { x.addEventListener('click', () => select(x.dataset.i)); x.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(x.dataset.i); } }); });
select(0);
document.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

window.__evms = { capture: () => { resize(); for (let i = 0; i < 3; i++) step(performance.now()); return canvas.toDataURL('image/png'); } };
