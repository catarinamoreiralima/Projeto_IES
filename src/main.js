import * as utils from './utils.js';
import * as state from './state.js';
import * as rows from './rows.js';
import * as render from './render.js';
import * as domHandlers from './dom-handlers.js';
import * as sync from './sync.js';

// Attach key helpers to `window` to preserve compatibility with the legacy `app.js`.
// This is a temporary bridge used during incremental migration.
window.createId = utils.createId;
window.escapeHtml = utils.escapeHtml;
window.formatCurrency = utils.formatCurrency;
window.parseCurrency = utils.parseCurrency;
window.slugify = utils.slugify;
window.formatDate = utils.formatDate;

window.normalizeEventsFromState = state.normalizeEvents;
window.collectBuyersFromState = state.collectBuyers;
window.collectPurchaseLocationsFromState = state.collectPurchaseLocations;
window.getSelectedEventFromState = state.getSelectedEvent;
window.syncSelectedArtistFromState = state.syncSelectedArtist;

window.normalizeItemNameFromRows = rows.normalizeItemName;
window.uniqueValuesFromRows = rows.uniqueValues;
window.combineQuantitiesFromRows = rows.combineQuantities;
window.parseQuantityFromRows = rows.parseQuantity;
window.formatQuantityFromRows = rows.formatQuantity;
window.sumNumericQuantitiesFromRows = rows.sumNumericQuantities;
window.getRowsFromRowsModule = rows.getSelectedEventRows;
window.getShoppingGroupKeyFromRows = rows.getShoppingGroupKey;
window.getShoppingRowsFromRows = rows.getShoppingRows;
window.getAllocatedItemValueFromRows = rows.getAllocatedItemValue;
window.getArtistTotalFromRows = rows.getArtistTotal;
window.getRoomTotalFromRows = rows.getRoomTotal;
window.findItemsByShoppingRowFromRows = rows.findItemsByShoppingRow;
window.findItemByIdsFromRows = rows.findItemByIds;
window.findRoomByIdsFromRows = rows.findRoomByIds;
window.calculatePurchaseValueFromRows = rows.calculatePurchaseValue;
window.splitPendingRowForPurchaseFromRows = rows.splitPendingRowForPurchase;
window.createExtraItemFromRows = rows.createExtraItem;
window.getOrCreateExtraArtistFromRows = rows.getOrCreateExtraArtist;
window.getOrCreateExtraRoomFromRows = rows.getOrCreateExtraRoom;

window.renderAppFromModule = render.renderApp;
window.renderEventsFromModule = render.renderEvents;
window.renderHeaderFromModule = render.renderHeader;
window.renderViewsFromModule = render.renderViews;
window.renderArtistsFromModule = render.renderArtists;
window.renderArtistFromModule = render.renderArtist;
window.renderRoomFromModule = render.renderRoom;
window.renderStoreSelectFromModule = render.renderStoreSelect;
window.renderStoreOptionsFromModule = render.renderStoreOptions;
window.renderItemFromModule = render.renderItem;
window.renderNoteTextFromModule = render.renderNoteText;
window.renderNoteFormFromModule = render.renderNoteForm;
window.renderShoppingTableFromModule = render.renderShoppingTable;
window.renderShoppingByStoreFromModule = render.renderShoppingByStore;
window.groupRowsByStoreFromModule = render.groupRowsByStore;
window.renderShoppingSectionFromModule = render.renderShoppingSection;
window.renderShoppingRowFromModule = render.renderShoppingRow;
window.renderEntryDetailsFromModule = render.renderEntryDetails;
window.renderBuyerCellFromModule = render.renderBuyerCell;
window.renderPriceCellFromModule = render.renderPriceCell;
window.renderBuyersFromModule = render.renderBuyers;
window.renderStoresFromModule = render.renderStores;
window.renderArtistSummaryFromModule = render.renderArtistSummary;
window.getArtistPendingCountFromModule = render.getArtistPendingCount;
window.renderSummaryFromModule = render.renderSummary;
window.renderBuyerBalanceFromModule = render.renderBuyerBalance;
window.sumValuesFromModule = render.sumValues;
window.formatDateFromModule = render.formatDate;
window.formatCurrencyInputFromModule = render.formatCurrencyInput;

window.attachDomHandlersFromModule = domHandlers.attachDomHandlers;

window.createSyncControllerFromModule = sync.createSyncController;

console.log('src/main.js: utilities attached to window for migration');

// Load the legacy app only after all bridge helpers are attached.
import('../app.js').catch((error) => {
	console.error('Failed to load app bootstrap', error);
});
