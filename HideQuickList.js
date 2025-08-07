(function(){
  // only run on Quicklists_r.aspx
  if (!/Quicklists_r\.aspx/i.test(window.location.pathname)) return;

  // wait until DOM is ready
  document.addEventListener('DOMContentLoaded', function(){
    // if you're already using jQuery:
    if (window.jQuery) {
      $('tr.rgRow, tr.rgAltRow').filter(function(){
        return $(this).find('a:contains("Saved For Later")').length > 0;
      }).hide();
    }
    // vanilla-JS fallback:
    else {
      document.querySelectorAll('tr.rgRow, tr.rgAltRow').forEach(function(row){
        // look for a link whose text is exactly “Saved For Later”
        var link = row.querySelector('a');
        if (link && link.textContent.trim() === 'Saved For Later') {
          row.style.display = 'none';
        }
      });
    }
  });
})();