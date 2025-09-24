/**
 * Tool-specific message configuration
 * Contains all UI tools descriptions and user-facing text
 */

export const ToolMessages = {
  // UI Form Tool
  uiForm: {
    name: 'get_ui_form',
    description:
      'Generate an interactive HTML form for data input with validation and submission handling',
    parameters: {
      title: 'Title displayed at the top of the form',
      description: 'Optional description shown below the title',
      fields: 'Array of form field definitions',
      submitButton: 'Text for the submit button',
      cancelButton: 'Text for the cancel button',
    },
    fieldTypes: {
      text: 'Single-line text input',
      email: 'Email address input with validation',
      password: 'Password input (masked)',
      number: 'Numeric input',
      date: 'Date picker',
      select: 'Dropdown selection',
      radio: 'Radio button group',
      checkbox: 'Multiple checkboxes',
      textarea: 'Multi-line text input',
      file: 'File upload',
      hidden: 'Hidden field',
    },
    validation: {
      required: 'This field is required',
      email: 'Please enter a valid email address',
      minLength: 'Minimum length is {min} characters',
      maxLength: 'Maximum length is {max} characters',
      min: 'Minimum value is {min}',
      max: 'Maximum value is {max}',
      pattern: 'Please match the required format',
      fileSize: 'File size must not exceed {size}MB',
      fileType: 'Invalid file type. Allowed types: {types}',
    },
    messages: {
      submitting: 'Submitting form...',
      submitted: 'Form submitted successfully',
      error: 'Error submitting form',
      cancelled: 'Form cancelled',
    },
  },

  // UI Table Tool
  uiTable: {
    name: 'get_ui_table',
    description:
      'Generate an interactive HTML table with sorting, filtering, and pagination capabilities',
    parameters: {
      title: 'Title displayed above the table',
      data: 'Array of data objects to display',
      columns: 'Column definitions with headers and properties',
      pageSize: 'Number of rows per page',
      enableSort: 'Enable column sorting',
      enableFilter: 'Enable data filtering',
      enablePagination: 'Enable pagination',
      enableExport: 'Enable data export options',
      actions: 'Row action buttons configuration',
    },
    features: {
      sortAscending: 'Sort ascending',
      sortDescending: 'Sort descending',
      clearSort: 'Clear sorting',
      filterPlaceholder: 'Filter data...',
      clearFilter: 'Clear filter',
      itemsPerPage: 'Items per page',
      showing: 'Showing {start} to {end} of {total} entries',
      noData: 'No data available',
      export: 'Export',
      exportCsv: 'Export as CSV',
      exportJson: 'Export as JSON',
      exportExcel: 'Export as Excel',
    },
    actions: {
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      confirm: 'Confirm',
      cancel: 'Cancel',
      confirmDelete: 'Are you sure you want to delete this item?',
    },
    pagination: {
      first: 'First',
      previous: 'Previous',
      next: 'Next',
      last: 'Last',
      page: 'Page {current} of {total}',
    },
  },

  // UI Chart Tool
  uiChart: {
    name: 'get_ui_chart',
    description: 'Generate interactive charts and visualizations using Chart.js',
    parameters: {
      title: 'Chart title',
      type: 'Chart type (line, bar, pie, doughnut, radar, etc.)',
      data: 'Chart data with labels and datasets',
      options: 'Chart configuration options',
      width: 'Chart width in pixels',
      height: 'Chart height in pixels',
    },
    types: {
      line: 'Line Chart',
      bar: 'Bar Chart',
      pie: 'Pie Chart',
      doughnut: 'Doughnut Chart',
      radar: 'Radar Chart',
      polarArea: 'Polar Area Chart',
      scatter: 'Scatter Plot',
      bubble: 'Bubble Chart',
    },
    labels: {
      noData: 'No data to display',
      loading: 'Loading chart...',
      error: 'Error loading chart',
    },
    legend: {
      show: 'Show legend',
      hide: 'Hide legend',
      position: 'Legend position',
    },
    tooltip: {
      label: 'Value',
      total: 'Total',
    },
  },

  // UI Dashboard Tool
  uiDashboard: {
    name: 'get_ui_dashboard',
    description: 'Generate a comprehensive dashboard with multiple visualization components',
    parameters: {
      title: 'Dashboard title',
      layout: 'Layout configuration (grid, flex, etc.)',
      widgets: 'Array of dashboard widgets',
      theme: 'Dashboard theme (light, dark, custom)',
      refreshInterval: 'Auto-refresh interval in seconds',
    },
    widgets: {
      metric: 'Metric Card',
      chart: 'Chart Widget',
      table: 'Data Table',
      list: 'List View',
      map: 'Map View',
      timeline: 'Timeline',
      activity: 'Activity Feed',
      progress: 'Progress Indicator',
    },
    metrics: {
      value: 'Current Value',
      change: 'Change',
      trend: 'Trend',
      target: 'Target',
      variance: 'Variance',
      period: 'Period',
    },
    controls: {
      refresh: 'Refresh',
      fullscreen: 'Fullscreen',
      export: 'Export',
      settings: 'Settings',
      dateRange: 'Date Range',
      filters: 'Filters',
    },
    status: {
      loading: 'Loading dashboard...',
      updating: 'Updating...',
      error: 'Error loading dashboard',
      noData: 'No data available',
      offline: 'Offline - Using cached data',
      live: 'Live',
      lastUpdated: 'Last updated: {time}',
    },
  },

  // Common UI Messages
  common: {
    buttons: {
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      finish: 'Finish',
      reset: 'Reset',
      apply: 'Apply',
      search: 'Search',
      clear: 'Clear',
      add: 'Add',
      remove: 'Remove',
      upload: 'Upload',
      download: 'Download',
      copy: 'Copy',
      paste: 'Paste',
    },
    status: {
      loading: 'Loading...',
      saving: 'Saving...',
      saved: 'Saved',
      deleting: 'Deleting...',
      deleted: 'Deleted',
      error: 'Error',
      warning: 'Warning',
      success: 'Success',
      info: 'Information',
      pending: 'Pending',
      processing: 'Processing...',
      completed: 'Completed',
      failed: 'Failed',
    },
    validation: {
      required: 'Required',
      invalid: 'Invalid',
      tooShort: 'Too short',
      tooLong: 'Too long',
      invalidFormat: 'Invalid format',
      mustMatch: 'Must match',
      unique: 'Must be unique',
      alreadyExists: 'Already exists',
    },
    errors: {
      generic: 'An error occurred',
      network: 'Network error',
      timeout: 'Request timeout',
      serverError: 'Server error',
      clientError: 'Client error',
      validationError: 'Validation error',
      notFound: 'Not found',
      unauthorized: 'Unauthorized',
      forbidden: 'Forbidden',
    },
    accessibility: {
      close: 'Close dialog',
      expand: 'Expand',
      collapse: 'Collapse',
      menu: 'Menu',
      navigation: 'Navigation',
      search: 'Search',
      sortable: 'Sortable column',
      sorted: 'Sorted {direction}',
      page: 'Page {number}',
      selected: 'Selected',
      loading: 'Loading content',
      error: 'Error message',
    },
  },
};

/**
 * Get tool message by path
 */
export function getToolMessage(path: string, params?: Record<string, any>): string {
  const keys = path.split('.');
  let current: any = ToolMessages;

  for (const key of keys) {
    if (current[key] === undefined) {
      return `Tool message not found: ${path}`;
    }
    current = current[key];
  }

  if (typeof current !== 'string') {
    return `Invalid tool message path: ${path}`;
  }

  return formatToolMessage(current, params);
}

/**
 * Format tool message with parameters
 */
export function formatToolMessage(message: string, params?: Record<string, any>): string {
  if (!params) return message;

  return Object.keys(params).reduce((msg, key) => {
    return msg.replace(new RegExp(`{${key}}`, 'g'), String(params[key]));
  }, message);
}
