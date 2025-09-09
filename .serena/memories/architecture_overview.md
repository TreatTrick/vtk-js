# vtk.js Architecture Overview

## Directory Structure
```
Sources/
├── Common/Core/        # Core data structures (DataArray, Math, LookupTable)
├── Common/DataModel/   # Data representations (PolyData, ImageData, Cell types)
├── Filters/           # Data processing algorithms
├── IO/                # File readers/writers (STL, OBJ, VTK formats)
├── Rendering/Core/    # Rendering pipeline (Actor, Mapper, Renderer, Camera)
├── Rendering/OpenGL/  # WebGL implementation
├── Rendering/WebGPU/  # WebGPU implementation
├── Rendering/SceneGraph/ # Scene graph and render passes
├── Widgets/           # Interactive 3D widgets
└── Proxy/             # State management via proxy pattern
```

## Core Concepts
1. **VTK Pipeline**: Data flows through sources → filters → mappers → actors → renderer
2. **Macro System**: Classes created using vtk.js macros for consistency
3. **Data Types**:
   - `vtkPolyData` - Geometric data (points, lines, polygons)
   - `vtkImageData` - Regular grid volumetric data
   - `vtkDataArray` - Typed arrays for attribute data
4. **Rendering**:
   - `vtkRenderer` manages the scene
   - `vtkRenderWindow` provides WebGL/WebGPU context
   - `vtkActor` + `vtkMapper` display data

## Rendering Pipeline
The rendering system uses a forward rendering approach with multiple passes for different types of geometry and volumes.