 # 服务器虚拟环境激活并添加system进程守护

## 一、添加python虚拟环境

### 1.创建虚拟环境

```bash
python3 -m venv venv
```

###  2.下载requests.txt的第三方库

```bash
venv/bin/pip install -r requirements.txt
```



## 二、添加systemd进程守护

假设你要创建`test`文件夹里面的`test.py`服务

### 1.创建 systemd 服务文件

```bash
sudo nano /etc/systemd/system/test.service
```

粘贴以下完整内容（Ctrl+O 保存，Enter 确认，Ctrl+X 退出）：

```ini
[Unit]
Description=test # 描述
After=network-online.target  # 不变
Wants=network-online.target  # 不变

[Service]
Type=simple
User=user  # 用户名
WorkingDirectory=/vol1/1000/python/test # 脚本工作目录
ExecStart=/vol1/1000/python/test/venv/bin/python /vol1/1000/python/test/test.py # 前者是虚拟环境的python目录，后者是py脚本目录
Restart=always  # 不变
RestartSec=15  # 不变

[Install]
WantedBy=multi-user.target
```

**各配置项含义**：

| 配置项                        | 作用                                   |
| ----------------------------- | -------------------------------------- |
| `After=network-online.target` | 开机等网络就绪后再启动（监控需要联网） |
| `Restart=always`              | 进程崩溃后 15 秒自动重启               |
| `User=user`                   | 以普通用户运行，不用 root              |
| `ExecStart`                   | 用 venv 里的 python 启动，保证用对依赖 |
| `WantedBy=multi-user.target`  | 系统进入多用户模式（正常开机）时启动   |

> ⚠️ 用 nano 直接编辑，不要用 `echo 密码 | sudo -S tee <<EOF` 的方式（heredoc 会占用 stdin，导致 sudo 读不到密码）。

### 2.启用开机自启并启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable test
sudo systemctl start test
```

**预期输出**：`enable` 显示 `Created symlink /etc/systemd/system/multi-user.target.wants/test.service → ...`

### 3.验证服务运行

```bash
systemctl status test --no-pager
systemctl is-enabled test
```

**预期结果**：

- 第一行 `Loaded: loaded (...; enabled; ...)` → 开机自启已配置
- `Active: active (running)` → 正在运行
- `Main PID:` 有进程号
- `is-enabled` 输出 `enabled`

---

### 4.重启服务器验证开机自启

```bash
sudo reboot
```

等 1~2 分钟重新 SSH 登录后：

```bash
systemctl status test
```

预期：无需任何手动操作，服务已经是 `active (running)`。

## 三、日常管理命令

```bash
systemctl status test      # 查看状态
systemctl restart test     # 重启
systemctl stop test        # 停止
journalctl -u test -f      # 实时看 systemd 
```
