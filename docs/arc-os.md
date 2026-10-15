# Arc OS: lista de comprobación

Arc OS (`/os`, comando `OS`) es el modo opcional de Arc Terminal que funciona como un sistema operativo. Sergi lo
quiere **completo y muy funcional** (D46 y Decisiones 2). Esta lista recoge todo lo pedido para que no se pierda
nada en los traspasos entre sesiones.

**Cómo se usa**
- Cada punto tiene su dueño entre corchetes. Cada sesión marca sus casillas `[x]` **en el PR que lo hace** y añade
  el número del PR.
- Nadie da su parte por terminada hasta tener todas sus casillas en `[x]`.
- Si una sesión se acerca a unos 400k de contexto, traspasa a una sesión nueva: le pasa esta lista y lo que le
  quede, y avisa a Decisiones 2.
- Algo nuevo que pida Sergi se añade aquí, con su dueño.

**Dueños**
- **OS 1**: núcleo. Terminado y archivado.
- **OS 2**: escritorio, barra, aspectos, Inicio, bandeja y menús.
- **OS 3**: móvil, Terminal e invitación.
- **OS 4**: apps del sistema.
- **OS 5**: arranque y sistema.
- **OS 6**: centro de mando.
- **Referencias de comportamiento**: OS.js, Synology DSM y, en móvil, iOS. Sin marcas, iconos ni nombres de nadie:
  todo es inspirado y propio.

## Núcleo (ventanas y escritorios)
- [x] Registro de apps sacado de los comandos y las experiencias, más las herramientas (`src/lib/os/apps.ts`) [OS 1] #477
- [x] Gestor de ventanas: abrir, foco, minimizar, maximizar, encajar a mitades y cuartos, tope de ventanas [OS 1] #477
- [x] Escritorios virtuales con nombre (hasta 6), Alt+1…6 [OS 1] #477
- [x] Vistas embebidas en ventanas (`?embed=1`) [OS 1] #477
- [x] Mosaico, teclado (Alt+º, Alt+↑/↓, Alt+⇧+←/→, Alt+W) y decoración de ventana por aspecto [OS 1] #493
- [x] Menú de ventana con clic derecho en el título, «siempre encima», varias instancias y cierre animado [OS 1] #496
- [x] Doble clic en el título para maximizar [OS 1] #493/#496
- [x] Restaurar la sesión de ventanas al volver (`arc-os-desks`) [OS 1] #477 (revisado por OS 5)
- [x] /os sin tope de peso (`scripts/weight.ts` → `EXEMPT`) [OS 2] #497

## Aspecto (cambio de Sergi, manda sobre lo anterior)
«El escritorio no tiene un estilo a elegir: tiene SU estilo y no puede cambiar; solo cambian las apps».
- [x] Hubo cuatro aspectos a elegir: Arc DSM, Windows, Mac y Linux [OS 2] #500. Se puede conservar el código
      (`data-os-skin`), pero ya **sin interfaz** para elegirlo.
- [x] **Un único aspecto fijo, propio de Arc**: identidad «Centro de mando» (estilo de plataforma de inteligencia,
      el que diseña OS 6) con estructura tipo DSM: barra superior fina, menú de apps, iconos grandes y widgets a la
      derecha [OS 6 diseño + OS 2 estructura] #503
- [ ] Quitar el selector de aspectos del asistente y del Panel de control. El asistente queda en fondo, widgets y
      nombre [OS 2]
- [ ] Las estéticas de la web (Apariencia: `data-style`, acento y densidad) solo afectan al **contenido de las
      apps** dentro de las ventanas, nunca al escritorio, la barra, los menús ni la decoración de ventana [OS 2]
- [x] El fondo de pantalla sí se puede cambiar: app «Fondo de pantalla», `openApp('wallpaper')` [OS 5] #511

