# vtk.js 场景图架构详解

## 概述

vtk.js 的场景图架构是整个渲染系统的核心，它提供了一个统一的、层次化的方式来管理和渲染3D场景中的所有对象。不同于传统图形库的场景图概念，vtk.js 的场景图更专注于科学可视化的需求，同时支持多种渲染后端（OpenGL/WebGPU）的抽象。

## 1. 场景图基本概念

### 1.1 什么是场景图

场景图是一个层次化的数据结构，用于组织和管理3D场景中的对象。在 vtk.js 中，场景图不仅负责空间层次的管理，更重要的是实现了**抽象渲染对象**与**具体实现对象**之间的映射关系。

```
抽象层场景图              具体实现场景图
(用户操作的对象)           (实际渲染的对象)
     │                        │
  vtkRenderer  ←──映射───→  vtkOpenGLRenderer
     │                        │
  vtkActor     ←──映射───→  vtkOpenGLActor
     │                        │
  vtkMapper    ←──映射───→  vtkOpenGLPolyDataMapper
```

### 1.2 vtk.js 场景图的特点

1. **双重结构**：维护抽象对象树和实现对象树
2. **动态映射**：运行时建立抽象与实现的对应关系
3. **渲染导向**：专为渲染管线优化的遍历机制
4. **平台无关**：统一的接口支持多种渲染后端

## 2. ViewNode 系统核心架构

### 2.1 ViewNode 基类设计

`vtkViewNode` 是场景图中所有节点的基类，定义了场景图的基本行为：

```javascript
// 核心数据结构
const DEFAULT_VALUES = {
  renderable: null,           // 对应的抽象对象
  myFactory: null,            // 节点工厂
  children: [],               // 子节点数组
  visited: false,             // 遍历标记
  _parent: null,              // 父节点引用
};

// 核心方法
function vtkViewNode(publicAPI, model) {
  model.classHierarchy.push('vtkViewNode');
  
  // 构建阶段 - 初始化节点
  publicAPI.build = (prepass) => {};
  
  // 渲染阶段 - 执行渲染
  publicAPI.render = (prepass) => {};
  
  // 遍历核心方法
  publicAPI.traverse = (renderPass) => {
    // 获取遍历操作类型
    const passTraversal = renderPass.getTraverseOperation();
    const fn = publicAPI[passTraversal];
    
    if (fn) {
      fn(renderPass);  // 执行特定的遍历方法
      return;
    }
    
    // 默认遍历流程
    publicAPI.apply(renderPass, true);    // 前序处理
    
    // 递归遍历子节点
    for (let index = 0; index < model.children.length; index++) {
      model.children[index].traverse(renderPass);
    }
    
    publicAPI.apply(renderPass, false);   // 后序处理
  };
}
```

### 2.2 节点树的层次结构

```
RenderWindow (ViewNode)
├── Renderer (ViewNode)
│   ├── Camera (ViewNode)
│   ├── Light (ViewNode)
│   ├── Actor (ViewNode)
│   │   └── Mapper (ViewNode)
│   │       └── DataSet (ViewNode)
│   ├── Volume (ViewNode)
│   │   └── VolumeMapper (ViewNode)
│   └── Actor2D (ViewNode)
└── RenderPass (ViewNode)
```

### 2.3 父子关系管理

ViewNode 维护严格的父子关系：

```javascript
// 添加子节点
publicAPI.addMissingNode = (dobj) => {
  // 检查是否已存在映射
  const result = model._renderableChildMap.get(dobj);
  if (result !== undefined) {
    result.setVisited(true);
    return result;
  }
  
  // 创建新节点
  const newNode = publicAPI.createViewNode(dobj);
  if (newNode) {
    newNode.setParent(publicAPI);        // 设置父节点
    newNode.setVisited(true);            // 标记为已访问
    model._renderableChildMap.set(dobj, newNode);  // 建立映射
    model.children.push(newNode);        // 添加到子节点列表
    return newNode;
  }
  return undefined;
};
```

### 2.4 节点查找机制

```javascript
// 递归查找对应的ViewNode
publicAPI.getViewNodeFor = (dataObject) => {
  // 检查当前节点
  if (model.renderable === dataObject) {
    return publicAPI;
  }
  
  // 递归搜索子节点
  for (let index = 0; index < model.children.length; ++index) {
    const child = model.children[index];
    const vn = child.getViewNodeFor(dataObject);
    if (vn) {
      return vn;
    }
  }
  return undefined;
};

// 向上查找特定类型的祖先节点
publicAPI.getFirstAncestorOfType = (type) => {
  if (!model._parent) return null;
  
  if (model._parent.isA(type)) {
    return model._parent;
  }
  return model._parent.getFirstAncestorOfType(type);
};
```

## 3. ViewNodeFactory 工厂系统

### 3.1 工厂模式实现

`vtkViewNodeFactory` 负责根据抽象对象创建对应的ViewNode实现：

