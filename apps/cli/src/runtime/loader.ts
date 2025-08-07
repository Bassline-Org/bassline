/**
 * Runtime loader for user installations
 */

import path from 'path'
import os from 'os'
import { promises as fs } from 'fs'
import type { BasslineInstallation } from '@bassline/installation'

export class InstallationLoader {
  private installPath: string
  private installation?: BasslineInstallation
  
  constructor(installPath?: string) {
    this.installPath = installPath || 
                      process.env.BASSLINE_HOME || 
                      path.join(os.homedir(), '.bassline')
  }
  
  /**
   * Check if installation exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.installPath)
      const indexPath = path.join(this.installPath, 'index.ts')
      const jsIndexPath = path.join(this.installPath, 'index.js')
      
      const tsExists = await this.fileExists(indexPath)
      const jsExists = await this.fileExists(jsIndexPath)
      
      return tsExists || jsExists
    } catch {
      return false
    }
  }
  
  /**
   * Load the user's installation
   */
  async load(): Promise<BasslineInstallation> {
    if (this.installation) {
      return this.installation
    }
    
    if (!await this.exists()) {
      throw new Error(
        `No Bassline installation found at ${this.installPath}\n` +
        `Run "bassline init" to create one.`
      )
    }
    
    try {
      // Try TypeScript first
      const tsPath = path.join(this.installPath, 'index.ts')
      if (await this.fileExists(tsPath)) {
        // Use tsx to load TypeScript directly
        try {
          require('tsx/cjs')
        } catch {
          // tsx not available globally, try local
          const localTsx = path.join(this.installPath, 'node_modules', 'tsx', 'dist', 'cjs', 'index.cjs')
          if (await this.fileExists(localTsx)) {
            require(localTsx)
          } else {
            throw new Error('TypeScript installation found but tsx not available')
          }
        }
        
        const module = await import(tsPath)
        this.installation = module.default
      } else {
        // Load JavaScript
        const jsPath = path.join(this.installPath, 'index.js')
        const module = await import(jsPath)
        this.installation = module.default
      }
      
      if (!this.installation) {
        throw new Error('Installation does not export a default BasslineInstallation')
      }
      
      return this.installation
    } catch (error) {
      throw new Error(
        `Failed to load installation from ${this.installPath}:\n` +
        `${error instanceof Error ? error.message : error}`
      )
    }
  }
  
  /**
   * Get installation path
   */
  getPath(): string {
    return this.installPath
  }
  
  /**
   * Get installation metadata
   */
  async getMetadata() {
    const packagePath = path.join(this.installPath, 'package.json')
    if (await this.fileExists(packagePath)) {
      const content = await fs.readFile(packagePath, 'utf-8')
      return JSON.parse(content)
    }
    return null
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}