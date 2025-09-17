/**
 * UI Types for SAP MCP UI Tools
 * Common interfaces and types for UI rendering engine
 */

export interface UIComponent {
    id: string;
    type: string;
    config: ComponentConfig;
    element?: HTMLElement;
    data?: any;
    events?: EventHandlerMap;
}

export interface ComponentConfig {
    width?: string;
    height?: string;
    cssClass?: string;
    style?: Record<string, string>;
    responsive?: boolean;
    validation?: ValidationConfig;
    binding?: DataBinding;
    layout?: string;
    title?: string;
    label?: string;
    placeholder?: string;
    readonly?: boolean;
    fields?: any[];
    submitLabel?: string;
    cancelLabel?: string;
    workflowType?: string;
    steps?: any[];
    columns?: any[];
    features?: any;
    pageSize?: number;
    selectionMode?: string;
    options?: any[];
}

export interface ValidationConfig {
    required?: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    custom?: (value: any) => ValidationResult;
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
    severity?: 'error' | 'warning' | 'info';
}

export interface DataBinding {
    path: string;
    type?: 'oneWay' | 'twoWay';
    formatter?: (value: any) => any;
    parser?: (value: any) => any;
}

export interface EventHandlerMap {
    [eventName: string]: string | ((event: Event) => void);
}

export interface LayoutDefinition {
    type: 'grid' | 'flexbox' | 'absolute';
    config: LayoutConfig;
    components: UIComponent[];
}

export interface LayoutConfig {
    columns?: number;
    rows?: number;
    gap?: string;
    padding?: string;
    margin?: string;
    responsive?: ResponsiveConfig;
}

export interface ResponsiveConfig {
    breakpoints: {
        [key: string]: {
            columns?: number;
            gap?: string;
        };
    };
}

export interface FormConfig {
    entityType: string;
    operation: 'create' | 'update' | 'search';
    layout?: 'vertical' | 'horizontal' | 'grid';
    columns?: number;
    customFields?: FieldConfig[];
    validation?: ValidationRules;
    theme?: 'sap_horizon' | 'sap_fiori_3';
}

export interface FieldConfig {
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect';
    required?: boolean;
    readonly?: boolean;
    hidden?: boolean;
    placeholder?: string;
    defaultValue?: any;
    options?: SelectOption[];
    validation?: ValidationConfig;
}

export interface SelectOption {
    key: string;
    text: string;
    description?: string;
}

export interface ValidationRules {
    [fieldName: string]: ValidationConfig;
}

export interface GridConfig {
    entitySet: string;
    columns?: ColumnConfig[];
    features?: GridFeatures;
    pageSize?: number;
    selectionMode?: 'none' | 'single' | 'multiple';
}

export interface ColumnConfig {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'date' | 'boolean' | 'custom';
    width?: string;
    sortable?: boolean;
    filterable?: boolean;
    formatter?: (value: any) => string;
    template?: string;
}

export interface GridFeatures {
    sorting?: boolean;
    filtering?: boolean;
    grouping?: boolean;
    export?: boolean;
    columnResize?: boolean;
    virtualScrolling?: boolean;
}

export interface DashboardConfig {
    layout: LayoutDefinition;
    widgets: WidgetConfig[];
    datasources: DataSourceMapping[];
    refreshInterval?: number;
    theme?: string;
}

export interface WidgetConfig {
    id: string;
    type: 'kpi-card' | 'chart' | 'table' | 'list' | 'custom';
    title: string;
    position: { row: number; col: number; width: number; height: number };
    config: any;
    dataKey?: string;
}

export interface DashboardWidget {
    id: string;
    type: 'chart' | 'metric' | 'table' | 'gauge';
    title: string;
    config: WidgetConfig;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface DataSourceMapping {
    widgetId: string;
    query: string;
    refresh?: number;
    transform?: (data: any) => any;
}

export interface WorkflowStep {
    id: string;
    name: string;
    component: string;
    validators?: string[];
    actions?: WorkflowAction[];
    transitions?: WorkflowTransition[];
}

export interface WorkflowAction {
    type: 'validate' | 'save' | 'execute' | 'navigate' | 'approve' | 'notify' | 'reject';
    target?: string;
    condition?: string;
}

export interface WorkflowTransition {
    condition: string;
    target: string;
    action?: WorkflowAction;
}

export interface WorkflowConfig {
    workflowType: string;
    steps: WorkflowStep[];
    transitions?: TransitionRules;
    persistence?: 'localStorage' | 'sessionStorage' | 'server' | 'sap';
}

export interface TransitionRules {
    [stepId: string]: {
        [outcome: string]: string; // outcome -> next step id
    };
}

export interface UIRenderResult {
    html: string;
    css?: string;
    javascript?: string;
    bindings?: DataBinding[];
    eventHandlers?: EventHandlerMap;
    validation?: ValidationRules;
}

export interface TemplateContext {
    data?: any;
    config?: any;
    theme?: string;
    locale?: string;
    user?: {
        id: string;
        roles: string[];
        scopes: string[];
    };
}

export interface UIError {
    code: string;
    message: string;
    details?: any;
    component?: string;
}

// Report-specific types
export interface ReportConfig {
    entityType: string;
    reportType: 'summary' | 'detailed' | 'analytical' | 'custom';
    dimensions: string[];
    measures: string[];
    filters?: ReportFilter[];
    drillDownLevels?: DrillDownLevel[];
    exportFormats?: string[];
    schedulingEnabled?: boolean;
    visualizations?: ReportChart[];
}

export interface ReportFilter {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'contains' | 'startswith' | 'endswith';
    value: string | number | boolean;
}

export interface DrillDownLevel {
    field: string;
    targetEntity?: string;
    navigationProperty?: string;
    enabled: boolean;
}

export interface ReportChart {
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'table';
    title: string;
    xAxis: string;
    yAxis: string;
    groupBy?: string;
    config?: any;
}