```javascript
function vtkViewNodeFactory(publicAPI, model) {
  model.classHierarchy.push('vtkViewNodeFactory');
  
  // 核心创建方法
  publicAPI.createNode = (dataObject) => {
    if (dataObject.isDeleted()) {
      return null;
    }
    
    // 遍历对象的类层次结构
    let cpt = 0;
    let className = dataObject.getClassName(cpt++);
    let isObject = false;
    const keys = Object.keys(model.overrides);
    
    // 查找匹配的类名
    while (className && !isObject) {
      if (keys.indexOf(className) !== -1) {
        isObject = true;
      } else {
        className = dataObject.getClassName(cpt++);
      }
    }
    
    if (!isObject) {
      return null;
    }
    
    // 创建对应的ViewNode
    const vn = model.overrides[className]();
    vn.setMyFactory(publicAPI);
    return vn;
  };
}
```

### 3.2 registerOverride 机制

这是实现抽象到具体映射的关键机制：

```javascript
// 在 OpenGL 后端
const CLASS_MAPPING = {};

export function registerOverride(className, fn) {
  CLASS_MAPPING[className] = fn;
}

// 注册具体实现
registerOverride('vtkRenderer', vtkOpenGLRenderer.newInstance);
registerOverride('vtkActor', vtkOpenGLActor.newInstance);
registerOverride('vtkMapper', vtkOpenGLPolyDataMapper.newInstance);

// 在 WebGPU 后端也有相同的注册
registerOverride('vtkRenderer', vtkWebGPURenderer.newInstance);
registerOverride('vtkActor', vtkWebGPUActor.newInstance);
registerOverride('vtkMapper', vtkWebGPUPolyDataMapper.newInstance);
```

### 3.3 动态类型创建

```javascript
// ViewNodeFactory 使用注册信息创建节点
export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  
  // 设置类映射表
  if (!model.overrides) {
    model.overrides = Object.assign({}, CLASS_MAPPING);
  }
  
  macro.obj(publicAPI, model);
  vtkViewNodeFactory(publicAPI, model);
}
```

## 4. 渲染遍历机制

### 4.1 RenderPass 系统

RenderPass 定义了遍历的类型和操作：

```javascript
function vtkRenderPass(publicAPI, model) {
  model.classHierarchy.push('vtkRenderPass');
  
  // 获取当前操作类型
  publicAPI.getOperation = () => model.currentOperation;
  
  // 设置操作并生成遍历方法名
  publicAPI.setCurrentOperation = (val) => {
    model.currentOperation = val;
    model.currentTraverseOperation = `traverse${macro.capitalize(val)}`;
  };
  
  // 获取遍历操作名称
  publicAPI.getTraverseOperation = () => model.currentTraverseOperation;
}
```

### 4.2 多阶段渲染管线

vtk.js 的渲染分为多个阶段，每个阶段都会遍历场景图：

```javascript
// 在 ForwardPass 中的遍历序列
publicAPI.traverse = (viewNode, parent = null) => {
  // 1. 构建阶段 - 创建和初始化ViewNode
  publicAPI.setCurrentOperation('buildPass');
  viewNode.traverse(publicAPI);
  
  // 2. 查询阶段 - 统计渲染对象
  publicAPI.setCurrentOperation('queryPass');
  renNode.traverse(publicAPI);
  
  // 3. 相机阶段 - 设置视图矩阵
  publicAPI.setCurrentOperation('cameraPass');
  renNode.traverse(publicAPI);
  
  // 4. 不透明渲染阶段
  if (model.opaqueActorCount > 0) {
    publicAPI.setCurrentOperation('opaquePass');
    renNode.traverse(publicAPI);
  }
  
  // 5. 半透明渲染阶段
  if (model.translucentActorCount > 0) {
    publicAPI.setCurrentOperation('translucentPass');
    // 使用专门的半透明Pass
    model.translucentPass.traverse(viewNode, renNode, publicAPI);
  }
  
  // 6. 体渲染阶段
  if (model.volumeCount > 0) {
    publicAPI.setCurrentOperation('volumePass');
    renNode.traverse(publicAPI);
  }
  
  // 7. 覆盖层阶段
  if (model.overlayActorCount > 0) {
    publicAPI.setCurrentOperation('overlayPass');
    renNode.traverse(publicAPI);
  }
};
```

### 4.3 节点级别的遍历响应

每个ViewNode可以响应特定的遍历操作：

```javascript
// 在 Actor ViewNode 中的实现
function vtkOpenGLActor(publicAPI, model) {
  // 响应不透明渲染遍历
  publicAPI.traverseOpaquePass = (renderPass) => {
    if (!model.renderable || !model.renderable.getNestedVisibility()) {
      return;
    }
    
    // 渲染前处理
    publicAPI.apply(renderPass, true);
    
    // 遍历子节点（通常是Mapper）
    for (let index = 0; index < model.children.length; index++) {
      model.children[index].traverse(renderPass);
    }
    
    // 渲染后处理
    publicAPI.apply(renderPass, false);
  };
  
  // 响应半透明渲染遍历
  publicAPI.traverseTranslucentPass = (renderPass) => {
    // 类似的实现...
  };
}
```

