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
  `scripts/weight.ts`: el verde o el rojo rápido), `smoke`
  (datos reales y prueba de humo) y `probe` solo si el PR toca `scripts/`. `compare` (vistas del PR frente a
  main) y `tv-shots` se lanzan a mano: Run workflow sobre la rama, con «herramienta».

## Arquitectura
- **La web es privada**: **Cloudflare Pages** la sirve en https://arcterminal.dev (dominio propio; también en https://arc-terminal.pages.dev), en la raíz, con
  **Cloudflare Access** delante (login por código al email de Sergi). La URL está en un solo sitio, `scripts/site.ts`,
  y se cambia sin tocar código con la Variable de GitHub `SITE_URL` (p. ej. al pasar a un dominio propio).
  Las Actions publican con `wrangler` (Secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`) y leen la copia
  anterior con el service token de Access (`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`, `fetchPublished` en
  `scripts/lib.ts`).
- **Transición**: GitHub Pages sigue publicando la misma web en https://srgicmps.github.io/arc-terminal/ (por eso
  `paths.base` es `/arc-terminal` salvo con `BASE_PATH` vacío, que usa el build de Cloudflare) hasta que Sergi
  confirme que la nueva va bien; luego se apaga en otro PR.
- Pages no tiene servidor, así que **GitHub Actions hace de servidor**: cada 15–30 min un script de Node
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
- **Órdenes desde la barra** (D41): «alerta NVDA > 150», «+NVDA», «vigila aranceles» abren un issue ya escrito
  (`src/lib/useralerts.ts`); `notify.ts` lee con `scripts/requests.ts` solo los issues abiertos **del dueño**,
  los aplica (`scripts/alerts/user.ts`) y cierra la alerta al avisar. Los issues son públicos.

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
  verde/roja con signo), `Note` (nota al pie), `ButtonRow` (fila de botones iguales), `Search` (buscador con ✕; filtra con `queryWords` + `hasWords` de `src/lib/search.ts`), `ChipInput` (campo + «Añadir» + chips «X ×»), `Disclosure` (plegable con ▸/▾), `Listen` («Escuchar» con la voz del navegador) y `Share` (botón «Compartir»; se usa con la prop `share` de `Panel`,
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
- **Cambiar la estética**, por ejemplo el acento: `--amber` en `tokens.css` (y su versión de día, abajo en el
  mismo archivo). Para una web más densa o más aireada: `--pad-x` y `--row-y`, o la escala `--sp-*`.
  Sergi también puede elegir cian o azul en HELP, «A tu gusto» (`src/lib/taste.svelte.ts`): son bloques
  `[data-accent]` al final de `tokens.css` que redefinen `--amber*`; nada lleva el acento escrito a mano.
  Lo único fuera de los tokens son los iconos (`static/favicon.svg` y los PNG de la PWA): llevan el ámbar
  escrito y hay que rehacerlos si cambia el acento.

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
| `GEO` | Geopolítica, mapa, terremotos, huracanes, incendios, elecciones | RSS (BBC, Al Jazeera, DW…), USGS, IGN, NOAA, NASA, Polymarket, Copernicus (ERA5), Wikidata, SIPRI, Cloudflare Radar* |
| `ES` | España en cifras, paro registrado por comunidad, BOE, luz | INE, SEPE, Seguridad Social, BOE, REE, RSS |
| `WS` | Wall Street, mapa de calor, curva de tipos, divisas, cripto, materias primas | TradingView, Tesoro de EE. UU., BCE, CoinGecko, Banco Mundial (Pink Sheet), EIA* (inventarios de petróleo) |
| `WB` | Bonos a 2, 10 y 30 años de EE. UU., zona euro (AAA) y Japón, con pendientes | Tesoro de EE. UU., BCE, MOF de Japón |
| `BTMM` | Mercado monetario de EE. UU. y zona euro: SOFR, EFFR, €STR, euríbor, letras | Fed de Nueva York, FRED*, Tesoro de EE. UU., BCE |
| `G` | Gráfico de cualquier serie de la terminal (`G US10, BUND`); catálogo en `/data/g/series.json` y atajos en `src/lib/gseries.ts` | Todas |
| `SEAS` | Estacionalidad mensual de una serie, con el historial que haya | Todas |
| `MOST` | Los que más suben, bajan y se negocian hoy (EE. UU., Alemania, España) | TradingView |
| `EQS` | Buscador de acciones: bolsa, punto de partida y filtros de sector, PER, dividendo… | TradingView |
| `NVDA`… | Ficha de un valor | TradingView, SEC* |
| `MIS` | Tu lista de valores (en el navegador) | TradingView |
| `TECH` / `AI` | Tecnología e IA | Hacker News, Hugging Face, OpenRouter, Epoch AI (CC BY 4.0), Cloudflare Radar*, RSS |
| `BOE` / `USGOV` | Boletines oficiales | BOE, Federal Register |
| `LUZ` | Precio de la luz y mix de generación | REE |
| `WX` | Tiempo, mar, aire, avisos, sol y luna | Open-Meteo, MeteoAlarm, Copernicus (ERA5), NOAA (CO₂) |
| `FUEL` | Gasolineras por provincia, «cerca de mí» | Ministerio para la Transición Ecológica, Comisión Europea (Weekly Oil Bulletin) |
| `CAL` | Agenda económica y resultados | TradingView, Finnhub* |
| `CHESS` | Ajedrez contra Stockfish (WebAssembly, en el navegador), pista, análisis y problema del día | Stockfish, chess.js, Lichess |
| `TV` | Modo TV: las vistas rotan solas, encajadas y a pantalla completa | — |
| `FONDOS` | Carteras 13F de grandes fondos: mayores posiciones, compras y ventas | SEC* |
| `HDS` | Qué fondos de FONDOS tienen un valor (13F al revés, con 45 días de retraso) | SEC* |
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
