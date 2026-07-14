/*
 * Second Memory — translations (NL default, EN).
 * No UI string is ever hardcoded in markup or logic; everything goes
 * through t(key, vars) or the data-i18n* markup attributes below.
 */

const dict = {
  nl: {
    appName: "Second Memory",

    search: "Zoeken",
    searchPlaceholder: "Zoek op titel of opmerking…",
    filter: "Filter",
    filterType: "Type",
    filterTags: "Tags",
    clearFilters: "Wis filters",
    noResults: "Geen resultaten voor deze zoekopdracht.",

    emptyList: "Nog niets opgeslagen. Tik op + om te beginnen.",
    emptyGrid: "Nog geen foto's.",
    loadMore: "Meer laden",

    back: "Terug",
    delete: "Verwijder",
    cancel: "Annuleer",
    save: "Opslaan",
    share: "Delen",
    confirmOk: "Bevestig",

    fieldTitle: "Titel",
    fieldUrl: "URL",
    fieldText: "Tekst",
    fieldComment: "Opmerking",
    fieldTags: "Tags",
    fieldImage: "Foto",
    fieldFile: "Bestand",
    tagsPlaceholder: "tag toevoegen, Enter of komma",
    urlPlaceholder: "https://…",
    paste: "Plakken",
    pasteNotSupported: "Plakken via de knop lukt hier niet — tik in het veld en houd vast tot 'Plakken' verschijnt.",
    titleRequired: "Titel is verplicht.",

    addTitle: "Nieuw item",
    typeLink: "Link",
    typeText: "Tekst",
    typeImage: "Foto",
    typeFile: "Bestand",

    itemSaved: "Item opgeslagen",
    itemUpdated: "Item bijgewerkt",
    itemDeleted: "Item verwijderd",
    confirmDeleteTitle: "Item verwijderen?",
    confirmDeleteMessage: "Dit item wordt verwijderd. Deze actie kan niet ongedaan worden gemaakt op dit toestel.",

    settings: "Instellingen",
    sync: "Synchronisatie",
    syncNow: "Nu synchroniseren",
    syncIdle: "Nog niet gesynchroniseerd",
    syncSyncing: "Synchroniseren…",
    syncSuccess: "Gesynchroniseerd: {added} nieuw, {updated} bijgewerkt, {deleted} verwijderd",
    syncError: "Synchronisatie mislukt: {message}",
    syncLastSync: "Laatste synchronisatie: {date}",
    autoSync: "Automatisch synchroniseren bij starten",
    tapToSync: "Aanmelding verlopen — tik op 'Nu synchroniseren'",
    driveConnecting: "Verbinden met Google Drive…",
    oauthFailed: "Aanmelden bij Google mislukt. Probeer het opnieuw.",
    offlineNotice: "Geen internetverbinding — synchronisatie is niet mogelijk.",

    backupRestore: "Back-up & herstel",
    createBackup: "Back-up maken",
    restoreBackup: "Herstellen",
    backupCreated: "Back-up gemaakt",
    backupRestored: "Back-up hersteld",
    noBackupsFound: "Geen back-ups gevonden op Drive.",
    restoreChooseMode: "Hoe wil je herstellen?",
    restoreMerge: "Samenvoegen",
    restoreMergeDesc: "Voeg back-up samen met huidige data (nieuwste wint).",
    restoreReplace: "Vervangen",
    restoreReplaceDesc: "Vervang alle huidige data volledig door de back-up.",

    exportData: "Exporteren",
    exportJson: "Exporteer JSON",
    exportCsv: "Exporteer CSV",
    exportDone: "Export gedownload",

    appearance: "Weergave",
    themeDark: "Donker",
    themeLight: "Licht",
    themeMidnight: "Middernacht",
    themePaper: "Papier",
    language: "Taal",

    storage: "Opslag",
    storagePersisted: "Opslag is permanent toegewezen door de browser.",
    storageNotPersisted: "Opslag is niet permanent toegewezen — kan door de browser worden opgeruimd bij ruimtegebrek.",
    storageEstimate: "{used} gebruikt van {quota} beschikbaar",

    about: "Over",
    aboutText: "Second Memory — je persoonlijke, privé geheugen. Alle data blijft op je toestel en in jouw Google Drive.",

    tabList: "Lijst",
    tabPhotos: "Foto's",
    tabAdd: "Toevoegen",
    tabSettings: "Instellingen",

    installHint: "Installeer Second Memory: tik op Deel en kies 'Zet op beginscherm'.",

    copiedToClipboard: "Gekopieerd naar klembord",
    shareNotSupported: "Delen wordt niet ondersteund op dit toestel — gekopieerd naar klembord in plaats daarvan.",
    fileTooLargeWarning: "Dit bestand is {size} MB. Grote bestanden vertragen synchronisatie. Toch doorgaan?",

    dateCreated: "Aangemaakt: {date}",
    dateUpdated: "Bijgewerkt: {date}",
  },

  en: {
    appName: "Second Memory",

    search: "Search",
    searchPlaceholder: "Search title or comment…",
    filter: "Filter",
    filterType: "Type",
    filterTags: "Tags",
    clearFilters: "Clear filters",
    noResults: "No results for this search.",

    emptyList: "Nothing saved yet. Tap + to get started.",
    emptyGrid: "No photos yet.",
    loadMore: "Load more",

    back: "Back",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    share: "Share",
    confirmOk: "Confirm",

    fieldTitle: "Title",
    fieldUrl: "URL",
    fieldText: "Text",
    fieldComment: "Comment",
    fieldTags: "Tags",
    fieldImage: "Photo",
    fieldFile: "File",
    tagsPlaceholder: "add tag, Enter or comma",
    urlPlaceholder: "https://…",
    paste: "Paste",
    pasteNotSupported: "Paste via the button isn't available here — tap the field and hold until 'Paste' appears.",
    titleRequired: "Title is required.",

    addTitle: "New item",
    typeLink: "Link",
    typeText: "Text",
    typeImage: "Photo",
    typeFile: "File",

    itemSaved: "Item saved",
    itemUpdated: "Item updated",
    itemDeleted: "Item deleted",
    confirmDeleteTitle: "Delete item?",
    confirmDeleteMessage: "This item will be deleted. This cannot be undone on this device.",

    settings: "Settings",
    sync: "Sync",
    syncNow: "Sync now",
    syncIdle: "Not synced yet",
    syncSyncing: "Syncing…",
    syncSuccess: "Synced: {added} new, {updated} updated, {deleted} deleted",
    syncError: "Sync failed: {message}",
    syncLastSync: "Last synced: {date}",
    autoSync: "Auto-sync on launch",
    tapToSync: "Session expired — tap 'Sync now'",
    driveConnecting: "Connecting to Google Drive…",
    oauthFailed: "Google sign-in failed. Please try again.",
    offlineNotice: "No internet connection — sync isn't possible.",

    backupRestore: "Backup & restore",
    createBackup: "Create backup",
    restoreBackup: "Restore",
    backupCreated: "Backup created",
    backupRestored: "Backup restored",
    noBackupsFound: "No backups found on Drive.",
    restoreChooseMode: "How do you want to restore?",
    restoreMerge: "Merge",
    restoreMergeDesc: "Merge backup with current data (newest wins).",
    restoreReplace: "Replace",
    restoreReplaceDesc: "Fully replace all current data with the backup.",

    exportData: "Export",
    exportJson: "Export JSON",
    exportCsv: "Export CSV",
    exportDone: "Export downloaded",

    appearance: "Appearance",
    themeDark: "Dark",
    themeLight: "Light",
    themeMidnight: "Midnight",
    themePaper: "Paper",
    language: "Language",

    storage: "Storage",
    storagePersisted: "Storage is persistently granted by the browser.",
    storageNotPersisted: "Storage is not persistent — the browser may clear it under storage pressure.",
    storageEstimate: "{used} used of {quota} available",

    about: "About",
    aboutText: "Second Memory — your personal, private memory. All data stays on your device and in your own Google Drive.",

    tabList: "List",
    tabPhotos: "Photos",
    tabAdd: "Add",
    tabSettings: "Settings",

    installHint: "Install Second Memory: tap Share and choose 'Add to Home Screen'.",

    copiedToClipboard: "Copied to clipboard",
    shareNotSupported: "Sharing isn't supported on this device — copied to clipboard instead.",
    fileTooLargeWarning: "This file is {size} MB. Large files slow down sync. Continue anyway?",

    dateCreated: "Created: {date}",
    dateUpdated: "Updated: {date}",
  },
};

let currentLang = "nl";

function setLang(lang) {
  currentLang = dict[lang] ? lang : "nl";
}

function getLang() {
  return currentLang;
}

function t(key, vars) {
  const str = (dict[currentLang] && dict[currentLang][key]) || dict.nl[key] || key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? vars[name] : `{${name}}`));
}

/** Applies data-i18n / data-i18n-placeholder / data-i18n-aria attributes to the whole document. */
function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
  document.documentElement.lang = currentLang;
}

export const i18n = { t, setLang, getLang, applyTranslations };
