// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const searchInput = document.getElementById('searchInput');
    const articleList = document.getElementById('articleList');
    const articles = articleList.getElementsByTagName('li');
    const categoryLinks = document.querySelectorAll('.category-link');
    const categoryTitle = document.querySelector('.category-title');
    const backAllBtn = document.getElementById('backAllBtn');

    // 初始化所有文章数组
    const allArticles = Array.from(articles);

    // 分类切换功能
    categoryLinks.forEach(link => {
        link.addEventListener('click', function() {
            // 移除所有active类
            categoryLinks.forEach(link => link.classList.remove('active'));
            // 添加当前active类
            this.classList.add('active');

            const category = this.getAttribute('data-category');

            // 更新标题和返回按钮
            if (category === 'all') {
                categoryTitle.textContent = 'Jrafina的博客小站';
                backAllBtn.style.display = 'none';
            } else if (category === 'tutorials') {
                categoryTitle.textContent = '教程归纳';
                backAllBtn.style.display = 'inline-block';
            } else if (category === 'solutions') {
                categoryTitle.textContent = '问题解决';
                backAllBtn.style.display = 'inline-block';
            }

            // 筛选文章
            filterArticles(category);
        });
    });

    // 返回全部文章
    backAllBtn.addEventListener('click', function() {
        categoryLinks.forEach(link => link.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        categoryTitle.textContent = 'Jrafina的博客小站';
        backAllBtn.style.display = 'none';
        filterArticles('all');
    });

    // 搜索功能
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const activeCategory = document.querySelector('.category-link.active').getAttribute('data-category');

        // 先筛选分类，再筛选搜索内容
        filterArticles(activeCategory, searchTerm);
    });

    // 文章筛选函数
    function filterArticles(category, searchTerm = '') {
        allArticles.forEach(article => {
            const articleCategory = article.getAttribute('data-category');
            const articleTitle = article.querySelector('.article-link').textContent.toLowerCase();

            // 判断是否匹配分类
            const isCategoryMatch = category === 'all' || articleCategory === category;
            // 判断是否匹配搜索词
            const isSearchMatch = searchTerm === '' || articleTitle.includes(searchTerm);

            // 显示/隐藏文章
            if (isCategoryMatch && isSearchMatch) {
                article.style.display = '';
            } else {
                article.style.display = 'none';
            }
        });
    }
});