import { describe, it, expect } from 'vitest';
import {
  insertDirectives,
  appendNodeDirective,
  replaceDirectives,
} from '../directive-inserter.js';

describe('insertDirectives', () => {
  const fileKey = 'abc123XYZ';
  const nodeId = '1:23';

  describe('inserting into empty files', () => {
    it('inserts directives into empty TypeScript file', () => {
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'component.tsx',
        content: '',
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(`// @figma-file: ${fileKey}\n// @figma-node: ${nodeId}`);
    });

    it('inserts directives into empty Python file', () => {
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'script.py',
        content: '',
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(`# @figma-file: ${fileKey}\n# @figma-node: ${nodeId}`);
    });

    it('inserts directives into empty CSS file', () => {
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'styles.css',
        content: '',
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(`/* @figma-file: ${fileKey} */\n/* @figma-node: ${nodeId} */`);
    });

    it('inserts directives into empty HTML file', () => {
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'page.html',
        content: '',
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(
        `<!-- @figma-file: ${fileKey} -->\n<!-- @figma-node: ${nodeId} -->`
      );
    });

    it('inserts file directive only when no node ID provided', () => {
      const result = insertDirectives({
        fileKey,
        nodeId: null,
        filePath: 'component.tsx',
        content: '',
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(`// @figma-file: ${fileKey}`);
    });
  });

  describe('inserting into files with existing content', () => {
    it('inserts directives at top with blank line before content', () => {
      const content = 'const x = 1;\nconst y = 2;';
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'file.ts',
        content,
      });
      expect(result.modified).toBe(true);
      expect(result.content).toBe(
        `// @figma-file: ${fileKey}\n// @figma-node: ${nodeId}\n\nconst x = 1;\nconst y = 2;\n`
      );
    });

    it('preserves content when inserting', () => {
      const content = `export function hello() {
  console.log("Hello");
}`;
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'file.ts',
        content,
      });
      expect(result.content).toContain('export function hello()');
      expect(result.content).toContain('console.log("Hello")');
    });
  });

  describe('handling shebang lines', () => {
    it('inserts directives after shebang', () => {
      const content = '#!/usr/bin/env node\nconsole.log("hello");';
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'script.js',
        content,
      });
      expect(result.modified).toBe(true);
      expect(result.content.startsWith('#!/usr/bin/env node')).toBe(true);
      expect(result.content).toContain(`// @figma-file: ${fileKey}`);
      expect(result.content.indexOf('#!/usr/bin/env node')).toBeLessThan(
        result.content.indexOf('@figma-file')
      );
    });

    it('handles shebang-only file', () => {
      const content = '#!/usr/bin/env python3';
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'script.py',
        content,
      });
      expect(result.modified).toBe(true);
      expect(result.content).toContain('#!/usr/bin/env python3');
      expect(result.content).toContain(`# @figma-file: ${fileKey}`);
    });

    it('handles shebang with content after', () => {
      const content = `#!/bin/bash
echo "Hello"
echo "World"`;
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'script.sh',
        content,
      });
      expect(result.modified).toBe(true);
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('#!/bin/bash');
      expect(lines[1]).toBe(`# @figma-file: ${fileKey}`);
    });
  });

  describe('preserving line endings', () => {
    it('preserves LF line endings', () => {
      const content = 'line1\nline2\nline3';
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'file.ts',
        content,
      });
      expect(result.content).not.toContain('\r\n');
      expect(result.content).toContain('\n');
    });

    it('preserves CRLF line endings', () => {
      const content = 'line1\r\nline2\r\nline3';
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'file.ts',
        content,
      });
      expect(result.content).toContain('\r\n');
    });
  });

  describe('insert mode with existing directives', () => {
    it('does not modify file with existing directives in insert mode', () => {
      const content = `// @figma-file: existingKey
// @figma-node: 9:99
const x = 1;`;
      const result = insertDirectives({
        fileKey,
        nodeId,
        filePath: 'file.ts',
        content,
        mode: 'insert',
      });
      expect(result.modified).toBe(false);
      expect(result.content).toBe(content);
    });
  });
});

