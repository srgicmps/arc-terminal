// Abrir el Expediente o el Grafo de una entidad desde cualquier app de Arc OS:
//   openDossier('country', 'ES')   openDossier('ticker', 'NVDA')   openDossierFor('Lagarde')
//   openGraph('leader', 'trump')
// La entidad viaja en el path de la ventana («/expediente#country:ES»), que se guarda con el escritorio.
import type { Entity } from '../../../entities.ts';
import { findEntity } from '../../../entities.ts';
import { openApp } from '../../os.svelte.ts';
import { pathTo } from './graph.ts';
import { nodeId, type Kind } from './model.ts';

/** Abre (o trae al frente) el Expediente de una entidad. */
export const openDossier = (kind: Kind, key: string) => openApp('expediente', pathTo('expediente', nodeId(kind, key)));

/** Lo mismo con el id del nodo («country:ES»). */
export const openDossierId = (id: string) => openApp('expediente', pathTo('expediente', id));

/** Abre el Grafo centrado en una entidad (sin entidad, la vista de la actualidad). */
export const openGraph = (kind?: Kind, key?: string) => openApp('grafo', pathTo('grafo', kind && key ? nodeId(kind, key) : null));

/** La entidad de findEntity (entities.ts) como id de nodo. */
export function entityNode(e: Entity): string {
	switch (e.kind) {
		case 'ticker':
			return nodeId('ticker', e.ticker.code);
		case 'leader':
			return nodeId('leader', e.leader.id);
		case 'bank':
			return nodeId('bank', e.bank);
		case 'country':
			return nodeId('country', e.country.code);
	}
}

/** Abre el Expediente de lo que se escriba («Lagarde», «Japón», «NVDA»). Sin ficha, abre el Expediente vacío. */
export function openDossierFor(text: string) {
	const e = findEntity(text);
	return openApp('expediente', pathTo('expediente', e ? entityNode(e) : null));
}