## Escritorio
- [x] Fondo por aspecto y fondos de tokens (sistema, estética, liso, rejilla, degradado) [OS 2] #476/#500
- [x] Fondo propio: galería (9 incluidos, día y noche con tokens), 2 vivos (el mundo ahora, tu cielo), color, degradado, tus imágenes (IndexedDB, comprimidas, solo este navegador; rellenar, ajustar, centrar, mosaico y punto focal), por escritorio, presentación y fondo de bloqueo (`src/lib/os/system/wall/`) [OS 5] #511
- [ ] Fondo en la pantalla de inicio del móvil con `<WallLayer />` [OS 3]
- [ ] «Cambiar fondo…» conectado en el clic derecho del escritorio y en el Panel de control [OS 2, cuando OS 5 tenga el selector]
- [x] Widgets movibles: reloj mundial, cotizaciones, tiempo, titulares, luz barata, Tu mañana [OS 2] #476
- [x] Widgets del sistema (estilo DSM): estado de las fuentes, registro, datos [OS 2] #500
- [x] Iconos en rejilla: arrastrar (solos o en grupo), casilla libre más cercana, guardados en la cuenta [OS 2] #501
- [x] Selección rectangular y Ctrl o ⌘ + clic [OS 2] #501
- [x] Clic derecho en el escritorio y en los iconos [OS 2] #501
- [ ] **Iconos de verdad**: un set SVG propio a color (48–64 px, sombra o brillo según el aspecto) para cada app,
      vista, carpeta y archivo. Se usa en el escritorio, Inicio, la barra, el dock, el explorador y el móvil
      (pasarlo a OS 3, OS 4 y OS 6) [OS 2]
- [ ] **Carpetas** en el escritorio: nueva carpeta (clic derecho), renombrar, arrastrar iconos dentro y fuera,
      abrir carpeta en una ventana con sus iconos, carpetas dentro de carpetas, eliminar a la papelera. Se guardan
      en la cuenta. Mismo modelo que el explorador [OS 2 + OS 4]

