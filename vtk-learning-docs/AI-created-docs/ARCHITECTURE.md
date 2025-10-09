# vtk.js Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Framework Architecture](#framework-architecture)
3. [Module Organization](#module-organization)
4. [Core Systems](#core-systems)
5. [Data Flow & Pipeline](#data-flow--pipeline)
6. [Class System & Object Model](#class-system--object-model)
7. [Rendering Architecture](#rendering-architecture)
8. [Widget System](#widget-system)
9. [IO System](#io-system)
10. [Build System & Configuration](#build-system--configuration)
11. [Extension Points](#extension-points)
12. [Design Patterns](#design-patterns)
13. [Performance Considerations](#performance-considerations)

## Overview

vtk.js is a JavaScript implementation of the Visualization Toolkit (VTK) for web-based 3D graphics, volume rendering, and scientific visualization. It's a complete rewrite of VTK in ES6 JavaScript (not a port), focusing on WebGL/WebGPU rendering for both geometry (PolyData) and volume (ImageData) data.

### Key Design Principles
- **Web-First Architecture**: Built specifically for web browsers with WebGL/WebGPU support
- **Modern JavaScript**: ES6+ modules with clean import/export patterns
- **TypeScript Support**: Comprehensive TypeScript definitions
- **Modular Design**: Tree-shakeable modules for optimal bundling
- **Performance-Oriented**: Efficient rendering pipeline optimized for web constraints
- **Extensible**: Plugin architecture for custom filters, widgets, and renderers

### Core Technologies
- **Rendering**: WebGL 1.0/2.0 and WebGPU for GPU-accelerated graphics
- **Mathematics**: gl-matrix for high-performance linear algebra
- **Data Structures**: Typed arrays for efficient memory usage
- **Build System**: Webpack/Rollup for module bundling
- **Testing**: Tape framework for unit tests

## Framework Architecture

vtk.js follows a modular, pipeline-based architecture where data flows through a series of processing stages:

```
Data Source → Filters → Mappers → Actors → Renderer → RenderWindow
     ↓           ↓         ↓        ↓         ↓           ↓
  Generate → Process → Convert → Display → Compose → Present
```

### High-Level Component Layers

1. **Application Layer**: User applications and examples
2. **Widget Layer**: Interactive 3D widgets and UI components
3. **Rendering Layer**: Scene management, actors, cameras, lights
4. **Processing Layer**: Filters and algorithms for data transformation
5. **Data Layer**: Core data structures (PolyData, ImageData)
6. **Foundation Layer**: Math utilities, macros, type systems

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Examples   │  │    Apps     │  │  User Code  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Widget Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 3D Widgets  │  │Manipulators │  │Interaction  │         │
│  │   Manager   │  │             │  │   Styles    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Rendering Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Renderer  │  │    Actor    │  │   Mapper    │         │
│  │   Camera    │  │   Light     │  │  Texture    │         │
│  │RenderWindow │  │  Property   │  │  Shader     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Processing Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Filters   │  │   Sources   │  │    I/O      │         │
│  │ (Transform) │  │ (Generate)  │  │ (Read/Write)│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  PolyData   │  │ ImageData   │  │  DataArray  │         │
│  │   Points    │  │    Cells    │  │LookupTable  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Foundation Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Math     │  │   Macros    │  │   Types     │         │
│  │  Utilities  │  │   System    │  │ & Constants │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Module Organization

The vtk.js codebase is organized into logical modules under the `Sources/` directory:

### Sources/ Directory Structure

```
Sources/
├── Common/               # Core data structures and utilities
│   ├── Core/            # Fundamental classes (DataArray, Math, etc.)
│   ├── DataModel/       # Data representations (PolyData, ImageData)
│   ├── System/          # System utilities (TimerLog, MobileVR)
│   └── Transform/       # Coordinate transformations
├── Filters/             # Data processing algorithms
│   ├── Core/           # Core filtering operations
│   ├── General/        # General-purpose filters
│   ├── Sources/        # Data generation filters
│   ├── Texture/        # Texture mapping filters
│   └── Cornerstone/    # Medical imaging integration
├── Rendering/          # Rendering pipeline implementation
│   ├── Core/           # Abstract rendering classes
│   ├── OpenGL/         # WebGL implementation
│   ├── WebGPU/         # WebGPU implementation
│   ├── Misc/           # Utility renderers
│   ├── Profiles/       # Rendering profiles
│   ├── SceneGraph/     # Scene graph management
│   └── WebXR/          # WebXR/VR support
├── IO/                 # Input/Output operations
│   ├── Core/           # Core I/O infrastructure
│   ├── Geometry/       # Geometry file readers/writers
│   ├── Image/          # Image file readers
│   ├── Legacy/         # Legacy VTK format support
│   ├── Misc/           # Miscellaneous readers
│   └── XML/            # XML-based VTK formats
├── Widgets/            # Interactive 3D widgets
│   ├── Core/           # Widget infrastructure
│   ├── Manipulators/   # User interaction handlers
│   ├── Representations/# Visual widget representations
│   └── Widgets3D/      # Concrete 3D widget implementations
├── Interaction/        # User interaction systems
│   ├── Animations/     # Animation controllers
│   ├── Manipulators/   # Camera and scene manipulators
│   ├── Misc/           # Miscellaneous interaction utilities
│   ├── Style/          # Interaction styles
│   ├── UI/             # User interface components
│   └── Widgets/        # Interaction widget implementations
├── Proxy/              # State management via proxy pattern
│   ├── Animation/      # Animation proxies
│   ├── Core/           # Core proxy classes
│   └── Representations/# Representation proxies
├── Imaging/            # Image processing algorithms
│   ├── Core/           # Core imaging operations
│   └── Hybrid/         # Hybrid imaging algorithms
├── macros.js           # Macro system implementation
├── vtk.js             # Core vtk object and factory registration
├── index.js           # Main entry point
└── interfaces.d.ts    # TypeScript interface definitions
```

### Module Responsibilities

#### Common/ Module
- **Core/**: Fundamental building blocks
  - `DataArray`: Typed array wrapper with VTK semantics
  - `Math`: Mathematical utilities and constants  
  - `LookupTable`: Color mapping tables
  - `Points`: Point coordinate management
  - `CellArray`: Cell connectivity data

- **DataModel/**: Data structure implementations
  - `PolyData`: Polygonal geometry representation
  - `ImageData`: Regular grid volumetric data
  - `DataSet`: Base class for all dataset types
  - `Cell`: Individual cell implementations (Triangle, Line, etc.)

#### Rendering/ Module
- **Core/**: Abstract rendering interfaces
  - `Renderer`: Scene composition and rendering coordination
  - `RenderWindow`: Window management and rendering context
  - `Actor`: Displayable scene objects
  - `Mapper`: Data-to-graphics conversion
  - `Camera`: View transformation and projection

- **OpenGL/**: WebGL-specific implementations
  - Hardware-accelerated rendering using WebGL 1.0/2.0
  - Shader management and compilation
  - Buffer object handling
  - Texture management

- **WebGPU/**: Next-generation graphics API implementation
  - Modern GPU compute and rendering pipeline
  - Advanced shader capabilities
  - Improved performance characteristics

#### Filters/ Module
- **Core/**: Essential filtering operations
  - `Cutter`: Plane-based cutting operations
  - `PolyDataNormals`: Surface normal computation
  - `ThresholdPoints`: Point-based thresholding

- **General/**: Commonly used filters
  - `AppendPolyData`: Combine multiple datasets
  - `Calculator`: Field computation and manipulation
  - `ContourFilter`: Isosurface generation
  - `TransformFilter`: Geometric transformations

- **Sources/**: Data generation
  - Primitive shape generators (Sphere, Cube, Cylinder)
  - Procedural data sources
  - Test data generators

## Core Systems

### Macro System

vtk.js uses a sophisticated macro system to reduce boilerplate code and provide consistent APIs across all classes. The macro system is implemented in `Sources/macros.js`.

#### Key Macro Functions

```javascript
// Object creation and extension
macro.newInstance(extend, className)  // Factory function creator
macro.extend(publicAPI, model, initialValues)  // Class extension

// Property accessors
macro.setGet(publicAPI, model, ['property1', 'property2'])  // Getter/setter pairs
macro.get(publicAPI, model, ['readOnlyProperty'])          // Getter only
macro.set(publicAPI, model, ['writeOnlyProperty'])         // Setter only

// Array property accessors
macro.getArray(publicAPI, model, ['points', 'colors'])     // Array getters
macro.setArray(publicAPI, model, ['points'], 3)            // Array setters with dimension

// Object timestamp management
macro.obj(model.mtime)                                     // Add timestamp management
```

#### Macro Usage Pattern

Every vtk.js class follows this consistent pattern:

```javascript
import macro from 'vtk.js/Sources/macros';

// 1. Implementation function
function vtkMyClass(publicAPI, model) {
  // Set className for introspection
  model.classHierarchy.push('vtkMyClass');
  
  // Add methods to publicAPI
  publicAPI.myMethod = () => {
    // Implementation
  };
}

// 2. Default values
const DEFAULT_VALUES = {
  property1: 'defaultValue',
  property2: 42,
};

// 3. Extension function  
export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  
  // Inherit from parent class
  vtkParentClass.extend(publicAPI, model, initialValues);
  
  // Add macro-generated methods
  macro.setGet(publicAPI, model, ['property1', 'property2']);
  
  // Apply class implementation
  vtkMyClass(publicAPI, model);
}

// 4. Factory function
export const newInstance = macro.newInstance(extend, 'vtkMyClass');

// 5. Default export
export default { newInstance, extend };
```

### Pipeline Architecture

vtk.js implements a dataflow pipeline where data passes through a series of processing stages:

#### Pipeline Components

1. **Sources**: Generate initial data
2. **Filters**: Transform or process data
3. **Mappers**: Convert data to renderable format
4. **Actors**: Represent displayable objects in a scene
5. **Renderer**: Compose and render the scene
6. **RenderWindow**: Manage the rendering context

#### Pipeline Flow

```javascript
// Example pipeline construction
const source = vtkSphereSource.newInstance({ radius: 1.0 });
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();
const renderer = vtkRenderer.newInstance();
const renderWindow = vtkRenderWindow.newInstance();

// Connect pipeline
mapper.setInputConnection(source.getOutputPort());
actor.setMapper(mapper);
renderer.addActor(actor);
renderWindow.addRenderer(renderer);
```

#### Pipeline Execution

The pipeline uses a demand-driven execution model:
- Data flows through the pipeline only when requested
- Each component tracks its modification time (MTime)
- Components re-execute only when inputs have changed
- Automatic dependency tracking prevents unnecessary computation

### Memory Management

vtk.js implements several memory management strategies:

#### Reference Counting
```javascript
// Objects track references to prevent garbage collection
obj.register(this);   // Add reference
obj.unregister(this); // Remove reference
```

#### Modification Time (MTime)
```javascript
// Track when objects change
obj.getMTime();      // Get modification timestamp
obj.modified();      // Mark object as modified
```

#### Shallow Copy Semantics
```javascript
// Efficient data sharing
output.shallowCopy(input);  // Share data arrays
output.deepCopy(input);     // Copy all data
```

## Data Flow & Pipeline

### VTK Pipeline Concepts

The VTK pipeline is built around these key concepts:

#### Executive Pattern
```javascript
class vtkAlgorithm {
  // Pipeline execution entry point
  update() {
    if (this.getMTime() > this.lastExecuteTime) {
      this.requestData();
      this.lastExecuteTime = Date.now();
    }
  }
  
  // Subclasses implement this
  requestData(inData, outData) {
    // Process input data and generate output
  }
}
```

#### Data Objects
```javascript
// All data objects inherit from vtkDataObject
class vtkDataObject {
  getMTime()              // Get modification time
  shallowCopy(other)      // Share data arrays
  deepCopy(other)         // Copy all data
  initialize()            // Reset to empty state
}
```

#### Connection Management
```javascript
// Filters connect via input/output ports
filter1.setInputConnection(source.getOutputPort(0));
filter2.setInputConnection(filter1.getOutputPort(0));
mapper.setInputConnection(filter2.getOutputPort(0));
```

### Data Structures

#### vtkPolyData
Represents polygonal geometry (meshes, point clouds):

```javascript
const polydata = vtkPolyData.newInstance();

// Points (vertices)
const points = vtkPoints.newInstance();
points.setData(Float32Array.from([x1, y1, z1, x2, y2, z2, ...]));
polydata.setPoints(points);

// Cells (connectivity)
const polys = vtkCellArray.newInstance();
polys.setData(Uint32Array.from([3, 0, 1, 2,  3, 1, 2, 3, ...])); // triangles
polydata.setPolys(polys);

// Attributes
const colors = vtkDataArray.newInstance({
  name: 'colors',
  values: Uint8Array.from([r1, g1, b1, r2, g2, b2, ...])
});
polydata.getPointData().setScalars(colors);
```

#### vtkImageData
Represents regular grid volumetric data:

```javascript
const imagedata = vtkImageData.newInstance();

// Grid structure
imagedata.setDimensions([nx, ny, nz]);
imagedata.setOrigin([ox, oy, oz]);
imagedata.setSpacing([dx, dy, dz]);

// Scalar data
const scalars = vtkDataArray.newInstance({
  name: 'scalars',
  values: new Float32Array(nx * ny * nz)
});
imagedata.getPointData().setScalars(scalars);
```

#### vtkDataArray
Efficient typed array wrapper:

```javascript
const array = vtkDataArray.newInstance({
  name: 'coordinates',
  numberOfComponents: 3,    // xyz coordinates
  values: Float32Array      // underlying storage
});

// Tuple-based access
array.setTuple(index, [x, y, z]);
const tuple = array.getTuple(index);

// Component access  
array.setComponent(tupleIndex, componentIndex, value);
const value = array.getComponent(tupleIndex, componentIndex);
```

### Filter Architecture

#### Base Filter Pattern
```javascript
function vtkMyFilter(publicAPI, model) {
  model.classHierarchy.push('vtkMyFilter');
  
  publicAPI.requestData = (inData, outData) => {
    const input = inData[0];
    const output = outData[0];
    
    if (!input) {
      return;
    }
    
    // Process input and generate output
    output.shallowCopy(input);  // Start with input
    
    // Modify output data
    const newPoints = processPoints(input.getPoints());
    output.getPoints().setData(newPoints);
  };
}
```

#### Filter Categories

**Sources** - Generate data from scratch:
```javascript
const sphereSource = vtkSphereSource.newInstance({
  center: [0, 0, 0],
  radius: 1.0,
  phiResolution: 32,
  thetaResolution: 32
});
```

**Transforms** - Modify existing data:
```javascript
const transform = vtkTransformPolyDataFilter.newInstance();
const matrix = vtkMatrixBuilder.buildFromRadian()
  .rotateZ(Math.PI / 4)
  .getMatrix();
transform.getTransform().setMatrix(matrix);
```

**Reducers** - Extract subsets:
```javascript
const threshold = vtkThresholdPoints.newInstance({
  lowerThreshold: 0.5,
  upperThreshold: 1.0
});
```

## Class System & Object Model

### VTK Object Model

vtk.js implements a prototype-based object system with these characteristics:

#### Class Hierarchy
Every object maintains its inheritance chain:
```javascript
model.classHierarchy = ['vtkObject', 'vtkDataObject', 'vtkPolyData'];

// Runtime type checking
obj.isA('vtkPolyData');        // true
obj.isA('vtkDataObject');      // true (parent class)
obj.isA('vtkImageData');       // false
```

#### Public API Pattern
Objects expose functionality through a public API:
```javascript
// Internal model (private)
const model = {
  property1: 'value',
  privateData: [...]
};

// Public API (exposed methods)
const publicAPI = {
  getProperty1: () => model.property1,
  setProperty1: (value) => {
    if (model.property1 !== value) {
      model.property1 = value;
      publicAPI.modified();
    }
  }
};
```

#### Factory Pattern
Consistent object creation across all classes:
```javascript
// Every class provides newInstance factory
const obj = vtkPolyData.newInstance({
  // Optional initial values
  points: existingPoints
});

// Equivalent to:
const model = { points: existingPoints };
const publicAPI = {};
vtkPolyData.extend(publicAPI, model, { points: existingPoints });
```

#### Method Chaining
Many methods return `publicAPI` for fluent interfaces:
```javascript
actor
  .setMapper(mapper)
  .getProperty()
  .setColor(1, 0, 0)
  .setOpacity(0.5);
```

### Type System

#### Runtime Type Information
```javascript
// Class identification
obj.getClassName();           // 'vtkPolyData'
obj.isA('vtkDataObject');    // type checking

// Capability detection
obj.isDeleteable();          // can be deleted
obj.isModified();           // has been modified
```

#### Property Types
Properties use typed accessors:
```javascript
// Scalar properties
macro.setGet(publicAPI, model, ['radius']);  // number
macro.setGet(publicAPI, model, ['name']);    // string
macro.setGet(publicAPI, model, ['visible']); // boolean

// Array properties  
macro.setArray(publicAPI, model, ['center'], 3);     // [x, y, z]
macro.setArray(publicAPI, model, ['color'], 3);      // [r, g, b]
macro.setArray(publicAPI, model, ['bounds'], 6);     // [xmin, xmax, ymin, ymax, zmin, zmax]

// Object references
macro.setGet(publicAPI, model, ['mapper', 'texture', 'transform']);
```

### Serialization System

vtk.js provides JSON serialization for all objects:

#### Serialization
```javascript
// Serialize object to JSON
const state = vtk.serialize(obj);

// Restore object from JSON
const newObj = vtk.deserialize(state);
```

#### State Management
Objects can save/restore their complete state:
```javascript
const state = obj.getState();  // Get complete state
obj.setState(state);          // Restore state
```

## Rendering Architecture

### Rendering Pipeline

The rendering system in vtk.js is built around a flexible pipeline that supports both WebGL and WebGPU backends:

```
Scene Graph → View Transformation → Rendering Backend → Frame Buffer
    ↓              ↓                      ↓                ↓
 Actors +    Camera Matrix        WebGL/WebGPU        Final Image
 Lights      Projection         Implementation
```

### Core Rendering Classes

#### vtkRenderer
Central scene management:
```javascript
const renderer = vtkRenderer.newInstance({
  background: [0.1, 0.2, 0.4],  // Background color
  viewport: [0, 0, 1, 1]        // Normalized viewport
});

// Scene management
renderer.addActor(actor);
renderer.addLight(light);
renderer.setActiveCamera(camera);

// Rendering control
renderer.resetCamera();          // Auto-fit scene
renderer.render();               // Trigger render
```

#### vtkRenderWindow
Rendering context management:
```javascript
const renderWindow = vtkRenderWindow.newInstance();
renderWindow.addRenderer(renderer);

// Canvas integration
const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
openglRenderWindow.setContainer(document.querySelector('#vtkContainer'));
renderWindow.addView(openglRenderWindow);

// Render loop
renderWindow.render();
```

#### vtkActor
Scene object representation:
```javascript
const actor = vtkActor.newInstance();
actor.setMapper(mapper);                    // Data source
actor.getProperty().setColor(1, 0, 0);      // Red color
actor.getProperty().setOpacity(0.8);        // Semi-transparent
actor.setVisibility(true);                  // Visible
actor.setPickable(true);                    // Interactive
```

#### vtkMapper
Data-to-graphics conversion:
```javascript
const mapper = vtkMapper.newInstance();
mapper.setInputConnection(filter.getOutputPort());

// Rendering configuration
mapper.setScalarVisibility(true);           // Color by data
mapper.setScalarModeToUsePointData();       // Point-based coloring
mapper.setLookupTable(lut);                 // Color mapping
```

### WebGL Implementation

Located in `Sources/Rendering/OpenGL/`, the WebGL implementation provides:

#### Shader Management
```javascript
const shader = vtkShaderProgram.newInstance();
shader.setVertexShaderCode(vertexShader);
shader.setFragmentShaderCode(fragmentShader);

// Uniform management
shader.setUniformf('opacity', 0.8);
shader.setUniformMatrix('modelMatrix', modelMatrix);
```

#### Buffer Management
```javascript
const vbo = vtkBufferObject.newInstance();
vbo.setOpenGLRenderWindow(openglRenderWindow);
vbo.upload(vertexData, vtkBufferObject.ObjectType.ARRAY_BUFFER);
vbo.bind();
```

#### Texture Handling
```javascript
const texture = vtkTexture.newInstance();
texture.setOpenGLRenderWindow(openglRenderWindow);
texture.create2DFromRaw(width, height, channels, dataArray);
texture.activate();
```

### WebGPU Implementation

Located in `Sources/Rendering/WebGPU/`, providing next-generation GPU features:

#### Device Management
```javascript
const device = vtkWebGPUDevice.newInstance();
await device.initialize();

const renderWindow = vtkWebGPURenderWindow.newInstance();
renderWindow.setDevice(device);
```

#### Compute Pipeline Support
```javascript
const computePipeline = vtkWebGPUComputePipeline.newInstance();
computePipeline.setComputeShader(computeShaderCode);
computePipeline.setBindGroup(bindGroup);
```

#### Advanced Rendering Features
- Multiple render targets
- Compute shaders for GPU processing
- Advanced texture formats
- Improved memory management

### Volume Rendering

vtk.js supports direct volume rendering for 3D scalar fields:

#### Volume Setup
```javascript
const volume = vtkVolume.newInstance();
const volumeMapper = vtkVolumeMapper.newInstance();
const volumeProperty = vtkVolumeProperty.newInstance();

volumeMapper.setInputData(imageData);
volume.setMapper(volumeMapper);
volume.setProperty(volumeProperty);

// Transfer functions
const colorTF = vtkColorTransferFunction.newInstance();
colorTF.addRGBPoint(0, 0, 0, 0);
colorTF.addRGBPoint(255, 1, 1, 1);

const opacityTF = vtkPiecewiseFunction.newInstance();
opacityTF.addPoint(0, 0.0);
opacityTF.addPoint(128, 0.5);
opacityTF.addPoint(255, 1.0);

volumeProperty.setRGBTransferFunction(colorTF);
volumeProperty.setScalarOpacity(opacityTF);
```

#### Rendering Techniques
- **Ray Casting**: Direct volume ray casting
- **Maximum Intensity Projection (MIP)**: Highlight bright features
- **Composite**: Blend samples along rays
- **Isosurface**: Extract surfaces at constant values

### Multi-Pass Rendering

Support for complex rendering techniques:

#### Order Independent Transparency
```javascript
const oitPass = vtkOrderIndependentTranslucentPass.newInstance();
renderer.addPass(oitPass);
```

#### Screen Space Effects
```javascript
const convolutionPass = vtkConvolution2DPass.newInstance();
convolutionPass.setKernel(blurKernel);
renderer.addPass(convolutionPass);
```

## Widget System

The widget system provides interactive 3D manipulation capabilities:

### Widget Architecture

```
Widget Manager → Widget Factory → Widget Instance → Representations
      ↓               ↓                ↓                ↓
   Orchestrates    Creates        Manages State    Visual Display
   Interactions    Widgets        & Behavior       & Feedback
```

### Core Widget Classes

#### vtkWidgetManager
Central widget orchestration:
```javascript
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// Enable interaction
widgetManager.enablePicking();
widgetManager.setCaptureOn(vtkWidgetManager.CaptureOn.MOUSE_MOVE);

// Widget lifecycle
const widget = widgetManager.addWidget(vtkLineWidget);
widgetManager.removeWidget(widget);
widgetManager.removeWidgets();
```

#### Widget State Management
```javascript
const widget = vtkLineWidget.newInstance();

// State access
const state = widget.getWidgetState();
state.getHandle1().setOrigin([0, 0, 0]);
state.getHandle2().setOrigin([1, 1, 1]);

// State binding
widget.onModified(() => {
  const p1 = state.getHandle1().getOrigin();
  const p2 = state.getHandle2().getOrigin();
  console.log(`Line: ${p1} to ${p2}`);
});
```

### Built-in Widgets

#### Line Widget
Interactive line manipulation:
```javascript
const lineWidget = vtkLineWidget.newInstance();
lineWidget.getWidgetState().getHandle1().setOrigin([0, 0, 0]);
lineWidget.getWidgetState().getHandle2().setOrigin([1, 0, 0]);
```

#### Plane Widget  
Interactive cutting plane:
```javascript
const planeWidget = vtkImplicitPlaneWidget.newInstance();
planeWidget.getWidgetState().setOrigin([0, 0, 0]);
planeWidget.getWidgetState().setNormal([0, 0, 1]);
```

#### Sphere Widget
Interactive sphere manipulation:
```javascript
const sphereWidget = vtkSphereWidget.newInstance();
sphereWidget.getWidgetState().setCenter([0, 0, 0]);
sphereWidget.getWidgetState().setRadius(1.0);
```

#### Spline Widget
Interactive curve editing:
```javascript
const splineWidget = vtkSplineWidget.newInstance();
splineWidget.getWidgetState().clearHandles();
splineWidget.getWidgetState().addHandle([0, 0, 0]);
splineWidget.getWidgetState().addHandle([1, 1, 0]);
splineWidget.getWidgetState().addHandle([2, 0, 0]);
```

### Widget Representations

#### Handle Representations
Visual feedback for manipulation points:
```javascript
const handleRep = vtkSphereHandleRepresentation.newInstance({
  scaleInPixels: true
});
widget.setHandleRepresentation(handleRep);
```

#### Context Representations
Visual feedback for widget bounds:
```javascript
const contextRep = vtkOutlineContextRepresentation.newInstance();
widget.setContextRepresentation(contextRep);
```

### Widget Manipulators

#### Plane Manipulator
Constrain movement to planes:
```javascript
const planeManipulator = vtkPlaneManipulator.newInstance();
planeManipulator.setNormal([0, 0, 1]);  // XY plane
planeManipulator.setOrigin([0, 0, 0]);
```

#### Line Manipulator
Constrain movement to lines:
```javascript
const lineManipulator = vtkLineManipulator.newInstance();
lineManipulator.setDirection([1, 0, 0]);  // X axis
```

#### Trackball Manipulator
Free 3D rotation:
```javascript
const trackballManipulator = vtkTrackballManipulator.newInstance();
trackballManipulator.setCenter([0, 0, 0]);
```

### Custom Widget Development

#### Widget Creation Pattern
```javascript
function vtkMyWidget(publicAPI, model) {
  model.classHierarchy.push('vtkMyWidget');
  
  // Widget state structure
  model.widgetState = vtkStateBuilder.createBuilder()
    .addStateFromMixin({
      labels: ['handle1', 'handle2'],
      mixins: ['origin', 'color', 'scale1'],
      name: 'handles',
      initialValues: {
        scale1: 10,
      },
    })
    .build();
    
  // Behavior implementation
  publicAPI.handleMouseMove = (callData) => {
    // Handle interaction
  };
}
```

## IO System

vtk.js provides comprehensive input/output capabilities for various data formats:

### Reader Architecture

#### Base Reader Pattern
```javascript
function vtkMyReader(publicAPI, model) {
  model.classHierarchy.push('vtkMyReader');
  
  publicAPI.requestData = (inData, outData) => {
    const output = outData[0];
    
    // Parse data from model.url or model.data
    const parsedData = parseMyFormat(model.data);
    
    // Create VTK data object
    output.shallowCopy(convertToVTK(parsedData));
  };
  
  publicAPI.setUrl = (url) => {
    if (model.url !== url) {
      model.url = url;
      model.data = null;  // Clear cached data
      publicAPI.modified();
    }
  };
}
```

### Geometry Readers/Writers

#### STL Format Support
```javascript
const reader = vtkSTLReader.newInstance();
reader.setUrl('/path/to/model.stl');
reader.loadData().then(() => {
  const polydata = reader.getOutputData();
  mapper.setInputData(polydata);
});

// Binary STL writing
const writer = vtkSTLWriter.newInstance();
writer.setInputData(polydata);
writer.setFormat('BINARY');
const stlContent = writer.getOutputData();
```

#### PLY Format Support
```javascript
const reader = vtkPLYReader.newInstance();
reader.setUrl('/path/to/pointcloud.ply');
reader.loadData().then(() => {
  const polydata = reader.getOutputData();
  // Access point clouds with color/normal data
});

const writer = vtkPLYWriter.newInstance();
writer.setInputData(polydata);
writer.setFormat('ASCII');
```

#### GLTF/GLB Support
```javascript
const importer = vtkGLTFImporter.newInstance();
importer.setUrl('/path/to/scene.gltf');
importer.importActors().then((actors) => {
  actors.forEach(actor => renderer.addActor(actor));
});
```

### Volume Data Readers

#### VTK Legacy Format
```javascript
const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
reader.setUrl('/data/volume.vti');
reader.loadData().then(() => {
  const imageData = reader.getOutputData();
  volumeMapper.setInputData(imageData);
});
```

#### TIFF Image Support
```javascript
const reader = vtkTIFFReader.newInstance();
reader.parseAsArrayBuffer(arrayBuffer).then(() => {
  const imageData = reader.getOutputData();
  // Multi-page TIFF support
});
```

#### ITK Integration
```javascript
const reader = vtkITKImageReader.newInstance();
reader.setFileName('volume.nrrd');
reader.loadData().then(() => {
  const imageData = reader.getOutputData();
  // Supports many medical image formats via ITK.js
});
```

### Network Data Loading

#### HTTP Data Set Reader
```javascript
const reader = vtkHttpDataSetReader.newInstance({
  fetchGzip: true,           // Automatic gzip decompression
  fetchJSON: true,           // Parse JSON metadata
});

reader.setUrl('/api/dataset/123');
reader.loadData().then(() => {
  const data = reader.getOutputData();
});
```

#### Progressive Loading
```javascript
const loader = vtkHttpDataSetLODsLoader.newInstance();
loader.setUrl('/data/progressive/');
loader.setLevelOfDetail(2);  // Load appropriate detail level

loader.onReady(() => {
  const data = loader.getOutputData();
  mapper.setInputData(data);
});
```

### Data Set Writers

#### XML VTK Formats
```javascript
// PolyData XML writer
const writer = vtkXMLPolyDataWriter.newInstance();
writer.setInputData(polydata);
writer.setFormat('BINARY');
const xmlContent = writer.write();

// ImageData XML writer  
const writer = vtkXMLImageDataWriter.newInstance();
writer.setInputData(imagedata);
writer.setFormat('ASCII');
const xmlContent = writer.write();
```

#### Custom Serialization
```javascript
const serializer = vtkSerializer.newInstance();
serializer.setDataSet(polydata);
serializer.setFormat('JSON');
const serialized = serializer.serialize();

// Restore from serialized data
const polydata = vtkDeserializer.deserialize(serialized);
```

### WebAssembly Integration

vtk.js can integrate with WebAssembly versions of VTK C++ components:

#### ITK.js Integration
```javascript
import { readImageArrayBuffer } from 'itk/InterfaceTypes';
import { processImage } from 'vtk.js/Sources/IO/Misc/ITKHelper';

const { image } = await readImageArrayBuffer(arrayBuffer, 'image.nii.gz');
const vtkImageData = processImage(image);
```

## Build System & Configuration

### Build Architecture

vtk.js uses a multi-target build system supporting various consumption patterns:

```
Source Code → Build Process → Distribution Targets
     ↓              ↓                    ↓
ES6 Modules → Webpack/Rollup → UMD, ESM, CommonJS
TypeScript → Babel Transform → Browser, Node.js
```

### Build Targets

#### ESM (ES Modules)
```javascript
// Direct ES module imports
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
```

#### UMD (Universal Module Definition)
```html
<!-- Browser script tag -->
<script src="https://unpkg.com/vtk.js"></script>
<script>
  const { vtkActor, vtkMapper } = vtk;
</script>
```

#### CommonJS
```javascript
// Node.js require syntax
const vtkActor = require('vtk.js').vtkActor;
```

### Build Configuration

#### package.json Scripts
```json
{
  "scripts": {
    "build": "npm run build:esm && npm run build:umd",
    "build:esm": "rollup -c rollup.esm.config.js",
    "build:umd": "webpack --config webpack.umd.config.js",
    "dev:esm": "rollup -c rollup.esm.config.js --watch",
    "dev:umd": "webpack serve --config webpack.dev.config.js"
  }
}
```

#### Webpack Configuration
```javascript
// webpack.config.js
module.exports = {
  entry: './Sources/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'vtk.js',
    library: 'vtk',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.glsl$/,
        use: 'shader-loader'
      }
    ]
  }
};
```

### Development Environment

#### Development Server
```bash
npm run dev:esm     # ESM development mode
npm run dev:umd     # UMD development mode  
npm run example     # Example server
```

#### Code Quality Tools
```bash
npm run lint        # ESLint checking
npm run lint-fix    # Auto-fix lint issues
npm run typecheck   # TypeScript validation
npm run validate    # Prettier formatting check
npm run reformat    # Auto-format code
```

#### Testing
```bash
npm run test:headless   # Headless browser tests
npm run test:debug      # Debug mode testing
npm run test:firefox    # Firefox testing
npm run test:webgpu     # WebGPU tests
```

### Tree Shaking Support

vtk.js is designed for optimal tree shaking:

#### Granular Imports
```javascript
// Import only needed components
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';

// Avoid importing entire library
import * as vtk from 'vtk.js';  // Not recommended for production
```

#### Side Effect Free Modules
- Pure functions with no global state modification
- Explicit dependency declarations
- Minimal cross-module dependencies

### Deployment Strategies

#### CDN Deployment
```html
<!-- Use unpkg CDN -->
<script src="https://unpkg.com/vtk.js@latest/dist/umd/vtk.js"></script>

<!-- Use jsDelivr CDN -->  
<script src="https://cdn.jsdelivr.net/npm/vtk.js@latest/dist/umd/vtk.js"></script>
```

#### Bundle Size Optimization
```javascript
// Webpack bundle analyzer
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    })
  ]
};
```

#### WebAssembly Loading
```javascript
// Dynamic WASM loading
const loadWASM = async () => {
  const wasmModule = await import('vtk-wasm');
  return wasmModule.initialize();
};
```

## Extension Points

vtk.js provides multiple extension mechanisms for adding custom functionality:

### Custom Filters

#### Filter Development Pattern
```javascript
import macro from 'vtk.js/Sources/macros';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';

function vtkMyCustomFilter(publicAPI, model) {
  model.classHierarchy.push('vtkMyCustomFilter');
  
  publicAPI.requestData = (inData, outData) => {
    const input = inData[0];
    const output = vtkPolyData.newInstance();
    
    // Custom processing logic
    const processedPoints = processPoints(input.getPoints());
    output.setPoints(processedPoints);
    
    // Copy other data
    output.getPointData().shallowCopy(input.getPointData());
    output.getCellData().shallowCopy(input.getCellData());
    
    outData[0] = output;
  };
}

const DEFAULT_VALUES = {
  customParameter: 1.0,
};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  
  // Inherit from algorithm
  vtkAlgorithm.extend(publicAPI, model, initialValues);
  
  // Add custom properties
  macro.setGet(publicAPI, model, ['customParameter']);
  
  // Implementation
  vtkMyCustomFilter(publicAPI, model);
}

export const newInstance = macro.newInstance(extend, 'vtkMyCustomFilter');
export default { newInstance, extend };
```

### Custom Mappers

#### Specialized Rendering
```javascript
function vtkMyCustomMapper(publicAPI, model) {
  model.classHierarchy.push('vtkMyCustomMapper');
  
  publicAPI.buildBufferObjects = (ren, actor) => {
    const polydata = publicAPI.getInputData();
    
    // Custom buffer creation
    const customBuffers = createCustomBuffers(polydata);
    
    model.renderable.setBufferObjects(customBuffers);
  };
  
  publicAPI.replaceShaderValues = (shaders, ren, actor) => {
    // Custom shader modifications
    shaders.Vertex = customVertexShader;
    shaders.Fragment = customFragmentShader;
  };
}
```

### Custom Widgets

#### Widget State Definition
```javascript
import vtkStateBuilder from 'vtk.js/Sources/Widgets/Core/StateBuilder';

const createWidgetState = () =>
  vtkStateBuilder.createBuilder()
    .addStateFromMixin({
      labels: ['moveHandle'],
      mixins: ['origin', 'color', 'scale1', 'visible', 'manipulator'],
      name: 'moveHandle',
      initialValues: {
        scale1: 10,
        origin: [0, 0, 0],
        visible: true,
      },
    })
    .addStateFromMixin({
      labels: ['rotateHandle'],  
      mixins: ['origin', 'direction'],
      name: 'rotateHandle',
      initialValues: {
        origin: [0, 0, 0],
        direction: [0, 0, 1],
      },
    })
    .build();
```

#### Widget Behavior Implementation
```javascript
function vtkMyCustomWidget(publicAPI, model) {
  model.classHierarchy.push('vtkMyCustomWidget');
  
  model.widgetState = createWidgetState();
  
  publicAPI.handleLeftButtonPress = (e) => {
    const manipulator = model.activeState?.getManipulator?.();
    if (manipulator) {
      manipulator.handleEvent(e, model.activeState);
      publicAPI.invokeStartInteractionEvent();
      return macro.EVENT_ABORT;
    }
    return macro.VOID;
  };
  
  publicAPI.handleMouseMove = (e) => {
    const activeState = model.activeState;
    if (activeState) {
      const manipulator = activeState.getManipulator();
      if (manipulator) {
        manipulator.handleEvent(e, activeState);
        publicAPI.invokeInteractionEvent();
      }
    }
  };
}
```

### Custom Representations

#### Visual Representation
```javascript
function vtkMyCustomRepresentation(publicAPI, model) {
  model.classHierarchy.push('vtkMyCustomRepresentation');
  
  publicAPI.requestData = (inData, outData) => {
    const state = inData[0];
    
    // Create visual representation
    const polydata = vtkPolyData.newInstance();
    
    // Generate geometry based on widget state
    const geometry = generateCustomGeometry(state);
    polydata.shallowCopy(geometry);
    
    outData[0] = polydata;
  };
  
  publicAPI.getSelectedState = (prop, compositeID) => {
    // Hit testing logic
    return model.widgetState.getSelectedState();
  };
}
```

### Plugin System

#### Plugin Registration
```javascript
// Plugin definition
const myPlugin = {
  name: 'MyCustomPlugin',
  version: '1.0.0',
  
  install(vtk) {
    // Register custom components
    vtk.register('vtkMyCustomFilter', vtkMyCustomFilter.newInstance);
    vtk.register('vtkMyCustomMapper', vtkMyCustomMapper.newInstance);
    vtk.register('vtkMyCustomWidget', vtkMyCustomWidget.newInstance);
  },
  
  uninstall(vtk) {
    // Cleanup if needed
    vtk.unregister('vtkMyCustomFilter');
    vtk.unregister('vtkMyCustomMapper');
    vtk.unregister('vtkMyCustomWidget');
  }
};

// Plugin usage
vtk.use(myPlugin);
```

### Shader Customization

#### Custom Shader Injection
```javascript
// Custom vertex shader
const customVertexShader = `
  attribute vec3 vertexMC;
  uniform mat4 MCDCMatrix;
  
  void main() {
    // Custom vertex transformation
    vec4 pos = vec4(vertexMC, 1.0);
    gl_Position = MCDCMatrix * pos;
  }
`;

// Custom fragment shader
const customFragmentShader = `
  uniform float opacity;
  uniform vec3 color;
  
  void main() {
    // Custom fragment processing
    gl_FragData[0] = vec4(color, opacity);
  }
`;

// Inject shaders
mapper.setCustomShaderAttributes({
  vertexShaderCode: customVertexShader,
  fragmentShaderCode: customFragmentShader
});
```

## Design Patterns

### Observer Pattern

vtk.js uses the observer pattern extensively for event handling:

#### Event System
```javascript
// Event subscription
obj.onModified(() => {
  console.log('Object was modified');
});

// Multiple listeners
const unsubscribe1 = obj.onModified(callback1);
const unsubscribe2 = obj.onModified(callback2);

// Cleanup
unsubscribe1();
unsubscribe2();

// One-time events
obj.onModified(callback, { once: true });
```

#### Custom Events
```javascript
function vtkMyClass(publicAPI, model) {
  // Define custom events
  publicAPI.invokeCustomEvent = () => {
    publicAPI.modified();
    return publicAPI.invokeEvent({ type: 'CustomEvent' });
  };
  
  // Event listeners
  publicAPI.onCustomEvent = (callback) => {
    return publicAPI.on('CustomEvent', callback);
  };
}
```

### Command Pattern

Widget interactions use the command pattern:

#### Undoable Operations
```javascript
class TransformCommand {
  constructor(actor, transform) {
    this.actor = actor;
    this.transform = transform;
    this.previousTransform = actor.getMatrix();
  }
  
  execute() {
    this.actor.setUserMatrix(this.transform);
  }
  
  undo() {
    this.actor.setUserMatrix(this.previousTransform);
  }
}

// Command execution
const command = new TransformCommand(actor, newTransform);
commandHistory.execute(command);

// Undo support
commandHistory.undo();
commandHistory.redo();
```

### Strategy Pattern

Different rendering backends use the strategy pattern:

#### Rendering Strategy
```javascript
// Abstract rendering interface
class RenderingStrategy {
  render(renderWindow, renderer) {
    throw new Error('Must implement render method');
  }
}

// Concrete implementations
class WebGLStrategy extends RenderingStrategy {
  render(renderWindow, renderer) {
    // WebGL-specific rendering
  }
}

class WebGPUStrategy extends RenderingStrategy {
  render(renderWindow, renderer) {
    // WebGPU-specific rendering
  }
}

// Strategy selection
const strategy = supportsWebGPU() ? new WebGPUStrategy() : new WebGLStrategy();
renderWindow.setRenderingStrategy(strategy);
```

### Factory Pattern

Consistent object creation across all classes:

#### Abstract Factory
```javascript
class VTKFactory {
  static createDataSet(type) {
    switch (type) {
      case 'PolyData':
        return vtkPolyData.newInstance();
      case 'ImageData':
        return vtkImageData.newInstance();
      case 'UnstructuredGrid':
        return vtkUnstructuredGrid.newInstance();
      default:
        throw new Error(`Unknown dataset type: ${type}`);
    }
  }
}
```

#### Builder Pattern
```javascript
class SceneBuilder {
  constructor() {
    this.renderer = vtkRenderer.newInstance();
    this.renderWindow = vtkRenderWindow.newInstance();
  }
  
  addActor(polydata) {
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();
    
    mapper.setInputData(polydata);
    actor.setMapper(mapper);
    this.renderer.addActor(actor);
    
    return this;
  }
  
  setBackground(r, g, b) {
    this.renderer.setBackground(r, g, b);
    return this;
  }
  
  build() {
    this.renderWindow.addRenderer(this.renderer);
    return this.renderWindow;
  }
}

// Usage
const scene = new SceneBuilder()
  .addActor(polydata1)
  .addActor(polydata2)
  .setBackground(0.1, 0.2, 0.4)
  .build();
```

### Proxy Pattern

The Proxy module implements the proxy pattern for state management:

#### Proxy Implementation
```javascript
function vtkGeometryRepresentationProxy(publicAPI, model) {
  model.classHierarchy.push('vtkGeometryRepresentationProxy');
  
  // Lazy initialization
  publicAPI.getMapper = () => {
    if (!model.mapper) {
      model.mapper = vtkMapper.newInstance();
    }
    return model.mapper;
  };
  
  // Property forwarding
  publicAPI.setColor = (r, g, b) => {
    publicAPI.getActor().getProperty().setColor(r, g, b);
  };
  
  publicAPI.getColor = () => {
    return publicAPI.getActor().getProperty().getColor();
  };
}
```

## Performance Considerations

### Memory Management

#### Efficient Data Structures
```javascript
// Use typed arrays for performance
const points = new Float32Array(numPoints * 3);
const cells = new Uint32Array(cellConnectivity);

// Minimize object creation
const reusableVector = [0, 0, 0];
for (let i = 0; i < numPoints; i++) {
  points.getPoint(i, reusableVector);
  // Process reusableVector
}
```

#### Reference Management
```javascript
// Proper cleanup
obj.delete();                    // Explicit cleanup
obj.unregister(this);           // Remove references

// Avoid memory leaks
renderWindow.delete();          // Clean up WebGL context
widgetManager.delete();         // Clean up event listeners
```

### Rendering Performance

#### Level of Detail (LOD)
```javascript
const mapper = vtkMapper.newInstance();

// Automatic LOD based on performance
mapper.setResolveCoincidentTopology(true);
mapper.setStatic(true);  // Hint for static geometry

// Manual LOD control
const lod = vtkLODActor.newInstance();
lod.addLODMapper(highResMapper, 1.0);    // High quality
lod.addLODMapper(mediumResMapper, 0.5);  // Medium quality  
lod.addLODMapper(lowResMapper, 0.1);     // Low quality
```

#### Frustum Culling
```javascript
// Enable frustum culling
renderer.setClippingRangeExpansion(0.05);
mapper.setClippingPlanes(renderer.getActiveCamera().getClippingPlanes());
```

#### Batch Rendering
```javascript
// Group similar objects
const multiMapper = vtkGlyph3DMapper.newInstance();
multiMapper.setInputData(points);
multiMapper.setSourceData(sphereSource.getOutputData());
multiMapper.setScaleModeToDataScalingOff();
```

### GPU Optimization

#### Buffer Management
```javascript
// Reuse buffers
const vertexBuffer = vtkBufferObject.newInstance();
vertexBuffer.setOpenGLRenderWindow(openglRenderWindow);

// Update data without reallocation
vertexBuffer.upload(newVertexData, vtkBufferObject.ObjectType.ARRAY_BUFFER);
```

#### Texture Optimization
```javascript
const texture = vtkTexture.newInstance();

// Use appropriate formats
texture.setFormat(vtkTexture.Format.RGB);
texture.setDataType(vtkTexture.DataType.UNSIGNED_BYTE);

// Enable mipmapping for distant objects
texture.setGenerateMipmap(true);
texture.setMinificationFilter(vtkTexture.Filter.LINEAR_MIPMAP_LINEAR);
```

#### Shader Compilation Caching
```javascript
// Cache compiled shaders
const shaderCache = vtkShaderCache.newInstance();
shaderCache.setOpenGLRenderWindow(openglRenderWindow);

// Reuse shader programs
const program = shaderCache.readyShaderProgram(vertexShader, fragmentShader);
```

### Data Processing Performance

#### Parallel Processing
```javascript
// Use Web Workers for heavy computation
const worker = new Worker('/path/to/processing-worker.js');
worker.postMessage({ 
  data: arrayBuffer,
  operation: 'processLargeDataset'
});

worker.onmessage = (e) => {
  const processedData = e.data;
  // Update visualization
};
```

#### Streaming and Progressive Loading
```javascript
// Stream large datasets
const streamLoader = vtkHttpDataSetReader.newInstance();
streamLoader.setProgressiveLoading(true);
streamLoader.setUrl('/api/large-dataset');

streamLoader.onProgress((progress) => {
  console.log(`Loading: ${progress}%`);
});

streamLoader.loadData().then(() => {
  // Process complete dataset
});
```

This comprehensive architecture documentation provides a deep understanding of vtk.js framework design, implementation patterns, and extension mechanisms. The framework's modular architecture, consistent object model, and performance optimizations make it well-suited for demanding web-based visualization applications.