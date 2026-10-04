(() => {
const $ = id => document.getElementById(id);
const R = 18;
const V3 = THREE.Vector3;
const UP = new V3(0,1,0);

/* ================= Controls ================= */
const CONTROLS = {
  up:['KeyW'], down:['KeyS'], left:['KeyA'], right:['KeyD'],
  punch:['Mouse0','KeyJ'], kick:['Mouse2','KeyK'], block:['KeyF'], dash:['ShiftLeft','ShiftRight'],
  shot:['KeyQ'], sk2:['KeyE'], ult:['KeyR'], jump:['Space'], cam:['KeyV'],
  lookL:['ArrowLeft'], lookR:['ArrowRight'], lookU:['ArrowUp'], lookD:['ArrowDown']
};
const GAME_KEYS = new Set(Object.values(CONTROLS).flat());
const keys = {};
const inGame = () => phase !== 'menu' && phase !== 'lobby';
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (GAME_KEYS.has(e.code) && inGame()) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape') togglePause();
  if (CONTROLS.cam.includes(e.code)) toggleCam();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousedown', e => {
  if (!inGame() || e.target !== renderer.domElement) return;
  if (!locked()) requestLock();
  keys['Mouse' + e.button] = true;
});
addEventListener('mouseup', e => { keys['Mouse' + e.button] = false; });
addEventListener('contextmenu', e => { if (inGame()) e.preventDefault(); });
const look = { yaw:0, pitch:-.12, sens:.0024 };
let lookFallback = false, wantLock = false;
const locked = () => document.pointerLockElement === renderer.domElement;
function requestLock(){
  if (isTouch || locked()) return;
  wantLock = true;
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { lookFallback = true; updateLookHint(); }); }
  catch(e){ lookFallback = true; }
  updateLookHint();
}
document.addEventListener('pointerlockerror', () => { lookFallback = true; updateLookHint(); });
document.addEventListener('pointerlockchange', () => {
  updateLookHint();
  if (!locked() && wantLock && inGame() && $('pause').hidden && $('result').hidden && phase !== 'over'){ wantLock = false; togglePause(); }
});
addEventListener('mousemove', e => {
  if (!inGame() || phase === 'paused') return;
  if (locked() || (lookFallback && e.target === renderer.domElement)){
    look.yaw -= e.movementX*look.sens; look.pitch -= e.movementY*look.sens; clampPitch();
  }
});
function clampPitch(){ const fps = camMode === 'fps'; look.pitch = Math.max(fps ? -1.35 : -.85, Math.min(fps ? 1.35 : .7, look.pitch)); }
function updateLookHint(){
  const show = inGame() && !isTouch && !locked() && !lookFallback && phase !== 'over' && $('pause').hidden;
  $('lookHint').hidden = !show;
  $('cross').classList.toggle('lock', locked());
}
// touch look: drag on the game view
let touchLook = null;
addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.target === renderer.domElement && inGame()) touchLook = { id:e.pointerId, x:e.clientX, y:e.clientY }; });
addEventListener('pointermove', e => {
  if (!touchLook || e.pointerId !== touchLook.id) return;
  look.yaw -= (e.clientX - touchLook.x)*.006; look.pitch -= (e.clientY - touchLook.y)*.006; clampPitch();
  touchLook.x = e.clientX; touchLook.y = e.clientY;
});
addEventListener('pointerup', e => { if (touchLook && e.pointerId === touchLook.id) touchLook = null; });
addEventListener('pointercancel', () => { touchLook = null; });

/* ================= Audio ================= */
let ac = null, muted = false;
function audio(){ if (!ac){ try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return ac; }
function noise(dur, freq, gain, type){
  const a = audio(); if (!a || muted) return;
  const len = Math.floor(a.sampleRate*dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1)*Math.pow(1 - i/len, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination); src.start();
}
function tone(f1, f2, dur, type, gain, delay){
  const a = audio(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (delay || 0);
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), t + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime); o.stop(t + dur + .05);
}
const SFX = {
  punch(){ noise(.13, 2400, .45); tone(180, 60, .13, 'sine', .45); },
  kick(){ noise(.22, 1300, .7); tone(120, 38, .26, 'sine', .7); },
  block(){ tone(1100, 800, .1, 'square', .08); noise(.07, 6000, .2, 'highpass'); },
  whoosh(){ noise(.12, 3000, .12, 'bandpass'); },
  ko(){ tone(320, 45, .9, 'sawtooth', .2); noise(.45, 800, .5); },
  bell(){ tone(660, 655, .9, 'triangle', .22); tone(990, 985, .7, 'sine', .1); },
  jump(){ noise(.1, 1500, .12, 'bandpass'); },
  land(){ noise(.08, 400, .25); },
  shot0(){ noise(.35, 900, .45); tone(220, 90, .3, 'sawtooth', .12); },
  shot1(){ tone(1800, 600, .25, 'triangle', .14); noise(.2, 7000, .18, 'highpass'); },
  explode0(){ noise(.4, 700, .6); tone(90, 40, .3, 'sine', .5); },
  explode1(){ noise(.25, 5000, .35, 'highpass'); tone(1500, 300, .2, 'triangle', .12); },
  nova(){ noise(.9, 500, .9); tone(70, 30, .9, 'sine', .8); tone(260, 60, .6, 'sawtooth', .15); },
  beam(){ tone(2400, 300, .6, 'sawtooth', .1); tone(1200, 200, .7, 'sine', .2); noise(.5, 8000, .25, 'highpass'); },
  freeze(){ for (let i = 0; i < 4; i++) tone(2000 + i*400, 900, .15, 'square', .05, i*.05); noise(.3, 9000, .3, 'highpass'); },
  shatter(){ noise(.3, 6000, .35, 'highpass'); tone(2600, 1200, .2, 'triangle', .08); },
  charge(){ tone(200, 900, .45, 'sawtooth', .07); },
  s_fire(){ noise(.35, 900, .45); tone(220, 90, .3, 'sawtooth', .12); },
  s_ice(){ tone(1800, 600, .25, 'triangle', .14); noise(.2, 7000, .18, 'highpass'); },
  s_wind(){ noise(.3, 2500, .35, 'bandpass'); tone(900, 300, .25, 'sine', .1); },
  s_gun(){ noise(.12, 3500, .6); tone(160, 60, .1, 'square', .2); },
  s_throw(){ noise(.15, 1200, .15, 'bandpass'); },
  s_rock(){ noise(.3, 500, .4); tone(90, 50, .3, 'sine', .3); },
  s_wave(){ noise(.6, 400, .6); tone(70, 35, .6, 'sine', .5); },
  slash(){ noise(.12, 6000, .35, 'highpass'); tone(2400, 900, .1, 'triangle', .08); },
  boom(r){ noise(.25 + (r || 1)*.08, 600, .7); tone(110, 35, .35, 'sine', .55); },
  zap(){ noise(.25, 8000, .3, 'highpass'); tone(1200, 120, .2, 'sawtooth', .12); },
  thunder(){ noise(.7, 1500, .55); tone(80, 30, .5, 'sawtooth', .2); },
  blink(){ tone(400, 1800, .18, 'sine', .14); noise(.1, 6000, .12, 'highpass'); },
  quake(){ noise(1.0, 250, 1.0); tone(55, 25, 1.0, 'sine', .9); }
};
function toggleMute(){ muted = !muted; $('muteBtn').textContent = muted ? 'Sesi aç' : 'Sesi kapat'; }

/* ================= Renderer & shared materials ================= */
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const menuCam = new THREE.PerspectiveCamera(50, 1, .1, 900);
const cam = new THREE.PerspectiveCamera(65, 1, .05, 900);
cam.layers.enable(1); cam.layers.enable(2);
menuCam.layers.enable(1); menuCam.layers.enable(2);

const grad = new THREE.DataTexture(new Uint8Array([95,95,95,255, 160,160,160,255, 215,215,215,255, 245,245,245,255]), 4, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap:grad }, extra || {}));
const OUT = new THREE.MeshBasicMaterial({ color:0x07060f, side:THREE.BackSide });

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,255,255,.7)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c);
})();
function glowSprite(color, size, opacity){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, opacity:opacity ?? 1 }));
  s.scale.setScalar(size); return s;
}
function addMesh(geo, mat, parent, x, y, z, ol){
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true; parent.add(m);
  if (ol){ const o = new THREE.Mesh(geo, OUT); o.scale.setScalar(ol); o.castShadow = false; m.add(o); }
  return m;
}

function rimToon(color, rim, extra, strength){
  const m = toon(color, extra), rc = new THREE.Color(rim), k = strength ?? .55;
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = { value:rc };
    sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\n float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n gl_FragColor.rgb += rimColor * pow(rimF, 2.6) * ' + k.toFixed(2) + ';');
  };
  m.customProgramCacheKey = () => 'rim' + rim + '_' + k;
  return m;
}
const hexCss = n => '#' + n.toString(16).padStart(6, '0');
const rnd = (a, b) => a + Math.random()*(b - a);
function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
function scatter(geo, mat, n, place, opts){
  const im = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < n; i++){ d.position.set(0,0,0); d.rotation.set(0,0,0); d.scale.set(1,1,1); const c = place(d, i); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (c !== undefined && im.setColorAt){ col.set(c); im.setColorAt(i, col); } }
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = !!(opts && opts.cast); im.receiveShadow = true; scene.add(im); return im;
}
const worldAnims = [];

/* ================= World: floating sky temple ================= */
(function sky(){
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,0,512);
  gr.addColorStop(0,'#0c1236'); gr.addColorStop(.4,'#1f2460'); gr.addColorStop(.7,'#40367e'); gr.addColorStop(1,'#64529a');
  g.fillStyle = gr; g.fillRect(0,0,4,512);
  scene.background = new THREE.CanvasTexture(c);
  scene.fog = new THREE.FogExp2(0x332b6a, .007);
  // stars
  const n = 1800, pos = new Float32Array(n*3);
  for (let i = 0; i < n; i++){
    const u = Math.random(), v = Math.random()*.9 + .1, th = u*Math.PI*2, ph = Math.acos(v);
    pos[i*3] = Math.sin(ph)*Math.cos(th)*380; pos[i*3+1] = Math.cos(ph)*380 - 20; pos[i*3+2] = Math.sin(ph)*Math.sin(th)*380;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xdcd6ff, size:1.4, sizeAttenuation:false, fog:false })));
  // moon
  const moonTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f4ecd6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++){ const x = Math.random()*w, y = Math.random()*h, r = 3 + Math.random()*22;
      g.fillStyle = `rgba(150,140,170,${.15 + Math.random()*.25})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(255,255,245,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x - 1, y - 1, r, Math.PI*.9, Math.PI*1.7); g.stroke(); }
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16), new THREE.MeshBasicMaterial({ map:moonTex, fog:false }));
  moon.position.set(-120, 95, -230); scene.add(moon);
  const mg = glowSprite(0xb8a8ff, 110, .55); mg.material.fog = false; mg.position.copy(moon.position); scene.add(mg);
})();

// aurora ribbons
const auroraMats = [];
(function aurora(){
  const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const fs = `uniform float t; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
    void main(){ float w = sin(vUv.x*18.0 + t*.6)*.5 + sin(vUv.x*41.0 - t*.9)*.25;
      float band = smoothstep(0.0,.35,vUv.y) * (1.0 - smoothstep(.45,1.0,vUv.y));
      float streak = .55 + .45*sin(vUv.x*120.0 + w*6.0);
      vec3 col = mix(c1, c2, vUv.y + w*.2);
      gl_FragColor = vec4(col, band*streak*(.55+w*.3)*.55); }`;
  [[0x3cffb0, 0x7a5cff, -160, 70, 0], [0x4fd6ff, 0xff5cc8, -200, 95, .9], [0x7affd2, 0x5c7aff, -180, 60, -1.1]].forEach(([a,b,r,y,rot],i) => {
    const m = new THREE.ShaderMaterial({ vertexShader:vs, fragmentShader:fs, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      uniforms:{ t:{ value:i*3 }, c1:{ value:new THREE.Color(a) }, c2:{ value:new THREE.Color(b) } } });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(-r, -r, 60, 64, 1, true, 0, Math.PI*.7), m);
    mesh.position.y = y; mesh.rotation.y = rot + 2.2; scene.add(mesh); auroraMats.push(m);
  });
})();

scene.add(new THREE.HemisphereLight(0xaab6ff, 0x4a3860, .85));
scene.add(new THREE.AmbientLight(0x8a80b8, .18));
const moonLight = new THREE.DirectionalLight(0xdde2ff, 1.2);
moonLight.position.set(-20, 34, -14);
moonLight.castShadow = true; moonLight.shadow.mapSize.set(4096, 4096);
Object.assign(moonLight.shadow.camera, { left:-24, right:24, top:24, bottom:-24, near:1, far:110 });
moonLight.shadow.camera.layers.enable(1); moonLight.shadow.camera.layers.enable(2);
moonLight.shadow.bias = -0.0006;
scene.add(moonLight);
const rimLight = new THREE.DirectionalLight(0xffa86a, .45); rimLight.position.set(12, 6, 14); scene.add(rimLight);

/* ---------- Arena floor ---------- */
function floorTexture(){
  return canvasTex(2048, 2048, (g, s) => {
    const cx = s/2, px = cx/R;
    g.fillStyle = '#2a2442'; g.fillRect(0, 0, s, s);
    // flagstones in concentric rings
    let r0 = 0, ring = 0;
    while (r0 < cx){
      const w = ring === 0 ? 150 : 70 + Math.random()*40, r1 = Math.min(cx, r0 + w);
      const n = ring === 0 ? 1 : Math.max(6, Math.round(2*Math.PI*((r0 + r1)/2)/(85 + Math.random()*50)));
      const off = Math.random(), gap = 3.5;
      for (let k = 0; k < n; k++){
        const a0 = (k + off)/n*Math.PI*2 + (ring ? gap/((r0 + r1)/2) : 0), a1 = (k + 1 + off)/n*Math.PI*2 - (ring ? gap/((r0 + r1)/2) : 0);
        const hue = 245 + Math.random()*20, sat = 8 + Math.random()*12, lit = 39 + Math.random()*12 + (r0 < cx*.3 ? 4 : 0);
        g.beginPath();
        if (ring === 0) g.arc(cx, cx, r1 - gap, 0, Math.PI*2);
        else { g.arc(cx, cx, r1 - gap, a0, a1); g.arc(cx, cx, r0 + gap, a1, a0, true); g.closePath(); }
        g.fillStyle = `hsl(${hue},${sat}%,${lit}%)`; g.fill();
        g.save(); g.clip();
        for (let i = 0; i < 18; i++){ g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random()*.07})`;
          const a = a0 + Math.random()*(a1 - a0 || 6.28), rr = r0 + Math.random()*(r1 - r0); g.beginPath(); g.arc(cx + Math.cos(a)*rr, cx + Math.sin(a)*rr, 4 + Math.random()*14, 0, 6.28); g.fill(); }
        g.restore();
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.07)'; g.stroke();
      }
      r0 = r1; ring++;
    }
    // moss creeping in the joints near the rim
    for (let i = 0; i < 900; i++){
      const a = Math.random()*Math.PI*2, rr = cx*(.55 + Math.random()*.45);
      g.fillStyle = `rgba(${70 + Math.random()*40},${120 + Math.random()*50},${60 + Math.random()*30},${.15 + Math.random()*.3})`;
      g.beginPath(); g.arc(cx + Math.cos(a)*rr, cx + Math.sin(a)*rr, 2 + Math.random()*7, 0, 6.28); g.fill();
    }
    // cracks
    g.strokeStyle = 'rgba(8,6,20,.55)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++){ let x = Math.random()*s, y = Math.random()*s; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++){ x += (Math.random()-.5)*70; y += (Math.random()-.5)*70; g.lineTo(x, y); } g.stroke(); }
    // gilded inlays
    const gold = (r, wdt) => { g.lineWidth = wdt; g.strokeStyle = '#c9a24f'; g.beginPath(); g.arc(cx, cx, r, 0, 6.28); g.stroke(); g.lineWidth = 1.5; g.strokeStyle = '#f3dc9a'; g.beginPath(); g.arc(cx, cx, r - wdt*.25, 0, 6.28); g.stroke(); };
    gold(cx - 14, 10); gold(cx - 70, 5); gold(px*5.6, 6); gold(px*2.6, 5);
    // mosaic band
    const nT = 120;
    for (let k = 0; k < nT; k++){
      const a0 = k/nT*6.28, a1 = (k + .8)/nT*6.28, cols = ['#1f6f78', '#c9a24f', '#5a3f8f'];
      g.fillStyle = cols[k % 3]; g.beginPath(); g.arc(cx, cx, cx - 24, a0, a1); g.arc(cx, cx, cx - 60, a1, a0, true); g.closePath(); g.fill();
    }
    // eight-pointed star rays between inner rings
    g.save(); g.translate(cx, cx);
    for (let k = 0; k < 16; k++){
      g.rotate(Math.PI/8); const long = k % 2 === 0;
      g.beginPath(); g.moveTo(0, -px*2.6); g.lineTo(long ? 22 : 14, -px*(long ? 5.6 : 4.4)); g.lineTo(0, -px*(long ? 6.4 : 4.8)); g.lineTo(long ? -22 : -14, -px*(long ? 5.6 : 4.4)); g.closePath();
      g.fillStyle = long ? 'rgba(201,162,79,.85)' : 'rgba(31,111,120,.8)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#f3dc9a'; g.stroke();
    }
    g.restore();
  });
}
const masonryTex = canvasTex(1024, 128, (g, w, h) => {
  g.fillStyle = '#2c2440'; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 3; row++){
    const y = row*40 + 6, off = row % 2 ? 32 : 0;
    for (let x = -off; x < w; x += 64){
      const l = 37 + Math.random()*10; g.fillStyle = `hsl(258,14%,${l}%)`; g.fillRect(x + 3, y, 58, 34);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 3, y, 58, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 3, y + 30, 58, 4);
    }
  }
  g.fillStyle = '#c9a24f'; g.fillRect(0, 0, w, 5);
});
masonryTex.wrapS = THREE.RepeatWrapping; masonryTex.repeat.set(14, 1);
const rockMat = toon(0x3b2c4a, { flatShading:true });
const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R*.985, 1.4, 160),
  [toon(0xffffff, { map:masonryTex }), toon(0xffffff, { map:floorTexture() }), rockMat]);
floor.position.y = -.7; floor.receiveShadow = true; scene.add(floor);
const floorOut = new THREE.Mesh(new THREE.CylinderGeometry(R*1.006, R*.99, 1.42, 160), OUT); floorOut.position.y = -.7; scene.add(floorOut);
// carved lip and corbels under the rim
addMesh(new THREE.CylinderGeometry(R*.99, R*.95, .6, 120), toon(0x40345a, { flatShading:true }), scene, 0, -1.7, 0, 1.01);
scatter(new THREE.BoxGeometry(.5, .7, .9), toon(0x4a3d66, { flatShading:true }), 90, (d, i) => {
  const a = i/90*Math.PI*2; d.position.set(Math.cos(a)*(R*.97), -2.2, Math.sin(a)*(R*.97)); d.rotation.y = -a; d.scale.y = i % 2 ? 1 : .7;
});

function jaggedCone(radius, height, seg, jitter, color){
  const geo = new THREE.ConeGeometry(radius, height, seg, 6, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++){
    const y = p.getY(i); if (y > height/2 - .01) continue;
    const k = 1 + (Math.random()-.5)*jitter;
    p.setX(i, p.getX(i)*k); p.setZ(i, p.getZ(i)*k); p.setY(i, y + (Math.random()-.5)*jitter*2);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toon(color, { flatShading:true }));
}
// island underside: rock strata
const under = jaggedCone(R*.95, 28, 26, .28, 0x3b2c4a); under.rotation.x = Math.PI; under.position.y = -16.2; scene.add(under);
const strata = jaggedCone(R*.9, 9, 26, .2, 0x5a3f4a); strata.rotation.x = Math.PI; strata.position.y = -6.6; strata.scale.set(1.04, 1, 1.04); scene.add(strata);
const strata2 = jaggedCone(R*.6, 10, 18, .3, 0x4a3448); strata2.rotation.x = Math.PI; strata2.position.y = -17; strata2.scale.set(1.15, 1, 1.15); scene.add(strata2);
for (let i = 0; i < 14; i++){
  const a = Math.random()*Math.PI*2, d = 4 + Math.random()*11, cr = jaggedCone(1 + Math.random()*1.8, 5 + Math.random()*8, 7, .4, 0x2e2240);
  cr.rotation.x = Math.PI; cr.position.set(Math.cos(a)*d, -24 - Math.random()*10, Math.sin(a)*d); scene.add(cr);
}
// glowing crystal clusters on the underside
const crystalMat = new THREE.MeshBasicMaterial({ color:0x9d7bff });
scatter(new THREE.OctahedronGeometry(.4, 0), crystalMat, 90, (d, i) => {
  const cl = Math.floor(i/5), a = cl/18*Math.PI*2 + (cl % 3)*.3, depth = 2.6 + (cl % 4)*2.5, rad = R*(.92 - depth*.03);
  d.position.set(Math.cos(a)*rad + rnd(-.6,.6), -depth + rnd(-.5,.5), Math.sin(a)*rad + rnd(-.6,.6));
  d.rotation.set(rnd(-.7,.7), rnd(0,3), rnd(-.7,.7)); d.scale.set(rnd(.4,.9), rnd(1.4,3), rnd(.4,.9));
  return [0x9d7bff, 0x7fd8ff, 0xc89dff][i % 3];
});
// hanging roots
scatter(new THREE.CylinderGeometry(.03, .07, 1, 5), toon(0x3a2a22), 160, (d, i) => {
  const a = Math.random()*Math.PI*2, rad = R*(.9 + Math.random()*.08), len = rnd(1.5, 6);
  d.position.set(Math.cos(a)*rad, -1.9 - len/2, Math.sin(a)*rad); d.scale.y = len; d.rotation.set(rnd(-.15,.15), 0, rnd(-.15,.15));
});
// waterfalls spilling from caves in the cliff
const fallTex = canvasTex(64, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 70; i++){ const x = Math.random()*w, y = Math.random()*h, l = 20 + Math.random()*70;
    const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.5,`rgba(220,240,255,${.4 + Math.random()*.5})`); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, 1.5 + Math.random()*3, l); g.fillRect(x, y - h, 1.5 + Math.random()*3, l); }
});
fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; fallTex.repeat.set(2, 3);
[.6, 2.5, 4.4].forEach(a => {
  const rad = R*.96, x = Math.cos(a)*rad, z = Math.sin(a)*rad;
  const cave = addMesh(new THREE.BoxGeometry(3.4, 1.6, 1.2), toon(0x0d0a18), scene, x, -3.2, z); cave.rotation.y = -a + Math.PI/2;
  const mat = new THREE.MeshBasicMaterial({ map:fallTex, color:0xbfe6ff, transparent:true, opacity:.8, depthWrite:false, side:THREE.DoubleSide });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 50, 1, 8), mat);
  fall.position.set(Math.cos(a)*(rad + .7), -28, Math.sin(a)*(rad + .7)); fall.rotation.y = -a + Math.PI/2; scene.add(fall);
  const pos = fall.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++){ const y = pos.getY(i); pos.setZ(i, Math.pow((25 - y)/50, 2)*2.2); }
  for (let i = 0; i < 6; i++){ const m = glowSprite(0xdff2ff, rnd(2, 4), .25); m.material.blending = THREE.NormalBlending; m.position.set(Math.cos(a)*(rad + 1.2), -3.8 - i*.4, Math.sin(a)*(rad + 1.2)); scene.add(m); }
});
worldAnims.push(dt => { fallTex.offset.y -= dt*1.4; });

