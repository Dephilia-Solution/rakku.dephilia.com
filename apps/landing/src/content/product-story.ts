// Product examples follow the same fixture/recipe used by the commercial:
// packages/demo/src/fixture.ts; remotion/src/data/demoSnapshot.ts.
// These are illustrative catalog/transaction values, not merchant results.
export const recipeExample = {
  productName: "Kopi Susu Gula Aren",
  portions: 2,
  ingredients: [
    {name: "Biji kopi", perPortion: 18, unit: "g"},
    {name: "Susu full cream", perPortion: 150, unit: "ml"},
    {name: "Sirup gula aren", perPortion: 25, unit: "ml"},
    {name: "Air mineral", perPortion: 30, unit: "ml"},
    {name: "Es batu", perPortion: 100, unit: "g"},
  ],
} as const;

export const menuPreview = [
  {id: "kopi-susu-gula-aren", image: "/images/kopsuaren.webp", category: "Coffee", name: "Kopi Susu Gula Aren", price: 26000},
  {id: "caffe-latte", image: "/images/caffelatte.webp", category: "Coffee", name: "Caffe Latte", price: 30000},
  {id: "espresso", image: "/images/espresso.webp", category: "Coffee", name: "Espresso", price: 18000},
  {id: "butter-croissant", image: "/images/croissant.webp", category: "Food", name: "Butter Croissant", price: 24000},
] as const;

// The commercial's seven-day Owner dashboard after the illustrated sale.
export const dashboardExample = {sales: 2627148, transactions: 29, favorite: "Americano", lowStock: 2} as const;
export const exampleMoney = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
