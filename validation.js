const { z } = require('zod');

// 1. User Registration Schema
const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name cannot exceed 60 characters'),
  email: z.string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address')
    .max(120, 'Email cannot exceed 120 characters'),
  password: z.string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters')
});

// 2. User Login Schema
const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address'),
  password: z.string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
});

// 3. Recipe Creation Schema
const recipeCreateSchema = z.object({
  name: z.string({ required_error: 'Recipe name is required' })
    .trim()
    .min(2, 'Recipe name must be at least 2 characters')
    .max(80, 'Recipe name cannot exceed 80 characters'),
  diet: z.enum(['vegetarian', 'vegan', 'non-vegetarian'], {
    errorMap: () => ({ message: 'Diet must be vegetarian, vegan, or non-vegetarian' })
  }),
  category: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack'], {
    errorMap: () => ({ message: 'Category must be Breakfast, Lunch, Dinner, or Snack' })
  }),
  cost: z.coerce.number({ required_error: 'Cost is required' })
    .min(1, 'Cost must be at least ₹1')
    .max(1000, 'Cost cannot exceed ₹1,000'),
  calories: z.coerce.number({ required_error: 'Calories are required' })
    .int('Calories must be an integer')
    .min(10, 'Calories must be at least 10 kcal')
    .max(3000, 'Calories cannot exceed 3,000 kcal'),
  protein: z.coerce.number({ required_error: 'Protein is required' })
    .min(0.1, 'Protein must be at least 0.1g')
    .max(150, 'Protein cannot exceed 150g'),
  time: z.coerce.number()
    .int()
    .min(1, 'Preparation time must be at least 1 minute')
    .max(300, 'Preparation time cannot exceed 300 minutes')
    .optional()
    .default(15),
  emoji: z.string().trim().max(10).optional().default('🍲'),
  ingredients: z.union([
    z.array(z.string().trim().min(1)),
    z.string().trim().min(1).transform(str => str.split(',').map(s => s.trim()).filter(Boolean))
  ]).refine(arr => arr.length > 0, 'At least one ingredient is required'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().default(''),
  instructions: z.union([
    z.array(z.string().trim().min(1)),
    z.string().trim().min(1).transform(str => str.split('\n').map(s => s.trim()).filter(Boolean))
  ]).optional().default([])
});

// 4. Recipe Update Schema (Partial)
const recipeUpdateSchema = recipeCreateSchema.partial();

// 5. Meal Plan Schema
const mealPlanSchema = z.object({
  title: z.string().trim().max(100).optional().default('My Weekly Plan'),
  preferences: z.object({
    budget: z.coerce.number().min(50, 'Daily budget must be at least ₹50').max(2000, 'Daily budget cannot exceed ₹2,000').optional().default(120),
    diet: z.enum(['vegetarian', 'vegan', 'non-vegetarian']).optional().default('vegetarian'),
    goal: z.enum(['balanced', 'muscle', 'weight']).optional().default('balanced'),
    mealsPerDay: z.coerce.number().min(3).max(4).optional().default(3),
    avoid: z.string().trim().max(200).optional().default('')
  }).optional().default({}),
  days: z.array(
    z.object({
      day: z.string(),
      meals: z.array(z.object({
        name: z.string(),
        cost: z.coerce.number(),
        calories: z.coerce.number(),
        protein: z.coerce.number()
      })),
      cost: z.coerce.number(),
      calories: z.coerce.number(),
      protein: z.coerce.number()
    })
  ).min(1, 'Meal plan must contain at least 1 day').max(7, 'Meal plan cannot exceed 7 days')
});

// 6. Shopping Item Schema
const shoppingItemSchema = z.object({
  name: z.string({ required_error: 'Item name is required' })
    .trim()
    .min(1, 'Item name cannot be empty')
    .max(80, 'Item name cannot exceed 80 characters'),
  category: z.string().trim().max(40).optional().default('Other'),
  estimatedCost: z.coerce.number()
    .min(0, 'Estimated cost cannot be negative')
    .max(5000, 'Estimated cost cannot exceed ₹5,000')
    .optional()
    .default(0)
});

// 7. Shopping Item Toggle Schema
const shoppingToggleSchema = z.object({
  checked: z.boolean({ required_error: 'Checked status is required' })
});

// 8. Community Post Schema
const communityPostSchema = z.object({
  author_name: z.string({ required_error: 'Author name is required' })
    .trim()
    .min(2, 'Author name must be at least 2 characters')
    .max(50, 'Author name cannot exceed 50 characters'),
  message: z.string({ required_error: 'Tip message is required' })
    .trim()
    .min(5, 'Tip message must be at least 5 characters')
    .max(500, 'Tip message cannot exceed 500 characters'),
  tag: z.enum([
    'Hostel Hacks',
    'Budget Snack',
    'High Protein',
    'Smart Shopping',
    'Meal Prep',
    'General'
  ]).optional().default('General')
});

// Express Validation Middleware Factory
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          error: 'Validation failed',
          message: details.map(d => `${d.field ? d.field + ': ' : ''}${d.message}`).join('; '),
          details
        });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

module.exports = {
  registerSchema,
  loginSchema,
  recipeCreateSchema,
  recipeUpdateSchema,
  mealPlanSchema,
  shoppingItemSchema,
  shoppingToggleSchema,
  communityPostSchema,
  validate
};
