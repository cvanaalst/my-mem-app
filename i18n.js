/*
 * Second Memory — translations (NL default, EN).
 * No UI string is ever hardcoded in markup or logic; everything goes
 * through t(key, vars) or the data-i18n* markup attributes below.
 */

const dict = {
  nl: {
    appName: "Second Memory",

    search: "Zoeken",
    searchPlaceholder: "Zoek op titel, tekst of link…",
    filter: "Filter",
    filterType: "Type",
    filterTags: "Tags",
    filterSort: "Sorteren",
    sortCreatedDesc: "Nieuwste eerst",
    sortCreatedAsc: "Oudste eerst",
    sortUpdatedDesc: "Recent gewijzigd",
    sortUpdatedAsc: "Langst geleden gewijzigd",
    filterDateRange: "Periode",
    clearFilters: "Wis filters",
    filtersActive: "Filters actief ({count}) — tik om te wissen",
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
    fieldReminder: "Herinnering (optioneel)",
    tagsPlaceholder: "tag toevoegen, Enter of komma",
    urlPlaceholder: "https://…",
    pinItem: "Vastzetten",
    unpinItem: "Losmaken",
    print: "Afdrukken",
    duplicateLinkMessage: "Deze link staat al opgeslagen als '{title}'. Toch opslaan?",
    saveAnyway: "Toch opslaan",
    reminderDue: "Herinnering: {date}",
    linkedItems: "Gekoppelde items",
    addLink: "Koppeling toevoegen",
    linkedFrom: "Gekoppeld vanuit",
    linkPickerTitle: "Kies een item om te koppelen",
    linkPickerSearchPlaceholder: "Zoek een item…",
    linkPickerEmpty: "Geen items gevonden.",
    hasLinkedItems: "Heeft gekoppelde items",
    titleRequired: "Titel is verplicht.",

    addTitle: "Nieuw item",
    quickCaptureTitle: "Snel vastleggen",
    quickCapturePlaceholder: "Plak een link of typ een notitie…",
    quickCaptureMore: "Meer opties",
    typeLink: "Link",
    typeText: "Tekst",
    typeImage: "Foto",
    typeFile: "Bestand",

    itemSaved: "Item opgeslagen",
    itemUpdated: "Item bijgewerkt",
    itemDeleted: "Item verwijderd",
    undo: "Ongedaan maken",

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

    printing: "Afdrukken",
    printOverviewButton: "Overzicht afdrukken",
    printOverviewTitle: "Second Memory — Overzicht",
    printOverviewMeta: "{count} items — {date}",
    printOverviewEmpty: "Nog niets om af te drukken.",
    printIncludeNoteText: "Notitietekst opnemen",

    appearance: "Weergave",
    themeDark: "Donker",
    themeLight: "Licht",
    themeMidnight: "Middernacht",
    themePaper: "Papier",
    language: "Taal",
    listDensity: "Lijstweergave",
    densityComfortable: "Comfortabel",
    densityCompact: "Compact",

    storage: "Opslag",
    storagePersisted: "Opslag is permanent toegewezen door de browser.",
    storageNotPersisted: "Opslag is niet permanent toegewezen — kan door de browser worden opgeruimd bij ruimtegebrek.",
    storageEstimate: "{used} gebruikt van {quota} beschikbaar",

    insights: "Inzichten",
    viewStatistics: "Bekijk statistieken",
    reportTitle: "Statistieken",
    reportTotal: "Items",
    reportPinned: "Vastgezet",
    reportRemindersDue: "Herinneringen verlopen",
    reportByType: "Per type",
    reportOverTime: "Vastgelegd per week",
    reportTags: "Tags",
    reportNoTags: "Nog geen tags.",

    about: "Over",
    aboutText: "Second Memory — je persoonlijke, privé geheugen. Alle data blijft op je toestel en in jouw Google Drive.",
    versionInfo: "Ontworpen door {designer} — {date}, build {build}",

    tabList: "Lijst",
    tabPhotos: "Foto's",
    tabAdd: "Toevoegen",
    tabSettings: "Instellingen",

    installHint: "Installeer Second Memory: tik op Deel en kies 'Zet op beginscherm'.",

    copiedToClipboard: "Gekopieerd naar klembord",
    shareNotSupported: "Delen wordt niet ondersteund op dit toestel — gekopieerd naar klembord in plaats daarvan.",
    fileTooLargeWarning: "Dit bestand is {size} MB. Grote bestanden vertragen synchronisatie. Toch doorgaan?",

    openInNewTab: "Open link in nieuw tabblad",
    openInMdViewer: "Open in Markdown-viewer",
    openFullSize: "Volledige grootte openen",
    openFile: "Bestand openen",
    editText: "Bewerken",
    previewText: "Voorbeeld weergeven",
    noUrlToOpen: "Geen URL om te openen.",

    dateCreated: "Aangemaakt: {date}",
    dateUpdated: "Bijgewerkt: {date}",
  },

  en: {
    appName: "Second Memory",

    search: "Search",
    searchPlaceholder: "Search title, text or link…",
    filter: "Filter",
    filterType: "Type",
    filterTags: "Tags",
    filterSort: "Sort",
    sortCreatedDesc: "Newest first",
    sortCreatedAsc: "Oldest first",
    sortUpdatedDesc: "Recently modified",
    sortUpdatedAsc: "Least recently modified",
    filterDateRange: "Date range",
    clearFilters: "Clear filters",
    filtersActive: "Filters active ({count}) — tap to clear",
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
    fieldReminder: "Reminder (optional)",
    tagsPlaceholder: "add tag, Enter or comma",
    urlPlaceholder: "https://…",
    pinItem: "Pin",
    unpinItem: "Unpin",
    print: "Print",
    duplicateLinkMessage: "This link is already saved as '{title}'. Save anyway?",
    saveAnyway: "Save anyway",
    reminderDue: "Reminder: {date}",
    linkedItems: "Linked items",
    addLink: "Add link",
    linkedFrom: "Linked from",
    linkPickerTitle: "Choose an item to link",
    linkPickerSearchPlaceholder: "Search for an item…",
    linkPickerEmpty: "No items found.",
    hasLinkedItems: "Has linked items",
    titleRequired: "Title is required.",

    addTitle: "New item",
    quickCaptureTitle: "Quick capture",
    quickCapturePlaceholder: "Paste a link or type a note…",
    quickCaptureMore: "More options",
    typeLink: "Link",
    typeText: "Text",
    typeImage: "Photo",
    typeFile: "File",

    itemSaved: "Item saved",
    itemUpdated: "Item updated",
    itemDeleted: "Item deleted",
    undo: "Undo",

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

    printing: "Printing",
    printOverviewButton: "Print overview",
    printOverviewTitle: "Second Memory — Overview",
    printOverviewMeta: "{count} items — {date}",
    printOverviewEmpty: "Nothing to print yet.",
    printIncludeNoteText: "Include note text",

    appearance: "Appearance",
    themeDark: "Dark",
    themeLight: "Light",
    themeMidnight: "Midnight",
    themePaper: "Paper",
    language: "Language",
    listDensity: "List view",
    densityComfortable: "Comfortable",
    densityCompact: "Compact",

    storage: "Storage",
    storagePersisted: "Storage is persistently granted by the browser.",
    storageNotPersisted: "Storage is not persistent — the browser may clear it under storage pressure.",
    storageEstimate: "{used} used of {quota} available",

    insights: "Insights",
    viewStatistics: "View statistics",
    reportTitle: "Statistics",
    reportTotal: "Items",
    reportPinned: "Pinned",
    reportRemindersDue: "Reminders due",
    reportByType: "By type",
    reportOverTime: "Captured per week",
    reportTags: "Tags",
    reportNoTags: "No tags yet.",

    about: "About",
    aboutText: "Second Memory — your personal, private memory. All data stays on your device and in your own Google Drive.",
    versionInfo: "Designed by {designer} — {date}, build {build}",

    tabList: "List",
    tabPhotos: "Photos",
    tabAdd: "Add",
    tabSettings: "Settings",

    installHint: "Install Second Memory: tap Share and choose 'Add to Home Screen'.",

    copiedToClipboard: "Copied to clipboard",
    shareNotSupported: "Sharing isn't supported on this device — copied to clipboard instead.",
    fileTooLargeWarning: "This file is {size} MB. Large files slow down sync. Continue anyway?",

    openInNewTab: "Open link in new tab",
    openInMdViewer: "Open in Markdown viewer",
    openFullSize: "Open full size",
    openFile: "Open file",
    editText: "Edit",
    previewText: "Show preview",
    noUrlToOpen: "No URL to open.",

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
