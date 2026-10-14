# Ideas pendientes de Arc Terminal

Estado a 14/10/2026, 17:00 hora de Madrid. Lo prepara la sesión «Ideas» para retomarlo en la próxima sesión.
Regla: lo aprobado no se reparte hasta que Sergi descongele el trabajo nuevo (se congeló hasta fusionar todos
los PR abiertos). Antes de programar cualquier cosa, mirar si ya hay rama o PR (`claude/*`).

## 1. Aprobado por Sergi y aún sin repartir (en orden de prioridad)

1. **MANUAL** (prioridad alta). Comando `MANUAL` con absolutamente todo: vistas, paneles, comandos con argumentos y
   ejemplos que se pueden tocar, atajos, personalización, avisos al móvil (ntfy), sin conexión, Tu sitio, ajedrez,
   novedades y preguntas frecuentes. Buscador y acordeón en el móvil. **Se genera desde los registros** y un test
   falla si algo queda sin documentar:
   - campo `manual` en cada comando (`src/lib/commands/<código>.ts`, tras el refactor de Prog 5: section, what,
     args con examples/options, tips, panels);
   - `src/lib/shortcuts.ts` como única lista de atajos (la usan CommandBar y +layout);
   - `src/lib/prefs.ts` como registro de claves de localStorage;
   - sección de avisos generada desde `scripts/alerts/config.ts`;
   - tests: todo comando documentado, toda ruta con comando, todo ejemplo se resuelve con `resolveInput`, todo
     atajo y toda preferencia documentados, y smoke de /manual a 390 y 1280 px.
   HELP se queda como chuleta rápida con un enlace al manual. Dos PR: (1) registros, vista y tests; (2) miniaturas
   (capturas de la prueba de humo) y novedades.
2. **LIDER fase 1**: `LIDER <nombre>`, ficha individual, agenda del BCE con todo el Comité Ejecutivo, ventana de 7
   días y líderes en la búsqueda. Más elegir y ordenar líderes en el navegador.
3. **Funciones por valor**: `NVDA GP` (gráfico), `CN` (noticias), `DES` (perfil), `FA` (fundamentales),
   `TA` (técnico) y `SEC`.
4. **Chips y controles de exportación**: el BIS de Comercio (Federal Register) en `sanctions.ts`, en GEO y en un
   panel de TECH.
5. **GEO, panel de diplomacia**: Departamento de Estado, FCDO, SEAE y OIEA, en lugar de «Gobiernos» (solo en GEO).
6. **Fuentes de AI y TECH**: Google DeepMind, NVIDIA, Meta AI, Import AI, The Register y Rest of World, y arreglar
   el filtro de HN (quitar «model» y «agents?»).
7. **Plegar paneles**, recordado por vista y panel.
8. **Exportar e importar ajustes** con un enlace (crea `prefs.ts`, que también usa MANUAL).
9. **Autocompletar argumentos** (provincias, líderes, países, funciones…).
10. **Atajos**: Ctrl/Cmd+K, `?`, `[` y `]`. **Decisión de Sergi: Esc dentro de una ficha vuelve a la vista anterior.**
11. **Palabras vigiladas en todos los titulares**, no solo en el BOE.
12. **País de referencia** en TOP y ECO.
13. **Silenciar medios e idioma** de los titulares (campo `lang` en los feeds).
14. **Medios del mundo** en GEO: Kyiv Independent, SCMP, Nikkei Asia y Africanews.
15. **Análisis de conflictos**: Crisis Group (CrisisWatch), Foreign Affairs, Elcano, ECFR e ISW.
16. **Modelos de IA con su precio** (OpenRouter, sin clave).
17. **Regulación y antimonopolio** en TECH: FTC, DOJ y la Comisión filtrada (competencia, DMA, AI Act).
18. **LIDER fase 2**: unos 25 líderes con el cargo al día desde Wikidata y la vista «Hoy en el mundo».
19. **Fichas de entidad** (`/org`: BCE, Fed, FMI, OTAN, ONU, OPEP).
20. **Búsqueda completa**: líderes, países y actos de agenda en la barra; filtros en NEWS (`NEWS inflación /eco /7d`).
21. **Nombres enlazados** en los titulares y una fila «Relacionado» en cada ficha.
22. **LIDER fase 3**: agendas oficiales (Elysée, Bundesregierung, Fed, Consilium, ONU; hay que probarlas) y
    cumbres. Descartadas: Xi (Xinhua parado desde 2017) y la agenda de la Comisión (404 desde Actions).
