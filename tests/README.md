# SAP MCP Server Test Suite

Suite di test completa per validare il corretto funzionamento del SAP MCP Server dopo modifiche impattanti.

## 🎯 Panoramica

Questa suite di test verifica:
- **Conformità protocollo MCP**: Inizializzazione, registrazione tool, comunicazione JSON-RPC
- **Sistema di autenticazione**: Gestione sessioni, validazione token, fallback per sviluppo
- **Esecuzione tool**: Tutti i tool MCP eseguono senza errori "Tool execution failed"
- **Validazione schema**: Schema Zod corretti e compatibili con standard MCP

## 📁 Struttura

```
tests/
├── README.md                    # Questa documentazione
├── run-tests.js                 # Test runner principale
├── test-mcp-protocol.js         # Test protocollo MCP
├── test-authentication.js       # Test sistema autenticazione
└── test-tool-execution.js       # Test esecuzione tool
```

## 🚀 Utilizzo

### Comandi NPM

```bash
# Esegui tutti i test
npm run test:all

# Test specifici
npm run test:protocol      # Solo protocollo MCP
npm run test:auth         # Solo autenticazione
npm run test:tools        # Solo esecuzione tool

# Con output dettagliato
npm run test:verbose
```

### Esecuzione Diretta

```bash
# Test completo
node tests/run-tests.js

# Test specifici
node tests/run-tests.js --suite=protocol
node tests/run-tests.js --suite=auth
node tests/run-tests.js --suite=tools

# Output verboso
node tests/run-tests.js --verbose
```

## 📊 Test Coverage

### 1. MCP Protocol Tests (`test-mcp-protocol.js`)

✅ **Verifica:**
- Connessione server MCP stdio
- Messaggio initialize/initialized
- Registrazione corretta dei tool (≥12 tool)
- Versione protocollo 2024-11-05
- Risposta tools/list

**Criteri di successo:**
- Server si connette correttamente
- Protocollo MCP v2024-11-05 supportato
- Almeno 12 tool registrati
- Comunicazione JSON-RPC funzionante

### 2. Authentication Tests (`test-authentication.js`)

✅ **Verifica:**
- `check-sap-authentication` senza session_id
- `check-sap-authentication` con session_id invalido
- Struttura risposta corretta
- Gestione ambiente sviluppo vs produzione

**Criteri di successo:**
- Ambiente sviluppo: `auth_disabled`
- Ambiente produzione: `authentication_required`
- Session invalidi: `auth_failed`
- Campi obbligatori: `status`, `message`

### 3. Tool Execution Tests (`test-tool-execution.js`)

✅ **Verifica:**
- Esecuzione senza errori dei tool principali:
  - `search-sap-services`
  - `check-sap-authentication`
  - `sap-smart-query`
  - `realtime-data-stream`
  - `kpi-dashboard-builder`
- Schema Zod validi per tutti i tool
- Nessun "Tool execution failed"

**Criteri di successo:**
- Tutti i tool restituiscono risposta valida
- Schema conformi allo standard MCP
- Proprietà `items` definita per array
- Descrizioni presenti per tutti i parametri

## 🔧 Configurazione

### Timeout

I timeout sono configurabili per ambiente:
- **MCP Protocol**: 10s
- **Authentication**: 8s
- **Tool Execution**: 25s

### Modalità Verbose

La modalità verbose mostra:
- Messaggi JSON-RPC completi
- Dettagli degli errori
- Debug della comunicazione MCP
- Tempo di esecuzione per test

## 🚨 Risoluzione Problemi

### "Tool execution failed"

**Causa comune**: Schema Zod non conformi allo standard MCP
- Array senza proprietà `items`
- Missing `.describe()` per parametri
- Type incompatibili

**Soluzione**: Verificare schema in `hierarchical-tool-registry.ts`

### Timeout durante test

**Cause possibili**:
- Server MCP non risponde
- Processo bloccato
- Performance degradate

**Soluzione**:
1. Aumentare timeout in test
2. Verificare log server
3. Controllare build applicazione

### Errori di build

**Verifica**:
```bash
npm run build
```

**Errori comuni**:
- TypeScript errors nei tool
- Missing dependencies
- Import path incorrect

## 📈 Metriche

### Performance Target

- **Build time**: < 30s
- **Test suite completa**: < 30s
- **MCP initialization**: < 5s
- **Tool registration**: < 2s

### Criteri di Successo Deploy

✅ **Tutti i test devono passare:**
- MCP Protocol: ✅
- Authentication: ✅
- Tool Execution: ✅

✅ **Zero errori "Tool execution failed"**

✅ **Compatibilità client MCP** (Claude, Copilot, etc.)

## 🔄 Integrazione CI/CD

### Pre-Deploy Hook

```bash
#!/bin/bash
echo "Running SAP MCP Server test suite..."
npm run test:all

if [ $? -eq 0 ]; then
    echo "✅ All tests passed - proceeding with deployment"
    npm run deploy:btp
else
    echo "❌ Tests failed - blocking deployment"
    exit 1
fi
```

### GitHub Actions

```yaml
- name: Run MCP Test Suite
  run: |
    npm run test:all
  env:
    NODE_ENV: test
```

## 📝 Note di Sviluppo

### Quando Eseguire i Test

🔄 **Sempre eseguire dopo**:
- Modifiche ai tool MCP
- Cambio schema Zod
- Update dependency MCP SDK
- Modifiche al sistema auth
- Token optimization
- Refactoring significativo

### Estendere i Test

Per aggiungere nuovi test:

1. **Nuovo tool test**: Aggiungere a `toolsToTest` in `test-tool-execution.js`
2. **Nuovo schema test**: Estendere `testToolSchemas()`
3. **Nuovo test suite**: Creare file separato e importare in `run-tests.js`

### Best Practices

- 🎯 Test atomici e indipendenti
- ⏱️ Timeout appropriati per ambiente
- 📊 Output chiaro e actionable
- 🔍 Debug info in modalità verbose
- 🚀 Velocità di esecuzione ottimizzata

---

**Versione**: 1.0.0
**Ultima modifica**: 2025-09-15
**Compatibilità**: MCP Protocol 2024-11-05