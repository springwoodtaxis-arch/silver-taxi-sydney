// Silver Taxi Sydney Service — robust external mobile menu controller
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    var toggle = document.getElementById('nav-toggle');
    var panel = document.getElementById('mob-panel');
    var overlay = document.getElementById('mob-overlay');
    var closeBtn = document.getElementById('mob-close-btn');
    var focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;
    var lastMenuToggle = 0;
    var lastPanelAction = 0;
    var lastPanelControl = null;
    var lastSyntheticClickUntil = 0;
    var lastOverlayAction = 0;

    if (!toggle || !panel || !overlay) return;

    var accordionMap = {
      'mob-services-btn': document.getElementById('mob-services-panel'),
      'mob-airport-btn': document.getElementById('mob-airport-panel'),
      'mob-areas-btn': document.getElementById('mob-areas-panel')
    };

    function eachAccordion(callback) {
      Object.keys(accordionMap).forEach(function (buttonId) {
        var btn = document.getElementById(buttonId);
        var section = accordionMap[buttonId];
        if (btn && section) callback(btn, section);
      });
    }

    panel.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('aria-controls', 'mob-panel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');

    if (closeBtn) closeBtn.setAttribute('type', 'button');

    eachAccordion(function (btn, section) {
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-controls', section.id);
      btn.setAttribute('aria-expanded', 'false');
      section.setAttribute('aria-hidden', 'true');
    });

    function setAccordion(btn, section, open) {
      btn.classList.toggle('open', open);
      section.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      section.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function closeAccordions(exceptBtn) {
      eachAccordion(function (btn, section) {
        if (exceptBtn && btn === exceptBtn) return;
        setAccordion(btn, section, false);
      });
    }

    function firstFocusable() {
      var items = panel.querySelectorAll(focusableSelector);
      return items.length ? items[0] : null;
    }

    function openMenu() {
      if (panel.classList.contains('open')) return;
      lastFocused = document.activeElement;
      panel.classList.add('open');
      overlay.classList.add('open');
      toggle.classList.add('active');
      document.documentElement.classList.add('mob-menu-open');
      document.body.classList.add('mob-menu-open');
      panel.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      /* Avoid forcing focus on open; on real mobile browsers it can trigger slow scroll/layout work. */
    }

    function closeMenu(restoreFocus) {
      if (!panel.classList.contains('open')) return;
      panel.classList.remove('open');
      overlay.classList.remove('open');
      toggle.classList.remove('active');
      document.documentElement.classList.remove('mob-menu-open');
      document.body.classList.remove('mob-menu-open');
      panel.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      closeAccordions();
      if (restoreFocus !== false && lastFocused && typeof lastFocused.focus === 'function' && !('ontouchstart' in window)) {
        window.setTimeout(function () { lastFocused.focus({ preventScroll: true }); }, 20);
      }
    }

    function toggleMenu() {
      if (panel.classList.contains('open')) closeMenu(true);
      else openMenu();
    }

    function consume(event) {
      if (!event) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function activateMenuToggle(event) {
      if (event && event.type === 'pointerup' && event.isPrimary === false) return;
      consume(event);
      var now = Date.now();
      if (now - lastMenuToggle < 140) return;
      lastMenuToggle = now;
      toggleMenu();
    }

    function handleOverlayAction(event) {
      if (!isPrimaryActivation(event)) return;
      consume(event);
      var now = Date.now();
      if (now - lastOverlayAction < 220) return;
      lastOverlayAction = now;
      if (event.type !== 'click') lastSyntheticClickUntil = now + 700;
      closeMenu(true);
    }

    function isPrimaryActivation(event) {
      if (!event) return false;
      if (event.type === 'pointerup') return event.isPrimary !== false;
      return event.type === 'touchend' || event.type === 'click';
    }

    function navigateFromMenuLink(link) {
      closeMenu(false);
      var href = link.getAttribute('href');
      if (!href) return;
      window.location.href = link.href;
    }

    function handlePanelAction(event) {
      if (!isPrimaryActivation(event)) return;
      var target = event.target;
      if (!target || !panel.contains(target)) return;

      var control = target.closest('.mob-nav-item, .mob-call-btn, button, a[href]');
      if (!control || !panel.contains(control)) return;

      var now = Date.now();
      if (event.type === 'click' && now < lastSyntheticClickUntil) {
        consume(event);
        return;
      }

      if (control === lastPanelControl && now - lastPanelAction < 220) {
        consume(event);
        return;
      }
      lastPanelControl = control;
      lastPanelAction = now;

      if (control.tagName === 'A') {
        consume(event);
        if (event.type !== 'click') lastSyntheticClickUntil = now + 700;
        navigateFromMenuLink(control);
        return;
      }

      if (control === closeBtn || control.id === 'mob-close-btn') {
        consume(event);
        if (event.type !== 'click') lastSyntheticClickUntil = now + 700;
        closeMenu(true);
        return;
      }

      if (accordionMap[control.id]) {
        consume(event);
        if (event.type !== 'click') lastSyntheticClickUntil = now + 700;
        var section = accordionMap[control.id];
        var willOpen = !section.classList.contains('open');
        closeAccordions(control);
        setAccordion(control, section, willOpen);
        return;
      }

    }

    if (window.PointerEvent) {
      toggle.addEventListener('pointerup', activateMenuToggle, { passive: false });
      panel.addEventListener('pointerup', handlePanelAction, { passive: false, capture: true });
    } else {
      toggle.addEventListener('touchend', activateMenuToggle, { passive: false });
      panel.addEventListener('touchend', handlePanelAction, { passive: false, capture: true });
    }

    toggle.addEventListener('click', activateMenuToggle, { passive: false });
    panel.addEventListener('click', handlePanelAction, { passive: false, capture: true });

    if (window.PointerEvent) {
      overlay.addEventListener('pointerup', handleOverlayAction, { passive: false });
    } else {
      overlay.addEventListener('touchend', handleOverlayAction, { passive: false });
    }
    overlay.addEventListener('click', handleOverlayAction, { passive: false });

    document.addEventListener('keydown', function (event) {
      if (!panel.classList.contains('open')) return;

      if (event.key === 'Escape') {
        consume(event);
        closeMenu(true);
        return;
      }

      if (event.key !== 'Tab') return;
      var items = Array.prototype.slice.call(panel.querySelectorAll(focusableSelector))
        .filter(function (el) { return el.offsetParent !== null || el === closeBtn; });
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024 && panel.classList.contains('open')) closeMenu(false);
    });

    var path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-link, .mob-links a').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('tel:') === 0 || href.indexOf('mailto:') === 0) return;
      var hrefPath = href.split('#')[0].replace(/\/$/, '') || '/';
      if (hrefPath === path || (path === '/' && hrefPath === '/') || (hrefPath !== '/' && path.indexOf(hrefPath) === 0)) {
        link.classList.add('active');
      }
    });
  });
})();
