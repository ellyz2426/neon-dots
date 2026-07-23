# @iwsdk/vite-plugin-uikitml

A Vite plugin for compiling UIKitML files to JSON. UIKitML is an HTML-like syntax for building spatial UI with [@pmndrs/uikit](https://github.com/pmndrs/uikit).

## Features

- 🎨 **HTML-Like Syntax** - Write spatial UI with familiar HTML/CSS patterns
- 👁️ **File Watching** - Automatic recompilation during development
- 🔄 **Hot Reload** - Triggers full reload when UI files change
- 📦 **Build Integration** - Compiles all files during production build

## Installation

```bash
npm install -D @iwsdk/vite-plugin-uikitml
```

## Quick Start

```javascript
import { defineConfig } from 'vite';
import { compileUIKit } from '@iwsdk/vite-plugin-uikitml';

export default defineConfig({
  plugins: [
    compileUIKit({
      sourceDir: 'ui',
      outputDir: 'public/ui',
      verbose: true,
    }),
  ],
});
```

## Configuration Options

```javascript
compileUIKit({
  // Directory containing .uikitml files
  sourceDir: 'ui', // default

  // Directory for compiled .json files
  outputDir: 'public/ui', // default

  // Enable file watching in development
  watch: true, // default

  // Include pattern for files to process
  include: /\.uikitml$/, // default

  // Exclude pattern for files to ignore
  exclude: undefined, // default

  // Enable verbose logging
  verbose: false, // default
});
```

## UIKitML Syntax

Create `.uikitml` files with HTML-like syntax:

```html
<!-- ui/welcome.uikitml -->
<style>
  .panel {
    background-color: rgba(0, 0, 0, 0.8);
    padding: 24px;
    border-radius: 16px;
  }

  .title {
    font-size: 32px;
    font-weight: 700;
    color: white;
  }

  .button {
    background-color: #0066cc;
    padding: 12px 24px;
    border-radius: 8px;
  }

  .button:hover {
    background-color: #0077ee;
  }
</style>

<Container class="panel">
  <Text class="title">Welcome to WebXR</Text>
  <button id="enter-vr" class="button">
    <Text>Enter VR</Text>
  </button>
</Container>
```

This compiles to `public/ui/welcome.json`, which can be loaded by IWSDK's PanelUI system.

## Project Structure

```
your-project/
├── ui/
│   ├── welcome.uikitml
│   ├── settings.uikitml
│   └── hud/
│       └── health.uikitml
├── public/
│   └── ui/           # Generated JSON files
│       ├── welcome.json
│       ├── settings.json
│       └── hud/
│           └── health.json
└── vite.config.js
```

## Usage with IWSDK

```typescript
import { World, PanelUI } from '@iwsdk/core';

const world = await World.create(container, {
  features: {
    spatialUI: {
      kits: [horizonKit],
    },
  },
});

// Create a panel entity
const panel = world.createEntity();
panel.addComponent(PanelUI, {
  config: './ui/welcome.json',
});
```

## Build Output

```
[compile-uikitml] Found 3 .uikitml files to compile
[compile-uikitml] ✅ Compiled: welcome.uikitml -> welcome.json
[compile-uikitml] ✅ Compiled: settings.uikitml -> settings.json
[compile-uikitml] ✅ Compiled: health.uikitml -> health.json

🎨 UIKitML Compilation Summary:
  - public/ui/welcome.json
  - public/ui/settings.json
  - public/ui/hud/health.json

📊 Total: 3 compiled, 0 failed
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  compileUIKit,
  type CompileUIKitOptions,
} from '@iwsdk/vite-plugin-uikitml';
```

## License

MIT © Meta Platforms, Inc.
