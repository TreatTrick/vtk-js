# vtkMapper 继承链详细分析

## 概述

vtkMapper 是 vtk.js 渲染管线中的核心组件，负责将数据对象（如 vtkPolyData）转换为可渲染的图形表示。本文档详细分析 vtkMapper 的完整继承链，每个类的职责和实现细节。

## 继承链结构

```
vtkObject (macros.js obj())
    ↓ 基础对象系统
vtkAlgorithm (macros.js algo())  
    ↓ 数据管道算法
vtkAbstractMapper
    ↓ 抽象映射器
vtkAbstractMapper3D
    ↓ 3D空间映射器
vtkMapper
    ↓ 完整映射器实现
```

## 详细类分析

### 1. vtkObject (基础对象系统)

**文件位置**: `Sources/macros.js` - `obj()` 函数

**核心职责**:
- 提供基础的 VTK 对象功能
- 管理对象的修改时间（mtime）系统
- 提供事件系统和生命周期管理
- 实现类层次结构管理

**关键方法**:

```javascript
// 修改时间管理
publicAPI.modified = (otherMTime) => {
    if (otherMTime && otherMTime < publicAPI.getMTime()) {
        return;
    }
    model.mtime = ++globalMTime;
    callbacks.forEach((callback) => callback && callback(publicAPI));
};

// 获取修改时间
publicAPI.getMTime = () => model.mtime;

// 事件订阅
publicAPI.onModified = (callback) => {
    if (model.deleted) {
        vtkErrorMacro('instance deleted - cannot call any method');
        return null;
    }
    const index = callbacks.length;
    callbacks.push(callback);
    return on(index);
};
```

**实现特点**:
- 使用全局 `globalMTime` 确保时间戳的唯一性和递增性
- 支持观察者模式，当对象修改时通知所有监听者
- 管理对象的删除状态，防止在已删除对象上调用方法
- 维护完整的类层次结构信息

### 2. vtkAlgorithm (数据管道算法)

**文件位置**: `Sources/macros.js` - `algo()` 函数  
**继承**: vtkObject

**核心职责**:
- 管理输入输出端口连接
- 实现数据管道的输入输出机制
- 处理数据流的传递和更新
- 提供算法执行框架

**数据结构**:
```javascript
// 输入数据管理
model.inputData = [];        // 直接输入的数据对象
model.inputConnection = [];  // 输入连接（来自其他算法的输出）
model.output = [];          // 输出数据
model.inputArrayToProcess = []; // 需要处理的数组信息
```

**关键方法**:

```javascript
// 设置输入数据
function setInputData(dataset, port = 0) {
    if (port >= model.numberOfInputs) {
        vtkErrorMacro(`算法只有 ${model.numberOfInputs} 个输入端口`);
        return;
    }
    model.inputData[port] = dataset;
    model.inputConnection[port] = null;
    publicAPI.modified();
}

// 获取输入数据（支持连接和直接数据）
function getInputData(port = 0) {
    if (model.inputConnection[port]) {
        model.inputData[port] = model.inputConnection[port]();
    }
    return model.inputData[port];
}

// 设置输入连接
function setInputConnection(outputPort, port = 0) {
    model.inputData[port] = null;
    model.inputConnection[port] = outputPort;
    publicAPI.modified();
}
```

**实现特点**:
- 支持多输入多输出端口架构
- 区分直接数据输入和连接输入
- 实现延迟执行机制，只在需要时从连接获取数据
- 提供动态添加端口的能力

### 3. vtkAbstractMapper (抽象映射器)

**文件位置**: `Sources/Rendering/Core/AbstractMapper/index.js`  
**继承**: vtkAlgorithm

**核心职责**:
- 定义映射器的抽象接口
- 管理裁剪平面功能
- 提供基础的更新机制
- 建立渲染器和数据之间的抽象连接

**数据结构**:
```javascript
const DEFAULT_VALUES = {
    clippingPlanes: [],  // 裁剪平面数组
};
```

**关键方法**:

