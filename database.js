const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'platepilot.db');

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
    seedInitialData(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  // 1. Users table for multi-tenancy
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Recipes table (with user_id to distinguish seed recipes vs user-created custom recipes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🍲',
      diet TEXT NOT NULL, -- 'vegetarian', 'vegan', 'non-vegetarian'
      cost REAL NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL,
      time INTEGER NOT NULL DEFAULT 15,
      category TEXT NOT NULL DEFAULT 'Lunch', -- 'Breakfast', 'Lunch', 'Dinner', 'Snack'
      ingredients TEXT NOT NULL, -- JSON array of strings
      description TEXT,
      instructions TEXT, -- JSON array of cooking step strings
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // 3. Meal plans table (user-specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT DEFAULT 'My Weekly Plan',
      preferences TEXT NOT NULL, -- JSON string: { budget, diet, goal, mealsPerDay, avoid }
      days_data TEXT NOT NULL, -- JSON array of 7 days with meals and nutrition
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Shopping items table (user-specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      plan_id INTEGER,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      checked INTEGER DEFAULT 0,
      is_custom INTEGER DEFAULT 0,
      quantity TEXT DEFAULT 'for the week',
      estimated_cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL
    );
  `);

  // 5. User preferences table (user-specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 6. Community tips table
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      author_name TEXT NOT NULL,
      message TEXT NOT NULL,
      tag TEXT DEFAULT 'General',
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Safe migration check for existing columns
  safeAddColumn(db, 'recipes', 'user_id', 'INTEGER');
  safeAddColumn(db, 'meal_plans', 'user_id', 'INTEGER');
  safeAddColumn(db, 'shopping_items', 'user_id', 'INTEGER');
  safeAddColumn(db, 'user_preferences', 'user_id', 'INTEGER');
  safeAddColumn(db, 'community_posts', 'user_id', 'INTEGER');
}

function safeAddColumn(db, table, column, type) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    const hasCol = info.some(c => c.name.toLowerCase() === column.toLowerCase());
    if (!hasCol) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    }
  } catch (err) {
    // Ignore if already exists or table busy
  }
}

function seedInitialData(db) {
  // 1. Seed demo student user
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  let defaultUserId = 1;
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('HostelPass123!', salt);
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `);
    const res = insertUser.run('Aarav Sharma', 'student@platepilot.edu', hash);
    defaultUserId = Number(res.lastInsertRowid);
    console.log('[PlatePilot DB] Seeded demo student user (student@platepilot.edu / HostelPass123!)');
  } else {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    defaultUserId = firstUser ? firstUser.id : 1;
  }

  // 2. Seed recipes if empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM recipes').get();
  if (countRow.count === 0) {
    const jsonPath = path.join(__dirname, 'recipes.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const recipes = JSON.parse(raw);
        const insertStmt = db.prepare(`
          INSERT INTO recipes (user_id, name, emoji, diet, cost, calories, protein, time, category, ingredients, description, instructions)
          VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of recipes) {
          const ingJson = JSON.stringify(r.ingredients || []);
          const insJson = JSON.stringify(r.instructions || [
            `Prep the ingredients: ${(r.ingredients || []).join(', ')}.`,
            `Cook according to preference in about ${r.time || 15} minutes.`,
            'Serve hot and enjoy!'
          ]);
          insertStmt.run(
            r.name,
            r.emoji || '🍲',
            r.diet || 'vegetarian',
            Number(r.cost) || 30,
            Number(r.calories) || 300,
            Number(r.protein) || 10,
            Number(r.time) || 15,
            r.category || 'Lunch',
            ingJson,
            r.description || '',
            insJson
          );
        }
        console.log(`[PlatePilot DB] Seeded ${recipes.length} standard recipes into SQLite.`);
      } catch (err) {
        console.error('[PlatePilot DB] Error seeding recipes:', err);
      }
    }
  }

  // 3. Seed community tips if empty
  const postsCount = db.prepare('SELECT COUNT(*) as count FROM community_posts').get();
  if (postsCount.count === 0) {
    const defaultTips = [
      {
        author: 'A fellow hostelite',
        message: 'Batch-cook dal or chickpeas once and use them in different meals through the week. It saves time and reduces cooking gas/electricity.',
        tag: 'Hostel Hacks',
        likes: 5
      },
      {
        author: 'Priya (2nd Year)',
        message: 'Keep roasted peanuts and bananas in your room! It costs under ₹20 and gives you an instant 10g protein snack between lectures.',
        tag: 'Budget Snack',
        likes: 12
      },
      {
        author: 'Arjun (Gym Bro)',
        message: 'Soya chunks are the cheapest protein source in India (~52g protein per 100g). Soak in warm salt water, squeeze thoroughly, and saute with onions.',
        tag: 'High Protein',
        likes: 18
      },
      {
        author: 'Hostel Chef',
        message: 'Buy seasonal vegetables from local weekly sabzi mandis instead of supermarkets. You will cut your grocery bill by at least 40%.',
        tag: 'Smart Shopping',
        likes: 9
      }
    ];

    const insertPost = db.prepare(`
      INSERT INTO community_posts (user_id, author_name, message, tag, likes)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const tip of defaultTips) {
      insertPost.run(defaultUserId, tip.author, tip.message, tip.tag, tip.likes);
    }
  }

  // 4. Seed default preferences for demo user if empty
  const prefCount = db.prepare('SELECT COUNT(*) as count FROM user_preferences').get();
  if (prefCount.count === 0) {
    const insertPref = db.prepare('INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)');
    insertPref.run(defaultUserId, 'budget', '120');
    insertPref.run(defaultUserId, 'diet', 'vegetarian');
    insertPref.run(defaultUserId, 'goal', 'balanced');
    insertPref.run(defaultUserId, 'mealsPerDay', '3');
    insertPref.run(defaultUserId, 'avoid', '');
  }
}

