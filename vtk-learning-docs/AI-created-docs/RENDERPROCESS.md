# vtk.js 渲染过程详解

## 概述

vtk.js 的渲染系统是一个复杂的管线架构，通过多个核心类的协作实现从几何数据到最终屏幕像素的完整转换。本文档详细描述了整个渲染过程、涉及的关键类以及它们之间的协作机制。

## 核心架构组件

### 数据层次结构
```
RenderWindow
├── Renderer
    ├── Actor[]
        ├── Mapper (PolyDataMapper)
        │   ├── InputData (PolyData)
        │   └── Property
        └── OpenGLActor
            └── OpenGLPolyDataMapper
                ├── Primitives[] (Helper)
                ├── ShaderProgram
                ├── VAO (VertexArrayObject)
                └── VBO (BufferObject)
```

## 渲染流程详细分析

### 第一阶段：数据准备与连接

#### 1.1 数据对象初始化
- **PolyData**: 存储几何数据
  - `points`: Float32Array 存储顶点坐标 [x,y,z, x,y,z, ...]
  - `polys`: Uint32Array 存储面片索引 [n, i1,i2,...,in, ...]
  - `pointData`: 存储顶点相关属性
    - `scalars`: 标量数据（颜色、密度等）
    - `vectors`: 向量数据（速度、法向量等）
    - `normals`: 法向量数据
    - `tcoords`: 纹理坐标

#### 1.2 渲染对象层次构建
```javascript
// 数据流向：直接引用传递，非管线连接
const polyData = vtkPolyData.newInstance();
const mapper = vtkMapper.newInstance();
mapper.setInputData(polyData);  // 直接存储引用

const actor = vtkActor.newInstance();
actor.setMapper(mapper);        // 直接存储引用

const renderer = vtkRenderer.newInstance();
renderer.addActor(actor);       // 添加到渲染列表
```

### 第二阶段：数据更新检测

#### 2.1 MTime（Modified Time）机制
每个 vtk.js 对象都维护一个单调递增的时间戳：

```javascript
// 在 macro.js 中实现
function obj(publicAPI, model) {
  model.mtime = 0;

  publicAPI.modified = () => {
    model.mtime++;        // 数据修改时递增
    model.globalMTime++;
  };

  publicAPI.getMTime = () => model.mtime;
}
```

#### 2.2 变化检测机制
在 `OpenGLPolyDataMapper/buildBufferObjects` 中：

```javascript
// 构建变化检测字符串
const toString =
  `${poly.getMTime()}A${representation}B${poly.getMTime()}` +
  `C${n ? n.getMTime() : 1}D${c ? c.getMTime() : 1}` +
  `E${actor.getProperty().getEdgeVisibility()}` +
  `F${tcoords ? tcoords.getMTime() : 1}`;

if (model.VBOBuildString !== toString) {
  // 数据有变化，需要重建 VBO
  // 重新构建顶点缓冲对象...
  model.VBOBuildString = toString;
}
```

### 第三阶段：渲染准备

#### 3.1 数据获取路径分析

**渲染器获取数据的完整路径：**
```
RenderWindow.render()
└── Renderer.render()
    └── Actor.render()
        └── Mapper.render()
            └── OpenGLPolyDataMapper.render()
                └── buildBufferObjects()
                    ├── const poly = model.currentInput;  // 获取 PolyData
                    ├── const points = poly.getPoints();  // 获取顶点坐标
                    ├── const polys = poly.getPolys();    // 获取面片索引
                    ├── const normals = poly.getPointData().getNormals();
                    └── const colors = model.renderable.getColorMapColors();
```

#### 3.2 VBO（顶点缓冲对象）构建

在 `OpenGLPolyDataMapper/buildBufferObjects` 中：

```javascript
// 构建 VBO 的选项配置
const options = {
  points,                    // Float32Array 顶点坐标
  normals: n,               // Float32Array 法向量
  tcoords,                  // Float32Array 纹理坐标
  colors: c,                // Uint8Array 颜色数据
  cellOffset: 0,
  vertexOffset: 0,
  useTCoordsPerCell,
  haveCellScalars: model.haveCellScalars,
  haveCellNormals: model.haveCellNormals,
  customAttributes: model.renderable.getCustomShaderAttributes()
    .map((arrayName) => poly.getPointData().getArrayByName(arrayName))
};

// 为每种基元类型创建 VBO
const primitives = [
  { inRep: 'verts', cells: poly.getVerts() },
  { inRep: 'lines', cells: poly.getLines() },
  { inRep: 'polys', cells: poly.getPolys() },
  { inRep: 'strips', cells: poly.getStrips() }
];

for (let i = primTypes.Start; i < primTypes.End; i++) {
  model.primitives[i].getCABO().createVBO(
    primitives[i].cells,
    primitives[i].inRep,
    representation,
    options,
    model.selectionWebGLIdsToVTKIds
  );
}
```

