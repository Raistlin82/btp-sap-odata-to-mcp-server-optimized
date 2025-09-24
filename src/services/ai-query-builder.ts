/**
 * AI-Powered Query Builder Service
 * Converts natural language to optimized OData queries using any MCP client
 */

import { EntityType, Property } from '../types/sap-types.js';
import {
  QueryIntent,
  OptimizedQuery,
  FilterCondition,
  OrderByCondition,
} from '../types/ai-types.js';
import { aiIntegration } from './ai-integration.js';
import { Logger } from 'winston';
import * as winston from 'winston';

export interface QueryContext {
  userId?: string;
  role?: string;
  recentQueries?: string[];
  preferredFields?: string[];
  businessContext?: string;
}

export interface NaturalQueryResult {
  originalIntent: string;
  interpretedIntent: QueryIntent;
  optimizedQuery: OptimizedQuery;
  explanations: {
    fieldSelection: string;
    filterLogic: string;
    performanceNotes: string;
  };
  alternativeQueries?: OptimizedQuery[];
  estimatedExecutionTime?: number;
}

export class AIQueryBuilderService {
  private logger: Logger;
  private queryCache: Map<string, NaturalQueryResult>;
  private queryPatterns: Map<string, QueryTemplate>;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console({ format: winston.format.simple() })],
    });

    this.queryCache = new Map();
    this.queryPatterns = new Map();

    this.initializeQueryPatterns();
    this.logger.info('AI Query Builder Service initialized');
  }

  /**
   * Main method: Convert natural language to optimized OData query
   */
  async buildQueryFromNaturalLanguage(
    naturalQuery: string,
    entityType: EntityType,
    context?: QueryContext
  ): Promise<NaturalQueryResult> {
    const cacheKey = this.generateCacheKey(naturalQuery, entityType.name, context);

    // Check cache first
    if (this.queryCache.has(cacheKey)) {
      this.logger.debug('Returning cached query result', { naturalQuery });
      return this.queryCache.get(cacheKey)!;
    }

    try {
      // Step 1: Parse natural language intent
      const interpretedIntent = await this.parseNaturalLanguageIntent(
        naturalQuery,
        entityType,
        context
      );

      // Step 2: Optimize query with AI assistance
      const optimizedQuery = await this.optimizeQueryWithAI(interpretedIntent, entityType, context);

      // Step 3: Generate explanations
      const explanations = await this.generateQueryExplanations(
        naturalQuery,
        interpretedIntent,
        optimizedQuery,
        entityType
      );

      // Step 4: Generate alternative queries if needed
      const alternativeQueries = await this.generateAlternativeQueries(
        interpretedIntent,
        entityType,
        optimizedQuery
      );

      const result: NaturalQueryResult = {
        originalIntent: naturalQuery,
        interpretedIntent,
        optimizedQuery,
        explanations,
        alternativeQueries,
        estimatedExecutionTime: this.estimateExecutionTime(optimizedQuery, entityType),
      };

      // Cache the result
      this.queryCache.set(cacheKey, result);

      this.logger.info('Successfully built query from natural language', {
        originalQuery: naturalQuery,
        optimizedUrl: optimizedQuery.url,
        confidence: optimizedQuery.confidence,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to build query from natural language', {
        naturalQuery,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return fallback query
      return this.createFallbackQuery(naturalQuery, entityType, context);
    }
  }

  /**
   * Parse natural language into structured query intent
   */
  private async parseNaturalLanguageIntent(
    naturalQuery: string,
    entityType: EntityType,
    context?: QueryContext
  ): Promise<QueryIntent> {
    // Check for common patterns first
    const patternMatch = this.matchCommonPatterns(naturalQuery, entityType);
    if (patternMatch) {
      return patternMatch;
    }

    // Use AI for complex parsing
    const aiPrompt = this.buildIntentParsingPrompt(naturalQuery, entityType, context);
    const aiResponse = await aiIntegration.optimizeQuery(naturalQuery, entityType, context);

    // Parse AI response into structured intent
    return this.parseAIResponseToIntent(aiResponse, entityType, naturalQuery);
  }

  /**
   * Optimize query using AI intelligence
   */
  private async optimizeQueryWithAI(
    intent: QueryIntent,
    entityType: EntityType,
    context?: QueryContext
  ): Promise<OptimizedQuery> {
    // Build optimization prompt
    const optimizationPrompt = this.buildOptimizationPrompt(intent, entityType, context);

    // Get AI optimization suggestions
    const baseQuery = await aiIntegration.optimizeQuery(
      `${intent.businessContext}: ${intent.operation} ${intent.fields.join(', ')}`,
      entityType,
      context
    );

    // Apply additional optimization rules
    const optimizedUrl = this.applyOptimizationRules(baseQuery.url, intent, entityType);

    // Determine caching strategy based on query characteristics
    const cacheStrategy = this.determineCacheStrategy(intent, entityType);

    return {
      url: optimizedUrl,
      explanation: `AI-optimized query for: ${intent.businessContext}. ${baseQuery.explanation}`,
      cacheStrategy,
      estimatedRows: this.estimateResultSize(intent, entityType),
      confidence: Math.min(baseQuery.confidence + 0.2, 1.0), // AI enhancement boost
    };
  }

  /**
   * Generate human-readable explanations
   */
  private async generateQueryExplanations(
    originalQuery: string,
    intent: QueryIntent,
    optimizedQuery: OptimizedQuery,
    entityType: EntityType
  ): Promise<{ fieldSelection: string; filterLogic: string; performanceNotes: string }> {
    const selectedFields = this.extractSelectedFields(optimizedQuery.url);
    const filters = this.extractFilters(optimizedQuery.url);

    return {
      fieldSelection: `Selected ${selectedFields.length} fields: ${selectedFields.join(', ')}. ${
        selectedFields.length < entityType.properties.length
          ? `Optimized to reduce payload by ${Math.round((1 - selectedFields.length / entityType.properties.length) * 100)}%`
          : 'All fields included as requested'
      }`,
      filterLogic:
        filters.length > 0
          ? `Applied ${filters.length} filter(s): ${filters.join(', ')}`
          : 'No filters applied - retrieving all records',
      performanceNotes: this.generatePerformanceNotes(optimizedQuery, entityType),
    };
  }

  /**
   * Generate alternative query suggestions
   */
  private async generateAlternativeQueries(
    intent: QueryIntent,
    entityType: EntityType,
    primaryQuery: OptimizedQuery
  ): Promise<OptimizedQuery[]> {
    const alternatives: OptimizedQuery[] = [];

    // Generate performance-optimized variant
    if (intent.fields.length > 5) {
      const minimalFields = this.selectMostImportantFields(intent.fields, entityType, 3);
      alternatives.push({
        url: this.buildQueryUrl(entityType.entitySet!, {
          select: minimalFields,
          filter: intent.filters,
          orderBy: intent.orderBy?.slice(0, 1), // Limit sorting for performance
        }),
        explanation: 'Performance-optimized version with minimal fields',
        cacheStrategy: 'long',
        estimatedRows: primaryQuery.estimatedRows,
        confidence: primaryQuery.confidence - 0.1,
      });
    }

    // Generate comprehensive variant
    if (intent.fields.length < entityType.properties.length / 2) {
      const extendedFields = this.suggestRelatedFields(intent.fields, entityType);
      alternatives.push({
        url: this.buildQueryUrl(entityType.entitySet!, {
          select: [...intent.fields, ...extendedFields],
          filter: intent.filters,
          orderBy: intent.orderBy,
        }),
        explanation: 'Extended version with related business fields',
        cacheStrategy: 'medium',
        estimatedRows: primaryQuery.estimatedRows,
        confidence: primaryQuery.confidence - 0.05,
      });
    }

    return alternatives;
  }

  /**
   * Initialize common query patterns for fast matching
   */
  private initializeQueryPatterns(): void {
    this.queryPatterns.set('show_all', {
      pattern: /^(show|list|get|display)\s+(all|everything)/i,
      intent: {
        operation: 'read',
        fields: [],
        filters: [],
        businessContext: 'List all records',
        confidence: 0.9,
      },
    });

    this.queryPatterns.set('find_by_status', {
      pattern: /^(find|show|get)\s+.*\b(pending|active|completed|approved|rejected|open|closed)\b/i,
      intent: {
        operation: 'filter',
        fields: [],
        filters: [{ field: 'Status', operator: 'eq', value: 'auto-detect' }],
        businessContext: 'Filter by status',
        confidence: 0.8,
      },
    });

    this.queryPatterns.set('recent_items', {
      pattern: /^(show|get|list)\s+.*\b(recent|latest|new|today|yesterday|this week|this month)\b/i,
      intent: {
        operation: 'filter',
        fields: [],
        filters: [{ field: 'auto-detect-date', operator: 'ge', value: 'auto-calculate' }],
        orderBy: [{ field: 'auto-detect-date', direction: 'desc' }],
        businessContext: 'Show recent items',
        confidence: 0.85,
      },
    });

    this.queryPatterns.set('high_value', {
      pattern:
        /^(show|find|get)\s+.*\b(high|large|big|expensive|costly|over|above|greater than)\b.*\b(\d+|amount|value|price|cost)\b/i,
      intent: {
        operation: 'filter',
        fields: [],
        filters: [{ field: 'auto-detect-amount', operator: 'gt', value: 'auto-extract' }],
        businessContext: 'Filter by high value',
        confidence: 0.75,
      },
    });

    this.logger.debug(`Initialized ${this.queryPatterns.size} query patterns`);
  }

  /**
   * Match common patterns for quick parsing
   */
  private matchCommonPatterns(naturalQuery: string, entityType: EntityType): QueryIntent | null {
    for (const [patternName, template] of this.queryPatterns) {
      if (template.pattern.test(naturalQuery)) {
        this.logger.debug(`Matched pattern: ${patternName}`, { naturalQuery });

        // Adapt template to entity
        const adaptedIntent = this.adaptTemplateToEntity(template.intent, entityType, naturalQuery);
        return adaptedIntent;
      }
    }
    return null;
  }

  /**
   * Adapt template intent to specific entity type
   */
  private adaptTemplateToEntity(
    templateIntent: Partial<QueryIntent>,
    entityType: EntityType,
    naturalQuery: string
  ): QueryIntent {
    const fields = templateIntent.fields?.length
      ? templateIntent.fields
      : this.selectDefaultFields(entityType);

    const filters: FilterCondition[] = [];

    // Process template filters
    if (templateIntent.filters) {
      for (const filter of templateIntent.filters) {
        if (filter.field === 'auto-detect') {
          // Find status-like field
          const statusField = this.findFieldByPattern(entityType, /status|state|condition/i);
          if (statusField) {
            filters.push({
              ...filter,
              field: statusField.name,
              value: this.extractStatusFromQuery(naturalQuery),
            });
          }
        } else if (filter.field === 'auto-detect-date') {
          // Find date field
          const dateField = this.findFieldByPattern(
            entityType,
            /date|time|created|modified|updated/i
          );
          if (dateField) {
            filters.push({
              ...filter,
              field: dateField.name,
              value: this.calculateDateFilter(naturalQuery),
            });
          }
        } else if (filter.field === 'auto-detect-amount') {
          // Find amount/value field
          const amountField = this.findFieldByPattern(entityType, /amount|value|price|cost|total/i);
          if (amountField) {
            filters.push({
              ...filter,
              field: amountField.name,
              value: this.extractAmountFromQuery(naturalQuery),
            });
          }
        } else {
          filters.push(filter);
        }
      }
    }

    const orderBy: OrderByCondition[] = [];
    if (templateIntent.orderBy) {
      for (const order of templateIntent.orderBy) {
        if (order.field === 'auto-detect-date') {
          const dateField = this.findFieldByPattern(entityType, /date|time|created|modified/i);
          if (dateField) {
            orderBy.push({ ...order, field: dateField.name });
          }
        } else {
          orderBy.push(order);
        }
      }
    }

    return {
      operation: templateIntent.operation || 'read',
      fields,
      filters,
      orderBy,
      businessContext: templateIntent.businessContext || 'Pattern-based query',
      confidence: templateIntent.confidence || 0.7,
    };
  }

  // Utility methods

  private buildIntentParsingPrompt(
    query: string,
    entityType: EntityType,
    context?: QueryContext
  ): string {
    return `Parse this natural language query into structured intent:
        
Query: "${query}"
Entity: ${entityType.name}
Available Fields: ${entityType.properties.map(p => `${p.name} (${p.type})`).join(', ')}
Key Fields: ${entityType.keys.join(', ')}
Context: ${context?.businessContext || 'General query'}

Return structured intent with operation, fields, filters, and sorting.`;
  }

  private buildOptimizationPrompt(
    intent: QueryIntent,
    entityType: EntityType,
    context?: QueryContext
  ): string {
    return `Optimize this query for SAP OData performance:
        
Intent: ${JSON.stringify(intent)}
Entity: ${entityType.name} (${entityType.properties.length} fields)
User Role: ${context?.role || 'standard'}

Focus on: field selection, filter efficiency, result size management.`;
  }

  private parseAIResponseToIntent(
    aiResponse: OptimizedQuery,
    entityType: EntityType,
    query: string
  ): QueryIntent {
    // Parse the AI response into structured intent
    // This is a simplified version - real implementation would parse AI response format
    const url = aiResponse.url;

    return {
      operation: url.includes('$filter') ? 'filter' : 'read',
      fields: this.extractSelectedFields(url),
      filters: this.parseFiltersFromUrl(url),
      orderBy: this.parseOrderByFromUrl(url),
      businessContext: `AI-parsed: ${query}`,
      confidence: aiResponse.confidence,
    };
  }

  private applyOptimizationRules(
    baseUrl: string,
    intent: QueryIntent,
    entityType: EntityType
  ): string {
    let optimizedUrl = baseUrl;

    // Rule 1: Always include key fields for reference
    const selectedFields = this.extractSelectedFields(baseUrl);
    const missingKeys = entityType.keys.filter(key => !selectedFields.includes(key));

    if (missingKeys.length > 0) {
      const allFields = [...selectedFields, ...missingKeys];
      optimizedUrl = optimizedUrl.replace(/\$select=[^&]+/, `$select=${allFields.join(',')}`);
    }

    // Rule 2: Add $top limit for performance
    if (!optimizedUrl.includes('$top') && intent.operation === 'read') {
      const separator = optimizedUrl.includes('?') ? '&' : '?';
      optimizedUrl += `${separator}$top=100`;
    }

    // Rule 3: Optimize filter order (most selective first)
    if (intent.filters.length > 1) {
      optimizedUrl = this.optimizeFilterOrder(optimizedUrl, intent.filters, entityType);
    }

    return optimizedUrl;
  }

  private determineCacheStrategy(
    intent: QueryIntent,
    entityType: EntityType
  ): OptimizedQuery['cacheStrategy'] {
    // No filters = static data = long cache
    if (intent.filters.length === 0) return 'long';

    // Date-based filters = short cache
    const hasDateFilters = intent.filters.some(f =>
      entityType.properties.find(p => p.name === f.field)?.type.includes('Date')
    );
    if (hasDateFilters) return 'short';

    // Status/enum filters = medium cache
    return 'medium';
  }

  private estimateResultSize(intent: QueryIntent, entityType: EntityType): number {
    let estimate = 1000; // Base estimate

    // Reduce estimate based on filters
    estimate *= Math.pow(0.3, intent.filters.length);

    // Adjust based on entity size indicators
    if (entityType.name.includes('Log') || entityType.name.includes('History')) {
      estimate *= 5; // Larger datasets
    }

    return Math.round(estimate);
  }

  private estimateExecutionTime(query: OptimizedQuery, entityType: EntityType): number {
    let baseTime = 200; // Base 200ms

    // Add time for each filter
    baseTime += query.url.split('$filter').length * 50;

    // Add time for sorting
    if (query.url.includes('$orderby')) baseTime += 100;

    // Adjust for estimated result size
    baseTime += (query.estimatedRows / 100) * 10;

    return Math.round(baseTime);
  }

  // More utility methods...

  private generateCacheKey(query: string, entityName: string, context?: QueryContext): string {
    return `${query.toLowerCase().trim()}_${entityName}_${context?.userId || 'anonymous'}`;
  }

  private createFallbackQuery(
    query: string,
    entityType: EntityType,
    context?: QueryContext
  ): NaturalQueryResult {
    const fallbackQuery: OptimizedQuery = {
      url: `${entityType.entitySet}?$top=50`,
      explanation: `Fallback query for: "${query}"`,
      cacheStrategy: 'short',
      estimatedRows: 50,
      confidence: 0.2,
    };

    return {
      originalIntent: query,
      interpretedIntent: {
        operation: 'read',
        fields: this.selectDefaultFields(entityType),
        filters: [],
        businessContext: 'Fallback query',
        confidence: 0.2,
      },
      optimizedQuery: fallbackQuery,
      explanations: {
        fieldSelection: 'Default field selection applied',
        filterLogic: 'No filters - showing latest records',
        performanceNotes: 'Limited to 50 records for performance',
      },
      estimatedExecutionTime: 300,
    };
  }

  // Field and filter utility methods

  private selectDefaultFields(entityType: EntityType): string[] {
    // Select up to 8 most important fields
    const important = [...entityType.keys];

    // Add common business fields
    const businessFields = entityType.properties
      .filter(p => /name|title|description|status|date|amount|number/i.test(p.name))
      .map(p => p.name);

    return [...important, ...businessFields].slice(0, 8);
  }

  private selectMostImportantFields(
    fields: string[],
    entityType: EntityType,
    limit: number
  ): string[] {
    // Prioritize key fields and common business fields
    const sorted = fields.sort((a, b) => {
      const aIsKey = entityType.keys.includes(a) ? 2 : 0;
      const bIsKey = entityType.keys.includes(b) ? 2 : 0;
      const aIsCommon = /name|title|status|date|amount/i.test(a) ? 1 : 0;
      const bIsCommon = /name|title|status|date|amount/i.test(b) ? 1 : 0;

      return bIsKey + bIsCommon - (aIsKey + aIsCommon);
    });

    return sorted.slice(0, limit);
  }

  private suggestRelatedFields(currentFields: string[], entityType: EntityType): string[] {
    const suggestions: string[] = [];

    // Add fields commonly queried together
    if (
      currentFields.includes('Amount') ||
      currentFields.some(f => /amount|value|price/i.test(f))
    ) {
      suggestions.push(
        ...entityType.properties
          .filter(p => /currency|tax|total|net|gross/i.test(p.name))
          .map(p => p.name)
      );
    }

    if (currentFields.some(f => /date/i.test(f))) {
      suggestions.push(
        ...entityType.properties
          .filter(p => /time|created|modified|due|valid/i.test(p.name))
          .map(p => p.name)
      );
    }

    return suggestions.slice(0, 3); // Limit suggestions
  }

  private findFieldByPattern(entityType: EntityType, pattern: RegExp): Property | null {
    return entityType.properties.find(p => pattern.test(p.name)) || null;
  }

  private extractStatusFromQuery(query: string): string {
    const statusMatch = query.match(
      /\b(pending|active|completed|approved|rejected|open|closed)\b/i
    );
    return statusMatch ? statusMatch[1].toUpperCase() : 'ACTIVE';
  }

  private calculateDateFilter(query: string): string {
    if (/today/i.test(query)) {
      return new Date().toISOString().split('T')[0];
    } else if (/yesterday/i.test(query)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    } else if (/this week/i.test(query)) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo.toISOString().split('T')[0];
    } else if (/this month/i.test(query)) {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  }

  private extractAmountFromQuery(query: string): number {
    const amountMatch = query.match(/\b(\d+)\b/);
    return amountMatch ? parseInt(amountMatch[1]) : 1000;
  }

  private extractSelectedFields(url: string): string[] {
    const selectMatch = url.match(/\$select=([^&]+)/);
    return selectMatch ? selectMatch[1].split(',').map(f => f.trim()) : [];
  }

  private extractFilters(url: string): string[] {
    const filterMatch = url.match(/\$filter=([^&]+)/);
    return filterMatch ? [decodeURIComponent(filterMatch[1])] : [];
  }

  private parseFiltersFromUrl(url: string): FilterCondition[] {
    // Simplified URL parsing - real implementation would be more comprehensive
    const filters: FilterCondition[] = [];
    const filterMatch = url.match(/\$filter=([^&]+)/);

    if (filterMatch) {
      const filterStr = decodeURIComponent(filterMatch[1]);
      // Basic parsing logic here
      filters.push({
        field: 'parsed-field',
        operator: 'eq',
        value: 'parsed-value',
      });
    }

    return filters;
  }

  private parseOrderByFromUrl(url: string): OrderByCondition[] {
    const orderBy: OrderByCondition[] = [];
    const orderMatch = url.match(/\$orderby=([^&]+)/);

    if (orderMatch) {
      const orderStr = decodeURIComponent(orderMatch[1]);
      const parts = orderStr.split(',');

      for (const part of parts) {
        const [field, direction] = part.trim().split(' ');
        orderBy.push({
          field: field,
          direction: direction?.toLowerCase() === 'desc' ? 'desc' : 'asc',
        });
      }
    }

    return orderBy;
  }

  private buildQueryUrl(
    entitySet: string,
    options: {
      select?: string[];
      filter?: FilterCondition[];
      orderBy?: OrderByCondition[];
      top?: number;
    }
  ): string {
    const url = entitySet;
    const params: string[] = [];

    if (options.select && options.select.length > 0) {
      params.push(`$select=${options.select.join(',')}`);
    }

    if (options.filter && options.filter.length > 0) {
      const filterStr = options.filter
        .map(f => `${f.field} ${f.operator} '${f.value}'`)
        .join(' and ');
      params.push(`$filter=${encodeURIComponent(filterStr)}`);
    }

    if (options.orderBy && options.orderBy.length > 0) {
      const orderStr = options.orderBy.map(o => `${o.field} ${o.direction}`).join(',');
      params.push(`$orderby=${orderStr}`);
    }

    if (options.top) {
      params.push(`$top=${options.top}`);
    }

    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  private optimizeFilterOrder(
    url: string,
    filters: FilterCondition[],
    entityType: EntityType
  ): string {
    // Reorder filters for optimal performance (most selective first)
    const sortedFilters = filters.sort((a, b) => {
      // Key fields first
      const aIsKey = entityType.keys.includes(a.field) ? 1 : 0;
      const bIsKey = entityType.keys.includes(b.field) ? 1 : 0;
      if (aIsKey !== bIsKey) return bIsKey - aIsKey;

      // Equality filters before range filters
      const aIsEquality = a.operator === 'eq' ? 1 : 0;
      const bIsEquality = b.operator === 'eq' ? 1 : 0;
      return bIsEquality - aIsEquality;
    });

    // Rebuild URL with optimized filter order
    // Implementation would reconstruct the filter string
    return url;
  }

  private generatePerformanceNotes(query: OptimizedQuery, entityType: EntityType): string {
    const notes: string[] = [];

    if (query.estimatedRows > 1000) {
      notes.push('Large result set - consider adding filters');
    }

    if (query.url.includes('$orderby') && query.estimatedRows > 100) {
      notes.push('Sorting large datasets may impact performance');
    }

    if (!query.url.includes('$top')) {
      notes.push('Consider limiting results with $top for better performance');
    }

    return notes.join('; ') || 'Query appears well-optimized';
  }

  // Public utility methods

  clearCache(): void {
    this.queryCache.clear();
    this.logger.info('Query cache cleared');
  }

  getCacheStats(): { size: number; patterns: number } {
    return {
      size: this.queryCache.size,
      patterns: this.queryPatterns.size,
    };
  }
}

// Supporting interfaces
interface QueryTemplate {
  pattern: RegExp;
  intent: Partial<QueryIntent>;
}

// Export singleton instance
export const aiQueryBuilder = new AIQueryBuilderService();
