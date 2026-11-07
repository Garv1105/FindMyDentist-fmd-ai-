// Still pictures of the section mascots for touch devices (MascotArt shows them there instead of live 3D canvases,
// which phones can't run smoothly ×10): each model in its artwork's pose, in its studio, framed exactly as
// MascotModel frames it (FOV 20, fitted to a 1-unit box), with a transparent background.
//
//   node model/blender/mascots/render_stills.cjs        (needs playwright-core and Google Chrome)
//   PLAYWRIGHT=/path/to/playwright-core CHROME=/usr/bin/google-chrome  to override where they are
//
// The looks, turns and the glass shader are read from web/src/components/MascotModel.tsx, so the stills match the
// live models. Re-run after rebuilding the models or changing their looks (and bump STILL_V in MascotArt.tsx).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../../..");
const WEB = path.join(ROOT, "web");
const OUT = path.join(WEB, "public/models/stills");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core");

// the Look literals and LOOKS map, evaluated (types stripped)
const src = fs.readFileSync(path.join(WEB, "src/components/MascotModel.tsx"), "utf8").replace(/\r\n/g, "\n"); // CRLF checkouts too
const block = src.slice(src.indexOf("const PORCELAIN: Look"), src.indexOf("const fileOf"));
const js = block
  .replace(/^const lookOf[^\n]*\n/m, "")
  .replace(/: Look\b/g, "")
  .replace(/: Record<string, Look>/g, "")
  .replace(/\(l\): Look =>/g, "(l) =>");
const LOOKS = new Function(`${js}; return LOOKS;`)();
const glassPatch = src.slice(src.indexOf("function glassify"), src.indexOf("\n}\n", src.indexOf("function glassify")) + 3);

// LOOPS=1: instead of one still, each model's motion (MascotModel's MOTIONS) as an animated WebP for phones
// (public/models/loops; MascotArt plays them there instead of live canvases). A motion mixes several periods, so it
// would never repeat: each loop has its own length (seconds) and every period is rounded to divide it, so it loops
// seamlessly. Bump LOOP_V in MascotArt.tsx after re-rendering.  ONLY=guide.glb,pin.glb  renders just those.
const LOOPS = !!process.env.LOOPS;
const FPS = 12;
const LOOP_T = { "guide.glb": 4, "guide-left.glb": 4.5, "butler.glb": 7, "laptop.glb": 6, "pin.glb": 5.2, "scholar.glb": 4.2, "vault.glb": 5, "reading.glb": 7, "heart.glb": 4 };
// the glass tooth has no loop: see-through and spinning, every pixel changes every frame (~5 MB); phones get its still
// with a CSS sway and glow (.phone-sway in globals.css)
const LOOP_OUT = path.join(WEB, "public/models/loops");
const FRAMES = path.join(require("os").tmpdir(), "fmd-loop-frames");
const motionSrc = src
  .slice(src.indexOf("const TAU ="), src.indexOf("/**", src.indexOf("const MOTIONS")))
  .replace(/: (number|Turn|Record<string, Motion>)/g, "")
  .replace("const wave =", "const wave0 =")
  .replace("const bump =", "const bump0 =");
// the motions for a loop of T seconds: wave and bump with their periods (and a bump's timing) rounded to divide T
const motionsFor = `(T) => {
  const Q = (p) => T / Math.max(1, Math.round(T / p));
  const wave = (t, p, ph = 0) => wave0(t, Q(p), ph);
  const bump = (t, p, at, w) => bump0(t, Q(p), (at * Q(p)) / p, (w * Q(p)) / p);
  ${motionSrc}
  return { MOTIONS, wave };
}`;