## 5. 动态节点管理

### 5.1 节点生命周期管理

场景图需要动态地添加和删除节点，同时保持数据一致性：

```javascript
// 准备遍历 - 重置访问标记
publicAPI.prepareNodes = () => {
  for (let index = 0; index < model.children.length; ++index) {
    model.children[index].setVisited(false);
  }
};

// 添加缺失的节点
publicAPI.addMissingNodes = (dataObjs, enforceOrder = false) => {
  if (!dataObjs || !dataObjs.length) return;
  
  for (let index = 0; index < dataObjs.length; ++index) {
    const dobj = dataObjs[index];
    const node = publicAPI.addMissingNode(dobj);
    
    // 如果需要强制顺序
    if (enforceOrder && node !== undefined && 
        model.children[index] !== node) {
      // 重新排列子节点顺序
      for (let i = index + 1; i < model.children.length; ++i) {
        if (model.children[i] === node) {
          model.children.splice(i, 1);
          model.children.splice(index, 0, node);
          break;
        }
      }
    }
  }
};

// 清理未使用的节点
publicAPI.removeUnusedNodes = () => {
  let visitedCount = 0;
  for (let index = 0; index < model.children.length; ++index) {
    const child = model.children[index];
    const visited = child.getVisited();
    
    if (visited) {
      model.children[visitedCount++] = child;
      child.setVisited(false);
    } else {
      // 删除未访问的节点
      const renderable = child.getRenderable();
      if (renderable) {
        model._renderableChildMap.delete(renderable);
      }
      child.delete();
    }
  }
  
  model.children.length = visitedCount;
};
```

### 5.2 visited 标记机制

```javascript
// 标记节点已被访问
publicAPI.setVisited = (val) => {
  model.visited = val;
};

// 在构建阶段标记所有需要保留的节点
publicAPI.buildPass = (prepass) => {
  if (prepass) {
    publicAPI.prepareNodes();
    
    // 添加当前需要的节点
    publicAPI.addMissingNode(model.renderable.getActiveCamera());
    publicAPI.addMissingNodes(
      model.renderable.getViewPropsWithNestedProps(), 
      true
    );
    
    // 清理不需要的节点
    publicAPI.removeUnusedNodes();
  }
};
```

## 6. 场景图节点类型详解

### 6.1 RenderWindowViewNode

渲染窗口ViewNode是整个场景图的根节点：

```javascript
function vtkRenderWindowViewNode(publicAPI, model) {
  model.classHierarchy.push('vtkRenderWindowViewNode');
  
  // 坐标系转换方法
  publicAPI.worldToDisplay = (x, y, z, renderer) => {
    const val = renderer.worldToView(x, y, z);
    const dims = publicAPI.getViewportSize(renderer);
    const val2 = renderer.viewToProjection(val[0], val[1], val[2], 
                                           dims[0] / dims[1]);
    const val3 = renderer.projectionToNormalizedDisplay(
      val2[0], val2[1], val2[2]
    );
    return publicAPI.normalizedDisplayToDisplay(val3[0], val3[1], val3[2]);
  };
  
  // 获取视口信息
  publicAPI.getViewportSize = (viewport) => {
    const vCoords = viewport.getViewportByReference();
    const size = publicAPI.getFramebufferSize();
    return [
      (vCoords[2] - vCoords[0]) * size[0],
      (vCoords[3] - vCoords[1]) * size[1],
    ];
  };
}
```

### 6.2 Renderer ViewNode

渲染器ViewNode管理单个渲染器的场景：

```javascript
function vtkOpenGLRenderer(publicAPI, model) {
  model.classHierarchy.push('vtkOpenGLRenderer');
  
  // 构建阶段
  publicAPI.buildPass = (prepass) => {
    if (prepass) {
      publicAPI.updateLights();
      publicAPI.prepareNodes();
      
      // 添加相机
      publicAPI.addMissingNode(model.renderable.getActiveCamera());
      
      // 添加所有可见的Props
      publicAPI.addMissingNodes(
        model.renderable.getViewPropsWithNestedProps(),
        true
      );
      
      publicAPI.removeUnusedNodes();
    }
  };
  
  // 相机阶段 - 清除背景
  publicAPI.cameraPass = (prepass) => {
    if (prepass) {
      publicAPI.clear();
    }
  };
  
  // 清除缓冲区
  publicAPI.clear = () => {
    const gl = model.context;
    const background = model.renderable.getBackgroundByReference();
    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
}
```

### 6.3 Actor ViewNode

Actor ViewNode负责几何体的渲染：

