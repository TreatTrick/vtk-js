# registerOverride 机制详解

## 概述

vtk.js 使用 `registerOverride` 机制实现抽象类与具体实现类的映射，这是一个基于工厂模式的动态绑定系统。虽然 `vtkRenderer` 和 `vtkOpenGLRenderer` 没有直接的继承关系，但通过 ViewNode 映射模式实现了运行时的动态关联。

## 核心机制

### 1. 注册阶段 - `registerOverride` 的工作原理

当导入 OpenGL 渲染器模块时，会执行注册：

```javascript
// Sources/Rendering/OpenGL/Renderer/index.js:231
registerOverride('vtkRenderer', newInstance);
```

注册函数的实现：

```javascript
// Sources/Rendering/OpenGL/ViewNodeFactory/index.js:4-8
const CLASS_MAPPING = Object.create(null);

export function registerOverride(className, fn) {
  CLASS_MAPPING[className] = fn;  // 存储映射: 'vtkRenderer' -> vtkOpenGLRenderer.newInstance
}
```

**关键点**：
- `CLASS_MAPPING` 是一个全局映射表
- 键是抽象类名字符串 (`'vtkRenderer'`)
- 值是具体实现的构造函数 (`vtkOpenGLRenderer.newInstance`)

### 2. 工厂初始化 - ViewNodeFactory 的创建

```javascript
// Sources/Rendering/OpenGL/RenderWindow/index.js:1354
model.myFactory = vtkOpenGLViewNodeFactory.newInstance();

// Sources/Rendering/OpenGL/ViewNodeFactory/index.js:27-31
export function extend(publicAPI, model, initialValues = {}) {
  // 所有 OpenGL ViewNodeFactory 实例共享同一个 CLASS_MAPPING
  model.overrides = CLASS_MAPPING;  
  vtkViewNodeFactory.extend(publicAPI, model, initialValues);
}
```

**关键点**：
- 每个 `vtkOpenGLRenderWindow` 都有自己的 `ViewNodeFactory`
- 所有 OpenGL 工厂实例共享同一个 `CLASS_MAPPING`
- 工厂包含了所有已注册的映射关系

### 3. 运行时映射 - 从抽象到具体的转换

完整的调用链：

```javascript
// 1. RenderWindow 在 buildPass 中添加渲染器
publicAPI.addMissingNodes(model.renderable.getRenderersByReference());  
// 传入的是 vtkRenderer 实例数组

// 2. ViewNode.addMissingNode 处理单个对象
publicAPI.addMissingNode = (dobj) => {  // dobj 是 vtkRenderer 实例
  const newNode = publicAPI.createViewNode(dobj);
  if (newNode) {
    newNode.setParent(publicAPI);
    newNode.setVisited(true);
    model._renderableChildMap.set(dobj, newNode);
    model.children.push(newNode);
    return newNode;
  }
}

// 3. ViewNode.createViewNode 调用工厂
publicAPI.createViewNode = (dataObj) => {
  if (!model.myFactory) {
    vtkErrorMacro('Cannot create view nodes without my own factory');
    return null;
  }
  const ret = model.myFactory.createNode(dataObj);  // 调用 ViewNodeFactory
  if (ret) {
    ret.setRenderable(dataObj);  // 关键：绑定抽象对象到具体实现
  }
  return ret;
}

// 4. ViewNodeFactory.createNode 执行映射查找
publicAPI.createNode = (dataObject) => {  // dataObject 是 vtkRenderer 实例
  if (dataObject.isDeleted()) {
    return null;
  }

  let cpt = 0;
  let className = dataObject.getClassName(cpt++);  // 获取 "vtkRenderer"
  let isObject = false;
  const keys = Object.keys(model.overrides);
  
  // 在继承链中查找匹配的映射
  while (className && !isObject) {
    if (keys.indexOf(className) !== -1) {  // 找到 'vtkRenderer'
      isObject = true;
    } else {
      className = dataObject.getClassName(cpt++);  // 查找父类
    }
  }

  if (!isObject) {
    return null;
  }
  
  // 创建具体实现实例
  const vn = model.overrides[className]();  // 调用 vtkOpenGLRenderer.newInstance()
  vn.setMyFactory(publicAPI);
  return vn;  // 返回 vtkOpenGLRenderer 实例
}
```

## 关联机制 - ViewNode 与 Renderable 的绑定

创建完成后的关联：