// edge rune ring and center sigil
const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(R - .12, .08, 6, 240), new THREE.MeshBasicMaterial({ color:0xffd27a }));
edgeRing.rotation.x = Math.PI/2; edgeRing.position.y = .03; scene.add(edgeRing);
function runeTexture(){
  return canvasTex(1024, 1024, (g, s) => {
    const cx = s/2; g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    const ring = (r, wd) => { g.lineWidth = wd; g.beginPath(); g.arc(cx, cx, r, 0, 6.28); g.stroke(); };
    ring(490, 8); ring(410, 5); ring(300, 3); ring(140, 6);
    g.lineWidth = 6;
    for (let k = 0; k < 36; k++){
      g.save(); g.translate(cx, cx); g.rotate(k/36*6.28); g.translate(0, -450);
      g.beginPath(); const t = k % 5;
      if (t === 0){ g.moveTo(-14,-18); g.lineTo(0,18); g.lineTo(14,-18); }
      else if (t === 1){ g.moveTo(0,-20); g.lineTo(0,20); g.moveTo(-14,-4); g.lineTo(14,-14); }
      else if (t === 2){ g.arc(0,0,14,0,Math.PI*1.5); }
      else if (t === 3){ g.moveTo(-14,18); g.lineTo(0,-18); g.lineTo(14,18); g.moveTo(-8,5); g.lineTo(8,5); }
      else { g.moveTo(-14,0); g.lineTo(14,0); g.moveTo(0,-18); g.lineTo(-10,18); g.moveTo(0,-18); g.lineTo(10,18); }
      g.stroke(); g.restore();
    }
    g.lineWidth = 4;
    for (let k = 0; k < 6; k++){ const a = k/6*6.28; g.beginPath(); g.moveTo(cx + Math.cos(a)*410, cx + Math.sin(a)*410); g.lineTo(cx + Math.cos(a + 2.094)*410, cx + Math.sin(a + 2.094)*410); g.stroke(); }
    for (let k = 0; k < 12; k++){ const a = k/12*6.28; g.beginPath(); g.arc(cx + Math.cos(a)*300, cx + Math.sin(a)*300, 16, 0, 6.28); g.stroke(); }
  });
}
const sigil = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map:runeTexture(), color:0x9d7bff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
sigil.rotation.x = -Math.PI/2; sigil.position.y = .025; scene.add(sigil);

/* ---------- Columns ---------- */
const COLS = [];
const bannerList = [];
const marble = rimToon(0xd8d0e6, 0x9db6ff, null, .35), marbleDark = rimToon(0x9a91b4, 0x9db6ff, null, .3);
function flutedColumn(h){
  const geo = new THREE.CylinderGeometry(.52, .58, h, 32, Math.max(2, Math.round(h*2)));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), z = p.getZ(i), th = Math.atan2(x, z), k = 1 - .055*(.5 + .5*Math.cos(th*16));
    p.setX(i, x*k); p.setZ(i, z*k);
    if (p.getY(i) > h/2 - .01){ p.setY(i, h/2 + (Math.random() - .5)*.35); }
  }
  geo.computeVertexNormals(); return geo;
}
const ivyMat = toon(0x2f6b3e), rubbleMat = toon(0x8e86a8, { flatShading:true });
const ivySpots = [], rubbleSpots = [];
[[Math.PI/4, 2.6, 7.5],[3*Math.PI/4, 3.4, 7.5],[5*Math.PI/4, 1.9, 7.5],[7*Math.PI/4, 3.0, 7.5],
 [0, 3.6, 13.5],[Math.PI/2, 2.4, 13.5],[Math.PI, 3.2, 13.5],[3*Math.PI/2, 2.8, 13.5],
 [Math.PI/8, 2.2, 15.5],[9*Math.PI/8, 3.0, 15.5]].forEach(([a, h, rad], i) => {
  const x = Math.cos(a)*rad, z = Math.sin(a)*rad, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = i; scene.add(g);
  addMesh(new THREE.BoxGeometry(1.7, .3, 1.7), marbleDark, g, 0, .15, 0, 1.03);
  addMesh(new THREE.CylinderGeometry(.74, .8, .22, 24), marble, g, 0, .41, 0, 1.03);
  addMesh(new THREE.TorusGeometry(.66, .08, 8, 24), marble, g, 0, .56, 0, 1.04).rotation.x = Math.PI/2;
  addMesh(flutedColumn(h), marble, g, 0, .6 + h/2, 0, 1.03);
  if (i % 3 === 0){
    // intact capital on some columns
    addMesh(new THREE.CylinderGeometry(.72, .55, .3, 24), marble, g, 0, .6 + h + .1, 0, 1.04);
    addMesh(new THREE.BoxGeometry(1.6, .22, 1.6), marbleDark, g, 0, .6 + h + .36, 0, 1.03);
  } else {
    const chunk = addMesh(new THREE.DodecahedronGeometry(.42, 0), marble, g, .2, .6 + h + .1, .1, 1.06); chunk.rotation.set(.4, i, .3);
  }
  const fall = addMesh(new THREE.CylinderGeometry(.48, .48, 1.2, 24), marble, scene, 0, 0, 0, 1.04);
  fall.position.set(Math.cos(a + .3)*(rad + 1.6), .45, Math.sin(a + .3)*(rad + 1.6)); fall.rotation.set(Math.PI/2, 0, a + i);
  COLS.push({ x:fall.position.x, z:fall.position.z, r:.55 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(.56, .035, 4, 32), new THREE.MeshBasicMaterial({ color:0x9d7bff }));
  band.rotation.x = Math.PI/2; band.position.y = .6 + h*.55; g.add(band);
  COLS.push({ x, z, r:.64 });
  ivySpots.push({ x, z, h }); rubbleSpots.push({ x, z });
  // banners on the outer columns
  if (rad === 13.5) banner(g, h, i);
});
scatter(new THREE.BoxGeometry(.16, .02, .12), ivyMat, 10*70, (d, i) => {
  const s = ivySpots[Math.floor(i/70)], t = (i % 70)/70, a = t*9 + Math.floor(i/70);
  const r = .6; d.position.set(s.x + Math.sin(a)*r, .6 + t*s.h*.9, s.z + Math.cos(a)*r); d.rotation.set(rnd(-1,1), a, rnd(-1,1));
  return [0x2f6b3e, 0x3f8a4a, 0x285a36][i % 3];
});
scatter(new THREE.DodecahedronGeometry(.2, 0), rubbleMat, 10*14, (d, i) => {
  const s = rubbleSpots[Math.floor(i/14)], a = Math.random()*6.28, r = rnd(.9, 1.7);
  d.position.set(s.x + Math.cos(a)*r, .08, s.z + Math.sin(a)*r); d.scale.setScalar(rnd(.4, 1.4)); d.rotation.set(rnd(0,3), rnd(0,3), 0);
}, { cast:true });

function emblem(g, type, cx, cy, s, color){
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = s*.08; g.beginPath();
  switch (type){
    case 'flame': g.moveTo(cx, cy - s); g.quadraticCurveTo(cx + s*.8, cy - s*.1, cx + s*.45, cy + s*.6); g.quadraticCurveTo(cx, cy + s, cx - s*.45, cy + s*.6); g.quadraticCurveTo(cx - s*.8, cy - s*.1, cx, cy - s); g.fill(); break;
    case 'flake': for (let k = 0; k < 6; k++){ const a = k/6*6.28; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a)*s, cy + Math.sin(a)*s); g.moveTo(cx + Math.cos(a)*s*.55, cy + Math.sin(a)*s*.55); g.lineTo(cx + Math.cos(a + .5)*s*.8, cy + Math.sin(a + .5)*s*.8); } g.stroke(); break;
    case 'crescent': g.arc(cx, cy, s, .3, 5.98); g.arc(cx + s*.45, cy, s*.75, 5.6, .7, true); g.fill(); break;
    case 'star': for (let k = 0; k < 10; k++){ const a = k/10*6.28 - 1.57, r = k % 2 ? s*.42 : s; g.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); } g.closePath(); g.fill(); break;
    case 'mountain': g.moveTo(cx - s, cy + s*.7); g.lineTo(cx - s*.3, cy - s*.6); g.lineTo(cx, cy - s*.1); g.lineTo(cx + s*.35, cy - s*.9); g.lineTo(cx + s, cy + s*.7); g.closePath(); g.fill(); break;
    case 'bolt': g.moveTo(cx + s*.2, cy - s); g.lineTo(cx - s*.5, cy + s*.1); g.lineTo(cx, cy + s*.1); g.lineTo(cx - s*.2, cy + s); g.lineTo(cx + s*.5, cy - s*.15); g.lineTo(cx, cy - s*.15); g.closePath(); g.fill(); break;
  }
}
function banner(colGroup, h, i){
  const kinds = [['flame', '#8a1f1a', '#e8c76a'], ['flake', '#1f3f80', '#bfeeff'], ['bolt', '#3a2a6b', '#fff04a'], ['mountain', '#2e3b26', '#a8e07a']][i % 4];
  const tex = canvasTex(128, 320, (g, w, hh) => {
    g.fillStyle = kinds[1]; g.fillRect(0, 0, w, hh);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, hh*.6, w, hh*.4);
    g.fillStyle = '#c9a24f'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 8, hh); g.fillRect(w - 8, 0, 8, hh);
    emblem(g, kinds[0], w/2, hh*.38, 40, kinds[2]);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, hh); g.lineTo(w/2, hh - 40); g.lineTo(w, hh); g.closePath(); g.fill();
  });
  const pole = addMesh(new THREE.CylinderGeometry(.04, .04, 1.6, 6), toon(0x5a3b22), colGroup, 0, .6 + h - .1, 0, 1.15); pole.rotation.z = Math.PI/2;
  const geo = new THREE.PlaneGeometry(1.3, 2.6, 4, 10); geo.translate(0, -1.3, 0);
  const m = new THREE.Mesh(geo, toon(0xffffff, { map:tex, side:THREE.DoubleSide, alphaTest:.5, transparent:false }));
  m.position.set(0, .6 + h - .15, .58); m.castShadow = true; colGroup.add(m);
  bannerList.push({ m, base:geo.attributes.position.array.slice(), ph:Math.random()*6 });
}
worldAnims.push((dt, t) => {
  for (const b of bannerList){
    const p = b.m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++){ const y = b.base[i*3+1], s = -y/2.6, x = b.base[i*3]; p.setZ(i, Math.sin(t*2.2 + s*3 + x + b.ph)*.12*s + s*s*.15); }
    p.needsUpdate = true; b.m.geometry.computeVertexNormals();
  }
});

/* ---------- Grass and flowers ---------- */
const grassMat = toon(0x4c8f4a);
const clumps = [];
for (let i = 0; i < 70; i++){
  let a = Math.random()*6.28, r = rnd(R*.55, R - .8);
  if (i < 30){ const c = COLS[(i*2 + 1) % COLS.length]; a = Math.atan2(c.z, c.x) + rnd(-.15, .15); r = Math.hypot(c.x, c.z) + rnd(-1.2, 1.2); }
  clumps.push({ x:Math.cos(a)*r, z:Math.sin(a)*r, n:rnd(.4, 1) });
}
const bladeGeo = new THREE.ConeGeometry(.035, .38, 3); bladeGeo.translate(0, .19, 0);
scatter(bladeGeo, grassMat, 2600, (d, i) => {
  const c = clumps[i % clumps.length], a = Math.random()*6.28, r = Math.random()*.9*c.n;
  d.position.set(c.x + Math.cos(a)*r, 0, c.z + Math.sin(a)*r); d.rotation.set(rnd(-.35,.35), rnd(0,3), rnd(-.35,.35)); d.scale.set(1, rnd(.5, 1.5), 1);
  return [0x4c8f4a, 0x5ea653, 0x3d7a44, 0x6fb35a][i % 4];
});
scatter(new THREE.IcosahedronGeometry(.06, 0), new THREE.MeshBasicMaterial({ color:0xffffff }), 220, (d, i) => {
  const c = clumps[i % clumps.length], a = Math.random()*6.28, r = Math.random()*.8*c.n;
  d.position.set(c.x + Math.cos(a)*r, rnd(.22, .4), c.z + Math.sin(a)*r);
  return [0xff9ad5, 0xfff07a, 0xc9b8ff, 0xffffff][i % 4];
});

/* ---------- Guardian statues ---------- */
function guardian(a){
  const stone = rimToon(0x8f88a6, 0x9db6ff, { flatShading:true }, .4), dk = toon(0x6a6382, { flatShading:true }), moss = toon(0x3f6b3a, { flatShading:true });
  const base = new THREE.Group(); base.position.set(Math.cos(a)*30, -3, Math.sin(a)*30); base.rotation.y = -a - Math.PI/2; scene.add(base);
  addMesh(new THREE.CylinderGeometry(3.4, 3, 1, 10), toon(0x4b6a4f, { flatShading:true }), base, 0, 0, 0, 1.02);
  const rock = jaggedCone(3.1, 10, 10, .35, 0x3b2c4a); rock.rotation.x = Math.PI; rock.position.y = -5.4; base.add(rock);
  const g = new THREE.Group(); g.position.y = .5; g.scale.setScalar(4.2); base.add(g);
  const M = (geo, m, x, y, z, ol) => addMesh(geo, m, g, x, y, z, ol ?? 1.04);
  M(new THREE.BoxGeometry(1.1, .2, .9), dk, 0, .1, 0);
  M(new THREE.CylinderGeometry(.24, .4, .9, 8, 1), stone, 0, .65, 0);
  M(new THREE.CylinderGeometry(.13, .1, .5, 7), stone, -.12, .3, 0); M(new THREE.CylinderGeometry(.13, .1, .5, 7), stone, .12, .3, 0);
  const chest = M(new THREE.CylinderGeometry(.36, .24, .55, 8), stone, 0, 1.35, 0); chest.scale.z = .75;
  M(new THREE.BoxGeometry(.3, .2, .1), dk, 0, 1.4, .2);
  for (const s of [-1, 1]){
    const pad = M(new THREE.SphereGeometry(.18, 8, 6, 0, 6.28, 0, 1.6), stone, s*.4, 1.55, 0); pad.scale.set(1.2, .9, 1);
    const up = M(new THREE.CylinderGeometry(.08, .07, .4, 6), stone, s*.36, 1.25, .12); up.rotation.x = -.6; up.rotation.z = s*.15;
    const fo = M(new THREE.CylinderGeometry(.08, .08, .35, 6), stone, s*.12, 1.05, .32); fo.rotation.z = s*1.2;
  }
  const helm = M(new THREE.SphereGeometry(.2, 10, 8), stone, 0, 1.82, .02); helm.scale.set(1, 1.15, 1.05);
  M(new THREE.BoxGeometry(.24, .04, .06), new THREE.MeshBasicMaterial({ color:0x9d7bff }), 0, 1.82, .2, 0);
  const plume = M(new THREE.BoxGeometry(.04, .2, .42), dk, 0, 2.02, -.05); plume.rotation.x = .3;
  const cape = M(new THREE.CylinderGeometry(.42, .55, 1.3, 10, 1, true, Math.PI*.6, Math.PI*.8), dk, 0, 1.0, -.05, 0); cape.material = dk;
  // sword planted in front, hands on the pommel
  M(new THREE.BoxGeometry(.1, 1.1, .03), stone, 0, .55, .45);
  M(new THREE.BoxGeometry(.42, .06, .08), dk, 0, 1.12, .45);
  M(new THREE.CylinderGeometry(.03, .03, .22, 6), dk, 0, 1.25, .45);
  M(new THREE.SphereGeometry(.05, 6, 4), dk, 0, 1.38, .45);
  for (let i = 0; i < 6; i++) M(new THREE.DodecahedronGeometry(rnd(.04, .09), 0), moss, rnd(-.35,.35), rnd(.2, 1.7), rnd(-.2,.3), 1.08);
  const eyeGlow = glowSprite(0x9d7bff, 1.2, .8); eyeGlow.position.set(0, 1.82*4.2 + .5, .3*4.2); base.add(eyeGlow);
}
[Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4].forEach(guardian);

/* ---------- Floating braziers ---------- */
const braziers = [];
const bowlGeo = new THREE.LatheGeometry([[0,0],[.18,.02],[.32,.12],[.5,.32],[.58,.46],[.54,.5]].map(p => new THREE.Vector2(p[0], p[1])), 14);
for (let i = 0; i < 6; i++){
  const a = i/6*Math.PI*2 + .3, g = new THREE.Group(); g.position.set(Math.cos(a)*(R + 2.6), 2.6, Math.sin(a)*(R + 2.6)); scene.add(g);
  addMesh(bowlGeo, rimToon(0x7a5532, 0xffa040, { side:THREE.DoubleSide }, .5), g, 0, -.2, 0, 1.06);
  addMesh(new THREE.TorusGeometry(.56, .04, 6, 20), toon(0xc9a24f), g, 0, .3, 0, 1.1).rotation.x = Math.PI/2;
  for (let k = 0; k < 3; k++){ const ka = k/3*6.28; const leg = addMesh(new THREE.ConeGeometry(.06, .7, 5), toon(0x4a3320), g, Math.cos(ka)*.28, -.5, Math.sin(ka)*.28, 1.1); leg.rotation.set(Math.sin(ka)*.4, 0, -Math.cos(ka)*.4); leg.rotation.x += Math.PI; }
  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(.85, .02, 4, 40), new THREE.MeshBasicMaterial({ color:0xffb060 })); runeRing.rotation.x = Math.PI/2 + .3; runeRing.position.y = .1; g.add(runeRing);
  const coals = addMesh(new THREE.DodecahedronGeometry(.3, 0), new THREE.MeshBasicMaterial({ color:0xff5a1a }), g, 0, .22, 0, 0); coals.scale.y = .4;
  const fl = glowSprite(0xff8a2a, 1.8); fl.position.y = .65; g.add(fl);
  const fl2 = glowSprite(0xffe2a0, .8); fl2.position.y = .5; g.add(fl2);
  const pl = new THREE.PointLight(0xff8a3a, 1.3, 18, 1.6); pl.position.y = .8; g.add(pl);
  braziers.push({ g, fl, fl2, pl, a, ph:Math.random()*6, ring:runeRing });
}
worldAnims.push(dt => { for (const b of braziers){ b.ring.rotation.z += dt*.8; } });

/* ---------- Distant floating islands ---------- */
const isles = [];
function pine(g, x, z, s){
  addMesh(new THREE.CylinderGeometry(.08*s, .12*s, .6*s, 5), toon(0x4a3320), g, x, .3*s, z, 1.08);
  for (let k = 0; k < 3; k++) addMesh(new THREE.ConeGeometry((.6 - k*.15)*s, .8*s, 7), toon([0x2d5a46, 0x356b50, 0x3f7a58][k], { flatShading:true }), g, x, (.7 + k*.45)*s, z, 1.05);
}
function roundTree(g, x, z, s){
  addMesh(new THREE.CylinderGeometry(.08*s, .13*s, .8*s, 5), toon(0x4a3320), g, x, .4*s, z, 1.08);
  const crown = addMesh(new THREE.IcosahedronGeometry(.6*s, 0), toon([0x6a8f3a, 0x8a5aa8, 0xc0507a][Math.floor(Math.random()*3)], { flatShading:true }), g, x, 1.1*s, z, 1.05);
  crown.scale.y = .85;
}
for (let i = 0; i < 16; i++){
  const a = (i/16)*Math.PI*2 + rnd(-.15, .15), d = 40 + Math.random()*75, s = .9 + Math.random()*2.2;
  if (d < 70 && [1,3,5,7].some(k => Math.abs(angleWrap(a - k*Math.PI/4)) < .3)) continue;
  const g = new THREE.Group(); g.position.set(Math.cos(a)*d, -6 + Math.random()*18, Math.sin(a)*d); scene.add(g);
  addMesh(new THREE.CylinderGeometry(2.4*s, 2.2*s, .45*s, 11), toon(0x4f8a4a, { flatShading:true }), g, 0, 0, 0, 1.03);
  addMesh(new THREE.CylinderGeometry(2.2*s, 1.9*s, .7*s, 11), toon(0x6a4a3a, { flatShading:true }), g, 0, -.55*s, 0, 1.03);
  const bot = jaggedCone(1.9*s, 5*s, 10, .4, 0x3b2c4a); bot.rotation.x = Math.PI; bot.position.y = -3.4*s; g.add(bot);
  const nT = 1 + Math.floor(Math.random()*4);
  for (let k = 0; k < nT; k++){ const x = rnd(-1.4, 1.4)*s, z = rnd(-1.4, 1.4)*s; (Math.random() < .55 ? pine : roundTree)(g, x, z, s*rnd(.6, 1)); }
  if (Math.random() < .5){
    // little ruined arch
    const ax = rnd(-.8, .8)*s;
    addMesh(new THREE.BoxGeometry(.3*s, 1.6*s, .3*s), marble, g, ax - .6*s, 1*s, 0, 1.05);
    addMesh(new THREE.BoxGeometry(.3*s, 1.6*s, .3*s), marble, g, ax + .6*s, 1*s, 0, 1.05);
    addMesh(new THREE.BoxGeometry(1.6*s, .25*s, .35*s), marble, g, ax, 1.9*s, 0, 1.05);
  }
  if (Math.random() < .35){
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(.8*s, 14*s), new THREE.MeshBasicMaterial({ map:fallTex, color:0xbfe6ff, transparent:true, opacity:.7, depthWrite:false, side:THREE.DoubleSide }));
    wf.position.set(0, -7*s, 2.15*s); g.add(wf);
  }
  isles.push({ g, base:g.position.y, ph:Math.random()*6, sp:.3 + Math.random()*.4 });
}
function angleWrap(x){ while (x > Math.PI) x -= 6.283; while (x < -Math.PI) x += 6.283; return x; }

/* ---------- Mountains on the horizon ---------- */
for (let i = 0; i < 18; i++){
  const a = i/18*Math.PI*2 + rnd(-.1, .1), d = rnd(230, 300), h = rnd(70, 150), r = h*rnd(.45, .7);
  const m = jaggedCone(r, h, 9, .25, 0x221a3d); m.material.fog = false; m.material.color.setHSL(.72, .35, rnd(.1, .16));
  m.position.set(Math.cos(a)*d, -70 + h/2, Math.sin(a)*d); m.rotation.y = rnd(0, 3); scene.add(m);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r*.28, h*.28, 9), toon(0xbfb8e8, { fog:false, flatShading:true }));
  cap.position.set(m.position.x, -70 + h - h*.14 + .5, m.position.z); cap.rotation.y = m.rotation.y; scene.add(cap);
}

