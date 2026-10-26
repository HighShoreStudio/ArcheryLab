# Archery Lab — Web App

Versione web app di **Archery Lab** (1.9.6 RC, build 19604) riprogettata con lo stile *Liquid Glass* di Apple:
viste con titoli grandi, liste raggruppate in stile Impostazioni, barra delle schede flottante in vetro,
controlli segmentati, fogli modali e avvisi in-app. Funziona in chiaro e in scuro, si installa sulla
schermata Home e resta utilizzabile offline.

Tutti i calcoli restano quelli originali e avvengono nel browser: nessun account, nessun server.

## Pubblicare su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `archery-lab`).
2. Carica **il contenuto** di questa cartella nella radice del repository (non la cartella stessa).
   Da terminale:
   ```bash
   git init
   git add .
   git commit -m "Archery Lab web app"
   git branch -M main
   git remote add origin https://github.com/<utente>/archery-lab.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, cartella `/ (root)`. Salva.
4. Dopo un minuto l'app è online su `https://<utente>.github.io/archery-lab/`.

Tutti i percorsi sono relativi, quindi funziona sia in un sottopercorso (`/archery-lab/`) sia su un dominio dedicato.
Il file `.nojekyll` evita che GitHub elabori i file con Jekyll.

## Provarla in locale

Il service worker richiede HTTPS o `localhost`, quindi apri la cartella tramite un piccolo server:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Installazione sul telefono

- **iPhone / iPad**: apri il sito in Safari → Condividi → *Aggiungi alla schermata Home*.
- **Android**: menu di Chrome → *Installa app*.
- **Desktop**: icona di installazione nella barra degli indirizzi di Chrome / Edge.

## Struttura

```
index.html                Home
calcolatore/              Attrezzatura, freccia (peso, FOC), balistica, aria, traiettoria RK4
spennata/                 Spennata Lab (bare-shaft) + catalogo-attrezzatura.json
rosata/                   Analisi della rosata
accordatura/              Accordatura guidata (le spunte restano sul dispositivo)
guide/                    Guide e schede tecniche
utilities/                Conversioni e somma del peso della freccia
altro/                    Scheda "Altro": strumenti, condivisione, lingua, informazioni
css/glass.css             Design system Liquid Glass (token chiaro/scuro, componenti)
css/pages.css             Stili specifici delle pagine
js/shell.js               Barra delle schede, avvisi in-app, condivisione, service worker
js/i18n.js                Interfaccia italiano / inglese
sw.js                     Service worker (rete prima, copia offline come riserva)
manifest.webmanifest      Manifest PWA
icons/                    Icone dell'app
```

## Differenze rispetto al sito originale

- **Rimossi** i file PHP (`counter.php`, `stats.php`, `guestbook.php`) e il contatore visite, perché GitHub Pages
  non esegue PHP. Il *Libro degli Arcieri* è collegato al sito originale su Altervista.
- **Rimosso** lo script di analisi Umami (l'ID era legato al dominio originale). Se vuoi le statistiche,
  aggiungi lo snippet nell'`<head>` delle pagine.
- I dialoghi `confirm()` / `prompt()` del browser sono sostituiti da avvisi in-app in stile iOS.
- **Conversioni**: nel pacchetto originale `utilities/app.js` era vuoto; ora le conversioni (massa, lunghezza,
  forza, velocità) e la somma del peso della freccia funzionano.
- **Analisi della Rosata**: i colori del bersaglio erano invertiti (giallo all'esterno); ora il centro è giallo come
  su una visuale regolamentare. Le statistiche non cambiano.
- **Traduzione**: corretto un errore di `i18n.js` che generava eccezioni sugli attributi `aria-label`.
- Il calcolatore apre direttamente una sezione con l'ancora nell'indirizzo, ad esempio `calcolatore/#trajectory`.

I dati salvati (profilo attrezzatura, archivio frecce, storico rosate) usano le stesse chiavi del sito originale,
ma restano legati al dominio: quelli salvati su `lan.altervista.org` non compaiono automaticamente su GitHub Pages.
L'archivio frecce si può esportare dal sito originale e importare qui.
