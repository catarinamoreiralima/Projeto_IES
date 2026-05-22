import { escapeHtml, formatCurrency } from './utils.js';

export function renderApp(state, els, helpers) {
  const selected = helpers.getSelectedEvent(state);
  helpers.syncSelectedArtist(state);
  renderEvents(state, els);
  renderHeader(selected, els);
  renderViews(state, els);
  renderArtists(state, els, selected, helpers);
  renderBuyers(selected, els);
  renderStores(selected, els);
  renderArtistSummary(selected, els, helpers);
  renderShoppingTable(state, els, selected, helpers);
  renderSummary(selected, els, helpers);
  renderBuyerBalance(selected, els, helpers);
}

export function renderEvents(state, els) {
  els.eventList.innerHTML = state.events
    .map((event) => {
      const active = event.id === state.selectedEventId ? " active" : "";
      const detail = [formatDate(event.date), event.location].filter(Boolean).join(" - ") || "Sem data/local";
      return `
        <div class="event-row${active}" draggable="true" data-event-row-id="${event.id}">
          <button class="event-button" type="button" data-event-id="${event.id}">
            <strong>${escapeHtml(event.name)}</strong>
            <span>${escapeHtml(detail)}</span>
          </button>
        </div>
      `;
    })
    .join("");
}

export function renderHeader(event, els) {
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
}

export function renderViews(state, els) {
  els.generalView.classList.toggle("hidden", state.activeView !== "general");
  els.dressingView.classList.toggle("hidden", state.activeView !== "dressing");
  els.shoppingView.classList.toggle("hidden", state.activeView !== "shopping");
  els.viewTabs.querySelectorAll("[data-view]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === state.activeView);
  });
}

export function renderArtists(state, els, event, helpers) {
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
  els.artistList.innerHTML = renderArtist(event, selectedArtist, helpers);
}

export function renderArtist(event, artist, helpers) {
  const rooms = artist.rooms.length
    ? artist.rooms.map((room) => renderRoom(event, artist, room, helpers)).join("")
    : `<p class="muted">Nenhum camarim cadastrado para este artista.</p>`;
  const artistTotal = helpers.getArtistTotal(event, artist);

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
}

export function renderRoom(event, artist, room, helpers) {
  const items = room.items.length
    ? room.items.map((item) => renderItem(event, artist, room, item, helpers)).join("")
    : `<p class="muted">Sem itens ainda.</p>`;
  const roomTotal = helpers.getRoomTotal(event, artist, room);

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
        ${renderStoreSelect(event, helpers)}
        <input name="notes" type="text" placeholder="Observações" />
        <button class="primary-button" type="submit">Adicionar</button>
      </form>
      <div>${items}</div>
    </div>
  `;
}

export function renderStoreSelect(event, helpers) {
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

export function renderStoreOptions(stores) {
  return stores.map((store) => `<option value="${escapeHtml(store)}">${escapeHtml(store)}</option>`).join("");
}

export function renderItem(event, artist, room, item, helpers) {
  const isBought = item.done && item.buyer;
  const allocatedValue = helpers.getAllocatedItemValue(event, item);
  const isEditingNote = helpers.isEditingNote?.(item.id) ?? false;
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

export function renderNoteText(item) {
  return item.notes ? `<span class="item-note">${escapeHtml(item.notes)}</span>` : "";
}

export function renderNoteForm(artist, room, item) {
  return `
    <form class="note-form" data-note-form data-artist-id="${artist.id}" data-room-id="${room.id}" data-item-id="${item.id}">
      <input name="notes" type="text" placeholder="Observações" value="${escapeHtml(item.notes ?? "")}" />
      <button class="ghost-button small-button" type="submit">Salvar</button>
    </form>
  `;
}

export function renderShoppingTable(state, els, event, helpers) {
  if (!event) {
    els.shoppingTable.innerHTML = "";
    return;
  }

  const rows = helpers.getShoppingRows(event).filter((row) => {
    if (state.statusFilter === "done") return row.status === "Comprado";
    if (state.statusFilter === "pending") return row.status === "Pendente";
    return true;
  });

  if (rows.length === 0) {
    els.shoppingTable.innerHTML = `<tr><td class="empty-row" colspan="8">Nenhum item para mostrar.</td></tr>`;
    return;
  }

  els.shoppingTable.innerHTML = renderShoppingByStore(rows, helpers);
}

export function renderShoppingByStore(rows, helpers) {
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
          renderShoppingSection("Pendentes", pendingRows, helpers),
          renderShoppingSection("Comprados", boughtRows, helpers),
        ]
          .filter(Boolean)
          .join("")}
      `;
    })
    .join("");
}

export function groupRowsByStore(rows) {
  return rows.reduce((acc, row) => {
    const store = row.store || "Sem local definido";
    acc[store] ??= [];
    acc[store].push(row);
    return acc;
  }, {});
}

export function renderShoppingSection(title, rows, helpers) {
  if (rows.length === 0) return "";

  return `
    <tr class="shopping-section-row">
      <td colspan="8">${title} <span>${rows.length}</span></td>
    </tr>
    ${rows.map((row) => renderShoppingRow(row, helpers)).join("")}
  `;
}

export function renderShoppingRow(row, helpers) {
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
      <td>${renderBuyerCell(row, helpers)}</td>
      <td>${renderPriceCell(row)}</td>
      <td>${escapeHtml(row.artist)}</td>
      <td>${escapeHtml(row.room)}</td>
    </tr>
  `;
}

export function renderEntryDetails(row) {
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

export function renderBuyerCell(row, helpers) {
  if (row.status === "Comprado") {
    return `
      <div class="buyer-cell">
        <strong>${escapeHtml(row.buyer)}</strong>
        <button class="ghost-button small-button" type="button" data-action="undo-purchase" data-row-key="${escapeHtml(row.rowKey)}">Desfazer</button>
      </div>
    `;
  }

  const event = helpers.getSelectedEvent(helpers.state);
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

export function renderPriceCell(row) {
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

export function renderBuyers(event, els) {
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

export function renderStores(event, els) {
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

export function renderArtistSummary(event, els, helpers) {
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
      const total = helpers.getArtistTotal(event, artist);
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

export function getArtistPendingCount(artist) {
  return artist.rooms.reduce(
    (total, room) => total + room.items.filter((item) => !(item.done && item.buyer)).length,
    0,
  );
}

export function renderSummary(event, els, helpers) {
  const rows = event ? helpers.getShoppingRows(event) : [];
  const rooms = event ? event.artists.reduce((total, artist) => total + artist.rooms.length, 0) : 0;
  els.summaryArtists.textContent = event?.artists.length ?? 0;
  els.summaryRooms.textContent = rooms;
  els.summaryItems.textContent = rows.length;
  els.summaryPending.textContent = rows.filter((row) => row.status === "Pendente").length;
}

export function renderBuyerBalance(event, els, helpers) {
  if (!event) {
    els.buyerBalance.innerHTML = "";
    return;
  }

  const boughtRows = helpers.getShoppingRows(event).filter((row) => row.status === "Comprado" && row.buyer);
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

export function sumValues(rows) {
  return rows.reduce((total, row) => total + Number(row.purchaseValue || 0), 0);
}

export function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatCurrencyInput(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.replace(".", ",");
}
