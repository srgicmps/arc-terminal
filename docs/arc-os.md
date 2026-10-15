# Arc OS: lista de comprobación

Lo que ya hace el Modo OS (`/os`, `src/lib/os/`), por sesión. Cada sesión añade sus casillas en su sección.

## OS 6 · Centro de mando

Aspecto «Mando» y apps de análisis inspiradas en las plataformas de inteligencia, sin marcas ni logos de nadie y
sin imitar a ningún gobierno (solo la franja «ARC · USO PRIVADO»).

- [x] Aspecto «Mando» (`data-os-skin='mando'`, 5.º de `skins.ts`): pizarra con rejilla técnica tenue, letra mono, acento frío (`--cmd-*` en `tokens.css`) y ámbar, bordes de 1 px y esquinas casi rectas.
- [x] Barra de arriba (`MandoBar.svelte`): menú de apps, pestañas de ventanas, nivel de alerta global de 1 a 5 y relojes UTC y Madrid con segundos.
- [x] Nivel de alerta (`mando.ts → alertLevel`): avisos graves del muro (los P1) y el tema más cubierto de IMP; el porqué en el título.
- [x] Franja de abajo (`MandoStrip.svelte`): «ARC · USO PRIVADO», pilotos de fuentes en vivo por grupo (IMP, GEO, MERC, MACRO), fuentes que van y fecha.
- [x] Estilo único y fijo de Arc OS (decisión de Sergi): paleta, letra y formas propias en `[data-os-skin='mando']`; la estética, el acento y el tema de la web solo se aplican dentro de las apps.
- [ ] Mapa operacional · Grafo de entidades · Expediente · Línea de tiempo · Vigilancia.

## OS 5 · Arranque y sistema

Todo en `src/lib/os/system/`, montado con `<SystemLayer />` en `/os` (también sobre el móvil).

- [x] Arranque: logo y barra fina, menos de 1 s, solo la primera vez del día (`arc-os-boot`), saltable; con reduced-motion, sin animación (`Boot.svelte`).
- [x] Pantalla de bloqueo: hora, fecha, tarjeta centrada con tu nombre, saludo y avisos sin leer; en el móvil, cara de teléfono y «Desliza hacia arriba». Ctrl+Alt+L bloquea (`Lock.svelte`).
- [x] Alt+Tab visual: miniaturas del escritorio con la ventana en su sitio; al soltar Alt, va a ella (`Switcher.svelte`).
- [x] Buscador universal `searchAll(q)` + `runHit(hit)`: apps, barra de comandos, valores, países, líderes y ajustes (`search.ts`). Lo usan los Spotlight de OS 2 y OS 3.
- [x] Restaurar la sesión: ventanas, posiciones y tamaños (`arc-os-desks`, del núcleo; sincronizado).
- [x] App «Fondo de pantalla» (`wallpaper`, carpeta `wall/`): 9 incluidos (día y noche con tokens), 2 vivos (el mundo ahora con terremotos, tu cielo), color, degradado, tus imágenes (arrastrar o elegir, comprimidas en IndexedDB, solo este navegador; rellenar, ajustar, centrar, mosaico y punto focal), por escritorio, presentación cada X minutos y fondo de bloqueo.
- [x] Sonidos del sistema opcionales y discretos (Web Audio, apagados por defecto): `sys.settings.sounds`.
- [x] Avisos de Arc (mercados, valores, macro, VIX…) como toasts con `notify()` y en el centro de notificaciones (`alerts.ts`).
- [x] Atajos en `src/lib/shortcuts.ts` (salen en HELP): Ctrl+Alt+L, Alt+Tab visual.
- [ ] «Cambiar fondo…» en el clic derecho del escritorio y en el Panel de control (OS 2b) y en Ajustes (OS 4): `openApp('wallpaper')`.
- [ ] Fondo en la pantalla de inicio del móvil con `<WallLayer />` (OS 3 2).
- [ ] Interruptores de «Pantalla de inicio» y «Sonidos» en Ajustes (OS 4): `setSettings({ boot, sounds })`.