```javascript
function vtkOpenGLActor(publicAPI, model) {
  model.classHierarchy.push('vtkOpenGLActor');
  
  // 查询阶段 - 统计渲染类型
  publicAPI.queryPass = (prepass) => {
    if (prepass) {
      const mapper = model.renderable.getMapper();
      if (mapper && model.renderable.getNestedVisibility()) {
        // 根据透明度决定渲染类型
        if (model.renderable.getProperty().getOpacity() < 1.0) {
          model._parent.incrementTranslucentActorCount();
        } else {
          model._parent.incrementOpaqueActorCount();
        }
      }
    }
  };
  
  // 构建阶段 - 准备Mapper
  publicAPI.buildPass = (prepass) => {
    if (prepass) {
      publicAPI.prepareNodes();
      
      const mapper = model.renderable.getMapper();
      if (mapper) {
        publicAPI.addMissingNode(mapper);
      }
      
      publicAPI.removeUnusedNodes();
    }
  };
  
  // 不透明渲染阶段
  publicAPI.traverseOpaquePass = (renderPass) => {
    if (!model.renderable || 
        !model.renderable.getNestedVisibility() ||
        model.renderable.getProperty().getOpacity() < 1.0) {
      return;
    }
    
    // 应用Actor的变换矩阵
    publicAPI.apply(renderPass, true);
    
    // 渲染Mapper
    for (let index = 0; index < model.children.length; index++) {
      model.children[index].traverse(renderPass);
    }
    
    publicAPI.apply(renderPass, false);
  };
}
```

### 6.4 Volume ViewNode

体数据ViewNode的特殊处理：

```javascript
function vtkOpenGLVolume(publicAPI, model) {
  model.classHierarchy.push('vtkOpenGLVolume');
  
  // 查询阶段 - 注册体数据
  publicAPI.queryPass = (prepass) => {
    if (prepass) {
      const mapper = model.renderable.getMapper();
      if (mapper && model.renderable.getNestedVisibility()) {
        model._parent.incrementVolumeCount();
      }
    }
  };
  
  // 体渲染阶段
  publicAPI.traverseVolumePass = (renderPass) => {
    if (!model.renderable || 
        !model.renderable.getNestedVisibility()) {
      return;
    }
    
    publicAPI.apply(renderPass, true);
    
    // 体渲染需要特殊处理
    for (let index = 0; index < model.children.length; index++) {
      model.children[index].traverse(renderPass);
    }
    
    publicAPI.apply(renderPass, false);
  };
}
```

## 7. 映射关系管理

### 7.1 renderable 到 ViewNode 的映射

每个ViewNode都维护一个映射表：

```javascript
// 在 ViewNode 初始化时创建映射表
function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  
  // 创建映射表
  model._renderableChildMap = new Map();
  
  // ... 其他初始化代码
}

// 维护映射关系
publicAPI.addMissingNode = (dobj) => {
  // 检查映射表
  const result = model._renderableChildMap.get(dobj);
  if (result !== undefined) {
    result.setVisited(true);
    return result;
  }
  
  // 创建新节点并建立映射
  const newNode = publicAPI.createViewNode(dobj);
  if (newNode) {
    model._renderableChildMap.set(dobj, newNode);
    // ...
  }
};
```

### 7.2 缓存和优化策略

```javascript
// 使用Map进行高效查找
const viewNodeCache = new Map();

// 缓存ViewNode避免重复创建
publicAPI.getViewNodeFor = (dataObject) => {
  // 首先检查缓存
  let cachedNode = viewNodeCache.get(dataObject);
  if (cachedNode && !cachedNode.isDeleted()) {
    return cachedNode;
  }
  
  // 递归查找
  const foundNode = publicAPI.recursiveSearch(dataObject);
  if (foundNode) {
    viewNodeCache.set(dataObject, foundNode);
  }
  
  return foundNode;
};
```

## 8. 渲染管线集成

### 8.1 与 ForwardPass 的集成

ForwardPass 使用场景图来协调整个渲染过程：

```javascript
publicAPI.traverse = (viewNode, parent = null) => {
  // 构建场景图
  publicAPI.setCurrentOperation('buildPass');
  viewNode.traverse(publicAPI);
  
  const renderers = viewNode.getRenderable().getRenderersByReference();
  for (let index = 0; index < renderers.length; index++) {
    const ren = renderers[index];
    
    // 获取渲染器的ViewNode实现
    const renNode = viewNode.getViewNodeFor(ren);
    
    // 统计场景内容
    publicAPI.setCurrentOperation('queryPass');
    renNode.traverse(publicAPI);
    
    // 执行渲染阶段
    publicAPI.setCurrentOperation('cameraPass');
    renNode.traverse(publicAPI);
    
    if (model.opaqueActorCount > 0) {
      publicAPI.setCurrentOperation('opaquePass');
      renNode.traverse(publicAPI);
    }
    
    // ... 其他渲染阶段
  }
};
```

### 8.2 遍历性能优化

