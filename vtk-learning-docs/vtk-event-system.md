# VTK 事件系统

## 综述

最基础的 macro.event 会生成 invoke{EventName}方法，用于触发事件, 用 on{EventName}方法，用于监听事件。

Interactor 在上面封装了一层，Interactor 监听浏览器的事件，然后将其转为{EventName}Event 事件出发，这个 Event 事件内部其实依然是调用了 macro.event 生成的 invoke{EventName}方法。

InteractorObserver 订阅 Interactor 的 Event 事件,生成 handle{EventName}方法，用于处理事件，其内部其实是通过 Interactor 的 on{EventName}方法监听事件。

InteractorObserver 内部又有自己的事件,如下所示:

```javascript
macro.event(publicAPI, model, 'InteractionEvent');
macro.event(publicAPI, model, 'StartInteractionEvent');
macro.event(publicAPI, model, 'EndInteractionEvent');
```

这些事件可以被外部用到 InteractorObserver 的 on{EventName}方法监听。比如 widget（继承 InteractorObserver）的实例就可以通过这个方法发送事件，然后这些事件还可以带参数，给外部提供更多信息。

widgetManager 监听 Interactor 的事件，用 on{EventName}方法监听事件，然后根据事件处理，负责激活某个被选中的 abstractWidget 实例。**注意这里是 on{EventName}方法监听的 Interactor 的事件，而不是 InteractorObserver 的 handle{EventName}事件。**

## 概览

VTK.js 交互器系统提供了一个用于处理用户与 3D 场景交互的综合框架。它由多个相互关联的组件组成，这些组件协同工作，将用户输入事件（鼠标、键盘、触摸、VR 控制器）转换为有意义的 3D 场景操作。

## 关键类及其作用

**Interactor**：负责接受浏览器中的各种事件（鼠标键盘等）的输入，然后将其转为 vtk 自己的自定义事件并且派发出去
**InteractorObserver**: 所有接收 Interactor 的事件的基类，然后派发给接收事件的函数，执行具体的操作
**InteractorStyle**:
**WidgetManager**:
**AbstractWidget**:

## Interactor 的作用和实现

### 鼠标事件到 Interactor 事件

interactor 中有以下的核心代码

```javascript
const _bindEvents = () => {
  //其余代码

  //将浏览器事件和内部函数绑定
  container.addEventListener('wheel', publicAPI.handleWheel);
  container.addEventListener('DOMMouseScroll', publicAPI.handleWheel);
  container.addEventListener('pointerenter', publicAPI.handlePointerEnter);
  container.addEventListener('pointermove', publicAPI.handlePointerMove);
  //其余绑定和代码
};
```

将浏览器的事件和和`handle{EventName}`函数绑定，当浏览器中的事件触发时候，就会触发相应的内部函数，然后内部函数再将其转为 vtk 自定义事件发送出去,这里用浏览器的`pointermove`事件为例子,其绑定到了`interactor`的`handlePointerMove`事件。如下，这里可能还会根据触发方式的不同（比如鼠标触发还是触摸屏点击触发）将事件转到不同的函数上去。然后将这些`handle{EventName}`的事件会被转为`{EventName}Event`的 interactor 自定义事件调用。比如下面代码中的`startMouseMoveEvent`，`mouseMoveEvent`。这些事件最后会被 interactorObaserver 监听并且在其中执行。

```javascript
publicAPI.handlePointerMove = (event) => {
  //其余代码
  switch (event.pointerType) {
    case 'pen':
    case 'touch':
      publicAPI.handleTouchMove(event);
      break;
    case 'mouse':
    default:
      publicAPI.handleMouseMove(event);
      break;
  }
  //其余代码
};

publicAPI.handleMouseMove = (event) => {
  //构建调用参数
  const callData = {
    ...getModifierKeysFor(event),
    position: getScreenEventPositionFor(event),
    deviceType: getDeviceTypeFor(event),
  };

  if (model.moveTimeoutID === 0) {
    //开始事件
    publicAPI.startMouseMoveEvent(callData);
  } else {
    //执行事件
    publicAPI.mouseMoveEvent(callData);
    clearTimeout(model.moveTimeoutID);
  }

  // start a timer to keep us animating while we get mouse move events
  model.moveTimeoutID = setTimeout(() => {
    //结束事件
    publicAPI.endMouseMoveEvent();
    model.moveTimeoutID = 0;
  }, 200);
};
```

这里的事件转化流程如下

```
浏览器{EventName}
    ↓
interactor的handle{EventName}
    ↓
interactor分发到子handle{SubEventName}（如果有）
    ↓
interactor的自定义事件唤起{SubEventName}Event
    ↓
interactorObaser的handle{SubEventName}执行具体操作
```

`vtkRenderWindow`中可以设置`Interactor`

```javascript
renderWindow.setInteractor(interactor);
```

