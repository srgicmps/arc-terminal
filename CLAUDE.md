# Arc Terminal: instrucciones para Claude

## Idioma y forma de trabajar
- Responde siempre en **español**.
- Sergi está aprendiendo. Explica **qué cambias y por qué**, archivo por archivo, sin dar nada por sabido.
  Svelte es nuevo para él (en el trabajo usa Vue 3 + TypeScript): cuando ayude, compáralo con Vue.
- Primero el plan y el porqué; luego, paso a paso.
- Sergi suele trabajar desde el móvil: respuestas claras y cortas, sin bloques de código enormes en el chat.
- Trabaja en **una rama por tarea** y abre un PR. Sergi revisa y hace el merge.
- Un commit por cada cambio probado. Mensajes cortos y claros, en español.
- Si Sergi pide algo que no es de la tarea en curso, avísale de que es mejor hacerlo aparte y apúntalo en
  «Aparcado», al final de este archivo.
- Antes de dar algo por terminado: `pnpm check` y `pnpm build` sin errores.

## Qué es
Terminal personal al estilo Bloomberg para el día a día de Sergi: economía y macro, geopolítica, Wall Street,
tecnología, IA, acciones importantes y utilidades como las gasolineras más baratas de Menorca. Se maneja con
una barra de comandos (`NVDA`, `ECO`, `FUEL`…) y paneles densos.

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
- Referencia: `docs/maqueta.html` (se abre directamente en el navegador). Colores y tipografías en `:root`.
- Estética de terminal: fondo casi negro, ámbar como acento, verde y rojo solo para subidas y bajadas,
  separaciones de 1 px, mucha densidad de información.
- Tipografías: IBM Plex Mono (datos y comandos) e IBM Plex Sans Condensed (titulares y textos).
- Sergi quiere detalles **sutiles y elegantes**, nada grueso ni llamativo. Un mismo elemento mide lo mismo
  en todas las vistas.
- Tiene que funcionar bien en el móvil (Sergi lo mirará mucho desde ahí).

## Comandos y fuentes previstas
| Comando | Qué abre | Fuentes |
|---|---|---|
| `TOP` | Portada | Resumen de todas |
| `ECO` | Economía y macro | FRED, BCE, Financial Times, Expansión, El País |
| `GEO` | Geopolítica | BBC, Al Jazeera, DW, France 24, GDELT |
| `WS` | Wall Street, mapa de calor | Finnhub, TradingView, CNBC, WSJ, MarketWatch |
| `NVDA`… | Ficha de una acción | TradingView, Finnhub |
| `TECH` / `AI` | Tecnología e IA | Hacker News, TechCrunch, The Verge, Ars Technica, MIT Technology Review, Hugging Face |
| `CAL` | Agenda económica y resultados | TradingView, Finnhub |
| `FUEL` | Gasolineras más baratas de Menorca | API abierta de precios de carburantes del Ministerio |

## Plan por fases
1. ~~**Esqueleto publicado**: proyecto SvelteKit + GitHub Action que construye y publica en Pages.~~ Hecho.
2. ~~**Primer dato real de punta a punta**: `FUEL` (una fuente, sin clave).~~ Hecho.
3. **Estilo de la maqueta y barra de comandos** con sugerencias y atajos de teclado. ← siguiente
4. **Noticias por RSS**: `ECO`, `GEO`, `TECH`, `AI`.
5. **Mercados**: TradingView + Finnhub (primera clave en GitHub Secrets).
6. **Macro** (FRED, BCE) y **portada `TOP`**.

Cuando termine una fase, actualiza esta lista.

## Reglas
- El repo y la web son **públicos**: nada privado, ninguna clave, ninguna URL interna.
- Comprueba cada fuente al usarla: si el RSS sigue vivo, límites del plan gratuito, términos de uso.
- Los datos de ejemplo se marcan siempre como de ejemplo; nunca se presentan como reales.
- GitHub desactiva los cron de un repo público tras 60 días sin actividad: tenerlo en cuenta en las Actions.

## Aparcado
- Evitar que GitHub desactive el cron tras 60 días sin commits (aviso o «keepalive» en la Action).
- `FUEL`: ordenar las gasolineras por distancia a donde estés (geolocalización del navegador).
