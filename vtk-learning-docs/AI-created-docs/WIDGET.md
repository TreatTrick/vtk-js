# VTK.js Widget 系统 - 架构详解与 Interactor 对比

## 目录
1. [概述](#概述)
2. [Widget 与 Interactor 的根本区别](#widget-与-interactor-的根本区别)
3. [Widget 系统架构](#widget-系统架构)
4. [核心组件详解](#核心组件详解)
5. [Widget 生命周期](#widget-生命周期)
6. [Widget 类型和分类](#widget-类型和分类)
7. [使用示例](#使用示例)
8. [自定义 Widget 开发](#自定义-widget-开发)
9. [最佳实践](#最佳实践)
10. [性能优化](#性能优化)

## 概述

VTK.js Widget 系统是一个专门用于创建**复杂交互式 3D 对象**的高级框架。虽然表面上看起来与 Interactor 系统功能相似，但它们在设计理念、应用场景和架构层次上存在根本性差异。

### 什么是 Widget？

Widget 是具有以下特征的交互式 3D 对象：
- **自包含的几何体**：拥有自己的形状、外观和行为
- **状态驱动**：通过内部状态控制显示和交互
- **可视化反馈**：提供直观的视觉表示和操作提示  
- **特定用途**：专门为特定的交互场景设计

### 核心特性

- **几何表示**：Widget 在场景中有实际的几何体现
- **内置行为**：封装了特定的交互逻辑和业务规则
- **状态管理**：维护复杂的内部状态和状态转换
- **多视图支持**：可在不同的渲染窗口中同时显示
- **组合架构**：由多个组件协作构成完整功能

## Widget 与 Interactor 的根本区别

### 设计层次对比

```
应用层级结构:
┌─────────────────────────────────────────────────┐
│                    应用层                        │
├─────────────────────────────────────────────────┤
│              Widget 系统（高级）                 │
│    • 复杂交互对象                                │
│    • 业务逻辑封装                                │
│    • 特定用途设计                                │
├─────────────────────────────────────────────────┤
│            Interactor 系统（基础）               │
│    • 通用交互机制                                │
│    • 事件处理框架                                │
│    • 相机控制基础                                │
├─────────────────────────────────────────────────┤
│               渲染引擎层                         │
└─────────────────────────────────────────────────┘
```

### 功能定位差异

| 方面 | Interactor 系统 | Widget 系统 |
|------|-----------------|-------------|
| **主要用途** | 通用交互基础框架 | 特定用途的交互对象 |
| **抽象层级** | 低级别、通用化 | 高级别、专门化 |
| **可视表现** | 无直接几何体现 | 有具体几何表示 |
| **交互范围** | 全局场景交互 | 局部对象交互 |
| **复杂度** | 相对简单、直接 | 复杂、多状态 |
| **扩展方式** | 继承和组合 | 工厂模式和组件组合 |
| **应用场景** | 相机控制、基础导航 | 测量工具、编辑器、标注 |

### 协作关系

Widgets **依赖并构建在** Interactor 系统之上：

```
Widget 内部结构:
┌─────────────────────────────────────────┐
│            Widget Instance              │
├─────────────────────────────────────────┤
│  • AbstractWidget (继承)                │
│    └─ InteractorObserver (基类)         │
│  • WidgetState (状态管理)               │
│  • Representations (视觉表示)          │
│  • Manipulators (操作控制)              │
│  • Behavior (交互行为)                  │
└─────────────────────────────────────────┘
          │
          ▼ (使用)
┌─────────────────────────────────────────┐
│         Interactor System               │
│  • RenderWindowInteractor              │
│  • Event Processing                     │
│  • Observer Pattern                     │
└─────────────────────────────────────────┘
```

## Widget 系统架构

### 整体架构图

```
┌───────────────────────────────────────────────────────────┐
│                    WidgetManager                          │
│  • Widget 生命周期管理                                    │
│  • 多视图协调                                             │
│  • 选择和激活控制                                          │
│  • 渲染优化                                               │
└─────────────────────┬─────────────────────────────────────┘
                      │ 管理
                      ▼
┌───────────────────────────────────────────────────────────┐
│              AbstractWidgetFactory                       │
│  • Widget 实例创建                                        │
│  • 多视图 Widget 管理                                     │
│  • 组件组装协调                                           │
└─────────────────────┬─────────────────────────────────────┘
                      │ 创建
                      ▼
┌───────────────────────────────────────────────────────────┐
│                AbstractWidget                            │
│  • 基础 Widget 功能                                       │
│  • InteractorObserver 继承                               │
│  • 状态和表示协调                                          │
└─────┬─────────────┬─────────────┬────────────────────────┘
      │             │             │
      ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐
│WidgetState  │ │Representations│ │    Behavior        │
│• 状态管理   │ │• 视觉表示     │ │• 交互逻辑           │
│• 层级状态   │ │• 渲染控制     │ │• 事件处理           │
│• 激活控制   │ │• 多种表现形式 │ │• 业务规则           │
└─────────────┘ └─────────────┘ └─────────────────────┘
```

### 组件间依赖关系

1. **WidgetManager** 协调所有 Widget 实例
2. **AbstractWidgetFactory** 负责创建和配置
3. **AbstractWidget** 提供核心 Widget 功能
4. **WidgetState** 管理复杂的状态层级
5. **Representations** 处理视觉呈现
6. **Behavior** 封装交互逻辑

## 核心组件详解

### AbstractWidget - Widget 基础类

AbstractWidget 是所有 Widget 的基类，继承自 InteractorObserver：

```javascript
// AbstractWidget 核心功能
class AbstractWidget extends InteractorObserver {
  // 控制点激活管理
  activateHandle({ selectedState, representation }) {
    this.widgetState.activateOnly(selectedState);
    this.activeState = selectedState;
    if (selectedState && selectedState.updateManipulator) {
      selectedState.updateManipulator();
    }
    // 触发激活事件
    this.invokeActivateHandle({ selectedState, representation });
  }

  // 停用所有控制点
  deactivateAllHandles() {
    this.widgetState.deactivate();
  }

  // 焦点管理
  grabFocus() { this.hasFocus = true; }
  loseFocus() { this.hasFocus = false; }

  // Widget 放置
  placeWidget(bounds) {
    this.widgetState.placeWidget(bounds);
  }
}
```

#### 关键特性：

1. **控制点管理**：激活/停用交互控制点
2. **焦点控制**：管理 Widget 的输入焦点
3. **边界控制**：定义 Widget 的空间范围
4. **表示协调**：管理多种视觉表示
5. **事件集成**：与 Interactor 系统集成

### WidgetState - 状态管理系统

WidgetState 是 Widget 的核心状态管理组件：

```javascript
// WidgetState 状态管理
class WidgetState {
  constructor() {
    this.labels = {};           // 标签分类
    this.nestedStates = [];     // 嵌套子状态
    this.subscriptions = [];    // 事件订阅
  }

  // 绑定子状态
  bindState(nested, labels = ['default']) {
    this.nestedStates.push(nested);
    // 订阅子状态变化
    this.subscriptions.push(nested.onModified(this.modified));
    
    // 按标签分类管理
    labels.forEach(label => {
      if (!this.labels[label]) {
        this.labels[label] = [];
      }
      this.labels[label].push(nested);
    });
  }

  // 激活控制策略
  activateOnly(subState) {
    if (subState) {
      subState.setActive(true);
    }
    // 停用其他状态，但保留指定状态
    this.deactivate(subState);
  }

  // 按标签获取状态
  getStatesWithLabel(name) {
    return this.labels[name];
  }
}
```

#### 状态层级示例：

```
SphereWidget 状态结构:
WidgetState (root)
├─ moveHandle (移动控制点)
├─ centerHandle (中心控制点) 
├─ borderHandle (边界控制点)
└─ sphereHandle (球体表示)
    ├─ active: boolean
    ├─ origin: [x, y, z]
    ├─ scale: number
    └─ visible: boolean
```

### WidgetManager - 协调管理器

WidgetManager 负责管理场景中的所有 Widget：

```javascript
// WidgetManager 核心功能
class WidgetManager {
  constructor() {
    this.widgets = [];           // Widget 实例列表
    this.activeWidget = null;    // 当前活动 Widget
    this.pickingEnabled = true;  // 拾取功能控制
  }

  // 添加 Widget 到场景
  addWidget(widget) {
    const viewWidget = widget.getWidgetForView({ 
      viewId: this.viewId,
      renderer: this._renderer 
    });
    
    this.widgets.push(viewWidget);
    this.updateWidgetWeakMap(viewWidget);
    
    return viewWidget;
  }

  // 选择更新机制
  async updateSelection(callData) {
    const { position } = callData;
    const { widget, selectedState, representation } = 
      await this.getSelectedDataForXY(position.x, position.y);

    // 激活选中的 Widget
    if (widget && widget.getNestedPickable()) {
      this.activateWidget(widget, { selectedState, representation });
    } else {
      this.deactivateAllWidgets();
    }
  }

  // Widget 缩放管理
  updateDisplayScaleParams() {
    const displayParams = this.calculateScaleParameters();
    
    this.widgets.forEach(widget => {
      widget.getNestedProps().forEach(representation => {
        if (representation.getScaleInPixels()) {
          representation.setDisplayScaleParams(displayParams);
        }
      });
    });
  }
}
```

### AbstractWidgetFactory - Widget 工厂

AbstractWidgetFactory 实现 Widget 的创建和配置：

```javascript
// Widget 工厂模式
class AbstractWidgetFactory {
  // 为特定视图创建 Widget 实例
  getWidgetForView({ viewId, renderer, viewType, initialValues }) {
    if (!this.viewToWidget[viewId]) {
      // 创建 Widget 实例
      const widgetModel = {
        widgetState: this.widgetState,
        manipulator: this.manipulator,
        viewType,
        renderer,
        factory: this
      };

      const widgetPublicAPI = {};
      AbstractWidget.extend(widgetPublicAPI, widgetModel, initialValues);

      // 创建视觉表示
      widgetModel.representations = this.getRepresentationsForViewType(viewType)
        .map(({ builder, labels, initialValues }) => 
          builder.newInstance({
            _parentProp: widgetPublicAPI,
            labels,
            ...initialValues
          })
        );

      // 应用行为逻辑
      this.behavior(widgetPublicAPI, widgetModel);

      // 设置交互器
      widgetPublicAPI.setInteractor(interactor);
      
      this.viewToWidget[viewId] = Object.freeze(widgetPublicAPI);
    }
    
    return this.viewToWidget[viewId];
  }
}
```

### Representations - 视觉表示

Representations 负责 Widget 的视觉呈现：

```javascript
// 球形控制点表示
class SphereHandleRepresentation extends GlyphRepresentation {
  constructor() {
    super();
    
    // 创建显示映射器（HTML 渲染）
    this.displayMapper = vtkPixelSpaceCallbackMapper.newInstance();
    this.displayActor = vtkActor.newInstance({ parentProp: this });
    this.displayActor.setMapper(this.displayMapper);
    
    // 添加到渲染管线
    this.addActor(this.displayActor);
    this.alwaysVisibleActors = [this.displayActor];
  }

  // 设置显示回调
  setDisplayCallback(callback) {
    this.displayCallback = callback;
    this.displayMapper.setCallback(callback ? this.callbackProxy : null);
  }

  // 球体分辨率控制
  setGlyphResolution(resolution) {
    this._pipeline.glyph.setPhiResolution(resolution);
    this._pipeline.glyph.setThetaResolution(resolution);
  }
}
```

### Manipulators - 操作控制器

Widget Manipulators 处理具体的操作控制：

```javascript
// 平面操作器
class PlaneManipulator extends AbstractManipulator {
  // 处理事件，返回世界坐标
  handleEvent(callData, glRenderWindow) {
    const worldCoords = this.intersectDisplayWithPlane(
      callData.position.x,
      callData.position.y,
      this.getOrigin(callData),    // 平面原点
      this.getNormal(callData),    // 平面法向量
      callData.pokedRenderer,
      glRenderWindow
    );

    return this._addWorldDeltas({ worldCoords });
  }

  // 显示坐标与平面的交点计算
  intersectDisplayWithPlane(x, y, planeOrigin, planeNormal, renderer, glRenderWindow) {
    const near = glRenderWindow.displayToWorld(x, y, 0, renderer);
    const far = glRenderWindow.displayToWorld(x, y, 1, renderer);
    
    return vtkPlane.intersectWithLine(near, far, planeOrigin, planeNormal).x;
  }
}
```

## Widget 生命周期

### 1. 创建阶段

```javascript
// 1. 创建 Widget 工厂
const sphereWidget = vtkSphereWidget.newInstance();

// 2. 创建 Widget 管理器
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// 3. 注册 Widget 到管理器
const viewWidget = widgetManager.addWidget(sphereWidget);
```

### 2. 配置阶段

```javascript
// 配置 Widget 属性
viewWidget.setRadius(1.0);
viewWidget.setCenter([0, 0, 0]);

// 设置操作器
const manipulator = vtkPlanePointManipulator.newInstance({
  useCameraNormal: true
});
viewWidget.setManipulator(manipulator);

// 配置可见性
viewWidget.getRepresentations()[0].setVisible(true);
```

### 3. 交互阶段

```javascript
// Widget 行为处理交互
widgetBehavior = {
  handleLeftButtonPress(e) {
    const { worldCoords } = this.currentWorldCoords(e);
    
    if (this.activeState === this.moveHandle) {
      // 初始放置
      if (!this.centerHandle.getOrigin()) {
        this.centerHandle.setOrigin(worldCoords);
      }
    }
    
    return macro.EVENT_ABORT;
  },

  handleMouseMove(e) {
    if (!this.activeState) return macro.VOID;
    
    const { worldCoords } = this.currentWorldCoords(e);
    this.activeState.setOrigin(worldCoords);
    this.updateSphere();
    
    return macro.VOID;
  }
};
```

### 4. 状态更新

```javascript
// 状态变化触发更新
updateSphere() {
  const center = this.centerHandle.getOrigin();
  const border = this.borderHandle.getOrigin();
  
  if (center && border) {
    const radius = vec3.distance(center, border);
    
    // 更新球体表示
    this.sphereHandle.setOrigin(center);
    this.sphereHandle.setScale1(radius * 2);
    this.sphereHandle.setVisible(true);
    
    // 触发重绘
    this._interactor.render();
  }
}
```

### 5. 销毁阶段

```javascript
// 清理 Widget 资源
widgetManager.removeWidget(viewWidget);
viewWidget.delete();
sphereWidget.delete();
```

## Widget 类型和分类

### 几何 Widgets

#### SphereWidget - 球体 Widget
```javascript
const sphereWidget = vtkSphereWidget.newInstance();

// 核心功能
sphereWidget.getRadius();                    // 获取半径
sphereWidget.setCenterAndRadius(center, radius); // 设置中心和半径

// 状态组件
const state = sphereWidget.getWidgetState();
const centerHandle = state.getCenterHandle();   // 中心控制点
const borderHandle = state.getBorderHandle();   // 边界控制点
const sphereHandle = state.getSphereHandle();   // 球体表示
```

#### LineWidget - 线段 Widget
```javascript
const lineWidget = vtkLineWidget.newInstance();

// 线段特定功能
lineWidget.getPoint1();     // 起点
lineWidget.getPoint2();     // 终点
lineWidget.getLength();     // 长度
```

#### ImplicitPlaneWidget - 隐式平面 Widget
```javascript
const planeWidget = vtkImplicitPlaneWidget.newInstance();

// 平面控制
planeWidget.getOrigin();    // 平面原点
planeWidget.getNormal();    // 平面法向量
planeWidget.setNormalToCamera(); // 设置法向量朝向相机
```

### 测量 Widgets

#### AngleWidget - 角度测量
```javascript
const angleWidget = vtkAngleWidget.newInstance();

// 角度测量功能
angleWidget.getAngle();           // 获取角度值
angleWidget.getText();            // 获取显示文本
angleWidget.setTextDisplayCallback(callback); // 自定义显示
```

#### RulerWidget - 尺子工具
```javascript
const rulerWidget = vtkRulerWidget.newInstance();

// 距离测量
rulerWidget.getDistance();        // 获取距离
rulerWidget.setNumberOfPoints(n); // 设置测量点数
```

### 编辑 Widgets

#### PolyLineWidget - 多边形线段
```javascript
const polyLineWidget = vtkPolyLineWidget.newInstance();

// 多点编辑
polyLineWidget.addPoint(worldCoord);    // 添加点
polyLineWidget.removeLastPoint();       // 删除最后一点
polyLineWidget.getPoints();             // 获取所有点
```

#### ImageCroppingWidget - 图像裁剪
```javascript
const cropWidget = vtkImageCroppingWidget.newInstance();

// 裁剪控制
cropWidget.setCroppingPlanes(planes);   // 设置裁剪平面
cropWidget.getCroppingPlanes();         // 获取裁剪平面
cropWidget.setVolumeMapper(mapper);     // 关联体积映射器
```

### 特殊用途 Widgets

#### ResliceCursorWidget - 重切片光标
```javascript
const cursorWidget = vtkResliceCursorWidget.newInstance();

// 切片控制
cursorWidget.getCenter();               // 光标中心
cursorWidget.setImage(imageData);       // 设置图像数据
cursorWidget.updateCursor();            // 更新光标显示
```

#### InteractiveOrientationWidget - 交互式方向指示器
```javascript
const orientationWidget = vtkInteractiveOrientationWidget.newInstance();

// 方向控制
orientationWidget.setEnabled(true);     // 启用交互
orientationWidget.updateMarkerOrientation(); // 更新方向标记
```

## 使用示例

### 基础球体 Widget 示例

```javascript
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import vtkSphereWidget from '@kitware/vtk.js/Widgets/Widgets3D/SphereWidget';

// 1. 设置基础渲染环境
const renderWindow = vtkRenderWindow.newInstance();
const renderer = vtkRenderer.newInstance({ background: [0.1, 0.1, 0.2] });
renderWindow.addRenderer(renderer);

const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
renderWindow.addView(openglRenderWindow);

// 设置容器
const container = document.createElement('div');
document.body.appendChild(container);
openglRenderWindow.setContainer(container);
openglRenderWindow.setSize(800, 600);

// 2. 创建交互器
const interactor = vtkRenderWindowInteractor.newInstance();
interactor.setView(openglRenderWindow);
interactor.initialize();
interactor.bindEvents(container);

const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance();
interactor.setInteractorStyle(interactorStyle);

// 3. 创建 Widget 管理器
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// 4. 创建和配置球体 Widget
const sphereWidget = vtkSphereWidget.newInstance();
const viewWidget = widgetManager.addWidget(sphereWidget);

// 配置 Widget 属性
viewWidget.placeWidget([0, 1, 0, 1, 0, 1]); // 设置边界
viewWidget.setScaleInPixels(true);           // 启用像素缩放

// 5. Widget 事件处理
viewWidget.onStartInteractionEvent(() => {
  console.log('球体交互开始');
});

viewWidget.onInteractionEvent(() => {
  const center = viewWidget.getWidgetState().getCenterHandle().getOrigin();
  const radius = viewWidget.getRadius();
  console.log('球体更新：', { center, radius });
});

viewWidget.onEndInteractionEvent(() => {
  console.log('球体交互结束');
});

// 6. 启用 Widget 管理器
widgetManager.enablePicking();

// 7. 开始渲染
interactor.start();
```

### 多 Widget 协作示例

```javascript
// 创建多个不同类型的 Widget
const sphereWidget = vtkSphereWidget.newInstance();
const lineWidget = vtkLineWidget.newInstance();
const angleWidget = vtkAngleWidget.newInstance();

// 添加到管理器
const sphere = widgetManager.addWidget(sphereWidget);
const line = widgetManager.addWidget(lineWidget);
const angle = widgetManager.addWidget(angleWidget);

// 设置不同的显示样式
sphere.getRepresentations()[0].getActor().getProperty().setColor(1, 0, 0);
line.getRepresentations()[0].getActor().getProperty().setColor(0, 1, 0);
angle.getRepresentations()[0].getActor().getProperty().setColor(0, 0, 1);

// 协调交互 - 当球体更新时，更新线段端点
sphere.onInteractionEvent(() => {
  const center = sphere.getWidgetState().getCenterHandle().getOrigin();
  const radius = sphere.getRadius();
  
  // 更新线段端点到球体表面
  const point1 = [center[0] - radius, center[1], center[2]];
  const point2 = [center[0] + radius, center[1], center[2]];
  
  line.getWidgetState().getPoint1Handle().setOrigin(point1);
  line.getWidgetState().getPoint2Handle().setOrigin(point2);
});

// Widget 选择性启用/禁用
function enableOnlyWidget(targetWidget) {
  [sphere, line, angle].forEach(widget => {
    widget.setEnabled(widget === targetWidget);
  });
}

// 键盘控制不同 Widget
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case '1':
      enableOnlyWidget(sphere);
      break;
    case '2':
      enableOnlyWidget(line);
      break;
    case '3':
      enableOnlyWidget(angle);
      break;
  }
});
```

## 自定义 Widget 开发

### 创建自定义 Widget 的步骤

#### 1. 定义 Widget 状态结构

```javascript
// customWidgetState.js - 状态生成器
import { distance2BetweenPoints } from 'vtk.js/Sources/Common/Core/Math';
import vtkStateBuilder from 'vtk.js/Sources/Widgets/Core/StateBuilder';

export default function generateState() {
  return vtkStateBuilder.createBuilder()
    .addStateFromMixin({
      labels: ['moveHandle'],
      mixins: ['origin', 'color', 'scale1', 'visible', 'manipulator'],
      name: 'moveHandle',
      initialValues: {
        scale1: 10,
        visible: true,
      },
    })
    .addStateFromMixin({
      labels: ['anchorHandle'],
      mixins: ['origin', 'color', 'scale1', 'visible', 'manipulator'],
      name: 'anchorHandle',
      initialValues: {
        scale1: 8,
        origin: [0, 0, 0],
        visible: false,
      },
    })
    .addDynamicMixinState({
      labels: ['handles'],
      mixins: ['origin', 'color', 'scale1', 'visible'],
      name: 'handle',
      initialValues: {
        scale1: 5,
        visible: true,
      },
    })
    .build();
}
```

#### 2. 实现 Widget 行为

```javascript
// customWidgetBehavior.js - 交互行为
import macro from 'vtk.js/Sources/macros';

export default function widgetBehavior(publicAPI, model) {
  const state = model.widgetState;
  const moveHandle = state.getMoveHandle();
  const anchorHandle = state.getAnchorHandle();

  // Widget 特定状态
  model._isDragging = false;
  model._currentHandleIndex = -1;

  // 辅助函数
  function isValidHandle(handle) {
    return handle === moveHandle || 
           handle === anchorHandle ||
           state.getHandleList().includes(handle);
  }

  function getCurrentWorldCoords(e) {
    const manipulator = model.activeState?.getManipulator?.() ?? model.manipulator;
    return manipulator.handleEvent(e, model._apiSpecificRenderWindow);
  }

  // 更新 Widget 显示
  function updateWidget() {
    const anchor = anchorHandle.getOrigin();
    const handles = state.getHandleList();
    
    if (anchor && handles.length > 0) {
      // 执行自定义更新逻辑
      anchorHandle.setVisible(true);
      moveHandle.setVisible(false);
      
      // 触发重绘
      model._interactor.render();
    }
  }

  // 事件处理
  publicAPI.handleLeftButtonPress = (e) => {
    if (!isValidHandle(model.activeState)) {
      model.activeState = null;
      return macro.VOID;
    }

    const { worldCoords } = getCurrentWorldCoords(e);

    if (model.activeState === moveHandle) {
      // 创建新控制点
      const newHandle = state.addHandle();
      newHandle.setOrigin(worldCoords);
      newHandle.setVisible(true);
      
      // 如果是第一个点，设为锚点
      if (state.getHandleList().length === 1) {
        anchorHandle.setOrigin(worldCoords);
      }
      
      updateWidget();
      return macro.EVENT_ABORT;
    }

    // 开始拖拽已存在的控制点
    model._isDragging = true;
    model._apiSpecificRenderWindow.setCursor('grabbing');
    publicAPI.invokeStartInteractionEvent();
    
    return macro.EVENT_ABORT;
  };

  publicAPI.handleLeftButtonRelease = (e) => {
    if (model._isDragging) {
      model._isDragging = false;
      model._apiSpecificRenderWindow.setCursor('pointer');
      publicAPI.invokeEndInteractionEvent();
    }
    return macro.EVENT_ABORT;
  };

  publicAPI.handleMouseMove = (e) => {
    if (!model.activeState) return macro.VOID;

    const { worldCoords } = getCurrentWorldCoords(e);

    if (model._isDragging) {
      model.activeState.setOrigin(worldCoords);
      updateWidget();
    }

    return macro.VOID;
  };

  // 自定义方法
  publicAPI.addPoint = (worldCoord) => {
    const handle = state.addHandle();
    handle.setOrigin(worldCoord);
    handle.setVisible(true);
    updateWidget();
  };

  publicAPI.removeLastPoint = () => {
    const handles = state.getHandleList();
    if (handles.length > 0) {
      state.removeHandle();
      updateWidget();
    }
  };

  publicAPI.clearAllPoints = () => {
    state.clearHandleList();
    anchorHandle.setVisible(false);
    moveHandle.setVisible(true);
    updateWidget();
  };
}
```

#### 3. 创建 Widget 主类

```javascript
// customWidget.js - Widget 主类
import vtkAbstractWidgetFactory from 'vtk.js/Sources/Widgets/Core/AbstractWidgetFactory';
import vtkSphereHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/SphereHandleRepresentation';
import vtkPlanePointManipulator from 'vtk.js/Sources/Widgets/Manipulators/PlaneManipulator';
import macro from 'vtk.js/Sources/macros';

import widgetBehavior from './customWidgetBehavior';
import stateGenerator from './customWidgetState';

function vtkCustomWidget(publicAPI, model) {
  model.classHierarchy.push('vtkCustomWidget');

  const superClass = { ...publicAPI };

  // 定义需要链接到表示的方法
  model.methodsToLink = ['scaleInPixels', 'sphereScale'];

  // 为不同视图类型提供表示配置
  publicAPI.getRepresentationsForViewType = (viewType) => [
    // 移动控制点表示
    {
      builder: vtkSphereHandleRepresentation,
      labels: ['moveHandle'],
      initialValues: {
        useActiveColor: false,
      },
    },
    // 锚点表示
    {
      builder: vtkSphereHandleRepresentation,
      labels: ['anchorHandle'],
      initialValues: {
        useActiveColor: true,
      },
    },
    // 动态控制点表示
    {
      builder: vtkSphereHandleRepresentation,
      labels: ['handles'],
      initialValues: {
        useActiveColor: true,
      },
    },
  ];

  // 公共 API 方法
  publicAPI.getPoints = () => {
    const handles = model.widgetState.getHandleList();
    return handles.map(handle => handle.getOrigin());
  };

  publicAPI.setPoints = (points) => {
    const state = model.widgetState;
    
    // 清除现有点
    state.clearHandleList();
    
    // 添加新点
    points.forEach(point => {
      const handle = state.addHandle();
      handle.setOrigin(point);
      handle.setVisible(true);
    });

    // 设置锚点
    if (points.length > 0) {
      state.getAnchorHandle().setOrigin(points[0]);
      state.getAnchorHandle().setVisible(true);
      state.getMoveHandle().setVisible(false);
    }

    publicAPI.modified();
  };

  publicAPI.getNumberOfPoints = () => {
    return model.widgetState.getHandleList().length;
  };

  // 设置操作器
  publicAPI.setManipulator = (manipulator) => {
    superClass.setManipulator(manipulator);
    
    // 为所有控制点设置操作器
    model.widgetState.getMoveHandle().setManipulator(manipulator);
    model.widgetState.getAnchorHandle().setManipulator(manipulator);
    
    const handles = model.widgetState.getHandleList();
    handles.forEach(handle => handle.setManipulator(manipulator));
  };

  // 初始化
  publicAPI.setManipulator(
    model.manipulator ||
      vtkPlanePointManipulator.newInstance({ useCameraNormal: true })
  );
}

// 默认值生成器
const defaultValues = (initialValues) => ({
  behavior: widgetBehavior,
  widgetState: stateGenerator(),
  ...initialValues,
});

// 扩展函数
export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, defaultValues(initialValues));
  
  vtkAbstractWidgetFactory.extend(publicAPI, model, initialValues);
  
  macro.setGet(publicAPI, model, ['manipulator', 'widgetState']);
  
  vtkCustomWidget(publicAPI, model);
}

// 实例创建
export const newInstance = macro.newInstance(extend, 'vtkCustomWidget');

// 导出
export default { newInstance, extend };
```

#### 4. 使用自定义 Widget

```javascript
import vtkCustomWidget from './customWidget';

// 创建自定义 Widget
const customWidget = vtkCustomWidget.newInstance();
const viewWidget = widgetManager.addWidget(customWidget);

// 使用自定义功能
viewWidget.addPoint([1, 0, 0]);
viewWidget.addPoint([0, 1, 0]);
viewWidget.addPoint([0, 0, 1]);

console.log('点数量:', viewWidget.getNumberOfPoints());
console.log('所有点:', viewWidget.getPoints());

// 事件监听
viewWidget.onInteractionEvent(() => {
  console.log('自定义 Widget 交互中...');
});
```

## 最佳实践

### 1. Widget 设计原则

```javascript
// ✅ 好的实践 - 单一职责
class MeasurementWidget {
  constructor() {
    this.purpose = 'distance_measurement'; // 专注于距离测量
  }
}

// ❌ 避免 - 职责混乱
class ComplexWidget {
  constructor() {
    this.canMeasure = true;
    this.canEdit = true;
    this.canAnimate = true;  // 功能过于复杂
  }
}
```

### 2. 状态管理最佳实践

```javascript
// ✅ 正确的状态层级设计
function createWellStructuredState() {
  return vtkStateBuilder.createBuilder()
    // 明确的标签分类
    .addStateFromMixin({
      labels: ['handles'],     // 用于拾取
      mixins: ['origin', 'color', 'visible', 'manipulator'],
      name: 'controlHandle',
      initialValues: {
        visible: true,
        color: [1, 1, 1],
      },
    })
    // 单独的显示状态
    .addStateFromMixin({
      labels: ['representation'],
      mixins: ['origin', 'scale', 'orientation'],
      name: 'displayState',
    })
    .build();
}

// ❌ 避免 - 状态职责不清
function poorStateDesign() {
  return vtkStateBuilder.createBuilder()
    .addStateFromMixin({
      labels: ['everything'], // 标签含糊
      mixins: ['origin', 'color', 'scale', 'visible', 'manipulator', 'text'], // 混合过多
      name: 'confusedState',
    })
    .build();
}
```

### 3. 事件处理最佳实践

```javascript
// ✅ 清晰的事件处理流程
publicAPI.handleLeftButtonPress = (e) => {
  // 1. 验证状态
  if (!this.isValidState(model.activeState)) {
    return macro.VOID;
  }

  // 2. 获取世界坐标
  const { worldCoords } = this.getCurrentWorldCoords(e);

  // 3. 根据当前模式处理
  switch (model.interactionMode) {
    case 'placing':
      return this.handlePlacement(worldCoords);
    case 'editing':
      return this.handleEditStart(worldCoords);
    default:
      return macro.VOID;
  }
};

// ❌ 避免 - 复杂的嵌套逻辑
publicAPI.handleLeftButtonPress = (e) => {
  if (model.activeState) {
    if (model.activeState === handle1) {
      if (model.mode === 'edit') {
        if (model.subMode === 'move') {
          // 深层嵌套，难以维护
        }
      }
    }
  }
};
```

### 4. 内存管理

```javascript
// ✅ 正确的资源清理
publicAPI.delete = macro.chain(() => {
  // 清理事件订阅
  model.subscriptions.forEach(sub => sub.unsubscribe());
  model.subscriptions = [];
  
  // 清理状态引用
  model.widgetState.unbindAll();
  
  // 清理表示
  model.representations.forEach(rep => rep.delete());
  model.representations = [];
  
  // 清理映射关系
  model.actorToRepresentationMap = new WeakMap();
  
}, publicAPI.delete);

// Widget 管理器中的清理
widgetManager.removeWidget = (widget) => {
  const index = this.widgets.indexOf(widget);
  if (index !== -1) {
    this.widgets.splice(index, 1);
    
    // 清理引用
    widget.getNestedProps().forEach(prop => {
      this.propsWeakMap.delete(prop);
    });
    
    // 删除 Widget
    widget.delete();
  }
};
```

### 5. 性能优化策略

```javascript
// ✅ 批量更新优化
class OptimizedWidget {
  constructor() {
    this.updatePending = false;
    this.batchedUpdates = new Set();
  }

  requestUpdate(component) {
    this.batchedUpdates.add(component);
    
    if (!this.updatePending) {
      this.updatePending = true;
      requestAnimationFrame(() => {
        this.performBatchUpdate();
        this.updatePending = false;
      });
    }
  }

  performBatchUpdate() {
    // 批量处理所有更新
    this.batchedUpdates.forEach(component => {
      component.update();
    });
    
    this.batchedUpdates.clear();
    
    // 单次渲染
    this._interactor.render();
  }
}

// ✅ 条件渲染优化
publicAPI.handleMouseMove = (e) => {
  if (!model.activeState || !model._isDragging) {
    return macro.VOID;
  }

  const { worldCoords } = this.getCurrentWorldCoords(e);
  
  // 检查是否真正改变
  if (this.hasSignificantChange(worldCoords)) {
    model.activeState.setOrigin(worldCoords);
    this.requestUpdate(this);
  }

  return macro.VOID;
};

hasSignificantChange(newCoords) {
  const oldCoords = model.activeState.getOrigin();
  const threshold = 0.001; // 最小变化阈值
  
  return vtkMath.distance2BetweenPoints(oldCoords, newCoords) > threshold * threshold;
}
```

## 性能优化

### 1. 渲染优化

```javascript
// 分层渲染策略
class LayeredWidgetManager extends vtkWidgetManager {
  constructor() {
    super();
    this.staticWidgets = new Set();    // 静态 Widget
    this.dynamicWidgets = new Set();   // 动态 Widget
    this.dirtyWidgets = new Set();     // 需要更新的 Widget
  }

  // 标记 Widget 为静态
  markStatic(widget) {
    this.staticWidgets.add(widget);
    this.dynamicWidgets.delete(widget);
  }

  // 智能渲染
  smartRender() {
    let needsRender = false;

    // 只更新脏 Widget
    this.dirtyWidgets.forEach(widget => {
      widget.updateRepresentationForRender();
      needsRender = true;
    });

    if (needsRender) {
      this._interactor.render();
      this.dirtyWidgets.clear();
    }
  }

  // 标记需要更新
  markDirty(widget) {
    this.dirtyWidgets.add(widget);
    
    // 节流渲染
    if (!this.renderPending) {
      this.renderPending = true;
      requestAnimationFrame(() => {
        this.smartRender();
        this.renderPending = false;
      });
    }
  }
}
```

### 2. 内存使用优化

```javascript
// 对象池模式
class HandlePool {
  constructor() {
    this.available = [];
    this.used = new Set();
  }

  acquire() {
    let handle;
    
    if (this.available.length > 0) {
      handle = this.available.pop();
      handle.reset(); // 重置状态
    } else {
      handle = this.createNewHandle();
    }
    
    this.used.add(handle);
    return handle;
  }

  release(handle) {
    if (this.used.has(handle)) {
      this.used.delete(handle);
      this.available.push(handle);
    }
  }

  createNewHandle() {
    return vtkHandleState.newInstance();
  }
}

// 使用对象池
const handlePool = new HandlePool();

class EfficientWidget {
  addHandle() {
    const handle = handlePool.acquire();
    this.handles.push(handle);
    return handle;
  }

  removeHandle(handle) {
    const index = this.handles.indexOf(handle);
    if (index !== -1) {
      this.handles.splice(index, 1);
      handlePool.release(handle);
    }
  }
}
```

### 3. 事件处理优化

```javascript
// 事件代理和节流
class OptimizedEventHandler {
  constructor() {
    this.throttledMouseMove = this.throttle(this.handleMouseMove.bind(this), 16);
    this.eventQueue = [];
    this.processingEvents = false;
  }

  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  // 批量事件处理
  queueEvent(eventType, eventData) {
    this.eventQueue.push({ type: eventType, data: eventData });
    
    if (!this.processingEvents) {
      this.processingEvents = true;
      requestAnimationFrame(() => this.processEventQueue());
    }
  }

  processEventQueue() {
    const currentQueue = [...this.eventQueue];
    this.eventQueue = [];

    // 批量处理相同类型的事件
    const eventGroups = currentQueue.reduce((groups, event) => {
      if (!groups[event.type]) {
        groups[event.type] = [];
      }
      groups[event.type].push(event);
      return groups;
    }, {});

    Object.keys(eventGroups).forEach(eventType => {
      this.processBatchedEvents(eventType, eventGroups[eventType]);
    });

    this.processingEvents = false;
  }
}
```

通过这个全面的 Widget 系统分析，我们可以看出 Widget 和 Interactor 虽然在某些功能上看起来相似，但它们在设计理念、应用层次和使用场景上有着根本的区别。Widget 系统构建在 Interactor 系统之上，提供了更高级别、更专业化的交互功能，专门用于创建复杂的 3D 交互对象和工具。