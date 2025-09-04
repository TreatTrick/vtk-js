# vtkActor 继承链详细分析

## 概述

vtkActor 是 vtk.js 渲染管线中的核心可渲染对象，代表场景中的一个3D实体。它结合了几何数据（通过Mapper）和视觉属性（通过Property）来创建完整的渲染对象。本文档详细分析 vtkActor 的完整继承链，每个类的职责和实现细节。

## 继承链结构

```
vtkObject (macros.js obj())
    ↓ 基础对象系统
vtkAlgorithm (macros.js algo())  
    ↓ 数据管道算法
vtkProp
    ↓ 渲染属性基础
vtkProp3D
    ↓ 3D变换系统
vtkActor
    ↓ 完整渲染对象

组合关系:
vtkActor ——→ vtkProperty (材质属性)
vtkActor ——→ vtkMapper (数据映射器)
```

## 详细类分析

### 1. vtkObject (基础对象系统)

**文件位置**: `Sources/macros.js` - `obj()` 函数

**核心职责**:
- 提供基础的 VTK 对象功能
- 管理对象的修改时间（mtime）系统
- 提供事件系统和生命周期管理
- 实现类层次结构管理

**关键功能**:
```javascript
// 修改时间管理 - 用于缓存失效和更新检测
publicAPI.modified = (otherMTime) => {
    model.mtime = ++globalMTime;
    callbacks.forEach((callback) => callback && callback(publicAPI));
};

// 事件订阅 - 支持观察者模式
publicAPI.onModified = (callback) => {
    const index = callbacks.length;
    callbacks.push(callback);
    return on(index);
};
```

### 2. vtkAlgorithm (数据管道算法)

**文件位置**: `Sources/macros.js` - `algo()` 函数  
**继承**: vtkObject

**核心职责**:
- 管理输入输出端口连接
- 实现数据管道的输入输出机制
- 处理数据流的传递和更新

**在Actor中的作用**: 虽然Actor本身不处理数据变换，但继承了数据管道的基础能力，为与Mapper的集成提供了框架。

### 3. vtkProp (渲染属性基础)

**文件位置**: `Sources/Rendering/Core/Prop/index.js`  
**继承**: vtkAlgorithm

**核心职责**:
- 定义可渲染对象的基本属性
- 管理可见性、拖拽性、选择性
- 处理纹理管理
- 提供渲染时间估算

**数据结构**:
```javascript
const DEFAULT_VALUES = {
    visibility: true,           // 可见性
    pickable: true,            // 可选择性
    dragable: true,            // 可拖拽性
    useBounds: true,           // 是否使用边界框
    allocatedRenderTime: 10.0, // 分配的渲染时间
    estimatedRenderTime: 0.0,  // 估计的渲染时间
    savedEstimatedRenderTime: 0.0,
    renderTimeMultiplier: 1.0, // 渲染时间乘数
    paths: null,
    textures: [],              // 纹理数组
    coordinateSystem: CoordinateSystem.WORLD, // 坐标系统
};
```

**关键方法**:

```javascript
// 纹理管理
publicAPI.addTexture = (texture) => {
    if (!texture || model.textures.indexOf(texture) !== -1) {
        return;
    }
    model.textures.push(texture);
    publicAPI.modified();
};

// 层次化属性查询
publicAPI.getNestedVisibility = () =>
    model.visibility && 
    (!model._parentProp || model._parentProp.getNestedVisibility());

publicAPI.getNestedPickable = () =>
    model.pickable && 
    (!model._parentProp || model._parentProp.getNestedPickable());

// 修改时间计算（包含纹理）
publicAPI.getMTime = () => {
    let m1 = model.mtime;
    for (let index = 0; index < model.textures.length; ++index) {
        const m2 = model.textures[index].getMTime();
        if (m2 > m1) {
            m1 = m2;
        }
    }
    return m1;
};
```

### 4. vtkProp3D (3D变换系统)

**文件位置**: `Sources/Rendering/Core/Prop3D/index.js`  
**继承**: vtkProp

**核心职责**:
- 管理3D空间中的变换（位置、旋转、缩放）
- 计算变换矩阵
- 处理边界框计算
- 管理材质属性

