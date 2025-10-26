# vtk.js ImageCPRMapper 原理与实现细节

本文基于源码 `Sources/Rendering/Core/ImageCPRMapper/` 与 `Sources/Rendering/OpenGL/ImageCPRMapper/` 进行解析，系统梳理 ImageCPRMapper 如何将三维体数据沿给定中心线重建为 CPR（Curved Planar Reformation，曲面重建/沿线重建）二维图像，包括核心数据结构、几何生成、着色器采样与投影、色彩映射、以及性能与可扩展性要点。

- 核心实现：
  - Core 层：`Sources/Rendering/Core/ImageCPRMapper/index.js:1` 定义数据与几何的高层语义（宽度、朝向、中心点、投影参数、中心线装配、距离度量等）。
  - OpenGL 层：`Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1` 负责构建 VBO/纹理、替换 GLSL 着色器、设置 uniforms/attributes 并执行绘制。


## 概念与输入

- 输入数据
  - 体数据：`vtkImageData`，作为 3D 纹理上传到 GPU（volumeTexture）。
  - 中心线：`vtkPolyData` 的 `Lines` + `Points`，以及可选的点属性（Orientation/Direction/Vectors/Tensors/Normals）用于提供每个点的朝向四元数。也可使用统一（uniform）朝向。
- CPR 输出平面
  - 以中心线为“纵向”，纵向像素高度等于中心线沿程累计长度；横向是 CPR 宽度 `width`，代表中心线切面上沿切线方向的横向采样范围。
- 模式
  - 直线化（Straightened）：沿真实中心线弧长展开，纵向像素代表点到首点的距离。
  - 拉伸（Stretched）：在统一朝向下，重新定义距离度量，仅统计与统一采样方向正交的分量，便于固定参考点（中心点）对齐显示。


## 核心数据与几何组织（Core）

- 有向中心线构建
  - `getOrientedCenterline()` 从 PolyData 中解析 `Lines` 与 `Points`，并读取/生成每个点的朝向四元数，组装为 `vtkPolyLine` 承载的“有向中心线”。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:28`。
  - 朝向来源：
    - 若 `useUniformOrientation=true`，使用 `uniformOrientation`（3、4、9、16 分量分别对应 vec3/quat/mat3/mat4）；
    - 否则，从点属性中按优先级查找 `orientationArrayName`/`Orientation`/`Direction`/`Vectors`/`Tensors`/`Normals`，并转换为四元数；支持 mat4/mat3/quat/vec3 输入并归一化。见 `Sources/Rendering/Core/ImageCPRMapper/Constants.js:1` 与 `Sources/Rendering/Core/ImageCPRMapper/index.js:49`。
- CPR 高度
  - `getHeight()` 返回中心线首点至末点累计距离，作为 CPR 图像高度（纵向像素域）。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:118`。
- 距离函数与模式切换
  - Straightened：`useStraightenedMode()` 恢复 `useUniformOrientation=false`，距离函数为欧式距离 `vec3.dist`。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:147`。
  - Stretched：`useStretchedMode(centerPoint)` 设定统一朝向与中心点，并改写距离函数 d(a,b)=sqrt(|a-b|^2 - (dot(dir,a-b))^2)，仅累计与统一采样方向正交的位移，使纵向度量与采样方向解耦，利于“拉伸对齐”。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:156`。
- 局部坐标系与方向矩阵
  - `tangentDirection / bitangentDirection / normalDirection` 组成 3×3 方向矩阵，用于将“局部横向/投影方向”旋转到体素空间；可通过 `setDirectionMatrix()` 一次性设置。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:86`。
- 投影参数
  - `projectionSlabThickness`、`projectionSlabNumberOfSamples`、`projectionMode`（MAX/MIN/AVERAGE）控制 slab 投影；当采样数>1 时投影启用。见 `Sources/Rendering/Core/ImageCPRMapper/Constants.js:1` 与 `Sources/Rendering/Core/ImageCPRMapper/index.js:181`。


## OpenGL 实现总览（VBO、纹理与着色器）

- 体纹理与传输函数纹理
  - volumeTexture：从 `vtkImageData` 的 scalars 创建 3D 纹理，优先启用 `EXT_texture_norm16`，支持基于 `ImageProperty.updatedExtents` 的局部更新。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:214` 与 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:260`。
  - colorTexture：从 `RGBTransferFunction(s)` 生成 2D 纹理表（支持独立/相关分量），行数为 `textureHeight = iComps ? 2 * numIComps : 1`。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:302`。
  - pwfTexture：从 `PiecewiseFunction(s)` 生成 2D 纹理，用作权重或不透明度。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:360`。
  - 纹理/TF 使用图形资源哈希复用与失效（`getTransferFunctionsHash/getImageDataHash`）。
- CPR 条带几何（Quad per segment）
  - 对中心线的每个线段生成一个四边形（quad）：
    - 顶/底 y 坐标由“累计距离”决定，x 为 `[0, width]` 的模型坐标；这样一组 quad 叠成完整的 CPR 图像。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:442`。
  - 自定义顶点属性（传递到着色器）：
    - `centerlinePosition(vec3)`：每个顶点携带所在线段的端点 3D 位置；
    - `quadIndex(float ∈ {0,1,3,2})`：标记顶点在 quad 的相对位置，以便在 VS 内推导横向偏移与“上下端”；见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:520`。
    - 非统一朝向时额外携带：`centerlineTopOrientation(vec4) / centerlineBotOrientation(vec4)`，用于在 FS 内对朝向做沿纵向的 slerp 插值，保证平滑旋转。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:568`。
