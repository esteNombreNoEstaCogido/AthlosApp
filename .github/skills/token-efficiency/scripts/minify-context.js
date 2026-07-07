#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function compactWhitespace(code) {
  return code
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

function extractImportedNames(statement) {
  const named = statement.match(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/);
  if (named) {
    return named[1]
      .split(',')
      .map((item) => item.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
  }

  const defaultImport = statement.match(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"][^'"]+['"]/);
  if (defaultImport) return [defaultImport[1]];

  const namespaceImport = statement.match(/import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+['"][^'"]+['"]/);
  if (namespaceImport) return [namespaceImport[1]];

  return [];
}

function removeUnusedImports(code) {
  const lines = code.split('\n');
  const keptLines = [];
  const body = code.replace(/^\s*import[\s\S]*?;?\n/gm, '');
  const imports = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) {
      keptLines.push(line);
      continue;
    }

    if (trimmed.startsWith('import ')) {
      const names = extractImportedNames(trimmed);
      if (names.length === 0) {
        keptLines.push(line);
        continue;
      }

      const used = names.some((name) => body.includes(name));
      if (used) {
        keptLines.push(line);
      }
    }
  }

  return keptLines.join('\n');
}

function minify(code) {
  let output = stripComments(code);
  output = removeUnusedImports(output);
  output = compactWhitespace(output);
  return output;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node minify-context.js <file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const result = minify(content);
  process.stdout.write(result);
}

main();
