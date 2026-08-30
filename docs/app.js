/**
 * StreamPe GitHub Pages Interactive Application Controller
 * Handles Carousel, Fullscreen Screenshot Lightbox Modal, FAQ Accordions, and Mobile Nav.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ── 1. Screenshot Gallery Data for Lightbox ──────────────────────────────────
  const galleryItems = [
    {
      src: 'assets/earning-overview-dashboard.png',
      title: '📊 Earning Overview & Analytics Dashboard',
      desc: 'Interactive revenue dashboard with daily timeline trends, payment app breakdowns (PhonePe, GPay, Amazon Pay), and top supporter rankings.'
    },
    {
      src: 'assets/live-alert-customizer.png',
      title: '🎛️ Live Alert Customizer & OBS Preview Grid',
      desc: 'Real-time alert card designer with transparent OBS canvas preview, dynamic opacity, backdrop blur, sound triggers, and entrance animations.'
    },
    {
      src: 'assets/code-studio.png',
      title: '💻 Fullscreen Code Studio & Live Sandbox',
      desc: 'Professional in-browser code editor with Handlebars HTML, CSS, and JS editor, syntax highlighting, selector pills, Prettier auto-formatting, and instant iframe sandbox.'
    },
    {
      src: 'assets/payment-goal-bar.png',
      title: '🎯 Stream Goal Bar Widget',
      desc: 'Configurable stream donation target bar with animated progress fills, gradient color picker, and overflow calculations beyond 100%.'
    },
    {
      src: 'assets/unified-list-widget.png',
      title: '🏆 Unified List Widget System',
      desc: 'Modular list system for displaying Top Supporters Leaderboard and Recent Donations feed on your stream with customizable font sizes, row limits, and borders.'
    },
    {
      src: 'assets/auto-cycling-widget.png',
      title: '🔄 Auto-Cycling Info Widget',
      desc: 'Rotational widget cycling through top supporters, recent donations, and custom promotional cards with configurable in/out transitions.'
    },
    {
      src: 'assets/native-desktop-app.png',
      title: '⚡ Native Desktop Shell (Tauri v2 + Bun)',
      desc: 'Ultra-lightweight native Windows desktop shell (< 25 MB RAM) with system tray minimization, start-on-boot, and 1-click URL copy.'
    }
  ];

  // ── 2. Interactive Screenshot Carousel ────────────────────────────────────
  const slides = Array.from(document.querySelectorAll('.carousel-slide'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  let currentIndex = 0;
  let autoPlayTimer = null;

  function showSlide(index) {
    if (!slides.length) return;
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    currentIndex = index;
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function prevSlide() {
    showSlide(currentIndex - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(nextSlide, 6000);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      nextSlide();
      startAutoPlay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      prevSlide();
      startAutoPlay();
    });
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      showSlide(i);
      startAutoPlay();
    });
  });

  // Touch Swipe Gesture Support on Carousel Viewport
  const viewport = document.querySelector('.carousel-viewport');
  if (viewport) {
    let startX = 0;
    viewport.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      stopAutoPlay();
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (Math.abs(diff) > 45) {
        if (diff > 0) nextSlide();
        else prevSlide();
      }
      startAutoPlay();
    }, { passive: true });

    // Open Lightbox when clicking active slide
    viewport.addEventListener('click', () => {
      openLightbox(currentIndex);
    });
  }

  startAutoPlay();

  // ── 3. Fullscreen Screenshot Lightbox Modal ───────────────────────────────
  const lightbox = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');
  let lightboxIndex = 0;

  function openLightbox(index) {
    if (!lightbox || !galleryItems.length) return;
    if (index < 0) index = galleryItems.length - 1;
    if (index >= galleryItems.length) index = 0;

    lightboxIndex = index;
    const item = galleryItems[lightboxIndex];
    const lightboxFrame = document.getElementById('lightbox-frame');
    if (lightboxImg) lightboxImg.src = item.src;
    if (lightboxTitle) lightboxTitle.textContent = item.title;
    if (lightboxDesc) lightboxDesc.textContent = item.desc;

    if (lightboxFrame) {
      if (item.src.includes('native-desktop-app') || item.src.includes('mobile-')) {
        lightboxFrame.classList.add('vertical-frame');
      } else {
        lightboxFrame.classList.remove('vertical-frame');
      }
    }

    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Lock scroll
    stopAutoPlay();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    startAutoPlay();
  }

  function lightboxNextSlide() {
    openLightbox(lightboxIndex + 1);
  }

  function lightboxPrevSlide() {
    openLightbox(lightboxIndex - 1);
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxPrevSlide();
    });
  }

  if (lightboxNext) {
    lightboxNext.addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxNextSlide();
    });
  }

  const lightboxBackdrop = document.querySelector('.lightbox-backdrop');
  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeLightbox);
  }

  // Keyboard navigation for Lightbox & Carousel
  document.addEventListener('keydown', (e) => {
    if (lightbox && lightbox.classList.contains('active')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') lightboxNextSlide();
      if (e.key === 'ArrowLeft') lightboxPrevSlide();
    } else {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    }
  });

  // ── 4. FAQ Accordion Toggle Controller ────────────────────────────────────
  const faqCards = document.querySelectorAll('.faq-card');
  faqCards.forEach(card => {
    const questionBtn = card.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = card.classList.contains('open');
        // Close other cards in same category if desired, or allow multiple open
        card.classList.toggle('open', !isOpen);
        questionBtn.setAttribute('aria-expanded', String(!isOpen));
      });
    }
  });

  // Expand target FAQ card on URL hash load (e.g. #play-protect)
  if (window.location.hash) {
    const targetEl = document.querySelector(window.location.hash);
    if (targetEl) {
      if (targetEl.classList.contains('faq-card')) {
        targetEl.classList.add('open');
      } else {
        const firstCard = targetEl.querySelector('.faq-card');
        if (firstCard) firstCard.classList.add('open');
      }
    }
  }

  // ── 5. Mobile Responsive Navigation Drawer ────────────────────────────────
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const active = navToggle.classList.toggle('active');
      navMenu.classList.toggle('active', active);
      navToggle.setAttribute('aria-expanded', String(active));
    });

    // Close menu when clicking navigation link
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── 6. Direct Binary Asset Download Links (ZIP & APK) ───────────────────
  async function resolveLatestReleaseDownloads() {
    const btnZip = document.getElementById('btn-download-portable');
    const btnApk = document.getElementById('btn-download-apk');
    const navDownload = document.querySelector('.nav-btn-primary');

    // Default fallback URLs
    const defaultReleaseUrl = 'https://github.com/clowneon1/streampe/releases/latest';

    if (btnZip) {
      btnZip.href = defaultReleaseUrl;
    }
    if (btnApk) {
      btnApk.href = defaultReleaseUrl;
    }

    try {
      const res = await fetch('https://api.github.com/repos/clowneon1/streampe/releases/latest');
      if (!res.ok) return;
      const release = await res.json();
      if (!release) return;

      const tag = release.tag_name || 'v2.2.6';
      const cleanTag = tag.startsWith('v') ? tag : `v${tag}`;

      // Dynamically update announcement bar & hero badge to match latest published GitHub release
      const announcementText = document.getElementById('announcement-text');
      const announcementLink = document.getElementById('announcement-link');
      const badgeVersion = document.getElementById('badge-version');
      if (announcementText) {
        announcementText.textContent = `🎉 StreamPe ${cleanTag} Released with Live Payment Alerts & OBS Overlays!`;
      }
      if (announcementLink) {
        announcementLink.textContent = `Get ${cleanTag}`;
      }
      if (badgeVersion) {
        badgeVersion.textContent = `🚀 StreamPe ${cleanTag} Release Out Now`;
      }

      if (!Array.isArray(release.assets)) return;

      const zipAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.zip') || a.name.toLowerCase().includes('portable'));
      const apkAsset = release.assets.find(a => a.name.toLowerCase().endsWith('.apk') || a.name.toLowerCase().includes('companion'));

      if (zipAsset && btnZip) {
        btnZip.href = zipAsset.browser_download_url;
        btnZip.setAttribute('download', zipAsset.name);
        const span = btnZip.querySelector('span');
        if (span) span.textContent = `📦 Download ${zipAsset.name}`;
      }
      if (apkAsset && btnApk) {
        btnApk.href = apkAsset.browser_download_url;
        btnApk.setAttribute('download', apkAsset.name);
        const span = btnApk.querySelector('span');
        if (span) span.textContent = `📱 Download ${apkAsset.name}`;
      }
      if (zipAsset && navDownload) {
        navDownload.href = zipAsset.browser_download_url;
        navDownload.setAttribute('download', zipAsset.name);
      }
    } catch (err) {
      console.warn('[ReleaseAPI] Fallback to direct download links:', err.message);
    }
  }
  resolveLatestReleaseDownloads();
});
