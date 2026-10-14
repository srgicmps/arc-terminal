# Arc Terminal

Terminal personal de mercados y actualidad: economía, geopolítica, Wall Street,
tecnología, IA y utilidades del día a día, como las gasolineras más baratas de donde elijas.
Se maneja desde una barra de comandos: escribes `NVDA`, `ECO` o `FUEL` y se abre.

La maqueta de diseño está en [`docs/maqueta.html`](docs/maqueta.html) (datos de ejemplo).

## Cómo funciona

- **Web estática** en GitHub Pages, hecha con SvelteKit y TypeScript.
- **GitHub Actions hace de servidor**: cada 15 minutos `pnpm data` descarga todas las fuentes, las guarda como
  JSON en `static/data/` y vuelve a publicar la web. Si una fuente falla, se reutiliza su última copia
  publicada. Las fuentes que cambian poco se reutilizan durante horas para no castigar sus APIs.
- **Cotizaciones y gráficos en directo** con los widgets de TradingView, sin clave.
- Casi todas las fuentes son abiertas y **sin clave**. Unas pocas admiten una clave **opcional** en GitHub
  Secrets (FRED, Finnhub, SEC, Hugging Face): solo la usa la Action y, sin ella, ese panel no sale.

## Comandos

| Comando | Qué abre |
|---|---|
| `TOP` | Portada: lo más importante de cada sección |
| `ECO` | Economía y macro: paro, inflación, PIB, deuda, tipos del BCE, euríbor, hipotecas, bonos y EE. UU. |
| `GEO` | Geopolítica, terremotos (USGS e IGN), huracanes, incendios y volcanes |
| `ES` | España: titulares, BOE del día y comunicados del Gobierno y de Europa |
| `WS` | Wall Street: mapa de calor, curva de tipos de EE. UU., divisas y cripto |
| `NVDA`, `SAN`… | Ficha de un valor (TradingView y documentos de la SEC) |
| `MIS` | Tu lista de valores, guardada en el navegador |
| `TECH` / `AI` | Tecnología, Hacker News e inteligencia artificial |
| `BOE` | Sumario del Boletín Oficial del Estado, con buscador |
| `USGOV` | Federal Register: decretos presidenciales y normas de EE. UU. |
| `LUZ` | Precio de la luz hora a hora, hoy y mañana, su evolución y el mix de generación |
| `FUEL` | Gasolineras más baratas de Menorca o de cualquier provincia, «cerca de mí» |
| `WX` | El tiempo, el mar, la calidad del aire, avisos, sol y luna |
| `NEWS` | Buscador en todos los titulares |
| `WIKI` | Lo más leído en Wikipedia y efemérides |
| `CAL` | Agenda económica de la semana y resultados de empresas |
| `CHESS` | Ajedrez contra Stockfish en 5 niveles, con pista, evaluación, análisis de la partida y problema del día de Lichess |
| `STATUS` | Estado de todas las fuentes |
| `HELP` | Comandos y atajos |

## Fuentes

**España:** BOE, INE, Ministerio para la Transición Ecológica (carburantes), Red Eléctrica, Instituto Geográfico
Nacional, La Moncloa, Banco de España. **Europa:** BCE, Eurostat, MeteoAlarm, Comisión Europea.
**EE. UU.:** Federal Register, BLS, Tesoro, USGS, NOAA, NASA, Casa Blanca, Reserva Federal, FRED\*, SEC\*.
**Mundo:** BIS, Open-Meteo, CoinGecko, Polymarket, Hacker News, Hugging Face, Finnhub\*, Wikipedia y unos 40
canales RSS de medios. (\* con clave opcional.) El estado y la
procedencia de cada una se ven en `STATUS`.

## Ajedrez: Stockfish y chess.js

`CHESS` usa dos programas de terceros, que van tal cual:
- **Stockfish 17.1**, versión ligera de un solo hilo compilada a WebAssembly por Nathan Rugg y Chess.com (paquete
  npm `stockfish`), en `static/engine/`. Tiene licencia **GPL-3.0** (`static/engine/license.txt`) y es un programa
  aparte: la web solo lo arranca en un Web Worker y le habla por UCI. Código fuente:
  [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) y
  [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish).
- **chess.js** para las reglas, con licencia BSD-2-Clause: [jhlywa/chess.js](https://github.com/jhlywa/chess.js).
- El **problema del día** es de [Lichess](https://lichess.org/training/daily); sus problemas son de dominio público (CC0).

## Desarrollo

Requisitos: Node 24 y pnpm.

```sh
pnpm install
pnpm data      # descarga todas las fuentes en static/data/ (o: pnpm data boe fuel)
pnpm dev       # http://localhost:5173/
pnpm check     # comprueba tipos y componentes
pnpm build     # genera la web estática en build/
pnpm preview   # sirve build/ en http://localhost:4173/arc-terminal/
```

Cada push a `main`, y cada 15 minutos, GitHub Actions descarga los datos, construye la web y la publica en
GitHub Pages (`.github/workflows/deploy.yml`). En los PR solo la construye, como prueba.