// ================= USER AUTHENTICATION CRUD =================
function createUser(name, email, passwordHash) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `);
  const res = insert.run(name.trim(), email.trim().toLowerCase(), passwordHash);
  return findUserById(res.lastInsertRowid);
}

function findUserByEmail(email) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
}

function findUserById(id) {
  const db = getDatabase();
  const user = db.prepare('SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?').get(id);
  return user || null;
}

// ================= RECIPE CRUD (SYSTEM & USER-OWNED) =================
function getAllRecipes(filter = {}, userId = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM recipes WHERE 1=1';
  const params = [];

  // If userId provided and customOnly flag is true, return only user's custom recipes
  if (filter.myRecipes && userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  if (filter.diet && filter.diet !== 'all') {
    query += ' AND LOWER(diet) = LOWER(?)';
    params.push(filter.diet);
  }
  if (filter.category && filter.category !== 'all') {
    query += ' AND LOWER(category) = LOWER(?)';
    params.push(filter.category);
  }
  if (filter.search) {
    query += ' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(ingredients) LIKE ?)';
    const term = `%${filter.search.toLowerCase()}%`;
    params.push(term, term, term);
  }
  if (filter.maxCost) {
    query += ' AND cost <= ?';
    params.push(Number(filter.maxCost));
  }

  query += ' ORDER BY id ASC';
  const rows = db.prepare(query).all(...params);
  return rows.map(formatRecipeRow);
}

function getRecipeById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  return row ? formatRecipeRow(row) : null;
}

function createRecipe(data, userId = null) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO recipes (user_id, name, emoji, diet, cost, calories, protein, time, category, ingredients, description, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ingredients = Array.isArray(data.ingredients) ? JSON.stringify(data.ingredients) : (data.ingredients || '[]');
  const instructions = Array.isArray(data.instructions) ? JSON.stringify(data.instructions) : (data.instructions || '[]');

  const result = insert.run(
    userId,
    data.name,
    data.emoji || '🍲',
    data.diet || 'vegetarian',
    Number(data.cost) || 30,
    Number(data.calories) || 300,
    Number(data.protein) || 10,
    Number(data.time) || 15,
    data.category || 'Lunch',
    ingredients,
    data.description || '',
    instructions
  );
  return getRecipeById(result.lastInsertRowid);
}

function updateRecipe(id, data, userId = null) {
  const db = getDatabase();
  const existing = getRecipeById(id);
  if (!existing) return null;

  // Authorization check: User can only update their own recipe (or admin if no userId)
  if (existing.user_id !== null && userId !== null && Number(existing.user_id) !== Number(userId)) {
    throw new Error('Unauthorized: You can only edit recipes you created');
  }

  const name = data.name !== undefined ? data.name : existing.name;
  const emoji = data.emoji !== undefined ? data.emoji : existing.emoji;
  const diet = data.diet !== undefined ? data.diet : existing.diet;
  const cost = data.cost !== undefined ? Number(data.cost) : existing.cost;
  const calories = data.calories !== undefined ? Number(data.calories) : existing.calories;
  const protein = data.protein !== undefined ? Number(data.protein) : existing.protein;
  const time = data.time !== undefined ? Number(data.time) : existing.time;
  const category = data.category !== undefined ? data.category : existing.category;
  const ingredients = data.ingredients !== undefined
    ? (Array.isArray(data.ingredients) ? JSON.stringify(data.ingredients) : data.ingredients)
    : JSON.stringify(existing.ingredients);
  const description = data.description !== undefined ? data.description : existing.description;
  const instructions = data.instructions !== undefined
    ? (Array.isArray(data.instructions) ? JSON.stringify(data.instructions) : data.instructions)
    : JSON.stringify(existing.instructions || []);

  db.prepare(`
    UPDATE recipes
    SET name = ?, emoji = ?, diet = ?, cost = ?, calories = ?, protein = ?, time = ?, category = ?, ingredients = ?, description = ?, instructions = ?
    WHERE id = ?
  `).run(name, emoji, diet, cost, calories, protein, time, category, ingredients, description, instructions, id);

  return getRecipeById(id);
}

function deleteRecipe(id, userId = null) {
  const db = getDatabase();
  const existing = getRecipeById(id);
  if (!existing) return false;

  // Protect system/seed recipes (user_id IS NULL)
  if (existing.user_id === null && userId !== null) {
    throw new Error('Forbidden: Cannot delete standard built-in recipes');
  }

  // Authorization check: User can only delete their own recipe
  if (existing.user_id !== null && userId !== null && Number(existing.user_id) !== Number(userId)) {
    throw new Error('Unauthorized: You can only delete recipes you created');
  }

  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return result.changes > 0;
}

function formatRecipeRow(row) {
  let ingredients = [];
  try {
    ingredients = JSON.parse(row.ingredients);
  } catch {
    ingredients = row.ingredients ? [row.ingredients] : [];
  }

  let instructions = [];
  try {
    instructions = JSON.parse(row.instructions);
  } catch {
    instructions = row.instructions ? [row.instructions] : [];
  }

  return {
    ...row,
    ingredients,
    instructions,
    isCustom: row.user_id !== null
  };
}

// ================= MEAL PLAN CRUD (USER-SPECIFIC) =================
function getActivePlan(userId = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM meal_plans WHERE is_active = 1';
  const params = [];

  if (userId !== null && userId !== undefined) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY updated_at DESC LIMIT 1';
  const row = db.prepare(query).get(...params);
  if (!row) return null;
  try {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      preferences: JSON.parse(row.preferences),
      days: JSON.parse(row.days_data),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (err) {
    console.error('[PlatePilot DB] Error parsing meal plan JSON:', err);
    return null;
  }
}

function savePlan(planData, userId = null) {
  const db = getDatabase();
  const preferencesJson = JSON.stringify(planData.preferences || {});
  const daysJson = JSON.stringify(planData.days || []);
  const title = planData.title || 'My Weekly Plan';

  // Deactivate older plans for this user (or global if userId is null)
  if (userId) {
    db.prepare('UPDATE meal_plans SET is_active = 0 WHERE user_id = ?').run(userId);
  } else {
    db.prepare('UPDATE meal_plans SET is_active = 0 WHERE user_id IS NULL').run();
  }

  const insert = db.prepare(`
    INSERT INTO meal_plans (user_id, title, preferences, days_data, is_active, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `);
  const result = insert.run(userId, title, preferencesJson, daysJson);
  const planId = Number(result.lastInsertRowid);

  // Auto-generate shopping list items for this user
  syncShoppingListFromPlan(db, planId, planData.days || [], userId);

  return getActivePlan(userId);
}

function clearPlan(userId = null) {
  const db = getDatabase();
  if (userId) {
    db.prepare('UPDATE meal_plans SET is_active = 0 WHERE user_id = ?').run(userId);
  } else {
    db.prepare('UPDATE meal_plans SET is_active = 0').run();
  }
  return true;
}

// ================= SHOPPING LIST CRUD (USER-SPECIFIC) =================
function syncShoppingListFromPlan(db, planId, days, userId = null) {
  // Remove previous auto-generated items for this user
  if (userId) {
    db.prepare('DELETE FROM shopping_items WHERE is_custom = 0 AND user_id = ?').run(userId);
  } else {
    db.prepare('DELETE FROM shopping_items WHERE is_custom = 0 AND user_id IS NULL').run();
  }

  const ingredientCounts = {};
  for (const day of days) {
    for (const meal of day.meals || []) {
      for (const ing of meal.ingredients || []) {
        const clean = ing.trim().toLowerCase();
        ingredientCounts[clean] = (ingredientCounts[clean] || 0) + 1;
      }
    }
  }

  const categoryMap = {
    'Grains & pulses': ['rice', 'poha', 'moong dal', 'rajma', 'chickpeas', 'roti', 'bread', 'oats', 'besan', 'sooji', 'flour', 'atta', 'dalia', 'toor dal'],
    'Protein & dairy': ['paneer', 'curd', 'soya chunks', 'soya granules', 'eggs', 'chicken', 'peanuts', 'milk', 'tofu', 'cheese', 'peanut butter'],
    'Vegetables & fruit': ['onion', 'tomato', 'cucumber', 'peas', 'seasonal vegetables', 'seasonal fruit', 'banana', 'potato', 'spinach', 'capsicum', 'carrot', 'beans', 'ginger', 'garlic'],
    'Other': ['lemon', 'coriander', 'curry leaves', 'spices', 'roasted seeds', 'oil', 'mustard seeds', 'cumin', 'honey', 'butter', 'chaat masala']
  };

  const insertStmt = db.prepare(`
    INSERT INTO shopping_items (user_id, plan_id, name, category, checked, is_custom, quantity, estimated_cost)
    VALUES (?, ?, ?, ?, 0, 0, ?, ?)
  `);

  for (const [name, count] of Object.entries(ingredientCounts)) {
    let matchedCategory = 'Other';
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => name.includes(k))) {
        matchedCategory = cat;
        break;
      }
    }
    const qtyText = count > 1 ? `x${count} recipes` : 'for the week';
    insertStmt.run(userId, planId, name, matchedCategory, qtyText, 0);
  }
}

function getShoppingItems(userId = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM shopping_items WHERE 1=1';
  const params = [];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  } else {
    query += ' AND user_id IS NULL';
  }

  query += ' ORDER BY is_custom ASC, category ASC, name ASC';
  const rows = db.prepare(query).all(...params);
  return rows.map(r => ({
    ...r,
    checked: Boolean(r.checked),
    is_custom: Boolean(r.is_custom)
  }));
}

function addCustomShoppingItem(name, category = 'Other', estimatedCost = 0, userId = null) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO shopping_items (user_id, name, category, checked, is_custom, quantity, estimated_cost)
    VALUES (?, ?, ?, 0, 1, 'Custom item', ?)
  `);
  const result = insert.run(userId, name.trim().toLowerCase(), category, Number(estimatedCost) || 0);
  return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(result.lastInsertRowid);
}

