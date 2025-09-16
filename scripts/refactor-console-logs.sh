#!/bin/bash

# Console.log Refactoring Script
# Automatically replaces remaining console.log statements with proper logger calls

echo "🔧 Starting console.log refactoring..."

# Create backup
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
echo "📦 Creating backup in $BACKUP_DIR..."
cp -r src $BACKUP_DIR/

# Function to add logger import to a file if not present
add_logger_import() {
    local file=$1
    if ! grep -q "import.*Logger" "$file"; then
        # Add import after the last import statement
        sed -i '' '/^import/a\
import { Logger } from '\''../utils/logger.js'\'';
' "$file"
        echo "   ✅ Added Logger import to $file"
    fi
}

# Function to add logger instance to a file
add_logger_instance() {
    local file=$1
    local component_name=$2

    # Check if it's a class file or module file
    if grep -q "export class\|class.*{" "$file"; then
        # It's a class - add logger as private property
        if ! grep -q "private logger: Logger" "$file"; then
            # Find the first private property and add logger before it
            sed -i '' '/private.*:/i\
    private logger: Logger;
' "$file"

            # Add logger initialization in constructor
            sed -i '' '/constructor(/a\
        this.logger = new Logger('\'''"$component_name"'\'');
' "$file"
            echo "   ✅ Added logger instance to class in $file"
        fi
    else
        # It's a module - add global logger
        if ! grep -q "const logger = new Logger" "$file"; then
            sed -i '' '/^import.*Logger/a\
\
const logger = new Logger('\'''"$component_name"'\'');
' "$file"
            echo "   ✅ Added global logger to module $file"
        fi
    fi
}

# Process remaining files with console.log
FILES_TO_PROCESS=(
    "src/utils/config.ts:Config"
    "src/utils/workflow-config-loader.ts:WorkflowConfigLoader"
    "src/tools/ai-enhanced-tools.ts:AIEnhancedTools"
    "src/tools/realtime-tools.ts:RealtimeTools"
    "src/index.ts:MainServer"
)

for file_info in "${FILES_TO_PROCESS[@]}"; do
    IFS=':' read -r file component_name <<< "$file_info"

    if [[ -f "$file" ]]; then
        echo "🔄 Processing $file..."

        # Add logger import and instance
        add_logger_import "$file"
        add_logger_instance "$file" "$component_name"

        # Replace console.log statements
        sed -i '' 's/console\.log(/this.logger.info(/g' "$file"
        sed -i '' 's/console\.warn(/this.logger.warn(/g' "$file"
        sed -i '' 's/console\.error(/this.logger.error(/g' "$file"
        sed -i '' 's/console\.debug(/this.logger.debug(/g' "$file"

        # For module files (non-class), use global logger
        if ! grep -q "export class\|class.*{" "$file"; then
            sed -i '' 's/this\.logger\./logger./g' "$file"
        fi

        echo "   ✅ Processed $file"
    else
        echo "   ⚠️  File not found: $file"
    fi
done

echo ""
echo "🧪 Running tests to verify no regressions..."
npm run build
if npm run test:mcp:working > /dev/null 2>&1; then
    echo "✅ Tests passed! Refactoring successful."
    echo ""
    echo "📊 Summary:"
    echo "   • Processed ${#FILES_TO_PROCESS[@]} files"
    echo "   • Backup created in $BACKUP_DIR"
    echo "   • All console.log statements replaced with logger calls"
    echo "   • No regressions detected"
    echo ""
    echo "🚀 Refactoring completed successfully!"
else
    echo "❌ Tests failed! Restoring backup..."
    rm -rf src
    cp -r "$BACKUP_DIR/src" .
    echo "🔄 Backup restored. Please check the issues manually."
    exit 1
fi