/* ---------- Cloud sea ---------- */
const cloudTex = canvasTex(256, 256, (g, s) => {
  for (let i = 0; i < 22; i++){
    const x = s/2 + rnd(-60, 60), y = s/2 + rnd(-30, 30), r = rnd(40, 90), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
});
for (let i = 0; i < 80; i++){
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:cloudTex, color:i % 3 ? 0x6a58a8 : 0x8a74c8, transparent:true, opacity:rnd(.5, .85), depthWrite:false }));
  const a = Math.random()*Math.PI*2, d = 18 + Math.random()*190; sp.position.set(Math.cos(a)*d, -36 - Math.random()*14, Math.sin(a)*d);
  sp.scale.set(rnd(40, 90), rnd(18, 34), 1); scene.add(sp);
}
for (let i = 0; i < 14; i++){
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:cloudTex, color:0x9a8ad0, transparent:true, opacity:.18, depthWrite:false, fog:false }));
  const a = Math.random()*Math.PI*2, d = 140 + Math.random()*80; sp.position.set(Math.cos(a)*d, rnd(15, 45), Math.sin(a)*d); sp.scale.set(rnd(60, 110), rnd(12, 20), 1); scene.add(sp);
}

/* ================= Particles & effects ================= */
const sparks = [];
for (let i = 0; i < 220; i++){ const s = glowSprite(0xffffff, .3); s.visible = false; scene.add(s); sparks.push({ s, v:new V3(), life:0, max:1, size:.3, grav:14 }); }
let sparkIdx = 0;
function spark(pos, color, vel, life, size, grav){
  const p = sparks[sparkIdx++ % sparks.length];
  p.s.position.copy(pos); p.s.material.color.set(color); p.s.visible = true; p.v.copy(vel);
  p.life = p.max = life; p.size = size; p.grav = grav ?? 14;
}
function burst(pos, color, n, power, size){
  for (let i = 0; i < n; i++){
    const v = new V3(Math.random()-.5, Math.random()*.9 - .1, Math.random()-.5).normalize().multiplyScalar(power*(.4 + Math.random()));
    spark(pos, color, v, .3 + Math.random()*.3, (size || .35)*(.6 + Math.random()*.8));
  }
}
function updateSparks(dt){
  for (const p of sparks){ if (!p.s.visible) continue;
    p.life -= dt; if (p.life <= 0){ p.s.visible = false; continue; }
    p.v.y -= p.grav*dt; p.s.position.addScaledVector(p.v, dt);
    const k = p.life/p.max; p.s.material.opacity = k; p.s.scale.setScalar(p.size*(.4 + k*.6));
  }
}
const effects = [];
function addEffect(obj, dur, fn){ scene.add(obj); effects.push({ obj, t:0, dur, fn }); fn(obj, 0); }
function updateEffects(dt){
  for (let i = effects.length - 1; i >= 0; i--){
    const e = effects[i]; e.t += dt; const k = Math.min(1, e.t/e.dur); e.fn(e.obj, k);
    if (k >= 1){ scene.remove(e.obj); e.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== OUT && o.material.map !== glowTex) o.material.dispose(); }); effects.splice(i, 1); }
  }
}
const addMat = color => new THREE.MeshBasicMaterial({ color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
function boomEffect(p, radius, color){
  const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), addMat(color)); g.add(sph);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), addMat(0xffffff)); g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), addMat(color)); ring.rotation.x = -Math.PI/2; ring.position.y = .1 - p[1]; g.add(ring);
  addEffect(g, .6, (o, k) => {
    const e = 1 - Math.pow(1 - k, 3);
    sph.scale.setScalar(.3 + e*radius); sph.material.opacity = (1 - k)*.6;
    core.scale.setScalar((.2 + e*radius*.5)*(1 - k)); core.material.opacity = 1 - k;
    ring.scale.setScalar(.3 + e*(radius + 1.2)); ring.material.opacity = (1 - k)*.9;
  });
  const c = new V3(p[0], p[1], p[2]);
  for (let i = 0; i < 10 + radius*6; i++){
    const a = Math.random()*Math.PI*2, v = new V3(Math.cos(a), Math.random()*.8 + .1, Math.sin(a)).multiplyScalar(radius*(1.5 + Math.random()*1.5));
    spark(c, Math.random() < .5 ? color : 0xffffff, v, .4 + Math.random()*.4, .5 + Math.random()*.6, 6);
  }
}
function lineEffect(p, color, width, dur){
  const a = new V3(p[0], p[1], p[2]), b = new V3(p[3], p[4], p[5]), dir = b.clone().sub(a), len = Math.max(.1, dir.length());
  const g = new THREE.Group(); g.position.copy(a).addScaledVector(dir, .5);
  g.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 12, 1, true), addMat(color)); g.add(outer);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(width*.33, width*.33, len, 8, 1, true), addMat(0xffffff)); g.add(core);
  addEffect(g, dur, (o, k) => { const w = 1 - k*k; outer.scale.set(w, 1, w); core.scale.set(w, 1, w); outer.material.opacity = (1 - k)*.8; core.material.opacity = 1 - k; });
  for (let i = 0; i < 6 + len; i++){
    const q = a.clone().addScaledVector(dir, Math.random());
    spark(q, Math.random() < .5 ? color : 0xffffff, new V3((Math.random()-.5)*3, Math.random()*2, (Math.random()-.5)*3), .3 + Math.random()*.4, .35, 2);
  }
}
function zigzag(p, color){
  // lightning: jagged segments between two points
  const a = new V3(p[0], p[1], p[2]), b = new V3(p[3], p[4], p[5]), n = 8, pts = [a.clone()];
  for (let i = 1; i < n; i++){ const q = a.clone().lerp(b, i/n); q.x += (Math.random()-.5)*.9; q.y += (Math.random()-.5)*.9; q.z += (Math.random()-.5)*.9; pts.push(q); }
  pts.push(b.clone());
  for (let i = 0; i < n; i++) lineEffect([pts[i].x, pts[i].y, pts[i].z, pts[i+1].x, pts[i+1].y, pts[i+1].z], color, .12, .35);
}
function markEffect(p, radius, delay, color){
  const g = new THREE.Group(); g.position.set(p[0], .06, p[2]);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius*.9, radius, 40), addMat(color)); ring.rotation.x = -Math.PI/2; g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), addMat(color)); fill.rotation.x = -Math.PI/2; g.add(fill);
  addEffect(g, delay, (o, k) => { ring.material.opacity = .5 + .5*Math.sin(k*30); fill.scale.setScalar(Math.max(.01, k)); fill.material.opacity = .35; });
}
function quakeEffect(p, radius){
  boomEffect([p[0], .2, p[2]], radius*.5, 0x9b8a6a);
  const c = new V3(p[0], .3, p[2]);
  for (let i = 0; i < 40; i++){
    const a = Math.random()*Math.PI*2, d = Math.random()*radius;
    spark(new V3(c.x + Math.cos(a)*d, .2, c.z + Math.sin(a)*d), Math.random() < .5 ? 0x8a7a5a : 0x7dff5a, new V3(0, 4 + Math.random()*5, 0), .6, .7, 14);
  }
}

/* ================= Characters ================= */
const lerpAngle = (a, b, t) => a + angleDiff(a, b)*t;
function angleDiff(a, b){ let d = (b - a) % (Math.PI*2); if (d > Math.PI) d -= Math.PI*2; if (d < -Math.PI) d += Math.PI*2; return d; }
function pushFromCols(p){
  for (const c of COLS){ const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + .42;
    if (d < m && d > 1e-4){ p.x = c.x + dx/d*m; p.z = c.z + dz/d*m; } }
}
const M_ = (start, active, rec, dmg, range, kb, stun, anim, extra) => Object.assign({ start, active, rec, dmg, range, kb, stun, anim }, extra || {});
const CHARS = {
  kor:{ name:'Kor', tag:'Ateş dövüşçüsü', weapon:'Alev eldivenleri', ui:'#ff8a3d',
    armor:0x2b2633, trim:0xa8743a, cloth:0xb5281c, dark:0x18141f, glow:0xff6a1a, head:'horns', wep:'gauntlet',
    light:M_(.07,.1,.17,6,1.9,3.2,.24,'punch'), heavy:M_(.17,.12,.3,12,2.3,8,.4,'kick'),
    q:{ name:'Ateş topu', cost:25, cd:.5, windup:.16, total:.42, pose:'throw', bot:'far', act:f => shoot(f, 'fireball') },
    f:{ name:'Alev atılışı', cd:6, windup:.1, total:.5, pose:'dash', bot:'gap', act:f => rush(f, { speed:24, time:.36, dmg:12, kb:10, stun:.5, color:0xff6a1a, hitFx:'kick' }) },
    r:{ name:'Alev patlaması', windup:.45, total:1.0, pose:'slamUp', bot:'close', act:f => nova(f, { radius:5.5, dmg:24, kb:18, stun:.7, color:0xff6a1a, aoe:true }) } },
  ayaz:{ name:'Ayaz', tag:'Buz mızrakçısı', weapon:'Buz mızrağı', ui:'#8fe6ff',
    armor:0xe3e9f5, trim:0x7f8fb8, cloth:0x1f4fa0, dark:0x2a3350, glow:0x4fd6ff, head:'crest', wep:'spear',
    light:M_(.1,.1,.2,7,2.9,3.5,.26,'stab'), heavy:M_(.2,.14,.32,12,3.1,8,.4,'slash'),
    q:{ name:'Buz mızrağı', cost:25, cd:.5, windup:.16, total:.42, pose:'throw', bot:'far', act:f => shoot(f, 'icespear') },
    f:{ name:'Don çemberi', cd:7, windup:.25, total:.6, pose:'slamUp', bot:'close', act:f => nova(f, { radius:3.8, dmg:6, kb:2, freeze:1.1, color:0x4fd6ff, aoe:true, frost:true }) },
    r:{ name:'Buz hapsi', windup:.35, total:.9, pose:'aim2', bot:'line', act:f => beam(f, { range:24, width:1.1, dmg:14, freeze:2.0, color:0x4fd6ff }) } },
  ruzgar:{ name:'Rüzgâr', tag:'Kılıç ustası', weapon:'Katana', ui:'#7affd2', speed:1.1,
    armor:0x1f1f27, trim:0xc23b3b, cloth:0x7a1d1d, dark:0x0f0f14, glow:0x7affd2, head:'kabuto', wep:'katana',
    light:M_(.07,.1,.16,7,2.5,3,.24,'slash'), heavy:M_(.18,.12,.3,14,2.7,7,.42,'overhead'),
    q:{ name:'Rüzgâr kesiği', cost:25, cd:.5, windup:.14, total:.4, pose:'slashThrow', bot:'far', act:f => shoot(f, 'crescent') },
    f:{ name:'Ani kesik', cd:5, windup:.08, total:.45, pose:'dash', bot:'gap', act:f => rush(f, { speed:30, time:.28, dmg:14, kb:6, stun:.55, color:0x7affd2, hitFx:'cut' }) },
    r:{ name:'Bin kesik', windup:.3, total:1.4, pose:'flurry', bot:'any', act:f => thousandCuts(f) } },
  tetik:{ name:'Tetik', tag:'Silahşor', weapon:'Çift tabanca', ui:'#ffcf4a', speed:1.06,
    armor:0x6b4a2f, trim:0xc9a45c, cloth:0x3b2a20, dark:0x241a14, glow:0xffcf4a, head:'hat', wep:'guns',
    light:M_(.07,.1,.17,5,1.9,3,.22,'punch'), heavy:M_(.17,.12,.3,11,2.3,8,.4,'kick'),
    q:{ name:'Seri atış', cost:20, cd:.4, windup:.08, total:.42, pose:'aim1', bot:'far', act:f => { for (let i = 0; i < 3; i++) schedule(i*.08, () => { if (f.state !== 'ko' && f.state !== 'fall') shoot(f, 'bullet', i ? (Math.random()-.5)*.05 : 0); }); } },
    f:{ name:'El bombası', cd:5, windup:.2, total:.5, pose:'lob', bot:'far', act:f => shoot(f, 'grenade') },
    r:{ name:'Bombardıman', windup:.4, total:.9, pose:'callDown', bot:'any', act:f => barrage(f) } },
  kaya:{ name:'Kaya', tag:'Taş dev', weapon:'Savaş çekici', ui:'#a8e07a', speed:.86, scale:1.18, armorMult:.82,
    armor:0x77726a, trim:0x4a463f, cloth:0x3f4a2e, dark:0x2c2a26, glow:0x7dff5a, head:'stone', wep:'hammer',
    light:M_(.16,.12,.28,9,2.6,5,.32,'slash'), heavy:M_(.32,.14,.4,17,2.9,12,.5,'overhead'),
    q:{ name:'Kaya fırlat', cost:25, cd:.6, windup:.25, total:.55, pose:'lob', bot:'far', act:f => shoot(f, 'boulder') },
    f:{ name:'Yer dalgası', cd:6, windup:.3, total:.6, pose:'slam', bot:'far', act:f => shoot(f, 'wave') },
    r:{ name:'Deprem', windup:.55, total:1.1, pose:'quake', bot:'close', act:f => quake(f) } },
  volt:{ name:'Volt', tag:'Şimşek büyücüsü', weapon:'Yıldırım asası', ui:'#fff04a',
    armor:0x3a2a6b, trim:0xe8c76a, cloth:0x2b1d55, dark:0x1a1236, glow:0xfff04a, head:'hood', wep:'staff',
    light:M_(.08,.1,.18,6,2.5,3,.24,'stab'), heavy:M_(.18,.2,.3,11,2.6,7,.4,'spin', { spin:true }),
    q:{ name:'Şimşek', cost:25, cd:.5, windup:.14, total:.4, pose:'aim1', bot:'far', act:f => bolt(f, { range:30, dmg:10, kb:3, stun:.4, color:0xfff04a }) },
    f:{ name:'Işınlanma', cd:4, windup:.08, total:.3, pose:'aim2', bot:'escape', act:f => blink(f) },
    r:{ name:'Fırtına', windup:.4, total:1.0, pose:'callDown', bot:'any', act:f => storm(f) } }
};
const POWER_CD = 5;
for (const id in CHARS){ CHARS[id].q.cd = POWER_CD; CHARS[id].f.cd = POWER_CD; }
const CHAR_IDS = Object.keys(CHARS);

