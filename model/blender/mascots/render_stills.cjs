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
const src = fs.readFileSync(path.join(WEB, "src/components/MascotModel.tsx"), "utf8");
const block = src.slice(src.indexOf("const PORCELAIN: Look"), src.indexOf("const fileOf"));
const js = block
  .replace(/^const lookOf[^\n]*\n/m, "")
  .replace(/: Look\b/g, "")
  .replace(/: Record<string, Look>/g, "")
  .replace(/\(l\): Look =>/g, "(l) =>");
const LOOKS = new Function(`${js}; return LOOKS;`)();
const glassPatch = src.slice(src.indexOf("function glassify"), src.indexOf("\n}\n", src.indexOf("function glassify")) + 3);

const SIZE = 1200; // px tall; phones show the boxes at up to ~300 css px × 3
const SS = 2; // rendered at SS× and downscaled: supersampled edges, as clean as the live canvases
const jobs = Object.entries(LOOKS).map(([file, look]) => ({
  file,
  look,
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
const J = ${JSON.stringify(jobs)}, H = ${SIZE * SS}, OUT_H = ${SIZE};
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
  scene.add(s);
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
  gl.render(scene, cam);
  const small = document.createElement("canvas");
  small.width = Math.round(W * OUT_H / H); small.height = OUT_H;
  const ctx = small.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(gl.domElement, 0, 0, small.width, small.height);
  await fetch("/save?f=" + j.file.replace(".glb", ".webp"), { method: "POST", body: small.toDataURL("image/webp", 0.92) });
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
  p.on("pageerror", (e) => {
    console.error("PAGEERR", e.message);
    process.exit(1);
  });
  await p.route("http://stills/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/") return r.fulfill({ body: html, contentType: "text/html" });
    if (u.pathname === "/save") {
      const f = path.join(OUT, u.searchParams.get("f"));
      fs.writeFileSync(f, Buffer.from(r.request().postData().split(",")[1], "base64"));
      console.log("wrote", path.relative(ROOT, f));
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
  await p.waitForFunction(() => window.DONE, null, { timeout: 900000, polling: 500 });
  await b.close();
})();
