# Guida alla Configurazione

Questa guida fornisce una panoramica completa di tutte le configurazioni necessarie per il server, dall'ambiente di sviluppo locale al deployment produttivo su SAP BTP.

## 1. Configurazione tramite Variabili d'Ambiente

Le variabili d'ambiente sono il metodo primario per configurare l'applicazione. Possono essere definite in un file `.env` per lo sviluppo locale o come "User-Provided Variables" nel BTP Cockpit.

### Variabili Fondamentali (Richieste)

| Variabile | Descrizione | Esempio | 
| :--- | :--- | :--- |
| `SAP_IAS_URL` | URL del tenant SAP Identity Authentication Service. | `https://your-tenant.accounts.ondemand.com` |
| `SAP_IAS_CLIENT_ID` | Client ID per l'applicazione OAuth in IAS. | `abc-def-123` |
| `SAP_IAS_CLIENT_SECRET`| Client Secret per l'applicazione OAuth in IAS. | `your-secret` |
| `PORT` | Porta su cui il server Express sarà in ascolto. | `8080` |
| `NODE_ENV` | Ambiente operativo dell'applicazione. | `production` o `development` |

### Configurazione delle Destination

| Variabile | Descrizione | Esempio | 
| :--- | :--- | :--- |
| `SAP_DESTINATION_NAME` | Nome della destination BTP usata per il discovery dei servizi. | `SAP_S4HANA_Design` |
| `SAP_DESTINATION_NAME_RT`| Nome della destination BTP usata a runtime (per le chiamate dati). | `SAP_S4HANA_Runtime` |
| `SAP_USE_SINGLE_DESTINATION`| Se `true`, usa `SAP_DESTINATION_NAME` per tutto. | `false` |
| `destinations` | Per lo sviluppo locale, un array JSON che simula il servizio Destination. | `[{"name":"MyDest","url":"..."}]` |

### Configurazione Avanzata (Opzionale)

| Variabile | Descrizione | Esempio | 
| :--- | :--- | :--- |
| `LOG_LEVEL` | Livello di dettaglio dei log. | `info`, `debug`, `warn`, `error` |
| `SESSION_TIMEOUT` | Durata di una sessione utente in millisecondi. | `3600000` (1 ora) |
| `CORS_ORIGINS` | Elenco separato da virgole degli origin consentiti per CORS. | `https://claude.ai,http://localhost:3000` |

## 2. Configurazione della Sicurezza (xs-security.json)

Questo file è cruciale per definire il modello di sicurezza dell'applicazione in SAP BTP. Viene utilizzato dal servizio XSUAA per creare e validare i token JWT.

**Percorso**: `xs-security.json`

### Ambiti (Scopes)

Definiscono le autorizzazioni granulari. Ogni tool protetto richiederà uno o più di questi ambiti.

```json
"scopes": [
  { "name": "$XSAPPNAME.read", "description": "Read access" },
  { "name": "$XSAPPNAME.write", "description": "Write access" },
  { "name": "$XSAPPNAME.admin", "description": "Administrative access" }
]
```

### Template di Ruolo (Role Templates)

Aggregano più ambiti in un ruolo logico che può essere assegnato agli utenti.

```json
"role-templates": [
  {
    "name": "MCPEditor",
    "description": "Read and write access",
    "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
  },
  {
    "name": "MCPAdmin",
    "description": "Full administrative access",
    "scope-references": ["$XSAPPNAME.admin"]
  }
]
```

### Collezioni di Ruoli (Role Collections)

Nel **BTP Cockpit**, si creano le "Role Collections" basate su questi template e si assegnano agli utenti o ai gruppi di utenti. Questo è il passo finale che concede effettivamente i permessi.

**Esempio in BTP Cockpit**:
1.  Vai su **Security > Role Collections**.
2.  Crea una nuova collezione, es. `App_Power_Users`.
3.  Aggiungi i ruoli definiti nei template, es. `MCPEditor`.
4.  Assegna la collezione `App_Power_Users` agli utenti desiderati.

## 3. Configurazione del Deployment (mta.yaml)

Questo file definisce la struttura dell'applicazione multi-target e i servizi BTP di cui ha bisogno per funzionare.

**Percorso**: `mta.yaml`

### Modulo Applicativo

Definisce le caratteristiche dell'applicazione Node.js, come memoria, comando di avvio e i servizi a cui si deve collegare.

```yaml
modules:
  - name: sap-mcp-server
    type: nodejs
    path: ./
    parameters:
      memory: 512M
      command: npm run start
    requires:
      - name: sap-mcp-destination
      - name: sap-mcp-connectivity
      - name: sap-mcp-xsuaa
```

### Risorse (Servizi BTP)

Elenca i servizi che BTP deve fornire all'applicazione al momento del deploy. È fondamentale che questi servizi siano disponibili e configurati nel tuo subaccount BTP.

```yaml
resources:
  - name: sap-mcp-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: sap-mcp-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
```

---

**Prossimi Passi**: [Guida al Deployment](./DEPLOYMENT.md) | [Guida Utente](./USER_GUIDE.md)
