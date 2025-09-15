# Riferimento ai Tool

Questa guida fornisce una documentazione dettagliata per ciascuno dei tool disponibili nel SAP MCP Server. I tool sono organizzati in categorie funzionali.

## Categoria 1: Entry Point e Autenticazione

Questi tool sono il punto di partenza per qualsiasi interazione con il server.

### 1. `sap-smart-query` (Router Universale)

-   **Descrizione**: **Questo è l'unico tool che dovresti usare per tutte le tue richieste.** Agisce come un router intelligente che analizza la tua richiesta e invoca la sequenza di tool più appropriata per te.
-   **Quando usarlo**: Sempre. Per qualsiasi richiesta, sia in linguaggio naturale ("mostra clienti") sia come query OData diretta (`A_BusinessPartner?$filter=...`).
-   **Parametri**:
    -   `userRequest` (string, required): La tua richiesta.
    -   `context` (object, optional): Contesto aggiuntivo, come `serviceId` o `entityType` se già noti.
-   **Autenticazione**: Gestita automaticamente dai tool sottostanti invocati dal router.

### 2. `check-sap-authentication`

-   **Descrizione**: Valida e associa la tua sessione di autenticazione. Viene chiamato automaticamente all'inizio di una conversazione, ma può essere usato manualmente per fornire un `session_id`.
-   **Quando usarlo**: Solo dopo aver completato il flusso di login nel browser per associare il `session_id` alla tua sessione MCP.
-   **Parametri**:
    -   `session_id` (string, optional): L'ID di sessione ottenuto dal flusso di autenticazione via browser.
-   **Autenticazione**: Questo tool *gestisce* l'autenticazione.

## Categoria 2: Discovery dei Dati

Questi tool ti aiutano a esplorare quali dati e servizi sono disponibili.

### 3. `search-sap-services`

-   **Descrizione**: Cerca e trova i servizi OData disponibili in base a parole chiave o categorie.
-   **Parametri**:
    -   `query` (string, optional): Termine di ricerca.
    -   `category` (enum, optional): Categoria per filtrare i servizi (es. `sales`, `finance`).
-   **Autenticazione**: Non richiesta.

### 4. `discover-service-entities`

-   **Descrizione**: Elenca tutte le entità (insiemi di dati) disponibili all'interno di un specifico servizio OData.
-   **Parametri**:
    -   `serviceId` (string, required): L'ID del servizio da esplorare.
-   **Autenticazione**: Non richiesta.

### 5. `get-entity-schema`

-   **Descrizione**: Fornisce la struttura dettagliata (campi, tipi di dati, chiavi) di una specifica entità.
-   **Parametri**:
    -   `serviceId` (string, required): L'ID del servizio.
    -   `entityName` (string, required): Il nome dell'entità.
-   **Autenticazione**: Non richiesta.

## Categoria 3: Esecuzione e Analisi Dati

Questi tool eseguono operazioni sui dati e forniscono analisi.

### 6. `execute-entity-operation`

-   **Descrizione**: Esegue operazioni CRUD (Create, Read, Update, Delete) su un'entità. **Attenzione**: da usare solo con sintassi OData precisa. Per il linguaggio naturale, affidarsi a `sap-smart-query`.
-   **Parametri**:
    -   `serviceId` (string, required): L'ID del servizio.
    -   `entityName` (string, required): Il nome dell'entità.
    -   `operation` (enum, required): `read`, `create`, `update`, `delete`.
    -   `parameters` (object, optional): Dati per le operazioni (es. il corpo per `create`/`update` o le chiavi per `delete`).
    -   `queryOptions` (object, optional): Opzioni OData come `$filter`, `$select`, `$top`.
-   **Autenticazione**: **Richiesta**.

### 7. `natural-query-builder`

-   **Descrizione**: Traduce una richiesta in linguaggio naturale (es. "clienti di Roma") in una query OData valida. Viene tipicamente invocato in automatico dallo `sap-smart-query`.
-   **Parametri**:
    -   `naturalQuery` (string, required): La richiesta in linguaggio naturale.
    -   `entityType` (string, required): L'entità target.
-   **Autenticazione**: Non richiesta.

### 8. `smart-data-analysis`

-   **Descrizione**: Analizza un set di dati per identificare trend, anomalie e generare insight di business tramite AI.
-   **Parametri**:
    -   `data` (array, required): Un array di oggetti JSON da analizzare.
    -   `analysisType` (enum, required): `trend`, `anomaly`, `forecast`.
-   **Autenticazione**: **Richiesta**.

## Categoria 4: Funzionalità AI e Real-Time

Tool avanzati per l'ottimizzazione, l'analisi di processi e il monitoraggio in tempo reale.

### 9. `query-performance-optimizer`

-   **Descrizione**: Analizza una query OData lenta e suggerisce ottimizzazioni.
-   **Autenticazione**: **Richiesta**.

### 10. `business-process-insights`

-   **Descrizione**: Analizza dati transazionali per identificare colli di bottiglia e inefficienze nei processi di business.
-   **Autenticazione**: **Richiesta**.

### 11. `realtime-data-stream`

-   **Descrizione**: Apre un canale WebSocket per lo streaming di dati in tempo reale.
-   **Autenticazione**: Non richiesta per avviare lo stream, ma potrebbe essere richiesta per accedere a dati specifici.

### 12. `kpi-dashboard-builder`

-   **Descrizione**: Crea e gestisce dashboard con KPI (Key Performance Indicators) basati su dati SAP.
-   **Autenticazione**: **Richiesta**.

---

**Prossimi Passi**: [Guida Utente](./USER_GUIDE.md) | [Guida alla Configurazione](./CONFIGURATION.md)
