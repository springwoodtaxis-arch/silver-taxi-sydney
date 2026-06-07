#!/usr/bin/env python3
"""
Upgrade the navigation and footer on index.html with premium mega-menu and redesigned footer.
This script replaces the navbar, mobile menu, and footer sections.
"""
import re

# ── NEW NAVBAR HTML ──
NEW_NAVBAR = '''<nav class="navbar" id="navbar">
<div class="nav-inner">
<a class="nav-logo" href="/">
<div class="nav-logo-text">
<span>Silver Service</span>
<span>Taxi Sydney</span>
</div>
</a>
<ul class="nav-menu" id="nav-menu">
<li><a class="nav-link" href="/">Home</a></li>
<li class="nav-item">
<a class="nav-link" href="/services">Services
<svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
</a>
<div class="mega-dropdown mega-services">
<div class="mega-panel">
<a href="/airport-transfers" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/><path d="M12 17v4M8 21h8"/><path d="M14.5 3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Airport Transfers</span><span class="mega-service-desc">Fixed-fare pickups & drop-offs at SYD & WSA</span></div>
</a>
<a href="/services#corporate" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Corporate Transfers</span><span class="mega-service-desc">Executive travel for business professionals</span></div>
</a>
<a href="/services#chauffeur" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M9 4.5C9 3.12 10.12 2 11.5 2h1c1.38 0 2.5 1.12 2.5 2.5"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Chauffeur Service</span><span class="mega-service-desc">Personal chauffeur for any occasion</span></div>
</a>
<a href="/services#events" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Event Transfers</span><span class="mega-service-desc">Weddings, galas & special occasions</span></div>
</a>
<a href="/services#cruise" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><path d="M3 18h18"/><path d="M5 18V8l7-4 7 4v10"/><path d="M2 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/><circle cx="12" cy="12" r="2"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Cruise Transfers</span><span class="mega-service-desc">Sydney cruise terminal pickups & drop-offs</span></div>
</a>
<a href="/services#hourly" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Hourly Hire</span><span class="mega-service-desc">Flexible hourly chauffeur bookings</span></div>
</a>
<a href="/services#vip" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">VIP Luxury Service</span><span class="mega-service-desc">Premium Lexus fleet for VIP clients</span></div>
</a>
</div>
</div>
</li>
<li class="nav-item">
<a class="nav-link" href="/airport-transfers">Airport
<svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
</a>
<div class="mega-dropdown mega-airport">
<div class="mega-panel">
<div class="mega-airport-grid">
<div class="mega-airport-card">
<div class="mega-airport-icon"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
<span class="mega-airport-name">SYD Airport</span>
<span class="mega-airport-sub">Sydney Kingsford Smith</span>
<div class="mega-airport-terminals">
<a href="/airport-transfers#domestic" class="mega-terminal-link"><span class="mega-terminal-dot"></span><span class="mega-terminal-text">Domestic Terminal (T2/T3)</span></a>
<a href="/airport-transfers#international" class="mega-terminal-link"><span class="mega-terminal-dot"></span><span class="mega-terminal-text">International Terminal (T1)</span></a>
</div>
</div>
<div class="mega-airport-card">
<div class="mega-airport-icon"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/><path d="M8 21h8"/><path d="M12 17v4"/><circle cx="12" cy="3" r="1" fill="currentColor"/></svg></div>
<span class="mega-airport-name">WSA Airport</span>
<span class="mega-airport-sub">Western Sydney International</span>
<div class="mega-airport-terminals">
<a href="/locations/western-sydney-airport/" class="mega-terminal-link"><span class="mega-terminal-dot"></span><span class="mega-terminal-text">Main Terminal — Luddenham</span></a>
</div>
</div>
</div>
</div>
</div>
</li>
<li class="nav-item">
<a class="nav-link" href="/locations/">Areas
<svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
</a>
<div class="mega-dropdown mega-areas">
<div class="mega-panel">
<div class="mega-areas-header">
<span class="mega-areas-title">Service Areas</span>
<a href="/locations/" class="mega-areas-viewall">View All 400+ Areas &rarr;</a>
</div>
<div class="mega-areas-grid">
<a href="/locations/sydney-cbd/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div><span class="mega-area-name">City of Sydney</span></a>
<a href="/locations/parramatta/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg></div><span class="mega-area-name">Parramatta</span></a>
<a href="/locations/blacktown/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div><span class="mega-area-name">Blacktown</span></a>
<a href="/locations/bankstown/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div><span class="mega-area-name">Canterbury-Bankstown</span></a>
<a href="/locations/manly/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M2 20c2-2 4-3 6-3s4 1 6 3 4 3 6 3"/><path d="M12 4v12"/><path d="M8 8c2-2 4-3 4-3s2 1 4 3"/></svg></div><span class="mega-area-name">Northern Beaches</span></a>
<a href="/locations/castle-hill/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div><span class="mega-area-name">Hills District</span></a>
<a href="/locations/newtown/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div><span class="mega-area-name">Inner West</span></a>
<a href="/locations/bondi/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M2 20c2-2 4-3 6-3s4 1 6 3 4 3 6 3"/><circle cx="17" cy="8" r="3"/></svg></div><span class="mega-area-name">Eastern Suburbs</span></a>
<a href="/locations/cronulla/" class="mega-area-link"><div class="mega-area-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div><span class="mega-area-name">Sutherland Shire</span></a>
</div>
</div>
</div>
</li>
<li><a class="nav-link" href="/about">About</a></li>
<li><a class="nav-link" href="/contact">Contact</a></li>
<li><a class="nav-book-btn" href="/book">Book Now</a></li>
</ul>
<button aria-label="Toggle menu" class="nav-toggle" id="nav-toggle">
<span></span><span></span><span></span>
</button>
</div>
</nav>'''

