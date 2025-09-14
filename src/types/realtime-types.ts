/**
 * TypeScript Type Definitions for Phase 3: Real-time Analytics & KPI Dashboard
 * Comprehensive types for WebSocket streaming, KPI monitoring, and real-time BI
 */

import { z } from 'zod';

// ===== REAL-TIME DATA STREAMING =====

export interface StreamingDataPoint {
    timestamp: Date;
    entityType: string;
    serviceId: string;
    data: Record<string, any>;
    metadata?: {
        source: string;
        confidence?: number;
        processingTime?: number;
    };
}

export interface WebSocketConnection {
    id: string;
    clientId: string;
    isActive: boolean;
    subscriptions: StreamSubscription[];
    lastHeartbeat: Date;
    connectionTime: Date;
}

export interface StreamSubscription {
    subscriptionId: string;
    entityType: string;
    serviceId: string;
    filters?: Record<string, any>;
    frequency: StreamingFrequency;
    isActive: boolean;
    lastUpdate: Date;
}

export type StreamingFrequency = 'realtime' | 'high' | 'medium' | 'low';

// ===== KPI DASHBOARD SYSTEM =====

export interface KPIDashboard {
    dashboardId: string;
    name: string;
    description: string;
    owner: string;
    kpis: KPIWidget[];
    layout: DashboardLayout;
    refreshInterval: number; // milliseconds
    isActive: boolean;
    created: Date;
    lastUpdated: Date;
}

export interface KPIWidget {
    widgetId: string;
    name: string;
    type: KPIWidgetType;
    query: KPIQuery;
    visualization: VisualizationConfig;
    alerts?: AlertRule[];
    position: WidgetPosition;
    lastValue?: any;
    trend?: TrendData;
}

export type KPIWidgetType = 
    | 'metric' 
    | 'chart' 
    | 'gauge' 
    | 'table' 
    | 'heatmap' 
    | 'forecast' 
    | 'comparison';

export interface KPIQuery {
    entityType: string;
    serviceId: string;
    aggregation: AggregationType;
    timeWindow: TimeWindow;
    filters?: Record<string, any>;
    groupBy?: string[];
}

export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct';

export interface TimeWindow {
    period: TimePeriod;
    size: number;
    offset?: number;
}

export type TimePeriod = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

// ===== VISUALIZATION & ALERTS =====

export interface VisualizationConfig {
    chartType?: ChartType;
    colors?: string[];
    thresholds?: ThresholdConfig[];
    formatting?: FormatConfig;
    interactive?: boolean;
}

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'bubble';

export interface ThresholdConfig {
    value: number;
    color: string;
    label?: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
}

export interface AlertRule {
    ruleId: string;
    name: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    notification: NotificationConfig;
    isActive: boolean;
}

export interface AlertCondition {
    operator: ComparisonOperator;
    value: number;
    timeWindow: TimeWindow;
    consecutiveViolations?: number;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between';

// ===== REAL-TIME BUSINESS INTELLIGENCE =====

export interface BusinessIntelligenceEngine {
    engineId: string;
    analyzers: AnalyzerConfig[];
    predictiveModels: PredictiveModel[];
    insights: BusinessInsight[];
    performanceMetrics: EngineMetrics;
}

export interface AnalyzerConfig {
    analyzerId: string;
    name: string;
    type: AnalyzerType;
    entityTypes: string[];
    frequency: AnalysisFrequency;
    parameters: Record<string, any>;
    isActive: boolean;
}

export type AnalyzerType = 
    | 'trend_detection' 
    | 'anomaly_detection' 
    | 'pattern_recognition' 
    | 'correlation_analysis' 
    | 'forecast_generation' 
    | 'performance_baseline';

export type AnalysisFrequency = 'continuous' | 'hourly' | 'daily' | 'weekly';

export interface PredictiveModel {
    modelId: string;
    name: string;
    algorithm: MLAlgorithm;
    trainingData: TrainingDataConfig;
    accuracy: number;
    lastTrained: Date;
    predictions: Prediction[];
}

export type MLAlgorithm = 
    | 'linear_regression' 
    | 'time_series' 
    | 'neural_network' 
    | 'decision_tree' 
    | 'random_forest';

export interface Prediction {
    predictionId: string;
    targetMetric: string;
    forecastPeriod: TimeWindow;
    predictedValues: PredictedValue[];
    confidence: number;
    generated: Date;
}

export interface PredictedValue {
    timestamp: Date;
    value: number;
    confidence: number;
    bounds?: {
        lower: number;
        upper: number;
    };
}

// ===== LAYOUT & POSITIONING =====

export interface DashboardLayout {
    columns: number;
    rows: number;
    responsive: boolean;
    theme: DashboardTheme;
}

export interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
}

