

document.addEventListener('DOMContentLoaded', function() {
  // 1) Define your steps: title + a selector pointing at something unique in that section
  var steps = [
    { title: 'Order details',       selector: '#ctl00_PageBody_TransactionTypeDiv'                },
    { title: 'Shipping & date',      selector: '#ctl00_PageBody_dtRequired_DatePicker_wrapper'      },
    { title: 'Your reference',       selector: '#ctl00_PageBody_PurchaseOrderNumberTextBox'         },
    { title: 'Branch',               selector: '#ctl00_PageBody_BranchSelector'                     },
    { title: 'Delivery address',     selector: '.font-weight-bold:contains("Delivery")'             },
    { title: 'Invoice address',      selector: '.font-weight-bold.mt-4:contains("Invoice")'          },
    { title: 'Special instructions', selector: '.cartTable'                                           }
  ];

  // Helper: querySelector with :contains for plain JS
  function queryContains(tagOrSelector, text) {
    var nodes = document.querySelectorAll(tagOrSelector);
    for (var i=0; i<nodes.length; i++) {
      if (nodes[i].textContent.trim().indexOf(text) !== -1) return nodes[i];
    }
    return null;
  }

  // 2) Build the wizard container & nav
  var container = document.querySelector('.container');
  var wizard   = document.createElement('div');
  wizard.className = 'checkout-wizard';
  container.insertBefore(wizard, container.firstChild);

  var nav = document.createElement('ul');
  nav.className = 'checkout-steps';
  wizard.appendChild(nav);

  // 3) For each step, pull its existing DOM into a new pane
  steps.forEach(function(step, i) {
    var stepNum = i + 1;

    // NAV ITEM
    var li = document.createElement('li');
    li.setAttribute('data-step', stepNum);
    li.textContent = step.title;
    li.addEventListener('click', function(){ showStep(stepNum); });
    nav.appendChild(li);

    // PANE
    var pane = document.createElement('div');
    pane.className = 'checkout-step';
    pane.setAttribute('data-step', stepNum);
    wizard.appendChild(pane);

    // FIND & MOVE existing element
    var targetEl = document.querySelector(step.selector)
              || (step.selector.match(/:contains/) && queryContains(step.selector.split(':')[0], step.title));
    if (targetEl) {
      // find an appropriate wrapper
      var wrapper = targetEl.closest('.row, .cartTable, .epi-form-group-checkout');
      pane.appendChild(wrapper);
    }

    // NAV BUTTONS
    var navDiv = document.createElement('div');
    navDiv.className = 'checkout-nav';
    pane.appendChild(navDiv);

    if (stepNum > 1) {
      var back = document.createElement('button');
      back.className = 'btn btn-secondary prev';
      back.textContent = 'Back';
      back.addEventListener('click', function(e){
        e.preventDefault();
        showStep(stepNum - 1);
      });
      navDiv.appendChild(back);
    }

    if (stepNum < steps.length) {
      var next = document.createElement('button');
      next.className = 'btn btn-primary next';
      next.textContent = 'Next';
      next.addEventListener('click', function(e){
        e.preventDefault();
        showStep(stepNum + 1);
      });
      navDiv.appendChild(next);
    } else {
      // LAST STEP: append your real Continue button
      var continues = Array.prototype.slice.call(
        document.querySelectorAll('#ctl00_PageBody_ContinueButton1, #ctl00_PageBody_ContinueButton2')
      );
      if (continues.length) {
        var cont = continues[continues.length - 1];
        cont.style.display = '';           // ensure it's visible
        navDiv.appendChild(cont);
      }
    }
  });

  // 4) function to switch steps
  function showStep(n) {
    // panes
    wizard.querySelectorAll('.checkout-step').forEach(function(p){
      p.classList.toggle('active', parseInt(p.getAttribute('data-step')) === n);
    });
    // nav bullets
    nav.querySelectorAll('li').forEach(function(b){
      var s = parseInt(b.getAttribute('data-step'));
      b.classList.toggle('active', s === n);
      b.classList.toggle('completed', s < n);
    });
    // scroll into view
    window.scrollTo({ top: wizard.offsetTop, behavior: 'smooth' });
  }

  // 5) kick it off
  showStep(1);
});