```javascript
// 在 createViewNode 中
const ret = model.myFactory.createNode(dataObj);  // 创建 vtkOpenGLRenderer
if (ret) {
  ret.setRenderable(dataObj);  // vtkOpenGLRenderer.model.renderable = vtkRenderer
}

// vtkOpenGLRenderer 通过 model.renderable 访问 vtkRenderer 的数据和方法
publicAPI.updateLights = () => {
  const lights = model.renderable.getLightsByReference();  // 调用 vtkRenderer 的方法
  // ...
}
```

## 完整的映射流程

### 序列图

```
用户代码                    vtkRenderWindow              vtkOpenGLRenderWindow         ViewNodeFactory
   |                           |                            |                            |
   |-- addRenderer(vtkRenderer) -->|                         |                            |
   |                           |                            |                            |
   |                           |                            |                            |
   |-- render() ------------->|                            |                            |
   |                           |-- buildPass() ----------->|                            |
   |                           |                            |-- addMissingNodes() ----->|
   |                           |                            |                            |-- createNode(vtkRenderer)
   |                           |                            |                            |-- getClassName() -> "vtkRenderer"
   |                           |                            |                            |-- 查找 CLASS_MAPPING["vtkRenderer"]
   |                           |                            |                            |-- 调用 vtkOpenGLRenderer.newInstance()
   |                           |                            |<-- vtkOpenGLRenderer 实例 --|
   |                           |                            |-- setRenderable(vtkRenderer)
   |                           |<-- ViewNode 树构建完成 ----|
   |<-- 渲染完成 --------------|
```

### 数据结构关系

```
vtkOpenGLRenderWindow
├── model.myFactory (vtkOpenGLViewNodeFactory)
│   └── model.overrides = {
│       "vtkRenderer": vtkOpenGLRenderer.newInstance,
│       "vtkActor": vtkOpenGLActor.newInstance,
│       "vtkMapper": vtkOpenGLPolyDataMapper.newInstance,
│       // ...
│   }
└── model.children[] (ViewNode 数组)
    └── vtkOpenGLRenderer (ViewNode)
        ├── model.renderable -> vtkRenderer (原始对象)
        └── 实现具体的 OpenGL 渲染逻辑
```

## 设计模式分析

### 1. **工厂模式 (Factory Pattern)**
- `ViewNodeFactory` 根据类名创建对应的具体实现
- 支持运行时动态选择实现

### 2. **策略模式 (Strategy Pattern)**  
- 不同的渲染后端（OpenGL、WebGPU）提供不同的策略
- 通过注册机制选择具体策略

### 3. **代理模式 (Proxy Pattern)**
- `vtkOpenGLRenderer` 作为 `vtkRenderer` 的代理
- 将抽象接口转换为具体的 OpenGL 调用

### 4. **组合模式 (Composite Pattern)**
- ViewNode 树形结构管理渲染对象层次
- 统一处理单个对象和对象组合

## 设计优势

### 1. **解耦**
```javascript
// 抽象层不依赖具体实现
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';

// 具体实现通过 Profile 按需加载
import 'vtk.js/Sources/Rendering/Profiles/Geometry';
```

### 2. **可扩展性**
```javascript
// 可以注册多种实现
registerOverride('vtkRenderer', vtkOpenGLRenderer.newInstance);    // OpenGL
registerOverride('vtkRenderer', vtkWebGPURenderer.newInstance);    // WebGPU
```

### 3. **延迟加载**
- 只有导入相应的 Profile 才会注册映射
- 支持按需加载，减小打包体积

### 4. **运行时灵活性**
- 可以在运行时切换不同的渲染后端
- 支持条件加载（如 WebGPU 可用性检测）

## 注册的触发时机

### Profile 加载顺序

```javascript
// 1. 用户导入 Profile
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

// 2. Profile 导入具体实现模块  
import 'vtk.js/Sources/Rendering/OpenGL/Renderer';

// 3. 模块加载时执行注册
registerOverride('vtkRenderer', newInstance);

// 4. 后续创建工厂时就包含了映射
const factory = vtkOpenGLViewNodeFactory.newInstance();
```

## 总结

`registerOverride` 机制通过以下步骤实现抽象与具体的映射：

1. **静态注册**：模块加载时建立类名到构造函数的映射
2. **工厂创建**：RenderWindow 创建包含映射表的工厂实例  
3. **动态查找**：运行时根据对象类名查找对应的具体实现
4. **实例创建**：调用注册的构造函数创建具体实现
5. **关系绑定**：将具体实现与抽象对象关联

这种设计使得 vtk.js 能够在保持 API 简洁的同时，支持多种渲染后端，实现了真正的抽象与实现分离。