### Interactor 事件如何发送到 InteractorObserver

`Interactor`中所有的自定义事件都是通过`vtk`的`macro`系统转发到`InteractorObserver`的，其核心代码如下。一开始就将所有的自定义事件定义到一个列表`handledEvents`中，然后调用`foreach`函数将所有的事件名称转为`{eventName}Event`形式的事件，最后用`vtk`的`macro`系统中的`invoke{EventName}`调用事件，`invoke{EventName}`会唤起所有注册的`on{EventName}`函数，达到事件分发的效果。`vtk`的`macro`系统如何事件`invoke on`系统会在`macro`章节中详述。

```javascript
const handledEvents = [
  //其他事件
  'MouseEnter',
  'MouseLeave',
  'MouseMove',
  //其他事件
];

handledEvents.forEach((eventName) => {
  //转为事件名+Event的形式
  const lowerFirst = eventName.charAt(0).toLowerCase() + eventName.slice(1);
  publicAPI[`${lowerFirst}Event`] = (arg) => {
    //构建调用参数
    const callData = {
      type: eventName,
      pokedRenderer: model.currentRenderer,
      firstRenderer: publicAPI.getFirstRenderer(),
      // Add the arguments to the call data
      ...arg,
    };

    //用vtk事件系统唤起事件invoke{EventName}调用后on{EventName}就会被唤起，这个在后文vtk macro系统中详述
    publicAPI[`invoke${eventName}`](callData);
  };
});
```

## IteractorObserver 的作用和实现

### 事件注册和触发

`vtkInteractorObserver` 是一个抽象观察器基类，为需要监听 `vtkRenderWindowInteractor` 事件的对象提供框架。它实现了观察者模式，是构建交互式 3D 对象（如 widget、操作器、自定义交互工具）的基础。

其核心代码就是将自己的`handle{EventName}`函数注册到`Interactor`中，当`Interactor`调用`{EventName}Event`时候，`interactorObserver`的 handle`{EventName}`被触发。代码如下，当`InteractorObserver`的继承类中有`handle{EventName}`函数的时候，将其注册，当`interactor`的`on{eventName}`调用时候调用`handle{eventName}`。`on{EventName}`之所以被调用是因为`vtk macro`系统。

```javascript
function subscribeToEvents() {
  //handledEvents就是上文中Interactor中定义的字符串数组
  vtkRenderWindowInteractor.handledEvents.forEach((eventName) => {
    if (publicAPI[`handle${eventName}`]) {
      model.subscribedEvents.push(
        model._interactor[`on${eventName}`]((callData) => {
          if (model.processEvents) {
            return publicAPI[`handle${eventName}`](callData);
          }
          return VOID;
        }, model.priority)
      );
    }
  });
}
```

整个调用链条如下，有点绕人。

```
Interactor的{EventName}Event触发
            ↓
vtk macro事件系统的invoke{EventName}触发
            ↓
vtk macro的on{EventName}触发
            ↓
interactorObserver的handle{EventName}触发
```

### 坐标变换功能

Interactor 提供两个函数世界坐标系与显示坐标系的转换, 这对于交互式操作至关重要，比如将鼠标点击的 2D 坐标转换为 3D 场景中的对应位置。

```javascript
  /**
   * Transform from world to display coordinates.
   *
   * @param {vtkRenderer} renderer The vtkRenderer instance.
   * @param {Number} x
   * @param {Number} y
   * @param {Number} z
   */
  computeWorldToDisplay(
    renderer: vtkRenderer,
    x: number,
    y: number,
    z: number
  ): Vector3;

  /**
   * Transform from display to world coordinates.
   *
   * @param {vtkRenderer} renderer The vtkRenderer instance.
   * @param {Number} x
   * @param {Number} y
   * @param {Number} z
   */
  computeDisplayToWorld(
    renderer: vtkRenderer,
    x: number,
    y: number,
    z: number
  ): Vector3;
```

### 交互事件

InteractorObserver 定义了三个关键交互事件：

- StartInteractionEvent：用户交互开始
- InteractionEvent：交互过程中持续触发
- EndInteractionEvent：交互结束

这为所有交互组件提供了统一的交互状态通知机制。可以通过下述方式订阅其事件，知道什么时候触发了什么事件。

```javascript
someObserver.onStartInteractionEvent((interactionMethodName) => {
  //do something
});
someObserver.onInteractionEvent((interactionMethodName) => {
  //do something
});

someObserver.onEndInteractionEvent((interactionMethodName) => {
  //do something
});
```

## InteractorStyle

vtkInteractorStyle 是 VTK.js 渲染系统中负责处理用户交互的基础类，定义了 3D 视图中的各种交互模式和行为。其继承自 InteractorObserver。

### InteractorStyle 中的状态

该类通过动态生成的状态管理方法，提供了 7 种不同的交互模式，每种模式都有对应的开始/结束事件。

