import type { HashSourceDir, HashSourceFile } from '@expo/fingerprint';

export function sourceFile(path: string, reason: string): HashSourceFile {
  return {
    type: 'file',
    filePath: path,
    reasons: [reason],
  };
}

export function sourceDir(path: string, reason: string): HashSourceDir {
  return {
    type: 'dir',
    filePath: path,
    reasons: [reason],
  };
}
