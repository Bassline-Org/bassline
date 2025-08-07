#!/bin/bash

# Update imports in web app to use workspace packages

echo "Updating imports in apps/web..."

# Update core imports
find apps/web -type f -name "*.ts" -o -name "*.tsx" | while read file; do
  # Update propagation-core-v2/types imports
  sed -i '' "s|from ['\"]~/propagation-core-v2/types['\"]|from '@bassline/core'|g" "$file"
  sed -i '' "s|from ['\"]~/propagation-core-v2/types/index['\"]|from '@bassline/core'|g" "$file"
  
  # Update propagation-core-v2/propagation imports
  sed -i '' "s|from ['\"]~/propagation-core-v2/propagation['\"]|from '@bassline/core'|g" "$file"
  sed -i '' "s|from ['\"]~/propagation-core-v2/propagation/index['\"]|from '@bassline/core'|g" "$file"
  
  # Update propagation-core-v2/schedulers imports
  sed -i '' "s|from ['\"]~/propagation-core-v2/schedulers/immediate['\"]|from '@bassline/core'|g" "$file"
  sed -i '' "s|from ['\"]~/propagation-core-v2/schedulers/batch['\"]|from '@bassline/core'|g" "$file"
  
  # Update propagation-core-v2/primitives imports
  sed -i '' "s|from ['\"]~/propagation-core-v2/primitives/|from '@bassline/core'|g" "$file"
  sed -i '' "s|from ['\"]~/propagation-core-v2/primitives['\"]|from '@bassline/core'|g" "$file"
  
  # Update bassline imports
  sed -i '' "s|from ['\"]~/propagation-core-v2/bassline['\"]|from '@bassline/bassline'|g" "$file"
  sed -i '' "s|from ['\"]~/propagation-core-v2/bassline/|from '@bassline/bassline'|g" "$file"
done

echo "Import migration complete!"