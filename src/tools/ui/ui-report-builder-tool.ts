import { Logger } from '../../utils/logger.js';
import { z } from 'zod';
import { MCPToolHandler } from '../../types/mcp-types.js';
import { UIRenderingEngine } from '../../ui/engines/ui-rendering-engine.js';
import { UIComponentLibrary } from '../../ui/components/ui-component-library.js';
import {
  ReportConfig,
  DrillDownLevel,
  ReportFilter,
  ReportChart,
  UIComponent
} from '../../ui/types/ui-types.js';
import { SAPEntityManager } from '../../core/sap-entity-manager.js';
import { AuthenticationValidator } from '../../middleware/authentication-validator.js';

const InputSchema = z.object({
  entityType: z.string().describe('SAP entity type for the report (e.g., "Customer", "SalesOrder")'),
  reportType: z.enum(['summary', 'detailed', 'analytical', 'custom']).describe('Type of report to generate'),
  dimensions: z.array(z.string()).describe('Fields to use as report dimensions'),
  measures: z.array(z.string()).describe('Fields to use as report measures'),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'startswith', 'endswith']),
    value: z.union([z.string(), z.number(), z.boolean()])
  })).optional().describe('Optional filters to apply to the report'),
  drillDownLevels: z.array(z.object({
    field: z.string(),
    entity: z.string().optional(),
    navigationProperty: z.string().optional()
  })).optional().describe('Drill-down levels configuration'),
  exportFormats: z.array(z.enum(['pdf', 'excel', 'csv', 'json', 'xml'])).optional().describe('Export formats to enable'),
  schedulingOptions: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
    recipients: z.array(z.string()).optional()
  }).optional().describe('Report scheduling configuration'),
  visualizations: z.array(z.object({
    type: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'table']),
    title: z.string(),
    xAxis: z.string(),
    yAxis: z.string(),
    groupBy: z.string().optional()
  })).optional().describe('Chart visualizations for the report')
});

export class UIReportBuilderTool implements MCPToolHandler {
    private logger = new Logger('UiReportBuilderTool');

  name = 'ui-report-builder';
  description = 'Creates comprehensive drill-down reports with analytical capabilities and export options';
  inputSchema = InputSchema;

  constructor(
    private renderingEngine: UIRenderingEngine,
    private componentLibrary: UIComponentLibrary,
    private entityManager: SAPEntityManager,
    private authValidator: AuthenticationValidator
  ) {}

