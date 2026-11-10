/**
 * A mascot still with its half-size copy (public/models/stills/m, same names), as img attributes. Phones get the half
 * copy: `sizes` reports the phone box a little small on purpose, so even a 3x screen picks it. A still only shows until
 * the mascot's 400px loop or live model covers it, so the half copy is still the sharper picture. Desktops get the full
 * file, as before.
 */
const WIDTH: Record<string, number> = { "hero-sitting": 2040 }; // the rest are 1200 wide

export function stillImg(path: string) {
  const [file, query] = path.split("?");
  const name = file.split("/").pop()!.replace(/\.webp$/, "");
  const w = WIDTH[name] ?? 1200;
  const q = query ? `?${query}` : "";
  const half = file.replace("/stills/", "/stills/m/");
  return {
    src: path,
    srcSet: `${half}${q} ${w / 2}w, ${file}${q} ${w}w`,
    sizes: `(max-width: 767px) ${Math.round(w / 2 / 2.75)}px, ${w / 2}px`,
  };
}
