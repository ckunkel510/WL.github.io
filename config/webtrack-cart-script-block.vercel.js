// Replace only the existing `if (isShoppingCart) { ...external loads... }` block.
// This runs inside the existing inline loader, where loadScriptOnce/onReady exist.
if (isShoppingCart) {
  [
    'WoodsonShoppingCart.js','Guestcheckout.js','Requestquote.js',
    'ShoppingCartBranch.js?v=20261106-native-ready-1','ShoppingCartSubtotal.js','cartbranchdropdown.js',
    'Addtocart.js','ShoppingCartSummary.js','SavedForLater.js','storeNotification.js',
    'ShoppingCartRow.js?v=20261106-native-ready-1','DeliveryOptions.js?v=20261106-native-ready-1','UpsShippingPromo.js'
  ].forEach(function (file) {
    loadScriptOnce('https://wl-upsrates.vercel.app/'+file);
  });
  // Optional measurement retains its existing independent delivery path.
  loadScriptOnce('https://ckunkel510.github.io/WL.github.io/MetaShop.js');
  // Keep native checkout/fallback decorators available without loading them on the basket.
  loadScriptOnce('https://wl-upsrates.vercel.app/CartNativeViews.js?v=20261106-native-views-1');
}
