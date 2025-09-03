import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const renderWindow = vtkRenderWindow.newInstance();
const renderer = vtkRenderer.newInstance({ background: [0.2, 0.3, 0.4] });
renderWindow.addRenderer(renderer);

// Create OpenGL render window
const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
renderWindow.addView(openglRenderWindow);

// Create a DOM element container
const container = document.createElement('div');
container.style.position = 'absolute';
container.style.top = '0';
container.style.left = '0';
container.style.width = '100%';
container.style.height = '100vh';
document.body.appendChild(container);
document.body.style.margin = '0';
openglRenderWindow.setContainer(container);

// Set size
openglRenderWindow.setSize(window.innerWidth, window.innerHeight);

// ----------------------------------------------------------------------------
// Create triangle geometry manually using PolyData
// ----------------------------------------------------------------------------

// Create a triangle with 3 vertices
const points = new Float32Array([
  0.0,
  1.0,
  0.0, // Top vertex
  -1.0,
  -1.0,
  0.0, // Bottom left vertex
  1.0,
  -1.0,
  0.0, // Bottom right vertex
]);

// Define triangle connectivity (one triangle using vertices 0, 1, 2)
const triangles = new Uint32Array([
  3, // Number of points in this polygon (triangle = 3)
  0,
  1,
  2, // Indices of the vertices
]);

// Create PolyData and set the geometry
const trianglePolyData = vtkPolyData.newInstance();
trianglePolyData.getPoints().setData(points, 3); // 3 components per point (x,y,z)
trianglePolyData.getPolys().setData(triangles, 1); // 1 component per cell

// ----------------------------------------------------------------------------
// Pipeline: PolyData --> Mapper --> Actor
// ----------------------------------------------------------------------------

const mapper = vtkMapper.newInstance();
mapper.setInputData(trianglePolyData);

const actor = vtkActor.newInstance();
actor.setMapper(mapper);

// Set triangle color to red
actor.getProperty().setColor(1.0, 0.2, 0.2);

// ----------------------------------------------------------------------------
// Add the actor to the renderer and set the camera based on it
// ----------------------------------------------------------------------------

renderer.addActor(actor);
renderer.resetCamera();

// ----------------------------------------------------------------------------
// Setup interaction
// ----------------------------------------------------------------------------

const interactor = vtkRenderWindowInteractor.newInstance();
interactor.setView(openglRenderWindow);
interactor.initialize();
interactor.bindEvents(container);

// Set interactor style
interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

// Start rendering
renderWindow.render();
