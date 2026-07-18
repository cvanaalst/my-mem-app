/*
 * Second Memory — help text, per language.
 *
 * Kept as Markdown rather than dozens of i18n keys: it's long-form prose,
 * and the app already ships a Markdown renderer for text items, so the
 * help screen just reuses it (see renderHelpView in app.js). Only the
 * subset markdown.js understands is used: #/##/### headers, - lists,
 * **bold**, *italic*, [links](url).
 *
 * NOTE: every paragraph and list item must stay on ONE line. That renderer
 * is line-based — a single newline becomes a <br>, and a wrapped list item
 * would end the list — so soft-wrapping this source would put hard breaks
 * at arbitrary points and shatter the bullets.
 */

const nl = `
# Second Memory

Je persoonlijke geheugen voor links, notities, foto's en bestanden. Alles staat op je eigen toestel en synchroniseert via jouw Google Drive. De app werkt volledig zonder internet.

## Iets vastleggen

- Tik op **+** onderaan. Heb je net een link gekopieerd, dan staat die al klaar — tik alleen nog op **Opslaan**.
- Typ je iets anders dan een link, dan wordt het een tekstnotitie.
- **Meer opties** opent het volledige formulier. Daar kies je tussen **Link**, **Tekst**, **Lijst**, **Foto** en **Bestand**, en voeg je meteen een titel, opmerking, tags of een herinnering toe.
- Sla je een link op die er al staat, dan waarschuwt de app je eerst.

## Lijsten en to-do's

- Kies **Lijst** om een boodschappen- of takenlijst te maken. De titel en opmerking blijven, maar het tekstveld wordt een reeks aanvinkbare regels.
- **Enter** maakt de volgende regel; **Backspace** op een lege regel wist die weer.
- Een vinkje zetten of weghalen wordt meteen bewaard — ook zonder op **Opslaan** te tikken.
- Op de lijstkaart zie je de voortgang, bijvoorbeeld *2 van 4 gedaan*.
- Naast elke regel staat een klein **schakeltje**. Tik erop om die regel aan een ander item te koppelen; het schakeltje kleurt dan op. Tik nogmaals om naar het gekoppelde item te springen, of houd het ingedrukt om de koppeling los te maken.

## Terugvinden

- Tik op het **vergrootglas** om te zoeken — in titel, tekst, opmerking én URL.
- Met de **trechter** filter je op type, tags en periode, en kies je hoe er gesorteerd wordt.
- Zodra een filter items verbergt, verschijnt bovenaan de balk **Filters actief**. Tik erop om alles in één keer te wissen.
- De knop ernaast wisselt tussen **comfortabel** (met tags en datum) en **compact** (alleen titels).

## Ordenen

- **Tags** typ je in het tagveld; Enter of een komma maakt de tag af. Tik op een tag in de lijst om er meteen op te filteren.
- Tik op de **ster** om iets vast te zetten. Vastgezette items staan altijd bovenaan.
- Een **herinnering** kleurt rood zodra de datum bereikt is.
- Met **Koppeling toevoegen** verbind je twee items met elkaar. Bij het andere item verschijnt de verwijzing onder **Gekoppeld vanuit**. Een schakeltje in de lijst laat zien dat een item gekoppeld is.

## Gebaren in de lijst

- **Veeg naar links** om te verwijderen. Je kunt dat direct ongedaan maken.
- **Veeg naar rechts** om vast te zetten of los te maken.
- **Houd ingedrukt** voor een menu: vastzetten, delen of verwijderen.
- **Trek omlaag** bovenaan de lijst om te synchroniseren.

## Synchroniseren en back-up

- Koppel je Google Drive onder **Instellingen → Synchronisatie**. De app kan alleen bij zijn eigen map — de rest van je Drive blijft onzichtbaar.
- Synchroniseren gaat twee kanten op: de nieuwste wijziging wint. **Een verwijdering wint altijd.** Dat is bewust: iets wat je op één toestel weggooit, komt niet via een ander toestel terug.
- **Back-up maken** zet een losse kopie in je Drive. Bij **Herstellen** kies je zelf tussen samenvoegen of alles vervangen.

## Exporteren en afdrukken

- **Exporteer JSON** voor alles, of **CSV** voor in een spreadsheet.
- In een item drukt het **printer-icoontje** dat ene item af.
- **Overzicht afdrukken** print je hele verzameling, gegroepeerd per type en alfabetisch op titel. Zet **Notitietekst opnemen** aan als de volledige tekst van je notities mee moet.

## Weergave

Kies een van de vier thema's, de taal en de lijstweergave. Onder **Inzichten** zie je hoeveel je hebt vastgelegd, per type en per week, plus hoeveel taken er nog openstaan.

## Vastleggen vanaf je computer

Op een computer leg je een pagina in één klik vast met een bladwijzer-knop (bookmarklet). Maak een nieuwe bladwijzer in je browser en plak de onderstaande regel als het adres (de URL). Klik erop op een willekeurige webpagina en die opent meteen ingevuld in het formulier.

javascript:location.href='https://cvanaalst.github.io/my-mem-app/#add?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)

## Snel vastleggen vanaf je iPhone

Zet de app op je beginscherm voor de beste ervaring. Met een iOS-Shortcut kun je een gedeelde link rechtstreeks in het formulier openen — de stappen staan in *snelvastleggen-ios-shortcuts-nl.md* bij het project.

## Je gegevens

Alles blijft in de opslag van je browser en in jouw eigen Google Drive. Er is geen server en niemand anders kan erbij. Offline werkt alles gewoon door; zodra je weer online bent, synchroniseert de app.
`;

