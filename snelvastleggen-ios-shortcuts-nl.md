# Snelkoppeling maken op je iPhone (stap voor stap)

Met een snelkoppeling (Shortcut) kun je vanuit het **deelblad** van je iPhone een link rechtstreeks in Second Memory opslaan. De snelkoppeling opent de app met een vooraf ingevuld formulier — jij tikt alleen nog op **Opslaan**.

Je hebt maar **twee acties** nodig. Onderstaande stappen maken de snelkoppeling voor het opslaan van **links** (webpagina's uit Safari). Onderaan staat hoe je hetzelfde doet voor **tekst**.

> **Tip:** Apple vertaalt de schermteksten soms net iets anders per iOS-versie. Achter elke Nederlandse naam staat de Engelse term tussen haakjes — vind je een actie niet, zoek dan even op het Engelse woord.

## Stap 1 — Nieuwe snelkoppeling starten

- Open de app **Opdrachten** (*Shortcuts*).
- Tik rechtsboven op **+** om een nieuwe opdracht te maken.
- Tik bovenaan op de naam en noem ze **Bewaar in Second Memory**.

## Stap 2 — In het deelblad zetten

- Tik op de knop met de **twee schuifjes** (of het ⓘ-pictogram) om de instellingen te openen.
- Zet **Weergeven in deelblad** (*Show in Share Sheet*) aan.
- Zorg dat bij de ontvangen types **URL's** (*URLs*) is aangevinkt.
- Ga terug naar het bewerkscherm. Bovenaan staat nu automatisch **Ontvang invoer uit deelblad** (*Receive input from Share Sheet*).

## Stap 3 — Actie "URL coderen" toevoegen

- Tik op **Voeg actie toe** (*Add Action*) en zoek op **URL coderen** (*URL Encode*).
- Tik erop om ze toe te voegen.
- De actie pakt automatisch de **Opdrachtinvoer** (*Shortcut Input*) als invoer. Staat er iets anders? Tik op het invoerveld en kies **Opdrachtinvoer**.

## Stap 4 — Actie "Open URL's" toevoegen

- Tik weer op **Voeg actie toe** en zoek op **Open URL's** (*Open URLs*).
- In het veld van die actie typ je precies dit adres:

`https://cvanaalst.github.io/my-mem-app/#add?type=link&url=`

- Zet de cursor **direct achter** `url=` (dus helemaal aan het einde, zonder spatie).
- Tik op de **variabele-toets** boven het toetsenbord en kies het resultaat van **URL coderen** (het heet meestal *URL-gecodeerde tekst* / *URL Encoded Text*).
- Nu staat er: het vaste adres, gevolgd door een blauw blokje met de gecodeerde link.

## Stap 5 — Bewaren

- Tik op **Gereed** (*Done*). Klaar — de snelkoppeling staat nu in je deelblad.

## Zo gebruik je ze

1. Open een webpagina in Safari (of een link in een andere app).
2. Tik op het **deelpictogram** (het vierkantje met pijltje omhoog).
3. Kies **Bewaar in Second Memory** uit de lijst.
4. Second Memory opent met de link al ingevuld. Voeg eventueel een titel of tags toe en tik op **Opslaan**.

## Variant voor tekst (optioneel)

Wil je ook geselecteerde **tekst** kunnen opslaan (bv. uit Notities)? Maak een tweede snelkoppeling met exact dezelfde stappen, met twee kleine verschillen:

- **Stap 2:** vink bij de ontvangen types **Tekst** (*Text*) aan in plaats van URL's.
- **Stap 4:** gebruik dit adres in plaats van het vorige:

`https://cvanaalst.github.io/my-mem-app/#add?type=text&text=`

## Goed om te weten

- De link opent in een gewone **Safari-tab**, niet in de app op je beginscherm. Dat is een beperking van iOS zelf. Het formulier werkt daar precies hetzelfde (het is dezelfde site); bewaar je item en ga daarna terug naar het app-pictogram op je beginscherm.
- Waarom de actie **URL coderen**? Zonder die stap breekt een link met speciale tekens (zoals `&` of `?` in de webadres-staart) halverwege af. Met URL coderen wordt de hele link netjes meegegeven.
