(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  var _scriptSrc = (document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })()).src;
  var _apiBase = _scriptSrc ? _scriptSrc.replace(/\/widget\.js.*$/, '') : 'http://localhost:3001';

  var ECP_CONFIG = {
    apiBase: _apiBase,
    apiKey: '',
    primaryColor: '#ff751f',
    accentColor: '#e5621a',
    widgetTitle: 'East Coast Parking',
    widgetSubtitle: 'How can we help you?',
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  var state = {
    open: false,
    sessionId: sessionStorage.getItem('ecp_session_id') || null,
    messages: [],
    loading: false,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    widgetX: null,
    widgetY: null,
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    var css = [
      '#ecp-greeting-bubble{position:fixed;bottom:100px;right:90px;z-index:100001;background:white;color:#2c3e50;padding:12px 16px 12px 14px;border-radius:16px 16px 4px 16px;box-shadow:0 4px 24px rgba(0,0,0,.18);font-family:Arial,sans-serif;font-size:13.5px;line-height:1.5;max-width:210px;cursor:pointer;opacity:1;transition:opacity .4s,transform .4s;transform-origin:bottom right;}',
      '#ecp-greeting-bubble.ecp-hidden{opacity:0 !important;pointer-events:none;transform:scale(.88);}',
      '#ecp-greeting-bubble strong{display:block;margin-bottom:3px;color:#ff751f;font-size:14px;}',
      '#ecp-greeting-close{position:absolute;top:6px;right:9px;background:none;border:none;cursor:pointer;font-size:12px;color:#bbb;line-height:1;padding:0;}',
      '#ecp-greeting-close:hover{color:#888;}',
      '#ecp-widget-launcher{position:fixed;bottom:24px;right:24px;z-index:99998;width:60px;height:60px;border-radius:50%;background:' + ECP_CONFIG.primaryColor + ';border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}',
      '#ecp-widget-launcher:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,0,0,.4);}',
      '#ecp-widget-launcher svg{width:26px;height:26px;}',
      '#ecp-widget-badge{position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;border-radius:50%;width:18px;height:18px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;}',
      '#ecp-widget-container{position:fixed;bottom:96px;right:24px;z-index:99999;width:360px;max-height:560px;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.25);font-family:Arial,sans-serif;background:#fff;transition:opacity .25s,transform .25s;transform-origin:bottom right;}',
      '#ecp-widget-container.ecp-hidden{opacity:0;pointer-events:none;transform:scale(.92) translateY(8px);}',
      '#ecp-widget-container.ecp-dragging{transition:none;cursor:grabbing;}',
      '#ecp-widget-header{background:' + ECP_CONFIG.primaryColor + ';color:white;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:grab;user-select:none;}',
      '#ecp-widget-header:active{cursor:grabbing;}',
      '.ecp-header-info{display:flex;align-items:center;gap:10px;}',
      '.ecp-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;}',
      '.ecp-header-text h3{margin:0;font-size:14px;font-weight:700;}',
      '.ecp-header-text p{margin:0;font-size:11px;opacity:.8;}',
      '.ecp-online-dot{display:inline-block;width:7px;height:7px;background:#2ecc71;border-radius:50%;margin-right:4px;}',
      '.ecp-header-actions{display:flex;gap:6px;}',
      '.ecp-header-btn{background:none;border:none;color:white;cursor:pointer;opacity:.7;padding:4px;border-radius:4px;transition:opacity .15s,background .15s;}',
      '.ecp-header-btn:hover{opacity:1;background:rgba(255,255,255,.15);}',
      '#ecp-messages{flex:1;overflow-y:auto;padding:16px;background:#f8f9fa;display:flex;flex-direction:column;gap:10px;min-height:300px;max-height:380px;}',
      '#ecp-messages::-webkit-scrollbar{width:4px;}',
      '#ecp-messages::-webkit-scrollbar-track{background:transparent;}',
      '#ecp-messages::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px;}',
      '.ecp-msg{display:flex;gap:8px;animation:ecpFadeIn .2s ease;}',
      '.ecp-msg.ecp-user{flex-direction:row-reverse;}',
      '.ecp-bubble{padding:10px 14px;border-radius:16px;max-width:82%;font-size:13.5px;line-height:1.5;word-break:break-word;}',
      '.ecp-msg.ecp-bot .ecp-bubble{background:white;color:#2c3e50;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.08);}',
      '.ecp-msg.ecp-user .ecp-bubble{background:' + ECP_CONFIG.primaryColor + ';color:white;border-bottom-right-radius:4px;}',
      '.ecp-msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:2px;}',
      '.ecp-msg.ecp-bot .ecp-msg-avatar{background:' + ECP_CONFIG.primaryColor + ';color:white;}',
      '.ecp-msg.ecp-user .ecp-msg-avatar{background:#dde4eb;color:#555;}',
      '.ecp-typing{display:flex;gap:4px;align-items:center;padding:8px 12px;}',
      '.ecp-typing span{width:7px;height:7px;border-radius:50%;background:#aaa;animation:ecpBounce .9s infinite;}',
      '.ecp-typing span:nth-child(2){animation-delay:.15s;}',
      '.ecp-typing span:nth-child(3){animation-delay:.3s;}',
      'html body .ecp-quick-replies{padding:6px 14px 0 !important;display:flex !important;flex-wrap:wrap !important;gap:6px !important;}',
      'html body .ecp-qr-btn,html body .ecp-qr-btn:link,html body .ecp-qr-btn:visited{background:white !important;color:' + ECP_CONFIG.primaryColor + ' !important;border:1.5px solid ' + ECP_CONFIG.primaryColor + ' !important;outline:none !important;border-radius:20px !important;padding:5px 12px !important;font-size:12.5px !important;font-weight:400 !important;cursor:pointer !important;transition:all .15s !important;white-space:nowrap !important;font-family:inherit !important;line-height:1.4 !important;box-shadow:none !important;text-decoration:none !important;display:inline-block !important;margin:0 !important;}',
      'html body .ecp-qr-btn:hover,html body .ecp-qr-btn:active{background:' + ECP_CONFIG.primaryColor + ' !important;color:white !important;}',
      '#ecp-widget-footer{padding:10px 12px;background:white;border-top:1px solid #eee;display:flex;flex-direction:column;gap:8px;}',
      '.ecp-input-row{display:flex;gap:8px;align-items:flex-end;}',
      '#ecp-input{flex:1;border:1.5px solid #dde4eb;border-radius:22px;padding:9px 14px;font-size:13.5px;outline:none;resize:none;max-height:90px;overflow-y:auto;line-height:1.4;font-family:inherit;transition:border-color .15s;}',
      '#ecp-input:focus{border-color:' + ECP_CONFIG.primaryColor + ';}',
      '#ecp-send-btn{width:40px;height:40px;border-radius:50%;background:' + ECP_CONFIG.primaryColor + ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;}',
      '#ecp-send-btn:hover{background:' + ECP_CONFIG.accentColor + ';}',
      '#ecp-send-btn:disabled{opacity:.5;cursor:not-allowed;}',
      '#ecp-send-btn svg{width:22px;height:22px;fill:white;}',
      '#ecp-agent-btn{background:none;border:none;color:#666;font-size:11.5px;cursor:pointer;text-align:left;padding:0;text-decoration:underline;text-decoration-color:transparent;transition:text-decoration-color .15s,color .15s;}',
      '#ecp-agent-btn:hover{color:' + ECP_CONFIG.primaryColor + ';text-decoration-color:' + ECP_CONFIG.primaryColor + ';}',
      '@keyframes ecpFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes ecpBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
      '@media(max-width:480px){' +
        '#ecp-widget-container{width:100% !important;right:0 !important;left:0 !important;bottom:0 !important;top:auto !important;max-height:88svh;max-height:88vh;border-radius:18px 18px 0 0 !important;padding-bottom:env(safe-area-inset-bottom,0px);transform-origin:bottom center;}' +
        '#ecp-widget-container.ecp-hidden{transform:translateY(100%) !important;}' +
        '#ecp-messages{min-height:200px;max-height:calc(88svh - 185px);max-height:calc(88vh - 185px);-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}' +
        '#ecp-widget-launcher{bottom:calc(20px + env(safe-area-inset-bottom,0px));right:16px;width:56px;height:56px;}' +
        '#ecp-greeting-bubble{display:none !important;}' +
        '#ecp-input{font-size:16px !important;}' +
        'html body .ecp-qr-btn{font-size:13px !important;padding:8px 14px !important;}' +
        '.ecp-bubble{font-size:14px !important;line-height:1.55 !important;}' +
        '#ecp-widget-header{padding:14px 16px !important;cursor:default !important;border-radius:18px 18px 0 0 !important;}' +
        '.ecp-header-text h3{font-size:15px !important;}' +
        '#ecp-send-btn{width:44px !important;height:44px !important;}' +
        '#ecp-agent-btn{font-size:12.5px !important;padding:4px 0 !important;}' +
        '.ecp-msg-avatar{display:none !important;}' +
        '.ecp-bubble{max-width:92% !important;}' +
      '}',
    ].join('');

    var style = document.createElement('style');
    style.id = 'ecp-widget-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── DOM ───────────────────────────────────────────────────────────────────
  function buildWidget() {
    // Launcher button
    var launcher = document.createElement('button');
    launcher.id = 'ecp-widget-launcher';
    launcher.setAttribute('aria-label', 'Open chat');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="white"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>';

    var badge = document.createElement('span');
    badge.id = 'ecp-widget-badge';
    badge.textContent = '1';
    launcher.appendChild(badge);

    // Greeting bubble
    var greeting = document.createElement('div');
    greeting.id = 'ecp-greeting-bubble';
    greeting.className = 'ecp-hidden';
    greeting.innerHTML = '<button id="ecp-greeting-close" aria-label="Dismiss">✕</button><strong>G\'day! 👋</strong>Need help with parking? I\'m here!';
    document.body.appendChild(greeting);

    // Container
    var container = document.createElement('div');
    container.id = 'ecp-widget-container';
    container.className = 'ecp-hidden';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', 'East Coast Parking chat');

    container.innerHTML = [
      '<div id="ecp-widget-header">',
        '<div class="ecp-header-info">',
          '<div class="ecp-avatar" style="font-size:11px;font-weight:800;letter-spacing:-.5px;">ECP</div>',
          '<div class="ecp-header-text">',
            '<h3>' + ECP_CONFIG.widgetTitle + '</h3>',
            '<p><span class="ecp-online-dot"></span>Online now</p>',
          '</div>',
        '</div>',
        '<div class="ecp-header-actions">',
          '<button class="ecp-header-btn" id="ecp-minimize-btn" title="Minimise" aria-label="Minimise chat">',
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>',
          '</button>',
        '</div>',
      '</div>',
      '<div id="ecp-messages" role="log" aria-live="polite"></div>',
      '<div id="ecp-quick-replies" class="ecp-quick-replies"></div>',
      '<div id="ecp-widget-footer">',
        '<div class="ecp-input-row">',
          '<textarea id="ecp-input" rows="1" placeholder="Type your message…" aria-label="Chat message"></textarea>',
          '<button id="ecp-send-btn" aria-label="Send">',
            '<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>',
          '</button>',
        '</div>',
        '<button id="ecp-agent-btn">👤 Talk to a real person</button>',
      '</div>',
    ].join('');

    document.body.appendChild(launcher);
    document.body.appendChild(container);

    return { launcher, container, greeting };
  }

  // ─── Messages ──────────────────────────────────────────────────────────────
  function renderMessage(role, text) {
    var msgs = document.getElementById('ecp-messages');
    var wrap = document.createElement('div');
    wrap.className = 'ecp-msg ecp-' + role;

    var avatar = document.createElement('div');
    avatar.className = 'ecp-msg-avatar';
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

    var bubble = document.createElement('div');
    bubble.className = 'ecp-bubble';
    bubble.textContent = text;

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }

  function showTyping() {
    var msgs = document.getElementById('ecp-messages');
    var wrap = document.createElement('div');
    wrap.className = 'ecp-msg ecp-bot';
    wrap.id = 'ecp-typing-indicator';

    var avatar = document.createElement('div');
    avatar.className = 'ecp-msg-avatar';
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

    var bubble = document.createElement('div');
    bubble.className = 'ecp-bubble ecp-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('ecp-typing-indicator');
    if (el) el.remove();
  }

  function setQuickReplies(replies) {
    var qr = document.getElementById('ecp-quick-replies');
    qr.innerHTML = '';
    if (!replies || !replies.length) return;
    replies.forEach(function (label) {
      var btn = document.createElement('button');
      btn.className = 'ecp-qr-btn';
      btn.textContent = label;
      btn.addEventListener('click', function () {
        sendMessage(label);
        qr.innerHTML = '';
      });
      qr.appendChild(btn);
    });
  }

  var WELCOME_REPLIES = ['Check parking prices', 'Book parking', 'Shuttle info', 'Location & directions'];

  function showWelcome() {
    renderMessage('bot', 'G\'day! 👋 Welcome to East Coast Parking. I\'m Matty, East Coast Parking\'s Virtual AI Assistant. What can I help you with today?');
    setQuickReplies(WELCOME_REPLIES);
  }

  // ─── API ───────────────────────────────────────────────────────────────────
  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': ECP_CONFIG.apiKey,
    };
  }

  function renderPaymentButton(booking) {
    var msgs = document.getElementById('ecp-messages');
    var wrap = document.createElement('div');
    wrap.className = 'ecp-msg ecp-bot';

    var avatar = document.createElement('div');
    avatar.className = 'ecp-msg-avatar';
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

    var bubble = document.createElement('div');
    bubble.className = 'ecp-bubble';
    bubble.style.cssText = 'background:white;padding:14px;max-width:100%;';
    var hasDiscount = booking.discount_percent > 0;
    var isFree = booking.total_amount === 0;
    var discountRow = hasDiscount ? [
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#27ae60;margin:2px 0;">',
        '<span>Discount (' + booking.discount_percent + '%)</span>',
        '<span>-$' + (booking.original_amount || 0).toFixed(2) + '</span>',
      '</div>',
    ].join('') : '';
    var paymentSection = isFree ? [
      '<div style="background:#eafaf1;border-radius:8px;padding:10px 12px;text-align:center;margin-top:4px;">',
        '<p style="margin:0;color:#27ae60;font-weight:700;font-size:13px;">No payment required</p>',
        '<p style="margin:4px 0 0;color:#555;font-size:12px;">Your booking is confirmed. A confirmation email is on its way!</p>',
      '</div>',
    ].join('') : [
      '<a href="' + booking.payment_url + '" target="_blank" ',
        'style="display:block;text-align:center;background:#ff751f;color:white;padding:11px 16px;',
        'border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">',
        '💳 Pay Now & Confirm Booking',
      '</a>',
      '<p style="margin:8px 0 0;font-size:11px;color:#999;text-align:center;">Secure payment via Stripe</p>',
    ].join('');
    bubble.innerHTML = [
      '<p style="margin:0 0 10px;font-size:12px;color:#888;">',
        '<strong style="color:#ff751f;font-size:13px;">Ref: ' + (booking.booking_reference || '') + '</strong>',
      '</p>',
      hasDiscount ? '<div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin:2px 0;"><span>Original price</span><span>$' + (booking.original_amount || 0).toFixed(2) + '</span></div>' : '',
      discountRow,
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#2c3e50;margin:6px 0 12px;border-top:1px solid #eee;padding-top:6px;">',
        '<span>Total</span><span>$' + (booking.total_amount || '0.00') + ' AUD</span>',
      '</div>',
      paymentSection,
    ].join('');

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text || !text.trim() || state.loading) return;
    text = text.trim();

    var input = document.getElementById('ecp-input');
    var sendBtn = document.getElementById('ecp-send-btn');
    input.value = '';
    input.style.height = 'auto';

    renderMessage('user', text);
    state.loading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      var res = await fetch(ECP_CONFIG.apiBase + '/api/chat', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          message: text,
          sessionId: state.sessionId,
        }),
      });

      var data = await res.json();
      hideTyping();

      if (!res.ok) throw new Error(data.error || 'Server error');

      state.sessionId = data.sessionId;
      sessionStorage.setItem('ecp_session_id', data.sessionId);
      renderMessage('bot', data.response);

      // If a booking was just created, show a clickable Pay Now button
      if (data.booking && data.booking.payment_url) {
        renderPaymentButton(data.booking);
      }

      // Auto-suggest quick replies based on conversation type
      if (data.conversationType === 'booking') {
        setQuickReplies(['Open Air $9.90/day', 'Undercover from $135', 'Check availability']);
      } else if (data.escalated) {
        setQuickReplies(['Call 0404 094 064', 'Send email']);
      } else {
        setQuickReplies([]);
      }

      // Remove badge once chat opened
      var badge = document.getElementById('ecp-widget-badge');
      if (badge) badge.remove();

    } catch (err) {
      hideTyping();
      renderMessage('bot', 'Sorry, I\'m having trouble connecting. Please call us on 0404 094 064 or email bookings@eastcoastparking.com.au.');
      console.error('ECP chat error:', err);
    } finally {
      state.loading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function showContactForm() {
    var msgs = document.getElementById('ecp-messages');
    var wrap = document.createElement('div');
    wrap.className = 'ecp-msg ecp-bot';
    wrap.id = 'ecp-contact-form-wrap';

    var avatar = document.createElement('div');
    avatar.className = 'ecp-msg-avatar';
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

    var bubble = document.createElement('div');
    bubble.className = 'ecp-bubble';
    bubble.style.cssText = 'max-width:100%;padding:14px;';
    bubble.innerHTML = [
      '<p style="margin:0 0 10px;font-weight:600;">Happy to connect you! Just leave your details and we\'ll be in touch shortly:</p>',
      '<input id="ecp-contact-name" type="text" placeholder="Full name *" style="width:100%;padding:8px 10px;margin-bottom:7px;border:1.5px solid #dde4eb;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;" />',
      '<input id="ecp-contact-email" type="email" placeholder="Email address *" style="width:100%;padding:8px 10px;margin-bottom:7px;border:1.5px solid #dde4eb;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;" />',
      '<input id="ecp-contact-phone" type="tel" placeholder="Phone number *" style="width:100%;padding:8px 10px;margin-bottom:7px;border:1.5px solid #dde4eb;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;" />',
      '<textarea id="ecp-contact-message" placeholder="How can we help you? *" rows="3" style="width:100%;padding:8px 10px;margin-bottom:10px;border:1.5px solid #dde4eb;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;resize:none;font-family:inherit;"></textarea>',
      '<button id="ecp-contact-submit" style="width:100%;background:#ff751f;color:white;border:none;padding:10px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Send my details →</button>',
    ].join('');

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;

    document.getElementById('ecp-contact-submit').addEventListener('click', submitContactForm);
    document.getElementById('ecp-contact-name').focus();
  }

  async function submitContactForm() {
    var name    = (document.getElementById('ecp-contact-name')    || {}).value || '';
    var email   = (document.getElementById('ecp-contact-email')   || {}).value || '';
    var phone   = (document.getElementById('ecp-contact-phone')   || {}).value || '';
    var message = (document.getElementById('ecp-contact-message') || {}).value || '';

    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) {
      var btn = document.getElementById('ecp-contact-submit');
      btn.textContent = 'Please fill in all fields';
      btn.style.background = '#c0392b';
      setTimeout(function () {
        btn.textContent = 'Send my details →';
        btn.style.background = '#ff751f';
      }, 2000);
      return;
    }

    // Remove the form
    var formWrap = document.getElementById('ecp-contact-form-wrap');
    if (formWrap) formWrap.remove();

    if (!state.sessionId) state.sessionId = 'manual-' + Date.now();

    renderMessage('bot', 'Thanks ' + name.trim().split(' ')[0] + '! Notifying our team now…');

    try {
      var res = await fetch(ECP_CONFIG.apiBase + '/api/escalate-to-agent', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          sessionId: state.sessionId,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          userMessage: message.trim(),
          reason: 'Customer clicked Talk to Agent button',
        }),
      });
      var data = await res.json();
      renderMessage('bot', data.message || 'Done! A team member will contact you at ' + email.trim() + ' or ' + phone.trim() + ' shortly. You can also call us on 0404 094 064.');
    } catch (err) {
      renderMessage('bot', 'Please call us on 0404 094 064 or email bookings@eastcoastparking.com.au and our team will assist you.');
    }
  }

  async function escalateToAgent() {
    showContactForm();
    setQuickReplies([]);
  }


  // ─── Drag ──────────────────────────────────────────────────────────────────
  function initDrag(container) {
    var header = document.getElementById('ecp-widget-header');

    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      state.dragging = true;
      var rect = container.getBoundingClientRect();
      state.dragOffsetX = e.clientX - rect.left;
      state.dragOffsetY = e.clientY - rect.top;
      container.classList.add('ecp-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!state.dragging) return;
      var x = e.clientX - state.dragOffsetX;
      var y = e.clientY - state.dragOffsetY;
      x = Math.max(0, Math.min(x, window.innerWidth - container.offsetWidth));
      y = Math.max(0, Math.min(y, window.innerHeight - container.offsetHeight));
      container.style.left = x + 'px';
      container.style.top = y + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', function () {
      if (state.dragging) {
        state.dragging = false;
        container.classList.remove('ecp-dragging');
      }
    });
  }

  // ─── Toggle ────────────────────────────────────────────────────────────────
  function dismissGreeting() {
    var g = document.getElementById('ecp-greeting-bubble');
    if (g) g.classList.add('ecp-hidden');
  }

  function openWidget(container) {
    state.open = true;
    container.classList.remove('ecp-hidden');
    dismissGreeting();
    document.getElementById('ecp-input').focus();

    var msgs = document.getElementById('ecp-messages');
    if (msgs && msgs.children.length === 0) {
      showWelcome();
    }

    var badge = document.getElementById('ecp-widget-badge');
    if (badge) badge.remove();
  }

  function closeWidget(container) {
    state.open = false;
    container.classList.add('ecp-hidden');
  }

  // ─── Input auto-resize ─────────────────────────────────────────────────────
  function initInput() {
    var input = document.getElementById('ecp-input');
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 90) + 'px';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init(options) {
    options = options || {};
    ECP_CONFIG.apiBase = options.apiBase || ECP_CONFIG.apiBase;
    ECP_CONFIG.apiKey = options.apiKey || '';

    injectStyles();
    var els = buildWidget();

    els.launcher.addEventListener('click', function () {
      state.open ? closeWidget(els.container) : openWidget(els.container);
    });

    document.getElementById('ecp-minimize-btn').addEventListener('click', function () {
      closeWidget(els.container);
    });

    document.getElementById('ecp-send-btn').addEventListener('click', function () {
      sendMessage(document.getElementById('ecp-input').value);
    });

    document.getElementById('ecp-agent-btn').addEventListener('click', escalateToAgent);

    initInput();
    if (window.innerWidth > 480) initDrag(els.container);

    // Greeting bubble — show immediately, auto-hide after 8s
    var g = document.getElementById('ecp-greeting-bubble');
    if (g && !state.open) {
      g.classList.remove('ecp-hidden');
      g.addEventListener('click', function (e) {
        if (e.target.id === 'ecp-greeting-close') { dismissGreeting(); return; }
        openWidget(els.container);
      });
      setTimeout(dismissGreeting, 8000);
    }

    // Pre-fill dates from URL params (cruise schedule page integration)
    var params = new URLSearchParams(window.location.search);
    if (params.get('checkIn') || params.get('cruise_date')) {
      openWidget(els.container);
      var checkIn = params.get('checkIn') || params.get('cruise_date');
      setTimeout(function () {
        sendMessage('I\'d like to book parking for check-in on ' + checkIn);
      }, 500);
    }
  }

  window.EastCoastParkingChat = { init: init };
})();
