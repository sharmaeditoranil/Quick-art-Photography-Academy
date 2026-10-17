/**
 * Quick Art Photography Academy
 * Offline On-Campus Sticky CTA & 1-Day Free Class Modal
 * Supports: courses/video-editing, courses/album-design, courses/ai-wedding-filmmaking,
 *           courses/ai-digital-marketing, courses/, master-class/, curriculum/
 */

(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.__qaOfflineStickyInitialized) return;
  window.__qaOfflineStickyInitialized = true;

  // Determine current course context from URL
  const path = (window.location.pathname || '').toLowerCase();
  let defaultCourse = 'Video Editing Course (Offline - Siwan Campus)';
  let shortCourseName = 'Offline Course';

  if (path.includes('/courses/album-design')) {
    defaultCourse = 'Wedding Album Design Course (Offline - Siwan Campus)';
    shortCourseName = 'Album Design Course';
  } else if (path.includes('/courses/ai-wedding-filmmaking')) {
    defaultCourse = 'AI Wedding Filmmaking Course (Offline - Siwan Campus)';
    shortCourseName = 'AI Wedding Filmmaking';
  } else if (path.includes('/courses/ai-digital-marketing') || path.includes('/courses/ai-marketing')) {
    defaultCourse = 'AI Digital Marketing Course (Offline - Siwan Campus)';
    shortCourseName = 'AI Digital Marketing';
  } else if (path.includes('/courses/video-editing')) {
    defaultCourse = 'Video Editing Course (Offline - Siwan Campus)';
    shortCourseName = 'Video Editing Course';
  } else if (path.includes('/master-class') || path.includes('/curriculum')) {
    defaultCourse = '14-Week Wedding Filmmaking Master Class (Offline - Siwan)';
    shortCourseName = '14-Week Master Class';
  } else if (path.includes('/courses')) {
    defaultCourse = 'On-Campus Comprehensive Course (Siwan Studio)';
    shortCourseName = 'On-Campus Course';
  }

  // Course Options List for Dropdown
  const courseOptions = [
    { value: 'Video Editing Course (Offline - Siwan Campus)', label: 'Video Editing Course (Offline - Siwan)' },
    { value: 'Wedding Album Design Course (Offline - Siwan Campus)', label: 'Wedding Album Design Course (Offline - Siwan)' },
    { value: 'AI Wedding Filmmaking Course (Offline - Siwan Campus)', label: 'AI Wedding Filmmaking Course (Offline - Siwan)' },
    { value: '14-Week Wedding Filmmaking Master Class (Offline - Siwan)', label: '14-Week Master Class in Siwan (Offline)' },
    { value: 'AI Digital Marketing Course (Offline - Siwan Campus)', label: 'AI Digital Marketing Course (Offline - Siwan)' },
    { value: 'General Enquiry / All Offline Courses (Siwan Campus)', label: 'All Courses / Guidance Needed (Siwan)' }
  ];

  // Helper to build options HTML
  const optionsHtml = courseOptions.map(opt => {
    const isSelected = opt.value === defaultCourse ? ' selected' : '';
    return `<option value="${opt.value}"${isSelected}>${opt.label}</option>`;
  }).join('');

  // 1. Create Sticky Bar Element
  const stickyBar = document.createElement('aside');
  stickyBar.className = 'offline-sticky-bar';
  stickyBar.setAttribute('aria-label', 'Offline 1 Day Free Class Booking');
  stickyBar.innerHTML = `
    <div class="offline-sticky-bar-inner">
      <div class="offline-sticky-info">
        <div class="offline-sticky-badge-row">
          <span class="offline-pill-tag">📍 Siwan Studio Campus</span>
          <span class="offline-offer-tag">🔥 Flat 10% OFF</span>
        </div>
        <p class="offline-sticky-title">1 Day Free Demo Class in Siwan Practical Studio</p>
        <p class="offline-sticky-sub">
          🏨 <strong>100% Free Hostel</strong> for Outside Students &bull; ⚡ New Batch Starting Soon
        </p>
      </div>
      <button type="button" class="offline-btn-green cta-bounce" id="qaOpenDemoModalBtn" aria-haspopup="dialog" aria-expanded="false">
        <span class="offline-btn-main">🎓 1 Day Free Class Book Now</span>
        <span class="offline-btn-sub">⚡ New Batch Starting Soon &bull; Flat 10% OFF</span>
      </button>
    </div>
  `;

  // 2. Create Popup Modal Element
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'offline-modal-overlay';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'offlineModalTitle');
  modalOverlay.id = 'qaOfflineDemoModal';

  modalOverlay.innerHTML = `
    <div class="offline-modal-card">
      <button type="button" class="offline-modal-close" id="qaCloseDemoModalBtn" aria-label="Close booking modal">&times;</button>
      
      <!-- Modal Header -->
      <div class="offline-modal-header">
        <span class="offline-modal-badge">📍 Siwan Campus &bull; 100% Free Hostel</span>
        <h2 class="offline-modal-title" id="offlineModalTitle">Book <em>1 Day Free Demo Class</em></h2>
        <p class="offline-modal-desc">
          Admission lene se pehle Siwan practical studio, workstations aur mentor training ka live anubhav karein.
        </p>
      </div>

      <!-- Offer & Batch Strip -->
      <div class="offline-modal-offer-banner">
        <span style="font-size:22px;line-height:1;">🎉</span>
        <div>
          <strong>New Batch Starting Soon:</strong> Aaj demo book karne par Offline Admission par <strong>Flat 10% OFF</strong> aur bahar ke students ke liye <strong>Free Hostel Stay</strong> milega!
        </div>
      </div>

      <!-- Booking Form -->
      <form id="qaOfflineDemoForm" novalidate>
        <!-- Honeypot for bots -->
        <input type="text" name="website" tabindex="-1" autocomplete="off" style="display:none;" aria-hidden="true">
        <input type="hidden" name="source" value="offline-1day-free-class-sticky">

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentName">Aapka Pura Naam (Full Name) *</label>
          <input type="text" id="qaStudentName" name="name" class="offline-input" placeholder="e.g. Rahul Kumar" required autocomplete="name">
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentPhone">WhatsApp / Mobile Number *</label>
          <div class="offline-phone-group">
            <span class="offline-phone-prefix">🇮🇳 +91</span>
            <input type="tel" id="qaStudentPhone" name="phone" class="offline-input" placeholder="10-digit number" required inputmode="numeric" maxlength="10" pattern="[0-9]{10}" autocomplete="tel">
          </div>
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentCity">Aapka Shahar / Jila (City / District)</label>
          <input type="text" id="qaStudentCity" name="city" class="offline-input" placeholder="e.g. Siwan, Gopalganj, Bettiah, Gaya, Aurangabad" autocomplete="address-level2">
        </div>

        <div class="offline-form-group">
          <label class="offline-form-label" for="qaStudentCourse">Offline Course Chuniye</label>
          <select id="qaStudentCourse" name="course" class="offline-select">
            ${optionsHtml}
          </select>
        </div>

        <button type="submit" class="offline-btn-green offline-submit-btn" id="qaSubmitDemoBtn">
          <span class="offline-btn-main">Confirm 1 Day Free Class Booking &rarr;</span>
          <span class="offline-btn-sub">100% Free Demo &bull; No Obligation &bull; Instant Call</span>
        </button>

        <p class="offline-trust-note">
          🔒 Aapki jankari surakshit hai. Hamare mentor 30 minutes me call karke details confirm karenge.
        </p>
      </form>
    </div>
  `;

  // Function to mount elements into document
  function mount() {
    if (document.body) {
      document.body.classList.add('has-offline-sticky');
      document.body.appendChild(stickyBar);
      document.body.appendChild(modalOverlay);
      bindEvents();
    } else {
      document.addEventListener('DOMContentLoaded', mount);
    }
  }

  // Open & Close Modal Helpers
  function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    const trigger = document.getElementById('qaOpenDemoModalBtn');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    const nameInput = document.getElementById('qaStudentName');
    if (nameInput) setTimeout(() => nameInput.focus(), 150);
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    const trigger = document.getElementById('qaOpenDemoModalBtn');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  // Bind interactive events
  function bindEvents() {
    // Open modal button
    const openBtn = document.getElementById('qaOpenDemoModalBtn');
    if (openBtn) {
      openBtn.addEventListener('click', openModal);
    }

    // Close button
    const closeBtn = document.getElementById('qaCloseDemoModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Click outside card to close
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Also attach to ANY element on the page with data-open-offline-demo OR existing "Book Free Demo Class" buttons!
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

    // Phone input restriction (only 10 digits)
    const phoneInput = document.getElementById('qaStudentPhone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function (e) {
        const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (e.target.value !== clean) {
          e.target.value = clean;
        }
      });
    }

    // Form submission
    const form = document.getElementById('qaOfflineDemoForm');
    const submitBtn = document.getElementById('qaSubmitDemoBtn');

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Bot check
        if (form.elements.website && form.elements.website.value) {
          return;
        }

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
          alert('Kripya 10 ankon ka sahi mobile number darj karein.');
          form.elements.phone.focus();
          return;
        }

        // Disable button while sending
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = `
          <span class="offline-btn-main">⏳ Seat Booking Ho Rahi Hai...</span>
          <span class="offline-btn-sub">Kripya pratiksha karein...</span>
        `;

        const payload = {
          name: name,
          phone: phone,
          city: city,
          course: course,
          source: 'offline-1day-free-class-sticky',
          message: 'Student requested 1 Day Free Demo Class in Siwan (New Batch 10% OFF Offer)'
        };

        try {
          // Resolve correct api endpoint
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
            // Success! Render celebration view
            renderSuccess(name, phone, course, city);

            // Trigger Meta/Google tracking if available
            try {
              if (window.fbq) fbq('track', 'Lead', { content_name: course, content_category: 'Offline 1 Day Free Class' });
              if (window.gtag) gtag('event', 'generate_lead', { event_category: 'Offline Demo Booking', event_label: course });
            } catch (_) {}
          } else {
            throw new Error(result.error || 'Unable to submit');
          }
        } catch (err) {
          console.warn('API error, falling back to direct WhatsApp confirmation:', err);
          // Even on network error, give instant fallback
          renderSuccess(name, phone, course, city);
        }
      });
    }
  }

  // Render celebratory success state
  function renderSuccess(name, phone, course, city) {
    const card = modalOverlay.querySelector('.offline-modal-card');
    if (!card) return;

    const waText = encodeURIComponent(
      `Namaste Quick Art Academy! Maine Siwan Campus me 1 Day Free Demo Class book kiya hai.\n` +
      `Naam: ${name}\n` +
      `Mobile: ${phone}\n` +
      `Course: ${course}\n` +
      `City: ${city || 'Not specified'}\n` +
      `Offer: 10% OFF New Batch\n` +
      `Kripya meri seat aur batch timing confirm karein.`
    );
    const waLink = `https://wa.me/919939800780?text=${waText}`;

    card.innerHTML = `
      <button type="button" class="offline-modal-close" onclick="document.getElementById('qaOfflineDemoModal').classList.remove('active'); document.body.style.overflow='';" aria-label="Close modal">&times;</button>
      
      <div class="offline-success-view">
        <div class="offline-success-icon">&#10004;</div>
        <h3 class="offline-success-title">🎉 Free Demo Seat Book Ho Gayi!</h3>
        <p class="offline-success-msg">
          Badhai ho <strong>${escapeHtml(name)}</strong>! Aapki <strong>1 Day Free Class</strong> ki request darj ho gayi hai.<br>
          Hamare senior mentor <strong>agle 30 minutes me</strong> aapko call karke batch timing aur Siwan hostel location confirm karenge.
        </p>

        <div style="background:rgba(228,179,95,0.12);border:1px dashed #e4b35f;border-radius:10px;padding:12px 14px;margin-bottom:18px;text-align:left;font-size:13px;color:#f8fafc;">
          <div style="color:#f5c879;font-weight:700;margin-bottom:4px;">✨ Aapke Benefits Reserve Ho Gaye:</div>
          <div>&bull; 1 Day Hands-on Practical Studio Session in Siwan</div>
          <div>&bull; Admission lene par <strong>Flat 10% OFF</strong> Discount</div>
          <div>&bull; Bahar ke students ke liye <strong>100% Free Hostel / Room</strong></div>
        </div>

        <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="offline-wa-confirm-btn">
          <span>💬 WhatsApp Par Turant Seat Confirm Karein &rarr;</span>
        </a>

        <button type="button" style="margin-top:14px;background:transparent;border:none;color:#94a3b8;font-size:13px;text-decoration:underline;cursor:pointer;" onclick="document.getElementById('qaOfflineDemoModal').classList.remove('active'); document.body.style.overflow='';">
          Band Karein (Close Window)
        </button>
      </div>
    `;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Mount when script loads
  mount();
})();
