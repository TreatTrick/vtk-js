# ResliceCursorWidget 详细说明

## 概述

ResliceCursorWidget（重切片光标组件）是vtk.js中用于3D医学图像可视化的核心交互组件。它提供了一个十字光标系统，允许用户在三维体积数据中进行交互式切片查看，类似于医学影像软件（如3D Slicer、DICOM查看器）中的多平面重建（MPR）功能。

## 主要功能

### 1. 三平面切片显示
- **轴状面（Axial）**: XY平面，从头部到足部的水平切片
- **冠状面（Coronal）**: XZ平面，从前到后的垂直切片  
- **矢状面（Sagittal）**: YZ平面，从左到右的垂直切片

### 2. 交互操作
- **平移中心点**: 移动十字光标的中心位置
- **轴向平移**: 沿着特定轴线移动切片平面
- **旋转**: 围绕中心点旋转切片平面
- **滚动切片**: 通过鼠标滚轮在切片间导航

### 3. 可视化表示
- **线条手柄**: 显示切片平面的交线
- **球形手柄**: 用于旋转操作的控制点
- **中心手柄**: 十字光标的中心控制点

## 架构设计

### 核心组件

```
ResliceCursorWidget
├── index.js          - 主要工厂类和API
├── behavior.js       - 交互行为定义
├── state.js          - 状态管理
├── helpers.js        - 辅助函数
└── Constants.js      - 常量定义
```

### 类层次结构

```
vtkAbstractWidgetFactory
    └── vtkResliceCursorWidget
```

## 使用方式

### 基本用法

```javascript
import vtkResliceCursorWidget from 'vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';

// 1. 创建组件实例
const resliceCursorWidget = vtkResliceCursorWidget.newInstance();

// 2. 设置图像数据
resliceCursorWidget.setImage(imageData);

// 3. 添加到组件管理器
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.addWidget(resliceCursorWidget);

// 4. 为不同视图类型添加组件
const axialWidget = widgetManager.addWidget(resliceCursorWidget, ViewTypes.XY_PLANE);
const coronalWidget = widgetManager.addWidget(resliceCursorWidget, ViewTypes.XZ_PLANE);
const sagittalWidget = widgetManager.addWidget(resliceCursorWidget, ViewTypes.YZ_PLANE);
```

### 配置选项

```javascript
// 创建时传入初始值
const widget = vtkResliceCursorWidget.newInstance({
  scaleInPixels: true,           // 是否以像素为单位缩放
  rotationHandlePosition: 0.5,   // 旋转手柄位置 (0-1)
  planes: ['X', 'Y', 'Z']        // 启用的平面
});

// 设置样式
widget.getRepresentationsForViewType(ViewTypes.XY_PLANE).forEach(rep => {
  rep.getActor().getProperty().setColor(1, 0, 0); // 红色
});
```

## 核心API

### 主要方法

#### 图像和位置控制
```javascript
// 设置图像数据
setImage(image)

// 设置/获取中心位置
setCenter(center)
getCenter()

// 获取组件状态
getWidgetState()
```

#### 平面操作
```javascript
// 获取特定视图类型的平面源
getPlaneSource(viewType)

// 获取平面法向量
getPlaneNormalFromViewType(viewType)

// 获取其他平面的法向量
getOtherPlaneNormals(viewType)

// 获取重切片轴矩阵
getResliceAxes(viewType)

// 更新重切片平面
updateReslicePlane(imageReslice, viewType)
```

#### 相机控制
```javascript
// 重置相机
resetCamera(renderer, viewType, resetFocalPoint, keepCenterFocalDistance)

// 更新相机点
updateCameraPoints(renderer, viewType, resetFocalPoint, computeFocalPointOffset)
```

#### 显示和交互
```javascript
// 设置像素缩放
setScaleInPixels(scale)

// 获取显示缩放参数
getDisplayScaleParams()

// 获取平面边界点
getPlaneExtremities(viewType)
```

### 事件和回调

组件通过vtk.js的事件系统发送通知：

```javascript
// 监听修改事件
widget.onModified(() => {
  // 组件状态发生变化
  console.log('Widget state changed');
});

// 监听交互事件
widget.getInteractor().onStartInteraction(() => {
  console.log('Interaction started');
});
```

## 状态管理

### 组件状态结构

