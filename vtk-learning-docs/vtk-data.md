# vtk中的基本数据类型
## core中的基本数据类型
vtkDataArray最基本的数据类型，存放数据列，可以有数据的维数numberOfComponents，比如`[1,2,3,4,5,6]`,numberOfComponenst是2，表示两个三维向量，分别为`[1,2,3]`,`[4,5,6]`

vtkCellArray存储不定长数据，继承子vtkDataArray，其数据类型为一个数字表示数据长度，其后跟随这个长度的多个数据，比如`[2,3,5,4,8,6,7,9]`,这个表示两个不定长数据，开头第一个数字是2，说明这个不定长数据的长度为2，也就是3,5两个数据，`[2,3,5]`构成了第一组不定长数据组。然后是4，说明后面四个数字8,6,7,9属于这个不定长数据,`[4,8,6,7,9]`构成第二组不定长数据。

vtkPoints,为numberOfComponents为3（默认为3，可以改）的vtkDataArray，用来表示点数据

## DataModel中的数据类型
vtkFieldData中放置多个vtkDataArray,一般这些vtkDataArray的numberOfTuples是一样大的，用来存储放置于VBO中的数据，比如顶点数据，颜色数据，法向量数据等。

vtkDataSetAttributes继承于vtkFieldData，其中存储了如下的vtkDataArray作为vtkFieldData的array数组的数据，
```javascript
//每个attrType作为一个vtkDataArray，名称为attrType。
const attrTypes = [
    'Scalars',
    'Vectors',
    'Normals',
    'TCoords',
    'Tensors',
    'GlobalIds',
    'PedigreeIds',
  ];

//activeXXX这个为同名array所在的array的index，因为vtkFieldData里面有一个attrTypes组成的arrays数组，如果要获得normals，就是要arrays[2],然后activeNormals = 2,也就是arrays的index
    'activeScalars',
    'activeNormals',
    'activeTCoords',
    'activeVectors',
    'activeTensors',
    'activeGlobalIds',
    'activePedigreeIds',
```

vtkDataSet，内涵三个vtkDataSetAttribute实例，分别是`['pointData', 'cellData', 'fieldData']`

vtkPointSet, 继承自vtkDataSet,内涵一个vtkPoints的实例

vtkPolyData, 继承自vtkPointSet，内有下述的多个vtkCellArray。用于管理所有的点数据和相关数据
```javascript
export const POLYDATA_FIELDS = ['verts', 'lines', 'polys', 'strips'];

// build empty cell arrays and set methods
POLYDATA_FIELDS.forEach((type) => {
  publicAPI[`getNumberOf${camelize(type)}`] = () =>
    model[type].getNumberOfCells();
  if (!model[type]) {
    model[type] = vtkCellArray.newInstance();
  } else {
    model[type] = vtk(model[type]);
  }
});
```
## 设计优势

VTK.js 的架构设计很大程度上继承自 C++ VTK 的经典设计，但在 JavaScript 环境下针对 WebGL 渲染和内存管理进行了优化。这种设计主要基于**数据中心（Data-Centric）和管线化（Pipeline）**的思想。

以下是这种架构设计的主要原因及其优势：

### 扁平化内存布局 (Flat Memory Layout)
设计： vtkDataArray 底层直接封装了 JavaScript 的 TypedArray (如 Float32Array, Uint32Array)。

原因： WebGL 也就是 GPU 渲染管线需要连续的内存块来传递顶点、颜色和法线数据。
优势：
高性能渲染： 数据可以直接传递给 GPU (Zero-copy 或极低开销)，无需在 CPU 端进行复杂的序列化或格式转换。
缓存友好： 连续内存访问比遍历嵌套的 JavaScript 对象（Object/Array of Objects）快得多。

### 拓扑与几何分离 (Topology vs. Geometry)
设计： vtkPoints（几何位置）与 vtkCellArray（拓扑连接）是分开存储的。

原因： 一个点（Vertex）可能被多个单元（Cell，如三角形）共享。
优势：
节省内存： 共享顶点只需存储一次坐标，而不是在每个三角形中重复存储。
连通性维护： 修改一个点的坐标会自动更新所有引用该点的单元形状，便于实现变形算法。

### 紧凑的非结构化存储 (Compact Unstructured Storage)
设计： vtkCellArray 使用 [n, id1, id2, ...] 的一维数组格式存储不定长数据。

原因： 网格往往是混合的（例如同时包含三角形和四边形），传统的二维数组无法有效处理行长不一致的情况。
优势：
灵活性： 可以在同一个数组中高效存储点、线、三角形、多边形等混合拓扑结构。
极简开销： 避免了创建成千上万个微小的 JavaScript 对象（如 Cell 类实例），显著降低了垃圾回收（GC）的压力。

### 属性数据的语义抽象 (Attribute Abstraction)
设计： vtkDataSetAttributes 使用 Scalars, Vectors, Normals 等语义命名，并通过 activeAttributes 标记当前生效的数据。

原因： 算法（Filter）需要以通用的方式处理数据，而不关心数据的具体名称（如 "Temperature" 或 "Pressure"）。
优势：
通用性： 一个“等值面提取（Contour）”算法只需要知道去处理“Active Scalars”，无论这个标量代表温度还是密度。
解耦： 渲染引擎可以自动查找 activeNormals 进行光照计算，无需手动绑定特定数组。

### 继承与多态 (Inheritance Hierarchy)
设计： vtkPolyData -> vtkPointSet -> vtkDataSet。

原因： 不同的数据集类型（如结构化网格和非结构化网格）有公共的行为（如都有点数据），但存储方式不同。
优势：
代码复用： 通用算法可以针对基
类 vtkDataSet 编写，从而适用于所有子类。
* 类型安全： 明确的层级结构有助于开发者理解数据具备哪些能力（例如 vtkPolyData 明确拥有 verts, lines, polys, strips）。