class Fighter {
  constructor(idx, charId){
    this.idx = idx; this.pos = new V3(); this.vel = new V3(); this.kb = new V3();
    this.buffer = null; this.flash = 0; this.combo = 0; this.comboT = 0; this.moveAmt = 0; this.pose = '';
    this.vel2 = new V3(); this.animVel = new V3(); this.prevPos = null; this.landT = 0; this.wasAir = false;
    this.setChar(charId); this.reset();
  }
  setChar(id){
    if (!CHARS[id]) id = 'kor';
    if (this.charId === id && this.root) return;
    if (this.root){ scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== OUT && !o.isSprite){ if (o.material.map && o.material.map !== glowTex) o.material.map.dispose(); o.material.dispose(); } }); }
    this.charId = id; this.cfg = CHARS[id];
    this.build();
    if (this.pos) this.apply();
  }
  build(){
    const c = this.cfg, h = c.head, stone = h === 'stone';
    const T = (col, ex, k) => rimToon(col, c.glow, ex, k ?? .45);
    const armor = T(c.armor), trim = T(c.trim, null, .35), cloth = T(c.cloth, { side:THREE.DoubleSide }, .3), dark = T(c.dark, null, .3), skin = T(0xc8946a, null, .3);
    const metal = T(0xd9dde6, null, .5), leather = T(0x5a3b22, null, .25);
    const glow = new THREE.MeshBasicMaterial({ color:c.glow });
    this.mats = [armor, trim, cloth, dark, skin, metal, leather];
    this.anims = [];
    const M = (geo, mat, parent, x, y, z, ol) => addMesh(geo, mat, parent, x, y, z, ol === 0 ? 0 : (ol || 1.08));
    const V2 = (a, b) => new THREE.Vector2(a, b);

    this.root = new THREE.Group(); scene.add(this.root);
    this.body = new THREE.Group(); this.body.scale.setScalar(c.scale || 1); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = .98; this.body.add(this.hips);

    /* ---- pelvis and waist ---- */
    M(new THREE.CylinderGeometry(.25, .21, .26, 14), dark, this.hips, 0, -.01, 0);
    M(new THREE.CylinderGeometry(.285, .285, .1, 16), leather, this.hips, 0, .09, 0, 1.05);
    M(new THREE.CylinderGeometry(.075, .075, .04, 6), trim, this.hips, 0, .09, .28, 1.1).rotation.x = Math.PI/2;
    M(new THREE.IcosahedronGeometry(.035, 0), glow, this.hips, 0, .09, .31, 0);
    for (const s of [-1, 1]) M(new THREE.BoxGeometry(.1, .12, .08), leather, this.hips, s*.25, .02, .1, 1.08).rotation.y = s*.5;
    if (h === 'kabuto'){
      for (let i = 0; i < 7; i++){ const a = -1.35 + i*.45 + (i > 3 ? 1.2 : 0); const pl = M(new THREE.BoxGeometry(.18, .34, .025), i % 2 ? trim : armor, this.hips, Math.sin(a)*.27, -.17, Math.cos(a)*.27, 1.07); pl.rotation.set(-.2*Math.cos(a), a, .2*Math.sin(a)); }
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) M(new THREE.BoxGeometry(.19, .025, .03), dark, this.hips, Math.sin(s*.45)*.29, -.06 - k*.1, Math.cos(s*.45)*.29, 0);
      // scabbard at the left hip
      const saya = M(new THREE.BoxGeometry(.05, 1.0, .07), dark, this.hips, .3, -.2, -.15, 1.1); saya.rotation.set(.9, 0, .25);
      M(new THREE.BoxGeometry(.06, .06, .08), trim, this.hips, .3, .1, .22, 1.1);
    } else if (h === 'hood'){
      const robe = M(new THREE.CylinderGeometry(.28, .62, .95, 18, 3, true), cloth, this.hips, 0, -.48, 0, 1.04);
      M(new THREE.TorusGeometry(.6, .025, 4, 30), new THREE.MeshBasicMaterial({ color:c.glow }), this.hips, 0, -.93, 0, 0).rotation.x = Math.PI/2;
      M(new THREE.BoxGeometry(.12, .8, .02), trim, this.hips, 0, -.45, .43, 0).rotation.x = -.28;
    } else if (h === 'hat'){
      const coat = M(new THREE.CylinderGeometry(.29, .52, .95, 18, 3, true, .55, Math.PI*2 - 1.1), cloth, this.hips, 0, -.47, 0, 1.04);
      for (const s of [-1, 1]){ const hol = M(new THREE.BoxGeometry(.09, .26, .12), leather, this.hips, s*.31, -.12, .02, 1.08); hol.rotation.z = s*.15; }
    } else if (stone){
      for (let i = 0; i < 8; i++){ const a = i/8*6.28; const r = M(new THREE.DodecahedronGeometry(.13, 0), armor, this.hips, Math.sin(a)*.27, -.12 - (i % 2)*.06, Math.cos(a)*.27, 1.08); r.rotation.set(i, i*2, 0); }
    } else {
      const fr = M(new THREE.BoxGeometry(.3, .36, .035), cloth, this.hips, 0, -.18, .22); fr.rotation.x = -.18;
      M(new THREE.BoxGeometry(.3, .04, .04), trim, this.hips, 0, -.35, .25, 0);
      const bk = M(new THREE.BoxGeometry(.36, .42, .035), cloth, this.hips, 0, -.2, -.21); bk.rotation.x = .18;
      for (const s of [-1, 1]){ const sp = M(new THREE.BoxGeometry(.2, .26, .04), armor, this.hips, s*.26, -.1, 0, 1.08); sp.rotation.set(0, s*1.57, s*.25); }
    }

    /* ---- torso ---- */
    this.torso = new THREE.Group(); this.torso.position.y = .12; this.hips.add(this.torso);
    M(new THREE.CylinderGeometry(.22, .25, .28, 14), dark, this.torso, 0, .13, 0);
    if (!stone) for (let i = 0; i < 3; i++) M(new THREE.BoxGeometry(.22 - i*.02, .065, .05), armor, this.torso, 0, .05 + i*.08, .2, 1.06);
    if (stone){
      const rocks = [[0, .5, .05, .36], [-.2, .62, 0, .25], [.2, .62, 0, .25], [0, .32, .1, .22]];
      rocks.forEach(([x, y, z, r], i) => { const m = M(new THREE.DodecahedronGeometry(r, 0), armor, this.torso, x, y, z, 1.06); m.rotation.set(i, i*1.3, 0); m.scale.z = .8; });
      for (let i = 0; i < 6; i++){ const cr = M(new THREE.BoxGeometry(.025, rnd(.15, .3), .02), glow, this.torso, rnd(-.25, .25), rnd(.3, .65), .31, 0); cr.rotation.z = rnd(-.8, .8); }
      for (let i = 0; i < 5; i++){ const cr = M(new THREE.OctahedronGeometry(.07, 0), glow, this.torso, rnd(-.25, .25), rnd(.4, .8), -.3, 0); cr.scale.y = rnd(2, 3.5); cr.rotation.set(-.5, 0, rnd(-.5, .5)); }
      M(new THREE.DodecahedronGeometry(.12, 0), toon(0x4f7a3a, { flatShading:true }), this.torso, .25, .72, .1, 1.1);
    } else {
      const chest = M(new THREE.LatheGeometry([V2(.24, 0), V2(.28, .08), V2(.33, .18), V2(.41, .33), V2(.43, .44), V2(.4, .54), V2(.3, .62), V2(.15, .67), V2(0, .68)], 16), armor, this.torso, 0, .2, 0);
      chest.scale.z = .72;
      const plate = M(new THREE.CylinderGeometry(.22, .16, .07, 6), trim, this.torso, 0, .58, .23, 1.08); plate.rotation.x = Math.PI/2 - .15; plate.scale.set(1.25, 1, .9);
      for (const s of [-1, 1]){ const pec = M(new THREE.BoxGeometry(.24, .16, .05), armor, this.torso, s*.14, .58, .25, 1.06); pec.rotation.set(-.2, s*.25, s*.1); }
    }
    this.core = M(new THREE.IcosahedronGeometry(.07, 0), glow, this.torso, 0, .58, .3, 0);
    const coreGlow = glowSprite(c.glow, .45, .8); coreGlow.position.set(0, .58, .32); this.torso.add(coreGlow);
    M(new THREE.TorusGeometry(.16, .045, 6, 16), trim, this.torso, 0, .78, 0, 1.06).rotation.x = Math.PI/2;
    M(new THREE.CylinderGeometry(.085, .1, .16, 10), h === 'hat' || h === 'hood' ? skin : dark, this.torso, 0, .85, 0);
    // character specific chest details
    if (h === 'horns'){
      for (let i = 0; i < 5; i++){ const cr = M(new THREE.BoxGeometry(.02, rnd(.1, .2), .015), glow, this.torso, rnd(-.28, .28), rnd(.3, .52), .28, 0); cr.rotation.z = rnd(-1, 1); }
      for (let i = 0; i < 3; i++){ const sp = M(new THREE.ConeGeometry(.05, .22, 5), trim, this.torso, 0, .5 + i*.08, -.3, 1.1); sp.rotation.x = -1.9; }
    } else if (h === 'crest'){
      for (let i = 0; i < 3; i++){ const cr = M(new THREE.OctahedronGeometry(.09, 0), glow, this.torso, (i - 1)*.16, .62 + (i === 1 ? .1 : 0), -.3, 0); cr.scale.y = i === 1 ? 4 : 3; cr.rotation.set(-.4, 0, (i - 1)*.4); }
    } else if (h === 'kabuto'){
      for (const s of [-1, 1]){ const lap = M(new THREE.BoxGeometry(.06, .55, .03), dark, this.torso, s*.05, .5, .28, 0); lap.rotation.set(-.15, 0, s*.55); }
      M(new THREE.TorusGeometry(.3, .025, 4, 20), trim, this.torso, 0, .3, 0, 0).rotation.x = Math.PI/2;
    } else if (h === 'hat'){
      const strap = M(new THREE.BoxGeometry(.08, .78, .03), leather, this.torso, 0, .45, .27, 1.08); strap.rotation.z = .65;
      for (let i = 0; i < 6; i++){ const b = M(new THREE.CylinderGeometry(.018, .018, .07, 5), trim, this.torso, -.2 + i*.08, .26 + i*.075, .3, 0); b.rotation.z = .65; }
      const strap2 = M(new THREE.BoxGeometry(.08, .78, .03), leather, this.torso, 0, .45, -.27, 1.08); strap2.rotation.z = .65;
    } else if (h === 'hood'){
      M(new THREE.CylinderGeometry(.2, .44, .3, 16, 1, true), cloth, this.torso, 0, .7, 0, 1.04);
      for (let i = 0; i < 4; i++) M(new THREE.BoxGeometry(.05, .05, .02), glow, this.torso, 0, .25 + i*.09, .3, 0).rotation.z = .78;
    }
    this.aura = glowSprite(c.glow, 1.0, .35); this.aura.position.set(0, .5, .1); this.torso.add(this.aura);

    /* ---- head (hidden from the owner's first-person view) ---- */
    this.head = new THREE.Group(); this.head.position.y = 1.02; this.torso.add(this.head);
    const eyes = (y, z, sx) => { for (const s of [-1, 1]) M(new THREE.BoxGeometry(.065, .028, .03), glow, this.head, s*(sx || .08), y, z, 0); };
    if (h === 'horns' || h === 'crest'){
      const helm = M(new THREE.SphereGeometry(.235, 18, 14), armor, this.head, 0, 0, 0); helm.scale.set(1, 1.08, 1.08);
      M(new THREE.BoxGeometry(.32, .06, .14), trim, this.head, 0, .07, .16, 1.06);
      M(new THREE.BoxGeometry(.28, .045, .1), glow, this.head, 0, 0, .2, 0);
      const jaw = M(new THREE.CylinderGeometry(.13, .09, .16, 6), dark, this.head, 0, -.12, .12, 1.06); jaw.rotation.x = .3;
      for (const s of [-1, 1]){ const ch = M(new THREE.BoxGeometry(.05, .2, .17), trim, this.head, s*.2, -.06, .06, 1.08); ch.rotation.z = s*.15; }
      if (h === 'horns'){
        for (const s of [-1, 1]){
          let cur = new THREE.Group(); cur.position.set(s*.19, .12, -.02); cur.rotation.set(-.25, 0, -s*1.0); this.head.add(cur);
          [[.065, .13], [.052, .12], [.04, .12], [.028, .11]].forEach(([r, l]) => {
            M(new THREE.CylinderGeometry(r*.78, r, l, 7), trim, cur, 0, l/2, 0, 1.12);
            const nx = new THREE.Group(); nx.position.y = l; nx.rotation.set(-.12, 0, s*.42); cur.add(nx); cur = nx;
          });
          M(new THREE.ConeGeometry(.022, .1, 6), trim, cur, 0, .05, 0, 1.12);
        }
        const p1 = glowSprite(c.glow, .7, .8); p1.position.set(0, .28, -.08); this.head.add(p1);
        const p2 = glowSprite(0xffd27a, .35, .9); p2.position.set(0, .24, -.05); this.head.add(p2);
        this.anims.push(() => { const k = .85 + Math.random()*.3; p1.scale.setScalar(.7*k); p2.scale.setScalar(.35*k); });
      } else {
        const fin = M(new THREE.BoxGeometry(.04, .18, .5), trim, this.head, 0, .23, -.04, 1.08); fin.rotation.x = -.15;
        for (let i = 0; i < 5; i++){ const a = -1 + i*.5; const cr = M(new THREE.OctahedronGeometry(.055, 0), glow, this.head, Math.sin(a)*.2, .16 + Math.cos(a)*.06, Math.cos(a)*.05 - .05, 0); cr.scale.y = 2.6 - Math.abs(i - 2)*.5; cr.rotation.z = -a*.5; }
      }
    } else if (h === 'kabuto'){
      const bowl = M(new THREE.SphereGeometry(.24, 18, 10, 0, 6.28, 0, Math.PI*.55), armor, this.head, 0, .02, 0); bowl.scale.set(1, 1.05, 1.08);
      for (let i = 0; i < 8; i++){ const rib = M(new THREE.BoxGeometry(.018, .02, .26), trim, this.head, 0, .18, 0, 0); rib.rotation.set(0, i/8*Math.PI, 0); rib.position.y = .2; }
      for (let k = 0; k < 3; k++){ const sh = M(new THREE.CylinderGeometry(.27 + k*.05, .3 + k*.06, .07, 20, 1, true, Math.PI*.35, Math.PI*1.3), k % 2 ? trim : armor, this.head, 0, -.02 - k*.07, -.01, 1.04); }
      for (const s of [-1, 1]){ const fk = M(new THREE.BoxGeometry(.1, .14, .03), trim, this.head, s*.25, .02, .08, 1.08); fk.rotation.y = s*.9; }
      const cres = M(new THREE.TorusGeometry(.22, .028, 4, 20, Math.PI), trim, this.head, 0, .16, .2, 1.15); cres.rotation.z = 0;
      M(new THREE.SphereGeometry(.04, 8, 6), glow, this.head, 0, .16, .21, 0);
      const mask = M(new THREE.CylinderGeometry(.15, .1, .16, 7), dark, this.head, 0, -.1, .13, 1.06); mask.rotation.x = .25;
      for (let i = 0; i < 3; i++) M(new THREE.BoxGeometry(.13, .012, .01), trim, this.head, 0, -.07 - i*.035, .21, 0);
      eyes(.0, .2);
    } else if (h === 'hat'){
      M(new THREE.SphereGeometry(.2, 16, 12), skin, this.head, 0, 0, .01);
      M(new THREE.ConeGeometry(.03, .07, 5), skin, this.head, 0, .0, .21, 0).rotation.x = Math.PI/2;
      for (const s of [-1, 1]) M(new THREE.SphereGeometry(.025, 6, 4), dark, this.head, s*.07, .04, .18, 0);
      M(new THREE.BoxGeometry(.18, .02, .02), dark, this.head, 0, .09, .18, 0);
      const band = M(new THREE.CylinderGeometry(.205, .2, .16, 14, 1, true, -1.4, 2.8), cloth, this.head, 0, -.1, .02, 1.05);
      const knot = M(new THREE.ConeGeometry(.06, .16, 4), cloth, this.head, 0, -.12, -.22, 1.06); knot.rotation.x = -2.2;
      const brim = M(new THREE.LatheGeometry([V2(.18, .02), V2(.3, 0), V2(.42, .03), V2(.47, .08)], 20), dark, this.head, 0, .12, 0, 1.05);
      brim.material = dark; brim.scale.z = 1.12;
      M(new THREE.CylinderGeometry(.17, .21, .24, 14), dark, this.head, 0, .26, 0, 1.05);
      M(new THREE.BoxGeometry(.04, .05, .36), dark, this.head, 0, .38, 0, 0);
      M(new THREE.CylinderGeometry(.215, .215, .05, 14), trim, this.head, 0, .17, 0, 1.03);
    } else if (stone){
      const hd = M(new THREE.DodecahedronGeometry(.26, 0), armor, this.head, 0, 0, 0); hd.scale.set(1.15, .95, 1.05);
      const brow = M(new THREE.BoxGeometry(.38, .09, .14), armor, this.head, 0, .08, .17, 1.06); brow.rotation.x = .3;
      M(new THREE.BoxGeometry(.3, .1, .12), armor, this.head, 0, -.15, .16, 1.06);
      eyes(.02, .25, .09);
      for (const s of [-1, 1]){ const cr = M(new THREE.OctahedronGeometry(.06, 0), glow, this.head, s*.2, .2, -.02, 0); cr.scale.y = 2.6; cr.rotation.z = -s*.6; }
      M(new THREE.DodecahedronGeometry(.1, 0), toon(0x4f7a3a, { flatShading:true }), this.head, .14, .2, -.08, 1.1);
    } else if (h === 'hood'){
      const hood = M(new THREE.SphereGeometry(.28, 16, 12, Math.PI*.8, Math.PI*1.4), cloth, this.head, 0, .03, -.01); hood.scale.set(1, 1.12, 1.15);
      const tip = M(new THREE.ConeGeometry(.15, .42, 10), cloth, this.head, 0, .16, -.26, 1.08); tip.rotation.x = -1.2;
      M(new THREE.SphereGeometry(.21, 12, 8), dark, this.head, 0, -.01, .04, 0);
      M(new THREE.TorusGeometry(.24, .02, 4, 20, Math.PI), trim, this.head, 0, .02, .1, 0).rotation.set(0, 0, 0);
      eyes(.02, .23);
      const beard = M(new THREE.ConeGeometry(.08, .26, 6), toon(0xd9d4e8), this.head, 0, -.2, .15, 1.08); beard.rotation.x = Math.PI + .25;
    }

    /* ---- shoulder pads ---- */
    const pads = new THREE.Group(); this.torso.add(pads); this.pads = pads;
    for (const s of [-1, 1]){
      if (stone){
        const b = M(new THREE.DodecahedronGeometry(.24, 0), armor, pads, s*.5, .7, 0); b.rotation.set(s, 1, 0);
        const cr = M(new THREE.OctahedronGeometry(.07, 0), glow, pads, s*.56, .9, -.05, 0); cr.scale.y = 3; cr.rotation.z = -s*.4;
        continue;
      }
      if (h === 'hood'){ const m = M(new THREE.SphereGeometry(.17, 10, 8, 0, 6.28, 0, 1.4), cloth, pads, s*.45, .66, 0); m.scale.set(1.2, .8, 1.1); continue; }
      const layers = h === 'kabuto' ? 3 : 2;
      for (let k = 0; k < layers; k++){
        const pad = M(h === 'kabuto' ? new THREE.BoxGeometry(.3, .05, .32) : new THREE.SphereGeometry(.21 - k*.03, 14, 8, 0, 6.28, 0, Math.PI/2), k % 2 ? trim : armor, pads, s*(.48 + k*.03), .68 - k*.1, 0, 1.06);
        if (h === 'kabuto') pad.rotation.z = -s*.35; else pad.scale.set(1.15, .85, 1.05);
      }
      if (h === 'horns'){ for (let k = 0; k < 2; k++){ const sp = M(new THREE.ConeGeometry(.055 - k*.01, .26 - k*.06, 6), trim, pads, s*(.52 + k*.07), .85 - k*.06, -.04 + k*.08, 1.12); sp.rotation.z = -s*(.45 + k*.3); } }
      else if (h === 'crest'){ for (let k = 0; k < 2; k++){ const cr = M(new THREE.OctahedronGeometry(.07 - k*.015, 0), glow, pads, s*(.5 + k*.08), .84 - k*.05, -.05 + k*.08, 0); cr.scale.y = 2.6; cr.rotation.z = -s*(.35 + k*.3); } }
      else if (h === 'hat'){ M(new THREE.BoxGeometry(.24, .03, .22), leather, pads, s*.46, .72, 0, 1.06).rotation.z = -s*.3; }
    }

    /* ---- arms ---- */
    const arm = s => {
      const sh = new THREE.Group(); sh.position.set(s*.47, .62, 0); this.torso.add(sh);
      const big = stone ? 1.3 : 1;
      M(new THREE.SphereGeometry(.095*big, 10, 8), stone ? armor : dark, sh, 0, 0, 0);
      M(new THREE.CylinderGeometry(.09*big, .08*big, .3, 10), stone ? armor : (h === 'hood' || h === 'hat' ? cloth : dark), sh, 0, -.16, 0);
      if (!stone) M(new THREE.CylinderGeometry(.095, .095, .05, 10), trim, sh, 0, -.06, 0, 1.06);
      const el = new THREE.Group(); el.position.y = -.33; sh.add(el);
      M(new THREE.SphereGeometry(.085*big, 10, 6), stone ? armor : trim, el, 0, 0, 0);
      M(new THREE.CylinderGeometry(.09*big, .115*big, .27, 10), armor, el, 0, -.15, 0);
      if (!stone) for (let k = 0; k < 2; k++) M(new THREE.BoxGeometry(.025, .2, .04), trim, el, 0, -.15, .1*(k ? -1 : 1), 0);
      M(new THREE.CylinderGeometry(.118*big, .118*big, .04, 10), glow, el, 0, -.26, 0, 0);
      const hand = new THREE.Group(); hand.position.set(0, -.37, .01); el.add(hand);
      const gl = c.wep === 'gauntlet' ? 1.3 : (stone ? 1.35 : 1);
      M(new THREE.BoxGeometry(.15*gl, .13*gl, .15*gl), h === 'hat' ? leather : trim, hand, 0, 0, 0, 1.1);
      M(new THREE.BoxGeometry(.15*gl, .05*gl, .07*gl), dark, hand, 0, -.08*gl, .03*gl, 1.08);
      M(new THREE.BoxGeometry(.04*gl, .07*gl, .06*gl), h === 'hat' ? leather : trim, hand, -s*.09*gl, -.02, .05*gl, 1.1);
      if (c.wep === 'gauntlet') for (let k = 0; k < 3; k++) M(new THREE.ConeGeometry(.02, .07, 4), trim, hand, (k - 1)*.05, -.12, .06, 1.15).rotation.x = Math.PI;
      const fg = glowSprite(c.glow, .45, 0); fg.position.y = -.38; el.add(fg);
      return { sh, el, fg };
    };
    const L = arm(1), Rr = arm(-1);
    this.shL = L.sh; this.elL = L.el; this.shR = Rr.sh; this.elR = Rr.el; this.fistGlowR = Rr.fg; this.fistGlowL = L.fg;
    this.buildWeapon(c, armor, trim, dark, glow, M, metal, leather);

    /* ---- legs ---- */
    const leg = s => {
      const hp = new THREE.Group(); hp.position.set(s*.15, -.05, 0); this.hips.add(hp);
      M(new THREE.CylinderGeometry(.125, .1, .44, 10), stone ? armor : dark, hp, 0, -.21, 0);
      if (!stone && h !== 'hood') M(new THREE.BoxGeometry(.16, .26, .05), armor, hp, 0, -.2, .1, 1.06);
      const kn = new THREE.Group(); kn.position.y = -.44; hp.add(kn);
      const kp = M(new THREE.SphereGeometry(.085, 10, 6), trim, kn, 0, 0, .05, 1.08); kp.scale.set(1, 1.1, .8);
      if (h === 'horns') M(new THREE.ConeGeometry(.03, .1, 5), trim, kn, 0, .02, .13, 1.12).rotation.x = Math.PI/2;
      M(new THREE.CylinderGeometry(.1, .08, .38, 10), armor, kn, 0, -.2, 0);
      if (!stone) M(new THREE.BoxGeometry(.11, .3, .04), trim, kn, 0, -.18, .08, 1.06);
      const boot = h === 'hat' ? leather : (stone ? armor : dark);
      M(new THREE.BoxGeometry(.17, .14, .26), boot, kn, 0, -.42, .02, 1.08);
      const toe = M(new THREE.SphereGeometry(.09, 10, 6, 0, 6.28, 0, Math.PI/2), boot, kn, 0, -.49, .14, 1.08); toe.scale.set(1, .9, 1.1);
      M(new THREE.TorusGeometry(.105, .025, 6, 14), trim, kn, 0, -.33, 0, 0).rotation.x = Math.PI/2;
      if (h === 'hat'){ const spur = M(new THREE.TorusGeometry(.04, .01, 4, 8), metal, kn, 0, -.44, -.14, 0); spur.rotation.y = Math.PI/2; }
      return { hp, kn };
    };
    const LL = leg(1), RL = leg(-1);
    this.hipL = LL.hp; this.knL = LL.kn; this.hipR = RL.hp; this.knR = RL.kn;

    /* ---- cape, scarf or coat tail ---- */
    const capeLen = h === 'hat' ? 1.15 : h === 'kabuto' ? 1.0 : h === 'hood' ? 1.2 : 1.1;
    const capeW = h === 'kabuto' ? .26 : h === 'hat' ? .6 : .7;
    const capeGeo = new THREE.PlaneGeometry(capeW, capeLen, 4, 12); capeGeo.translate(0, -capeLen/2, 0);
    this.capeLen = capeLen; this.capeBase = capeGeo.attributes.position.array.slice();
    const emblemOf = { horns:'flame', crest:'flake', kabuto:'crescent', hat:'star', stone:'mountain', hood:'bolt' }[h];
    const capeTex = canvasTex(128, 256, (g, w, hh) => {
      const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, hexCss(c.cloth)); gr.addColorStop(1, hexCss((((c.cloth >> 16 & 255)*.45) << 16) | (((c.cloth >> 8 & 255)*.45) << 8) | ((c.cloth & 255)*.45)));
      g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      g.fillStyle = hexCss(c.trim); g.fillRect(0, 0, 7, hh); g.fillRect(w - 7, 0, 7, hh); g.fillRect(0, 0, w, 8);
      if (h !== 'kabuto') emblem(g, emblemOf, w/2, hh*.3, 30, hexCss(c.trim));
      if (h === 'horns'){ g.globalCompositeOperation = 'destination-out'; for (let x = 0; x < w; x += 16){ g.beginPath(); g.moveTo(x, hh); g.lineTo(x + 8, hh - 20 - Math.random()*30); g.lineTo(x + 16, hh); g.fill(); } }
      if (h === 'kabuto'){ g.fillStyle = hexCss(c.glow); for (let y = 30; y < hh; y += 46) g.fillRect(0, y, w, 4); }
    });
    this.cape = new THREE.Mesh(capeGeo, rimToon(0xffffff, c.glow, { map:capeTex, side:THREE.DoubleSide, alphaTest:.5 }, .25));
    this.mats.push(this.cape.material);
    this.cape.castShadow = true;
    this.cape.position.set(h === 'kabuto' ? .18 : 0, h === 'kabuto' ? .8 : .76, h === 'hood' ? -.24 : -.27); this.torso.add(this.cape);
    if (stone) this.cape.visible = false;

    // floating orbs for the lightning mage
    if (h === 'hood'){
      const ring = new THREE.Group(); ring.position.y = .5; this.torso.add(ring);
      for (let k = 0; k < 3; k++){ const o = new THREE.Group(); o.position.set(Math.cos(k*2.09)*.65, Math.sin(k*1.7)*.15, Math.sin(k*2.09)*.65); ring.add(o);
        o.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.05, 0), glow)); o.add(glowSprite(c.glow, .35, .9)); }
      this.anims.push(dt => { ring.rotation.y += dt*1.8; ring.position.y = .5 + Math.sin(this.t*2)*.05; });
    }
    if (stone){ const cracks = []; this.torso.traverse(o => { if (o.material === glow) cracks.push(o); }); this.anims.push(() => { const k = .7 + Math.sin(this.t*3)*.3; glow.color.setHex(c.glow).multiplyScalar(k); }); }
    if (h === 'horns') this.anims.push(() => { if (Math.random() < .12){ const p = new V3(); this.shR.getWorldPosition(p); spark(p, Math.random() < .5 ? 0xff6a1a : 0xffb060, new V3(rnd(-.3,.3), rnd(.6, 1.4), rnd(-.3,.3)), .5, .25, -1); } });
    if (h === 'crest') this.anims.push(() => { if (Math.random() < .08){ const p = this.pos.clone(); p.x += rnd(-.4,.4); p.z += rnd(-.4,.4); p.y += rnd(.2, 1.6); spark(p, 0xbdf3ff, new V3(0, rnd(-.3,.2), 0), .9, .18, -.2); } });

    /* ---- frozen prison, aura light, first-person hiding ---- */
    this.iceBlock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), toon(0xa8ecff, { transparent:true, opacity:.55, flatShading:true }));
    this.iceBlock.scale.set(.85, 1.35, .85).multiplyScalar(c.scale || 1); this.iceBlock.position.y = 1.15; this.iceBlock.visible = false; this.root.add(this.iceBlock);
    const iceOut = new THREE.Mesh(this.iceBlock.geometry, OUT); iceOut.scale.setScalar(1.04); this.iceBlock.add(iceOut);
    this.light = new THREE.PointLight(c.glow, .8, 6, 2); this.light.position.set(0, 1.3, .4); this.root.add(this.light);
    const layer = 1 + this.idx;
    this.head.traverse(o => o.layers.set(layer)); pads.traverse(o => o.layers.set(layer));
  }
  buildWeapon(c, armor, trim, dark, glow, M, metal, leather){
    const w = c.wep, el = this.elR;
    if (w === 'spear'){
      M(new THREE.CylinderGeometry(.028, .032, 2.5, 8), dark, el, 0, -.95, .02, 1.15);
      for (let k = 0; k < 4; k++) M(new THREE.CylinderGeometry(.04, .04, .05, 8), k % 2 ? trim : glow, el, 0, -.1 - k*.55, .02, k % 2 ? 1.1 : 0);
      const tip = M(new THREE.OctahedronGeometry(.13, 0), glow, el, 0, -2.38, .02, 0); tip.scale.set(.7, 2.8, .35);
      for (const s of [-1, 1]){ const fl = M(new THREE.OctahedronGeometry(.06, 0), glow, el, s*.1, -2.12, .02, 0); fl.scale.set(.5, 2, .4); fl.rotation.z = s*.6; }
      M(new THREE.CylinderGeometry(.06, .03, .1, 8), trim, el, 0, -2.05, .02, 1.1);
      const tg = glowSprite(c.glow, .7, .7); tg.position.set(0, -2.35, .02); el.add(tg);
      M(new THREE.ConeGeometry(.04, .2, 6), trim, el, 0, .35, .02, 1.1);
    } else if (w === 'katana'){
      M(new THREE.CylinderGeometry(.03, .03, .32, 8), dark, el, 0, -.3, .02, 1.12);
      for (let k = 0; k < 4; k++) M(new THREE.BoxGeometry(.065, .025, .065), trim, el, 0, -.18 - k*.07, .02, 0).rotation.y = .78;
      M(new THREE.CylinderGeometry(.09, .09, .02, 12), trim, el, 0, -.47, .02, 1.1);
      const bladeMat = rimToon(0xe8eef5, c.glow, null, .7);
      let cur = new THREE.Group(); cur.position.set(0, -.48, .02); el.add(cur);
      for (let k = 0; k < 4; k++){
        M(new THREE.BoxGeometry(.045, .26, .012), bladeMat, cur, 0, -.13, 0, 1.12);
        M(new THREE.BoxGeometry(.01, .26, .014), glow, cur, -.025, -.13, 0, 0);
        const nx = new THREE.Group(); nx.position.y = -.26; nx.rotation.z = -.05; cur.add(nx); cur = nx;
      }
      const pt = M(new THREE.ConeGeometry(.024, .1, 4), bladeMat, cur, 0, -.05, 0, 1.12); pt.rotation.x = Math.PI;
    } else if (w === 'guns'){
      for (const e of [this.elR, this.elL]){
        M(new THREE.CylinderGeometry(.03, .03, .32, 8), metal, e, 0, -.62, .07, 1.12);
        M(new THREE.BoxGeometry(.06, .2, .07), dark, e, 0, -.5, .07, 1.1);
        const drum = M(new THREE.CylinderGeometry(.055, .055, .09, 8), metal, e, 0, -.44, .07, 1.1);
        M(new THREE.BoxGeometry(.05, .06, .14), leather, e, 0, -.38, -.01, 1.1).rotation.x = .3;
        M(new THREE.BoxGeometry(.015, .04, .04), trim, e, 0, -.4, .12, 0);
        const muzzle = glowSprite(c.glow, .6, 0); muzzle.position.set(0, -.82, .07); e.add(muzzle);
        if (e === this.elR) this.muzzleR = muzzle; else this.muzzleL = muzzle;
      }
    } else if (w === 'hammer'){
      M(new THREE.CylinderGeometry(.045, .05, 1.4, 8), leather, el, 0, -.87, .02, 1.12);
      for (let k = 0; k < 3; k++) M(new THREE.CylinderGeometry(.055, .055, .04, 8), trim, el, 0, -.3 - k*.25, .02, 0);
      const head = new THREE.Group(); head.position.set(0, -1.6, .02); el.add(head);
      M(new THREE.BoxGeometry(.34, .32, .5), armor, head, 0, 0, 0, 1.06);
      for (const s of [-1, 1]){ M(new THREE.BoxGeometry(.38, .36, .07), trim, head, 0, 0, s*.25, 1.06); const sp = M(new THREE.ConeGeometry(.08, .2, 5), trim, head, 0, 0, s*.38, 1.1); sp.rotation.x = s*Math.PI/2; }
      M(new THREE.BoxGeometry(.35, .035, .51), glow, head, 0, .06, 0, 0); M(new THREE.BoxGeometry(.35, .035, .51), glow, head, 0, -.06, 0, 0);
      M(new THREE.DodecahedronGeometry(.07, 0), trim, el, 0, -.15, .02, 1.1);
    } else if (w === 'staff'){
      M(new THREE.CylinderGeometry(.028, .035, 2.1, 8), leather, el, 0, -.72, .02, 1.15);
      for (let k = 0; k < 4; k++) M(new THREE.TorusGeometry(.04, .012, 4, 10), trim, el, 0, -.05 - k*.45, .02, 0).rotation.x = Math.PI/2;
      const cr = M(new THREE.TorusGeometry(.14, .025, 6, 16, Math.PI*1.4), trim, el, 0, -1.9, .02, 1.12); cr.rotation.z = Math.PI*.8;
      M(new THREE.IcosahedronGeometry(.1, 1), glow, el, 0, -1.92, .02, 0);
      const og = glowSprite(c.glow, 1.0, .85); og.position.set(0, -1.92, .02); el.add(og);
      this.anims.push(() => { og.scale.setScalar(.9 + Math.sin(this.t*9)*.15); });
    }
  }
  reset(){
    const sx = this.idx === 0 ? -5 : 5;
    this.pos.set(sx, 0, 0); this.vel.set(0,0,0); this.kb.set(0,0,0); this.vy = 0;
    this.facing = this.idx === 0 ? Math.PI/2 : -Math.PI/2;
    this.aimYaw = this.facing; this.aimPitch = 0;
    this.hp = 100; this.energy = 20; this.state = 'idle'; this.atkT = 0; this.stun = 0; this.dashCd = 0; this.cdQ = 0; this.cdF = 0;
    this.freezeT = 0; this.fired = false; this.buffer = null; this.punchSide = 0; this.walkPhase = 0; this.combo = 0; this.t = Math.random()*5;
    if (this.vel2){ this.vel2.set(0,0,0); this.animVel.set(0,0,0); } this.prevPos = null; this.landT = 0;
    this.ab = null; this.pose = ''; this.dashT = 0;
    this.body.rotation.set(0,0,0); this.body.position.set(0,0,0); this.root.visible = true; this.iceBlock.visible = false;
    this.tgt = null;
  }
  fwd(){ return new V3(Math.sin(this.facing), 0, Math.cos(this.facing)); }
  atk(s){ return s === 'punch' ? this.cfg.light : this.cfg.heavy; }
  readInput(){ const c = this.ctrl(); for (const a of c.press) this.buffer = { a, t:.18 }; return c; }
  moveBy(v){
    const oldR = Math.hypot(this.pos.x, this.pos.z);
    this.pos.add(v); pushFromCols(this.pos);
    const r = Math.hypot(this.pos.x, this.pos.z), lim = Math.max(R - .45, oldR);
    if (r > lim){ this.pos.x *= lim/r; this.pos.z *= lim/r; }
    this.moveAmt = Math.min(1, this.moveAmt + v.length()*3);
  }
  update(dt, canAct){
    this.t += dt; this.dashCd -= dt; this.cdQ -= dt; this.cdF -= dt; this.flash = Math.max(0, this.flash - dt*4);
    this.moveAmt = Math.max(0, this.moveAmt - dt*3);
    if (this.comboT > 0){ this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.state === 'fall'){
      this.vel.y -= 26*dt; this.pos.addScaledVector(this.vel, dt);
      this.body.rotation.x -= dt*4; if (this.pos.y < -45) this.root.visible = false;
      this.apply(); return;
    }
    if (canAct) this.energy = Math.min(100, this.energy + 3.5*dt);
    const opp = this.opp, toOpp = Math.atan2(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z);
    const busy = ['punch','kick','cast','ult','rush'].includes(this.state);
    const inp = canAct && this.state !== 'ko' ? this.readInput() : null;
    if (inp){ this.aimYaw = inp.yaw; this.aimPitch = inp.pitch; }
    if (this.state !== 'ko' && this.state !== 'frozen' && !busy) this.facing = lerpAngle(this.facing, inp ? inp.yaw : toOpp, 1 - Math.exp(-11*dt));
    let target = new V3();
    if (this.buffer){ this.buffer.t -= dt; if (this.buffer.t <= 0) this.buffer = null; }
    const by = inp ? inp.yaw : this.facing;
    const f = new V3(Math.sin(by), 0, Math.cos(by)), right = new V3(-f.z, 0, f.x);
    const air = this.pos.y > .02 || this.vy > 0;
    const spd = this.cfg.speed || 1;
    const mvOf = i => { const v = new V3().addScaledVector(f, i.z).addScaledVector(right, i.x); if (v.lengthSq() > 1) v.normalize(); return v; };
    this.lastMv = inp ? mvOf(inp) : new V3();

    const s = this.state;
    if (s === 'frozen'){ this.freezeT -= dt; if (this.freezeT <= 0){ this.state = 'idle'; fx('shatter', [r2(this.pos.x), r2(this.pos.y + 1), r2(this.pos.z)]); } }
    else if (s === 'hit'){ this.stun -= dt; if (this.stun <= 0) this.state = 'idle'; }
    else if (s === 'punch' || s === 'kick'){
      this.atkT += dt; const a = this.atk(s);
      if (!this.hasHit && this.atkT >= a.start && this.atkT <= a.start + a.active) this.tryHit(a);
      if (this.atkT >= a.start + a.active + a.rec) this.state = 'idle';
      else if (inp) target = mvOf(inp).multiplyScalar(air ? 3 : 1.2);
    }
    else if (s === 'cast' || s === 'ult'){
      this.atkT += dt; const ab = this.ab;
      if (ab && !this.fired && this.atkT >= ab.windup){ this.fired = true; ab.act(this); }
      if ((this.state === 'cast' || this.state === 'ult') && (!ab || this.atkT >= ab.total)) this.state = 'idle';
    }
    else if (s === 'rush'){
      this.dashT -= dt; const r = this.rushSpec;
      this.moveBy(this.dashDir.clone().multiplyScalar(r.speed*dt));
      if (Math.random() < .8) spark(this.pos.clone().setY(this.pos.y + 1), r.color, new V3((Math.random()-.5)*2, Math.random()*2, (Math.random()-.5)*2), .4, .7, -1);
      if (!this.hasHit && this.pos.distanceTo(opp.pos) < 1.5){ this.hasHit = true; opp.receive(this, r, this.dashDir); }
      if (this.dashT <= 0) this.state = 'idle';
    }
    else if (s === 'dash'){
      this.dashT -= dt; this.moveBy(this.dashDir.clone().multiplyScalar((10 + 50*Math.max(0, this.dashT))*dt));
      if (this.dashT <= 0){ this.state = 'idle'; this.vel2.copy(this.dashDir).multiplyScalar(5); }
    }
    if (this.state === 'idle' || this.state === 'walk' || this.state === 'block'){
      if (!inp) this.state = 'idle';
      else {
        const b = this.buffer, mv = mvOf(inp);
        const useAb = (key, st) => { this.buffer = null; this.ab = this.cfg[key]; this.state = st; this.atkT = 0; this.fired = false; this.pose = this.ab.pose; aimAssist(this); };
        if (b && b.a === 'jump' && !air){
          this.buffer = null; this.vy = 9; fx('jump');
        } else if (b && b.a === 'dash' && this.dashCd <= 0){
          this.buffer = null; this.state = 'dash'; this.dashT = .18; this.dashCd = .7;
          this.dashDir = mv.lengthSq() > .01 ? mv.clone().normalize() : f.clone(); fx('whoosh'); this.vel2.copy(this.dashDir).multiplyScalar(6);
        } else if (b && b.a === 'ult' && this.energy >= 100){
          this.energy = 0; useAb('r', 'ult'); fx('charge', null, this.cfg.glow);
        } else if (b && b.a === 'shot' && this.cdQ <= 0){
          this.cdQ = POWER_CD; useAb('q', 'cast');
        } else if (b && b.a === 'sk2' && this.cdF <= 0){
          this.cdF = POWER_CD; useAb('f', 'cast');
        } else if (b && (b.a === 'punch' || b.a === 'kick') && !inp.block){
          const kind = b.a; this.buffer = null; this.state = kind; this.atkT = 0; this.hasHit = false; aimAssist(this);
          if (kind === 'punch') this.punchSide ^= 1; fx('whoosh');
        } else if (inp.block && !air){
          this.state = 'block'; target = mv.multiplyScalar(1.4);
        } else if (mv.lengthSq() > .01){
          this.state = 'walk'; target = mv.multiplyScalar(6.2*spd);
        } else this.state = this.vel2.lengthSq() > .6 ? 'walk' : 'idle';
        if (b && this.buffer === b && b.a === 'ult' && this.energy < 100) this.buffer = null;
      }
    }
    // smooth acceleration and deceleration instead of instant starts and stops
    if (['dash','rush','frozen','ko','hit'].includes(this.state)) this.vel2.multiplyScalar(Math.exp(-12*dt));
    else {
      const speeding = target.lengthSq() > this.vel2.lengthSq();
      const accel = air ? 4 : (speeding ? 11 : 9);
      this.vel2.lerp(target, 1 - Math.exp(-accel*dt));
    }
    if (this.vel2.lengthSq() > 1e-4 && this.state !== 'dash' && this.state !== 'rush') this.moveBy(this.vel2.clone().multiplyScalar(dt));
    if (this.kb.lengthSq() > 1e-4){
      this.pos.addScaledVector(this.kb, dt); pushFromCols(this.pos); this.kb.multiplyScalar(Math.exp(-5.5*dt));
    }
    const overGround = Math.hypot(this.pos.x, this.pos.z) <= R + .1;
    if (this.pos.y > 0 || this.vy > 0 || !overGround){
      this.vy -= 24*dt; this.pos.y += this.vy*dt;
      if (overGround && this.pos.y <= 0 && this.vy <= 0){ if (this.vy < -6) fx('land'); this.pos.y = 0; this.vy = 0; if (this.onLand){ const cb = this.onLand; this.onLand = null; cb(); } }
    }
    if (this.pos.y < -2.5 && !overGround){
      this.state = 'fall'; this.iceBlock.visible = false; this.vel.set(this.kb.x*.4, this.vy, this.kb.z*.4); onRingOut(this);
    }
    this.animate(dt); this.apply();
  }
  tryHit(a){
    const opp = this.opp, dx = opp.pos.x - this.pos.x, dz = opp.pos.z - this.pos.z;
    if (Math.hypot(dx, dz) > a.range*(this.cfg.scale || 1) || Math.abs(opp.pos.y - this.pos.y) > 1.3) return;
    if (!a.spin && Math.abs(angleDiff(this.facing, Math.atan2(dx, dz))) > .9) return;
    this.hasHit = true;
    const isBlade = ['katana','spear','hammer','staff'].includes(this.cfg.wep);
    opp.receive(this, Object.assign({}, a, { hitFx: a.dmg >= 11 ? 'kick' : 'punch', color: isBlade ? this.cfg.glow : 0 }));
  }
  receive(att, sp, dirIn){
    if (this.state === 'fall' || this.state === 'ko') return false;
    const dir = dirIn ? dirIn.clone().setY(0).normalize() : new V3(this.pos.x - att.pos.x, 0, this.pos.z - att.pos.z).normalize();
    if (dir.lengthSq() < .5) dir.set(Math.sin(att.facing), 0, Math.cos(att.facing));
    const facingSrc = Math.abs(angleDiff(this.facing, Math.atan2(-dir.x, -dir.z))) < 1.3;
    const hp3 = this.pos.clone().addScaledVector(dir, -.35); hp3.y += 1.25;
    const hitPos = [r2(hp3.x), r2(hp3.y), r2(hp3.z)];
    const blocked = this.state === 'block' && facingSrc && !sp.unblock;
    const lowMult = 1 + (100 - this.hp)/110;
    let dmg = sp.dmg*(this.cfg.armorMult || 1), kb = sp.kb || 0;
    if (sp.freeze){
      dmg *= blocked ? .4 : 1; this.state = 'frozen'; this.freezeT = blocked ? sp.freeze*.35 : sp.freeze;
      kb = Math.min(kb, 2); this.buffer = null; fx('freeze', hitPos);
    } else if (blocked){
      dmg *= sp.aoe ? .45 : .15; kb *= sp.aoe ? .7*lowMult : .45; att.combo = 0; fx('block', hitPos);
    } else {
      kb *= lowMult;
      if (this.state === 'frozen'){ fx('shatter', hitPos); dmg *= 1.2; }
      this.state = 'hit'; this.stun = sp.stun || .4; this.flash = 1; this.buffer = null; this.onLand = null;
      fx(sp.hitFx || 'punch', hitPos, sp.color || 0);
      att.combo++; att.comboT = 1.1; if (att.combo >= 2) fx('combo', null, [att.idx, att.combo]);
    }
    if (!sp.noGain) att.energy = Math.min(100, att.energy + (blocked ? 2 : 6));
    this.energy = Math.min(100, this.energy + (blocked ? 3 : 5));
    this.hp = Math.max(0, this.hp - dmg);
    this.kb.addScaledVector(dir, kb);
    if (sp.lift && !blocked) this.vy = Math.max(this.vy, sp.lift);
    if (this.hp <= 0){ this.state = 'ko'; this.iceBlock.visible = false; this.kb.addScaledVector(dir, 4); onKO(this); }
    return true;
  }
  animate(dt){
    // measure how the body is actually moving, so host, bot and online views animate the same way
    if (this.prevPos && dt > 0){
      const v = this.pos.clone().sub(this.prevPos).divideScalar(dt); v.y = 0;
      if (v.lengthSq() > 400) v.setLength(20);
      this.animVel.lerp(v, 1 - Math.exp(-10*dt));
    }
    if (!this.prevPos) this.prevPos = this.pos.clone(); else this.prevPos.copy(this.pos);
    const airNow = this.pos.y > .05;
    if (this.wasAir && !airNow) this.landT = .28;
    this.wasAir = airNow; this.landT = Math.max(0, this.landT - dt);
    const fwdV = new V3(Math.sin(this.facing), 0, Math.cos(this.facing)), rightV = new V3(-fwdV.z, 0, fwdV.x);
    const vF = this.animVel.dot(fwdV), vS = this.animVel.dot(rightV), speed = Math.hypot(vF, vS);
    this.moveAmt = Math.min(1, speed/6);
    const P = { sxL:-.5, szL:-.15, exL:-1.75, sxR:-.5, szR:.15, exR:-1.75, hxL:.28, hxR:-.3, hzL:0, hzR:0, kxL:.35, kxR:.4, tX:.08, tY:0, tZ:0, bR:0, bY:0, hy:-.05, hdX:0 };
    const w = this.cfg.wep;
    if (w === 'spear' || w === 'staff' || w === 'hammer'){ P.sxR = -.35; P.exR = -1.3; P.szR = .05; P.sxL = -.7; P.exL = -1.6; P.szL = -.35; }
    if (w === 'katana'){ P.sxR = -.7; P.exR = -1.1; P.szR = .35; P.sxL = -.75; P.exL = -1.2; P.szL = -.45; }
    if (w === 'guns'){ P.sxR = -.9; P.exR = -.7; P.sxL = -.9; P.exL = -.7; }
    P.tY = Math.sin(this.t*2.2)*.05;
    const s = this.state, a = this.atkT;
    let auraTarget = .9 + this.energy/100*.6, fgL = 0, fgR = 0, spinY = null;
    if (s === 'frozen'){ this.iceBlock.visible = true; this.capeAnim(dt, true); return; }
    this.iceBlock.visible = false;
    if (s === 'walk'){ /* handled by the locomotion pass below */ }
    else if (s === 'punch' || s === 'kick'){
      const at = this.atk(s), ext = a < at.start + at.active + .04, pre = a < at.start;
      switch (at.anim){
        case 'punch':
          if (ext && !pre){ if (this.punchSide || w === 'guns'){ P.sxR = -1.58; P.exR = -.05; P.szR = .05; P.tY = .5; } else { P.sxL = -1.58; P.exL = -.05; P.szL = -.05; P.tY = -.5; } P.tX = .18; P.hxL = .5; P.kxL = .5; }
          break;
        case 'kick':
          if (a < at.start*.6){ P.hxR = -1.2; P.kxR = 1.6; P.tX = -.1; }
          else if (ext){ P.hxR = -1.5; P.kxR = .02; P.tX = -.4; P.hxL = .1; P.kxL = .2; P.sxL = -.2; P.szL = .7; P.sxR = -.2; P.szR = -.7; P.exL = -.6; P.exR = -.6; }
          else { P.hxR = -.5; P.kxR = .8; }
          break;
        case 'stab':
          if (pre){ P.sxR = -1.2; P.exR = -.9; P.tY = -.4; P.tX = -.05; }
          else if (ext){ P.sxR = -1.57; P.exR = 0; P.szR = .02; P.tY = .45; P.tX = .25; P.hxL = .6; P.kxL = .6; }
          break;
        case 'slash':
          if (pre){ P.sxR = -1.4; P.szR = -.7; P.exR = -.4; P.tY = -.9; }
          else if (ext){ P.sxR = -1.45; P.szR = .55; P.exR = -.15; P.tY = .9; P.tX = .15; P.hxL = .5; P.kxL = .5; }
          else { P.sxR = -1.0; P.szR = .5; P.tY = .5; }
          break;
        case 'overhead':
          if (pre){ P.sxR = -3.0; P.exR = -.3; P.sxL = -2.9; P.exL = -.3; P.szL = -.2; P.tX = -.3; }
          else if (ext){ P.sxR = -1.0; P.exR = -.1; P.sxL = -1.05; P.exL = -.1; P.szL = -.35; P.tX = .5; P.hy = -.18; P.kxL = .9; P.kxR = .9; P.hxL = .7; P.hxR = -.2; }
          break;
        case 'spin':
          P.sxR = -1.57; P.exR = 0; P.szR = -.3; P.sxL = -.3; P.szL = 1.3;
          if (!pre) spinY = ((a - at.start)/(at.active + .06))*Math.PI*2;
          break;
      }
    }
    else if (s === 'block'){ P.sxL = -1.05; P.szL = -.45; P.exL = -2.2; P.sxR = -1.05; P.szR = .45; P.exR = -2.2; P.tX = .18; P.hy = -.12; P.kxL = .7; P.kxR = .7; P.hxL = .45; P.hxR = -.25; }
    else if (s === 'hit'){ P.tX = -.5; P.sxL = .3; P.sxR = .3; P.exL = -.4; P.exR = -.4; P.szL = .5; P.szR = -.5; }
    else if (s === 'dash' || s === 'rush'){ P.tX = .5; P.hxL = -.7; P.kxL = 1; P.hxR = .5; P.kxR = .3; P.sxL = .6; P.sxR = .6; P.exL = -.3; P.exR = -.3;
      if (s === 'rush' && (w === 'katana')){ P.sxR = -1.5; P.szR = .6; P.exR = 0; P.tY = .8; } }
    else if (s === 'cast' || s === 'ult'){
      const wu = this.ab ? this.ab.windup : .2, pre = a < wu, post = a - wu;
      fgR = pre ? 1 : Math.max(0, 1 - post*4);
      switch (this.pose){
        case 'throw': if (pre){ P.sxR = .4; P.exR = -1.6; P.tY = -.55; } else { P.sxR = -1.6; P.exR = 0; P.szR = .1; P.tY = .4; } P.sxL = -.8; P.exL = -1.9; break;
        case 'slashThrow': if (pre){ P.sxR = -1.4; P.szR = -.8; P.tY = -1; } else { P.sxR = -1.5; P.szR = .7; P.tY = 1; } break;
        case 'aim1': P.sxR = -1.57; P.exR = 0; P.szR = .05; P.tY = .3; if (w === 'guns'){ P.sxL = -1.57; P.exL = 0; P.szL = -.05; fgL = fgR; } break;
        case 'aim2': if (pre){ P.sxL = .3; P.sxR = .3; P.exL = -2; P.exR = -2; P.szL = -.4; P.szR = .4; P.tX = -.15; fgL = 1; }
          else { P.sxL = -1.57; P.sxR = -1.57; P.exL = 0; P.exR = 0; P.szL = -.18; P.szR = .18; P.tX = .1; fgL = fgR; } P.hy = -.1; P.kxL = .6; P.kxR = .6; break;
        case 'lob': if (pre){ P.sxR = -2.8; P.exR = -.8; P.tX = -.3; P.tY = -.3; } else { P.sxR = -1.2; P.exR = -.1; P.tX = .25; P.tY = .3; } break;
        case 'slam': if (pre){ P.sxR = -3.0; P.sxL = -2.9; P.exR = -.3; P.exL = -.3; P.tX = -.3; } else { P.sxR = -.7; P.sxL = -.7; P.exR = 0; P.exL = 0; P.tX = .6; P.hy = -.3; P.kxL = 1.1; P.kxR = 1.1; P.hxL = .8; P.hxR = -.3; } break;
        case 'quake': if (pre){ P.sxR = -3.0; P.sxL = -2.9; P.exR = -.2; P.exL = -.2; P.tX = -.35; P.kxL = 1.4; P.kxR = 1.4; P.hxL = -.8; P.hxR = -.8; }
          else { P.sxR = -.6; P.sxL = -.6; P.tX = .6; P.hy = -.32; P.kxL = 1.2; P.kxR = 1.2; P.hxL = .8; P.hxR = -.4; } fgL = fgR; auraTarget = pre ? 1.5 + a*5 : auraTarget; break;
        case 'slamUp':
          if (pre){ P.sxL = -2.9; P.sxR = -2.9; P.exL = -.3; P.exR = -.3; P.szL = .35; P.szR = -.35; P.tX = -.25; P.hy = .05; fgL = 1; auraTarget = 1.5 + a*7; }
          else { P.sxL = -.2; P.sxR = -.2; P.szL = 1.35; P.szR = -1.35; P.exL = -.2; P.exR = -.2; P.tX = .35; P.hy = -.32; P.kxL = 1.2; P.kxR = 1.2; P.hxL = .7; P.hxR = -.6; }
          break;
        case 'callDown': if (pre){ P.sxR = -3.0; P.exR = 0; P.szR = .1; P.tX = -.2; auraTarget = 1.5 + a*6; } else { P.sxR = -2.6; P.exR = 0; } fgR = 1; break;
        case 'dash': P.tX = .45; P.sxR = -1.5; P.exR = 0; break;
        case 'flurry': { const ph = Math.sin(a*28); P.sxR = -1.5; P.szR = ph*.8; P.exR = -.1; P.tY = ph*.9; P.tX = .2; break; }
      }
    }
    else if (s === 'ko'){ P.bR = -1.45; P.bY = .22; P.sxL = 0; P.sxR = 0; P.exL = 0; P.exR = 0; P.szL = 1.3; P.szR = -1.3; P.hxL = .2; P.hxR = -.2; P.kxL = .1; P.kxR = .1; P.tX = 0; P.tY = 0; auraTarget = .2; }
    const loco = (s === 'walk' || s === 'idle' || s === 'block') && speed > .25 && !airNow;
    if (loco){
      const back = vF < -.3 ? -1 : 1;
      this.walkPhase += dt*(3.5 + speed*1.55)*back;
      const wv = Math.sin(this.walkPhase), wc = Math.cos(this.walkPhase), amp = Math.min(1, speed/6)*(s === 'block' ? .35 : .8);
      const fr = speed > 0 ? Math.abs(vF)/speed : 1, sr = speed > 0 ? vS/speed : 0;
      P.hxL = .05 + wv*amp*fr*.95; P.hxR = -.05 - wv*amp*fr*.95;
      P.hzL = wv*amp*sr*.35; P.hzR = -wv*amp*sr*.35;
      P.kxL = .15 + Math.max(0, -wv)*1.3*amp + (1 - fr)*.2; P.kxR = .15 + Math.max(0, wv)*1.3*amp + (1 - fr)*.2;
      P.hy = -.04 - Math.abs(wc)*.06*amp;
      if (s !== 'block'){
        const armAmp = (w === 'gauntlet' || w === 'guns' ? .45 : .22)*amp*fr;
        P.sxL += -wv*armAmp; P.sxR += wv*armAmp;
        P.tY = wv*.12*amp;
        P.tX = .08 + Math.max(-.12, Math.min(.28, vF*.035));
        P.tZ = Math.max(-.18, Math.min(.18, -vS*.028));
      }
    } else if (s === 'idle'){
      const br = Math.sin(this.t*1.9);
      P.hy = -.06 + br*.012; P.tX = .06 + br*.025; P.sxL += br*.04; P.sxR -= br*.04;
      P.tZ = Math.sin(this.t*.9)*.03; P.hzL = Math.sin(this.t*.9)*.03; P.hzR = Math.sin(this.t*.9)*.03;
    }
    P.hdX = -Math.max(-.6, Math.min(.6, this.aimPitch || 0))*.5;
    if (airNow && ['idle','walk','block','punch','kick'].includes(s)){
      const rising = this.vy > 1 || (this.tgt && this.pos.y < this.tgt[1] - .02);
      if (!(s === 'kick' && this.atk('kick').anim === 'kick')){
        if (rising){ P.hxL = -.7; P.kxL = 1.3; P.hxR = .25; P.kxR = .5; } else { P.hxL = -.45; P.kxL = .8; P.hxR = -.15; P.kxR = .6; }
      }
      if (s === 'idle' || s === 'walk'){ P.tX = .18; P.sxL = rising ? -1.1 : -.4; P.sxR = rising ? -1.1 : -.4; P.szL = .35; P.szR = -.35; P.exL = -1.1; P.exR = -1.1; }
    }
    if (this.landT > 0){ const l = this.landT/.28; P.hy -= .22*l; P.kxL += .7*l; P.kxR += .7*l; P.hxL += .35*l; P.hxR += .2*l; P.tX += .2*l; }
    const fast = ['punch','kick','dash','cast','ult','rush'].includes(s);
    const k = 1 - Math.exp(-(fast ? 26 : s === 'ko' ? 7 : s === 'hit' ? 18 : 10)*dt), L = (o, p, v) => { o[p] += (v - o[p])*k; };
    const kSoft = 1 - Math.exp(-7*dt);
    L(this.shL.rotation,'x',P.sxL); L(this.shL.rotation,'z',P.szL); L(this.elL.rotation,'x',P.exL);
    L(this.shR.rotation,'x',P.sxR); L(this.shR.rotation,'z',P.szR); L(this.elR.rotation,'x',P.exR);
    L(this.hipL.rotation,'x',P.hxL); L(this.hipR.rotation,'x',P.hxR); L(this.knL.rotation,'x',P.kxL); L(this.knR.rotation,'x',P.kxR);
    L(this.hipL.rotation,'z',P.hzL); L(this.hipR.rotation,'z',P.hzR);
    L(this.torso.rotation,'x',P.tX);
    this.torso.rotation.z += (P.tZ - this.torso.rotation.z)*kSoft;
    this.head.rotation.x += (P.hdX - this.head.rotation.x)*kSoft;
    if (spinY !== null) this.torso.rotation.y = spinY; else L(this.torso.rotation,'y',P.tY);
    L(this.body.rotation,'x',P.bR); L(this.body.position,'y',P.bY);
    this.hips.position.y += (.98 + P.hy - this.hips.position.y)*k;
    this.aura.scale.setScalar(this.aura.scale.x + (auraTarget - this.aura.scale.x)*k);
    this.aura.material.opacity = .25 + (this.energy >= 100 ? .25 + Math.sin(this.t*8)*.15 : 0);
    this.fistGlowR.material.opacity += (fgR - this.fistGlowR.material.opacity)*k;
    this.fistGlowL.material.opacity += (fgL - this.fistGlowL.material.opacity)*k;
    this.fistGlowR.scale.setScalar(.45 + fgR*.5); this.fistGlowL.scale.setScalar(.45 + fgL*.5);
    if (this.muzzleR){ this.muzzleR.material.opacity *= Math.exp(-14*dt); this.muzzleL.material.opacity *= Math.exp(-14*dt); }
    this.light.intensity = .6 + (this.energy/100)*.6 + (fgR + fgL)*.8;
    this.capeAnim(dt, false);
    for (const fn of this.anims) fn(dt);
  }
  capeAnim(dt, still){
    if (!this.cape.visible) return;
    const p = this.cape.geometry.attributes.position, b = this.capeBase, len = this.capeLen;
    const sway = still ? 0 : Math.min(1, this.moveAmt + Math.max(0, -this.vy || 0)*.05);
    for (let i = 0; i < p.count; i++){
      const x = b[i*3], y = b[i*3+1], s = -y/len;
      p.setZ(i, -s*s*(.1 + sway*.45) - s*.06 + (still ? 0 : Math.sin(this.t*5 + s*4 + x*3)*.045*s));
    }
    p.needsUpdate = true; this.cape.geometry.computeVertexNormals();
  }
  apply(){
    this.root.position.copy(this.pos); this.root.rotation.y = this.facing;
    const f = this.flash*.8; for (const m of this.mats) m.emissive.setRGB(f, f*.9, f*.8);
  }
}
function aimAssist(f){
  const o = f.opp, dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
  const ranged = f.state === 'cast' || f.state === 'ult';
  const cone = ranged ? .35 : .7, reach = ranged ? 35 : 5.5;
  if (Math.abs(angleDiff(f.aimYaw, a)) < cone && d < reach && o.state !== 'fall'){ f.facing = a; f.assisted = true; }
  else { f.facing = f.aimYaw; f.assisted = false; }
}
const f1 = new Fighter(0, 'kor'), f2 = new Fighter(1, 'ayaz');
f1.opp = f2; f2.opp = f1;
const fighters = [f1, f2];

