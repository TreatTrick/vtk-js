# VTK架构概述

## 概述

vtk.js 是 C++版本的 VTK 的 JavaScript 实现,用于基于 Web 的 3D 图形、体绘制和科学可视化。它是用 ES6 JavaScript 完全重写的 VTK(而非移植),专注于使用 WebGL/WebGPU 渲染几何数据(PolyData)和体数据(ImageData)。

## 框架结构

vtkjs 的核心框架结构有两个
- 基于管道的渲染数据流动和渲染架构
- 基于场景图的逐层渲染管理机制

### 数据流架构
vtk.js 遵循模块化、基于管道的架构,数据通过一系列处理阶段流动:

```mermaid
flowchart LR
      DS[数据源<br/>Data Source] --> F[过滤器<br/>Filter]
      F --> M[映射器<br/>Mapper]
      M --> A[Actor]
      A --> R[渲染器<br/>Renderer]
      R --> RW[渲染窗口<br/>Render Window]

      DS -.-> |生成| G[Generate]
      F -.-> |处理| P[Process]
      M -.-> |转换| T[Transform]
      A -.-> |显示| D[Display]
      R -.-> |组合| C[Compose]
      RW -.-> |呈现| O[Output]

      style DS fill:#e1f5fe
      style F fill:#f3e5f5
      style M fill:#fff3e0
      style A fill:#e8f5e8
      style R fill:#fff8e1
      style RW fill:#fce4ec
```
