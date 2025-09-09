# vtk.js Development Commands

## Development Commands
```bash
npm install              # Install dependencies
npm run dev:esm         # Watch mode for ESM build
npm run dev:umd         # Watch mode for UMD build
npm run build           # Full production build (lint + ESM + UMD)
```

## Code Quality Commands (MUST RUN BEFORE TASK COMPLETION)
```bash
npm run lint            # Check ESLint rules
npm run lint-fix        # Auto-fix ESLint issues  
npm run typecheck       # TypeScript type checking
npm run validate        # Check Prettier formatting
npm run reformat        # Auto-format with Prettier
```

## Testing Commands
```bash
npm run test:headless   # Run tests in headless Chrome (CI mode)
npm run test:debug      # Run tests with debug logging
npm run test:firefox    # Run tests in Firefox
npm run test:webgpu     # Run tests with WebGPU support
```

## Documentation Commands
```bash
npm run doc             # Generate documentation
npm run example         # Run example server
npm run example:webgpu  # Run examples with WebGPU
```

## Git Commands
```bash
npm run commit          # Create conventional commit with Commitizen
```