**数据结构**:
```javascript
const DEFAULT_VALUES = {
    origin: [0, 0, 0],           // 变换原点
    position: [0, 0, 0],         // 位置
    rotation: null,              // 旋转矩阵（4x4）
    scale: [1, 1, 1],           // 缩放
    bounds: [1, -1, 1, -1, 1, -1], // 边界框
    center: [0, 0, 0],          // 中心点
    orientation: [0, 0, 0],      // 欧拉角
    isIdentity: true,           // 是否是单位变换
    cachedProp3D: null,
    userMatrix: null,           // 用户自定义变换矩阵
    generalMatrix: null,        // 通用变换矩阵
    matrix: null,               // 最终变换矩阵
    properties: [null],         // 材质属性数组
};
```

**核心3D变换功能**:

```javascript
// 3D旋转操作
publicAPI.rotateX = (val) => {
    if (val === 0.0) return;
    mat4.rotateX(
        model.rotation,
        model.rotation,
        vtkMath.radiansFromDegrees(val)
    );
    publicAPI.modified();
};

publicAPI.rotateY = (val) => {
    if (val === 0.0) return;
    mat4.rotateY(
        model.rotation,
        model.rotation, 
        vtkMath.radiansFromDegrees(val)
    );
    publicAPI.modified();
};

// 四元数旋转支持
publicAPI.rotateQuaternion = (quaternion) => {
    const mat = mat4.create();
    mat4.fromQuat(mat, quaternion);
    mat4.multiply(model.rotation, model.rotation, mat);
    publicAPI.updateIdentityFlag();
    publicAPI.modified();
};

// 获取方向的轴角表示
publicAPI.getOrientationWXYZ = () => {
    const q = quat.create();
    mat4.getRotation(q, model.rotation);
    const oaxis = new Float64Array(3);
    const w = quat.getAxisAngle(oaxis, q);
    return [vtkMath.degreesFromRadians(w), oaxis[0], oaxis[1], oaxis[2]];
};
```

**变换矩阵计算**:

```javascript
// 计算最终变换矩阵
publicAPI.computeMatrix = () => {
    // 重置为单位矩阵
    mat4.identity(model.matrix);
    
    // 应用用户矩阵
    if (model.userMatrix) {
        mat4.multiply(model.matrix, model.matrix, model.userMatrix);
    }
    
    // 应用位置变换
    mat4.translate(model.matrix, model.matrix, model.position);
    
    // 应用旋转变换  
    mat4.multiply(model.matrix, model.matrix, model.rotation);
    
    // 应用缩放变换
    mat4.scale(model.matrix, model.matrix, model.scale);
    
    // 应用原点偏移
    mat4.translate(model.matrix, model.matrix, [
        -model.origin[0],
        -model.origin[1], 
        -model.origin[2]
    ]);
    
    // 更新单位标志
    publicAPI.updateIdentityFlag();
};
```

**边界框管理**:

```javascript
// 获取边界框（支持变换）
publicAPI.getBoundsByReference = () => {
    // 检查是否需要重新计算
    if (!model.cachedProp3D || 
        model.cachedProp3D.getMTime() < publicAPI.getMTime()) {
        
        // 获取原始边界框
        const input = publicAPI.getInputDataObject(0, 0);
        if (input && input.getBounds) {
            const bounds = input.getBounds();
            
            // 应用变换矩阵到边界框
            if (!publicAPI.getIsIdentity()) {
                vtkBoundingBox.transformBounds(bounds, publicAPI.getMatrix(), bounds);
            }
            
            model.bounds = bounds;
        } else {
            vtkBoundingBox.reset(model.bounds);
        }
        
        model.cachedProp3D = { getMTime: () => publicAPI.getMTime() };
    }
    
    return model.bounds;
};
```

**材质属性管理**:

```javascript
// 获取材质属性（支持延迟创建）
publicAPI.getProperty = () => {
    if (!model.properties[0]) {
        model.properties[0] = publicAPI.makeProperty();
        model.properties[0].setColor(1, 1, 1);
        model.properties[0].setAmbient(0.1);
        model.properties[0].setDiffuse(0.9);
        model.properties[0].setSpecular(0.1);
        model.properties[0].setSpecularPower(10.0);
        model.properties[0].setOpacity(1.0);
        model.properties[0].setInterpolation(model.interpolation);
    }
    return model.properties[0];
};

// 设置材质属性
publicAPI.setProperty = (property) => {
    if (model.properties[0] !== property) {
        model.properties[0] = property;
        publicAPI.modified();
    }
};
```

### 5. vtkActor (完整渲染对象)

**文件位置**: `Sources/Rendering/Core/Actor/index.js`  
**继承**: vtkProp3D

