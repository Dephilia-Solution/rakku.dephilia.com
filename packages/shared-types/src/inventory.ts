export type IngredientUnit = "gram" | "ml" | "pcs" | "kg" | "liter";

export interface Ingredient {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  unit: IngredientUnit;
  stock_quantity: number;
  min_stock_alert: number;
  cost_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductRecipe {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_used: number;
  created_at: string;
}

export interface ProductRecipeWithIngredient extends ProductRecipe {
  ingredient_name: string;
  ingredient_unit: IngredientUnit;
}

export type StockMovementType = "purchase" | "sale_deduction" | "adjustment" | "waste";

export interface StockMovement {
  id: string;
  company_id: string;
  outlet_id: string;
  ingredient_id: string;
  type: StockMovementType;
  quantity_change: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  outlet_id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}

export interface IngredientPurchaseItem {
  id: string;
  purchase_id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface IngredientPurchase {
  id: string;
  company_id: string;
  outlet_id: string;
  supplier_name: string | null;
  total_amount: number;
  purchase_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type DiningTableStatus = "available" | "occupied";

export interface DiningTable {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  status: DiningTableStatus;
  created_at: string;
}

export interface PublicMenuProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  products: PublicMenuProduct[];
}

export interface PublicMenu {
  outletName: string;
  categories: PublicMenuCategory[];
}
