/**
 * PlatePilot Shopping List Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("#shopping-list");
  if (!host) return;

  const progressText = document.querySelector("#shopping-progress");
  const progressFill = document.querySelector("#progress-fill");
  const shoppingTotal = document.querySelector("#shopping-total");
  const addItemBtn = document.querySelector("#add-item");
  const clearCheckedBtn = document.querySelector("#clear-checked");
  const printBtn = document.querySelector("#print-list");
  const copyBtn = document.querySelector("#copy-list");

  const GROUPS = {
    "Grains & pulses": ["rice", "poha", "moong dal", "rajma", "chickpeas", "roti", "bread", "oats", "besan", "sooji", "atta", "toor dal", "sprouted moong"],
    "Protein & dairy": ["paneer", "curd", "soya chunks", "soya granules", "eggs", "chicken", "peanuts", "milk", "peanut butter"],
    "Vegetables & fruit": ["onion", "tomato", "cucumber", "peas", "seasonal vegetables", "seasonal fruit", "banana", "potato", "spinach", "capsicum", "ginger", "garlic", "green chilli"],
    "Other": ["lemon", "coriander", "curry leaves", "spices", "roasted seeds", "chaat masala", "mustard seeds", "cumin", "honey", "butter", "soy sauce", "ghee"]
  };

  // Rough price estimates for grocery budgeting (per typical weekly purchase)
  const ITEM_COST_ESTIMATES = {
    "rice": 40, "poha": 25, "moong dal": 35, "rajma": 45, "chickpeas": 40, "toor dal": 40, "roti": 30, "bread": 25, "oats": 35, "besan": 30,
    "paneer": 70, "curd": 35, "soya chunks": 25, "soya granules": 25, "eggs": 45, "chicken": 110, "peanuts": 25, "milk": 30, "peanut butter": 60,
    "onion": 25, "tomato": 25, "cucumber": 15, "peas": 20, "seasonal vegetables": 35, "seasonal fruit": 35, "banana": 25, "potato": 20, "spinach": 20,
    "lemon": 10, "coriander": 10, "spices": 20, "roasted seeds": 30, "ginger": 10, "garlic": 10, "green chilli": 10
  };

  let items = [];

  async function loadData() {
    let serverItems = null;
    try {
      if (window.PPStore && typeof window.PPStore.getShoppingItemsAsync === 'function') {
        serverItems = await window.PPStore.getShoppingItemsAsync();
      }
    } catch {
      serverItems = null;
    }

    if (Array.isArray(serverItems) && serverItems.length > 0) {
      items = serverItems;
      render();
      return;
    }

    // Fallback: build from active plan and local custom items
    const plan = PPStore.getPlan();
    const custom = PPStore.getCustom();
    const checks = PPStore.getChecks();

    if (!plan && !custom.length) {
      host.innerHTML = `
        <div class="empty-state">
          <span>🛒</span>
          <h3>Your list is waiting</h3>
          <p>Save a meal plan first, then your ingredients will appear here.</p>
          <a class="button" href="planner.html">Create plan →</a>
        </div>
      `;
      updateProgress(0, 0, 0);
      return;
    }

    const map = {};
    (plan?.days || []).forEach(d => {
      (d.meals || []).forEach(m => {
        (m.ingredients || []).forEach(ing => {
          const clean = ing.trim().toLowerCase();
          map[clean] = (map[clean] || 0) + 1;
        });
      });
    });

    items = [];
    Object.entries(map).forEach(([name, count], index) => {
      let matchedGroup = "Other";
      for (const [group, known] of Object.entries(GROUPS)) {
        if (known.some(k => name.includes(k))) {
          matchedGroup = group;
          break;
        }
      }
      items.push({
        id: index + 1,
        name,
        category: matchedGroup,
        checked: checks.includes(name),
        quantity: count > 1 ? `x${count} recipes` : 'for the week',
        is_custom: false
      });
    });

    custom.forEach((c, idx) => {
      items.push({
        id: 1000 + idx,
        name: c.name,
        category: c.category || 'Other',
        checked: checks.includes(c.name),
        quantity: 'Custom item',
        is_custom: true
      });
    });

    render();
  }

  function render() {
    if (!items.length) {
      host.innerHTML = `
        <div class="empty-state">
          <span>🛒</span>
          <h3>No items in your shopping list</h3>
          <p>Generate a meal plan or add custom items to get started.</p>
          <a class="button" href="planner.html">Generate plan →</a>
        </div>
      `;
      updateProgress(0, 0, 0);
      return;
    }

    const categories = Object.keys(GROUPS);
    let html = "";
    let totalItems = items.length;
    let checkedItems = 0;
    let estCostSum = 0;

    categories.forEach(group => {
      const groupItems = items.filter(i => (i.category || 'Other').toLowerCase() === group.toLowerCase());
      if (!groupItems.length) return;

      html += `
        <div class="shopping-category">
          <h3>${group}</h3>
          ${groupItems.map(item => {
            if (item.checked) checkedItems++;
            const cost = ITEM_COST_ESTIMATES[item.name] || 25;
            estCostSum += cost;
            return `
              <label class="shopping-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
                <input type="checkbox" data-id="${item.id}" ${item.checked ? 'checked' : ''}>
                <span>${PlatePilot.escapeHTML(item.name)}</span>
                <small>${PlatePilot.escapeHTML(item.quantity || 'for the week')}</small>
              </label>
            `;
          }).join("")}
        </div>
      `;
    });

    // Other / uncategorized items
    const otherItems = items.filter(i => !categories.some(c => c.toLowerCase() === (i.category || '').toLowerCase()));
    if (otherItems.length) {
      html += `
        <div class="shopping-category">
          <h3>Other & Essentials</h3>
          ${otherItems.map(item => {
            if (item.checked) checkedItems++;
            const cost = ITEM_COST_ESTIMATES[item.name] || 20;
            estCostSum += cost;
            return `
              <label class="shopping-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
                <input type="checkbox" data-id="${item.id}" ${item.checked ? 'checked' : ''}>
                <span>${PlatePilot.escapeHTML(item.name)}</span>
                <small>${PlatePilot.escapeHTML(item.quantity || 'for the week')}</small>
              </label>
            `;
          }).join("")}
        </div>
      `;
    }

    host.innerHTML = html;

    // Attach checkbox change events
    host.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', async () => {
        const id = Number(input.dataset.id);
        const item = items.find(x => x.id === id);
        if (item) {
          item.checked = input.checked;
          const parentLabel = input.closest('.shopping-item');
          if (parentLabel) parentLabel.classList.toggle('checked', item.checked);

          // Update SQLite backend
          if (window.PPStore && typeof window.PPStore.toggleShoppingItemAsync === 'function') {
            await window.PPStore.toggleShoppingItemAsync(id, item.checked);
          }

          // Update LocalStorage checks
          const checkedNames = items.filter(i => i.checked).map(i => i.name);
          PPStore.saveChecks(checkedNames);

          updateProgress(items.filter(i => i.checked).length, items.length, estCostSum);
        }
      });
    });

    updateProgress(checkedItems, totalItems, estCostSum);
  }

  function updateProgress(done, total, estCost) {
    if (progressText) {
      progressText.textContent = `${done} of ${total} items checked`;
    }
    if (progressFill) {
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      progressFill.style.width = `${pct}%`;
    }
    if (shoppingTotal) {
      shoppingTotal.textContent = total > 0 ? `Estimated weekly grocery spend: ~₹${estCost}` : 'Estimated total: ₹—';
    }
  }

  // Add Item Modal
  if (addItemBtn) {
    addItemBtn.addEventListener("click", () => {
      const modalBody = `
        <form id="add-item-form" style="display:grid;gap:12px">
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Ingredient / Item Name *
            <input id="item-name" required placeholder="e.g. ginger, peanut butter, brown bread" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
          </label>
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Category
            <select id="item-cat" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
              <option value="Grains & pulses">Grains & pulses</option>
              <option value="Protein & dairy">Protein & dairy</option>
              <option value="Vegetables & fruit">Vegetables & fruit</option>
              <option value="Other" selected>Other / Spices</option>
            </select>
          </label>
          <label style="display:grid;gap:4px;font-size:12px;font-weight:700">
            Estimated Cost (₹)
            <input id="item-cost" type="number" min="0" max="1000" value="30" style="padding:10px;border:1px solid #e5eae3;border-radius:8px">
          </label>
          <button type="submit" class="button button-full" style="margin-top:6px">Add to Shopping List</button>
        </form>
      `;

      PlatePilot.openModal("Add Custom Grocery Item", modalBody);

      const form = document.querySelector("#add-item-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const nameInput = document.querySelector("#item-name");
          const catInput = document.querySelector("#item-cat");
          const costInput = document.querySelector("#item-cost");
          const name = nameInput.value.trim().toLowerCase();
          const cat = catInput.value;
          const cost = Number(costInput.value) || 0;

          if (name) {
            if (window.PPStore && typeof window.PPStore.addCustomShoppingItemAsync === 'function') {
              const created = await window.PPStore.addCustomShoppingItemAsync(name, cat, cost);
              if (created) items.push(created);
            } else {
              items.push({
                id: Date.now(),
                name,
                category: cat,
                checked: false,
                quantity: 'Custom item',
                is_custom: true
              });
            }
            PlatePilot.closeModal();
            render();
            PlatePilot.showToast(`Added "${name}" to shopping list!`, "success");
          }
        });
      }
    });
  }

  // Clear checked
  if (clearCheckedBtn) {
    clearCheckedBtn.addEventListener("click", async () => {
      if (window.PPStore && typeof window.PPStore.clearCheckedShoppingAsync === 'function') {
        const remaining = await window.PPStore.clearCheckedShoppingAsync();
        if (Array.isArray(remaining)) items = remaining;
      }
      items.forEach(i => {
        if (i.checked && !i.is_custom) i.checked = false;
      });
      items = items.filter(i => !(i.checked && i.is_custom));
      PPStore.saveChecks([]);
      render();
      PlatePilot.showToast("Checked items cleared!", "info");
    });
  }

  // Copy list to clipboard
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!items.length) {
        PlatePilot.showToast("Shopping list is empty.", "error");
        return;
      }

      let text = "🛒 PlatePilot Grocery Checklist:\n\n";
      const categories = Object.keys(GROUPS);
      categories.forEach(group => {
        const groupItems = items.filter(i => (i.category || 'Other').toLowerCase() === group.toLowerCase());
        if (groupItems.length) {
          text += `[${group}]\n`;
          groupItems.forEach(i => {
            text += `  ${i.checked ? '[x]' : '[ ]'} ${i.name} (${i.quantity || 'for the week'})\n`;
          });
          text += "\n";
        }
      });

      navigator.clipboard.writeText(text).then(() => {
        PlatePilot.showToast("Shopping checklist copied to clipboard!", "success");
      }).catch(() => {
        PlatePilot.showToast("Could not copy to clipboard.", "error");
      });
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  loadData();
});
