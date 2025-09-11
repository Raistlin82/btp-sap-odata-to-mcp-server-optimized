/**
 * AI and Analytics Types for SAP MCP Server
 * Compatible with any MCP client (Claude, GPT, Gemini, local models, etc.)
 */

// Query Intelligence Types
export interface QueryIntent {
    operation: 'read' | 'filter' | 'aggregate' | 'search';
    fields: string[];
    filters: FilterCondition[];
    orderBy?: OrderByCondition[];
    businessContext: string;
    confidence: number;
}

export interface FilterCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'contains' | 'startswith' | 'endswith';
    value: any;
    logicalOperator?: 'and' | 'or';
}

export interface OrderByCondition {
    field: string;
    direction: 'asc' | 'desc';
}

export interface OptimizedQuery {
    url: string;
    explanation: string;
    cacheStrategy: 'none' | 'short' | 'medium' | 'long';
    estimatedRows: number;
    confidence: number;
}

// Analytics Types
export interface AnalysisResult {
    insights: BusinessInsight[];
    recommendations: Recommendation[];
    confidence: number;
    visualizations: ChartConfig[];
    alerts: BusinessAlert[];
    metadata: {
        analyzedAt: Date;
        dataPoints: number;
        processingTime: number;
    };
}

export interface BusinessInsight {
    type: 'trend' | 'anomaly' | 'correlation' | 'forecast' | 'risk';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
    supportingData: any[];
}

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    estimatedImpact: string;
    actionable: boolean;
    requiredActions: string[];
}

// Real-time Streaming Types
export interface StreamingQuery {
    id: string;
    entitySet: string;
    filters: string;
    pollInterval: number;
    lastUpdate: Date;
    subscribers: Set<string>;
    intervalId?: NodeJS.Timeout;
    isActive: boolean;
}

export interface StreamingEvent {
    streamId: string;
    data: EnrichedDataPoint[];
    timestamp: Date;
    changeType: 'create' | 'update' | 'delete' | 'bulk_update';
    affectedRecords: number;
}

export interface EnrichedDataPoint {
    [key: string]: any;
    _analytics: {
        insights: BusinessInsight[];
        riskScore: number;
        trends: TrendData[];
        recommendations: Recommendation[];
    };
    _timestamp: Date;
    _changeType: 'create' | 'update' | 'delete';
    _confidence: number;
}

// Anomaly Detection Types
export interface AnomalyReport {
    id: string;
    entitySet: string;
    anomalyType: 'volume' | 'value' | 'pattern' | 'process';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    detectedAt: Date;
    dataPoints: any[];
    confidence: number;
    businessImpact: string;
    recommendedActions: string[];
    correlatedAnomalies: string[];
}

export interface AnomalyConfiguration {
    entitySet: string;
    enabled: boolean;
    sensitivity: 'high' | 'medium' | 'low';
    alertThresholds: {
        critical: number;
        high: number;
        medium: number;
    };
    monitoringFields: string[];
    businessRules: BusinessRule[];
}

// Dashboard Types
export interface DashboardConfig {
    userId: string;
    role: string;
    widgets: Widget[];
    layout: 'single-column' | 'two-column' | 'grid' | 'tabs';
    refreshStrategy: RefreshStrategy;
    alerts: AlertConfiguration[];
    personalizations: PersonalizationSettings;
}

export interface Widget {
    id: string;
    title: string;
    type: 'chart' | 'table' | 'kpi' | 'gauge' | 'text' | 'alert';
    position: { x: number; y: number; width: number; height: number };
    dataSource: DataSource;
    config: WidgetConfig;
    permissions: string[];
}

export interface DataSource {
    type: 'sap-odata' | 'realtime-stream' | 'aggregated' | 'computed';
    query?: string;
    streamId?: string;
    refreshInterval?: number;
    transformFunction?: (data: any[]) => Promise<any>;
    cacheEnabled: boolean;
}

export interface WidgetConfig {
    refreshInterval: number;
    autoRefresh: boolean;
    drillDown: boolean;
    exportEnabled: boolean;
    filterEnabled: boolean;
    chartOptions?: ChartConfig;
    alertThresholds?: AlertThreshold[];
}

// Chart and Visualization Types
export interface ChartConfig {
    type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polar' | 'scatter' | 'bubble';
    data: ChartData;
    options: ChartOptions;
}