```javascript
const widgetState = {
  center: [0, 0, 0],              // 中心位置
  image: null,                    // 图像数据
  activeViewType: null,           // 当前活动视图类型
  planes: {                       // 平面配置
    [ViewTypes.XY_PLANE]: {
      normal: [0, 0, -1],
      viewUp: [0, -1, 0]
    },
    [ViewTypes.XZ_PLANE]: {
      normal: [0, -1, 0], 
      viewUp: [0, 0, 1]
    },
    [ViewTypes.YZ_PLANE]: {
      normal: [1, 0, 0],
      viewUp: [0, 0, 1]
    }
  },
  scrollingMethod: ScrollingMethods.MIDDLE_MOUSE_BUTTON,
  cameraOffsets: {},              // 相机偏移
  viewUpFromViewType: {}          // 视图向上向量
}
```

### 手柄状态

每个视图包含三种类型的手柄：

1. **线条手柄** (`lineInX`, `lineInY`, `lineInZ`)
   - 表示切片平面的交线
   - 支持沿轴向平移

2. **旋转手柄** (`rotationInX`, `rotationInY`, `rotationInZ`)
   - 球形手柄，用于旋转操作
   - 每条线有两个旋转点 (`point0`, `point1`)

3. **中心手柄** (`center`)
   - 十字光标的中心点
   - 支持整体平移

## 交互行为

### 交互模式

```javascript
const InteractionMethodsName = {
  TranslateAxis: 'translateAxis',                    // 轴向平移
  RotateLine: 'rotateLine',                         // 线条旋转
  TranslateCenter: 'translateCenter',               // 中心平移
  TranslateCenterAndUpdatePlanes: 'translateCenterAndUpdatePlanes'
};
```

### 鼠标操作

- **左键拖拽**:
  - 线条手柄: 轴向平移
  - 旋转手柄: 旋转切片平面
  - 中心手柄: 移动十字光标中心

- **滚轮**:
  - 在切片间导航
  - 可配置使用不同鼠标按钮

### 自定义光标样式

```javascript
widget.setCursorStyles({
  [InteractionMethodsName.TranslateCenter]: 'move',
  [InteractionMethodsName.RotateLine]: 'alias',
  [InteractionMethodsName.TranslateAxis]: 'pointer',
  default: 'default'
});
```

## 高级特性

### 1. 平面约束

组件自动将切片平面约束在图像边界内：

```javascript
// 内部调用 boundPlane 函数确保平面不超出图像范围
boundPlane(imageBounds, origin, point1, point2);
```

### 2. 相机同步

支持保持相机与重切片中心的相对位置关系：

```javascript
// 计算并保存相机偏移
computeFocalPointOffsetFromResliceCursorCenter(viewType, renderer);

// 重置相机时保持距离关系  
resetCamera(renderer, viewType, false, true);
```

### 3. 正交性约束

可选择保持切片平面的正交关系：

```javascript
widget.setKeepOrthogonality(true);
```

### 4. 动态缩放

支持基于像素或世界坐标的缩放：

```javascript
widget.setScaleInPixels(true);  // 像素缩放
widget.setScaleInPixels(false); // 世界坐标缩放
```

## 数学原理

### 重切片轴计算

组件使用4x4变换矩阵定义重切片轴：

```javascript
// 重切片轴矩阵格式: [axis1, axis2, normal, origin]
const resliceAxes = mat4.identity(new Float64Array(16));
for (let i = 0; i < 3; i++) {
  resliceAxes[i] = planeAxis1[i];      // X轴
  resliceAxes[4 + i] = planeAxis2[i];  // Y轴  
  resliceAxes[8 + i] = normal[i];      // Z轴（法向量）
  resliceAxes[12 + i] = origin[i];     // 原点
}
```

### 平面变换

使用矩阵变换来旋转和定位切片平面：

```javascript
const transformMatrix = vtkMatrixBuilder
  .buildFromRadian()
  .translate(...center)
  .multiply(rotationMatrix)
  .translate(...vtkMath.multiplyScalar([...center], -1))
  .getMatrix();
```

## 性能优化

### 1. 纹理映射优化

自动计算最优的纹理尺寸（2的幂次）：

```javascript
// 将切片尺寸填充到2的幂次，提高GPU性能
while (extentX < realExtentX) {
  extentX <<= 1; // 左移位操作，等同于 *= 2
}
```

### 2. 边界检查

内置边界检查避免无效计算：

```javascript
if (realExtentX > VTK_INT_MAX >> 1) {
  vtkErrorMacro('Invalid X extent:', realExtentX);
  extentX = 0;
}
```

