// Starter data used the very first time the app runs (when there are no profiles/recipes yet).
// Recipes come from "Main recipe list.pdf". Calories are rough per-serving estimates: edit them in the app.

export const DEFAULT_PROFILES = [
  { name: 'Me', emoji: '🌿', color: '#2f855a', calorie_goal: 1400 },
  { name: 'Sister', emoji: '🌸', color: '#b83280', calorie_goal: 1400 },
  { name: 'Mom', emoji: '🌻', color: '#c05621', calorie_goal: 1300 },
];

// Typical ingredients for each starter recipe, used for the grocery list. Edit them in the app.
const INGREDIENTS = {
  'Mix Veg Soup': 'Carrot\nBeans\nCabbage\nGreen peas\nSweet corn\nOnion\nGarlic\nGinger\nBlack pepper\nCornflour (1 tsp)\nOil (1 tsp)',
  'Dal Palak': 'Toor dal (½ cup)\nSpinach (1 bunch)\nOnion\nTomato\nGarlic\nGreen chilli\nCumin seeds\nTurmeric\nGhee or oil (1 tsp)',
  'Veg Noodles': 'Noodles (millet / whole wheat)\nCabbage\nCarrot\nCapsicum\nSpring onion\nGarlic\nSoy sauce\nVinegar\nBlack pepper\nOil (2 tsp)',
  'Ragi Besan Chilla': 'Ragi flour (½ cup)\nBesan (¼ cup)\nOnion\nTomato\nGreen chilli\nCoriander leaves\nCumin seeds\nOil (1 tsp)',
  'Green Chutney': 'Coriander leaves\nMint leaves\nGreen chilli\nGinger\nLemon\nRoasted chana or peanuts (1 tbsp)',
  'South Indian Vegetable Sambar': 'Toor dal (½ cup)\nTamarind\nSambar powder\nDrumstick\nCarrot\nPumpkin\nOnion (small / shallots)\nTomato\nMustard seeds\nCurry leaves\nOil (1 tsp)',
  'Air Fryer Dal Vada': 'Chana dal (1 cup)\nOnion\nGreen chilli\nGinger\nCurry leaves\nCoriander leaves\nFennel seeds\nOil spray',
  'Yellow Pumpkin Dal': 'Toor or moong dal (½ cup)\nYellow pumpkin (1 cup)\nOnion\nTomato\nGarlic\nCumin seeds\nTurmeric\nRed chilli powder\nGhee (1 tsp)',
  'Green Pea Poha (Matar Poha)': 'Poha (1 cup)\nGreen peas (¼ cup)\nOnion\nGreen chilli\nMustard seeds\nCurry leaves\nTurmeric\nLemon\nCoriander leaves\nPeanuts (1 tbsp)\nOil (1 tsp)',
  'Palak Chole': 'Chickpeas (1 cup, soaked)\nSpinach (1 bunch)\nOnion\nTomato\nGinger\nGarlic\nGreen chilli\nChole masala\nCumin seeds\nOil (2 tsp)',
  'Coriander Rice (Coriander Pulao)': 'Rice (1 cup)\nCoriander leaves (1 bunch)\nMint leaves\nGreen chilli\nGinger\nGarlic\nGreen peas\nOnion\nWhole spices\nGhee (1 tsp)',
  'Gajar Matar Sabzi': 'Carrot (2)\nGreen peas (1 cup)\nOnion\nTomato\nGinger\nCumin seeds\nTurmeric\nCoriander powder\nOil (1 tsp)',
  'Masala Jowar Roti': 'Jowar flour (1 cup)\nOnion\nGreen chilli\nCoriander leaves\nAjwain\nSalt',
  'Weight Loss Smoothies': 'Banana or apple\nSpinach\nOats (2 tbsp)\nCurd or almond milk\nChia seeds\nBerries',
  'Black Chana Tangy Soup': 'Black chana (½ cup, soaked)\nTomato\nOnion\nGarlic\nGinger\nLemon\nCumin seeds\nBlack pepper',
  'Ragi Oats Chilla': 'Ragi flour (¼ cup)\nOats (¼ cup)\nCurd (2 tbsp)\nOnion\nCarrot\nGreen chilli\nCoriander leaves\nOil (1 tsp)',
  'Chilli Paneer': 'Paneer (100 g)\nCapsicum\nOnion\nSpring onion\nGarlic\nGinger\nGreen chilli\nSoy sauce\nVinegar\nCornflour (1 tsp)\nOil (2 tsp)',
  'Healthy Homemade Salad Dressings': 'Olive oil\nLemon\nHoney\nMustard\nGreek yoghurt\nGarlic\nBlack pepper',
  'Kerala Veg Stew': 'Coconut milk (1 cup)\nPotato\nCarrot\nBeans\nGreen peas\nOnion\nGinger\nGreen chilli\nCurry leaves\nWhole spices\nCoconut oil (1 tsp)',
  'Zucchini Noodles': 'Zucchini (2)\nCherry tomatoes\nGarlic\nOlive oil\nParmesan or paneer\nBlack pepper\nChilli flakes\nBasil',
  'Healthy Soups (collection)': 'Seasonal vegetables\nOnion\nGarlic\nBlack pepper',
  'Ragi Idli': 'Ragi flour (1 cup)\nUrad dal (½ cup)\nIdli rava (½ cup)\nFenugreek seeds\nSalt',
  'Khaman Dhokla (microwave)': 'Besan (1 cup)\nCurd (¼ cup)\nGinger\nGreen chilli\nEno fruit salt\nLemon\nMustard seeds\nCurry leaves\nOil (1 tsp)',
};

