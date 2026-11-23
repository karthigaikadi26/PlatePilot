/**
 * PlatePilot Storage Layer
 * Hybrid SQLite REST API client with automatic JWT authorization, LocalStorage caching, and offline fallback.
 */
(function() {
  const KEYS = {
    plan: "platepilot_plan",
    posts: "platepilot_posts",
    checks: "platepilot_checks",
    custom: "platepilot_custom_items",
    prefs: "platepilot_preferences"
  };

  const readLocal = (key, fallback) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[PPStore] LocalStorage write failed:', e);
    }
  };

  // Safe fetch helper with timeout and JWT auth header
  async function apiFetch(url, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      // Attach JWT token if user is authenticated
      const token = (window.PlatePilotAuth && typeof window.PlatePilotAuth.getToken === 'function')
        ? window.PlatePilotAuth.getToken()
        : localStorage.getItem('platepilot_token');

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      // Offline or network error
      return null;
    }
  }

  const PPStore = {
    // ---------------- MEAL PLAN ----------------
    getPlan() {
      return readLocal(KEYS.plan, null);
    },

    savePlan(plan) {
      writeLocal(KEYS.plan, plan);
      // Asynchronously sync to SQLite backend
      apiFetch('/api/plan', {
        method: 'POST',
        body: JSON.stringify(plan)
      }).then(serverPlan => {
        if (serverPlan) {
          writeLocal(KEYS.plan, serverPlan);
        }
      });
      return plan;
    },

    async getPlanAsync() {
      const serverPlan = await apiFetch('/api/plan');
      if (serverPlan) {
        writeLocal(KEYS.plan, serverPlan);
        return serverPlan;
      }
      return this.getPlan();
    },

    async savePlanAsync(plan) {
      writeLocal(KEYS.plan, plan);
      const serverPlan = await apiFetch('/api/plan', {
        method: 'POST',
        body: JSON.stringify(plan)
      });
      if (serverPlan) {
        writeLocal(KEYS.plan, serverPlan);
        return serverPlan;
      }
      return plan;
    },

    async clearPlanAsync() {
      localStorage.removeItem(KEYS.plan);
      await apiFetch('/api/plan', { method: 'DELETE' });
    },

    // ---------------- RECIPES ----------------
    async getRecipes(filter = {}) {
      const params = new URLSearchParams();
      if (filter.diet && filter.diet !== 'all') params.set('diet', filter.diet);
      if (filter.category && filter.category !== 'all') params.set('category', filter.category);
      if (filter.search) params.set('search', filter.search);
      if (filter.maxCost) params.set('maxCost', filter.maxCost);
      if (filter.myRecipes) params.set('myRecipes', 'true');

      const qs = params.toString() ? `?${params.toString()}` : '';
      const serverRecipes = await apiFetch(`/api/recipes${qs}`);
      if (Array.isArray(serverRecipes) && serverRecipes.length > 0) {
        return serverRecipes;
      }

      // Fallback: try recipes.json
      try {
        const localRes = await fetch('recipes.json');
        if (localRes.ok) {
          const jsonRecipes = await localRes.json();
          return jsonRecipes;
        }
      } catch (e) {
        console.warn('Fallback to recipes.json failed', e);
      }
      return [];
    },

    async createRecipeAsync(recipeData) {
      return await apiFetch('/api/recipes', {
        method: 'POST',
        body: JSON.stringify(recipeData)
      });
    },

    async updateRecipeAsync(id, recipeData) {
      return await apiFetch(`/api/recipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(recipeData)
      });
    },

    async deleteRecipeAsync(id) {
      return await apiFetch(`/api/recipes/${id}`, {
        method: 'DELETE'
      });
    },

    // ---------------- SHOPPING LIST ----------------
    getChecks() {
      return readLocal(KEYS.checks, []);
    },

    saveChecks(items) {
      writeLocal(KEYS.checks, items);
      return items;
    },

    getCustom() {
      return readLocal(KEYS.custom, []);
    },

    saveCustom(items) {
      writeLocal(KEYS.custom, items);
      return items;
    },

    async getShoppingItemsAsync() {
      const items = await apiFetch('/api/shopping');
      if (Array.isArray(items)) {
        return items;
      }
      return null;
    },

    async toggleShoppingItemAsync(id, checked) {
      return await apiFetch(`/api/shopping/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ checked })
      });
    },

    async addCustomShoppingItemAsync(name, category = 'Other', estimatedCost = 0) {
      const result = await apiFetch('/api/shopping', {
        method: 'POST',
        body: JSON.stringify({ name, category, estimatedCost })
      });
      // Also update local cache
      const custom = this.getCustom();
      custom.push({ name: name.trim().toLowerCase(), category, estimatedCost });
      writeLocal(KEYS.custom, custom);
      return result;
    },

    async clearCheckedShoppingAsync() {
      const res = await apiFetch('/api/shopping/clear-checked', { method: 'POST' });
      writeLocal(KEYS.checks, []);
      return res;
    },

    // ---------------- COMMUNITY POSTS ----------------
    getPosts() {
      return readLocal(KEYS.posts, []);
    },

    savePosts(posts) {
      writeLocal(KEYS.posts, posts);
      return posts;
    },

    async getPostsAsync() {
      const posts = await apiFetch('/api/community');
      if (Array.isArray(posts) && posts.length > 0) {
        writeLocal(KEYS.posts, posts);
        return posts;
      }
      return this.getPosts();
    },

    async createPostAsync(author, message, tag = 'General') {
      const newPost = await apiFetch('/api/community', {
        method: 'POST',
        body: JSON.stringify({ author_name: author, message, tag })
      });

      const current = this.getPosts();
      const localPost = newPost || {
        id: Date.now(),
        author_name: author,
        message,
        tag,
        likes: 0,
        created_at: new Date().toISOString()
      };
      current.unshift(localPost);
      writeLocal(KEYS.posts, current);
      return localPost;
    },

    async likePostAsync(id) {
      const updated = await apiFetch(`/api/community/${id}/like`, { method: 'POST' });
      const current = this.getPosts();
      const post = current.find(p => p.id === id);
      if (post) {
        post.likes = (post.likes || 0) + 1;
        writeLocal(KEYS.posts, current);
      }
      return updated;
    },

    // ---------------- PREFERENCES ----------------
    getPreferences() {
      return readLocal(KEYS.prefs, {
        budget: 120,
        diet: 'vegetarian',
        goal: 'balanced',
        mealsPerDay: 3,
        avoid: ''
      });
    },

    async getPreferencesAsync() {
      const serverPrefs = await apiFetch('/api/preferences');
      if (serverPrefs && Object.keys(serverPrefs).length > 0) {
        writeLocal(KEYS.prefs, serverPrefs);
        return serverPrefs;
      }
      return this.getPreferences();
    },

    async savePreferencesAsync(prefs) {
      writeLocal(KEYS.prefs, prefs);
      return await apiFetch('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(prefs)
      });
    },

    clear() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    }
  };

  // Synchronize on script execution
  PPStore.getPlanAsync();

  window.PPStore = PPStore;
})();