## Revisión de Decisiones 2 (main a 1440 y 390 px)
- [x] El reloj de la bandeja salía en UTC: ahora usa la zona del navegador, y Madrid si no hay ninguna [OS 2] #501
- [x] «5 abiertas» se leía como ventanas: ahora dice «5 bolsas abiertas» [OS 2] #501
- [ ] Iconos todavía como glifos (▦ ★ % $): va con el set SVG de «Escritorio» [OS 2]
- [ ] Widgets vacíos en local: comprobar que en la web real se llenan y, si una fuente falla, poner un mensaje útil (qué falla y cuándo se vuelve a intentar) [OS 2]
- [ ] A 390 px sigue saliendo el escritorio de PC: lo resuelve la versión móvil (#494) [OS 3]

## Barra, Inicio y bandeja
- [x] Barra de tareas: clic para enfocar o minimizar, vista previa al pasar, ancladas [OS 2] #495
- [x] Clic derecho en la barra, el dock y las pestañas de DSM [OS 2] #501
- [x] Menú Inicio con buscador, categorías, recientes y anclar [OS 2] #476
- [x] Bandeja: reloj con zonas y bolsas abiertas, avisos, cuenta y ajustes [OS 2] #476
- [x] Panel de control: aspecto, estética, fondo, barra, widgets, avisos, cuenta y admin [OS 2] #476/#500
- [x] Buscador (Ctrl+Espacio) con las apps [OS 2] #500
- [x] `searchAll(q)` + `runHit(hit)`: vistas, valores, países, líderes, comandos y ajustes [OS 5] #510
- [ ] Conectado en el buscador del escritorio [OS 2]

## Sistema
- [x] Arranque breve (la primera vez del día) y pantalla de bloqueo, también en el móvil; Ctrl+Alt+L [OS 5] #499
- [x] Asistente «Bienvenido a Arc OS»: aspecto, fondo y widgets [OS 2] #501
- [x] Centro de notificaciones (campana) y toasts; `notify()` para el sistema y las apps [OS 2] #476/#500
- [x] Alt+Tab visual con miniaturas [OS 5] #509
- [x] Avisos de Arc (mercados, valores, macro…) como toasts con `notify()` [OS 5] #512
- [x] Sonidos opcionales (Web Audio, apagados por defecto: `setSettings({ sounds })`) [OS 5] #511
- [ ] Interruptores de «Pantalla de inicio» y «Sonidos» en Ajustes [OS 4]
- [x] Atajos del sistema en `shortcuts.ts` (salen en HELP) [OS 5] #499/#509

## Apps del sistema
- [ ] Explorador de archivos al estilo de un gestor web de archivos, con papelera (mismo modelo de carpetas que el escritorio) [OS 4]
- [ ] Panel de control en ventana, estilo DSM (reutiliza `ControlPanel.svelte`) [OS 4]
- [ ] Centro de paquetes (activar y quitar apps y experiencias) [OS 4]
- [ ] Notas [OS 4]
- [ ] Calculadora [OS 4]
- [ ] Reloj [OS 4]
- [ ] Calendario [OS 4]
- [ ] Monitor (recursos y fuentes) [OS 4]
- [ ] Registros [OS 4]
- [x] Terminal (la barra de comandos como consola) [OS 3] #478
- [x] Apps de análisis: mapa operacional, grafo de entidades, expedientes, línea de tiempo y vigilancia [OS 6] #513–#516 (detalle abajo)

## Móvil (≤ 900 px, al estilo iOS)
- [ ] Pantalla de inicio con páginas, dock, widgets e insignias [OS 3] (#494)
- [ ] Multitarea, centro de control, buscador y gestos [OS 3]
- [x] Cambiar entre «Terminal clásico» y «Modo OS» (`mode.svelte.ts`) [OS 3] #478

## OS 6 · Centro de mando (detalle de #503 y #513–#516)
Aspecto «Mando» y apps de análisis inspiradas en las plataformas de inteligencia, sin marcas ni logos de nadie y
sin imitar a ningún gobierno (solo la franja «ARC · USO PRIVADO»).
- [x] Aspecto «Mando» (`data-os-skin='mando'`, 5.º de `skins.ts`): pizarra con rejilla técnica tenue, letra mono, acento frío (`--cmd-*` en `tokens.css`) y ámbar, bordes de 1 px y esquinas casi rectas [OS 6] #503
- [x] Barra de arriba (`MandoBar.svelte`): menú de apps, pestañas de ventanas, nivel de alerta global de 1 a 5 y relojes UTC y Madrid con segundos [OS 6] #503
- [x] Nivel de alerta (`mando.ts → alertLevel`): avisos graves del muro (los P1) y el tema más cubierto de IMP; el porqué en el título [OS 6] #503
- [x] Franja de abajo (`MandoStrip.svelte`): «ARC · USO PRIVADO», pilotos de fuentes en vivo por grupo (IMP, GEO, MERC, MACRO), fuentes que van y fecha [OS 6] #503
- [x] Paleta, letra y formas fijas en `[data-os-skin='mando']` (no cambian con la estética ni el tema de la web); cada app añade sus `--cmd-*` en un bloque `[data-os-skin]` sin redefinir los de base [OS 6] #503
- [x] **Mapa operacional** (`mapa-op`): las capas de GEO y de la Sala en un mapa plano (zoom y arrastre) o globo, filtros por capa con recuento, periodo de 6 h a Todo y línea de tiempo para rebobinar (histograma, ▶/❚❚, «Ahora»); ficha del suceso con PAIS/GEO en ventana. `openApp('mapa-op', '?capas=quakes&periodo=24h')` [OS 6] #513
- [x] **Vigilancia** (`vigilancia`): tus objetivos (valores, países, líderes, temas) con nivel 0–4, «desde tu visita» y «Avisarme al móvil» con las alertas de AVISOS; clave portable `arc-os-watch` [OS 6] #514
- [x] **Línea de tiempo** (`cronologia`): 6 carriles de sucesos y 7 de mercados sobre un eje común, 24 h–1 año, zoom, cursor común, carriles a elegir [OS 6] #515
- [x] **Grafo de entidades** (`grafo`): países, líderes, bancos, valores, sanciones, sucesos y temas de IMP con aristas por co-mención y relación; fuerzas propias, expandir, filtrar, buscar [OS 6] #516
- [x] **Expediente** (`expediente`): ficha de cualquier entidad (resumen, datos, mapa, relaciones, cronología), exportar a Markdown/JSON e imprimir. API: `openDossier(kind, key)`, `openDossierFor('Lagarde')`, `openGraph()` (`apps/intel/open.ts`) [OS 6] #516
- [ ] Iconos SVG de las cinco apps con el set de OS 2 (`OsIcon`) [OS 6, cuando esté el set]
- [ ] Título de ventana: no enseñar el path en las herramientas sin `href` («Expediente · /expediente#country:CN») [núcleo]
- [x] Contraste AA en /os: `--muted` de Mando a 4,5:1 también sobre el fondo con acento [OS 6] #533
