# VTK 例子运行和测试

VTK 的整个框架中有大量的例子可以供学习和实验，如果配合 debug 功能和自定义例子能够很好的理解 VTK 的一些运行机制和架构，方便灵活的使用和调试甚至自定义 VTK 中的功能。下面将详细介绍如何在当前 VTK 框架下实现例子的运行、debug 以及自定义例子。

## 有哪些例子可以运行

访问 vtkjs 的官方例子网站[vtk js example](https://kitware.github.io/vtk-js/examples/)，其中左侧的侧边栏有所有官方提供的可以运行实验的例子。这些例子都可以在本项目中找到并且运行，当然也可以全部打断点单步执行。

## 运行某个例子

VTK 中所有的例子都分布在两个地方

1. Example 文件夹之下
2. Source 文件夹下的某个文件夹下的 example 文件夹下

### Examples 文件夹之下

Examples 文件夹之下的所有含有 index.js 的文件夹都是例子，可以通过 `npm run example example-name` 运行。比如对于`Examples\Rendering\Actor2D\index.js`这个文件中的例子，只要执行`npm run example Actor2D`就可以运行例子，例子运行后，打印如下内容

```powershell
> vtk.js@0.0.0-semantically-release example
> node ./Utilities/ExampleRunner/example-runner-cli.js -c ./Documentation/config.js Actor2D


=> Extract examples

 - GeometryViewer : SKIPPED
 - ImageViewer : SKIPPED
#其余输出
 - Actor2D : Rendering/Actor2D/index.js #当前例子
 - Convolution2DPass : SKIPPED
 - CustomWebGPUCone : SKIPPED
#其余输出
#打包
<s> [webpack.Progress] 99% cache begin idle
<s> [webpack.Progress] 100%
#其余输出
#运行成功
crypto (ignored) 15 bytes [optional] [built] [code generated]
webpack 5.97.1 compiled successfully in 23785 ms
```

然后在本地浏览器中输入`http://localhost:9999/`就可以访问例子做实验了

### Source 文件夹下的某个文件夹下的 example 文件夹下

同上，执行`npm run example example-name`就可以，比如`Sources\Rendering\Core\TextActor\example\index.js`就代表一个例子，只要执行`npm run example TextActor`就可以执行例子，输出和上面的 Examples 下面的例子一致。同样直接运行在本地浏览器中输入`http://localhost:9999/`就可以访问。