### 第四阶段：着色器系统

#### 4.1 着色器模板系统

**顶点着色器模板** (`vtkPolyDataVS.glsl`)：
```glsl
attribute vec4 vertexMC;    // 模型坐标中的顶点

// 动态标记，将被具体代码替换
//VTK::System::Dec
//VTK::PositionVC::Dec      // 位置相关声明
//VTK::Normal::Dec          // 法向量相关声明
//VTK::Light::Dec           // 光照相关声明
//VTK::TCoord::Dec          // 纹理坐标声明
//VTK::Color::Dec           // 颜色声明
//VTK::Camera::Dec          // 相机矩阵声明

void main() {
  //VTK::Color::Impl        // 颜色计算实现
  //VTK::Normal::Impl       // 法向量变换实现
  //VTK::TCoord::Impl       // 纹理坐标传递
  //VTK::Clip::Impl         // 裁剪实现
  //VTK::PositionVC::Impl   // 位置变换实现（关键）
  //VTK::Light::Impl        // 光照计算
}
```

**片段着色器模板** (`vtkPolyDataFS.glsl`)：
```glsl
uniform int PrimitiveIDOffset;

//VTK::PositionVC::Dec      // 位置相关声明
//VTK::Color::Dec           // 颜色相关声明
//VTK::Normal::Dec          // 法向量声明
//VTK::Light::Dec           // 光照相关声明

void main() {
  //VTK::PositionVC::Impl   // 位置处理
  //VTK::Color::Impl        // 颜色计算
  //VTK::Normal::Impl       // 法向量处理
  //VTK::Light::Impl        // 最终光照和颜色计算（关键）
  //VTK::Clip::Impl         // 裁剪测试
}
```

#### 4.2 动态着色器构建

在 `OpenGLPolyDataMapper` 中通过一系列替换函数构建最终着色器：

```javascript
publicAPI.replaceShaderValues = (shaders, ren, actor) => {
  publicAPI.replaceShaderColor(shaders, ren, actor);      // 颜色处理
  publicAPI.replaceShaderNormal(shaders, ren, actor);     // 法向量处理
  publicAPI.replaceShaderLight(shaders, ren, actor);      // 光照计算
  publicAPI.replaceShaderTCoord(shaders, ren, actor);     // 纹理坐标
  publicAPI.replaceShaderPicking(shaders, ren, actor);    // 拾取支持
  publicAPI.replaceShaderClip(shaders, ren, actor);       // 裁剪平面
  publicAPI.replaceShaderPositionVC(shaders, ren, actor); // 位置变换
};
```

**示例：位置变换代码替换**
```javascript
// 在 replaceShaderPositionVC 中
if (lastLightComplexity > 0) {
  // 需要光照计算时，传递视图坐标
  VSSource = vtkShaderProgram.substitute(
    VSSource,
    '//VTK::PositionVC::Impl',
    [
      'vertexVCVSOutput = MCVCMatrix * vertexMC;',  // 计算视图坐标
      '  gl_Position = MCPCMatrix * vertexMC;',     // 计算最终位置
    ]
  ).result;
} else {
  // 简单情况，直接计算最终位置
  VSSource = vtkShaderProgram.substitute(
    VSSource,
    '//VTK::PositionVC::Impl',
    ['  gl_Position = MCPCMatrix * vertexMC;']
  ).result;
}
```

### 第五阶段：Uniform 变量管理

#### 5.1 矩阵 Uniform 设置

在 `setCameraShaderParameters` 中：

```javascript
publicAPI.setCameraShaderParameters = (cellBO, ren, actor) => {
  const program = cellBO.getProgram();
  const keyMats = model.openGLCamera.getKeyMatrices(ren);
  const actMats = model.openGLActor.getKeyMatrices();

  // 模型到裁剪坐标变换矩阵（MVP 矩阵）
  program.setUniformMatrix('MCPCMatrix',
    safeMatrixMultiply([
      keyMats.wcpc,              // 世界到裁剪坐标
      actMats.mcwc,              // 模型到世界坐标
      inverseShiftScaleMatrix    // 坐标偏移缩放补偿
    ], mat4, model.tmpMat4)
  );

  // 模型到视图坐标变换矩阵（用于光照计算）
  if (program.isUniformUsed('MCVCMatrix')) {
    program.setUniformMatrix('MCVCMatrix',
      safeMatrixMultiply([
        keyMats.wcvc,           // 世界到视图坐标
        actMats.mcwc,           // 模型到世界坐标
        inverseShiftScaleMatrix
      ], mat4, model.tmpMat4)
    );
  }

  // 法向量变换矩阵（3x3）
  if (program.isUniformUsed('normalMatrix')) {
    program.setUniformMatrix3x3('normalMatrix',
      safeMatrixMultiply([
        keyMats.normalMatrix,     // 法向量变换矩阵
        actMats.normalMatrix
      ], mat3, model.tmpMat3)
    );
  }
};
```

