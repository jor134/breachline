// Store build settings. gate: 'iap' = free download, the full game is one durable add-on bought through Meta (Digital Goods API);
// 'none' = everything unlocked (use this if the game is ever listed as a paid app instead).
export const STORE = {
  appId: '1766163904906396',                 // Meta Horizon App ID (not secret)
  billing: 'https://quest.meta.com/billing', // Meta's Digital Goods / PaymentRequest method
  sku: 'full_game',                          // the add-on's SKU in the Developer Dashboard (durable)
  gate: 'iap',
  demoMaps: ['training', 'mansion'],         // free: the training facility and the mansion, solo
};
