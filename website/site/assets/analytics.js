'use strict';
/*
 * Visitor statistics for the MDM website: Google Analytics 4 and Microsoft Clarity.
 *
 * Off until the IDs below are filled in. With no IDs, this file does nothing:
 * no banner, no cookies, no requests.
 *
 * When IDs are set, visitors see a consent banner. Nothing loads until they
 * accept (RGPD). Before switching it on, add a paragraph about these cookies
 * to privacidade.html and en/privacidade.html.
 *
 * Events sent (both tools): call_click, whatsapp_click, email_click,
 * quote_open, quote_sent, quote_whatsapp, quote_email, calculator_open.
 */
(function () {
  const GA4_ID = '';      // e.g. 'G-XXXXXXXXXX'
  const CLARITY_ID = '';  // e.g. 'abcd1234ef'
  if (!GA4_ID && !CLARITY_ID) return;

  const KEY = 'mdm-consent-v1';
  const en = document.documentElement.lang.startsWith('en');
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch {} };

  let ready = false;
  function track(name, params) {
    if (!ready) return;
    if (window.gtag) window.gtag('event', name, params || {});
    if (window.clarity) window.clarity('event', name);
  }
  window.mdmTrack = track;

  function load() {
    if (ready) return;
    ready = true;
    if (GA4_ID) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID, { anonymize_ip: true });
    }
    if (CLARITY_ID) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      const c = document.createElement('script');
      c.async = true;
      c.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_ID);
      document.head.appendChild(c);
    }
    if (/\/calculadora(\.html)?$/.test(location.pathname)) track('calculator_open');
  }

  function banner() {
    const box = document.createElement('div');
    box.className = 'consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', en ? 'Cookies' : 'Cookies');
    const privacy = en ? '/en/privacidade.html' : '/privacidade.html';
    box.innerHTML = (en
      ? '<p>We use statistics cookies to understand how the site is used and improve it. <a href="' + privacy + '">Privacy</a></p><div><button type="button" data-consent="no">Decline</button><button type="button" data-consent="yes">Accept</button></div>'
      : '<p>Usamos cookies de estatística para perceber como o site é usado e melhorá-lo. <a href="' + privacy + '">Privacidade</a></p><div><button type="button" data-consent="no">Recusar</button><button type="button" data-consent="yes">Aceitar</button></div>');
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      set(b.dataset.consent);
      box.remove();
      if (b.dataset.consent === 'yes') load();
    });
    document.body.appendChild(box);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a, button');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('tel:')) track('call_click', { location: a.closest('header, footer, .mobile-actions, main')?.tagName?.toLowerCase() || '' });
    else if (href.includes('wa.me')) track('whatsapp_click');
    else if (href.startsWith('mailto:')) track('email_click');
    else if (a.hasAttribute('data-quote')) track('quote_open');
    else if (a.id === 'send-whatsapp') track('quote_whatsapp');
    else if (a.id === 'send-email') track('quote_email');
  }, true);

  const result = document.getElementById('delivery-result');
  if (result) {
    new MutationObserver(() => { if (!result.hidden) track('quote_sent'); })
      .observe(result, { attributes: true, attributeFilter: ['hidden'] });
  }

  const choice = get();
  if (choice === 'yes') load();
  else if (choice !== 'no') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
    else banner();
  }
})();