const en = `
# Second Memory

Your personal memory for links, notes, photos and files. Everything lives on your own device and syncs through your own Google Drive. The app works fully offline.

## Capturing something

- Tap **+** at the bottom. If you've just copied a link it's already filled in — one tap on **Save** and you're done.
- Type anything that isn't a link and it becomes a text note.
- **More options** opens the full form, where you pick **Link**, **Text**, **List**, **Photo** or **File** and can add a title, comment, tags or a reminder straight away.
- Save a link you already have and the app warns you first.

## Lists and to-dos

- Pick **List** to make a shopping list or a to-do list. The title and comment stay, but the text field becomes a set of tickable rows.
- **Enter** starts the next row; **Backspace** on an empty row removes it.
- Ticking or unticking a box is saved immediately — no need to tap **Save**.
- The list card shows progress, for example *2 of 4 done*.
- Each row has a small **chain icon**. Tap it to link that row to another item; the icon lights up. Tap again to jump to the linked item, or hold it to remove the link.

## Finding things again

- Tap the **magnifier** to search — across title, text, comment and URL.
- The **funnel** filters by type, tags and period, and sets the sort order.
- As soon as a filter hides items, a **Filters active** bar appears at the top. Tap it to clear everything at once.
- The button next to it switches between **comfortable** (with tags and date) and **compact** (titles only).

## Organising

- Type **tags** into the tag field; Enter or a comma commits one. Tap a tag in the list to filter by it.
- Tap the **star** to pin something. Pinned items always sort to the top.
- A **reminder** turns red once its date arrives.
- **Add link** connects two items. The other item shows the connection under **Linked from**, and a small chain icon in the list marks anything linked.

## Gestures in the list

- **Swipe left** to delete — you can undo it immediately.
- **Swipe right** to pin or unpin.
- **Long-press** for a menu: pin, share or delete.
- **Pull down** at the top of the list to sync.

## Sync and backup

- Connect your Google Drive under **Settings → Sync**. The app can only see its own folder; the rest of your Drive stays invisible to it.
- Sync runs both ways and the newest change wins. **A deletion always wins.** That's deliberate: something you throw away on one device shouldn't come back from another.
- **Create backup** puts a separate copy in your Drive. On **Restore** you choose between merging and replacing everything.

## Exporting and printing

- **Export JSON** for everything, or **CSV** for a spreadsheet.
- Inside an item, the **printer icon** prints that one item.
- **Print overview** prints your whole collection, grouped by type and alphabetical by title. Turn on **Include note text** to print the full text of your notes too.

## Appearance

Pick one of the four themes, the language, and the list density. **Insights** shows how much you've captured, by type and by week, plus how many tasks are still open.

## Capturing from your computer

On a computer you can capture a page in one click with a bookmarklet. Create a new bookmark in your browser and paste the line below as its address (URL). Click it on any web page and it opens pre-filled in the form.

javascript:location.href='https://cvanaalst.github.io/my-mem-app/#add?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)

## Quick capture from your iPhone

Add the app to your home screen for the best experience. An iOS Shortcut can open a shared link straight into the form — the steps are in *snelvastleggen-ios-shortcuts-nl.md* alongside the project.

## Your data

Everything stays in your browser's storage and in your own Google Drive. There is no server and nobody else can reach it. Offline everything keeps working, and the app syncs as soon as you're back online.
`;

export const HELP_CONTENT = { nl, en };
