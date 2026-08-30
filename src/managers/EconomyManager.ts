/** Economy facade — cash, revenue, upgrade costs tracked in Simulation */
export type EconomySnapshot = {
  cash: number;
  revenueToday: number;
  expensesToday: number;
};
