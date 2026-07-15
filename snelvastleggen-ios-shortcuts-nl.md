# Snel vastleggen via iOS Snelkoppelingen (omweg voor het deelblad)

Vertaling van hoofdstuk 4 uit `README.md` ("Quick capture via iOS Shortcuts"), met de Nederlandse (België) namen zoals ze in de **Opdrachten**-app op je iPhone staan.

> **Let op over de vertaling:** Apple past de exacte schermteksten soms licht aan per iOS-versie. Ik heb bij elke stap de Engelse originele naam tussen haakjes gezet — als je een actie niet meteen terugvindt onder de Nederlandse naam, zoek dan even op het Engelse woord tussen haakjes; die zoekterm werkt meestal ook als je toestel op Nederlands staat.

Een snelkoppeling (Shortcut) *kan* wél verschijnen in het deelblad van iOS, ook al kan de app zelf dat niet. De snelkoppeling grijpt wat je aan het delen bent en opent Second Memory daarmee vooraf ingevuld, via een `#add?...`-link die de app herkent bij het opstarten.

## Snelkoppeling 1 — "Bewaar link in Second Memory"

Voor het delen van een URL vanuit Safari, Kaarten, enz.

1. Open de app **Opdrachten** (Shortcuts) → tik op **+** (nieuwe opdracht) → geef ze de naam "Bewaar link in Second Memory".
2. Tik op het instellingenpictogram (ⓘ) rechtsboven → zet **Weergeven in deelblad** (*Show in Share Sheet*) aan → stel bij **Deelbladtypen** (*Share Sheet Types*) in op **URL's** (*URLs*).
3. Voeg de actie **Tekst** (*Text*) toe met als inhoud:
   `https://<jouw-pages-url>/#add?type=link&url=`
   (vul je eigen GitHub Pages-URL in, bv. `https://cvanaalst.github.io/my-mem-app/`)
4. Voeg de actie **URL coderen** (*URL Encode*) toe → als invoer kies je **Opdrachtinvoer** (*Shortcut Input*).
5. Voeg nog een actie **Tekst** (*Text*) toe die de twee vorige resultaten samenvoegt tot één tekst (het vaste voorvoegsel uit stap 3 + de gecodeerde invoer uit stap 4).
6. Voeg de actie **URL's openen** (*Open URLs*) toe → als invoer kies je de samengevoegde tekst uit stap 5.

## Snelkoppeling 2 — "Bewaar tekst in Second Memory"

Voor het delen van geselecteerde tekst vanuit Notities, Safari, enz.

Zelfde stappen als hierboven, met twee verschillen:
- Bij stap 2: **Deelbladtypen** → **Tekst** (*Text*) in plaats van URL's.
- Bij stap 3: het voorvoegsel is
  `https://<jouw-pages-url>/#add?type=text&text=`

## Gebruik

Eenmaal beide snelkoppelingen aangemaakt: deel een link of stuk tekst ergens op je iPhone → kies **Delen** → **Snelkoppelingen** (of tik direct op de snelkoppeling als die al in je deelblad staat) → de juiste snelkoppeling → Second Memory opent met een vooraf ingevuld formulier. Je voegt zelf nog een titel en eventueel tags toe en tikt op **Opslaan**.

## Belangrijk om te weten

- iOS opent deze link in een gewone Safari-tab, niet in de geïnstalleerde app op je beginscherm — dat is een beperking van iOS zelf, niet van deze app. Het toevoegformulier werkt daar gewoon (het is dezelfde site), het is alleen niet het "losstaande" venster. Bewaar het item en ga daarna terug naar het pictogram op je beginscherm.
- De parameters die de app begrijpt in de link: `type` (`link` of `text`, wordt automatisch afgeleid als je `url` of `text` meegeeft), `url`, `text`, `title`, `comment`, `tags` (gescheiden door komma's). Alle waarden moeten URL-gecodeerd zijn — dat regelt de actie **URL coderen** in stap 4 voor je.
