import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const forcedP = params.has('p') ? parseFloat(params.get('p')) : null; // ?p=0..1 freezes the scene (used for Figma frames)

const stage = document.getElementById('stage');
const section = document.querySelector('.assembly');
const canvas = document.getElementById('car');
const railFill = document.getElementById('railFill');
const steps = [...document.querySelectorAll('.steps li')];

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe0da, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 9, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
scene.add(key);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.material.depthWrite = false;
scene.add(ground);

// soft contact blob under the car
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(10,40,35,.55)'); gr.addColorStop(1, 'rgba(10,40,35,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
const blob = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.9), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002;
scene.add(blob);

/* ---------------- materials ---------------- */
const M = {
  paint: new THREE.MeshPhysicalMaterial({ color: 0x12574d, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0a1513, metalness: 0.3, roughness: 0.05, clearcoat: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x151817, roughness: 0.85 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc9d1ce, metalness: 1, roughness: 0.22 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2b3331, metalness: 0.8, roughness: 0.4 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x8c9895, metalness: 0.9, roughness: 0.35 }),
  battery: new THREE.MeshStandardMaterial({ color: 0x1c2826, metalness: 0.4, roughness: 0.5 }),
  cell: new THREE.MeshStandardMaterial({ color: 0x1e5c52, emissive: 0x47d9bf, emissiveIntensity: 0.55, roughness: 0.4 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xd9824a, metalness: 1, roughness: 0.3, emissive: 0x7a2c08, emissiveIntensity: 0.3 }),
  seat: new THREE.MeshStandardMaterial({ color: 0xd8d0bf, roughness: 0.7 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x111514, roughness: 0.6 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xff3b2f, emissive: 0xff2a1e, emissiveIntensity: 2 }),
  port: new THREE.MeshStandardMaterial({ color: 0x9dfbe6, emissive: 0x47d9bf, emissiveIntensity: 2 }),
  lime: new THREE.MeshStandardMaterial({ color: 0xb8de5a, metalness: 0.3, roughness: 0.4 }),
};
const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);

/* ---------------- car parts ---------------- */
const car = new THREE.Group();
scene.add(car);
const WX = 1.42, WY = 0.42, WZ = 0.8; // wheel centre

// chassis rails ("skateboard")
const chassis = new THREE.Group();
[-0.58, 0.58].forEach((z) => { const r = rbox(3.9, 0.07, 0.1, 0.02, M.frame); r.position.set(0, 0.2, z); chassis.add(r); });
[-1.42, -0.5, 0.5, 1.42].forEach((x) => { const c = rbox(0.08, 0.06, 1.2, 0.02, M.frame); c.position.set(x, 0.2, 0); chassis.add(c); });

// battery pack with glowing cells
const battery = new THREE.Group();
const tray = rbox(2.6, 0.13, 1.3, 0.04, M.battery); tray.position.y = 0.27; battery.add(tray);
const cellGeo = new RoundedBoxGeometry(0.27, 0.035, 0.2, 2, 0.012);
const cells = new THREE.InstancedMesh(cellGeo, M.cell, 8 * 5);
let ci = 0; const dummy = new THREE.Object3D();
for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
  dummy.position.set(-1.1 + i * 0.314, 0.352, -0.5 + j * 0.25); dummy.updateMatrix(); cells.setMatrixAt(ci++, dummy.matrix);
}
battery.add(cells);
const busbar = rbox(2.4, 0.02, 0.05, 0.01, M.copper); busbar.position.set(0, 0.37, 0); battery.add(busbar);

// motors + axles
const motors = new THREE.Group();
[-WX, WX].forEach((x) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.46, 32), M.frame); m.rotation.x = Math.PI / 2; m.position.set(x, WY, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 12, 40), M.copper); ring.position.set(x, WY, 0.12);
  const ring2 = ring.clone(); ring2.position.z = -0.12;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 16), M.darkMetal); axle.rotation.x = Math.PI / 2; axle.position.set(x, WY, 0);
  motors.add(m, ring, ring2, axle);
});

// seats
const seats = new THREE.Group();
const seat = (x, z, w) => {
  const g = new THREE.Group();
  const base = rbox(0.5, 0.13, w, 0.05, M.seat); base.position.set(0, 0.52, 0);
  const back = rbox(0.12, 0.56, w, 0.05, M.seat); back.position.set(-0.24, 0.82, 0); back.rotation.z = 0.16;
  const head = rbox(0.1, 0.14, w * 0.6, 0.04, M.seat); head.position.set(-0.3, 1.17, 0); head.rotation.z = 0.16;
  g.add(base, back, head); g.position.set(x, 0, z); return g;
};
seats.add(seat(0.15, -0.38, 0.46), seat(0.15, 0.38, 0.46), seat(-0.95, 0, 1.2));
const dash = rbox(0.18, 0.16, 1.4, 0.05, M.trim); dash.position.set(0.82, 0.86, 0); seats.add(dash);