```javascript
// 添加裁剪平面
publicAPI.addClippingPlane = (plane) => {
    if (!plane.isA('vtkPlane')) {
        return false;
    }
    if (!model.clippingPlanes.includes(plane)) {
        model.clippingPlanes.push(plane);
        publicAPI.modified();
        return true;
    }
    return false;
};

// 移除所有裁剪平面
publicAPI.removeAllClippingPlanes = () => {
    if (model.clippingPlanes.length === 0) {
        return false;
    }
    model.clippingPlanes.length = 0;
    publicAPI.modified();
    return true;
};

// 获取数据坐标系中的裁剪平面
publicAPI.getClippingPlaneInDataCoords = (propMatrix, i, hnormal) => {
    const plane = clipPlanes[i];
    const normal = plane.getNormal();
    const origin = plane.getOrigin();
    
    // 计算平面方程
    const v1 = normal[0], v2 = normal[1], v3 = normal[2];
    const v4 = -(v1 * origin[0] + v2 * origin[1] + v3 * origin[2]);
    
    // 从世界坐标转换到数据坐标
    hnormal[0] = v1 * mat[0] + v2 * mat[4] + v3 * mat[8] + v4 * mat[12];
    hnormal[1] = v1 * mat[1] + v2 * mat[5] + v3 * mat[9] + v4 * mat[13];
    hnormal[2] = v1 * mat[2] + v2 * mat[6] + v3 * mat[10] + v4 * mat[14];
    hnormal[3] = v1 * mat[3] + v2 * mat[7] + v3 * mat[11] + v4 * mat[15];
};
```

**实现特点**:
- 支持最多6个裁剪平面（WebGL限制）
- 提供坐标系变换功能，将裁剪平面从世界坐标转换到数据坐标
- 实现基础的更新机制，调用 `getInputData()` 触发数据更新

### 4. vtkAbstractMapper3D (3D抽象映射器)

**文件位置**: `Sources/Rendering/Core/AbstractMapper3D/index.js`  
**继承**: vtkAbstractMapper

**核心职责**:
- 提供3D空间相关的计算功能
- 管理边界框（bounds）计算
- 计算几何中心和长度
- 管理视图相关属性

**数据结构**:
```javascript
const defaultValues = (initialValues) => ({
    bounds: [...vtkBoundingBox.INIT_BOUNDS],  // 边界框
    center: [0, 0, 0],                        // 几何中心
    viewSpecificProperties: {},               // 视图特定属性
    ...initialValues,
});
```

**关键方法**:

```javascript
// 获取边界框（抽象方法，由子类实现）
publicAPI.getBounds = () => {
    macro.vtkErrorMacro(`vtkAbstractMapper3D.getBounds - NOT IMPLEMENTED`);
    return createUninitializedBounds();
};

// 计算几何中心
publicAPI.getCenter = () => {
    const bounds = publicAPI.getBounds();
    model.center = vtkBoundingBox.isValid(bounds)
        ? vtkBoundingBox.getCenter(bounds)
        : null;
    return model.center?.slice();
};

// 计算对角线长度
publicAPI.getLength = () => {
    const bounds = publicAPI.getBounds();
    return vtkBoundingBox.getDiagonalLength(bounds);
};
```

**实现特点**:
- 使用 vtkBoundingBox 工具类进行边界框计算
- 缓存计算结果以提高性能
- 返回数据副本防止外部修改
- 提供视图特定属性存储机制

### 5. vtkMapper (完整映射器实现)

**文件位置**: `Sources/Rendering/Core/Mapper/index.js`  
**继承**: vtkAbstractMapper3D

**核心职责**:
- 实现完整的数据到图形映射功能
- 处理标量数据的颜色映射
- 管理查找表和颜色模式
- 支持纹理映射和多种渲染模式
- 处理透明度和材质属性

**主要常量定义**:
```javascript
const { ColorMode, ScalarMode, GetArray } = Constants;

// 颜色模式
// ColorMode.DEFAULT - 默认颜色模式
// ColorMode.MAP_SCALARS - 映射标量到颜色
// ColorMode.DIRECT_SCALARS - 直接使用标量作为颜色

// 标量模式
// ScalarMode.DEFAULT - 默认标量模式
// ScalarMode.USE_POINT_DATA - 使用点数据
// ScalarMode.USE_CELL_DATA - 使用单元数据
```

