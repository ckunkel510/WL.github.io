document.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);

  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  var steps = [
    {
      title: 'Order details',
      findEls: function() {
        var tx = document.getElementById('ctl00_PageBody_TransactionTypeDiv');
        return tx && tx.closest('.epi-form-col-single-checkout')
          ? [tx.closest('.epi-form-col-single-checkout')]
          : [];
      }
    },
    {
      title: 'Shipping & date',
      findEls: function() {
        var ship = document.getElementById('ctl00_PageBody_SaleTypeSelector_lblDelivered');
        var date = document.getElementById('ctl00_PageBody_dtRequired_DatePicker_wrapper');
        var arr = [];
        if (ship) arr.push(ship.closest('.epi-form-col-single-checkout'));
        if (date) arr.push(date.closest('.epi-form-col-single-checkout'));
        return arr;
      }
    },
    {
      title: 'Your reference',
      findEls: function() {
        var po = document.getElementById('ctl00_PageBody_PurchaseOrderNumberTextBox');
        return po && po.closest('.epi-form-group-checkout')
          ? [po.closest('.epi-form-group-checkout')]
          : [];
      }
    },
    {
      title: 'Branch',
      findEls: function() {
        var brRow = document.getElementById('ctl00_PageBody_BranchSelector');
        return brRow ? [brRow] : [];
      }
    },
    {
      title: 'Delivery address',
      findEls: function() {
        var hdr = document.querySelector('.SelectableAddressType');
        return hdr && hdr.closest('.epi-form-col-single-checkout')
          ? [hdr.closest('.epi-form-col-single-checkout')]
          : [];
      }
    },
    {
      title: 'Invoice address',
      findEls: function() {
        // grab the Google-Places wrapper inside the invoice panel,
        // then move its outer `.epi-form-col-single-checkout` container
        var gp = document.getElementById('ctl00_PageBody_InvoiceAddress_GoogleAddressSearchWrapper');
        if (gp) {
          var wrap = gp.closest('.epi-form-col-single-checkout');
          if (wrap) return [wrap];
        }
        return [];
      }
    },
    {
      title: 'Special instructions',
      findEls: function() {
        var tbl = document.querySelector('.cartTable');
        return tbl ? [tbl] : [];
      }
    }
  ];

  // build the steps & panes
  steps.forEach(function(step, i) {
    var num = i + 1;
    // nav bullet
    var li = document.createElement('li');
    li.setAttribute('data-step', num);
    li.textContent = step.title;
    li.addEventListener('click', function(){ showStep(num); });
    nav.appendChild(li);

    // pane
    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.setAttribute('data-step', num);
    wizard.appendChild(pane);

    // move in existing elements
    step.findEls().forEach(function(el){
      pane.appendChild(el);
    });

    // back/next buttons
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (num > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', function(e){
        e.preventDefault();
        showStep(num - 1);
      });
      navDiv.appendChild(back);
    }
    if (num < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', function(e){
        e.preventDefault();
        showStep(num + 1);
      });
      navDiv.appendChild(next);
    } else {
      // final: your real Continue
      var allCont = Array.from(
        document.querySelectorAll('#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2')
      );
      if (allCont.length) {
        var cont = allCont[allCont.length - 1];
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', +p.getAttribute('data-step') === n);
    });
    nav.querySelectorAll('li').forEach(function(b){
      var s = +b.getAttribute('data-step');
      b.classList.toggle('active',    s === n);
      b.classList.toggle('completed', s <  n);
    });
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }

  // immediately open step 1
  showStep(1);
});