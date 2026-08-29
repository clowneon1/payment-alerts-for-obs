/**
 * Top supporters overlay. Reads only `widgets.leaderboard` — its text style,
 * canvas and layout are its own and never shared with the other widgets.
 */
(function () {
  let config = StorageHelper.getDefaultSettings();
  let ws = null;

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return [10, 14, 23];
    const clean = hex.trim();
    if (clean.startsWith('rgba') || clean.startsWith('rgb')) {
      const nums = clean.match(/\d+/g);
      if (nums && nums.length >= 3) return [parseInt(nums[0], 10), parseInt(nums[1], 10), parseInt(nums[2], 10)];
    }
    const match = clean.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (match) return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
    const shortMatch = clean.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
    if (shortMatch) return [parseInt(shortMatch[1] + shortMatch[1], 16), parseInt(shortMatch[2] + shortMatch[2], 16), parseInt(shortMatch[3] + shortMatch[3], 16)];
    return [10, 14, 23];
  }

  function applyLeaderboardSettings(newSettings) {
    if (newSettings && config && config.widgets && config.widgets.leaderboard) {
      if (!newSettings.widgets) newSettings.widgets = {};
      if (config.widgets.leaderboard.supporters && Object.keys(config.widgets.leaderboard.supporters).length) {
        if (!newSettings.widgets.leaderboard || !newSettings.widgets.leaderboard.supporters || !Object.keys(newSettings.widgets.leaderboard.supporters).length) {
          if (!newSettings.widgets.leaderboard) newSettings.widgets.leaderboard = {};
          newSettings.widgets.leaderboard.supporters = config.widgets.leaderboard.supporters;
        }
      }
    }
    config = StorageHelper.mergeWithDefaults(newSettings);
    const lb = config.widgets.leaderboard;
    const root = document.documentElement;

    const [r, g, b] = hexToRgb(lb.style.backgroundColor || '#0a0e17');
    const opacityVal = Number.isFinite(parseFloat(lb.style?.backgroundOpacity)) ? parseFloat(lb.style.backgroundOpacity) : 88;
    const bgOpacity = opacityVal / 100;
    root.style.setProperty('--lb-bg-color', `rgba(${r}, ${g}, ${b}, ${bgOpacity})`);
    root.style.setProperty('--lb-bg-opacity', bgOpacity);
    root.style.setProperty('--lb-accent-color', lb.style.accentColor);
    root.style.setProperty('--lb-row-bg-color', lb.style.rowBgColor);
    root.style.setProperty('--lb-border-radius', (lb.style.borderRadius ?? 16) + 'px');
    root.style.setProperty('--lb-border-width', (lb.style.borderWidth ?? 1) + 'px');
    root.style.setProperty('--lb-border-color', lb.style.borderColor || 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--lb-padding', lb.style.padding + 'px');
    root.style.setProperty('--lb-width', lb.layout.width + 'px');
    root.style.setProperty('--lb-position-x', lb.layout.positionX);
    root.style.setProperty('--lb-position-y', lb.layout.positionY);
    root.style.setProperty('--lb-margin-x', lb.layout.marginX + 'px');
    root.style.setProperty('--lb-margin-y', lb.layout.marginY + 'px');

    WidgetStyle.applyCssVars(root, WidgetStyle.toCssVars(lb.text, 'lb'));
    WidgetStyle.applyCssVars(root, CanvasPresets.toCssVars(lb.canvas));

    let customStyleEl = document.getElementById('custom-lb-css');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'custom-lb-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = (lb.code.enableCustomCode !== false ? (lb.code.customCSS || '') : '');

    renderLeaderboardWidget(lb);
  }

  function renderLeaderboardWidget(lb) {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    if (lb.enabled === false) {
      container.innerHTML = '';
      return;
    }

    const supportersMap = lb.supporters || {};
    const topSupporters = Object.keys(supportersMap)
      .map(name => ({ name, amount: parseFloat(supportersMap[name]) || 0 }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, parseInt(lb.maxEntries, 10) || 5);

    const lbTitle = TemplateEngine.render(lb.text.titleTemplate || lb.title || 'Top Supporters', {
      title: lb.title,
      count: topSupporters.length,
      max: parseInt(lb.maxEntries, 10)
    });

    if (lb.code.enableCustomCode !== false && lb.code.customHTML && lb.code.customHTML.trim()) {
      container.innerHTML = TemplateEngine.render(lb.code.customHTML, {
        title: lbTitle,
        count: topSupporters.length
      });
      const list = container.querySelector('.lb-list');
      if (list) list.innerHTML = rowsHtml(topSupporters, lb);
      return;
    }

    if (topSupporters.length === 0) {
      container.innerHTML = `
        <div class="lb-card">
          <div class="lb-header">
            <svg class="widget-title-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffb703" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
            <div class="lb-title">${TemplateEngine.escapeHtml(lbTitle)}</div>
          </div>
          <div class="lb-empty">No payments received yet</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="lb-card">
        <div class="lb-header">
          <svg class="widget-title-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffb703" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
          <div class="lb-title">${TemplateEngine.escapeHtml(lbTitle)}</div>
        </div>
        <div class="lb-list">
          ${rowsHtml(topSupporters, lb)}
        </div>
      </div>
    `;
  }

  function rowsHtml(supporters, lb) {
    return supporters.map((supporter, idx) => {
      const rank = idx + 1;
      const badgeIcon = `#${rank}`;
      const formattedAmount = `₹${supporter.amount.toLocaleString('en-IN')}`;
      return `
        <div class="lb-row rank-${rank}">
          <div class="lb-user-info">
            <div class="lb-badge">${badgeIcon}</div>
            <div class="lb-name">${TemplateEngine.escapeHtml(supporter.name)}</div>
          </div>
          ${lb.showAmounts !== false ? `<div class="lb-amount">${formattedAmount}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/obs`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SETTINGS_UPDATED' && msg.payload) applyLeaderboardSettings(msg.payload);
        else if (msg.type === 'config' && msg.config) applyLeaderboardSettings(msg.config);
      } catch (e) {
        console.warn('[Leaderboard] WS parse error:', e);
      }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
  }

  window.addEventListener('message', (event) => {
    if (event.data && (event.data.type === 'SETTINGS_UPDATED' || event.data.type === 'config')) {
      const payload = event.data.payload || event.data.config;
      if (payload) applyLeaderboardSettings(payload);
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      applyLeaderboardSettings(await StorageHelper.loadServer());
    } catch (e) { /* keep defaults */ }
    connectWebSocket();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'OVERLAY_READY', widget: 'leaderboard' }, '*');
    }
  });
})();
