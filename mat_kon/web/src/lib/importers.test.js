import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { fromRecetteTek, mapCategory, needsSource, readRecetteTek } from './importers';

const recipe = {
  title: '‏ עוף ברוטב בצלים ',
  ingredients: 'מגש שוקיים\n5 בצלים\n\n1.5 כוסות מים',
  instructions: '1. מטגנים בצל\n2. מוסיפים עוף',
  quantity: '4 מנות',
  url: 'https://www.10dakot.co.il/recipe/1',
  pictures: ['/data/user/0/fr.recettetek/files/Pictures/abc.png'],
  categories: [{ title: 'קינוח' }],
  rating: 4.0,
  favorite: true,
  notes: 'פחות סוכר',
  lastModifiedDate: '2025-11-28 15:58:20',
  uuid: 'u1',
};

describe('RecetteTek import', () => {
  it('maps a recipe', () => {
    const r = fromRecetteTek(recipe);
    expect(r.title).toBe('עוף ברוטב בצלים');
    expect(r.ingredients[0].items).toEqual(['מגש שוקיים', '5 בצלים', '1.5 כוסות מים']);
    expect(r.steps[0].items).toEqual(['מטגנים בצל', 'מוסיפים עוף']);
    expect(r).toMatchObject({ category: 'קינוחים', servings: '4 מנות', rating: 4, favorite: true, myNotes: 'פחות סוכר', picture: 'abc.png', id: 'u1' });
    expect(r.source.url).toBe('https://www.10dakot.co.il/recipe/1');
    expect(needsSource(r)).toBe(false);
    expect(needsSource(fromRecetteTek({ ...recipe, ingredients: '' }))).toBe(true);
    expect(fromRecetteTek({ title: '  ' })).toBeNull();
  });

  it('keeps unknown categories as the user own', () => {
    expect(mapCategory('יונתן')).toBe('יונתן');
    expect(mapCategory('עוף')).toBe('עוף');
  });

  it('reads the zip with images and categories', () => {
    const zip = zipSync({
      'recipes_0.json': strToU8(JSON.stringify([recipe, { ...recipe, uuid: 'u2', categories: [{ title: 'יונתן' }], pictures: [] }])),
      'categories.json': strToU8(JSON.stringify([{ title: 'קינוח' }, { title: 'יונתן' }, { title: 'מנה עיקרית' }])),
      'abc.png': new Uint8Array([1, 2, 3]),
    });
    const { recipes, categories, images } = readRecetteTek(zip);
    expect(recipes).toHaveLength(2);
    expect(categories).toEqual(['יונתן', 'מנה עיקרית']);
    expect(Object.keys(images)).toEqual(['abc.png']);
    expect(() => readRecetteTek(zipSync({ 'x.json': strToU8('[]') }))).toThrow();
  });
});