// body shell: extruded side profile with wheel arches
const bodyShape = new THREE.Shape();
bodyShape.moveTo(-2.2, 0.32);
bodyShape.lineTo(-WX - 0.48, 0.32);
bodyShape.absarc(-WX, WY, 0.49, Math.PI, 0, true);
bodyShape.lineTo(WX - 0.48, 0.32);
bodyShape.absarc(WX, WY, 0.49, Math.PI, 0, true);
bodyShape.lineTo(2.12, 0.32);
bodyShape.quadraticCurveTo(2.32, 0.42, 2.29, 0.66);
bodyShape.quadraticCurveTo(2.22, 0.82, 1.9, 0.86);
bodyShape.lineTo(0.95, 0.98);
bodyShape.lineTo(-1.62, 1.02);
bodyShape.quadraticCurveTo(-2.16, 1.0, -2.25, 0.8);
bodyShape.lineTo(-2.27, 0.46);
bodyShape.quadraticCurveTo(-2.26, 0.32, -2.2, 0.32);
const BODY_D = 1.68;
const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: BODY_D, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6, curveSegments: 40 });
bodyGeo.translate(0, 0, -BODY_D / 2);
const body = new THREE.Group();
const shell = new THREE.Mesh(bodyGeo, M.paint); body.add(shell);
// sill cladding + mirrors + handles
const sill = rbox(1.9, 0.1, BODY_D + 0.2, 0.04, M.trim); sill.position.set(0, 0.36, 0); body.add(sill);
[-1, 1].forEach((s) => {
  const mirror = rbox(0.2, 0.1, 0.14, 0.04, M.paint); mirror.position.set(0.82, 1.04, s * 0.98); body.add(mirror);
  [0.25, -0.75].forEach((x) => { const h = rbox(0.2, 0.025, 0.02, 0.01, M.trim); h.position.set(x, 0.86, s * 0.925); body.add(h); });
});

// glass greenhouse
const cabShape = new THREE.Shape();
cabShape.moveTo(0.98, 0.96);
cabShape.quadraticCurveTo(0.42, 1.44, -0.12, 1.5);
cabShape.lineTo(-1.15, 1.49);
cabShape.quadraticCurveTo(-1.78, 1.42, -1.98, 0.98);
cabShape.closePath();
const CAB_D = 1.36;
const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: CAB_D, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 6, curveSegments: 40 });
cabGeo.translate(0, 0, -CAB_D / 2);
const cabin = new THREE.Mesh(cabGeo, M.glass);

// roof panel + B-pillars in paint
const roof = new THREE.Group();
const roofPanel = rbox(1.15, 0.05, CAB_D + 0.12, 0.025, M.paint); roofPanel.position.set(-0.62, 1.565, 0); roof.add(roofPanel);
[-1, 1].forEach((s) => { const p = rbox(0.1, 0.52, 0.03, 0.012, M.paint); p.position.set(-0.32, 1.24, s * (CAB_D / 2 + 0.095)); roof.add(p); });
const bar = rbox(0.9, 0.02, 0.06, 0.01, M.lime); bar.position.set(-0.62, 1.6, 0); roof.add(bar);

// wheels
const makeWheel = (side) => {
  const g = new THREE.Group();
  const spin = new THREE.Group(); g.add(spin);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.1, 24, 64), M.rubber); spin.add(tire);
  const tireCore = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 48), M.rubber); tireCore.rotation.x = Math.PI / 2; spin.add(tireCore);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 40), M.darkMetal); disc.rotation.x = Math.PI / 2; disc.position.z = -side * 0.03; spin.add(disc);
  const rimFace = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.27, 0.04, 48), M.rim); rimFace.rotation.x = Math.PI / 2; rimFace.position.z = side * 0.085; spin.add(rimFace);
  for (let k = 0; k < 5; k++) {
    const spoke = rbox(0.24, 0.07, 0.03, 0.012, M.darkMetal); const a = (k / 5) * Math.PI * 2;
    spoke.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, side * 0.11); spoke.rotation.z = a; spin.add(spoke);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), M.lime); cap.rotation.x = Math.PI / 2; cap.position.z = side * 0.125; spin.add(cap);
  g.userData.spin = spin;
  return g;
};
const wheels = [];
[[WX, 1], [WX, -1], [-WX, 1], [-WX, -1]].forEach(([x, s]) => { const w = makeWheel(s); w.position.set(x, WY, s * WZ); wheels.push(w); });

