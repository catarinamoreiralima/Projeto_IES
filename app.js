const SUPABASE_URL = "https://nmaftctgvulckprcxwkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VSoB6vAcT9UTlFbu1aqaLw_nBHbvDF0";

const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) ?? null;

const state = {
  events: normalizeEvents(loadEvents()),
  selectedEventId: null,
  statusFilter: "all",
  activeView: "dressing",
  selectedArtistId: null,
  editingNoteItemId: null,
};

const els = {
  eventForm: document.querySelector("#event-form"),
  eventName: document.querySelector("#event-name"),
  eventDate: document.querySelector("#event-date"),
  eventLocation: document.querySelector("#event-location"),
  eventList: document.querySelector("#event-list"),
  eventTitle: document.querySelector("#event-title"),
  eventMeta: document.querySelector("#event-meta"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authStatus: document.querySelector("#auth-status"),
  signOut: document.querySelector("#sign-out"),
  syncNow: document.querySelector("#sync-now"),
  syncStatus: document.querySelector("#sync-status"),
  emptyState: document.querySelector("#empty-state"),
  workspace: document.querySelector("#event-workspace"),
  artistForm: document.querySelector("#artist-form"),
  artistName: document.querySelector("#artist-name"),
  buyerForm: document.querySelector("#buyer-form"),
  buyerName: document.querySelector("#buyer-name"),
  buyerList: document.querySelector("#buyer-list"),
  storeForm: document.querySelector("#store-form"),
  storeName: document.querySelector("#store-name"),
  storeList: document.querySelector("#store-list"),
  artistSummaryList: document.querySelector("#artist-summary-list"),
  artistTabs: document.querySelector("#artist-tabs"),
  artistList: document.querySelector("#artist-list"),
  shoppingTable: document.querySelector("#shopping-table"),
  buyerBalance: document.querySelector("#buyer-balance"),
  generalView: document.querySelector("#general-view"),
  dressingView: document.querySelector("#dressing-view"),
  shoppingView: document.querySelector("#shopping-view"),
  viewTabs: document.querySelector(".view-tabs"),
  statusFilter: document.querySelector("#status-filter"),
  exportCsv: document.querySelector("#export-csv"),
  exportXls: document.querySelector("#export-xls"),
  exportPdf: document.querySelector("#export-pdf"),
  summaryArtists: document.querySelector("#summary-artists"),
  summaryRooms: document.querySelector("#summary-rooms"),
  summaryItems: document.querySelector("#summary-items"),
  summaryPending: document.querySelector("#summary-pending"),
};

let currentUser = null;
const syncController = window.createSyncControllerFromModule?.({
  state,
  els,
  getSupabaseClient: () => supabaseClient,
  getCurrentUser: () => currentUser,
  setCurrentUser: (value) => {
    currentUser = value;
  },
  render,
  loadEvents,
  normalizeEvents,
  uniqueValues,
}) ?? null;

if (state.events.length > 0) {
  state.selectedEventId = state.events[0].id;
}

const domHandlerActions = {
  getSupabaseClient: () => supabaseClient,
  getCurrentUser: () => currentUser,
  setCurrentUser: (value) => {
    currentUser = value;
  },
  setSyncStatus: (message) => syncController?.setSyncStatus(message),
  updateAuthUi: () => syncController?.updateAuthUi(),
  syncRemoteData: () => syncController?.syncRemoteData(),
  getSelectedEvent,
  createId,
  persistAndRender,
  render,
  syncSelectedArtist,
  moveEventTo,
  clearEventDragState,
  confirmDelete,
  findItemsByShoppingRow,
  calculatePurchaseValue,
  parseQuantity,
  splitPendingRowForPurchase,
  findItemByIds,
  downloadFile,
  slugify,
  toCsv,
  toExcelHtml,
  getShoppingRows,
};

window.attachDomHandlersFromModule?.({ state, els, actions: domHandlerActions });

render();
syncController?.initSupabase();

function render() {
  return window.renderAppFromModule?.(state, els, {
    getSelectedEvent: () => getSelectedEvent(),
    syncSelectedArtist: () => syncSelectedArtist(),
    getArtistTotal,
    getRoomTotal,
    getAllocatedItemValue,
    getShoppingRows,
    isEditingNote: (itemId) => state.editingNoteItemId === itemId,
    state,
  });
}

function moveEventTo(draggedId, targetId) {
  const fromIndex = state.events.findIndex((event) => event.id === draggedId);
  const toIndex = state.events.findIndex((event) => event.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return;

  const [moved] = state.events.splice(fromIndex, 1);
  state.events.splice(toIndex, 0, moved);
  state.selectedEventId = moved.id;
  persistAndRender();
}

function clearEventDragState() {
  els.eventList.querySelectorAll(".event-row.dragging, .event-row.drag-over").forEach((item) => {
    item.classList.remove("dragging", "drag-over");
  });
}

function renderHeader(event) {
  return window.renderHeaderFromModule?.(event, els) ?? (() => {
    const hasEvent = Boolean(event);
    els.emptyState.classList.toggle("hidden", hasEvent);
    els.workspace.classList.toggle("hidden", !hasEvent);
    els.exportCsv.disabled = !hasEvent;
    els.exportXls.disabled = !hasEvent;
    els.exportPdf.disabled = !hasEvent;

    if (!event) {
      els.eventTitle.textContent = "Nenhum evento cadastrado";
      els.eventMeta.textContent = "Crie um evento para começar.";
      return;
    }

    els.eventTitle.textContent = event.name;
    els.eventMeta.textContent = [formatDate(event.date), event.location].filter(Boolean).join(" - ") || "Sem data/local definida";
  })();
}

function renderArtists(event) {
  return window.renderArtistsFromModule?.(state, els, event, {
    getArtistTotal,
    getRoomTotal,
    getAllocatedItemValue,
    getShoppingRows,
    getSelectedEvent,
    state,
    isEditingNote: (itemId) => state.editingNoteItemId === itemId,
  }) ?? (() => {
    if (!event) {
      els.artistTabs.innerHTML = "";
      els.artistList.innerHTML = "";
      return;
    }

    if (event.artists.length === 0) {
      els.artistTabs.innerHTML = "";
      els.artistList.innerHTML = `<p class="muted">Nenhum artista cadastrado neste evento.</p>`;
      return;
    }

    els.artistTabs.innerHTML = event.artists
      .map((artist) => {
        const active = artist.id === state.selectedArtistId ? " active" : "";
        return `<button class="artist-tab${active}" type="button" data-artist-id="${artist.id}">${escapeHtml(artist.name)}</button>`;
      })
      .join("");

    const selectedArtist = event.artists.find((artist) => artist.id === state.selectedArtistId) || event.artists[0];
    els.artistList.innerHTML = renderArtist(event, selectedArtist);
  })();
}

function renderArtist(event, artist) {
  return window.renderArtistFromModule?.(event, artist, {
    getArtistTotal,
    getRoomTotal,
    getAllocatedItemValue,
    getShoppingRows,
    getSelectedEvent,
    state,
    isEditingNote: (itemId) => state.editingNoteItemId === itemId,
  }) ?? (() => {
    const rooms = artist.rooms.length
      ? artist.rooms.map((room) => renderRoom(event, artist, room)).join("")
      : `<p class="muted">Nenhum camarim cadastrado para este artista.</p>`;
    const artistTotal = getArtistTotal(event, artist);

    return `
      <article class="artist-card">
        <div class="card-head">
          <div>
            <h4>${escapeHtml(artist.name)}</h4>
            <span class="total-badge">Total do artista: ${escapeHtml(formatCurrency(artistTotal))}</span>
          </div>
          <div>
            <button class="icon-button" type="button" title="Excluir artista" data-action="delete-artist" data-artist-id="${artist.id}">x</button>
          </div>
        </div>
        <form class="room-form" data-room-form data-artist-id="${artist.id}">
          <input name="room" type="text" placeholder="Nome do camarim" required />
          <button class="ghost-button" type="submit">Adicionar camarim</button>
        </form>
        <div class="room-list">${rooms}</div>
      </article>
    `;
  })();
}

function renderRoom(event, artist, room) {
  const items = room.items.length
    ? room.items.map((item) => renderItem(event, artist, room, item)).join("")
    : `<p class="muted">Sem itens ainda.</p>`;
  const roomTotal = getRoomTotal(event, artist, room);

  return `
    <div class="room">
      <div class="room-head">
        <div>
          <h5>${escapeHtml(room.name)}</h5>
          <span class="total-badge subtle">Total do camarim: ${escapeHtml(formatCurrency(roomTotal))}</span>
        </div>
        <button class="icon-button" type="button" title="Excluir camarim" data-action="delete-room" data-artist-id="${artist.id}" data-room-id="${room.id}">x</button>
      </div>
      <form class="item-form" data-item-form data-artist-id="${artist.id}" data-room-id="${room.id}">
        <input name="name" type="text" placeholder="Item" required />
        <input name="quantity" type="text" placeholder="Qtd." />
        ${renderStoreSelect(event)}
        <input name="notes" type="text" placeholder="Observações" />
        <button class="primary-button" type="submit">Adicionar</button>
      </form>
      <div>${items}</div>
    </div>
  `;
}

function renderStoreSelect(event) {
  const stores = event?.purchaseLocations ?? [];
  if (stores.length === 0) {
    return `
      <select name="store" aria-label="Onde comprar" class="store-select" disabled>
        <option value="">Cadastre locais no Geral</option>
      </select>
    `;
  }

  return `
    <select name="store" aria-label="Onde comprar" class="store-select" required>
      <option value="">Onde comprar</option>
      ${renderStoreOptions(stores)}
    </select>
  `;
}

function renderStoreOptions(stores) {
  return stores
    .map((store) => `<option value="${escapeHtml(store)}">${escapeHtml(store)}</option>`)
    .join("");
}

function renderItem(event, artist, room, item) {
  const isBought = item.done && item.buyer;
  const allocatedValue = getAllocatedItemValue(event, item);
  const isEditingNote = state.editingNoteItemId === item.id;
  return `
    <div class="item-row${isBought ? " done" : ""}">
      <span>
        <span class="item-main">${escapeHtml(item.name)} ${item.quantity ? `- ${escapeHtml(item.quantity)}` : ""}</span>
        <span class="item-detail">${escapeHtml(item.store || "Sem fornecedor")}</span>
        ${isEditingNote ? renderNoteForm(artist, room, item) : renderNoteText(item)}
      </span>
      <span class="item-actions">
        <span class="item-value">${escapeHtml(formatCurrency(allocatedValue))}</span>
        <span class="status-pill ${isBought ? "done" : "pending"}">${isBought ? "Comprado" : "Pendente"}</span>
        <button class="icon-button" type="button" title="Editar observação" data-action="edit-note" data-artist-id="${artist.id}" data-room-id="${room.id}" data-item-id="${item.id}">✏</button>
        <button class="icon-button" type="button" title="Excluir item" data-action="delete-item" data-artist-id="${artist.id}" data-room-id="${room.id}" data-item-id="${item.id}">x</button>
      </span>
    </div>
  `;
}

function renderNoteText(item) {
  return item.notes ? `<span class="item-note">${escapeHtml(item.notes)}</span>` : "";
}

function renderNoteForm(artist, room, item) {
  return `
    <form class="note-form" data-note-form data-artist-id="${artist.id}" data-room-id="${room.id}" data-item-id="${item.id}">
      <input name="notes" type="text" placeholder="Observações" value="${escapeHtml(item.notes ?? "")}" />
      <button class="ghost-button small-button" type="submit">Salvar</button>
    </form>
  `;
}

function renderShoppingTable(event) {
  if (!event) {
    els.shoppingTable.innerHTML = "";
    return;
  }

  const rows = getShoppingRows(event).filter((row) => {
    if (state.statusFilter === "done") return row.status === "Comprado";
    if (state.statusFilter === "pending") return row.status === "Pendente";
    return true;
  });

  if (rows.length === 0) {
    els.shoppingTable.innerHTML = `<tr><td class="empty-row" colspan="8">Nenhum item para mostrar.</td></tr>`;
    return;
  }

  els.shoppingTable.innerHTML = renderShoppingByStore(rows);
}

function renderShoppingByStore(rows) {
  return Object.entries(groupRowsByStore(rows))
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([store, storeRows]) => {
      const pendingRows = storeRows.filter((row) => row.status === "Pendente");
      const boughtRows = storeRows.filter((row) => row.status === "Comprado");
      return `
        <tr class="store-section-row">
          <td colspan="8">${escapeHtml(store)} <span>${storeRows.length}</span></td>
        </tr>
        ${[
          renderShoppingSection("Pendentes", pendingRows),
          renderShoppingSection("Comprados", boughtRows),
        ]
          .filter(Boolean)
          .join("")}
      `;
    })
    .join("");
}

function groupRowsByStore(rows) {
  return rows.reduce((acc, row) => {
    const store = row.store || "Sem local definido";
    acc[store] ??= [];
    acc[store].push(row);
    return acc;
  }, {});
}

function renderShoppingSection(title, rows) {
  if (rows.length === 0) return "";

  return `
    <tr class="shopping-section-row">
      <td colspan="8">${title} <span>${rows.length}</span></td>
    </tr>
    ${rows.map(renderShoppingRow).join("")}
  `;
}

function renderShoppingRow(row) {
  return `
    <tr>
      <td><span class="status-pill ${row.status === "Comprado" ? "done" : "pending"}">${row.status}</span></td>
      <td>
        <strong>${escapeHtml(row.item)}</strong>
        ${row.count > 1 ? `<span class="cell-detail">${row.count} pedidos consolidados</span>` : ""}
        ${renderEntryDetails(row)}
      </td>
      <td>${escapeHtml(row.quantity)}</td>
      <td>${escapeHtml(row.store)}</td>
      <td>${renderBuyerCell(row)}</td>
      <td>${renderPriceCell(row)}</td>
      <td>${escapeHtml(row.artist)}</td>
      <td>${escapeHtml(row.room)}</td>
    </tr>
  `;
}

function renderEntryDetails(row) {
  const entries = row.entries ?? [];
  const shouldShow = entries.length > 1 || entries.some((entry) => entry.notes);
  if (!shouldShow) return "";

  return `
    <details class="entry-details">
      <summary>Ver pedidos</summary>
      <div class="entry-list">
        ${entries
          .map(
            (entry) => `
              <div class="entry-detail">
                <strong>${escapeHtml(entry.artist)} / ${escapeHtml(entry.room)}</strong>
                <span>Qtd.: ${escapeHtml(entry.quantity || "-")}</span>
                <span>Obs.: ${escapeHtml(entry.notes || "-")}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderBuyerCell(row) {
  if (row.status === "Comprado") {
    return `
      <div class="buyer-cell">
        <strong>${escapeHtml(row.buyer)}</strong>
        <button class="ghost-button small-button" type="button" data-action="undo-purchase" data-row-key="${escapeHtml(row.rowKey)}">Desfazer</button>
      </div>
    `;
  }

  const event = getSelectedEvent();
  const buyers = event?.buyers ?? [];
  const options = buyers.map((buyer) => `<option value="${escapeHtml(buyer)}">${escapeHtml(buyer)}</option>`).join("");
  const disabled = buyers.length === 0 ? " disabled" : "";

  return `
    <form class="purchase-form" data-purchase-form data-row-key="${escapeHtml(row.rowKey)}">
      <select name="buyer" required${disabled}>
        <option value="">Responsável</option>
        ${options}
      </select>
      <input name="purchaseValue" type="text" inputmode="decimal" placeholder="Valor" />
      <input name="purchasedQuantity" type="text" inputmode="decimal" placeholder="Qtd. comprada" />
      <select name="purchaseValueMode" aria-label="Tipo do valor">
        <option value="total">Total</option>
        <option value="unit">Por item</option>
      </select>
      <button class="primary-button small-button" type="submit"${disabled}>Marcar</button>
    </form>
    <span class="print-only">Pendente</span>
  `;
}

function renderPriceCell(row) {
  if (row.status !== "Comprado") {
    return `<span class="muted">-</span>`;
  }

  return `
    <form class="price-form" data-price-form data-row-key="${escapeHtml(row.rowKey)}">
      <input name="purchaseValue" type="text" inputmode="decimal" placeholder="Valor" value="${escapeHtml(formatCurrencyInput(row.purchaseValueInput || row.purchaseValue))}" />
      <select name="purchaseValueMode" aria-label="Tipo do valor">
        <option value="total"${row.purchaseValueMode === "total" ? " selected" : ""}>Total</option>
        <option value="unit"${row.purchaseValueMode === "unit" ? " selected" : ""}>Por item</option>
      </select>
      <button class="ghost-button small-button" type="submit">Salvar</button>
    </form>
    ${row.purchaseValueMode === "unit" ? `<span class="cell-detail">Total: ${escapeHtml(formatCurrency(row.purchaseValue))}</span>` : ""}
    <span class="print-only">${escapeHtml(formatCurrency(row.purchaseValue))}</span>
  `;
}

function renderViews() {
  els.generalView.classList.toggle("hidden", state.activeView !== "general");
  els.dressingView.classList.toggle("hidden", state.activeView !== "dressing");
  els.shoppingView.classList.toggle("hidden", state.activeView !== "shopping");
  els.viewTabs.querySelectorAll("[data-view]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.activeView);
  });
}

function renderBuyers(event) {
  if (!event) {
    els.buyerList.innerHTML = "";
    return;
  }

  const buyers = event.buyers ?? [];
  if (buyers.length === 0) {
    els.buyerList.innerHTML = `<p class="muted">Cadastre responsáveis para liberar o dropdown do checklist.</p>`;
    return;
  }

  els.buyerList.innerHTML = buyers
    .map(
      (buyer) => `
        <span class="buyer-chip">
          ${escapeHtml(buyer)}
          <button type="button" title="Remover responsável" data-action="delete-buyer" data-buyer="${escapeHtml(buyer)}">x</button>
        </span>
      `,
    )
    .join("");
}

function renderStores(event) {
  if (!event) {
    els.storeList.innerHTML = "";
    return;
  }

  const stores = event.purchaseLocations ?? [];
  if (stores.length === 0) {
    els.storeList.innerHTML = `<p class="muted">Cadastre locais para preencher o dropdown dos itens.</p>`;
    return;
  }

  els.storeList.innerHTML = stores
    .map(
      (store) => `
        <span class="buyer-chip">
          ${escapeHtml(store)}
          <button type="button" title="Remover local" data-action="delete-store" data-store="${escapeHtml(store)}">x</button>
        </span>
      `,
    )
    .join("");
}

function renderArtistSummary(event) {
  if (!event) {
    els.artistSummaryList.innerHTML = "";
    return;
  }

  if (event.artists.length === 0) {
    els.artistSummaryList.innerHTML = `<p class="muted">Nenhum artista cadastrado neste evento.</p>`;
    return;
  }

  els.artistSummaryList.innerHTML = event.artists
    .map((artist) => {
      const total = getArtistTotal(event, artist);
      const pending = getArtistPendingCount(artist);
      return `
        <article class="artist-summary-card">
          <strong>${escapeHtml(artist.name)}</strong>
          <span>Total gasto: ${escapeHtml(formatCurrency(total))}</span>
          <span>${pending} ${pending === 1 ? "item pendente" : "itens pendentes"}</span>
        </article>
      `;
    })
    .join("");
}

function getArtistPendingCount(artist) {
  return artist.rooms.reduce(
    (total, room) => total + room.items.filter((item) => !(item.done && item.buyer)).length,
    0,
  );
}

function renderSummary(event) {
  const rows = event ? getShoppingRows(event) : [];
  const rooms = event ? event.artists.reduce((total, artist) => total + artist.rooms.length, 0) : 0;
  els.summaryArtists.textContent = event?.artists.length ?? 0;
  els.summaryRooms.textContent = rooms;
  els.summaryItems.textContent = rows.length;
  els.summaryPending.textContent = rows.filter((row) => row.status === "Pendente").length;
}

function renderBuyerBalance(event) {
  if (!event) {
    els.buyerBalance.innerHTML = "";
    return;
  }

  const boughtRows = getShoppingRows(event).filter((row) => row.status === "Comprado" && row.buyer);
  if (boughtRows.length === 0) {
    els.buyerBalance.innerHTML = `<p class="muted">Nenhuma compra marcada ainda.</p>`;
    return;
  }

  const grouped = boughtRows.reduce((acc, row) => {
    acc[row.buyer] ??= [];
    acc[row.buyer].push(row);
    return acc;
  }, {});

  els.buyerBalance.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(
      ([buyer, rows]) => `
        <article class="buyer-card">
          <div>
            <strong>${escapeHtml(buyer)}</strong>
            <span>${rows.length} ${rows.length === 1 ? "item comprado" : "itens comprados"} - ${escapeHtml(formatCurrency(sumValues(rows)))}</span>
          </div>
          <ul>
            ${rows
              .map((row) => `<li>${escapeHtml(row.item)}${row.quantity ? ` (${escapeHtml(row.quantity)})` : ""} - ${escapeHtml(formatCurrency(row.purchaseValue))} - ${escapeHtml(row.artist)} / ${escapeHtml(row.room)}</li>`)
              .join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function getSelectedEvent() {
  return window.getSelectedEventFromState?.(state) ?? (state.events.find((event) => event.id === state.selectedEventId) || null);
}

function confirmDelete(message) {
  return window.confirm(`${message}\n\nEsta ação não pode ser desfeita.`);
}

function syncSelectedArtist() {
  window.syncSelectedArtistFromState?.(state) ?? (() => {
    const event = getSelectedEvent();
    if (!event || event.artists.length === 0) {
      state.selectedArtistId = null;
      return;
    }

    if (!event.artists.some((artist) => artist.id === state.selectedArtistId)) {
      state.selectedArtistId = event.artists[0].id;
    }
  })();
}

function findItemsByShoppingRow(event, rowKey) {
  return window.findItemsByShoppingRowFromRows?.(event, rowKey) ?? (() => {
    const row = getShoppingRows(event).find((item) => item.rowKey === rowKey);
    return row?.rawItems ?? [];
  })();
}

function findItemByIds(event, ids) {
  return window.findItemByIdsFromRows?.(event, ids) ?? (() => {
    const artist = event.artists.find((item) => item.id === ids.artistId);
    const room = artist?.rooms.find((item) => item.id === ids.roomId);
    return room?.items.find((item) => item.id === ids.itemId) || null;
  })();
}

function findRoomByIds(event, ids) {
  return window.findRoomByIdsFromRows?.(event, ids) ?? (() => {
    const artist = event.artists.find((item) => item.id === ids.artistId);
    return artist?.rooms.find((item) => item.id === ids.roomId) || null;
  })();
}

function splitPendingRowForPurchase(event, row, requestedQuantity) {
  return window.splitPendingRowForPurchaseFromRows?.(event, row, requestedQuantity, (artistId) => {
    state.selectedArtistId = artistId;
  }) ?? (() => {
    const rowQuantity = sumNumericQuantities(row.rawRows.map((item) => item.quantity));
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || !Number.isFinite(rowQuantity) || requestedQuantity >= rowQuantity) {
      if (Number.isFinite(requestedQuantity) && Number.isFinite(rowQuantity) && requestedQuantity > rowQuantity) {
        const extraItem = createExtraItem(event, row, requestedQuantity - rowQuantity, "Comprado acima do pedido");
        return [...row.rawItems, extraItem];
      }
      return row.rawItems;
    }

    const itemsToBuy = [];
    let remaining = requestedQuantity;

    for (const entry of row.rawRows) {
      if (remaining <= 0) break;

      const quantity = parseQuantity(entry.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return row.rawItems;

      if (remaining >= quantity) {
        itemsToBuy.push(entry.rawItem);
        remaining -= quantity;
        continue;
      }

      const room = findRoomByIds(event, entry);
      if (!room) return row.rawItems;

      const boughtItem = {
        ...entry.rawItem,
        id: createId(),
        quantity: formatQuantity(remaining),
        done: false,
        buyer: "",
        purchaseValue: "",
        purchaseValueInput: "",
        purchaseValueMode: "total",
      };

      entry.rawItem.quantity = formatQuantity(quantity - remaining);
      const index = room.items.findIndex((item) => item.id === entry.itemId);
      room.items.splice(index + 1, 0, boughtItem);
      itemsToBuy.push(boughtItem);
      remaining = 0;
    }

    return itemsToBuy;
  })();
}

function createExtraItem(event, row, quantity, notes) {
  return window.createExtraItemFromRows?.(event, row, quantity, notes, (artistId) => {
    state.selectedArtistId = artistId;
  }) ?? (() => {
    const artist = getOrCreateExtraArtist(event);
    const room = getOrCreateExtraRoom(artist);
    const item = {
      id: createId(),
      name: row.item,
      quantity: formatQuantity(quantity),
      store: row.store,
      notes,
      buyer: "",
      purchaseValue: "",
      purchaseValueInput: "",
      purchaseValueMode: "total",
      done: false,
    };
    room.items.push(item);
    state.selectedArtistId = artist.id;
    return item;
  })();
}

function getOrCreateExtraArtist(event) {
  return window.getOrCreateExtraArtistFromRows?.(event) ?? (() => {
    let artist = event.artists.find((item) => item.name.toLowerCase() === "extra");
    if (!artist) {
      artist = { id: createId(), name: "Extra", rooms: [] };
      event.artists.push(artist);
    }
    return artist;
  })();
}

function getOrCreateExtraRoom(artist) {
  return window.getOrCreateExtraRoomFromRows?.(artist) ?? (() => {
    let room = artist.rooms.find((item) => item.name.toLowerCase() === "extra");
    if (!room) {
      room = { id: createId(), name: "Extra", items: [] };
      artist.rooms.push(room);
    }
    return room;
  })();
}

function getArtistTotal(event, artist) {
  return window.getArtistTotalFromRows?.(event, artist) ?? artist.rooms.reduce((total, room) => total + getRoomTotal(event, artist, room), 0);
}

function getRoomTotal(event, artist, room) {
  return window.getRoomTotalFromRows?.(event, artist, room) ?? room.items.reduce((total, item) => total + getAllocatedItemValue(event, item), 0);
}

function getAllocatedItemValue(event, item) {
  return window.getAllocatedItemValueFromRows?.(event, item) ?? (() => {
    const total = Number(item.purchaseValue);
    if (!Number.isFinite(total) || total <= 0) return 0;

    const itemRow = getRows(event).find((row) => row.rawItem === item);
    if (!itemRow) return total;

    const shoppingGroupKey = getShoppingGroupKey(itemRow);
    const groupRows = getRows(event).filter((row) => getShoppingGroupKey(row) === shoppingGroupKey);
    if (groupRows.length <= 1) return total;

    const quantities = groupRows.map((row) => Number(String(row.quantity ?? "").replace(",", ".")));
    const currentQuantity = Number(String(item.quantity ?? "").replace(",", "."));
    const canUseQuantity = quantities.length > 0 && quantities.every((value) => Number.isFinite(value)) && Number.isFinite(currentQuantity);

    if (canUseQuantity) {
      const quantityTotal = quantities.reduce((sum, value) => sum + value, 0);
      if (quantityTotal > 0) return total * (currentQuantity / quantityTotal);
    }

    return total / groupRows.length;
  })();
}

function getRows(event) {
  return window.getRowsFromRowsModule?.(event) ?? event.artists.flatMap((artist) =>
    artist.rooms.flatMap((room) =>
      room.items.map((item) => ({
        artistId: artist.id,
        roomId: room.id,
        itemId: item.id,
        groupKey: normalizeItemName(item.name),
        rawItem: item,
        event: event.name,
        date: formatDate(event.date),
        location: event.location,
        artist: artist.name,
        room: room.name,
        item: item.name,
        quantity: item.quantity,
        store: item.store,
        notes: item.notes ?? "",
        buyer: item.buyer,
        purchaseValue: item.purchaseValue ?? "",
        purchaseValueInput: item.purchaseValueInput ?? item.purchaseValue ?? "",
        purchaseValueMode: item.purchaseValueMode ?? "total",
        status: item.done && item.buyer ? "Comprado" : "Pendente",
      })),
    ),
  );
}

function getShoppingRows(event) {
  return window.getShoppingRowsFromRows?.(event) ?? (() => {
    const groups = getRows(event).reduce((acc, row) => {
      const key = getShoppingGroupKey(row);
      acc[key] ??= [];
      acc[key].push(row);
      return acc;
    }, {});

    return Object.entries(groups)
      .map((rows) => {
        const [rowKey, groupedRows] = rows;
        const firstRow = groupedRows[0];
        const buyers = uniqueValues(groupedRows.map((row) => row.buyer).filter(Boolean));
        const purchaseValues = uniqueValues(groupedRows.map((row) => row.purchaseValue).filter((value) => value !== ""));
        const purchaseValueInputs = uniqueValues(groupedRows.map((row) => row.purchaseValueInput).filter((value) => value !== ""));
        const purchaseValueModes = uniqueValues(groupedRows.map((row) => row.purchaseValueMode).filter(Boolean));
        const bought = firstRow.status === "Comprado";
        return {
          ...firstRow,
          rowKey,
          rawRows: groupedRows,
          rawItems: groupedRows.map((row) => row.rawItem),
          artist: uniqueValues(groupedRows.map((row) => row.artist)).join(", "),
          room: uniqueValues(groupedRows.map((row) => `${row.artist} / ${row.room}`)).join("; "),
          quantity: combineQuantities(groupedRows.map((row) => row.quantity)),
          store: uniqueValues(groupedRows.map((row) => row.store).filter(Boolean)).join(" / "),
          notes: uniqueValues(groupedRows.map((row) => row.notes).filter(Boolean)).join(" / "),
          entries: groupedRows.map((row) => ({
            artist: row.artist,
            room: row.room,
            quantity: row.quantity,
            notes: row.notes,
          })),
          buyer: bought ? buyers[0] : "",
          purchaseValue: purchaseValues[0] ?? "",
          purchaseValueInput: purchaseValueInputs[0] ?? purchaseValues[0] ?? "",
          purchaseValueMode: purchaseValueModes[0] ?? "total",
          status: bought ? "Comprado" : "Pendente",
          count: groupedRows.length,
        };
      })
      .sort((a, b) => a.item.localeCompare(b.item, "pt-BR") || a.status.localeCompare(b.status, "pt-BR"));
  })();
}

function getShoppingGroupKey(row) {
  return window.getShoppingGroupKeyFromRows?.(row) ?? (() => {
    if (row.status === "Pendente") {
      return `${row.groupKey}::pending`;
    }

    return [
      row.groupKey,
      "bought",
      normalizeItemName(row.buyer),
      row.purchaseValue || "0",
      row.purchaseValueInput || row.purchaseValue || "0",
      row.purchaseValueMode || "total",
    ].join("::");
  })();
}

function persistAndRender() {
  render();
  syncController?.scheduleRemoteSync();
}

function loadEvents() {
  return [];
}

function normalizeEvents(events) {
  return window.normalizeEventsFromState?.(events) ?? events.map((event) => ({
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

function collectBuyers(event) {
  return window.collectBuyersFromState?.(event) ?? (() => {
    const buyers = new Set();
    (event.artists ?? []).forEach((artist) => {
      (artist.rooms ?? []).forEach((room) => {
        (room.items ?? []).forEach((item) => {
          if (item.buyer) buyers.add(item.buyer);
        });
      });
    });
    return [...buyers].sort((a, b) => a.localeCompare(b, "pt-BR"));
  })();
}

function collectPurchaseLocations(event) {
  return window.collectPurchaseLocationsFromState?.(event) ?? (() => {
    const stores = new Set();
    (event.artists ?? []).forEach((artist) => {
      (artist.rooms ?? []).forEach((room) => {
        (room.items ?? []).forEach((item) => {
          if (item.store) stores.add(item.store);
        });
      });
    });
    return [...stores].sort((a, b) => a.localeCompare(b, "pt-BR"));
  })();
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeItemName(value) {
  const text = String(value ?? "");
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() || text.trim().toLowerCase();
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function combineQuantities(values) {
  const quantities = uniqueValues(values);
  if (quantities.length === 0) return "";

  const numbers = quantities.map((value) => Number(value.replace(",", ".")));
  if (numbers.every((value) => Number.isFinite(value))) {
    return String(numbers.reduce((total, value) => total + value, 0)).replace(".", ",");
  }

  return quantities.join(" + ");
}

function parseQuantity(value) {
  return window.parseQuantityFromRows?.(value) ?? (() => {
    const text = String(value ?? "").trim();
    if (!text) return NaN;
    const number = Number(text.replace(",", "."));
    return Number.isFinite(number) ? number : NaN;
  })();
}

function formatQuantity(value) {
  return window.formatQuantityFromRows?.(value) ?? (() => {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3))).replace(".", ",");
  })();
}

function parseCurrency(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

function calculatePurchaseValue(event, rowKey, rawValue, mode, quantityOverride = NaN) {
  return window.calculatePurchaseValueFromRows?.(event, rowKey, rawValue, mode, quantityOverride) ?? (() => {
    const parsed = parseCurrency(rawValue);
    if (parsed === "") return "";

    if (mode !== "unit") return parsed;

    const quantity = Number.isFinite(quantityOverride)
      ? quantityOverride
      : sumNumericQuantities(
          getShoppingRows(event)
            .find((row) => row.rowKey === rowKey)
            ?.rawRows.map((row) => row.quantity) ?? [],
        );

    if (!Number.isFinite(quantity)) return parsed;
    return (Number(parsed) * quantity).toFixed(2);
  })();
}

function sumNumericQuantities(values) {
  return window.sumNumericQuantitiesFromRows?.(values) ?? (() => {
    const numbers = values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .map(parseQuantity);

    if (numbers.length === 0 || numbers.some((value) => !Number.isFinite(value))) return NaN;
    return numbers.reduce((total, value) => total + value, 0);
  })();
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "R$ 0,00";
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyInput(value) {
  if (value === "" || value == null) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toFixed(2).replace(".", ",");
}

function sumValues(rows) {
  return rows.reduce((total, row) => total + (Number(row.purchaseValue) || 0), 0);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toCsv(rows) {
  const headers = ["Evento", "Data", "Local", "Artista", "Camarim", "Item", "Quantidade", "Onde comprar", "Observações", "Responsável", "Valor", "Tipo do valor", "Status"];
  const values = rows.map((row) => [row.event, row.date, row.location, row.artist, row.room, row.item, row.quantity, row.store, row.notes, row.buyer, formatCurrency(row.purchaseValue), formatValueMode(row.purchaseValueMode), row.status]);
  return [headers, ...values].map((line) => line.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toExcelHtml(event, rows) {
  const headers = ["Evento", "Data", "Local", "Artista", "Camarim", "Item", "Quantidade", "Onde comprar", "Observações", "Responsável", "Valor", "Tipo do valor", "Status"];
  const balance = rows.filter((row) => row.status === "Comprado" && row.buyer);
  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.event)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.location)}</td>
          <td>${escapeHtml(row.artist)}</td>
          <td>${escapeHtml(row.room)}</td>
          <td>${escapeHtml(row.item)}</td>
          <td>${escapeHtml(row.quantity)}</td>
          <td>${escapeHtml(row.store)}</td>
          <td>${escapeHtml(row.notes)}</td>
          <td>${escapeHtml(row.buyer)}</td>
          <td>${escapeHtml(formatCurrency(row.purchaseValue))}</td>
          <td>${escapeHtml(formatValueMode(row.purchaseValueMode))}</td>
          <td>${escapeHtml(row.status)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <h1>${escapeHtml(event.name)}</h1>
        <table border="1">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody>
        </table>
        <h2>Compras por responsável</h2>
        <table border="1">
          <thead><tr><th>Responsável</th><th>Item</th><th>Quantidade</th><th>Valor</th><th>Observações</th><th>Artista</th><th>Camarim</th></tr></thead>
          <tbody>
            ${balance
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.buyer)}</td>
                    <td>${escapeHtml(row.item)}</td>
                    <td>${escapeHtml(row.quantity)}</td>
                    <td>${escapeHtml(formatCurrency(row.purchaseValue))}</td>
                    <td>${escapeHtml(row.notes)}</td>
                    <td>${escapeHtml(row.artist)}</td>
                    <td>${escapeHtml(row.room)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function formatValueMode(mode) {
  return mode === "unit" ? "Por item" : "Total";
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