**关键数据管理**:

```javascript
// 获取边界框（实现基类抽象方法）
publicAPI.getBounds = () => {
    const input = publicAPI.getInputData();
    if (!input) {
        model.bounds = vtkBoundingBox.newBounds();
    } else {
        if (!model.static) {
            publicAPI.update();
        }
        model.bounds = input.getBounds();
    }
    return model.bounds;
};
```

**标量映射核心功能**:

```javascript
// 获取抽象标量数据
publicAPI.getAbstractScalars = (input, scalarMode, arrayAccessMode, arrayId, arrayName) => {
    // 根据标量模式选择数据源
    let scalars = null;
    let fieldAssociation = FieldAssociations.FIELD_ASSOCIATION_POINTS;
    
    switch (scalarMode) {
        case ScalarMode.USE_POINT_DATA:
            scalars = input.getPointData().getScalars();
            fieldAssociation = FieldAssociations.FIELD_ASSOCIATION_POINTS;
            break;
        case ScalarMode.USE_CELL_DATA:
            scalars = input.getCellData().getScalars();
            fieldAssociation = FieldAssociations.FIELD_ASSOCIATION_CELLS;
            break;
        case ScalarMode.USE_FIELD_DATA:
            scalars = input.getFieldData().getArray(arrayId);
            fieldAssociation = FieldAssociations.FIELD_ASSOCIATION_NONE;
            break;
    }
    
    return { scalars, fieldAssociation };
};

// 映射标量到颜色
publicAPI.mapScalars = (input, alpha) => {
    const { scalars } = publicAPI.getAbstractScalars(/* ... */);
    
    if (!scalars) {
        return { scalars: null, colors: null };
    }
    
    // 根据颜色模式处理
    if (model.colorMode === ColorMode.DIRECT_SCALARS) {
        // 直接使用标量作为颜色
        return { scalars, colors: scalars };
    }
    
    // 使用查找表映射颜色
    const lut = publicAPI.getLookupTable();
    const colors = lut.mapScalars(scalars, model.colorMode, model.scalarRange);
    
    return { scalars, colors };
};
```

**纹理映射功能**:

```javascript
// 映射标量到纹理
publicAPI.mapScalarsToTexture = (input, scalars) => {
    const lut = publicAPI.getLookupTable();
    const colorTextureMap = vtkImageData.newInstance();
    
    // 创建3D纹理用于存储颜色映射
    const dimensions = [textureWidth, textureHeight, textureDepth];
    colorTextureMap.setDimensions(dimensions);
    
    // 使用锯齿模式填充纹理，支持插值
    const zigzagCoordinates = [0, 0, 0];
    const textureCoordinate = [0, 0, 0];
    
    for (let i = 0; i < numValues; i++) {
        const value = scalars.getData()[i];
        const color = lut.getColor(value);
        
        // 计算纹理坐标
        getZigZagTextureCoordinatesFromTexelPosition(
            textureCoordinate, 
            i, 
            dimensions
        );
        
        // 设置颜色数据
        const index = getIndexFromCoordinates(textureCoordinate, dimensions);
        colorData[index * 4] = color[0] * 255;
        colorData[index * 4 + 1] = color[1] * 255;
        colorData[index * 4 + 2] = color[2] * 255;
        colorData[index * 4 + 3] = 255;
    }
    
    return colorTextureMap;
};
```

**透明度和渲染优化**:

```javascript
// 判断是否不透明
publicAPI.getIsOpaque = () => {
    const input = publicAPI.getInputData();
    if (!input) {
        return true;
    }
    
    // 检查材质透明度
    if (model.scalarVisibility) {
        const lut = publicAPI.getLookupTable();
        if (!lut.isOpaque()) {
            return false;
        }
        
        // 检查标量数据透明度
        const scalars = publicAPI.getAbstractScalars(/* ... */);
        if (scalars && scalars.scalars) {
            return lut.areScalarsOpaque(scalars.scalars, model.colorMode);
        }
    }
    
    return true;
};

// 获取基本图元数量（用于性能统计）
publicAPI.getPrimitiveCount = () => {
    const input = publicAPI.getInputData();
    if (!input) {
        return { points: 0, lines: 0, triangles: 0 };
    }
    
    return {
        points: input.getNumberOfVerts(),
        lines: input.getNumberOfLines(),
        triangles: input.getNumberOfPolys()
    };
};
```

