# Traspaso de «OS 4 Apps del sistema» (15-10-2026)

La sesión OS 4 llegó al tope de contexto. Esto es lo que hay y lo que falta, para su relevo («OS 4b»). Cuando
`docs/arc-os.md` (#502) esté en `main`, pasar esto allí y borrar este archivo.

## Cómo están hechas
- Cada app es una herramienta del núcleo: `src/lib/os/apps/<id>.ts` (registro, `load` diferido) y su carpeta
  `src/lib/os/apps/<carpeta>/`. Marco común `kit/Tool.svelte` (barra + contenido) y `kit/store.ts` (JSON en
  localStorage; si la clave está en `prefs.ts`, la nube la sincroniza sola con D1).
- Lógica pura en un `.ts` con tests al lado; el estado del navegador en `.svelte.ts`.
- Para probar en local: `pnpm build`, `vite preview` y Playwright con `localStorage` `arc-shell=os`,
  `arc-os-desks` con la ventana de la app y pulsar Intro para pasar la pantalla de bloqueo de OS 5.

## En main
| App | id | PR | Datos |
| --- | --- | --- | --- |
| Calculadora (normal, financiera, divisas BCE) | `calculadora` | #498 | — |
| Reloj (mundo, alarmas, cronómetro, temporizador) | `reloj` | #498 | `arc-os-alarms` |
| Notas (formato, fijar, buscar, papelera) | `notas` | #504 | `arc-os-note-<id>` |
| Monitor del sistema (ventanas, fuentes, rendimiento) | `monitor` | #505 | — |
| Calendario (festivos, datos, resultados MIS, alarmas, eventos) | `calendario` | #506 | `arc-os-events`, `/data/os-cal.json` |
| Ajustes | `ajustes` | #508 | las claves de siempre |

## Abierto
- **#518 Visor** (imágenes y PDF locales): fusionar cuando esté verde.
- **#520 Ajustes**: sin selector de aspecto (Sergi: un solo estilo, el «Mando» de OS 6) y con sección «Sistema»
  (OS 5: `sys.settings`, `setSettings`, `lock`, app `wallpaper`). El interruptor de sonidos sale solo cuando
  entre #511.
- **#517 Archivos**: EN ESPERA. Hay que portarlo al modelo único de carpetas de OS 2b (`src/lib/os/fs/`, clave
  `arc-os-fs`, nodos `folder | app | file` con `file = { app, ref }`): mis accesos pasan a nodos `app` y `file`
  (`ref`: `note:<id>`, `tick:NVDA`, `desk:d1`, `fav:ECO TIPOS`), y se quita `files/fs.ts` y `arc-os-files`. Los
  sitios del sistema (Apps, Notas, Valores, Escritorios, Favoritos) siguen virtuales. Iconos con `OsIcon`
  (`src/lib/os/icons/`). `openNode(carpeta)` de OS 2b debe abrir `openApp('archivos', '<id>')`: leer el id de la
  ruta de la ventana. Ya hecho en #517 y reutilizable: `openNote(id)` en `notes.svelte.ts`.

## Pendiente (pedido por Sergi vía Decisiones 2: «como Synology DSM en la web», sin marcas)
- Ajustes / Panel de control al estilo DSM: rejilla de iconos por categorías y, al entrar, lista lateral.
  Acordar con OS 2b (`session_01Ldge26A3VD1sV1ew8yRXX2`), que lleva el Panel de control rápido.
- Explorador al estilo File Station: árbol a la izquierda, barra de herramientas, lista o iconos, «Propiedades».
- **Centro de paquetes**: catálogo para instalar o quitar apps, vistas, experiencias y widgets del escritorio
  (estado en prefs).
- **Monitor de recursos** con gráficas en directo (se permiten librerías libres, p. ej. uPlot; /os no tiene tope de
  peso desde #497).
- **Centro de registros**: historial de avisos y de actualizaciones de las fuentes.
- Alarmas: que suenen sin abrir el Reloj. Se ha pedido a OS 5 que llame a `startAlarms()` al arrancar.
- Marcar las casillas de OS 4 en `docs/arc-os.md` cuando entre #502.
- La prueba de humo falla a veces con «Failed to fetch dynamically imported module …/nodes/0.*.js» en vistas a
  390 px que no tocan estos PR (pasó en #498 y #504). Al relanzar pasa; conviene que alguien lo mire.
- La ficha de un valor (`/s?sym=`) no es una app del núcleo: `openPath` devuelve null. Archivos la abre en una
  ventana de MIS. Lo ideal sería que el núcleo (OS 1) la resolviera.