```javascript
// 缓存遍历结果
let lastTraversalTime = 0;
let cachedTraversalResult = null;

publicAPI.traverse = (renderPass) => {
  const currentTime = performance.now();
  
  // 如果场景没有变化，使用缓存结果
  if (currentTime - lastTraversalTime < 16 && // 60fps
      cachedTraversalResult && 
      !model.modified) {
    return cachedTraversalResult;
  }
  
  // 执行实际遍历
  const result = publicAPI.actualTraverse(renderPass);
  
  // 更新缓存
  lastTraversalTime = currentTime;
  cachedTraversalResult = result;
  model.modified = false;
  
  return result;
};
```

## 9. 跨平台支持机制

### 9.1 统一的抽象层

```javascript
// 抽象层定义统一接口
function vtkRenderer(publicAPI, model) {
  // 通用的渲染器行为
  publicAPI.addActor = (actor) => {
    model.actors.push(actor);
    publicAPI.modified();
  };
  
  publicAPI.render = () => {
    // 抽象的渲染方法，具体实现由ViewNode提供
  };
}

// OpenGL实现
function vtkOpenGLRenderer(publicAPI, model) {
  model.classHierarchy.push('vtkOpenGLRenderer');
  
  publicAPI.render = () => {
    // OpenGL特定的渲染实现
    const gl = model.context;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // ...
  };
}

// WebGPU实现
function vtkWebGPURenderer(publicAPI, model) {
  model.classHierarchy.push('vtkWebGPURenderer');
  
  publicAPI.render = () => {
    // WebGPU特定的渲染实现
    const device = model.device;
    const encoder = device.createCommandEncoder();
    // ...
  };
}
```

### 9.2 运行时后端切换

```javascript
// 动态切换渲染后端
publicAPI.setBackend = (backendName) => {
  // 清理当前后端的ViewNode
  publicAPI.clearViewNodes();
  
  // 根据后端类型加载不同的工厂
  let factory;
  switch (backendName) {
    case 'OpenGL':
      factory = vtkOpenGLViewNodeFactory.newInstance();
      break;
    case 'WebGPU':
      factory = vtkWebGPUViewNodeFactory.newInstance();
      break;
    default:
      throw new Error(`Unsupported backend: ${backendName}`);
  }
  
  // 设置新工厂
  publicAPI.setMyFactory(factory);
  
  // 重建场景图
  publicAPI.rebuild();
};
```

## 10. 设计模式分析

### 10.1 组合模式 (Composite Pattern)

场景图本身就是组合模式的经典应用：

```javascript
// Component - ViewNode基类
class ViewNode {
  traverse(renderPass) {
    // 处理自身
    this.apply(renderPass, true);
    
    // 递归处理子节点
    for (const child of this.children) {
      child.traverse(renderPass);
    }
    
    // 后处理
    this.apply(renderPass, false);
  }
}

// Composite - 容器节点（如Renderer）
class RendererNode extends ViewNode {
  addChild(child) {
    this.children.push(child);
  }
}

// Leaf - 叶子节点（如Actor）
class ActorNode extends ViewNode {
  traverse(renderPass) {
    // 叶子节点的具体渲染逻辑
    this.render(renderPass);
  }
}
```

### 10.2 访问者模式 (Visitor Pattern)

RenderPass 充当访问者，对场景图节点执行操作：

```javascript
// Visitor - RenderPass
class RenderPass {
  visit(node) {
    const method = `traverse${this.getOperation()}`;
    if (node[method]) {
      node[method](this);
    }
  }
}

// Element - ViewNode
class ViewNode {
  accept(visitor) {
    visitor.visit(this);
  }
}

// 具体的访问操作
class OpaquePass extends RenderPass {
  constructor() {
    super();
    this.operation = 'OpaquePass';
  }
}
```

### 10.3 工厂模式 (Factory Pattern)

ViewNodeFactory 实现了工厂模式：

```javascript
// AbstractFactory
class ViewNodeFactory {
  createRenderer() { throw new Error('Abstract method'); }
  createActor() { throw new Error('Abstract method'); }
}

// ConcreteFactory1
class OpenGLViewNodeFactory extends ViewNodeFactory {
  createRenderer() { return new OpenGLRenderer(); }
  createActor() { return new OpenGLActor(); }
}

// ConcreteFactory2  
class WebGPUViewNodeFactory extends ViewNodeFactory {
  createRenderer() { return new WebGPURenderer(); }
  createActor() { return new WebGPUActor(); }
}
```

### 10.4 策略模式 (Strategy Pattern)

不同的渲染策略通过不同的Pass实现：

```javascript
// Strategy Interface
class RenderStrategy {
  execute(scene) {
    throw new Error('Abstract method');
  }
}

// Concrete Strategies
class ForwardRenderStrategy extends RenderStrategy {
  execute(scene) {
    scene.traverse(new OpaquePass());
    scene.traverse(new TranslucentPass());
  }
}

class DeferredRenderStrategy extends RenderStrategy {
  execute(scene) {
    scene.traverse(new GBufferPass());
    scene.traverse(new LightingPass());
  }
}
```

