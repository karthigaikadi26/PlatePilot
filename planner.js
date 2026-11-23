/**
 * PlatePilot Planner Page Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#planner-form");
  if (!form) return;

  const budget = document.querySelector("#budget");
  const budgetValue = document.querySelector("#budget-value");
  const dietSelect = document.querySelector("#diet");
  const goalSelect = document.querySelector("#goal");
  const mealsSelect = document.querySelector("#meals");
  const avoidInput = document.querySelector("#avoid");
  const planBox = document.querySelector("#meal-plan");
  const summary = document.querySelector("#plan-summary");
  const saveBtn = document.querySelector("#save-plan");
  const printBtn = document.querySelector("#print-plan");

  let currentPlan = null;

  // Real-time budget slider value update
  budget.addEventListener("input", () => {
    budgetValue.textContent = `₹${budget.value}`;
  });

  // Ensure recipe pool is loaded from SQLite
  if (window.PPOptimizer && typeof window.PPOptimizer.loadRecipePool === 'function') {
    await window.PPOptimizer.loadRecipePool();
  }

  // Load existing plan from SQLite / LocalStorage
  try {
    currentPlan = await PPStore.getPlanAsync();
  } catch {
    currentPlan = PPStore.getPlan();
  }

  function render(plan) {
    currentPlan = plan;
    const totalWeeklyCost = plan.days.reduce((s, d) => s + d.cost, 0);
    const avgDailyCost = Math.round(totalWeeklyCost / 7);
    const avgProtein = Math.round(plan.days.reduce((s, d) => s + d.protein, 0) / 7);

    summary.innerHTML = `
      <div class="summary-card">
        <span>Daily average</span>
        <b>₹${avgDailyCost}</b>
      </div>
      <div class="summary-card">
        <span>Protein / day</span>
        <b>${avgProtein}g</b>
      </div>
      <div class="summary-card">
        <span>Est. weekly spend</span>
        <b>₹${totalWeeklyCost}</b>
      </div>
    `;

    planBox.innerHTML = plan.days.map((d, dayIndex) => `
      <article class="day-card" data-day-index="${dayIndex}">
        <div class="day-title">
          <h3>${d.day}</h3>
          <span>₹${d.cost} · ${d.calories} kcal · ${d.protein}g protein</span>
        </div>
        ${d.meals.map((m, mealIndex) => `
          <div class="meal-row">
            <span class="meal-emoji">${m.emoji || '🍲'}</span>
            <div>
              <b>${PlatePilot.escapeHTML(m.name)}</b>
              <small>${m.slotName ? `[${m.slotName}] ` : ''}${m.calories} kcal · ${m.protein}g protein · ${m.time || 15}m</small>
            </div>
            <span class="meal-cost">₹${m.cost}</span>
            <button class="meal-swap-btn" data-day="${dayIndex}" data-meal="${mealIndex}" title="Swap with alternative meal">
              🔄 Swap
            </button>
          </div>
        `).join("")}
      </article>
    `).join("");

    // Attach meal swap event listeners
    planBox.querySelectorAll(".meal-swap-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const dayIdx = Number(btn.dataset.day);
        const mealIdx = Number(btn.dataset.meal);
        if (window.PPOptimizer && typeof window.PPOptimizer.swapMeal === 'function') {
          currentPlan = window.PPOptimizer.swapMeal(currentPlan, dayIdx, mealIdx);
          render(currentPlan);
          PPStore.savePlan(currentPlan);
          PlatePilot.showToast("Meal replaced with an alternative!", "info");
        }
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Optimizing meals...';
    }

    try {
      const generated = PPOptimizer.generate({
        budget: budget.value,
        diet: dietSelect.value,
        goal: goalSelect.value,
        mealsPerDay: mealsSelect.value,
        avoid: avoidInput.value
      });

      render(generated);
      await PPStore.savePlanAsync(generated);
      PlatePilot.showToast("7-day meal plan generated and saved to database!", "success");
    } catch (err) {
      console.error(err);
      PlatePilot.showToast("Error generating plan. Please try again.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Generate my 7-day plan <span>→</span>';
      }
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (currentPlan) {
        saveBtn.disabled = true;
        await PPStore.savePlanAsync(currentPlan);
        saveBtn.disabled = false;
        PlatePilot.showToast("Your meal plan is safely stored in the SQLite database!", "success");
      } else {
        PlatePilot.showToast("Please generate a meal plan first.", "error");
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  // Populate initial values from existing plan
  if (currentPlan && currentPlan.preferences) {
    const prefs = currentPlan.preferences;
    if (prefs.budget) {
      budget.value = prefs.budget;
      budgetValue.textContent = `₹${budget.value}`;
    }
    if (prefs.diet) dietSelect.value = prefs.diet;
    if (prefs.goal) goalSelect.value = prefs.goal;
    if (prefs.mealsPerDay) mealsSelect.value = prefs.mealsPerDay;
    if (prefs.avoid) avoidInput.value = prefs.avoid;
    render(currentPlan);
  }
});
