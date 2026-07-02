# zer0plan

SubStore 订阅转换脚本，基于 [powerfullz/override-rules](https://github.com/powerfullz/override-rules) 定制。

## 复制粘贴

### SubStore 覆写脚本

jsdelivr CDN（国内可用，有缓存）：
```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/convert.min.js
```

GitHub Raw（实时，需代理）：
```
https://raw.githubusercontent.com/Zer0wAve/zer0plan/main/convert.min.js
```

### zer0direct 规则集（直连白名单）

```
https://cdn.jsdelivr.net/gh/Zer0wAve/zer0plan@main/ruleset/zer0direct.txt
```

## 与上游的区别

- **Video 统一组** — YouTube / Netflix / Twitch / Bahamut / PikPak / TikTok 合并到 `Video`
- **选择代理 统一组** — Telegram / Twitter / Crypto / GFWList 合并到 `选择代理`
- **bkup 节点过滤** — 名称含 `bkup` 的节点单独分组，故障转移自动包含，不参与国家分组
- **zer0direct 规则集** — 自定义直连域名列表
- **精简代理组** — 移除 SSH / 搜狗输入法 / Apple / Spotify / Truth Social / 新浪微博 等独立组
- **jsdelivr CDN** — 所有规则集和图标走 jsdelivr，国内可用

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

## 更新 zer0direct

编辑 `ruleset/zer0direct.txt`，一行一个域名。

## 构建

```bash
npm install
npm run build
# 产物: convert.js / convert.min.js
```
