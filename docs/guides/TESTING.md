# Guida Completa alla Test Suite del SAP MCP Server

Questa guida unificata fornisce tutte le informazioni necessarie per eseguire, manutenere ed estendere la suite di test del SAP MCP Server, garantendo la stabilità e l'affidabilità dell'applicazione.

## 1. Panoramica e Obiettivi

La suite di test è progettata per verificare in modo completo le funzionalità principali del server, tra cui:

-   **Conformità al Protocollo MCP**: Corretta inizializzazione, registrazione dei tool e comunicazione JSON-RPC.
-   **Sistema di Autenticazione**: Gestione delle sessioni, validazione dei token e fallback per lo sviluppo.
-   **Esecuzione dei Tool**: Funzionamento senza errori di tutti i tool principali.
-   **Validazione degli Schemi**: Correttezza e compatibilità degli schemi Zod con lo standard MCP.
-   **Funzionalità Avanzate**: Test specifici per il routing intelligente, l'analisi AI e le feature real-time.

## 2. Struttura della Test Suite

I test sono organizzati in file modulari all'interno della cartella `/tests`:

```
tests/
├── run-tests.js                 # Test runner principale che orchestra l'esecuzione
├── test-mcp-protocol.js         # Test per la conformità al protocollo MCP
├── test-authentication.js       # Test per il sistema di autenticazione
├── test-tool-execution.js       # Test per l'esecuzione base dei tool
└── test-advanced-features.js    # Test per funzionalità avanzate (AI, routing)
```

## 3. Come Eseguire i Test

È possibile lanciare i test tramite script NPM o eseguendo direttamente il test runner.

### Comandi NPM (Consigliato)

```bash
# Esegui la suite di test completa (include anche i test avanzati)
npm run test:all

# Esegui suite specifiche
npm run test:protocol      # Solo test del protocollo MCP
npm run test:auth          # Solo test di autenticazione
npm run test:tools         # Solo test di esecuzione dei tool base
npm run test:advanced      # Solo test delle funzionalità avanzate

# Esegui tutti i test con output dettagliato
npm run test:full
```

### Esecuzione Diretta con Node.js

```bash
# Esegui la suite completa
node tests/run-tests.js

# Esegui una suite specifica
node tests/run-tests.js --suite=protocol

# Abilita l'output verboso per il debug
node tests/run-tests.js --suite=all --verbose
```

## 4. Copertura dei Test

### Test Suite Attuali

1.  **MCP Protocol Tests** (`test-mcp-protocol.js`)
    *   **Verifica**: Connessione al server, messaggi `initialize/initialized`, registrazione di almeno 12 tool, versione del protocollo.
    *   **Criteri di Successo**: Connessione stabile, protocollo `2024-11-05` supportato, comunicazione JSON-RPC funzionante.

2.  **Authentication Tests** (`test-authentication.js`)
    *   **Verifica**: Comportamento di `check-sap-authentication` con e senza `session_id`, gestione degli ambienti (sviluppo vs. produzione).
    *   **Criteri di Successo**: Risposte corrette (`auth_disabled`, `authentication_required`, `auth_failed`) in base al contesto.

3.  **Tool Execution Tests** (`test-tool-execution.js`)
    *   **Verifica**: Esecuzione senza errori dei tool principali (`search-sap-services`, `sap-smart-query`, etc.) e validità degli schemi Zod.
    *   **Criteri di Successo**: Nessun errore "Tool execution failed", schemi conformi, proprietà `items` definita per gli array.

4.  **Advanced Features Tests** (`test-advanced-features.js`)
    *   **Verifica**: Efficacia del router `sap-smart-query`, esecuzione dei tool AI, completezza degli schemi e performance sotto carico.
    *   **Criteri di Successo**: Routing corretto, schemi validi, gestione di richieste concorrenti.

## 5. Estendere la Test Suite

### Aggiungere un Nuovo Test per un Tool

Per testare un nuovo tool, aggiungilo all'array `toolsToTest` in `test-tool-execution.js`:

```javascript
{
    name: 'nuovo-tool-nome',
    args: {
        param1: 'valore',
        param2: true
    },
    description: 'Descrizione del test per il nuovo tool'
}
```

### Creare una Nuova Suite di Test

1.  **Crea un nuovo file di test** (es. `tests/test-custom-feature.js`) usando il template fornito in `EXPANDED_TEST_SUITE_GUIDE.md`.
2.  **Integra il nuovo file** in `run-tests.js` importandolo e aggiungendolo alla logica di esecuzione.
3.  **Aggiungi un nuovo script NPM** in `package.json` per lanciare la nuova suite in modo isolato.

```json
"scripts": {
  "test:custom": "node tests/run-tests.js --suite=custom"
}
```

## 6. Debug e Risoluzione dei Problemi

### Errore: "Tool execution failed"
*   **Causa Comune**: Schemi Zod non conformi (es. un array senza `.describe()` o senza la proprietà `items`).
*   **Soluzione**: Verificare la definizione dello schema del tool in `src/tools/hierarchical-tool-registry.ts`.

### Timeout durante i Test
*   **Cause Comuni**: Server BTP lento, connessione di rete instabile, memory leak.
*   **Soluzioni**: Aumentare il timeout tramite la variabile d'ambiente `TEST_TIMEOUT=45000` o eseguire i test in un ambiente locale (`NODE_ENV=development npm run test:all`).

## 7. Integrazione Continua (CI/CD)

I test sono progettati per essere eseguiti in una pipeline di CI/CD per prevenire regressioni.

### Esempio di Hook Pre-Deploy

```bash
#!/bin/bash
echo "Running SAP MCP Server test suite..."
npm run test:all

if [ $? -eq 0 ]; then
    echo "✅ All tests passed - proceeding with deployment"
    # Includere qui il comando di deploy, es: cf push
else
    echo "❌ Tests failed - blocking deployment"
    exit 1
fi
```

### Esempio per GitHub Actions

```yaml
- name: Run MCP Test Suite & Build
  run: |
    npm ci
    npm run test:all
    npm run build
  env:
    NODE_ENV: test
```

## 8. Raccomandazioni per il Futuro

-   **Aumentare la Copertura**: Scrivere test per tutti i 12+ tool.
-   **Test di Carico**: Implementare test di performance con un alto numero di richieste concorrenti.
-   **Mock dei Servizi SAP**: Per test più veloci e isolati, creare mock dei servizi SAP.
-   **Code Coverage**: Integrare uno strumento di reporting per la code coverage con l'obiettivo di superare il 90%.
