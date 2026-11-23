/**
 * PlatePilot Comprehensive Test Suite
 */
const assert = require('assert');
const http = require('http');
const db = require('./database');
const app = require('./server');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n--- Running PlatePilot Test Suite ---\n');

  console.log('[1] Database & SQLite Schema Tests:');
  it('Initializes SQLite database and tables', () => {
    const rawDb = db.getDatabase();
    assert(rawDb, 'Database instance should exist');
  });

  it('Seeds 24 nutritious student recipes', () => {
    const recipes = db.getAllRecipes();
    assert(recipes.length >= 24, `Expected at least 24 recipes, got ${recipes.length}`);
    const sample = recipes[0];
    assert(sample.name && sample.cost && sample.calories && sample.protein, 'Recipe must have complete macros');
  });

  it('Supports filtering recipes by diet and category', () => {
    const veganRecipes = db.getAllRecipes({ diet: 'vegan' });
    assert(veganRecipes.every(r => r.diet === 'vegan'), 'All filtered recipes must be vegan');

    const breakfastRecipes = db.getAllRecipes({ category: 'Breakfast' });
    assert(breakfastRecipes.every(r => r.category === 'Breakfast'), 'All filtered recipes must be Breakfast');
  });

  it('Performs Recipe CRUD operations', () => {
    // Create
    const created = db.createRecipe({
      name: 'Test Egg Bhurji Roll',
      emoji: '🌯',
      diet: 'non-vegetarian',
      cost: 32,
      calories: 320,
      protein: 18,
      time: 12,
      category: 'Snack',
      ingredients: ['eggs', 'roti', 'onion'],
      description: 'Test recipe item'
    });
    assert(created && created.id, 'Created recipe should have an ID');

    // Read
    const fetched = db.getRecipeById(created.id);
    assert.strictEqual(fetched.name, 'Test Egg Bhurji Roll');

    // Update
    const updated = db.updateRecipe(created.id, { cost: 35 });
    assert.strictEqual(updated.cost, 35);

    // Delete
    const deleted = db.deleteRecipe(created.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(db.getRecipeById(created.id), null);
  });

  console.log('\n[2] Meal Plan & Shopping List Sync Tests:');
  it('Saves meal plan and automatically synchronizes shopping list', () => {
    const testPlan = {
      title: 'Test Week Plan',
      preferences: { budget: 130, diet: 'vegetarian', goal: 'balanced', mealsPerDay: 3 },
      days: [
        {
          day: 'Monday',
          meals: [
            { id: 1, name: 'Moong dal chilla', cost: 25, calories: 220, protein: 14, ingredients: ['moong dal', 'onion'] },
            { id: 7, name: 'Curd rice & cucumber', cost: 28, calories: 350, protein: 11, ingredients: ['rice', 'curd', 'cucumber'] }
          ],
          cost: 53,
          calories: 570,
          protein: 25
        }
      ]
    };

    const saved = db.savePlan(testPlan);
    assert(saved && saved.id, 'Plan should be saved with ID');
    assert.strictEqual(saved.title, 'Test Week Plan');

    // Check shopping list auto-sync
    const shoppingItems = db.getShoppingItems();
    assert(shoppingItems.length > 0, 'Shopping items should be generated from meal ingredients');
    const hasMoongDal = shoppingItems.some(i => i.name.includes('moong dal'));
    assert(hasMoongDal, 'Shopping list must include ingredients from the plan');
  });

  it('Supports custom shopping items and checked state toggling', () => {
    const custom = db.addCustomShoppingItem('almonds', 'Protein & dairy', 40);
    assert(custom && custom.id, 'Custom item should be added');

    const toggled = db.toggleShoppingItem(custom.id, true);
    assert.strictEqual(toggled.checked, 1, 'Item should be marked checked');

    const cleared = db.clearCheckedShoppingItems();
    assert(!cleared.some(i => i.id === custom.id && i.checked), 'Checked custom item should be removed');
  });

  console.log('\n[3] Community Tips & Preferences Tests:');
  it('Stores community tips and tracks likes', () => {
    const post = db.createCommunityPost('Test User', 'Boil potatoes in advance for quick aloo parathas.', 'Hostel Hacks');
    assert(post && post.id, 'Post should be created');
    assert.strictEqual(post.likes, 0);

    const liked = db.likeCommunityPost(post.id);
    assert.strictEqual(liked.likes, 1, 'Post likes should increment to 1');

    db.deleteCommunityPost(post.id);
  });

  it('Saves and retrieves user preferences', () => {
    db.setPreference('budget', '140');
    const prefs = db.getPreferences();
    assert.strictEqual(Number(prefs.budget), 140);
  });

  console.log('\n[4] Express REST API & HTTP Routes Tests:');
  await new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      await itAsync('GET /api/health returns 200 OK and SQLite status', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'ok');
        assert.strictEqual(data.database, 'SQLite');
      });

      await itAsync('GET /api/recipes returns catalogue', async () => {
        const res = await fetch(`${baseUrl}/api/recipes`);
        assert.strictEqual(res.status, 200);
        const list = await res.json();
        assert(Array.isArray(list) && list.length >= 24);
      });

      await itAsync('GET /api/plan returns active plan', async () => {
        const res = await fetch(`${baseUrl}/api/plan`);
        assert.strictEqual(res.status, 200);
        const plan = await res.json();
        assert(plan !== undefined);
      });

      await itAsync('GET /api/shopping returns shopping items', async () => {
        const res = await fetch(`${baseUrl}/api/shopping`);
        assert.strictEqual(res.status, 200);
        const items = await res.json();
        assert(Array.isArray(items));
      });

      await itAsync('GET /api/community returns tips', async () => {
        const res = await fetch(`${baseUrl}/api/community`);
        assert.strictEqual(res.status, 200);
        const posts = await res.json();
        assert(Array.isArray(posts));
      });

      await itAsync('GET / serves index.html', async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('PlatePilot'));
      });

      await itAsync('GET /planner.html serves planner page', async () => {
        const res = await fetch(`${baseUrl}/planner.html`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('planner-form'));
      });

      await itAsync('GET /dashboard.html serves dashboard page', async () => {
        const res = await fetch(`${baseUrl}/dashboard.html`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('dashboard-content'));
      });

      await itAsync('GET /recipes.html serves recipes page', async () => {
        const res = await fetch(`${baseUrl}/recipes.html`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('recipe-grid'));
      });

      await itAsync('GET /shopping.html serves shopping checklist page', async () => {
        const res = await fetch(`${baseUrl}/shopping.html`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('shopping-list'));
      });

      await itAsync('GET /community.html serves community forum page', async () => {
        const res = await fetch(`${baseUrl}/community.html`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert(html.includes('community-posts'));
      });

      server.close();
      resolve();
    });
  });

  console.log(`\nTest Summary: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('❌ Some tests failed.');
  }
}

runTests();
