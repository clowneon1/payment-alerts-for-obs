/**
 * Recent donations overlay. Reads only `widgets.recent` — its text style,
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

  function applyRecentSettings(newSettings) {
    if (newSettings && config && config.widgets && config.widgets.recent) {
      if (!newSettings.widgets) newSettings.widgets = {};
      if (config.widgets.recent.recentDonations && config.widgets.recent.recentDonations.length) {
        if (!newSettings.widgets.recent || !newSettings.widgets.recent.recentDonations || !newSettings.widgets.recent.recentDonations.length) {
          if (!newSettings.widgets.recent) newSettings.widgets.recent = {};
          newSettings.widgets.recent.recentDonations = config.widgets.recent.recentDonations;
        }
      }
    }
    config = StorageHelper.mergeWithDefaults(newSettings);
    const recent = config.widgets.recent;
    const root = document.documentElement;

    const [r, g, b] = hexToRgb(recent.style.backgroundColor || '#0a0e17');
    const opacityVal = Number.isFinite(parseFloat(recent.style?.backgroundOpacity)) ? parseFloat(recent.style.backgroundOpacity) : 88;
    const bgOpacity = opacityVal / 100;
    root.style.setProperty('--recent-bg-color', `rgba(${r}, ${g}, ${b}, ${bgOpacity})`);
    root.style.setProperty('--recent-bg-opacity', bgOpacity);
    root.style.setProperty('--recent-accent-color', recent.style.accentColor);
    root.style.setProperty('--recent-row-bg-color', recent.style.rowBgColor);
    root.style.setProperty('--recent-border-radius', (recent.style.borderRadius ?? 16) + 'px');
    root.style.setProperty('--recent-border-width', (recent.style.borderWidth ?? 1) + 'px');
    root.style.setProperty('--recent-border-color', recent.style.borderColor || 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--recent-padding', recent.style.padding + 'px');
    root.style.setProperty('--recent-width', recent.layout.width + 'px');
    root.style.setProperty('--recent-position-x', recent.layout.positionX);
    root.style.setProperty('--recent-position-y', recent.layout.positionY);
    root.style.setProperty('--recent-margin-x', recent.layout.marginX + 'px');
    root.style.setProperty('--recent-margin-y', recent.layout.marginY + 'px');

    WidgetStyle.applyCssVars(root, WidgetStyle.toCssVars(recent.text, 'recent'));
    WidgetStyle.applyCssVars(root, CanvasPresets.toCssVars(recent.canvas));

    let customStyleEl = document.getElementById('custom-recent-css');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'custom-recent-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = (recent.code.enableCustomCode !== false ? (recent.code.customCSS || '') : '');

    renderRecentWidget(recent);
  }

  function renderRecentWidget(recent) {
    const container = document.getElementById('recent-container');
    if (!container) return;

    if (recent.enabled === false) {
      container.innerHTML = '';
      return;
    }

    const history = recent.recentDonations || [];
    const displayItems = history.slice(0, parseInt(recent.maxEntries, 10) || 5);
    const max = parseInt(recent.maxEntries, 10) || 5;
    const total = displayItems.reduce((sum, it) => sum + (parseFloat(it.amountValue || it.amount) || 0), 0);
    const formattedTotal = `₹${total.toLocaleString('en-IN')}`;

    const recentTitle = TemplateEngine.render(recent.text.titleTemplate || recent.title || 'Recent Donations', {
      title: recent.title,
      count: displayItems.length,
      max: max,
      maxEntries: max,
      totalAmount: total,
      formattedTotal: formattedTotal
    });

    if (recent.code && recent.code.enableCustomCode !== false) {
      container.innerHTML = (typeof recent.code.customHTML === 'string' && recent.code.customHTML)
        ? TemplateEngine.render(recent.code.customHTML, {
            title: recentTitle,
            count: displayItems.length,
            max: max,
            maxEntries: max,
            totalAmount: total,
            formattedTotal: formattedTotal
          })
        : '';
      const list = container.querySelector('.lb-list');
      if (list) list.innerHTML = rowsHtml(displayItems, recent);
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (displayItems.length === 0) {
      container.innerHTML = `
        <div class="lb-card">
          <div class="lb-header">
            <svg class="widget-title-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9146ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
            <div class="lb-title">${TemplateEngine.escapeHtml(recentTitle)}</div>
          </div>
          <div class="lb-empty">No payments received yet</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="lb-card">
        <div class="lb-header">
          <svg class="widget-title-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9146ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
          <div class="lb-title">${TemplateEngine.escapeHtml(recentTitle)}</div>
        </div>
        <div class="lb-list">
          ${rowsHtml(displayItems, recent)}
        </div>
      </div>
    `;
  }

  function rowsHtml(items, recent) {
    return items.map((item, idx) => {
      const formattedAmount = `₹${(parseFloat(item.amountValue) || 0).toLocaleString('en-IN')}`;
      return `
        <div class="lb-row">
          <div class="lb-user-info">
            <div class="lb-badge">#${idx + 1}</div>
            <div class="lb-name">${TemplateEngine.escapeHtml(item.sender)}</div>
          </div>
          ${recent.showAmounts !== false ? `<div class="lb-amount">${formattedAmount}</div>` : ''}
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
        if (msg.type === 'SETTINGS_UPDATED' && msg.payload) applyRecentSettings(msg.payload);
        else if (msg.type === 'config' && msg.config) applyRecentSettings(msg.config);
      } catch (e) {
        console.warn('[Recent] WS parse error:', e);
      }
    };
    ws.onclose = () => setTimeout(connectWebSocket, 3000);
  }

  window.addEventListener('message', (event) => {
    if (event.data && (event.data.type === 'SETTINGS_UPDATED' || event.data.type === 'config')) {
      const payload = event.data.payload || event.data.config;
      if (payload) applyRecentSettings(payload);
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      applyRecentSettings(await StorageHelper.loadServer());
    } catch (e) { /* keep defaults */ }
    connectWebSocket();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'OVERLAY_READY', widget: 'recent' }, '*');
    }
  });
})();
