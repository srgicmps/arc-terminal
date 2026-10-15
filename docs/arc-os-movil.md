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
  - [x] Insignias (`badges()` de `home.ts`, clave `arc-os-badges`; de momento solo NOVEDADES)
  - [x] Apps a pantalla completa (iframe `?embed=1`; herramientas con su componente) y barra de inicio
  - [x] Multitarea en tarjetas (apps vivas, hasta 4; mantener la barra o deslizar largo)
  - [x] Notificaciones (arriba izquierda) y centro de control (arriba derecha)
  - [x] Spotlight (deslizar hacia abajo en inicio)
  - [x] Gestos (`gesture()` de `home.ts`, con tests)

## Pendiente (órdenes de Sergi vía Decisiones 2)
- [ ] **Estilo único de Arc OS** («Centro de mando», de OS 6): sin aspectos; dentro de /os no se aplican las estéticas
  de la web. Estructura tipo iOS, pero sin imitar a Apple. Cambiar los tokens `--os-phone-*`, `--os-glass*`, `--os-icon-*`.
- [ ] **Iconos SVG** de OS 2b (`src/lib/os/icons/`, `<OsIcon id size />`) en `PhoneIcon.svelte` en lugar del carácter.
- [x] **Carpetas** al arrastrar un icono sobre otro; orden de iconos y dock editables y guardados (`arc-os-phone`, en la
  cuenta). Modelo propio del teléfono, de un nivel como en iOS (`place`, `takeOut`, `arrange` de `home.ts`), no el árbol
  de archivos de OS 2.
- [ ] Spotlight con `searchAll()` de OS 5 (`src/lib/os/system/search.ts`) cuando esté en main.
- [ ] Pantalla de bloqueo/arranque de OS 5 en el móvil (le pedí aspecto de teléfono, por encima de `--z-modal`+4).
- [ ] Apps de OS 4 (Calculadora, Reloj, Notas, Monitor, Calendario, Ajustes, Archivos) a pantalla completa: comprobar a 390 px.
- [ ] Más insignias (AVISOS, CAL de hoy…) y widgets editables.
- [ ] Probar en un iPhone de verdad (safe-area, PWA instalada, gestos frente al «atrás» del navegador).
