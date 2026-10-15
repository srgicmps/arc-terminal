# Licencias de las fuentes

Auditoría de octubre de 2026, al abrir la web a familia y amigos (menos de 50 personas, privada tras Cloudflare
Access, sin ánimo de lucro). Pregunta: ¿se puede **mostrar** cada fuente a ese grupo?

- ✅ libre: dominio público, datos oficiales reutilizables, CC o API abierta. Basta con citar la fuente (ya se hace).
- ⚠ dudosa: los términos hablan de «uso personal» o de no redistribuir. **Grave** si el texto lo prohíbe claramente;
  **leve** si es zona gris razonable para un grupo privado sin ánimo de lucro.
- ❌ no permitida: ninguna de momento.

Lo que dicen los términos está resumido de su página pública; no es asesoría legal.

## Resumen

| Fuente (archivo de `scripts/sources/`) | Vistas | Estado | Por qué |
|---|---|---|---|
| **Finnhub** (`finnhub`, `alert-quotes`, `analysts`, `peers`, `perf`) | RV, SIG, CAL, ficha, avisos | ⚠ **grave** | Plan gratuito «para uso personal»; prohíbe redistribuir los datos a terceros. |
| **FRED: series de terceros** (`fred`: `BAMLH0A0HYM2`, `BAMLC0A0CM`, `BAMLHE00EHYIOAS` de ICE BofA; `VIXCLS` de Cboe; `MORTGAGE30US` de Freddie Mac) | ECO, WS, G | ⚠ **grave** | FRED las marca «Copyright… permission required»; sus términos de la API no permiten republicar series con copyright. |
| **Cboe** (`vix`, CSV de cdn.cboe.com) | WS, G | ⚠ leve | Datos de mercado de Cboe; su web es para uso personal y no comercial. Grupo privado y sin ánimo de lucro: zona gris. |
| **Titulares de pago por RSS** (`news`: FT, The Economist, Dow Jones/WSJ, Investing.com, Nikkei) | TOP, ECO, NEWS… | ⚠ leve | RSS para «uso personal, no comercial». Solo se muestra titular, resumen corto y enlace: es lo que hace cualquier lector de RSS. |
| **Roll Call Factba.se** (`leaders`) | GEO | ⚠ leve | Agenda de la Casa Blanca; sin licencia explícita. Se cita y enlaza. |
| **FINRA** (`finra`, ventas en corto) | ficha | ⚠ leve | Archivos públicos; términos de FINRA: uso no comercial. |
| **aisstream.io** (`ais`) | puertos | ⚠ leve | Gratis con clave; los términos no hablan de mostrarlo a terceros. |
| TradingView (widgets, sin clave) | WS, MOST, EQS, IMAP, ficha, CAL | ✅ | Los widgets se pueden incrustar gratis en cualquier web si se deja su logo y enlace (se deja). |
| FRED: resto de series (Fed, BEA, BLS, Tesoro, EIA, Fed de Atlanta…) | ECO, BTMM, G | ✅ | Dominio público de EE. UU. |
| Organismos de EE. UU.: BLS, Tesoro, Fed de NY, Federal Register, SEC, EIA, CFTC (`cot`), USGS, NOAA, NASA, JPL, SWPC, NHC, CISA, Departamento de Estado, FEWS NET | varias | ✅ | Dominio público de EE. UU. |
| España: INE, SEPE, Seguridad Social, BOE, BdE, REE, MITECO (agua), Ministerio (gasolineras), AEMET, IGN, La Moncloa | ES, LUZ, FUEL, WX… | ✅ | Reutilización de información pública (Ley 37/2007), citando la fuente. |
| UE y organismos: Eurostat, BCE, EUR-Lex, Comisión (Oil Bulletin), Copernicus/ECMWF, MeteoAlarm, GIE, Energy-Charts | varias | ✅ | Reutilización con cita o CC BY 4.0. |
| Internacionales: BIS, FMI (y PortWatch), OCDE, DBnomics, Banco Mundial (Pink Sheet), FAO, OMS, ACNUR, SIPRI, GDACS, MOF de Japón | varias | ✅ | Datos abiertos con cita (varios CC BY o CC BY-NC: sin ánimo de lucro, vale). |
| Cloudflare Radar, IODA | GEO, TECH | ✅ | CC BY-NC 4.0 / uso con cita. |
| Wikipedia, Wikidata (`wiki`, `imp`, `elections`) | WIKI, IMP, GEO | ✅ | CC BY-SA / CC0. |
| IA y tecnología: Hugging Face, arXiv, OpenRouter, Epoch AI, Hacker News, GitHub | TECH, AI | ✅ | API públicas; Epoch con CC BY 4.0, citado. |
| Cripto: CoinGecko, mempool.space, DefiLlama, Polymarket | WS, GEO | ✅ | API públicas; CoinGecko pide la mención (ya sale). |
| Open-Meteo, NOAA CO₂, Nager.Date, Launch Library 2, Indeed Hiring Lab, policyuncertainty.com, Lichess (CC0), Stockfish (GPL), status de servicios | WX, CHESS… | ✅ | Libres o CC BY, con cita. |
| Titulares por RSS de medios abiertos y organismos (BBC, DW, Al Jazeera, ONU, El País, RTVE…) | varias | ✅ | RSS publicado para lectores: titular + enlace. |
| MyMemory (`translate`) | titulares | ✅ | Uso gratuito con email; solo traduce titulares. |

## Propuestas para las graves

1. **Finnhub.** Opciones: (a) dejarlo para todos (grupo privado, sin ánimo de lucro; riesgo bajo pero contra la letra
   de los términos); (b) **mostrar RV, SIG y el bloque de Finnhub de la ficha solo al usuario de Sergi** y, para el
   resto, el widget de TradingView equivalente (ya sale en la ficha); (c) pagar un plan con redistribución (caro).
   Recomendación: **(b)**.
2. **FRED con copyright** (ICE BofA, VIX, hipoteca de Freddie Mac). Opciones: (a) dejarlo; (b) **quitar esas cinco
   series del catálogo compartido y usar alternativas libres**: VIX → el CSV de Cboe que ya se descarga (`vix`, ⚠ leve);
   diferenciales de crédito → los del BCE para el euro (`ecb`) y, para EE. UU., nada equivalente libre; hipoteca →
   el tipo medio del Tesoro a 10 años ya está; (c) mostrarlas solo a Sergi. Recomendación: **(c)**, que no quita
   nada a Sergi, y si se complica, (b).

Nada se ha quitado: queda a la espera de la decisión de Sergi.
