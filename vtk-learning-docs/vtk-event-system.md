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
