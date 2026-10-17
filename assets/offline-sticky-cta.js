/**
 * Quick Art Photography Academy
 * Offline On-Campus Mobile Sticky CTA & Compact Modal
 * 
 * Features:
 * - Mobile-only responsive bottom bar (hidden on PC)
 * - Scroll-triggered appearance (slides up after scrolling past hero, hides at top)
 * - Website matching Gold Gradient + distinct contrast color for "Book Now"
 * - Compact & ultra-clean popup booking form
 */

(function () {
  'use strict';

  if (window.__qaOfflineStickyInitialized) return;
  window.__qaOfflineStickyInitialized = true;

  // Determine current course context from URL
  const path = (window.location.pathname || '').toLowerCase();
  let defaultCourse = 'Video Editing Course (Offline - Siwan Campus)';

  if (path.includes('/courses/album-design')) {
    defaultCourse = 'Wedding Album Design Course (Offline - Siwan Campus)';
  } else if (path.includes('/courses/ai-wedding-filmmaking')) {
    defaultCourse = 'AI Wedding Filmmaking Course (Offline - Siwan Campus)';
  } else if (path.includes('/courses/ai-digital-marketing') || path.includes('/courses/ai-marketing')) {
    defaultCourse = 'AI Digital Marketing Course (Offline - Siwan Campus)';
  } else if (path.includes('/courses/video-editing')) {
    defaultCourse = 'Video Editing Course (Offline - Siwan Campus)';
  } else if (path.includes('/master-class') || path.includes('/curriculum')) {
    defaultCourse = '14-Week Wedding Filmmaking Master Class (Offline - Siwan)';
  } else if (path.includes('/courses')) {
    defaultCourse = 'Comprehensive On-Campus Course (Siwan Studio)';
  }

  // Course Options List for Dropdown
  const courseOptions = [
    { value: 'Video Editing Course (Offline - Siwan Campus)', label: 'Video Editing Course (Siwan)' },
    { value: 'Wedding Album Design Course (Offline - Siwan Campus)', label: 'Wedding Album Design Course (Siwan)' },
    { value: 'AI Wedding Filmmaking Course (Offline - Siwan Campus)', label: 'AI Wedding Filmmaking Course (Siwan)' },
    { value: '14-Week Wedding Filmmaking Master Class (Offline - Siwan)', label: '14-Week Master Class (Siwan)' },
    { value: 'AI Digital Marketing Course (Offline - Siwan Campus)', label: 'AI Digital Marketing (Siwan)' },
    { value: 'General Enquiry / All Offline Courses (Siwan Campus)', label: 'All Offline Courses Guidance' }
  ];

  const optionsHtml = courseOptions.map(opt => {
    const isSelected = opt.value === defaultCourse ? ' selected' : '';
    return `<option value="${opt.value}"${isSelected}>${opt.label}</option>`;
  }).join('');

  // 1. Mobile Sticky Bar Element
  const stickyBar = document.createElement('aside');
  stickyBar.className = 'offline-sticky-bar';
  stickyBar.setAttribute('aria-label', '1 Days Free Demo Class Booking');
  stickyBar.innerHTML = `
    <div class="offline-sticky-bar-inner">
      <button type="button" class="offline-btn-gold cta-bounce" id="qaOpenDemoModalBtn" aria-haspopup="dialog" aria-expanded="false">
        <span class="offline-btn-main">
          <span>🎓 1 Days Free Demo Class</span>
          <span class="offline-book-text">Book Now &rarr;</span>
        </span>
        <span class="offline-btn-sub">
          ⚡ New Batch Starting Soon &bull; <strong>10% OFF</strong>
        </span>
      </button>
    </div>
  `;

  // 2. Compact & Clean Modal Element
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'offline-modal-overlay';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'offlineModalTitle');
  modalOverlay.id = 'qaOfflineDemoModal';

  modalOverlay.innerHTML = `
    <div class="offline-modal-card">
      <button type="button" class="offline-modal-close" id="qaCloseDemoModalBtn" aria-label="Close modal">&times;</button>
      
      <!-- Clean Header -->
      <div class="offline-modal-header">
        <span class="offline-modal-badge">📍 Siwan Campus &bull; Free Hostel</span>
        <h2 class="offline-modal-title" id="offlineModalTitle">Book <em>1 Day Free Demo Class</em></h2>
      </div>

      <!-- Compact Offer Strip -->
      <div class="offline-modal-offer-tag">
        ⚡ <strong>New Batch Starting Soon:</strong> 10% OFF on Admission + Free Hostel Stay
      </div>

      <!-- Compact Booking Form -->
      <form id="qaOfflineDemoForm" novalidate>
        <input type="text" name="website" tabindex="-1" autocomplete="off" style="display:none;" aria-hidden="true">
        <input type="hidden" name="source" value="offline-1day-free-class-sticky">

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentName">Pura Naam (Full Name) *</label>
          <input type="text" id="qaStudentName" name="name" class="offline-input" placeholder="e.g. Rahul Kumar" required autocomplete="name">
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentPhone">WhatsApp Number *</label>
          <div class="offline-phone-group">
            <span class="offline-phone-prefix">🇮🇳 +91</span>
            <input type="tel" id="qaStudentPhone" name="phone" class="offline-input" placeholder="10-digit number" required inputmode="numeric" maxlength="10" pattern="[0-9]{10}" autocomplete="tel">
          </div>
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentCity">Aapka Shahar / City (Optional)</label>
          <input type="text" id="qaStudentCity" name="city" class="offline-input" placeholder="e.g. Siwan, Gopalganj, Bettiah, Gaya" autocomplete="address-level2">
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentCourse">Course Chuniye</label>
          <select id="qaStudentCourse" name="course" class="offline-select">
            ${optionsHtml}
          </select>
        </div>

        <button type="submit" class="offline-modal-submit-btn" id="qaSubmitDemoBtn">
          Confirm Free Demo Class &rarr;
        </button>

        <p class="offline-trust-note">
          🔒 100% Free Demo &bull; Hamare mentor 30 mins me call karenge.
        </p>
      </form>
    </div>
  `;

  // Mount elements
  function mount() {
    if (document.body) {
      document.body.classList.add('has-offline-sticky');
      document.body.appendChild(stickyBar);
      document.body.appendChild(modalOverlay);
      bindScrollTrigger();
      bindEvents();
    } else {
      document.addEventListener('DOMContentLoaded', mount);
    }
  }

  // Scroll Trigger: Only show after scrolling past 220px (Like landing page)
  function bindScrollTrigger() {
    let ticking = false;
    const threshold = 220; // Trigger distance in pixels

    function updateStickyVisibility() {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (currentScroll > threshold) {
        stickyBar.classList.add('show');
      } else {
        stickyBar.classList.remove('show');
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(updateStickyVisibility);
        ticking = true;
      }
    }, { passive: true });

    // Initial check on page load
    updateStickyVisibility();
  }

  // Modal open/close helpers
  function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    const trigger = document.getElementById('qaOpenDemoModalBtn');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    const nameInput = document.getElementById('qaStudentName');
    if (nameInput) setTimeout(() => nameInput.focus(), 120);
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    const trigger = document.getElementById('qaOpenDemoModalBtn');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  // Bind interactive handlers
  function bindEvents() {
    // Open trigger
    const openBtn = document.getElementById('qaOpenDemoModalBtn');
    if (openBtn) {
      openBtn.addEventListener('click', openModal);
    }

    // Close trigger
    const closeBtn = document.getElementById('qaCloseDemoModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Click outside card
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Delegate to any on-page "Book Free Demo Class" buttons
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('a, button');
      if (!btn) return;
      if (btn.hasAttribute('data-open-offline-demo')) {
        e.preventDefault();
        openModal();
      } else if (btn.tagName === 'A' && btn.textContent && /Book\s+Free\s+Demo/i.test(btn.textContent)) {
        const href = btn.getAttribute('href') || '';
        if (href === '#main-content' || href === '#demo' || href.includes('contact-us')) {
          e.preventDefault();
          openModal();
        }
      }
    });

    // 10-digit numeric constraint
    const phoneInput = document.getElementById('qaStudentPhone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function (e) {
        const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (e.target.value !== clean) e.target.value = clean;
      });
    }

    // Form submission
    const form = document.getElementById('qaOfflineDemoForm');
    const submitBtn = document.getElementById('qaSubmitDemoBtn');

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Bot trap
        if (form.elements.website && form.elements.website.value) return;

        const name = (form.elements.name.value || '').trim();
        const phone = (form.elements.phone.value || '').replace(/\D/g, '').slice(0, 10);
        const city = (form.elements.city.value || '').trim();
        const course = form.elements.course ? form.elements.course.value : defaultCourse;

        if (!name) {
          alert('Kripya apna pura naam darj karein.');
          form.elements.name.focus();
          return;
        }

        if (phone.length !== 10) {
          alert('Kripya 10 ankon ka mobile number darj karein.');
          form.elements.phone.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Booking Ho Rahi Hai...';

        const payload = {
          name: name,
          phone: phone,
          city: city,
          course: course,
          source: 'offline-1day-free-class-sticky',
          message: 'Student booked 1 Day Free Demo Class in Siwan (New Batch 10% OFF)'
        };

        try {
          const apiPath = window.location.origin.includes('quickartphotography.in')
            ? '/api/leads.php'
            : (window.location.pathname.includes('/courses/') ? '../../api/leads.php' : '../api/leads.php');

          const response = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const result = await response.json();

          if (response.ok && result.ok) {
            renderSuccess(name, phone, course, city);
            try {
              if (window.fbq) fbq('track', 'Lead', { content_name: course });
              if (window.gtag) gtag('event', 'generate_lead', { event_label: course });
            } catch (_) {}
          } else {
            throw new Error(result.error || 'Submit error');
          }
        } catch (err) {
          console.warn('API lead submission fallback:', err);
          renderSuccess(name, phone, course, city);
        }
      });
    }
  }

  // Compact celebratory success view
  function renderSuccess(name, phone, course, city) {
    const card = modalOverlay.querySelector('.offline-modal-card');
    if (!card) return;

    const waText = encodeURIComponent(
      `Namaste Quick Art Academy! Maine 1 Day Free Demo Class book kiya hai.\n` +
      `Naam: ${name}\n` +
      `Mobile: ${phone}\n` +
      `Course: ${course}\n` +
      `City: ${city || 'Not specified'}\n` +
      `Kripya meri demo seat confirm karein.`
    );
    const waLink = `https://wa.me/919939800780?text=${waText}`;

    card.innerHTML = `
      <button type="button" class="offline-modal-close" onclick="document.getElementById('qaOfflineDemoModal').classList.remove('active'); document.body.style.overflow='';" aria-label="Close modal">&times;</button>
      
      <div class="offline-success-view">
        <div class="offline-success-icon">&#10004;</div>
        <h3 class="offline-success-title">🎉 Free Demo Book Ho Gaya!</h3>
        <p class="offline-success-msg">
          Dhanyawad <strong>${escapeHtml(name)}</strong>! Aapki request darj ho gayi hai. Hamare mentor jald hi aapse batch timing confirm karenge.
        </p>

        <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="offline-wa-confirm-btn">
          <span>💬 WhatsApp Par Confirm Karein &rarr;</span>
        </a>

        <button type="button" style="margin-top:12px;background:transparent;border:none;color:#94a3b8;font-size:12px;text-decoration:underline;cursor:pointer;" onclick="document.getElementById('qaOfflineDemoModal').classList.remove('active'); document.body.style.overflow='';">
          Close Window
        </button>
      </div>
    `;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  mount();
})();
