# MapDrawer

A drawing utility for MapLibre GL that allows users to draw on maps.

## Installation

Since this package is not published to npm, you can use it locally:

```bash
npm install ./
```

Or reference it from a parent directory:

```json
"dependencies": {
  "mapdrawer": "file:../path/to/mapdrawer"
}
```

## Usage

```typescript
import DrawTools from 'mapdrawer';

const map = new maplibregl.Map({...});
const tools = new DrawTools(map);
```

The CSS styles are automatically injected into the document when the module is imported, so no additional CSS imports are needed.

## Development

Build the package:
```bash
npm run build
```

This bundles TypeScript and CSS into a single `dist/index.js` file with type definitions. The CSS is automatically injected into the DOM when the module loads.

## Distribution

The package includes:
- **dist/index.js** — Compiled JavaScript with CSS bundled inline
- **dist/index.d.ts** — TypeScript type definitions
- **dist/index.js.map** — Source map for debugging

## License

ISC
