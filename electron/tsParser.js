const vm = require('vm');

/**
 * Marks Proxy stubs created for unresolved imports, so we can tell apart
 * "import used only as a computed-key generator" (fine — the enum member
 * name is consumed as a string key and the proxy itself never survives
 * into the data) from "import used directly as a value" (e.g. spreading
 * or assigning another locale file's export — that data isn't in this
 * file, so returning a stub for it would silently drop real keys).
 */
const IMPORT_STUB = Symbol('importStub');

function makeImportStub() {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === IMPORT_STUB) return true;
      if (typeof prop === 'symbol') return undefined;
      return prop;
    },
  });
}

/** Extracts the local binding names introduced by one `import ... from '...'` statement. */
function extractImportNames(statement) {
  const clauseMatch = statement.match(/^import\s+(.+?)\s+from\s+['"]/s);
  if (!clauseMatch) return [];
  let clause = clauseMatch[1].trim();

  const nsMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
  if (nsMatch) return [nsMatch[1]];

  const names = [];
  const braceMatch = clause.match(/\{([^}]*)\}/);
  if (braceMatch) {
    for (const part of braceMatch[1].split(',')) {
      const p = part.trim();
      if (!p) continue;
      const asMatch = p.match(/\bas\s+([A-Za-z_$][\w$]*)\s*$/);
      names.push(asMatch ? asMatch[1] : p.split(/\s+/)[0]);
    }
    clause = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();
  }
  if (clause) {
    const defMatch = clause.match(/^([A-Za-z_$][\w$]*)$/);
    if (defMatch) names.push(defMatch[1]);
  }
  return names;
}

/** Finds the dotted path of the first unresolved-import stub still present as a value. */
function findImportStub(obj, path = '') {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[IMPORT_STUB]) return path || '(root)';
  for (const [k, v] of Object.entries(obj)) {
    const found = findImportStub(v, path ? `${path}.${k}` : k);
    if (found) return found;
  }
  return null;
}

/**
 * Safely parses the content of a TypeScript/Javascript locale file.
 * @param {string} content - File content
 * @returns {{data: object, meta: object}} Parsed locale data and formatting metadata
 */
function parseTs(content) {
  // Extract imports
  const importRegex = /import\s+[\s\S]*?from\s+['"].*?['"];?/g;
  const imports = content.match(importRegex) || [];

  // Named imports are usually TS enums used only as computed object keys
  // (e.g. `[SomeReason.FOO]: '...'`). Stub each imported binding so that
  // access resolves instead of throwing ReferenceError; if a stub ends up
  // stored as an actual value (not just consumed for its key name) we
  // catch that below and fail with a precise error instead of silently
  // losing data.
  const importNames = new Set();
  for (const stmt of imports) {
    for (const name of extractImportNames(stmt)) importNames.add(name);
  }
  const stubPreamble = Array.from(importNames)
      .map(name => `const ${name} = __importStub();`)
      .join('\n');

  let code = content.replace(importRegex, '');
  
  let exportType = 'default';
  let exportName = '';
  let asConst = false;
  
  if (code.includes('as const')) {
    asConst = true;
  }
  
  // Clean 'as const' and other castings
  code = code.replace(/\s+as\s+const\b/g, '');
  code = code.replace(/\s+as\s+[a-zA-Z0-9_<>{}[\]\s:|'"]+(;|\n|$)/g, '$1');
  
  // Normalize exports to global.locale assignment
  if (/export\s+default\s+/.test(code)) {
    exportType = 'default';
    code = code.replace(/export\s+default\s+/, 'global.locale = ');
  } else {
    const namedMatch = code.match(/export\s+(const|let|var)\s+(\w+)\s*(:\s*[^{=]+)?=\s*/);
    if (namedMatch) {
      exportType = 'named';
      exportName = namedMatch[2];
      code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*(:\s*[^{=]+)?=\s*/, 'global.locale = ');
    } else if (/module\.exports\s*=\s*/.test(code)) {
      exportType = 'cjs';
      code = code.replace(/module\.exports\s*=\s*/, 'global.locale = ');
    } else if (/export\s+=[^=]/.test(code)) {
      exportType = 'export-equals';
      code = code.replace(/export\s+=\s*/, 'global.locale = ');
    }
  }
  
  const sandbox = { global: {}, __importStub: makeImportStub };
  vm.createContext(sandbox);
  try {
    vm.runInContext(stubPreamble + '\n' + code, sandbox, { timeout: 5000 });
  } catch (err) {
    throw new Error(`Failed to parse TypeScript file content: ${err.message}`);
  }

  const data = sandbox.global.locale;
  if (!data || typeof data !== 'object') {
    throw new Error('No valid locale object was found exported from the file.');
  }

  const unresolvedPath = findImportStub(data);
  if (unresolvedPath) {
    throw new Error(
        `Unresolved import at key "${unresolvedPath}" — this file references another module's ` +
        `export directly as a value (not just as a computed key), so it can't be parsed standalone.`
    );
  }

  return {
    data,
    meta: {
      format: 'ts',
      exportType,
      exportName,
      asConst,
      imports
    }
  };
}

module.exports = { parseTs };
