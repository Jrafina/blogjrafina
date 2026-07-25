// ============== Post page logic ==============

(function() {
    // --- Parse query param ---
    const params = new URLSearchParams(window.location.search);
    const postFile = params.get('post');

    if (!postFile) {
        document.getElementById('postContent').innerHTML =
            '<p style="text-align:center;padding:60px 0;color:var(--text-tertiary);">未指定文章。请从<a href="index.html">文章列表</a>选择一篇文章。</p>';
        document.getElementById('tocEmpty').textContent = '无内容';
        buildOtherPosts();
        return;
    }

    // --- Find post metadata ---
    const postMeta = POSTS.find(p => p.file === postFile);

    // --- Render other posts list ---
    function buildOtherPosts() {
        const nav = document.getElementById('otherPostsNav');
        nav.innerHTML = POSTS
            .filter(p => p.file !== postFile)
            .map(p => `<li><a href="post.html?post=${encodeURIComponent(p.file)}">${p.title}</a></li>`)
            .join('');
    }

    // --- Determine if it's an HTML or MD file ---
    const isHTML = postFile.endsWith('.html');

    // Set page title
    document.title = (postMeta ? postMeta.title : postFile) + ' - Jrafina的博客';
    document.getElementById('pageTitle').textContent = document.title;

    // Show post meta
    if (postMeta) {
        const meta = document.getElementById('postMeta');
        meta.style.display = 'flex';
        document.getElementById('postTag').textContent =
            postMeta.category === 'tutorials' ? '教程归纳' : '学习合集';
        document.getElementById('postTag').className = 'post-tag ' + postMeta.category;
        document.getElementById('postDate').textContent = postMeta.date;
    }
    document.getElementById('postTitle').textContent = postMeta ? postMeta.title : postFile;
    buildOtherPosts();

    // Load post content
    if (isHTML) {
        loadHTMLPost(postFile);
    } else {
        loadMDPost(postFile);
    }

    // ============== Shared KaTeX config ==============
    const KATEX_OPTS = {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$',  right: '$',  display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
        strict: false,
        trust: true
    };

    // ============== HTML Post Loader ==============
    function loadHTMLPost(file) {
        fetch('posts/' + file)
            .then(res => res.text())
            .then(html => {
                const container = document.getElementById('postContent');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Remove scripts for safety
                doc.body.querySelectorAll('script').forEach(s => s.remove());

                // Try Typora export containers
                const writeDiv = doc.body.querySelector('#write') || doc.body.querySelector('.markdown-body');
                container.innerHTML = writeDiv ? writeDiv.innerHTML : doc.body.innerHTML;

                // Render KaTeX
                window.renderMathInElement(container, KATEX_OPTS);

                // Generate TOC
                setTimeout(() => generateTOC(container), 200);
            })
            .catch(err => {
                document.getElementById('postContent').innerHTML =
                    `<p style="text-align:center;padding:60px;color:var(--text-tertiary);">
                        文章加载失败：${err.message}<br><a href="index.html">返回首页</a></p>`;
            });
    }

    // ============== Markdown Post Loader ==============
    function loadMDPost(file) {
        fetch('posts/' + file)
            .then(res => {
                if (!res.ok) throw new Error('文章文件不存在: ' + file);
                return res.text();
            })
            .then(md => {
                const container = document.getElementById('postContent');
                const codeBlocks = [];
                const mathBlocks = [];
                let c = 0, m = 0;

                // --- Step 1: Protect fenced code blocks ---
                md = md.replace(/(```[\s\S]*?```)/g, (match) => {
                    codeBlocks.push(match);
                    return `\n@@CODEBLOCK${c++}@@\n`;
                });

                // --- Step 2: Protect $$ display math ---
                md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_m, content) => {
                    mathBlocks.push({ type: 'display', content: '$$' + content + '$$' });
                    return `\n@@MATH${m++}@@\n`;
                });

                // --- Step 3: Protect $ inline math ---
                md = md.replace(/\$([^$\n]+?)\$/g, (_m, content) => {
                    if (/^\d/.test(content.trim())) return _m;
                    mathBlocks.push({ type: 'inline', content: '$' + content + '$' });
                    return `@@MATH${m++}@@`;
                });

                // --- Step 4: Restore code blocks ---
                md = md.replace(/@@CODEBLOCK(\d+)@@/g,
                    (_m, i) => codeBlocks[parseInt(i)]);

                // --- Step 5: Parse with Marked ---
                marked.setOptions({ breaks: false, gfm: true });
                let html = marked.parse(md);

                // --- Step 6: Restore math ---
                html = html.replace(/<p[^>]*>@@MATH(\d+)@@<\/p>/g,
                    (_m, i) => mathBlocks[parseInt(i)].content);
                html = html.replace(/@@MATH(\d+)@@/g,
                    (_m, i) => mathBlocks[parseInt(i)].content);

                container.innerHTML = html;

                // Render KaTeX
                window.renderMathInElement(container, KATEX_OPTS);

                // Generate TOC
                setTimeout(() => generateTOC(container), 200);
            })
            .catch(err => {
                document.getElementById('postContent').innerHTML =
                    `<p style="text-align:center;padding:60px;color:var(--text-tertiary);">
                        文章加载失败：${err.message}<br><a href="index.html">返回首页</a></p>`;
            });
    }

    // ============== TOC Generator ==============
    function generateTOC(container) {
        const headings = container.querySelectorAll('h1, h2, h3, h4');
        const tocNav = document.getElementById('tocNav');
        const tocEmpty = document.getElementById('tocEmpty');

        if (headings.length === 0) {
            tocEmpty.textContent = '本文无标题';
            return;
        }
        tocEmpty.style.display = 'none';

        const ul = document.createElement('ul');
        ul.className = 'toc-list';

        headings.forEach((h, i) => {
            if (!h.id) h.id = 'heading-' + (i + 1);
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + h.id;
            a.textContent = h.textContent;
            a.className = 'toc-' + h.tagName.toLowerCase();

            a.addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById(h.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
                tocNav.querySelectorAll('a').forEach(link => link.classList.remove('active'));
                a.classList.add('active');
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
        tocNav.appendChild(ul);

        // Scroll spy
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    tocNav.querySelectorAll('a').forEach(a => {
                        a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
                    });
                }
            });
        }, { rootMargin: '-60px 0px -70% 0px' });
        headings.forEach(h => observer.observe(h));
    }
})();