export type DashboardTheme = 'light' | 'dark' | 'sap_horizon' | 'sap_quartz';

// ===== CONFIGURATION & SETTINGS =====

export interface RealtimeConfig {
    websocket: {
        port: number;
        path: string;
        heartbeatInterval: number;
        maxConnections: number;
        compressionEnabled: boolean;
    };
    streaming: {
        bufferSize: number;
        batchSize: number;
        maxRetries: number;
        retryDelay: number;
    };
    kpi: {
        maxDashboards: number;
        maxWidgetsPerDashboard: number;
        defaultRefreshInterval: number;
        cacheTimeout: number;
    };
    analytics: {
        maxAnalyzers: number;
        maxPredictiveModels: number;
        trainingDataRetention: number; // days
        insightRetention: number; // days
    };
}

export interface EngineMetrics {
    processedEvents: number;
    generatedInsights: number;
    averageProcessingTime: number;
    errorRate: number;
    lastUpdate: Date;
}

// ===== ZOD SCHEMAS FOR MCP TOOLS =====

export const StreamSubscriptionSchema = z.object({
    entityType: z.string().min(1),
    serviceId: z.string().min(1),
    filters: z.record(z.any()).optional(),
    frequency: z.enum(['realtime', 'high', 'medium', 'low']).default('medium')
});

export const KPIDashboardSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    kpis: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(['metric', 'chart', 'gauge', 'table', 'heatmap', 'forecast', 'comparison']),
        entityType: z.string().min(1),
        serviceId: z.string().min(1),
        aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'distinct']),
        timeWindow: z.object({
            period: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']),
            size: z.number().positive()
        })
    })),
    refreshInterval: z.number().positive().default(30000)
});

export const PredictiveAnalysisSchema = z.object({
    entityType: z.string().min(1),
    serviceId: z.string().min(1),
    targetMetric: z.string().min(1),
    forecastPeriod: z.object({
        period: z.enum(['hours', 'days', 'weeks', 'months']),
        size: z.number().positive()
    }),
    algorithm: z.enum(['linear_regression', 'time_series', 'neural_network']).default('time_series'),
    includeConfidenceBounds: z.boolean().default(true)
});

// ===== UTILITY TYPES =====

export interface TrendData {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
    significance: 'high' | 'medium' | 'low';
}

export interface FormatConfig {
    numberFormat?: string;
    dateFormat?: string;
    currency?: string;
    locale?: string;
    precision?: number;
}

export interface NotificationConfig {
    channels: NotificationChannel[];
    template: string;
    throttle?: {
        maxPerHour: number;
        cooldownPeriod: number; // minutes
    };
}

export type NotificationChannel = 'email' | 'webhook' | 'sms' | 'push' | 'slack';

export interface TrainingDataConfig {
    sourceEntities: string[];
    timeRange: TimeWindow;
    features: string[];
    target: string;
    validationSplit: number; // 0-1
}

export interface BusinessInsight {
    insightId: string;
    title: string;
    description: string;
    type: InsightType;
    severity: AlertSeverity;
    confidence: number;
    data: Record<string, any>;
    recommendations?: string[];
    generated: Date;
    expires?: Date;
}

export type InsightType = 
    | 'trend_alert' 
    | 'anomaly_detection' 
    | 'performance_degradation' 
    | 'opportunity' 
    | 'risk_warning' 
    | 'process_optimization';

// ===== EXPORT ALL TYPES =====
export * from './ai-types.js';