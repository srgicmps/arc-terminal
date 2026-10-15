// Estado de la Bitácora en el navegador (como un store de Pinia con persistencia). Las reglas están en
// bitacora.ts; aquí solo se lee y se guarda en localStorage. Con cuenta, cloud.svelte.ts lo sube a D1.
import { addEntry, JOURNAL_KEY, newId, parseJournal, removeEntry, toggleDone, type Entry } from './bitacora.ts';

export const journal = $state({ entries: [] as Entry[], ready: false });

/** Lee lo guardado. Solo en el navegador (desde un $effect); la segunda vez no hace nada. */
export function initJournal() {
	if (journal.ready) return;
	try {
		journal.entries = parseJournal(localStorage.getItem(JOURNAL_KEY));
	} catch {}
	journal.ready = true;
}

function save() {
	try {
		localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal.entries));
	} catch {}
}

export function addToJournal(e: Omit<Entry, 'id' | 'at'>) {
	journal.entries = addEntry(journal.entries, { ...e, id: newId(), at: new Date().toISOString() });
	save();
}

export function deleteFromJournal(id: string) {
	journal.entries = removeEntry(journal.entries, id);
	save();
}

export function toggleJournalDone(id: string) {
	journal.entries = toggleDone(journal.entries, id);
	save();
}
