# Guida al Deployment

Questa guida copre i due scenari di deployment principali per il server: il deployment produttivo su **SAP BTP, Cloud Foundry** e la configurazione per lo **sviluppo locale**.

## 1. Deployment su SAP BTP, Cloud Foundry (Produzione)

Questo è lo scenario consigliato per l'uso produttivo, sfruttando appieno i servizi della piattaforma BTP.

### Prerequisiti

Assicurati che nel tuo subaccount BTP siano disponibili e "entitled" i seguenti servizi:

-   **Authorization & Trust Management (XSUAA)**: Per la gestione di ruoli e autorizzazioni.
-   **Identity (IAS)**: Per l'autenticazione degli utenti.
-   **Connectivity**: Per la connessione sicura ai sistemi SAP backend.
-   **Destination**: Per la gestione centralizzata delle destinazioni di sistema.

### Passo 1: Preparazione dei Servizi BTP

Prima di deployare l'applicazione, è necessario creare le istanze dei servizi BTP che utilizzerà. Questi comandi vanno eseguiti una sola volta.

```bash
# 1. Crea il servizio XSUAA usando la tua configurazione di sicurezza
# (Assicurati che il file xs-security.json sia corretto)
cf create-service xsuaa application sap-mcp-xsuaa -c xs-security.json

# 2. Crea il servizio di connettività
cf create-service connectivity lite sap-mcp-connectivity

# 3. Crea il servizio delle destinazioni
cf create-service destination lite sap-mcp-destination
```

### Passo 2: Build e Deploy dell'Applicazione

Con i servizi pronti, puoi procedere al deploy.

```bash
# 1. Installa le dipendenze del progetto
npm install

# 2. Esegui il build dei sorgenti TypeScript
npm run build

# 3. Esegui il deploy su Cloud Foundry
# Il comando cf push utilizzerà le configurazioni definite in mta.yaml e manifest.yml
cf push
```

Dopo il `cf push`, l'applicazione si avvierà e si collegherà automaticamente ai servizi creati in precedenza, come definito nel file `mta.yaml`.

### Passo 3: Configurazione Post-Deployment

1.  **Assegnazione Ruoli**: Nel BTP Cockpit, vai in **Security > Role Collections** e assegna le collezioni di ruoli (es. `MCPAdministrator`, `MCPUser`) agli utenti o gruppi di utenti che devono accedere all'applicazione.

2.  **Configurazione Destination**: Nel BTP Cockpit, vai in **Connectivity > Destinations** e crea le destinazioni necessarie per connetterti ai tuoi sistemi SAP backend (es. S/4HANA). Assicurati che l'autenticazione sia impostata correttamente (es. `PrincipalPropagation`).

3.  **Verifica**: Controlla lo stato dell'applicazione con `cf apps` e accedi all'endpoint `/health` per assicurarti che tutto funzioni correttamente.

    ```bash
    # Controlla lo stato dell'app
    cf apps

    # Verifica l'health check (sostituisci con la tua URL)
    curl https://your-app-name.cfapps.region.hana.ondemand.com/health
    ```

## 2. Configurazione per lo Sviluppo Locale

Per sviluppare e testare l'applicazione localmente.

### Prerequisiti

-   Node.js >= 18
-   Un file `.env` correttamente configurato.

### Passo 1: Configurazione dell'Ambiente

1.  **Clona il Repository** e installa le dipendenze:

    ```bash
    git clone <this-repo>
    cd btp-sap-odata-to-mcp-server-optimized
    npm install
    ```

2.  **Crea e configura il file `.env`**:

    ```bash
    cp .env.example .env
    ```

3.  **Modifica il file `.env`** con le credenziali del tuo tenant SAP IAS (per l'autenticazione) e altre configurazioni necessarie per lo sviluppo. Imposta `NODE_ENV=development`.

    ```env
    # Esempio di configurazione per lo sviluppo
    NODE_ENV=development
    PORT=8080
    LOG_LEVEL=debug

    # Credenziali del tuo tenant IAS di sviluppo
    SAP_IAS_URL=https://your-dev-tenant.accounts.ondemand.com
    SAP_IAS_CLIENT_ID=...
    SAP_IAS_CLIENT_SECRET=...

    # Per simulare il servizio Destination localmente
    destinations=[{"name":"MyLocalDest","url":"http://localhost:4004/catalog","authentication":"NoAuthentication"}]
    ```

### Passo 2: Avvio del Server di Sviluppo

Esegui uno dei seguenti comandi:

```bash
# Avvia il server in modalità sviluppo con hot-reload (consigliato)
npm run dev

# Avvia il server in modalità standard (richiede build manuale)
npm run build
npm run start
```

Il server sarà disponibile all'indirizzo `http://localhost:8080`.

### Connessione ai Servizi BTP (Opzionale)

Se vuoi connetterti ai servizi BTP reali (come XSUAA o Destination) dal tuo ambiente locale, puoi usare le **service keys**.

1.  **Crea una Service Key** in BTP:

    ```bash
    cf create-service-key sap-mcp-destination local-dev-key
    ```

2.  **Visualizza la Service Key** e copia le credenziali nel tuo file `.env` o in un file `default-env.json`.

    ```bash
    cf service-key sap-mcp-destination local-dev-key
    ```

---

**Prossimi Passi**: [Guida alla Configurazione](./CONFIGURATION.md) | [Riferimento ai Tool](./TOOL_REFERENCE.md)