// lights
const lights = new THREE.Group();
const headL = rbox(0.05, 0.04, 1.5, 0.018, M.head); headL.position.set(2.31, 0.72, 0); headL.rotation.z = -0.35;
const intake = rbox(0.06, 0.12, 1.1, 0.04, M.trim); intake.position.set(2.33, 0.46, 0);
const plate = rbox(0.02, 0.1, 0.36, 0.01, M.seat); plate.position.set(2.37, 0.46, 0);
const frontLights = new THREE.Group(); frontLights.add(headL, intake, plate);
const tailL = rbox(0.04, 0.05, 1.6, 0.02, M.tail); tailL.position.set(-2.3, 0.82, 0);
const port = rbox(0.12, 0.08, 0.02, 0.01, M.port); port.position.set(-1.78, 0.86, BODY_D / 2 + 0.085);
const rearLights = new THREE.Group(); rearLights.add(tailL, port);

/* ---------------- explode choreography ---------------- */
// each part: assembled transform is where it was built; `off`/`rot` describe the exploded state.
const parts = [];
const add = (obj, off, rot, a, b) => {
  shadowed(obj); car.add(obj);
  parts.push({ obj, base: obj.position.clone(), baseRot: obj.rotation.clone(), off: new THREE.Vector3(...off), rot: new THREE.Euler(...rot), a, b });
};
add(chassis,    [0, -0.05, 0],  [0, 0, 0],        0.00, 0.20);
add(battery,    [0, -0.75, 0],  [0, 0.25, 0],     0.04, 0.30);
add(motors,     [0, -0.35, 0],  [0, 0, 0],        0.14, 0.38);
add(seats,      [0, 0.95, 0],   [0, -0.2, 0],     0.30, 0.52);
wheels.forEach((w, i) => add(w, [Math.sign(w.position.x) * 0.2, 0.1, Math.sign(w.position.z) * 1.05], [0, Math.sign(w.position.z) * 0.6, 0], 0.22 + i * 0.03, 0.48 + i * 0.03));
add(body,       [0, 1.8, 0],    [0, 0, 0.04],     0.50, 0.76);
add(cabin,      [0, 2.45, 0],   [0, 0, -0.05],    0.60, 0.84);
add(roof,       [0, 3.05, 0],   [0, 0, 0],        0.66, 0.90);
add(frontLights,[1.2, 0.3, 0],  [0, 0, 0],        0.80, 0.98);
add(rearLights, [-1.2, 0.3, 0], [0, 0, 0],        0.80, 0.98);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function pose(pa) {
  for (const p of parts) {
    const t = ease(clamp((pa - p.a) / (p.b - p.a)));
    const k = 1 - t;
    p.obj.position.set(p.base.x + p.off.x * k, p.base.y + p.off.y * k, p.base.z + p.off.z * k);
    p.obj.rotation.set(p.baseRot.x + p.rot.x * k, p.baseRot.y + p.rot.y * k, p.baseRot.z + p.rot.z * k);
    if (p.obj.userData.spin) p.obj.userData.spin.rotation.z = -k * 9;
  }
  car.position.y = (1 - ease(clamp(pa / 0.6))) * 0.9; // hovers while exploded
  blob.material.opacity = 0.35 + 0.65 * ease(clamp((pa - 0.5) / 0.5));
}

/* ---------------- camera path ---------------- */
const camFar = { pos: new THREE.Vector3(10.2, 5.4, 12.4), look: new THREE.Vector3(0, 2.2, 0) };
const camNear = { pos: new THREE.Vector3(7.0, 2.5, 8.1), look: new THREE.Vector3(0, 0.62, 0) };
const look = new THREE.Vector3();
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.5, maxPolarAngle: 1.45, rotateSpeed: 0.7 });
controls.enabled = false;
canvas.style.touchAction = 'pan-y';

