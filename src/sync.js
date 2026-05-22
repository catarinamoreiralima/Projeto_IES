export function createSyncController({
  state,
  els,
  getSupabaseClient,
  getCurrentUser,
  setCurrentUser,
  render,
  loadEvents,
  normalizeEvents,
  uniqueValues,
  saveEventsToStorage,
}) {
  let isRemoteLoading = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncRequestedWhileInFlight = false;

  function setSyncStatus(message) {
    if (els.syncStatus) {
      els.syncStatus.textContent = message;
    }
  }

  function updateAuthUi() {
    const currentUser = getCurrentUser();
    const loggedIn = Boolean(currentUser);
    els.authForm.classList.toggle("hidden", loggedIn);
    els.signOut.classList.toggle("hidden", !loggedIn);
    els.authStatus.textContent = loggedIn ? `Conectado como ${currentUser.email}` : "Entre para sincronizar com o Supabase.";
  }

  async function completeSupabaseLogin() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    setSyncStatus("Finalizando login...");
    const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (error) {
      setSyncStatus(`Erro ao finalizar login: ${error.message}`);
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function throwIfSupabaseError(table, error) {
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  function buildEventsFromRemote(data) {
    const eventMap = new Map(
      data.events.map((event) => [
        event.id,
        {
          id: event.id,
          name: event.name,
          date: event.event_date ?? "",
          location: event.location ?? "",
          buyers: [],
          purchaseLocations: [],
          artists: [],
        },
      ]),
    );

    const artistMap = new Map();
    data.artists.forEach((artist) => {
      const event = eventMap.get(artist.event_id);
      if (!event) return;
      const localArtist = { id: artist.id, name: artist.name, rooms: [] };
      event.artists.push(localArtist);
      artistMap.set(artist.id, localArtist);
    });

    const roomMap = new Map();
    data.rooms.forEach((room) => {
      const artist = artistMap.get(room.artist_id);
      if (!artist) return;
      const localRoom = { id: room.id, name: room.name, items: [] };
      artist.rooms.push(localRoom);
      roomMap.set(room.id, localRoom);
    });

    data.items.forEach((item) => {
      const room = roomMap.get(item.room_id);
      if (!room) return;
      room.items.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity ?? "",
        store: item.store ?? "",
        notes: item.notes ?? "",
        buyer: item.buyer ?? "",
        done: item.done,
        purchaseValue: item.purchase_value ?? "",
        purchaseValueInput: item.purchase_value_input ?? item.purchase_value ?? "",
        purchaseValueMode: item.purchase_value_mode ?? "total",
      });
    });

    data.buyers.forEach((buyer) => {
      eventMap.get(buyer.event_id)?.buyers.push(buyer.name);
    });

    data.locations.forEach((location) => {
      eventMap.get(location.event_id)?.purchaseLocations.push(location.name);
    });

    return normalizeEvents([...eventMap.values()]);
  }

  async function loadRemoteData() {
    const supabaseClient = getSupabaseClient();
    const currentUser = getCurrentUser();
    if (!supabaseClient || !currentUser) return;

    isRemoteLoading = true;
    setSyncStatus("Carregando dados do Supabase...");

    try {
      setSyncStatus("Carregando eventos...");
      const eventsResult = await supabaseClient.from("events").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      throwIfSupabaseError("events", eventsResult.error);

      setSyncStatus("Carregando artistas...");
      const artistsResult = await supabaseClient.from("artists").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      throwIfSupabaseError("artists", artistsResult.error);

      setSyncStatus("Carregando camarins...");
      const roomsResult = await supabaseClient.from("rooms").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      throwIfSupabaseError("rooms", roomsResult.error);

      setSyncStatus("Carregando itens...");
      const itemsResult = await supabaseClient.from("items").select("*").order("created_at", { ascending: true });
      throwIfSupabaseError("items", itemsResult.error);

      setSyncStatus("Carregando responsáveis...");
      const buyersResult = await supabaseClient.from("buyers").select("*").order("name", { ascending: true });
      throwIfSupabaseError("buyers", buyersResult.error);

      setSyncStatus("Carregando locais de compra...");
      const locationsResult = await supabaseClient.from("purchase_locations").select("*").order("name", { ascending: true });
      throwIfSupabaseError("purchase_locations", locationsResult.error);

      const remoteEvents = buildEventsFromRemote({
        events: eventsResult.data ?? [],
        artists: artistsResult.data ?? [],
        rooms: roomsResult.data ?? [],
        items: itemsResult.data ?? [],
        buyers: buyersResult.data ?? [],
        locations: locationsResult.data ?? [],
      });

      const localEvents = normalizeEvents(loadEvents());
      if (remoteEvents.length === 0 && localEvents.length > 0 && window.confirm("O Supabase ainda está vazio. Deseja enviar os dados locais deste navegador para o banco?")) {
        state.events = localEvents;
        state.selectedEventId = state.events[0]?.id ?? null;
        isRemoteLoading = false;
        render();
        await syncRemoteData();
        return;
      }

      state.events = remoteEvents;
      state.selectedEventId = state.events[0]?.id ?? null;
      saveEventsToStorage(state.events);
      render();
      setSyncStatus("Dados sincronizados.");
    } catch (error) {
      console.error("Erro ao carregar Supabase", error);
      setSyncStatus(`Erro ao carregar: ${error.message}`);
    } finally {
      isRemoteLoading = false;
    }
  }

  function scheduleRemoteSync() {
    const supabaseClient = getSupabaseClient();
    const currentUser = getCurrentUser();
    if (!supabaseClient) {
      setSyncStatus("Supabase não carregou. Alteração salva só localmente.");
      return;
    }
    if (!currentUser) {
      setSyncStatus("Sem login. Alteração salva só localmente.");
      return;
    }
    if (isRemoteLoading) return;
    if (syncInFlight) {
      syncRequestedWhileInFlight = true;
      return;
    }
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncRemoteData();
    }, 450);
  }

  async function syncRemoteData() {
    const supabaseClient = getSupabaseClient();
    const currentUser = getCurrentUser();
    if (!supabaseClient || !currentUser) return;
    if (syncInFlight) {
      syncRequestedWhileInFlight = true;
      return;
    }

    syncInFlight = true;
    syncRequestedWhileInFlight = false;
    setSyncStatus("Salvando no Supabase...");

    try {
      await upsertRemoteGraph();
      setSyncStatus("Salvo no Supabase.");
    } catch (error) {
      console.error("Erro ao sincronizar Supabase", error);
      setSyncStatus(`Erro ao salvar: ${error.message}`);
    } finally {
      syncInFlight = false;
      if (syncRequestedWhileInFlight) {
        scheduleRemoteSync();
      }
    }
  }

  async function upsertRemoteGraph() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;

    const eventRows = state.events.map((event, index) => ({
      id: event.id,
      name: event.name,
      event_date: event.date || null,
      location: event.location || null,
      sort_order: index,
    }));
    const artistRows = [];
    const roomRows = [];
    const itemRows = [];

    state.events.forEach((event) => {
      event.artists.forEach((artist, artistIndex) => {
        artistRows.push({
          id: artist.id,
          event_id: event.id,
          name: artist.name,
          sort_order: artistIndex,
        });

        artist.rooms.forEach((room, roomIndex) => {
          roomRows.push({
            id: room.id,
            artist_id: artist.id,
            name: room.name,
            sort_order: roomIndex,
          });

          room.items.forEach((item) => {
            itemRows.push({
              id: item.id,
              room_id: room.id,
              name: item.name,
              quantity: item.quantity || null,
              store: item.store || null,
              notes: item.notes || null,
              buyer: item.buyer || null,
              done: Boolean(item.done),
              purchase_value: item.purchaseValue === "" ? null : item.purchaseValue,
              purchase_value_input: item.purchaseValueInput === "" ? null : item.purchaseValueInput,
              purchase_value_mode: item.purchaseValueMode || "total",
            });
          });
        });
      });
    });

    await upsertRows("events", eventRows, "id");
    await upsertRows("artists", artistRows, "id");
    await upsertRows("rooms", roomRows, "id");
    await upsertRows("items", itemRows, "id");
    await syncChildNameRows("buyers", "event_id", state.events.flatMap((event) => uniqueValues(event.buyers).map((name) => ({ event_id: event.id, name }))));
    await syncChildNameRows(
      "purchase_locations",
      "event_id",
      state.events.flatMap((event) => uniqueValues(event.purchaseLocations).map((name) => ({ event_id: event.id, name }))),
    );

    await deleteMissingRows("items", itemRows.map((row) => row.id));
    await deleteMissingRows("rooms", roomRows.map((row) => row.id));
    await deleteMissingRows("artists", artistRows.map((row) => row.id));
    await deleteMissingRows("events", eventRows.map((row) => row.id));
  }

  async function upsertRows(table, rows, onConflict) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient || rows.length === 0) return;
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async function syncChildNameRows(table, eventIdColumn, rows) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;

    const eventIds = state.events.map((event) => event.id);
    await Promise.all(
      eventIds.map(async (eventId) => {
        const { error } = await supabaseClient.from(table).delete().eq(eventIdColumn, eventId);
        if (error) throw new Error(`${table} delete: ${error.message}`);
      }),
    );

    if (rows.length === 0) return;
    const { error } = await supabaseClient.from(table).insert(rows);
    if (error) throw new Error(`${table} insert: ${error.message}`);
  }

  async function deleteMissingRows(table, ids) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient.from(table).select("id");
    if (error) throw new Error(`${table} select stale: ${error.message}`);

    const keep = new Set(ids);
    const staleIds = (data ?? []).map((row) => row.id).filter((id) => !keep.has(id));
    if (staleIds.length === 0) return;

    const { error: deleteError } = await supabaseClient.from(table).delete().in("id", staleIds);
    if (deleteError) throw new Error(`${table} delete stale: ${deleteError.message}`);
  }

  async function initSupabase() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      setSyncStatus("Supabase indisponível. Usando dados locais.");
      return;
    }

    await completeSupabaseLogin();

    const { data } = await supabaseClient.auth.getSession();
    setCurrentUser(data.session?.user ?? null);
    updateAuthUi();

    if (getCurrentUser()) {
      await loadRemoteData();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      setCurrentUser(session?.user ?? null);
      updateAuthUi();
      if (getCurrentUser()) {
        await loadRemoteData();
      } else {
        state.events = normalizeEvents(loadEvents());
        state.selectedEventId = state.events[0]?.id ?? null;
        render();
        setSyncStatus("Sessão encerrada. Usando dados locais.");
      }
    });
  }

  return {
    initSupabase,
    completeSupabaseLogin,
    updateAuthUi,
    loadRemoteData,
    scheduleRemoteSync,
    syncRemoteData,
    setSyncStatus,
    buildEventsFromRemote,
  };
}
