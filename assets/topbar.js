(function () {
  var bar = document.getElementById('topbar');
  if (!bar) return;

  var onScroll = function () {
    bar.classList.toggle('topbar--scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = bar.querySelector('.topbar-toggle');
  var links = bar.querySelector('.topbar-links');
  if (toggle && links) {
    var closeMenu = function () {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMenu();
    });
    document.addEventListener('click', function (e) {
      if (links.classList.contains('is-open') && !bar.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        closeMenu();
        toggle.focus();
      }
    });
  }
})();
