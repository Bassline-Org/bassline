/**
 * File Materializer Gadget
 *
 * Takes materialization requests and actually creates files, directories,
 * and sets permissions on the filesystem
 */

import { CompilationGadget, CompilationEffects } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  MaterializationRequest
} from '../types';
import { changed, noop } from '../../effects';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MaterializerConfig {
  dryRun?: boolean;
  backupExisting?: boolean;
  outputPath: string;
}

export class FileMaterializer extends CompilationGadget {
  private config: MaterializerConfig;

  constructor(config: MaterializerConfig) {
    super({});
    this.config = {
      dryRun: false,
      backupExisting: true,
      ...config
    };
  }

  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null {
    if ('materialization' in effect) {
      return { action: 'materialize', context: effect.materialization };
    }

    return null;
  }

  protected createActions() {
    return {
      'materialize': async (gadget: any, { requests }: { requests: MaterializationRequest[] }) => {
        const state = gadget.current() as CompilationGadgetState;

        try {
          const results = await this.processRequests(requests);

          // Update metrics
          const newMetrics = { ...state.metrics };
          newMetrics.materializedFiles += results.filesCreated;

          gadget.update({
            ...state,
            metrics: newMetrics
          });

          return changed({
            materialized: true,
            requests: requests.length,
            filesCreated: results.filesCreated,
            directoriesCreated: results.directoriesCreated,
            errors: results.errors.length,
            dryRun: this.config.dryRun
          });

        } catch (error) {
          gadget.emit(CompilationEffects.compilationError('materializer', {
            code: 'MATERIALIZATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown materialization error',
            severity: 'error'
          }));

          return changed({ materialized: false, error: error.message });
        }
      }
    };
  }

  private async processRequests(requests: MaterializationRequest[]): Promise<{
    filesCreated: number;
    directoriesCreated: number;
    errors: string[];
  }> {
    const results = {
      filesCreated: 0,
      directoriesCreated: 0,
      errors: []
    };

    // Group requests by type for efficient processing
    const groupedRequests = this.groupRequestsByType(requests);

    // Process in order: directories first, then files, then permissions
    await this.processDirectoryRequests(groupedRequests.directories, results);
    await this.processFileRequests(groupedRequests.files, results);
    await this.processPermissionRequests(groupedRequests.permissions, results);
    await this.processSymlinkRequests(groupedRequests.symlinks, results);

    return results;
  }

  private groupRequestsByType(requests: MaterializationRequest[]): {
    directories: MaterializationRequest[];
    files: MaterializationRequest[];
    permissions: MaterializationRequest[];
    symlinks: MaterializationRequest[];
  } {
    const grouped = {
      directories: [],
      files: [],
      permissions: [],
      symlinks: []
    };

    requests.forEach(request => {
      switch (request.type) {
        case 'create_directory':
          grouped.directories.push(request);
          break;
        case 'write_file':
          grouped.files.push(request);
          break;
        case 'set_permissions':
          grouped.permissions.push(request);
          break;
        case 'create_symlink':
          grouped.symlinks.push(request);
          break;
      }
    });

    return grouped;
  }

  private async processDirectoryRequests(
    requests: MaterializationRequest[],
    results: { directoriesCreated: number; errors: string[] }
  ): Promise<void> {
    // Deduplicate and sort by depth to create parent directories first
    const uniquePaths = [...new Set(requests.map(r => r.path))];
    const sortedPaths = uniquePaths.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);

