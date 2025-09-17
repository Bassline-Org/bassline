/**
 * File Materializer Gadget (Functional Implementation)
 *
 * Materializes generated artifacts into actual files on the filesystem
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  CompilationEffect,
  CompilationGadgetState,
  MaterializationRequest
} from '../types';
import { createEmptyAST, createEmptyMetrics, CompilationEffects } from '../base';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MaterializerConfig {
  outputPath: string;
  dryRun: boolean;
  backupExisting: boolean;
  createDirectories: boolean;
}

interface MaterializerState extends CompilationGadgetState {
  config: MaterializerConfig;
  materializedFiles: Set<string>;
  pendingRequests: MaterializationRequest[];
}

// Helper functions for file materialization
async function materializeFile(request: MaterializationRequest, config: MaterializerConfig): Promise<{
  success: boolean;
  path: string;
  error?: string;
}> {
  try {
    const filePath = path.resolve(request.path);

    if (config.dryRun) {
      console.log(`[DRY RUN] Would write to: ${filePath}`);
      return { success: true, path: filePath };
    }

    // Create directory if needed
    if (config.createDirectories) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Backup existing file if configured
    if (config.backupExisting) {
      try {
        await fs.access(filePath);
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copyFile(filePath, backupPath);
      } catch {
        // File doesn't exist, no backup needed
      }
    }

    // Write the file
    await fs.writeFile(filePath, request.content, { encoding: 'utf-8' });

    // Set permissions if specified
    if (request.permissions) {
      await fs.chmod(filePath, request.permissions);
    }

    return { success: true, path: filePath };

  } catch (error) {
    return {
      success: false,
      path: request.path,
      error: error instanceof Error ? error.message : 'Unknown materialization error'
    };
  }
}

async function materializeDirectory(request: MaterializationRequest, config: MaterializerConfig): Promise<{
  success: boolean;
  path: string;
  error?: string;
}> {
  try {
    const dirPath = path.resolve(request.path);

    if (config.dryRun) {
      console.log(`[DRY RUN] Would create directory: ${dirPath}`);
      return { success: true, path: dirPath };
    }

    await fs.mkdir(dirPath, { recursive: true });

    // Set permissions if specified
    if (request.permissions) {
      await fs.chmod(dirPath, request.permissions);
    }

    return { success: true, path: dirPath };

  } catch (error) {
    return {
      success: false,
      path: request.path,
      error: error instanceof Error ? error.message : 'Unknown directory creation error'
    };
  }
}

async function materializeSymlink(request: MaterializationRequest, config: MaterializerConfig): Promise<{
  success: boolean;
  path: string;
  error?: string;
}> {
  try {
    const linkPath = path.resolve(request.path);
    const targetPath = request.target || '';

    if (config.dryRun) {
      console.log(`[DRY RUN] Would create symlink: ${linkPath} -> ${targetPath}`);
      return { success: true, path: linkPath };
    }

    // Create directory if needed
    if (config.createDirectories) {
      const dir = path.dirname(linkPath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Remove existing symlink/file
    try {
      await fs.unlink(linkPath);
    } catch {
      // File doesn't exist, continue
    }

    await fs.symlink(targetPath, linkPath);

    return { success: true, path: linkPath };

  } catch (error) {
    return {
      success: false,
      path: request.path,
      error: error instanceof Error ? error.message : 'Unknown symlink creation error'
    };
  }
}

/**
 * Create a file materializer gadget using createGadget
 */
export function createFileMaterializer(config: {
  outputPath: string;
  dryRun?: boolean;
  backupExisting?: boolean;
  createDirectories?: boolean;
}) {
  const materializerConfig: MaterializerConfig = {
    outputPath: config.outputPath,
    dryRun: config.dryRun || false,
    backupExisting: config.backupExisting !== false,
    createDirectories: config.createDirectories !== false
  };

  const initialState: MaterializerState = {
    ast: createEmptyAST(),
    metrics: createEmptyMetrics(),
    cache: new Map(),
    config: materializerConfig,
    materializedFiles: new Set(),
    pendingRequests: []
  };

  return createGadget<MaterializerState, CompilationEffect>(
    (state, incoming) => {
      // Handle materialization requests
      if ('materialization' in incoming) {
        return { action: 'materialize', context: incoming.materialization };
      }

      // Handle batch materialization
      if ('batchMaterialization' in incoming) {
        return { action: 'materialize_batch', context: incoming.batchMaterialization };
      }

      return null;
    },
    {
      'materialize': (gadget: any, { requests }: { requests: MaterializationRequest[] }) => {
        const state = gadget.current() as MaterializerState;

        return gadget.receive({ batchMaterialization: { requests } });
      },

      'materialize_batch': async (gadget: any, { requests }: { requests: MaterializationRequest[] }) => {
        const state = gadget.current() as MaterializerState;

        const results: Array<{
          request: MaterializationRequest;
          success: boolean;
          path: string;
          error?: string;
        }> = [];

        let successCount = 0;
        let errorCount = 0;

        // Process each materialization request
        for (const request of requests) {
          let result;

          switch (request.type) {
            case 'file':
              result = await materializeFile(request, state.config);
              break;

            case 'directory':
              result = await materializeDirectory(request, state.config);
              break;

            case 'symlink':
              result = await materializeSymlink(request, state.config);
              break;

            default:
              result = {
                success: false,
                path: request.path,
                error: `Unknown materialization type: ${request.type}`
              };
              break;
          }

          results.push({
            request,
            ...result
          });

          if (result.success) {
            successCount++;
            state.materializedFiles.add(result.path);
          } else {
            errorCount++;

            // Emit error for failed materialization
            gadget.emit(CompilationEffects.compilationError('materializer', {
              code: 'MATERIALIZATION_ERROR',
              message: `Failed to materialize ${request.type}: ${result.error}`,
              severity: 'error'
            }));
          }
        }

        // Update metrics
        const newMetrics = { ...state.metrics };
        newMetrics.materializedFiles += successCount;
        newMetrics.errors += errorCount;

        const newState = {
          ...state,
          metrics: newMetrics
        };

        gadget.update(newState);

        // Emit materialization completion
        const summary = {
          total: requests.length,
          successful: successCount,
          failed: errorCount,
          paths: results.filter(r => r.success).map(r => r.path)
        };

        return changed({
          materialized: true,
          summary,
          dryRun: state.config.dryRun
        });
      }
    }
  )(initialState);
}