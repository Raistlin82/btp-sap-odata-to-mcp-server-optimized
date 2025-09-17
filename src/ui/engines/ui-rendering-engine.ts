/**
 * UI Rendering Engine
 * Core engine for rendering SAP UI components and templates
 */

import { Logger } from "../../utils/logger.js";
import {
    UIComponent,
    LayoutDefinition,
    UIRenderResult,
    TemplateContext,
    UIError
} from "../types/ui-types.js";

export class UIRenderingEngine {
    private logger: Logger;
    private templateCache: Map<string, string> = new Map();

    constructor() {
        this.logger = new Logger('UIRenderingEngine');
    }

    /**
     * Render a complete layout with components
     */
    public async renderLayout(layout: LayoutDefinition, context?: TemplateContext): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Rendering layout type: ${layout.type} with ${layout.components.length} components`);

            const renderedComponents = await Promise.all(
                layout.components.map(component => this.renderComponent(component, context))
            );

            const html = this.generateLayoutHTML(layout, renderedComponents);
            const css = this.generateLayoutCSS(layout);
            const javascript = this.generateLayoutJS(layout, renderedComponents);

            const bindings = renderedComponents.flatMap(comp => comp.bindings || []);
            const eventHandlers = this.mergeEventHandlers(renderedComponents);

            return {
                html,
                css,
                javascript,
                bindings,
                eventHandlers
            };

        } catch (error) {
            this.logger.error('Failed to render layout', error as Error);
            throw this.createUIError('LAYOUT_RENDER_FAILED', 'Failed to render layout', error);
        }
    }

    /**
     * Render a single UI component
     */
    public async renderComponent(component: UIComponent, context?: TemplateContext): Promise<UIRenderResult> {
        try {
            this.logger.debug(`Rendering component: ${component.type}#${component.id}`);

            // Get component template
            const template = await this.getComponentTemplate(component.type);

            // Prepare template context
            const componentContext = {
                ...context,
                component,
                data: component.data,
                config: component.config
            };

            // Render template
            const html = this.processTemplate(template, componentContext);
            const css = this.generateComponentCSS(component);
            const javascript = this.generateComponentJS(component);

