/**
 * UI Component Library
 * SAP Fiori-style components for MCP UI tools
 */

import { Logger } from "../../utils/logger.js";
import { UIRenderingEngine } from "../engines/ui-rendering-engine.js";
import {
    UIComponent,
    FormConfig,
    GridConfig,
    DashboardConfig,
    WorkflowConfig,
    FieldConfig,
    ComponentConfig,
    UIRenderResult
} from "../types/ui-types.js";

export class UIComponentLibrary {
    private logger: Logger;
    private renderingEngine: UIRenderingEngine;

    constructor() {
        this.logger = new Logger('UIComponentLibrary');
        this.renderingEngine = new UIRenderingEngine();
    }

    /**
     * Generate a complete form for SAP entity
     */
    public async generateForm(config: FormConfig): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Generating form for entity: ${config.entityType}, operation: ${config.operation}`);

            const formComponent: UIComponent = {
                id: `form-${config.entityType}-${Date.now()}`,
                type: 'form-container',
                config: {
                    ...this.getDefaultFormConfig(),
                    layout: config.layout || 'vertical',
                    fields: config.customFields || [],
                    submitLabel: this.getSubmitLabel(config.operation),
                    cancelLabel: 'Cancel',
                    validation: config.validation,
                    cssClass: `sap-form-${config.theme || 'sap_horizon'}`
                },
                events: {
                    submit: `handleFormSubmit('${config.entityType}', '${config.operation}')`,
                    reset: `resetForm('${config.entityType}')`
                }
            };

            return await this.renderingEngine.renderComponent(formComponent);

        } catch (error) {
            this.logger.error(`Failed to generate form for ${config.entityType}`, error as Error);
            throw error;
        }
    }

    /**
     * Generate a data grid component
     */
    public async generateDataGrid(config: GridConfig): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Generating data grid for entity set: ${config.entitySet}`);

            const gridComponent: UIComponent = {
                id: `grid-${config.entitySet}-${Date.now()}`,
                type: 'data-grid',
                config: {
                    title: config.entitySet,
                    columns: config.columns || [],
                    features: {
                        sorting: true,
                        filtering: true,
                        export: true,
                        ...config.features
                    },
                    pageSize: config.pageSize || 20,
                    selectionMode: config.selectionMode || 'single',
                    cssClass: 'sap-grid-fiori'
                },
                data: {
                    rows: [] // Will be populated by data binding
                },
                events: {
                    rowSelect: `handleRowSelection('${config.entitySet}')`,
                    sort: `handleGridSort('${config.entitySet}')`,
                    filter: `handleGridFilter('${config.entitySet}')`
                }
            };

            return await this.renderingEngine.renderComponent(gridComponent);

        } catch (error) {
            this.logger.error(`Failed to generate data grid for ${config.entitySet}`, error as Error);
            throw error;
        }
    }

    /**
     * Generate a dashboard with widgets
     */
    public async generateDashboard(config: DashboardConfig): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Generating dashboard with ${config.widgets.length} widgets`);

            // Create layout with widgets as components
            const widgetComponents = config.widgets.map(widget => this.createWidgetComponent(widget));

            const result = await this.renderingEngine.renderLayout(config.layout);

            // Add dashboard-specific CSS and JS
            const dashboardCSS = this.generateDashboardCSS(config);
            const dashboardJS = this.generateDashboardJS(config);

            return {
                ...result,
                css: (result.css || '') + dashboardCSS,
                javascript: (result.javascript || '') + dashboardJS
            };

        } catch (error) {
            this.logger.error('Failed to generate dashboard', error as Error);
            throw error;
        }
    }

    /**
     * Generate a workflow builder interface
     */
    public async generateWorkflowBuilder(config: WorkflowConfig): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Generating workflow builder for: ${config.workflowType}`);

            const workflowComponent: UIComponent = {
                id: `workflow-${config.workflowType}-${Date.now()}`,
                type: 'workflow-builder',
                config: {
                    workflowType: config.workflowType,
                    steps: config.steps,
                    cssClass: 'sap-workflow-builder'
                },
                events: {
                    stepChange: `handleWorkflowStep('${config.workflowType}')`,
                    complete: `completeWorkflow('${config.workflowType}')`,
                    cancel: `cancelWorkflow('${config.workflowType}')`
                }
            };

            const result = await this.renderingEngine.renderComponent(workflowComponent);

            // Add workflow-specific functionality
            const workflowJS = this.generateWorkflowJS(config);

            return {
                ...result,
                javascript: (result.javascript || '') + workflowJS
            };

        } catch (error) {
            this.logger.error(`Failed to generate workflow builder for ${config.workflowType}`, error as Error);
            throw error;
        }
    }

    /**
     * Create individual form field components
     */
    public createFormField(fieldConfig: FieldConfig): UIComponent {
        const baseConfig: ComponentConfig = {
            cssClass: 'sap-form-field',
            validation: fieldConfig.validation
        };

        switch (fieldConfig.type) {
            case 'text':
            case 'number':
                return {
                    id: `field-${fieldConfig.name}`,
                    type: 'text-field',
                    config: {
                        ...baseConfig,
                        label: fieldConfig.label,
                        placeholder: fieldConfig.placeholder,
                        readonly: fieldConfig.readonly
                    }
                };

            case 'select':
                return {
                    id: `field-${fieldConfig.name}`,
                    type: 'select-field',
                    config: {
                        ...baseConfig,
                        label: fieldConfig.label,
                        options: fieldConfig.options || []
                    }
                };

            case 'date':
                return {
                    id: `field-${fieldConfig.name}`,
                    type: 'date-field',
                    config: {
                        ...baseConfig,
                        label: fieldConfig.label
                    }
                };

            case 'boolean':
                return {
                    id: `field-${fieldConfig.name}`,
                    type: 'checkbox-field',
                    config: {
                        ...baseConfig,
                        label: fieldConfig.label
                    }
                };

            default:
                return {
                    id: `field-${fieldConfig.name}`,
                    type: 'text-field',
                    config: {
                        ...baseConfig,
                        label: fieldConfig.label
                    }
                };
        }
    }

    /**
     * Create widget component for dashboard
     */
    private createWidgetComponent(widget: any): UIComponent {
        return {
            id: widget.id,
            type: widget.type,
            config: {
                title: widget.title,
                position: widget.position,
                ...widget.config
            },
            data: widget.data
        };
    }

    /**
     * Get default form configuration
     */
    private getDefaultFormConfig(): ComponentConfig {
        return {
            responsive: true,
            cssClass: 'sap-form-default'
        };
    }

    /**
     * Get submit button label based on operation
     */
    private getSubmitLabel(operation: string): string {
        switch (operation) {
            case 'create': return 'Create';
            case 'update': return 'Update';
            case 'search': return 'Search';
            default: return 'Submit';
        }
    }

    /**
     * Generate dashboard-specific CSS
     */
    private generateDashboardCSS(config: DashboardConfig): string {
        return `
            .sap-dashboard {
                padding: 1rem;
                background-color: #f5f6fa;
            }

            .sap-dashboard-widget {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                padding: 1rem;
                margin-bottom: 1rem;
            }

            .sap-widget-title {
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 1rem;
                color: #0070f2;
            }
        `;
    }

    /**
     * Generate dashboard-specific JavaScript
     */
    private generateDashboardJS(config: DashboardConfig): string {
        const refreshInterval = config.refreshInterval || 30000;

        return `
            // Dashboard initialization
            class SAPDashboard {
                constructor() {
                    this.widgets = [];
                    this.refreshInterval = ${refreshInterval};
                    this.init();
                }

                init() {
                    this.setupRefresh();
                    this.logger.debug('SAP Dashboard initialized');
                }

                setupRefresh() {
                    if (this.refreshInterval > 0) {
                        setInterval(() => {
                            this.refreshData();
                        }, this.refreshInterval);
                    }
                }

                refreshData() {
                    this.logger.debug('Refreshing dashboard data...');
                    // Implement data refresh logic
                }
            }

            // Initialize dashboard when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                window.sapDashboard = new SAPDashboard();
            });
        `;
    }

    /**
     * Generate workflow-specific JavaScript
     */
    private generateWorkflowJS(config: WorkflowConfig): string {
        return `
            // Workflow state management
            class SAPWorkflow {
                constructor() {
                    this.currentStep = 0;
                    this.steps = ${JSON.stringify(config.steps)};
                    this.state = {};
                    this.init();
                }

                init() {
                    this.renderCurrentStep();
                    this.logger.debug('SAP Workflow initialized with ${config.steps.length} steps');
                }

                nextStep() {
                    if (this.currentStep < this.steps.length - 1) {
                        this.currentStep++;
                        this.renderCurrentStep();
                    }
                }

                previousStep() {
                    if (this.currentStep > 0) {
                        this.currentStep--;
                        this.renderCurrentStep();
                    }
                }

                renderCurrentStep() {
                    const step = this.steps[this.currentStep];
                    this.logger.debug('Rendering step:', step.name);
                    // Implement step rendering logic
                }

                saveState() {
                    if ('${config.persistence}' === 'localStorage') {
                        localStorage.setItem('sapWorkflow_${config.workflowType}', JSON.stringify(this.state));
                    }
                }
            }

            // Initialize workflow when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                window.sapWorkflow = new SAPWorkflow();
            });
        `;
    }

    /**
     * Validate component configuration
     */
    public validateComponentConfig(type: string, config: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        switch (type) {
            case 'form':
                if (!config.entityType) {
                    errors.push('entityType is required for form components');
                }
                if (!config.operation) {
                    errors.push('operation is required for form components');
                }
                break;

            case 'grid':
                if (!config.entitySet) {
                    errors.push('entitySet is required for grid components');
                }
                break;
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}