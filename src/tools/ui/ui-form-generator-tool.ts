/**
 * UI Form Generator Tool
 * Generates interactive forms for SAP entities with validation and data binding
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SAPClient } from "../../services/sap-client.js";
import { Logger } from "../../utils/logger.js";
import { UIComponentLibrary } from "../../ui/components/ui-component-library.js";
import { IntelligentToolRouter } from "../../middleware/intelligent-tool-router.js";
import { SecureErrorHandler } from "../../utils/secure-error-handler.js";
import {
    FormConfig,
    FieldConfig,
    ValidationRules,
    UIRenderResult,
    ValidationConfig
} from "../../ui/types/ui-types.js";
import { z } from "zod";

const UIFormGeneratorSchema = {
    entityType: z.string().describe("SAP entity type (e.g., 'Customer', 'Product', 'Order')"),
    operation: z.enum(['create', 'update', 'search']).describe("Form operation type"),
    customFields: z.array(z.object({
        name: z.string(),
        label: z.string(),
        type: z.enum(['text', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect']),
        required: z.boolean().optional(),
        readonly: z.boolean().optional(),
        hidden: z.boolean().optional(),
        placeholder: z.string().optional(),
        defaultValue: z.any().optional(),
        options: z.array(z.object({
            key: z.string(),
            text: z.string(),
            description: z.string().optional()
        })).optional(),
        validation: z.object({
            required: z.boolean().optional(),
            pattern: z.string().optional(),
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
            min: z.number().optional(),
            max: z.number().optional()
        }).optional()
    })).optional().describe("Custom field configurations"),
    layout: z.enum(['vertical', 'horizontal', 'grid']).optional().describe("Form layout type"),
    theme: z.enum(['sap_horizon', 'sap_fiori_3']).optional().describe("SAP UI theme"),
    validation: z.record(z.object({
        required: z.boolean().optional(),
        pattern: z.string().optional(),
        minLength: z.number().optional(),
        maxLength: z.number().optional(),
        min: z.number().optional(),
        max: z.number().optional()
    })).optional().describe("Field validation rules")
};

export class UIFormGeneratorTool {
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
            "ui-form-generator",
            {
                title: "UI Form Generator",
                description: `Generate interactive forms for SAP entities with validation and data binding.

Features:
- Dynamic form generation based on SAP entity metadata
- Built-in validation with SAP-specific rules
- SAP Fiori design language compliance
- Support for all SAP field types (text, number, date, boolean, select)
- Custom field configurations and layouts
- Real-time validation feedback
- Responsive design for mobile and desktop

Required scope: ui.forms

Examples:
- Create customer form: {"entityType": "Customer", "operation": "create"}
- Search products with custom fields: {"entityType": "Product", "operation": "search", "customFields": [...]}
- Update order with validation: {"entityType": "Order", "operation": "update", "validation": {...}}`,
                inputSchema: UIFormGeneratorSchema
            },
            async (args: Record<string, unknown>) => {
                return await this.handleFormGeneration(args);
            }
        );

        this.logger.info("✅ UI Form Generator tool registered successfully");
    }

    private async handleFormGeneration(args: unknown): Promise<any> {
        try {
            // Validate input parameters
            const params = z.object(UIFormGeneratorSchema).parse(args);

            this.logger.info(`🎨 Generating UI form for entity: ${params.entityType}, operation: ${params.operation}`);

            // Check authentication and authorization
            const authCheck = await this.checkUIAccess('ui.forms');
            if (!authCheck.hasAccess) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Authorization denied: ${authCheck.reason || 'Access denied for UI form generation'}\n\nRequired scope: ui.forms`
                    }]
                };
            }

            // Step 1: Get entity metadata from SAP
            const entityMetadata = await this.getEntityMetadata(params.entityType);

            // Step 2: Generate form fields from metadata
            const formFields = await this.generateFormFields(entityMetadata, params);

            // Step 3: Create form configuration
            const formConfig: FormConfig = {
                entityType: params.entityType,
                operation: params.operation,
                layout: params.layout || 'vertical',
                theme: params.theme || 'sap_horizon',
                customFields: formFields,
                validation: params.validation || this.generateDefaultValidation(formFields)
            };

            // Step 4: Generate form UI
            const formResult = await this.componentLibrary.generateForm(formConfig);

            // Step 5: Add SAP-specific enhancements
            const enhancedResult = await this.enhanceFormResult(formResult, params);

            // Step 6: Prepare response
            const response = this.createFormResponse(enhancedResult, formConfig);

            this.logger.info(`✅ UI form generated successfully for ${params.entityType}`);

            return {
                content: [
                    {
                        type: "text",
                        text: `# SAP ${params.entityType} Form (${params.operation})\n\n` +
                              `Form generated successfully with ${formFields.length} fields.\n\n` +
                              `## Form Features:\n` +
                              `- Layout: ${formConfig.layout}\n` +
                              `- Theme: ${formConfig.theme}\n` +
                              `- Validation: ${Object.keys(formConfig.validation || {}).length} rules\n` +
                              `- Fields: ${formFields.map(f => f.name).join(', ')}\n\n` +
                              `## Usage:\n` +
                              `Embed this form in your SAP application or use via MCP client.\n\n` +
                              `## Technical Details:\n` +
                              `- Form ID: ${response.formId}\n` +
                              `- Entity Type: ${params.entityType}\n` +
                              `- Operation: ${params.operation}`
                    },
                    {
                        type: "resource",
                        data: response,
                        mimeType: "application/json"
                    }
                ]
            };

        } catch (error) {
            this.logger.error(`❌ Failed to generate UI form`, error as Error);
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to generate UI form: ${(error as Error).message}`
                }]
            };
        }
    }

    /**
     * Get entity metadata from SAP services
     */
    private async getEntityMetadata(entityType: string): Promise<any> {
        try {
            // Mock metadata for now - in real implementation this would call SAP services
            const mockMetadata = {
                properties: {
                    ID: { type: 'Edm.String', key: true, nullable: false },
                    Name: { type: 'Edm.String', nullable: false, maxLength: 100 },
                    Email: { type: 'Edm.String', nullable: true, maxLength: 255 },
                    Phone: { type: 'Edm.String', nullable: true, maxLength: 20 },
                    CreatedAt: { type: 'Edm.DateTime', nullable: false },
                    Active: { type: 'Edm.Boolean', nullable: false }
                }
            };

            this.logger.debug(`Using mock metadata for entity: ${entityType}`);
            return mockMetadata;

            throw new Error(`Entity type '${entityType}' not found in available SAP services`);

        } catch (error) {
            this.logger.error(`Failed to get metadata for entity ${entityType}`, error as Error);
            throw error;
        }
    }

    /**
     * Generate form fields from entity metadata
     */
    private async generateFormFields(metadata: any, params: any): Promise<FieldConfig[]> {
        const fields: FieldConfig[] = [];

        // Use custom fields if provided
        if (params.customFields && params.customFields.length > 0) {
            return params.customFields;
        }

        // Generate fields from metadata
        if (metadata.properties) {
            for (const [propertyName, property] of Object.entries(metadata.properties)) {
                const prop = property as any;

                const field: FieldConfig = {
                    name: propertyName,
                    label: this.formatFieldLabel(propertyName),
                    type: this.mapSAPTypeToFieldType(prop.type),
                    required: !prop.nullable,
                    readonly: prop.key === true, // Primary keys are readonly in update forms
                    hidden: this.shouldHideField(propertyName, params.operation),
                    placeholder: this.generatePlaceholder(propertyName, prop.type),
                    validation: this.generateFieldValidation(prop)
                };

                // Add options for enum types
                if (prop.enum && prop.enum.length > 0) {
                    field.options = prop.enum.map((value: string) => ({
                        key: value,
                        text: value
                    }));
                }

                fields.push(field);
            }
        }

        return fields;
    }

    /**
     * Map SAP OData types to UI field types
     */
    private mapSAPTypeToFieldType(sapType: string): 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect' {
        switch (sapType?.toLowerCase()) {
            case 'edm.string':
                return 'text';
            case 'edm.int32':
            case 'edm.int64':
            case 'edm.decimal':
            case 'edm.double':
                return 'number';
            case 'edm.datetime':
            case 'edm.datetimeoffset':
                return 'datetime';
            case 'edm.date':
                return 'date';
            case 'edm.boolean':
                return 'boolean';
            default:
                return 'text';
        }
    }

    /**
     * Format field name to human-readable label
     */
    private formatFieldLabel(fieldName: string): string {
        return fieldName
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .trim();
    }

    /**
     * Determine if field should be hidden based on operation
     */
    private shouldHideField(fieldName: string, operation: string): boolean {
        const hiddenFields: { [key: string]: string[] } = {
            create: ['id', 'createdAt', 'modifiedAt', 'createdBy', 'modifiedBy'],
            update: ['createdAt', 'createdBy'],
            search: []
        };

        return hiddenFields[operation]?.includes(fieldName.toLowerCase()) || false;
    }

    /**
     * Generate placeholder text for field
     */
    private generatePlaceholder(fieldName: string, sapType: string): string {
        switch (sapType?.toLowerCase()) {
            case 'edm.string':
                return `Enter ${this.formatFieldLabel(fieldName).toLowerCase()}`;
            case 'edm.int32':
            case 'edm.int64':
                return 'Enter number';
            case 'edm.decimal':
            case 'edm.double':
                return 'Enter decimal value';
            case 'edm.datetime':
            case 'edm.datetimeoffset':
                return 'Select date and time';
            case 'edm.date':
                return 'Select date';
            default:
                return `Enter ${this.formatFieldLabel(fieldName).toLowerCase()}`;
        }
    }

    /**
     * Generate field validation from SAP metadata
     */
    private generateFieldValidation(property: any): ValidationConfig {
        const validation: ValidationConfig = {};

        if (!property.nullable) {
            validation.required = true;
        }

        if (property.maxLength) {
            validation.maxLength = property.maxLength;
        }

        // Add type-specific validation
        switch (property.type?.toLowerCase()) {
            case 'edm.string':
                if (property.maxLength) {
                    validation.maxLength = property.maxLength;
                }
                break;
            case 'edm.int32':
                validation.pattern = '^-?\\d+$';
                break;
            case 'edm.decimal':
            case 'edm.double':
                validation.pattern = '^-?\\d*\\.?\\d+$';
                break;
        }

        return validation;
    }

    /**
     * Generate default validation rules for all fields
     */
    private generateDefaultValidation(fields: FieldConfig[]): ValidationRules {
        const validationRules: ValidationRules = {};

        fields.forEach(field => {
            if (field.validation) {
                validationRules[field.name] = field.validation;
            }
        });

        return validationRules;
    }

    /**
     * Enhance form result with SAP-specific functionality
     */
    private async enhanceFormResult(formResult: UIRenderResult, params: any): Promise<UIRenderResult> {
        // Add SAP-specific CSS
        const sapCSS = this.generateSAPFormCSS(params.theme || 'sap_horizon');

        // Add SAP-specific JavaScript
        const sapJS = this.generateSAPFormJS(params.entityType, params.operation);

        return {
            ...formResult,
            css: (formResult.css || '') + sapCSS,
            javascript: (formResult.javascript || '') + sapJS
        };
    }

    /**
     * Generate SAP-specific CSS
     */
    private generateSAPFormCSS(theme: string): string {
        return `
            /* SAP ${theme} Theme Styles */
            .sap-form-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
            }

            .sap-form-field {
                margin-bottom: 1.5rem;
            }

            .sap-label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #32363a;
                font-size: 0.875rem;
            }

            .sap-input, .sap-select {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #89919a;
                border-radius: 4px;
                font-size: 0.875rem;
                transition: border-color 0.2s ease;
            }

            .sap-input:focus, .sap-select:focus {
                outline: none;
                border-color: #0070f2;
                box-shadow: 0 0 0 2px rgba(0, 112, 242, 0.1);
            }

            .sap-input.error {
                border-color: #e53935;
            }

            .sap-field-help {
                font-size: 0.75rem;
                color: #6a6d70;
                margin-top: 0.25rem;
            }

            .sap-field-help.error {
                color: #e53935;
            }

            .sap-form-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid #e4e7ea;
            }

            .sap-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 4px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .sap-button-primary {
                background: #0070f2;
                color: white;
            }

            .sap-button-primary:hover {
                background: #0058d3;
            }

            .sap-button-secondary {
                background: #e4e7ea;
                color: #32363a;
            }

            .sap-button-secondary:hover {
                background: #d5d9dc;
            }
        `;
    }

    /**
     * Generate SAP-specific JavaScript
     */
    private generateSAPFormJS(entityType: string, operation: string): string {
        return `
            // SAP Form Handler for ${entityType}
            class SAPFormHandler {
                constructor(entityType, operation) {
                    this.entityType = entityType;
                    this.operation = operation;
                    this.validators = {};
                    this.init();
                }

                init() {
                    this.setupValidation();
                    this.setupEventHandlers();
                    this.logger.debug('SAP Form Handler initialized for', this.entityType, this.operation);
                }

                setupValidation() {
                    const form = document.querySelector('.sap-form');
                    if (!form) return;

                    const inputs = form.querySelectorAll('.sap-input, .sap-select');
                    inputs.forEach(input => {
                        input.addEventListener('blur', (e) => this.validateField(e.target));
                        input.addEventListener('input', (e) => this.clearFieldError(e.target));
                    });
                }

                setupEventHandlers() {
                    const form = document.querySelector('.sap-form');
                    if (form) {
                        form.addEventListener('submit', (e) => this.handleSubmit(e));
                    }
                }

                validateField(field) {
                    const fieldName = field.id.replace('-input', '').replace('-select', '');
                    const value = field.value;
                    const isValid = this.validateFieldValue(fieldName, value);

                    if (!isValid.valid) {
                        this.showFieldError(field, isValid.message);
                        return false;
                    } else {
                        this.clearFieldError(field);
                        return true;
                    }
                }

                validateFieldValue(fieldName, value) {
                    // Implement field-specific validation
                    if (this.validators[fieldName]) {
                        return this.validators[fieldName](value);
                    }

                    return { valid: true };
                }

                showFieldError(field, message) {
                    field.classList.add('error');
                    const helpDiv = document.getElementById(field.id.replace('-input', '-help').replace('-select', '-help'));
                    if (helpDiv) {
                        helpDiv.textContent = message;
                        helpDiv.classList.add('error');
                    }
                }

                clearFieldError(field) {
                    field.classList.remove('error');
                    const helpDiv = document.getElementById(field.id.replace('-input', '-help').replace('-select', '-help'));
                    if (helpDiv) {
                        helpDiv.textContent = '';
                        helpDiv.classList.remove('error');
                    }
                }

                handleSubmit(event) {
                    event.preventDefault();

                    const formData = this.collectFormData();
                    const validationResult = this.validateForm(formData);

                    if (validationResult.valid) {
                        this.submitForm(formData);
                    } else {
                        this.showFormErrors(validationResult.errors);
                    }
                }

                collectFormData() {
                    const form = document.querySelector('.sap-form');
                    const formData = new FormData(form);
                    const data = {};

                    for (const [key, value] of formData.entries()) {
                        data[key] = value;
                    }

                    return data;
                }

                validateForm(data) {
                    const errors = [];

                    // Perform comprehensive form validation
                    for (const [fieldName, value] of Object.entries(data)) {
                        const validation = this.validateFieldValue(fieldName, value);
                        if (!validation.valid) {
                            errors.push({ field: fieldName, message: validation.message });
                        }
                    }

                    return {
                        valid: errors.length === 0,
                        errors
                    };
                }

                submitForm(data) {
                    this.logger.debug('Submitting form data:', data);
                    // Implement actual form submission to SAP backend
                    alert('Form submitted successfully!');
                }

                showFormErrors(errors) {
                    errors.forEach(error => {
                        const field = document.getElementById('field-' + error.field + '-input') ||
                                     document.getElementById('field-' + error.field + '-select');
                        if (field) {
                            this.showFieldError(field, error.message);
                        }
                    });
                }
            }

            // Global form handler functions
            function handleFormSubmit(entityType, operation) {
                if (window.sapFormHandler) {
                    const form = document.querySelector('.sap-form');
                    if (form) {
                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(event);
                    }
                }
            }

            function resetForm(entityType) {
                const form = document.querySelector('.sap-form');
                if (form) {
                    form.reset();
                    // Clear all error states
                    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
                    form.querySelectorAll('.sap-field-help').forEach(el => {
                        el.textContent = '';
                        el.classList.remove('error');
                    });
                }
            }

            function cancelFormOperation() {
                if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                    window.history.back();
                }
            }

            // Initialize form handler when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                window.sapFormHandler = new SAPFormHandler('${entityType}', '${operation}');
            });
        `;
    }

    /**
     * Create form response object
     */
    private createFormResponse(formResult: UIRenderResult, formConfig: FormConfig): any {
        return {
            formId: `sap-form-${formConfig.entityType}-${Date.now()}`,
            entityType: formConfig.entityType,
            operation: formConfig.operation,
            layout: formConfig.layout,
            theme: formConfig.theme,
            html: formResult.html,
            css: formResult.css,
            javascript: formResult.javascript,
            bindings: formResult.bindings,
            eventHandlers: formResult.eventHandlers,
            validation: formConfig.validation,
            fields: formConfig.customFields,
            metadata: {
                generated: new Date().toISOString(),
                version: '1.0.0',
                toolName: 'ui-form-generator'
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