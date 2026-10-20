// Cómo se entrega a la página lo que ya está en Cache Storage. Lógica sin cachés ni fetch, para poder probarla.

/**
 * La misma respuesta, con el cuerpo ya leído entero. Chromium cancela a veces (net::ERR_ABORTED) un
 * <link rel="modulepreload"> cuyo cuerpo le llega en streaming desde Cache Storage, sobre todo con la CPU
 * cargada; ese trozo queda roto y el arranque de la vista falla con «Failed to fetch dynamically imported
 * module». Con el cuerpo ya leído no pasa. Los trozos de código pesan pocos KB, así que leerlos antes cuesta poco.
 */
export async function buffered(response: Response): Promise<Response> {
	return new Response(await response.arrayBuffer(), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
}