describe('more apps: Paprika, Recipe Keeper, Cookmate', () => {
  it('reads a Paprika export (zip of gzipped JSON, photo inside)', async () => {
    const { gzipSync } = await import('fflate');
    const { readImportFile } = await import('./importers');
    const one = {
      uid: 'p1', name: 'שקשוקה', ingredients: '6 ביצים\n4 עגבניות', directions: 'מטגנים\nמוסיפים ביצים', categories: ['ארוחת בוקר'],
      servings: '4', prep_time: '10 דקות', cook_time: '20 דקות', rating: 5, on_favorites: 1, notes: 'חריף', source_url: 'https://site.example/shakshuka',
      photo_data: btoa('jpeg'), created: '2024-01-02 10:00:00',
    };
    const zip = zipSync({ 'שקשוקה.paprikarecipe': gzipSync(strToU8(JSON.stringify(one))), 'x.paprikarecipe': gzipSync(strToU8('{"name":"   "}')) });
    const out = readImportFile(zip);
    expect(out.app).toBe('Paprika');
    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0]).toMatchObject({ title: 'שקשוקה', category: 'ארוחת בוקר', rating: 5, favorite: true, myNotes: 'חריף', servings: '4', id: 'p1' });
    expect(out.recipes[0].ingredients[0].items).toEqual(['6 ביצים', '4 עגבניות']);
    expect(out.recipes[0].source.url).toBe('https://site.example/shakshuka');
    expect(out.images[out.recipes[0].picture]).toBeInstanceOf(Blob);
    expect(out.recipes[0].photoData).toBeUndefined();
    // מתכון בודד (.paprikarecipe – לא ZIP)
    expect(readImportFile(gzipSync(strToU8(JSON.stringify(one)))).recipes[0].title).toBe('שקשוקה');
  });

  it('reads a Recipe Keeper export (recipes.html with itemprop fields and images)', async () => {
    const { readImportFile } = await import('./importers');
    const html = `<html><body>
      <div class="recipe-details">
        <h2 itemprop="name">עוגת שמרים &amp; קינמון</h2>
        <meta content="rk1" itemprop="recipeId">
        <span itemprop="recipeCourse">קינוח</span>
        <span itemprop="recipeYield">12 פרוסות</span>
        <span itemprop="prepTime" content="PT1H20M">1:20</span>
        <meta content="True" itemprop="recipeIsFavourite"><meta content="4" itemprop="recipeRating">
        <div itemprop="recipeIngredients"><p>500 גרם קמח</p><p>1 כף שמרים</p></div>
        <div itemprop="recipeDirections"><p>1. לשים</p><p>2. אופים</p></div>
        <div itemprop="recipeNotes">של סבתא</div>
        <img src="images/cake.jpg" class="recipe-photo">
      </div>
      <div class="recipe-details"><h2 itemprop="name">סלט</h2><div itemprop="recipeIngredients"><p>מלפפון</p></div>
        <span itemprop="recipeSource"><a href="https://salad.example/x">salad</a></span></div>
    </body></html>`;
    const out = readImportFile(zipSync({ 'recipes.html': strToU8(html), 'images/cake.jpg': new Uint8Array([1, 2, 3]) }));
    expect(out.app).toBe('Recipe Keeper');
    expect(out.recipes.map((r) => r.title)).toEqual(['עוגת שמרים & קינמון', 'סלט']);
    const cake = out.recipes[0];
    expect(cake).toMatchObject({ category: 'קינוחים', servings: '12 פרוסות', favorite: true, rating: 4, myNotes: 'של סבתא', id: 'rk1' });
    expect(cake.ingredients[0].items).toEqual(['500 גרם קמח', '1 כף שמרים']);
    expect(cake.steps[0].items).toEqual(['לשים', 'אופים']);
    expect(cake.prepTime).toBe('שעה ו-20 דקות');
    expect(out.images['images/cake.jpg']).toBeInstanceOf(Blob);
    expect(out.recipes[1].source.url).toBe('https://salad.example/x');
  });

  it('reads a Cookmate / My Cookbook export (.mcb zip with XML)', async () => {
    const { readImportFile } = await import('./importers');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><cookbook>
      <recipe><title><![CDATA[מרק עדשים]]></title><preptime>15 דקות</preptime><quantity>6</quantity>
        <ingredient><li>2 כוסות עדשים</li><li>1 בצל</li></ingredient>
        <recipetext><li>מטגנים בצל</li><li>מבשלים 25 דקות</li></recipetext>
        <comments><li>טעים עם לימון</li></comments><category>מרקים</category><category>חורף</category>
        <url>https://soup.example/lentils</url><imagepath>images/soup.jpg</imagepath><rating>3</rating></recipe>
      <recipe><title>   </title></recipe>
    </cookbook>`;
    const out = readImportFile(zipSync({ 'MyCookBook.xml': strToU8(xml), 'images/soup.jpg': new Uint8Array([9]) }));
    expect(out.app).toBe('Cookmate');
    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0]).toMatchObject({ title: 'מרק עדשים', category: 'מרקים', servings: '6', prepTime: '15 דקות', rating: 3, myNotes: 'טעים עם לימון' });
    expect(out.recipes[0].ingredients[0].items).toEqual(['2 כוסות עדשים', '1 בצל']);
    expect(out.recipes[0].source.url).toBe('https://soup.example/lentils');
    expect(out.images['images/soup.jpg']).toBeInstanceOf(Blob);
    // גם XML בלי ZIP
    expect(readImportFile(strToU8(xml)).recipes).toHaveLength(1);
  });

  it('still reads My Recipe Box, and explains an unknown file', async () => {
    const { readImportFile } = await import('./importers');
    const out = readImportFile(zipSync({ 'recipes_0.json': strToU8(JSON.stringify([recipe])) }));
    expect(out.app).toBe('My Recipe Box');
    expect(() => readImportFile(zipSync({ 'readme.txt': strToU8('hi') }))).toThrow('הקובץ הזה לא גיבוי מאפליקציה שאנחנו מכירים');
    expect(() => readImportFile(strToU8('not a zip'))).toThrow('לא הצלחתי לפתוח את הקובץ');
  });
});
