# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vtk.js is a JavaScript implementation of the Visualization Toolkit (VTK) for web-based 3D graphics, volume rendering, and scientific visualization. It's a complete rewrite of VTK in ES6 JavaScript (not a port), focusing on WebGL/WebGPU rendering for both geometry (PolyData) and volume (ImageData) data.

## Key Commands

### Development
```bash
npm install              # Install dependencies
npm run dev:esm         # Watch mode for ESM build
npm run dev:umd         # Watch mode for UMD build
npm run build           # Full production build (lint + ESM + UMD)
```

### Code Quality - MUST RUN BEFORE TASK COMPLETION
```bash
npm run lint            # Check ESLint rules
npm run lint-fix        # Auto-fix ESLint issues
npm run typecheck       # TypeScript type checking
npm run validate        # Check Prettier formatting
npm run reformat        # Auto-format with Prettier
```

### Testing
```bash
npm run test:headless   # Run tests in headless Chrome (CI mode)
npm run test:debug      # Run tests with debug logging
npm run test:firefox    # Run tests in Firefox
npm run test:webgpu     # Run tests with WebGPU support
```

### Documentation & Examples
```bash
npm run doc             # Generate documentation
npm run example         # Run example server
npm run example:webgpu  # Run examples with WebGPU
```

### Git Workflow
```bash
npm run commit          # Create conventional commit with Commitizen
```

## Architecture

### Directory Structure
- `Sources/` - Main source code
  - `Common/Core/` - Core data structures (DataArray, Math, LookupTable)
  - `Common/DataModel/` - Data representations (PolyData, ImageData, Cell types)
  - `Filters/` - Data processing algorithms
  - `IO/` - File readers/writers (STL, OBJ, VTK formats)
  - `Rendering/Core/` - Rendering pipeline (Actor, Mapper, Renderer, Camera)
  - `Rendering/OpenGL/` - WebGL implementation
  - `Rendering/WebGPU/` - WebGPU implementation
  - `Widgets/` - Interactive 3D widgets
  - `Proxy/` - State management via proxy pattern
- `Examples/` - Demo applications and usage examples
- `dist/` - Built distribution files (ESM and UMD)

### Core Concepts

1. **VTK Pipeline**: Data flows through a pipeline of sources → filters → mappers → actors → renderer
2. **Macro System**: Classes are created using vtk.js macros (`vtkNewMacro`, `vtkGetMacro`, `vtkSetMacro`)
3. **Data Types**: 
   - `vtkPolyData` - Geometric data (points, lines, polygons)
   - `vtkImageData` - Regular grid volumetric data
   - `vtkDataArray` - Typed arrays for attribute data
4. **Rendering**: 
   - `vtkRenderer` manages the scene
   - `vtkRenderWindow` provides the WebGL/WebGPU context
   - `vtkActor` + `vtkMapper` display data

### Code Style

- **Style Guide**: Airbnb JavaScript with modifications
- **Formatting**: Prettier with single quotes, trailing commas, 80-char lines
- **Indentation**: 2 spaces
- **Naming**: VTK conventions (e.g., `vtkActor`, `getSomething`, `setSomething`)
- **Tests**: Use Tape framework, located in `test/` subdirectories
- **Types**: Provide TypeScript definitions in `.d.ts` files

### Development Workflow

1. Make changes in `Sources/`
2. Run `npm run reformat` to fix formatting
3. Run `npm run lint-fix` to fix auto-fixable issues  
4. Run `npm run lint` to check for remaining issues
5. Run `npm run typecheck` if TypeScript definitions were modified
6. Run `npm run test:headless` to verify tests pass
7. Use `npm run commit` for conventional commits

### Testing Approach

- Unit tests use Tape framework
- Test files in `Sources/*/test/test*.js`
- Run specific tests by modifying `Sources/Testing/index.js`
- Tests import using `vtk.js/Sources/` paths
- Use `npm run test:headless` for CI-appropriate testing

### Common Patterns

```javascript
// Creating a VTK class
import macro from 'vtk.js/Sources/macros';

function vtkMyClass(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMyClass');
  
  // Method implementation
  publicAPI.myMethod = () => {
    // Implementation
  };
}

// Object factory
export function newInstance(initialValues) {
  return macro.newInstance(vtkMyClass, initialValues);
}

// Default values
export default { newInstance };
```

### Important Notes

- This is a JavaScript rewrite, not a direct port of VTK C++
- Not all VTK filters are implemented - focus is on web rendering
- WebAssembly integration available for specific VTK C++ components
- Examples demonstrate best practices and usage patterns