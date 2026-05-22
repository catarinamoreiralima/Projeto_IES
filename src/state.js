export function normalizeEvents(events = []) {
  return events.map((event) => ({
    ...event,
    buyers: event.buyers ?? collectBuyers(event),
    purchaseLocations: event.purchaseLocations ?? collectPurchaseLocations(event),
    artists: (event.artists ?? []).map((artist) => ({
      ...artist,
      rooms: (artist.rooms ?? []).map((room) => ({
        ...room,
        items: (room.items ?? []).map((item) => ({
          ...item,
          notes: item.notes ?? "",
          purchaseValue: item.purchaseValue ?? "",
          purchaseValueInput: item.purchaseValueInput ?? item.purchaseValue ?? "",
          purchaseValueMode: item.purchaseValueMode ?? "total",
        })),
      })),
    })),
  }));
}

export function collectBuyers(event) {
  const buyers = new Set();
  (event.artists ?? []).forEach((artist) => {
    (artist.rooms ?? []).forEach((room) => {
      (room.items ?? []).forEach((item) => {
        if (item.buyer) buyers.add(item.buyer);
      });
    });
  });
  return [...buyers].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function collectPurchaseLocations(event) {
  const stores = new Set();
  (event.artists ?? []).forEach((artist) => {
    (artist.rooms ?? []).forEach((room) => {
      (room.items ?? []).forEach((item) => {
        if (item.store) stores.add(item.store);
      });
    });
  });
  return [...stores].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getSelectedEvent(state) {
  return state.events.find((event) => event.id === state.selectedEventId) || null;
}

export function syncSelectedArtist(state) {
  const event = getSelectedEvent(state);
  if (!event || event.artists.length === 0) {
    state.selectedArtistId = null;
    return;
  }

  if (!event.artists.some((artist) => artist.id === state.selectedArtistId)) {
    state.selectedArtistId = event.artists[0].id;
  }
}