            return {
                html,
                css,
                javascript,
                bindings: component.config.binding ? [component.config.binding] : [],
                eventHandlers: component.events || {}
            };

        } catch (error) {
            this.logger.error(`Failed to render component ${component.type}#${component.id}`, error as Error);
            throw this.createUIError('COMPONENT_RENDER_FAILED', `Failed to render component ${component.type}`, error);
        }
    }

    /**
     * Get component template from cache or load from file
     */
    private async getComponentTemplate(componentType: string): Promise<string> {
        const cacheKey = `template_${componentType}`;

        if (this.templateCache.has(cacheKey)) {
            return this.templateCache.get(cacheKey)!;
        }

        // Load template (in a real implementation, this would load from files)
        const template = this.getDefaultTemplate(componentType);
        this.templateCache.set(cacheKey, template);

        return template;
    }

    /**
     * Get default template for component type
     */
    private getDefaultTemplate(componentType: string): string {
        const templates: { [key: string]: string } = {
            'text-field': `
                <div class="sap-text-field {{config.cssClass}}" id="{{component.id}}">
                    <label for="{{component.id}}-input" class="sap-label">{{config.label}}</label>
                    <input
                        id="{{component.id}}-input"
                        type="text"
                        class="sap-input"
                        placeholder="{{config.placeholder}}"
                        value="{{data.value}}"
                        {{#if config.validation.required}}required{{/if}}
                        {{#if config.readonly}}readonly{{/if}}
                    />
                    <div class="sap-field-help" id="{{component.id}}-help"></div>
                </div>
            `,
            'select-field': `
                <div class="sap-select-field {{config.cssClass}}" id="{{component.id}}">
                    <label for="{{component.id}}-select" class="sap-label">{{config.label}}</label>
                    <select id="{{component.id}}-select" class="sap-select">
                        {{#each config.options}}
                        <option value="{{key}}" {{#if selected}}selected{{/if}}>{{text}}</option>
                        {{/each}}
                    </select>
                </div>
            `,
            'data-grid': `
                <div class="sap-data-grid {{config.cssClass}}" id="{{component.id}}">
                    <div class="sap-grid-toolbar">
                        <h3 class="sap-grid-title">{{config.title}}</h3>
                        <div class="sap-grid-actions">
                            {{#if config.features.export}}
                            <button class="sap-button sap-button-secondary" onclick="exportGrid('{{component.id}}')">Export</button>
                            {{/if}}
                        </div>
                    </div>
                    <table class="sap-table">
                        <thead>
                            <tr>
                                {{#each config.columns}}
                                <th class="sap-table-header {{#if sortable}}sortable{{/if}}" data-key="{{key}}">
                                    {{label}}
                                </th>
                                {{/each}}
                            </tr>
                        </thead>
                        <tbody>
                            {{#each data.rows}}
                            <tr class="sap-table-row">
                                {{#each ../config.columns}}
                                <td class="sap-table-cell">{{lookup ../this key}}</td>
                                {{/each}}
                            </tr>
                            {{/each}}
                        </tbody>
                    </table>
                </div>
            `,
            'form-container': `
                <div class="sap-form-container {{config.cssClass}}" id="{{component.id}}">
                    <form class="sap-form sap-form-{{config.layout}}">
                        <div class="sap-form-content">
                            {{#each config.fields}}
                            <div class="sap-form-field">
                                {{{renderField this}}}
                            </div>
                            {{/each}}
                        </div>
                        <div class="sap-form-actions">
                            <button type="submit" class="sap-button sap-button-primary">{{config.submitLabel}}</button>
                            <button type="button" class="sap-button sap-button-secondary" onclick="cancelForm('{{../component.id}}')">{{config.cancelLabel}}</button>
                        </div>
                    </form>
                </div>
            `
        };

        return templates[componentType] || `<div>Unknown component type: ${componentType}</div>`;
    }

    /**
     * Process template with context data (simple Handlebars-like implementation)
     */
    private processTemplate(template: string, context: TemplateContext): string {
        let processed = template;

        // Simple variable substitution {{variable}}
        processed = processed.replace(/\{\{([^{}]+)\}\}/g, (match, path) => {
            const value = this.getValueFromPath(context, path.trim());
            return value !== undefined ? String(value) : '';
        });

        // Simple conditional {{#if condition}}content{{/if}}
        processed = processed.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
            const conditionValue = this.getValueFromPath(context, condition.trim());
            return conditionValue ? content : '';
        });

        // Simple iteration {{#each array}}content{{/each}}
        processed = processed.replace(/\{\{#each\s+([^}]+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayPath, content) => {
            const array = this.getValueFromPath(context, arrayPath.trim());
            if (Array.isArray(array)) {
                return array.map(item => {
                    const itemContext = { ...context, this: item };
                    return this.processTemplate(content, itemContext);
                }).join('');
            }
            return '';
        });

        return processed;
    }

    /**
     * Get value from object path (e.g., "config.validation.required")
     */
    private getValueFromPath(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Generate layout HTML structure
     */
    private generateLayoutHTML(layout: LayoutDefinition, components: UIRenderResult[]): string {
        const layoutClass = `sap-layout sap-layout-${layout.type}`;

        let html = `<div class="${layoutClass}">`;

        components.forEach(component => {
            html += component.html;
        });

        html += '</div>';

        return html;
    }

    /**
     * Generate CSS for layout
     */
    private generateLayoutCSS(layout: LayoutDefinition): string {
        let css = '';

        switch (layout.type) {
            case 'grid':
                css += `
                    .sap-layout-grid {
                        display: grid;
                        grid-template-columns: repeat(${layout.config.columns || 'auto-fit'}, 1fr);
                        gap: ${layout.config.gap || '1rem'};
                        padding: ${layout.config.padding || '1rem'};
                    }
                `;
                break;
            case 'flexbox':
                css += `
                    .sap-layout-flexbox {
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${layout.config.gap || '1rem'};
                        padding: ${layout.config.padding || '1rem'};
                    }
                `;
                break;
        }

        return css;
    }

    /**
     * Generate component-specific CSS
     */
    private generateComponentCSS(component: UIComponent): string {
        let css = '';

        if (component.config.style) {
            const styles = Object.entries(component.config.style)
                .map(([prop, value]) => `${prop}: ${value}`)
                .join('; ');
            css += `#${component.id} { ${styles} }`;
        }

        return css;
    }

    /**
     * Generate JavaScript for layout and components
     */
    private generateLayoutJS(layout: LayoutDefinition, components: UIRenderResult[]): string {
        let js = '';

        // Add component initialization
        components.forEach((component, index) => {
            if (component.javascript) {
                js += component.javascript;
            }
        });

        // Add layout-specific JavaScript
        js += `
            // Layout initialization
            document.addEventListener('DOMContentLoaded', function() {
                // Initialize layout-specific functionality
                console.log('Layout ${layout.type} initialized');
            });
        `;

        return js;
    }

    /**
     * Generate component-specific JavaScript
     */
    private generateComponentJS(component: UIComponent): string {
        let js = '';

        // Add event handlers
        if (component.events) {
            Object.entries(component.events).forEach(([event, handler]) => {
                if (typeof handler === 'string') {
                    js += `
                        document.getElementById('${component.id}').addEventListener('${event}', function(e) {
                            ${handler}
                        });
                    `;
                }
            });
        }

        return js;
    }

    /**
     * Merge event handlers from multiple components
     */
    private mergeEventHandlers(components: UIRenderResult[]): { [key: string]: any } {
        const merged: { [key: string]: any } = {};

        components.forEach(component => {
            if (component.eventHandlers) {
                Object.assign(merged, component.eventHandlers);
            }
        });

        return merged;
    }

    /**
     * Create a standardized UI error
     */
    private createUIError(code: string, message: string, originalError?: any): UIError {
        return {
            code,
            message,
            details: originalError?.message || originalError
        };
    }

    /**
     * Clear template cache
     */
    public clearCache(): void {
        this.templateCache.clear();
        this.logger.debug('Template cache cleared');
    }
}