# Product Requirements Document (PRD): GeoKanban Digital Twin Evolution

## 1. Introduzione ed Executive Summary
L'obiettivo di questo documento è delineare il percorso evolutivo di GeoKanban V3 per trasformarlo da un "Data Shadow" reattivo (registro di eventi passati e posizioni in tempo reale) in un **Digital Twin (Gemello Digitale) Intelligente e Predittivo**. Sfruttando la solida base dati relazionale acquisita (Posizioni, Geofencing, Attività e Certificazioni Crew), introdurremo AI, simulazioni e telemetria avanzata.

## 2. Obiettivi e Benefici (Why)
- **Incremento Affidabilità ETA:** Passare da calcoli statici (distanza/velocità) a calcoli predittivi basati sullo storico di performance della nave rispetto alle condizioni meteo.
- **Saving Carburante (Bunker):** Ridurre corse inutili verso banchine congestionate o attese in rada calcolando la velocità ideale.
- **Pianificazione Simulativa:** Prevedere il futuro ricalcolando gli obiettivi mensili (Production Targets) in "What-If scenarios".
- **Generazione SAL Passivi (Cost Control):** Tracciare gli off-hire e gli stand-by concordati contrattualmente per calcolare i rimborsi, il costo reale dell'attività nave e determinare il KPI economico finale (€/ton).

## 3. Fasi Evolutive e Requisiti (What)

### Fase 0: Schedule & Stand-by Planning (In Lavorazione)
Prima di passare alla telemetria passiva, espandiamo il Data Shadow con le intenzioni in tempo reale della Crew e le regole contrattuali.
- [ ] **DB "Stand-by Reasons":** Nuova tabella master gestita dagli Admin con causali specifiche (Weather, Routine Maintenance, Extraordinary Maintenance, Allowance/Commercial Idle).
- [ ] **Calendario Interattivo (Crew & Admin):** Interfaccia a calendario in cui la Crew può selezionare un giorno e assegnare uno stand-by. 
- [ ] **Regole di Modificabilità:** Il giorno è modificabile/cancellabile dalla Crew *solo fino al termine della data stessa* (es. dichiarazione "Weather Stand-by" il giorno stesso per cambio meteo repentino).
- [ ] **Monitoraggio Admin 7-Giorni:** Cruscotto laterale nella vista Admin che riassume in una colonna tutti gli eventi di stand-by imminenti (finestra di 7 giorni) per tutta la flotta.
- [ ] **Override Geofence Activity:** Il DB controllerà il calendario: se una nave entra/esce in una Geofence ma per quel giorno è segnata in Stand-by, il trigger scriverà come Activity Type la denominazione dello stand-by invece del pattuito (es. "Transit").

### Fase 1: Deep Telemetry (Integrazione IoT Avanzata)
L'obiettivo è arricchire la pipeline dati integrando l'Information Technology (il Database) con l'Operation Technology (i sensori di bordo della flotta).
- [ ] **Lettura Carburante in Real-time:** Ricevere log dai flussometri della nave (es. via API satellitare o sistemi VDR) per mappare i consumi senza attendere il resoconto Logbook di fine operazione.
- [ ] **Sensori Pescaggio (Draft):** Calcolare tonnellaggio di carico stimato confrontando il pescaggio tra ATA (Arrivo) e ATD (Partenza) nella zona di Loading.

### Fase 2: Predictive AI (Il Gemello Intelligente)
Utilizzo dei dati storici consolidati del meteo (`weather_logs`) e delle tempistiche di transito per creare modelli predittivi.
- [ ] **Smart ETA (Estimated Time of Arrival):** Creare un algoritmo di machine learning (o regressivo) che aggiusti l'ETA in base alla velocità media *effettiva* della specifica nave, date le esatte condizioni meteo in mare (altezza onde, velocità vento).
- [ ] **Port Congestion Prediction:** Sistema di allerta su code nei Tugs, Ormeggiatori o Banchina, analizzando le tempistiche di arrivo delle diverse navi.

### Fase 3: Scenario Simulation (Motore What-If)
Creazione di una "Sandbox" sicura per i pianificatori.
- [ ] **Test di Produzione:** Modulo in cui l'operatore può simulare di modificare una rotta o cambiare nave per un viaggio senza intaccare il Database reale, vedendo l'impatto sul totale "Monthly Target".
- [ ] **Routing Automatico Suggerito:** Se il meteo rallenterà un viaggio del 15%, il Digital Twin suggerirà autonomamente rotte, date e velocità (Eco-speed) per recuperare il gap.

### Fase 4: Visual & Spatial Context (Il Gemello Visivo)
Rendere visibile la potenza del Twin Mappato.
- [ ] **Live Meteo Overlay in VesselMap:** Mappa CartoDB arricchita con layer animati di Onde e Correnti sulla zona d'interesse (Mar Ligure).
- [ ] **Playback History (Rewind Map):** Nuova sezione in Admin con barra temporale che permette all'Admin di tornare indietro nel tempo guardando l'overlay delle barche muoversi come in un video.
    - *Soluzione Tecnica (Client-Side Caching):* L'utente seleziona una finestra di max 7-14 giorni (limitazione RAM). Il client carica tutte le posizioni una volta (Singola Query Dati Bassa Frequenza al DB) per zero latenza in riproduzione.
    - *Velocità Variabile (1-5x):* La riproduzione sfrutta un timer JavaScript che cicla l'array delle posizioni saltando *N array index* in risposta alla velocità desiderata (1-5). Esempio: Velocità 3 su acquisizione 30 min = la grafica "salta" in avanti processando istantaneamente 90 minuti di tracciati reali senza bufferizzazioni al server.

## 4. Architettura Tecnica Attesa (How)
1. **Datalake IoT:** Le misurazioni OT verranno raccolte tramite Edge Functions e incrociate con i Logbook.
2. **AI Layer (Python/Supabase Postgres):** Utilizzo di estensioni come `pgvector` per AI/ML su Postgres, o microservizi (FastAPI/Python) per calcoli predittivi esterni richiamati da Edge Functions.
3. **Mappa WebGL:** Upgrade della mappa Leaflet/CartoDB per supportare livelli complessi come layer meteorologici vettoriali e Time-Slider fluide.

## 5. Metriche di Successo (KPI)
- Riduzione della discrepanza tra ETA stimato e ATA (Arrival) effettivo a < 5%.
- Riduzione tempi medi in rada.
- Numero di entry Logbook auto-compilate dai sensori anziché dall'uomo > 50%.

*(Ultimo aggiornamento: Marzo 2026)*