// category: one of breakfast, lunch, dinner, snack, drink, side
export const SEED_RECIPES = [
  ['Mix Veg Soup', 'https://hebbarskitchen.com/vegetable-soup-recipe-mix-veg-soup/', 'dinner', 90],
  ['Dal Palak', 'https://www.indianhealthyrecipes.com/dal-palak-recipe/', 'lunch', 180],
  ['Veg Noodles', 'https://www.indianhealthyrecipes.com/veg-noodles-recipe/', 'lunch', 300],
  ['Ragi Besan Chilla', 'https://www.zeelskitchen.com/recipe/ragi-besan-chilla/', 'breakfast', 200],
  ['Green Chutney', 'https://www.indianhealthyrecipes.com/green-chutney-recipe/', 'side', 25],
  ['South Indian Vegetable Sambar', 'https://hebbarskitchen.com/south-indian-vegetable-sambar-recipe/', 'lunch', 150],
  ['Air Fryer Dal Vada', 'https://culinaryshades.com/dal-vada-lentil-fritters-in-air-fryer/', 'snack', 180],
  ['Yellow Pumpkin Dal', 'https://www.archanaskitchen.com/yellow-pumpkin-dal', 'dinner', 170],
  ['Green Pea Poha (Matar Poha)', 'https://www.tarladalal.com/green-pea-poha-matar-poha-4655r', 'breakfast', 250],
  ['Palak Chole', 'https://www.vegrecipesofindia.com/palak-chole-recipe-palak-chole/', 'dinner', 250],
  ['Coriander Rice (Coriander Pulao)', 'https://hebbarskitchen.com/coriander-rice-recipe-coriander-pulao/', 'lunch', 280],
  ['Gajar Matar Sabzi', 'https://www.cookwithmanali.com/gajar-matar-sabzi-indian-style-carrots-green-peas/', 'lunch', 120],
  ['Masala Jowar Roti', 'https://www.whiskaffair.com/masala-jowar-roti/', 'side', 120],
  ['Weight Loss Smoothies', 'https://www.healthifyme.com/blog/5-smoothie-recipes-weight-loss/', 'breakfast', 180],
  ['Black Chana Tangy Soup', 'https://www.betterbutter.in/recipe/73157/black-chana-tangy-soup', 'dinner', 150],
  ['Ragi Oats Chilla', 'https://cookpad.com/in/recipes/16525882-ragi-oats-chilla', 'breakfast', 180],
  ['Chilli Paneer', 'https://www.cult.fit/live/recipe/chilli-paneer/RECIPE724', 'dinner', 280],
  ['Healthy Homemade Salad Dressings', 'https://www.eatingbirdfood.com/6-healthy-homemade-salad-dressings/', 'side', 60],
  ['Kerala Veg Stew', 'https://hebbarskitchen.com/veg-stew-kerala-style-vegetable-stew/', 'dinner', 180],
  ['Zucchini Noodles', 'https://www.goodhousekeeping.com/food-recipes/healthy/g4347/zucchini-noodle-recipes/?slide=3', 'dinner', 200],
  ['Healthy Soups (collection)', 'https://www.tarladalal.com/recipes-for-healthy-soups-372', 'dinner', 100],
  ['Ragi Idli', 'https://www.vegrecipesofindia.com/ragi-idli-recipe/', 'breakfast', 150],
  ['Khaman Dhokla (microwave)', 'https://www.vegrecipesofindia.com/khaman-dhokla-microwave-recipe/', 'snack', 160],
].map(([name, url, category, kcal]) => ({ name, url, category, kcal, ingredients: INGREDIENTS[name] || null, notes: 'Calories are an estimate per serving. Ingredient list is a typical version: check the linked recipe.' }));