## 集成示例

### 完整的医学影像查看器

```javascript
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkResliceCursorWidget from 'vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';

// 创建渲染窗口
const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// 创建组件管理器
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// 创建重切片光标组件
const resliceCursorWidget = vtkResliceCursorWidget.newInstance();

// 设置图像数据（假设已加载）
resliceCursorWidget.setImage(imageData);

// 添加到管理器
widgetManager.addWidget(resliceCursorWidget);

// 为三个主视图添加组件实例
const axialWidget = widgetManager.addWidget(
  resliceCursorWidget, 
  ViewTypes.XY_PLANE
);
const coronalWidget = widgetManager.addWidget(
  resliceCursorWidget, 
  ViewTypes.XZ_PLANE  
);
const sagittalWidget = widgetManager.addWidget(
  resliceCursorWidget,
  ViewTypes.YZ_PLANE
);

// 启用交互
widgetManager.enablePicking();

// 渲染
renderWindow.render();
```

### 多视口布局

```javascript
// 创建四个视口：三个切片视图 + 一个3D视图
const viewports = [
  { viewType: ViewTypes.XY_PLANE, viewport: [0, 0.5, 0.5, 1] },    // 轴状面
  { viewType: ViewTypes.XZ_PLANE, viewport: [0.5, 0.5, 1, 1] },    // 冠状面
  { viewType: ViewTypes.YZ_PLANE, viewport: [0, 0, 0.5, 0.5] },    // 矢状面
  { viewType: ViewTypes.VOLUME, viewport: [0.5, 0, 1, 0.5] }       // 3D体渲染
];

viewports.forEach(({ viewType, viewport }) => {
  const renderer = vtkRenderer.newInstance();
  renderer.setViewport(...viewport);
  renderWindow.addRenderer(renderer);
  
  if (viewType !== ViewTypes.VOLUME) {
    const widget = widgetManager.addWidget(resliceCursorWidget, viewType);
    widget.setRenderer(renderer);
  }
});
```

## 常见问题和解决方案

### 1. 图像不显示
```javascript
// 确保图像数据有效且包含数据
if (imageData && imageData.getNumberOfPoints() > 0) {
  resliceCursorWidget.setImage(imageData);
  
  // 重置相机以查看完整图像
  const bounds = imageData.getBounds();
  renderer.resetCamera(bounds);
}
```

### 2. 交互不响应
```javascript
// 确保启用了拾取功能
widgetManager.enablePicking();

// 检查手柄是否可拾取
widget.setEnableTranslation(true);
widget.setEnableRotation(true);
```

### 3. 切片平面超出边界
```javascript
// 组件会自动约束，但可以手动检查
const center = widget.getCenter();
const bounds = imageData.getBounds();

if (center[0] < bounds[0] || center[0] > bounds[1] ||
    center[1] < bounds[2] || center[1] > bounds[3] ||
    center[2] < bounds[4] || center[2] > bounds[5]) {
  // 重置到图像中心
  widget.setCenter(imageData.getCenter());
}
```

## 扩展开发

### 自定义交互行为

```javascript
// 扩展behavior.js中的交互逻辑
const customBehavior = (publicAPI, model) => {
  // 添加自定义交互方法
  publicAPI.customInteraction = (event) => {
    // 自定义交互逻辑
  };
  
  // 重写现有方法
  const superTranslateCenter = publicAPI.translateCenter;
  publicAPI.translateCenter = (event) => {
    // 添加自定义逻辑
    superTranslateCenter(event);
  };
};
```

### 自定义表示

```javascript
// 创建自定义手柄表示
const customRepresentation = vtkSphereHandleRepresentation.newInstance({
  scaleInPixels: true,
  lighting: false,
  radius: 5
});

// 替换默认表示
widget.getRepresentationsForViewType(ViewTypes.XY_PLANE)[2] = customRepresentation;
```

## 总结

ResliceCursorWidget是vtk.js中功能强大的医学影像交互组件，提供了完整的多平面重建功能。它通过精心设计的状态管理、交互行为和数学计算，为开发者提供了构建专业医学影像应用的基础工具。

通过理解其架构和API，开发者可以：
- 快速集成多平面切片查看功能
- 自定义交互行为和视觉样式  
- 构建复杂的医学影像工作流
- 优化性能和用户体验

该组件展现了vtk.js在科学可视化领域的强大能力，特别是在医学图像处理和分析方面的专业水准。