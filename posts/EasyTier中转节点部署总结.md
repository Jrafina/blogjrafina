# EasyTier 中转节点部署（纯 TCP · 精简版）

> **以下命令全部在「服务器终端」里执行**（`ssh root@公网ip` 登录后，提示符是 `root@iZuf60yjcy3mv455j2mr4jZ:~#`）。
> 想在自己电脑上远程执行的话，每条命令前加 `ssh root@公网ip` 即可，但没必要。

---

## 1. 清理旧版（**全新系统跳过这步**）

只有机器上原来装过 easytier 才需要跑：

```bash
pkill -f "nano easytier" 2>/dev/null || true
systemctl stop easytier@default 2>/dev/null || true
systemctl disable easytier@.service 2>/dev/null || true
rm -rf /etc/systemd/system/easytier@.service \
       /etc/systemd/system/multi-user.target.wants/easytier@default.service \
       /opt/easytier /root/easytier-linux-x86_64
rm -f /usr/sbin/easytier-core /usr/sbin/easytier-cli /tmp/easytier.sh
systemctl daemon-reload && systemctl reset-failed
```

核验（应输出 `0` 和空）：

```bash
ps aux | grep -c "[e]asytier"; ss -tulnp | grep 11010
```

---

## 2. 下载安装

> 整段粘进服务器终端一次跑完。外层的 `( set -e ... )` 保证**任何一步失败立即停止**，
> 不会出现"解压失败却继续往下执行把安装包删了"的情况。首次运行会自动装 `unzip`。

```bash
( set -e
command -v unzip >/dev/null || { apt-get update -qq && apt-get install -y unzip; }
E=61b659eaedba658fa66fe47d17e1426cdd77e5d02fa15fed447bb4357c09dfd6
curl -L --fail -o /root/et.zip \
  "https://ghfast.top/https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip"
[ "$(sha256sum /root/et.zip | awk '{print $1}')" = "$E" ] || { echo "!! 校验失败"; exit 1; }
mkdir -p /opt/easytier/config
unzip -q -o /root/et.zip -d /tmp/et
D=$(dirname "$(find /tmp/et -name easytier-core | head -1)")
install -m 0755 "$D/easytier-core" "$D/easytier-cli" /opt/easytier/
rm -rf /tmp/et /root/et.zip
/opt/easytier/easytier-core --version
)
```

最后一行应输出 `easytier-core 2.6.4-8428a89d`。

---

## 3. 写配置

```bash
cat > /opt/easytier/config/relay.toml <<'CONF'
instance_name = "relay"
hostname      = "aliyun-relay"

listeners = [
    "tcp://0.0.0.0:11010",
    "ws://0.0.0.0:11011/",
]

rpc_portal           = "15888"
rpc_portal_whitelist = "127.0.0.1,::1"

[network_identity]
network_name   = "284354" #自定义用户名
network_secret = "4692bdc7621323c4d1614228e91039ff223" #自定义密码

[flags]
no_tun                  = true
relay_network_whitelist = "28435441"
relay_all_peer_rpc      = true
enable_encryption       = true
default_protocol        = "tcp"
mtu                     = 1380
CONF
```

校验（无输出即通过）：

```bash
/opt/easytier/easytier-core -c /opt/easytier/config/relay.toml --check-config
```

| 参数 | 作用 |
|---|---|
| `no_tun` | 不建虚拟网卡，纯转发 |
| `relay_network_whitelist` | 只给这个网络做中转，防蹭带宽 |
| `rpc_portal_whitelist` | 管理口只允许本机访问，**必须写** |

---

## 4. 启动服务

```bash
cat > /etc/systemd/system/easytier-relay.service <<'UNIT'
[Unit]
Description=EasyTier Relay
After=network-online.target

[Service]
WorkingDirectory=/opt/easytier
ExecStart=/opt/easytier/easytier-core -c /opt/easytier/config/relay.toml
Restart=always
RestartSec=3s
Environment=RUST_LOG=info,easytier::common::stun=warn

[Install]
WantedBy=multi-user.target
UNIT
```

```bash
systemctl daemon-reload && systemctl enable --now easytier-relay
```

---

## 5. 验证

```bash
systemctl is-active easytier-relay
ss -tulnp | grep easytier | awk '{print $1, $5}'
/opt/easytier/easytier-cli -p 127.0.0.1:15888 peer
```

期望：`active`；监听只有 `tcp 11010 / 11011 / 15888`；peer 表列出本机。

---

## 6. 放行安全组（回你自己电脑做）

阿里云控制台 → 安全组 → 入方向 → 手动添加：

| 协议 | 端口 | 必要性 |
|---|---|---|
| TCP | `11010` | 必开 |
| TCP | `11011` | 可选（WS 备用） |

**不要放 15888**（管理口）。在自己电脑上验证：

```bash
nc -zv 公网ip 11010
```

---

## 7. 客户端接入（在你的设备上，不是服务器）

1. 命令行

```bash
easytier-core -i 10.144.144.2 \
  --network-name 284354 \
  --network-secret 4692bdc7621323c4d1614228e91039ff223 \
  -p tcp://公网ip:11010
```

- `-i` 每台设备必须不同（`.2` / `.3` / `.4`…）
- `-p` 一定要带 `tcp://` 前缀
- Windows 需管理员权限

2. gui客户端

![1792680832447_image-20261022225344993](https://img.1795857.xyz/file/%E5%8D%9A%E5%AE%A2/EasyTier_%E4%B8%AD%E8%BD%AC%E8%8A%82%E7%82%B9%E9%83%A8%E7%BD%B2/1792681048887_1792680832447_image-20261022225344993.png)

---

## 8. 三个坑

1. **GitHub Release 直连会超时**（`github.com` 通但 `objects.githubusercontent.com` 不通）→ 必须走 `ghfast.top` 前缀。
2. **`rpc_portal` 的 IP 参数不生效**，写 `127.0.0.1:15888` 也会绑 `0.0.0.0` → 只能靠 `rpc_portal_whitelist` 挡。
3. **本机自测别用 127.0.0.1**，会 2 秒超时；改用内网 IP `172.24.24.15:11010`。

---

## 运维

```bash
systemctl status easytier-relay
journalctl -u easytier-relay -f
/opt/easytier/easytier-cli -p 127.0.0.1:15888 peer
systemctl restart easytier-relay
```

---

## 想加回 UDP（传大文件卡顿 / 流量费吃不消时）

把 `listeners` 换成这四行、`default_protocol` 改 `udp`，重启，安全组补放 UDP `11010` 和 `11013`：

```toml
listeners = [
    "tcp://0.0.0.0:11010",
    "udp://0.0.0.0:11010",
    "ws://0.0.0.0:11011/",
    "quic://0.0.0.0:11013",
]
```
