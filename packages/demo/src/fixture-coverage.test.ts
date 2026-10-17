import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSandbox } from "../index";

test("cafe fixture has exact menu identities and realistic cashier, modifier, tier and table history", () => {
  const sandbox = createDemoSandbox(new Date("2026-10-13T05:00:00Z"));
  sandbox.run({ type: "session.owner" });
  const state = sandbox.getSnapshot();
  const menus = ["Espresso", "Americano", "Cappuccino", "Caffe Latte", "Kopi Susu Gula Aren", "Matcha Latte", "Chocolate Latte", "Lemon Tea", "Butter Croissant", "French Fries"];
  assert.equal(state.employees.length, 4);
  for (const outlet of state.outlets) {
    assert.deepEqual(state.products.filter(product => product.outlet_id === outlet.id).map(product => product.name), menus);
    const employees = state.employees.filter(employee => employee.outlet_ids.includes(outlet.id));
    assert.equal(employees.length, 2);
    const history = state.orders.filter(order => order.outlet_id === outlet.id && order.status === "completed");
    assert.equal(history.length, 60);
    for (const employee of employees) {
      const orders = history.filter(order => order.cashier_id === employee.id);
      assert.equal(orders.length, 30);
      assert.ok(orders.every(order => order.cashier_name === employee.name));
    }
    assert.equal(new Set(history.map(order => order.tier_id)).size, 4);
    assert.equal(new Set(history.map(order => order.order_type)).size, 4);
    assert.equal(new Set(history.map(order => order.payment_method)).size, 3);
    assert.ok(history.some(order => order.table_id !== null));
    assert.ok(history.some(order => order.items.some(item => item.modifier_label !== null)));
    for (const movement of state.movements.filter(m => m.outlet_id === outlet.id && m.type === "sale_deduction")) {
      assert.equal(movement.created_by, history.find(order => order.id === movement.reference_id)?.cashier_id);
    }
    const tea = state.products.find(product => product.outlet_id === outlet.id && product.name === "Lemon Tea")!;
    assert.equal(tea.modifiers.length, 0);
  }
  sandbox.destroy();
});
