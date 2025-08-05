document.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.container');
  var wizard    = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);

  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // Step definitions with pure JS finders
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
        var br = document.getElementById('ctl00_PageBody_BranchSelector');
        return br && br.closest('.epi-form-col-both-checkout')
          ? [br.closest('.epi-form-col-both-checkout')]
          : [];
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
        var headers = document.querySelectorAll('.font-weight-bold.mb-3.mt-4');
        for (var i=0; i<headers.length; i++) {
          if (headers[i].textContent.trim().toLowerCase().startsWith('invoice address')) {
            var wrap = headers[i].closest('.epi-form-col-single-checkout');
            if (wrap) return [wrap];
          }
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

  // Build the wizard steps & panes
  steps.forEach(function(step, idx) {
    var stepNum = idx + 1;
    // Nav bullet
    var li = document.createElement('li');
    li.setAttribute('data-step', stepNum);
    li.textContent = step.title;
    li.addEventListener('click', function(){ showStep(stepNum); });
    nav.appendChild(li);

    // Pane
    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.setAttribute('data-step', stepNum);
    wizard.appendChild(pane);

    // Pull in existing elements
    var els = step.findEls();
    els.forEach(function(el) {
      if (el) pane.appendChild(el);
    });

    // Nav buttons
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (stepNum > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', function(e){
        e.preventDefault();
        showStep(stepNum - 1);
      });
      navDiv.appendChild(back);
    }

    if (stepNum < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', function(e){
        e.preventDefault();
        showStep(stepNum + 1);
      });
      navDiv.appendChild(next);
    } else {
      // final step: append real Continue button
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

  // Step switching logic
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

  // Open step 1 immediately
  showStep(1);
});