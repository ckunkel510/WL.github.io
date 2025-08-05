document.addEventListener('DOMContentLoaded', function() {
  // 1) Grab your container and build the wizard shell
  var container = document.querySelector('.container');
  var wizard   = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);

  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 2) Define each step and which existing elements to move
  var steps = [
    {
      title: 'Order details',
      paneEls: [
        document.querySelector('#ctl00_PageBody_TransactionTypeDiv')
                .closest('.epi-form-col-single-checkout')
      ]
    },
    {
      title: 'Shipping & date',
      paneEls: [
        // shipping method column
        document.querySelector('#ctl00_PageBody_SaleTypeSelector_lblDelivered')
                .closest('.epi-form-col-single-checkout'),
        // date required column
        document.querySelector('#ctl00_PageBody_dtRequired_DatePicker_wrapper')
                .closest('.epi-form-col-single-checkout')
      ]
    },
    {
      title: 'Your reference',
      paneEls: [
        document.querySelector('#ctl00_PageBody_PurchaseOrderNumberTextBox')
                .closest('.epi-form-group-checkout')
      ]
    },
    {
      title: 'Branch',
      paneEls: [
        document.querySelector('#ctl00_PageBody_BranchSelector')
                .closest('.epi-form-col-both-checkout')
      ]
    },
    {
      title: 'Delivery address',
      paneEls: [
        document.querySelector('.SelectableAddressType')
                .closest('.epi-form-col-single-checkout')
      ]
    },
    {
      title: 'Invoice address',
      paneEls: [
        document.querySelector(
          '.font-weight-bold.mt-4:contains("Invoice")'
        )?.closest('.epi-form-col-single-checkout')
      ]
    },
    {
      title: 'Special instructions',
      paneEls: [
        document.querySelector('.cartTable')
      ]
    }
  ];

  // 3) Build each step in the DOM
  steps.forEach(function(step, i) {
    var idx = i + 1;

    // Nav bullet
    var li = document.createElement('li');
    li.setAttribute('data-step', idx);
    li.textContent = step.title;
    li.addEventListener('click', function() { showStep(idx); });
    nav.appendChild(li);

    // Content pane
    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.setAttribute('data-step', idx);
    wizard.appendChild(pane);

    // Move each element into this pane
    step.paneEls.forEach(function(el) {
      if (el) pane.appendChild(el);
    });

    // Back / Next buttons
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (idx > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary';
      back.textContent = 'Back';
      back.addEventListener('click', function(e) {
        e.preventDefault();
        showStep(idx - 1);
      });
      navDiv.appendChild(back);
    }

    if (idx < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary';
      next.textContent = 'Next';
      next.addEventListener('click', function(e) {
        e.preventDefault();
        showStep(idx + 1);
      });
      navDiv.appendChild(next);
    } else {
      // last step: pull in your real Continue button
      var continues = Array.from(
        document.querySelectorAll(
          '#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2'
        )
      );
      if (continues.length) {
        var cont = continues[continues.length - 1];
        cont.style.display = '';
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) Step switcher
  function showStep(n) {
    wizard.querySelectorAll('.checkout-step').forEach(function(p) {
      p.classList.toggle('active',
        parseInt(p.getAttribute('data-step'), 10) === n
      );
    });
    nav.querySelectorAll('li').forEach(function(b) {
      var s = parseInt(b.getAttribute('data-step'), 10);
      b.classList.toggle('active',    s === n);
      b.classList.toggle('completed', s <  n);
    });
    // scroll into view
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }

  // 5) Immediately open step 1
  showStep(1);
});