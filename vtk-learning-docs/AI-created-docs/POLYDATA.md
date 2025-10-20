# VTK.js PolyData 完整指南

## 目录
1. [PolyData 概述](#polydata-概述)
2. [继承体系](#继承体系)
3. [核心组件](#核心组件)
4. [构造方法](#构造方法)
5. [数据存储格式](#数据存储格式)
6. [属性系统](#属性系统)
7. [实际应用示例](#实际应用示例)
8. [高级功能](#高级功能)
9. [性能优化](#性能优化)
10. [常见模式](#常见模式)

---

## PolyData 概述

**PolyData** 是 VTK.js 中最重要的几何数据结构，用于表示**显式几何数据**（点、线、面）。与 ImageData 的隐式网格不同，PolyData 存储每个点的具体坐标和单元连接性。

### 核心特征
- **显式几何**：每个点的坐标都明确存储
- **灵活拓扑**：支持混合单元类型（点、线、三角形、四边形等）
- **属性丰富**：每个点或单元可关联多个属性（颜色、法线、纹理坐标等）
- **高效查询**：支持拓扑关系查询（邻接、边界等）

---

## 继承体系

```
vtkDataObject (基础数据对象)
    ↓
vtkDataSet (抽象数据集接口 - 定义数据集基本契约)
    ↓
vtkPointSet (点集管理 - 添加空间坐标管理)
    ↓
vtkPolyData (多边形数据 - 添加单元连接性)
```

### 各层职责详解

#### vtkDataSet (Sources/Common/DataModel/DataSet)
```javascript
// 基础数据集接口
abstract class vtkDataSet {
  pointData: vtkDataSetAttributes    // 点属性数据
  cellData: vtkDataSetAttributes     // 单元属性数据
  fieldData: vtkDataSetAttributes    // 场数据

  getBounds(): [xmin, xmax, ymin, ymax, zmin, zmax]
  getNumberOfPoints(): number
  getNumberOfCells(): number
}
```

#### vtkPointSet (Sources/Common/DataModel/PointSet)
```javascript
// 添加点集管理
class vtkPointSet extends vtkDataSet {
  points: vtkPoints                   // 3D坐标数组

  getNumberOfPoints(): number         // 获取点数
  getBounds(): Bounds                 // 计算空间包围盒
  computeBounds(): void               // 重新计算边界
}
```

#### vtkPolyData (Sources/Common/DataModel/PolyData)
```javascript
// 完整的多边形数据结构
class vtkPolyData extends vtkPointSet {
  // 四种单元类型
  verts: vtkCellArray     // 顶点单元 (孤立点)
  lines: vtkCellArray     // 线单元 (线段、折线)
  polys: vtkCellArray     // 多边形单元 (三角形、四边形)
  strips: vtkCellArray    // 三角形条带

  // 拓扑结构
  cells: vtkCellTypes     // 单元类型映射
  links: vtkCellLinks     // 点到单元的连接
}
```

---

## 核心组件

### 1. 点数据 (Points)
存储所有顶点的3D坐标：
```javascript
const points = new Float32Array([
  x0, y0, z0,  // 点0
  x1, y1, z1,  // 点1
  x2, y2, z2   // 点2
]);
```

### 2. 单元数组 (Cell Arrays)
四种单元类型，每种使用相同的存储格式：

#### 存储格式
```
[cellSize0, p0, p1, ..., pN, cellSize1, p0, p1, ..., pM, ...]
```

#### 单元类型详解

**Verts (顶点)** - 孤立点渲染
```javascript
// 3个独立顶点
const verts = new Uint32Array([
  1, 0,  // 1个点，使用顶点0
  1, 1,  // 1个点，使用顶点1
  1, 2   // 1个点，使用顶点2
]);
```

**Lines (线段)** - 线框渲染
```javascript
// 一条折线
const lines = new Uint32Array([
  4, 0, 1, 2, 3  // 4个点，构成折线 0→1→2→3
]);
```

**Polys (多边形)** - 面片渲染
```javascript
// 2个三角形
const polys = new Uint32Array([
  3, 0, 1, 2,   // 三角形1: 顶点0,1,2
  3, 3, 4, 5    // 三角形2: 顶点3,4,5
]);
```

**Strips (三角形条带)** - 高效三角形序列
```javascript
// 三角形条带 (每新增1点形成1个三角形)
const strips = new Uint32Array([
  5, 0, 1, 2, 3, 4  // 5个顶点，形成3个三角形
]);
```

### 3. 属性数据 (Attributes)
每个点或单元可关联多个属性：

```javascript
// 点属性 - 每个点一个值
pointData: {
  scalars: vtkDataArray,    // 标量 (温度、压力等)
  vectors: vtkDataArray,    // 向量 (速度、位移等)
  normals: vtkDataArray,    // 法线 (光照计算)
  tCoords: vtkDataArray     // 纹理坐标
}

// 单元属性 - 每个单元一个值
cellData: {
  scalars: vtkDataArray,
  vectors: vtkDataArray,
  normals: vtkDataArray,
  tCoords: vtkDataArray
}
```

---

## 构造方法

### 方法1: 手动构造 (基础三角形)

```javascript
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';

// 1. 定义顶点坐标 (逆时针方向)
const points = new Float32Array([
  0.0,  1.0, 0.0,  // 顶点0: 顶部
  -1.0, -1.0, 0.0,  // 顶点1: 左下
  1.0, -1.0, 0.0   // 顶点2: 右下
]);

// 2. 定义三角形连接性
const triangles = new Uint32Array([
  3,    // 这个单元有3个顶点
  0, 1, 2  // 使用顶点0, 1, 2构成三角形
]);

// 3. 创建PolyData并设置几何数据
const trianglePolyData = vtkPolyData.newInstance();
trianglePolyData.getPoints().setData(points, 3);      // 3个分量(x,y,z)
trianglePolyData.getPolys().setData(triangles, 1);    // 1个分量(顶点索引)

// 4. 可选：添加颜色属性
const colors = new Float32Array([
  1, 0, 0,  // 顶点0: 红色
  0, 1, 0,  // 顶点1: 绿色
  0, 0, 1   // 顶点2: 蓝色
]);

trianglePolyData.getPointData().setScalars(
  vtkDataArray.newInstance({
    name: 'Colors',
    values: colors,
    numberOfComponents: 3  // RGB
  })
);
```

### 方法2: 复杂几何 (立方体)

```javascript
// 立方体顶点 (8个点)
const points = new Float32Array([
  // 底面 (z = -1)
  -1, -1, -1,  // 0
   1, -1, -1,  // 1
   1,  1, -1,  // 2
  -1,  1, -1,  // 3
  // 顶面 (z = 1)
  -1, -1,  1,  // 4
   1, -1,  1,  // 5
   1,  1,  1,  // 6
  -1,  1,  1   // 7
]);

// 立方体面 (6个四边形 = 12个三角形)
const polys = new Uint32Array([
  // 底面 (2个三角形)
  3, 0, 1, 2,   // 三角形1
  3, 0, 2, 3,   // 三角形2
  // 顶面 (2个三角形)
  3, 4, 6, 5,   // 三角形3
  3, 4, 7, 6,   // 三角形4
  // 前面 (2个三角形)
  3, 0, 4, 5,   // 三角形5
  3, 0, 5, 1,   // 三角形6
  // 后面 (2个三角形)
  3, 2, 6, 7,   // 三角形7
  3, 2, 7, 3,   // 三角形8
  // 左面 (2个三角形)
  3, 0, 3, 7,   // 三角形9
  3, 0, 7, 4,   // 三角形10
  // 右面 (2个三角形)
  3, 1, 5, 6,   // 三角形11
  3, 1, 6, 2    // 三角形12
]);

const cube = vtkPolyData.newInstance();
cube.getPoints().setData(points, 3);
cube.getPolys().setData(polys, 1);
```

### 方法3: 算法生成 (圆锥体)

```javascript
function createCone(height = 2.0, radius = 1.0, resolution = 32) {
  const points = [];
  const polys = [];

  // 1. 顶点：底面圆心 + 圆周点 + 顶点
  points.push(0, 0, 0);  // 底面圆心 (索引0)

  // 底面圆周点
  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;
    points.push(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
  }

  // 圆锥顶点
  points.push(0, 0, height);  // 索引 resolution+1

  // 2. 面片：底面三角形 + 侧面三角形

  // 底面 (多个三角形扇)
  for (let i = 0; i < resolution; i++) {
    const next = (i + 1) % resolution;
    polys.push(3, 0, i + 1, next + 1);  // 圆心→当前点→下一点
  }

  // 侧面 (三角形条带)
  for (let i = 0; i < resolution; i++) {
    const next = (i + 1) % resolution;
    polys.push(3, i + 1, resolution + 1, next + 1);  // 底点→顶点→下底点
  }

  const cone = vtkPolyData.newInstance();
  cone.getPoints().setData(new Float32Array(points), 3);
  cone.getPolys().setData(new Uint32Array(polys), 1);

  return cone;
}
```

---

## 数据存储格式

### 单元数组详细格式

#### 单一单元类型
```javascript
// 3个独立的三角形
const polys = new Uint32Array([
  3, 0, 1, 2,   // [单元大小, 顶点索引...]
  3, 3, 4, 5,   // 每个单元独立定义大小
  3, 6, 7, 8
]);
```

#### 混合单元类型
```javascript
// 三角形和四边形混合
const mixedPolys = new Uint32Array([
  3, 0, 1, 2,        // 三角形 (3个点)
  4, 3, 4, 5, 6,     // 四边形 (4个点)
  3, 7, 8, 9         // 另一个三角形
]);
```

### 内存布局优化

#### 顶点缓存友好性
```javascript
// 好的：顶点重用，缓存友好
const efficient = new Uint32Array([
  3, 0, 1, 2,   // 三角形1
  3, 1, 3, 2    // 三角形2 (重用顶点1,2)
]);

// 差的：顶点冗余
const inefficient = new Uint32Array([
  3, 0, 1, 2,   // 三角形1
  3, 4, 5, 6    // 三角形2 (新顶点，无重用)
]);
```

---

## 属性系统

### 标量属性 (Scalars)
```javascript
// 每个点的温度值
const temperatures = new Float32Array([98.6, 101.2, 99.5, 102.1]);

polyData.getPointData().setScalars(
  vtkDataArray.newInstance({
    name: 'Temperature',
    values: temperatures,
    numberOfComponents: 1
  })
);
```

### 向量属性 (Vectors)
```javascript
// 每个点的速度向量
const velocities = new Float32Array([
  1.0, 0.0, 0.0,  // 点0: 向+x方向
  0.0, 1.0, 0.0,  // 点1: 向+y方向
  -1.0, 0.0, 0.0  // 点2: 向-x方向
]);

polyData.getPointData().setVectors(
  vtkDataArray.newInstance({
    name: 'Velocity',
    values: velocities,
    numberOfComponents: 3
  })
);
```

### 法线属性 (Normals)
```javascript
// 每个点的表面法线
const normals = new Float32Array([
  0.0, 0.0, 1.0,  // 点0: +Z方向
  0.0, 0.0, 1.0,  // 点1: +Z方向
  0.0, 0.0, 1.0   // 点2: +Z方向
]);

polyData.getPointData().setNormals(
  vtkDataArray.newInstance({
    name: 'Normals',
    values: normals,
    numberOfComponents: 3
  })
);
```

### 纹理坐标 (TCoords)
```javascript
// 每个点的UV纹理坐标
const texCoords = new Float32Array([
  0.5, 1.0,  // 点0: 顶部中心
  0.0, 0.0,  // 点1: 左下
  1.0, 0.0   // 点2: 右下
]);

polyData.getPointData().setTCoords(
  vtkDataArray.newInstance({
    name: 'TextureCoordinates',
    values: texCoords,
    numberOfComponents: 2
  })
);
```

---

## 实际应用示例

### 示例1: 医学血管模型
```javascript
// 从医学扫描数据创建血管表面
function createVesselSurface(centerline, radius) {
  const points = [];
  const polys = [];
  const normals = [];

  const segments = centerline.length - 1;
  const radialSegments = 16;

  // 1. 生成圆周顶点
  for (let i = 0; i <= segments; i++) {
    const position = centerline[i];
    const tangent = i < segments ?
      vec3.subtract([], centerline[i + 1], centerline[i]) :
      vec3.subtract([], centerline[i], centerline[i - 1]);

    vec3.normalize(tangent, tangent);

    // 计算垂直向量
    const up = [0, 0, 1];
    const right = vec3.cross([], tangent, up);
    vec3.normalize(right, right);
    const up2 = vec3.cross([], right, tangent);

    // 生成圆周点
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * 2 * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const point = vec3.scaleAndAdd([], position, right, x);
      vec3.scaleAndAdd(point, point, up2, y);

      points.push(...point);

      // 计算法线 (指向外部)
      const normal = vec3.subtract([], point, position);
      vec3.normalize(normal, normal);
      normals.push(...normal);
    }
  }

  // 2. 生成四边形面片
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;

      const a = i * radialSegments + j;
      const b = i * radialSegments + nextJ;
      const c = (i + 1) * radialSegments + nextJ;
      const d = (i + 1) * radialSegments + j;

      // 分成两个三角形
      polys.push(3, a, b, c);
      polys.push(3, a, c, d);
    }
  }

  const vessel = vtkPolyData.newInstance();
  vessel.getPoints().setData(new Float32Array(points), 3);
  vessel.getPolys().setData(new Uint32Array(polys), 1);
  vessel.getPointData().setNormals(
    vtkDataArray.newInstance({
      name: 'Normals',
      values: new Float32Array(normals),
      numberOfComponents: 3
    })
  );

  return vessel;
}
```

### 示例2: 科学计算网格
```javascript
// 创建CFD计算网格
function createCFDMesh() {
  const points = [];
  const polys = [];
  const pressure = [];
  const velocity = [];

  const nx = 50, ny = 30;

  // 1. 生成网格顶点
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = i / nx * 10;  // 0-10
      const y = j / ny * 5;   // 0-5
      const z = Math.sin(x * 0.5) * Math.cos(y * 0.3) * 0.5;  // 起伏表面

      points.push(x, y, z);

      // 计算物理属性
      const dist = Math.sqrt(x*x + y*y);
      pressure.push(1000 - dist * 10);  // 压力随距离递减
      velocity.push(
        (10 - x) * 0.1,  // x方向速度
        (5 - y) * 0.05,  // y方向速度
        0                // z方向速度
      );
    }
  }

  // 2. 生成四边形单元
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * (nx + 1) + i;

      const a = idx;
      const b = idx + 1;
      const c = idx + nx + 2;
      const d = idx + nx + 1;

      // 四边形分成两个三角形
      polys.push(3, a, b, c);
      polys.push(3, a, c, d);
    }
  }

  const mesh = vtkPolyData.newInstance();
  mesh.getPoints().setData(new Float32Array(points), 3);
  mesh.getPolys().setData(new Uint32Array(polys), 1);

  // 设置物理属性
  mesh.getPointData().setScalars(
    vtkDataArray.newInstance({
      name: 'Pressure',
      values: new Float32Array(pressure),
      numberOfComponents: 1
    })
  );

  mesh.getPointData().setVectors(
    vtkDataArray.newInstance({
      name: 'Velocity',
      values: new Float32Array(velocity),
      numberOfComponents: 3
    })
  );

  return mesh;
}
```

---

## 高级功能

### 拓扑查询

#### 构建拓扑结构
```javascript
const polyData = vtkPolyData.newInstance();

// 设置几何数据
polyData.getPoints().setData(points, 3);
polyData.getPolys().setData(polys, 1);

// 构建拓扑查询结构
polyData.buildCells();  // 创建单元类型映射
polyData.buildLinks();  // 创建点到单元连接
```

#### 邻接查询
```javascript
// 获取使用某点的所有单元
const pointId = 5;
const cellIds = [];
polyData.getPointCells(pointId, cellIds);

// 获取单元的所有邻接单元
const cellId = 10;
const neighborCellIds = [];
polyData.getCellNeighbors(cellId, neighborCellIds);
```

### 几何操作

#### 变换操作
```javascript
import { mat4 } from 'gl-matrix';

// 创建变换矩阵
const transform = mat4.create();
mat4.translate(transform, transform, [1, 2, 3]);  // 平移
mat4.rotateZ(transform, transform, Math.PI / 4); // 旋转
mat4.scale(transform, transform, [2, 2, 2]);     // 缩放

// 应用变换到PolyData
polyData.getPoints().setData(transformedPoints, 3);
```

#### 法线计算
```javascript
// 自动计算顶点法线
polyData.computeNormals();

// 手动计算面法线
function computeFaceNormal(p0, p1, p2) {
  const v1 = vec3.subtract([], p1, p0);
  const v2 = vec3.subtract([], p2, p0);
  const normal = vec3.cross([], v1, v2);
  vec3.normalize(normal, normal);
  return normal;
}
```

### 数据过滤

#### 抽取子集
```javascript
// 提取特定范围的单元
function extractSubset(polyData, minValue, maxValue) {
  const scalars = polyData.getPointData().getScalars();
  const values = scalars.getData();

  const subsetPoints = [];
  const subsetPolys = [];
  const subsetScalars = [];

  const pointMap = new Map();
  let newPointId = 0;

  // 遍历所有单元
  const cellData = polyData.getPolys().getData();
  let cellId = 0;

  for (let i = 0; i < cellData.length; ) {
    const cellSize = cellData[i];
    let includeCell = false;
    const cellPoints = [];

    // 检查单元是否包含在范围内
    for (let j = 0; j < cellSize; j++) {
      const pointId = cellData[i + 1 + j];
      const value = values[pointId];

      if (value >= minValue && value <= maxValue) {
        includeCell = true;
      }

      // 映射点ID
      if (!pointMap.has(pointId)) {
        pointMap.set(pointId, newPointId++);

        // 复制点坐标
        const coords = polyData.getPoints().getPoint(pointId);
        subsetPoints.push(...coords);

        // 复制标量值
        subsetScalars.push(value);
      }

      cellPoints.push(pointMap.get(pointId));
    }

    // 如果单元在范围内，添加到结果
    if (includeCell) {
      subsetPolys.push(cellSize, ...cellPoints);
    }

    i += 1 + cellSize;
  }

  const subset = vtkPolyData.newInstance();
  subset.getPoints().setData(new Float32Array(subsetPoints), 3);
  subset.getPolys().setData(new Uint32Array(subsetPolys), 1);
  subset.getPointData().setScalars(
    vtkDataArray.newInstance({
      name: 'SubsetScalars',
      values: new Float32Array(subsetScalars),
      numberOfComponents: 1
    })
  );

  return subset;
}
```

---

## 性能优化

### 内存管理

#### 使用合适的数据类型
```javascript
// 好的：使用合适的数据类型
const indices = new Uint16Array([0, 1, 2, 3]);  // 如果点数 < 65536
const coordinates = new Float32Array([0.1, 0.2, 0.3]);  // 足够的精度

// 差的：过度分配
const indices = new Uint32Array([0, 1, 2, 3]);  // 浪费内存
const coordinates = new Float64Array([0.1, 0.2, 0.3]); // 不必要的精度
```

#### 避免数据复制
```javascript
// 好的：直接设置数据
const points = new Float32Array([...]);
polyData.getPoints().setData(points, 3);

// 差的：数据复制
const points = new Float32Array([...]);
const copiedPoints = new Float32Array(points);  // 不必要的复制
polyData.getPoints().setData(copiedPoints, 3);
```

### 构建优化

#### 延迟构建
```javascript
// 批量设置数据，然后一次性构建
polyData.getPoints().setData(points, 3);
polyData.getPolys().setData(polys, 1);
polyData.getPointData().setScalars(scalars);

// 最后构建拓扑结构
polyData.buildCells();
polyData.buildLinks();
```

#### 缓存计算结果
```javascript
class PolyDataCache {
  constructor() {
    this.boundsCache = new Map();
    this.normalCache = new Map();
  }

  getBounds(polyData) {
    const key = polyData.getMTime();

    if (!this.boundsCache.has(key)) {
      this.boundsCache.set(key, polyData.getBounds());
    }

    return this.boundsCache.get(key);
  }

  clear() {
    this.boundsCache.clear();
    this.normalCache.clear();
  }
}
```

### 渲染优化

#### 减少绘制调用
```javascript
// 好的：合并小网格
function mergePolyDatas(polyDatas) {
  const allPoints = [];
  const allPolys = [];
  let pointOffset = 0;

  polyDatas.forEach(polyData => {
    const points = polyData.getPoints().getData();
    allPoints.push(...points);

    const polys = polyData.getPolys().getData();
    for (let i = 0; i < polys.length; ) {
      const cellSize = polys[i];
      allPolys.push(cellSize);

      for (let j = 0; j < cellSize; j++) {
        allPolys.push(polys[i + 1 + j] + pointOffset);
      }

      i += 1 + cellSize;
    }

    pointOffset += points.length / 3;
  });

  const merged = vtkPolyData.newInstance();
  merged.getPoints().setData(new Float32Array(allPoints), 3);
  merged.getPolys().setData(new Uint32Array(allPolys), 1);

  return merged;
}
```

#### 使用索引绘制
```javascript
// 自动使用索引绘制 (VTK.js内部优化)
const mapper = vtkMapper.newInstance();
mapper.setInputData(polyData);
// VTK.js会自动检测并使用最优的绘制方式
```

---

## 常见模式

### 数据管线模式
```javascript
// 标准VTK管线：Source → Filter → Mapper → Actor
const source = vtkConeSource.newInstance();
const filter = vtkTriangleFilter.newInstance();
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();

filter.setInputConnection(source.getOutputPort());
mapper.setInputConnection(filter.getOutputPort());
actor.setMapper(mapper);
```

### 观察者模式
```javascript
// 监听数据变化
polyData.onModified(() => {
  console.log('PolyData modified');
  updateRendering();
});

// 监听属性变化
polyData.getPointData().onModified(() => {
  console.log('Point data modified');
  updateColorMapping();
});
```

### 工厂模式
```javascript
// 单元类型工厂
const CELL_FACTORY = {
  [CellType.VTK_LINE]: vtkLine,
  [CellType.VTK_POLY_LINE]: vtkLine,
  [CellType.VTK_TRIANGLE]: vtkTriangle,
  [CellType.VTK_QUAD]: vtkQuad,
  [CellType.VTK_POLYGON]: vtkPolygon
};

function createCell(type) {
  const CellClass = CELL_FACTORY[type];
  return CellClass ? CellClass.newInstance() : null;
}
```

### 策略模式
```javascript
// 不同的法线计算策略
const normalStrategies = {
  vertex: (polyData) => polyData.computeVertexNormals(),
  face: (polyData) => polyData.computeFaceNormals(),
  weighted: (polyData) => polyData.computeWeightedNormals()
};

function computeNormals(polyData, strategy = 'vertex') {
  const computeFn = normalStrategies[strategy];
  return computeFn ? computeFn(polyData) : null;
}
```

### 装饰器模式
```javascript
// 为PolyData添加额外功能
function withStatistics(polyData) {
  return {
    ...polyData,
    getStatistics() {
      return {
        numPoints: this.getNumberOfPoints(),
        numCells: this.getNumberOfCells(),
        numTriangles: this.getNumberOfPolys(),
        numLines: this.getNumberOfLines(),
        bounds: this.getBounds()
      };
    }
  };
}

const enhancedPolyData = withStatistics(originalPolyData);
console.log(enhancedPolyData.getStatistics());
```

---

## 总结

PolyData 是 VTK.js 的核心数据结构，提供了：

1. **灵活的几何表示**：支持点、线、面等多种单元类型
2. **丰富的属性系统**：标量、向量、法线、纹理坐标
3. **高效的存储格式**：基于 TypedArray 的紧凑内存布局
4. **强大的拓扑查询**：邻接关系、边界提取
5. **完整的可视化管线**：从数据到渲染的完整支持

掌握 PolyData 的使用是进行 VTK.js 开发的基础，无论是医学影像、科学计算还是工程可视化，PolyData 都提供了强大而灵活的数据基础。

---

## 相关资源

- [VTK.js 官方文档](https://kitware.github.io/vtk-js/)
- [PolyData API 参考](https://kitware.github.io/vtk-js/api/Common_DataModel_PolyData.html)
- [示例代码库](https://github.com/Kitware/vtk-js/tree/master/Examples)
- [数据模型指南](https://kitware.github.io/vtk-js/docs/concepts.html)

*本文档基于 VTK.js v29.0.0 编写，不同版本可能存在差异*