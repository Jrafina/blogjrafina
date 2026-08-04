# 在飞牛上面解锁挂在 veracrypt 加密盘及卸载

## 飞牛系统

飞牛是基于 `Debian 12` 开发的系统



## 必备文件

假设你有以下文件：

1. `/vol1/1000/test/加密卷`
2. `/vol1/1000/test/密钥`
3. `/vol1/1000/test/mount-veracrypt.sh`
4. `/vol1/1000/test/veracrypt-1.26.29-Debian-12-amd64.deb`

## 一、 准备

### 1.安装 VeraCrypt

```bash
# 修复缺失的图形库依赖（即使只用命令行，也必须安装）
sudo apt --fix-broken install

# 安装 deb 包
sudo dpkg -i "/vol1/1000/test/veracrypt-1.26.29-Debian-12-amd64.deb"

# 安装 FUSE 库（挂载所必需）
sudo apt install libfuse2
```

### 2.创建挂载点

```bash
sudo mkdir -p /vol1/1000/挂载
```

### 3.清除 DISPLAY 环境变量（避免图形界面报错）

若通过 SSH 连接（如 MoTTY/Xshell），需关闭 X11 转发或手动执行：

```bash
unset DISPLAY
```

> 永久解决：在 SSH 客户端设置中禁用 X11 转发（如 MoTTY → Connection → SSH → X11 → 取消勾选 Enable X11 forwarding）。

## 二、命令行挂载加密卷

```bash
sudo veracrypt -t --mount "/vol1/1000/test/加密卷" /vol1/1000/挂载 \
  --keyfiles="/vol1/1000/test/密钥" \
  --password="12334" \
  --non-interactive
```

### 验证加密卷

```bash
root@fn-v:~# ls /vol1/1000/挂载
```

如果出现以下结果则表示挂载成功,其中`申报书.doc`是挂载卷中的文件

```bash
'$RECYCLE.BIN'  'System Volume Information'   申报书.doc
```

### 卸载加密卷

```bash
sudo veracrypt -d /vol1/1000/挂载
# 或卸载全部 VeraCrypt 卷
sudo veracrypt -d
```

## 三、脚本挂载加密卷

`/vol1/1000/test/mount-veracrypt.sh`即脚本

```sh
#!/bin/bash

# 退出时若发生错误则停止
set -e

# 检查 VeraCrypt 是否可用
if ! command -v veracrypt &> /dev/null; then
    echo "错误：未找到 VeraCrypt，请先安装。"
    exit 1
fi

echo "===== VeraCrypt 交互式挂载脚本 ====="

# 1. 加密卷路径
read -p "请输入加密卷路径（文件或设备）： " volume_path
if [ ! -e "$volume_path" ]; then
    echo "警告：路径 '$volume_path' 不存在，将继续尝试挂载。"
fi

# 2. 挂载点
read -p "请输入挂载点路径： " mount_point
if [ ! -d "$mount_point" ]; then
    echo "挂载点不存在，是否创建？[y/N]"
    read -r create_confirm
    if [ "$create_confirm" = "y" ] || [ "$create_confirm" = "Y" ]; then
        sudo mkdir -p "$mount_point"
        echo "已创建挂载点：$mount_point"
    else
        echo "已取消操作。"
        exit 0
    fi
fi

# 3. 密钥文件（可留空）
read -p "请输入密钥文件路径（无密钥则直接回车）： " keyfile_path

# 4. 密码（隐藏输入，可留空）
read -s -p "请输入密码（无密码则直接回车）： " password
echo    # 输出换行

# 构建参数数组（安全传递特殊字符）
args=(sudo veracrypt -t --mount "$volume_path" "$mount_point")

if [ -n "$keyfile_path" ]; then
    args+=(--keyfiles="$keyfile_path")
fi

if [ -z "$password" ]; then
    args+=(--password=)
else
    args+=(--password="$password")
fi

args+=(--non-interactive)

echo "正在挂载..."
# 执行挂载
"${args[@]}"

# 检查挂载结果
if mountpoint -q "$mount_point"; then
    echo "✔ 挂载成功！挂载点：$mount_point"
else
    echo "✘ 挂载可能失败，请检查上方错误信息。"
    exit 1
fi
```

### 使用方法

1. 进入文件夹

   ```bash
   cd /vol1/1000/test/
   ```

2. 赋权

   ```bash
   chmod +x mount-veracrypt.sh
   ```

3. 挂载

   ```bash
   -i 's/\r$//' mount-veracrypt.sh
   
   bash ./mount-veracrypt.sh
   ```

4. 对应输入文件路径就好了