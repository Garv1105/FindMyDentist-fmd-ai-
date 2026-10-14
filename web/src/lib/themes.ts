export type ThemeId =
  | "obsidian-silver"
  | "obsidian-amber"
  | "obsidian-royal"
  | "obsidian-gold"
  | "pearl-light"
  | "silver-light"
  | "white-royal";

export type Theme = {
  id: ThemeId;
  name: string;
  mood: string;
  dark: boolean;
  /** preview swatch: [background, glow/accent] */
  swatch: [string, string];
};

export const THEMES: Theme[] = [
  { id: "obsidian-silver", name: "Obsidian Silver", mood: "Luxury futuristic", dark: true, swatch: ["#050505", "#eef3fa"] },
  { id: "obsidian-amber", name: "Obsidian Amber", mood: "Premium energetic", dark: true, swatch: ["#060504", "#ff9f4a"] },
  { id: "obsidian-royal", name: "Obsidian Royal", mood: "Advanced technology", dark: true, swatch: ["#04050a", "#5b8cff"] },
  { id: "obsidian-gold", name: "Obsidian Gold", mood: "Luxury healthcare", dark: true, swatch: ["#060605", "#dcc28d"] },
  { id: "pearl-light", name: "Pearl Light", mood: "Clean clinical", dark: false, swatch: ["#f3f1ed", "#2b2e33"] },
  { id: "silver-light", name: "Silver Light", mood: "Minimal professional", dark: false, swatch: ["#e6e9ed", "#4a5562"] },
  { id: "white-royal", name: "White + Royal Blue", mood: "Modern medical technology", dark: false, swatch: ["#ffffff", "#1e4fd6"] },
];

export const DEFAULT_THEME: ThemeId = "obsidian-royal";
export const SYSTEM = "system";
export const STORAGE_KEY = "fmd-theme";

/** "system" maps the OS preference onto the two primary identities. */
export function resolveTheme(choice: string | null): ThemeId {
  if (choice === SYSTEM) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "pearl-light" : DEFAULT_THEME;
  }
  return THEMES.some((t) => t.id === choice) ? (choice as ThemeId) : DEFAULT_THEME;
}

/** Inlined in <head> so the stored theme applies before first paint.
 *  `?theme=<id>` previews a theme for review links without persisting it. */
export const noFlashScript = `(function(){try{var q=new URLSearchParams(location.search).get("theme");var c=q||localStorage.getItem("${STORAGE_KEY}");var t=c;if(c==="${SYSTEM}"){t=matchMedia("(prefers-color-scheme: light)").matches?"pearl-light":"${DEFAULT_THEME}"}if(!t||!${JSON.stringify(
  THEMES.map((t) => t.id),
)}.includes(t))t="${DEFAULT_THEME}";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}"}})();`;
