(function(){
  'use strict';
  if (!/AccountPayment_r\.aspx/i.test(location.pathname)) return;

  function $(id){ return document.getElementById(id); }

  const url = new URL(location.href);
  const invoicesParam = url.searchParams.get('utm_invoices') || ''; // e.g. "12345,45678"
  const totalParam    = url.searchParams.get('utm_total')    || ''; // e.g. "12.34"

  // Fill Amount
  const amt = $('ctl00_PageBody_PaymentAmountTextBox');
  if (amt && totalParam){
    // Put exactly the number string (12.34). The server-side will format/validate.
    amt.value = totalParam;
    // Fire change so the ASP.NET postback runs as if typed by user
    setTimeout(()=> {
      amt.dispatchEvent(new Event('change', { bubbles:true }));
    }, 0);
  }

  // Fill Remittance Advice with the invoice list
  const rem = $('ctl00_PageBody_RemittanceAdviceTextBox');
  if (rem && invoicesParam){
    // If it’s empty, just drop the list. If not, append.
    if (!rem.value.trim()){
      rem.value = invoicesParam; // e.g. "12345,45678"
    } else {
      rem.value = `${rem.value.trim()}\n${invoicesParam}`;
    }
  }
})();
