# vtk.js 拾取机制完全解析

## 目录

1. [核心概念：硬件选择（Hardware Selection）](#1-核心概念硬件选择hardware-selection)
2. [多通道渲染（Multi-Pass Rendering）](#2-多通道渲染multi-pass-rendering)
3. [渲染类型（RenderingTypes）](#3-渲染类型renderingtypes)
4. [完整拾取流程（Step-by-Step）](#4-完整拾取流程step-by-step)
5. [数据结构总览](#5-数据结构总览)
6. [性能优化策略](#6-性能优化策略)
7. [完整流程图](#7-完整流程图文本形式)
8. [具体示例：拾取球形手柄](#8-具体示例拾取球形手柄)
9. [关键要点总结](#9-关键要点总结)

---

## 1. 核心概念：硬件选择（Hardware Selection）

### 什么是硬件选择？

硬件选择（也称为"颜色编码拾取"）是一种利用 GPU 加速的 3D 对象识别技术。与传统的 CPU 射线-物体相交测试不同，vtk.js 使用**颜色编码拾取**（Color-Coded Picking）技术。

### 颜色编码原理

**编码过程**：每个 actor/prop 被分配一个唯一的整数 ID，然后转换为 RGB 颜色值：

```javascript
// 来自 OpenGL/HardwareSelector/index.js:653-657
publicAPI.setPropColorValueFromInt = (val) => {
  model.propColorValue[0] = (val % 256) / 255.0;                    // R通道
  model.propColorValue[1] = (Math.floor(val / 256) % 256) / 255.0; // G通道
  model.propColorValue[2] = (Math.floor(val / 65536) % 256) / 255.0; // B通道
};
```

这允许编码最多 **16,777,216** (256³) 个唯一对���。

**解码过程**：从帧缓冲读取 RGB 值，重建 ID：

```javascript
// 来自 OpenGL/HardwareSelector/index.js:27-36
function convert(xx, yy, pb, area) {
  const offset = (yy * (area[2] - area[0] + 1) + xx) * 4;
  const r = pb[offset];
  const g = pb[offset + 1];
  const b = pb[offset + 2];
  return (b * 256 + g) * 256 + r;  // 从RGB重建ID
}
```

### 为什么使用离屏缓冲（Off-Screen Buffer）？

1. **隔离性**：拾取渲染使用特殊着色器，不影响用户看到的画面
2. **无视觉伪影**：用户视图保持不变
3. **精确像素读取**：可以准确读取鼠标坐标处的像素值
4. **多通道渲染**：支持多次渲染，每次编码不同信息

**位置**：`Sources/Rendering/OpenGL/HardwareSelector/index.js`，第 349-367 行

---

## 2. 多通道渲染（Multi-Pass Rendering）

硬��选择器执行**4个渲染通道**，每次编码不同的信息：

```javascript
// 来自 OpenGL/HardwareSelector/Constants.js
export const PassTypes = {
  ACTOR_PASS: 0,           // 编码哪个 actor/prop
  COMPOSITE_INDEX_PASS: 1,  // 编码子部件索引（如实例化几何体的实例ID）
  ID_LOW24: 2,              // 单元格/点的低24位ID
  ID_HIGH24: 3,             // 单元格/点的高24位ID（��持>1600万个图元）
};
```

### 为什么需要���通道？

- **ACTOR_PASS**：识别哪个对象被点击
- **COMPOSITE_INDEX_PASS**：对于有多个实例的对象（如 Glyph），识别具体哪个实例
- **ID_LOW24 + ID_HIGH24**：支持高达 **281万亿** (2^48) 个单元格/点的ID编码

### 通道处理流程

#### Actor 注册（第 615-621 行）

```javascript
publicAPI.renderProp = (prop) => {
  if (model.currentPass === PassTypes.ACTOR_PASS) {
    publicAPI.setPropColorValueFromInt(model.props.length + idOffset);
    model.props.push(prop);  // 存储 prop 供后续查找
  }
};
```

每个 actor 获得下一个可用的 ID（带偏移量 1 以避免纯黑色 = 0）。

#### 组合索引（第 623-628 行）

对于有多个子部件的对象（如 glyphs），组合索引标识哪个实例：

```javascript
publicAPI.renderCompositeIndex = (index) => {
  if (model.currentPass === PassTypes.COMPOSITE_INDEX_PASS) {
    publicAPI.setPropColorValueFromInt(index + idOffset);
  }
};
```

---

## 3. 渲染类型（RenderingTypes）

**文件**：`Sources/Widgets/Core/WidgetManager/Constants.js`，第 11-14 行

```javascript
export const RenderingTypes = {
  PICKING_BUFFER: 0,  // 用颜色编码ID渲染到离屏缓冲
  FRONT_BUFFER: 1,    // 正常渲染（带材质、光照等）
};
```

### 何时使用每种类型

**PICKING_BUFFER** (值: 0):
- 捕获选择数据时使用
- 触发特殊渲染模式，actors 用编码颜色渲染
- Handle representations 始终可见（因此可以被拾取）
- 由 `WidgetManager.renderPickingBuffer()` 在���获前调用

**FRONT_BUFFER** (值: 1):
- 用于正常显示渲染
- Actors 用实际外观渲染（颜色、纹理等）
- Handle representations 遵循可见性标志（可能被隐藏）
- 由 `WidgetManager.renderFrontBuffer()` 在拾取后调用

### 对 Actor 可见性的影响

**文件**：`Sources/Widgets/Representations/WidgetRepresentation/index.js`，第 220-253 行

```javascript
publicAPI.updateActorVisibility = (
  renderingType = RenderingTypes.FRONT_BUFFER,
  ctxVisible = true,
  handleVisible = true
) => {
  let otherFlag = true;
  switch (model.behavior) {
    case Behavior.HANDLE:
      // 关键：Handles 在 PICKING_BUFFER 期间始终可见
      otherFlag =
        renderingType === RenderingTypes.PICKING_BUFFER || handleVisible;
      break;
    case Behavior.CONTEXT:
      otherFlag = ctxVisible;
      break;
    default:
      otherFlag = true;
      break;
  }
  // 应用可见性到此 representation 的��有 actors
  for (let i = 0; i < model.actors.length; i++) {
    model.actors[i].setVisibility(otherFlag && model.visibilityFlagArray[i]);
  }
};
```

**关键洞察**：Handle representations（如你拖动的球体）在 `PICKING_BUFFER` 期间强制可见，因此即使它们被配置为在正常视图中不可见，也总是可以被选择。

---

## 4. 完整拾取流程（Step-by-Step）

以下是从鼠标事件到 widget 选择的逐步流程：

### 步骤 1：鼠标事件触发

**文件**：`Sources/Widgets/Core/WidgetManager/index.js`，第 293-312 行

```javascript
// setRenderer() 期间注册鼠标移动处理器
subscriptions.push(
  model._interactor.onMouseMove((eventData) => {
    handleEvent(eventData);  // 开始拾取流程
    return macro.VOID;
  })
);
```

### 步骤 2：handleEvent → updateSelection

**第 196-208 行**：

```javascript
const handleEvent = async (callData, fromTouchEvent = false) => {
  if (
    !model.isAnimating &&
    model.pickingEnabled &&
    callData.pokedRenderer === model._renderer
  ) {
    const callID = Symbol('UpdateSelection');
    model._currentUpdateSelectionCallID = callID;
    await updateSelection(callData, fromTouchEvent, callID);
  } else {
    deactivateAllWidgets();
  }
};
```

**注意**：动画期间禁用拾取以提高性能。

### 步骤 3：获取鼠标位置的选中数据

**第 129-183 行**：

```javascript
async function updateSelection(callData, fromTouchEvent, callID) {
  const { position } = callData;

  // 关键调用：触发拾取过程
  const { requestCount, selectedState, representation, widget } =
    await publicAPI.getSelectedDataForXY(position.x, position.y);

  // ... 处理选择结果
}
```

### 步骤 4：捕获缓冲（如果需要）

**第 390-412 行**：

```javascript
publicAPI.getSelectedDataForXY = async (x, y) => {
  model.selections = null;
  if (model.pickingEnabled) {
    // 检查是否需要新捕获
    if (!model._capturedBuffers ||
        model.captureOn === CaptureOn.MOUSE_MOVE) {
      await captureBuffers(x, y, x, y);  // 触发拾取渲染
    } else {
      // 检查鼠标是否移出缓存区域
      const capturedRegion = model._capturedBuffers.area;
      if (x < capturedRegion[0] || x > capturedRegion[2] ||
          y < capturedRegion[1] || y > capturedRegion[3]) {
        await captureBuffers(x, y, x, y);  // 重新捕获
      }
    }

    // 从捕获的缓冲生成选择
    model.selections = model._capturedBuffers.generateSelection(x, y, x, y);
  }
  return publicAPI.getSelectedData();
};
```

**性能优化**：如果鼠标仍在已捕获区域内，重用缓冲！

### 步骤 5：captureBuffers - 核心拾取渲染

**第 224-243 行**：

```javascript
async function captureBuffers(x1, y1, x2, y2) {
  if (model._captureInProgress) {
    await model._captureInProgress;
    return;
  }

  // 步骤 5A：切换所有 widgets 到 PICKING_BUFFER 模式
  renderPickingBuffer();  // 设置 renderingType = PICKING_BUFFER

  // 步骤 5B：调用硬件选择器执行实际拾取渲染
  model._capturedBuffers = null;
  model._captureInProgress = model._selector.getSourceDataAsync(
    model._renderer,
    x1, y1, x2, y2
  );
  model._capturedBuffers = await model._captureInProgress;
  model._captureInProgress = null;

  model.previousSelectedData = null;

  // 步骤 5C：切换回正常渲染
  renderFrontBuffer();  // 设置 renderingType = FRONT_BUFFER
}
```

**第 214-222 行**：

```javascript
function renderPickingBuffer() {
  model.renderingType = RenderingTypes.PICKING_BUFFER;
  model.widgets.forEach(updateWidgetForRender);  // 更新所有 widget 可见性
}

function renderFrontBuffer() {
  model.renderingType = RenderingTypes.FRONT_BUFFER;
  model.widgets.forEach(updateWidgetForRender);
}

function updateWidgetForRender(w) {
  w.updateRepresentationForRender(model.renderingType);  // 传播到 representations
}
```

### 步骤 6：硬件选择器离屏渲染

**文件**：`Sources/Rendering/OpenGL/HardwareSelector/index.js`，第 454-526 行（`captureBuffers`）：

```javascript
publicAPI.captureBuffers = () => {
  // 初始化帧缓冲和渲染器
  model._openGLRenderer = model._openGLRenderWindow.getViewNodeFor(model._renderer);

  publicAPI.invokeEvent({ type: 'StartEvent' });

  // 设置背景为黑色（表示未命中）
  model.originalBackground = model._renderer.getBackgroundByReference();
  model._renderer.setBackground(0.0, 0.0, 0.0, 0.0);

  publicAPI.beginSelection();  // 创建/绑定帧缓冲，清除，在渲染器上设置选择器

  // 执行多通道渲染
  const pixelBufferSavedPasses = [];
  for (
    model.currentPass = PassTypes.MIN_KNOWN_PASS;
    model.currentPass <= PassTypes.MAX_KNOWN_PASS;
    model.currentPass++
  ) {
    if (publicAPI.passRequired(model.currentPass)) {
      publicAPI.preCapturePass(model.currentPass);  // 禁用混合

      // 关键：用当前通道编码渲染整个场景
      model._openGLRenderWindow.traverseAllPasses();

      publicAPI.postCapturePass(model.currentPass);  // 恢复混合

      // 从 GPU 读取像素
      publicAPI.savePixelBuffer(model.currentPass);
      pixelBufferSavedPasses.push(model.currentPass);
    }
  }

  // 处理捕获的像素数据
  pixelBufferSavedPasses.forEach((pass) => {
    model.currentPass = pass;
    publicAPI.processPixelBuffers();  // 在命中的 props 上调用 processSelectorPixelBuffers
  });

  publicAPI.endSelection();  // 恢复帧缓冲，从渲染器清除选择器

  // 恢复原始背景
  model._renderer.setBackground(model.originalBackground);
  publicAPI.invokeEvent({ type: 'EndEvent' });

  return true;
};
```

**关键理解**：每次 `traverseAllPasses()` 都会渲染整个场景，但使用不同的着色器输出不同的编码信息。

### 步骤 7：从 GPU 读取像素数据

**第 554-594 行**（`savePixelBuffer`）：

```javascript
publicAPI.savePixelBuffer = (passNo) => {
  // 从帧缓冲读取像素
  model.pixBuffer[passNo] = model._openGLRenderWindow.getPixelData(
    model.area[0], model.area[1],
    model.area[2], model.area[3]
  );

  // 保存原始副本
  if (!model.rawPixBuffer[passNo]) {
    const size = (model.area[2] - model.area[0] + 1) *
                 (model.area[3] - model.area[1] + 1) * 4;
    model.rawPixBuffer[passNo] = new Uint8Array(size);
    model.rawPixBuffer[passNo].set(model.pixBuffer[passNo]);
  }

  // ACTOR_PASS 后，构建命中列表
  if (passNo === PassTypes.ACTOR_PASS) {
    if (model.captureZValues) {
      // 同时读取深度缓冲
      const rpasses = model._openGLRenderWindow.getRenderPasses();
      const fb = rpasses[0].getFramebuffer();
      fb.saveCurrentBindingsAndBuffers();
      fb.bind();
      model.zBuffer = model._openGLRenderWindow.getPixelData(/* ... */);
      fb.restorePreviousBindingsAndBuffers();
    }
    publicAPI.buildPropHitList(model.rawPixBuffer[passNo]);
  }
};
```

### 步骤 8：构建命中列表

**第 596-613 行**：

```javascript
publicAPI.buildPropHitList = (pixelbuffer) => {
  let offset = 0;
  // 扫描整个选择区域
  for (let yy = 0; yy <= model.area[3] - model.area[1]; yy++) {
    for (let xx = 0; xx <= model.area[2] - model.area[0]; xx++) {
      let val = convert(xx, yy, pixelbuffer, model.area);
      if (val > 0) {  // 0 = 背景（未命中）
        val--;  // 移除偏移量
        if (!(val in model.hitProps)) {
          model.hitProps[val] = true;  // 标记此 prop 被命中
          model.propPixels[val] = [];  // 记录命中的像素
        }
        model.propPixels[val].push(offset * 4);
      }
      ++offset;
    }
  }
};
```

### 步骤 9：解码拾取的 Actors

**第 667-818 行**：

```javascript
publicAPI.getPixelInformation = (inDisplayPosition, maxDistance, outSelectedPosition) => {
  // 1. 转换显示坐标到缓冲偏移
  const displayPosition = [
    inDisplayPosition[0] - model.area[0],
    inDisplayPosition[1] - model.area[1],
  ];

  // 2. 从 ACTOR_PASS 缓冲解码 actor ID
  const actorid = convert(displayPosition[0], displayPosition[1],
                          model.pixBuffer[PassTypes.ACTOR_PASS], model.area);

  // 3. 获取实际的 prop 引用
  info.propID = actorid - idOffset;
  info.prop = model.props[info.propID];

  // 4. 从 COMPOSITE_INDEX_PASS 缓冲解码组合 ID
  let compositeID = convert(displayPosition[0], displayPosition[1],
                            model.pixBuffer[PassTypes.COMPOSITE_INDEX_PASS], model.area);
  info.compositeID = compositeID - idOffset;

  // 5. 可选：获取 Z 深度
  if (model.captureZValues) {
    info.zValue = /* 从深度缓冲解码 */;
  }

  // 6. 解码单元格/点属性 ID（从两个 24 位通道组合成 48 位 ID）
  const low24 = convert(displayPosition[0], displayPosition[1],
                        model.pixBuffer[PassTypes.ID_LOW24], model.area);
  const high24 = convert(displayPosition[0], displayPosition[1],
                         model.pixBuffer[PassTypes.ID_HIGH24], model.area);
  info.attributeID = getID(low24, high24);

  return info;
};
```

### 步骤 10：生成选择结果

**第 275-324 行**（`generateSelectionWithData`）：

```javascript
function generateSelectionWithData(buffdata, fx1, fy1, fx2, fy2) {
  const dataMap = new Map();
  const outSelectedPosition = [0, 0];

  // 扫描选择矩形
  for (let yy = y1; yy <= y2; yy++) {
    for (let xx = x1; xx <= x2; xx++) {
      const pos = [xx, yy];

      // 获取此像素的完整信息
      const info = getPixelInformationWithData(buffdata, pos, 0, outSelectedPosition);

      if (info && info.valid) {
        // 按 (propID, compositeID) 分组
        const hash = getInfoHash(info);  // `${info.propID} ${info.compositeID}`

        if (!dataMap.has(hash)) {
          dataMap.set(hash, {
            info,
            pixelCount: 1,
            attributeIDs: [info.attributeID],
          });
        } else {
          const dmv = dataMap.get(hash);
          dmv.pixelCount++;
          // 追踪所有命中的属性 IDs（单元格/点）
          if (dmv.attributeIDs.indexOf(info.attributeID) === -1) {
            dmv.attributeIDs.push(info.attributeID);
          }
        }
      }
    }
  }

  // 转换为 vtkSelectionNode 数组
  return convertSelection(
    buffdata.fieldAssociation,
    dataMap,
    buffdata.captureZValues,
    buffdata.renderer,
    buffdata.openGLRenderWindow
  );
}
```

### 步骤 11：映射到 Widget

回到 `WidgetManager.getSelectedData()`（第 414-453 行）：

```javascript
publicAPI.getSelectedData = () => {
  if (!model.selections || !model.selections.length) {
    model.previousSelectedData = null;
    return {};
  }

  // 获取选择属性
  const { propID, compositeID, prop } = model.selections[0].getProperties();
  let { widget, representation } = model.selections[0].getProperties();

  // 检查缓存
  if (
    model.previousSelectedData &&
    model.previousSelectedData.prop === prop &&
    model.previousSelectedData.widget === widget &&
    model.previousSelectedData.compositeID === compositeID
  ) {
    model.previousSelectedData.requestCount++;
    return model.previousSelectedData;
  }

  // 使用 WeakMap 从 prop 查找 widget/representation
  if (propsWeakMap.has(prop)) {
    const props = propsWeakMap.get(prop);
    widget = props.widget;
    representation = props.representation;
  }

  if (widget && representation) {
    // 获取对应此拾取的状态对象
    const selectedState = representation.getSelectedState(prop, compositeID);

    model.previousSelectedData = {
      requestCount: 0,
      propID,
      compositeID,
      prop,
      widget,
      representation,
      selectedState,  // 这是 widget 的内部状态（例如手柄位置）
    };
    return model.previousSelectedData;
  }

  model.previousSelectedData = null;
  return {};
};
```

**关键机制**：`propsWeakMap` 在 widget 添加时建立映射：

```javascript
// 第 65-76 行
function updateWidgetWeakMap(widget) {
  const representations = widget.getRepresentations();
  for (let i = 0; i < representations.length; i++) {
    const representation = representations[i];
    const origin = { widget, representation };
    const actors = representation.getActors();
    for (let j = 0; j < actors.length; j++) {
      const actor = actors[j];
      propsWeakMap.set(actor, origin);  // 映射 actor → {widget, representation}
    }
  }
}
```

### 步骤 12：激活 Widget Handle

回到 `updateSelection`（第 129-183 行）：

```javascript
async function updateSelection(callData, fromTouchEvent, callID) {
  const { position } = callData;
  const { requestCount, selectedState, representation, widget } =
    await publicAPI.getSelectedDataForXY(position.x, position.y);

  if (requestCount || callID !== model._currentUpdateSelectionCallID) {
    return;  // 已处理或过时的调用
  }

  function activateHandle(w) {
    if (fromTouchEvent) {
      model._interactor.invokeLeftButtonRelease(callData);
    }
    // 激活被拾取的手柄
    w.activateHandle({ selectedState, representation });
    if (fromTouchEvent) {
      model._interactor.invokeLeftButtonPress(callData);
    }
  }

  // 更新光标
  const cursorStyles = publicAPI.getCursorStyles();
  const style = widget ? 'hover' : 'default';
  const cursor = cursorStyles[style];
  if (cursor) {
    model._apiSpecificRenderWindow.setCursor(cursor);
  }

  model.activeWidget = null;
  let wantRender = false;

  // 检查 widget 焦点并激活适当的 widget
  if (model.widgetInFocus === widget && widget.hasFocus()) {
    activateHandle(widget);
    model.activeWidget = widget;
    wantRender = true;
  } else {
    // 检查所有 widgets
    for (let i = 0; i < model.widgets.length; i++) {
      const w = model.widgets[i];
      if (w === widget && w.getNestedPickable()) {
        activateHandle(w);
        model.activeWidget = w;
        wantRender = true;
      } else {
        wantRender ||= !!w.getActiveState();
        w.deactivateAllHandles();
      }
    }
  }

  if (wantRender) {
    model._interactor.render();
  }
}
```

---

## 5. 数据结构总览

```javascript
// 硬件选择器的关键数据结构
model.props[]           // 所有可拾取的 actors（按编码ID索引）
model.hitProps{}        // 被命中的 prop IDs 集合
model.propPixels{}      // 每个命中的 prop 的像素偏移数组
model.pixBuffer[]       // Uint8Array 缓冲数组，每个通道一个
model.zBuffer           // 可选的深度缓冲数据
model.framebuffer       // 离屏 WebGL 帧缓冲

// WidgetManager 的关键数据结构
propsWeakMap            // WeakMap<actor, {widget, representation}>
model._capturedBuffers  // 缓存的拾取数据
model.selections        // vtkSelectionNode[] 数组
model.activeWidget      // 当前激活的 widget
model.previousSelectedData  // 上一次选择的缓存
```

---

## 6. 性能优化策略

### 6.1 捕获模式

```javascript
// 来自 WidgetManager/Constants.js:16-19
export const CaptureOn = {
  MOUSE_MOVE: 0,    // 每次鼠标移动都捕获（响应快但昂贵）
  MOUSE_RELEASE: 1, // 仅在鼠标释放时捕获（延迟但便宜）
};
```

**默认**：`CaptureOn.MOUSE_MOVE`（响应式拾取）

### 6.2 空间缓存

**第 390-412 行（在 WidgetManager 中）**：
- 捕获区域后，如果鼠标仍��其中则重用缓冲
- 仅在鼠标移出 `model._capturedBuffers.area` 时重新捕获
- 极大减少 GPU 回读次数

```javascript
const capturedRegion = model._capturedBuffers.area;
if (x < capturedRegion[0] || x > capturedRegion[2] ||
    y < capturedRegion[1] || y > capturedRegion[3]) {
  await captureBuffers(x, y, x, y);  // 仅在必要时重新捕获
}
```

### 6.3 动画检测

**第 281-290 行**：

```javascript
subscriptions.push(
  model._interactor.onStartAnimation(() => {
    model.isAnimating = true;  // 相机交互期间禁用拾取
  })
);
subscriptions.push(
  model._interactor.onEndAnimation(() => {
    model.isAnimating = false;
    publicAPI.renderWidgets();  // 重新启用并更新
  })
);
```

### 6.4 通道跳过

**第 537-551 行**：

```javascript
publicAPI.passRequired = (pass) => {
  if (pass === PassTypes.ID_HIGH24) {
    // 如果 IDs 适合低 24 位，跳过高 24 位通道
    if (model.fieldAssociation === FieldAssociations.FIELD_ASSOCIATION_POINTS) {
      return model.maximumPointId > 0x00ffffff;  // 1600万点
    }
    if (model.fieldAssociation === FieldAssociations.FIELD_ASSOCIATION_CELLS) {
      return model.maximumCellId > 0x00ffffff;
    }
  }
  return true;
};
```

### 6.5 异步操作

**第 224-243 行**：
- 所有拾取都是异步的以避免阻塞主线程
- 等待进行中的捕获：`if (model._captureInProgress) await model._captureInProgress;`

```javascript
async function captureBuffers(x1, y1, x2, y2) {
  if (model._captureInProgress) {
    await model._captureInProgress;  // 避免重复捕获
    return;
  }

  model._captureInProgress = model._selector.getSourceDataAsync(...);
  model._capturedBuffers = await model._captureInProgress;
  model._captureInProgress = null;
}
```

### 6.6 缓存策略

1. **Prop 数组**：`model.props[]` 每次捕获构建一次，供所有像素查询重用
2. **WeakMap**：`propsWeakMap` 提供 O(1) 的 actor→widget 查找，且不持有引用
3. **上一次选择**：`model.previousSelectedData` 缓存最后结果以避免冗余处理
4. **请求计数**：`requestCount` 追踪重复选择以跳过冗余的手柄激活

---

## 7. 完整流程图（文本形式）

```
用户鼠标移动
    ↓
Interactor.onMouseMove() 事件
    ↓
WidgetManager.handleEvent(callData)
    ↓
[检查：!isAnimating && pickingEnabled && 正确的渲染器?]
    ↓ 是
WidgetManager.updateSelection(callData)
    ↓
WidgetManager.getSelectedDataForXY(x, y)
    ↓
[检查：需要新捕获？]
    ↓ 是
WidgetManager.captureBuffers(x, y, x, y)
    ↓
┌───────────────────────────────────────────┐
│ 拾取渲染序列                              │
├───────────────────────────────────────────┤
│ 1. renderPickingBuffer()                  │
│    - 设置 renderingType = PICKING_BUFFER  │
│    - 更新所有 widget 可见���                │
│      (handles 强制可见)                    │
│                                           │
│ 2. selector.getSourceDataAsync()          │
│    ↓                                      │
│    selector.captureBuffers()              │
│    ↓                                      │
│    selector.beginSelection()              │
│    - 创建/绑定离屏帧缓冲                   │
│    - 清除为黑色 (miss = 0,0,0)            │
│    - 在渲染器上设置选择器                  │
│    ↓                                      │
│    对于每个 PassType (0..3):              │
│      ┌─────���───────────────────────────┐ │
│      │ Pass 0: ACTOR_PASS              │ │
│      │ - 每个 actor 获得唯一颜色        │ │
│      │ - RGB 编码 actor ID             │ │
│      ├─────────────────────────────────┤ │
│      │ Pass 1: COMPOSITE_INDEX_PASS    │ │
│      │ - RGB 编码子部件索引            │ │
│      ├─────────────────────────────────┤ │
│      │ Pass 2: ID_LOW24                │ │
│      │ - RGB 编码单元格/点ID (低24位)  │ │
│      ├─────────────────────────────────┤ │
│      │ Pass 3: ID_HIGH24               │ │
│      │ - RGB 编码单元格/点ID (高24位)  │ │
│      └───────────────────────���─────────┘ │
│      ↓                                    │
│      selector.preCapturePass()            │
│      - 禁用混合                           │
│      ↓                                    │
│      openGLRenderWindow.traverseAllPasses()
│      - 渲染整个场景                       │
│      - 着色器输出编码的颜色                │
│      ↓                                    │
│      selector.postCapturePass()           │
│      - 恢复混合                           │
│      ↓                                    │
│      selector.savePixelBuffer(passNo)     │
│      - gl.readPixels() → pixBuffer[i]    │
│      - 构建 prop 命中列表 (Pass 0 后)    │
│    ↓                                      │
│    selector.endSelection()                │
│    - 恢复正常帧缓冲                       │
│    - 从渲染器清除选择器                   │
│    ↓                                      │
│    返回捕获的缓冲数据                     │
│                                           │
│ 3. renderFrontBuffer()                    │
│    - 设置 renderingType = FRONT_BUFFER    │
│    - 恢复正常可见性                       │
└───────────────────────────────────────────┘
    ↓
capturedBuffers.generateSelection(x, y, x, y)
    ↓
generateSelectionWithData()
  - 遍历选择矩形
  - 对于每个像素:
    - getPixelInformationWithData()
      - 解码 RGB → actorID (从 ACTOR_PASS)
      - 解码 RGB → compositeID (从 COMPOSITE_INDEX_PASS)
      - 解码 RGB → attributeID (从 ID_LOW24 + ID_HIGH24)
      - 查找 prop: props[actorID]
      - 返回 info{prop, compositeID, attributeID, zValue}
  - 按 (propID, compositeID) 分组
  - 为每个唯一选择创建 vtkSelectionNode
    ↓
返回 vtkSelectionNode 对象数组
    ↓
WidgetManager.getSelectedData()
  - 提取第一个选择
  - 从 propsWeakMap 查找 widget/representation
  - 从 representation.getSelectedState() 获取 selectedState
  - 缓存结果到 previousSelectedData
  - 返回 {widget, representation, selectedState, ...}
    ↓
回到 updateSelection():
  - 确定要激活哪个 widget
  - widget.activateHandle({selectedState, representation})
  - 更新光标样式
  - 如需要则渲染
    ↓
Widget 现在响应鼠标拖动激活的手柄
```

---

## 8. 具体示例：拾取球形手柄

让我们追踪一个具体场景：拾取球形手柄 widget。

### 初始设置

- SphereHandle widget 有一个带球形几何体的 vtkActor
- WidgetManager 注册此 actor：
  ```javascript
  propsWeakMap.set(sphereActor, {
    widget: sphereHandle,
    representation: sphereRep
  })
  ```

### 鼠标移动到 (320, 240)

1. `handleEvent()` 被调用，`position: {x: 320, y: 240}`

### 需要捕获

2. 没有缓存缓冲，调用 `captureBuffers(320, 240, 320, 240)`

### 拾取渲染

3. `renderPickingBuffer()`: 设置 `renderingType = PICKING_BUFFER`
4. Widget 的 `updateRepresentationForRender()` 传播到 representation
5. Representation 的 `updateActorVisibility()` 看到 `Behavior.HANDLE` + `PICKING_BUFFER` → `otherFlag = true`
6. 球形 actor 设置为可见

### 硬件选择

7. `beginSelection()`: 创建 640x480 帧缓冲（或重用）

8. **Pass 0 (ACTOR_PASS)**:
   - 球形 actor 是 prop #5
   - `renderProp()` 分配颜色 RGB(6/255, 0, 0) = 红色通道 6
   - 场景渲染，球形像素为 red=6
   - `savePixelBuffer(0)`: 读取帧缓冲 → `pixBuffer[0]`
   - `buildPropHitList()`: 扫描缓冲，找到 `convert(0,0,pixBuffer[0]) = 6`
   - 存储 `hitProps[5] = true`

9. **Pass 1 (COMPOSITE_INDEX_PASS)**:
   - 球形没有子部件，用颜色 RGB(1/255, 0, 0) 渲染
   - 保存到 `pixBuffer[1]`

10. **Pass 2 (ID_LOW24)**:
    - 如果拾取点，球形顶点被编码
    - 保存到 `pixBuffer[2]`

11. **Pass 3 (ID_HIGH24)**:
    - 跳过（小网格不需要）

12. `endSelection()`: 恢复主帧缓冲

13. 返回 `capturedBuffers` 对象

### 生成选择

14. `generateSelection(320, 240, 320, 240)`: 单个像素

15. `getPixelInformationWithData(buffdata, [320, 240], 0, outPos)`:
    - 像素偏移: `(240 * 641 + 320) * 4 = 某个缓冲偏移`
    - `convert(320, 240, pixBuffer[0])` → 读取 red=6 → `actorid = 6`
    - `actorid - idOffset = 6 - 1 = 5` → `info.propID = 5`
    - `info.prop = props[5]` → 球形 actor
    - `convert(320, 240, pixBuffer[1])` → `compositeID = 0`
    - `convert(320, 240, pixBuffer[2])` → `attributeID = 42` (点索引)

16. 用这些属性创建 `vtkSelectionNode`

17. 返回数组 `[selectionNode]`

### 获取选中数据

18. `selections[0].getProperties()` → `{prop: sphereActor, compositeID: 0, attributeID: 42}`

19. `propsWeakMap.get(sphereActor)` → `{widget: sphereHandle, representation: sphereRep}`

20. `sphereRep.getSelectedState(sphereActor, 0)` → 返回此手柄的状态对象

21. 返回 `{widget: sphereHandle, representation: sphereRep, selectedState: {...}, compositeID: 0}`

### 激活 Widget

22. `sphereHandle.activateHandle({selectedState, representation: sphereRep})`

23. Widget 设置内部激活状态，准备拖动

24. 光标变为 'hover' 样式

### 后续鼠标移动

25. 拖动时，widget ���新手柄位置

26. 拖动期间可能禁用拾取

27. 鼠标释放时，widget 最终确定位置

---

## 9. 关键要点总结

1. **颜色编码拾取**：使用 RGB 通道编码最多 **1600 万个对象 ID**（24位）

2. **多通道渲染**：4 个通道编码不同信息：
   - ACTOR_PASS: 识别哪个 actor
   - COMPOSITE_INDEX_PASS: 识别子部件实例
   - ID_LOW24/ID_HIGH24: 组合成 48 位，支持 **281 万亿**个单元格/点

3. **离屏缓冲**：拾取在不可见的帧缓冲中进行，不影响用户视图

4. **双渲染类型**：
   - `PICKING_BUFFER` (0): 用于选择，actors 用编码颜色渲染
   - `FRONT_BUFFER` (1): 用于显示，actors 用正常外观渲染

5. **Handle 强制可见**：`Behavior.HANDLE` 类型的 representations 在拾取期间始终可见，即使在前缓冲中隐藏

6. **WeakMap ��射**：`propsWeakMap` 高效地将 actors 映射回 widgets，O(1) 查找且不持有引用

7. **性能优化策略**：
   - 空间缓存：重用捕获的区域
   - 异步操作：不阻塞主���程
   - 动画期间禁用：相机交互时禁用拾取
   - 通道跳过：小数据集跳过不必要的通道
   - 请求去重：避免处理重复选择

8. **GPU 加速**：完全利用 GPU 的并行渲染能力，避免 CPU 射线投射

9. **数据流**：
   ```
   鼠标事件 → 捕获缓冲 → 多通道渲染 → 读取像素
   → 解码 RGB → 查找 props → 映射到 widgets → 激活手柄
   ```

10. **扩展性**：
    - 支持 1600万+ 个 actors（24位）
    - 支持 281万亿+ 个单元格/点（48位）
    - 每个 actor 可以有多个实例（���合索引）

---

## 附录：关键文件位置

- **核心选择器**：
  - `Sources/Rendering/Core/HardwareSelector/index.js` - 抽象基类
  - `Sources/Rendering/OpenGL/HardwareSelector/index.js` - WebGL 实现
  - `Sources/Rendering/OpenGL/HardwareSelector/Constants.js` - 通道类型定义

- **Widget 管理**：
  - `Sources/Widgets/Core/WidgetManager/index.js` - 主要拾取协调
  - `Sources/Widgets/Core/WidgetManager/Constants.js` - RenderingTypes 和 CaptureOn

- **Widget Representation**：
  - `Sources/Widgets/Representations/WidgetRepresentation/index.js` - 可见性管理
  - `Sources/Widgets/Representations/WidgetRepresentation/Constants.js` - Behavior 类型

- **帧缓冲**：
  - `Sources/Rendering/OpenGL/Framebuffer/index.js` - 离屏渲染缓冲

---

这个机制的优雅之处在于它完全利用了 GPU 的并行渲染能力，将复杂的 3D 拾取问题转化为简单的颜色查找！通过多通道编码，vtk.js 能够在一次拾取操作中获取多层信息（对象、实例、单元格/点），而所有这些都在毫秒级完成。
