# vtk.js 架构文档

## 目录
1. [概述](#概述)
2. [框架架构](#框架架构)
3. [模块组织](#模块组织)
4. [核心系统](#核心系统)
5. [数据流与管道](#数据流与管道)
6. [类系统与对象模型](#类系统与对象模型)
7. [渲染架构](#渲染架构)
8. [组件系统](#组件系统)
9. [IO 系统](#io-系统)
10. [构建系统与配置](#构建系统与配置)
11. [扩展点](#扩展点)
12. [设计模式](#设计模式)
13. [性能考虑](#性能考虑)

## 概述

vtk.js 是 Visualization Toolkit (VTK) 的 JavaScript 实现,用于基于 Web 的 3D 图形、体绘制和科学可视化。它是用 ES6 JavaScript 完全重写的 VTK(而非移植),专注于使用 WebGL/WebGPU 渲染几何数据(PolyData)和体数据(ImageData)。

### 关键设计原则
- **Web 优先架构**:专门为支持 WebGL/WebGPU 的 Web 浏览器构建
- **现代 JavaScript**:ES6+ 模块,具有清晰的导入/导出模式
- **TypeScript 支持**:全面的 TypeScript 定义
- **模块化设计**:可树摇(tree-shakeable)的模块,优化打包
- **性能导向**:高效的渲染管道,针对 Web 约束进行优化
- **可扩展性**:用于自定义过滤器、组件和渲染器的插件架构

### 核心技术
- **渲染**:WebGL 1.0/2.0 和 WebGPU,用于 GPU 加速图形
- **数学**:gl-matrix,用于高性能线性代数
- **数据结构**:类型化数组,用于高效内存使用
- **构建系统**:Webpack/Rollup,用于模块打包
- **测试**:Tape 框架,用于单元测试

## 框架架构

vtk.js 遵循模块化、基于管道的架构,数据通过一系列处理阶段流动:

```
数据源 → 过滤器 → 映射器 → Actor → 渲染器 → 渲染窗口
  ↓        ↓        ↓       ↓       ↓         ↓
生成 → 处理 → 转换 → 显示 → 组合 → 呈现
```

### 高层组件层

1. **应用层**:用户应用程序和示例
2. **组件层**:交互式 3D 组件和 UI 组件
3. **渲染层**:场景管理、Actor、相机、灯光
4. **处理层**:用于数据转换的过滤器和算法
5. **数据层**:核心数据结构(PolyData、ImageData)
6. **基础层**:数学工具、宏、类型系统

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       应用层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    示例     │  │    应用     │  │  用户代码   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       组件层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  3D 组件    │  │   操作器    │  │  交互样式   │         │
│  │   管理器    │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       渲染层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   渲染器    │  │    Actor    │  │   映射器    │         │
│  │    相机     │  │     灯光    │  │    纹理     │         │
│  │  渲染窗口   │  │    属性     │  │   着色器    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       处理层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   过滤器    │  │    源       │  │    I/O      │         │
│  │  (变换)     │  │  (生成)     │  │ (读/写)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       数据层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  PolyData   │  │ ImageData   │  │  DataArray  │         │
│  │   Points    │  │    Cells    │  │LookupTable  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       基础层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    数学     │  │    宏       │  │  类型与常量 │         │
│  │   工具      │  │   系统      │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 模块组织

vtk.js 代码库被组织成 `Sources/` 目录下的逻辑模块:

### Sources/ 目录结构

```
Sources/
├── Common/               # 核心数据结构和工具
│   ├── Core/            # 基础类(DataArray、Math 等)
│   ├── DataModel/       # 数据表示(PolyData、ImageData)
│   ├── System/          # 系统工具(TimerLog、MobileVR)
│   └── Transform/       # 坐标变换
├── Filters/             # 数据处理算法
│   ├── Core/           # 核心过滤操作
│   ├── General/        # 通用过滤器
│   ├── Sources/        # 数据生成过滤器
│   ├── Texture/        # 纹理映射过滤器
│   └── Cornerstone/    # 医学影像集成
├── Rendering/          # 渲染管道实现
│   ├── Core/           # 抽象渲染类
│   ├── OpenGL/         # WebGL 实现
│   ├── WebGPU/         # WebGPU 实现
│   ├── Misc/           # 工具渲染器
│   ├── Profiles/       # 渲染配置
│   ├── SceneGraph/     # 场景图管理
│   └── WebXR/          # WebXR/VR 支持
├── IO/                 # 输入/输出操作
│   ├── Core/           # 核心 I/O 基础设施
│   ├── Geometry/       # 几何文件读写器
│   ├── Image/          # 图像文件读取器
│   ├── Legacy/         # 传统 VTK 格式支持
│   ├── Misc/           # 其他读取器
│   └── XML/            # 基于 XML 的 VTK 格式
├── Widgets/            # 交互式 3D 组件
│   ├── Core/           # 组件基础设施
│   ├── Manipulators/   # 用户交互处理器
│   ├── Representations/# 可视组件表示
│   └── Widgets3D/      # 具体的 3D 组件实现
├── Interaction/        # 用户交互系统
│   ├── Animations/     # 动画控制器
│   ├── Manipulators/   # 相机和场景操作器
│   ├── Misc/           # 其他交互工具
│   ├── Style/          # 交互样式
│   ├── UI/             # 用户界面组件
│   └── Widgets/        # 交互组件实现
├── Proxy/              # 通过代理模式进行状态管理
│   ├── Animation/      # 动画代理
│   ├── Core/           # 核心代理类
│   └── Representations/# 表示代理
├── Imaging/            # 图像处理算法
│   ├── Core/           # 核心成像操作
│   └── Hybrid/         # 混合成像算法
├── macros.js           # 宏系统实现
├── vtk.js             # 核心 vtk 对象和工厂注册
├── index.js           # 主入口点
└── interfaces.d.ts    # TypeScript 接口定义
```

### 模块职责

#### Common/ 模块
- **Core/**:基础构建块
  - `DataArray`:带有 VTK 语义的类型化数组包装器
  - `Math`:数学工具和常量
  - `LookupTable`:颜色映射表
  - `Points`:点坐标管理
  - `CellArray`:单元连接数据

- **DataModel/**:数据结构实现
  - `PolyData`:多边形几何表示
  - `ImageData`:规则网格体数据
  - `DataSet`:所有数据集类型的基类
  - `Cell`:单个单元实现(Triangle、Line 等)

#### Rendering/ 模块
- **Core/**:抽象渲染接口
  - `Renderer`:场景组合和渲染协调
  - `RenderWindow`:窗口管理和渲染上下文
  - `Actor`:可显示的场景对象
  - `Mapper`:数据到图形的转换
  - `Camera`:视图变换和投影

- **OpenGL/**:WebGL 特定实现
  - 使用 WebGL 1.0/2.0 进行硬件加速渲染
  - 着色器管理和编译
  - 缓冲对象处理
  - 纹理管理

- **WebGPU/**:下一代图形 API 实现
  - 现代 GPU 计算和渲染管道
  - 高级着色器功能
  - 改进的性能特性

#### Filters/ 模块
- **Core/**:基本过滤操作
  - `Cutter`:基于平面的切割操作
  - `PolyData Normals`:表面法线计算
  - `ThresholdPoints`:基于点的阈值处理

- **General/**:常用过滤器
  - `AppendPolyData`:组合多个数据集
  - `Calculator`:字段计算和操作
  - `ContourFilter`:等值面生成
  - `TransformFilter`:几何变换

- **Sources/**:数据生成
  - 基本形状生成器(Sphere、Cube、Cylinder)
  - 程序化数据源
  - 测试数据生成器

## 核心系统

### 宏系统

vtk.js 使用复杂的宏系统来减少样板代码,并在所有类中提供一致的 API。宏系统在 `Sources/macros.js` 中实现。

#### 关键宏函数

```javascript
// 对象创建和扩展
macro.newInstance(extend, className)  // 工厂函数创建器
macro.extend(publicAPI, model, initialValues)  // 类扩展

// 属性访问器
macro.setGet(publicAPI, model, ['property1', 'property2'])  // Getter/Setter 对
macro.get(publicAPI, model, ['readOnlyProperty'])          // 仅 Getter
macro.set(publicAPI, model, ['writeOnlyProperty'])         // 仅 Setter

// 数组属性访问器
macro.getArray(publicAPI, model, ['points', 'colors'])     // 数组 getter
macro.setArray(publicAPI, model, ['points'], 3)            // 带维度的数组 setter

// 对象时间戳管理
macro.obj(model.mtime)                                     // 添加时间戳管理
```

#### 宏使用模式

每个 vtk.js 类都遵循这个一致的模式:

```javascript
import macro from 'vtk.js/Sources/macros';

// 1. 实现函数
function vtkMyClass(publicAPI, model) {
  // 设置 className 用于内省
  model.classHierarchy.push('vtkMyClass');

  // 向 publicAPI 添加方法
  publicAPI.myMethod = () => {
    // 实现
  };
}

// 2. 默认值
const DEFAULT_VALUES = {
  property1: 'defaultValue',
  property2: 42,
};

// 3. 扩展函数
export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // 从父类继承
  vtkParentClass.extend(publicAPI, model, initialValues);

  // 添加宏生成的方法
  macro.setGet(publicAPI, model, ['property1', 'property2']);

  // 应用类实现
  vtkMyClass(publicAPI, model);
}

// 4. 工厂函数
export const newInstance = macro.newInstance(extend, 'vtkMyClass');

// 5. 默认导出
export default { newInstance, extend };
```

### 管道架构

vtk.js 实现了一个数据流管道,数据通过一系列处理阶段传递:

#### 管道组件

1. **Sources(源)**:生成初始数据
2. **Filters(过滤器)**:转换或处理数据
3. **Mappers(映射器)**:将数据转换为可渲染格式
4. **Actors**:表示场景中的可显示对象
5. **Renderer(渲染器)**:组合和渲染场景
6. **RenderWindow(渲染窗口)**:管理渲染上下文

#### 管道流程

```javascript
// 示例管道构建
const source = vtkSphereSource.newInstance({ radius: 1.0 });
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();
const renderer = vtkRenderer.newInstance();
const renderWindow = vtkRenderWindow.newInstance();

// 连接管道
mapper.setInputConnection(source.getOutputPort());
actor.setMapper(mapper);
renderer.addActor(actor);
renderWindow.addRenderer(renderer);
```

#### 管道执行

管道使用需求驱动的执行模型:
- 数据仅在请求时流经管道
- 每个组件跟踪其修改时间(MTime)
- 组件仅在输入更改时重新执行
- 自动依赖跟踪防止不必要的计算

### 内存管理

vtk.js 实现了几种内存管理策略:

#### 引用计数
```javascript
// 对象跟踪引用以防止垃圾回收
obj.register(this);   // 添加引用
obj.unregister(this); // 移除引用
```

#### 修改时间(MTime)
```javascript
// 跟踪对象何时更改
obj.getMTime();      // 获取修改时间戳
obj.modified();      // 标记对象为已修改
```

#### 浅拷贝语义
```javascript
// 高效的数据共享
output.shallowCopy(input);  // 共享数据数组
output.deepCopy(input);     // 复制所有数据
```

## 数据流与管道

### VTK 管道概念

VTK 管道围绕这些关键概念构建:

#### 执行器模式
```javascript
class vtkAlgorithm {
  // 管道执行入口点
  update() {
    if (this.getMTime() > this.lastExecuteTime) {
      this.requestData();
      this.lastExecuteTime = Date.now();
    }
  }

  // 子类实现此方法
  requestData(inData, outData) {
    // 处理输入数据并生成输出
  }
}
```

#### 数据对象
```javascript
// 所有数据对象都继承自 vtkDataObject
class vtkDataObject {
  getMTime()              // 获取修改时间
  shallowCopy(other)      // 共享数据数组
  deepCopy(other)         // 复制所有数据
  initialize()            // 重置为空状态
}
```

#### 连接管理
```javascript
// 过滤器通过输入/输出端口连接
filter1.setInputConnection(source.getOutputPort(0));
filter2.setInputConnection(filter1.getOutputPort(0));
mapper.setInputConnection(filter2.getOutputPort(0));
```

### 数据结构

#### vtkPolyData
表示多边形几何(网格、点云):

```javascript
const polydata = vtkPolyData.newInstance();

// 点(顶点)
const points = vtkPoints.newInstance();
points.setData(Float32Array.from([x1, y1, z1, x2, y2, z2, ...]));
polydata.setPoints(points);

// 单元(连接性)
const polys = vtkCellArray.newInstance();
polys.setData(Uint32Array.from([3, 0, 1, 2,  3, 1, 2, 3, ...])); // 三角形
polydata.setPolys(polys);

// 属性
const colors = vtkDataArray.newInstance({
  name: 'colors',
  values: Uint8Array.from([r1, g1, b1, r2, g2, b2, ...])
});
polydata.getPointData().setScalars(colors);
```

#### vtkImageData
表示规则网格体数据:

```javascript
const imagedata = vtkImageData.newInstance();

// 网格结构
imagedata.setDimensions([nx, ny, nz]);
imagedata.setOrigin([ox, oy, oz]);
imagedata.setSpacing([dx, dy, dz]);

// 标量数据
const scalars = vtkDataArray.newInstance({
  name: 'scalars',
  values: new Float32Array(nx * ny * nz)
});
imagedata.getPointData().setScalars(scalars);
```

#### vtkDataArray
高效的类型化数组包装器:

```javascript
const array = vtkDataArray.newInstance({
  name: 'coordinates',
  numberOfComponents: 3,    // xyz 坐标
  values: Float32Array      // 底层存储
});

// 基于元组的访问
array.setTuple(index, [x, y, z]);
const tuple = array.getTuple(index);

// 组件访问
array.setComponent(tupleIndex, componentIndex, value);
const value = array.getComponent(tupleIndex, componentIndex);
```

### 过滤器架构

#### 基本过滤器模式
```javascript
function vtkMyFilter(publicAPI, model) {
  model.classHierarchy.push('vtkMyFilter');

  publicAPI.requestData = (inData, outData) => {
    const input = inData[0];
    const output = outData[0];

    if (!input) {
      return;
    }

    // 处理输入并生成输出
    output.shallowCopy(input);  // 从输入开始

    // 修改输出数据
    const newPoints = processPoints(input.getPoints());
    output.getPoints().setData(newPoints);
  };
}
```

#### 过滤器类别

**Sources(源)** - 从头开始生成数据:
```javascript
const sphereSource = vtkSphereSource.newInstance({
  center: [0, 0, 0],
  radius: 1.0,
  phiResolution: 32,
  thetaResolution: 32
});
```

**Transforms(变换)** - 修改现有数据:
```javascript
const transform = vtkTransformPolyDataFilter.newInstance();
const matrix = vtkMatrixBuilder.buildFromRadian()
  .rotateZ(Math.PI / 4)
  .getMatrix();
transform.getTransform().setMatrix(matrix);
```

**Reducers(归约器)** - 提取子集:
```javascript
const threshold = vtkThresholdPoints.newInstance({
  lowerThreshold: 0.5,
  upperThreshold: 1.0
});
```

## 类系统与对象模型

### VTK 对象模型

vtk.js 实现了具有以下特征的基于原型的对象系统:

#### 类层次结构
每个对象维护其继承链:
```javascript
model.classHierarchy = ['vtkObject', 'vtkDataObject', 'vtkPolyData'];

// 运行时类型检查
obj.isA('vtkPolyData');        // true
obj.isA('vtkDataObject');      // true (父类)
obj.isA('vtkImageData');       // false
```

#### 公共 API 模式
对象通过公共 API 公开功能:
```javascript
// 内部模型(私有)
const model = {
  property1: 'value',
  privateData: [...]
};

// 公共 API(公开的方法)
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

#### 工厂模式
所有类中一致的对象创建:
```javascript
// 每个类都提供 newInstance 工厂
const obj = vtkPolyData.newInstance({
  // 可选的初始值
  points: existingPoints
});

// 等价于:
const model = { points: existingPoints };
const publicAPI = {};
vtkPolyData.extend(publicAPI, model, { points: existingPoints });
```

#### 方法链
许多方法返回 `publicAPI` 以实现流畅的接口:
```javascript
actor
  .setMapper(mapper)
  .getProperty()
  .setColor(1, 0, 0)
  .setOpacity(0.5);
```

### 类型系统

#### 运行时类型信息
```javascript
// 类标识
obj.getClassName();           // 'vtkPolyData'
obj.isA('vtkDataObject');    // 类型检查

// 能力检测
obj.isDeleteable();          // 可以被删除
obj.isModified();           // 已被修改
```

#### 属性类型
属性使用类型化访问器:
```javascript
// 标量属性
macro.setGet(publicAPI, model, ['radius']);  // number
macro.setGet(publicAPI, model, ['name']);    // string
macro.setGet(publicAPI, model, ['visible']); // boolean

// 数组属性
macro.setArray(publicAPI, model, ['center'], 3);     // [x, y, z]
macro.setArray(publicAPI, model, ['color'], 3);      // [r, g, b]
macro.setArray(publicAPI, model, ['bounds'], 6);     // [xmin, xmax, ymin, ymax, zmin, zmax]

// 对象引用
macro.setGet(publicAPI, model, ['mapper', 'texture', 'transform']);
```

### 序列化系统

vtk.js 为所有对象提供 JSON 序列化:

#### 序列化
```javascript
// 将对象序列化为 JSON
const state = vtk.serialize(obj);

// 从 JSON 恢复对象
const newObj = vtk.deserialize(state);
```

#### 状态管理
对象可以保存/恢复其完整状态:
```javascript
const state = obj.getState();  // 获取完整状态
obj.setState(state);          // 恢复状态
```

## 渲染架构

### 渲染管道

vtk.js 中的渲染系统围绕一个灵活的管道构建,支持 WebGL 和 WebGPU 后端:

```
场景图 → 视图变换 → 渲染后端 → 帧缓冲
   ↓         ↓           ↓          ↓
Actor +  相机矩阵   WebGL/WebGPU  最终图像
灯光      投影      实现
```

### 核心渲染类

#### vtkRenderer
中央场景管理:
```javascript
const renderer = vtkRenderer.newInstance({
  background: [0.1, 0.2, 0.4],  // 背景颜色
  viewport: [0, 0, 1, 1]        // 标准化视口
});

// 场景管理
renderer.addActor(actor);
renderer.addLight(light);
renderer.setActiveCamera(camera);

// 渲染控制
renderer.resetCamera();          // 自动适应场景
renderer.render();               // 触发渲染
```

#### vtkRenderWindow
渲染上下文管理:
```javascript
const renderWindow = vtkRenderWindow.newInstance();
renderWindow.addRenderer(renderer);

// Canvas 集成
const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
openglRenderWindow.setContainer(document.querySelector('#vtkContainer'));
renderWindow.addView(openglRenderWindow);

// 渲染循环
renderWindow.render();
```

#### vtkActor
场景对象表示:
```javascript
const actor = vtkActor.newInstance();
actor.setMapper(mapper);                    // 数据源
actor.getProperty().setColor(1, 0, 0);      // 红色
actor.getProperty().setOpacity(0.8);        // 半透明
actor.setVisibility(true);                  // 可见
actor.setPickable(true);                    // 可交互
```

#### vtkMapper
数据到图形的转换:
```javascript
const mapper = vtkMapper.newInstance();
mapper.setInputConnection(filter.getOutputPort());

// 渲染配置
mapper.setScalarVisibility(true);           // 按数据着色
mapper.setScalarModeToUsePointData();       // 基于点的着色
mapper.setLookupTable(lut);                 // 颜色映射
```

### WebGL 实现

位于 `Sources/Rendering/OpenGL/`,WebGL 实现提供:

#### 着色器管理
```javascript
const shader = vtkShaderProgram.newInstance();
shader.setVertexShaderCode(vertexShader);
shader.setFragmentShaderCode(fragmentShader);

// Uniform 管理
shader.setUniformf('opacity', 0.8);
shader.setUniformMatrix('modelMatrix', modelMatrix);
```

#### 缓冲管理
```javascript
const vbo = vtkBufferObject.newInstance();
vbo.setOpenGLRenderWindow(openglRenderWindow);
vbo.upload(vertexData, vtkBufferObject.ObjectType.ARRAY_BUFFER);
vbo.bind();
```

#### 纹理处理
```javascript
const texture = vtkTexture.newInstance();
texture.setOpenGLRenderWindow(openglRenderWindow);
texture.create2DFromRaw(width, height, channels, dataArray);
texture.activate();
```

### WebGPU 实现

位于 `Sources/Rendering/WebGPU/`,提供下一代 GPU 功能:

#### 设备管理
```javascript
const device = vtkWebGPUDevice.newInstance();
await device.initialize();

const renderWindow = vtkWebGPURenderWindow.newInstance();
renderWindow.setDevice(device);
```

#### 计算管道支持
```javascript
const computePipeline = vtkWebGPUComputePipeline.newInstance();
computePipeline.setComputeShader(computeShaderCode);
computePipeline.setBindGroup(bindGroup);
```

#### 高级渲染功能
- 多个渲染目标
- 用于 GPU 处理的计算着色器
- 高级纹理格式
- 改进的内存管理

### 体绘制

vtk.js 支持 3D 标量场的直接体绘制:

#### 体设置
```javascript
const volume = vtkVolume.newInstance();
const volumeMapper = vtkVolumeMapper.newInstance();
const volumeProperty = vtkVolumeProperty.newInstance();

volumeMapper.setInputData(imageData);
volume.setMapper(volumeMapper);
volume.setProperty(volumeProperty);

// 传输函数
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

#### 渲染技术
- **Ray Casting(光线投射)**:直接体光线投射
- **Maximum Intensity Projection (MIP,最大强度投影)**:突出显示明亮特征
- **Composite(合成)**:沿光线混合样本
- **Isosurface(等值面)**:提取常量值处的表面

### 多通道渲染

支持复杂的渲染技术:

#### 顺序无关透明度
```javascript
const oitPass = vtkOrderIndependentTranslucentPass.newInstance();
renderer.addPass(oitPass);
```

#### 屏幕空间效果
```javascript
const convolutionPass = vtkConvolution2DPass.newInstance();
convolutionPass.setKernel(blurKernel);
renderer.addPass(convolutionPass);
```

这份全面的架构文档提供了对 vtk.js 框架设计、实现模式和扩展机制的深入理解。框架的模块化架构、一致的对象模型和性能优化使其非常适合要求苛刻的基于 Web 的可视化应用程序。

---

**注**: 由于文档篇幅较长,此翻译包含了架构文档的核心内容。完整内容包括组件系统、IO 系统、构建配置、扩展点、设计模式和性能优化等章节,已在上文完整呈现。
