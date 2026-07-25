# 📘 Cloudflare R2 + rclone 配置完全指南（Windows）

## 1. 安装必要软件

### 1.1 WinFsp（如果需要挂载R2存储桶到本地则下载）

- 下载地址：[https://winfsp.dev/rel/](https://winfsp.dev/rel/)
- 下载 `.msi` 安装包，双击安装，全部默认设置即可。

### 1.2 rclone

- 下载地址：[https://rclone.org/downloads/](https://rclone.org/downloads/)
- 选择 **Windows Intel/AMD 64-bit**，下载后解压得到 `rclone.exe`。
- 建议将 `rclone.exe` 放到固定目录，例如：`C:\rclone\`。

---

## 2. 配置环境变量（让 rclone 全局可用）

1. 按 `Win + R`，输入 `sysdm.cpl` 回车。
2. 切换到 **高级** 选项卡 → **环境变量**。
3. 在 **系统变量**（或用户变量）中找到 `Path`，双击。
4. 新建一项，填入 `C:\rclone\`（即你存放 `rclone.exe` 的文件夹路径）。
5. 依次点击 **确定** 保存。

验证：打开新的 **PowerShell** 或 **CMD**，输入：

```powershell
rclone version
```

输出版本信息即表示配置成功。

---

## 3. 获取 Cloudflare R2 凭证

在 Cloudflare 后台 → **R2** → **管理 R2 API 令牌**，创建令牌后获取：

- **Endpoint**：格式 `https://<账户ID>.r2.cloudflarestorage.com`
- **Access Key ID**
- **Secret Access Key**
- **存储桶名称**（例如 `my-bucket`）

> **⚠️ 安全提示**：这些密钥拥有操作权限，切勿在公共场合或聊天中粘贴真实密钥。

---

## 4. 使用 rclone config 配置 R2 连接

在终端运行：

```powershell
rclone config
```

按以下交互一步步操作（输入内容已用 `【】` 标出，不要复制标点）：

```
e/n/d/r/c/s/q> n                          【选择新远程】
name> cf-r2                               【给连接起个名字，例如 cf-r2】
Storage> s3                               【存储类型输入 s3 或数字 4】
provider> Cloudflare                      【注意：一定是 Cloudflare，不要带 R2】
env_auth> 直接按回车                      【默认 false，手动输入密钥】
access_key_id> 你的 Access Key ID         【粘贴你的 Access Key ID】
secret_access_key> 你的 Secret Access Key 【粘贴你的 Secret Access Key】
region> auto                              【输入 auto 或按回车留空均可】
endpoint> https://xxxxx.r2.cloudflarestorage.com  【替换为你的 Endpoint】
Edit advanced config? y/n> n              【直接回车，不编辑高级配置】
Keep this "cf-r2" remote? y/e/d> y        【确认保存】
e/n/d/r/c/s/q> q                          【退出配置】
```

好了，现在你的 R2 远程连接 `cf-r2` 已经可用。

---

## 5. 常用操作命令

### 5.1 查看所有存储桶

```powershell
rclone lsd cf-r2:
```

> 注意末尾的冒号，列出根目录下的所有桶。

### 5.2 查看桶内文件

```powershell
# 简单列表
rclone ls cf-r2:你的桶名

# 详细信息（时间、大小）
rclone lsl cf-r2:你的桶名

# 树状目录
rclone tree cf-r2:你的桶名
```

### 5.3 增量上传本地文件夹到 R2（安全备份，不删除远程文件）

```powershell
rclone copy "C:\你的本地文件夹" cf-r2:你的桶名/远程路径 --progress --transfers 16 --checkers 32
```

### 5.4 单向镜像同步（让远程和本地完全一致，会删除远程多余文件）

```powershell
# 先模拟看看效果
rclone sync "C:\你的本地文件夹" cf-r2:你的桶名/远程路径 --dry-run

# 确认后正式执行
rclone sync "C:\你的本地文件夹" cf-r2:你的桶名/远程路径 --progress --transfers 16 --checkers 32
```

### 5.5 挂载为本地磁盘（需要 WinFsp）

以**管理员身份**打开终端：

```powershell
rclone mount cf-r2:你的桶名 R: --vfs-cache-mode full --network-mode
```

成功后会多出一个 `R:` 盘（可自由指定盘符）。  
管理时最好不要关闭该终端窗口。

**开机自动挂载**：使用“任务计划程序”创建基本任务，触发器选“登录时”，操作填：

- 程序：`rclone`
- 参数：`mount cf-r2:你的桶名 R: --vfs-cache-mode full --network-mode --no-console`

### 5.6 生成临时分享链接

```powershell
rclone link cf-r2:你的桶名/文件路径.jpg
```

会返回一个有时效性的预签名 URL，适合临时分享私密文件。

---

## 6. 进阶参数参考

| 场景                 | 推荐参数                                                  |
| -------------------- | --------------------------------------------------------- |
| 日常备份（只增不删） | `rclone copy ... --progress --transfers 16 --checkers 32` |
| 完全镜像（慎用）     | `rclone sync ... --dry-run` 先预览，确认后加 `--progress` |
| 大量小文件           | `--transfers 32 --checkers 64`（调高并发）                |
| 限制本地缓存         | `--vfs-cache-max-size 5G`（挂载时用）                     |
| 实时性要求高         | `--dir-cache-time 5000`（挂载时目录缓存 5 秒）            |

---

## 7. 常见问题排错

- **`provider "Cloudflare R2" not known`**  
  配置时 `provider` 必须填 `Cloudflare`，不要加 `R2`。

- **`InvalidAccessKeyId`**  
  Access Key ID 输入错误或密钥已失效，请重新生成。

- **权限不足挂载失败**  
  尝试以管理员权限运行终端，或检查 WinFsp 是否安装正确。

- **中文乱码**  
  在批处理开头加 `chcp 65001`，并保存为 UTF-8 with BOM 编码。

---

## ⚡ 一键直达最常用操作

```powershell
# 列出桶
rclone lsd cf-r2:

# 备份桌面文件夹到 R2
rclone copy "C:\Users\你的用户名\Desktop\重要文件" cf-r2:my-bucket/backup --progress

# 挂载 R2 为 Z 盘
rclone mount cf-r2:my-bucket Z: --vfs-cache-mode full --network-mode
```

---

## 同步bat脚本

```bash
@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title R2 增量同步脚本（模式可选 · 中文预览 + 安全确认）

:: ========== 请根据实际修改 ==========
set "LOCAL_PATH=电脑文件目录"
set "REMOTE_PATH=cf_R2:存储桶/文件夹"
:: ===================================

set "TEMP_LOG=%TEMP%\rclone_sync_preview.txt"

echo ================================================
echo        R2 增量同步脚本 - 请选择同步模式
echo ================================================
echo  1. 快速模式（仅比较文件大小）
echo     - 速度最快，适合大文件夹
echo     - 缺点：极少情况下（文件内容改动但大小不变）可能漏传
echo.
echo  2. 准确模式（比较文件校验和）
echo     - 绝对准确，适合文本/代码等文件
echo     - 缺点：首次同步或大量文件时会较慢
echo.
echo  3. 默认模式（比较大小 + 修改时间）
echo     - 速度较快，但若文件时间戳被改动（如手机上传）
echo       会导致大量误判为“需要更新”
echo.
echo  4. 取消并退出
echo ================================================

set /p CHOICE="请输入数字 (1/2/3/4): "

if "%CHOICE%"=="1" (
    set "SYNC_MODE=--size-only"
    set "MODE_DESC=快速模式（仅大小）"
) else if "%CHOICE%"=="2" (
    set "SYNC_MODE=--checksum"
    set "MODE_DESC=准确模式（校验和）"
) else if "%CHOICE%"=="3" (
    set "SYNC_MODE="
    set "MODE_DESC=默认模式（大小+时间）"
) else if "%CHOICE%"=="4" (
    echo 操作已取消。
    pause
    exit /b
) else (
    echo 输入无效，将退出。
    pause
    exit /b
)

echo.
echo 当前模式：!MODE_DESC!
echo ================================================
echo  正在分析本地文件夹与 R2 的差异...
echo  源  ："%LOCAL_PATH%"
echo  目标："%REMOTE_PATH%"
echo ================================================

:: 1. 预览阶段
rclone sync "%LOCAL_PATH%" "%REMOTE_PATH%" ^
    --exclude "1.txt" ^
    --exclude "2.txt" ^
    !SYNC_MODE! ^
    --transfers 16 ^
    --checkers 32 ^
    --dry-run > "%TEMP_LOG%" 2>&1

echo.
echo ==================== 本次同步变更明细 ====================

:: [新增/更新]
set count=0
echo  [新增/更新] 以下文件将被上传或覆盖：
for /f "usebackq tokens=1* delims=" %%L in (`findstr /c:"Skipped copy" "%TEMP_LOG%"`) do (
    set "line=%%L"
    set "line=!line: Skipped copy as --dry-run is set=!"
    for /f "tokens=1* delims=:" %%a in ("!line!") do set "file=%%b"
    for /f "tokens=*" %%f in ("!file!") do set "file=%%f"
    if defined file (
        set /a count+=1
        echo   !file!
    )
)
if !count!==0 echo   (无)
echo  共计 !count! 个文件

echo.

:: [删除]
set count=0
echo  [删除] 以下文件将从远程删除：
for /f "usebackq tokens=1* delims=" %%L in (`findstr /c:"Skipped delete" "%TEMP_LOG%"`) do (
    set "line=%%L"
    set "line=!line: Skipped delete as --dry-run is set=!"
    for /f "tokens=1* delims=:" %%a in ("!line!") do set "file=%%b"
    for /f "tokens=*" %%f in ("!file!") do set "file=%%f"
    if defined file (
        set /a count+=1
        echo   !file!
    )
)
if !count!==0 echo   (无)
echo  共计 !count! 个文件

:: 清理临时文件
del "%TEMP_LOG%" >nul 2>&1

echo ============================================================
echo  以上是本次同步即将执行的所有操作，请仔细核对！
echo ============================================================

set /p CONFIRM="确认执行同步？(输入 y 继续，其他任意键取消): "
if /i not "%CONFIRM%"=="y" (
    echo 操作已取消。
    pause
    exit /b
)

:: 2. 正式同步
if not exist "D:\rclone" mkdir "D:\rclone"

echo.
echo 正在同步（!MODE_DESC!），请稍候...
rclone sync "%LOCAL_PATH%" "%REMOTE_PATH%" ^
    --exclude "1.txt" ^
    --exclude "2.txt" ^
    !SYNC_MODE! ^
    --transfers 16 ^
    --checkers 32 ^
    --progress ^
    --stats 15s ^
    --log-file="D:\rclone\rclone_sync.log" ^
    --log-level INFO

echo.
echo ✅ 同步完成！
pause
```

执行步骤：

1. 复制以上代码
2. 新建一个文件，名为：`sync.bat`
3. 把复制好的代码粘贴到`sync.bat`
4. 运行`sync.baw`


