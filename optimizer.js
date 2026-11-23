/**
 * PlatePilot Meal Optimizer
 * Generates balanced, budget-aware 7-day meal plans with category-aware meal slots (Breakfast, Lunch, Dinner, Snack).
 */
(function() {
  // Built-in fallback catalog if recipes haven't loaded yet
  const DEFAULT_RECIPES = [
    { id: 1, name: "Moong dal chilla", emoji: "🥞", diet: "vegan", cost: 25, calories: 220, protein: 14, category: "Breakfast", ingredients: ["moong dal", "onion", "tomato"] },
    { id: 2, name: "Peanut poha", emoji: "🍚", diet: "vegan", cost: 22, calories: 310, protein: 8, category: "Breakfast", ingredients: ["poha", "peanuts", "onion"] },
    { id: 3, name: "Rajma rice bowl", emoji: "🍛", diet: "vegan", cost: 42, calories: 480, protein: 18, category: "Lunch", ingredients: ["rajma", "rice", "tomato"] },
    { id: 4, name: "Paneer bhurji roti", emoji: "🫓", diet: "vegetarian", cost: 48, calories: 430, protein: 25, category: "Dinner", ingredients: ["paneer", "roti", "onion"] },
    { id: 5, name: "Chana salad bowl", emoji: "🥗", diet: "vegan", cost: 30, calories: 290, protein: 13, category: "Lunch", ingredients: ["chickpeas", "cucumber", "tomato"] },
    { id: 6, name: "Egg bhurji with roti", emoji: "🍳", diet: "non-vegetarian", cost: 38, calories: 390, protein: 22, category: "Dinner", ingredients: ["eggs", "onion", "tomato", "roti"] },
    { id: 7, name: "Curd rice & cucumber", emoji: "🥣", diet: "vegetarian", cost: 28, calories: 350, protein: 11, category: "Lunch", ingredients: ["rice", "curd", "cucumber"] },
    { id: 8, name: "Soya pulao", emoji: "🍲", diet: "vegan", cost: 35, calories: 410, protein: 23, category: "Dinner", ingredients: ["soya chunks", "rice", "peas"] },
    { id: 9, name: "Banana curd bowl", emoji: "🍌", diet: "vegetarian", cost: 20, calories: 230, protein: 9, category: "Snack", ingredients: ["banana", "curd"] },
    { id: 10, name: "Chicken rice plate", emoji: "🍗", diet: "non-vegetarian", cost: 65, calories: 520, protein: 34, category: "Lunch", ingredients: ["chicken", "rice", "onion"] },
    { id: 11, name: "Boiled eggs & toast", emoji: "🥚", diet: "non-vegetarian", cost: 28, calories: 280, protein: 16, category: "Breakfast", ingredients: ["eggs", "bread"] },
    { id: 12, name: "Dal tadka with jeera rice", emoji: "🍲", diet: "vegan", cost: 36, calories: 460, protein: 16, category: "Dinner", ingredients: ["toor dal", "rice", "cumin"] },
    { id: 13, name: "Oats & peanut butter porridge", emoji: "🥣", diet: "vegetarian", cost: 26, calories: 340, protein: 14, category: "Breakfast", ingredients: ["oats", "milk", "peanut butter"] },
    { id: 14, name: "Besan chilla roll", emoji: "🌯", diet: "vegan", cost: 24, calories: 250, protein: 12, category: "Breakfast", ingredients: ["besan", "onion", "tomato"] },
    { id: 15, name: "Palak paneer with roti", emoji: "🥬", diet: "vegetarian", cost: 52, calories: 440, protein: 24, category: "Dinner", ingredients: ["spinach", "paneer", "roti"] },
    { id: 16, name: "Egg sandwich", emoji: "🥪", diet: "non-vegetarian", cost: 32, calories: 330, protein: 17, category: "Snack", ingredients: ["eggs", "bread"] },
    { id: 17, name: "Masala khichdi", emoji: "🍲", diet: "vegan", cost: 30, calories: 380, protein: 14, category: "Dinner", ingredients: ["rice", "moong dal"] },
    { id: 18, name: "Roasted peanut chaat", emoji: "🥜", diet: "vegan", cost: 18, calories: 260, protein: 11, category: "Snack", ingredients: ["peanuts", "onion", "lemon"] },
    { id: 19, name: "Aloo paratha with curd", emoji: "🫓", diet: "vegetarian", cost: 34, calories: 420, protein: 12, category: "Breakfast", ingredients: ["atta", "potato", "curd"] },
    { id: 20, name: "Chicken egg fried rice", emoji: "🍚", diet: "non-vegetarian", cost: 68, calories: 540, protein: 36, category: "Dinner", ingredients: ["chicken", "eggs", "rice"] },
    { id: 21, name: "Sprouts chaat bowl", emoji: "🌱", diet: "vegan", cost: 22, calories: 210, protein: 14, category: "Snack", ingredients: ["sprouted moong", "cucumber"] },
    { id: 22, name: "Soya bhurji roti", emoji: "🫓", diet: "vegan", cost: 28, calories: 360, protein: 26, category: "Dinner", ingredients: ["soya granules", "roti"] },
    { id: 23, name: "Egg curry with rice", emoji: "🍛", diet: "non-vegetarian", cost: 45, calories: 450, protein: 21, category: "Dinner", ingredients: ["eggs", "rice"] },
    { id: 24, name: "Seasonal fruit & roasted seeds", emoji: "🍎", diet: "vegan", cost: 18, calories: 140, protein: 4, category: "Snack", ingredients: ["seasonal fruit", "roasted seeds"] }
  ];

  let cachedPool = [...DEFAULT_RECIPES];

  // Load recipes from server or local file
  async function loadRecipePool() {
    try {
      if (window.PPStore && typeof window.PPStore.getRecipes === 'function') {
        const list = await window.PPStore.getRecipes();
        if (Array.isArray(list) && list.length > 0) {
          cachedPool = list;
          return cachedPool;
        }
      }
      const res = await fetch('recipes.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          cachedPool = json;
        }
      }
    } catch {
      // Keep DEFAULT_RECIPES
    }
    return cachedPool;
  }

  // Preload pool on script init
  loadRecipePool();

  function isDietCompatible(recipeDiet, userDiet) {
    if (userDiet === 'vegan') return recipeDiet === 'vegan';
    if (userDiet === 'vegetarian') return recipeDiet === 'vegetarian' || recipeDiet === 'vegan';
    // Non-vegetarian includes all diets
    return true;
  }

  function scoreMeal(meal, goal, remainingBudget, targetMealCost) {
    let score = 100;

    // Budget fit penalty
    const diff = Math.abs(meal.cost - targetMealCost);
    score -= (diff / targetMealCost) * 20;

    if (meal.cost > remainingBudget) {
      score -= 50; // Heavy penalty if over daily remaining budget
    }

    if (goal === 'muscle') {
      // Prioritize high protein-to-cost ratio and high absolute protein
      const proteinPerRupee = meal.protein / Math.max(meal.cost, 1);
      score += proteinPerRupee * 60 + meal.protein * 1.5;
    } else if (goal === 'weight') {
      // Prioritize moderate calories with high protein density
      score += (meal.protein / Math.max(meal.calories, 1)) * 300;
      if (meal.calories > 450) score -= 25;
    } else {
      // Balanced: standard distribution
      score += (meal.protein * 0.8) - Math.abs(meal.calories - 380) * 0.05;
    }

    return score;
  }

  function generate({
    budget = 120,
    diet = "vegetarian",
    goal = "balanced",
    mealsPerDay = 3,
    avoid = "",
    customPool = null
  } = {}) {
    const pool = customPool && customPool.length ? customPool : cachedPool;
    const dailyBudget = Math.max(60, Number(budget) || 120);
    const count = Math.min(4, Math.max(3, Number(mealsPerDay) || 3));
    const blockedKeywords = avoid
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // Filter by diet and allergy/avoidance
    let candidates = pool.filter(recipe => {
      if (!isDietCompatible(recipe.diet, diet)) return false;
      if (blockedKeywords.length > 0) {
        const ingredients = (recipe.ingredients || []).map(i => i.toLowerCase());
        const hasBlocked = ingredients.some(ing => blockedKeywords.some(b => ing.includes(b)));
        if (hasBlocked) return false;
        if (blockedKeywords.some(b => recipe.name.toLowerCase().includes(b))) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      // Fallback: relax allergy filter if impossible, but keep diet
      candidates = pool.filter(recipe => isDietCompatible(recipe.diet, diet));
      if (candidates.length === 0) candidates = pool;
    }

    // Determine slot types for each day
    // 3 meals: Breakfast, Lunch, Dinner
    // 4 meals: Breakfast, Lunch, Snack, Dinner
    const slotNames = count === 4
      ? ['Breakfast', 'Lunch', 'Snack', 'Dinner']
      : ['Breakfast', 'Lunch', 'Dinner'];

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const weeklyPlan = [];
    const usedRecipeCounts = {};

    daysOfWeek.forEach((day, dayIndex) => {
      let remainingDailyBudget = dailyBudget;
      const dayMeals = [];

      slotNames.forEach((slot, slotIndex) => {
        const mealsLeftToPick = count - slotIndex;
        const targetCostForSlot = remainingDailyBudget / mealsLeftToPick;

        // Find recipes matching this category
        let slotCandidates = candidates.filter(r => r.category.toLowerCase() === slot.toLowerCase());
        if (slotCandidates.length === 0) {
          // If no recipe for exact category, take any suitable candidate
          slotCandidates = candidates;
        }

        // Rank candidates by heuristic score with penalty for recent repeats
        const ranked = slotCandidates.map(meal => {
          let score = scoreMeal(meal, goal, remainingDailyBudget, targetCostForSlot);
          const timesUsed = usedRecipeCounts[meal.id] || 0;
          score -= timesUsed * 18; // Variety boost: discourage repeating same meal too frequently

          // If meal was already picked today, heavy penalty
          if (dayMeals.some(m => m.id === meal.id)) {
            score -= 80;
          }

          return { meal, score };
        }).sort((a, b) => b.score - a.score);

        // Select best meal
        const selected = (ranked[0] && ranked[0].meal) || candidates[0];
        dayMeals.push({
          ...selected,
          slotName: slot
        });

        usedRecipeCounts[selected.id] = (usedRecipeCounts[selected.id] || 0) + 1;
        remainingDailyBudget -= selected.cost;
      });

      const dayCost = dayMeals.reduce((sum, m) => sum + m.cost, 0);
      const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
      const dayProtein = Math.round(dayMeals.reduce((sum, m) => sum + m.protein, 0) * 10) / 10;

      weeklyPlan.push({
        day,
        meals: dayMeals,
        cost: Math.round(dayCost),
        calories: dayCalories,
        protein: dayProtein
      });
    });

    return {
      preferences: {
        budget: dailyBudget,
        diet,
        goal,
        mealsPerDay: count,
        avoid
      },
      days: weeklyPlan,
      createdAt: new Date().toISOString()
    };
  }

  // Swap an individual meal in an existing plan
  function swapMeal(plan, dayIndex, mealIndex) {
    if (!plan || !plan.days || !plan.days[dayIndex] || !plan.days[dayIndex].meals[mealIndex]) {
      return plan;
    }

    const currentMeal = plan.days[dayIndex].meals[mealIndex];
    const userDiet = plan.preferences.diet || 'vegetarian';
    const category = currentMeal.category || currentMeal.slotName || 'Lunch';

    // Find alternative recipes matching diet and category
    let alternatives = cachedPool.filter(r =>
      r.id !== currentMeal.id &&
      isDietCompatible(r.diet, userDiet) &&
      r.category.toLowerCase() === category.toLowerCase()
    );

    if (alternatives.length === 0) {
      alternatives = cachedPool.filter(r => r.id !== currentMeal.id && isDietCompatible(r.diet, userDiet));
    }

    if (alternatives.length > 0) {
      // Pick next alternative
      const nextMeal = alternatives[Math.floor(Math.random() * alternatives.length)];
      plan.days[dayIndex].meals[mealIndex] = {
        ...nextMeal,
        slotName: currentMeal.slotName || category
      };

      // Recalculate day totals
      const meals = plan.days[dayIndex].meals;
      plan.days[dayIndex].cost = Math.round(meals.reduce((sum, m) => sum + m.cost, 0));
      plan.days[dayIndex].calories = meals.reduce((sum, m) => sum + m.calories, 0);
      plan.days[dayIndex].protein = Math.round(meals.reduce((sum, m) => sum + m.protein, 0) * 10) / 10;
    }

    return plan;
  }

  window.PPOptimizer = {
    generate,
    swapMeal,
    loadRecipePool,
    getPool: () => cachedPool
  };
})();
