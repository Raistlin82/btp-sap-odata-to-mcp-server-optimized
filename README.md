# SAP OData to AI-Powered MCP Server (Optimized Playground)

Questo repository è un ambiente sperimentale e ottimizzato basato sul progetto originale **[btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server)** di @lemaiwo. È stato potenziato con funzionalità AI, un'architettura di tool gerarchica e un sistema di autenticazione robusto per scenari enterprise.

## ✨ Funzionalità Principali

-   **🧠 Hierarchical Tools & Smart Router**: Invece di centinaia di tool, l'interfaccia è semplificata a pochi tool intelligenti. Il tool `sap-smart-query` agisce come un router universale che interpreta le richieste (in linguaggio naturale o OData) e orchestra il workflow ottimale.
-   **🔐 Autenticazione Enterprise**: Integrazione nativa con SAP BTP tramite XSUAA, con un flusso di autenticazione basato su sessioni e gestione dei ruoli.
-   **🤖 Funzionalità AI e Real-time**: Include tool per la conversione da linguaggio naturale a OData, analisi dati, ottimizzazione di query e analytics in tempo reale.
-   **☁️ Ottimizzato per Cloud-Native**: Progettato per il deployment su SAP BTP, Cloud Foundry, con logging strutturato, health check e gestione del ciclo di vita.

## 🚀 Quick Start

### Prerequisiti

-   Accesso a un ambiente SAP BTP, Cloud Foundry.
-   Servizi BTP richiesti: XSUAA, Identity, Connectivity, Destination.
-   Node.js >= 18.

### 1. Installazione

```bash
git clone <this-repo>
cd btp-sap-odata-to-mcp-server-optimized
npm install
```

### 2. Configurazione

Copia il file `.env.example` in `.env` e popola le variabili richieste per il tuo tenant SAP IAS.

```bash
cp .env.example .env
```

### 3. Build e Deploy

```bash
# Esegui il build dei sorgenti TypeScript
npm run build

# Esegui il deploy su SAP BTP, Cloud Foundry
cf push
```

## 📚 Documentazione Completa

Per una guida dettagliata sull'architettura, la configurazione, l'uso dei tool e le guide avanzate, consulta il nostro **[Hub della Documentazione](./docs/README.md)**.