/** Logistics — warehouse stock + runner dispatch (Simulation.updateStaff / buyWarehouseStock) */
export type LogisticsSnapshot = {
  warehouseStock: number;
  pendingRestocks: number;
};
