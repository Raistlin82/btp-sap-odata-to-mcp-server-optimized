import * as fs from 'fs';
import * as path from 'path';

export interface ToolSelectionRules {
    naturalLanguagePatterns: {
        italian: string[];
        english: string[];
    };
    directQueryPatterns: string[];
    performancePatterns: string[];
    processPatterns: string[];
}

export interface WorkflowConfig {
    version: string;
    lastUpdated: string;
    toolSelectionRules: ToolSelectionRules;
    toolPriorities: any;
    workflowSequences: any;
    toolDescriptionTemplates: any;
    authenticationRules: any;
    errorPrevention: any;
    customization: any;
}

export class WorkflowConfigLoader {
    private static instance: WorkflowConfigLoader;
    private config: WorkflowConfig | null = null;
    private workflowGuide: string | null = null;

    private constructor() {}

    public static getInstance(): WorkflowConfigLoader {
        if (!WorkflowConfigLoader.instance) {
            WorkflowConfigLoader.instance = new WorkflowConfigLoader();
        }
        return WorkflowConfigLoader.instance;
    }

    public loadConfig(): WorkflowConfig {
        if (this.config) {
            return this.config;
        }

        try {
            const configPath = path.join(process.cwd(), 'config', 'tool-routing-rules.json');
            const configContent = fs.readFileSync(configPath, 'utf-8');
            this.config = JSON.parse(configContent) as WorkflowConfig;
            return this.config;
        } catch (error) {
            console.warn('Failed to load workflow config, using defaults:', error);
            this.config = this.getDefaultConfig();
            return this.config;
        }
    }

    public loadWorkflowGuide(): string {
        if (this.workflowGuide) {
            return this.workflowGuide;
        }

        try {
            const guidePath = path.join(process.cwd(), 'config', 'workflow-guide.md');
            this.workflowGuide = fs.readFileSync(guidePath, 'utf-8');
            return this.workflowGuide;
        } catch (error) {
            console.warn('Failed to load workflow guide, using default:', error);
            return this.getDefaultWorkflowGuide();
        }
    }

    public reloadConfig(): void {
        this.config = null;
        this.workflowGuide = null;
    }

    private getDefaultConfig(): WorkflowConfig {
        return {
            version: "2.0.0",
            lastUpdated: new Date().toISOString(),
            toolSelectionRules: {
                naturalLanguagePatterns: {
                    italian: ["mostra.*ultim[oi]", "analizza.*creat[oi]", "trova.*sospeso"],
                    english: ["show.*last", "analyze.*created", "find.*pending"]
                },
                directQueryPatterns: ["\\$filter=", "\\$select=", "Set\\?"],
                performancePatterns: ["slow", "optimize", "performance"],
                processPatterns: ["process", "workflow", "bottleneck"]
            },
            toolPriorities: {},
            workflowSequences: {},
            toolDescriptionTemplates: {},
            authenticationRules: {},
            errorPrevention: {},
            customization: {}
        };
    }

    private getDefaultWorkflowGuide(): string {
        return `# SAP MCP Tools - Default Workflow Guide

## Tool Selection Rules
1. Natural language queries → natural-query-builder
2. Direct OData queries → execute-entity-operation
3. Data analysis → smart-data-analysis
4. Performance optimization → query-performance-optimizer
5. Process analysis → business-process-insights

## Authentication Requirements
- Discovery tools: No authentication required
- Execution tools: Authentication required
`;
    }

    public getToolDescription(toolName: string): string {
        const config = this.loadConfig();
        const template = config.toolDescriptionTemplates[toolName];
        
        if (!template) {
            return `${toolName} - Tool description not configured`;
        }

        let description = `${template.indicator || ''} ${template.description || ''}`;
        
        if (template.examples && template.examples.length > 0) {
            description += `. Examples: ${template.examples.join(', ')}`;
        }

        if (template.warning) {
            description += `. ${template.warning}`;
        }

        if (template.requirement) {
            description += `. ${template.requirement}`;
        }

        return description;
    }

    public getNextSteps(toolName: string): any {
        const config = this.loadConfig();
        const template = config.toolDescriptionTemplates[toolName];
        return template?.nextSteps || null;
    }

    public isAuthRequired(toolName: string): boolean {
        const config = this.loadConfig();
        return config.authenticationRules.authRequired?.includes(toolName) || false;
    }
}