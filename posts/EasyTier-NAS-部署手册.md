# EasyTier 异地组网部署手册（NAS 侧 + Windows 侧）

> 适用环境：飞牛 fnOS（Debian 12）/ frp 隧道/ 无公网 IP
> 目标：Windows 电脑在外网通过 frp 隧道访问家里的 NAS 及其服务
> 全程只需一个 frp 隧道（TCP，远程端口 11011）

---

## 1. 确认 frp 链路是通的

配置好frps

![image-20261028182023591](https://img.1795857.xyz/file/%E5%8D%9A%E5%AE%A2/%E9%A3%9E%E7%89%9B%E7%AB%AF%E7%94%A8frp%E4%B8%AD%E8%BD%ACEasyTier/1793182827587_image-20261028182023591.png)

然后在飞牛下载frpc下载，把配置文件复制进去

---

## 2. 准备 EasyTier 二进制

**方式 A：从官方 Releases 下载（推荐，版本可控）**

```bash
cd /tmp
curl -LO https://v6.gh-proxy.org/https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip

# 要是这个链接下载太慢了就去https://pan2.ppig.eu.cc/?item=software%2Feasytier-linux-x86_64-v2.6.4%2Feasytier-linux-x86_64-v2.6.4.zip&bucket=https%3A%2F%2Fbold-mouse-7461.software001.workers.dev下载，再传到 /tmp里面


unzip -o easytier-linux-x86_64-v2.6.4.zip -d easytier

sudo install -m 755 easytier/easytier-linux-x86_64/easytier-core /usr/local/bin/easytier-core


/usr/local/bin/easytier-core --version
# 返回easytier-core 2.6.4-8428a89d
```

---

## 3. 生成网络名和密钥

网络名只是标识，密钥才是门禁（参与握手和加密），**不要用弱口令**：

```bash
# 生成 24 位随机密钥（只保留字母数字，避免转义问题）
openssl rand -base64 32
```

记下这个值，后面 NAS 和 Windows 两端都要用：

```
网络名称：xxxx      （自己起，别用中文和空格）
网络密钥：<上一条命令的输出>
```

---

## 4. 写 systemd 服务

进入 easytier-nas.service

```bash
sudo nano /etc/systemd/system/easytier-nas.service
```

配置service文件

```bash
[Unit]
Description=EasyTier NAS node (reachable via frp)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/easytier-core \
  --hostname fn-nas \
  --network-name 你的网络名 \
  --network-secret 你的密钥 \
  --ipv4 10.144.144.1 \
  --listeners tcp://0.0.0.0:11011 \
  --listeners udp://0.0.0.0:11011 \
  --rpc-portal 127.0.0.1:15889 \
  --private-mode true \
Restart=always
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
```

### 参数逐条解释

| 参数 | 作用 | 为什么这么填 |
|---|---|---|
| `--hostname fn-nas` | 节点在虚拟网里的显示名 | `easytier-cli peer` 里能一眼认出来 |
| `--ipv4 10.144.144.1` | 固定虚拟 IP | 服务端要固定，客户端才能写死访问地址 |
| `--listeners tcp://0.0.0.0:11011` | **必须**和 frp 的 localPort 一致 | 你的 frp 映射是 11011 |
| `--listeners udp://...` | 保留 UDP 监听 | 以后同局域网直连时用得上，不占公网 |
| `--rpc-portal 127.0.0.1:15889` | 管理接口 | 避开 EasyTier-Web 应用占用的 15888 |
| `--private-mode true` | 禁止其他网络的节点拿你当免费中转 | 防止被白嫖带宽 |
| `--tcp-whitelist ...` | **隧道内**只放行这些 TCP 端口 | 即使密钥泄露，对方也只能碰这几个端口 |

> **关于 `--tcp-whitelist`**：这是整份配置里性价比最高的一条。
> 白名单里的端口 = 你真正要用的服务。要加端口就改这一行再重启。
> 实测效果：隧道内访问 `80` 正常返回，访问 `11211` 直接超时。

> **关于 `--secure-mode`**：**不要加**。2.6.4 的 Windows GUI 没有这个开关，加了会导致 GUI 客户端每 3 秒掉一次线。
> 只有当你两端都用命令行启动时，才考虑加（见附录 A）。

---

## 5. 启动与验证

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now easytier-nas

# 服务状态
systemctl status easytier-nas --no-pager

# 端口监听（应看到 0.0.0.0:11011）
ss -lntup | grep 11011

# TUN 网卡（应看到 tun0 + 10.144.144.1/24）
ip -br addr | grep -i tun

# 启动日志（确认没有报错、listener 已加载）
sudo journalctl -u easytier-nas -n 30 --no-pager
```

日志里应该出现：

```
INFO CORE::INSTANCE: [...] new listener added listener=tcp://0.0.0.0:11011
INFO CORE::INSTANCE: [...] tun device ready dev="tun0"
```

### 从外部判断链路是否真的活了

在**任意一台外网机器**上（手机热点 / 公司电脑）：

```powershell
# 连上 公网ip:11011，观察多久断开
$c = New-Object System.Net.Sockets.TcpClient
$c.Connect('frp公网ip', 11011)
$s = $c.GetStream(); $s.ReadTimeout = 6000
$sw = [Diagnostics.Stopwatch]::StartNew()
try { $n = $s.Read((New-Object byte[] 32), 0, 32); "closed after $($sw.ElapsedMilliseconds)ms" }
catch { "保持 >6s：有服务在监听" }
$c.Close()
```

| 现象 | 含义 |
|---|---|
| **10ms 左右就断** | frpc 后面没人监听（EasyTier 没起来 / 端口不对） |
| **保持 5 秒才断** | EasyTier 在，但在等握手 → 正常（裸连不握手会超时） |

---

## 6. Windows 端配置

### 方式 A：GUI（推荐日常使用）

| 字段 | 值 |
|---|---|
| 网络名称 | 你的网络名 |
| 网络密码 | 你的密钥 |
| 虚拟 IPv4 | `10.144.144.2` |
| 对等节点 | `tcp://frp公网ip` |
| 端口 | `11011` |
| 高级设置 → 仅使用物理网卡 | ✅ 建议开启 |
| 高级设置 → 启用多线程 | ✅ 建议开启 |



### 方式 B：命令行（管理员运行）

```powershell
.\easytier-core.exe -i 10.144.144.2 `
  --network-name 你的网络名 `
  --network-secret 你的密钥 `
  -p tcp://frp公网ip:11011
```

> ⚠️ **协议必须是 `tcp://`**。frp 是四层 TCP 转发，写 `ws://` 或 `udp://` 都连不上。
> ⚠️ **端口必须是 11011**（frp 的远程端口），不是 EasyTier 本地的 11010。这是最容易错的地方。

---

## 7. 端到端验证

### 7.1 Windows 侧看连接状态

```powershell
easytier-cli peer
```

期望输出：

```
| ipv4         | hostname | cost | lat_ms | tunnel_proto | nat_type |
| 10.144.144.1 | fn-nas   | 1    | 30~60  | tcp          | ...      |
```

### 7.2 实际访问

```powershell
ping 10.144.144.1
\\10.144.144.1              # SMB
http://10.144.144.1:5666    # NAS 管理页
```

### 7.3 不用 TUN 的验证法（排障神器）

不想装 TUN、或者想确认"隧道本身通不通"，用端口转发模式：

```powershell
.\easytier-core.exe --no-tun --no-listener --ipv4 10.144.144.9 `
  --network-name 你的网络名 --network-secret 你的密钥 `
  --port-forward tcp://127.0.0.1:2222/10.144.144.1:43593 `
  -p tcp://frp公网ip `
  --rpc-portal 127.0.0.1:15899 --console-log-level info
```

然后 `ssh admin@127.0.0.1 -p 2222` 就能进 NAS——**全程不需要管理员权限、不创建 TUN**。
这个方法在 GUI 挂掉、又不方便装驱动时特别有用。

---

## 8. 常见故障对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| 客户端一直"连接中"，NAS 日志里**没有** `new connection accepted` | 端口写错了（写成 11010） | 改成 `tcp://frp公网ip` |
| 客户端连上但每 3 秒断一次 | 一端开了 `--secure-mode`，另一端没开 | 两端保持一致（GUI 用户：NAS 侧去掉该参数） |
| 外网 TCP 连 11011 立刻断（<20ms） | frpc 后面没有服务 | `systemctl status easytier-nas`，看端口有没有监听 |
| 外网 TCP 连 11011 保持 5 秒才断 | EasyTier 正常，但客户端握手失败 | 检查网络名/密钥是否一致 |
| 连上了但 ping 不通 10.144.144.1 | 虚拟 IP 冲突 / 防火墙 | 换 `10.144.144.3` 试试；检查 Windows 防火墙 |
| `easytier-cli peer` 里 `tunnel_proto` 是 tcp 但延迟很高 | 走了 frp 中转（正常） | 家用宽带打洞失败时无解，接受延迟 |
| 服务起不来，`journalctl` 报参数错误 | unit 里换行/引号写错 | 用 `easytier-core --help` 核对参数名 |

---

## 9. 日常运维

```bash
# 状态 / 重启 / 停止
sudo systemctl status easytier-nas
sudo systemctl restart easytier-nas
sudo systemctl stop easytier-nas

# 实时日志
sudo journalctl -u easytier-nas -f

# 看谁连过（排查陌生节点）
sudo journalctl -u easytier-nas --since '-24h' | grep 'new peer added'

# 改配置
sudo nano /etc/systemd/system/easytier-nas.service
sudo systemctl daemon-reload && sudo systemctl restart easytier-nas
```

### 端口白名单怎么加

比如要给 Docker 里的某个服务开 `8080`：

```bash
sudo sed -i 's/--tcp-whitelist .*/--tcp-whitelist 80,443,445,139,5666,5667,43593,8080/' \
  /etc/systemd/system/easytier-nas.service
sudo systemctl daemon-reload && sudo systemctl restart easytier-nas
```

> 注意：`--tcp-whitelist` 必须是 `ExecStart` 的最后一行，**末尾不要加反斜杠 `\`**，
> 否则会和下一行 `Restart=always` 拼在一起导致服务起不来。改完用
> `systemctl cat easytier-nas` 确认一下。

### 访问 NAS 之外的局域网设备（可选）

在 `ExecStart` 里加 `-n 192.168.31.0/24`，然后重启。
⚠️ 如果你常去的网络也是 `192.168.31.x` 网段，会路由冲突，别开。

---

## 10. 完整卸载

```bash
sudo systemctl disable --now easytier-nas
sudo rm -f /etc/systemd/system/easytier-nas.service
sudo systemctl daemon-reload
sudo rm -f /usr/local/bin/easytier-core
sudo journalctl --rotate && sudo journalctl --vacuum-time=1s   # 可选：清日志

# 验证
ss -lntup | grep 11011 || echo "端口已释放"
ip -br addr | grep -i tun || echo "TUN 已消失"
```

卸载后记得处理两处收尾：

1. frp 面板里那条 `11011` 隧道（现在指向空端口，删掉释放名额）
2. Windows GUI 里的网络配置

---

## 附录 A：secure mode（仅当两端都用命令行时）

开启后每对节点独立协商密钥（Noise 握手 + 防重放），**即使密钥泄露也无法解密历史流量**。
代价：**客户端必须也开**，否则每 3 秒断线；而 2.6.4 的 GUI 没有这个开关。

NAS 侧把 `ExecStart` 改成这样（**注意每行末尾的 `\`，最后一行不能有**）：

```ini
ExecStart=/usr/local/bin/easytier-core \
  --hostname fn-nas \
  --network-name 你的网络名 \
  --network-secret 你的密钥 \
  --ipv4 10.144.144.1 \
  --listeners tcp://0.0.0.0:11011 \
  --listeners udp://0.0.0.0:11011 \
  --rpc-portal 127.0.0.1:15889 \
  --private-mode true \
  --tcp-whitelist 80,443,445,139,5666,5667,43593 \
  --secure-mode
Restart=always
```

> ⚠️ **最容易踩的坑**：往 `ExecStart` 中间插参数时，忘了给**上一行**补 `\`。
> systemd 会把断掉的那一行当成 `ExecStart` 的结尾，后面的 `--secure-mode` 变成一条
> 独立指令被**静默忽略**——服务照常启动，但参数没生效。
> 改完务必用下面这条命令核对 systemd 实际解析出的命令行：
>
> ```bash
> systemctl show easytier-nas -p ExecStart | tr ';' '\n' | head -1
> ```

Windows 侧：

```powershell
.\easytier-core.exe -i 10.144.144.2 --network-name 你的网络名 --network-secret 你的密钥 `
  --secure-mode -p tcp://frp公网ip
```

---

*文档基于 2026-10-28 实际部署验证，EasyTier v2.6.4 / frp 0.71.0 / fnOS（Debian 12）。*