function toggleShoppingItem(id, checked, userId = null) {
  const db = getDatabase();
  let query = 'UPDATE shopping_items SET checked = ? WHERE id = ?';
  const params = [checked ? 1 : 0, id];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  db.prepare(query).run(...params);
  return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
}

function deleteShoppingItem(id, userId = null) {
  const db = getDatabase();
  let query = 'DELETE FROM shopping_items WHERE id = ?';
  const params = [id];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const res = db.prepare(query).run(...params);
  return res.changes > 0;
}

function clearCheckedShoppingItems(userId = null) {
  const db = getDatabase();
  if (userId) {
    db.prepare('DELETE FROM shopping_items WHERE checked = 1 AND is_custom = 1 AND user_id = ?').run(userId);
    db.prepare('UPDATE shopping_items SET checked = 0 WHERE checked = 1 AND is_custom = 0 AND user_id = ?').run(userId);
  } else {
    db.prepare('DELETE FROM shopping_items WHERE checked = 1 AND is_custom = 1 AND user_id IS NULL').run();
    db.prepare('UPDATE shopping_items SET checked = 0 WHERE checked = 1 AND is_custom = 0 AND user_id IS NULL').run();
  }
  return getShoppingItems(userId);
}

function clearAllShoppingItems(userId = null) {
  const db = getDatabase();
  if (userId) {
    db.prepare('DELETE FROM shopping_items WHERE user_id = ?').run(userId);
  } else {
    db.prepare('DELETE FROM shopping_items WHERE user_id IS NULL').run();
  }
  return [];
}

