# 🎉 Markdown 渲染测试文章

欢迎来到我的博客！这篇文章展示了**完整的 Markdown 渲染能力**，包括数学公式、代码高亮、表格等。

---

## 📐 行内数学公式

质能方程：$E = mc^2$

勾股定理：$a^2 + b^2 = c^2$

欧拉恒等式被誉为最美的数学公式：$e^{i\pi} + 1 = 0$

二次方程求根公式：$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

概率中的贝叶斯定理：$P(A \mid B) = \frac{P(B \mid A) \cdot P(A)}{P(B)}$

---

## 📊 多行（块级）数学公式

### 柯西-施瓦茨不等式

$$
\left( \sum_{k=1}^{n} a_k b_k \right)^2 \leq \left( \sum_{k=1}^{n} a_k^2 \right) \left( \sum_{k=1}^{n} b_k^2 \right)
$$

### 高斯积分

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

### 傅里叶变换

$$
\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) \cdot e^{-2\pi i x \xi} \, dx
$$

### Maxwell 方程组（微分形式）

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\[4pt]
\nabla \cdot \mathbf{B} &= 0 \\[4pt]
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\[4pt]
\nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

### 矩阵运算

$$
\begin{bmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{bmatrix}
\cdot
\begin{bmatrix}
x_1 \\ x_2 \\ \vdots \\ x_n
\end{bmatrix}
=
\begin{bmatrix}
b_1 \\ b_2 \\ \vdots \\ b_m
\end{bmatrix}
$$

### Taylor 级数展开

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!} (x - a)^n
$$

---

## 💻 代码块

### Python 示例

```python
def quick_sort(arr):
    """快速排序算法"""
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

# 测试
nums = [3, 6, 8, 10, 1, 2, 1]
print(quick_sort(nums))  # [1, 1, 2, 3, 6, 8, 10]
```

### JavaScript 示例

```javascript
const fibonacci = (n, memo = {}) => {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
};

console.log(fibonacci(10)); // 55
```

### Shell 命令

```bash
# 批量重命名文件
for f in *.jpg; do
  mv "$f" "photo_$(printf '%03d' $((++i))).jpg"
done
```

---

## 📋 表格

| 语言 | 用途 | 难度 | 推荐指数 |
|------|------|------|----------|
| Python | 数据分析、AI/ML、自动化脚本 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| JavaScript | Web 前端、全栈开发 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Rust | 系统编程、高性能应用 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Go | 后端服务、云原生 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| TypeScript | 大型前端项目 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🖼️ 其他 Markdown 元素

### 引用块

> **注意：** 这是一条引用块。伟大的数学家高斯曾说："数学是科学的皇后，数论是数学的皇后。"
>
> —— 卡尔·弗里德里希·高斯

### 嵌套引用

> 外层引用内容
>> 内层嵌套引用 —— 这在技术文档中很常见
>
> 回到外层

### 无序列表

- 📝 **Markdown**：轻量级标记语言，易读易写
- 🔧 **LaTeX**：专业排版系统，特别适合数学论文
- 🌐 **HTML**：网页的基础标记语言
- ⚛️ **React/Vue**：现代前端框架

### 有序列表

1. 第一阶段：学习 HTML + CSS
2. 第二阶段：掌握 JavaScript 基础
3. 第三阶段：学习一个前端框架
4. 第四阶段：了解后端开发

### 水平分割线

---

### 任务列表

- [x] 学习 Markdown 语法
- [x] 学习 KaTeX 数学公式
- [ ] 搭建个人博客
- [ ] 写 100 篇技术文章
- [ ] 出版一本书

---

## 📝 小结

这篇文章展示了 Markdown 博客应该具备的完整渲染能力：

| 功能 | 状态 |
|------|------|
| 行内公式 `$...$` | ✅ |
| 块级公式 `$$...$$` | ✅ |
| 代码高亮 | ✅ |
| 表格 | ✅ |
| 引用 | ✅ |
| 图片 | ✅ |

希望这篇博客能帮助你更好地组织技术文章！🚀