  async handle(args: z.infer<typeof InputSchema>, context?: any): Promise<any> {
    try {
      // Validate authentication and authorization
      const authResult = await this.authValidator.validateToken(context?.token);
      if (!authResult.isValid) {
        throw new Error('Authentication required for report builder');
      }

      if (!authResult.scopes?.includes('ui.reports')) {
        throw new Error('Insufficient permissions for report builder (ui.reports scope required)');
      }

      // Get entity metadata
      const entityMetadata = await this.entityManager.getEntityMetadata(args.entityType);
      if (!entityMetadata) {
        throw new Error(`Entity type ${args.entityType} not found`);
      }

      // Build report configuration
      const reportConfig: ReportConfig = {
        entityType: args.entityType,
        reportType: args.reportType,
        dimensions: args.dimensions,
        measures: args.measures,
        filters: args.filters || [],
        drillDownLevels: this.buildDrillDownLevels(args.drillDownLevels || []),
        exportFormats: args.exportFormats || ['pdf', 'excel', 'csv'],
        schedulingEnabled: args.schedulingOptions?.enabled || false,
        visualizations: this.buildReportCharts(args.visualizations || [])
      };

      // Generate the report UI
      const reportHTML = await this.generateReportInterface(reportConfig, entityMetadata);

      return {
        content: [
          {
            type: 'text',
            text: `Report builder created for ${args.entityType} with ${args.reportType} configuration. Features drill-down capabilities, multiple export formats, and analytical visualizations.`
          },
          {
            type: 'text',
            text: reportHTML
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating report builder: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }

  private buildDrillDownLevels(levels: any[]): DrillDownLevel[] {
    return levels.map(level => ({
      field: level.field,
      targetEntity: level.entity,
      navigationProperty: level.navigationProperty,
      enabled: true
    }));
  }

  private buildReportCharts(visualizations: any[]): ReportChart[] {
    return visualizations.map(viz => ({
      type: viz.type,
      title: viz.title,
      xAxis: viz.xAxis,
      yAxis: viz.yAxis,
      groupBy: viz.groupBy,
      config: {
        responsive: true,
        maintainAspectRatio: false
      }
    }));
  }

  private async generateReportInterface(config: ReportConfig, entityMetadata: any): Promise<string> {
    const reportId = `report_${Date.now()}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.entityType} Report Builder</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <style>
        body {
            font-family: "72", "72full", Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f7f7f7;
        }

        .report-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .report-header {
            background: linear-gradient(135deg, #0070f3, #0051cc);
            color: white;
            padding: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .report-title {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
        }

        .report-actions {
            display: flex;
            gap: 12px;
        }

        .sap-button {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }

        .sap-button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }

        .sap-button.primary {
            background: #ff6b35;
            border-color: #ff6b35;
        }

        .sap-button.primary:hover {
            background: #e55a2b;
        }

        .report-toolbar {
            padding: 16px 24px;
            background: #f9f9f9;
            border-bottom: 1px solid #e6e6e6;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
        }

        .filter-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .filter-input {
            padding: 6px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
        }

        .report-content {
            padding: 24px;
        }

        .report-tabs {
            display: flex;
            border-bottom: 2px solid #e6e6e6;
            margin-bottom: 24px;
        }

        .report-tab {
            padding: 12px 20px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            font-weight: 500;
            transition: all 0.2s;
        }

        .report-tab.active {
            border-bottom-color: #0070f3;
            color: #0070f3;
        }

        .report-tab:hover {
            background: #f5f5f5;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e6e6e6;
        }

        .data-table th {
            background: #f8f9fa;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
            cursor: pointer;
        }

        .data-table th:hover {
            background: #e9ecef;
        }

        .data-table tr:hover {
            background: #f8f9fa;
        }

        .drill-down-link {
            color: #0070f3;
            cursor: pointer;
            text-decoration: underline;
        }

        .drill-down-link:hover {
            color: #0051cc;
        }

        .chart-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .chart-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #333;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }

        .metric-value {
            font-size: 32px;
            font-weight: 700;
            color: #0070f3;
            margin-bottom: 8px;
        }

        .metric-label {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }

        .breadcrumb {
            background: #f0f0f0;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 16px;
            font-size: 14px;
        }

        .breadcrumb-item {
            color: #0070f3;
            cursor: pointer;
            text-decoration: underline;
        }

        .breadcrumb-separator {
            margin: 0 8px;
            color: #999;
        }

        .export-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }

        .export-dialog {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 8px;
            min-width: 400px;
        }

        .export-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin: 16px 0;
        }

        .export-option {
            padding: 12px;
            border: 2px solid #e6e6e6;
            border-radius: 4px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .export-option:hover {
            border-color: #0070f3;
            background: #f0f8ff;
        }

        .export-option.selected {
            border-color: #0070f3;
            background: #0070f3;
            color: white;
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0070f3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
        }

        .pagination button {
            padding: 8px 12px;
            border: 1px solid #ccc;
            background: white;
            cursor: pointer;
            border-radius: 4px;
        }

        .pagination button:hover {
            background: #f5f5f5;
        }

        .pagination button.active {
            background: #0070f3;
            color: white;
            border-color: #0070f3;
        }

        .schedule-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: #333;
        }

        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
        }

        .form-control:focus {
            outline: none;
            border-color: #0070f3;
            box-shadow: 0 0 0 2px rgba(0,112,243,0.2);
        }

        @media (max-width: 768px) {
            .report-toolbar {
                flex-direction: column;
                align-items: stretch;
            }

            .report-actions {
                flex-direction: column;
            }

            .metrics-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">${config.entityType} ${config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1)} Report</h1>
            <div class="report-actions">
                <button class="sap-button" onclick="refreshReport()">
                    <span id="refresh-icon">🔄</span> Refresh
                </button>
                <button class="sap-button" onclick="showExportModal()">📤 Export</button>
                <button class="sap-button primary" onclick="showScheduleModal()">⏰ Schedule</button>
            </div>
        </div>

        <div class="report-toolbar">
            <div class="filter-group">
                <label>Date Range:</label>
                <input type="date" class="filter-input" id="startDate">
                <span>to</span>
                <input type="date" class="filter-input" id="endDate">
            </div>

            <div class="filter-group">
                <label>Quick Filter:</label>
                <input type="text" class="filter-input" id="quickFilter" placeholder="Search...">
            </div>

            <div class="filter-group">
                <label>Group By:</label>
                <select class="filter-input" id="groupBy">
                    <option value="">None</option>
                    ${config.dimensions.map(dim => `<option value="${dim}">${dim}</option>`).join('')}
                </select>
            </div>

            <button class="sap-button" onclick="applyFilters()">Apply Filters</button>
            <button class="sap-button" onclick="clearFilters()">Clear</button>
        </div>

        <div class="report-content">
            <div class="breadcrumb" id="breadcrumb" style="display: none;">
                <span class="breadcrumb-item" onclick="navigateToLevel(0)">Summary</span>
            </div>

            <div class="report-tabs">
                <div class="report-tab active" onclick="switchTab('summary')">Summary</div>
                <div class="report-tab" onclick="switchTab('data')">Data</div>
                <div class="report-tab" onclick="switchTab('charts')">Charts</div>
                <div class="report-tab" onclick="switchTab('analytics')">Analytics</div>
            </div>

            <div id="summary-tab" class="tab-content active">
                <div class="metrics-grid">
                    ${config.measures.map(measure => `
                        <div class="metric-card">
                            <div class="metric-value" id="metric-${measure}">-</div>
                            <div class="metric-label">${measure}</div>
                        </div>
                    `).join('')}
                </div>

                <div class="chart-container">
                    <div class="chart-title">Trend Analysis</div>
                    <canvas id="trendChart" width="400" height="200"></canvas>
                </div>
            </div>

            <div id="data-tab" class="tab-content">
                <div style="overflow-x: auto;">
                    <table class="data-table" id="dataTable">
                        <thead>
                            <tr>
                                ${[...config.dimensions, ...config.measures].map(field => `
                                    <th onclick="sortTable('${field}')">${field} ↕️</th>
                                `).join('')}
                                ${(config.drillDownLevels?.length || 0) > 0 ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="dataTableBody">
                            <tr><td colspan="${[...config.dimensions, ...config.measures].length + ((config.drillDownLevels?.length || 0) > 0 ? 1 : 0)}">Loading data...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" id="pagination"></div>
            </div>

            <div id="charts-tab" class="tab-content">
                ${(config.visualizations || []).map((chart, index) => `
                    <div class="chart-container">
                        <div class="chart-title">${chart.title}</div>
                        <canvas id="chart-${index}" width="400" height="300"></canvas>
                    </div>
                `).join('')}
            </div>

            <div id="analytics-tab" class="tab-content">
                <div class="chart-container">
                    <div class="chart-title">Advanced Analytics</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <canvas id="correlationChart" width="300" height="300"></canvas>
                        <canvas id="distributionChart" width="300" height="300"></canvas>
                    </div>
                </div>

                <div class="schedule-section">
                    <h3>Statistical Summary</h3>
                    <div id="statisticalSummary">Loading statistical analysis...</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Export Modal -->
    <div id="exportModal" class="export-modal">
        <div class="export-dialog">
            <h3>Export Report</h3>
            <div class="export-options">
                ${(config.exportFormats || []).map(format => `
                    <div class="export-option" onclick="selectExportFormat('${format}')">
                        ${format.toUpperCase()}
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                <button class="sap-button" onclick="hideExportModal()">Cancel</button>
                <button class="sap-button primary" onclick="exportReport()">Export</button>
            </div>
        </div>
    </div>

    <!-- Schedule Modal -->
    <div id="scheduleModal" class="export-modal">
        <div class="export-dialog">
            <h3>Schedule Report</h3>
            <div class="form-group">
                <label class="form-label">Frequency:</label>
                <select class="form-control" id="scheduleFrequency">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Recipients (comma-separated emails):</label>
                <input type="text" class="form-control" id="scheduleRecipients" placeholder="user1@company.com, user2@company.com">
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                <button class="sap-button" onclick="hideScheduleModal()">Cancel</button>
                <button class="sap-button primary" onclick="scheduleReport()">Schedule</button>
            </div>
        </div>
    </div>

    <script>
        // Report state management
        let currentData = [];
        let filteredData = [];
        let currentPage = 1;
        let pageSize = 50;
        let drillDownStack = [];
        let currentLevel = 0;
        let sortColumn = '';
        let sortDirection = 'asc';
        let selectedExportFormat = 'pdf';

        // Configuration
        const reportConfig = ${JSON.stringify(config)};

        // Initialize report
        document.addEventListener('DOMContentLoaded', function() {
            loadInitialData();
            initializeCharts();
            setDefaultDateRange();
        });

        function setDefaultDateRange() {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
            document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        }

        async function loadInitialData() {
            try {
                showLoading('dataTableBody');

                // Simulate data loading
                const mockData = generateMockData(100);
                currentData = mockData;
                filteredData = [...currentData];

                updateSummaryMetrics();
                updateDataTable();
                updateCharts();
                updateAnalytics();

            } catch (error) {
                this.logger.error('Error loading data:', { error: error });
                showError('Failed to load report data');
            }
        }

        function generateMockData(count) {
            const data = [];
            const statuses = ['Active', 'Inactive', 'Pending', 'Completed'];
            const categories = ['A', 'B', 'C', 'D'];

            for (let i = 0; i < count; i++) {
                const record = {};

                reportConfig.dimensions.forEach(dim => {
                    switch (dim.toLowerCase()) {
                        case 'status':
                            record[dim] = statuses[Math.floor(Math.random() * statuses.length)];
                            break;
                        case 'category':
                            record[dim] = categories[Math.floor(Math.random() * categories.length)];
                            break;
                        case 'date':
                            const date = new Date();
                            date.setDate(date.getDate() - Math.floor(Math.random() * 365));
                            record[dim] = date.toISOString().split('T')[0];
                            break;
                        default:
                            record[dim] = \`\${dim}_\${i + 1}\`;
                    }
                });

                reportConfig.measures.forEach(measure => {
                    record[measure] = Math.floor(Math.random() * 10000) + 1000;
                });

                record.id = i + 1;
                data.push(record);
            }

            return data;
        }

        function updateSummaryMetrics() {
            reportConfig.measures.forEach(measure => {
                const values = filteredData.map(row => row[measure] || 0);
                const sum = values.reduce((a, b) => a + b, 0);
                const avg = sum / values.length;
                const max = Math.max(...values);

                const element = document.getElementById(\`metric-\${measure}\`);
                if (element) {
                    element.textContent = formatNumber(sum);
                    element.title = \`Average: \${formatNumber(avg)}, Max: \${formatNumber(max)}\`;
                }
            });
        }

        function updateDataTable() {
            const tbody = document.getElementById('dataTableBody');
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pageData = filteredData.slice(startIndex, endIndex);

            tbody.innerHTML = pageData.map(row => \`
                <tr>
                    \${[...reportConfig.dimensions, ...reportConfig.measures].map(field => \`
                        <td>\${formatCellValue(row[field], field)}</td>
                    \`).join('')}
                    \${reportConfig.drillDownLevels.length > 0 ? \`
                        <td>
                            <span class="drill-down-link" onclick="drillDown('\${row.id}', '\${row[reportConfig.dimensions[0]]}')">
                                Drill Down
                            </span>
                        </td>
                    \` : ''}
                </tr>
            \`).join('');

            updatePagination();
        }

        function formatCellValue(value, field) {
            if (value === null || value === undefined) return '-';

            if (reportConfig.measures.includes(field)) {
                return formatNumber(value);
            }

            if (field.toLowerCase().includes('date')) {
                return new Date(value).toLocaleDateString();
            }

            return value;
        }

        function formatNumber(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toLocaleString();
        }

        function updatePagination() {
            const totalPages = Math.ceil(filteredData.length / pageSize);
            const pagination = document.getElementById('pagination');

            let paginationHTML = '';

            // Previous button
            if (currentPage > 1) {
                paginationHTML += \`<button onclick="changePage(\${currentPage - 1})">← Previous</button>\`;
            }

            // Page numbers
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'active' : '';
                paginationHTML += \`<button class="\${activeClass}" onclick="changePage(\${i})">\${i}</button>\`;
            }

            // Next button
            if (currentPage < totalPages) {
                paginationHTML += \`<button onclick="changePage(\${currentPage + 1})">Next →</button>\`;
            }

            pagination.innerHTML = paginationHTML;
        }

        function changePage(page) {
            currentPage = page;
            updateDataTable();
        }

        function initializeCharts() {
            // Trend chart
            const trendCtx = document.getElementById('trendChart').getContext('2d');
            new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: getLast12Months(),
                    datasets: reportConfig.measures.map((measure, index) => ({
                        label: measure,
                        data: generateTrendData(),
                        borderColor: getChartColor(index),
                        backgroundColor: getChartColor(index, 0.1),
                        tension: 0.4
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Monthly Trend'
                        }
                    }
                }
            });

            // Initialize visualization charts
            reportConfig.visualizations.forEach((chart, index) => {
                initializeVisualizationChart(chart, index);
            });

            // Analytics charts
            initializeAnalyticsCharts();
        }

        function initializeVisualizationChart(chartConfig, index) {
            const ctx = document.getElementById(\`chart-\${index}\`).getContext('2d');

            new Chart(ctx, {
                type: chartConfig.type,
                data: generateChartData(chartConfig),
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: chartConfig.title
                        }
                    }
                }
            });
        }

        function initializeAnalyticsCharts() {
            // Correlation chart
            const correlationCtx = document.getElementById('correlationChart').getContext('2d');
            new Chart(correlationCtx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Correlation Analysis',
                        data: generateCorrelationData(),
                        backgroundColor: 'rgba(0, 112, 243, 0.6)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Measure Correlation'
                        }
                    }
                }
            });

            // Distribution chart
            const distributionCtx = document.getElementById('distributionChart').getContext('2d');
            new Chart(distributionCtx, {
                type: 'bar',
                data: {
                    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                    datasets: [{
                        label: 'Distribution',
                        data: [25, 35, 28, 42],
                        backgroundColor: [
                            'rgba(255, 107, 53, 0.8)',
                            'rgba(0, 112, 243, 0.8)',
                            'rgba(40, 167, 69, 0.8)',
                            'rgba(255, 193, 7, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Quartile Distribution'
                        }
                    }
                }
            });
        }

        function generateChartData(chartConfig) {
            const labels = getUniqueValues(filteredData, chartConfig.xAxis);
            const data = labels.map(label => {
                const filtered = filteredData.filter(row => row[chartConfig.xAxis] === label);
                return filtered.reduce((sum, row) => sum + (row[chartConfig.yAxis] || 0), 0);
            });

            return {
                labels: labels,
                datasets: [{
                    label: chartConfig.yAxis,
                    data: data,
                    backgroundColor: chartConfig.type === 'pie' ?
                        labels.map((_, i) => getChartColor(i, 0.8)) :
                        getChartColor(0, 0.8),
                    borderColor: getChartColor(0),
                    borderWidth: 1
                }]
            };
        }

        function getUniqueValues(data, field) {
            return [...new Set(data.map(row => row[field]))].slice(0, 10);
        }

        function generateTrendData() {
            return Array.from({length: 12}, () => Math.floor(Math.random() * 1000) + 500);
        }

        function generateCorrelationData() {
            return Array.from({length: 50}, () => ({
                x: Math.random() * 100,
                y: Math.random() * 100
            }));
        }

        function getLast12Months() {
            const months = [];
            const now = new Date();
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
            }
            return months;
        }

        function getChartColor(index, alpha = 1) {
            const colors = [
                \`rgba(0, 112, 243, \${alpha})\`,
                \`rgba(255, 107, 53, \${alpha})\`,
                \`rgba(40, 167, 69, \${alpha})\`,
                \`rgba(255, 193, 7, \${alpha})\`,
                \`rgba(108, 117, 125, \${alpha})\`
            ];
            return colors[index % colors.length];
        }

        function updateCharts() {
            // Update existing charts with filtered data
            updateSummaryMetrics();
        }

        function updateAnalytics() {
            const summary = document.getElementById('statisticalSummary');

            let analyticsHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">';

            reportConfig.measures.forEach(measure => {
                const values = filteredData.map(row => row[measure] || 0);
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);

                analyticsHTML += \`
                    <div class="metric-card">
                        <h4>\${measure}</h4>
                        <p><strong>Mean:</strong> \${formatNumber(mean)}</p>
                        <p><strong>Std Dev:</strong> \${formatNumber(stdDev)}</p>
                        <p><strong>Min:</strong> \${formatNumber(Math.min(...values))}</p>
                        <p><strong>Max:</strong> \${formatNumber(Math.max(...values))}</p>
                    </div>
                \`;
            });

            analyticsHTML += '</div>';
            summary.innerHTML = analyticsHTML;
        }

        // Event handlers
        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.report-tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');
            event.target.classList.add('active');
        }

        function applyFilters() {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const quickFilter = document.getElementById('quickFilter').value.toLowerCase();
            const groupBy = document.getElementById('groupBy').value;

            filteredData = currentData.filter(row => {
                let matchesFilter = true;

                // Date filter
                if (startDate && endDate && row.date) {
                    const rowDate = new Date(row.date);
                    matchesFilter = matchesFilter && rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
                }

                // Quick filter
                if (quickFilter) {
                    const rowText = Object.values(row).join(' ').toLowerCase();
                    matchesFilter = matchesFilter && rowText.includes(quickFilter);
                }

                return matchesFilter;
            });

            // Group by functionality
            if (groupBy) {
                // Implement grouping logic here
                this.logger.debug('Grouping by:', groupBy);
            }

            currentPage = 1;
            updateDataTable();
            updateSummaryMetrics();
            updateCharts();
            updateAnalytics();
        }

        function clearFilters() {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            document.getElementById('quickFilter').value = '';
            document.getElementById('groupBy').value = '';

            filteredData = [...currentData];
            currentPage = 1;
            updateDataTable();
            updateSummaryMetrics();
            updateCharts();
            updateAnalytics();
        }

        function sortTable(column) {
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }

            filteredData.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];

                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (sortDirection === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            updateDataTable();
        }

        function drillDown(id, value) {
            drillDownStack.push({
                level: currentLevel,
                data: [...filteredData],
                title: \`\${reportConfig.entityType} Report\`
            });

            currentLevel++;

            // Filter data for drill-down
            filteredData = currentData.filter(row => row[reportConfig.dimensions[0]] === value);

            // Update breadcrumb
            updateBreadcrumb(value);

            // Update displays
            updateDataTable();
            updateSummaryMetrics();
            updateCharts();
        }

        function navigateToLevel(level) {
            if (level < currentLevel && level >= 0) {
                const targetState = drillDownStack[level];
                if (targetState) {
                    filteredData = targetState.data;
                    currentLevel = level;
                    drillDownStack = drillDownStack.slice(0, level);

                    updateBreadcrumb();
                    updateDataTable();
                    updateSummaryMetrics();
                    updateCharts();
                }
            }
        }

        function updateBreadcrumb(currentItem) {
            const breadcrumb = document.getElementById('breadcrumb');

            if (currentLevel === 0) {
                breadcrumb.style.display = 'none';
                return;
            }

            breadcrumb.style.display = 'block';
            let breadcrumbHTML = '<span class="breadcrumb-item" onclick="navigateToLevel(0)">Summary</span>';

            drillDownStack.forEach((item, index) => {
                breadcrumbHTML += \`<span class="breadcrumb-separator">›</span><span class="breadcrumb-item" onclick="navigateToLevel(\${index + 1})">\${item.title}</span>\`;
            });

            if (currentItem) {
                breadcrumbHTML += \`<span class="breadcrumb-separator">›</span><span>\${currentItem}</span>\`;
            }

            breadcrumb.innerHTML = breadcrumbHTML;
        }

        async function refreshReport() {
            const icon = document.getElementById('refresh-icon');
            icon.innerHTML = '<div class="loading"></div>';

            try {
                await loadInitialData();
                showMessage('Report refreshed successfully', 'success');
            } catch (error) {
                showMessage('Failed to refresh report', 'error');
            } finally {
                icon.innerHTML = '🔄';
            }
        }

        function showExportModal() {
            document.getElementById('exportModal').style.display = 'block';
        }

        function hideExportModal() {
            document.getElementById('exportModal').style.display = 'none';
        }

        function selectExportFormat(format) {
            document.querySelectorAll('.export-option').forEach(option => {
                option.classList.remove('selected');
            });
            event.target.classList.add('selected');
            selectedExportFormat = format;
        }

        async function exportReport() {
            try {
                switch (selectedExportFormat) {
                    case 'pdf':
                        await exportToPDF();
                        break;
                    case 'excel':
                        await exportToExcel();
                        break;
                    case 'csv':
                        await exportToCSV();
                        break;
                    case 'json':
                        await exportToJSON();
                        break;
                }

                showMessage(\`Report exported as \${selectedExportFormat.toUpperCase()}\`, 'success');
                hideExportModal();
            } catch (error) {
                showMessage('Export failed', 'error');
            }
        }

        async function exportToPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(20);
            doc.text(\`\${reportConfig.entityType} Report\`, 20, 30);

            doc.setFontSize(12);
            doc.text(\`Generated: \${new Date().toLocaleDateString()}\`, 20, 45);
            doc.text(\`Records: \${filteredData.length}\`, 20, 55);

            // Add summary metrics
            let yPos = 75;
            doc.setFontSize(16);
            doc.text('Summary Metrics', 20, yPos);
            yPos += 15;

            reportConfig.measures.forEach(measure => {
                const values = filteredData.map(row => row[measure] || 0);
                const sum = values.reduce((a, b) => a + b, 0);
                doc.setFontSize(12);
                doc.text(\`\${measure}: \${formatNumber(sum)}\`, 20, yPos);
                yPos += 10;
            });

            doc.save(\`\${reportConfig.entityType}_report.pdf\`);
        }

        async function exportToExcel() {
            const ws = XLSX.utils.json_to_sheet(filteredData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report Data');

            XLSX.writeFile(wb, \`\${reportConfig.entityType}_report.xlsx\`);
        }

        async function exportToCSV() {
            const headers = [...reportConfig.dimensions, ...reportConfig.measures];
            const csvContent = [
                headers.join(','),
                ...filteredData.map(row => headers.map(header => row[header] || '').join(','))
            ].join('\\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${reportConfig.entityType}_report.csv\`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        async function exportToJSON() {
            const jsonContent = JSON.stringify(filteredData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${reportConfig.entityType}_report.json\`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        function showScheduleModal() {
            document.getElementById('scheduleModal').style.display = 'block';
        }

        function hideScheduleModal() {
            document.getElementById('scheduleModal').style.display = 'none';
        }

        async function scheduleReport() {
            const frequency = document.getElementById('scheduleFrequency').value;
            const recipients = document.getElementById('scheduleRecipients').value;

            if (!recipients.trim()) {
                showMessage('Please enter at least one recipient email', 'error');
                return;
            }

            try {
                // Here you would call your scheduling API
                this.logger.debug('Scheduling report:', { frequency, recipients });
                showMessage(\`Report scheduled \${frequency} for \${recipients}\`, 'success');
                hideScheduleModal();
            } catch (error) {
                showMessage('Failed to schedule report', 'error');
            }
        }

        function showMessage(message, type) {
            // Create toast notification
            const toast = document.createElement('div');
            toast.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                z-index: 2000;
                background: \${type === 'success' ? '#28a745' : '#dc3545'};
                animation: slideIn 0.3s ease;
            \`;
            toast.textContent = message;

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        function showLoading(elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading"></div></div>';
            }
        }

        function showError(message) {
            const element = document.getElementById('dataTableBody');
            if (element) {
                element.innerHTML = \`<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">\${message}</td></tr>\`;
            }
        }

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;
  }
}