describe('appendNodeDirective', () => {
  const fileKey = 'abc123XYZ';
  const existingNodeId = '1:23';
  const newNodeId = '4:56';

  it('appends new node to file with matching file key', () => {
    const content = `// @figma-file: ${fileKey}
// @figma-node: ${existingNodeId}
const x = 1;`;
    const result = appendNodeDirective(fileKey, newNodeId, 'file.ts', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`// @figma-node: ${existingNodeId}`);
    expect(result.content).toContain(`// @figma-node: ${newNodeId}`);
  });

  it('does not modify file with different file key', () => {
    const content = `// @figma-file: differentKey
// @figma-node: ${existingNodeId}
const x = 1;`;
    const result = appendNodeDirective(fileKey, newNodeId, 'file.ts', content);
    expect(result.modified).toBe(false);
    expect(result.content).toBe(content);
  });

  it('does not add duplicate node ID', () => {
    const content = `// @figma-file: ${fileKey}
// @figma-node: ${existingNodeId}
const x = 1;`;
    const result = appendNodeDirective(fileKey, existingNodeId, 'file.ts', content);
    expect(result.modified).toBe(false);
    expect(result.content).toBe(content);
  });

  it('appends node with correct comment style for Python', () => {
    const content = `# @figma-file: ${fileKey}
# @figma-node: ${existingNodeId}
print("hello")`;
    const result = appendNodeDirective(fileKey, newNodeId, 'script.py', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`# @figma-node: ${newNodeId}`);
  });

  it('appends node with correct comment style for CSS', () => {
    const content = `/* @figma-file: ${fileKey} */
/* @figma-node: ${existingNodeId} */
.class {}`;
    const result = appendNodeDirective(fileKey, newNodeId, 'styles.css', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`/* @figma-node: ${newNodeId} */`);
  });

  it('appends node with correct comment style for HTML', () => {
    const content = `<!-- @figma-file: ${fileKey} -->
<!-- @figma-node: ${existingNodeId} -->
<div></div>`;
    const result = appendNodeDirective(fileKey, newNodeId, 'page.html', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`<!-- @figma-node: ${newNodeId} -->`);
  });
});

describe('replaceDirectives', () => {
  const newFileKey = 'newKey123';
  const newNodeId = '9:99';

  it('replaces existing directives with new ones', () => {
    const content = `// @figma-file: oldKey
// @figma-node: 1:23
// @figma-node: 4:56
const x = 1;`;
    const result = replaceDirectives(newFileKey, newNodeId, 'file.ts', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`// @figma-file: ${newFileKey}`);
    expect(result.content).toContain(`// @figma-node: ${newNodeId}`);
    expect(result.content).not.toContain('oldKey');
    expect(result.content).not.toContain('1:23');
    expect(result.content).not.toContain('4:56');
  });

  it('replaces directives and preserves remaining content', () => {
    const content = `// @figma-file: oldKey
// @figma-node: 1:23
const x = 1;
function hello() {}`;
    const result = replaceDirectives(newFileKey, newNodeId, 'file.ts', content);
    expect(result.content).toContain('const x = 1;');
    expect(result.content).toContain('function hello() {}');
  });

  it('replaces directives in file with shebang', () => {
    const content = `#!/usr/bin/env node
// @figma-file: oldKey
// @figma-node: 1:23
console.log("hello");`;
    const result = replaceDirectives(newFileKey, newNodeId, 'script.js', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain('#!/usr/bin/env node');
    expect(result.content).toContain(`// @figma-file: ${newFileKey}`);
    expect(result.content).not.toContain('oldKey');
  });

  it('replaces directives with different comment styles', () => {
    const content = `# @figma-file: oldKey
# @figma-node: 1:23
print("hello")`;
    const result = replaceDirectives(newFileKey, newNodeId, 'script.py', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`# @figma-file: ${newFileKey}`);
    expect(result.content).toContain(`# @figma-node: ${newNodeId}`);
    expect(result.content).not.toContain('oldKey');
  });

  it('replaces with file directive only when no node ID provided', () => {
    const content = `// @figma-file: oldKey
// @figma-node: 1:23
const x = 1;`;
    const result = replaceDirectives(newFileKey, null, 'file.ts', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`// @figma-file: ${newFileKey}`);
    expect(result.content).not.toContain('@figma-node');
  });

  it('inserts directives when no existing directives (replace mode)', () => {
    const content = 'const x = 1;\nconst y = 2;';
    const result = replaceDirectives(newFileKey, newNodeId, 'file.ts', content);
    expect(result.modified).toBe(true);
    expect(result.content).toContain(`// @figma-file: ${newFileKey}`);
    expect(result.content).toContain(`// @figma-node: ${newNodeId}`);
    expect(result.content).toContain('const x = 1;');
  });
});
