# From-Scratch Mobile Navigation Redesign Blueprint

The previous mobile drawer must be treated as visually failed because the trust badges, sticky phone CTA, accordion content, and partial-width panel compete for the same vertical space. The corrected design will not layer floating elements over menu content. It will use a simple full-screen premium drawer with a single scrollable content column and a clean bottom call-to-action that appears after the navigation content rather than overlapping it.

| Area | Corrected Direction |
|---|---|
| Drawer shell | Use a true full-width mobile drawer, `width: 100vw`, `max-width: none`, fixed to the viewport, with internal scrolling and no exposed dark strip on the right side. |
| Header | Keep the existing logo small and aligned left, with a visible close button aligned right. The header remains compact and non-overlapping. |
| Intro area | Replace the large hero card with a compact booking hub card using navy/blue/white glass styling and the existing Fira Sans font system. |
| Primary actions | Show Book Now and Call as two clean stacked buttons near the top. They must not be sticky or floating over accordion content. |
| Navigation items | Use simple premium list rows with SVG icons, clear labels, and accordions for Services, Airport, and Service Areas. |
| Submenus | Render submenu links as normal in-flow cards beneath each accordion button. No negative margins, no absolute positioning, and no side offsets that can create overflow. |
| Trust indicators | Move trust indicators to a calm in-flow footer row near the end of the menu, or hide them on very small screens. They must never sit on top of submenu content. |
| Colours | Use only the site palette: navy, deep blue, bright blue, white, ice blue, and glass borders. No gold. |
| Typography | Keep the current premium Fira Sans style with strong headings, clear spacing, and readable line heights. |
| Accessibility | Preserve existing IDs and hooks so the mobile menu controller can open, close, and toggle accordions. Keep visible focus states and large tap targets. |

The mobile booking form and Western Sydney Airport layout fixes will be added as a separate responsive override section so menu styling remains isolated from form/content layout corrections.