1. 旋转模式 (Rotate) States.IS_ROTATE

- 用途：围绕场景中心旋转相机视角
- 方法：startRotate(), endRotate()
- 事件：StartRotateEvent, EndRotateEvent

2. 平移模式 (Pan) States.IS_PAN

- 用途：在屏幕平面内平移相机位置
- 方法：startPan(), endPan()
- 事件：StartPanEvent, EndPanEvent

3. 旋转模式 (Spin) States.IS_SPIN

- 用途：绕垂直于屏幕的轴旋转场景
- 方法：startSpin(), endSpin()
- 事件：StartSpinEvent, EndSpinEvent

4. 缩放模式 (Dolly) States.IS_DOLLY

- 用途：沿相机视线方向缩放视图
- 方法：startDolly(), endDolly()
- 事件：StartDollyEvent, EndDollyEvent

5. 相机姿态模式 (CameraPose) States.IS_CAMERA_POSE

- 用途：设置特定的相机姿态
- 方法：startCameraPose(), endCameraPose()
- 事件：StartCameraPoseEvent, EndCameraPoseEvent

6. 窗宽窗位模式 (WindowLevel) States.IS_WINDOW_LEVEL

- 用途：医学影像专用的窗宽窗位调节
- 方法：startWindowLevel(), endWindowLevel()
- 事件：StartWindowLevelEvent, EndWindowLevelEvent

7. 切片模式 (Slice) States.IS_SLICE

- 用途：逐层查看体积数据
- 方法：startSlice(), endSlice()
- 事件：StartSliceEvent, EndSliceEvent

### 状态之间的转换

状态转换规则

```javascript
// 开始状态：只能从 IS_NONE 切换到指定状态
if (model.state !== States.IS_NONE) return;
model.state = stateNames[key];

// 结束状态：只能从指定状态返回 IS_NONE
if (model.state !== stateNames[key]) return;
model.state = States.IS_NONE;
```

有了上述的状态之后 InteractorStyle 的派生类会在自己接收到 Interactor 下发的鼠标事件后，调用 start{StateName}来切换不同的状态，然后再根据不同的状态运行相应的鼠标处理。这里用 InteractorStyleTrackballCamera 来作为例子。

```javascript
//当鼠标左键点击时候切换状态
publicAPI.handleLeftButtonPress = (callData) => {
  const pos = callData.position;
  model.previousPosition = pos;

  if (callData.shiftKey) {
    if (callData.controlKey || callData.altKey) {
      publicAPI.startDolly();
    } else {
      publicAPI.startPan();
    }
  } else {
    if (callData.controlKey || callData.altKey) {
      publicAPI.startSpin();
    } else {
      publicAPI.startRotate();
    }
  }
};

//鼠标移动时候根据状态处理不同的事件
// Public API methods
publicAPI.handleMouseMove = (callData) => {
  const pos = callData.position;
  const renderer = model.getRenderer(callData);

  switch (model.state) {
    case States.IS_ROTATE:
      publicAPI.handleMouseRotate(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
      break;

    case States.IS_PAN:
      publicAPI.handleMousePan(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
      break;

    case States.IS_DOLLY:
      publicAPI.handleMouseDolly(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
      break;

    case States.IS_SPIN:
      publicAPI.handleMouseSpin(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
      break;

    default:
      break;
  }

  model.previousPosition = pos;
};
```

## WidgetManager

WidgetManager 是 vtk.js 中交互式 3D 小部件系统的核心管理器，负责：

- 管理多个小部件的生命周期
- 处理鼠标/触摸事件和选择交互
- 协调渲染和拾取(pass 渲染)
- 维护缩放和显示参数
- 管理焦点和激活状态

这个类和其细节功能会在 Widget 系统篇章详述，放到这里来讲是因为 WidgetManager 会用 vtk macro 系统将自己 on{EventName}函数注册到 Interactor 将鼠标转化后的 invoke{EventName}事件，前文说过 Interactor 是将{EventName}Event 转到 invoke{EventName}发送事件的，这里正是用 on{EventName}订阅了这个事件。

WidgetManger 之所以要订阅这个事件，是因为它需要通过鼠标事件激活被鼠标选中的 Representation 和 WidgetState（Widget 系统中详细描述）。因为设计细节颇多这里不详述

## AbstractWidget

AbstractWidget 是 WidgetState 实例化之后的类，负责掌管 widget 系统中的具体的一个 widget 实例，负责显示 widget 和将鼠标事件转为控制 3D 渲染中的状态或者参数。

这里提及是因为 AbstractWidget 也是继承自 InteractorObserver，可以处理 Interactor 下发的鼠标事件。AbstractWidget 处理鼠标事件时候会结合 widgetManger 选中的状态和 Interactor 的鼠标事件一同考虑。

这个篇章也细节颇多，放在 Widget 系统中详述。
