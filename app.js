/**
 * PlatePilot Global UI & Community Module
 */
(function() {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    let container = $('.pp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'pp-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `pp-toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
    toast.innerHTML = `<span style="font-size:16px">${icon}</span> <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Modal System
  function openModal(title, bodyHtml, footerButtonsHtml = '') {
    closeModal(); // Close any existing modal
    const overlay = document.createElement('div');
    overlay.className = 'pp-modal-overlay';
    overlay.innerHTML = `
      <div class="pp-modal" role="dialog" aria-modal="true">
        <div class="pp-modal-header">
          <h3 class="pp-modal-title">${escapeHTML(title)}</h3>
          <button class="pp-modal-close" aria-label="Close dialog">&times;</button>
        </div>
        <div class="pp-modal-body">
          ${bodyHtml}
        </div>
        ${footerButtonsHtml ? `<div class="pp-modal-footer">${footerButtonsHtml}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelector('.pp-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return overlay;
  }

  function closeModal() {
    const overlay = $('.pp-modal-overlay');
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  }

  // Highlight active link in navbar
  function initNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    $$('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });

    const toggle = $('.menu-toggle');
    const nav = $('.nav-links');
    if (toggle && nav) {
      toggle.addEventListener('click', () => nav.classList.toggle('open'));
    }

    $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  }

  // Community Page Controller
  async function initCommunity() {
    const form = $("#post-form");
    const host = $("#community-posts");
    if (!form || !host) return;

    let selectedTag = 'All';
    let posts = [];

    // Tag filter bar
    const tags = ['All', 'Hostel Hacks', 'Budget Snack', 'High Protein', 'Smart Shopping', 'Meal Prep', 'General'];
    const filterContainer = document.createElement('div');
    filterContainer.className = 'tag-filter-bar';
    filterContainer.innerHTML = tags.map(t => `<button class="tag-pill ${t === 'All' ? 'active' : ''}" data-tag="${t}">${t}</button>`).join('');
    host.parentElement.insertBefore(filterContainer, host);

    filterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-pill');
      if (!btn) return;
      $$('.tag-pill', filterContainer).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTag = btn.dataset.tag;
      render();
    });

    async function loadData() {
      host.innerHTML = '<div class="empty-state"><p>Loading community ideas from database...</p></div>';
      try {
        if (window.PPStore && typeof window.PPStore.getPostsAsync === 'function') {
          posts = await window.PPStore.getPostsAsync();
        } else {
          posts = window.PPStore.getPosts();
        }
      } catch {
        posts = window.PPStore.getPosts();
      }
      if (!posts || !posts.length) {
        posts = [
          {
            id: 1,
            author_name: "A fellow hostelite",
            message: "Batch-cook dal or chickpeas once and use them in different meals through the week. It saves time and reduces cooking gas/electricity.",
            tag: "Hostel Hacks",
            likes: 6,
            created_at: "Just now"
          }
        ];
      }
      render();
    }

    function render() {
      const filtered = selectedTag === 'All' ? posts : posts.filter(p => (p.tag || 'General').toLowerCase() === selectedTag.toLowerCase());
      if (!filtered.length) {
        host.innerHTML = `
          <div class="empty-state">
            <span>💬</span>
            <h3>No tips in this category yet</h3>
            <p>Be the first to share an affordable tip under ${selectedTag}!</p>
          </div>
        `;
        return;
      }

      host.innerHTML = filtered.map(p => {
        const id = p.id;
        const author = p.author_name || p.name || 'Anonymous';
        const dateStr = p.created_at ? (typeof p.created_at === 'string' && p.created_at.includes('T') ? new Date(p.created_at).toLocaleDateString() : p.created_at) : 'Community tip';
        const tag = p.tag || 'General';

        return `
          <article class="community-post" data-id="${id}">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <span class="post-author">${escapeHTML(author)}</span>
                <span class="post-date">${escapeHTML(dateStr)}</span>
                <span class="post-tag">${escapeHTML(tag)}</span>
              </div>
            </div>
            <p>${escapeHTML(p.message)}</p>
            <button class="like-button" data-like-id="${id}">
              <span>♡</span> Helpful · <span class="like-count">${p.likes || 0}</span>
            </button>
          </article>
        `;
      }).join('');

      // Attach like listeners
      $$('[data-like-id]', host).forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.likeId);
          const post = posts.find(p => p.id === id);
          if (post) {
            post.likes = (post.likes || 0) + 1;
            const countSpan = btn.querySelector('.like-count');
            if (countSpan) countSpan.textContent = post.likes;
            btn.style.transform = 'scale(1.15)';
            setTimeout(() => btn.style.transform = '', 200);

            if (window.PPStore && typeof window.PPStore.likePostAsync === 'function') {
              await window.PPStore.likePostAsync(id);
            }
            showToast('Thank you for voting!', 'success');
          }
        });
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = $("#post-name");
      const msgInput = $("#post-message");
      const tagSelect = $("#post-tag");
      const author = nameInput.value.trim();
      const message = msgInput.value.trim();
      const tag = tagSelect ? tagSelect.value : 'Hostel Hacks';

      if (!author || !message) {
        showToast('Please provide both your name and tip.', 'error');
        return;
      }

      const submitBtn = form.querySelector('button');
      if (submitBtn) submitBtn.disabled = true;

      try {
        let created;
        if (window.PPStore && typeof window.PPStore.createPostAsync === 'function') {
          created = await window.PPStore.createPostAsync(author, message, tag);
        } else {
          created = {
            id: Date.now(),
            author_name: author,
            message,
            tag,
            likes: 0,
            created_at: new Date().toISOString()
          };
          posts.unshift(created);
          window.PPStore.savePosts(posts);
        }
        if (created) {
          posts.unshift(created);
        }
        form.reset();
        render();
        showToast('Tip posted to community database!', 'success');
      } catch (err) {
        showToast('Failed to post tip. Please try again.', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    loadData();
  }

  document.addEventListener('DOMContentLoaded', initNav);

  window.PlatePilot = {
    initCommunity,
    showToast,
    openModal,
    closeModal,
    escapeHTML
  };
})();