**核心职责**:
- 集成Mapper进行几何数据渲染
- 管理透明度和渲染状态
- 处理背面材质
- 支持选择和交互

**数据结构**:
```javascript
const DEFAULT_VALUES = {
    mapper: null,              // 数据映射器
    backfaceProperty: null,    // 背面材质属性
    forceOpaque: false,        // 强制不透明
    forceTranslucent: false,   // 强制半透明
};
```

**透明度管理核心算法**:

```javascript
// 判断对象是否不透明
publicAPI.getIsOpaque = () => {
    // 强制设置优先
    if (model.forceOpaque) return true;
    if (model.forceTranslucent) return false;
    
    // 确保材质属性存在
    if (!model.properties[0]) {
        publicAPI.getProperty(); // 延迟创建默认材质
    }
    
    // 检查材质透明度
    let isOpaque = model.properties[0].getOpacity() >= 1.0;
    
    // 检查纹理透明度
    isOpaque = isOpaque && (!model.texture || !model.texture.isTranslucent());
    
    // 检查Mapper数据透明度
    isOpaque = isOpaque && (!model.mapper || model.mapper.getIsOpaque());
    
    return isOpaque;
};

// 判断是否有半透明多边形几何体
publicAPI.hasTranslucentPolygonalGeometry = () => {
    if (model.mapper === null) return false;
    
    if (!model.properties[0]) {
        publicAPI.getProperty();
    }
    
    return !publicAPI.getIsOpaque();
};
```

**修改时间管理**:

```javascript
// Actor的mtime需要考虑背面材质
publicAPI.getMTime = () => {
    let mt = superClass.getMTime(); // 继承自Prop3D的mtime
    
    // 考虑背面材质的修改时间
    if (model.backfaceProperty !== null) {
        const time = model.backfaceProperty.getMTime();
        mt = time > mt ? time : mt;
    }
    
    return mt;
};

// 渲染相关的修改时间（包含mapper和数据）
publicAPI.getRedrawMTime = () => {
    let mt = model.mtime;
    
    if (model.mapper !== null) {
        // Mapper本身的修改时间
        let time = model.mapper.getMTime();
        mt = time > mt ? time : mt;
        
        // 输入数据的修改时间
        if (model.mapper.getInput() !== null) {
            model.mapper.getInputAlgorithm().update(); // 确保数据是最新的
            time = model.mapper.getInput().getMTime();
            mt = time > mt ? time : mt;
        }
    }
    
    return mt;
};
```

**选择和交互支持**:

```javascript
// 选择支持（依赖于mapper）
publicAPI.getSupportsSelection = () =>
    model.mapper ? model.mapper.getSupportsSelection() : false;

// 处理选择像素缓冲区
publicAPI.processSelectorPixelBuffers = (selector, pixelOffsets) => {
    if (model.mapper && model.mapper.processSelectorPixelBuffers) {
        model.mapper.processSelectorPixelBuffers(selector, pixelOffsets);
    }
};

// 获取所有Actor（用于层次化场景管理）
publicAPI.getActors = () => [publicAPI];
```

## vtkProperty (材质属性系统)

**文件位置**: `Sources/Rendering/Core/Property/index.js`

虽然不在继承链中，但vtkProperty是Actor的重要组成部分，负责定义对象的视觉外观。

**核心属性**:
```javascript
const DEFAULT_VALUES = {
    lighting: true,              // 是否启用光照
    interpolation: Interpolation.GOURAUD, // 插值模式
    representation: Representation.SURFACE, // 渲染模式
    
    // 颜色属性
    color: [1, 1, 1],           // 基础颜色
    ambient: 0.0,               // 环境光系数
    ambientColor: [1, 1, 1],    // 环境光颜色
    diffuse: 1.0,               // 漫反射系数
    diffuseColor: [1, 1, 1],    // 漫反射颜色
    specular: 0.0,              // 镜面反射系数
    specularColor: [1, 1, 1],   // 镜面反射颜色
    specularPower: 1.0,         // 镜面反射功率
    
    // 物理属性
    opacity: 1.0,               // 不透明度
    edgeVisibility: false,      // 边缘可见性
    edgeColor: [0, 0, 0],      // 边缘颜色
    lineWidth: 1.0,            // 线宽
    pointSize: 1.0,            // 点大小
    
    // 面剔除
    backfaceCulling: false,     // 背面剔除
    frontfaceCulling: false,    // 正面剔除
    
    // PBR材质属性
    metallic: 0.0,             // 金属度
    roughness: 0.5,            // 粗糙度
    normalStrength: 1.0,       // 法线强度
    emission: 0.0,             // 自发光
    baseIOR: 1.5,              // 基础折射率
};
```

