// Turns meal text (from the diet charts or a recipe's ingredient list) into a grocery list.
// Each entry: [display name, aisle, regex that finds it in meal text]
const ITEMS = [
  // Produce
  ['Cucumber', 'Vegetables & fruit', /cucumber/i],
  ['Mint leaves', 'Vegetables & fruit', /\bmint\b/i],
  ['Coriander leaves', 'Vegetables & fruit', /coriander/i],
  ['Fenugreek (methi) leaves', 'Vegetables & fruit', /fenugreek|methi/i],
  ['Spinach (palak)', 'Vegetables & fruit', /spinach|palak/i],
  ['Tomato', 'Vegetables & fruit', /tomato/i],
  ['Onion', 'Vegetables & fruit', /onion/i],
  ['Garlic', 'Vegetables & fruit', /garlic/i],
  ['Ginger', 'Vegetables & fruit', /ginger/i],
  ['Green chilli', 'Vegetables & fruit', /chilli(?! ?(paneer|chicken|powder))|chili/i],
  ['Carrot', 'Vegetables & fruit', /carrot|gajar/i],
  ['Green peas', 'Vegetables & fruit', /\bpeas?\b|matar/i],
  ['Capsicum / bell pepper', 'Vegetables & fruit', /capsicum|bell pepper/i],
  ['Broccoli', 'Vegetables & fruit', /broccoli/i],
  ['Mushrooms', 'Vegetables & fruit', /mushroom/i],
  ['Zucchini', 'Vegetables & fruit', /zucchini/i],
  ['Cabbage', 'Vegetables & fruit', /cabbage/i],
  ['Cauliflower', 'Vegetables & fruit', /cauliflower|gobi/i],
  ['Beetroot', 'Vegetables & fruit', /beetroot/i],
  ['Pumpkin', 'Vegetables & fruit', /pumpkin(?! ?(\+|seed))/i],
  ['Bottle gourd (lauki)', 'Vegetables & fruit', /lauki|bottle gourd/i],
  ['Okra (bhindi)', 'Vegetables & fruit', /bhindi|okra/i],
  ['Beans', 'Vegetables & fruit', /\bbeans\b/i],
  ['Sweet corn', 'Vegetables & fruit', /corn(?!flour)/i],
  ['Lettuce / salad greens', 'Vegetables & fruit', /lettuce|salad greens/i],
  ['Mixed vegetables', 'Vegetables & fruit', /mix(ed)? ?veg|vegetable salad|veggies|vegetables/i],
  ['Lemon / lime', 'Vegetables & fruit', /lemon|lime/i],
  ['Avocado', 'Vegetables & fruit', /avocado/i],
  ['Sweet potato', 'Vegetables & fruit', /sweet potato/i],
  ['Potato', 'Vegetables & fruit', /(?<!sweet )potato/i],
  ['Apple', 'Vegetables & fruit', /apple/i],
  ['Banana', 'Vegetables & fruit', /banana/i],
  ['Orange / mosambi', 'Vegetables & fruit', /orange|mosambi/i],
  ['Papaya', 'Vegetables & fruit', /papaya/i],
  ['Watermelon', 'Vegetables & fruit', /watermelon/i],
  ['Pomegranate', 'Vegetables & fruit', /pomegranate/i],
  ['Berries / strawberries', 'Vegetables & fruit', /berr(y|ies)/i],
  ['Guava', 'Vegetables & fruit', /guava/i],
  ['Pear', 'Vegetables & fruit', /\bpears?\b/i],
  ['Seasonal fruit', 'Vegetables & fruit', /cut fruits?|chopped fruits?|fresh fruits?|sliced fresh/i],
  ['Tender coconut', 'Vegetables & fruit', /tender coconut/i],
  ['Dates', 'Vegetables & fruit', /\bdates?\b/i],
  // Dairy & eggs
  ['Paneer', 'Dairy, eggs & protein', /paneer/i],
  ['Curd / yoghurt', 'Dairy, eggs & protein', /curd|yog(h)?urt|raita|dahi/i],
  ['Greek yoghurt', 'Dairy, eggs & protein', /greek yog/i],
  ['Buttermilk', 'Dairy, eggs & protein', /buttermilk/i],
  ['Milk (skimmed / almond / oat)', 'Dairy, eggs & protein', /milk(?!shake)/i],
  ['Cheese slices', 'Dairy, eggs & protein', /cheese(?! ?cake)/i],
  ['Ghee', 'Dairy, eggs & protein', /ghee/i],
  ['Eggs', 'Dairy, eggs & protein', /\beggs?\b|omelette|anda/i],
  ['Chicken breast', 'Dairy, eggs & protein', /chicken/i],
  ['Fish', 'Dairy, eggs & protein', /\bfish\b/i],
  ['Prawns', 'Dairy, eggs & protein', /prawn/i],
  ['Tofu', 'Dairy, eggs & protein', /tofu/i],
  ['Soy chunks', 'Dairy, eggs & protein', /soy(a)? ?chunk|soya/i],
  ['Protein powder', 'Dairy, eggs & protein', /protein powder/i],
  // Grains & flours
  ['Whole wheat atta (roti)', 'Grains & flours', /\broti\b|chapati|atta|paratha/i],
  ['Multigrain bread', 'Grains & flours', /multigrain (toast|bread)|toast/i],
  ['Rice', 'Grains & flours', /\brice\b|pulav|pulao/i],
  ['Brown rice', 'Grains & flours', /brown rice/i],
  ['Oats', 'Grains & flours', /\boats?\b|oatmeal/i],
  ['Quinoa', 'Grains & flours', /quinoa/i],
  ['Poha', 'Grains & flours', /poha/i],
  ['Rawa / sooji', 'Grains & flours', /rawa|rava|sooji|suji|(?<!(quinoa|vermicelli|oats) )up(a)?ma/i],
  ['Vermicelli', 'Grains & flours', /vermicelli/i],
  ['Besan (gram flour)', 'Grains & flours', /besan|gram flour|pakoda|dhokla/i],
  ['Ragi flour', 'Grains & flours', /ragi/i],
  ['Jowar / bajra flour', 'Grains & flours', /jowar|bajra|millet/i],
  ['Pasta', 'Grains & flours', /pasta/i],
  ['Noodles', 'Grains & flours', /noodle(?!s? ?\(thinly)/i],
  ['Idli batter', 'Grains & flours', /idli/i],
  ['Dosa batter', 'Grains & flours', /dosa/i],
  ['Popcorn kernels', 'Grains & flours', /popcorn/i],
  ['Digestive biscuits', 'Grains & flours', /digestive/i],
  // Pulses
  ['Masoor dal (red lentil)', 'Dals & pulses', /masoor|red lentil/i],
  ['Toor dal', 'Dals & pulses', /sambar|toor|pumpkin dal|dal palak|dal \(lentil\)|\bdal\b(?! vada)/i],
  ['Moong dal', 'Dals & pulses', /mo+ng|green gram|mung/i],
  ['Chana dal', 'Dals & pulses', /chana dal|dal vada/i],
  ['Chickpeas (chole)', 'Dals & pulses', /chole|chickpea|kabuli/i],
  ['Black chana', 'Dals & pulses', /black chana|kala chana/i],
  ['Rajma', 'Dals & pulses', /rajma|kidney bean/i],
  ['Horse gram (kulith)', 'Dals & pulses', /kulith|horse gram/i],
  ['Sprouts', 'Dals & pulses', /sprout/i],
  // Nuts & seeds
  ['Almonds', 'Nuts & seeds', /almond(?!\s*(\/|milk|flour))/i],
  ['Walnuts', 'Nuts & seeds', /walnut/i],
  ['Cashews', 'Nuts & seeds', /cashew/i],
  ['Mixed dry fruits', 'Nuts & seeds', /dry fruit|nuts\b/i],
  ['Raisins', 'Nuts & seeds', /raisin/i],
  ['Chia seeds', 'Nuts & seeds', /chia/i],
  ['Mixed seeds (pumpkin, flax, sunflower, sesame)', 'Nuts & seeds', /mixed seeds|\bseeds\b/i],
  ['Makhana (lotus seeds)', 'Nuts & seeds', /makhana|lotus seed/i],
  ['Peanut butter', 'Nuts & seeds', /peanut butter/i],
  ['Peanuts', 'Nuts & seeds', /peanuts?(?! butter)/i],
  // Pantry
  ['Green tea', 'Pantry & drinks', /green tea/i],
  ['Tea / coffee', 'Pantry & drinks', /chai|coffee/i],
  ['Herbal tea (chamomile / cinnamon)', 'Pantry & drinks', /chamomile|cinnamon tea|herbal tea/i],
  ['Stevia / monkfruit', 'Pantry & drinks', /stevia|monkfruit/i],
  ['Cocoa powder', 'Pantry & drinks', /cocoa|chocolate oat|chocolate chia/i],
  ['Dark chocolate', 'Pantry & drinks', /dark chocolate/i],
  ['Vanilla essence', 'Pantry & drinks', /vanilla/i],
  ['Honey', 'Pantry & drinks', /honey/i],
  ['Coconut (grated / milk)', 'Pantry & drinks', /coconut(?! water)/i],
  ['Olive oil', 'Pantry & drinks', /olive oil/i],
  ['Cooking oil', 'Pantry & drinks', /\boil\b(?!s)|fried|pan fry|sauté|saute/i],
  ['Tomato / pasta sauce', 'Pantry & drinks', /red sauce|tomato sauce|pasta sauce/i],
  ['Soy & chilli sauce', 'Pantry & drinks', /manchurian|chilli (paneer|chicken)|fried rice|soy sauce/i],
  ['Chaat masala & spices', 'Pantry & drinks', /masala|spice|pepper|cumin|jeera|turmeric|haldi/i],
  ['Green chutney ingredients', 'Pantry & drinks', /chutney/i],
];

// Words that, right before an item, describe an amount: "75 grams paneer", "2 tbsp chia seeds", "1 katori curd".
const QTY = /((?:\d+(?:[.\/]\d+)?|½|¼|¾)\s*(?:grams?|gms?|gm|g|ml|tbsp|tsp|cups?|katori|bowls?|glass(?:es)?|scoops?|slices?|pieces?|nos?)?)\s+(?:of\s+)?(?:(?:cooked|chopped|diced|grated|roasted|soaked|fresh|plain|boiled|grilled|sliced|whole|low fat|big|small)\s+)?$/i;

export function groceriesFromText(text) {
  if (!text) return [];
  const found = [];
  const seen = new Set();
  for (const [name, aisle, re] of ITEMS) {
    const m = re.exec(text);
    if (!m || seen.has(name)) continue;
    // Prefer the more specific item when both match (e.g. Greek yoghurt over curd, brown rice over rice).
    seen.add(name);
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const q = aisle === 'Pantry & drinks' ? null : QTY.exec(before);
    found.push({ name, aisle, qty: q ? q[1].trim() : '' });
  }
  const names = new Set(found.map(f => f.name));
  const drop = new Set();
  if (names.has('Greek yoghurt')) drop.add('Curd / yoghurt');
  if (names.has('Brown rice')) drop.add('Rice');
  if (names.has('Herbal tea (chamomile / cinnamon)') || names.has('Green tea')) { /* keep tea/coffee only if mentioned */ }
  if (names.has('Masoor dal (red lentil)') || names.has('Moong dal') || names.has('Horse gram (kulith)')) drop.add('Toor dal');
  if (names.has('Black chana')) drop.add('Chickpeas (chole)');
  if (names.has('Mixed dry fruits') && names.has('Almonds')) { /* both fine */ }
  if (names.has('Peanut butter')) drop.add('Peanuts');
  if (names.has('Dark chocolate') && !/cocoa/i.test(text)) drop.add('Cocoa powder');
  return found.filter(f => !drop.has(f.name));
}

// Ingredient lists typed into a recipe (one per line) are used as-is.
export function groceriesFromIngredients(ingredients) {
  return (ingredients || '').split('\n').map(s => s.replace(/^[-•*\s]+/, '').trim()).filter(Boolean)
    .map(line => {
      const hit = ITEMS.find(([, , re]) => re.test(line));
      return { name: line, aisle: hit ? hit[1] : 'Other', qty: '' };
    });
}

export const AISLES = ['Vegetables & fruit', 'Dairy, eggs & protein', 'Grains & flours', 'Dals & pulses', 'Nuts & seeds', 'Pantry & drinks', 'Other'];
