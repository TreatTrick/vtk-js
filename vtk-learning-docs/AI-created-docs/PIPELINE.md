# VTK.js Data Flow & Pipeline Architecture

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [Pipeline Components](#pipeline-components)
4. [Data Flow Mechanics](#data-flow-mechanics)
5. [Data Types & Structures](#data-types--structures)
6. [Rendering Pipeline](#rendering-pipeline)
7. [Examples](#examples)
8. [Best Practices & Performance](#best-practices--performance)

## Overview

VTK.js implements a **data flow pipeline architecture** that provides a structured way to process and visualize scientific data. The pipeline is based on the producer-consumer pattern where data flows from **sources** through **filters** to **mappers** and finally to **actors** for rendering.

### Key Concepts

- **Lazy Evaluation**: Data is only processed when needed (on demand)
- **Modified Time (MTime)**: Tracks when objects change to determine if updates are needed
- **Connection-based**: Objects connect via input/output ports rather than direct data passing
- **Streaming**: Supports processing of large datasets by breaking them into pieces

### Basic Pipeline Flow

```
[Data Source] → [Filters...] → [Mapper] → [Actor] → [Renderer] → [RenderWindow]
     ↑              ↑           ↑         ↑         ↑           ↑
  Generates       Process     Convert   Represent  Manage     Display
    Data          Data      to Graphics Scene Obj  Scene      Scene
```

## Core Architecture

The VTK.js pipeline is built on several key base classes that provide the foundation for all pipeline objects:

### Class Hierarchy

```
vtkObject (base for all VTK objects)
├── vtkDataSet (base for all data representations)
│   ├── vtkPolyData (meshes, surfaces)
│   ├── vtkImageData (regular grids, volumes)
│   └── vtkPointSet (irregular point collections)
├── vtkAlgorithm (base for all pipeline objects)
│   ├── vtkSource (data generators)
│   ├── vtkFilter (data processors)
│   └── vtkReader (file importers)
└── vtkProp (base for renderable objects)
    ├── vtkActor (3D objects)
    └── vtkActor2D (2D overlays)
```

### The `algo` Macro

The heart of the pipeline is the `algo` macro defined in `Sources/macros.js`. This macro adds pipeline functionality to any class:

```javascript
// From Sources/macros.js
export function algo(publicAPI, model, numberOfInputs, numberOfOutputs) {
  // Sets up input/output port management
  // Provides setInputData(), setInputConnection()
  // Provides getOutputData(), getOutputPort()
  // Implements update mechanism
}

// Usage in a filter
macro.algo(publicAPI, model, 1, 1); // 1 input, 1 output
```

## Pipeline Components

### 1. Data Sources (`vtkSource`)

Sources generate data from scratch or read it from external sources. They have **zero inputs** and **one or more outputs**.

#### Example: SphereSource

```javascript
// Sources/Filters/Sources/SphereSource/index.js
function vtkSphereSource(publicAPI, model) {
  model.classHierarchy.push('vtkSphereSource');
  
  publicAPI.requestData = (inData, outData) => {
    // Generate sphere geometry
    const dataset = vtkPolyData.newInstance();
    
    // Create points, normals, and cells
    const points = generateSpherePoints();
    const normals = generateSphereNormals();
    const polys = generateSphereCells();
    
    dataset.getPoints().setData(points);
    dataset.getPointData().setNormals(normals);
    dataset.getPolys().setData(polys);
    
    outData[0] = dataset;
  };
}

// Setup as algorithm with 0 inputs, 1 output
macro.algo(publicAPI, model, 0, 1);
```

#### Common Sources

- **SphereSource**: Generates sphere geometry
- **ConeSource**: Generates cone geometry  
- **PlaneSource**: Generates plane geometry
- **STLReader**: Reads STL files
- **OBJReader**: Reads OBJ files

### 2. Data Objects (`vtkDataSet`)

Data objects represent the actual data flowing through the pipeline. They store geometry, topology, and attribute data.

#### Base Class: vtkDataSet

```javascript
// Sources/Common/DataModel/DataSet/index.js
function vtkDataSet(publicAPI, model) {
  model.classHierarchy.push('vtkDataSet');
  
  // Add dataset attributes for different data types
  const DATASET_FIELDS = ['pointData', 'cellData', 'fieldData'];
  
  DATASET_FIELDS.forEach((fieldName) => {
    if (!model[fieldName]) {
      model[fieldName] = vtkDataSetAttributes.newInstance();
    }
  });
}
```

#### Key Data Types

- **vtkPolyData**: Meshes, surfaces (points, lines, polygons)
- **vtkImageData**: Regular grids, volumes (3D arrays)
- **vtkPointSet**: Irregular point collections

### 3. Filters (`vtkFilter`)

Filters process data, transforming input datasets into output datasets. They have **one or more inputs** and **one or more outputs**.

#### Example: Calculator Filter

```javascript
// Sources/Filters/General/Calculator/index.js
function vtkCalculator(publicAPI, model) {
  model.classHierarchy.push('vtkCalculator');
  
  publicAPI.requestData = (inData, outData) => {
    if (!model.formula) {
      return 0; // No processing needed
    }
    
    // Get array specifications from formula
    const arraySpec = model.formula.getArrays(inData);
    
    // Create output dataset (shallow copy of input)
    const newDataSet = vtk({ vtkClass: inData[0].getClassName() });
    newDataSet.shallowCopy(inData[0]);
    outData[0] = newDataSet;
    
    // Prepare input/output arrays
    const arrays = publicAPI.prepareArrays(arraySpec, inData[0], outData[0]);
    
    // Execute formula on arrays
    model.formula.evaluate(arrays.arraysIn, arrays.arraysOut);
    
    return 1; // Success
  };
}

// Setup as algorithm with 1 input, 1 output
macro.algo(publicAPI, model, 1, 1);
```

#### Common Filters

- **Calculator**: Performs mathematical operations on data arrays
- **ContourFilter**: Generates isosurfaces
- **ClipFilter**: Clips data with planes or implicit functions
- **TransformFilter**: Applies geometric transformations

### 4. Mappers (`vtkMapper`)

Mappers convert data into graphics primitives for rendering. They bridge the gap between **data processing** and **visualization**.

```javascript
// Sources/Rendering/Core/Mapper/index.js
function vtkMapper(publicAPI, model) {
  model.classHierarchy.push('vtkMapper');
  
  // Mappers are algorithms with inputs but no pipeline outputs
  // (they produce graphics primitives, not data objects)
}

// Common mapper types:
// - vtkPolyDataMapper: Renders polygonal data
// - vtkVolumeMapper: Renders volumetric data  
// - vtkImageMapper: Renders 2D images
```

### 5. Actors (`vtkActor`)

Actors represent objects in the 3D scene. They combine **geometry** (from mappers) with **appearance** (properties).

```javascript
// Sources/Rendering/Core/Actor/index.js
function vtkActor(publicAPI, model) {
  model.classHierarchy.push('vtkActor');
  
  publicAPI.getIsOpaque = () => {
    // Check property opacity
    let isOpaque = model.properties[0].getOpacity() >= 1.0;
    
    // Check texture opacity
    isOpaque = isOpaque && (!model.texture || !model.texture.isTranslucent());
    
    // Check mapper opacity
    isOpaque = isOpaque && (!model.mapper || model.mapper.getIsOpaque());
    
    return isOpaque;
  };
}
```

### 6. Renderers (`vtkRenderer`)

Renderers manage collections of actors and handle the rendering process.

```javascript
// Sources/Rendering/Core/Renderer/index.js
function vtkRenderer(publicAPI, model) {
  model.classHierarchy.push('vtkRenderer');
  
  publicAPI.updateCamera = () => {
    if (!model.activeCamera) {
      // Auto-create camera if none exists
      publicAPI.getActiveCameraAndResetIfCreated();
    }
    
    // Update viewing transformation
    model.activeCamera.render(publicAPI);
    
    return true;
  };
}
```

## Data Flow Mechanics

### The Update Mechanism

The pipeline uses a **lazy evaluation** strategy where data is only computed when needed. This is implemented through three key methods:

1. **`shouldUpdate()`**: Checks if processing is needed
2. **`update()`**: Triggers the update process
3. **`requestData()`**: Does the actual work

```javascript
// From Sources/macros.js - algo macro
publicAPI.shouldUpdate = () => {
  const localMTime = publicAPI.getMTime();
  let minOutputMTime = Infinity;
  
  // Check if outputs are invalid
  let count = numberOfOutputs;
  while (count--) {
    if (!model.output[count] || model.output[count].isDeleted()) {
      return true; // Need to update
    }
    const mt = model.output[count].getMTime();
    if (mt < localMTime) {
      return true; // Output older than this object
    }
    if (mt < minOutputMTime) {
      minOutputMTime = mt;
    }
  }
  
  // Check if inputs are newer than outputs
  count = model.numberOfInputs;
  while (count--) {
    if (model.inputConnection[count]?.filter.shouldUpdate() ||
        publicAPI.getInputData(count)?.getMTime() > minOutputMTime) {
      return true; // Input newer than output
    }
  }
  
  return false; // No update needed
};

publicAPI.update = () => {
  const ins = [];
  if (model.numberOfInputs) {
    let count = 0;
    while (count < model.numberOfInputs) {
      ins[count] = publicAPI.getInputData(count);
      count++;
    }
  }
  
  if (publicAPI.requestData && 
      !publicAPI.isDeleted() && 
      publicAPI.shouldUpdate()) {
    publicAPI.requestData(ins, model.output);
  }
};
```

### Modified Time (MTime) System

Every VTK object has a **modified time** that tracks when it was last changed. This enables efficient pipeline updates.

```javascript
// From Sources/macros.js
let globalMTime = 0;

export function obj(publicAPI, model) {
  model.mtime = ++globalMTime;
  
  publicAPI.getMTime = () => model.mtime;
  
  publicAPI.modified = (otherMTime) => {
    if (otherMTime && otherMTime < model.mtime) {
      return;
    }
    model.mtime = otherMTime || ++globalMTime;
  };
}
```

### Input/Output Connections

Pipeline objects connect through **output ports** and **input connections**:

```javascript
// Setting up a pipeline
const sphere = vtkSphereSource.newInstance();
const mapper = vtkPolyDataMapper.newInstance();
const actor = vtkActor.newInstance();

// Connect components
mapper.setInputConnection(sphere.getOutputPort());  // Data connection
actor.setMapper(mapper);                            // Rendering connection

// When data is requested:
const polydata = mapper.getInputData(); // Triggers sphere.update() if needed
```

## Data Types & Structures

### vtkPolyData

Represents polygonal data (meshes, surfaces) with four basic cell types:

```javascript
// Structure of vtkPolyData
{
  points: vtkPoints,           // 3D coordinates
  verts: vtkCellArray,         // Vertex cells
  lines: vtkCellArray,         // Line cells  
  polys: vtkCellArray,         // Polygon cells
  strips: vtkCellArray,        // Triangle strips
  pointData: {                 // Attributes per point
    scalars: vtkDataArray,
    vectors: vtkDataArray,
    normals: vtkDataArray,
    // ... other arrays
  },
  cellData: {                  // Attributes per cell
    scalars: vtkDataArray,
    // ... other arrays
  }
}
```

### vtkImageData

Represents regular grids and volumetric data:

```javascript
// Structure of vtkImageData
{
  dimensions: [nx, ny, nz],    // Grid dimensions
  spacing: [dx, dy, dz],       // Physical spacing
  origin: [x0, y0, z0],        // Physical origin
  pointData: {                 // Data at grid points
    scalars: vtkDataArray,     // Primary data array
    // ... other arrays
  }
}
```

### vtkDataArray

Represents typed arrays of data:

```javascript
const array = vtkDataArray.newInstance({
  name: 'Temperature',
  numberOfComponents: 1,       // Scalar=1, Vector=3, etc.
  values: new Float32Array(data),
  size: data.length
});
```

## Rendering Pipeline

The rendering pipeline converts processed data into visible graphics:

```
[Data Pipeline] → [Mapper] → [Actor] → [Renderer] → [RenderWindow]
                     ↓          ↓         ↓           ↓
                  Graphics   Scene Obj  Rendering   Display
                Primitives  Properties  Management  Context
```

### Rendering Process

1. **Data to Graphics**: Mappers convert data objects to graphics primitives
2. **Scene Assembly**: Actors combine geometry with visual properties  
3. **Rendering**: Renderers process all actors in the scene
4. **Display**: RenderWindow manages the graphics context and display

### WebGL/WebGPU Backend

VTK.js supports both WebGL and WebGPU rendering backends:

```javascript
// WebGL backend (default)
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';

// WebGPU backend (experimental)
import vtkWebGPURenderWindow from 'vtk.js/Sources/Rendering/WebGPU/RenderWindow';

const renderWindow = vtkOpenGLRenderWindow.newInstance();
```

## Examples

### Basic Pipeline Setup

```javascript
import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource';
import vtkPolyDataMapper from 'vtk.js/Sources/Rendering/Core/PolyDataMapper';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';

// Create pipeline components
const sphereSource = vtkSphereSource.newInstance({ 
  radius: 1.0,
  thetaResolution: 20,
  phiResolution: 20
});

const mapper = vtkPolyDataMapper.newInstance();
const actor = vtkActor.newInstance();
const renderer = vtkRenderer.newInstance();
const renderWindow = vtkRenderWindow.newInstance();
const interactor = vtkRenderWindowInteractor.newInstance();

// Connect the pipeline
mapper.setInputConnection(sphereSource.getOutputPort());
actor.setMapper(mapper);
renderer.addActor(actor);
renderWindow.addRenderer(renderer);
interactor.setRenderWindow(renderWindow);

// Initialize and render
interactor.initialize();
interactor.bindEvents(document.querySelector('#container'));
interactor.start();
```

### Complex Pipeline with Filters

```javascript
import vtkConeSource from 'vtk.js/Sources/Filters/Sources/ConeSource';
import vtkElevationFilter from 'vtk.js/Sources/Filters/General/ElevationFilter';
import vtkWarpScalar from 'vtk.js/Sources/Filters/General/WarpScalar';

// Create a cone
const coneSource = vtkConeSource.newInstance({
  height: 1.0,
  radius: 0.5,
  resolution: 20
});

// Add elevation data based on height
const elevationFilter = vtkElevationFilter.newInstance({
  lowPoint: [0, -0.5, 0],
  highPoint: [0, 0.5, 0]
});

// Warp the geometry using scalar values
const warpScalar = vtkWarpScalar.newInstance({
  scaleFactor: 0.2
});

// Connect the filters
elevationFilter.setInputConnection(coneSource.getOutputPort());
warpScalar.setInputConnection(elevationFilter.getOutputPort());

// Connect to mapper
const mapper = vtkPolyDataMapper.newInstance();
mapper.setInputConnection(warpScalar.getOutputPort());
```

### Reading and Rendering Data

```javascript
import vtkSTLReader from 'vtk.js/Sources/IO/Geometry/STLReader';
import vtkTriangleFilter from 'vtk.js/Sources/Filters/General/TriangleFilter';

// Create reader
const reader = vtkSTLReader.newInstance();

// Optional: ensure all polygons are triangles
const triangleFilter = vtkTriangleFilter.newInstance();
triangleFilter.setInputConnection(reader.getOutputPort());

// Connect to rendering
const mapper = vtkPolyDataMapper.newInstance();
mapper.setInputConnection(triangleFilter.getOutputPort());

// Load and render data
reader.setUrl('path/to/model.stl').then(() => {
  reader.loadData().then(() => {
    // Data is now available in the pipeline
    renderWindow.render();
  });
});
```

### Custom Filter Implementation

```javascript
import macro from 'vtk.js/Sources/macros';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';

function vtkMyCustomFilter(publicAPI, model) {
  model.classHierarchy.push('vtkMyCustomFilter');
  
  // Custom parameters
  publicAPI.setScaleFactor = (factor) => {
    if (model.scaleFactor !== factor) {
      model.scaleFactor = factor;
      publicAPI.modified(); // Mark as modified
    }
  };
  
  // Main processing function
  publicAPI.requestData = (inData, outData) => {
    // Get input data
    const input = inData[0];
    if (!input) {
      return 0;
    }
    
    // Create output data (copy structure from input)
    const output = vtkPolyData.newInstance();
    output.shallowCopy(input);
    
    // Process points
    const inputPoints = input.getPoints().getData();
    const outputPoints = new Float32Array(inputPoints.length);
    
    for (let i = 0; i < inputPoints.length; i += 3) {
      outputPoints[i] = inputPoints[i] * model.scaleFactor;     // x
      outputPoints[i + 1] = inputPoints[i + 1] * model.scaleFactor; // y
      outputPoints[i + 2] = inputPoints[i + 2] * model.scaleFactor; // z
    }
    
    // Set modified points
    output.getPoints().setData(outputPoints);
    
    // Set output
    outData[0] = output;
    
    return 1; // Success
  };
}

// Object factory
const DEFAULT_VALUES = {
  scaleFactor: 1.0,
};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  
  macro.obj(publicAPI, model);
  macro.algo(publicAPI, model, 1, 1); // 1 input, 1 output
  macro.setGet(publicAPI, model, ['scaleFactor']);
  
  vtkMyCustomFilter(publicAPI, model);
}

export const newInstance = macro.newInstance(extend, 'vtkMyCustomFilter');
export default { newInstance, extend };
```

## Best Practices & Performance

### Pipeline Optimization

1. **Minimize Updates**: Only call `modified()` when objects actually change
2. **Shallow Copy**: Use `shallowCopy()` when possible to avoid data duplication
3. **Connection Reuse**: Reuse pipeline connections rather than recreating them
4. **Appropriate Data Types**: Use the smallest data type that meets precision requirements

```javascript
// Good: Conditional modification
if (model.radius !== newRadius) {
  model.radius = newRadius;
  publicAPI.modified();
}

// Bad: Always calling modified
model.radius = newRadius;
publicAPI.modified();
```

### Memory Management

1. **Delete Unused Objects**: Call `delete()` on objects no longer needed
2. **Avoid Circular References**: Be careful with event listeners and callbacks
3. **Use TypedArrays**: Prefer TypedArrays over regular arrays for large datasets

```javascript
// Clean up pipeline
actor.delete();
mapper.delete();
source.delete();
```

### Common Patterns

#### Producer-Consumer Pattern

```javascript
// Producer
const source = vtkSphereSource.newInstance();

// Consumer
const mapper = vtkPolyDataMapper.newInstance();
mapper.setInputConnection(source.getOutputPort());

// Data flows automatically when needed
const data = mapper.getInputData(); // Triggers source.update() if needed
```

#### Observer Pattern

```javascript
// Listen for data changes
source.onModified(() => {
  console.log('Source data changed');
  renderWindow.render(); // Re-render when data changes
});
```

#### Factory Pattern

```javascript
// Create objects using factory functions
const source = vtkSphereSource.newInstance({
  radius: 2.0,
  thetaResolution: 32
});

// Rather than manual construction
```

### Performance Tips

1. **Batch Operations**: Group multiple changes together before calling `modified()`
2. **Use Appropriate Resolutions**: Balance quality vs. performance for geometric sources
3. **Level of Detail**: Use different resolutions based on viewing distance
4. **Frustum Culling**: Let the renderer cull objects outside the view
5. **WebGL Optimization**: Minimize state changes in WebGL backend

```javascript
// Batch modifications
source.set({
  radius: 2.0,
  thetaResolution: 32,
  phiResolution: 16
}); // Single modification event

// Rather than individual calls
source.setRadius(2.0);           // Modified
source.setThetaResolution(32);   // Modified  
source.setPhiResolution(16);     // Modified
```

## Conclusion

The VTK.js pipeline provides a powerful and flexible architecture for scientific data processing and visualization. By understanding the core concepts of **data flow**, **lazy evaluation**, and **component connections**, developers can build efficient and scalable visualization applications.

Key takeaways:

- **Pipeline objects** communicate through input/output ports
- **Modified time** tracking enables efficient updates
- **Shallow copying** and **lazy evaluation** optimize performance  
- **Modular design** allows flexible pipeline configurations
- **WebGL/WebGPU backends** provide high-performance rendering

For more detailed information, refer to the source code in the `Sources/` directory and the official VTK.js examples.