# Arc OS en el móvil: traspaso de OS 3 a «OS 3 2»

Dueño: OS 3 (hasta #494), ahora **OS 3 2**. La lista general de Arc OS está en `docs/arc-os.md` (de OS 2).

## Qué hay en main
- **Modo** (`src/lib/os/mode.ts`, `mode.svelte.ts`): «Terminal clásico» / «Modo OS», clave `arc-shell`, `enterOS()`,
  `leaveOS()`, `toggleOS()`. Al abrir la web con el Modo OS elegido se entra en `/os` (`startPath` de `src/lib/home.ts`).
- **Invitación** (`src/lib/os/invite/`): `OsPreview` (animación), `OsInvite` (primer paso de la Bienvenida) y
  `OsNotice` (aviso una vez, `arc-os-invite`; píldora «◂ Inicio» fuera de /os). En la cabecera, «⋯» → «Cambiar al Modo OS».
- **Terminal** (`src/lib/os/terminal/`, app `src/lib/os/apps/terminal.ts`): consola con historial, Tab, cálculos y
  respuestas rápidas; Ctrl+Alt+T (`WindowLayer.handleKey`, entrada `os-terminal` de `shortcuts.ts`).
- **Móvil** (`src/lib/os/mobile/`, `/os` con ≤ 900 px; el `{#if phone.current}` de `src/routes/os/+page.svelte` es mío):
  - [x] Inicio con rejilla 4×6, iconos squircle con nombre, páginas con puntos y «Buscar»
  - [x] Widgets entre iconos («Hoy», «Mundo», «Mercados») con las respuestas de la barra
  - [x] Dock de 4 (TOP, IMP, WS, Terminal)
  - [x] Insignias (ver abajo: ya salen del centro de notificaciones)
  - [x] Apps a pantalla completa (iframe `?embed=1`; herramientas con su componente) y barra de inicio
  - [x] Multitarea en tarjetas (apps vivas, hasta 4; mantener la barra o deslizar largo)
  - [x] Notificaciones (arriba izquierda) y centro de control (arriba derecha)
  - [x] Spotlight (deslizar hacia abajo en inicio)
  - [x] Gestos (`gesture()` de `home.ts`, con tests)

## Pendiente (órdenes de Sergi vía Decisiones 2)
- [x] **Estilo único de Arc OS** («Mando», de OS 6): el teléfono y todo lo que se abre encima llevan
  `data-os-skin="mando"`; sus `--os-phone-*`, `--os-glass*`, `--os-icon-*` y `--os-radius-*` están en el bloque Mando de
  `tokens.css`. Las estéticas de la web solo cambian lo de dentro de las apps.
- [x] **Iconos SVG** de OS 2b (#526, `<OsIcon id size />`) en inicio, dock, carpetas y multitarea; las esquinas salen
  de `--os-icon-radius` del bloque Mando.
- [x] **Carpetas** al arrastrar un icono sobre otro; orden de iconos y dock editables y guardados (`arc-os-phone`, en la
  cuenta). Modelo propio del teléfono, de un nivel como en iOS (`place`, `takeOut`, `arrange` de `home.ts`), no el árbol
  de archivos de OS 2.
- [x] Spotlight con `searchAll()` de OS 5: apps, valores, países, líderes y ajustes (bloquear, centro de control…);
  las acciones se hacen en el teléfono (`runPhoneHit` de `MobileHome`), no en ventanas.
- [x] Arranque y bloqueo de OS 5 en el móvil, con cara de teléfono y en estilo «Mando» (#499 y #512).
- [x] Apps de OS 4 a pantalla completa a 390 px: Calculadora, Reloj, Monitor, Ajustes, Visor y Vigilancia, bien;
  Notas (el `@container` se consultaba a sí mismo) y Calendario (fila de «Evento nuevo») arreglados.
- [x] Insignias del centro de notificaciones de Arc OS (`shell.notices`, lo mismo que en el escritorio): cada aviso o
  novedad sin leer cuenta en la app de su enlace y todos los avisos en AVISOS; Calendario, tus eventos de hoy.
- [x] Widgets elegibles: en el modo edición, «−» quita y «+» añade (Hoy, Mundo, Mercados, Avisos, Cripto, Bonos, Macro y
  Gasolina; hasta 16 casillas). Se guardan en `arc-os-phone`.
- [x] Fondo de pantalla: el inicio del teléfono pinta `WallLayer` de OS 5 (el que eliges en la app «Fondo de pantalla»).
- [x] «Atrás» del navegador o gesto del sistema: cierra lo de encima (hoja, carpeta, app) con el enrutado superficial
  de SvelteKit (`pushState`, `page.state.phone`); en inicio, sale de /os como siempre.
- [ ] Probarlo en un iPhone de verdad (safe-area, PWA instalada): solo puede Sergi; probado en Chromium a 390×844.

## QA OS 1 (inicio del móvil)
- [x] Iconos que encogen con el alto de la pantalla (iPhone SE y 320 px: el nombre pisaba el icono de abajo) y widgets
  que se ajustan a su hueco (`@container`).
- [x] Widgets en franjas de 2 filas (`layout` + `rowsOf` de `home.ts`): con 4 pequeños el último se salía de la rejilla.
- [x] «−» de los widgets, redondo (el horizontal lo hace QA OS 2, #551).
- [x] Mantener un widget entra en el modo edición; tocar un hueco vacío lo termina. Carpetas: miniaturas 3×3 desde
  arriba a la izquierda.
