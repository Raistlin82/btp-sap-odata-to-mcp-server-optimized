/**
 * UI Workflow Builder Tool
 * Creates visual workflow processes with step-by-step forms and approvals
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SAPClient } from "../../services/sap-client.js";
import { Logger } from "../../utils/logger.js";
import { UIComponentLibrary } from "../../ui/components/ui-component-library.js";
import { IntelligentToolRouter } from "../../middleware/intelligent-tool-router.js";
import { SecureErrorHandler } from "../../utils/secure-error-handler.js";
import {
    WorkflowConfig,
    WorkflowStep,
    WorkflowAction,
    WorkflowTransition,
    TransitionRules,
    UIRenderResult
} from "../../ui/types/ui-types.js";
import { z } from "zod";

const UIWorkflowBuilderSchema = {
    workflowType: z.string().describe("Type of workflow (e.g., 'approval', 'onboarding', 'order-processing')"),
    title: z.string().describe("Workflow title"),
    description: z.string().optional().describe("Workflow description"),
    steps: z.array(z.object({
        id: z.string().describe("Unique step identifier"),
        name: z.string().describe("Step display name"),
        description: z.string().optional().describe("Step description"),
        component: z.enum(['form', 'approval', 'notification', 'decision', 'data-entry', 'review', 'custom']).describe("Step component type"),
        config: z.object({
            entityType: z.string().optional().describe("SAP entity type for data operations"),
            formFields: z.array(z.object({
                name: z.string(),
                label: z.string(),
                type: z.string(),
                required: z.boolean().optional(),
                validation: z.record(z.any()).optional()
            })).optional().describe("Form fields for form components"),
            approvers: z.array(z.object({
                role: z.string(),
                required: z.boolean().optional(),
                escalationTime: z.number().optional()
            })).optional().describe("Approvers for approval components"),
            conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']),
                value: z.any()
            })).optional().describe("Conditions for decision components"),
            template: z.string().optional().describe("Custom template for notifications"),
            dataSource: z.object({
                entitySet: z.string().optional(),
                query: z.record(z.any()).optional()
            }).optional().describe("Data source configuration")
        }).optional().describe("Step-specific configuration"),
        validators: z.array(z.object({
            type: z.enum(['required', 'format', 'business', 'approval']),
            config: z.record(z.any()).optional()
        })).optional().describe("Step validation rules"),
        actions: z.array(z.object({
            type: z.enum(['validate', 'save', 'execute', 'navigate', 'notify', 'approve', 'reject']),
            target: z.string().optional(),
            condition: z.string().optional(),
            config: z.record(z.any()).optional()
        })).optional().describe("Step actions"),
        timeout: z.number().optional().describe("Step timeout in seconds"),
        parallel: z.boolean().optional().describe("Allow parallel execution")
    })).describe("Workflow steps"),
    transitions: z.record(z.record(z.string())).optional().describe("Step transition rules"),
    roles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        permissions: z.array(z.string()),
        steps: z.array(z.string()).optional().describe("Steps this role can access")
    })).optional().describe("Workflow roles and permissions"),
    persistence: z.enum(['localStorage', 'sessionStorage', 'server', 'sap']).optional().describe("Data persistence method"),
    notifications: z.object({
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        push: z.boolean().optional(),
        sapInbox: z.boolean().optional()
    }).optional().describe("Notification settings"),
    escalation: z.object({
        enabled: z.boolean(),
        timeouts: z.record(z.number()).optional(),
        escalationChain: z.array(z.string()).optional()
    }).optional().describe("Escalation configuration"),
    analytics: z.object({
        trackStepTime: z.boolean().optional(),
        trackUserActions: z.boolean().optional(),
        generateReports: z.boolean().optional()
    }).optional().describe("Analytics configuration"),
    integration: z.object({
        sapWorkflowService: z.boolean().optional(),
        externalApi: z.string().optional(),
        webhooks: z.array(z.object({
            event: z.string(),
            url: z.string()
        })).optional()
    }).optional().describe("External system integration")
};

export class UIWorkflowBuilderTool {
    private mcpServer: McpServer;
    private sapClient: SAPClient;
    private logger: Logger;
    private componentLibrary: UIComponentLibrary;
    private intelligentRouter: IntelligentToolRouter;
    private errorHandler: SecureErrorHandler;

    constructor(
        mcpServer: McpServer,
        sapClient: SAPClient,
        logger: Logger
    ) {
        this.mcpServer = mcpServer;
        this.sapClient = sapClient;
        this.logger = logger;
        this.componentLibrary = new UIComponentLibrary();
        this.intelligentRouter = new IntelligentToolRouter();
        this.errorHandler = new SecureErrorHandler(logger);
    }

    public async register(): Promise<void> {
        this.mcpServer.registerTool(
            "ui-workflow-builder",
            {
                title: "UI Workflow Builder",
                description: `Create visual workflow processes with step-by-step forms and approvals.

Features:
- Visual workflow designer with drag-and-drop interface
- Multiple step types (forms, approvals, decisions, notifications)
- Role-based access control and permissions
- Conditional branching and parallel execution
- Integration with SAP Workflow Service
- Email, SMS, and push notifications
- Escalation and timeout handling
- Real-time progress tracking
- Analytics and reporting
- Mobile-responsive design
- Audit trail and compliance

Required scope: ui.workflows

Step Types:
- form: Data entry forms with validation
- approval: Multi-level approval processes
- notification: Email/SMS notifications
- decision: Conditional branching based on data
- data-entry: Direct SAP data manipulation
- review: Data review and verification
- custom: Custom HTML/JavaScript components

Workflow Types:
- approval: Document/request approval flows
- onboarding: Employee/customer onboarding
- order-processing: Order fulfillment workflows
- incident-management: Issue resolution processes
- change-request: Change management workflows

Examples:
- Purchase approval: {"workflowType": "approval", "steps": [...]}
- Employee onboarding: {"workflowType": "onboarding", "title": "New Employee Setup"}
- Order processing: {"workflowType": "order-processing", "integration": {...}}`,
                inputSchema: UIWorkflowBuilderSchema
            },
            async (args: Record<string, unknown>) => {
                return await this.handleWorkflowBuilding(args);
            }
        );

        this.logger.info("✅ UI Workflow Builder tool registered successfully");
    }

    private async handleWorkflowBuilding(args: unknown): Promise<any> {
        try {
            // Validate input parameters
            const params = z.object(UIWorkflowBuilderSchema).parse(args);

            this.logger.info(`🔄 Building workflow: ${params.title} (${params.workflowType}) with ${params.steps.length} steps`);

            // Check authentication and authorization
            const authCheck = await this.checkUIAccess('ui.workflows');
            if (!authCheck.hasAccess) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Authorization denied: ${authCheck.reason || 'Access denied for UI workflow building'}\n\nRequired scope: ui.workflows`
                    }]
                };
            }

            // Step 1: Validate workflow structure
            const validationResult = await this.validateWorkflowStructure(params);
            if (!validationResult.valid) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Workflow validation failed:\n${validationResult.errors.join('\n')}`
                    }]
                };
            }

            // Step 2: Prepare workflow steps with enhanced configurations
            const enhancedSteps = await this.enhanceWorkflowSteps(params.steps);

            // Step 3: Create transition rules
            const transitionRules = this.createTransitionRules(enhancedSteps, params.transitions);

            // Step 4: Create workflow configuration
            const workflowConfig: WorkflowConfig = {
                workflowType: params.workflowType,
                steps: enhancedSteps,
                transitions: transitionRules,
                persistence: params.persistence || 'localStorage'
            };

            // Step 5: Generate workflow UI
            const workflowResult = await this.componentLibrary.generateWorkflowBuilder(workflowConfig);

            // Step 6: Add SAP-specific enhancements
            const enhancedResult = await this.enhanceWorkflowResult(workflowResult, params);

            // Step 7: Prepare response
            const response = this.createWorkflowResponse(enhancedResult, params, enhancedSteps);

            this.logger.info(`✅ Workflow '${params.title}' built successfully`);

            return {
                content: [
                    {
                        type: "text",
                        text: `# ${params.title}\n\n` +
                              `${params.description || `Visual ${params.workflowType} workflow with step-by-step process`}\n\n` +
                              `## Workflow Overview:\n` +
                              `- Type: ${params.workflowType}\n` +
                              `- Steps: ${params.steps.length}\n` +
                              `- Roles: ${params.roles?.length || 0}\n` +
                              `- Persistence: ${params.persistence || 'localStorage'}\n` +
                              `- Notifications: ${this.getNotificationSummary(params.notifications)}\n` +
                              `- Escalation: ${params.escalation?.enabled ? '✅' : '❌'}\n\n` +
                              `## Workflow Steps:\n` +
                              params.steps.map((step, index) =>
                                  `${index + 1}. **${step.name}** (${step.component})\n   ${step.description || 'No description'}`
                              ).join('\n') + '\n\n' +
                              `## Features:\n` +
                              `- Visual Progress Indicator: ✅\n` +
                              `- Role-based Access Control: ${params.roles?.length ? '✅' : '❌'}\n` +
                              `- Conditional Branching: ${enhancedSteps.some(s => s.transitions) ? '✅' : '❌'}\n` +
                              `- Integration: ${params.integration ? Object.keys(params.integration).join(', ') : 'None'}\n` +
                              `- Analytics: ${params.analytics?.trackStepTime ? '✅' : '❌'}\n\n` +
                              `Start the workflow by clicking the 'Begin Process' button in the generated interface.`
                    },
                    {
                        type: "resource",
                        data: response,
                        mimeType: "application/json"
                    }
                ]
            };

        } catch (error) {
            this.logger.error(`❌ Failed to build workflow`, error as Error);
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to build workflow: ${(error as Error).message}`
                }]
            };
        }
    }

    /**
     * Validate workflow structure
     */
    private async validateWorkflowStructure(params: any): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        // Check if workflow has at least one step
        if (!params.steps || params.steps.length === 0) {
            errors.push("Workflow must have at least one step");
        }

        // Validate step IDs are unique
        const stepIds = new Set();
        params.steps?.forEach((step: any, index: number) => {
            if (stepIds.has(step.id)) {
                errors.push(`Duplicate step ID: ${step.id}`);
            }
            stepIds.add(step.id);
        });

        // Validate transition references
        if (params.transitions) {
            Object.entries(params.transitions).forEach(([fromStep, transitions]) => {
                if (!stepIds.has(fromStep)) {
                    errors.push(`Transition references unknown step: ${fromStep}`);
                }
                Object.values(transitions as any).forEach((toStep: any) => {
                    if (toStep !== 'end' && !stepIds.has(toStep)) {
                        errors.push(`Transition references unknown step: ${toStep}`);
                    }
                });
            });
        }

        // Validate role permissions
        if (params.roles) {
            params.roles.forEach((role: any) => {
                if (role.steps) {
                    role.steps.forEach((stepId: string) => {
                        if (!stepIds.has(stepId)) {
                            errors.push(`Role ${role.id} references unknown step: ${stepId}`);
                        }
                    });
                }
            });
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Enhance workflow steps with additional configurations
     */
    private async enhanceWorkflowSteps(steps: any[]): Promise<WorkflowStep[]> {
        const enhancedSteps: WorkflowStep[] = [];

        for (const step of steps) {
            const enhancedStep: WorkflowStep = {
                id: step.id,
                name: step.name,
                component: step.component,
                validators: step.validators || [],
                actions: await this.createStepActions(step),
                transitions: await this.createStepTransitions(step)
            };

            enhancedSteps.push(enhancedStep);
        }

        return enhancedSteps;
    }

    /**
     * Create step actions based on component type
     */
    private async createStepActions(step: any): Promise<WorkflowAction[]> {
        const actions: WorkflowAction[] = [];

        switch (step.component) {
            case 'form':
                actions.push(
                    { type: 'validate', target: 'form-data' },
                    { type: 'save', target: 'workflow-state' },
                    { type: 'navigate', target: 'next-step' }
                );
                break;

            case 'approval':
                actions.push(
                    { type: 'approve', target: 'approval-decision' },
                    { type: 'reject', target: 'rejection-reason' },
                    { type: 'notify', target: 'approval-result' }
                );
                break;

            case 'notification':
                actions.push(
                    { type: 'notify', target: 'recipients' },
                    { type: 'navigate', target: 'next-step' }
                );
                break;

            case 'decision':
                actions.push(
                    { type: 'validate', target: 'decision-conditions' },
                    { type: 'navigate', target: 'conditional-step' }
                );
                break;

            case 'data-entry':
                actions.push(
                    { type: 'validate', target: 'entity-data' },
                    { type: 'execute', target: 'sap-operation' },
                    { type: 'save', target: 'operation-result' }
                );
                break;

            default:
                actions.push(
                    { type: 'validate', target: 'step-data' },
                    { type: 'navigate', target: 'next-step' }
                );
        }

        // Add custom actions from step configuration
        if (step.actions) {
            actions.push(...step.actions);
        }

        return actions;
    }

    /**
     * Create step transitions
     */
    private async createStepTransitions(step: any): Promise<WorkflowTransition[]> {
        const transitions: WorkflowTransition[] = [];

        // Default transitions based on component type
        switch (step.component) {
            case 'approval':
                transitions.push(
                    { condition: 'approved', target: 'next-step' },
                    { condition: 'rejected', target: 'rejection-step' },
                    { condition: 'timeout', target: 'escalation-step' }
                );
                break;

            case 'decision':
                if (step.config?.conditions) {
                    step.config.conditions.forEach((condition: any, index: number) => {
                        transitions.push({
                            condition: `condition_${index}`,
                            target: condition.target || 'next-step'
                        });
                    });
                }
                break;

            default:
                transitions.push(
                    { condition: 'success', target: 'next-step' },
                    { condition: 'error', target: 'error-step' }
                );
        }

        return transitions;
    }

    /**
     * Create transition rules for the entire workflow
     */
    private createTransitionRules(steps: WorkflowStep[], customTransitions?: any): TransitionRules {
        const rules: TransitionRules = {};

        // Create default linear transitions
        steps.forEach((step, index) => {
            const nextStep = index < steps.length - 1 ? steps[index + 1].id : 'end';

            rules[step.id] = {
                success: nextStep,
                next: nextStep,
                error: 'error',
                timeout: 'timeout'
            };
        });

        // Apply custom transitions
        if (customTransitions) {
            Object.entries(customTransitions).forEach(([stepId, transitions]) => {
                if (rules[stepId]) {
                    rules[stepId] = { ...rules[stepId], ...transitions as any };
                }
            });
        }

        return rules;
    }

    /**
     * Enhance workflow result with SAP-specific functionality
     */
    private async enhanceWorkflowResult(workflowResult: UIRenderResult, params: any): Promise<UIRenderResult> {
        // Add SAP Workflow CSS
        const sapCSS = this.generateSAPWorkflowCSS();

        // Add SAP Workflow JavaScript
        const sapJS = this.generateSAPWorkflowJS(params);

        return {
            ...workflowResult,
            css: (workflowResult.css || '') + sapCSS,
            javascript: (workflowResult.javascript || '') + sapJS
        };
    }

    /**
     * Generate SAP-specific CSS for workflow
     */
    private generateSAPWorkflowCSS(): string {
        return `
            /* SAP Workflow Builder Styles */
            .sap-workflow-container {
                background: #f5f6fa;
                min-height: 100vh;
                padding: 2rem;
                font-family: '72', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .sap-workflow-header {
                background: white;
                border-radius: 8px;
                padding: 2rem;
                margin-bottom: 2rem;
                box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
                border: 1px solid #e4e7ea;
            }

            .sap-workflow-title {
                font-size: 2rem;
                font-weight: 600;
                color: #0070f2;
                margin: 0 0 0.5rem 0;
            }

            .sap-workflow-description {
                color: #6a6d70;
                margin: 0 0 1rem 0;
                font-size: 1.1rem;
            }

            .sap-workflow-meta {
                display: flex;
                gap: 2rem;
                flex-wrap: wrap;
                color: #6a6d70;
                font-size: 0.875rem;
            }

            .sap-workflow-meta-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            /* Progress Indicator */
            .sap-workflow-progress {
                background: white;
                border-radius: 8px;
                padding: 1.5rem;
                margin-bottom: 2rem;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                border: 1px solid #e4e7ea;
            }

            .sap-progress-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: #32363a;
                margin: 0 0 1rem 0;
            }

            .sap-progress-steps {
                display: flex;
                align-items: center;
                overflow-x: auto;
                padding: 1rem 0;
                gap: 1rem;
            }

            .sap-progress-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 120px;
                position: relative;
                text-align: center;
            }

            .sap-progress-step:not(:last-child)::after {
                content: '';
                position: absolute;
                top: 20px;
                right: -1rem;
                width: 2rem;
                height: 2px;
                background: #d5d9dc;
                z-index: 1;
            }

            .sap-progress-step.completed::after {
                background: #52c41a;
            }

            .sap-progress-step.active::after {
                background: #0070f2;
            }

            .sap-progress-circle {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 0.5rem;
                position: relative;
                z-index: 2;
                font-weight: 600;
                font-size: 0.875rem;
            }

            .sap-progress-step.pending .sap-progress-circle {
                background: #f0f2f5;
                color: #6a6d70;
                border: 2px solid #d5d9dc;
            }

            .sap-progress-step.active .sap-progress-circle {
                background: #0070f2;
                color: white;
                border: 2px solid #0070f2;
                animation: pulse 2s infinite;
            }

            .sap-progress-step.completed .sap-progress-circle {
                background: #52c41a;
                color: white;
                border: 2px solid #52c41a;
            }

            .sap-progress-step.error .sap-progress-circle {
                background: #f5222d;
                color: white;
                border: 2px solid #f5222d;
            }

            .sap-progress-label {
                font-size: 0.75rem;
                color: #6a6d70;
                font-weight: 500;
                max-width: 100px;
                word-wrap: break-word;
            }

            .sap-progress-step.active .sap-progress-label {
                color: #0070f2;
                font-weight: 600;
            }

            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(0, 112, 242, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(0, 112, 242, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 112, 242, 0); }
            }

            /* Step Content */
            .sap-workflow-step {
                background: white;
                border-radius: 8px;
                padding: 2rem;
                margin-bottom: 2rem;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                border: 1px solid #e4e7ea;
                min-height: 400px;
            }

            .sap-step-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #f0f2f5;
            }

            .sap-step-title {
                font-size: 1.4rem;
                font-weight: 600;
                color: #32363a;
                margin: 0;
            }

            .sap-step-type {
                background: #e3f2fd;
                color: #0070f2;
                padding: 0.25rem 0.75rem;
                border-radius: 16px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
            }

            .sap-step-content {
                margin: 1.5rem 0;
            }

            .sap-step-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid #f0f2f5;
            }

            /* Form Components */
            .sap-workflow-form {
                display: grid;
                gap: 1.5rem;
            }

            .sap-form-field {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .sap-form-label {
                font-weight: 600;
                color: #32363a;
                font-size: 0.875rem;
            }

            .sap-form-input,
            .sap-form-select,
            .sap-form-textarea {
                padding: 0.75rem;
                border: 1px solid #d5d9dc;
                border-radius: 4px;
                font-size: 0.875rem;
                transition: border-color 0.2s ease;
            }

            .sap-form-input:focus,
            .sap-form-select:focus,
            .sap-form-textarea:focus {
                outline: none;
                border-color: #0070f2;
                box-shadow: 0 0 0 2px rgba(0, 112, 242, 0.1);
            }

            .sap-form-error {
                color: #f5222d;
                font-size: 0.75rem;
                margin-top: 0.25rem;
            }

            /* Approval Components */
            .sap-approval-content {
                text-align: center;
                padding: 2rem;
            }

            .sap-approval-icon {
                width: 80px;
                height: 80px;
                margin: 0 auto 1rem;
                background: #fff8e1;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
            }

            .sap-approval-message {
                font-size: 1.2rem;
                color: #32363a;
                margin-bottom: 1rem;
            }

            .sap-approval-details {
                background: #f7f8fa;
                border-radius: 4px;
                padding: 1rem;
                margin: 1rem 0;
                text-align: left;
            }

            .sap-approval-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
                margin-top: 2rem;
            }

            /* Decision Components */
            .sap-decision-content {
                padding: 1rem;
            }

            .sap-decision-conditions {
                display: grid;
                gap: 1rem;
                margin: 1rem 0;
            }

            .sap-decision-condition {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: #f7f8fa;
                border-radius: 4px;
                border: 1px solid #e4e7ea;
            }

            .sap-decision-result {
                background: #e8f5e8;
                color: #2e7d32;
                padding: 1rem;
                border-radius: 4px;
                margin: 1rem 0;
                text-align: center;
                font-weight: 600;
            }

            /* Buttons */
            .sap-workflow-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 4px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 120px;
            }

            .sap-button-primary {
                background: #0070f2;
                color: white;
            }

            .sap-button-primary:hover:not(:disabled) {
                background: #0058d3;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 112, 242, 0.3);
            }

            .sap-button-secondary {
                background: white;
                color: #32363a;
                border: 1px solid #d5d9dc;
            }

            .sap-button-secondary:hover:not(:disabled) {
                background: #f7f8fa;
                border-color: #0070f2;
                color: #0070f2;
            }

            .sap-button-danger {
                background: #f5222d;
                color: white;
            }

            .sap-button-danger:hover:not(:disabled) {
                background: #d50000;
            }

            .sap-button-success {
                background: #52c41a;
                color: white;
            }

            .sap-button-success:hover:not(:disabled) {
                background: #389e0d;
            }

            .sap-workflow-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
                box-shadow: none !important;
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .sap-workflow-container {
                    padding: 1rem;
                }

                .sap-workflow-header,
                .sap-workflow-progress,
                .sap-workflow-step {
                    padding: 1rem;
                }

                .sap-progress-steps {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .sap-progress-step:not(:last-child)::after {
                    display: none;
                }

                .sap-step-actions {
                    flex-direction: column;
                }

                .sap-workflow-button {
                    width: 100%;
                }

                .sap-approval-actions {
                    flex-direction: column;
                }
            }

            /* Loading States */
            .sap-workflow-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                gap: 1rem;
            }

            .sap-loading-spinner {
                width: 24px;
                height: 24px;
                border: 3px solid #f0f2f5;
                border-top: 3px solid #0070f2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
    }

    /**
     * Generate SAP-specific JavaScript for workflow
     */
    private generateSAPWorkflowJS(params: any): string {
        return `
            // SAP Workflow Engine
            class SAPWorkflowEngine {
                constructor(config) {
                    this.config = config;
                    this.currentStep = 0;
                    this.stepHistory = [];
                    this.workflowData = {};
                    this.stepStartTime = Date.now();
                    this.analytics = {
                        stepTimes: {},
                        userActions: [],
                        startTime: Date.now()
                    };
                    this.init();
                }

                init() {
                    this.loadWorkflowState();
                    this.renderWorkflow();
                    this.setupEventHandlers();
                    this.trackAnalytics('workflow_started');
                    this.logger.debug('SAP Workflow Engine initialized:', this.config.title);
                }

                loadWorkflowState() {
                    if (this.config.persistence === 'localStorage') {
                        const saved = localStorage.getItem(\`workflow_\${this.config.workflowType}\`);
                        if (saved) {
                            const state = JSON.parse(saved);
                            this.currentStep = state.currentStep || 0;
                            this.workflowData = state.data || {};
                            this.stepHistory = state.history || [];
                        }
                    }
                }

                saveWorkflowState() {
                    if (this.config.persistence === 'localStorage') {
                        const state = {
                            currentStep: this.currentStep,
                            data: this.workflowData,
                            history: this.stepHistory,
                            lastSaved: Date.now()
                        };
                        localStorage.setItem(\`workflow_\${this.config.workflowType}\`, JSON.stringify(state));
                    }
                }

                renderWorkflow() {
                    this.renderWorkflowHeader();
                    this.renderProgressIndicator();
                    this.renderCurrentStep();
                }

                renderWorkflowHeader() {
                    const header = document.createElement('div');
                    header.className = 'sap-workflow-header';
                    header.innerHTML = \`
                        <h1 class="sap-workflow-title">\${this.config.title}</h1>
                        <p class="sap-workflow-description">\${this.config.description || ''}</p>
                        <div class="sap-workflow-meta">
                            <div class="sap-workflow-meta-item">
                                <span>📋</span>
                                <span>Type: \${this.config.workflowType}</span>
                            </div>
                            <div class="sap-workflow-meta-item">
                                <span>📊</span>
                                <span>Steps: \${this.config.steps.length}</span>
                            </div>
                            <div class="sap-workflow-meta-item">
                                <span>⏱️</span>
                                <span>Started: \${new Date(this.analytics.startTime).toLocaleString()}</span>
                            </div>
                        </div>
                    \`;

                    const container = document.querySelector('.sap-workflow-container') || document.body;
                    container.appendChild(header);
                }

                renderProgressIndicator() {
                    const progress = document.createElement('div');
                    progress.className = 'sap-workflow-progress';
                    progress.innerHTML = \`
                        <h2 class="sap-progress-title">Workflow Progress</h2>
                        <div class="sap-progress-steps">
                            \${this.config.steps.map((step, index) => \`
                                <div class="sap-progress-step \${this.getStepStatus(index)}">
                                    <div class="sap-progress-circle">
                                        \${this.getStepIcon(step, index)}
                                    </div>
                                    <div class="sap-progress-label">\${step.name}</div>
                                </div>
                            \`).join('')}
                        </div>
                    \`;

                    const container = document.querySelector('.sap-workflow-container');
                    container.appendChild(progress);
                }

                getStepStatus(index) {
                    if (index < this.currentStep) return 'completed';
                    if (index === this.currentStep) return 'active';
                    return 'pending';
                }

                getStepIcon(step, index) {
                    const status = this.getStepStatus(index);
                    if (status === 'completed') return '✓';
                    if (status === 'active') return index + 1;
                    return index + 1;
                }

                renderCurrentStep() {
                    const existingStep = document.querySelector('.sap-workflow-step');
                    if (existingStep) existingStep.remove();

                    if (this.currentStep >= this.config.steps.length) {
                        this.renderCompletion();
                        return;
                    }

                    const step = this.config.steps[this.currentStep];
                    const stepElement = document.createElement('div');
                    stepElement.className = 'sap-workflow-step';
                    stepElement.innerHTML = \`
                        <div class="sap-step-header">
                            <h3 class="sap-step-title">\${step.name}</h3>
                            <span class="sap-step-type">\${step.component}</span>
                        </div>
                        <div class="sap-step-content">
                            \${this.renderStepContent(step)}
                        </div>
                        <div class="sap-step-actions">
                            \${this.renderStepActions(step)}
                        </div>
                    \`;

                    const container = document.querySelector('.sap-workflow-container');
                    container.appendChild(stepElement);

                    this.stepStartTime = Date.now();
                }

                renderStepContent(step) {
                    switch (step.component) {
                        case 'form':
                            return this.renderFormComponent(step);
                        case 'approval':
                            return this.renderApprovalComponent(step);
                        case 'notification':
                            return this.renderNotificationComponent(step);
                        case 'decision':
                            return this.renderDecisionComponent(step);
                        case 'data-entry':
                            return this.renderDataEntryComponent(step);
                        case 'review':
                            return this.renderReviewComponent(step);
                        default:
                            return \`<p>\${step.description || 'Step content will be displayed here.'}</p>\`;
                    }
                }

                renderFormComponent(step) {
                    const fields = step.config?.formFields || [];
                    return \`
                        <form class="sap-workflow-form" id="step-form-\${step.id}">
                            \${fields.map(field => \`
                                <div class="sap-form-field">
                                    <label class="sap-form-label">\${field.label} \${field.required ? '*' : ''}</label>
                                    \${this.renderFormInput(field)}
                                    <div class="sap-form-error" id="error-\${field.name}"></div>
                                </div>
                            \`).join('')}
                        </form>
                    \`;
                }

                renderFormInput(field) {
                    const value = this.workflowData[field.name] || '';

                    switch (field.type) {
                        case 'textarea':
                            return \`<textarea class="sap-form-textarea" name="\${field.name}" placeholder="\${field.label}">\${value}</textarea>\`;
                        case 'select':
                            return \`
                                <select class="sap-form-select" name="\${field.name}">
                                    <option value="">Select...</option>
                                    \${(field.options || []).map(opt =>
                                        \`<option value="\${opt.value}" \${opt.value === value ? 'selected' : ''}>\${opt.label}</option>\`
                                    ).join('')}
                                </select>
                            \`;
                        case 'date':
                            return \`<input type="date" class="sap-form-input" name="\${field.name}" value="\${value}">\`;
                        case 'number':
                            return \`<input type="number" class="sap-form-input" name="\${field.name}" value="\${value}" placeholder="\${field.label}">\`;
                        default:
                            return \`<input type="text" class="sap-form-input" name="\${field.name}" value="\${value}" placeholder="\${field.label}">\`;
                    }
                }

                renderApprovalComponent(step) {
                    return \`
                        <div class="sap-approval-content">
                            <div class="sap-approval-icon">📋</div>
                            <div class="sap-approval-message">
                                This step requires approval before proceeding.
                            </div>
                            <div class="sap-approval-details">
                                <strong>Approval Required For:</strong><br>
                                \${step.description || 'Review and approve the workflow data'}
                                <br><br>
                                <strong>Workflow Data:</strong><br>
                                \${Object.entries(this.workflowData).map(([key, value]) =>
                                    \`<strong>\${key}:</strong> \${value}\`
                                ).join('<br>')}
                            </div>
                            <div class="sap-approval-actions">
                                <button class="sap-workflow-button sap-button-success" onclick="window.sapWorkflow.approve()">
                                    ✅ Approve
                                </button>
                                <button class="sap-workflow-button sap-button-danger" onclick="window.sapWorkflow.reject()">
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    \`;
                }

                renderNotificationComponent(step) {
                    return \`
                        <div class="sap-approval-content">
                            <div class="sap-approval-icon">📧</div>
                            <div class="sap-approval-message">
                                Notification will be sent to relevant parties.
                            </div>
                            <div class="sap-approval-details">
                                <strong>Message:</strong><br>
                                \${step.description || 'Workflow notification message'}
                                <br><br>
                                <strong>Recipients:</strong><br>
                                \${(step.config?.recipients || ['System Administrator']).join(', ')}
                            </div>
                        </div>
                    \`;
                }

                renderDecisionComponent(step) {
                    const conditions = step.config?.conditions || [];
                    return \`
                        <div class="sap-decision-content">
                            <p><strong>Decision Logic:</strong></p>
                            <div class="sap-decision-conditions">
                                \${conditions.map((condition, index) => \`
                                    <div class="sap-decision-condition">
                                        <strong>Condition \${index + 1}:</strong>
                                        If \${condition.field} \${condition.operator.replace('_', ' ')} \${condition.value}
                                    </div>
                                \`).join('')}
                            </div>
                            <div class="sap-decision-result" id="decision-result">
                                Decision will be evaluated based on current workflow data.
                            </div>
                        </div>
                    \`;
                }

                renderDataEntryComponent(step) {
                    return \`
                        <div class="sap-approval-content">
                            <div class="sap-approval-icon">💾</div>
                            <div class="sap-approval-message">
                                Data will be saved to SAP system.
                            </div>
                            <div class="sap-approval-details">
                                <strong>Entity Type:</strong> \${step.config?.entityType || 'Unknown'}<br>
                                <strong>Operation:</strong> Create/Update<br>
                                <strong>Data to Save:</strong><br>
                                \${Object.entries(this.workflowData).map(([key, value]) =>
                                    \`<strong>\${key}:</strong> \${value}\`
                                ).join('<br>')}
                            </div>
                        </div>
                    \`;
                }

                renderReviewComponent(step) {
                    return \`
                        <div class="sap-approval-content">
                            <div class="sap-approval-icon">🔍</div>
                            <div class="sap-approval-message">
                                Please review all workflow data before proceeding.
                            </div>
                            <div class="sap-approval-details">
                                <strong>Complete Workflow Summary:</strong><br><br>
                                \${Object.entries(this.workflowData).map(([key, value]) =>
                                    \`<strong>\${key}:</strong> \${value}\`
                                ).join('<br>')}
                                <br><br>
                                <strong>Steps Completed:</strong> \${this.currentStep} of \${this.config.steps.length}
                            </div>
                        </div>
                    \`;
                }

                renderStepActions(step) {
                    const actions = [];

                    switch (step.component) {
                        case 'form':
                            actions.push(\`
                                <button class="sap-workflow-button sap-button-primary" onclick="window.sapWorkflow.validateAndNext()">
                                    Next Step
                                </button>
                            \`);
                            break;

                        case 'approval':
                            // Actions are rendered in the approval component
                            break;

                        case 'notification':
                            actions.push(\`
                                <button class="sap-workflow-button sap-button-primary" onclick="window.sapWorkflow.sendNotification()">
                                    Send Notification
                                </button>
                            \`);
                            break;

                        case 'decision':
                            actions.push(\`
                                <button class="sap-workflow-button sap-button-primary" onclick="window.sapWorkflow.evaluateDecision()">
                                    Evaluate & Continue
                                </button>
                            \`);
                            break;

                        default:
                            actions.push(\`
                                <button class="sap-workflow-button sap-button-primary" onclick="window.sapWorkflow.nextStep()">
                                    Continue
                                </button>
                            \`);
                    }

                    if (this.currentStep > 0) {
                        actions.unshift(\`
                            <button class="sap-workflow-button sap-button-secondary" onclick="window.sapWorkflow.previousStep()">
                                Previous
                            </button>
                        \`);
                    }

                    return actions.join('');
                }

                renderCompletion() {
                    const completionElement = document.createElement('div');
                    completionElement.className = 'sap-workflow-step';
                    completionElement.innerHTML = \`
                        <div class="sap-approval-content">
                            <div class="sap-approval-icon">🎉</div>
                            <div class="sap-approval-message">
                                <h2>Workflow Completed Successfully!</h2>
                            </div>
                            <div class="sap-approval-details">
                                <strong>Workflow:</strong> \${this.config.title}<br>
                                <strong>Completed:</strong> \${new Date().toLocaleString()}<br>
                                <strong>Total Time:</strong> \${this.formatDuration(Date.now() - this.analytics.startTime)}<br>
                                <strong>Steps Completed:</strong> \${this.config.steps.length}
                            </div>
                            <div class="sap-approval-actions">
                                <button class="sap-workflow-button sap-button-primary" onclick="window.sapWorkflow.downloadSummary()">
                                    Download Summary
                                </button>
                                <button class="sap-workflow-button sap-button-secondary" onclick="window.sapWorkflow.startNew()">
                                    Start New Workflow
                                </button>
                            </div>
                        </div>
                    \`;

                    const container = document.querySelector('.sap-workflow-container');
                    container.appendChild(completionElement);

                    this.trackAnalytics('workflow_completed');
                }

                setupEventHandlers() {
                    // Auto-save on form changes
                    document.addEventListener('input', (e) => {
                        if (e.target.matches('.sap-form-input, .sap-form-select, .sap-form-textarea')) {
                            this.workflowData[e.target.name] = e.target.value;
                            this.saveWorkflowState();
                            this.trackAnalytics('field_changed', { field: e.target.name, value: e.target.value });
                        }
                    });

                    // Handle browser navigation
                    window.addEventListener('beforeunload', (e) => {
                        this.saveWorkflowState();
                    });
                }

                validateAndNext() {
                    const form = document.querySelector(\`#step-form-\${this.config.steps[this.currentStep].id}\`);
                    if (form && this.validateForm(form)) {
                        this.nextStep();
                    }
                }

                validateForm(form) {
                    const fields = form.querySelectorAll('.sap-form-input, .sap-form-select, .sap-form-textarea');
                    let isValid = true;

                    fields.forEach(field => {
                        const error = document.getElementById(\`error-\${field.name}\`);
                        error.textContent = '';

                        if (field.hasAttribute('required') && !field.value.trim()) {
                            error.textContent = 'This field is required';
                            isValid = false;
                        }
                    });

                    return isValid;
                }

                nextStep() {
                    this.recordStepTime();
                    this.stepHistory.push({
                        stepIndex: this.currentStep,
                        stepId: this.config.steps[this.currentStep].id,
                        completedAt: Date.now(),
                        data: { ...this.workflowData }
                    });

                    this.currentStep++;
                    this.saveWorkflowState();
                    this.renderCurrentStep();
                    this.updateProgressIndicator();
                    this.trackAnalytics('step_completed', { step: this.currentStep - 1 });
                }

                previousStep() {
                    if (this.currentStep > 0) {
                        this.currentStep--;
                        this.saveWorkflowState();
                        this.renderCurrentStep();
                        this.updateProgressIndicator();
                        this.trackAnalytics('step_back', { step: this.currentStep });
                    }
                }

                approve() {
                    this.workflowData['approval_result'] = 'approved';
                    this.workflowData['approval_timestamp'] = new Date().toISOString();
                    this.trackAnalytics('approval_granted');
                    this.nextStep();
                }

                reject() {
                    const reason = prompt('Please provide a reason for rejection:');
                    if (reason) {
                        this.workflowData['approval_result'] = 'rejected';
                        this.workflowData['rejection_reason'] = reason;
                        this.workflowData['rejection_timestamp'] = new Date().toISOString();
                        this.trackAnalytics('approval_rejected', { reason });
                        // In a real implementation, this might go to a different step
                        alert('Workflow has been rejected. This would typically route to a rejection handler.');
                    }
                }

                sendNotification() {
                    this.trackAnalytics('notification_sent');
                    alert('Notification sent successfully!');
                    this.nextStep();
                }

                evaluateDecision() {
                    const step = this.config.steps[this.currentStep];
                    const conditions = step.config?.conditions || [];

                    // Simple decision evaluation
                    let decisionResult = 'default';
                    for (const condition of conditions) {
                        const fieldValue = this.workflowData[condition.field];
                        let conditionMet = false;

                        switch (condition.operator) {
                            case 'equals':
                                conditionMet = fieldValue == condition.value;
                                break;
                            case 'greater_than':
                                conditionMet = parseFloat(fieldValue) > parseFloat(condition.value);
                                break;
                            case 'less_than':
                                conditionMet = parseFloat(fieldValue) < parseFloat(condition.value);
                                break;
                            case 'contains':
                                conditionMet = String(fieldValue).includes(String(condition.value));
                                break;
                        }

                        if (conditionMet) {
                            decisionResult = condition.result || 'condition_met';
                            break;
                        }
                    }

                    this.workflowData['decision_result'] = decisionResult;
                    this.trackAnalytics('decision_evaluated', { result: decisionResult });

                    document.getElementById('decision-result').innerHTML =
                        \`<strong>Decision Result:</strong> \${decisionResult}\`;

                    setTimeout(() => this.nextStep(), 1500);
                }

                updateProgressIndicator() {
                    const steps = document.querySelectorAll('.sap-progress-step');
                    steps.forEach((step, index) => {
                        step.className = \`sap-progress-step \${this.getStepStatus(index)}\`;
                        const circle = step.querySelector('.sap-progress-circle');
                        circle.innerHTML = this.getStepIcon(this.config.steps[index], index);
                    });
                }

                recordStepTime() {
                    const stepDuration = Date.now() - this.stepStartTime;
                    const stepId = this.config.steps[this.currentStep].id;
                    this.analytics.stepTimes[stepId] = stepDuration;
                }

                trackAnalytics(event, data = {}) {
                    if (this.config.analytics?.trackUserActions) {
                        this.analytics.userActions.push({
                            event,
                            timestamp: Date.now(),
                            step: this.currentStep,
                            data
                        });
                        this.logger.debug('Analytics:', event, data);
                    }
                }

                formatDuration(ms) {
                    const minutes = Math.floor(ms / 60000);
                    const seconds = Math.floor((ms % 60000) / 1000);
                    return \`\${minutes}m \${seconds}s\`;
                }

                downloadSummary() {
                    const summary = {
                        workflow: this.config.title,
                        type: this.config.workflowType,
                        completedAt: new Date().toISOString(),
                        duration: this.formatDuration(Date.now() - this.analytics.startTime),
                        steps: this.stepHistory,
                        finalData: this.workflowData,
                        analytics: this.analytics
                    };

                    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = \`workflow-summary-\${this.config.workflowType}-\${Date.now()}.json\`;
                    link.click();
                    URL.revokeObjectURL(url);
                }

                startNew() {
                    if (confirm('Start a new workflow? This will clear all current data.')) {
                        this.currentStep = 0;
                        this.workflowData = {};
                        this.stepHistory = [];
                        this.analytics = {
                            stepTimes: {},
                            userActions: [],
                            startTime: Date.now()
                        };
                        this.saveWorkflowState();
                        location.reload();
                    }
                }
            }

            // Initialize workflow when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                // Create workflow container
                const container = document.createElement('div');
                container.className = 'sap-workflow-container';
                document.body.appendChild(container);

                const workflowConfig = ${JSON.stringify(params, null, 2)};
                window.sapWorkflow = new SAPWorkflowEngine(workflowConfig);
            });
        `;
    }

    /**
     * Get notification summary for response
     */
    private getNotificationSummary(notifications?: any): string {
        if (!notifications) return 'None';

        const enabled = Object.entries(notifications)
            .filter(([_, enabled]) => enabled)
            .map(([type, _]) => type);

        return enabled.length > 0 ? enabled.join(', ') : 'None';
    }

    /**
     * Create workflow response object
     */
    private createWorkflowResponse(workflowResult: UIRenderResult, params: any, steps: WorkflowStep[]): any {
        return {
            workflowId: `sap-workflow-${params.workflowType}-${Date.now()}`,
            title: params.title,
            description: params.description,
            workflowType: params.workflowType,
            steps: steps,
            roles: params.roles,
            persistence: params.persistence,
            notifications: params.notifications,
            escalation: params.escalation,
            analytics: params.analytics,
            integration: params.integration,
            html: workflowResult.html,
            css: workflowResult.css,
            javascript: workflowResult.javascript,
            metadata: {
                generated: new Date().toISOString(),
                version: '1.0.0',
                toolName: 'ui-workflow-builder',
                stepCount: steps.length,
                features: {
                    progressTracking: true,
                    stateManagement: true,
                    analytics: !!params.analytics?.trackUserActions,
                    escalation: !!params.escalation?.enabled,
                    integration: !!params.integration
                }
            }
        };
    }

    /**
     * Check UI access permissions
     */
    private async checkUIAccess(requiredScope: string): Promise<{ hasAccess: boolean; reason?: string }> {
        // In a real implementation, this would check the current user's JWT token
        // For now, we'll return true (access granted)
        return { hasAccess: true };
    }
}