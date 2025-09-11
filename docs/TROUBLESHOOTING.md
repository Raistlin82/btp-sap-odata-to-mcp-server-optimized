# Troubleshooting Guide

> **Reference to Original Project**  
> This troubleshooting guide extends the support for [@lemaiwo](https://github.com/lemaiwo)'s [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with enhanced diagnostics and solutions.

## 🔍 Quick Diagnostics

### Health Check First

Always start with the health check endpoint to get an overview of system status:

```bash
curl https://your-app.cfapps.region.hana.ondemand.com/health | jq
```

### Common Quick Fixes

| Issue | Quick Fix | Command |
|-------|-----------|---------|
| App not responding | Restart app | `cf restart sap-mcp-server-prod` |
| Memory issues | Scale memory | `cf scale sap-mcp-server-prod -m 1G` |
| Service binding issues | Restage app | `cf restage sap-mcp-server-prod` |
| Session expired | Re-authenticate | Navigate to `/auth/` |

## 🔐 Authentication Issues

### Issue: "SESSION_ID_REQUIRED" Error

**Symptoms**:
- MCP tools return authentication required error
- Session ID not provided in tool calls

**Root Causes**:
1. No session ID provided in tool arguments
2. Using public tools that don't need authentication (false positive)
3. Client not configured to pass session ID

**Solutions**:

1. **Get Session ID via Web Authentication**:
   ```bash
   # Navigate to authentication URL
   open https://your-app.cfapps.region.hana.ondemand.com/auth/
   
   # Follow SAP IAS login process
   # Copy Session ID from success page
   ```

2. **Verify Tool Requirements**:
   ```bash
   # Check if tool actually requires authentication
   curl https://your-app.cfapps.region.hana.ondemand.com/health | jq '.checks'
   ```

3. **Configure MCP Client**:
   ```json
   {
     "tool": "execute-entity-operation",
     "arguments": {
       "session_id": "your-session-id-here",
       "serviceId": "s4hana-cloud",
       "entityName": "A_BusinessPartner",
       "operation": "read"
     }
   }
   ```

### Issue: "SESSION_EXPIRED" Error

**Symptoms**:
- Previously working session ID now fails
- Authentication required despite having session ID

**Root Causes**:
1. Session timeout (default 1 hour)
2. Server restart cleared sessions
3. User logged out from another session

**Solutions**:

1. **Check Session Status**:
   ```bash
   curl -H "Cookie: sessionId=your-session-id" \
        https://your-app.cfapps.region.hana.ondemand.com/auth/status
   ```

2. **Re-authenticate**:
   ```bash
   # Navigate to auth URL for new session
   open https://your-app.cfapps.region.hana.ondemand.com/auth/
   ```

3. **Extend Session Timeout** (Admin):
   ```bash
   cf set-env sap-mcp-server-prod SESSION_TIMEOUT "7200000"  # 2 hours
   cf restart sap-mcp-server-prod
   ```

### Issue: "INSUFFICIENT_PERMISSIONS" Error

**Symptoms**:
- User authenticated but cannot access certain tools
- Permission denied errors for specific operations

**Root Causes**:
1. User not assigned to proper role collections
2. Missing scopes in XSUAA configuration
3. IAS to XSUAA token exchange failed

**Solutions**:

1. **Check User Role Collections** (BTP Cockpit):
   ```
   Security → Role Collections → Check user assignments
   ```

2. **Verify Role Collection Configuration**:
   ```json
   // In xs-security.json
   {
     "role-collections": [
       {
         "name": "MCPAdministrator",
         "role-template-references": ["$XSAPPNAME.MCPAdmin"]
       }
     ]
   }
   ```

3. **Update Service Configuration**:
   ```bash
   cf update-service sap-mcp-xsuaa -c xs-security.json
   cf restage sap-mcp-server-prod
   ```

### Issue: SAP IAS Configuration Problems

**Symptoms**:
- OAuth2 redirect failures
- IAS authentication page not loading
- Invalid client credentials errors

**Root Causes**:
1. Incorrect redirect URLs in IAS application
2. Wrong client ID/secret in environment variables
3. IAS application not properly configured

**Solutions**:

1. **Verify IAS Application Configuration**:
   ```
   Redirect URLs should include:
   - https://your-app.cfapps.region.hana.ondemand.com/auth/callback
   - http://localhost:8080/auth/callback (for local dev)
   ```

2. **Check Environment Variables**:
   ```bash
   cf env sap-mcp-server-prod | grep SAP_IAS
   ```

3. **Test IAS Connectivity**:
   ```bash
   curl "https://your-tenant.accounts.ondemand.com/.well-known/openid_configuration"
   ```

## 🌐 Connectivity Issues

### Issue: "DESTINATION_ERROR" - Cannot Connect to SAP Systems

**Symptoms**:
- Tools fail with connectivity errors
- "Destination not found" messages
- Connection timeout errors

**Root Causes**:
1. Destination not configured in BTP
2. Cloud Connector not running/misconfigured
3. Network connectivity issues
4. Authentication problems with SAP systems

**Solutions**:

1. **Verify Destination Configuration** (BTP Cockpit):
   ```
   Connectivity → Destinations → Check destination details
   ```

2. **Test Destination from BTP**:
   ```
   Connectivity → Destinations → Check Connection
   ```

3. **Check Cloud Connector Status** (On-Premise):
   ```bash
   # On Cloud Connector system
   sudo systemctl status scc_daemon
   
   # Check exposed systems
   # Access Cloud Connector UI at https://localhost:8443
   ```

4. **Test Connectivity from App**:
   ```bash
   cf ssh sap-mcp-server-prod
   curl -v https://your-sap-system.com/sap/opu/odata/sap/
   ```

5. **Check Connectivity Service Binding**:
   ```bash
   cf env sap-mcp-server-prod | grep -A 20 '"connectivity"'
   ```

### Issue: "PRINCIPAL_PROPAGATION_FAILED" Error

**Symptoms**:
- User authentication successful but SAP system access denied
- Principal propagation errors in logs
- User context not passed to SAP systems

**Root Causes**:
1. Certificate trust issues between IAS and SAP system
2. User not provisioned in SAP backend
3. Principal propagation not configured correctly

**Solutions**:

1. **Check IAS Trust Configuration** (SAP System):
   ```
   STRUSTSSO2 → Check IAS certificate import
   ```

2. **Verify User Provisioning**:
   ```
   SU01 → Check if IAS user ID exists in SAP system
   ```

3. **Test Principal Propagation**:
   ```bash
   # Check logs for principal propagation details
   cf logs sap-mcp-server-prod --recent | grep "principal"
   ```

4. **Configure Destination for Principal Propagation**:
   ```json
   {
     "Name": "S4HANA_SYSTEM",
     "Authentication": "PrincipalPropagation",
     "TrustAll": "false",
     "sap-client": "100"
   }
   ```

### Issue: SSL/Certificate Problems

**Symptoms**:
- SSL handshake failures
- Certificate validation errors
- HTTPS connection refused

**Solutions**:

1. **Check Certificate Configuration**:
   ```bash
   # Test SSL connection
   openssl s_client -connect your-sap-system.com:443 -servername your-sap-system.com
   ```

2. **Update Destination with Certificate**:
   ```json
   {
     "TrustAll": "false",
     "TrustStore": "your-certificate-content",
     "TrustStorePassword": "password"
   }
   ```

3. **Check Cloud Connector Certificate**:
   ```
   Cloud Connector UI → Configuration → On Premise → Certificate
   ```

## 🚀 Performance Issues

### Issue: Slow Response Times

**Symptoms**:
- MCP tools taking longer than 30 seconds
- Timeout errors
- High memory usage

**Root Causes**:
1. Large data sets without proper filtering
2. Missing indexes on SAP system
3. Network latency issues
4. Insufficient app resources

**Solutions**:

1. **Add Query Filters**:
   ```json
   {
     "queryOptions": {
       "$filter": "BusinessPartnerCategory eq '1'",
       "$top": 100,
       "$select": "BusinessPartner,BusinessPartnerFullName"
     }
   }
   ```

2. **Increase App Resources**:
   ```bash
   cf scale sap-mcp-server-prod -m 1G
   cf scale sap-mcp-server-prod -i 2
   ```

3. **Enable Caching**:
   ```bash
   cf set-env sap-mcp-server-prod ENABLE_CACHING "true"
   cf set-env sap-mcp-server-prod CACHE_TTL "1800000"
   cf restart sap-mcp-server-prod
   ```

4. **Check App Performance**:
   ```bash
   cf app sap-mcp-server-prod
   cf events sap-mcp-server-prod
   ```

### Issue: Memory Leaks

**Symptoms**:
- Gradual memory increase over time
- App crashes with out-of-memory errors
- Performance degradation

**Solutions**:

1. **Monitor Memory Usage**:
   ```bash
   # Check app stats
   cf app sap-mcp-server-prod
   
   # Check health endpoint
   curl https://your-app.cfapps.region.hana.ondemand.com/health | jq '.checks.memory'
   ```

2. **Enable Session Cleanup**:
   ```bash
   cf set-env sap-mcp-server-prod SESSION_CLEANUP_INTERVAL "300000"  # 5 minutes
   cf restart sap-mcp-server-prod
   ```

3. **Increase Memory Limit**:
   ```bash
   cf scale sap-mcp-server-prod -m 1G
   ```

4. **Check for Memory Leaks**:
   ```bash
   # Enable debug logging
   cf set-env sap-mcp-server-prod LOG_LEVEL "debug"
   cf restart sap-mcp-server-prod
   
   # Monitor logs for memory patterns
   cf logs sap-mcp-server-prod | grep -i memory
   ```

## 🔧 Service Issues

### Issue: SAP Cloud Logging "degraded"

**Symptoms**:
- Health check shows cloud logging as degraded
- Logs not appearing in SAP Cloud Logging dashboard
- Fallback logging being used

**Root Causes**:
1. Cloud logging service not bound
2. Service binding configuration issues
3. Service instance problems

**Solutions**:

1. **Check Service Binding**:
   ```bash
   cf services
   cf env sap-mcp-server-prod | grep cloud-logging
   ```

2. **Bind Cloud Logging Service**:
   ```bash
   cf bind-service sap-mcp-server-prod sap-mcp-cloud-logging
   cf restage sap-mcp-server-prod
   ```

3. **Verify Service Instance**:
   ```bash
   cf service sap-mcp-cloud-logging
   ```

4. **Check Cloud Logging Dashboard**:
   ```
   BTP Cockpit → Services → Cloud Logging → Open Dashboard
   ```

### Issue: XSUAA Service Problems

**Symptoms**:
- Authentication fails with XSUAA errors
- Token exchange failures
- Service binding errors

**Solutions**:

1. **Check XSUAA Service Status**:
   ```bash
   cf service sap-mcp-xsuaa
   ```

2. **Update Security Configuration**:
   ```bash
   cf update-service sap-mcp-xsuaa -c xs-security.json
   ```

3. **Rebind XSUAA Service**:
   ```bash
   cf unbind-service sap-mcp-server-prod sap-mcp-xsuaa
   cf bind-service sap-mcp-server-prod sap-mcp-xsuaa
   cf restage sap-mcp-server-prod
   ```

4. **Check Service Key**:
   ```bash
   cf create-service-key sap-mcp-xsuaa debug-key
   cf service-key sap-mcp-xsuaa debug-key
   ```

## 📊 Data Issues

### Issue: "ENTITY_NOT_FOUND" Errors

**Symptoms**:
- Specific entities cannot be found
- Service discovery works but entity access fails
- Metadata shows entity but queries fail

**Root Causes**:
1. Entity name case sensitivity
2. Authorization issues for specific entities
3. Entity not available in connected system
4. Service configuration mismatch

**Solutions**:

1. **Verify Entity Name Case**:
   ```bash
   # Check exact entity names from service metadata
   curl -H "sessionId: your-session-id" \
        "https://your-app/api/discover-service-entities?serviceId=s4hana"
   ```

2. **Test Direct OData Access**:
   ```bash
   # Test direct access to SAP system
   curl -u "user:pass" \
        "https://your-sap-system.com/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner"
   ```

3. **Check SAP Authorizations**:
   ```
   SAP System → SU53 → Check authorization failures for user
   ```

4. **Verify Service Configuration**:
   ```json
   // Check service-discovery-config.json
   {
     "services": [{
       "entitySets": [{
         "name": "A_BusinessPartner",  // Exact case-sensitive name
         "path": "API_BUSINESS_PARTNER/A_BusinessPartner"
       }]
     }]
   }
   ```

### Issue: OData Query Errors

**Symptoms**:
- Complex queries fail
- Filter expressions not working
- Navigation properties fail

**Root Causes**:
1. Incorrect OData syntax
2. SAP system version limitations
3. Entity relationship issues
4. Data type mismatches

**Solutions**:

1. **Validate OData Query Syntax**:
   ```bash
   # Test simple query first
   {
     "queryOptions": {
       "$top": 1
     }
   }
   
   # Add filters incrementally
   {
     "queryOptions": {
       "$filter": "BusinessPartner eq '0000100001'",
       "$top": 1
     }
   }
   ```

2. **Check SAP System OData Version**:
   ```bash
   # Test metadata endpoint
   curl "https://your-sap-system.com/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata"
   ```

3. **Use OData Query Builder Tools**:
   - SAP Gateway Service Builder (SEGW)
   - Postman OData collections
   - Online OData query validators

## 🔄 Deployment Issues

### Issue: App Won't Start After Deployment

**Symptoms**:
- `cf push` succeeds but app crashes on startup
- Health checks fail immediately
- App shows as crashed

**Root Causes**:
1. Missing environment variables
2. Service binding issues
3. Build problems
4. Port configuration issues

**Solutions**:

1. **Check App Logs**:
   ```bash
   cf logs sap-mcp-server-prod --recent
   cf events sap-mcp-server-prod
   ```

2. **Verify Environment Variables**:
   ```bash
   cf env sap-mcp-server-prod | grep -E "(SAP_IAS|PORT|NODE_ENV)"
   ```

3. **Check Service Bindings**:
   ```bash
   cf services
   cf env sap-mcp-server-prod | grep VCAP_SERVICES
   ```

4. **Test Local Build**:
   ```bash
   npm run build
   node dist/index.js
   ```

5. **Check manifest.yml**:
   ```yaml
   applications:
   - name: sap-mcp-server-prod
     health-check-type: http
     health-check-http-endpoint: /health
     timeout: 180
   ```

### Issue: Health Check Failures

**Symptoms**:
- App starts but fails health checks
- Router shows app as unhealthy
- Intermittent 503 errors

**Solutions**:

1. **Test Health Endpoint Manually**:
   ```bash
   cf ssh sap-mcp-server-prod
   curl localhost:8080/health
   ```

2. **Increase Health Check Timeout**:
   ```yaml
   # In manifest.yml
   health-check-invocation-timeout: 120
   ```

3. **Check App Startup Time**:
   ```bash
   cf logs sap-mcp-server-prod | grep -i "ready\|started"
   ```

4. **Verify Health Check Endpoint**:
   ```bash
   curl https://your-app.cfapps.region.hana.ondemand.com/health
   ```

## 🔍 Debugging Tools

### Log Analysis

**View Recent Logs**:
```bash
cf logs sap-mcp-server-prod --recent
```

**Follow Live Logs**:
```bash
cf logs sap-mcp-server-prod
```

**Filter Logs by Component**:
```bash
cf logs sap-mcp-server-prod | grep "AuthServer"
cf logs sap-mcp-server-prod | grep "ERROR"
```

### SSH Access for Debug

**SSH into App Container**:
```bash
cf enable-ssh sap-mcp-server-prod
cf ssh sap-mcp-server-prod
```

**Debug Network Connectivity**:
```bash
# Inside app container
curl -v https://your-sap-system.com
ping your-sap-system.com
nslookup your-sap-system.com
```

### Environment Inspection

**Check All Environment Variables**:
```bash
cf env sap-mcp-server-prod
```

**Check Specific Variables**:
```bash
cf env sap-mcp-server-prod | grep -A 5 -B 5 "SAP_IAS"
```

### Service Debugging

**Check Service Instance Details**:
```bash
cf service sap-mcp-xsuaa
cf service sap-mcp-connectivity  
cf service sap-mcp-destination
cf service sap-mcp-cloud-logging
```

**Create Debug Service Keys**:
```bash
cf create-service-key sap-mcp-xsuaa debug-key
cf service-key sap-mcp-xsuaa debug-key
```

## 📞 Getting Help

### Collect Diagnostic Information

**Create Support Package**:
```bash
#!/bin/bash
# collect-diagnostics.sh

echo "=== App Status ===" > diagnostics.txt
cf app sap-mcp-server-prod >> diagnostics.txt

echo -e "\n=== App Events ===" >> diagnostics.txt
cf events sap-mcp-server-prod >> diagnostics.txt

echo -e "\n=== Services ===" >> diagnostics.txt
cf services >> diagnostics.txt

echo -e "\n=== Environment ===" >> diagnostics.txt
cf env sap-mcp-server-prod >> diagnostics.txt

echo -e "\n=== Recent Logs ===" >> diagnostics.txt
cf logs sap-mcp-server-prod --recent >> diagnostics.txt

echo -e "\n=== Health Check ===" >> diagnostics.txt
curl -s https://your-app.cfapps.region.hana.ondemand.com/health >> diagnostics.txt

echo "Diagnostics collected in diagnostics.txt"
```

### Support Channels

1. **Original Project Issues**: [btp-sap-odata-to-mcp-server Issues](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server/issues)
2. **SAP Community**: [SAP BTP Topics](https://community.sap.com/topics/business-technology-platform)
3. **SAP Support**: If you have enterprise support contract
4. **Stack Overflow**: Tag with `sap-btp`, `odata`, `mcp-protocol`

### Provide Debug Information

When seeking help, always include:

- [ ] **Error messages** (exact text)
- [ ] **App logs** (recent 100 lines)
- [ ] **Health check output**
- [ ] **Environment details** (Node.js version, CF buildpack)
- [ ] **Configuration** (manifest.yml, environment variables - sanitized)
- [ ] **Steps to reproduce** the issue
- [ ] **Expected vs actual behavior**

---

**📖 Related Documentation**:
- [Configuration Guide](CONFIGURATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Reference](API_REFERENCE.md)
- [Architecture Overview](ARCHITECTURE.md)