# Task Completion Checklist for vtk.js

When completing any coding task, MUST run these commands in order:

1. **Format Code**
   ```bash
   npm run reformat        # Auto-format with Prettier
   ```

2. **Fix Linting Issues**
   ```bash
   npm run lint-fix        # Auto-fix ESLint issues
   npm run lint            # Check for remaining issues
   ```

3. **Type Check (if TypeScript files modified)**
   ```bash
   npm run typecheck       # TypeScript type checking
   ```

4. **Run Tests**
   ```bash
   npm run test:headless   # Verify tests pass
   ```

## Development Workflow
1. Make changes in `Sources/`
2. Run formatting and linting commands above
3. Run tests to verify changes
4. Use `npm run commit` for conventional commits

## Important Notes
- NEVER commit without running the code quality commands
- Always test changes with `npm run test:headless`
- Follow VTK naming conventions and macro patterns