## 11. 实际应用示例

### 11.1 基本场景构建

```javascript
// 创建基本的渲染场景
const renderWindow = vtkRenderWindow.newInstance();
const renderer = vtkRenderer.newInstance();
const actor = vtkActor.newInstance();
const mapper = vtkPolyDataMapper.newInstance();

// 构建对象层次
actor.setMapper(mapper);
renderer.addActor(actor);
renderWindow.addRenderer(renderer);

// 创建OpenGL视图（这里会创建对应的ViewNode树）
const glRenderWindow = renderWindow.newAPISpecificView('WebGL');

// ViewNode树的构建过程：
// 1. 创建 vtkOpenGLRenderWindow (根ViewNode)
// 2. 为 renderer 创建 vtkOpenGLRenderer ViewNode
// 3. 为 actor 创建 vtkOpenGLActor ViewNode  
// 4. 为 mapper 创建 vtkOpenGLPolyDataMapper ViewNode

// 执行渲染（触发场景图遍历）
renderWindow.render();
```

### 11.2 动态场景更新

```javascript
// 动态添加新的Actor
const newActor = vtkActor.newInstance();
const newMapper = vtkPolyDataMapper.newInstance();
newActor.setMapper(newMapper);

// 添加到渲染器
renderer.addActor(newActor);

// 下次渲染时，场景图会自动：
// 1. 在buildPass中检测到新的Actor
// 2. 调用addMissingNode创建对应的ViewNode
// 3. 建立映射关系
// 4. 在渲染遍历中包含新节点

// 移除Actor
renderer.removeActor(oldActor);

// 场景图会在下次遍历时：
// 1. 在prepareNodes中标记相关节点为未访问
// 2. 在removeUnusedNodes中清理无用节点
// 3. 释放相关资源
```

### 11.3 自定义ViewNode扩展

```javascript
// 创建自定义的ViewNode
function vtkCustomActor(publicAPI, model) {
  model.classHierarchy.push('vtkCustomActor');
  
  // 自定义的查询行为
  publicAPI.queryPass = (prepass) => {
    if (prepass) {
      // 根据自定义逻辑决定渲染类型
      if (model.customProperty.useSpecialRendering) {
        model._parent.incrementSpecialActorCount();
      } else {
        model._parent.incrementOpaqueActorCount();
      }
    }
  };
  
  // 自定义的渲染遍历
  publicAPI.traverseSpecialPass = (renderPass) => {
    // 执行特殊的渲染逻辑
    publicAPI.customRender(renderPass);
  };
}

// 注册自定义实现
registerOverride('vtkCustomActor', vtkCustomActor.newInstance);

// 扩展ForwardPass以支持新的渲染阶段
const originalTraverse = ForwardPass.prototype.traverse;
ForwardPass.prototype.traverse = function(viewNode, parent) {
  // 执行原始遍历
  originalTraverse.call(this, viewNode, parent);
  
  // 添加自定义渲染阶段
  if (model.specialActorCount > 0) {
    publicAPI.setCurrentOperation('specialPass');
    renNode.traverse(publicAPI);
  }
};
```

## 12. 性能优化与最佳实践

### 12.1 场景图优化技巧

#### 12.1.1 节点缓存优化

```javascript
// 使用WeakMap避免内存泄漏
const nodeCache = new WeakMap();

publicAPI.getViewNodeFor = (dataObject) => {
  // 检查缓存
  let cached = nodeCache.get(dataObject);
  if (cached && !cached.isDeleted()) {
    return cached;
  }
  
  // 查找并缓存
  const found = publicAPI.recursiveFind(dataObject);
  if (found) {
    nodeCache.set(dataObject, found);
  }
  return found;
};
```

#### 12.1.2 遍历路径优化

```javascript
// 使用位掩码优化遍历判断
const PASS_TYPES = {
  BUILD: 1 << 0,
  QUERY: 1 << 1, 
  CAMERA: 1 << 2,
  OPAQUE: 1 << 3,
  TRANSLUCENT: 1 << 4,
  VOLUME: 1 << 5
};

publicAPI.traverse = (renderPass) => {
  const passType = renderPass.getPassType();
  
  // 快速判断是否需要处理此遍历
  if (!(model.supportedPasses & passType)) {
    return;
  }
  
  // 执行遍历...
};
```

#### 12.1.3 批量操作优化

```javascript
// 批量更新减少遍历次数
publicAPI.beginUpdate = () => {
  model.updating = true;
};

publicAPI.endUpdate = () => {
  model.updating = false;
  if (model.needsRebuild) {
    publicAPI.rebuild();
  }
};

publicAPI.addActors = (actors) => {
  publicAPI.beginUpdate();
  actors.forEach(actor => renderer.addActor(actor));
  publicAPI.endUpdate();
};
```

### 12.2 内存管理

#### 12.2.1 自动资源清理