- 相机/矩阵
  - 顶点着色器使用 `MCPCMatrix` 完成从模型坐标到裁剪坐标（投影）的变换；在片元阶段使用 `MCTCMatrix` 将模型坐标转换到体素纹理坐标（index→texture 缩放）。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1108`。
- 着色器替换与拼接
  - 基于 `vtkReplacementShaderMapper` 将 polydata 的默认 VS/FS 片段替换为 CPR 专用代码段，包括 attribute/uniform 声明、方向旋转函数、体采样与投影、TF 取色与混合、裁剪与偏移等。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:640` 起的 `replaceShaderValues/replaceShaderClip`。


## 顶点着色器（VS）关键流程

- 横向偏移与纵向端点
  - 通过 `quadIndex` 推导 `quadOffsetVSOutput`：x 方向左右各半宽（`±0.5 * width`），y 标记上下端（top=1/bottom=0）。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:723`。
- 方向与朝向
  - 统一朝向：将 `centerlineOrientation`（uniform 四元数）应用到 `tangentDirection/bitangentDirection`，得到采样方向与投影方向，并作为 VS→FS 的 varyings 传递。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:728`。
  - 非统一朝向：将 `centerlineTopOrientation/centerlineBotOrientation` 作为 flat varying 传入 FS，延迟在 FS 做 slerp，以获得沿纵向的平滑朝向场。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:737`。


## 片元着色器（FS）关键流程

- 模型坐标到体素纹理坐标
  - 在 FS 侧根据 `centerlinePosVSOutput + horizontalOffset * samplingDirection` 得到体采样点的模型坐标，再用 `MCTCMatrix` 转到纹理坐标；若越界，输出背景色并 early-return。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:958`。
- 横向对齐（中心点）
  - Stretched 模式可设置 `globalCenterPoint`：在 FS 内通过 `baseOffset = dot(samplingDirection, globalCenterPoint - centerlinePos)` 让横向偏移相对全局中心点对齐，统一“切线向右”的参照。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:942`。
- 纵向朝向插值（非统一朝向）
  - 使用四元数 `q0/q1` 做 slerp（角度阈值下退化为 lerp），再将插值后的朝向作用到 `tangentDirection/bitangentDirection`，得到当前片元的采样/投影方向。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:900`。
- 投影（Slab Projection）
  - 当 `projectionSlabNumberOfSamples>1`：
    - 在 `projectionDirection` 上，按 `projectionSlabThickness` 均匀步进，累计 MAX/MIN/AVERAGE；采样位置以 `volumeSizeMC` 归一化为纹理坐标步长。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1010` 与 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1204`。
- 颜色与不透明度映射
  - 独立分量（`iComps=true`）：逐分量取 `colorTexture1/pwfTexture1` 做颜色与权重，再按权重归一组合成最终 RGB，并乘以整体 `opacity`。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1060`。
  - 相关分量（灰度/LA/RGB/RGBA）：按约定通道组合，并通过 piecewise function 取不透明度。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1110`。
- 裁剪与偏移
  - 支持最多 6 个裁剪平面（在 VS/FS 中分别做距离计算与 discard）。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1136`。
  - 与 Coincident Topology 偏移集成以避免 Z-fighting。


## 性能与缓存

- 资源共享与失效
  - 基于体数据与传输函数的哈希缓存纹理，避免重复创建；属性更新（如 `updatedExtents`）触发局部纹理更新。见 `getImageDataHash/getTransferFunctionsHash` 与 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:236, 302, 360`。