## 核心功能模块详解

### 1. 数据管道连接机制

映射器作为数据管道的终端节点，负责：
- 从输入端口接收数据（通常是 vtkPolyData）
- 管理数据更新和缓存
- 提供数据给渲染器使用

```javascript
// 典型的管道连接
const mapper = vtkMapper.newInstance();
mapper.setInputData(polyData);  // 直接连接数据

// 或者连接到算法输出
mapper.setInputConnection(filter.getOutputPort());
```

### 2. 标量映射系统

支持多种标量数据映射模式：
- **点数据映射**: 使用顶点处的标量值
- **单元数据映射**: 使用单元（面、线）的标量值  
- **字段数据映射**: 使用任意字段数据
- **直接颜色**: 直接使用标量作为RGB颜色

### 3. 查找表和颜色管理

```javascript
// 创建和配置查找表
const lut = vtkLookupTable.newInstance();
lut.setRange(0, 255);           // 设置数值范围
lut.setHueRange(0.0, 0.8);      // 设置色调范围
mapper.setLookupTable(lut);

// 或使用默认查找表
mapper.createDefaultLookupTable();
```

### 4. 性能优化特性

- **静态模式**: 标记数据为静态，避免重复计算边界框
- **纹理映射**: 使用GPU纹理加速颜色映射
- **选择性渲染**: 支持部分数据渲染和LOD
- **缓存机制**: 缓存计算结果避免重复计算

## 实际应用示例

基于提供的 Triangle 示例 (`Examples/Geometry/Triangle/index.js`)：

```javascript
// 创建PolyData
const trianglePolyData = vtkPolyData.newInstance();
trianglePolyData.getPoints().setData(points, 3);
trianglePolyData.getPolys().setData(triangles, 1);

// 创建Mapper并连接数据
const mapper = vtkMapper.newInstance();
mapper.setInputData(trianglePolyData);  // vtkAlgorithm.setInputData()

// 创建Actor并设置Mapper
const actor = vtkActor.newInstance();
actor.setMapper(mapper);                // 建立渲染连接

// 设置颜色（直接设置Actor属性，不使用标量映射）
actor.getProperty().setColor(1.0, 0.2, 0.2);
```

在这个例子中，映射器的作用：
1. 接收 vtkPolyData 输入（继承自 vtkAlgorithm）
2. 计算三角形的边界框（继承自 vtkAbstractMapper3D）
3. 准备渲染数据供 Actor 使用（vtkMapper 功能）
4. 支持颜色和材质属性应用

## 最佳实践

### 1. 性能优化
```javascript
// 对于静态数据，设置静态模式
mapper.setStatic(true);

// 合理使用标量映射
if (needColorMapping) {
    mapper.setScalarVisibility(true);
    mapper.setLookupTable(customLUT);
} else {
    mapper.setScalarVisibility(false);  // 禁用标量映射提升性能
}
```

### 2. 内存管理
```javascript
// 及时清理大型查找表
mapper.setLookupTable(null);
mapper.clearColorArrays();
```

### 3. 渲染质量
```javascript
// 启用标量插值获得平滑颜色过渡
mapper.setInterpolateScalarsBeforeMapping(true);

// 使用合适的标量范围
const range = scalars.getRange();
mapper.setScalarRange(range[0], range[1]);
```

## 总结

vtkMapper 的继承链体现了良好的面向对象设计原则：

1. **vtkObject**: 提供基础的对象系统和事件机制
2. **vtkAlgorithm**: 实现数据管道和输入输出管理
3. **vtkAbstractMapper**: 定义映射器抽象接口和裁剪功能
4. **vtkAbstractMapper3D**: 添加3D空间计算能力
5. **vtkMapper**: 实现完整的数据映射和渲染准备功能

每一层都有明确的职责分工，通过组合提供了强大而灵活的数据可视化能力。这种设计使得 vtk.js 能够处理各种复杂的数据可视化需求，同时保持良好的可扩展性和维护性。