#### 5.2 材质属性 Uniform

在 `setPropertyShaderParameters` 中：

```javascript
publicAPI.setPropertyShaderParameters = (cellBO, ren, actor) => {
  const program = cellBO.getProgram();
  const ppty = actor.getProperty();

  // 基础材质属性
  program.setUniformf('opacityUniform', ppty.getOpacity());
  program.setUniform3fArray('ambientColorUniform', ppty.getAmbientColor());
  program.setUniform3fArray('diffuseColorUniform', ppty.getDiffuseColor());
  program.setUniformf('ambient', ppty.getAmbient());
  program.setUniformf('diffuse', ppty.getDiffuse());

  // 高级材质属性（镜面反射）
  if (lastLightComplexity > 0) {
    program.setUniform3fArray('specularColorUniform', ppty.getSpecularColor());
    program.setUniformf('specularPowerUniform', ppty.getSpecularPower());
    program.setUniformf('specular', ppty.getSpecular());
  }

  // 背面材质属性（双面渲染）
  if (program.isUniformUsed('ambientIntensityBF')) {
    const backPpty = actor.getBackfaceProperty();
    program.setUniformf('ambientIntensityBF', backPpty.getAmbient());
    program.setUniformf('diffuseIntensityBF', backPpty.getDiffuse());
    program.setUniform3fArray('ambientColorUniformBF', backPpty.getAmbientColor());
    program.setUniform3fArray('diffuseColorUniformBF', backPpty.getDiffuseColor());
  }
};
```

#### 5.3 动态光照 Uniform

在 `setLightingShaderParameters` 中：

```javascript
publicAPI.setLightingShaderParameters = (cellBO, ren, actor) => {
  const program = cellBO.getProgram();
  const lights = ren.getLightsByReference();
  let numberOfLights = 0;

  // 为每个激活的光源设置 uniform
  for (let index = 0; index < lights.length; ++index) {
    const light = lights[index];
    if (light.getSwitch() > 0.0) {
      // 光源颜色（强度加权）
      const dColor = light.getColorByReference();
      const intensity = light.getIntensity();
      const lightColor = [
        dColor[0] * intensity,
        dColor[1] * intensity,
        dColor[2] * intensity
      ];

      // 光源方向（视图坐标系中）
      const ld = light.getDirection();
      const transform = ren.getActiveCamera().getViewMatrix();
      const lightDirection = transformDirection(ld, transform);

      // 设置 uniform（每个光源使用不同的变量名）
      program.setUniform3fArray(`lightColor${numberOfLights}`, lightColor);
      program.setUniform3fArray(`lightDirectionVC${numberOfLights}`, lightDirection);

      // 位置光源的附加参数
      if (light.getPositional()) {
        const lightPosition = transformPosition(light.getTransformedPosition(), transform);
        program.setUniform3fArray(`lightPositionVC${numberOfLights}`, lightPosition);
        program.setUniform3fArray(`lightAttenuation${numberOfLights}`, light.getAttenuationValues());
        program.setUniformf(`lightConeAngle${numberOfLights}`, light.getConeAngle());
        program.setUniformf(`lightExponent${numberOfLights}`, light.getExponent());
        program.setUniformi(`lightPositional${numberOfLights}`, 1);
      }

      numberOfLights++;
    }
  }
};
```

### 第六阶段：最终渲染执行

#### 6.1 渲染调度

在 `OpenGLPolyDataMapper.renderPiece` 中：

```javascript
publicAPI.renderPiece = (ren, actor) => {
  // 1. 渲染准备
  publicAPI.renderPieceStart(ren, actor);
    // - 检测数据变化
    // - 更新 VBO
    // - 激活纹理

  // 2. 执行绘制
  publicAPI.renderPieceDraw(ren, actor);
    // - 遍历所有基元类型
    // - 为每个基元执行 drawArrays

  // 3. 清理工作
  publicAPI.renderPieceFinish(ren, actor);
    // - 停用纹理
    // - 重置状态
};
```

#### 6.2 基元绘制循环

在 `renderPieceDraw` 中：

```javascript
publicAPI.renderPieceDraw = (ren, actor) => {
  const representation = actor.getProperty().getRepresentation();
  const drawSurfaceWithEdges =
    actor.getProperty().getEdgeVisibility() &&
    representation === Representation.SURFACE;

  // 遍历所有基元类型（点、线、三角形、三角带）
  for (let i = primTypes.Start; i < primTypes.End; i++) {
    const cabo = model.primitives[i].getCABO();
    if (cabo.getElementCount()) {
      // 设置绘制边缘标志
      model.drawingEdges = drawSurfaceWithEdges &&
        (i === primTypes.TrisEdges || i === primTypes.TriStripsEdges);

      // 执行实际绘制
      model.lastBoundBO = model.primitives[i];
      model.primitiveIDOffset += model.primitives[i].drawArrays(
        ren, actor, representation, publicAPI
      );
    }
  }
};
```

