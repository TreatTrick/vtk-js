# vtk.js Code Style and Conventions

## Code Style Guide
- **Style Guide**: Airbnb JavaScript with modifications
- **Formatting**: Prettier with single quotes, trailing commas, 80-char lines
- **Indentation**: 2 spaces
- **Naming**: VTK conventions (e.g., `vtkActor`, `getSomething`, `setSomething`)

## VTK Macro System
Classes are created using vtk.js macros:
- `vtkNewMacro` - creates new instances
- `vtkGetMacro` - creates getter methods
- `vtkSetMacro` - creates setter methods

## Common Pattern Example
```javascript
import macro from 'vtk.js/Sources/macros';

function vtkMyClass(publicAPI, model) {
  model.classHierarchy.push('vtkMyClass');
  
  publicAPI.myMethod = () => {
    // Implementation
  };
}

export function newInstance(initialValues) {
  return macro.newInstance(vtkMyClass, initialValues);
}

export default { newInstance };
```

## File Structure
- Tests: Use Tape framework, located in `test/` subdirectories
- TypeScript: Provide definitions in `.d.ts` files
- Imports: Use `vtk.js/Sources/` paths