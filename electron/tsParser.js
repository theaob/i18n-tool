const vm = require('vm');

/**
 * Safely parses the content of a TypeScript/Javascript locale file.
 * @param {string} content - File content
 * @returns {{data: object, meta: object}} Parsed locale data and formatting metadata
 */
function parseTs(content) {
  // Extract imports
  const importRegex = /import\s+[\s\S]*?from\s+['"].*?['"];?/g;
  const imports = content.match(importRegex) || [];
  
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
    } else if (/export\s*=\s*/.test(code)) {
      exportType = 'export-equals';
      code = code.replace(/export\s*=\s*/, 'global.locale = ');
    }
  }
  
  const sandbox = { global: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox);
  } catch (err) {
    throw new Error(`Failed to parse TypeScript file content: ${err.message}`);
  }
  
  const data = sandbox.global.locale || sandbox.module?.exports;
  if (!data || typeof data !== 'object') {
    throw new Error('No valid locale object was found exported from the file.');
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