- VBO 重建条件
  - 当映射器/actor/image/centerline/纹理句柄变化时重建；中心线变动仅重建几何，不必重建体/TF 纹理。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:184`。
- 插值与过滤
  - `ImageProperty.InterpolationType` 映射到三种纹理的 Min/Mag Filter（NEAREST/LINEAR），保证渲染质量与性能的平衡。见 `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:152`。


## 与 ImageResliceMapper 的差异

- ImageResliceMapper 是“平面重采样”到 2D 纹理再贴图；ImageCPRMapper 则是“沿中心线的片元级体采样”。
  - CPR 的关键是：
    - 片元级构造采样方向（由中心线朝向与局部坐标系决定）；
    - 支持非统一朝向并在 FS 做 slerp，保证沿线朝向的连续性；
    - 可选 slab 投影，沿副方向聚合信息（MAX/MIN/AVERAGE）。


## 关键 API 与使用要点

- 基础输入
  - `setImageData(imageData)` / `setImageConnection(port)` 提供体数据。
  - `setCenterlineData(polydata)` / `setCenterlineConnection(port)` 提供中心线（可空；也可直接 `setOrientedCenterline`）。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:172`。
- 模式与几何
  - `setWidth(width)`：CPR 横向宽度（模型坐标单位，通常与体素世界坐标一致）。
  - `useStraightenedMode()` / `useStretchedMode(centerPoint?)` 切换模式与距离度量。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:147, 156`。
  - `setDirectionMatrix(mat3x3)` 或分量设置切/副切/法线方向，用于定义局部采样与投影方向。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:86`。
  - `setUseUniformOrientation(flag)` 与 `setUniformOrientation([x,y,z,w])`：控制朝向来源与类型（vec3/quat/mat3/mat4 自适应）。
- 投影
  - `setProjectionSlabThickness(t)`、`setProjectionSlabNumberOfSamples(n)`、`setProjectionMode(mode)`：控制投影；当 `n>1` 自动启用。见 `Sources/Rendering/Core/ImageCPRMapper/Constants.js:1`。
- 取色
  - 使用 `vtkImageSlice.getProperty()` 配置 `RGBTransferFunction(s)` 与 `PiecewiseFunction(s)`，支持独立/相关分量与通道混合、整体 `opacity`。


## 渲染管线总结（端到端）

1) Core 侧准备
- 解析与缓存“有向中心线”（点、线段索引、每点朝向四元数、累计距离、距离函数）。
- 提供 CPR 尺寸（`width × height`，其中 height=累计距离）。

2) OpenGL 侧准备
- 构建/复用体 3D 纹理与 TF 2D 纹理（含局部更新）。
- 以“每段一 quad”生成 CPR 条带几何，打包 custom attributes。

3) 着色与采样
- VS：基于 `quadIndex` 计算横向偏移，传递中心线端点与（可选）统一朝向；
- FS：
  - 非统一朝向→对端点朝向 slerp；应用到切/副切得到采样/投影方向；
  - 根据横向偏移与（可选）全局中心点得到当前采样位置；
  - 体素采样与（可选）slab 投影聚合；
  - 传输函数映射出颜色与不透明度；
  - 裁剪与 Coincident 偏移处理；
  - 输出片元颜色。


## 调试与扩展建议

- 调试朝向场：
  - 使用 `getCenterlineTangentDirections()` 可获得每点切线方向（已应用四元数），便于对比 VS/FS 的方向计算一致性。见 `Sources/Rendering/Core/ImageCPRMapper/index.js:131`。
- 自定义朝向源：
  - 扩展 `getOrientationDataArray()` 解析更多命名或数据类型；保证转换为四元数并归一化。
- 新增投影模式：
  - 在 FS 中扩展投影累积策略与后处理（如中位数、能量权重等），注意 uniform 与 CPU 侧参数同步。
- 采样边界策略：
  - 目前 out-of-volume 直接输出背景色；可改为 clamp 或镜像，或在 VS 侧预裁剪 quad。
- 性能
  - `preferSizeOverAccuracy` 可影响体纹理格式选择；
  - 传输函数/体纹理哈希复用与 `updatedExtents` 局部更新能显著减少重建成本。


## 参考源码（起始行）
- Core：
  - `Sources/Rendering/Core/ImageCPRMapper/index.js:1`
  - `Sources/Rendering/Core/ImageCPRMapper/Constants.js:1`
- OpenGL：
  - `Sources/Rendering/OpenGL/ImageCPRMapper/index.js:1`