const SIZE = LOOPS ? 400 : 1200; // px tall; phones show the boxes at up to ~300 css px × 3 (loops: ~1.4×, they move)
const SS = 2; // rendered at SS× and downscaled: supersampled edges, as clean as the live canvases
const only = process.env.ONLY?.split(",");
const jobs = Object.entries(LOOKS)
  .filter(([file]) => (!only || only.includes(file)) && (!LOOPS || LOOP_T[file]))
  .map(([file, look]) => ({
    file,
    look,
    loop: LOOP_T[file],
    align: file === "tooth.glb" ? "center" : "bottom",
    aspect: file === "tooth.glb" ? 1000 / 716 : 1, // the Care Core's box is its artwork's shape
  }));

const html = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
${glassPatch.replace(/: THREE\.Object3D|: number|as THREE\.Mesh|as THREE\.Material|\(o as THREE\.Mesh\)/g, (m) => (m === "(o as THREE.Mesh)" ? "o" : ""))}
const J = ${JSON.stringify(jobs)}, H = ${SIZE * SS}, OUT_H = ${SIZE}, LOOPS = ${LOOPS}, FPS = ${FPS};
const motionsFor = ${motionsFor};
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for (const [ji, j] of J.entries()) {
  const L = j.look, W = Math.round(H * j.aspect);
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setSize(W, H);
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = L.exposure;
  const cam = new THREE.PerspectiveCamera(20, j.aspect, 0.1, 1000);
  cam.position.set(0, 0, 0.56 / Math.tan(THREE.MathUtils.degToRad(10)));
  const s = (await loader.loadAsync("/m/" + ji)).scene;
  if (L.glass) glassify(s, L.glass);
  s.rotation.y = THREE.MathUtils.degToRad(L.turn || 0);
  s.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(s), size = b.getSize(new THREE.Vector3()), k = 1 / Math.max(size.x, size.y);
  s.scale.setScalar(k);
  const c = b.getCenter(new THREE.Vector3()).multiplyScalar(k);
  s.position.set(-c.x, j.align === "bottom" ? -0.5 - b.min.y * k : -c.y, -c.z);
  const scene = new THREE.Scene();
  const spinner = new THREE.Group(); // turns about the box's centre, as MascotModel's spin group does
  spinner.add(s);
  scene.add(spinner);
  if (L.ambient) scene.add(new THREE.AmbientLight(L.ambient[0], L.ambient[1]));
  if (L.ground) scene.add(new THREE.HemisphereLight("#000000", L.ground[0], L.ground[1]));
  for (const [p, i, col] of L.dirs) { const d = new THREE.DirectionalLight(col, i); d.position.set(...p); scene.add(d); }
  const env = new THREE.Scene();
  for (const [p, sc, i, col] of L.panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }));
    m.material.color.set(col || "#ffffff").multiplyScalar(i);
    m.scale.set(...sc); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m);
  }
  if (L.dome) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false }));
    m.material.color.set(L.dome[0]).multiplyScalar(L.dome[1]); m.scale.setScalar(50); env.add(m);
  }
  const rt = new THREE.WebGLCubeRenderTarget(256);
  rt.texture.type = THREE.HalfFloatType;
  const cc = new THREE.CubeCamera(0.1, 1000, rt);
  env.add(cc);
  cc.update(gl, env);
  scene.environment = rt.texture;
  const small = document.createElement("canvas");
  small.width = Math.round(W * OUT_H / H); small.height = OUT_H;
  const ctx = small.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const save = async (name, type, q) => {
    gl.render(scene, cam);
    ctx.clearRect(0, 0, small.width, small.height);
    ctx.drawImage(gl.domElement, 0, 0, small.width, small.height);
    await fetch("/save?f=" + name, { method: "POST", body: small.toDataURL(type, q) });
  };
  if (!LOOPS) await save(j.file.replace(".glb", ".webp"), "image/webp", 0.92);
  else {
    // MascotModel's motion, frame by frame: bones turned about model-space axes at their pivots, spin, glow pulse
    const { MOTIONS, wave } = motionsFor(j.loop);
    const mo = MOTIONS[j.file] || {};
    const inv = s.getWorldQuaternion(new THREE.Quaternion()).invert();
    const bones = new Map(), glow = [];
    s.traverse((o) => {
      if (o.isBone && o.parent)
        bones.set(o.name, { bone: o, rest: o.quaternion.clone(), parent: inv.clone().multiply(o.parent.getWorldQuaternion(new THREE.Quaternion())) });
      if (o.isMesh && o.material.emissiveIntensity) glow.push({ m: o.material, base: o.material.emissiveIntensity });
    });
    // whole turns over the loop, so it closes
    const spin = mo.spin ? (2 * Math.PI * Math.max(1, Math.round((mo.spin * j.loop) / (2 * Math.PI)))) / j.loop : 0;
    const n = Math.round(j.loop * FPS);
    for (let i = 0; i < n; i++) {
      const t = (i * j.loop) / n;
      for (const { bone, rest } of bones.values()) bone.quaternion.copy(rest);
      for (const [name, axis, a] of (mo.bones ? mo.bones(t) : [])) {
        const b = bones.get(name.replace(".", ""));
        if (!b) continue;
        const q = new THREE.Quaternion().setFromAxisAngle(AX[axis], a);
        b.bone.quaternion.premultiply(b.parent.clone().invert().multiply(q).multiply(b.parent));
      }
      if (spin) spinner.rotation.y = t * spin;
      if (mo.pulse) for (const { m, base } of glow) m.emissiveIntensity = base * (1 + mo.pulse[0] * wave(t, mo.pulse[1]));
      await save(j.file.replace(".glb", "") + "/" + String(i).padStart(4, "0") + ".png", "image/png");
    }
  }
  gl.dispose();
}
window.DONE = 1;
</script></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    executablePath: process.env.CHROME || "/usr/bin/google-chrome",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const p = await b.newPage();
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.error("CONSOLE", m.text().slice(0, 300)));
  p.on("pageerror", (e) => {
    console.error("PAGEERR", e.message);
    process.exit(1);
  });
  await p.route("http://stills/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/") return r.fulfill({ body: html, contentType: "text/html" });
    if (u.pathname === "/save") {
      const f = path.join(LOOPS ? FRAMES : OUT, u.searchParams.get("f"));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, Buffer.from(r.request().postData().split(",")[1], "base64"));
      if (!LOOPS || f.endsWith("0000.png")) console.log("wrote", f);
      return r.fulfill({ body: "ok" });
    }
    if (u.pathname.startsWith("/m/")) {
      const j = jobs[parseInt(u.pathname.slice(3))];
      return r.fulfill({ path: path.join(WEB, "public/models/rig", j.file), contentType: "model/gltf-binary" });
    }
    if (u.pathname.startsWith("/three/")) return r.fulfill({ path: path.join(WEB, "node_modules", u.pathname), contentType: "text/javascript" });
    r.fulfill({ status: 404, body: "" });
  });
  await p.goto("http://stills/");
  await p.waitForFunction(() => window.DONE, null, { timeout: 3600000, polling: 500 });
  await b.close();
  if (!LOOPS) return;
  // the frames → one looping animated WebP per model (sharp: web/node_modules)
  const sharp = require(path.join(WEB, "node_modules/sharp"));
  fs.mkdirSync(LOOP_OUT, { recursive: true });
  for (const j of jobs) {
    const name = j.file.replace(".glb", "");
    const dir = path.join(FRAMES, name);
    const frames = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(dir, f));
    // a frame that came out empty (a lost WebGL context) would flash in the loop: stop instead
    for (const f of frames) if ((await sharp(f).stats()).channels[3].max === 0) throw new Error("empty frame " + f);
    const out = path.join(LOOP_OUT, name + ".webp");
    await sharp(frames, { join: { animated: true } })
      .webp({ quality: 70, alphaQuality: 75, effort: 6, loop: 0, delay: Math.round((j.loop * 1000) / frames.length) })
      .toFile(out);
    console.log("loop", path.relative(ROOT, out), frames.length, "frames", Math.round(fs.statSync(out).size / 1024) + " KB");
    if (!process.env.KEEP) fs.rmSync(dir, { recursive: true });
  }
})();