23. **Polymarket**: cambio en 24 h (`oneDayPriceChange`) y filtro por tema.
24. **Sanciones de la UE** leyendo eurlex (#138, tema «Sanciones»); la OFSI del Reino Unido es opcional.
25. **Titulares de GEO por región** (Europa, Oriente Medio, Asia, América, África).
26. **Terremotos de España**: de GEO a ES.
27. **LIDER**: Powell, con agenda y discursos de la Fed; von der Leyen solo con «lo último».

Avisos al móvil aprobados (para Prog 2, con la ficha detallada ya enviada): euríbor mensual con hipoteca tipo,
conflictos y escaladas (grupos de IMP), elecciones (día y resultado), novedades grandes de IA, lanzamientos espaciales
1 h antes, problema de ajedrez en el resumen de la mañana, SEMANA los domingos a las 19:00, valores seguidos
(defensa + NVDA + AAPL, con Finnhub; los no estadounidenses quizá no salgan en el plan gratis), diésel (±3 cts en 7
días, mínimos o máximos de 90 días, zona a ±5 cts de la media de España), avisos meteorológicos naranja y rojo de su
zona, y temas generales (apagón, GDACS, IODA, caídas de servicios, huelgas, ciberataques, OMS, luz de mañana,
festivos y cambio de hora). Tope: 50 al día, a cualquier hora. La zona va en Secrets.

## 2. Borrador del lote 18 (sin mandar a Sergi)

1. **NOVEDADES**: lo fusionado en la última semana (API de GitHub con GITHUB_TOKEN en la Action).
2. **Incertidumbre y riesgo geopolítico**: EPU (policyuncertainty.com) y GPR (Caldara–Iacoviello). Sin clave;
   hay que probarlos con probe.
3. **Presión en las cadenas de suministro**: GSCPI de la Fed de Nueva York (XLSX mensual).
4. **Deuda y déficit por país** con el FMI (GGXWDG_NGDP y GGXCNL_NGDP) en ECO y PAIS.
5. **Calendario de todos los bancos centrales grandes** (BoE, BoJ, SNB, BoC, RBA, Banxico, BCB, RBI, PBoC). Va en
   CAL, junto a «Próximo dato» (M10): que lo haga la misma sesión.
6. **Stablecoins**: capitalización de USDT, USDC… con DefiLlama (sin clave).
7. **Exportar a CSV** cualquier tabla.

## 3. Decisiones de Sergi que hay que respetar

- Arc Terminal es **mundial**: nada nuevo centrado en Menorca, salvo los puertos AIS de Maó y Ciutadella.
- **Sin licencia** en el repo (todos los derechos reservados). Stockfish va aparte, en `static/engine/`, con su GPL.
- Horas siempre en **hora de Madrid** al hablar con Sergi.
- **Traducción de titulares**: MyMemory (email de contacto en el Secret `MYMEMORY_EMAIL`) + traductor integrado de
  Chrome en el ordenador. DeepL no.
- **Tu sitio**: Madrid por defecto, localStorage + `?lugar=`, 1 principal y 5 favoritos.
- Claves ya en Secrets: FRED_API_KEY, FINNHUB_API_KEY, SEC_USER_AGENT (y HF_TOKEN opcional).
- Descartadas: GDELT, el RSS de la CNMV, el RSS del Parlamento Europeo, el RSS de OFAC (retirado en 2025) y la
  agenda de la Comisión. ReliefWeb, aparcado (falta el appname).

## 4. Cómo se trabaja

Ideas propone → Decisiones se lo enseña a Sergi → lo aprobado va **solo a Coordinación**, que lo reparte. Las
sesiones de Mejora continua 1–4 mandan sus lotes a Ideas, que quita lo repetido y los pasa a Decisiones.
