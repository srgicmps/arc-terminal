# Arc Terminal: instrucciones para Claude

## Idioma y forma de trabajar
- Responde siempre en **español**.
- Sergi está aprendiendo. Explica **qué cambias y por qué**, archivo por archivo, sin dar nada por sabido.
  Svelte es nuevo para él (en el trabajo usa Vue 3 + TypeScript): cuando ayude, compáralo con Vue.
- Primero el plan y el porqué; luego, paso a paso.
- Sergi suele trabajar desde el móvil: respuestas claras y cortas, sin bloques de código enormes en el chat.
- Trabaja en **una rama por tarea** y abre un PR. Los agentes tienen permiso para hacer el merge ellos mismos
  cuando pasen `pnpm check` y `pnpm build`: trae main antes y resuelve conflictos (puede haber varias sesiones a la vez).
- Un commit por cada cambio probado. Mensajes cortos y claros, en español.
- Si Sergi pide algo que no es de la tarea en curso, avísale de que es mejor hacerlo aparte y apúntalo en
  «Aparcado», al final de este archivo.
- Antes de dar algo por terminado: `pnpm check` y `pnpm build` sin errores.

## Trabajo entre sesiones
Varias sesiones de Claude trabajan a la vez en este repo. Para no pisarse:
- **Coordinación** reparte las tareas. Antes de asignar una, revisa las ramas y los PR abiertos.
- **Ideas** propone mejoras (qué es, fuente, si la ha comprobado y qué archivos tocaría) y se las manda a
  Coordinación por lotes. No programa.
- Las **sesiones que programan** piden tarea a Coordinación antes de empezar algo nuevo y le avisan al abrir el PR.
  No toques archivos de otra tarea en curso sin hablarlo antes con su sesión.
- Para hablar entre sesiones, usa `send_message` de Claude Code Remote; `list_sessions` dice quién está activo.
- Si una fuente o vista nueva se solapa con otro PR abierto, el que llega después se adapta al primero.

## Qué es
Terminal personal al estilo Bloomberg para el día a día de Sergi: economía y macro, geopolítica, Wall Street,
tecnología, IA, acciones importantes y utilidades como las gasolineras más baratas de Menorca. Se maneja con
una barra de comandos (`NVDA`, `ECO`, `FUEL`…) y paneles densos.

## Cómo está hecho
- `scripts/update.ts` (`pnpm data`) ejecuta las fuentes de `scripts/sources/` y guarda cada una en
  `static/data/<nombre>.json` como `{ name, fetchedAt, data }`. Las fuentes reciben la copia anterior para
  acumular historial (gasolina, luz). Los tipos compartidos están en `src/lib/types.ts` y `src/lib/fuel.ts`.
- Cada vista lee sus datos en `+page.ts` con `dataset('nombre')` (`src/lib/data.ts`).
- Componentes comunes en `src/lib/components/` (Panel, NewsList, SeriesTable, LineChart, TvWidget…).
- Atajos de teclado: registro único en `src/lib/shortcuts.ts` (`SHORTCUTS` + `isShortcut`). De ahí salen HELP, el MANUAL y las teclas que escuchan la barra, los paneles y el modo TV.
- `scripts/probe.ts` + `scripts/probe.txt`: en los PR que tocan `scripts/`, la Action consulta esas URL y deja la
  respuesta en el registro. Sirve para explorar APIs nuevas cuando el entorno de desarrollo no tiene red.
- **Probar una fuente sin la pasada completa**: Actions → «Publicar en Pages» → Run workflow, con «fuentes»
  (p. ej. `fao climate`). Descarga solo esas fuentes, sin copia guardada, y lanza el sondeo, sin publicar.
- En los PR, la Action va en jobs a la vez: `checks` (check, test, build y el tope de peso por vista de
  `scripts/weight.ts`: el verde o el rojo rápido; Arc OS, `/os`, no tiene tope por decisión de Sergi, y lo que solo
  carga dentro de `/os` tampoco), `smoke`
  (datos reales y prueba de humo) y `probe` solo si el PR toca `scripts/`. `compare` (vistas del PR frente a
  main) y `tv-shots` se lanzan a mano: Run workflow sobre la rama, con «herramienta».