    for (const dirPath of sortedPaths) {
      try {
        const fullPath = path.resolve(this.config.outputPath, dirPath);

        if (this.config.dryRun) {
          console.log(`[DRY RUN] Would create directory: ${fullPath}`);
          results.directoriesCreated++;
          continue;
        }

        // Check if directory already exists
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            continue; // Directory already exists
          } else {
            throw new Error(`Path exists but is not a directory: ${fullPath}`);
          }
        } catch (error) {
          // Directory doesn't exist, create it
          await fs.mkdir(fullPath, { recursive: true });
          results.directoriesCreated++;
          console.log(`Created directory: ${fullPath}`);
        }

      } catch (error) {
        const errorMsg = `Failed to create directory ${dirPath}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  private async processFileRequests(
    requests: MaterializationRequest[],
    results: { filesCreated: number; errors: string[] }
  ): Promise<void> {
    for (const request of requests) {
      try {
        const fullPath = path.resolve(this.config.outputPath, request.path);

        if (this.config.dryRun) {
          console.log(`[DRY RUN] Would write file: ${fullPath} (${request.content?.length || 0} bytes)`);
          results.filesCreated++;
          continue;
        }

        // Backup existing file if requested
        if (this.config.backupExisting) {
          await this.backupExistingFile(fullPath);
        }

        // Ensure parent directory exists
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(fullPath, request.content || '', 'utf8');
        results.filesCreated++;
        console.log(`Created file: ${fullPath}`);

      } catch (error) {
        const errorMsg = `Failed to write file ${request.path}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  private async processPermissionRequests(
    requests: MaterializationRequest[],
    results: { errors: string[] }
  ): Promise<void> {
    for (const request of requests) {
      try {
        const fullPath = path.resolve(this.config.outputPath, request.path);

        if (this.config.dryRun) {
          console.log(`[DRY RUN] Would set permissions on: ${fullPath} (${request.permissions?.toString(8)})`);
          continue;
        }

        if (request.permissions !== undefined) {
          await fs.chmod(fullPath, request.permissions);
          console.log(`Set permissions on: ${fullPath} (${request.permissions.toString(8)})`);
        }

      } catch (error) {
        const errorMsg = `Failed to set permissions on ${request.path}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  private async processSymlinkRequests(
    requests: MaterializationRequest[],
    results: { errors: string[] }
  ): Promise<void> {
    for (const request of requests) {
      try {
        const fullPath = path.resolve(this.config.outputPath, request.path);
        const target = request.target;

        if (!target) {
          throw new Error('Symlink target is required');
        }

        if (this.config.dryRun) {
          console.log(`[DRY RUN] Would create symlink: ${fullPath} -> ${target}`);
          continue;
        }

        // Remove existing symlink/file if it exists
        try {
          await fs.unlink(fullPath);
        } catch (error) {
          // Ignore if file doesn't exist
        }

        // Create symlink
        await fs.symlink(target, fullPath);
        console.log(`Created symlink: ${fullPath} -> ${target}`);

      } catch (error) {
        const errorMsg = `Failed to create symlink ${request.path}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  private async backupExistingFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);

      // File exists, create backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup-${timestamp}`;

      await fs.copyFile(filePath, backupPath);
      console.log(`Backed up existing file: ${filePath} -> ${backupPath}`);

    } catch (error) {
      // File doesn't exist, no backup needed
    }
  }

  /**
   * Clean up generated files (useful for testing)
   */
  async cleanup(pattern?: string): Promise<void> {
    if (this.config.dryRun) {
      console.log('[DRY RUN] Would clean up generated files');
      return;
    }

    try {
      const outputPath = path.resolve(this.config.outputPath);

      if (pattern) {
        // Clean specific pattern
        const glob = await import('glob');
        const files = await glob.glob(pattern, { cwd: outputPath });

        for (const file of files) {
          const fullPath = path.join(outputPath, file);
          await fs.unlink(fullPath);
          console.log(`Cleaned up: ${fullPath}`);
        }
      } else {
        // Clean entire output directory
        await fs.rmdir(outputPath, { recursive: true });
        console.log(`Cleaned up directory: ${outputPath}`);
      }

    } catch (error) {
      console.error('Cleanup failed:', error.message);
    }
  }

  /**
   * Get materialization statistics
   */
  getStats(): {
    outputPath: string;
    dryRun: boolean;
    backupExisting: boolean;
  } {
    return {
      outputPath: path.resolve(this.config.outputPath),
      dryRun: this.config.dryRun,
      backupExisting: this.config.backupExisting
    };
  }
}

/**
 * Create a file materializer gadget
 */
export function createFileMaterializer(config: MaterializerConfig): FileMaterializer {
  return new FileMaterializer(config);
}