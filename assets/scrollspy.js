/* Engage Colorado — section scroll-spy for long-form pages.
 * Highlights the .vnav__chip whose data-target section is in view and keeps
 * it centered in the horizontal nav strip. Used by /honest-assessment and
 * /vision. No-op on pages without a .vnav.
 */
(function () {
  var chips = Array.prototype.slice.call(document.querySelectorAll('.vnav__chip'));
  var strip = document.querySelector('.vnav__inner');
  if (!chips.length) return;
  var byId = {};
  chips.forEach(function (c) { byId[c.dataset.target] = c; });
  function setActive(id) {
    chips.forEach(function (c) { c.classList.toggle('is-active', c.dataset.target === id); });
    var btn = byId[id];
    if (btn && strip) {
      var delta = btn.offsetLeft - strip.scrollLeft - (strip.clientWidth - btn.clientWidth) / 2;
      strip.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-180px 0px -65% 0px', threshold: 0 });
  Object.keys(byId).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el);
  });
})();