**复合颜色计算**:

```javascript
// 设置颜色时同时更新环境光和漫反射颜色
publicAPI.setColor = (...args) => {
    if (args.length === 1) {
        // 单个颜色数组
        const color = args[0];
        if (model.color[0] !== color[0] || 
            model.color[1] !== color[1] || 
            model.color[2] !== color[2]) {
            
            model.color[0] = color[0];
            model.color[1] = color[1]; 
            model.color[2] = color[2];
            
            // 同步更新其他颜色分量
            publicAPI.setAmbientColor(model.color);
            publicAPI.setDiffuseColor(model.color);
            publicAPI.setSpecularColor(model.color);
            publicAPI.modified();
        }
    } else if (args.length >= 3) {
        // RGB分量
        publicAPI.setColor([args[0], args[1], args[2]]);
    }
};

// 获取复合颜色（考虑光照模型）
publicAPI.getColor = () => {
    // 根据光照模型计算最终颜色
    for (let i = 0; i < 3; i++) {
        let val = model.ambient * model.ambientColor[i];
        val += model.diffuse * model.diffuseColor[i];
        val += model.specular * model.specularColor[i];
        model.color[i] = val;
    }
    return model.color;
};
```

## 核心功能模块详解

### 1. 3D变换矩阵系统

Actor的3D变换系统基于gl-matrix库，支持完整的变换链：

```javascript
// 完整的变换管道
最终变换 = 用户矩阵 × 平移(position) × 旋转(rotation) × 缩放(scale) × 平移(-origin)

// 实际计算过程
mat4.identity(matrix);              // 重置为单位矩阵
if (userMatrix) {
    mat4.multiply(matrix, matrix, userMatrix); // 用户变换
}
mat4.translate(matrix, matrix, position);      // 位置变换
mat4.multiply(matrix, matrix, rotation);       // 旋转变换  
mat4.scale(matrix, matrix, scale);            // 缩放变换
mat4.translate(matrix, matrix, [-origin[0], -origin[1], -origin[2]]); // 原点偏移
```

### 2. 渲染管线集成

Actor在渲染管线中的作用：

```
数据源(vtkPolyData) → Mapper → Actor → Renderer → RenderWindow
                         ↓        ↓
                    几何变换   材质属性
```

**典型渲染流程**:
```javascript
// 1. 数据准备阶段
const polyData = vtkPolyData.newInstance();
const mapper = vtkMapper.newInstance();
mapper.setInputData(polyData);

// 2. Actor创建和配置
const actor = vtkActor.newInstance();
actor.setMapper(mapper);

// 3. 变换设置
actor.setPosition(1, 2, 3);
actor.rotateX(45);
actor.setScale(2, 2, 2);

// 4. 材质设置
const property = actor.getProperty();
property.setColor(1, 0, 0);
property.setOpacity(0.8);

// 5. 添加到场景
renderer.addActor(actor);
```

### 3. 透明度处理机制

vtk.js使用深度排序来正确渲染半透明对象：

```javascript
// 渲染器中的透明度处理逻辑
const opaqueActors = [];
const translucentActors = [];

actors.forEach(actor => {
    if (actor.getIsOpaque()) {
        opaqueActors.push(actor);
    } else {
        translucentActors.push(actor);
    }
});

// 先渲染不透明对象
opaqueActors.forEach(actor => renderActor(actor));

// 后渲染半透明对象（需要深度排序）
translucentActors.sort((a, b) => {
    const distA = calculateDepth(a);
    const distB = calculateDepth(b);
    return distB - distA; // 从远到近排序
});
translucentActors.forEach(actor => renderActor(actor));
```

### 4. 边界框计算与缓存

```javascript
// 高效的边界框计算
publicAPI.getBounds = () => {
    const input = publicAPI.getInputData();
    if (!input) {
        model.bounds = vtkBoundingBox.newBounds();
        return model.bounds;
    }
    
    // 检查缓存有效性
    if (!model.boundsMTime || 
        model.boundsMTime.getMTime() < publicAPI.getMTime()) {
        
        // 获取原始数据边界
        const inputBounds = input.getBounds();
        
        // 应用变换
        if (!publicAPI.getIsIdentity()) {
            vtkBoundingBox.transformBounds(
                inputBounds, 
                publicAPI.getMatrix(), 
                model.bounds
            );
        } else {
            model.bounds = [...inputBounds];
        }
        
        // 更新缓存时间戳
        model.boundsMTime.modified();
    }
    
    return model.bounds;
};
```

