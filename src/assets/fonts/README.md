# Fonts

The site serves these fonts itself; no request goes to a third-party font service.

| File | Font | Source | Changes |
| --- | --- | --- | --- |
| `archivo.woff2` | Archivo (variable) | Google Fonts, Latin subset | Axes trimmed with fontTools to weight 400–800 and width 100–125, the ranges the site uses. |
| `source-serif-4.woff2` | Source Serif 4 (variable) | Google Fonts, Latin subset | None. "Source" is a Reserved Font Name, so this file must stay unmodified. |
| `jetbrains-mono.woff2` | JetBrains Mono (variable) | Google Fonts, Latin subset | Weight axis trimmed with fontTools to 400–600. |

All three are licensed under the SIL Open Font License 1.1; the license for each is in this folder.
The `@font-face` rules are in `src/styles/fonts.css`, and `src/layouts/SiteLayout.astro` preloads Archivo and Source Serif 4.