// ================= COMMUNITY POSTS CRUD =================
function getAllCommunityPosts() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM community_posts ORDER BY likes DESC, id DESC').all();
}

function createCommunityPost(author, message, tag = 'General', userId = null) {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO community_posts (user_id, author_name, message, tag, likes)
    VALUES (?, ?, ?, ?, 0)
  `);
  const result = insert.run(userId, author.trim(), message.trim(), tag || 'General');
  return db.prepare('SELECT * FROM community_posts WHERE id = ?').get(result.lastInsertRowid);
}

function likeCommunityPost(id) {
  const db = getDatabase();
  db.prepare('UPDATE community_posts SET likes = likes + 1 WHERE id = ?').run(id);
  return db.prepare('SELECT * FROM community_posts WHERE id = ?').get(id);
}

function deleteCommunityPost(id, userId = null) {
  const db = getDatabase();
  let query = 'DELETE FROM community_posts WHERE id = ?';
  const params = [id];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const res = db.prepare(query).run(...params);
  return res.changes > 0;
}

// ================= USER PREFERENCES (USER-SPECIFIC) =================
function getPreferences(userId = null) {
  const db = getDatabase();
  let query = 'SELECT key, value FROM user_preferences WHERE ';
  const params = [];

  if (userId) {
    query += 'user_id = ?';
    params.push(userId);
  } else {
    query += 'user_id IS NULL';
  }

  const rows = db.prepare(query).all(...params);
  const result = {};
  for (const r of rows) {
    try {
      result[r.key] = JSON.parse(r.value);
    } catch {
      result[r.key] = r.value;
    }
  }
  return result;
}

function setPreference(key, value, userId = null) {
  const db = getDatabase();
  const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // Check if preference exists
  let checkQuery = 'SELECT id FROM user_preferences WHERE key = ? AND ';
  const checkParams = [key];
  if (userId) {
    checkQuery += 'user_id = ?';
    checkParams.push(userId);
  } else {
    checkQuery += 'user_id IS NULL';
  }

  const existing = db.prepare(checkQuery).get(...checkParams);

  if (existing) {
    db.prepare('UPDATE user_preferences SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(valStr, existing.id);
  } else {
    db.prepare('INSERT INTO user_preferences (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run(userId, key, valStr);
  }

  return getPreferences(userId);
}

function setAllPreferences(prefObj, userId = null) {
  for (const [key, val] of Object.entries(prefObj)) {
    setPreference(key, val, userId);
  }
  return getPreferences(userId);
}

module.exports = {
  getDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getActivePlan,
  savePlan,
  clearPlan,
  getShoppingItems,
  addCustomShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCheckedShoppingItems,
  clearAllShoppingItems,
  getAllCommunityPosts,
  createCommunityPost,
  likeCommunityPost,
  deleteCommunityPost,
  getPreferences,
  setPreference,
  setAllPreferences
};