#### 6.3 OpenGL 绘制调用

在 `Helper.drawArrays` 中：

```javascript
publicAPI.drawArrays = (ren, actor, rep, oglMapper) => {
  if (model.CABO.getElementCount()) {
    const mode = publicAPI.getOpenGLMode(rep);  // GL_TRIANGLES, GL_LINES, GL_POINTS
    const gl = model.context;

    // 1. 更新着色器程序和 uniform
    publicAPI.updateShaders(ren, actor, oglMapper);
      // - 检查是否需要重新编译着色器
      // - 设置所有 uniform 变量
      // - 绑定 VAO 和属性

    // 2. 执行实际的 OpenGL 绘制调用
    if (wideLines && mode === gl.LINES) {
      // 宽线条使用实例化渲染
      gl.drawArraysInstanced(mode, 0, model.CABO.getElementCount(),
        2 * Math.ceil(actor.getProperty().getLineWidth()));
    } else {
      // 标准绘制
      gl.drawArrays(mode, 0, model.CABO.getElementCount());
    }

    return model.CABO.getElementCount() / stride;
  }
  return 0;
};
```

## 类间协作关系总结

### 数据流向

```
用户代码
   ↓ setInputData()
PolyData (几何数据存储)
   ↓ 直接引用
Mapper (数据映射逻辑)
   ↓ 直接引用
Actor (场景对象)
   ↓ addActor()
Renderer (场景管理)
   ↓ render()
RenderWindow (渲染窗口)
```

### 渲染执行路径

```
RenderWindow.render()
   ↓
Renderer.render()
   ↓ 遍历 actors
Actor.render()
   ↓
Mapper.render()
   ↓
OpenGLPolyDataMapper.render()
   ↓
buildBufferObjects() → VBO 构建
   ↓
replaceShaderValues() → 着色器生成
   ↓
Helper.drawArrays()
   ↓
updateShaders() → Uniform 设置
   ↓
gl.drawArrays() → GPU 绘制
```

### 核心类职责

| 类名 | 主要职责 | 关键方法 |
|-----|---------|---------|
| **PolyData** | 几何数据存储 | `getPoints()`, `getPolys()`, `getPointData()` |
| **Mapper** | 数据映射与颜色处理 | `setInputData()`, `mapScalars()`, `getInputData()` |
| **Actor** | 场景对象与属性管理 | `setMapper()`, `getProperty()`, `getMatrix()` |
| **Renderer** | 场景管理与光照 | `addActor()`, `getLights()`, `getActiveCamera()` |
| **OpenGLPolyDataMapper** | OpenGL 渲染实现 | `buildBufferObjects()`, `replaceShaderValues()` |
| **Helper** | 基元渲染辅助 | `drawArrays()`, `updateShaders()` |
| **ShaderProgram** | 着色器程序管理 | `setUniformMatrix()`, `setUniformf()` |
| **CellArrayBufferObject** | 顶点缓冲管理 | `createVBO()`, `getElementCount()` |
| **VertexArrayObject** | 顶点属性管理 | `addAttributeArray()`, `bind()` |

### 数据更新检测机制

1. **MTime 机制**: 每个对象维护修改时间戳
2. **变化检测**: 通过比较 MTime 字符串检测数据变化
3. **按需更新**: 仅在数据变化时重建 VBO 和着色器
4. **缓存机制**: VBO 和着色器程序被缓存以提高性能

### 性能优化策略

1. **VBO 缓存**: 仅在数据变化时重建顶点缓冲
2. **着色器缓存**: 相同配置的着色器被重用
3. **Uniform 检查**: 仅设置着色器中实际使用的 uniform
4. **实例化渲染**: 对于重复几何体使用实例化
5. **视锥裁剪**: 在 GPU 中进行裁剪平面计算

## 总结

vtk.js 的渲染系统通过精心设计的类层次结构和数据流向，实现了高效的 3D 渲染。关键特点包括：

1. **直接引用传递**: 与传统 VTK C++ 的管线不同，使用直接引用提高性能
2. **模板化着色器**: 动态生成 GLSL 代码以适应不同渲染需求
3. **智能缓存机制**: 通过 MTime 检测变化，避免不必要的重计算
4. **模块化设计**: 每个类都有明确的职责分工
5. **WebGL 优化**: 充分利用 WebGL 特性进行性能优化

这种设计使得 vtk.js 既保持了 VTK 的强大功能，又适应了 Web 环境的特殊需求。