let W = 0, H = 0, mobile = false;
function resize() {
  W = stage.clientWidth; H = stage.clientHeight; mobile = W < 960;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ---------------- scroll state ---------------- */
let viewY = 0, p = 0, pSmooth = 0, phase = 'hero', userTurned = false;
function readScroll() {
  if (forcedP !== null) return forcedP;
  const r = section.getBoundingClientRect();
  return clamp(-r.top / (section.offsetHeight - innerHeight));
}
// scroll → assembly progress: 0–6% hero at rest, 6–84% builds, 84–100% configure
const toAssembly = (s) => clamp((s - 0.06) / 0.78);

function setPhase(next) {
  if (next === phase) return; phase = next; stage.dataset.phase = next;
  controls.enabled = next === 'done';
  if (next !== 'done') userTurned = false;
}
controls.addEventListener('start', () => { userTurned = true; });

let t0 = performance.now();
function step(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  p = readScroll();
  pSmooth = reduceMotion || forcedP !== null ? p : lerp(pSmooth, p, 1 - Math.pow(0.0015, dt));
  const pa = reduceMotion ? 1 : toAssembly(pSmooth);
  pose(pa);

  setPhase(p < 0.05 ? 'hero' : p < 0.86 ? 'build' : 'done');
  const idx = clamp(Math.floor(((p - 0.06) / 0.78) * 4), 0, 3);
  steps.forEach((li, i) => li.classList.toggle('on', phase === 'build' && i === idx));
  railFill.style.transform = `scaleY(${clamp((p - 0.05) / 0.81)})`;

  // camera follows the build unless the user has taken over
  if (!(phase === 'done' && userTurned)) {
    const c = ease(clamp(pa / 0.95));
    const tp = new THREE.Vector3().lerpVectors(camFar.pos, camNear.pos, c);
    const tl = new THREE.Vector3().lerpVectors(camFar.look, camNear.look, c);
    const fit = Math.max(1, 0.95 / Math.min(camera.aspect, 1.6)) * (mobile ? (phase === 'hero' ? 1.25 : phase === 'done' ? 0.8 : 1) : 1); // pull back on tall screens
    tp.sub(tl).multiplyScalar(fit).add(tl);
    const k = forcedP !== null ? 1 : 1 - Math.pow(0.001, dt);
    camera.position.lerp(tp, k); look.lerp(tl, k);
    camera.lookAt(look); controls.target.copy(look);
    // slow turntable while building
    car.rotation.y = lerp(0.5, -0.55, ease(clamp(pa))) + (phase === 'hero' && !reduceMotion ? Math.sin(now / 2400) * 0.12 : 0);
  }
  // push the car right on desktop so the hero copy / captions have room
  const shift = mobile ? 0 : lerp(0.2, 0.17, clamp(pa * 1.2)) * (phase === 'done' ? 0 : 1);
  const lift = mobile ? (phase === 'hero' ? 0.42 : phase === 'build' ? -0.14 : 0.04) : 0;
  viewY = lerp(viewY, lift, forcedP !== null ? 1 : 0.08);
  camera.setViewOffset(W, H, -W * shift, H * viewY, W, H);
  controls.update();
  renderer.render(scene, camera);
}
function frame(now) { step(now); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

/* ---------------- paint swatches ---------------- */
const paintName = document.getElementById('paintName');
document.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.sw').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  const target = new THREE.Color(b.dataset.paint);
  const from = M.paint.color.clone(); const start = performance.now();
  const step = (n) => { const t = clamp((n - start) / 450); M.paint.color.copy(from).lerp(target, ease(t)); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  paintName.textContent = b.textContent.trim();
}));

/* ---------------- booking tabs ---------------- */
document.querySelectorAll('.book-tabs button').forEach((b, _, all) => b.addEventListener('click', () => all.forEach((x) => x.setAttribute('aria-selected', String(x === b)))));

/* ---------------- stations: list ↔ map ---------------- */
const pins = [...document.querySelectorAll('.pin')];
const rows = [...document.querySelectorAll('.st')];
const select = (i) => { pins.forEach((x) => x.classList.toggle('on', x.dataset.i === String(i))); rows.forEach((x) => x.classList.toggle('on', x.dataset.i === String(i))); };
pins.forEach((x) => x.addEventListener('click', () => select(x.dataset.i)));
rows.forEach((x) => { x.tabIndex = 0; x.addEventListener('click', () => select(x.dataset.i)); x.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(x.dataset.i); } }); });
select(0);
document.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

// expose for capture tooling
window.__edryv = { renderer, setPaint: (hex) => M.paint.color.set(hex), capture: () => { resize(); for (let i = 0; i < 3; i++) step(performance.now()); return canvas.toDataURL('image/png'); } };
