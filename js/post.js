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

                // Add copy buttons to code blocks
                addCopyButtons(container);

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
                // Manual line-scan: match opening fence by backtick count
                // so nested fences (e.g. 4-backtick block containing 3-backtick
                // example) are handled correctly.
                const lines = md.split('\n');
                let src = '';
                let i = 0;

                while (i < lines.length) {
                    const m = lines[i].match(/^(\s*)(`{3,})([^`]*)$/);
                    if (m) {
                        const fenceLen = m[2].length;
                        const lang = m[3].trim();
                        const blockLines = [];
                        let j = i + 1;
                        // Find closing fence: at least fenceLen backticks, nothing else
                        const closeRe = new RegExp('^\\s*`{' + fenceLen + ',}\\s*$');
                        while (j < lines.length && !closeRe.test(lines[j])) {
                            blockLines.push(lines[j]);
                            j++;
                        }
                        if (j < lines.length) {
                            // Found closing fence
                            const fullBlock = m[0] + '\n' + blockLines.join('\n') + '\n' + lines[j];
                            codeBlocks.push(fullBlock);
                            src += '\n@@CODEBLOCK' + (c++) + '@@\n';
                            i = j + 1;
                            continue;
                        }
                        // No matching close found — treat as regular text
                    }
                    src += lines[i] + '\n';
                    i++;
                }
                md = src;

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
                marked.setOptions({
                    breaks: false,
                    gfm: true,
                    // Syntax highlight via highlight.js; unknown/no language → auto-detect
                    highlight: function(code, lang) {
                        const language = (lang || '').toLowerCase();
                        if (language && hljs.getLanguage(language)) {
                            return hljs.highlight(code, { language: language }).value;
                        }
                        return hljs.highlightAuto(code).value;
                    }
                });
                let html = marked.parse(md);

                // --- Step 6: Restore math ---
                html = html.replace(/<p[^>]*>@@MATH(\d+)@@<\/p>/g,
                    (_m, i) => mathBlocks[parseInt(i)].content);
                html = html.replace(/@@MATH(\d+)@@/g,
                    (_m, i) => mathBlocks[parseInt(i)].content);

                container.innerHTML = html;

                // Add copy buttons to code blocks
                addCopyButtons(container);

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

    // ============== Add Copy Buttons to Code Blocks ==============
    function addCopyButtons(container) {
        container.querySelectorAll('pre').forEach(pre => {
            // Don't add if already wrapped
            if (pre.parentNode.classList.contains('code-block-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';

            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
            btn.setAttribute('aria-label', '复制代码');

            btn.addEventListener('click', () => {
                const code = pre.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                        btn.classList.remove('copied');
                    }, 2000);
                }).catch(() => {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = code;
                    textarea.style.cssText = 'position:fixed;left:-9999px;';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        btn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                        btn.classList.add('copied');
                        setTimeout(() => {
                            btn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
                            btn.classList.remove('copied');
                        }, 2000);
                    } catch (e) {
                        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> 复制失败';
                    }
                    document.body.removeChild(textarea);
                });
            });

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(btn);
            wrapper.appendChild(pre);
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

        // Build a nested tree of headings
        // Each node: { el, level, children: [] }
        function buildTree() {
            const root = { level: 0, children: [] };
            const stack = [root];

            headings.forEach((h, i) => {
                if (!h.id) h.id = 'heading-' + (i + 1);
                const level = parseInt(h.tagName.charAt(1)); // h1->1, h2->2, ...
                const node = { el: h, level: level, children: [] };

                // Pop stack until we're at a parent level
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }
                // Attach to parent
                const parent = stack[stack.length - 1] || root;
                parent.children.push(node);
                stack.push(node);
            });

            return root.children;
        }

        // Get clean heading text excluding KaTeX MathML annotations
        function getTocText(heading) {
            const clone = heading.cloneNode(true);
            // Remove MathML elements – they contain raw LaTeX source in <annotation>
            clone.querySelectorAll('.katex-mathml').forEach(el => el.remove());
            return clone.textContent.trim();
        }

        // Render nested <ul> from tree nodes
        function renderTree(nodes) {
            if (nodes.length === 0) return '';
            let html = '<ul class="toc-list">';
            nodes.forEach(node => {
                const h = node.el;
                const tag = h.tagName.toLowerCase();
                html += '<li>';
                html += `<a href="#${h.id}" class="toc-${tag}">${getTocText(h)}</a>`;
                if (node.children.length > 0) {
                    html += renderTree(node.children);
                }
                html += '</li>';
            });
            html += '</ul>';
            return html;
        }

        const tree = buildTree();
        tocNav.innerHTML = renderTree(tree);

        // Bind click events
        tocNav.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.getElementById(a.getAttribute('href').slice(1));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                tocNav.querySelectorAll('a').forEach(link => link.classList.remove('active'));
                a.classList.add('active');
            });
        });

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
