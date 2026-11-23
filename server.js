const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./database');
const {
  registerSchema,
  loginSchema,
  recipeCreateSchema,
  recipeUpdateSchema,
  mealPlanSchema,
  shoppingItemSchema,
  shoppingToggleSchema,
  communityPostSchema,
  validate
} = require('./validation');
const {
  generateToken,
  requireAuth,
  optionalAuth
} = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Project root must strictly point to the current project directory using __dirname
const ROOT = __dirname;

// Security & Parsing Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT));

// ----------------- HEALTH ENDPOINT -----------------
app.get('/api/health', (_req, res) => {
  try {
    const recipesCount = db.getAllRecipes().length;
    res.json({
      status: 'ok',
      app: 'PlatePilot',
      version: '2.0.0',
      database: 'SQLite (Multi-Tenant)',
      totalRecipes: recipesCount,
      authEnabled: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ----------------- AUTHENTICATION REST API -----------------
app.post('/api/auth/register', validate(registerSchema), (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const user = db.createUser(name, email, passwordHash);
    const token = generateToken(user);

    // Initialize default preferences for new user
    db.setPreference('budget', 120, user.id);
    db.setPreference('diet', 'vegetarian', user.id);
    db.setPreference('goal', 'balanced', user.id);
    db.setPreference('mealsPerDay', 3, user.id);

    res.status(201).json({
      message: 'Registration successful! Welcome to PlatePilot.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user', message: err.message });
  }
});

app.post('/api/auth/login', validate(loginSchema), (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password.'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password.'
      });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login', message: err.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const activePlan = db.getActivePlan(user.id);
    const prefs = db.getPreferences(user.id);
    res.json({
      user,
      hasActivePlan: Boolean(activePlan),
      preferences: prefs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ----------------- RECIPES REST API -----------------
app.get('/api/recipes', optionalAuth, (req, res) => {
  try {
    const { diet, category, search, maxCost, myRecipes } = req.query;
    const userId = req.user ? req.user.id : null;
    const recipes = db.getAllRecipes(
      { diet, category, search, maxCost, myRecipes: myRecipes === 'true' },
      userId
    );
    res.json(recipes);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).json({ error: 'Failed to retrieve recipes' });
  }
});

app.get('/api/recipes/:id', (req, res) => {
  try {
    const recipe = db.getRecipeById(Number(req.params.id));
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recipes', requireAuth, validate(recipeCreateSchema), (req, res) => {
  try {
    const created = db.createRecipe(req.body, req.user.id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.status(500).json({ error: 'Failed to create recipe', message: err.message });
  }
});

app.put('/api/recipes/:id', requireAuth, validate(recipeUpdateSchema), (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.getRecipeById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const updated = db.updateRecipe(id, req.body, req.user.id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.startsWith('Unauthorized')) {
      return res.status(403).json({ error: 'Forbidden', message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recipes/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.getRecipeById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const success = db.deleteRecipe(id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json({ message: 'Recipe deleted successfully' });
  } catch (err) {
    if (err.message && err.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: 'Forbidden', message: err.message });
    }
    if (err.message && err.message.startsWith('Unauthorized')) {
      return res.status(403).json({ error: 'Forbidden', message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ----------------- MEAL PLANS REST API (USER-ISOLATED) -----------------
app.get('/api/plan', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const plan = db.getActivePlan(userId);
    res.json(plan || null);
  } catch (err) {
    console.error('Error fetching plan:', err);
    res.status(500).json({ error: 'Failed to retrieve meal plan' });
  }
});

app.post('/api/plan', optionalAuth, validate(mealPlanSchema), (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { preferences, days, title } = req.body;
    const saved = db.savePlan({ preferences, days, title }, userId);
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error saving plan:', err);
    res.status(500).json({ error: 'Failed to save meal plan', message: err.message });
  }
});

app.delete('/api/plan', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    db.clearPlan(userId);
    res.json({ message: 'Meal plan cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- SHOPPING LIST REST API (USER-ISOLATED) -----------------
app.get('/api/shopping', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const items = db.getShoppingItems(userId);
    res.json(items);
  } catch (err) {
    console.error('Error fetching shopping items:', err);
    res.status(500).json({ error: 'Failed to retrieve shopping list' });
  }
});

app.post('/api/shopping', optionalAuth, validate(shoppingItemSchema), (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { name, category, estimatedCost } = req.body;
    const item = db.addCustomShoppingItem(name, category, estimatedCost, userId);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/shopping/:id', optionalAuth, validate(shoppingToggleSchema), (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user ? req.user.id : null;
    const { checked } = req.body;
    const updated = db.toggleShoppingItem(id, checked, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/shopping/:id', optionalAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user ? req.user.id : null;
    const deleted = db.deleteShoppingItem(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/shopping/clear-checked', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const remaining = db.clearCheckedShoppingItems(userId);
    res.json(remaining);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/shopping', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    db.clearAllShoppingItems(userId);
    res.json({ message: 'All shopping items cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- COMMUNITY POSTS REST API -----------------
app.get('/api/community', (_req, res) => {
  try {
    const posts = db.getAllCommunityPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve community tips' });
  }
});

app.post('/api/community', optionalAuth, validate(communityPostSchema), (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { author_name, message, tag } = req.body;
    const post = db.createCommunityPost(author_name, message, tag, userId);
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/community/:id/like', (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = db.likeCommunityPost(id);
    if (!updated) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/community/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = db.deleteCommunityPost(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- USER PREFERENCES REST API (USER-ISOLATED) -----------------
app.get('/api/preferences', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const prefs = db.getPreferences(userId);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/preferences', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const updated = db.setAllPreferences(req.body, userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- STATIC ROUTING & SPA FALLBACK -----------------
app.get('*', (req, res) => {
  const requested = path.resolve(ROOT, '.' + decodeURIComponent(req.path));

  if (
    requested.startsWith(ROOT + path.sep) &&
    fs.existsSync(requested) &&
    fs.statSync(requested).isFile()
  ) {
    return res.sendFile(requested);
  }

  if (req.path === '/') {
    return res.sendFile(path.join(ROOT, 'index.html'));
  }

  // Handle extension-less HTML routes (e.g. /login -> login.html)
  const htmlAttempt = requested + '.html';
  if (fs.existsSync(htmlAttempt) && fs.statSync(htmlAttempt).isFile()) {
    return res.sendFile(htmlAttempt);
  }

  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[PlatePilot 2.0] Server running at http://localhost:${PORT}`);
    console.log(`[PlatePilot 2.0] Serving files from ROOT: ${ROOT}`);
  });
}

module.exports = app;