# ── NEW MOBILE MENU HTML ──
NEW_MOBILE_MENU = '''<div id="mob-overlay" style="display:none"></div>
<div id="mob-panel" style="display:none">
<!-- Header -->
<div class="mob-header">
  <a href="/" class="mob-logo-link">
    <div class="mob-logo-text">
      <span class="mob-logo-top">Silver Service</span>
      <span class="mob-logo-sub">Taxi Sydney</span>
    </div>
  </a>
  <button aria-label="Close menu" class="mob-close" id="mob-close-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
</div>
<nav class="mob-links" id="mob-links">
  <!-- Home -->
  <a href="/" class="mob-nav-item">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg></span>
    <span class="mob-nav-label">Home</span>
  </a>
  <!-- Services Toggle -->
  <button class="mob-nav-item" id="mob-services-btn" aria-expanded="false">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
    <span class="mob-nav-label">Services</span>
    <svg class="mob-toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  <!-- Services Panel -->
  <div class="mob-services-panel" id="mob-services-panel">
    <a href="/airport-transfers" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/><path d="M12 17v4M8 21h8"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Airport Transfers</span><span class="mob-service-link-desc">Fixed-fare pickups & drop-offs</span></div>
    </a>
    <a href="/maxi-taxi" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 17v2M17 17v2M8 11h8M6 7l2-3h8l2 3"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Maxi Taxi</span><span class="mob-service-link-desc">7-11 seat group taxi service</span></div>
    </a>
    <a href="/services#corporate" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Corporate Transfers</span><span class="mob-service-link-desc">Executive business travel</span></div>
    </a>
    <a href="/services#chauffeur" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Chauffeur Service</span><span class="mob-service-link-desc">Personal chauffeur for any occasion</span></div>
    </a>
    <a href="/services#events" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Event Transfers</span><span class="mob-service-link-desc">Weddings, galas & special events</span></div>
    </a>
    <a href="/services#cruise" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><path d="M3 18h18"/><path d="M5 18V8l7-4 7 4v10"/><circle cx="12" cy="12" r="2"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Cruise Transfers</span><span class="mob-service-link-desc">Sydney cruise terminal service</span></div>
    </a>
    <a href="/services#hourly" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">Hourly Hire</span><span class="mob-service-link-desc">Flexible hourly chauffeur bookings</span></div>
    </a>
    <a href="/services#vip" class="mob-service-link">
      <div class="mob-service-link-icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
      <div class="mob-service-link-text"><span class="mob-service-link-title">VIP Luxury Service</span><span class="mob-service-link-desc">Premium Lexus fleet for VIP clients</span></div>
    </a>
  </div>
  <!-- Airport Toggle -->
  <button class="mob-nav-item" id="mob-airport-btn" aria-expanded="false">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/><path d="M12 17v4M8 21h8"/></svg></span>
    <span class="mob-nav-label">Airport</span>
    <svg class="mob-toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  <!-- Airport Panel -->
  <div class="mob-airport-panel" id="mob-airport-panel">
    <div class="mob-airport-section">
      <div class="mob-airport-label"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/></svg>Airport Transfers</div>
      <a href="/airport-transfers" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">Airport Transfers Overview</span></a>
      <a href="/book?service=airport" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">Book Airport Transfer</span></a>
      <a href="/maxi-taxi/#maxi-airport" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">Maxi Taxi Airport Transfers</span></a>
    </div>
    <div class="mob-airport-section">
      <div class="mob-airport-label"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/></svg>SYD Airport</div>
      <a href="/airport-transfers#domestic" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">Domestic Terminal (T2/T3)</span></a>
      <a href="/airport-transfers#international" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">International Terminal (T1)</span></a>
    </div>
    <div class="mob-airport-section">
      <div class="mob-airport-label"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/></svg>WSA Airport</div>
      <a href="/locations/western-sydney-airport/" class="mob-airport-link"><span class="mob-airport-link-dot"></span><span class="mob-airport-link-text">Western Sydney International — Luddenham</span></a>
    </div>
  </div>
  <!-- Service Areas Toggle -->
  <button class="mob-nav-item mob-areas-toggle" id="mob-areas-btn" aria-expanded="false">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></span>
    <span class="mob-nav-label">Service Areas</span>
    <svg class="mob-toggle-arrow mob-areas-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
  </button>
  <!-- Service Areas Panel -->
  <div class="mob-areas-panel" id="mob-areas-panel" aria-hidden="true">
    <div class="mob-areas-group">
      <div class="mob-areas-group-label">City &amp; Inner</div>
      <a href="/locations/sydney-cbd/">Sydney CBD</a>
      <a href="/locations/parramatta/">Parramatta</a>
      <a href="/locations/newtown/">Inner West</a>
      <a href="/locations/strathfield/">Strathfield</a>
      <a href="/locations/burwood/">Burwood</a>
    </div>
    <div class="mob-areas-group">
      <div class="mob-areas-group-label">North Shore &amp; Beaches</div>
      <a href="/locations/chatswood/">Chatswood</a>
      <a href="/locations/manly/">Manly / Northern Beaches</a>
      <a href="/locations/hornsby/">Hornsby</a>
      <a href="/locations/castle-hill/">Hills District</a>
      <a href="/locations/mosman/">Mosman</a>
    </div>
    <div class="mob-areas-group">
      <div class="mob-areas-group-label">South &amp; East</div>
      <a href="/locations/bondi/">Eastern Suburbs</a>
      <a href="/locations/cronulla/">Sutherland Shire</a>
      <a href="/locations/hurstville/">St George</a>
      <a href="/locations/randwick/">Randwick</a>
    </div>
    <div class="mob-areas-group">
      <div class="mob-areas-group-label">West &amp; South West</div>
      <a href="/locations/blacktown/">Blacktown</a>
      <a href="/locations/penrith/">Penrith</a>
      <a href="/locations/liverpool/">Liverpool</a>
      <a href="/locations/campbelltown/">Campbelltown</a>
      <a href="/locations/bankstown/">Canterbury-Bankstown</a>
    </div>
    <div class="mob-areas-group">
      <div class="mob-areas-group-label">Regional</div>
      <a href="/locations/wollongong/">Wollongong</a>
      <a href="/locations/gosford/">Central Coast</a>
      <a href="/locations/katoomba/">Blue Mountains</a>
      <a href="/locations/">View All 400+ Areas &rarr;</a>
    </div>
  </div>
  <!-- Book Now -->
  <a href="/book" class="mob-nav-item mob-book-link">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg></span>
    <span class="mob-nav-label">Book Now</span>
  </a>
  <!-- About -->
  <a href="/about" class="mob-nav-item">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg></span>
    <span class="mob-nav-label">About Us</span>
  </a>
  <!-- Contact -->
  <a href="/contact" class="mob-nav-item">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></span>
    <span class="mob-nav-label">Contact</span>
  </a>
  <!-- Manage Booking -->
  <a href="/manage" class="mob-nav-item">
    <span class="mob-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
    <span class="mob-nav-label">Manage Booking</span>
  </a>
</nav>
<!-- Footer call button -->
<div class="mob-footer">
  <a class="mob-call-btn" href="tel:1800173171">
    <svg fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
    1800 173 171
  </a>
</div>
</div>'''

