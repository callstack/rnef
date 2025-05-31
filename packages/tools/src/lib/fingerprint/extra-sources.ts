import fs from 'node:fs';
import path from 'node:path';
import type { HashSource } from '@expo/fingerprint';
import glob from 'fast-glob';
import logger from '../logger.js';
import { sourceDir, sourceFile } from './utils.js';

/**
 * Processes extra source files and directories for fingerprinting.
 * @param extraSources Array of file paths, directory paths, or glob patterns
 * @param projectRoot Root directory of the project
 * @param ignorePaths Optional array of paths to ignore
 * @returns Array of processed sources with their contents or directory information
 */
export function processExtraSources(
  extraSources: string[],
  projectRoot: string,
  ignorePaths?: string[]
) {
  const processedSources: Array<HashSource> = [];

  for (const source of extraSources) {
    try {
      const isGlobPattern = glob.isDynamicPattern(source);
      if (isGlobPattern) {
        const matches = glob.sync(source, {
          cwd: projectRoot,
          ignore: ignorePaths ?? [],
        });
        for (const match of matches) {
          const absolutePath = path.join(projectRoot, match);
          if (fs.existsSync(absolutePath)) {
            const stats = fs.statSync(absolutePath);
            if (stats.isDirectory()) {
              processedSources.push(
                sourceDir(absolutePath, 'custom-user-config')
              );
            } else {
              processedSources.push(
                sourceFile(absolutePath, 'custom-user-config')
              );
            }
          }
        }
        continue;
      }

      const absolutePath = path.isAbsolute(source)
        ? source
        : path.join(projectRoot, source);
      if (!fs.existsSync(absolutePath)) {
        logger.warn(
          `Extra source "${absolutePath}" does not exist, skipping...`
        );
        continue;
      }

      const stats = fs.statSync(absolutePath);
      if (stats.isDirectory()) {
        processedSources.push(sourceDir(absolutePath, 'custom-user-config'));
      } else {
        processedSources.push(sourceFile(absolutePath, 'custom-user-config'));
      }
    } catch (error) {
      logger.debug(`Error processing extra source "${source}": ${error}`);
    }
  }

  return processedSources;
}
