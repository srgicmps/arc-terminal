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
- `scripts/probe.ts` + `scripts/probe.txt`: en los PR la Action consulta esas URL y deja la respuesta en el
  registro. Sirve para explorar APIs nuevas cuando el entorno de desarrollo no tiene red.

## Arquitectura
- **GitHub Pages** sirve la web estática en https://srgicmps.github.io/arc-terminal/ (por eso hay que
  configurar `paths.base` en SvelteKit).
- Pages no tiene servidor, así que **GitHub Actions hace de servidor**: cada 15–30 min un script de Node
  descarga los datos, los guarda como JSON y vuelve a publicar la web. Así tampoco hay problemas de CORS.
- Las claves de las APIs van en **GitHub Secrets** y solo las usa el script de Actions. Nunca en el código
  que llega al navegador.
- Cotizaciones y gráficos en directo: widgets de TradingView (sin clave).

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
  `--lh*`, `--track-*`), escala de espaciado (`--sp-N`, donde N son los px), ritmo principal (`--pad-x`,
  `--row-y`, `--gutter`), líneas (`--hair`, `--border`) y medidas (`--control-h`, `--touch`…). Los puntos de corte
  están documentados en el mismo archivo. El tema de día solo redefine colores en `:root[data-theme='light']`.
- **Regla: nada de valores fijos.** Ni colores, ni fuentes, ni px de espaciado, bordes o letra en vistas y
  componentes: siempre `var(--…)`. Solo puede ir en px la geometría propia de un componente (el ancho de una
  columna, el alto de un gráfico). Si falta un valor, se añade un token.
- **Componentes base** en `src/lib/components/ui/`:
  `Seg` (botones de opción), `Select` (desplegable con etiqueta), `Tiles` + `Tile` (cifras grandes), `Table`
  (tabla densa: celdas `.l`, `.name`, `.sub`, `.mut`), `Bar` (barra de comparación), `Change` (variación
  verde/roja con signo), `Note` (nota al pie) y `Share` (botón «Compartir»; se usa con la prop `share` de `Panel`,
  y su lógica está en `src/lib/share.ts`). Además, `Panel` y `ViewHeader` para paneles y cabeceras de vista.
  Antes de escribir CSS para algo que ya existe, se usa el componente.
- **`app.css`** solo tiene el reset, la tipografía base y lo que comparten todas las vistas: rejillas (`.grid`,
  `.grid-2`, `.grid-2e`, `.grid-3`, `.col`), listas `.mini`, `.empty` y los colores `.up`, `.down`, `.mut`.
  El resto va en el `<style>` de su componente.
- **Cambiar la estética**, por ejemplo el acento: `--amber` en `tokens.css` (y su versión de día, abajo en el
  mismo archivo). Para una web más densa o más aireada: `--pad-x` y `--row-y`, o la escala `--sp-*`.
  Lo único fuera de los tokens son los iconos (`static/favicon.svg` y los PNG de la PWA): llevan el ámbar
  escrito y hay que rehacerlos si cambia el acento.

## Comandos y fuentes
La lista completa y actual está en `src/lib/commands.ts` (y en la vista `HELP`). Resumen:
| Comando | Qué abre | Fuentes |
|---|---|---|
| `TOP` | Portada | Resumen de todas |
| `IMP` | Lo más importante de hoy, la semana, el mes y el año (puntuación propia, sin IA) | Todos los titulares, BOE, Federal Register, Wikipedia |
| `ECO` | Economía y macro, tipos de los bancos centrales | Eurostat, BCE, BLS, Tesoro de EE. UU., INE, BIS, FRED*, RSS |
| `GEO` | Geopolítica, mapa, terremotos, huracanes, incendios, elecciones | RSS (BBC, Al Jazeera, DW…), USGS, IGN, NOAA, NASA, Polymarket, Wikidata |
| `ES` | España en cifras, BOE, luz | INE, BOE, REE, RSS |
| `WS` | Wall Street, mapa de calor, curva de tipos, divisas, cripto | TradingView, Tesoro de EE. UU., BCE, CoinGecko |
| `NVDA`… | Ficha de un valor | TradingView, SEC* |
| `MIS` | Tu lista de valores (en el navegador) | TradingView |
| `TECH` / `AI` | Tecnología e IA | Hacker News, Hugging Face, RSS |
| `BOE` / `USGOV` | Boletines oficiales | BOE, Federal Register |
| `LUZ` | Precio de la luz y mix de generación | REE |
| `WX` | Tiempo, mar, aire, avisos, sol y luna | Open-Meteo, MeteoAlarm |
| `FUEL` | Gasolineras por provincia, «cerca de mí» | Ministerio para la Transición Ecológica |
| `CAL` | Agenda económica y resultados | TradingView, Finnhub* |
| `NEWS` / `WIKI` / `STATUS` / `HELP` | Buscador, Wikipedia, estado de fuentes, ayuda | — |

\* Fuente con clave **opcional** en GitHub Secrets (`FRED_API_KEY`, `FINNHUB_API_KEY`, `SEC_USER_AGENT`, `HF_TOKEN`):
sin ella el panel no sale y no se rompe nada.

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
- El repo y la web son **públicos**: nada privado, ninguna clave, ninguna URL interna.
- Comprueba cada fuente al usarla: si el RSS sigue vivo, límites del plan gratuito, términos de uso.
- Los datos de ejemplo se marcan siempre como de ejemplo; nunca se presentan como reales.
- GitHub desactiva los cron de un repo público tras 60 días sin actividad: lo evita `.github/workflows/keepalive.yml`.

## Aparcado
- Festivos locales de Menorca: Sergi ha decidido no añadirlos.
- Formato y lint en CI (Prettier + ESLint): un PR propio, cuando haya pocas ramas abiertas.
- Descartadas: GDELT (429 desde Actions), RSS de la CNMV (no responde) y RSS del Parlamento Europeo (todo
  europarl.europa.eu responde 202 vacío desde Actions: muro anti-robots).
- ReliefWeb: falta el appname aprobado (RELIEFWEB_APPNAME); aparcado por Sergi.
