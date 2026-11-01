/* Boot: build the screen, then show the title. */
(function (root) {
  'use strict';
  var BK = root.BK;

  function boot() {
    BK.UI.init();
    if (BK.Music && BK.Music.setEnabled && !BK.UI.settings.music) BK.Music.setEnabled(false);
    BK.Title.show();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
