import { createId } from './utils.js';

export function normalizeItemName(value) {
  const text = String(value ?? "");
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() || text.trim().toLowerCase();
}

export function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

export function combineQuantities(values) {
  const quantities = uniqueValues(values);
  if (quantities.length === 0) return "";

  const numbers = quantities.map((value) => Number(value.replace(",", ".")));
  if (numbers.every((value) => Number.isFinite(value))) {
    return String(numbers.reduce((total, value) => total + value, 0)).replace(".", ",");
  }

  return quantities.join(" + ");
}

export function parseQuantity(value) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

export function formatQuantity(value) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3))).replace(".", ",");
}

export function sumNumericQuantities(values) {
  const numbers = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map(parseQuantity);

  if (numbers.length === 0 || numbers.some((value) => !Number.isFinite(value))) return NaN;
  return numbers.reduce((total, value) => total + value, 0);
}

export function getSelectedEventRows(event) {
  return event.artists.flatMap((artist) =>
    artist.rooms.flatMap((room) =>
      room.items.map((item) => ({
        artistId: artist.id,
        roomId: room.id,
        itemId: item.id,
        groupKey: normalizeItemName(item.name),
        rawItem: item,
        event: event.name,
        date: event.date ? new Date(event.date).toLocaleDateString("pt-BR") : "",
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

export function getShoppingGroupKey(row) {
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
}

export function getShoppingRows(event) {
  const groups = getSelectedEventRows(event).reduce((acc, row) => {
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
}

export function getAllocatedItemValue(event, item) {
  const total = Number(item.purchaseValue);
  if (!Number.isFinite(total) || total <= 0) return 0;

  const itemRow = getSelectedEventRows(event).find((row) => row.rawItem === item);
  if (!itemRow) return total;

  const shoppingGroupKey = getShoppingGroupKey(itemRow);
  const groupRows = getSelectedEventRows(event).filter((row) => getShoppingGroupKey(row) === shoppingGroupKey);
  if (groupRows.length <= 1) return total;

  const quantities = groupRows.map((row) => Number(String(row.quantity ?? "").replace(",", ".")));
  const currentQuantity = Number(String(item.quantity ?? "").replace(",", "."));
  const canUseQuantity = quantities.length > 0 && quantities.every((value) => Number.isFinite(value)) && Number.isFinite(currentQuantity);

  if (canUseQuantity) {
    const quantityTotal = quantities.reduce((sum, value) => sum + value, 0);
    if (quantityTotal > 0) return total * (currentQuantity / quantityTotal);
  }

  return total / groupRows.length;
}

export function getArtistTotal(event, artist) {
  return artist.rooms.reduce((total, room) => total + getRoomTotal(event, artist, room), 0);
}

export function getRoomTotal(event, artist, room) {
  return room.items.reduce((total, item) => total + getAllocatedItemValue(event, item), 0);
}

export function findItemsByShoppingRow(event, rowKey) {
  const row = getShoppingRows(event).find((item) => item.rowKey === rowKey);
  return row?.rawItems ?? [];
}

export function findItemByIds(event, ids) {
  const artist = event.artists.find((item) => item.id === ids.artistId);
  const room = artist?.rooms.find((item) => item.id === ids.roomId);
  return room?.items.find((item) => item.id === ids.itemId) || null;
}

export function findRoomByIds(event, ids) {
  const artist = event.artists.find((item) => item.id === ids.artistId);
  return artist?.rooms.find((item) => item.id === ids.roomId) || null;
}

export function calculatePurchaseValue(event, rowKey, rawValue, mode, quantityOverride = NaN) {
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
}

export function splitPendingRowForPurchase(event, row, requestedQuantity, onSelectArtist = () => {}) {
  const rowQuantity = sumNumericQuantities(row.rawRows.map((item) => item.quantity));
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || !Number.isFinite(rowQuantity) || requestedQuantity >= rowQuantity) {
    if (Number.isFinite(requestedQuantity) && Number.isFinite(rowQuantity) && requestedQuantity > rowQuantity) {
      const extraItem = createExtraItem(event, row, requestedQuantity - rowQuantity, "Comprado acima do pedido", onSelectArtist);
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
}

export function createExtraItem(event, row, quantity, notes, onSelectArtist = () => {}) {
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
  onSelectArtist(artist.id);
  return item;
}

export function getOrCreateExtraArtist(event) {
  let artist = event.artists.find((item) => item.name.toLowerCase() === "extra");
  if (!artist) {
    artist = { id: createId(), name: "Extra", rooms: [] };
    event.artists.push(artist);
  }
  return artist;
}

export function getOrCreateExtraRoom(artist) {
  let room = artist.rooms.find((item) => item.name.toLowerCase() === "extra");
  if (!room) {
    room = { id: createId(), name: "Extra", items: [] };
    artist.rooms.push(room);
  }
  return room;
}

export function parseCurrency(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}
