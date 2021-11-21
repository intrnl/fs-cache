Rudimentary filesystem cache

## Examples

Transformation plugin example

```js
import * as fs from 'fs/promises';
import postcss from 'postcss';

import { FSCache, getProjectRoot } from '@intrnl/fs-cache';

const cache = new FSCache({
  ...await getProjectRoot('postcss'),
});

// Plugin version
const version = 1;

// Set up transformer
const plugins = [/* ... */];
const transformer = postcss(plugins);

const filename = '/app.css';

// The key is stringified to JSON.
const key = [
  version,
  plugins.map((plugin) => plugin.postcssPlugin),
];

const result = await cache.get(filename, key, async () => {
  const source = await fs.readFile(filename, 'utf-8');
  const css = await transformer.process(source, { from: filename });

  // Collect dependencies.
  const dependencies = [filename];

  for (const message of result.messages) {
    if (message.type === 'dependency') {
      dependencies.push(message.file);
    } 
  }

  // dependencies is the only special field, modified time is stored and
  // compared the next time.
  return { dependencies, css };
});
```