/* ================= Ability toolkit ================= */
let scheduled = [];
function schedule(t, fn){ scheduled.push({ t, fn }); }
function runSchedule(dt){
  if (!scheduled.length) return;
  const due = [];
  scheduled = scheduled.filter(s => { s.t -= dt; if (s.t <= 0){ due.push(s.fn); return false; } return true; });
  due.forEach(fn => fn());
}
const chest = f => new V3(f.pos.x, f.pos.y + 1.2*(f.cfg.scale || 1), f.pos.z);
const clampIn = (p, lim) => { const r = Math.hypot(p.x, p.z); if (r > lim){ p.x *= lim/r; p.z *= lim/r; } return p; };
const P3a = v => [r2(v.x), r2(v.y), r2(v.z)];

const PROJ = {
  fireball:{ speed:19, dmg:10, kb:5, stun:.35, r:.85, life:1.6, splash:1.6, color:0xff7a2e, mesh:'orb', snd:'fire', trail:[0xff6a1a,0xffb060], tg:-2 },
  icespear:{ speed:26, dmg:9, kb:4, stun:.35, r:.8, life:1.3, color:0x4fd6ff, mesh:'spike', snd:'ice', trail:[0x9eeaff], tg:1 },
  crescent:{ speed:23, dmg:11, kb:6, stun:.42, r:1.35, life:1.0, color:0x7affd2, mesh:'crescent', snd:'wind', trail:[0x7affd2], tg:0, hitFx:'cut' },
  bullet:  { speed:52, dmg:5, kb:1.5, stun:.18, r:.6, life:.7, color:0xffcf4a, mesh:'bullet', snd:'gun', trail:null },
  grenade: { speed:15, grav:20, dmg:14, kb:10, stun:.5, r:.7, life:2.2, splash:3.2, color:0xffa040, mesh:'grenade', snd:'throw', trail:[0x9a9a9a], tg:-1 },
  boulder: { speed:17, grav:16, dmg:14, kb:9, stun:.5, r:1.0, life:2.4, splash:2.3, color:0xb8a27a, mesh:'boulder', snd:'rock', trail:[0x8a7a5a], tg:6 },
  wave:    { speed:15, dmg:10, kb:5, stun:.8, r:1.4, life:1.4, color:0x7dff5a, mesh:'wave', snd:'wave', trail:[0x7dff5a,0x8a7a5a], tg:-3, ground:true }
};
const projectiles = []; let projId = 0;
function makeProjMesh(type){
  const t = PROJ[type] || PROJ.fireball, g = new THREE.Group();
  const basic = c => new THREE.MeshBasicMaterial({ color:c });
  switch (t.mesh){
    case 'orb': g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), basic(0xffe0a0))); g.add(glowSprite(0xff6a1a, 1.5)); g.add(glowSprite(0xffb060, .8)); break;
    case 'spike': { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), basic(0xe8fbff)); m.scale.set(.6, .6, 3); g.add(m); g.add(glowSprite(0x4fd6ff, 1.3)); break; }
    case 'crescent': { const m = new THREE.Mesh(new THREE.TorusGeometry(.8, .07, 4, 24, Math.PI), addMat(0xb8fff0)); m.rotation.set(Math.PI/2, 0, Math.PI); g.add(m);
      const m2 = new THREE.Mesh(new THREE.TorusGeometry(.8, .2, 4, 24, Math.PI), addMat(0x7affd2)); m2.rotation.copy(m.rotation); m2.material.opacity = .4; g.add(m2); break; }
    case 'bullet': { const m = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .5, 6), basic(0xfff2b0)); m.rotation.x = Math.PI/2; g.add(m); g.add(glowSprite(0xffcf4a, .5)); break; }
    case 'grenade': { const m = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), toon(0x3f4a2e)); m.castShadow = true; g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.1, .025, 4, 10), toon(0xc9a45c)); ring.position.y = .14; g.add(ring); const bl = glowSprite(0xff3a2a, .5); g.add(bl); g.userData.blink = bl; break; }
    case 'boulder': { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(.55, 0), toon(0x77726a, { flatShading:true })); m.castShadow = true; g.add(m);
      const o = new THREE.Mesh(m.geometry, OUT); o.scale.setScalar(1.06); m.add(o); g.userData.spin = m; break; }
    case 'wave': { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, .6, .4), addMat(0x7dff5a)); m.material.opacity = .55; m.position.y = .1; g.add(m);
      for (let i = -1; i <= 1; i++){ const r = new THREE.Mesh(new THREE.ConeGeometry(.3, .9, 5), toon(0x77726a, { flatShading:true })); r.position.set(i*.7, .2, 0); g.add(r); } break; }
  }
  scene.add(g); return g;
}
function shoot(f, type, spread){
  const t = PROJ[type], fw = f.fwd(), o = f.opp;
  const start = chest(f).addScaledVector(fw, .7); start.y += .15;
  let vel;
  if (t.ground){ start.y = .3; const yaw = f.facing; vel = new V3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(t.speed); }
  else if (t.grav){
    let dist = 14, dirFlat = fw.clone();
    if (f.assisted){ const dx = o.pos.x - start.x, dz = o.pos.z - start.z; dist = Math.max(3, Math.min(26, Math.hypot(dx, dz))); dirFlat.set(dx, 0, dz).normalize(); }
    else dist = 10 + Math.max(0, f.aimPitch + .2)*20;
    const T = dist/t.speed, vy = t.grav*T/2 - (start.y - .3)/T;
    vel = dirFlat.multiplyScalar(t.speed); vel.y = vy;
  } else {
    let dir;
    if (f.assisted) dir = chest(o).sub(start).normalize();
    else { const p = Math.max(-.6, Math.min(.6, f.aimPitch)); dir = new V3(fw.x*Math.cos(p), Math.sin(p), fw.z*Math.cos(p)); }
    if (spread) dir.applyAxisAngle(UP, spread);
    vel = dir.multiplyScalar(t.speed);
  }
  const p = { id:++projId, type, owner:f.idx, pos:start, vel, life:t.life, g:makeProjMesh(type) };
  p.g.position.copy(p.pos); projectiles.push(p);
  fx('shot', null, [t.snd, f.idx]);
}
function removeProj(i){ const p = projectiles[i]; scene.remove(p.g); p.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== OUT && !o.isSprite) o.material.dispose(); }); projectiles.splice(i, 1); }
function projVisual(g, vel, type, dt){
  g.lookAt(g.position.clone().add(vel));
  if (g.userData.spin) g.userData.spin.rotation.x += dt*8;
  if (g.userData.blink) g.userData.blink.material.opacity = Math.sin(clock*25) > 0 ? 1 : .2;
  const t = PROJ[type];
  if (t && t.trail && Math.random() < .7){
    spark(g.position, t.trail[Math.floor(Math.random()*t.trail.length)], new V3((Math.random()-.5)*.8, Math.random()*.8, (Math.random()-.5)*.8), .3, t.mesh === 'wave' ? .8 : .5, t.tg);
  }
}
function updateProjectiles(dt){
  for (let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i], t = PROJ[p.type], owner = fighters[p.owner], o = fighters[1 - p.owner];
    p.life -= dt; if (t.grav) p.vel.y -= t.grav*dt; p.pos.addScaledVector(p.vel, dt);
    if (t.ground){ p.pos.y = .3; if (Math.hypot(p.pos.x, p.pos.z) > R) p.life = 0; }
    p.g.position.copy(p.pos); projVisual(p.g, p.vel, p.type, dt);
    let dead = p.life <= 0 || p.pos.y < -6, hitPoint = null;
    if (!dead && p.pos.y < .05 && Math.hypot(p.pos.x, p.pos.z) < R && !t.ground){ dead = true; hitPoint = p.pos.clone().setY(.1); }
    if (!dead && !t.ground){ for (const c of COLS){ if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.r + .15 && p.pos.y < 3.8){ dead = true; hitPoint = p.pos.clone(); break; } } }
    if (!dead && o.state !== 'fall' && o.state !== 'ko'){
      const hit = t.ground ? (Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z) < t.r && o.pos.y < .7) : p.pos.distanceTo(chest(o)) < t.r;
      if (hit){
        dead = true;
        if (t.splash) hitPoint = p.pos.clone();
        else o.receive(owner, { dmg:t.dmg, kb:t.kb, stun:t.stun, hitFx:t.hitFx || 'kick', color:t.color }, p.vel);
      }
    }
    if (dead){
      if (t.splash && (hitPoint || p.life <= 0)) explode(owner, hitPoint || p.pos, t.splash, { dmg:t.dmg, kb:t.kb, stun:t.stun }, t.color);
      else if (hitPoint) fx('boom', P3a(hitPoint), [.8, t.color]);
      removeProj(i);
    }
  }
}
function explode(owner, pos, radius, sp, color){
  fx('boom', P3a(pos), [radius, color]);
  const o = owner.opp, c = chest(o);
  if (c.distanceTo(pos) < radius + .5) o.receive(owner, Object.assign({ aoe:true, hitFx:'kick' }, sp), new V3(o.pos.x - pos.x, 0, o.pos.z - pos.z));
}
function nova(f, sp){
  fx(sp.frost ? 'frostnova' : 'nova', [r2(f.pos.x), r2(f.pos.y), r2(f.pos.z)], [sp.radius, sp.color]);
  const o = f.opp, d = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
  if (d < sp.radius && Math.abs(o.pos.y - f.pos.y) < 2.5) o.receive(f, Object.assign({ hitFx:'kick', noGain:true }, sp));
}
function rush(f, sp){
  f.state = 'rush'; f.dashT = sp.time; f.rushSpec = Object.assign({ noGain:false }, sp); f.hasHit = false;
  const o = f.opp;
  f.dashDir = f.assisted ? new V3(o.pos.x - f.pos.x, 0, o.pos.z - f.pos.z).normalize() : f.fwd();
  fx('whoosh');
}
function lineTrace(start, dir, range, width, o){
  let len = range;
  for (const c of COLS){
    const t = (c.x - start.x)*dir.x + (c.z - start.z)*dir.z;
    if (t > 0 && t < len && start.y + dir.y*t < 3.8){ if (Math.hypot(c.x - (start.x + dir.x*t), c.z - (start.z + dir.z*t)) < c.r) len = t; }
  }
  const oc = chest(o), v = oc.clone().sub(start), t = v.dot(dir);
  let hit = false;
  if (t > 0 && t < len + .3 && o.state !== 'fall'){ const closest = start.clone().addScaledVector(dir, t); if (closest.distanceTo(oc) < width) { hit = true; len = t; } }
  return { hit, end:start.clone().addScaledVector(dir, len) };
}
function aimDir(f, from){
  if (f.assisted) return chest(f.opp).sub(from).normalize();
  const p = f.aimPitch, fw = f.fwd(); return new V3(fw.x*Math.cos(p), Math.sin(p), fw.z*Math.cos(p));
}
function beam(f, sp){
  const start = chest(f).addScaledVector(f.fwd(), .6);
  const dir = f.fwd(); dir.y = 0;
  const r = lineTrace(start, dir, sp.range, sp.width, f.opp);
  fx('beam', [...P3a(start), ...P3a(r.end)], sp.color);
  if (r.hit) f.opp.receive(f, { dmg:sp.dmg, kb:1.5, stun:.5, freeze:sp.freeze, noGain:true }, dir);
}
function bolt(f, sp){
  const start = chest(f).addScaledVector(f.fwd(), .7); start.y += .3;
  const dir = aimDir(f, start), r = lineTrace(start, dir, sp.range, .85, f.opp);
  fx('zap', [...P3a(start), ...P3a(r.end)], sp.color);
  if (r.hit) f.opp.receive(f, { dmg:sp.dmg, kb:sp.kb, stun:sp.stun, hitFx:'punch', color:sp.color }, dir);
}
function blink(f){
  const from = f.pos.clone();
  const dir = f.lastMv && f.lastMv.lengthSq() > .01 ? f.lastMv.clone().normalize() : f.fwd().multiplyScalar(-1);
  const dest = clampIn(from.clone().addScaledVector(dir, 7), R - 1); pushFromCols(dest);
  fx('blink', [r2(from.x), r2(from.y + 1), r2(from.z)], f.cfg.glow);
  f.pos.x = dest.x; f.pos.z = dest.z;
  fx('blink', [r2(dest.x), r2(dest.y + 1), r2(dest.z)], f.cfg.glow);
  const o = f.opp;
  if (o.pos.distanceTo(from) < 2.6) o.receive(f, { dmg:6, kb:3, stun:.35, hitFx:'punch', color:f.cfg.glow, aoe:true }, new V3(o.pos.x - from.x, 0, o.pos.z - from.z));
}
function strike(f, x, z, delay, radius, sp, style, color){
  const p = clampIn(new V3(x, 0, z), R - .5);
  fx('mark', [r2(p.x), 0, r2(p.z)], [radius, delay, color]);
  schedule(delay, () => {
    if (style === 'bolt') fx('skybolt', [r2(p.x), 0, r2(p.z)], color);
    else fx('boom', [r2(p.x), .4, r2(p.z)], [radius, color]);
    const o = f.opp;
    if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < radius + .4 && o.pos.y < 3) o.receive(f, Object.assign({ aoe:true, hitFx:'kick', noGain:true, color }, sp), new V3(o.pos.x - p.x, 0, o.pos.z - p.z));
  });
}
function barrage(f){
  for (let i = 0; i < 8; i++) schedule(i*.17, () => {
    const o = f.opp, a = Math.random()*Math.PI*2, d = i === 0 ? 0 : Math.random()*3.2;
    strike(f, o.pos.x + Math.cos(a)*d, o.pos.z + Math.sin(a)*d, .55, 2.4, { dmg:8, kb:7, stun:.45 }, 'boom', 0xff8a30);
  });
}
function storm(f){
  for (let i = 0; i < 5; i++) schedule(i*.38, () => {
    const o = f.opp; strike(f, o.pos.x + o.kb.x*.2, o.pos.z + o.kb.z*.2, .45, 1.9, { dmg:8, kb:3, stun:.5 }, 'bolt', 0xfff04a);
  });
}
function thousandCuts(f){
  const o = f.opp, d = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
  if (d > 26 || o.state === 'fall' || o.state === 'ko'){ fx('whoosh'); return; }
  const from = f.pos.clone(), away = new V3(o.pos.x - f.pos.x, 0, o.pos.z - f.pos.z).normalize();
  const dest = clampIn(o.pos.clone().addScaledVector(away, 1.3), R - .6); pushFromCols(dest);
  fx('blink', [r2(from.x), r2(from.y + 1), r2(from.z)], f.cfg.glow);
  f.pos.set(dest.x, o.pos.y, dest.z); f.vy = 0; f.facing = Math.atan2(o.pos.x - dest.x, o.pos.z - dest.z);
  fx('blink', [r2(dest.x), r2(dest.y + 1), r2(dest.z)], f.cfg.glow);
  if (o.state !== 'frozen'){ o.state = 'hit'; o.stun = 1.2; } o.kb.set(0, 0, 0);
  const dirTo = () => new V3(o.pos.x - f.pos.x, 0, o.pos.z - f.pos.z);
  for (let i = 0; i < 6; i++) schedule(.08 + i*.11, () => { if (o.state !== 'ko' && o.state !== 'fall') o.receive(f, { dmg:4, kb:.3, stun:.5, unblock:true, hitFx:'cut', color:f.cfg.glow, noGain:true }, dirTo()); });
  schedule(.85, () => { if (o.state !== 'ko' && o.state !== 'fall') o.receive(f, { dmg:9, kb:15, stun:.6, unblock:true, hitFx:'kick', color:f.cfg.glow, lift:5, noGain:true }, dirTo()); });
}
function quake(f){
  f.vy = 7; fx('jump');
  f.onLand = () => {
    fx('quake', [r2(f.pos.x), 0, r2(f.pos.z)], 7.5);
    const o = f.opp;
    if (Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z) < 7.5 && o.pos.y < .6) o.receive(f, { dmg:20, kb:9, stun:1.3, aoe:true, hitFx:'kick', lift:4, noGain:true });
  };
}

