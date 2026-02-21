import path from 'node:path';

function normalizePath(input: string): string {
  return path.resolve(input);
}

export function isPathInside(rootPath: string, candidatePath: string): boolean {
  const root = normalizePath(rootPath);
  const candidate = normalizePath(candidatePath);
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertPathInside(
  rootPath: string,
  candidatePath: string,
  errorMessage = 'Path is outside the allowed directory',
): string {
  const candidate = normalizePath(candidatePath);
  if (!isPathInside(rootPath, candidate)) {
    throw new Error(errorMessage);
  }
  return candidate;
}

export function assertPathInsideAny(
  rootPaths: string[],
  candidatePath: string,
  errorMessage = 'Path is outside the allowed directories',
): string {
  const candidate = normalizePath(candidatePath);
  if (!rootPaths.some((root) => isPathInside(root, candidate))) {
    throw new Error(errorMessage);
  }
  return candidate;
}
