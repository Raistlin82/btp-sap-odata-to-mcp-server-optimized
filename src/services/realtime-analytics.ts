/**
 * Phase 3: Real-time Analytics & KPI Dashboard Service
 * Core engine for WebSocket streaming, KPI monitoring, and predictive analytics
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import {
    StreamingDataPoint,
    WebSocketConnection,
    StreamSubscription,
    KPIDashboard,
    KPIWidget,
    BusinessIntelligenceEngine,
    PredictiveModel,
    BusinessInsight,
    RealtimeConfig,
    TrendData,
    StreamingFrequency,
    AnalyzerType,
    InsightType
} from '../types/realtime-types.js';

export class RealtimeAnalyticsService extends EventEmitter {
    private wsServer: WebSocketServer | null = null;
    private connections: Map<string, WebSocketConnection> = new Map();
    private subscriptions: Map<string, StreamSubscription> = new Map();
    private dashboards: Map<string, KPIDashboard> = new Map();
    private dataBuffer: Map<string, StreamingDataPoint[]> = new Map();
    private biEngine: BusinessIntelligenceEngine;
    private config: RealtimeConfig;
    private isInitialized = false;

    constructor(config?: Partial<RealtimeConfig>) {
        super();
        this.config = this.mergeConfig(config);
        this.biEngine = this.initializeBI();
        console.log('info: Realtime Analytics Service initialized');
    }

    private mergeConfig(userConfig?: Partial<RealtimeConfig>): RealtimeConfig {
        const defaultConfig: RealtimeConfig = {
            websocket: {
                port: 8081,
                path: '/realtime',
                heartbeatInterval: 30000,
                maxConnections: 100,
                compressionEnabled: true
            },
            streaming: {
                bufferSize: 1000,
                batchSize: 50,
                maxRetries: 3,
                retryDelay: 1000
            },
            kpi: {
                maxDashboards: 50,
                maxWidgetsPerDashboard: 20,
                defaultRefreshInterval: 30000,
                cacheTimeout: 300000
            },
            analytics: {
                maxAnalyzers: 10,
                maxPredictiveModels: 5,
                trainingDataRetention: 30,
                insightRetention: 7
            }
        };

        return {
            websocket: { ...defaultConfig.websocket, ...userConfig?.websocket },
            streaming: { ...defaultConfig.streaming, ...userConfig?.streaming },
            kpi: { ...defaultConfig.kpi, ...userConfig?.kpi },
            analytics: { ...defaultConfig.analytics, ...userConfig?.analytics }
        };
    }

    private initializeBI(): BusinessIntelligenceEngine {
        return {
            engineId: `bi_engine_${Date.now()}`,
            analyzers: [],
            predictiveModels: [],
            insights: [],
            performanceMetrics: {
                processedEvents: 0,
                generatedInsights: 0,
                averageProcessingTime: 0,
                errorRate: 0,
                lastUpdate: new Date()
            }
        };
    }

    // ===== WEBSOCKET SERVER MANAGEMENT =====

    public async startWebSocketServer(port?: number): Promise<void> {
        if (this.wsServer) {
            throw new Error('WebSocket server is already running');
        }

        const serverPort = port || this.config.websocket.port;
        
        this.wsServer = new WebSocketServer({
            port: serverPort,
            path: this.config.websocket.path,
            perMessageDeflate: this.config.websocket.compressionEnabled
        });

        this.wsServer.on('connection', this.handleConnection.bind(this));
        this.wsServer.on('error', this.handleServerError.bind(this));

        // Start heartbeat interval
        setInterval(this.performHeartbeat.bind(this), this.config.websocket.heartbeatInterval);

        // Start analytics processing
        setInterval(this.processAnalytics.bind(this), 5000);

        this.isInitialized = true;
        console.log(`info: WebSocket server started on port ${serverPort}`);
        this.emit('server:started', { port: serverPort });
    }

    private handleConnection(ws: WebSocket, request: any): void {
        if (this.connections.size >= this.config.websocket.maxConnections) {
            ws.close(1013, 'Maximum connections exceeded');
            return;
        }

        const connectionId = this.generateId('conn');
        const clientId = this.extractClientId(request) || this.generateId('client');

        const connection: WebSocketConnection = {
            id: connectionId,
            clientId,
            isActive: true,
            subscriptions: [],
            lastHeartbeat: new Date(),
            connectionTime: new Date()
        };

        this.connections.set(connectionId, connection);

        ws.on('message', (data) => this.handleMessage(connectionId, data, ws));
        ws.on('close', () => this.handleDisconnection(connectionId));
        ws.on('pong', () => this.updateHeartbeat(connectionId));

        // Send welcome message
        this.sendToConnection(connectionId, {
            type: 'connection:established',
            connectionId,
            clientId,
            timestamp: new Date().toISOString()
        });

        console.log(`info: New WebSocket connection established: ${connectionId}`);
        this.emit('connection:new', { connectionId, clientId });
    }

    private handleMessage(connectionId: string, data: WebSocket.Data, ws: WebSocket): void {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'subscribe':
                    this.handleSubscription(connectionId, message.payload);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscription(connectionId, message.payload);
                    break;
                case 'kpi:create':
                    this.handleKPICreation(connectionId, message.payload);
                    break;
                case 'kpi:update':
                    // KPI update functionality would be implemented here
                    ws.send(JSON.stringify({ type: 'kpi:update', status: 'not_implemented' }));
                    break;
                case 'analytics:predict':
                    this.handlePredictionRequest(connectionId, message.payload);
                    break;
                default:
                    ws.send(JSON.stringify({ error: 'Unknown message type', type: message.type }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
    }

    // ===== SUBSCRIPTION MANAGEMENT =====

    private handleSubscription(connectionId: string, payload: any): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        const subscriptionId = this.generateId('sub');
        const subscription: StreamSubscription = {
            subscriptionId,
            entityType: payload.entityType,
            serviceId: payload.serviceId,
            filters: payload.filters,
            frequency: payload.frequency || 'medium',
            isActive: true,
            lastUpdate: new Date()
        };

        this.subscriptions.set(subscriptionId, subscription);
        connection.subscriptions.push(subscription);

        this.sendToConnection(connectionId, {
            type: 'subscription:confirmed',
            subscriptionId,
            subscription
        });

        console.log(`info: New subscription created: ${subscriptionId} for ${payload.entityType}`);
        this.emit('subscription:created', { subscriptionId, entityType: payload.entityType });
    }

    private handleUnsubscription(connectionId: string, payload: { subscriptionId: string }): void {
        const subscription = this.subscriptions.get(payload.subscriptionId);
        if (!subscription) return;

        subscription.isActive = false;
        this.subscriptions.delete(payload.subscriptionId);

        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.subscriptions = connection.subscriptions.filter(
                sub => sub.subscriptionId !== payload.subscriptionId
            );
        }

        this.sendToConnection(connectionId, {
            type: 'subscription:removed',
            subscriptionId: payload.subscriptionId
        });

        console.log(`info: Subscription removed: ${payload.subscriptionId}`);
    }

    // ===== KPI DASHBOARD MANAGEMENT =====

    private handleKPICreation(connectionId: string, payload: any): void {
        const dashboardId = this.generateId('dashboard');
        
        const dashboard: KPIDashboard = {
            dashboardId,
            name: payload.name,
            description: payload.description || '',
            owner: this.connections.get(connectionId)?.clientId || 'unknown',
            kpis: payload.kpis.map((kpi: any) => ({
                widgetId: this.generateId('widget'),
                name: kpi.name,
                type: kpi.type,
                query: {
                    entityType: kpi.entityType,
                    serviceId: kpi.serviceId,
                    aggregation: kpi.aggregation,
                    timeWindow: kpi.timeWindow,
                    filters: kpi.filters,
                    groupBy: kpi.groupBy
                },
                visualization: kpi.visualization || {},
                alerts: kpi.alerts || [],
                position: kpi.position || { x: 0, y: 0, width: 1, height: 1 }
            })),
            layout: payload.layout || { columns: 12, rows: 8, responsive: true, theme: 'light' },
            refreshInterval: payload.refreshInterval || this.config.kpi.defaultRefreshInterval,
            isActive: true,
            created: new Date(),
            lastUpdated: new Date()
        };

        this.dashboards.set(dashboardId, dashboard);

        this.sendToConnection(connectionId, {
            type: 'kpi:created',
            dashboardId,
            dashboard
        });

        console.log(`info: KPI Dashboard created: ${dashboardId} with ${dashboard.kpis.length} widgets`);
        this.emit('dashboard:created', { dashboardId, widgetCount: dashboard.kpis.length });
    }

    // ===== PREDICTIVE ANALYTICS =====

    private handlePredictionRequest(connectionId: string, payload: any): void {
        const predictionId = this.generateId('prediction');
        
        // Simulate predictive analysis (in real implementation, this would use ML models)
        const prediction = this.generatePrediction(payload);
        
        this.sendToConnection(connectionId, {
            type: 'analytics:prediction',
            predictionId,
            prediction
        });

        console.log(`info: Prediction generated: ${predictionId} for ${payload.entityType}`);
    }

    private generatePrediction(payload: any): any {
        // Simulate time series prediction
        const baseValue = Math.random() * 1000 + 500;
        const predictions = [];
        
        for (let i = 1; i <= payload.forecastPeriod.size; i++) {
            const timestamp = new Date();
            timestamp.setHours(timestamp.getHours() + i);
            
            const trend = (Math.random() - 0.5) * 0.1; // ±5% trend
            const noise = (Math.random() - 0.5) * 0.2; // ±10% noise
            const value = baseValue * (1 + trend * i + noise);
            
            predictions.push({
                timestamp,
                value: Math.round(value),
                confidence: 0.85 - (i * 0.05), // Confidence decreases over time
                bounds: {
                    lower: Math.round(value * 0.9),
                    upper: Math.round(value * 1.1)
                }
            });
        }

        return {
            targetMetric: payload.targetMetric,
            forecastPeriod: payload.forecastPeriod,
            predictedValues: predictions,
            confidence: 0.85,
            generated: new Date(),
            algorithm: payload.algorithm || 'time_series'
        };
    }

    // ===== DATA STREAMING =====

    public streamData(dataPoint: StreamingDataPoint): void {
        const key = `${dataPoint.serviceId}_${dataPoint.entityType}`;
        
        if (!this.dataBuffer.has(key)) {
            this.dataBuffer.set(key, []);
        }
        
        const buffer = this.dataBuffer.get(key)!;
        buffer.push(dataPoint);
        
        // Limit buffer size
        if (buffer.length > this.config.streaming.bufferSize) {
            buffer.shift();
        }

        // Send to matching subscriptions
        this.broadcastToSubscriptions(dataPoint);

        // Process for analytics
        this.processDataForAnalytics(dataPoint);
    }

    private broadcastToSubscriptions(dataPoint: StreamingDataPoint): void {
        for (const [subId, subscription] of this.subscriptions) {
            if (!subscription.isActive) continue;
            
            if (subscription.entityType === dataPoint.entityType &&
                subscription.serviceId === dataPoint.serviceId) {
                
                // Check frequency throttling
                if (this.shouldSendUpdate(subscription)) {
                    this.broadcastToSubscribers(subId, {
                        type: 'data:update',
                        subscriptionId: subId,
                        data: dataPoint,
                        timestamp: new Date().toISOString()
                    });
                    
                    subscription.lastUpdate = new Date();
                }
            }
        }
    }

    private shouldSendUpdate(subscription: StreamSubscription): boolean {
        const now = Date.now();
        const lastUpdate = subscription.lastUpdate.getTime();
        
        const intervals = {
            realtime: 1000,    // 1 second
            high: 5000,        // 5 seconds
            medium: 15000,     // 15 seconds
            low: 60000         // 1 minute
        };
        
        return now - lastUpdate >= intervals[subscription.frequency];
    }

    private broadcastToSubscribers(subscriptionId: string, message: any): void {
        for (const [connId, connection] of this.connections) {
            if (connection.subscriptions.some(sub => sub.subscriptionId === subscriptionId)) {
                this.sendToConnection(connId, message);
            }
        }
    }

    // ===== BUSINESS INTELLIGENCE PROCESSING =====

    private processDataForAnalytics(dataPoint: StreamingDataPoint): void {
        this.biEngine.performanceMetrics.processedEvents++;
        
        // Simple trend analysis
        const trend = this.analyzeTrend(dataPoint);
        if (trend && Math.abs(trend.percentage) > 10) {
            const insight = this.generateTrendInsight(dataPoint, trend);
            this.biEngine.insights.push(insight);
            this.broadcastInsight(insight);
        }
        
        // Anomaly detection
        const anomaly = this.detectAnomaly(dataPoint);
        if (anomaly) {
            const insight = this.generateAnomalyInsight(dataPoint, anomaly);
            this.biEngine.insights.push(insight);
            this.broadcastInsight(insight);
        }
    }

    private analyzeTrend(dataPoint: StreamingDataPoint): TrendData | null {
        // Simplified trend analysis - in production would use more sophisticated algorithms
        const key = `${dataPoint.serviceId}_${dataPoint.entityType}`;
        const buffer = this.dataBuffer.get(key) || [];
        
        if (buffer.length < 10) return null;
        
        const recent = buffer.slice(-5);
        const previous = buffer.slice(-10, -5);
        
        const recentAvg = this.calculateAverage(recent);
        const previousAvg = this.calculateAverage(previous);
        
        if (previousAvg === 0) return null;
        
        const percentage = ((recentAvg - previousAvg) / previousAvg) * 100;
        
        return {
            direction: percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'stable',
            percentage: Math.abs(percentage),
            period: '5min',
            significance: Math.abs(percentage) > 20 ? 'high' : Math.abs(percentage) > 10 ? 'medium' : 'low'
        };
    }

    private calculateAverage(dataPoints: StreamingDataPoint[]): number {
        if (dataPoints.length === 0) return 0;
        
        // Assume we're analyzing a numeric field - in production would be configurable
        const values = dataPoints.map(dp => {
            const numericFields = Object.keys(dp.data).filter(key => 
                typeof dp.data[key] === 'number'
            );
            return numericFields.length > 0 ? dp.data[numericFields[0]] : 0;
        });
        
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    private detectAnomaly(dataPoint: StreamingDataPoint): any {
        // Simple threshold-based anomaly detection
        // In production would use statistical methods or ML
        const numericFields = Object.keys(dataPoint.data).filter(key => 
            typeof dataPoint.data[key] === 'number'
        );
        
        for (const field of numericFields) {
            const value = dataPoint.data[field];
            if (value > 10000 || value < -1000) { // Simple threshold
                return {
                    field,
                    value,
                    threshold: value > 0 ? 10000 : -1000,
                    severity: value > 50000 || value < -5000 ? 'high' : 'medium'
                };
            }
        }
        
        return null;
    }

    private generateTrendInsight(dataPoint: StreamingDataPoint, trend: TrendData): BusinessInsight {
        return {
            insightId: this.generateId('insight'),
            title: `Trend Alert: ${dataPoint.entityType}`,
            description: `${trend.direction.toUpperCase()} trend detected: ${trend.percentage.toFixed(1)}% change over ${trend.period}`,
            type: 'trend_alert',
            severity: trend.significance === 'high' ? 'high' : 'medium',
            confidence: 0.8,
            data: { dataPoint, trend },
            recommendations: [
                `Monitor ${dataPoint.entityType} closely for continued ${trend.direction}ward movement`,
                'Consider adjusting thresholds or scaling resources if trend continues'
            ],
            generated: new Date(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
    }

    private generateAnomalyInsight(dataPoint: StreamingDataPoint, anomaly: any): BusinessInsight {
        return {
            insightId: this.generateId('insight'),
            title: `Anomaly Detected: ${dataPoint.entityType}`,
            description: `Unusual value detected for ${anomaly.field}: ${anomaly.value} (threshold: ${anomaly.threshold})`,
            type: 'anomaly_detection',
            severity: anomaly.severity === 'high' ? 'critical' : 'high',
            confidence: 0.9,
            data: { dataPoint, anomaly },
            recommendations: [
                'Investigate the cause of this anomalous value',
                'Check system health and data quality',
                'Consider updating anomaly detection thresholds'
            ],
            generated: new Date(),
            expires: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
        };
    }

    private broadcastInsight(insight: BusinessInsight): void {
        const message = {
            type: 'insight:generated',
            insight
        };

        // Broadcast to all connected clients
        for (const connectionId of this.connections.keys()) {
            this.sendToConnection(connectionId, message);
        }

        this.biEngine.performanceMetrics.generatedInsights++;
        console.log(`info: Business insight generated and broadcast: ${insight.insightId}`);
    }

    private processAnalytics(): void {
        // Periodic cleanup and maintenance
        this.cleanupExpiredInsights();
        this.updatePerformanceMetrics();
    }

    private cleanupExpiredInsights(): void {
        const now = new Date();
        this.biEngine.insights = this.biEngine.insights.filter(insight => 
            !insight.expires || insight.expires > now
        );
    }

    private updatePerformanceMetrics(): void {
        this.biEngine.performanceMetrics.lastUpdate = new Date();
        // Additional metrics updates would go here
    }

    // ===== UTILITY METHODS =====

    private sendToConnection(connectionId: string, message: any): void {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.isActive) return;

        // Find the WebSocket for this connection
        if (this.wsServer) {
            this.wsServer.clients.forEach((ws: WebSocket) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            });
        }
    }

    private performHeartbeat(): void {
        if (!this.wsServer) return;

        this.wsServer.clients.forEach((ws: WebSocket) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        });

        // Cleanup inactive connections
        const now = new Date();
        for (const [connId, connection] of this.connections) {
            const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
            if (timeSinceHeartbeat > this.config.websocket.heartbeatInterval * 2) {
                this.handleDisconnection(connId);
            }
        }
    }

    private updateHeartbeat(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.lastHeartbeat = new Date();
        }
    }

    private handleDisconnection(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (connection) {
            // Clean up subscriptions
            connection.subscriptions.forEach(sub => {
                this.subscriptions.delete(sub.subscriptionId);
            });
            
            this.connections.delete(connectionId);
            console.log(`info: WebSocket connection closed: ${connectionId}`);
            this.emit('connection:closed', { connectionId });
        }
    }

    private handleServerError(error: Error): void {
        console.error('WebSocket server error:', error);
        this.emit('server:error', error);
    }

    private extractClientId(request: any): string | null {
        // Extract client ID from headers or query parameters
        return request.headers['x-client-id'] || null;
    }

    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ===== PUBLIC API METHODS =====

    public async stop(): Promise<void> {
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        this.connections.clear();
        this.subscriptions.clear();
        this.isInitialized = false;
        console.log('info: Realtime Analytics Service stopped');
    }

    public getStatus(): any {
        return {
            isInitialized: this.isInitialized,
            connections: this.connections.size,
            subscriptions: this.subscriptions.size,
            dashboards: this.dashboards.size,
            insights: this.biEngine.insights.length,
            performanceMetrics: this.biEngine.performanceMetrics
        };
    }

    public getDashboards(): KPIDashboard[] {
        return Array.from(this.dashboards.values());
    }

    public getInsights(): BusinessInsight[] {
        return this.biEngine.insights;
    }

    public simulateDataStream(entityType: string, serviceId: string, count: number = 10): void {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const dataPoint: StreamingDataPoint = {
                    timestamp: new Date(),
                    entityType,
                    serviceId,
                    data: {
                        id: `item_${Date.now()}_${i}`,
                        value: Math.random() * 1000 + 100,
                        status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)],
                        amount: Math.random() * 5000 + 500
                    },
                    metadata: {
                        source: 'simulator',
                        confidence: 0.95,
                        processingTime: Math.random() * 100 + 10
                    }
                };
                this.streamData(dataPoint);
            }, i * 2000); // 2 second intervals
        }
    }
}