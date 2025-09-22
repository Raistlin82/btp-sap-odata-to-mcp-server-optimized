# MCP Client Compatibility Guide

## Problem Overview

Some MCP clients (non-Claude) may have difficulties with:
1. **Complex UI suggestions** embedded in tool responses
2. **Verbose formatted responses** with emoji and markdown
3. **Workflow recommendations** that assume Claude's capabilities
4. **Large response payloads** with extensive suggestions

## Solution: Legacy Client List (Inverted Logic)

### Default: Full Features for Everyone

**By default, ALL clients receive full features (UI suggestions, rich formatting, verbose responses)**

### Legacy Client List (Exception Handling)

**Only clients listed in the legacy list receive compatibility mode:**

```bash
# Define which client patterns need legacy/compatibility mode (default: cline,windsurf,inspector)
# Uses 'contains' matching against User-Agent
MCP_LEGACY_CLIENTS=cline,windsurf,inspector,old-client
```

**Behavior:**
- ✅ **ALL clients: Full features by default** (UI suggestions, rich formatting, verbose responses)
- ⚠️ **Only clients in legacy list: Compatibility mode** (based on settings below)
- ✅ **Unknown/empty clients: Full features** (backward compatibility)

### Compatibility Settings (For Legacy Clients Only)

These settings only apply to clients IN `MCP_LEGACY_CLIENTS`:

```bash
# Settings below are applied ONLY to clients in MCP_LEGACY_CLIENTS
# All other clients receive full features regardless of these settings

# Disable UI suggestions for legacy clients (default: false = enabled)
MCP_DISABLE_UI_SUGGESTIONS=true

# Use simplified responses for legacy clients (default: false = normal)
MCP_SIMPLIFIED_RESPONSES=true

# Use minimal formatting for legacy clients (default: false = rich)
MCP_MINIMAL_FORMATTING=true

# Limit response size for legacy clients (default: unlimited)
MCP_MAX_RESPONSE_LENGTH=5000

# Force UI suggestions even for legacy clients (default: false)
MCP_FORCE_UI_SUGGESTIONS=true
```

### Automatic Client Detection

The server automatically detects client types and applies behavior based on configuration:

| Detection Logic | Behavior |
|-----------------|----------|
| Client ID in `MCP_LEGACY_CLIENTS` | ⚠️ **Compatibility mode** (simplified responses based on settings) |
| Client ID NOT in list (default) | ✅ **Full features** (UI suggestions, rich formatting, verbose responses) |

**Client Detection Logic:**
- Uses **'contains' matching** against User-Agent header
- Examples: `User-Agent: "Cline/1.0 VSCode Extension"` → matches `cline` pattern in legacy list
- **Unknown/empty User-Agent** → defaults to **full features** (not in legacy list)

**Common Legacy Client Patterns:**
- `cline` - Matches User-Agents containing 'cline' → gets compatibility mode
- `windsurf` - Matches User-Agents containing 'windsurf' → gets compatibility mode
- `inspector` - Matches User-Agents containing 'mcp-inspector' → gets compatibility mode
- **All other clients** (including `claude`, `generic`, unknown) → get **full features**

### Configuration Examples

#### Default Setup (All Clients Get Full Features)

Default configuration - no configuration needed:

```bash
# Default legacy clients that need compatibility mode
MCP_LEGACY_CLIENTS=cline,windsurf,inspector

# All other clients (Claude, generic, unknown, custom) get full features automatically
# No additional configuration needed!
```

#### Add More Clients to Legacy List

To force specific clients into compatibility mode:

```bash
# Add problematic clients to legacy list
MCP_LEGACY_CLIENTS=cline,windsurf,inspector,old-client,problematic-ai

# Configure compatibility settings for these clients only
MCP_SIMPLIFIED_RESPONSES=true
MCP_MINIMAL_FORMATTING=true
```

#### Empty Legacy List (All Clients Get Full Features)

To give ALL clients full features:

```bash
# No legacy clients - everyone gets full features
MCP_LEGACY_CLIENTS=

# Compatibility settings are ignored since no clients are in legacy list
```

#### Testing Legacy Mode

Test how specific clients behave in legacy mode:

```bash
# Force Claude into legacy mode for testing
MCP_LEGACY_CLIENTS=claude,cline,windsurf

# Configure legacy mode behavior
MCP_SIMPLIFIED_RESPONSES=true
MCP_MINIMAL_FORMATTING=true
```

### Response Format Differences

#### Default Client Response (Full Features)

All clients get this by default:

```json
{
  "result": {
    "services": [...],
    "uiSuggestions": "## 🎨 Suggerimenti UI Interattivi\n...",
    "recommendedTools": ["ui-data-grid", "ui-form-generator"],
    "nextSteps": "Use ui-data-grid for visualization..."
  },
  "description": "Found 5 services with detailed suggestions"
}
```

#### Legacy Client Response (Compatibility Mode)

Only clients in `MCP_LEGACY_CLIENTS` get this:

```json
{
  "success": true,
  "tool": "search-sap-services",
  "data": {
    "services": [...],
    "count": 5
  },
  "timestamp": "2025-09-22T00:30:00.000Z"
}
```

### Tool Description Adaptation

Tools descriptions are automatically simplified for legacy clients only:

- **Default clients**: Full descriptions with examples, emoji, detailed formatting
- **Legacy clients**: Simplified descriptions with removed examples, emoji, limited to 300 characters
- Focus: Core functionality only for legacy clients

### Troubleshooting

#### Client not following workflow

**Solution**: Add client to legacy list

```bash
MCP_LEGACY_CLIENTS=cline,windsurf,inspector,problematic-client
MCP_SIMPLIFIED_RESPONSES=true
MCP_DISABLE_UI_SUGGESTIONS=true
```

#### Responses too large for some clients

**Solution**: Add clients to legacy list and limit size

```bash
MCP_LEGACY_CLIENTS=cline,windsurf,inspector,slow-client
MCP_MAX_RESPONSE_LENGTH=5000
```

#### Client parsing errors

**Solution**: Add client to legacy list with minimal formatting

```bash
MCP_LEGACY_CLIENTS=cline,windsurf,inspector,old-parser
MCP_MINIMAL_FORMATTING=true
```

### Testing Compatibility

Test with different client modes:

```bash
# Test as generic client (full features by default)
curl -H "User-Agent: generic-mcp-client" http://localhost:3000/mcp/tools

# Test as Cline (legacy mode by default)
curl -H "User-Agent: cline/1.0" http://localhost:3000/mcp/tools

# Test as Claude (full features by default)
curl -H "User-Agent: Claude/1.0" http://localhost:3000/mcp/tools

# Test as custom client (full features by default)
curl -H "User-Agent: MyCustomAI/2.0" http://localhost:3000/mcp/tools
```

### Implementation Status

- [x] Legacy client detection module with inverted logic
- [x] Client-specific response formatting
- [x] Environment variable configuration with MCP_LEGACY_CLIENTS
- [ ] Integration with existing tool registry (pending)
- [ ] Testing with various MCP clients (pending)

## Recommendations

1. **Default to full features** for maximum functionality
2. **Add problematic clients to legacy list** only when needed
3. **Test with target clients** before adding to legacy list
4. **Monitor client behavior** to identify clients that need legacy mode

## Future Improvements

1. **Client capability negotiation** during handshake
2. **Per-tool compatibility settings**
3. **Response streaming** for large datasets
4. **Client-specific tool filtering**
