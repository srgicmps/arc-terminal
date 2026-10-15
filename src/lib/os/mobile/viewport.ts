// Arc OS en iPhone y iPad: que la pantalla llegue a los bordes (muesca, isla y barra de inicio).
// Sin `viewport-fit=cover` en la etiqueta viewport, Safari deja todos los `env(safe-area-inset-*)` a 0 y el
// inicio, el dock y la barra de las apps quedaban debajo de la barra de inicio del iPhone (o de la muesca en
// horizontal). Solo se pone dentro de /os: el resto de la web sigue como estaba.

/** El contenido de la etiqueta viewport con `viewport-fit=cover` (sin repetirlo si ya está). */
export function withCover(content: string): string {
	const parts = content
		.split(',')
		.map((p) => p.trim())
		.filter((p) => p && !/^viewport-fit\s*=/i.test(p));
	return [...parts, 'viewport-fit=cover'].join(', ');
}

/** Pone `viewport-fit=cover` mientras dura Arc OS; devuelve la función que deja la etiqueta como estaba. */
export function coverViewport(doc: Document = document): () => void {
	const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
	if (!meta) return () => {};
	const before = meta.content;
	meta.content = withCover(before);
	return () => {
		meta.content = before;
	};
}
