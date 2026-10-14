# Arc Terminal

Terminal personal de mercados y actualidad, al estilo Bloomberg: economía, geopolítica, Wall Street,
tecnología, IA y utilidades del día a día, como las gasolineras más baratas de Menorca.
Se maneja desde una barra de comandos: escribes `NVDA`, `ECO` o `FUEL` y se abre.

> En construcción. La maqueta de diseño está en [`docs/maqueta.html`](docs/maqueta.html) (datos de ejemplo).

## Cómo funciona

- **Web estática** en GitHub Pages, hecha con SvelteKit y TypeScript.
- **GitHub Actions hace de servidor**: cada 15–30 minutos descarga noticias, cotizaciones, datos macro y
  precios de la gasolina, los guarda como JSON y vuelve a publicar la web. Las claves de las APIs viven en
  GitHub Secrets y nunca llegan al navegador.
- **Cotizaciones y gráficos en directo** con los widgets de TradingView.

## Comandos previstos

| Comando | Qué abre |
|---|---|
| `TOP` | Portada: lo más importante de cada sección |
| `ECO` | Economía y macro |
| `GEO` | Geopolítica |
| `WS` | Wall Street e inversión |
| `NVDA`, `AAPL`… | Ficha de una acción |
| `TECH` | Tecnología |
| `AI` | Inteligencia artificial |
| `CAL` | Agenda económica y resultados de empresas |
| `FUEL` | Gasolineras más baratas de Menorca |
| `HELP` | Comandos y atajos |