## 实际应用示例

基于Triangle示例的完整Actor使用：

```javascript
// 1. 创建几何数据
const trianglePolyData = vtkPolyData.newInstance();
trianglePolyData.getPoints().setData(points, 3);
trianglePolyData.getPolys().setData(triangles, 1);

// 2. 创建映射器
const mapper = vtkMapper.newInstance();
mapper.setInputData(trianglePolyData);

// 3. 创建Actor并配置
const actor = vtkActor.newInstance();
actor.setMapper(mapper);

// 4. 设置3D变换
actor.setPosition(0, 0, 0);          // 位置
actor.setOrientation(0, 45, 0);      // Y轴旋转45度
actor.setScale(2, 1, 1);             // X方向放大2倍

// 5. 配置材质属性
const property = actor.getProperty();
property.setColor(1.0, 0.2, 0.2);   // 红色
property.setOpacity(0.8);            // 80%不透明度
property.setSpecular(0.5);           // 镜面反射
property.setSpecularPower(20.0);     // 高光强度

// 6. 高级材质设置
property.setInterpolationToPhong();   // Phong着色
property.setRepresentationToSurface(); // 表面渲染
property.setEdgeVisibility(true);     // 显示边缘
property.setEdgeColor(0, 0, 1);       // 蓝色边缘

// 7. 添加到渲染器
renderer.addActor(actor);

// 8. 动画示例
function animate() {
    actor.rotateY(1); // 每帧Y轴旋转1度
    renderWindow.render();
    requestAnimationFrame(animate);
}
animate();
```

## 高级特性和最佳实践

### 1. 材质属性优化

```javascript
// 创建可重用的材质
const createMaterial = (color, opacity = 1.0) => {
    const property = vtkProperty.newInstance();
    property.setColor(...color);
    property.setOpacity(opacity);
    property.setSpecular(0.3);
    property.setSpecularPower(30);
    return property;
};

// 共享材质减少内存占用
const redMaterial = createMaterial([1, 0, 0]);
const blueMaterial = createMaterial([0, 0, 1], 0.7);

actor1.setProperty(redMaterial);
actor2.setProperty(redMaterial); // 共享同一材质
```

### 2. 变换性能优化

```javascript
// 批量变换更新
actor.setPosition(x, y, z);
actor.setOrientation(rx, ry, rz);  
actor.setScale(sx, sy, sz);
// 只在最后一次调用时触发矩阵重计算

// 避免频繁的getBounds调用
const bounds = actor.getBounds(); // 计算一次
const center = [
    (bounds[0] + bounds[1]) / 2,
    (bounds[2] + bounds[3]) / 2, 
    (bounds[4] + bounds[5]) / 2
];
```

### 3. 透明度渲染优化

```javascript
// 合理设置透明度标志
actor.setForceOpaque(true);  // 确定不透明时设置此标志
actor.setForceTranslucent(true); // 确定半透明时设置此标志

// 避免不必要的透明度计算
if (opacity === 1.0) {
    property.setOpacity(1.0);
    actor.setForceOpaque(true);
}
```

### 4. 内存管理

```javascript
// 正确的资源清理
actor.delete();           // 清理Actor
mapper.delete();          // 清理Mapper  
property.delete();        // 清理材质
polyData.delete();        // 清理数据

// 或使用垃圾回收友好的方式
actor = null;
mapper = null;
property = null;
```

## 总结

vtkActor的继承链体现了分层设计的优势：

1. **vtkObject**: 提供基础对象系统和事件机制
2. **vtkAlgorithm**: 实现数据管道基础设施  
3. **vtkProp**: 定义可渲染对象的通用属性
4. **vtkProp3D**: 添加完整的3D变换能力
5. **vtkActor**: 实现完整的3D渲染对象功能

这种设计使得：
- **职责清晰**: 每层专注于特定功能
- **可扩展性**: 易于添加新的3D对象类型
- **代码重用**: 基础功能可在多个类间共享
- **性能优化**: 分层缓存和延迟计算

vtkActor通过组合vtkMapper和vtkProperty，配合完善的3D变换系统，为vtk.js提供了强大而灵活的3D对象渲染能力，是整个可视化系统的核心组件。