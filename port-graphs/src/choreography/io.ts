/**
 * Save and load utilities for choreographies
 *
 * Supports both JSON and YAML formats
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Choreography } from './types';

/**
 * Load a choreography from a file (JSON or YAML)
 */
export function loadChoreography(filePath: string): Choreography {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.yaml':
    case '.yml':
      return yaml.load(content) as Choreography;

    case '.json':
      return JSON.parse(content) as Choreography;

    default:
      // Try to parse as JSON first, fall back to YAML
      try {
        return JSON.parse(content) as Choreography;
      } catch {
        return yaml.load(content) as Choreography;
      }
  }
}

/**
 * Save a choreography to a file (JSON or YAML based on extension)
 */
export function saveChoreography(
  choreography: Choreography,
  filePath: string,
  options?: {
    format?: 'json' | 'yaml';
    indent?: number;
  }
): void {
  const ext = path.extname(filePath).toLowerCase();
  const format = options?.format ||
    (ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json');

  let content: string;

  if (format === 'yaml') {
    content = yaml.dump(choreography, {
      indent: options?.indent || 2,
      sortKeys: false,
      lineWidth: -1 // Don't wrap lines
    });
  } else {
    content = JSON.stringify(choreography, null, options?.indent || 2);
  }

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Parse choreography from a string (auto-detect format)
 */
export function parseChoreography(content: string): Choreography {
  // Try JSON first (stricter format)
  try {
    return JSON.parse(content) as Choreography;
  } catch {
    // Fall back to YAML
    return yaml.load(content) as Choreography;
  }
}

/**
 * Serialize choreography to string
 */
export function serializeChoreography(
  choreography: Choreography,
  format: 'json' | 'yaml' = 'yaml',
  indent: number = 2
): string {
  if (format === 'yaml') {
    return yaml.dump(choreography, {
      indent,
      sortKeys: false,
      lineWidth: -1
    });
  } else {
    return JSON.stringify(choreography, null, indent);
  }
}

/**
 * Validate a choreography structure
 */
export function validateChoreography(choreography: any): choreography is Choreography {
  if (!choreography || typeof choreography !== 'object') {
    return false;
  }

  // Must have gadgets section
  if (!choreography.gadgets || typeof choreography.gadgets !== 'object') {
    return false;
  }

  // Validate gadget definitions
  for (const [, spec] of Object.entries(choreography.gadgets)) {
    if (!spec || typeof spec !== 'object') {
      return false;
    }

    const gadgetSpec = spec as any;
    if (!gadgetSpec.type || typeof gadgetSpec.type !== 'string') {
      return false;
    }
  }

  // Validate bootstrap if present
  if (choreography.bootstrap) {
    if (!Array.isArray(choreography.bootstrap)) {
      return false;
    }

    for (const message of choreography.bootstrap) {
      if (!message || typeof message !== 'object') {
        return false;
      }
      if (!message.to || typeof message.to !== 'string') {
        return false;
      }
      // data can be any type
    }
  }

  return true;
}