/**
 * PlatePilot Recipe Catalogue Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.querySelector("#recipe-grid");
  if (!grid) return;

  const searchInput = document.querySelector("#recipe-search");
  const dietFilter = document.querySelector("#recipe-filter");
  const categoryFilter = document.querySelector("#category-filter");
  const addRecipeBtn = document.querySelector("#open-add-recipe-modal");

  let allRecipes = [];

  async function loadRecipes() {
    try {
      allRecipes = await PPStore.getRecipes();
      render();
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1">Could not load recipes. Ensure server is running with npm start.</p>';
    }
  }

  function render() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const diet = dietFilter.value;
    const category = categoryFilter ? categoryFilter.value : 'all';

    const filtered = allRecipes.filter(r => {
      // Diet check
      if (diet !== "all") {
        if (diet === "vegan" && r.diet !== "vegan") return false;
        if (diet === "vegetarian" && r.diet !== "vegetarian" && r.diet !== "vegan") return false;
        if (diet === "non-vegetarian" && r.diet !== "non-vegetarian") return false;
      }
      // Category check
      if (category !== "all" && r.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
      // Search term check
      if (q) {
        const text = [
          r.name,
          r.description,
          r.category,
          ...(r.ingredients || [])
        ].join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <span>🔍</span>
          <h3>No recipes match your criteria</h3>
          <p>Try clearing filters or searching for another ingredient like 'egg', 'dal', or 'rice'.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(r => `
      <article class="recipe-card" data-recipe-id="${r.id}">
        <div class="recipe-art">${r.emoji || '🍲'}</div>
        <div class="recipe-body">
          <div class="recipe-meta">
            <span>${(r.category || 'MEAL').toUpperCase()}</span>
            <span>⏱ ${r.time || 15} MIN</span>
          </div>
          <h3>${PlatePilot.escapeHTML(r.name)}</h3>
          <p>${PlatePilot.escapeHTML(r.description || '')}</p>
          <div class="recipe-tags">
            <span>₹${r.cost} est.</span>
            <span>${r.protein}g protein</span>
            <span>${r.calories} kcal</span>
            <span style="text-transform:capitalize">${r.diet}</span>
          </div>
          <button class="button button-outline button-small view-recipe-btn" data-id="${r.id}">
            View Recipe Details →
          </button>
        </div>
      </article>
    `).join("");

    // Attach click handlers to open detailed modal
    grid.querySelectorAll(".view-recipe-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const recipeId = Number(btn.dataset.id);
        const recipe = allRecipes.find(x => x.id === recipeId);
        if (recipe) {
          openRecipeModal(recipe);
        }
      });
    });
  }

  function openRecipeModal(r) {
    const ingredientsHtml = (r.ingredients || []).map(ing => `
      <li style="display:flex;align-items:center;gap:8px;padding:4px 0">
        <span style="color:var(--green)">•</span>
        <span style="text-transform:capitalize">${PlatePilot.escapeHTML(ing)}</span>
      </li>
    `).join("");

    const instructions = Array.isArray(r.instructions) && r.instructions.length
      ? r.instructions
      : [
          `Prep all ingredients: ${(r.ingredients || []).join(', ')}.`,
          `Cook on medium heat for about ${r.time || 15} minutes until ready.`,
          'Serve fresh and enjoy your nutritious student meal!'
        ];

    const instructionsHtml = instructions.map((step, idx) => `
      <div class="instruction-step">
        <div class="instruction-num">${idx + 1}</div>
        <div>${PlatePilot.escapeHTML(step)}</div>
      </div>
    `).join("");

    const bodyHtml = `
      <div style="display:flex;align-items:center;gap:15px;margin-bottom:10px">
        <span style="font-size:42px">${r.emoji || '🍲'}</span>
        <div>
          <div style="display:flex;gap:6px;margin-bottom:4px">
            <span class="tag tag-green">${r.category}</span>
            <span class="tag" style="background:#edf3e9;color:#236b4d">${r.diet}</span>
            <span class="tag" style="background:#fef5eb;color:#c67d3e">⏱ ${r.time} mins</span>
          </div>
          <p style="font-size:12px;color:var(--muted);margin:0">${PlatePilot.escapeHTML(r.description || '')}</p>
        </div>
      </div>

      <div class="nutrition-grid" style="margin:12px 0">
        <div class="nutrition-card">
          <strong>₹${r.cost}</strong>
          <span>Estimated cost</span>
        </div>
        <div class="nutrition-card">
          <strong>${r.protein}g</strong>
          <span>Protein</span>
        </div>
        <div class="nutrition-card">
          <strong>${r.calories}</strong>
          <span>Calories (kcal)</span>
        </div>
      </div>

      <div>
        <h4 style="font:700 14px Manrope;margin:12px 0 6px">Required Ingredients:</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:13px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px">
          ${ingredientsHtml}
        </ul>
      </div>

      <div style="margin-top:14px">
        <h4 style="font:700 14px Manrope;margin:0 0 10px">Cooking Instructions:</h4>
        <div>${instructionsHtml}</div>
      </div>
    `;

    const footerHtml = `
      <button class="button button-small" onclick="PlatePilot.closeModal()">Close</button>
    `;

    PlatePilot.openModal(r.name, bodyHtml, footerHtml);
  }

  // Handle "+ Submit Recipe" Modal
  if (addRecipeBtn) {
    addRecipeBtn.addEventListener("click", () => {
      const modalBody = `
        <form id="new-recipe-form" style="display:grid;gap:12px">
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Recipe Name *
            <input id="new-recipe-name" required placeholder="e.g. Soya Chunks Stir Fry" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Diet *
              <select id="new-recipe-diet" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="non-vegetarian">Non-vegetarian</option>
              </select>
            </label>
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Category *
              <select id="new-recipe-cat" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch" selected>Lunch</option>
                <option value="Dinner">Dinner</option>
                <option value="Snack">Snack</option>
              </select>
            </label>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Cost (₹) *
              <input id="new-recipe-cost" type="number" min="5" max="300" value="35" required style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
            </label>
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Calories *
              <input id="new-recipe-cals" type="number" min="50" max="1500" value="380" required style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
            </label>
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Protein (g) *
              <input id="new-recipe-prot" type="number" min="1" max="100" value="20" required style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Cooking Time (mins)
              <input id="new-recipe-time" type="number" min="2" max="120" value="15" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
            </label>
            <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
              Emoji Icon
              <input id="new-recipe-emoji" value="🍲" maxlength="4" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
            </label>
          </div>
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Ingredients (comma separated) *
            <input id="new-recipe-ings" required placeholder="soya chunks, onion, tomato, spices" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
          </label>
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Short Description
            <textarea id="new-recipe-desc" rows="2" placeholder="Quick high-protein dinner for busy study nights." style="padding:10px;border:1px solid #e5eae3;border-radius:8px"></textarea>
          </label>
          <button type="submit" class="button button-full" style="margin-top:6px">Save to SQLite Database</button>
        </form>
      `;

      PlatePilot.openModal("Submit New Recipe", modalBody);

      const form = document.querySelector("#new-recipe-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = document.querySelector("#new-recipe-name").value.trim();
          const diet = document.querySelector("#new-recipe-diet").value;
          const category = document.querySelector("#new-recipe-cat").value;
          const cost = Number(document.querySelector("#new-recipe-cost").value);
          const calories = Number(document.querySelector("#new-recipe-cals").value);
          const protein = Number(document.querySelector("#new-recipe-prot").value);
          const time = Number(document.querySelector("#new-recipe-time").value) || 15;
          const emoji = document.querySelector("#new-recipe-emoji").value.trim() || '🍲';
          const ingsRaw = document.querySelector("#new-recipe-ings").value;
          const description = document.querySelector("#new-recipe-desc").value.trim();

          const ingredients = ingsRaw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

          try {
            const res = await fetch("/api/recipes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                diet,
                category,
                cost,
                calories,
                protein,
                time,
                emoji,
                ingredients,
                description
              })
            });

            if (res.ok) {
              const created = await res.json();
              allRecipes.unshift(created);
              PlatePilot.closeModal();
              render();
              PlatePilot.showToast("Recipe added to database successfully!", "success");
            } else {
              PlatePilot.showToast("Failed to save recipe to server.", "error");
            }
          } catch (err) {
            PlatePilot.showToast("Network error saving recipe.", "error");
          }
        });
      }
    });
  }

  searchInput.addEventListener("input", render);
  dietFilter.addEventListener("change", render);
  if (categoryFilter) categoryFilter.addEventListener("change", render);

  loadRecipes();
});
