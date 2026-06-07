// Shared utilities for Silver Taxi Sydney Service
window.SSO = window.SSO || {};
SSO.API_BASE = '';

SSO.api = async function(endpoint, data, method = 'POST') {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    const r = await fetch(SSO.API_BASE + endpoint, opts);
    return await r.json();
  } catch(e) {
    console.error('API error:', e);
    return { error: e.message };
  }
};

SSO.formatPhone = function(phone) {
  let p = phone.replace(/\s/g,'');
  if (p.startsWith('04')) return '+61' + p.slice(1);
  if (p.startsWith('614') && !p.startsWith('+')) return '+' + p;
  return p;
};

SSO.toast = function(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'sso-toast sso-toast-' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.classList.add('show'); }, 10);
  setTimeout(function() { el.classList.remove('show'); setTimeout(function() { el.remove(); }, 400); }, 3500);
};

// Safe fallback for pages that use the shared homepage header but do not define their own Google Ads call tracking helper.
if (typeof window.trackPhoneCall !== 'function') {
  window.trackPhoneCall = function(source) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'phone_call', {
          event_category: 'contact',
          event_label: source || 'website_call',
          value: 1
        });
      }
    } catch (e) {
      console.warn('Phone call tracking fallback failed:', e);
    }
    return true;
  };
}

// 2026 premium refresh: normalize desktop navigation labels/order site-wide while preserving existing links and dropdown content.
(function normalizePremiumNavigation(){
  function cleanText(a, label){
    if (!a || !label) return;
    var svg = a.querySelector('svg');
    Array.prototype.slice.call(a.childNodes).forEach(function(node){
      if (node.nodeType === 3) node.nodeValue = '';
    });
    var textNode = document.createTextNode(label + (svg ? ' ' : ''));
    a.insertBefore(textNode, svg || a.firstChild);
    a.setAttribute('aria-label', label);
  }
  function normalize(){
    document.querySelectorAll('.nav-menu').forEach(function(menu){
      var items = Array.prototype.slice.call(menu.children);
      function topHref(li){
        var a = li && li.children && li.children[0] && li.children[0].tagName === 'A' ? li.children[0] : null;
        return a ? a.getAttribute('href') : '';
      }
      var home = items.find(function(li){ return topHref(li) === '/'; });
      var airport = items.find(function(li){ return topHref(li) === '/airport-transfers'; });
      var manage = items.find(function(li){ return topHref(li) === '/manage'; });
      var services = items.find(function(li){ return topHref(li) === '/services'; });
      var areas = items.find(function(li){ return topHref(li) === '/locations/' || topHref(li) === '/locations'; });
      var book = items.find(function(li){ return topHref(li) === '/book'; });
      var about = items.find(function(li){ return topHref(li) === '/about'; });
      var contact = items.find(function(li){ return topHref(li) === '/contact'; });
      [airport, manage].filter(Boolean).forEach(function(li){ li.remove(); });
      var ordered = [home, about, services, areas, contact, book].filter(Boolean);
      if (ordered.length >= 5) ordered.forEach(function(li){ menu.appendChild(li); });
      cleanText(services && services.querySelector('a.nav-link'), 'Services');
      cleanText(areas && areas.querySelector('a.nav-link'), 'Area');
      cleanText(book && book.querySelector('a'), 'Book Now');
      cleanText(about && about.querySelector('a.nav-link'), 'About');
      cleanText(contact && contact.querySelector('a.nav-link'), 'Contact');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize); else normalize();
})();

// 2026 premium logo refresh: install the uploaded brand mark consistently across desktop and mobile headers.
(function normalizePremiumLogo(){
  var logoSrc = '/images/logo.png?v=logo-20260606';
  function makeLogo(className){
    var img = document.createElement('img');
    img.className = className || 'sso-site-logo';
    img.src = logoSrc;
    img.alt = 'Silver Services Taxi Sydney';
    img.loading = 'eager';
    img.decoding = 'async';
    img.width = 1742;
    img.height = 577;
    return img;
  }
  function normalize(){
    document.querySelectorAll('.nav-logo').forEach(function(link){
      var existing = link.querySelector('img');
      if (existing) {
        existing.src = logoSrc;
        existing.alt = 'Silver Services Taxi Sydney';
        existing.classList.add('sso-site-logo');
      } else {
        link.textContent = '';
        link.appendChild(makeLogo('sso-site-logo nav-site-logo'));
      }
      link.classList.add('has-image');
      link.setAttribute('aria-label', 'Silver Services Taxi Sydney home');
    });
    document.querySelectorAll('.mob-logo-link').forEach(function(link){
      var existing = link.querySelector('img');
      if (existing) {
        existing.src = logoSrc;
        existing.alt = 'Silver Services Taxi Sydney';
        existing.classList.add('sso-mobile-site-logo');
      } else {
        link.textContent = '';
        link.appendChild(makeLogo('sso-mobile-site-logo'));
      }
      link.classList.add('has-image');
      link.setAttribute('aria-label', 'Silver Services Taxi Sydney home');
    });
    document.querySelectorAll('.footer-brand-logo, .footer-logo img, img[alt*="Silver"][src*="logo"]').forEach(function(img){
      img.src = logoSrc;
      img.alt = 'Silver Services Taxi Sydney';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize); else normalize();
})();

// Mobile menu behavior lives in /mobile-menu.js so it can be managed independently from shared utilities.
