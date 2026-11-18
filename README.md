# Family Diet Plan

A phone-friendly website (installable like an app) for our family's diet plan:

- **Plan**: each person's day, meal by meal (7:00 AM, 8:30 AM, 11:00 AM, 1:00 PM, 4:30 PM, 7:00 PM). Load any day from the Week 1–8 diet charts, build a day from your recipes, or copy the previous day. Calories planned and eaten are shown against each person's daily goal.
- **Logging**: mark each meal Done, Changed (say what you ate instead and its calories) or Skipped.
- **Swap**: swap any meal for a suggestion from the diet charts or your recipes, or type your own.
- **Meal details**: tap a meal to see how to make it, its linked recipe, a grocery checklist and a link to Vencut Cook videos.
- **Grocery list**: for the day or the next 7 days, for one person or the whole family. Share or copy it.
- **Recipes**: your recipe collection, with links, videos, ingredients and calories.
- **Family**: everyone's progress: meals logged, calories, % on plan, streaks and weight.

It is plain HTML/CSS/JS with no build step. Data syncs between phones through a free Supabase project.

## One-time setup (about 10 minutes)

### 1. Supabase (free shared database)
1. Sign up at https://supabase.com and create a new project (free plan).
2. Open **SQL Editor → New query**, paste everything from `schema.sql`, and click **Run**.
3. Open **Authentication → Users → Add user → Create new user**. Make one family login (an email and password everyone will use). Tick "Auto confirm user".
4. Open **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**, so only your family login works.
5. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key into `config.js`.

### 2. Free hosting (GitHub Pages)
1. Put these files in a GitHub repository.
2. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

(Netlify also works: drag this folder onto https://app.netlify.com/drop.)

### 3. On each phone
Open the link, sign in with the family login, and pick who you are.
- iPhone: Safari → Share → **Add to Home Screen**.
- Android: Chrome → ⋮ → **Install app**.

## Notes
- Without Supabase details in `config.js`, the app still works but saves data only on that one device.
- The diet charts don't list calories, so chart meals use rough estimates per meal (marked "est."). Edit any meal to set exact numbers.
- Settings → Download backup saves everything to a file.