/* ================= Input sources ================= */
let frameDt = 0;
const ACTIONS = ['punch','kick','dash','shot','sk2','ult','jump'];
function makeLocal(){
  const prev = {};
  return () => {
    const d = a => CONTROLS[a].some(k => keys[k]);
    if (frameDt){
      look.yaw += ((d('lookL') ? 1 : 0) - (d('lookR') ? 1 : 0))*2.4*frameDt;
      look.pitch += ((d('lookU') ? 1 : 0) - (d('lookD') ? 1 : 0))*1.6*frameDt; clampPitch();
    }
    const press = [];
    for (const a of ACTIONS){ const n = d(a); if (n && !prev[a]) press.push(a); prev[a] = n; }
    return { x:(d('right')?1:0) - (d('left')?1:0), z:(d('up')?1:0) - (d('down')?1:0), yaw:look.yaw, pitch:look.pitch, block:d('block'), press };
  };
}
let guestInput = null;
const REMOTE_KEYS = [['punch','p'],['kick','k'],['dash','d'],['shot','s'],['sk2','f'],['ult','u'],['jump','j']];
function makeRemote(){
  const seen = {};
  return () => {
    const i = guestInput, press = [];
    if (!i || typeof i !== 'object') return { x:0, z:0, yaw:0, pitch:0, block:false, press };
    for (const [a, key] of REMOTE_KEYS){ const v = Number(i[key]) || 0; if (seen[key] !== undefined && v > seen[key]) press.push(a); seen[key] = v; }
    const cl = v => Math.max(-1, Math.min(1, Number(v) || 0));
    return { x:cl(i.x), z:cl(i.z), yaw:Number(i.yw) || 0, pitch:Math.max(-1.4, Math.min(1.4, Number(i.pt) || 0)), block:!!i.b, press };
  };
}

