# VTK.js 交互器系统 - 完整架构和使用指南

## 目录
1. [概览](#概览)
2. [架构](#架构)  
3. [RenderWindowInteractor](#renderwindowinteractor)
4. [InteractorStyle 系统](#interactorstyle-系统)
5. [Manipulator 框架](#manipulator-框架)
6. [Widget 系统](#widget-系统)
7. [事件处理](#事件处理)
8. [使用示例](#使用示例)
9. [高级定制](#高级定制)
10. [最佳实践](#最佳实践)

## 概览

VTK.js 交互器系统提供了一个用于处理用户与 3D 场景交互的综合框架。它由多个相互关联的组件组成，这些组件协同工作，将用户输入事件（鼠标、键盘、触摸、VR 控制器）转换为有意义的 3D 场景操作。

### 核心组件
- **RenderWindowInteractor**: 中央事件处理器和协调器
- **InteractorStyle**: 高级交互行为定义
- **Manipulators**: 模块化、可组合的交互处理器
- **Widgets**: 复杂的交互式 3D 对象
- **Event System**: 基于观察者模式的事件传播

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户输入事件                              │
│            (鼠标、键盘、触摸、VR 控制器)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                RenderWindowInteractor                          │
│  • 事件处理和规范化                                             │
│  • 手势识别                                                     │
│  • 动画管理                                                     │
│  • 观察者模式协调                                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   InteractorStyle                              │
│  • 高级交互逻辑                                                 │
│  • 状态管理                                                     │
│  • 默认按键绑定                                                 │
└─────────────────┬───────────────────┬───────────────────────────┘
                  │                   │
                  ▼                   ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│     Manipulators        │    │       Widgets           │
│  • 模块化处理器         │    │  • 复杂3D对象           │
│  • 可组合动作           │    │  • 状态管理             │
│  • 相机控制             │    │  • 视觉反馈             │
└─────────────────────────┘    └─────────────────────────┘
```

## RenderWindowInteractor

`vtkRenderWindowInteractor` 是处理所有用户输入事件并协调交互系统的核心组件。

### 核心职责

1. **事件处理**: 捕获和规范化 DOM 事件
2. **事件分发**: 将事件路由到适当的处理器
3. **动画管理**: 控制渲染循环和帧率
4. **手势识别**: 识别多点触控手势
5. **指针锁定**: 管理第一人称视角交互
6. **VR 支持**: 处理 XR 控制器输入

### 主要特性

#### 处理的事件类型
```javascript
const handledEvents = [
  'StartAnimation', 'Animation', 'EndAnimation',
  'PointerEnter', 'PointerLeave',
  'MouseEnter', 'MouseLeave',
  'StartMouseMove', 'MouseMove', 'EndMouseMove',
  'LeftButtonPress', 'LeftButtonRelease',
  'MiddleButtonPress', 'MiddleButtonRelease',
  'RightButtonPress', 'RightButtonRelease',
  'KeyPress', 'KeyDown', 'KeyUp',
  'StartMouseWheel', 'MouseWheel', 'EndMouseWheel',
  'StartPinch', 'Pinch', 'EndPinch',
  'StartPan', 'Pan', 'EndPan',
  'StartRotate', 'Rotate', 'EndRotate',
  'Button3D', 'Move3D',
  'StartPointerLock', 'EndPointerLock'
];
```

#### 初始化和设置
```javascript
// 创建和配置交互器
const interactor = vtkRenderWindowInteractor.newInstance();
interactor.setView(openglRenderWindow);
interactor.initialize();
interactor.bindEvents(container);

// 设置交互样式
interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());

// 启用/禁用功能
interactor.setEnabled(true);
interactor.setRecognizeGestures(true);
```

#### 动画系统
交互器管理一个复杂的动画系统：

```javascript
// 从组件请求动画
interactor.requestAnimation(requestor);

// 延长动画以实现平滑过渡
interactor.extendAnimation(600); // 毫秒

// 取消动画
interactor.cancelAnimation(requestor);

// 检查是否正在动画
if (interactor.isAnimating()) {
  // 处理动画状态
}
```

#### 手势识别
内置的多点触控手势支持：

- **捏合**: 缩放/放大操作
- **平移**: 双指平移
- **旋转**: 围绕中心的双指旋转

```javascript
// 手势识别阈值和逻辑
recognizeGesture(event, positions) {
  const originalDistance = Math.sqrt(/* 距离计算 */);
  const newDistance = Math.sqrt(/* 新距离计算 */);
  const angleDeviation = newAngle - originalAngle;
  
  // 根据移动特征确定手势类型
  if (pinchDistance > threshold) {
    this.currentGesture = 'Pinch';
  } else if (rotateDistance > threshold) {
    this.currentGesture = 'Rotate';
  } else if (panDistance > threshold) {
    this.currentGesture = 'Pan';
  }
}
```

#### VR/XR 支持
全面的 VR 控制器支持：

```javascript
updateXRGamepads(xrSession, xrFrame, xrRefSpace) {
  xrSession.inputSources.forEach((inputSource) => {
    const gamepad = inputSource.gamepad;
    const hand = inputSource.handedness;
    
    // 处理按钮状态并触发事件
    for (let buttonIdx = 0; buttonIdx < gamepad.buttons.length; ++buttonIdx) {
      if (buttonPressed !== lastButtonState) {
        this.button3DEvent({
          gamepad,
          position: gripPose.transform.position,
          orientation: gripPose.transform.orientation,
          device: inputSource.handedness === 'left' 
            ? Device.LeftController 
            : Device.RightController,
          input: deviceInputMap[gamepad.mapping][buttonIdx]
        });
      }
    }
  });
}
```

## InteractorStyle 系统

InteractorStyles 定义高级交互行为，并为常见交互模式提供默认实现。

### 基类

#### InteractorObserver
所有交互器观察者的基类：

```javascript
class InteractorObserver {
  // 事件订阅管理
  setInteractor(interactor) {
    this.unsubscribeFromEvents();
    this._interactor = interactor;
    if (interactor && this.enabled) {
      this.subscribeToEvents();
    }
  }

  // 自动事件处理器注册
  subscribeToEvents() {
    vtkRenderWindowInteractor.handledEvents.forEach((eventName) => {
      if (this[`handle${eventName}`]) {
        this.subscribedEvents.push(
          this._interactor[`on${eventName}`]((callData) => {
            if (this.processEvents) {
              return this[`handle${eventName}`](callData);
            }
          }, this.priority)
        );
      }
    });
  }
}
```

#### InteractorStyle
扩展 InteractorObserver 并添加状态管理：

```javascript
class InteractorStyle extends InteractorObserver {
  // 状态管理
  startRotate() {
    if (this.state !== States.IS_NONE) return;
    this.state = States.IS_ROTATE;
    this._interactor.requestAnimation(this);
  }

  endRotate() {
    if (this.state !== States.IS_ROTATE) return;
    this.state = States.IS_NONE;
    this._interactor.cancelAnimation(this);
  }

  // 默认按键绑定
  handleKeyPress(callData) {
    switch (callData.key) {
      case 'r': case 'R':
        this.getRenderer(callData).resetCamera();
        break;
      case 'w': case 'W':
        // 设置线框表示
        break;
      case 's': case 'S':
        // 设置表面表示
        break;
    }
  }
}
```

### 内置 InteractorStyles

#### InteractorStyleTrackballCamera
用于 3D 导航最常用的样式：

```javascript
const style = vtkInteractorStyleTrackballCamera.newInstance();

// 鼠标交互映射：
// 左键: 围绕焦点旋转相机
// 左键 + Shift: 平移相机
// 左键 + Ctrl/Alt: 围绕视图方向旋转相机
// 左键 + Shift + Ctrl/Alt: 推拉（缩放）
// 鼠标滚轮: 推拉

style.handleLeftButtonPress = (callData) => {
  if (callData.shiftKey) {
    if (callData.controlKey || callData.altKey) {
      this.startDolly(); // 缩放
    } else {
      this.startPan(); // 平移
    }
  } else {
    if (callData.controlKey || callData.altKey) {
      this.startSpin(); // 旋转
    } else {
      this.startRotate(); // 旋转
    }
  }
};
```

#### InteractorStyleImage
为 2D 图像查看优化：

```javascript
const style = vtkInteractorStyleImage.newInstance();

// 功能：
// - 窗位/窗宽调整
// - 图像平移
// - 缩放功能
// - 切片导航
```

#### InteractorStyleMPRSlice
用于多平面重建查看：

```javascript
const style = vtkInteractorStyleMPRSlice.newInstance();

// 专用于：
// - 切片滚动
// - 十字线导航
// - 窗位/窗宽调整
```

## Manipulator 框架

Manipulator 提供了一种模块化的交互处理方法，允许对特定交互行为进行细粒度控制。

### Manipulator 类型

#### 鼠标 Manipulators
- `MouseCameraTrackballRotateManipulator`: 相机旋转
- `MouseCameraTrackballPanManipulator`: 相机平移  
- `MouseCameraTrackballZoomManipulator`: 相机缩放
- `MouseCameraTrackballZoomToMouseManipulator`: 缩放到光标位置
- `MouseBoxSelectorManipulator`: 框选

#### 手势 Manipulators
- `GestureCameraManipulator`: 多点触控相机控制

#### 键盘 Manipulators
- `KeyboardCameraManipulator`: 基于键盘的相机控制

#### VR Manipulators
- `VRButtonPanManipulator`: VR 控制器平移

### InteractorStyleManipulator

组合多个 manipulator 以实现复杂的交互方案：

```javascript
const manipulatorStyle = vtkInteractorStyleManipulator.newInstance();

// 添加鼠标 manipulators
const rotateManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance();
rotateManipulator.setButton(1); // 鼠标左键
manipulatorStyle.addMouseManipulator(rotateManipulator);

const panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance();
panManipulator.setButton(1); // 鼠标左键
panManipulator.setShift(true); // 配合 shift 键
manipulatorStyle.addMouseManipulator(panManipulator);

const zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance();
zoomManipulator.setButton(3); // 鼠标右键
manipulatorStyle.addMouseManipulator(zoomManipulator);

// 添加手势 manipulators
const gestureManipulator = vtkGestureCameraManipulator.newInstance();
manipulatorStyle.addGestureManipulator(gestureManipulator);
```

### 自定义 Manipulator 创建

```javascript
function createCustomManipulator() {
  const manipulator = vtkMouseCameraTrackballRotateManipulator.newInstance();
  
  // 配置按钮/键组合
  manipulator.setButton(1); // 鼠标左键
  manipulator.setShift(false);
  manipulator.setControl(false);
  
  // 自定义行为
  manipulator.onStartInteraction((callData) => {
    // 自定义开始逻辑
  });
  
  manipulator.onInteraction((callData) => {
    // 自定义交互逻辑
  });
  
  manipulator.onEndInteraction((callData) => {
    // 自定义结束逻辑
  });
  
  return manipulator;
}
```

## Widget 系统

Widgets 提供具有自己状态管理和视觉反馈的复杂交互式 3D 对象。

### Widget 架构

```javascript
// Widget Manager - 协调 widget 交互
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// Widget Factory - 创建 widget 实例
const widget = vtkSomeWidget.newInstance();

// 添加到场景
const viewWidget = widgetManager.addWidget(widget);

// 配置 widget 行为
widget.setManipulator(manipulator);
widget.getWidgetState().setVisible(true);
```

### Widget 生命周期

1. **创建**: 工厂方法创建 widget 实例
2. **注册**: WidgetManager 将 widget 添加到场景
3. **激活**: 用户交互激活 widget 控制点
4. **操作**: 活动控制点响应输入
5. **停用**: 交互结束时停用控制点

### Widget 状态管理

Widgets 通过 WidgetState 系统维护内部状态：

```javascript
const widgetState = widget.getWidgetState();

// 访问子状态（控制点、表示）
const handles = widgetState.getHandleList();
const activeHandle = widgetState.getActiveHandle();

// 状态属性
widgetState.setVisible(true);
widgetState.setOrigin(0, 0, 0);
widgetState.setScale(1, 1, 1);
```

### Widget-Interactor 集成

Widgets 通过 WidgetManager 与交互器系统集成：

```javascript
// WidgetManager 处理选择和激活
async updateSelection(callData) {
  const { position } = callData;
  const { widget, selectedState, representation } = 
    await this.getSelectedDataForXY(position.x, position.y);

  if (widget && widget.getNestedPickable()) {
    widget.activateHandle({ selectedState, representation });
    this.activeWidget = widget;
  } else {
    // 停用所有 widgets
    this.widgets.forEach(w => w.deactivateAllHandles());
  }
}
```

## 事件处理

VTK.js 交互器系统使用复杂的观察者模式进行事件处理。

### 事件流程

1. **DOM 事件捕获**: 浏览器事件被容器捕获
2. **事件规范化**: 转换为 VTK.js 事件格式
3. **事件分发**: 路由到注册的观察者
4. **优先级处理**: 高优先级观察者先处理
5. **事件传播**: 事件通过系统传播

### 事件注册

```javascript
// 基于方法名的自动注册
class CustomInteractorStyle extends vtkInteractorStyle {
  handleMouseMove(callData) {
    // 此方法自动注册为 MouseMove 事件
    const { position } = callData;
    // 自定义鼠标移动逻辑
  }
  
  handleKeyPress(callData) {
    // 自动注册为 KeyPress 事件
    const { key, controlKey, shiftKey, altKey } = callData;
    // 自定义按键处理逻辑
  }
}
```

### 事件数据结构

所有事件包含标准化数据：

```javascript
const callData = {
  type: 'MouseMove',
  position: { x: 100, y: 200, z: 0 },
  pokedRenderer: renderer,
  firstRenderer: firstRenderer,
  controlKey: false,
  shiftKey: false,
  altKey: false,
  deviceType: 'mouse'
};
```

### 自定义事件处理器

```javascript
// 订阅特定事件
const subscription = interactor.onMouseMove((callData) => {
  console.log('鼠标移动到:', callData.position);
  
  // 返回 false 停止事件传播
  return callData.position.x > 100;
});

// 完成后取消订阅
subscription.unsubscribe();
```

## 使用示例

### 基础设置

```javascript
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera';

// 创建渲染组件
const renderWindow = vtkRenderWindow.newInstance();
const renderer = vtkRenderer.newInstance({ background: [0.1, 0.2, 0.3] });
renderWindow.addRenderer(renderer);

const openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
renderWindow.addView(openglRenderWindow);

// 设置容器
const container = document.createElement('div');
document.body.appendChild(container);
openglRenderWindow.setContainer(container);
openglRenderWindow.setSize(800, 600);

// 设置交互器
const interactor = vtkRenderWindowInteractor.newInstance();
interactor.setView(openglRenderWindow);
interactor.initialize();
interactor.bindEvents(container);

// 设置交互样式
const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance();
interactor.setInteractorStyle(interactorStyle);

// 开始交互
interactor.start();
```

### 自定义交互样式

```javascript
function createCustomInteractorStyle() {
  const style = vtkInteractorStyle.extend({
    handleLeftButtonPress(callData) {
      if (callData.shiftKey) {
        this.startCustomAction();
      } else {
        this.startRotate();
      }
    },

    handleLeftButtonRelease() {
      if (this.state === States.IS_ROTATE) {
        this.endRotate();
      } else if (this.state === States.IS_CUSTOM) {
        this.endCustomAction();
      }
    },

    handleMouseMove(callData) {
      if (this.state === States.IS_CUSTOM) {
        this.performCustomAction(callData.position);
      } else {
        // 委托给父类
        this.handleMouseMove(callData);
      }
    },

    startCustomAction() {
      this.state = States.IS_CUSTOM;
      this._interactor.requestAnimation(this);
    },

    endCustomAction() {
      this.state = States.IS_NONE;
      this._interactor.cancelAnimation(this);
    },

    performCustomAction(position) {
      // 这里是自定义交互逻辑
      console.log('自定义动作位置:', position);
    }
  });

  return style;
}
```

### Widget 集成

```javascript
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import vtkSphereWidget from '@kitware/vtk.js/Widgets/Widgets3D/SphereWidget';

// 创建 widget manager
const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

// 创建和配置 widget
const sphereWidget = vtkSphereWidget.newInstance();
const viewWidget = widgetManager.addWidget(sphereWidget);

// 配置 widget 行为
viewWidget.setRadius(1.0);
viewWidget.setCenter(0, 0, 0);
viewWidget.getRepresentations()[0].setVisible(true);

// 处理 widget 事件
viewWidget.onInteractionEvent(() => {
  const center = viewWidget.getCenter();
  const radius = viewWidget.getRadius();
  console.log('球体已更新:', center, radius);
});
```

### 多点触控手势

```javascript
// 启用手势识别
interactor.setRecognizeGestures(true);

// 自定义手势处理
const gestureStyle = vtkInteractorStyle.extend({
  handleStartPinch(callData) {
    this.initialScale = callData.scale;
    console.log('捏合手势开始');
  },

  handlePinch(callData) {
    const scaleFactor = callData.scale / this.initialScale;
    const renderer = this.getRenderer(callData);
    const camera = renderer.getActiveCamera();
    
    if (camera.getParallelProjection()) {
      camera.setParallelScale(camera.getParallelScale() / scaleFactor);
    } else {
      camera.dolly(scaleFactor);
    }
    
    this.initialScale = callData.scale;
  },

  handleEndPinch() {
    console.log('捏合手势结束');
  }
});
```

## 高级定制

### 自定义 Manipulator 开发

```javascript
function createCustomZoomManipulator() {
  const manipulator = macro.newInstance((publicAPI, model) => {
    model.classHierarchy.push('CustomZoomManipulator');

    publicAPI.onButtonDown = (interactor, renderer, position) => {
      model.previousPosition = position;
      model.center = renderer.getCenter();
    };

    publicAPI.onMouseMove = (interactor, renderer, position) => {
      if (!model.previousPosition) return;

      const dy = position.y - model.previousPosition.y;
      const camera = renderer.getActiveCamera();
      const zoomFactor = Math.pow(1.1, dy * 0.01);

      if (camera.getParallelProjection()) {
        camera.setParallelScale(camera.getParallelScale() / zoomFactor);
      } else {
        // 缩放到鼠标位置
        const worldPoint = interactor.getInteractorStyle()
          .computeDisplayToWorld(renderer, position.x, position.y, 0);
        
        camera.setFocalPoint(worldPoint);
        camera.dolly(zoomFactor);
      }

      model.previousPosition = position;
    };

    publicAPI.onButtonUp = () => {
      model.previousPosition = null;
    };
  });

  return manipulator;
}
```

### 事件系统扩展

```javascript
// 自定义事件类型
const CUSTOM_EVENTS = ['CustomEvent1', 'CustomEvent2'];

// 使用自定义事件扩展交互器
function extendInteractorWithCustomEvents(interactor) {
  CUSTOM_EVENTS.forEach(eventName => {
    macro.event(interactor, interactor.getModel(), eventName);
    
    interactor[`invoke${eventName}`] = (callData) => {
      const event = { type: eventName, ...callData };
      interactor.invokeEvent(event);
    };
  });

  // 触发自定义事件
  interactor.triggerCustomEvent1 = (data) => {
    interactor.invokeCustomEvent1(data);
  };
}
```

### 性能优化

```javascript
// 节流昂贵操作
function createThrottledInteractorStyle(throttleMs = 16) {
  let lastUpdate = 0;
  
  return vtkInteractorStyle.extend({
    handleMouseMove(callData) {
      const now = Date.now();
      if (now - lastUpdate > throttleMs) {
        this.performExpensiveOperation(callData);
        lastUpdate = now;
      }
    },

    performExpensiveOperation(callData) {
      // 昂贵的渲染或计算
    }
  });
}

// 批处理渲染更新
function createBatchedRenderer(renderWindow) {
  let pendingRender = false;
  
  const requestRender = () => {
    if (!pendingRender) {
      pendingRender = true;
      requestAnimationFrame(() => {
        renderWindow.render();
        pendingRender = false;
      });
    }
  };
  
  return { requestRender };
}
```

## 最佳实践

### 1. 内存管理

```javascript
// 始终清理交互器
function cleanupInteractor(interactor) {
  if (interactor) {
    interactor.unbindEvents();
    interactor.delete();
  }
}

// 移除事件订阅
function cleanupEventSubscriptions(subscriptions) {
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.length = 0;
}
```

### 2. 事件处理

```javascript
// 使用优先级排序事件
const highPriorityStyle = vtkInteractorStyle.newInstance();
highPriorityStyle.setPriority(10);

const lowPriorityStyle = vtkInteractorStyle.newInstance();
lowPriorityStyle.setPriority(1);

// 返回 false 停止事件传播
publicAPI.handleMouseMove = (callData) => {
  if (this.shouldHandleEvent(callData)) {
    this.processEvent(callData);
    return false; // 停止传播
  }
  return true; // 继续传播
};
```

### 3. 性能考虑

```javascript
// 在交互期间最小化渲染调用
publicAPI.handleMouseMove = (callData) => {
  // 更新内部状态而不渲染
  this.updateCameraPosition(callData.position);
  
  // 仅在交互结束时渲染
  if (this.state === States.IS_NONE) {
    this._interactor.render();
  }
};

// 使用动画系统进行平滑交互
publicAPI.startInteraction = () => {
  this._interactor.requestAnimation(this);
};

publicAPI.endInteraction = () => {
  this._interactor.cancelAnimation(this);
  this._interactor.render(); // 最终渲染
};
```

### 4. 跨平台兼容性

```javascript
// 处理不同输入设备
publicAPI.handlePointerDown = (callData) => {
  switch (callData.deviceType) {
    case 'mouse':
      this.handleMouseDown(callData);
      break;
    case 'touch':
      this.handleTouchStart(callData);
      break;
    case 'pen':
      this.handlePenDown(callData);
      break;
  }
};

// 考虑设备像素比
const getScreenPosition = (event) => {
  const canvas = this._view.getCanvas();
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  
  return {
    x: scaleX * (event.clientX - bounds.left),
    y: scaleY * (bounds.height - event.clientY + bounds.top)
  };
};
```

### 5. 错误处理

```javascript
// 健壮的事件处理器实现
publicAPI.handleMouseMove = (callData) => {
  try {
    if (!this.validateCallData(callData)) {
      return;
    }

    const renderer = this.getRenderer(callData);
    if (!renderer) {
      console.warn('交互没有可用的渲染器');
      return;
    }

    this.performInteraction(callData, renderer);
  } catch (error) {
    console.error('鼠标移动处理器错误:', error);
    this.resetInteractionState();
  }
};
```

这个全面的指南为开发者提供了理解、实现和自定义 VTK.js 应用程序中用户交互所需的一切。交互器系统的模块化设计允许简单使用和复杂定制场景。