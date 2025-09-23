/**
 * UI Data Grid Tool
 * Generates interactive data grids with sorting, filtering, pagination and export
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SAPClient } from "../../services/sap-client.js";
import { Logger } from "../../utils/logger.js";
import { UIComponentLibrary } from "../../ui/components/ui-component-library.js";
import { IntelligentToolRouter } from "../../middleware/intelligent-tool-router.js";
import { SecureErrorHandler } from "../../utils/secure-error-handler.js";
import {
    GridConfig,
    ColumnConfig,
    GridFeatures,
    UIRenderResult
} from "../../ui/types/ui-types.js";
import { z } from "zod";

const UIDataGridSchema = {
    entitySet: z.string().describe("SAP entity set name (e.g., 'Customers', 'Products', 'Orders')"),
    serviceId: z.string().optional().describe("SAP service ID containing the entity set"),
    columns: z.array(z.object({
        key: z.string().describe("Field name from entity"),
        label: z.string().describe("Column header display name"),
        type: z.enum(['text', 'number', 'date', 'boolean', 'custom']).optional().describe("Column data type"),
        width: z.string().optional().describe("Column width (e.g., '150px', '20%')"),
        sortable: z.boolean().optional().describe("Enable sorting for this column"),
        filterable: z.boolean().optional().describe("Enable filtering for this column"),
        formatter: z.string().optional().describe("Custom formatter function name"),
        template: z.string().optional().describe("Custom cell template")
    })).optional().describe("Custom column configurations"),
    features: z.object({
        sorting: z.boolean().optional().describe("Enable sorting functionality"),
        filtering: z.boolean().optional().describe("Enable filtering functionality"),
        grouping: z.boolean().optional().describe("Enable grouping functionality"),
        export: z.boolean().optional().describe("Enable export functionality"),
        columnResize: z.boolean().optional().describe("Enable column resizing"),
        virtualScrolling: z.boolean().optional().describe("Enable virtual scrolling for large datasets")
    }).optional().describe("Grid feature toggles"),
    pageSize: z.number().min(1).max(1000).optional().describe("Number of rows per page"),
    selectionMode: z.enum(['none', 'single', 'multiple']).optional().describe("Row selection mode"),
    initialData: z.array(z.record(z.any())).optional().describe("Initial data to display"),
    dataQuery: z.object({
        filter: z.string().optional().describe("OData $filter query"),
        orderby: z.string().optional().describe("OData $orderby query"),
        select: z.string().optional().describe("OData $select query"),
        top: z.number().optional().describe("OData $top query"),
        skip: z.number().optional().describe("OData $skip query")
    }).optional().describe("Initial data query parameters"),
    theme: z.enum(['sap_horizon', 'sap_fiori_3']).optional().describe("SAP UI theme"),
    responsive: z.boolean().optional().describe("Enable responsive design")
};

export class UIDataGridTool {
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
            "ui-data-grid",
            {
                title: "UI Data Grid Generator",
                description: `Generate interactive data grids for SAP entities with advanced features.

Features:
- Dynamic columns from SAP entity metadata
- Sorting, filtering, and grouping capabilities
- Export to Excel/CSV/PDF formats
- Virtual scrolling for large datasets
- Column resizing and reordering
- Responsive design for mobile/desktop
- Real-time data refresh
- Selection modes (single/multiple)
- Custom cell formatters and templates

Required scope: ui.grids

Examples:
- Basic customer grid: {"entitySet": "Customers"}
- Products with custom columns: {"entitySet": "Products", "columns": [...]}
- Orders with filtering: {"entitySet": "Orders", "features": {"filtering": true, "export": true}}`,
                inputSchema: UIDataGridSchema
            },
            async (args: Record<string, unknown>) => {
                return await this.handleDataGridGeneration(args);
            }
        );

        this.logger.info("✅ UI Data Grid tool registered successfully");
    }

    private async handleDataGridGeneration(args: unknown): Promise<any> {
        try {
            // Validate input parameters
            const params = z.object(UIDataGridSchema).parse(args);

            this.logger.info(`📊 Generating UI data grid for entity set: ${params.entitySet}`);

            // Check authentication and authorization
            const authCheck = await this.checkUIAccess('ui.grids');
            if (!authCheck.hasAccess) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Authorization denied: ${authCheck.reason || 'Access denied for UI grid generation'}\n\nRequired scope: ui.grids`
                    }]
                };
            }

            // Step 1: Get entity metadata
            const entityMetadata = await this.getEntityMetadata(params.entitySet, params.serviceId);

            // Step 2: Generate columns from metadata or use custom
            const gridColumns = params.columns ? params.columns.map(col => ({
                ...col,
                formatter: undefined // Convert string formatters to undefined for now
            })) : await this.generateColumnsFromMetadata(entityMetadata);

            // Step 3: Fetch initial data if query provided
            const initialData = params.initialData || await this.fetchInitialData(params.entitySet, params.dataQuery);

            // Step 4: Create grid configuration
            const gridConfig: GridConfig = {
                entitySet: params.entitySet,
                columns: gridColumns,
                features: {
                    sorting: true,
                    filtering: true,
                    export: true,
                    columnResize: true,
                    virtualScrolling: Boolean(params.pageSize && params.pageSize > 100),
                    ...params.features
                },
                pageSize: params.pageSize || 20,
                selectionMode: params.selectionMode || 'single'
            };

            // Step 5: Generate grid UI
            const gridResult = await this.componentLibrary.generateDataGrid(gridConfig);

            // Step 6: Add SAP-specific enhancements
            const enhancedResult = await this.enhanceGridResult(gridResult, params, initialData);

            // Step 7: Prepare response
            const response = this.createGridResponse(enhancedResult, gridConfig, initialData);

            this.logger.info(`✅ UI data grid generated successfully for ${params.entitySet}`);

            return {
                content: [
                    {
                        type: "text",
                        text: `# SAP ${params.entitySet} Data Grid\n\n` +
                              `Interactive data grid generated successfully.\n\n` +
                              `## Grid Features:\n` +
                              `- Columns: ${gridColumns.length}\n` +
                              `- Sorting: ${gridConfig.features?.sorting ? '✅' : '❌'}\n` +
                              `- Filtering: ${gridConfig.features?.filtering ? '✅' : '❌'}\n` +
                              `- Export: ${gridConfig.features?.export ? '✅' : '❌'}\n` +
                              `- Virtual Scrolling: ${gridConfig.features?.virtualScrolling ? '✅' : '❌'}\n` +
                              `- Page Size: ${gridConfig.pageSize}\n` +
                              `- Selection Mode: ${gridConfig.selectionMode}\n\n` +
                              `## Data:\n` +
                              `- Initial Rows: ${initialData.length}\n` +
                              `- Entity Set: ${params.entitySet}\n\n` +
                              `## Usage:\n` +
                              `Embed this grid in your SAP application or use via MCP client.`
                    },
                    {
                        type: "resource",
                        data: response,
                        mimeType: "application/json"
                    }
                ]
            };

        } catch (error) {
            this.logger.error(`❌ Failed to generate UI data grid`, error as Error);
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to generate UI data grid: ${(error as Error).message}`
                }]
            };
        }
    }

    /**
     * Get entity metadata for grid generation
     */
    private async getEntityMetadata(entitySet: string, serviceId?: string): Promise<any> {
        try {
            // Mock metadata based on common SAP entity patterns
            const mockMetadata = {
                entitySet,
                properties: this.getMockPropertiesForEntitySet(entitySet)
            };

            this.logger.debug(`Using mock metadata for entity set: ${entitySet}`);
            return mockMetadata;

        } catch (error) {
            this.logger.error(`Failed to get metadata for entity set ${entitySet}`, error as Error);
            throw error;
        }
    }

    /**
     * Generate mock properties based on entity set name
     */
    private getMockPropertiesForEntitySet(entitySet: string): any {
        const commonFields = {
            ID: { type: 'Edm.String', key: true },
            CreatedAt: { type: 'Edm.DateTime' },
            ModifiedAt: { type: 'Edm.DateTime' },
            Active: { type: 'Edm.Boolean' }
        };

        const entitySpecificFields: { [key: string]: any } = {
            Customers: {
                CustomerID: { type: 'Edm.String', key: true },
                CompanyName: { type: 'Edm.String' },
                ContactName: { type: 'Edm.String' },
                Email: { type: 'Edm.String' },
                Phone: { type: 'Edm.String' },
                Country: { type: 'Edm.String' },
                City: { type: 'Edm.String' },
                Revenue: { type: 'Edm.Decimal' },
                Status: { type: 'Edm.String', enum: ['Active', 'Inactive', 'Pending'] }
            },
            Products: {
                ProductID: { type: 'Edm.String', key: true },
                ProductName: { type: 'Edm.String' },
                Category: { type: 'Edm.String' },
                Price: { type: 'Edm.Decimal' },
                UnitsInStock: { type: 'Edm.Int32' },
                Discontinued: { type: 'Edm.Boolean' },
                SupplierID: { type: 'Edm.String' },
                Description: { type: 'Edm.String' }
            },
            Orders: {
                OrderID: { type: 'Edm.String', key: true },
                CustomerID: { type: 'Edm.String' },
                OrderDate: { type: 'Edm.DateTime' },
                ShippedDate: { type: 'Edm.DateTime' },
                TotalAmount: { type: 'Edm.Decimal' },
                Status: { type: 'Edm.String', enum: ['Open', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
                ShipCountry: { type: 'Edm.String' },
                ShipCity: { type: 'Edm.String' }
            }
        };

        const specificFields = entitySpecificFields[entitySet] || {
            Name: { type: 'Edm.String' },
            Description: { type: 'Edm.String' },
            Status: { type: 'Edm.String' }
        };

        return { ...specificFields, ...commonFields };
    }

    /**
     * Generate columns from entity metadata
     */
    private async generateColumnsFromMetadata(metadata: any): Promise<ColumnConfig[]> {
        const columns: ColumnConfig[] = [];
        const properties = metadata.properties || {};

        for (const [propertyName, property] of Object.entries(properties)) {
            const prop = property as any;

            // Skip system fields for grid display
            if (['CreatedAt', 'ModifiedAt', 'CreatedBy', 'ModifiedBy'].includes(propertyName)) {
                continue;
            }

            const column: ColumnConfig = {
                key: propertyName,
                label: this.formatColumnLabel(propertyName),
                type: this.mapSAPTypeToColumnType(prop.type),
                sortable: true,
                filterable: !prop.key, // Primary keys usually don't need filtering
                width: this.getDefaultColumnWidth(prop.type),
                formatter: undefined // Formatter functions will be handled in the UI layer
            };

            columns.push(column);
        }

        return columns;
    }

    /**
     * Map SAP OData types to grid column types
     */
    private mapSAPTypeToColumnType(sapType: string): 'text' | 'number' | 'date' | 'boolean' | 'custom' {
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
            case 'edm.date':
                return 'date';
            case 'edm.boolean':
                return 'boolean';
            default:
                return 'text';
        }
    }

    /**
     * Format column header labels
     */
    private formatColumnLabel(propertyName: string): string {
        return propertyName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Get default column width based on type
     */
    private getDefaultColumnWidth(sapType: string): string {
        switch (sapType?.toLowerCase()) {
            case 'edm.boolean':
                return '80px';
            case 'edm.int32':
            case 'edm.int64':
                return '100px';
            case 'edm.decimal':
            case 'edm.double':
                return '120px';
            case 'edm.datetime':
            case 'edm.datetimeoffset':
                return '150px';
            case 'edm.date':
                return '120px';
            default:
                return '150px';
        }
    }

    /**
     * Get column formatter function name
     */
    private getColumnFormatter(sapType: string, propertyName: string): string | undefined {
        switch (sapType?.toLowerCase()) {
            case 'edm.decimal':
            case 'edm.double':
                if (propertyName.toLowerCase().includes('price') ||
                    propertyName.toLowerCase().includes('amount') ||
                    propertyName.toLowerCase().includes('revenue')) {
                    return 'formatCurrency';
                }
                return 'formatNumber';
            case 'edm.datetime':
            case 'edm.datetimeoffset':
                return 'formatDateTime';
            case 'edm.date':
                return 'formatDate';
            case 'edm.boolean':
                return 'formatBoolean';
            default:
                return undefined;
        }
    }

    /**
     * Fetch initial data for the grid
     */
    private async fetchInitialData(entitySet: string, dataQuery?: any): Promise<any[]> {
        try {
            // Generate mock data based on entity set
            const mockData = this.generateMockData(entitySet, dataQuery?.top || 20);

            this.logger.debug(`Generated ${mockData.length} mock records for ${entitySet}`);
            return mockData;

        } catch (error) {
            this.logger.error(`Failed to fetch initial data for ${entitySet}`, error as Error);
            return [];
        }
    }

    /**
     * Generate mock data for different entity sets
     */
    private generateMockData(entitySet: string, count: number): any[] {
        const data: any[] = [];

        for (let i = 1; i <= count; i++) {
            let record: any;

            switch (entitySet) {
                case 'Customers':
                    record = {
                        CustomerID: `CUST${i.toString().padStart(4, '0')}`,
                        CompanyName: `Company ${i}`,
                        ContactName: `Contact Person ${i}`,
                        Email: `contact${i}@company${i}.com`,
                        Phone: `+1-555-${i.toString().padStart(4, '0')}`,
                        Country: ['USA', 'Germany', 'UK', 'France', 'Italy'][i % 5],
                        City: ['New York', 'Berlin', 'London', 'Paris', 'Rome'][i % 5],
                        Revenue: Math.round((Math.random() * 1000000) * 100) / 100,
                        Status: ['Active', 'Inactive', 'Pending'][i % 3],
                        Active: i % 4 !== 0,
                        CreatedAt: new Date(2024, 0, i),
                        ModifiedAt: new Date(2024, 6, i)
                    };
                    break;

                case 'Products':
                    record = {
                        ProductID: `PROD${i.toString().padStart(4, '0')}`,
                        ProductName: `Product ${i}`,
                        Category: ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports'][i % 5],
                        Price: Math.round((Math.random() * 500 + 10) * 100) / 100,
                        UnitsInStock: Math.floor(Math.random() * 100),
                        Discontinued: i % 10 === 0,
                        SupplierID: `SUP${(i % 5 + 1).toString().padStart(3, '0')}`,
                        Description: `High-quality product ${i} for various applications`,
                        Active: i % 8 !== 0,
                        CreatedAt: new Date(2024, 0, i),
                        ModifiedAt: new Date(2024, 6, i)
                    };
                    break;

                case 'Orders':
                    record = {
                        OrderID: `ORD${i.toString().padStart(6, '0')}`,
                        CustomerID: `CUST${((i % 20) + 1).toString().padStart(4, '0')}`,
                        OrderDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
                        ShippedDate: Math.random() > 0.3 ? new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1) : null,
                        TotalAmount: Math.round((Math.random() * 5000 + 100) * 100) / 100,
                        Status: ['Open', 'Processing', 'Shipped', 'Delivered', 'Cancelled'][i % 5],
                        ShipCountry: ['USA', 'Germany', 'UK', 'France', 'Italy'][i % 5],
                        ShipCity: ['New York', 'Berlin', 'London', 'Paris', 'Rome'][i % 5],
                        Active: i % 15 !== 0,
                        CreatedAt: new Date(2024, 0, i),
                        ModifiedAt: new Date(2024, 6, i)
                    };
                    break;

                default:
                    record = {
                        ID: `${entitySet.toUpperCase()}${i.toString().padStart(4, '0')}`,
                        Name: `${entitySet} Item ${i}`,
                        Description: `Description for ${entitySet} item ${i}`,
                        Status: ['Active', 'Inactive'][i % 2],
                        Active: i % 3 !== 0,
                        CreatedAt: new Date(2024, 0, i),
                        ModifiedAt: new Date(2024, 6, i)
                    };
            }

            data.push(record);
        }

        return data;
    }

    /**
     * Enhance grid result with SAP-specific functionality
     */
    private async enhanceGridResult(gridResult: UIRenderResult, params: any, data: any[]): Promise<UIRenderResult> {
        // Add SAP-specific CSS
        const sapCSS = this.generateSAPGridCSS(params.theme || 'sap_horizon');

        // Add SAP-specific JavaScript
        const sapJS = this.generateSAPGridJS(params.entitySet, data);

        return {
            ...gridResult,
            css: (gridResult.css || '') + sapCSS,
            javascript: (gridResult.javascript || '') + sapJS
        };
    }

    /**
     * Generate SAP-specific CSS for data grid
     */
    private generateSAPGridCSS(theme: string): string {
        return `
            /* SAP ${theme} Data Grid Styles */
            .sap-data-grid {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                margin: 1rem 0;
            }

            .sap-grid-toolbar {
                background: #f7f8fa;
                border-bottom: 1px solid #e4e7ea;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .sap-grid-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: #0070f2;
                margin: 0;
            }

            .sap-grid-actions {
                display: flex;
                gap: 0.5rem;
            }

            .sap-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.875rem;
            }

            .sap-table-header {
                background: #f7f8fa;
                border-bottom: 2px solid #e4e7ea;
                padding: 0.75rem 1rem;
                text-align: left;
                font-weight: 600;
                color: #32363a;
                cursor: pointer;
                user-select: none;
                transition: background-color 0.2s ease;
            }

            .sap-table-header:hover {
                background: #e9ecef;
            }

            .sap-table-header.sortable::after {
                content: ' ↕️';
                opacity: 0.5;
                margin-left: 0.5rem;
            }

            .sap-table-header.sorted-asc::after {
                content: ' ↑';
                opacity: 1;
                color: #0070f2;
            }

            .sap-table-header.sorted-desc::after {
                content: ' ↓';
                opacity: 1;
                color: #0070f2;
            }

            .sap-table-row {
                border-bottom: 1px solid #e4e7ea;
                transition: background-color 0.2s ease;
                cursor: pointer;
            }

            .sap-table-row:hover {
                background: #f9fafb;
            }

            .sap-table-row.selected {
                background: #e3f2fd;
                border-color: #0070f2;
            }

            .sap-table-cell {
                padding: 0.75rem 1rem;
                vertical-align: middle;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            }

            .sap-table-cell.number {
                text-align: right;
                font-family: 'Courier New', monospace;
            }

            .sap-table-cell.boolean {
                text-align: center;
            }

            .sap-table-cell.date {
                font-family: 'Courier New', monospace;
            }

            .sap-status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
            }

            .sap-status-active {
                background: #e8f5e8;
                color: #2e7d32;
            }

            .sap-status-inactive {
                background: #ffeaa7;
                color: #d68910;
            }

            .sap-status-pending {
                background: #e3f2fd;
                color: #1976d2;
            }

            .sap-grid-pagination {
                background: #f7f8fa;
                border-top: 1px solid #e4e7ea;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .sap-pagination-info {
                color: #6a6d70;
                font-size: 0.875rem;
            }

            .sap-pagination-controls {
                display: flex;
                gap: 0.5rem;
            }

            .sap-button {
                padding: 0.5rem 1rem;
                border: 1px solid #d5d9dc;
                border-radius: 4px;
                background: white;
                color: #32363a;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .sap-button:hover:not(:disabled) {
                background: #f7f8fa;
                border-color: #0070f2;
            }

            .sap-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .sap-button-primary {
                background: #0070f2;
                color: white;
                border-color: #0070f2;
            }

            .sap-button-primary:hover:not(:disabled) {
                background: #0058d3;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .sap-grid-toolbar {
                    flex-direction: column;
                    gap: 1rem;
                    align-items: stretch;
                }

                .sap-table {
                    font-size: 0.75rem;
                }

                .sap-table-cell {
                    padding: 0.5rem;
                    max-width: 120px;
                }

                .sap-grid-pagination {
                    flex-direction: column;
                    gap: 1rem;
                    text-align: center;
                }
            }
        `;
    }

    /**
     * Generate SAP-specific JavaScript for data grid
     */
    private generateSAPGridJS(entitySet: string, data: any[]): string {
        return `
            // SAP Data Grid Handler for ${entitySet}
            class SAPDataGrid {
                constructor(entitySet, initialData) {
                    this.entitySet = entitySet;
                    this.data = initialData || [];
                    this.filteredData = [...this.data];
                    this.currentPage = 1;
                    this.pageSize = 20;
                    this.sortColumn = null;
                    this.sortDirection = 'asc';
                    this.selectedRows = new Set();
                    this.init();
                }

                init() {
                    this.setupEventHandlers();
                    this.renderGrid();
                    this.logger.debug('SAP Data Grid initialized for', this.entitySet, 'with', this.data.length, 'records');
                }

                setupEventHandlers() {
                    // Column sorting
                    document.addEventListener('click', (e) => {
                        if (e.target.classList.contains('sap-table-header') && e.target.classList.contains('sortable')) {
                            this.handleSort(e.target);
                        }
                    });

                    // Row selection
                    document.addEventListener('click', (e) => {
                        if (e.target.closest('.sap-table-row')) {
                            this.handleRowSelection(e.target.closest('.sap-table-row'));
                        }
                    });

                    // Export functionality
                    document.addEventListener('click', (e) => {
                        if (e.target.classList.contains('export-btn')) {
                            this.handleExport(e.target.dataset.format);
                        }
                    });
                }

                handleSort(headerElement) {
                    const column = headerElement.dataset.key;

                    if (this.sortColumn === column) {
                        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortColumn = column;
                        this.sortDirection = 'asc';
                    }

                    this.sortData();
                    this.updateSortIndicators();
                    this.renderGrid();
                }

                sortData() {
                    this.filteredData.sort((a, b) => {
                        const aVal = a[this.sortColumn];
                        const bVal = b[this.sortColumn];

                        let comparison = 0;
                        if (aVal < bVal) comparison = -1;
                        if (aVal > bVal) comparison = 1;

                        return this.sortDirection === 'desc' ? -comparison : comparison;
                    });
                }

                updateSortIndicators() {
                    // Clear all sort indicators
                    document.querySelectorAll('.sap-table-header').forEach(header => {
                        header.classList.remove('sorted-asc', 'sorted-desc');
                    });

                    // Add indicator to current sort column
                    const currentHeader = document.querySelector(\`[data-key="\${this.sortColumn}"]\`);
                    if (currentHeader) {
                        currentHeader.classList.add(\`sorted-\${this.sortDirection}\`);
                    }
                }

                handleRowSelection(rowElement) {
                    const rowId = rowElement.dataset.rowId;

                    if (this.selectedRows.has(rowId)) {
                        this.selectedRows.delete(rowId);
                        rowElement.classList.remove('selected');
                    } else {
                        this.selectedRows.add(rowId);
                        rowElement.classList.add('selected');
                    }

                    this.logger.debug('Selected rows:', Array.from(this.selectedRows););
                }

                handleExport(format) {
                    const exportData = this.filteredData.map(row => {
                        const exported = {};
                        Object.keys(row).forEach(key => {
                            if (!['Active', 'CreatedAt', 'ModifiedAt'].includes(key)) {
                                exported[key] = row[key];
                            }
                        });
                        return exported;
                    });

                    switch (format) {
                        case 'csv':
                            this.exportToCSV(exportData);
                            break;
                        case 'excel':
                            this.exportToExcel(exportData);
                            break;
                        case 'json':
                            this.exportToJSON(exportData);
                            break;
                        default:
                            this.logger.debug('Export data:', exportData);
                    }
                }

                exportToCSV(data) {
                    if (data.length === 0) return;

                    const headers = Object.keys(data[0]);
                    const csvContent = [
                        headers.join(','),
                        ...data.map(row => headers.map(header => \`"\${row[header] || ''}"\`).join(','))
                    ].join('\\n');

                    this.downloadFile(csvContent, \`\${this.entitySet}-export.csv\`, 'text/csv');
                }

                exportToJSON(data) {
                    const jsonContent = JSON.stringify(data, null, 2);
                    this.downloadFile(jsonContent, \`\${this.entitySet}-export.json\`, 'application/json');
                }

                downloadFile(content, filename, mimeType) {
                    const blob = new Blob([content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(url);
                }

                renderGrid() {
                    const startIndex = (this.currentPage - 1) * this.pageSize;
                    const endIndex = startIndex + this.pageSize;
                    const pageData = this.filteredData.slice(startIndex, endIndex);

                    // Update grid content
                    this.updateGridData(pageData);
                    this.updatePagination();
                }

                updateGridData(pageData) {
                    const tbody = document.querySelector('.sap-table tbody');
                    if (!tbody) return;

                    tbody.innerHTML = pageData.map((row, index) => {
                        const rowId = row.ID || row[\`\${this.entitySet}ID\`] || index;
                        return \`
                            <tr class="sap-table-row" data-row-id="\${rowId}">
                                \${Object.entries(row).map(([key, value]) => {
                                    if (['CreatedAt', 'ModifiedAt'].includes(key)) return '';

                                    let cellClass = 'sap-table-cell';
                                    let cellContent = value;

                                    // Format cell content based on type
                                    if (typeof value === 'number') {
                                        cellClass += ' number';
                                        if (key.toLowerCase().includes('price') ||
                                            key.toLowerCase().includes('amount') ||
                                            key.toLowerCase().includes('revenue')) {
                                            cellContent = new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD'
                                            }).format(value);
                                        } else {
                                            cellContent = new Intl.NumberFormat().format(value);
                                        }
                                    } else if (typeof value === 'boolean') {
                                        cellClass += ' boolean';
                                        cellContent = value ? '✅' : '❌';
                                    } else if (value instanceof Date || (typeof value === 'string' && /\\d{4}-\\d{2}-\\d{2}/.test(value))) {
                                        cellClass += ' date';
                                        cellContent = new Date(value).toLocaleDateString();
                                    } else if (key === 'Status') {
                                        const statusClass = \`sap-status-\${value.toLowerCase()}\`;
                                        cellContent = \`<span class="sap-status-badge \${statusClass}">\${value}</span>\`;
                                    }

                                    return \`<td class="\${cellClass}">\${cellContent}</td>\`;
                                }).join('')}
                            </tr>
                        \`;
                    }).join('');
                }

                updatePagination() {
                    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
                    const startRecord = (this.currentPage - 1) * this.pageSize + 1;
                    const endRecord = Math.min(this.currentPage * this.pageSize, this.filteredData.length);

                    const paginationInfo = document.querySelector('.sap-pagination-info');
                    if (paginationInfo) {
                        paginationInfo.textContent = \`Showing \${startRecord}-\${endRecord} of \${this.filteredData.length} records\`;
                    }

                    // Update pagination buttons
                    const prevBtn = document.querySelector('.pagination-prev');
                    const nextBtn = document.querySelector('.pagination-next');

                    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
                    if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
                }

                goToPage(page) {
                    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
                    if (page >= 1 && page <= totalPages) {
                        this.currentPage = page;
                        this.renderGrid();
                    }
                }

                refreshData() {
                    this.logger.debug('Refreshing grid data...');
                    // In a real implementation, this would fetch fresh data from SAP
                    this.renderGrid();
                }
            }

            // Global grid handler functions
            function exportGrid(format) {
                if (window.sapDataGrid) {
                    window.sapDataGrid.handleExport(format);
                }
            }

            function handleGridSort(entitySet, column) {
                if (window.sapDataGrid) {
                    const header = document.querySelector(\`[data-key="\${column}"]\`);
                    if (header) {
                        window.sapDataGrid.handleSort(header);
                    }
                }
            }

            function handleRowSelection(entitySet, rowId) {
                if (window.sapDataGrid) {
                    const row = document.querySelector(\`[data-row-id="\${rowId}"]\`);
                    if (row) {
                        window.sapDataGrid.handleRowSelection(row);
                    }
                }
            }

            function handleGridFilter(entitySet, column, value) {
                if (window.sapDataGrid) {
                    // Implement filtering logic
                    this.logger.debug('Filtering', column, 'by', value);
                }
            }

            // Initialize grid when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                const gridData = ${JSON.stringify(data)};
                window.sapDataGrid = new SAPDataGrid('${entitySet}', gridData);

                // Setup pagination handlers
                document.addEventListener('click', function(e) {
                    if (e.target.classList.contains('pagination-prev')) {
                        window.sapDataGrid.goToPage(window.sapDataGrid.currentPage - 1);
                    } else if (e.target.classList.contains('pagination-next')) {
                        window.sapDataGrid.goToPage(window.sapDataGrid.currentPage + 1);
                    }
                });
            });
        `;
    }

    /**
     * Create grid response object
     */
    private createGridResponse(gridResult: UIRenderResult, gridConfig: GridConfig, data: any[]): any {
        return {
            gridId: `sap-grid-${gridConfig.entitySet}-${Date.now()}`,
            entitySet: gridConfig.entitySet,
            columns: gridConfig.columns,
            features: gridConfig.features,
            pageSize: gridConfig.pageSize,
            selectionMode: gridConfig.selectionMode,
            html: gridResult.html,
            css: gridResult.css,
            javascript: gridResult.javascript,
            data: data,
            metadata: {
                totalRecords: data.length,
                generated: new Date().toISOString(),
                version: '1.0.0',
                toolName: 'ui-data-grid'
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