/* ================= Bot ================= */
const BOT_LEVELS = {
  easy:  { react:.55, block:.2,  aim:.45, aggr:.45, dodge:.12, skill:.35 },
  normal:{ react:.32, block:.45, aim:.18, aggr:.7,  dodge:.35, skill:.6 },
  hard:  { react:.16, block:.75, aim:.05, aggr:.88, dodge:.65, skill:.85 }
};
function makeBot(f, level){
  const L = BOT_LEVELS[level] || BOT_LEVELS.normal;
  let t = 0, strafe = 1, strafeT = 0, noise = 0;
  const plan = { x:0, z:0, block:false, once:[] };
  const losClear = () => {
    const o = f.opp, dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx/d, uz = dz/d;
    return !COLS.some(c => { const tt = (c.x - f.pos.x)*ux + (c.z - f.pos.z)*uz; return tt > 0 && tt < d && Math.hypot(c.x - (f.pos.x + ux*tt), c.z - (f.pos.z + uz*tt)) < c.r + .3; });
  };
  const wants = (tag, d, los, threatened, myR) => {
    switch (tag){
      case 'far': return d > 6 && d < 24 && los;
      case 'close': return d < 4.8;
      case 'gap': return d > 4 && d < 10 && los;
      case 'line': return d < 20 && los;
      case 'any': return d < 24;
      case 'escape': return (threatened && f.hp < 50) || myR > R - 3;
    }
    return false;
  };
  return () => {
    const dt = frameDt; t -= dt; strafeT -= dt;
    const o = f.opp, dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1, C = f.cfg;
    const ang = Math.atan2(dx, dz), myR = Math.hypot(f.pos.x, f.pos.z), oR = Math.hypot(o.pos.x, o.pos.z);
    if (strafeT <= 0){ strafe = Math.random() < .5 ? -1 : 1; strafeT = 1 + Math.random()*2; }
    if (t <= 0){
      t = L.react*(.7 + Math.random()*.6);
      const rnd = Math.random;
      plan.x = 0; plan.z = 0; plan.block = false;
      noise = (rnd() - .5)*2*L.aim;
      const meleeRange = C.light.range*(C.scale || 1) - .2;
      const threatened = (o.state === 'punch' || o.state === 'kick' || o.state === 'rush') && d < 3.5;
      const incoming = projectiles.some(p => p.owner !== f.idx && p.pos.distanceTo(f.pos) < 9 && p.vel.dot(new V3().subVectors(f.pos, p.pos)) > 0);
      const oUlt = o.state === 'ult' && o.ab && o.atkT < o.ab.windup;
      const los = losClear();
      if (oUlt && rnd() < L.dodge + .2){ plan.x = strafe; plan.z = -1; plan.once.push(rnd() < .5 ? 'dash' : 'jump'); }
      else if (threatened && rnd() < L.block){ plan.block = true; }
      else if (incoming && rnd() < L.dodge){ plan.x = strafe; plan.once.push(rnd() < .5 ? 'jump' : 'dash'); }
      else if (f.energy >= 100 && wants(C.r.bot, d, los, threatened, myR) && rnd() < .85){ noise = 0; plan.once.push('ult'); }
      else if (f.cdF <= 0 && wants(C.f.bot, d, los, threatened, myR) && rnd() < L.skill){ noise = 0; plan.once.push('sk2'); if (C.f.bot === 'escape'){ plan.z = -1; plan.x = strafe; } }
      else if (d > 7){
        if (f.cdQ <= 0 && wants(C.q.bot, d, los) && rnd() < .5*L.aggr){ plan.once.push('shot'); }
        else { plan.z = 1; plan.x = strafe*.4; if (rnd() < .2) plan.once.push('dash'); }
      } else if (d > meleeRange){
        plan.z = 1; plan.x = strafe*.5;
        if (f.cdQ <= 0 && rnd() < .25*L.aggr) plan.once.push('shot');
        else if (rnd() < .08) plan.once.push('jump');
        else if (rnd() < .12*L.aggr) plan.once.push('dash');
      } else {
        if (rnd() < L.aggr) plan.once.push(rnd() < (oR > R - 4 ? .75 : .35) ? 'kick' : 'punch');
        else if (rnd() < .5){ plan.z = -1; plan.block = rnd() < L.block; }
        plan.x = strafe*.3;
      }
      if (myR > R - 3.2){
        const cx = -f.pos.x/myR, cz = -f.pos.z/myR, fx_ = Math.sin(ang), fz_ = Math.cos(ang);
        plan.z = cx*fx_ + cz*fz_; plan.x = cx*(-fz_) + cz*fx_; plan.block = false;
      }
    }
    const press = plan.once.splice(0);
    return { x:plan.x, z:plan.z, yaw:ang + noise, pitch:0, block:plan.block, press };
  };
}
f1.ctrl = makeLocal(); f2.ctrl = makeBot(f2, 'normal');

/* ================= Effects (shared with the network) ================= */
const r2 = v => Math.round(v*100)/100;
const FX_SPARK = { punch:[0xfff1c9,10,5,.08], kick:[0xffb347,18,7,.26], block:[0x8fd3ff,8,4,.1], cut:[0xffffff,14,6,.12] };
let events = [], evId = 0, ann = null, annId = 0;
let shake = 0;
function addShake(v){ shake = Math.min(.7, shake + v); }
const P3 = p => Array.isArray(p) ? new V3(+p[0] || 0, +p[1] || 0, +p[2] || 0) : null;
const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
function fx(kind, p, extra, fromNet){
  const pos = P3(p), ex = Array.isArray(extra) ? extra : null;
  switch (kind){
    case 'combo': if (ex) showCombo(ex[0] ? 1 : 0, num(ex[1], 0)); break;
    case 'shot': {
      const snd = ex ? String(ex[0]) : '';
      if (SFX['s_' + snd]) SFX['s_' + snd]();
      if (snd === 'gun' && ex){ const fi = fighters[ex[1] ? 1 : 0]; if (fi.muzzleR){ fi.muzzleR.material.opacity = 1; fi.muzzleL.material.opacity = 1; } }
      break;
    }
    case 'boom': if (pos && ex){ const rad = Math.min(8, num(ex[0], 1)); boomEffect(p.map(Number), rad, num(ex[1], 0xffffff)); SFX.boom(rad); addShake(Math.min(.5, rad*.1)); } break;
    case 'nova': if (pos && ex){ boomEffect([pos.x, pos.y + 1, pos.z], Math.min(8, num(ex[0], 4)), num(ex[1], 0xff6a1a)); SFX.nova(); addShake(.55); } break;
    case 'frostnova': if (pos && ex){ boomEffect([pos.x, pos.y + .6, pos.z], Math.min(8, num(ex[0], 3)), 0x9eeaff); SFX.freeze(); addShake(.25); } break;
    case 'beam': if (Array.isArray(p) && p.length === 6){ lineEffect(p.map(Number), num(extra, 0x4fd6ff), .42, .55); SFX.beam(); addShake(.25); } break;
    case 'zap': if (Array.isArray(p) && p.length === 6){ zigzag(p.map(Number), num(extra, 0xfff04a)); SFX.zap(); } break;
    case 'skybolt': if (pos){ zigzag([pos.x, 34, pos.z, pos.x, 0, pos.z], num(extra, 0xfff04a)); boomEffect([pos.x, .3, pos.z], 1.4, num(extra, 0xfff04a)); SFX.thunder(); addShake(.3); } break;
    case 'mark': if (pos && ex) markEffect([pos.x, 0, pos.z], Math.min(6, num(ex[0], 2)), Math.min(2, num(ex[1], .5)), num(ex[2], 0xff4a30)); break;
    case 'blink': if (pos){ burst(pos, num(extra, 0xffffff), 20, 6, .5); SFX.blink(); } break;
    case 'quake': if (pos){ quakeEffect(p.map(Number), Math.min(10, num(extra, 7))); SFX.quake(); addShake(.7); } break;
    case 'freeze': SFX.freeze(); if (pos) burst(pos, 0xbdf3ff, 22, 5, .45); break;
    case 'shatter': SFX.shatter(); if (pos) burst(pos, 0xbdf3ff, 26, 7, .4); break;
    case 'charge': SFX.charge(); break;
    case 'jump': SFX.jump(); break;
    case 'land': SFX.land(); break;
    default: {
      if (kind === 'cut') SFX.slash(); else if (SFX[kind]) SFX[kind]();
      const sp = FX_SPARK[kind];
      if (sp && pos){ burst(pos, num(extra, 0) || sp[0], sp[1], sp[2]); if (num(extra, 0)) burst(pos, 0xffffff, 6, sp[2]); addShake(sp[3]); }
    }
  }
  if (!fromNet && mode === 'host'){ events.push([++evId, kind, p || 0, extra ?? 0]); if (events.length > 24) events.shift(); }
}

/* ================= Camera ================= */
let camMode = 'tps';
try { camMode = localStorage.getItem('kor-cam') === 'fps' ? 'fps' : 'tps'; } catch(e){}
const camPos = new V3(), camLook = new V3();
let playerIdx = 0;
const me = () => playerIdx;
function toggleCam(){
  if (!inGame()) return;
  camMode = camMode === 'fps' ? 'tps' : 'fps'; clampPitch();
  try { localStorage.setItem('kor-cam', camMode); } catch(e){}
  updateViewTags();
}
function updateViewTags(){
  $('vt1').textContent = `${camMode === 'fps' ? 'Birinci şahıs' : 'Üçüncü şahıs'} (V ile değiştir)`;
  $('vt1').hidden = !inGame(); $('cross').hidden = !inGame(); $('power').hidden = !inGame();
}
const tmp = new V3();
function lookDir(){ const cp = Math.cos(look.pitch); return new V3(Math.sin(look.yaw)*cp, Math.sin(look.pitch), Math.cos(look.yaw)*cp); }
function updateViewCam(dt, snap){
  const f = fighters[me()];
  const fps = camMode === 'fps' && !['ko','fall'].includes(f.state);
  const dir = lookDir(), flat = new V3(Math.sin(look.yaw), 0, Math.cos(look.yaw)), right = new V3(-flat.z, 0, flat.x);
  if (f.state === 'fall'){
    const tgt = new V3(f.pos.x, Math.max(f.pos.y, -50) + 1, f.pos.z); camLook.lerp(tgt, 1 - Math.exp(-6*dt));
  } else if (fps){
    f.root.updateMatrixWorld(true); f.head.getWorldPosition(tmp);
    const pos = tmp.addScaledVector(flat, .2); pos.y += .04;
    camPos.lerp(pos, snap ? 1 : 1 - Math.exp(-30*dt));
    camLook.copy(camPos).addScaledVector(dir, 10);
  } else {
    const sc = f.cfg.scale || 1, pivot = f.pos.clone(); pivot.y += 1.85*sc;
    const pos = pivot.clone().addScaledVector(dir, -4.6*sc).addScaledVector(right, .85);
    if (Math.hypot(pos.x, pos.z) < R + 1) pos.y = Math.max(pos.y, .35);
    camPos.lerp(pos, snap ? 1 : 1 - Math.exp(-18*dt));
    camLook.copy(camPos).addScaledVector(dir, 10);
  }
  cam.position.copy(camPos);
  if (shake > .001){ cam.position.x += (Math.random()-.5)*shake*.6; cam.position.y += (Math.random()-.5)*shake*.6; }
  cam.lookAt(camLook);
  const fov = fps ? 78 : 65; if (Math.abs(cam.fov - fov) > .1){ cam.fov += (fov - cam.fov)*Math.min(1, dt*10); cam.updateProjectionMatrix(); }
  cam.layers.enable(1); cam.layers.enable(2); if (fps) cam.layers.disable(1 + me());
}
function updateMenuCam(){
  const t = clock*.08;
  menuCam.position.set(Math.sin(t)*30, 11 + Math.sin(t*.7)*2, Math.cos(t)*30); menuCam.lookAt(0, 0, 0);
}

/* ================= Game flow ================= */
let phase = 'menu', prevPhase = 'menu', phaseT = 0, round = 1, wins = [0,0], timeLeft = 90, clock = 0, timeScale = 1, slowT = 0;
let names = ['Oyuncu','Rakip'], pick = 'kor', botLevel = 'normal';
let mode = 'bot', nr = null, guestPeer = null, lastSeen = 0, lastSent = 0, lastSentIn = '', guestCtrl = null,
    guestCount = { p:0, k:0, d:0, s:0, f:0, u:0, j:0 }, lastSt = null, lastEv = -1, lastAnn = -1, hostSeen = false, joinT = 0, myPeer = null;
try { $('myName').value = localStorage.getItem('kor-me') || ''; } catch(e){}
try { const p = localStorage.getItem('arena-pick'); if (CHARS[p]) pick = p; } catch(e){}
try { const l = localStorage.getItem('kor-level'); if (BOT_LEVELS[l]) botLevel = l; } catch(e){}
(function buildRoster(){
  const r = $('roster');
  for (const id of CHAR_IDS){
    const c = CHARS[id], b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.id = id; b.style.setProperty('--c', c.ui);
    const nm = document.createElement('b'); nm.textContent = c.name;
    const tg = document.createElement('span'); tg.className = 'tg'; tg.textContent = `${c.tag}, ${c.weapon.toLocaleLowerCase('tr')}`;
    const ab = document.createElement('span'); ab.className = 'ab'; ab.textContent = `Q: ${c.q.name}. E: ${c.f.name}. Ulti: ${c.r.name}.`;
    b.append(nm, tg, ab); r.appendChild(b);
    b.onclick = () => { pick = id; try { localStorage.setItem('arena-pick', id); } catch(e){} syncPicks(); fighters[0].setChar(id); fighters[0].reset(); };
  }
})();
function syncPicks(){
  document.querySelectorAll('#roster button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === pick)));
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lv === botLevel)));
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { botLevel = b.dataset.lv; try { localStorage.setItem('kor-level', botLevel); } catch(e){} syncPicks(); });
syncPicks(); fighters[0].setChar(pick); fighters[0].reset();

function announce(big, small){
  const el = $('announce'); el.classList.remove('show'); void el.offsetWidth;
  el.textContent = '';
  if (big){
    const b = document.createElement('span'); b.className = 'big'; b.textContent = big; el.appendChild(b);
    if (small){ const s = document.createElement('span'); s.className = 'small'; s.textContent = small; el.appendChild(s); }
    el.classList.add('show');
  }
}
function say(big, small){ announce(big, small); if (mode === 'host') ann = { i:++annId, b:big || '', s:small || '' }; }
function showCombo(idx, n){
  const el = $('combo' + (idx + 1));
  el.textContent = n + ' vuruş'; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 900);
}
function clearProjectiles(){ for (let i = projectiles.length - 1; i >= 0; i--) removeProj(i); clearGuestProj(); scheduled = []; }
function applyCharUI(){
  [0, 1].forEach(i => { const c = fighters[i].cfg, side = document.querySelector('.side.p' + (i + 1)); side.style.setProperty('--c', c.ui); });
  const c = fighters[me()].cfg, P = $('power');
  P.style.setProperty('--c', c.ui);
  $('ultName').textContent = c.r.name;
  $('abQ').querySelector('.nm').textContent = c.q.name; $('abE').querySelector('.nm').textContent = c.f.name;
  powPrev.full = null; powPrev.q = powPrev.e = true;
}
const myName = def => { const n = ($('myName').value.trim() || def).slice(0,12); try { localStorage.setItem('kor-me', $('myName').value.trim()); } catch(e){} return n; };
const cleanName = n => String(n || 'Rakip').replace(/[\u0000-\u001f]/g,'').slice(0,12) || 'Rakip';

function enterGameUI(){
  $('n1').textContent = names[0]; $('n2').textContent = names[1]; applyCharUI();
  audio(); if (ac && ac.state === 'suspended') ac.resume();
  $('menu').hidden = true; $('lobby').hidden = true; $('result').hidden = true; $('hud').hidden = false;
  $('touch').hidden = !isTouch;
}
function startBot(){
  mode = 'bot'; playerIdx = 0;
  const others = CHAR_IDS.filter(id => id !== pick), botChar = others[Math.floor(Math.random()*others.length)];
  fighters[0].setChar(pick); fighters[1].setChar(botChar);
  names = [myName(CHARS[pick].name), `${CHARS[botChar].name} (bot)`];
  fighters[0].ctrl = makeLocal(); fighters[1].ctrl = makeBot(fighters[1], botLevel);
  startMatch();
  requestLock();
}
function startMatch(){ wins = [0,0]; round = 1; enterGameUI(); startRound(); }
function startRound(){
  fighters.forEach(f => f.reset()); clearProjectiles(); timeLeft = 90; timeScale = 1;
  phase = 'intro'; phaseT = 0;
  const f = fighters[me()]; look.yaw = f.facing; look.pitch = -.12;
  updateViewCam(0, true);
  $('roundLabel').textContent = 'Raunt ' + round;
  updateViewTags(); updateLookHint();
  say(round === 3 ? 'Son raunt' : 'Raunt ' + round, `${names[0]} ile ${names[1]} karşı karşıya`);
}
function endRound(winner, big){
  if (phase !== 'fight') return;
  phase = 'roundEnd'; phaseT = 0;
  if (winner !== null) wins[winner]++;
  say(big, winner === null ? 'Kimse raundu alamadı' : `${names[winner]} raundu aldı`);
}
function onKO(f){ if (phase === 'fight'){ fx('ko'); timeScale = .3; slowT = .9; endRound(f.opp.idx, 'Nakavt!'); } }
function onRingOut(f){ if (phase === 'fight'){ fx('ko'); endRound(f.opp.idx, 'Boşluğa düştü!'); } }
function releaseLock(){ wantLock = false; if (locked()) document.exitPointerLock(); }
function showResult(){
  const w = wins[0] > wins[1] ? 0 : 1;
  phase = 'over'; say(''); releaseLock();
  $('rematchBtn').hidden = mode === 'guest'; $('resultNote').hidden = mode !== 'guest';
  $('resultTitle').textContent = w === me() ? 'Kazandın!' : `${names[w]} kazandı`;
  $('resultTitle').style.color = w === 0 ? '#ff9a5a' : '#8fe6ff';
  $('resultScore').textContent = `${names[0]} ${wins[0]} – ${wins[1]} ${names[1]}`;
  $('result').hidden = false; updateLookHint(); (mode === 'guest' ? $('menuBtn') : $('rematchBtn')).focus();
}
function toMenu(msg){
  releaseLock();
  if (nr){ try { nr.leave(); } catch(e){} nr = null; }
  mode = 'bot'; guestPeer = null; guestInput = null; lastSt = null; hostSeen = false; playerIdx = 0;
  fighters[0].setChar(pick);
  phase = 'menu'; announce(''); fighters.forEach(f => f.reset()); clearProjectiles(); timeScale = 1;
  ['pause','result','lobby','hud','touch','netTag','vt1','cross','lookHint','power'].forEach(id => $(id).hidden = true);
  $('menu').hidden = false;
  $('onlineMsg').textContent = typeof msg === 'string' ? msg : '';
}
let lastToggle = 0;
function togglePause(){
  if (!inGame()) return;
  const now = performance.now(); if (now - lastToggle < 250) return; lastToggle = now;
  if (mode !== 'bot'){
    const show = $('pause').hidden; $('pause').hidden = !show;
    if (show){ releaseLock(); $('resumeBtn').focus(); } else requestLock();
    updateLookHint(); return;
  }
  if (phase === 'paused'){ phase = prevPhase; $('pause').hidden = true; requestLock(); }
  else if (phase === 'fight' || phase === 'intro' || phase === 'roundEnd'){ prevPhase = phase; phase = 'paused'; $('pause').hidden = false; releaseLock(); $('resumeBtn').focus(); }
  updateLookHint();
}
$('botBtn').onclick = startBot;
$('rematchBtn').onclick = () => { if (mode === 'host' || mode === 'bot'){ startMatch(); requestLock(); } };
$('menuBtn').onclick = () => toMenu();
$('quitBtn').onclick = () => toMenu();
$('lobbyCancel').onclick = () => toMenu();
$('resumeBtn').onclick = togglePause;
$('pauseBtn').onclick = togglePause;
$('muteBtn').onclick = toggleMute;
$('hostBtn').onclick = hostRoom;
$('joinBtn').onclick = joinRoom;
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

