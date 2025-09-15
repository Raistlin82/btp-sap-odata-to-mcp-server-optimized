# Hub della Documentazione

Benvenuto nella documentazione completa del **SAP OData to AI-Powered MCP Server**.

Questa documentazione è strutturata per guidarti attraverso i concetti chiave, l'utilizzo, l'amministrazione e lo sviluppo di questa applicazione potenziata.

## 1. Concetti Chiave

Per comprendere appieno la potenza di questo server, è fondamentale capire due concetti architetturali principali.

-   **[Il Modello a Tool Gerarchici](./ARCHITECTURE.md#il-modello-a-tool-gerarchici)**: Scopri perché usiamo un piccolo set di tool intelligenti invece di centinaia di tool specifici per ogni operazione CRUD.
-   **[Il Router Universale `sap-smart-query`](./TOOL_REFERENCE.md#il-router-universale-sap-smart-query)**: Approfondisci come questo singolo entry point analizza, instrada e orchestra le tue richieste per semplificare l'interazione.

## 2. Guida Utente

Questa sezione è dedicata a chi deve interagire con il server per interrogare i dati SAP.

-   **[Flusso di Autenticazione](./USER_GUIDE.md#flusso-di-autenticazione-step-by-step)**: Una guida passo-passo su come autenticarsi e gestire le sessioni.
-   **[Riferimento ai Tool](./TOOL_REFERENCE.md)**: La documentazione dettagliata di tutti i tool disponibili, con esempi e parametri.
-   **[Esempi di Workflow](./USER_GUIDE.md#esempi-di-workflow)**: Scenari d'uso comuni, come "trovare un cliente e visualizzare i suoi ordini".

## 3. Guida Amministratore

Questa sezione è per chi deve deployare, configurare e manutenere l'applicazione.

-   **[Deployment](./DEPLOYMENT.md)**: Istruzioni dettagliate per il deploy su **SAP BTP, Cloud Foundry** e per l'**ambiente di sviluppo locale**.
-   **[Configurazione](./CONFIGURATION.md)**: La guida definitiva a tutte le **variabili d'ambiente**, alla configurazione dei servizi BTP (`mta.yaml`) e alla sicurezza (`xs-security.json`).
-   **[Sicurezza e Ruoli](./CONFIGURATION.md#configurazione-della-sicurezza-xs-securityjson)**: Come configurare ruoli e autorizzazioni tramite le Role Collection di BTP.
-   **[Monitoring e Health Check](./DEPLOYMENT.md#monitoring-e-health-check)**: Come monitorare lo stato dell'applicazione tramite gli endpoint di health check.

## 4. Guide Avanzate

Approfondimenti su aspetti specifici dell'applicazione.

-   **[Guida al Testing](./guides/TESTING.md)**: Come eseguire e estendere la suite di test automatizzati.
-   **[Analisi del Consumo di Token](./work/TOKEN_CONSUMPTION_ANALYSIS.md)**: Un'analisi dettagliata del consumo di token e delle strategie di ottimizzazione (spostato in `work/`).
-   **[Revisione dell'Identity Management](./work/IDENTITY_MANAGEMENT_REVIEW.md)**: Il piano di azione per la migrazione a XSUAA (spostato in `work/`).