## Arquitectura
- **La web es privada**: **Cloudflare Pages** la sirve en https://arcterminal.dev (dominio propio; también en https://arc-terminal.pages.dev), en la raíz, con
  **Cloudflare Access** delante (login por código al email de Sergi). La URL está en un solo sitio, `scripts/site.ts`,
  y se cambia sin tocar código con la Variable de GitHub `SITE_URL`. GitHub Pages está apagado.
  Las Actions publican con `wrangler` (Secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`) y leen la copia
  anterior con el service token de Access (`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`, `fetchPublished` en
  `scripts/lib.ts`).
- **Usuarios** (Sergi, familia y amigos; los añade él a mano en la política de Access): cada uno tiene sus ajustes
  en su cuenta, sincronizados entre sus dispositivos. Pages Function `functions/api/prefs.ts` (GET/PUT) → lógica en
  `cloud/prefs.ts` + base **D1** (`arc-terminal-users`, tabla `prefs` que se crea sola). El usuario sale del JWT de
  Access **verificado** con las claves del equipo (`cloud/access.ts`), nunca de una cabecera suelta. Solo se guardan
  las claves «portables» de `prefs.ts` (las de `transfer.ts`), con topes de tamaño. En el navegador,
  `src/lib/cloud.svelte.ts` (fusión a tres bandas en `cloud.ts`): localStorage sigue siendo la caché y el modo sin
  conexión; la primera vez sube lo que haya (migración). `wrangler.toml` no lleva secretos: `scripts/cf-config.ts`
  lo rellena al publicar con la API de Cloudflare (crea la base si no está, lee el AUD de la app de Access y el dominio
  del equipo; el token necesita D1 · Edit y Access: Apps and Policies y Organizations · Read). Las Variables
  `D1_DATABASE_ID`, `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` son opcionales y mandan. Sin nada, /api/* responde 503 y la web
  va igual, solo en local.
- **Cabeceras** (`static/_headers`, solo lo estático): un año de caché (`private, immutable`) SOLO para lo que lleva hash en el nombre (`/_app/immutable/*`, el motor de ajedrez); en todo, `nosniff` y `frame-ancestors 'self'` (nunca `'none'`: Arc OS abre vistas en iframes).
- La web es estática, así que **GitHub Actions hace de servidor**: cada 15–30 min un script de Node
  descarga los datos, los guarda como JSON y vuelve a publicar la web. Así tampoco hay problemas de CORS.
- **Dos velocidades**: `deploy.yml` (cada 15 min y en cada push a main) refresca todo lo caducado según el
  `maxAgeMinutes` de cada fuente; `fast.yml` (cada 5 min) fuerza solo las urgentes (lista `URGENT`: terremotos,
  avisos, titulares, IMP…) y publica. Comparten grupo de concurrencia, así que nunca publican a la vez.
- Las claves de las APIs van en **GitHub Secrets** y solo las usa el script de Actions. Nunca en el código
  que llega al navegador.
- Cotizaciones y gráficos en directo: widgets de TradingView (sin clave).
- **Avisos al móvil** con ntfy (`scripts/notify.ts`, tras `pnpm data`): reglas P1–P4 en la lista `RULES` de
  `scripts/alerts/rules.ts`, umbrales y cupos en `scripts/alerts/config.ts`. El tema
  va en el Secret `NTFY_TOPIC` y es la única protección: nunca en el repo, en registros ni en JSON.
- **Avisos por usuario** (`AVISOS`): cada usuario elige temas (grupos de `src/lib/alertconfig.ts`), nivel, tope
  diario, sus valores y silencio; por defecto, lo de Sergi. Se guarda en D1 (`cloud/alerts.ts`, `/api/alerts`) con un
  tema de ntfy propio, aleatorio, que solo ven él y la Action. `notify.ts` lee la lista con el service token de Access
  (`/api/alerts?all=1`, sin emails) y `scripts/alerts/users.ts` reparte los avisos de la pasada según cada uno. Su
  historial va SOLO en la caché de Actions (`.notify-cache/notify-users.json`, por uid aleatorio), nunca en static/data.
  Los de Sergi siguen saliendo por `NTFY_TOPIC`.
- **«Tu mañana»** (`scripts/alerts/brief.ts`, panel en AVISOS): resumen diario personal a la hora que elige cada uno
  (tiempo de su sitio con Open-Meteo, sus valores, su agenda y titulares de IMP de sus temas; 5 líneas). Por su ntfy y,
  si lo pide, por email: la Action manda el texto por uid a `/api/brief` (`cloud/brief.ts`) y la web lo envía con
  Brevo (Secrets de Pages `BREVO_API_KEY` y `BREVO_SENDER`); el email nunca sale de Cloudflare. Uno al día.
- **Avisos de casa** (F16, `scripts/alerts/home.ts`, panel «En casa» de AVISOS): horas baratas de la luz de mañana, su gasolinera favorita (si baja 2 cts), polen de
  mañana en el sitio de «Tu mañana» (Open-Meteo, CAMS) y la víspera de los resultados de sus valores (F12). Por usuario.
- **Mandar a la familia** (F15): «Mandar» en cada titular (`FamilySend.svelte`) y panel «Familia» en AVISOS. `/api/family`
  (`cloud/family.ts`, tablas `family` y `family_sent`): cada uno pone un nombre y acepta o no; la Function manda al tema
  de ntfy del otro (nunca sale de ahí), con tope diario. Solo salen quienes aceptan y tienen los avisos activados.
- **Sugerencias** (pie de cada vista, `Feedback.svelte`): `/api/feedback` (`cloud/feedback.ts`) las guarda en D1
  (tabla `feedback`) y avisa a Sergi por ntfy si Pages tiene el Secret `NTFY_TOPIC`. Leerlas, solo el admin
  (Secret de Pages `ADMIN_EMAIL`, nunca en el repo).
- **ADMIN** (`/admin`, `cloud/admin.ts`, `/api/admin`): solo para `ADMIN_EMAIL`. Usuarios (último acceso, tabla
  `seen` que apunta `/api/prefs`; avisos), invitar o quitar emails de la política de Access «Sergi» (Variable
  `ACCESS_POLICY` si se llama distinto) con los Secrets de Pages `CF_ACCESS_ADMIN_TOKEN` (Access: Apps and Policies ·
  Edit) y `CF_ACCOUNT_ID`, y las sugerencias. Quitar cierra su sesión y borra sus datos de D1.
- **Alertas propias** (F14, antes D41 con issues): «alerta NVDA > 150», «+NVDA», «vigila aranceles» se guardan en la
  cuenta de cada uno (`prices`, `mis`, `words` de `alertconfig.ts`, `/api/alerts`; panel «Tus alertas» en AVISOS). A
  cada uno le llegan por su tema; las de Sergi (Secret de Pages `ADMIN_EMAIL`) salen por `NTFY_TOPIC` como siempre.
  Al avisar, la Action las borra (`?fired=1`). Los issues que queden se pasan a la cuenta de Sergi y se cierran
  (`?migrate=1`, `scripts/requests.ts`); nada privado en `notify-log.json`.

- **Arc OS** (`/os`, comando `OS`): modo opcional que funciona como un sistema operativo (núcleo en `src/lib/os/`, shell en
  `src/lib/os/shell/`). Lista de comprobación y dueños en `docs/arc-os.md`: cada PR marca ahí sus casillas.

- **Experiencias** (`EXP`): cada una es una ruta `src/routes/x/<id>` que reutiliza datos y componentes; se apuntan en
  `src/lib/experiences.ts` (de ahí salen el índice `/x`, «EXP <nombre>», el selector de `ExpHeader` y «Al entrar» de
  HELP, que guarda `x:<id>` en `arc-home`). Sin tokens propios: funcionan con cualquier estilo y con el modo Sencillo.

## Stack
- SvelteKit con `adapter-static` + TypeScript, Svelte 5 (runes).
- pnpm y Node 24.
- CSS propio, sin frameworks de estilos.
- Gráficos propios, si hacen falta: uPlot o Lightweight Charts.

## Diseño
- Referencia: `docs/maqueta.html` (se abre directamente en el navegador). Colores y tipografías, en
  `src/styles/tokens.css` (ver «Sistema de diseño»).
- Estética de terminal: fondo casi negro, ámbar como acento, verde y rojo solo para subidas y bajadas,
  separaciones de 1 px, mucha densidad de información.
- Tipografías: IBM Plex Mono (datos y comandos) e IBM Plex Sans Condensed (titulares y textos).
- Sergi quiere detalles **sutiles y elegantes**, nada grueso ni llamativo. Un mismo elemento mide lo mismo
  en todas las vistas.
- Tiene que funcionar bien en el móvil (Sergi lo mirará mucho desde ahí).

## Sistema de diseño
Un cambio de estética se hace en un solo sitio.
- **Tokens** en `src/styles/tokens.css` (lo importa `src/app.css`): colores, tipografía (`--fs-*`, `--fw-*`,
  `--lh*`, `--track-*`), escala de espaciado (`--sp-N`, donde N son los px), ritmo principal (`--pad-x`, `--head-y`,
  `--row-y`, `--gutter`), líneas (`--hair`, `--border`) y medidas (`--control-h`, `--touch`…). Los puntos de corte
  están documentados en el mismo archivo. El tema de día solo redefine colores en `:root[data-theme='light']`.
- **Regla: nada de valores fijos.** Ni colores, ni fuentes, ni px de espaciado, bordes o letra en vistas y
  componentes: siempre `var(--…)`. Solo puede ir en px la geometría propia de un componente (el ancho de una
  columna, el alto de un gráfico). Si falta un valor, se añade un token.
- **Componentes base** en `src/lib/components/ui/`:
  `Seg` (botones de opción), `Select` (desplegable con etiqueta), `Tiles` + `Tile` (cifras grandes), `Table`
  (tabla densa: celdas `.l`, `.name`, `.sub`, `.mut`, `.per`, `.spark`), `Bar` (barra de comparación), `Change` (variación
  verde/roja con signo), `Note` (nota al pie), `ButtonRow` (fila de botones iguales), `Search` (buscador con ✕; filtra con `queryWords` + `hasWords` de `src/lib/search.ts`), `ChipInput` (campo + «Añadir» + chips «X ×»), `Disclosure` (plegable con ▸/▾), `Menu` (botón con lista desplegable: «⋯» de la cabecera, «Más» de las pestañas, relojes), `Listen` («Escuchar» con la voz del navegador) y `Share` (botón «Compartir»; se usa con la prop `share` de `Panel`,
  y su lógica está en `src/lib/share.ts`). Además, `Panel` y `ViewHeader` para paneles y cabeceras de vista.
  Antes de escribir CSS para algo que ya existe, se usa el componente.
- **Controles**: todo botón, segmentado, desplegable o campo suelto mide `--control-h` de alto (28 px con ratón,
  44 px en pantallas táctiles: el token cambia solo). `Seg` con una sola opción activa es un grupo de radios
  (`role=radiogroup`, `aria-checked`, flechas); con varias, botones con `aria-pressed`.
- **Modo «encajar en pantalla»** (≥1280 px): la última rejilla de la vista llena el alto; cada panel parte de
  `--fit-panel-min` (o de su contenido, si es menor), el alto que sobra se reparte sin pasar del contenido, y los
  gráficos, mapas y widgets van enteros. Si no cabe, hace scroll la vista, nunca se aplasta un panel. Desde ~1680 px, una columna ancha con varios
  paneles se parte en dos subcolumnas también al encajar. Las reglas
  están en `src/routes/+layout.svelte`; no se ajusta panel a panel.
- **`app.css`** solo tiene el reset, la tipografía base y lo que comparten todas las vistas: rejillas (`.grid`,
  `.grid-2`, `.grid-2e`, `.grid-3`, `.col`), listas `.mini`, `.empty` y los colores `.up`, `.down`, `.mut`.
  El resto va en el `<style>` de su componente.
- **Modo Sencillo** (`src/lib/modo.ts`, `<html data-modo>`, clave `arc-modo`): bloque `[data-modo='sencillo']` de
  `tokens.css` (letra, aire, títulos de panel), paneles esenciales por vista y títulos claros en `src/lib/simple.ts`.
  `Panel` oculta solo lo que no es esencial y `ViewHeader` ofrece «Ver todos». Una vista nueva sin lista se ve entera.
  Explicaciones (qué es, por qué importa, cómo leerlo) en `src/lib/explain.ts`, sobre el glosario: el ⓘ de `Term` y
  del título de cada panel. Frases con los datos clave en `src/lib/plain.ts` (plantillas, sin IA), con la prop `plain`
  de `ViewHeader`.
- **Cambiar la estética**, por ejemplo el acento: `--amber` en `tokens.css` (y su versión de día, abajo en el
  mismo archivo). Para una web más densa o más aireada: `--pad-x` y `--row-y`, o la escala `--sp-*`.
  Sergi también puede elegir cian o azul en HELP, «A tu gusto» (`src/lib/taste.svelte.ts`): son bloques
  `[data-accent]` al final de `tokens.css` que redefinen `--amber*`; nada lleva el acento escrito a mano.
  **Estéticas** (`ESTILO` y «A tu gusto»): `<html data-style="<id>">`, una por archivo en `static/estilos/<id>.css`
  (registro en `src/lib/estilos.ts`; cómo se hace una, en `docs/estilos.md`). Capas CSS: `tokens` < `estilos` <
  `ajustes` (`src/styles/ajustes.css`: densidad y modo Sencillo). Clave `arc-style`, sincronizada con la cuenta. Sin
  nada guardado, `src/app.html` decide: «Terminal» si el navegador ya usaba la web, «Grafito» si es nuevo.
  En Arc OS (`/os`) el escritorio, la barra, los menús y la decoración de ventana no usan la estética, el acento ni la
  densidad: tienen un aspecto propio y fijo (`src/lib/os/look.ts`; el aspecto «Mando» está en `tokens.css`). El contenido de
  las ventanas sí los usa.
  Lo único fuera de los tokens son los iconos (`static/favicon.svg` y los PNG de la PWA): llevan el ámbar
  escrito: se rehacen con `node scripts/icons.ts` (iconos, maskable, apple-touch y arranque del iPhone) a partir de
  `static/favicon.svg`. El logo en la web es `Logo.svelte` (mismo dibujo, con `--amber`).

## Comandos y fuentes
Un archivo por comando en `src/lib/commands/` (`eco.ts`, `geo.ts`…); `src/lib/commands.ts` los junta solos y `order`
decide su sitio. Un comando nuevo es un archivo nuevo. Los valores, en `src/lib/tickers.ts`, y todo junto, en la
vista `HELP`. Resumen:
| Comando | Qué abre | Fuentes |
|---|---|---|
| `TOP` | Portada | Resumen de todas |
| `IMP` | Lo más importante de hoy, la semana, el mes y el año (puntuación propia, sin IA) | Todos los titulares, BOE, Federal Register, Wikipedia |
| `SEMANA` | Resumen de la semana: top de IMP en 7 días, mercados, datos publicados y agenda | IMP, FRED*, BCE, Tesoro de EE. UU., CoinGecko, calendarios de publicaciones |
| `ECO` | Economía y macro, tipos de los bancos centrales | Eurostat, BCE, BLS, Tesoro de EE. UU., INE, BIS, FAO, FRED*, RSS |
| `GEO` | Geopolítica, mapa, terremotos, huracanes, incendios, elecciones | RSS (BBC, Al Jazeera, DW…), USGS, IGN, NOAA, NASA, Polymarket, Copernicus (ERA5), Wikidata, SIPRI, EASA (CZIB), NGA (avisos a navegantes), Cloudflare Radar* |
| `GLOBO` | Globo 3D que gira con las capas de GEO y la Sala de control; Canvas 2D propio (`src/lib/geo/globe.ts` + `globe-render.ts`, cargado con import()), también «Ver en 3D» en GEO y «Globo 3D» en la Sala | Las de GEO y la Sala |
| `ES` | España en cifras, paro registrado por comunidad, tráfico por provincia, BOE, luz | INE, SEPE, Seguridad Social, DGT (DATEX II), BOE, REE, RSS |
| `WS` | Wall Street, mapa de calor, curva de tipos, divisas, cripto, materias primas | TradingView, Tesoro de EE. UU., BCE, CoinGecko, Banco Mundial (Pink Sheet), EIA* (inventarios de petróleo) |
| `WB` | Bonos a 2, 10 y 30 años de EE. UU., zona euro (AAA) y Japón, con pendientes | Tesoro de EE. UU., BCE, MOF de Japón |
| `BTMM` | Mercado monetario de EE. UU. y zona euro: SOFR, EFFR, €STR, euríbor, letras | Fed de Nueva York, FRED*, Tesoro de EE. UU., BCE |
| `G` | Gráfico de cualquier serie de la terminal (`G US10, BUND`); catálogo en `/data/g/series.json` y atajos en `src/lib/gseries.ts` | Todas |
| `SEAS` | Estacionalidad mensual de una serie, con el historial que haya | Todas |
| `MOST` | Los que más suben, bajan y se negocian hoy (EE. UU., Alemania, España) | TradingView |
| `EQS` | Buscador de acciones: bolsa, punto de partida y filtros de sector, PER, dividendo… | TradingView |
| `IMAP` | Mapas de calor de más índices y países, sectores de EE. UU. y bolsas del mundo | TradingView |
| `NVDA`… | Ficha de un valor | TradingView, SEC* |
| `RV` | Un valor frente a sus competidores: PER, márgenes, crecimiento (unos 60 de EE. UU.) | Finnhub* |
| `SIG` | Señales técnicas: máximos y mínimos de 52 semanas, medias y RSI | Finnhub*, TradingView |
| `MIS` | Tu lista de valores (en el navegador) | TradingView |
| `TECH` / `AI` | Tecnología e IA | Hacker News, Hugging Face, OpenRouter, Epoch AI (CC BY 4.0), Cloudflare Radar*, RSS |
| `BOE` / `USGOV` | Boletines oficiales | BOE, Federal Register |
| `LUZ` | Precio de la luz y mix de generación | REE |
| `WX` | Tiempo, mar, aire, avisos, sol y luna | Open-Meteo, MeteoAlarm, Copernicus (ERA5), NOAA (CO₂) |
| `VIAJE` | Antes de un viaje: tiempo a 7 días, hora, moneda, aviso de viaje y festivos de cualquier ciudad | Open-Meteo, BCE, Departamento de Estado de EE. UU., Nager.Date |
| `FUEL` | Gasolineras por provincia, «cerca de mí» | Ministerio para la Transición Ecológica, Comisión Europea (Weekly Oil Bulletin) |
| `HIPOTECA` | Tu hipoteca: cuota, cuadro de amortización y próxima revisión (datos solo tuyos, en tus ajustes) | BCE (euríbor a 12 meses) |
| `CARTERA` | Tu cartera: posiciones, ganancia o pérdida y reparto (datos solo tuyos, en tus ajustes) | Finnhub* (EE. UU.), precio a mano, BCE |
| `AHORRO` | Dónde rinde el dinero, interés compuesto, lo que vale hoy el de otro año y tu inflación (MI IPC) | BCE, Banco de España, Eurostat (IPCA del INE) |
| `CAL` | Agenda económica y resultados | TradingView, Finnhub* |
| `CAL` | Agenda económica y resultados | TradingView, Finnhub* |
| `TEST` | Test de la semana: cinco preguntas con titulares y datos de la semana, sin IA; puntuación en la cuenta de cada uno | IMP, FRED*, BCE, CoinGecko, USGS |
| `CAL` | Agenda económica, resultados, festivos y puentes (`PUENTES`) | TradingView, Finnhub*, Nager.Date |
| `CHESS` | Ajedrez contra Stockfish (WebAssembly, en el navegador), pista, análisis y problema del día | Stockfish, chess.js, Lichess |
| `MODO` | Modo Sencillo (lo esencial, letra mayor, explicaciones; por defecto para usuarios nuevos) o Terminal (todo) | — |
| `TV` | Modo TV: las vistas rotan solas, encajadas y a pantalla completa | — |
| `EXP` | Experiencias: otras formas de usar Arc con los mismos datos (periódico, sala de control, feed…) | Todas |
| `FONDOS` | Carteras 13F de grandes fondos: mayores posiciones, compras y ventas | SEC* |
| `HDS` | Qué fondos de FONDOS tienen un valor (13F al revés, con 45 días de retraso) | SEC* |
| `RSS` | Mis RSS (como Feedly): tus feeds en tu cuenta, leídos por `/api/rss` (`cloud/rss.ts`, caché de 15 min y topes; solo con cuenta) | Tus feeds |
| `ESTILO` | Estética: Terminal, Grafito, Cristal, Fósforo… (17), con vista previa | — |
| `AVISOS` | Tus avisos al móvil: temas, nivel, tope, valores y silencio (solo con cuenta, en arcterminal.dev) | ntfy |
| `QUIEN` | Quién lo cuenta: el mismo hecho en varios medios, cobertura por región y ángulos muertos (sin IA) | Todos los titulares |
| `BIENVENIDA` | La primera vez (y desde HELP): intereses o perfil, ciudad y modo → portada, inicio, MIS de ejemplo y propuesta de avisos; recorrido de 6 pasos (el último, las experiencias), solo en BIENVENIDA y HELP (`src/lib/onboarding/`) | — |
| `NEWS` / `WIKI` / `STATUS` / `HELP` | Buscador, Wikipedia, estado de fuentes, ayuda | — |

\* Fuente con clave **opcional** en GitHub Secrets (`FRED_API_KEY`, `FINNHUB_API_KEY`, `SEC_USER_AGENT`, `HF_TOKEN`, `CLOUDFLARE_RADAR_TOKEN`, `EIA_API_KEY`):
sin ella el panel no sale y no se rompe nada. `MYMEMORY_EMAIL` (también opcional) traduce al español los
titulares en inglés (`scripts/translate.ts`); sin él, siguen en inglés.

## Plan por fases
1. ~~**Esqueleto publicado**: proyecto SvelteKit + GitHub Action que construye y publica en Pages.~~ Hecho.
2. ~~**Primer dato real de punta a punta**: `FUEL` (una fuente, sin clave).~~ Hecho.
3. ~~**Estilo de la maqueta y barra de comandos** con sugerencias y atajos de teclado.~~ Hecho.
4. ~~**Noticias por RSS**: `ECO`, `GEO`, `TECH`, `AI`.~~ Hecho (y `ES`, `NEWS`).
5. ~~**Mercados**: TradingView, y Finnhub con clave opcional.~~ Hecho.
6. ~~**Macro** (BCE, Eurostat, BLS, Tesoro, INE, BIS, FRED con clave opcional) y **portada `TOP`**.~~ Hecho.
7. ~~**Gobiernos**: `BOE`, `USGOV` (Federal Register), comunicados de La Moncloa, BdE, UE, Casa Blanca y Fed.~~ Hecho.
8. **Pulido y fiabilidad**: tema claro, sistema de diseño, vista modular, tests y avisos de fuentes caídas. ← en curso

Arc Terminal es **mundial**: lo de Menorca que ya existe se queda, pero no se añade nada nuevo centrado en Menorca.
Excepción aprobada por Sergi: puertos AIS de Maó y Ciutadella (D1).

Cuando termine una fase, actualiza esta lista.

## Reglas
- El **repo es público** (la web, privada tras Access): nada privado en el repo, ninguna clave, ninguna URL interna.
- Comprueba cada fuente al usarla: si el RSS sigue vivo, límites del plan gratuito, términos de uso.
- Los datos de ejemplo se marcan siempre como de ejemplo; nunca se presentan como reales.
- GitHub desactiva los cron de un repo público tras 60 días sin actividad: lo evita `.github/workflows/keepalive.yml`.

## Aparcado
- Festivos locales de Menorca: Sergi ha decidido no añadirlos.
- Formato y lint en CI (Prettier + ESLint): un PR propio, cuando haya pocas ramas abiertas.
- Descartadas: GDELT (429 desde Actions), RSS de la CNMV (no responde) y RSS del Parlamento Europeo (todo
  europarl.europa.eu responde 202 vacío desde Actions: muro anti-robots), datos abiertos del Congreso y Frontex (lote 26-B: congreso.es y
  frontex.europa.eu dan 403 a todo desde Actions, robots.txt incluido; data.europa.eu solo enlaza a Frontex).
- Bonos a 10 años de Reino Unido, Japón y China: TradingView no da rentabilidades en sus widgets; hacen falta
  fuentes oficiales (BoE, MOF de Japón, ChinaBond). De momento no se hacen.
- «Próximo dato» de Eurostat (M10): el .ics `cache/RELEASE_CALENDAR/calendar_EN.ics` da 404 y no se ha encontrado el nuevo. El de INE y EE. UU. (fechas de FRED; el .ics del BLS prohíbe robots) sí funcionan.
- Oro de los bancos centrales en toneladas (lote 24.5): la API nueva del FMI (2025) tiene el flujo IRFCL, pero su lista de
  indicadores no incluye el oro (seis sondeos en el #282). El World Gold Council pide registro.