# ── NEW PREMIUM FOOTER HTML ──
NEW_FOOTER = '''<footer class="footer-premium">
<div class="container">
<!-- Footer Top: Brand + CTA -->
<div class="footer-top">
<div class="footer-brand">
<div class="footer-brand-logo-wrap">
<div class="footer-brand-emblem">
<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
</div>
<div class="footer-brand-name">
<span class="footer-brand-name-top">Silver Service</span>
<span class="footer-brand-name-sub">Taxi Sydney</span>
</div>
</div>
<p class="footer-brand-desc">Sydney&rsquo;s premier Silver Service taxi and chauffeur company. Professional, reliable and luxurious transport for all occasions &mdash; 24 hours a day, 7 days a week.</p>
<div class="footer-social-premium">
<a href="https://www.facebook.com/1005432045994525" class="footer-social-btn" aria-label="Facebook" target="_blank" rel="noopener"><svg fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
<a href="#" class="footer-social-btn" aria-label="Instagram"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect height="20" rx="5" ry="5" width="20" x="2" y="2"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg></a>
<a href="#" class="footer-social-btn" aria-label="LinkedIn"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
</div>
</div>
<div class="footer-cta">
<span class="footer-cta-text">24/7 Dispatch Available</span>
<a href="tel:1800173171" class="footer-cta-phone">
<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
<span class="footer-cta-phone-number">1800 173 171</span>
</a>
<a href="/book" class="footer-cta-book">
<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
Book Your Taxi Now
</a>
</div>
</div>

<!-- Footer Main Grid -->
<div class="footer-main">
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Quick Links</div>
<ul class="footer-links-premium">
<li><a href="/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Home</a></li>
<li><a href="/services"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Our Services</a></li>
<li><a href="/airport-transfers"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Airport Transfers</a></li>
<li><a href="/about"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>About Us</a></li>
<li><a href="/contact"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Contact</a></li>
<li><a href="/book"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Book Online</a></li>
<li><a href="/manage"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Manage Booking</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>Our Services</div>
<ul class="footer-links-premium">
<li><a href="/airport-transfers"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Airport Transfers</a></li>
<li><a href="/services#corporate"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Corporate Travel</a></li>
<li><a href="/services#chauffeur"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Chauffeur Service</a></li>
<li><a href="/services#events"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Event Transfers</a></li>
<li><a href="/services#cruise"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Cruise Transfers</a></li>
<li><a href="/services#hourly"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Hourly Hire</a></li>
<li><a href="/services#vip"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>VIP Luxury Service</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Service Areas</div>
<ul class="footer-links-premium">
<li><a href="/locations/sydney-cbd/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Sydney CBD</a></li>
<li><a href="/locations/parramatta/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Parramatta</a></li>
<li><a href="/locations/manly/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Northern Beaches</a></li>
<li><a href="/locations/bondi/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Eastern Suburbs</a></li>
<li><a href="/locations/cronulla/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Sutherland Shire</a></li>
<li><a href="/locations/blacktown/"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>Western Sydney</a></li>
<li><a href="/locations/" style="color:var(--gold);font-weight:700"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>View All 400+ Areas &rarr;</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>Contact Us</div>
<div class="footer-contact-premium">
<div class="footer-contact-row">
<div class="footer-contact-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></div>
<div class="footer-contact-info"><span class="footer-contact-label">Phone</span><a href="tel:1800173171" class="footer-contact-value">1800 173 171</a></div>
</div>
<div class="footer-contact-row">
<div class="footer-contact-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
<div class="footer-contact-info"><span class="footer-contact-label">Email</span><a href="mailto:info@silverserviceonline.com.au" class="footer-contact-value">info@silverserviceonline.com.au</a></div>
</div>
<div class="footer-contact-row">
<div class="footer-contact-icon"><svg viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg></div>
<div class="footer-contact-info"><span class="footer-contact-label">Location</span><span class="footer-contact-value">Sydney, NSW, Australia</span></div>
</div>
<div class="footer-contact-row">
<div class="footer-contact-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
<div class="footer-contact-info"><span class="footer-contact-label">Hours</span><span class="footer-contact-value">24/7 — 365 Days</span></div>
</div>
</div>
</div>
</div>

<!-- Footer Bottom -->
<div class="footer-bottom-premium">
<div class="footer-bottom-left">&copy; 2026 Silver Service Taxi Sydney &mdash; All Rights Reserved</div>
<div class="footer-bottom-right">
<a href="/privacy-policy">Privacy Policy</a>
<a href="/terms-and-conditions">Terms &amp; Conditions</a>
<a href="/sitemap.xml">Sitemap</a>
</div>
</div>
</div>
</footer>'''


def upgrade_page(filepath):
    """Upgrade a single HTML page with new navbar, mobile menu, and footer."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add mega-menu.css link if not present
    if 'mega-menu.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/mega-menu.css">\n</head>')
    
    # Replace navbar
    nav_pattern = r'<nav class="navbar"[^>]*id="navbar"[^>]*>.*?</nav>'
    match = re.search(nav_pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + NEW_NAVBAR + content[match.end():]
    
    # Replace mobile menu (mob-overlay + mob-panel)
    mob_pattern = r'<div id="mob-overlay"[^>]*>.*?</div>\s*<div id="mob-panel"[^>]*>.*?</div>\s*</div>'
    match = re.search(mob_pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + NEW_MOBILE_MENU + content[match.end():]
    
    # Replace footer
    footer_pattern = r'<footer class="footer[^"]*">.*?</footer>'
    match = re.search(footer_pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + NEW_FOOTER + content[match.end():]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        for f in sys.argv[1:]:
            try:
                upgrade_page(f)
                print(f'✓ Upgraded: {f}')
            except Exception as e:
                print(f'✗ Error on {f}: {e}')
    else:
        print('Usage: python3 upgrade-nav-footer.py <file1.html> [file2.html ...]')
