// Replace only the existing `if (isShoppingCart) { ...external loads... }` block.
// This runs inside the existing inline loader, where loadScriptOnce/onReady exist.
if (isShoppingCart) {
  [
    'WoodsonShoppingCart.js','Guestcheckout.js','Requestquote.js',
    'ShoppingCartBranch.js','ShoppingCartSubtotal.js','cartbranchdropdown.js',
    'Addtocart.js','MetaShop.js','ShoppingCartSummary.js','SavedForLater.js','storeNotification.js',
    'ShoppingCartRow.js','DeliveryOptions.js','UpsShippingPromo.js'
  ].forEach(function (file) {
    loadScriptOnce('https://ckunkel510.github.io/WL.github.io/'+file);
  });
  // Keep native checkout/fallback decorators available without loading them on the basket.
  loadScriptOnce('https://ckunkel510.github.io/WL.github.io/CartNativeViews.js?v=20261106-native-views-1');
}