export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

export interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
}

export interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio?: boolean;
    plugins?: {
        legend?: { position: 'top' | 'bottom' | 'left' | 'right' };
        title?: { display: boolean; text: string };
        tooltip?: any;
    };
    scales?: any;
    interaction?: any;
    animation?: any;
}

// Business Rules and Automation Types
export interface BusinessRule {
    id: string;
    name: string;
    description: string;
    trigger: RuleTrigger;
    conditions: RuleCondition[];
    actions: RuleAction[];
    priority: number;
    enabled: boolean;
    createdAt: Date;
    lastExecuted?: Date;
    executionCount: number;
}

export interface RuleTrigger {
    type: 'data_change' | 'time_based' | 'threshold' | 'anomaly' | 'manual';
    entitySet?: string;
    field?: string;
    schedule?: string; // cron expression for time-based
    threshold?: { field: string; operator: string; value: any };
}

export interface RuleCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'contains' | 'in' | 'between';
    value: any;
    logicalOperator: 'and' | 'or';
}

export interface RuleAction {
    type: 'update_field' | 'create_record' | 'send_alert' | 'call_api' | 'execute_function';
    target?: string;
    parameters: Record<string, any>;
    requiresApproval: boolean;
}

export interface RuleExecutionResult {
    ruleId: string;
    executed: boolean;
    timestamp: Date;
    success: boolean;
    error?: string;
    actionsPerformed: string[];
    approvalRequired: boolean;
    approvalRequestId?: string;
}

// Alert System Types
export interface BusinessAlert {
    id: string;
    type: 'anomaly_detected' | 'threshold_exceeded' | 'rule_triggered' | 'system_error' | 'business_event';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    source: string;
    entitySet?: string;
    recordId?: string;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    resolvedAt?: Date;
    status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'false_positive';
    recommendedActions: string[];
    dataContext: any;
    correlationId?: string;
}

export interface AlertConfiguration {
    id: string;
    name: string;
    entitySet: string;
    conditions: AlertCondition[];
    channels: AlertChannel[];
    enabled: boolean;
    suppressionRules: SuppressionRule[];
}

export interface AlertCondition {
    field: string;
    operator: string;
    threshold: any;
    timeWindow?: number; // minutes
    occurrenceCount?: number;
}

export interface AlertChannel {
    type: 'websocket' | 'email' | 'webhook' | 'sms';
    target: string;
    enabled: boolean;
    priority: 'immediate' | 'batched' | 'digest';
}

export interface SuppressionRule {
    type: 'time_based' | 'correlation_based' | 'threshold_based';
    duration?: number; // minutes
    conditions: Record<string, any>;
}

// User Context and Personalization Types
export interface UserContext {
    userId: string;
    role: string;
    department: string;
    permissions: string[];
    preferences: UserPreferences;
    recentQueries: QueryHistory[];
    usagePatterns: UsagePattern[];
}

export interface UserPreferences {
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
    defaultDashboard: string;
    alertPreferences: {
        channels: AlertChannel[];
        quietHours: { start: string; end: string };
        severity: 'critical' | 'high' | 'medium' | 'low';
    };
}

export interface QueryHistory {
    query: string;
    entitySet: string;
    timestamp: Date;
    executionTime: number;
    resultCount: number;
    wasOptimized: boolean;
}

export interface UsagePattern {
    pattern: string;
    frequency: number;
    lastUsed: Date;
    context: Record<string, any>;
}

// Supporting Types
export interface TrendData {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    magnitude: number;
    confidence: number;
    timeframe: string;
}

export interface AlertThreshold {
    metric: string;
    warning: number;
    critical: number;
    unit: string;
}

export interface RefreshStrategy {
    globalInterval: number;
    adaptiveRefresh: boolean;
    priorityWidgets: string[];
    offPeakInterval?: number;
}

export interface PersonalizationSettings {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    animationsEnabled: boolean;
    autoSave: boolean;
    customColors: Record<string, string>;
}

// MCP Integration Types
export interface MCPAITool {
    name: string;
    description: string;
    category: 'query' | 'analytics' | 'streaming' | 'alerts';
    inputSchema: any;
    outputSchema: any;
    requiresAuth: boolean;
    aiEnhanced: boolean;
}

// All types are already exported as interfaces above