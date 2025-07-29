
document.addEventListener("DOMContentLoaded", function () {
  console.log("[CartFix-1283] 🔍 Script loaded. Attempting targeted line-item removal.");

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = "/Products.aspx"; // use any valid page with working VIEWSTATE
  document.body.appendChild(iframe);

  iframe.onload = function () {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      const vs = doc.querySelector('input[name="__VIEWSTATE"]');
      const ev = doc.querySelector('input[name="__EVENTVALIDATION"]');
      const vsg = doc.querySelector('input[name="__VIEWSTATEGENERATOR"]');

      if (!vs || !ev) {
        console.warn("[CartFix-1283] ❌ Missing __VIEWSTATE or __EVENTVALIDATION.");
        return;
      }

      const payload = [
        ["__EVENTTARGET", "ctl00$PageBody$CartLineControl_1283$del_0"],
        ["__EVENTARGUMENT", ""],
        ["__VIEWSTATE", vs.value],
        ["__EVENTVALIDATION", ev.value]
      ];

      if (vsg) {
        payload.push(["__VIEWSTATEGENERATOR", vsg.value]);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/ShoppingCart.aspx";
      form.style.display = "none";

      for (const [name, value] of payload) {
        const input = document.createElement("input");
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);

      console.log("[CartFix-1283] 🧾 Built form with:");
      console.table(Object.fromEntries(payload));

      console.log("[CartFix-1283] ⏳ Submitting in 5 seconds...");
      setTimeout(() => {
        console.log("[CartFix-1283] 🚀 Submitting to delete BasketLineID 1283...");
        form.submit();
      }, 5000);
    } catch (err) {
      console.error("[CartFix-1283] ❌ Error during form construction or submission:", err);
    }
  };
});

