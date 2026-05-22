export const STORAGE_KEY = "camarim-compras-data-v1";

export function loadEventsFromStorage(storage = window.localStorage) {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveEventsToStorage(events, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(events));
}
