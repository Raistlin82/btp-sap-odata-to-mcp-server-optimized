# Guida Utente

Questa guida è pensata per gli utenti che devono interagire con il server per interrogare i dati SAP. Illustra il flusso di autenticazione e fornisce esempi pratici di utilizzo.

## Flusso di Autenticazione Step-by-Step

L'autenticazione è basata su sessioni e richiede un'unica autenticazione all'inizio di una conversazione. Una volta autenticati, tutti i tool che richiedono accesso ai dati funzioneranno senza ulteriori interruzioni.

**Passo 1: Avvio della Sessione e Autenticazione Iniziale**

1.  **Inizio Conversazione**: Quando inizi una nuova conversazione con il client (es. Claude), il server MCP crea una nuova sessione.
2.  **Prima Chiamata (Automatica)**: Il client dovrebbe chiamare automaticamente il tool `check-sap-authentication`. Se non sei autenticato, il tool risponderà con un link.

    ```json
    {
      "status": "authentication_required",
      "message": "🔑 Authentication required for SAP data operations",
      "auth_url": "https://<your-app-url>/auth/",
      "action": "Visit auth_url → get session_id → call check-sap-authentication({session_id: \"your_id\"})"
    }
    ```

3.  **Login via Browser**: Visita l'`auth_url` in un browser. Effettua il login con le tue credenziali SAP (IAS).
4.  **Ottieni il `session_id`**: Dopo il login, la pagina mostrerà un `session_id`. Copialo.

**Passo 2: Associazione della Sessione**

1.  **Fornire il `session_id`**: Esegui di nuovo il tool `check-sap-authentication`, questa volta fornendo il `session_id` che hai copiato.

    ```
    check-sap-authentication({ session_id: "<il-tuo-session-id>" })
    ```

2.  **Conferma**: Il tool confermerà che la sessione è stata autenticata e associata.

    ```json
    {
      "status": "authenticated",
      "message": "✅ Authentication successful! Session associated.",
      "user": "nome.utente@example.com"
    }
    ```

**Passo 3: Utilizzo dei Tool**

Da questo momento in poi, puoi usare qualsiasi tool senza dover specificare nuovamente il `session_id`. Il server gestirà automaticamente il contesto di sicurezza per te. **Si consiglia di usare sempre il tool `sap-smart-query` per tutte le richieste.**

## Esempi di Workflow

Ecco alcuni scenari d'uso comuni che mostrano come interagire con il server dopo l'autenticazione.

### Esempio 1: Trovare un Cliente e Visualizzare i suoi Dettagli

**Obiettivo**: Trovare un Business Partner specifico e ottenere i dettagli del suo schema.

1.  **Ricerca del servizio**: Inizia cercando il servizio corretto.

    > **Tu**: "Usa `sap-smart-query` per trovare i servizi relativi ai business partner."

    Il router intelligente eseguirà `search-sap-services` e restituirà i servizi pertinenti, come `API_BUSINESS_PARTNER`.

2.  **Esplorazione delle entità**: Scopri quali entità sono disponibili nel servizio.

    > **Tu**: "Usa `sap-smart-query` per esplorare le entità nel servizio `API_BUSINESS_PARTNER`."

    Il router eseguirà `discover-service-entities` e mostrerà entità come `A_BusinessPartner`.

3.  **Ottenere lo schema**: Visualizza la struttura dell'entità.

    > **Tu**: "Usa `sap-smart-query` per ottenere lo schema dell'entità `A_BusinessPartner` nel servizio `API_BUSINESS_PARTNER`."

    Il router eseguirà `get-entity-schema`, fornendoti tutti i campi, i tipi e le chiavi.

### Esempio 2: Interrogazione in Linguaggio Naturale

**Obiettivo**: Trovare tutti i clienti creati nell'ultimo mese.

1.  **Richiesta diretta**: Dopo esserti autenticato, fai la tua richiesta in linguaggio naturale.

    > **Tu**: "Usa `sap-smart-query` per mostrarmi tutti i business partner creati nell'ultimo mese."

2.  **Workflow Automatico del Router**:
    *   Il `sap-smart-query` rileva che è una richiesta in linguaggio naturale.
    *   Esegue `natural-query-builder` per tradurre la tua richiesta in una query OData (es. `A_BusinessPartner?$filter=CreationDate ge ...`).
    *   Esegue `execute-entity-operation` con la query OData generata, recuperando i dati.
    *   (Opzionale) Esegue `smart-data-analysis` per fornire un'analisi dei risultati.

3.  **Risultato**: Riceverai l'elenco dei business partner che soddisfano i criteri, senza dover conoscere la sintassi OData.

### Esempio 3: Esecuzione di una Query OData Diretta

**Obiettivo**: Se sei uno sviluppatore e conosci già la query OData, puoi eseguirla direttamente.

1.  **Richiesta con query OData**:

    > **Tu**: "Usa `sap-smart-query` per eseguire la query `A_BusinessPartnerAddress?$filter=Country eq 'IT'&$top=5` nel servizio `API_BUSINESS_PARTNER`."

2.  **Esecuzione Diretta del Router**:
    *   Il `sap-smart-query` rileva la sintassi OData.
    *   Esegue direttamente `execute-entity-operation` con la tua query.

3.  **Risultato**: Ottieni immediatamente i primi 5 indirizzi di business partner in Italia.
