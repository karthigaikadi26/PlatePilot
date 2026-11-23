/**
 * PlatePilot Nutrition & Spend Dashboard Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("#dashboard-content");
  if (!host) return;

  let plan = null;
  try {
    plan = await PPStore.getPlanAsync();
  } catch {
    plan = PPStore.getPlan();
  }

  if (!plan || !plan.days || plan.days.length === 0) {
    host.innerHTML = `
      <div class="empty-state panel">
        <span>📊</span>
        <h3>No saved plan yet</h3>
        <p>Create a weekly plan to see your nutrition, calorie distribution, and budget analytics.</p>
        <a class="button" href="planner.html">Create a meal plan →</a>
      </div>
    `;
    return;
  }

  const days = plan.days;
  const targetBudget = Number(plan.preferences.budget) || 120;
  const userGoal = plan.preferences.goal || 'balanced';
  const userDiet = plan.preferences.diet || 'vegetarian';

  const totalWeeklyCost = days.reduce((s, d) => s + d.cost, 0);
  const avgCost = Math.round(totalWeeklyCost / days.length);
  const totalWeeklyCalories = days.reduce((s, d) => s + d.calories, 0);
  const avgCalories = Math.round(totalWeeklyCalories / days.length);
  const totalWeeklyProtein = Math.round(days.reduce((s, d) => s + d.protein, 0) * 10) / 10;
  const avgProtein = Math.round(totalWeeklyProtein / days.length);

  // Commercial canteen comparison (estimated ₹300/day for eating out)
  const canteenWeeklySpend = targetBudget > 200 ? 7 * 350 : 7 * 280;
  const weeklySavings = Math.max(0, canteenWeeklySpend - totalWeeklyCost);

  // Maximum values for scaling bars
  const maxCalories = Math.max(...days.map(d => d.calories), 1800);
  const maxCost = Math.max(...days.map(d => d.cost), targetBudget * 1.2);

  // Goal description helper
  const goalTitles = {
    muscle: 'Muscle Building & High Protein',
    weight: 'Weight Management & Calorie Control',
    balanced: 'Balanced Energy & Wellness'
  };

  const goalDescriptions = {
    muscle: 'Optimized for high protein-to-cost ratio to support recovery and lean muscle growth on a student budget.',
    weight: 'Focused on nutrient-dense, high-fibre meals with moderate calories to keep you energized and satisfied.',
    balanced: 'Well-rounded distribution of complex carbs, clean protein, and healthy micronutrients for busy academic days.'
  };

  host.innerHTML = `
    <!-- Top KPI Summary Cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <span>Average daily spend</span>
        <b>₹${avgCost}</b>
        <small style="font-size:10px;color:${avgCost <= targetBudget ? '#236b4d' : '#e99b59'}">
          ${avgCost <= targetBudget ? '✓ Within daily budget' : '⚠ Slightly above target'}
        </small>
      </div>
      <div class="summary-card">
        <span>Daily protein intake</span>
        <b>${avgProtein}g</b>
        <small style="font-size:10px;color:#236b4d">~${Math.round((avgProtein / 65) * 100)}% of student RDA</small>
      </div>
      <div class="summary-card">
        <span>Weekly total spend</span>
        <b>₹${totalWeeklyCost}</b>
        <small style="font-size:10px;color:#236b4d">Est. ₹${weeklySavings} saved vs dining out</small>
      </div>
    </div>

    <!-- Calorie & Protein Visual Analytics Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:20px">
      <!-- Calorie Distribution Chart -->
      <div class="panel">
        <div class="results-head">
          <div>
            <span class="eyebrow">WEEKLY ENERGY INTAKE</span>
            <h2 style="font-size:18px">Daily Calories (kcal)</h2>
          </div>
          <span class="tag tag-green">Avg ${avgCalories} kcal</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;align-items:end;height:180px;padding-top:15px;border-bottom:1px solid #e5eae3">
          ${days.map(d => {
            const height = Math.max(20, Math.round((d.calories / maxCalories) * 140));
            return `
              <div style="text-align:center;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end">
                <span style="font-size:9px;font-weight:700;color:#236b4d;margin-bottom:4px">${d.calories}</span>
                <div title="${d.day}: ${d.calories} kcal" style="width:75%;height:${height}px;background:linear-gradient(180deg,#86b86c,#236b4d);border-radius:6px 6px 2px 2px;transition:0.3s"></div>
                <small style="font-size:10px;color:#718078;margin-top:6px;font-weight:600">${d.day.slice(0, 3)}</small>
              </div>
            `;
          }).join("")}
        </div>
        <p class="form-note" style="margin-top:10px">Calorie counts are estimates based on standard portion sizes.</p>
      </div>

      <!-- Protein Intake vs Target -->
      <div class="panel">
        <div class="results-head">
          <div>
            <span class="eyebrow">MACRONUTRIENT HIGHLIGHT</span>
            <h2 style="font-size:18px">Daily Protein (grams)</h2>
          </div>
          <span class="tag tag-green">${userDiet}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;align-items:end;height:180px;padding-top:15px;border-bottom:1px solid #e5eae3">
          ${days.map(d => {
            const height = Math.max(18, Math.round((d.protein / 80) * 140));
            return `
              <div style="text-align:center;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end">
                <span style="font-size:9px;font-weight:700;color:#236b4d;margin-bottom:4px">${Math.round(d.protein)}g</span>
                <div title="${d.day}: ${d.protein}g protein" style="width:75%;height:${height}px;background:linear-gradient(180deg,#e99b59,#c67d3e);border-radius:6px 6px 2px 2px;transition:0.3s"></div>
                <small style="font-size:10px;color:#718078;margin-top:6px;font-weight:600">${d.day.slice(0, 3)}</small>
              </div>
            `;
          }).join("")}
        </div>
        <p class="form-note" style="margin-top:10px">Recommended baseline for active hostel students is 55g–70g/day.</p>
      </div>
    </div>

    <!-- Plan Strategy & Goal Alignment -->
    <div class="feature-grid" style="margin-top:20px">
      <div class="panel">
        <span class="eyebrow">YOUR GOAL</span>
        <h3 style="margin:6px 0">${goalTitles[userGoal] || 'Balanced Nutrition'}</h3>
        <p class="form-note">${goalDescriptions[userGoal] || 'Balanced eating routine.'}</p>
      </div>
      <div class="panel">
        <span class="eyebrow">YOUR BUDGET</span>
        <h3 style="margin:6px 0">₹${targetBudget} / day</h3>
        <p class="form-note">Current daily average is ₹${avgCost}. You are staying on track with your weekly budget.</p>
      </div>
      <div class="panel">
        <span class="eyebrow">FOOD PREFERENCE</span>
        <h3 style="margin:6px 0" style="text-transform:capitalize">${userDiet}</h3>
        <p class="form-note">${plan.preferences.mealsPerDay || 3} meals per day planned with zero food waste in mind.</p>
      </div>
    </div>

    <!-- Quick Action Links -->
    <div class="results-actions" style="margin-top:25px">
      <a class="button" href="planner.html">Modify meal plan →</a>
      <a class="button button-outline" href="shopping.html">View weekly shopping list</a>
      <a class="button button-outline" href="recipes.html">Browse recipe catalogue</a>
    </div>
  `;
});
