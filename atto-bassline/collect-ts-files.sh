#!/bin/bash

# Script to collect all TypeScript files from atto-bassline into a single file
# with clear boundaries and file paths

OUTPUT_FILE="/tmp/atto-bassline-combined.ts"
BASE_DIR="/Users/goose/prg/bassline/atto-bassline"

# Clear the output file if it exists
> "$OUTPUT_FILE"

# Add header
echo "// ============================================================================" >> "$OUTPUT_FILE"
echo "// ATTO-BASSLINE COMBINED TYPESCRIPT FILES" >> "$OUTPUT_FILE"
echo "// Generated on: $(date)" >> "$OUTPUT_FILE"
echo "// Base directory: $BASE_DIR" >> "$OUTPUT_FILE"
echo "// ============================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find all .ts files (excluding node_modules, dist, and test files)
find "$BASE_DIR" -name "*.ts" -type f \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/__tests__/*" \
  ! -name "*.test.ts" \
  ! -name "*.spec.ts" \
  | sort | while read -r file; do
  
  # Get relative path
  relative_path="${file#$BASE_DIR/}"
  
  # Add file separator
  echo "" >> "$OUTPUT_FILE"
  echo "// ============================================================================" >> "$OUTPUT_FILE"
  echo "// FILE: $relative_path" >> "$OUTPUT_FILE"
  echo "// ============================================================================" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  
  # Add file contents
  cat "$file" >> "$OUTPUT_FILE"
  
  # Add end marker
  echo "" >> "$OUTPUT_FILE"
  echo "// ------------ END OF FILE: $relative_path ------------" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Add footer
echo "" >> "$OUTPUT_FILE"
echo "// ============================================================================" >> "$OUTPUT_FILE"
echo "// END OF COMBINED TYPESCRIPT FILES" >> "$OUTPUT_FILE"
echo "// Total files included: $(find "$BASE_DIR" -name "*.ts" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/__tests__/*" ! -name "*.test.ts" ! -name "*.spec.ts" | wc -l | tr -d ' ')" >> "$OUTPUT_FILE"
echo "// ============================================================================" >> "$OUTPUT_FILE"

# Print summary
echo "✅ Combined TypeScript files written to: $OUTPUT_FILE"
echo "📊 Total files included: $(find "$BASE_DIR" -name "*.ts" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/__tests__/*" ! -name "*.test.ts" ! -name "*.spec.ts" | wc -l | tr -d ' ')"
echo "📏 Output file size: $(ls -lh "$OUTPUT_FILE" | awk '{print $5}')"