```javascript
// ViewNode的生命周期管理
const parentDelete = publicAPI.delete;
publicAPI.delete = () => {
  // 清理子节点
  for (let i = 0; i < model.children.length; i++) {
    model.children[i].delete();
  }
  
  // 清理映射关系
  model._renderableChildMap.clear();
  
  // 从父节点移除
  if (model._parent) {
    model._parent.removeNode(publicAPI);
  }
  
  // 调用父类清理
  parentDelete();
};
```

#### 12.2.2 弱引用模式

```javascript
// 使用弱引用避免循环引用
class ViewNode {
  constructor() {
    this.children = [];
    this.parentRef = null; // 弱引用到父节点
  }
  
  setParent(parent) {
    this.parentRef = new WeakRef(parent);
  }
  
  getParent() {
    const parent = this.parentRef?.deref();
    return parent || null;
  }
}
```

### 12.3 调试和故障排除

#### 12.3.1 场景图可视化

```javascript
// 打印场景图结构
publicAPI.printSceneGraph = (depth = 0) => {
  const indent = '  '.repeat(depth);
  const className = publicAPI.getClassName();
  const renderable = model.renderable;
  const renderableName = renderable ? renderable.getClassName() : 'null';
  
  console.log(`${indent}${className} -> ${renderableName}`);
  
  model.children.forEach(child => {
    child.printSceneGraph(depth + 1);
  });
};

// 验证场景图完整性
publicAPI.validateSceneGraph = () => {
  const issues = [];
  
  // 检查父子关系一致性
  model.children.forEach(child => {
    if (child.getParent() !== publicAPI) {
      issues.push(`Child ${child.getClassName()} has incorrect parent`);
    }
  });
  
  // 检查映射关系
  model._renderableChildMap.forEach((viewNode, renderable) => {
    if (viewNode.getRenderable() !== renderable) {
      issues.push(`Mapping inconsistency for ${renderable.getClassName()}`);
    }
  });
  
  return issues;
};
```

#### 12.3.2 性能监控

```javascript
// 遍历性能监控
let traversalStats = {
  count: 0,
  totalTime: 0,
  maxTime: 0
};

const originalTraverse = publicAPI.traverse;
publicAPI.traverse = (renderPass) => {
  const startTime = performance.now();
  
  originalTraverse.call(publicAPI, renderPass);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  traversalStats.count++;
  traversalStats.totalTime += duration;
  traversalStats.maxTime = Math.max(traversalStats.maxTime, duration);
  
  // 每100次遍历报告一次性能
  if (traversalStats.count % 100 === 0) {
    const avgTime = traversalStats.totalTime / traversalStats.count;
    console.log(`Traversal stats: avg=${avgTime.toFixed(2)}ms, max=${traversalStats.maxTime.toFixed(2)}ms`);
  }
};
```

#### 12.3.3 常见问题诊断

```javascript
// 内存泄漏检测
publicAPI.detectMemoryLeaks = () => {
  const leaks = [];
  
  // 检查未释放的ViewNode
  model.children.forEach(child => {
    if (child.isDeleted() && child.getParent() === publicAPI) {
      leaks.push(`Deleted child still has parent reference: ${child.getClassName()}`);
    }
  });
  
  // 检查孤儿映射
  model._renderableChildMap.forEach((viewNode, renderable) => {
    if (renderable.isDeleted() && !viewNode.isDeleted()) {
      leaks.push(`ViewNode ${viewNode.getClassName()} references deleted renderable`);
    }
  });
  
  return leaks;
};

// 渲染问题诊断
publicAPI.diagnoseRenderingIssues = () => {
  const issues = [];
  
  // 检查是否有可见对象但没有对应的ViewNode
  const actors = model.renderable.getActors();
  actors.forEach(actor => {
    if (actor.getVisibility()) {
      const viewNode = publicAPI.getViewNodeFor(actor);
      if (!viewNode) {
        issues.push(`Visible actor ${actor.getClassName()} has no ViewNode`);
      }
    }
  });
  
  return issues;
};
```

## 13. 高级特性

### 13.1 多级LOD支持

```javascript
// 支持多级细节的ViewNode
function vtkLODActor(publicAPI, model) {
  model.classHierarchy.push('vtkLODActor');
  
  publicAPI.queryPass = (prepass) => {
    if (prepass) {
      // 根据距离选择LOD级别
      const camera = model._parent.getRenderable().getActiveCamera();
      const distance = publicAPI.getDistanceToCamera(camera);
      
      const lodLevel = publicAPI.selectLODLevel(distance);
      model.currentLOD = lodLevel;
      
      // 只为当前LOD创建ViewNode
      const lodMapper = model.renderable.getLODMapper(lodLevel);
      publicAPI.addMissingNode(lodMapper);
    }
  };
}
```

### 13.2 实例化渲染支持

