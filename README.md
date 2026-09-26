# zer0plan

SubStore 订阅转换脚本，基于 [powerfullz/override-rules](https://github.com/powerfullz/override-rules) 定制。

## 复制粘贴

### SubStore 覆写脚本

GitHub Raw（实时，需代理）：
```
https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/mainline.min.js
```

jsdelivr CDN（国内可用，有缓存）：
```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/mainline.min.js
```

### zer0direct 规则集（直连白名单）

GitHub Raw（实时，需代理）：
```
https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/ruleset/zer0direct.yaml
```

jsDelivr CDN（国内可用，有缓存）：
```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/ruleset/zer0direct.yaml
```

### iosextra 手机端额外覆写（DNS / Tailscale / MITM 等）

GitHub Raw（实时，需代理）：
```
https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/iosextra.yaml
```

jsdelivr CDN（国内可用，有缓存）：
```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/iosextra.yaml
```

运行顺序：先跑 SubStore 覆写脚本（mainline.min.js），再跑此 YAML（iosextra.yaml）。

### WSL2 Mihomo 额外覆写

GitHub Raw（实时，需代理）：
```
https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/wsl.yaml
```

jsDelivr CDN（国内可用，有缓存）：
```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/wsl.yaml
```

运行顺序：先跑 SubStore 覆写脚本（mainline.min.js），再跑此 YAML（wsl.yaml）。

## 与上游的区别

- **Video 统一组** - YouTube / Netflix / Twitch / Bahamut / PikPak / TikTok 合并到 `Video`
- **选择代理 统一组** - Telegram / Twitter / Crypto / GFWList 合并到 `选择代理`
- **bkup 节点过滤** - 名称含 `bkup` 的节点单独分组，故障转移自动包含，不参与国家分组
- **zer0direct 规则集** - 自定义直连域名列表
- **精简代理组** - 移除 SSH / 搜狗输入法 / Apple / Spotify / Truth Social / 新浪微博 等独立组
- **jsdelivr CDN** - 所有规则集和图标走 jsdelivr，国内可用

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `grouptype` | 地区代理组类型 0=手动 1=自动测速 2=负载均衡 | `1` |
| `ipv6` | IPv6 | `false` |
| `tun` | TUN 模式 | `false` |
| `full` | 完整配置（纯内核启动） | `false` |
| `fakeip` | DNS FakeIP 模式 | `true` |
| `quic` | 允许 QUIC | `false` |
| `threshold` | 地区节点最小阈值 | `2` |
| `regex` | 正则过滤模式 | `false` |
| `process` | 加入桌面端 `PROCESS-NAME` 直连规则；iOS Stash 保持关闭 | `false` |
| `telegram` | 值为 `manual` 时，Telegram 组纳入「实验性」低倍率节点并**置顶优先**（手机在 Telegram 内看视频省流量）；其他值/不传则排除 | 空 |

`process` 是显式平台开关，在 SubStore 的「脚本操作」中配置。**传参方式取决于脚本的加载模式**：

- **链接模式（`mode: link`，即填 URL）**：参数必须写在 URL 的 **`#` 片段**里，SubStore 会忽略该操作的 `arguments` 字段。
  ```
  https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/mainline.min.js#process=true
  ```
  iOS Stash 用 `#process=false`（或不写片段，默认即 false）。
- **脚本模式（`mode: script`，即直接粘代码）**：参数写在 `arguments` 字段，值为字符串 `"true"` / `"false"`。

开启后会在规则顶部插入 18 条进程直连规则，并设置 `find-process-mode: strict`。桌面端 `wsl.yaml` 不再重复插入这些规则。

## 更新 zer0direct

编辑 `ruleset/zer0direct.yaml`，一行一个域名。

## 构建

```bash
npm install
npm run build
# 产物: mainline.js / mainline.min.js
```
