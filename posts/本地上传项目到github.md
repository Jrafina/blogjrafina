# 本地上传项目到github

## 一、创建一个github仓库

例如创建一个名为 `test`的仓库

## 二、推送到github

```bash
# 1. 进入你的文件夹
cd "项目文件夹的路径"

# 2. 初始化 Git 仓库
git init

# 3. 将所有文件添加到暂存区
git add .

# 4. 提交（可以根据需要修改提交信息）
git commit -m "初始提交"

# 5. 将本地分支重命名为 main（如果默认是 master，现在 GitHub 推荐用 main）
git branch -M main

# 6. 关联远程仓库（换成你自己复制的地址）
git remote set-url origin git@github.com:用户名/仓库名.git

# 7. 推送到 GitHub
git push -u origin main
```