```javascript
// 支持实例化渲染的ViewNode
function vtkInstancedActor(publicAPI, model) {
  publicAPI.queryPass = (prepass) => {
    if (prepass) {
      // 统计实例数量
      const instanceCount = model.renderable.getInstanceCount();
      
      if (instanceCount > model.instanceThreshold) {
        // 使用实例化渲染
        model._parent.incrementInstancedActorCount();
      } else {
        // 使用常规渲染
        model._parent.incrementOpaqueActorCount();
      }
    }
  };
  
  publicAPI.traverseInstancedPass = (renderPass) => {
    // 实例化渲染逻辑
    const instances = model.renderable.getInstances();
    publicAPI.renderInstances(instances, renderPass);
  };
}
```

### 13.3 动态着色器生成

```javascript
// 支持动态着色器的ViewNode
function vtkShaderGeneratedActor(publicAPI, model) {
  publicAPI.buildPass = (prepass) => {
    if (prepass) {
      // 根据材质属性生成着色器代码
      const material = model.renderable.getProperty();
      const shaderCode = publicAPI.generateShaderCode(material);
      
      // 缓存生成的着色器
      model.generatedShader = shaderCode;
    }
  };
  
  publicAPI.generateShaderCode = (material) => {
    let fragmentShader = 'precision mediump float;\n';
    
    if (material.getDiffuseTexture()) {
      fragmentShader += 'uniform sampler2D diffuseTexture;\n';
    }
    
    if (material.getNormalMap()) {
      fragmentShader += 'uniform sampler2D normalMap;\n';
    }
    
    // ... 根据材质特性生成完整着色器
    
    return fragmentShader;
  };
}
```

## 14. 扩展和插件系统

### 14.1 插件架构

```javascript
// 插件基类
class SceneGraphPlugin {
  constructor(name) {
    this.name = name;
    this.enabled = true;
  }
  
  onNodeCreated(node) {}
  onNodeDeleted(node) {}
  onTraverseBegin(renderPass) {}
  onTraverseEnd(renderPass) {}
}

// 插件管理器
class PluginManager {
  constructor() {
    this.plugins = new Map();
  }
  
  register(plugin) {
    this.plugins.set(plugin.name, plugin);
  }
  
  notifyNodeCreated(node) {
    this.plugins.forEach(plugin => {
      if (plugin.enabled) {
        plugin.onNodeCreated(node);
      }
    });
  }
}
```

### 14.2 自定义渲染Pass

```javascript
// 自定义渲染Pass
function vtkShadowPass(publicAPI, model) {
  model.classHierarchy.push('vtkShadowPass');
  
  publicAPI.traverse = (viewNode, parent = null) => {
    // 第一遍：渲染深度到阴影贴图
    publicAPI.setCurrentOperation('shadowMapPass');
    viewNode.traverse(publicAPI);
    
    // 第二遍：使用阴影贴图渲染场景
    publicAPI.setCurrentOperation('shadowRenderPass');
    viewNode.traverse(publicAPI);
  };
}

// 在Actor中支持阴影Pass
function vtkShadowActor(publicAPI, model) {
  publicAPI.traverseShadowMapPass = (renderPass) => {
    // 渲染到阴影贴图
    publicAPI.renderDepthOnly(renderPass);
  };
  
  publicAPI.traverseShadowRenderPass = (renderPass) => {
    // 使用阴影贴图的正常渲染
    publicAPI.renderWithShadows(renderPass);
  };
}
```

## 总结

vtk.js 的场景图架构是一个精心设计的系统，它成功地解决了以下关键问题：

### 设计优势

1. **抽象与实现分离**：通过ViewNode系统实现了用户接口与渲染实现的完全解耦
2. **跨平台支持**：统一的场景图接口支持OpenGL和WebGPU两种渲染后端
3. **动态性能**：支持运行时的节点添加、删除和修改
4. **渲染优化**：多阶段遍历机制优化了渲染性能
5. **扩展性**：插件化的架构支持自定义节点和渲染Pass

### 核心创新

1. **双重场景图**：维护抽象对象树和实现对象树的映射关系
2. **工厂注册系统**：`registerOverride`机制实现了灵活的实现类注册
3. **遍历驱动渲染**：将传统的渲染循环转换为场景图遍历
4. **访问者模式的渲染**：RenderPass作为访问者对场景图执行操作

### 适用场景

vtk.js 的场景图特别适合：

1. **科学可视化**：复杂的数据可视化场景
2. **医学成像**：需要精确控制渲染顺序的医学应用
3. **工程仿真**：大规模几何数据的高效渲染
4. **跨平台应用**：需要在不同图形API之间切换的应用

通过深入理解这套场景图架构，开发者可以：
- 更好地使用 vtk.js 的高级特性
- 创建自定义的渲染节点和Pass
- 优化复杂场景的渲染性能
- 扩展 vtk.js 以满足特定需求

vtk.js 的场景图不仅仅是一个数据结构，它是整个渲染系统的核心协调机制，体现了现代图形系统设计的最佳实践。