export function attachDomHandlers({ state, els, actions }) {
  function getSafeEmailRedirectUrl() {
    try {
      const url = new URL(window.location.href);
      // Supabase redirect checks are often strict with IPv6/unspecified hosts.
      if (url.hostname === "::1" || url.hostname === "[::]" || url.hostname === "0.0.0.0") {
        url.hostname = "localhost";
      }
      return url.toString();
    } catch {
      return "http://localhost:8000";
    }
  }

  let cooldownUntil = 0;
  function startCooldown(seconds) {
    cooldownUntil = Date.now() + Math.max(5, Number(seconds) || 60) * 1000;
    updateCooldownUi();
  }

  let cooldownInterval = null;
  function updateCooldownUi() {
    clearInterval(cooldownInterval);
    const until = cooldownUntil;
    if (!until || until <= Date.now()) {
      // clear state
      setSyncStatus('');
      // re-enable auth form buttons if they were disabled
      try { els.authForm.querySelectorAll('button, input[type=submit]').forEach(el => el.disabled = false); } catch {}
      cooldownUntil = 0;
      return;
    }

    // disable form buttons
    try { els.authForm.querySelectorAll('button, input[type=submit]').forEach(el => el.disabled = true); } catch {}

    cooldownInterval = setInterval(() => {
      const now = Date.now();
      const left = Math.ceil((cooldownUntil - now) / 1000);
      if (left <= 0) {
        clearInterval(cooldownInterval);
        cooldownUntil = 0;
        updateCooldownUi();
        return;
      }
      setSyncStatus(`Limite de envio atingido. Tente novamente em ${left}s.`);
    }, 1000);
  }

  const {
    getSupabaseClient,
    getCurrentUser,
    setCurrentUser,
    setSyncStatus,
    updateAuthUi,
    syncRemoteData,
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
  } = actions;

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;

    const email = els.authEmail.value.trim();
    if (!email) return;
    const password = String(els.authPassword?.value || "");
    const authMode = event.submitter?.value || "password-login";

    if (authMode === "password-login") {
      if (!password) {
        setSyncStatus("Informe a senha para entrar.");
        return;
      }

      setSyncStatus("Entrando...");
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        const message = String(error.message || "");
        setSyncStatus(`Erro ao entrar: ${message}`);
        return;
      }

      setSyncStatus("Login realizado com sucesso.");
      return;
    }

    if (authMode === "password-reset") {
      const redirectUrl = getSafeEmailRedirectUrl();
      setSyncStatus("Enviando recuperação de senha...");
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        setSyncStatus(`Erro ao enviar recuperação: ${error.message}`);
        return;
      }

      setSyncStatus("Email de recuperação enviado. Confira caixa de entrada/spam.");
      return;
    }

    setSyncStatus("Enviando link de acesso...");

    const redirectUrl = getSafeEmailRedirectUrl();
    let { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    // Fallback for projects that reject redirect URLs not explicitly allow-listed.
    if (error) {
      const message = String(error.message || "").toLowerCase();
      const looksLikeRedirectIssue = message.includes("redirect") || message.includes("invalid") || message.includes("url");
      if (looksLikeRedirectIssue) {
        ({ error } = await supabaseClient.auth.signInWithOtp({ email }));
      }
    }

    if (error) {
      console.error("Supabase OTP error", error);
      // Handle rate limit specifically
      if (error.status === 429) {
        // start a short cooldown (60s) to prevent hammering the endpoint
        startCooldown(60);
        setSyncStatus('Limite de envio atingido. Tente novamente em 60s.');
      } else {
        setSyncStatus(`Erro ao enviar link: ${error.message}${error.status ? ` (status ${error.status})` : ""}`);
      }
      return;
    }

    setSyncStatus("Link enviado. Confira caixa de entrada/spam. Se não chegar, valide Auth > Email no Supabase.");
  });

  els.signOut.addEventListener("click", async () => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });

  els.syncNow.addEventListener("click", async () => {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      setSyncStatus("Supabase não carregou no navegador.");
      return;
    }

    if (!getCurrentUser()) {
      const { data } = await supabaseClient.auth.getSession();
      setCurrentUser(data.session?.user ?? null);
      updateAuthUi();
    }

    if (!getCurrentUser()) {
      setSyncStatus("Você não está logado. Faça login antes de sincronizar.");
      return;
    }

    await syncRemoteData();
  });

  els.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const supabaseClient = getSupabaseClient();
    const currentUser = getCurrentUser();
    if (!supabaseClient || !currentUser) {
      setSyncStatus("Você precisa estar conectado ao Supabase para criar um evento.");
      return;
    }

    const newEvent = {
      id: createId(),
      name: els.eventName.value.trim(),
      date: els.eventDate.value,
      location: els.eventLocation.value.trim(),
      buyers: [],
      purchaseLocations: [],
      artists: [],
    };

    if (!newEvent.name) return;
    state.events.unshift(newEvent);
    state.selectedEventId = newEvent.id;
    els.eventForm.reset();
    persistAndRender();
  });

  els.artistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = getSelectedEvent();
    const name = els.artistName.value.trim();
    if (!selected || !name) return;

    selected.artists.push({ id: createId(), name, rooms: [] });
    state.selectedArtistId = selected.artists[selected.artists.length - 1].id;
    els.artistForm.reset();
    persistAndRender();
  });

  els.buyerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = getSelectedEvent();
    const name = els.buyerName.value.trim();
    if (!selected || !name) return;

    selected.buyers ??= [];
    if (!selected.buyers.some((buyer) => buyer.toLowerCase() === name.toLowerCase())) {
      selected.buyers.push(name);
      selected.buyers.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    els.buyerForm.reset();
    persistAndRender();
  });

  els.storeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = getSelectedEvent();
    const name = els.storeName.value.trim();
    if (!selected || !name) return;

    selected.purchaseLocations ??= [];
    if (!selected.purchaseLocations.some((store) => store.toLowerCase() === name.toLowerCase())) {
      selected.purchaseLocations.push(name);
      selected.purchaseLocations.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    els.storeForm.reset();
    persistAndRender();
  });

  els.statusFilter.addEventListener("change", () => {
    state.statusFilter = els.statusFilter.value;
    render();
  });

  els.viewTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (!tab) return;
    state.activeView = tab.dataset.view;
    render();
  });

  els.eventList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-id]");
    if (!button) return;
    state.selectedEventId = button.dataset.eventId;
    syncSelectedArtist();
    render();
  });

  els.eventList.addEventListener("dragstart", (event) => {
    const row = event.target.closest("[data-event-row-id]");
    if (!row) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.dataset.eventRowId);
    row.classList.add("dragging");
  });

  els.eventList.addEventListener("dragover", (event) => {
    const row = event.target.closest("[data-event-row-id]");
    if (!row) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    els.eventList.querySelectorAll(".event-row.drag-over").forEach((item) => item.classList.remove("drag-over"));
    row.classList.add("drag-over");
  });

  els.eventList.addEventListener("dragleave", (event) => {
    const row = event.target.closest("[data-event-row-id]");
    if (row) row.classList.remove("drag-over");
  });

  els.eventList.addEventListener("drop", (event) => {
    const row = event.target.closest("[data-event-row-id]");
    const draggedId = event.dataTransfer.getData("text/plain");
    if (!row || !draggedId || draggedId === row.dataset.eventRowId) return;

    event.preventDefault();
    moveEventTo(draggedId, row.dataset.eventRowId);
    clearEventDragState();
  });

  els.eventList.addEventListener("dragend", () => {
    clearEventDragState();
  });

  els.workspace.addEventListener("click", (event) => {
    const selected = getSelectedEvent();
    const action = event.target.closest("[data-action]");
    if (!selected || !action) return;

    if (action.dataset.action === "delete-event") {
      if (!confirmDelete(`Excluir o evento "${selected.name}"?`)) return;
      state.events = state.events.filter((item) => item.id !== selected.id);
      state.selectedEventId = state.events[0]?.id ?? null;
      state.selectedArtistId = null;
      syncSelectedArtist();
      persistAndRender();
    }
  });

  els.artistTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-artist-id]");
    if (!tab) return;
    state.selectedArtistId = tab.dataset.artistId;
    render();
  });

  els.buyerList.addEventListener("click", (event) => {
    const selected = getSelectedEvent();
    const action = event.target.closest("[data-action]");
    if (!selected || !action) return;

    if (action.dataset.action === "delete-buyer") {
      if (!confirmDelete(`Remover o responsável "${action.dataset.buyer}"?`)) return;
      selected.buyers = selected.buyers.filter((buyer) => buyer !== action.dataset.buyer);
      persistAndRender();
    }
  });

  els.storeList.addEventListener("click", (event) => {
    const selected = getSelectedEvent();
    const action = event.target.closest("[data-action]");
    if (!selected || !action) return;

    if (action.dataset.action === "delete-store") {
      if (!confirmDelete(`Remover o local de compra "${action.dataset.store}"?`)) return;
      selected.purchaseLocations = selected.purchaseLocations.filter((store) => store !== action.dataset.store);
      persistAndRender();
    }
  });

  els.artistList.addEventListener("click", (event) => {
    const selected = getSelectedEvent();
    if (!selected) return;

    const action = event.target.closest("[data-action]");
    if (!action) return;

    const artist = selected.artists.find((item) => item.id === action.dataset.artistId);
    const room = artist?.rooms.find((item) => item.id === action.dataset.roomId);

    if (action.dataset.action === "delete-artist" && artist) {
      if (!confirmDelete(`Excluir o artista "${artist.name}"?`)) return;
      selected.artists = selected.artists.filter((item) => item.id !== artist.id);
      syncSelectedArtist();
    }

    if (action.dataset.action === "delete-room" && artist && room) {
      if (!confirmDelete(`Excluir o camarim "${room.name}"?`)) return;
      artist.rooms = artist.rooms.filter((item) => item.id !== room.id);
    }

    if (action.dataset.action === "delete-item" && room) {
      const item = room.items.find((entry) => entry.id === action.dataset.itemId);
      if (!confirmDelete(`Excluir o item "${item?.name ?? "selecionado"}"?`)) return;
      room.items = room.items.filter((item) => item.id !== action.dataset.itemId);
      if (state.editingNoteItemId === action.dataset.itemId) state.editingNoteItemId = null;
    }

    if (action.dataset.action === "edit-note" && room) {
      state.editingNoteItemId = state.editingNoteItemId === action.dataset.itemId ? null : action.dataset.itemId;
    }

    persistAndRender();
  });

  els.shoppingTable.addEventListener("click", (event) => {
    const selected = getSelectedEvent();
    const action = event.target.closest("[data-action]");
    if (!selected || !action) return;

    if (action.dataset.action === "undo-purchase") {
      const items = findItemsByShoppingRow(selected, action.dataset.rowKey);
      items.forEach((item) => {
        item.done = false;
        item.buyer = "";
        item.purchaseValue = "";
        item.purchaseValueInput = "";
        item.purchaseValueMode = "total";
      });
      persistAndRender();
    }
  });

  els.shoppingTable.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = getSelectedEvent();
    const form = event.target.closest("[data-purchase-form]");
    const priceForm = event.target.closest("[data-price-form]");
    if (!selected || (!form && !priceForm)) return;

    if (priceForm) {
      const items = findItemsByShoppingRow(selected, priceForm.dataset.rowKey);
      const data = new FormData(priceForm);
      const purchaseValueInput = String(data.get("purchaseValue") || "").trim();
      const purchaseValueMode = String(data.get("purchaseValueMode") || "total");
      const purchaseValue = calculatePurchaseValue(selected, priceForm.dataset.rowKey, data.get("purchaseValue"), purchaseValueMode);
      if (items.length === 0) return;

      items.forEach((item) => {
        item.purchaseValue = purchaseValue;
        item.purchaseValueInput = purchaseValueInput;
        item.purchaseValueMode = purchaseValueMode;
      });
      persistAndRender();
      return;
    }

    const row = actions.getShoppingRows(selected).find((item) => item.rowKey === form.dataset.rowKey);
    const data = new FormData(form);
    const buyer = String(data.get("buyer") || "").trim();
    const purchaseValueInput = String(data.get("purchaseValue") || "").trim();
    const purchaseValueMode = String(data.get("purchaseValueMode") || "total");
    const purchasedQuantity = parseQuantity(data.get("purchasedQuantity"));
    const purchaseValue = calculatePurchaseValue(selected, form.dataset.rowKey, data.get("purchaseValue"), purchaseValueMode, purchasedQuantity);
    if (!row || !buyer) return;

    const itemsToBuy = splitPendingRowForPurchase(selected, row, purchasedQuantity, (artistId) => {
      state.selectedArtistId = artistId;
    });
    if (itemsToBuy.length === 0) return;

    itemsToBuy.forEach((item) => {
      item.done = true;
      item.buyer = buyer;
      item.purchaseValue = purchaseValue;
      item.purchaseValueInput = purchaseValueInput;
      item.purchaseValueMode = purchaseValueMode;
    });
    persistAndRender();
  });

  els.artistList.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = getSelectedEvent();
    const itemForm = event.target.closest("[data-item-form]");
    const roomForm = event.target.closest("[data-room-form]");
    const noteForm = event.target.closest("[data-note-form]");
    if (!selected || (!itemForm && !roomForm && !noteForm)) return;

    if (roomForm) {
      const artist = selected.artists.find((item) => item.id === roomForm.dataset.artistId);
      const data = new FormData(roomForm);
      const name = String(data.get("room") || "").trim();
      if (artist && name) {
        artist.rooms.push({ id: createId(), name, items: [] });
        roomForm.reset();
        persistAndRender();
      }
      return;
    }

    if (noteForm) {
      const item = findItemByIds(selected, noteForm.dataset);
      const data = new FormData(noteForm);
      if (item) {
        item.notes = String(data.get("notes") || "").trim();
        state.editingNoteItemId = null;
        persistAndRender();
      }
      return;
    }

    const artist = selected.artists.find((item) => item.id === itemForm.dataset.artistId);
    const room = artist?.rooms.find((item) => item.id === itemForm.dataset.roomId);
    if (!artist || !room) return;

    const data = new FormData(itemForm);
    const item = {
      id: createId(),
      name: String(data.get("name") || "").trim(),
      quantity: String(data.get("quantity") || "").trim(),
      store: String(data.get("store") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
      buyer: "",
      done: false,
    };

    if (!item.name) return;
    room.items.push(item);
    itemForm.reset();
    persistAndRender();
  });

  els.exportCsv.addEventListener("click", () => {
    const selected = getSelectedEvent();
    if (!selected) return;
    downloadFile(`${slugify(selected.name)}-compras.csv`, toCsv(actions.getShoppingRows(selected)), "text/csv;charset=utf-8");
  });

  els.exportXls.addEventListener("click", () => {
    const selected = getSelectedEvent();
    if (!selected) return;
    downloadFile(`${slugify(selected.name)}-compras.xls`, toExcelHtml(selected, actions.getShoppingRows(selected)), "application/vnd.ms-excel");
  });

  els.exportPdf.addEventListener("click", () => {
    state.activeView = "shopping";
    render();
    setTimeout(() => window.print(), 0);
  });
}
