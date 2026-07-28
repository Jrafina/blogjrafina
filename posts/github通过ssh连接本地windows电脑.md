在 Windows 命令行中生成 SSH 密钥、关联 GitHub 并克隆仓库。

---

# Windows 命令行通过 SSH 密钥连接 GitHub 并克隆仓库

本指南将帮助你使用 Windows 自带的 OpenSSH 客户端，通过 SSH 协议安全地连接 GitHub，并将远程仓库克隆到本地。

## 环境要求

- Windows 10 / 11 系统（自带 OpenSSH 客户端和可选的服务端）
- 已安装 [Git for Windows](https://git-scm.com/download/win)（提供 `git` 命令）
- 一个 GitHub 账号

以下步骤可在 **PowerShell**、**CMD** 或 **Git Bash** 中执行，推荐使用 PowerShell 以获得最佳兼容性。示例将以 PowerShell 为主。

---

## 1. 检查 SSH 客户端是否可用

打开 **PowerShell**，输入以下命令查看 SSH 版本：

```powershell
ssh -V
```

如果返回类似 `OpenSSH_for_Windows_8.6p1, LibreSSL 3.4.3` 的信息，说明 SSH 客户端已就绪。  
如果提示未找到命令，请前往 Windows 设置 → 应用 → 可选功能 → 添加功能 → 安装 **OpenSSH 客户端**。

---

## 2. 生成 SSH 密钥对

执行以下命令生成新的 Ed25519 密钥（现代、安全、短小），若你的系统不支持 Ed25519，可改用 RSA 4096。

```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

> 说明：
> - `-t ed25519` 指定密钥类型，也可用 `-t rsa -b 4096`。
> - `-C` 添加注释，一般填入你的 GitHub 邮箱，方便识别。
> - 回车后系统会询问密钥保存路径，直接按 **Enter** 使用默认路径 `C:\Users\你的用户名\.ssh\id_ed25519`。
> - 接着会提示输入密码短语（passphrase），可设可不设。设置后每次使用密钥都需输入，安全性更高；留空则直接按回车跳过。

生成成功后，`~/.ssh` 目录下会出现两个文件：

- `id_ed25519` —— 私钥（**务必保密，不要上传或分享**）
- `id_ed25519.pub` —— 公钥（上传到 GitHub）

---

## 3. 将私钥添加到 ssh-agent（推荐）（可选）

`ssh-agent` 可以在后台管理你的密钥，避免重复输入密码短语。

首先，确保 `ssh-agent` 服务正在运行（PowerShell 需以**管理员身份**运行）：

```powershell
# 设置 ssh-agent 服务为自动启动（首次配置时执行一次）
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

然后在**普通 PowerShell 窗口**中，将私钥添加到 agent：

```powershell
ssh-add ~\.ssh\id_ed25519
```

如果生成密钥时设置了密码短语，这里会要求输入一次。之后，只要 agent 在运行，Git 操作就无需再次输入密码。

> 若使用 **Git Bash**，可运行 `eval $(ssh-agent -s)` 再执行 `ssh-add ~/.ssh/id_ed25519`。

---

## 4. 复制公钥内容

使用以下命令将公钥文本复制到剪贴板：

```powershell
Get-Content ~\.ssh\id_ed25519.pub | Set-Clipboard
```

> 或者直接用记事本打开文件：`notepad ~\.ssh\id_ed25519.pub`，全选复制。

---

## 5. 在 GitHub 上添加 SSH 公钥

1. 登录 [GitHub](https://github.com)，点击右上角头像 → **Settings**。
2. 左侧菜单选择 **SSH and GPG keys**。
3. 点击 **New SSH key**。
4. **Title**：填入一个便于识别的名字（如 "My Windows PC"）。
5. **Key type** 保持 `Authentication Key`。
6. **Key**：将剪贴板中的公钥粘贴进来（以 `ssh-ed25519` 开头，以邮箱结尾）。
7. 点击 **Add SSH key**，根据提示输入 GitHub 密码完成确认。

---

## 6. 测试 SSH 连接

回到命令行，输入：

```powershell
ssh -T git@github.com
```

首次连接时会看到主机指纹验证提示：

```
The authenticity of host 'github.com (IP)' can't be established.
...
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

输入 `yes` 并按回车。如果配置正确，将显示：

```
Hi <你的GitHub用户名>! You've successfully authenticated, but GitHub does not provide shell access.
```

看到这条消息即表示 SSH 密钥已成功关联 GitHub。

---

## 7. 使用 SSH 协议克隆仓库

现在你可以通过 SSH 地址克隆任何你有权限的仓库了。  
在 GitHub 仓库页面点击绿色的 **Code** 按钮，选择 **SSH**，复制类似以下格式的地址：

```
git@github.com:用户名/仓库名.git
```

在命令行中执行：

```powershell
git clone git@github.com:用户名/仓库名.git
```

例如：

```powershell
git clone git@github.com:octocat/Hello-World.git
```

克隆成功后，即可在本地开始工作。

---

## 8. （可选）管理多个 SSH 密钥或不同账号

如果你需要在同一台电脑上使用多个 GitHub 账号，可以生成多个密钥并配置 `~/.ssh/config` 文件。

生成另一个密钥时指定不同的文件名：

```powershell
ssh-keygen -t ed25519 -C "another@example.com" -f ~\.ssh\id_ed25519_work
```

然后创建或编辑 `~\.ssh\config` 文件（没有扩展名），添加如下内容：

```
# 个人账号
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519

# 工作账号
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
```

克隆工作仓库时，将主机名替换为 `github-work`：

```powershell
git clone git@github-work:公司名/仓库.git
```

---

