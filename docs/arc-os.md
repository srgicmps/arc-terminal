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
- [x] Restaurar la sesión de ventanas al volver (`arc-os-desks`) [OS 1] #477 (OS 5 lo revisa)
- [x] /os sin tope de peso (`scripts/weight.ts` → `EXEMPT`) [OS 2] #497

## Aspecto (cambio de Sergi, manda sobre lo anterior)
«El escritorio no tiene un estilo a elegir: tiene SU estilo y no puede cambiar; solo cambian las apps».
- [x] Hubo cuatro aspectos a elegir: Arc DSM, Windows, Mac y Linux [OS 2] #500. Se puede conservar el código
      (`data-os-skin`), pero ya **sin interfaz** para elegirlo.
- [ ] **Un único aspecto fijo, propio de Arc**: identidad «Centro de mando» (estilo de plataforma de inteligencia,
      el que diseña OS 6) con estructura tipo DSM: barra superior fina, menú de apps, iconos grandes y widgets a la
      derecha [OS 6 diseño + OS 2 estructura]
- [ ] Quitar el selector de aspectos del asistente y del Panel de control. El asistente queda en fondo, widgets y
      nombre [OS 2]
- [ ] Las estéticas de la web (Apariencia: `data-style`, acento y densidad) solo afectan al **contenido de las
      apps** dentro de las ventanas, nunca al escritorio, la barra, los menús ni la decoración de ventana [OS 2]
- [ ] El fondo de pantalla sí se puede cambiar (ver «Escritorio») [OS 5 + OS 2]

## Escritorio
- [x] Fondo por aspecto y fondos de tokens (sistema, estética, liso, rejilla, degradado) [OS 2] #476/#500
- [ ] Fondo propio: subir imagen, galería, por escritorio, presentación y fondo «vivo» [OS 5]
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
- [ ] Buscador con más fuentes (vistas, valores, comandos y ajustes): `searchAll(q)` de OS 5, conectado en el buscador [OS 5 + OS 2]

## Sistema
- [ ] Arranque breve (la primera vez del día) y pantalla de bloqueo [OS 5] (#499)
- [x] Asistente «Bienvenido a Arc OS»: aspecto, fondo y widgets [OS 2] #501
- [x] Centro de notificaciones (campana) y toasts; `notify()` para el sistema y las apps [OS 2] #476/#500
- [ ] Alt+Tab visual con miniaturas [OS 5]
- [ ] Sonidos opcionales [OS 5]
- [ ] Atajos del sistema en `shortcuts.ts` [OS 5]

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
- [ ] Apps de análisis: mapa operacional, grafo de entidades, expedientes, línea de tiempo y vigilancia [OS 6]

## Móvil (≤ 900 px, al estilo iOS)
- [ ] Pantalla de inicio con páginas, dock, widgets e insignias [OS 3] (#494)
- [ ] Multitarea, centro de control, buscador y gestos [OS 3]
- [x] Cambiar entre «Terminal clásico» y «Modo OS» (`mode.svelte.ts`) [OS 3] #478
