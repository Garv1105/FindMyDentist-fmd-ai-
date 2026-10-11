# FindMyDentist — FMD Main homepage (design prototype)

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Motion · Lucide

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Structure

```
src/app/globals.css        design tokens (7 themes) + glass / horizon / button primitives
src/lib/themes.ts          theme registry, no-flash script, ?theme=<id> preview links
src/data/demo.ts           PROTOTYPE DEMO DATA — not real dentists or clinics
src/components/
  nav/                     Navbar, ThemeSwitcher
  hero/                    Hero, Tooth (WebGL), SearchBar, Assistant (card + panel)
  sections/                QuickActions, Dentists (+ProfileDrawer), Treatments, AiValue,
                           Journey, Records, Explore, Concierge, Trust, Footer
  ui.tsx                   Reveal, SectionHeader, Container, badges, chips
```

## Themes

All colour lives in CSS variables on `[data-theme]`; components only read tokens.
Default is **Obsidian Silver**. A choice persists in `localStorage` (`fmd-theme`);
"Match system" maps the OS preference to Obsidian Silver / Pearl Light.
Share a preview without persisting it: `/?theme=obsidian-amber`.

To add a theme: add a `[data-theme="…"]` block in `globals.css` and an entry in `THEMES`.

## The tooth

`hero/Tooth.tsx` raymarches a signed-distance molar in a single fragment shader
(no model files, no 3D library). It is lit by the `--tooth-*` tokens, so it re-lights with
the theme, pauses off-screen and stays still under `prefers-reduced-motion`.

## Demo boundaries

Dentist portraits and treatment thumbnails are crops of the FMD reference mockups.
AI replies, booking and Concierge submissions are simulated client-side.