/* ================= Online ================= */
let roomApi = null;
/* Peer-to-peer fallback (PeerJS) so online play also works outside claude.ai.
   It exposes the same small interface the game uses: presence(), peers(), leave(). */
function makePeerRoomApi(){
  if (typeof window.Peer !== 'function') return null;
  return {
    isPeer:true,
    join(name, asHost){
      return new Promise((resolve, reject) => {
        const roomId = 'gokarenasi-' + name.replace(/[^a-z0-9-]/gi, '');
        const peer = asHost ? new window.Peer(roomId) : new window.Peer();
        const remotes = new Map();
        let mine = {}, myId = null, settled = false, closed = false;
        const send = conn => { try { if (conn.open) conn.send({ t:'p', d:mine }); } catch(e){} };
        const attach = conn => {
          conn.on('open', () => { remotes.set(conn.peer, { conn, presence:null }); send(conn); });
          conn.on('data', msg => { const r = remotes.get(conn.peer); if (r && msg && msg.t === 'p' && typeof msg.d === 'object') r.presence = msg.d; });
          conn.on('close', () => remotes.delete(conn.peer));
          conn.on('error', () => remotes.delete(conn.peer));
        };
        const api = {
          presence(partial){ mine = Object.assign({}, mine, partial); for (const r of remotes.values()) send(r.conn); return Promise.resolve(); },
          peers(){
            const list = [{ peer:myId, isMe:true, sameTab:true, presence:mine }];
            for (const [id, r] of remotes) if (r.presence) list.push({ peer:id, isMe:false, sameTab:false, presence:r.presence });
            return list;
          },
          leave(){ if (closed) return; closed = true; try { peer.destroy(); } catch(e){} }
        };
        peer.on('open', id => {
          myId = id;
          if (!asHost) attach(peer.connect(roomId, { reliable:true, serialization:'json' }));
          settled = true; resolve(api);
        });
        peer.on('connection', conn => { if (asHost) attach(conn); else conn.close(); });
        peer.on('error', err => {
          if (!settled){ settled = true; try { peer.destroy(); } catch(e){} reject(err); }
        });
        setTimeout(() => { if (!settled){ settled = true; try { peer.destroy(); } catch(e){} reject(new Error('timeout')); } }, 12000);
      });
    }
  };
}
const roomReady = ((window.claude && typeof window.claude.use === 'function')
  ? window.claude.use('room').catch(() => null) : Promise.resolve(null))
  .then(r => r || makePeerRoomApi())
  .then(r => (roomApi = r));
roomReady.then(r => { if (!r){ $('hostBtn').disabled = true; $('joinBtn').disabled = true;
  $('onlineMsg').textContent = 'Online bağlantı kütüphanesi yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile. Bota karşı oynayabilirsin.'; } });
const joinNet = (room, name, asHost) => room.isPeer ? room.join(name, asHost) : room.join(name);
function setBusy(b){ $('hostBtn').disabled = b || !roomApi; $('joinBtn').disabled = b || !roomApi; }

async function hostRoom(){
  const room = await roomReady; if (!room) return;
  setBusy(true); $('onlineMsg').textContent = 'Oda açılıyor…';
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random()*chars.length)];
  try {
    nr = await joinNet(room, 'kor-' + code.toLowerCase(), true);
    mode = 'host'; phase = 'lobby'; guestPeer = null; guestInput = null; events = []; ann = null; playerIdx = 0;
    fighters[0].setChar(pick); names = [myName(CHARS[pick].name), 'Rakip'];
    await nr.presence({ role:'host', name:names[0], st:null });
    fighters[0].ctrl = makeLocal(); fighters[1].ctrl = makeRemote();
    $('menu').hidden = true; $('lobby').hidden = false; $('lobbyTitle').textContent = 'Oda kuruldu';
    $('lobbyCode').textContent = code;
    $('lobbyMsg').textContent = `Bu kodu arkadaşına ver. O katılınca dövüş kendiliğinden başlar. Sen ${CHARS[pick].name} ile oynayacaksın.`;
    $('onlineMsg').textContent = ''; audio();
  } catch(e){ $('onlineMsg').textContent = 'Oda açılamadı. Biraz sonra tekrar dene.'; nr = null; mode = 'bot'; phase = 'menu'; }
  setBusy(false);
}
async function joinRoom(){
  const room = await roomReady; if (!room) return;
  const code = $('codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (code.length !== 4){ $('onlineMsg').textContent = 'Oda kodu 4 karakter olmalı.'; $('codeIn').focus(); return; }
  setBusy(true); $('onlineMsg').textContent = 'Odaya bağlanılıyor…';
  try {
    nr = await joinNet(room, 'kor-' + code.toLowerCase(), false);
    mode = 'guest'; phase = 'lobby'; hostSeen = false; playerIdx = 1; joinT = 0; lastSt = null; lastEv = -1; lastAnn = -1; myPeer = null;
    guestCtrl = makeLocal(); guestCount = { p:0, k:0, d:0, s:0, f:0, u:0, j:0 }; lastSentIn = '';
    await nr.presence({ role:'guest', name:myName(CHARS[pick].name), ch:pick, in:{ x:0, z:0, yw:0, pt:0, b:0, ...guestCount } });
    $('menu').hidden = true; $('lobby').hidden = false; $('lobbyTitle').textContent = 'Odaya katılınıyor';
    $('lobbyCode').textContent = code; $('lobbyMsg').textContent = 'Ev sahibi aranıyor…';
    $('onlineMsg').textContent = ''; audio();
  } catch(e){ $('onlineMsg').textContent = 'Odaya bağlanılamadı. Kodu kontrol edip tekrar dene.'; nr = null; mode = 'bot'; phase = 'menu'; }
  setBusy(false);
}
function hostNet(){
  if (!nr) return;
  const peers = nr.peers(), now = performance.now(), other = 1 - playerIdx;
  let g = guestPeer ? peers.find(p => p.peer === guestPeer) : null;
  if (!guestPeer && phase === 'lobby'){
    g = peers.find(p => !p.isMe && p.presence && p.presence.role === 'guest');
    if (g){ guestPeer = g.peer; names[1] = cleanName(g.presence.name); fighters[1].setChar(CHARS[g.presence.ch] ? g.presence.ch : 'ayaz'); lastSeen = now; startMatch(); }
  }
  if (guestPeer){
    if (g){ lastSeen = now; guestInput = g.presence && g.presence.in; }
    else if (now - lastSeen > 3500){ toMenu('Arkadaşının bağlantısı koptu.'); return; }
  }
  if (now - lastSent > 33 && phase !== 'lobby'){
    lastSent = now;
    const abKey = f => !f.ab ? '' : f.ab === f.cfg.q ? 'q' : f.ab === f.cfg.f ? 'f' : 'r';
    nr.presence({ role:'host', name:names[0], st:{
      ph:phase, r:round, w:wins, tl:r2(timeLeft), n:names, gp:guestPeer, c:fighters.map(f => f.charId),
      f:fighters.map(f => [r2(f.pos.x), r2(f.pos.y), r2(f.pos.z), r2(f.facing), f.state, r2(f.hp), r2(f.atkT), f.punchSide, r2(f.flash), Math.round(f.energy), abKey(f), r2(Math.max(0, f.cdF)), r2(Math.max(0, f.cdQ))]),
      pr:projectiles.slice(-12).map(p => [p.id, p.type, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.vel.x), r2(p.vel.y), r2(p.vel.z)]),
      ev:events, an:ann
    }}).catch(() => {});
  }
}
const guestProj = new Map();
function clearGuestProj(){ for (const [, q] of guestProj){ scene.remove(q.g); } guestProj.clear(); }
function guestFrame(dt){
  clock += dt;
  if (!nr) return;
  const now = performance.now();
  const c = guestCtrl();
  const keyOf = { punch:'p', kick:'k', dash:'d', shot:'s', sk2:'f', ult:'u', jump:'j' };
  for (const a of c.press) guestCount[keyOf[a]]++;
  const inp = { x:c.x, z:c.z, yw:Math.round(c.yaw*1000)/1000, pt:Math.round(c.pitch*1000)/1000, b:c.block ? 1 : 0, ...guestCount };
  const js = JSON.stringify(inp);
  if (js !== lastSentIn){ lastSentIn = js; nr.presence({ in:inp }).catch(() => {}); }
  const peers = nr.peers();
  if (!myPeer){ const mine = peers.find(p => p.sameTab); if (mine) myPeer = mine.peer; }
  const h = peers.find(p => !p.isMe && p.presence && p.presence.role === 'host');
  if (h) lastSeen = now;
  if (!hostSeen){
    joinT += dt;
    if (h && h.presence.st){
      hostSeen = true; playerIdx = 1; applySnapshot(h.presence.st);
      enterGameUI(); look.yaw = -Math.PI/2; look.pitch = -.12;
    }
    else if (joinT > 8 && !h){ toMenu('Bu kodla açık bir oda bulunamadı.'); return; }
  } else if (!h && now - lastSeen > 3500){ toMenu('Ev sahibi odadan ayrıldı.'); return; }
  const st = h && h.presence.st;
  if (st && st !== lastSt) applySnapshot(st);
  const k = 1 - Math.exp(-18*dt);
  fighters.forEach(f => {
    if (!f.tgt) return;
    f.pos.x += (f.tgt[0] - f.pos.x)*k; f.pos.y += (f.tgt[1] - f.pos.y)*k; f.pos.z += (f.tgt[2] - f.pos.z)*k;
    f.facing = lerpAngle(f.facing, f.tgt[3], k);
    f.t += dt; f.flash = Math.max(0, f.flash - dt*4);
    if (['punch','kick','cast','ult'].includes(f.state)) f.atkT += dt;
    if (f.state === 'fall'){ f.body.rotation.x -= dt*4; f.root.visible = f.pos.y > -45; }
    else { f.root.visible = true; f.animate(dt); }
    f.apply();
  });
  for (const [, q] of guestProj){ const t = PROJ[q.type]; if (t && t.grav) q.vel.y -= t.grav*dt; q.tgt.addScaledVector(q.vel, dt); q.g.position.lerp(q.tgt, k); projVisual(q.g, q.vel, q.type, dt); }
  updateSparks(dt); updateEffects(dt);
  if (hostSeen && phase !== 'lobby') updateViewCam(dt, false); else updateMenuCam();
  shake *= Math.exp(-10*dt);
  updateHUD();
}
const STATES = ['idle','walk','punch','kick','block','hit','dash','ko','fall','cast','ult','frozen'];
function applySnapshot(st){
  const first = !lastSt; lastSt = st;
  if (Array.isArray(st.c)){ let ch = false; st.c.forEach((id, i) => { if (CHARS[id] && fighters[i].charId !== id){ fighters[i].setChar(id); ch = true; } }); if (ch && hostSeen) applyCharUI(); }
  if (Array.isArray(st.n) && st.n.length === 2){ names = [cleanName(st.n[0]), cleanName(st.n[1])]; $('n1').textContent = names[0]; $('n2').textContent = names[1]; }
  if (Array.isArray(st.w)) wins = [Number(st.w[0]) || 0, Number(st.w[1]) || 0];
  round = Number(st.r) || 1; timeLeft = Number(st.tl) || 0; $('roundLabel').textContent = 'Raunt ' + round;
  const ph = String(st.ph || '');
  if (ph === 'over' && phase !== 'over'){ phase = 'over'; showResult(); }
  else if (ph !== 'over'){
    if (phase === 'over'){ $('result').hidden = true; }
    if (phase !== ph){ if (ph === 'intro'){ const f = fighters[me()]; look.yaw = Number(st.f && st.f[me()] && st.f[me()][3]) || look.yaw; } phase = ph; updateViewTags(); updateLookHint(); }
  }
  if (Array.isArray(st.f)) st.f.forEach((a, i) => {
    const f = fighters[i]; if (!f || !Array.isArray(a)) return;
    const tgt = [+a[0] || 0, +a[1] || 0, +a[2] || 0, +a[3] || 0];
    const ns = STATES.includes(a[4]) ? a[4] : 'idle';
    if (!f.tgt || first || (f.state === 'fall' && ns !== 'fall')){ f.pos.set(tgt[0], tgt[1], tgt[2]); f.facing = tgt[3]; if (ns !== 'fall') f.body.rotation.x = 0; }
    f.tgt = tgt; f.state = ns;
    f.hp = +a[5] || 0; f.atkT = +a[6] || 0; f.punchSide = a[7] ? 1 : 0; f.flash = Math.max(f.flash, +a[8] || 0); f.energy = +a[9] || 0;
    const ak = a[10]; f.ab = (ak === 'q' || ak === 'f' || ak === 'r') ? f.cfg[ak] : null; f.pose = f.ab ? f.ab.pose : ''; f.cdF = +a[11] || 0; f.cdQ = +a[12] || 0;
  });
  if (Array.isArray(st.pr)){
    const seen = new Set();
    for (const p of st.pr){
      if (!Array.isArray(p)) continue; const id = Number(p[0]); seen.add(id);
      let q = guestProj.get(id);
      if (!q){ const type = PROJ[p[1]] ? p[1] : 'fireball'; q = { g:makeProjMesh(type), type, tgt:new V3(), vel:new V3() }; q.g.position.set(+p[2] || 0, +p[3] || 0, +p[4] || 0); guestProj.set(id, q); }
      q.tgt.set(+p[2] || 0, +p[3] || 0, +p[4] || 0); q.vel.set(+p[5] || 0, +p[6] || 0, +p[7] || 0);
    }
    for (const [id, q] of guestProj){ if (!seen.has(id)){ scene.remove(q.g); guestProj.delete(id); } }
  }
  if (Array.isArray(st.ev)){
    for (const e of st.ev){ if (!Array.isArray(e)) continue; const id = Number(e[0]) || 0;
      if (first){ lastEv = Math.max(lastEv, id); continue; }
      if (id > lastEv){ lastEv = id; fx(String(e[1]), e[2], e[3], true); } }
  }
  if (st.an && typeof st.an === 'object' && st.an.i !== lastAnn){ lastAnn = st.an.i; announce(String(st.an.b || '').slice(0,40), String(st.an.s || '').slice(0,70)); }
  const spectating = st.gp && myPeer && st.gp !== myPeer;
  $('netTag').hidden = !spectating; if (spectating) $('netTag').textContent = 'İzleyici olarak bağlandın';
}

/* ================= Main update ================= */
function update(rawDt){
  clock += rawDt;
  if (slowT > 0){ slowT -= rawDt; if (slowT <= 0) timeScale = 1; }
  const dt = rawDt*timeScale;
  phaseT += rawDt;
  if (phase === 'intro'){
    if (phaseT > 1.4 && phaseT - rawDt <= 1.4){ say('Dövüş!'); fx('bell'); }
    if (phaseT > 2.0){ phase = 'fight'; say(''); }
  } else if (phase === 'fight'){
    timeLeft -= rawDt;
    if (timeLeft <= 0){ timeLeft = 0; endRound(f1.hp === f2.hp ? null : (f1.hp > f2.hp ? 0 : 1), 'Süre doldu'); }
  } else if (phase === 'roundEnd' && phaseT > 3){
    if (wins[0] >= 2 || wins[1] >= 2) showResult();
    else { round++; startRound(); }
  }
  const canAct = phase === 'fight';
  fighters.forEach(f => f.update(dt, canAct));
  const dx = f2.pos.x - f1.pos.x, dz = f2.pos.z - f1.pos.z, d = Math.hypot(dx, dz);
  if (d < .95 && d > 1e-4 && Math.abs(f1.pos.y - f2.pos.y) < 1.5 && f1.state !== 'fall' && f2.state !== 'fall'){
    const push = (.95 - d)/2, nx = dx/d, nz = dz/d;
    f1.pos.x -= nx*push; f1.pos.z -= nz*push; f2.pos.x += nx*push; f2.pos.z += nz*push;
  }
  runSchedule(dt); updateProjectiles(dt); updateSparks(dt); updateEffects(dt);
  if (!inGame()) updateMenuCam(); else updateViewCam(rawDt, false);
  shake *= Math.exp(-10*rawDt);
  updateHUD();
}
function updateHUD(){
  if (!inGame()) return;
  for (const i of [0, 1]){
    const f = fighters[i], n = i + 1;
    $('hp' + n).style.transform = `scaleX(${f.hp/100})`; $('lag' + n).style.transform = `scaleX(${f.hp/100})`;
    [...$('pips' + n).children].forEach((p, j) => p.classList.toggle('on', wins[i] > j));
  }
  $('timer').textContent = Math.ceil(timeLeft);
  updatePower();
}
const powPrev = { q:true, e:true, full:false, energy:0 };
function updatePower(){
  const m = fighters[me()], P = $('power'), e = Math.max(0, Math.min(100, m.energy));
  P.style.setProperty('--p', e.toFixed(1));
  $('ultFill').style.strokeDashoffset = (100 - e).toFixed(1);
  $('ultPct').textContent = Math.floor(e);
  const full = e >= 100;
  if (full !== powPrev.full){ P.classList.toggle('full', full); $('ultState').textContent = full ? 'Hazır, R ile kullan' : 'Dolduruluyor'; if (full) bump($('ultBox'), 'burst'); powPrev.full = full; }
  if (e - powPrev.energy > 3.5) bump($('ultBox'), 'gain');
  powPrev.energy = e;
  for (const [key, cd] of [['q', m.cdQ], ['e', m.cdF]]){
    const left = Math.max(0, cd), ready = left <= 0, el = $('ab' + key.toUpperCase());
    el.querySelector('.sweep').style.strokeDashoffset = (100*left/POWER_CD).toFixed(1);
    el.querySelector('.cd').textContent = ready ? '' : Math.ceil(left);
    el.querySelector('.st').textContent = ready ? 'Hazır' : `${left.toFixed(1)} sn`;
    el.classList.toggle('ready', ready);
    if (ready && !powPrev[key]) bump(el, 'pop');
    powPrev[key] = ready;
  }
}
function bump(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

/* ================= World animation ================= */
function animateWorld(dt){
  sigil.rotation.z += dt*.06;
  sigil.material.opacity = .65 + Math.sin(clock*1.5)*.2;
  edgeRing.material.color.setHSL(.11, 1, .62 + Math.sin(clock*3)*.08);
  auroraMats.forEach(m => m.uniforms.t.value += dt);
  for (const b of braziers){
    b.g.position.y = 2.6 + Math.sin(clock*1.2 + b.ph)*.3;
    const fl = .85 + Math.sin(clock*13 + b.ph)*.1 + Math.random()*.08;
    b.fl.scale.setScalar(1.8*fl); b.pl.intensity = 1.3*fl;
    if (Math.random() < .2) spark(b.g.position.clone().add(new V3(0, .6, 0)), Math.random() < .5 ? 0xff8a2a : 0xffd27a, new V3((Math.random()-.5)*.6, 1.2 + Math.random(), (Math.random()-.5)*.6), .6, .35, -.5);
  }
  for (const s of isles){ s.g.position.y = s.base + Math.sin(clock*s.sp + s.ph)*.8; s.g.rotation.y += dt*.02; }
  for (const fn of worldAnims) fn(dt, clock);
}

/* ================= Touch ================= */
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
(function buildTouch(){
  const wrap = $('touch'), pad = document.createElement('div'); pad.className = 'pad p1';
  const dpad = document.createElement('div'); dpad.className = 'dpad';
  const cells = [null,['up','▲'],null,['left','◀'],null,['right','▶'],null,['down','▼'],null];
  const acts = document.createElement('div'); acts.className = 'acts';
  const mk = (parent, action, label) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn'; b.textContent = label;
    if (action === 'cam'){ b.addEventListener('pointerdown', e => { e.preventDefault(); toggleCam(); }); parent.appendChild(b); return; }
    const code = CONTROLS[action][CONTROLS[action].length > 1 ? 1 : 0];
    const on = e => { e.preventDefault(); keys[code] = true; b.classList.add('on'); };
    const off = e => { e.preventDefault(); keys[code] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    parent.appendChild(b);
  };
  cells.forEach(cell => { if (cell) mk(dpad, cell[0], cell[1]); else dpad.appendChild(document.createElement('span')); });
  [['punch','Yumruk'],['kick','Tekme'],['jump','Zıpla'],['block','Blok'],['dash','Atıl'],['shot','Güç 1'],['sk2','Güç 2'],['ult','Ulti'],['cam','Kamera']].forEach(([a,l]) => mk(acts, a, l));
  pad.append(dpad);
  const spacer = document.createElement('div'); spacer.style.flex = '1';
  wrap.append(pad, spacer, acts); acts.style.pointerEvents = 'auto';
})();

/* ================= Render loop ================= */
function render(){
  const w = innerWidth, h = innerHeight;
  const c = inGame() && (mode !== 'guest' || hostSeen) ? cam : menuCam;
  c.aspect = w/h; c.updateProjectionMatrix(); renderer.render(scene, c);
}
function resize(){ renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();
let last = performance.now();
function loop(now){
  const dt = Math.min(.05, (now - last)/1000); last = now; frameDt = dt;
  animateWorld(dt);
  if (mode === 'guest') guestFrame(dt);
  else {
    if (phase !== 'paused' && phase !== 'over') update(dt);
    else if (phase === 'over'){ clock += dt; updateSparks(dt); updateEffects(dt); fighters.forEach(f => f.update(dt, false)); updateViewCam(dt, false); }
    else if (phase === 'paused'){ frameDt = 0; }
    if (mode === 'host') hostNet();
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
