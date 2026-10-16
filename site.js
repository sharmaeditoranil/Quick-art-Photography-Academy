/* Plain JavaScript: shared navigation, progressive enhancement and real lead submission. */
(() => {
    'use strict';
    const scriptURL = document.currentScript?.src || new URL('site.js', location.href).href;
    const siteRoot = new URL('.', scriptURL);
    const header = document.querySelector('.qa-header');
    if (header) {
        if ((location.pathname || '/') === '/' || (location.pathname || '').endsWith('/index.html')) header.classList.add('qa-home-header');
        const toggle = header.querySelector('.qa-mobile');
        const nav = header.querySelector('.qa-nav');
        const courses = header.querySelector('.qa-courses');
        if (nav && nav.querySelectorAll) {
            const links = [...nav.querySelectorAll(':scope > a')];
            const blog = links.find(a => a.textContent.trim() === 'Blog');
            const faq = links.find(a => a.textContent.trim() === 'FAQ');
            const about = links.find(a => a.textContent.trim() === 'About');
            if (blog) blog.remove();
            if (faq) faq.remove();
            if (!nav.querySelector('.qa-resources')) {
                const resources = document.createElement('details'); resources.className = 'qa-resources';
                resources.innerHTML = `<summary>Resources <span class="qa-chevron" aria-hidden="true">⌄</span></summary><div class="qa-resources-menu"><a href="${about?.getAttribute('href') || '../about-us/'}">About Us</a><a href="${blog?.getAttribute('href') || '../blog/'}">Blog</a><a href="${faq?.getAttribute('href') || '../#faq'}">FAQ</a><a href="/downloads/quickart-academy-release.apk" download="quickart-academy.apk">Download Our App (APK)</a><a href="https://www.youtube.com/@QuickartPhotographyAcademy/videos" target="_blank" rel="noreferrer">YouTube</a><a href="https://wa.me/919939800780" target="_blank" rel="noreferrer">WhatsApp</a></div>`;
                const contact = links.find(a => a.textContent.trim() === 'Contact');
                if (contact && nav.insertBefore) nav.insertBefore(resources, contact); else nav.append(resources);
            }
            const resourcesMenu = nav.querySelector('.qa-resources');
            if (resourcesMenu) {
                let resourcesCloseTimer;
                resourcesMenu.addEventListener('pointerenter', () => { window.clearTimeout(resourcesCloseTimer); resourcesMenu.open = true; });
                resourcesMenu.addEventListener('pointerleave', () => { resourcesCloseTimer = window.setTimeout(() => { resourcesMenu.open = false; }, 180); });
                resourcesMenu.addEventListener('focusin', () => window.clearTimeout(resourcesCloseTimer));
                resourcesMenu.addEventListener('focusout', () => { resourcesCloseTimer = window.setTimeout(() => { if (!resourcesMenu.contains(document.activeElement)) resourcesMenu.open = false; }, 0); });
            }
        }
        // Keep the mega menu labels and chips aligned with the approved reference header.
        if (courses && courses.querySelectorAll) {
            const labels = courses.querySelectorAll('.qa-mega-title p, .qa-tag-group h3');
            if (labels[0]) labels[0].textContent = 'POPULAR PROGRAMS';
            if (labels[1]) labels[1].textContent = 'BY CAREER';
            if (labels[2]) labels[2].textContent = 'BY SOFTWARE';
            if (labels[3]) labels[3].textContent = 'BY MODE';
            const groups = courses.querySelectorAll('.qa-tag-group');
            const addChip = (group, text, href) => { if (group && ![...group.querySelectorAll('a')].some(a => a.textContent.trim() === text)) { const a = document.createElement('a'); a.href = href; a.textContent = text; group.querySelector('div')?.append(a); } };
            addChip(groups[0], 'Content Creator', 'https://quickartphotography.in/courses/');
            addChip(groups[1], 'After Effects', 'https://quickartphotography.in/courses/video-editing/');
            addChip(groups[1], 'AI Tools', 'https://quickartphotography.in/courses/ai-wedding-filmmaking/');
            addChip(groups[2], 'Weekend Batch', 'https://quickartphotography.in/contact-us/');
        }
        document.documentElement.classList.add('qa-js');
        // Transparent dark header at the top; a light floating bar after scrolling.
        let scrollScheduled = false;
        const updateHeader = () => {
            header.classList.toggle('qa-scrolled', window.scrollY > 32);
            scrollScheduled = false;
        };
        updateHeader();
        window.addEventListener('scroll', () => {
            if (!scrollScheduled) {
                scrollScheduled = true;
                window.requestAnimationFrame(updateHeader);
            }
        }, { passive: true });
        window.addEventListener('pageshow', updateHeader);
        // Desktop opens the entire menu on hover; native details keeps click/touch/keyboard support.
        const hoverMenu = window.matchMedia('(min-width:1200px) and (hover:hover) and (pointer:fine)');
        let menuCloseTimer;
        const cancelMenuClose = () => window.clearTimeout(menuCloseTimer);
        const closeCourses = () => { cancelMenuClose(); courses.open = false; };
        courses.addEventListener('pointerenter', () => {
            if (!hoverMenu.matches) return;
            cancelMenuClose();
            courses.open = true;
        });
        courses.addEventListener('pointerleave', () => {
            if (!hoverMenu.matches) return;
            cancelMenuClose();
            menuCloseTimer = window.setTimeout(() => { courses.open = false; }, 180);
        });
        courses.addEventListener('focusin', cancelMenuClose);
        courses.addEventListener('focusout', () => {
            cancelMenuClose();
            menuCloseTimer = window.setTimeout(() => {
                if (!courses.contains(document.activeElement)) courses.open = false;
            }, 0);
        });
        hoverMenu.addEventListener('change', closeCourses);
        const closeNav = () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
        });
        document.addEventListener('click', event => {
            if (!header.contains(event.target)) { closeCourses(); closeNav(); }
        });
        header.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (courses.open) { closeCourses(); courses.querySelector('summary').focus(); }
            else { closeNav(); toggle.focus(); }
        });
        header.addEventListener('click', event => {
            const link = event.target.closest('a');
            if (!link) return;
            closeCourses(); closeNav();
            const destination = new URL(link.href);
            if (destination.pathname === location.pathname && destination.hash) {
                const target = document.getElementById(destination.hash.slice(1));
                if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true }); }
            }
        });
        window.matchMedia('(min-width:1200px)').addEventListener('change', () => { closeNav(); closeCourses(); });
    }
    document.querySelectorAll('[data-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
    // Keep the software showcase compact so the tools support the page instead of dominating it.
    document.querySelectorAll('section').forEach(section => {
        if (section.querySelector('h2')?.textContent.includes('Pro tools used by industry leaders')) section.classList.add('qa-tools-section');
        if (section.querySelector('[data-thanks-heading]') || section.querySelector('[data-thanks-message]')) section.classList.add('qa-thanks-page');
    });
    const homeBadge = document.querySelector('.qa-home-hero .qa-hero-badge');
    if (homeBadge) homeBadge.textContent = 'New Batch Starting Soon';
    if ((location.pathname || '').includes('/contact-us/')) document.querySelector('main')?.classList.add('qa-contact-page');
    if ((location.pathname || '').includes('/courses/video-editing/')) document.querySelector('main')?.classList.add('qa-video-page');
    if ((location.pathname || '').includes('/courses/album-design/')) document.querySelector('main')?.classList.add('qa-album-page');
    if ((location.pathname || '').includes('/courses/ai-wedding-filmmaking/')) document.querySelector('main')?.classList.add('qa-ai-page');
    // Match the Master Class hero to the cinematic campaign layout while keeping the page content factual.
    if ((location.pathname || '').includes('/master-class/')) {
        const hero = document.querySelector('main > section.qa-master-hero') || document.querySelector('main > section.relative.bg-ink');
        if (hero) {
            hero.classList.add('qa-master-hero');
            const heroGrid = hero.querySelector('.container.relative > .grid');
            if (heroGrid) {
                heroGrid.classList.add('qa-master-hero-grid');
                if (window.innerWidth >= 1024) {
                    heroGrid.style.gridTemplateColumns = 'minmax(0,1.08fr) minmax(390px,.72fr)';
                    heroGrid.style.alignItems = 'center';
                }
            }
            const badge = hero.querySelector('.container.relative .lg\\:col-span-3 > .inline-flex span');
            if (badge) badge.textContent = 'Limited seats · New batch starting soon';
            const countdown = hero.querySelector('.qa-countdown') || hero.querySelector('.mc-studio-timer-wrap .qa-countdown') || hero.querySelector('.lg\\:col-span-3 .mt-9');
            if (countdown) {
                if (!countdown.querySelector('.qa-countdown-grid')) {
                    countdown.className = 'qa-countdown';
                    countdown.innerHTML = '<p>⏳ Early-bird pricing ends in</p><div class="qa-countdown-grid" role="timer" aria-label="Time remaining for early-bird pricing"><div><strong data-countdown-days>02</strong><span>Days</span></div><div><strong data-countdown-hours>14</strong><span>Hours</span></div><div><strong data-countdown-minutes>35</strong><span>Min</span></div><div><strong data-countdown-seconds>48</strong><span>Sec</span></div></div>';
                }
                const timerKey = 'qa-masterclass-live-timer-v3';
                const defaultDuration = (2 * 86400 + 14 * 3600 + 35 * 60 + 48) * 1000;
                let deadline;
                try {
                    const stored = localStorage.getItem(timerKey);
                    deadline = Number(stored);
                    if (!stored || !Number.isFinite(deadline) || deadline <= Date.now()) {
                        deadline = Date.now() + defaultDuration;
                        localStorage.setItem(timerKey, String(deadline));
                    }
                } catch (_) {
                    deadline = Date.now() + defaultDuration;
                }
                const tick = () => {
                    let diff = deadline - Date.now();
                    if (diff <= 0) {
                        deadline = Date.now() + defaultDuration;
                        try { localStorage.setItem(timerKey, String(deadline)); } catch (_) {}
                        diff = defaultDuration;
                    }
                    const totalSec = Math.floor(diff / 1000);
                    const days = Math.floor(totalSec / 86400);
                    const hours = Math.floor((totalSec % 86400) / 3600);
                    const minutes = Math.floor((totalSec % 3600) / 60);
                    const seconds = totalSec % 60;

                    const dEl = countdown.querySelector('[data-countdown-days]');
                    const hEl = countdown.querySelector('[data-countdown-hours]');
                    const mEl = countdown.querySelector('[data-countdown-minutes]');
                    const sEl = countdown.querySelector('[data-countdown-seconds]');

                    if (dEl) dEl.textContent = String(days).padStart(2, '0');
                    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
                    if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
                    if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
                };
                tick();
                window.setInterval(tick, 1000);
            }
        }
    }
    // The homepage keeps four clear reasons in one row; remove the duplicate placeholder card.
    const reasonsHeading = [...document.querySelectorAll('h2')].find(node => node.textContent.includes('Five reasons students pick Quick Art'));
    if (reasonsHeading) {
        const grid = reasonsHeading.closest('section')?.querySelector('.mt-14');
        const projectCard = grid && [...grid.children].find(card => card.textContent.trim() === 'Project practice');
        if (projectCard) projectCard.remove();
    }
    document.querySelectorAll('[data-lead-form]').forEach(form => {
        const requestedCourse = new URLSearchParams(location.search).get('course');
        const courseField = form.elements.course;
        if (requestedCourse && requestedCourse.length <= 120 && courseField) {
            if (courseField.tagName === 'SELECT' && ![...courseField.options].some(option => option.value === requestedCourse)) {
                courseField.add(new Option(requestedCourse, requestedCourse));
            }
            courseField.value = requestedCourse;
        }
        // The Master Class already has its section heading above the form; keep the form compact.
        if ((location.pathname || '').includes('/master-class/')) {
            form.classList.add('qa-master-form');
            form.querySelector('.qa-kicker')?.remove();
            form.querySelector('h2')?.remove();
            const intro = form.querySelector(':scope > p:not(.qa-form-status)');
            intro?.remove();
            if (form.closest('.qa-master-hero')) {
                const heroConsent = form.querySelector('input[name="consent"]');
                if (heroConsent) heroConsent.removeAttribute('required');
            }
        }
        // Auto pre-fill & real-time sync to localStorage for frictionless 1-step checkout
        if (form.elements.name) {
            const sn = localStorage.getItem('qa_user_name');
            if (sn && !form.elements.name.value) form.elements.name.value = sn;
            form.elements.name.addEventListener('input', e => {
                try { if (e.target.value.trim()) localStorage.setItem('qa_user_name', e.target.value.trim()); } catch (_) {}
            });
        }
        if (form.elements.phone) {
            const phoneEl = form.elements.phone;
            phoneEl.setAttribute('maxlength', '10');
            phoneEl.setAttribute('pattern', '[0-9]{10}');
            phoneEl.setAttribute('inputmode', 'numeric');
            const sp = localStorage.getItem('qa_user_phone');
            if (sp && !phoneEl.value) phoneEl.value = sp.replace(/\D/g, '').slice(-10);
            phoneEl.addEventListener('input', e => {
                const raw = e.target.value;
                const digits = raw.replace(/\D/g, '').slice(0, 10);
                if (raw !== digits) {
                    e.target.value = digits;
                }
                try {
                    if (digits) localStorage.setItem('qa_user_phone', digits);
                } catch (_) {}
            });
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            if (form.elements.website && form.elements.website.value) { return; } // bot
            const status = form.querySelector('.qa-form-status');
            const button = form.querySelector('button[type="submit"]');
            const rawPhone = form.elements.phone ? form.elements.phone.value.trim() : '';
            const phone = rawPhone.replace(/\D/g, '').slice(0, 10);
            if (phone.length !== 10) { 
                status.textContent = 'Please enter a valid 10-digit mobile number.'; 
                form.elements.phone.focus(); 
                return; 
            }
            const data = Object.fromEntries(new FormData(form));
            data.source = form.dataset.source || 'website';
            data.consent = true;
            button.disabled = true;
            status.textContent = 'Sending your enquiry…';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            try {
                if (location.protocol === 'file:') throw new Error('local');
                const leadsEndpoint = ['5500', '5501', '5502', '3000'].includes(location.port) ? 'http://127.0.0.1:8000/api/leads.php' : new URL('api/leads.php', siteRoot);
                const response = await fetch(leadsEndpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal
                });
                const result = await response.json();
                if (!response.ok || !result.ok || !result.id) throw new Error('server');
                try { 
                    sessionStorage.setItem('qa-enquiry-received', 'true'); 
                    sessionStorage.setItem('qa_lead_pending', '1');
                    if (data.name) localStorage.setItem('qa_user_name', data.name.trim());
                    if (phone) localStorage.setItem('qa_user_phone', phone.replace(/\D/g, '').slice(-10));
                } catch (_) { }
                location.assign(new URL('thank-you/', siteRoot));
            } catch (error) {
                status.replaceChildren();
                status.append(document.createTextNode('We could not confirm your enquiry. Please call +91 9939800780 or '));
                const link = document.createElement('a');
                link.href = 'mailto:support@quickartphotography.in?subject=' + encodeURIComponent('Course enquiry') + '&body=' + encodeURIComponent('Name: ' + data.name + '\nPhone: ' + phone + '\nCity: ' + (data.city || '') + '\nCourse: ' + (data.course || '') + '\nMessage: ' + (data.message || ''));
                link.textContent = 'send it by email'; status.append(link, document.createTextNode('.'));
                button.disabled = false;
            } finally { clearTimeout(timeout); }
        });
    });
    // Contact page map: keep the Google embed lazy and preserve the supplied map URL.
    // (skipped when the page already has its own map section)
    if ((location.pathname || '').includes('/contact-us/') && !document.getElementById('visit')) {
        const contactColumn = document.querySelector('#enquiry .qa-split > div');
        const contactLayout = document.querySelector('#enquiry > .container');
        if (contactColumn && contactLayout && !contactLayout.querySelector('.qa-map-wrap')) {
            const wrap = document.createElement('div'); wrap.className = 'qa-map-wrap';
            const link = document.createElement('a'); link.className = 'qa-map-link'; link.href = 'https://www.google.com/maps/search/?api=1&query=Quick+Art+Photography+Academy+Siwan'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open in Maps ↗';
            const map = document.createElement('iframe'); map.title = 'Quick Art Photography Academy location map'; map.src = 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3579.006652023136!2d84.33479439999999!3d26.228973399999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1788979519455!5m2!1sen!2sin'; map.loading = 'lazy'; map.referrerPolicy = 'strict-origin-when-cross-origin'; map.allowFullscreen = true;
            wrap.append(link, map); contactLayout.append(wrap);
        }
    }
    try {
        if (sessionStorage.getItem('qa-enquiry-received') === 'true') {
            const thanks = document.querySelector('[data-thanks-heading]');
            if (thanks) thanks.textContent = 'Application received';
            const message = document.querySelector('[data-thanks-message]');
            if (message) message.textContent = 'Aapka form successfully submit ho gaya hai. Hamari team aapki enquiry ke baare mein aapse sampark karegi.';
            sessionStorage.removeItem('qa-enquiry-received');
        }
    } catch (_) { }
})();
document.addEventListener('DOMContentLoaded', () => {
    const hero = document.querySelector('.qa-master-hero');
    hero?.querySelectorAll('span').forEach((node) => {
        if (/^\s*12\s*\+\s*2\s*weeks\s*$/i.test(node.textContent)) node.remove();
    });
    hero?.querySelectorAll('*').forEach((node) => {
        if (node.children.length === 0 && /1,800\+ students trained at Quick Art Photography Academy/i.test(node.textContent)) {
            node.remove();
        }
    });
    const form = hero?.querySelector('form.qa-enquiry');
    if (form) {
        const label = form.querySelector('.qa-kicker'); if (label) label.textContent = 'FREE DEMO CLASS';
        const title = form.querySelector('h2'); if (title) title.textContent = 'Book your seat today';
        const copy = form.querySelector('h2 + p'); if (copy) copy.textContent = 'Meet the mentor, tour the studio, and see the exact editing workflow — completely free.';
        const button = form.querySelector('button'); if (button) button.innerHTML = '🎬 Book My Seat Now <span aria-hidden="true">→</span>';
        const siteScriptURL = document.currentScript?.src || [...document.scripts].find(s => /\/site\.js(?:\?|$)/.test(s.src))?.src || new URL('site.js', location.href).href;
        const siteRoot = new URL('.', siteScriptURL);
        const avatarUrl = new URL('assets/form-avatars.png', siteRoot).href;
        let proof = form.querySelector('.qa-form-proof');
        if (!proof) {
            proof = document.createElement('div'); proof.className = 'qa-form-proof';
            (form.querySelector('.qa-form-status') || button)?.after(proof);
        }
        proof.innerHTML = '<div class="qa-proof-safe"><span class="qa-proof-icon" aria-hidden="true">🔒</span> Your details are safe. Team calls within 1 hour.</div><div class="qa-proof-divider" aria-hidden="true"></div><div class="qa-proof-social"><img src="' + avatarUrl + '" alt="Enrolled Students" width="42" height="16" class="qa-proof-avatars-img" loading="lazy"><span class="qa-proof-text"><strong>1,800+</strong> enrollments · <strong class="qa-proof-rating">4.9★</strong> rated</span></div>';
    }
    const price = hero?.querySelector('.tabular-nums');
    if (price && !hero.querySelector('.qa-price-original')) {
        const priceBlock = price.closest('.mt-7');
        if (priceBlock) priceBlock.innerHTML = '<div class="qa-price-row"><s class="qa-price-original">₹49,999</s><strong class="qa-price-current">₹ 35,000</strong><span class="qa-price-save">SAVE 30%</span></div>';
        const paymentNote = priceBlock?.nextElementSibling;
        if (paymentNote) paymentNote.textContent = 'EMI available from ₹2,500 / month';
    }
});
(() => {
    'use strict';
    if (!document.body) return;
    const scriptURL = document.currentScript?.src || [...document.scripts].find(s => /\/site\.js(?:\?|$)/.test(s.src))?.src || new URL('site.js', location.href).href;
    const popupRoot = new URL('.', scriptURL);
    const avatarUrl = new URL('assets/form-avatars.png', popupRoot).href;
    const getProofHTML = () => '<div class="qa-form-proof"><div class="qa-proof-safe"><span class="qa-proof-icon" aria-hidden="true">🔒</span> Your details are safe. Team calls within 1 hour.</div><div class="qa-proof-divider" aria-hidden="true"></div><div class="qa-proof-social"><img src="' + avatarUrl + '" alt="Enrolled Students" width="42" height="16" class="qa-proof-avatars-img" loading="lazy"><span class="qa-proof-text"><strong>1,800+</strong> enrollments · <strong class="qa-proof-rating">4.9★</strong> rated</span></div></div>';

    // Standardize proof footer on any enquiry form present on the page
    document.querySelectorAll('form.qa-enquiry').forEach(enqForm => {
        let proof = enqForm.querySelector('.qa-form-proof');
        if (!proof) {
            proof = document.createElement('div');
            proof.className = 'qa-form-proof';
            (enqForm.querySelector('.qa-form-status') || enqForm.querySelector('button[type="submit"]'))?.after(proof);
        }
        proof.innerHTML = '<div class="qa-proof-safe"><span class="qa-proof-icon" aria-hidden="true">🔒</span> Your details are safe. Team calls within 1 hour.</div><div class="qa-proof-divider" aria-hidden="true"></div><div class="qa-proof-social"><img src="' + avatarUrl + '" alt="Enrolled Students" width="42" height="16" class="qa-proof-avatars-img" loading="lazy"><span class="qa-proof-text"><strong>1,800+</strong> enrollments · <strong class="qa-proof-rating">4.9★</strong> rated</span></div>';
    });

    const path = location.pathname || '/';
    const isHome = path === '/' ||
        path === '/index.html' ||
        path.endsWith('/quickart-masterclass-final/') ||
        path.endsWith('/quickart-masterclass-final/index.html') ||
        path === popupRoot.pathname ||
        path === new URL('index.html', popupRoot).pathname;
    const isPortalOrAdmin = path.includes('/portal') || path.includes('/admin');

    if (!isPortalOrAdmin) {
        let rail = document.querySelector('.fixed.bottom-5.right-5, .qa-float-stack, .qa-float-actions');
        const floatMarkup = `<a href="https://wa.me/919939800780?text=Hi%2C%20I%20want%20to%20know%20about%20the%20Video%20Editing%20Course" target="_blank" rel="noreferrer" class="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 animate-float qa-float-whatsapp" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle h-6 w-6" aria-hidden="true" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg></a><a href="tel:+919939800780" class="h-14 w-14 rounded-full bg-white text-ink flex items-center justify-center shadow-2xl border border-black/5 hover:bg-gold-500 hover:text-black transition qa-float-call" style="color:#111827!important;background:#ffffff!important;" aria-label="Call Us"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#111827" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone h-6 w-6" aria-hidden="true" viewBox="0 0 24 24"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg></a>`;
        if (!rail) {
            rail = document.createElement('div');
            rail.className = 'fixed bottom-5 right-5 z-40 flex flex-col gap-2.5 items-end qa-float-stack';
            rail.innerHTML = floatMarkup;
            document.body.append(rail);
        } else {
            rail.className = 'fixed bottom-5 right-5 z-40 flex flex-col gap-2.5 items-end qa-float-stack';
            rail.innerHTML = floatMarkup;
        }
    }

    // Automatic popup tracking: Har customer ko poori website pe kewal EK hi baar automatic popup dikhe
    const AUTO_POPUP_KEY = 'qaa_popup_auto_shown';
    const hasAutoPopupShown = () => {
        try {
            return localStorage.getItem(AUTO_POPUP_KEY) === 'true' ||
                   sessionStorage.getItem('qa-enquiry-received') === 'true';
        } catch (_) {
            return false;
        }
    };

    const markAutoPopupShown = () => {
        try {
            localStorage.setItem(AUTO_POPUP_KEY, 'true');
        } catch (_) {}
    };

    const showPopup = (initialCourse, isAuto = false) => {
        if (document.querySelector('.qa-popup-overlay')) return;
        markAutoPopupShown();
        const overlay = document.createElement('div'); overlay.className = 'qa-popup-overlay';
        overlay.innerHTML = '<div class="qa-popup" role="dialog" aria-modal="true" aria-labelledby="qa-popup-title"><div class="qa-popup-top"><button class="qa-popup-close" type="button" aria-label="Close popup" title="Close">✕</button><span>♔ LIMITED SEATS LEFT</span><h2 id="qa-popup-title">Get a <em>FREE</em> Course Consultation</h2><p>Leave your details — our mentor will call within 60 minutes and guide you on the best course for your goals.</p></div><form class="qa-popup-form"><input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><input name="name" required placeholder="Your Full Name *" autocomplete="name"><div class="qa-phone-group"><span class="qa-phone-prefix">🇮🇳 +91</span><input name="phone" required type="tel" inputmode="numeric" maxlength="10" pattern="[0-9]{10}" placeholder="10-digit number *" autocomplete="tel"></div><input name="city" placeholder="Your City (optional)" autocomplete="address-level2"><input name="course" placeholder="Which course are you interested in? (optional)"><button type="submit">Request Free Callback <span>→</span></button>' + getProofHTML() + '<p class="qa-popup-status" role="status"></p></form></div>';
        document.body.append(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.qa-popup-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        const previousFocus = document.activeElement;
        overlay.querySelectorAll('input').forEach(input => input.setAttribute('aria-label', input.placeholder));
        const popupNameInp = overlay.querySelector('input[name="name"]');
        const popupPhoneInp = overlay.querySelector('input[name="phone"]');
        if (popupNameInp) {
            const sn = localStorage.getItem('qa_user_name');
            if (sn && !popupNameInp.value) popupNameInp.value = sn;
            popupNameInp.addEventListener('input', e => {
                try { if (e.target.value.trim()) localStorage.setItem('qa_user_name', e.target.value.trim()); } catch (_) {}
            });
        }
        if (popupPhoneInp) {
            const sp = localStorage.getItem('qa_user_phone');
            if (sp && !popupPhoneInp.value) popupPhoneInp.value = sp.replace(/\D/g, '').slice(0, 10);
            popupPhoneInp.addEventListener('input', e => {
                const raw = e.target.value;
                const digits = raw.replace(/\D/g, '').slice(0, 10);
                if (raw !== digits) e.target.value = digits;
                try {
                    if (digits) localStorage.setItem('qa_user_phone', digits);
                } catch (_) {}
            });
        }
        if (initialCourse) {
            const courseField = overlay.querySelector('input[name="course"]');
            if (courseField && !courseField.value) courseField.value = initialCourse;
        }
        (popupPhoneInp && popupNameInp && popupNameInp.value ? popupPhoneInp : (popupNameInp || overlay.querySelector('input'))).focus();
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') { close(); previousFocus?.focus(); }
            if (e.key === 'Tab') {
                const nodes = [...overlay.querySelectorAll('button,input,a[href]')].filter(n => !n.disabled);
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        overlay.querySelector('form').addEventListener('submit', async e => {
            e.preventDefault(); const form = e.currentTarget; if (!form.reportValidity()) return;
            if (form.elements.website && form.elements.website.value) { return; } // bot
            const status = overlay.querySelector('.qa-popup-status'), button = form.querySelector('button');
            const data = Object.fromEntries(new FormData(form));
            const phoneDigits = (data.phone || '').replace(/\D/g, '').slice(0, 10);
            if (phoneDigits.length !== 10) { status.textContent = 'Please enter a valid 10-digit mobile number.'; return; }
            data.phone = phoneDigits;
            data.source = 'course-popup'; data.consent = true; button.disabled = true; status.textContent = 'Sending your enquiry…';
            const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
            try {
                const popupEndpoint = ['5500', '5501', '5502', '3000'].includes(location.port) ? 'http://127.0.0.1:8000/api/leads.php' : new URL('api/leads.php', popupRoot);
                const response = await fetch(popupEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal });
                const result = await response.json(); if (!response.ok || !result.ok || !result.id) throw new Error('save');
                try {
                    sessionStorage.setItem('qa-enquiry-received', 'true');
                    sessionStorage.setItem('qa_lead_pending', '1');
                    localStorage.setItem(AUTO_POPUP_KEY, 'true');
                    if (data.name) localStorage.setItem('qa_user_name', data.name.trim());
                    if (data.phone) localStorage.setItem('qa_user_phone', data.phone.replace(/\D/g, '').slice(-10));
                } catch (_) { }
                location.assign(new URL('thank-you/', popupRoot));
            } catch (_) { status.textContent = 'Unable to save your enquiry. Please try again or call +91 9939800780.'; button.disabled = false; }
            finally { clearTimeout(timeout); }
        });
    };

    // Universal 10-digit numeric constraint for all phone/whatsapp inputs (Non-capturing, low INP)
    document.addEventListener('input', e => {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT') return;
        if (t.type === 'tel' || t.name === 'phone' || (t.id && t.id.toLowerCase().includes('phone'))) {
            const raw = t.value;
            const digits = raw.replace(/\D/g, '').slice(0, 10);
            if (raw !== digits) {
                t.value = digits;
            }
        }
    }, { passive: true });

    document.addEventListener('paste', e => {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT') return;
        if (t.type === 'tel' || t.name === 'phone' || (t.id && t.id.toLowerCase().includes('phone'))) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
            let digits = text.replace(/\D/g, '');
            if (digits.length === 12 && digits.startsWith('91')) {
                digits = digits.slice(2);
            } else if (digits.length > 10) {
                digits = digits.slice(-10);
            }
            t.value = digits.slice(0, 10);
            t.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    document.addEventListener('keydown', e => {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT') return;
        if (t.type === 'tel' || t.name === 'phone' || (t.id && t.id.toLowerCase().includes('phone'))) {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)) return;
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        }
    });

    // Connect all "Book Free Demo" buttons/links on the page (Fast-pathed for sub-16ms INP)
    // Popup is homepage-only: on other pages these links keep their normal href (contact page / on-page form).
    document.addEventListener('click', e => {
        if (!isHome) return;
        const trigger = e.target.closest('a, button');
        if (!trigger) return;
        if (trigger.type === 'submit' || trigger.closest('form')) return;

        let isDemoCta = false;
        if (trigger.classList.contains('ref-demo-cta') || trigger.hasAttribute('data-open-popup')) {
            isDemoCta = true;
        } else if (trigger.classList.contains('qa-demo')) {
            isDemoCta = /contact-us.*#enquiry/i.test(trigger.getAttribute('href') || '');
        } else {
            const t = trigger.textContent || '';
            if (t.includes('Demo') || t.includes('demo')) {
                isDemoCta = /book\s+(?:free\s+)?demo/i.test(t);
            }
        }

        if (isDemoCta) {
            e.preventDefault();
            e.stopPropagation();
            showPopup();
        }
    });

    // Page open hone ke 15 second baad popup automatically open ho — sirf Home page par, har customer ko kewal EK hi baar
    if (isHome && !hasAutoPopupShown()) {
        window.setTimeout(() => {
            if (!hasAutoPopupShown() && !document.querySelector('.qa-popup-overlay')) {
                markAutoPopupShown();
                showPopup(null, true);
            }
        }, 15000);
    }
})();
(() => {
    const button = document.querySelector('.qa-motion-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
        const paused = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(paused));
        button.closest('.qa-tools').classList.toggle('is-paused', paused);
        button.textContent = paused ? 'Resume motion' : 'Pause motion';
    });
})();

// Supplied visual examples complement, but never impersonate, student reviews.
(() => {
    const main = document.querySelector('main');
    if (!main || /\/(?:thank-you\/|contact-us\/|404\.html|admin\.html|sitemap\.html)/.test(location.pathname) || (location.pathname || '').includes('/blog') || document.querySelector('link[rel="canonical"][href*="/blog/"]')) return;
    const script = [...document.scripts].find(s => /\/site\.js(?:\?|$)/.test(s.src));
    if (!script || document.getElementById('qaa-editing-examples')) return;
    const root = new URL('.', script.src);
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('editing-examples.css', root).href; document.head.append(style);
    const section = document.createElement('section'); section.id = 'qaa-editing-examples'; section.className = 'qaa-examples'; section.setAttribute('aria-labelledby', 'qaa-examples-title');
    const wrap = document.createElement('div'); wrap.className = 'qaa-examples-wrap';
    wrap.innerHTML = '<header class="qaa-examples-heading"><span>BEFORE &amp; AFTER</span><h2 id="qaa-examples-title">See the Difference AI Can Make</h2><p>Transform ordinary photos into professional results using modern AI editing techniques. Learn practical workflows for enhancement, retouching, color grading and creative editing.</p></header>';
    const grid = document.createElement('div'); grid.className = 'qaa-examples-grid';
    const examples = [['portrait', 'AI Portrait Enhancement', 'Natural skin retouching, lighting & professional portrait enhancement.'], ['landscape', 'AI Color Enhancement', 'Turn flat images into vibrant, cinematic and eye-catching visuals.'], ['retouch', 'AI Beauty Retouching', 'Professional skin cleanup, facial enhancement and polished results.']];
    examples.forEach(([file, title, description], i) => { const figure = document.createElement('figure'); const img = document.createElement('img'); img.src = new URL('assets/editing-example-' + file + '.webp', root).href; img.alt = title + ' — before and after editing example'; img.width = 1000; img.height = 450; img.loading = 'lazy'; img.decoding = 'async'; const caption = document.createElement('figcaption'); const copy = document.createElement('div'); const label = document.createElement('h3'); label.textContent = title; const text = document.createElement('p'); text.textContent = description; copy.append(label, text); caption.append(copy); figure.append(img, caption); grid.append(figure); });
    const actions = document.createElement('div'); actions.className = 'qaa-examples-actions'; const cta = document.createElement('a'); cta.href = new URL('courses/', root).href; cta.textContent = 'Explore Our Courses →'; actions.append(cta);
    const profiles = [['Raju Sharma', 'RS', 'AI Portrait Editor'], ['Harendra Yadav', 'HY', 'Colorist'], ['Nidhi Kumari', 'NK', 'Retouching Experts']];
    [...grid.children].forEach((figure, i) => {
        const [name, initials, role] = profiles[i]; const profile = document.createElement('div'); profile.className = 'qaa-example-profile';
        const avatar = document.createElement('span'); avatar.className = 'qaa-neutral-avatar'; avatar.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>'; avatar.setAttribute('aria-hidden', 'true');
        const info = document.createElement('div'); info.className = 'qaa-profile-info'; const row = document.createElement('div'); row.className = 'qaa-profile-name-row'; const title = document.createElement('strong'); title.textContent = name; const stars = document.createElement('span'); stars.className = 'qaa-profile-stars'; stars.textContent = '★★★★★'; stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', '5 out of 5 stars'); row.append(title, stars); const note = document.createElement('small'); note.textContent = role; info.append(row, note); profile.append(avatar, info); figure.querySelector('img').after(profile);
    });
    wrap.append(grid, actions); section.append(wrap);
    const whyChoose = main.querySelector('#why-choose');
    const review = [...main.querySelectorAll('section')].find(s => [...s.querySelectorAll('h2')].some(h => /community of|testimonials|student stories/i.test(h.textContent)));
    const faq = main.querySelector('#faq') || [...main.querySelectorAll('section:not(.mc-info)')].find(s => [...s.querySelectorAll('h2')].some(h => /frequently asked questions/i.test(h.textContent)));
    const anchor = whyChoose || (main.querySelector('.mc-bonuses') ? (faq || review) : (review || faq)) || main.querySelector('#visit');
    if (anchor) anchor.before(section); else main.append(section);
})();

(() => {
    const source = [...document.scripts].find(s => /\/site\.js(?:\?|$)/.test(s.src)); if (!source) return;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('final-polish.css', source.src).href; document.head.append(css);
    const main = document.querySelector('main'); if (!main) return;
    const app = main.querySelector('.qaa-play-download')?.closest('section');
    const homeFaq = main.querySelector('#faq'); if (app && homeFaq) homeFaq.before(app);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!('IntersectionObserver' in window) || reduced.matches) return;

    // Scroll motion: only content BELOW the fold is hidden (no LCP/CLS cost); grids reveal with a stagger.
    const skip = '.qa-scroll-reveal,.qa-scroll-stagger,.qa-scroll-zoom,.qa-scroll-left,.qa-scroll-right,[data-no-motion],.ref-header,dialog,[role="dialog"]';
    const items = new Set();
    const add = (el, kind, delay) => {
        if (!el || items.has(el) || el.closest(skip) || items.size > 360) return;
        el.classList.add('qm', kind); if (delay) el.style.setProperty('--qm-d', delay + 'ms'); items.add(el);
    };
    const finish = el => { el.classList.remove('qm', 'qm-up', 'qm-zoom', 'qm-in'); el.style.removeProperty('--qm-d'); };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target; observer.unobserve(el); el.classList.add('qm-in');
        // Hand transforms back to the component (hover lifts etc.) once the reveal is done
        setTimeout(() => finish(el), 900 + (parseInt(el.style.getPropertyValue('--qm-d')) || 0));
    }), { threshold: 0.12, rootMargin: '0px 100% -8% 100%' }); // wide side margins: carousels/marquees never stay hidden

    requestAnimationFrame(() => {
        const fold = innerHeight;
        main.querySelectorAll('section').forEach(section => {
            if (section.getBoundingClientRect().bottom < fold) return;
            section.querySelectorAll(':scope :is(h2, h2 + p, [class*="eyebrow"], [class*="kicker"], [class*="badge"]):not(:is([class*="grid"] *, [class*="cards"] *))').forEach(el => add(el, 'qm-up'));
            section.querySelectorAll(':scope :is([class*="grid"], [class*="cards"], [class*="-list"], .qaa-examples-grid)').forEach(grid => {
                if (/marquee|track|slider|carousel|swiper|ticker|scroll/i.test(grid.getAttribute('class') || '') || grid.scrollWidth > grid.clientWidth + 4) return;
                const kids = [...grid.children].filter(k => /^(DIV|ARTICLE|FIGURE|LI|A)$/.test(k.tagName));
                if (kids.length < 2 || kids.length > 24) return;
                kids.forEach((k, i) => add(k, k.tagName === 'FIGURE' ? 'qm-zoom' : 'qm-up', Math.min(i, 7) * 70));
            });
            section.querySelectorAll(':scope :is(figure, .qa-roadmap-header, details):not(.qm, .qm *)').forEach(el => add(el, 'qm-up'));
        });
        items.forEach(el => {
            if (el.getBoundingClientRect().top < fold * 0.92) { items.delete(el); finish(el); return; }
            observer.observe(el);
        });
        document.documentElement.classList.add('qm-on');
    });
    reduced.addEventListener('change', () => { if (reduced.matches) { observer.disconnect(); items.forEach(finish); } });
})();

// Premium Scroll Reveal & Stagger Animation Controller
(() => {
    if (typeof window === 'undefined') return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const initScrollAnimation = () => {
        document.documentElement.classList.add('qa-animations-active');

        const targets = document.querySelectorAll('.qa-scroll-reveal, .qa-scroll-stagger, .qa-scroll-zoom, .qa-scroll-left, .qa-scroll-right');
        if (!targets.length) return;

        if (!('IntersectionObserver' in window)) {
            targets.forEach(el => el.classList.add('is-revealed'));
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    obs.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            threshold: 0.08,
            rootMargin: '0px 0px -40px 0px'
        });

        targets.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                el.classList.add('is-revealed');
            } else {
                observer.observe(el);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollAnimation);
    } else {
        initScrollAnimation();
    }
})();

/* =========================================================================
   LIVE COURSE SYNC: Auto-sync prices, discounts, and posters from Course Builder
   ========================================================================= */
(function initLiveCourseSync() {
    const runSync = () => {
        const landingSection = document.querySelector('.course-structure-section[data-course-id]');
        const isLandingPage = !!landingSection;
        const isHubPage = !!document.querySelector('.hub-card');
        if (!isLandingPage && !isHubPage) return;

        function getRelativeRoot() {
            const segs = window.location.pathname.replace(/^\/|\/(?:index\.html)?$/g, '').split('/').filter(Boolean);
            return segs.length > 0 ? '../'.repeat(segs.length) : '';
        }

        function resolveAssetUrl(path) {
            if (!path) return '';
            if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//') || path.startsWith('data:')) return path;
            if (path.startsWith('/')) return path;
            return getRelativeRoot() + path.replace(/^\.?\//, '');
        }

        function applyCourseToLanding(course) {
            if (!course) return;

            // 1. Sync Price & Discounts
            if (course.price) {
                const salePrice = Number(course.price);
                const origPrice = Number(course.originalPrice || (salePrice * 2));
                const curStr = '₹' + salePrice.toLocaleString('en-IN');
                const origStr = '₹' + origPrice.toLocaleString('en-IN');
                const savings = origPrice > salePrice ? (origPrice - salePrice) : 0;
                const savingsStr = '₹' + savings.toLocaleString('en-IN');
                const discountPct = origPrice > salePrice ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0;

                // Price display elements
                document.querySelectorAll('.lp-current-price, .lp-pricing-price').forEach(el => {
                    el.textContent = curStr;
                });
                document.querySelectorAll('.lp-original-price, .lp-pricing-strike').forEach(el => {
                    el.textContent = origStr;
                });

                // Sticky Mobile Bottom Bar
                const stickyEl = document.querySelector('.lp-sticky-price');
                if (stickyEl) {
                    stickyEl.innerHTML = `${curStr} <span class="lp-sticky-orig">${origStr}</span>`;
                }

                // Discount Badge & Urgency Pills
                if (discountPct > 0) {
                    document.querySelectorAll('.lp-discount-badge').forEach(el => {
                        el.textContent = `${discountPct}% OFF TODAY`;
                    });
                    document.querySelectorAll('.lp-urgency-pill').forEach(el => {
                        el.textContent = `${discountPct}% OFF`;
                    });
                }

                // Urgency Banner Savings
                const urgencyBar = document.querySelector('.lp-urgency-bar');
                if (urgencyBar && savings > 0) {
                    urgencyBar.innerHTML = `🔥 सीमित समय ऑफर: <span class="lp-urgency-pill">${discountPct}% OFF</span> आज ही Enroll करें और ${savingsStr} बचाएं! <strong>ऑफर जल्द समाप्त होने वाला है।</strong>`;
                }

                // Pricing Tagline
                const tagline = document.querySelector('.lp-pricing-tagline');
                if (tagline && savings > 0) {
                    tagline.textContent = `Save ${savingsStr} Today · Instant Classroom Activation`;
                }

                // Action Buttons with Price (e.g. "⚡ Enroll Now & Start Watching — ₹4,999")
                document.querySelectorAll('.lp-btn-primary, .lp-pricing-btn, .lp-sticky-btn').forEach(btn => {
                    if (btn.textContent.includes('₹')) {
                        btn.innerHTML = btn.innerHTML.replace(/₹[\d,]+/g, curStr);
                    }
                });
            }

            // 2. Sync Poster / Thumbnail (handles both picture source and img)
            if (course.thumbnail) {
                const thumbUrl = resolveAssetUrl(course.thumbnail);
                document.querySelectorAll('.lp-media-thumb, .lp-preview-img, .lp-media-card, .lp-hero-preview, .lp-video-poster').forEach(container => {
                    container.querySelectorAll('picture source').forEach(src => {
                        src.srcset = thumbUrl;
                    });
                    container.querySelectorAll('img').forEach(img => {
                        img.src = thumbUrl;
                        if (course.title) img.alt = course.title;
                    });
                });
                document.querySelectorAll('.lp-media-thumb img, .lp-preview-img img, .lp-media-card img, .lp-hero-preview img, .lp-video-poster img').forEach(img => {
                    img.src = thumbUrl;
                    if (course.title) img.alt = course.title;
                });
            }

            // 3. Sync Course Duration
            if (course.duration) {
                const durStr = formatCourseDuration(course.duration);
                const durNumMatch = durStr.match(/\d+/);
                const durNum = durNumMatch ? parseFloat(durNumMatch[0]) : null;

                // A. Hero highlight badges / chips (e.g. "65+ Hours 4K Lessons", "45+ Hours HD Video")
                document.querySelectorAll('.lp-h-item, .lp-chip').forEach(item => {
                    const textEl = item.querySelector('.lp-h-text') || item;
                    if (/\b\d+\+?\s*(?:Hours?|Hrs?)\b/i.test(textEl.textContent)) {
                        textEl.textContent = textEl.textContent.replace(/\b\d+\+?\s*(?:Hours?|Hrs?)\b/i, durStr);
                    }
                });

                // B. Stats bar KPI values (.lp-stat-val, .lp-stat-num)
                document.querySelectorAll('.lp-stat-val, .lp-stat-num').forEach(el => {
                    if (/\b\d+\+?\s*(?:Hours?|Hrs?)\b/i.test(el.textContent) || (el.id && el.id.includes('duration'))) {
                        el.textContent = durStr;
                        if (el._counterItem) {
                            el._counterItem.raw = durStr;
                            if (durNum !== null) el._counterItem.target = durNum;
                        }
                    }
                });

                // C. Curriculum section header stat (#cs-stat-duration)
                const csDur = document.getElementById('cs-stat-duration');
                if (csDur) {
                    csDur.textContent = durStr;
                }

                // D. Pricing checklist, feature bullets, & bonus items
                document.querySelectorAll('.lp-pricing-list li, .lp-pricing-card li, .lp-bonus-card li, .lp-feature-bullets li, .cs-curriculum-header').forEach(el => {
                    if (/\b\d+\+?\s*(?:Hours?|Hrs?)\b/i.test(el.innerHTML)) {
                        el.innerHTML = el.innerHTML.replace(/\b\d+\+?\s*(?:Hours?|Hrs?)\b/gi, durStr);
                    }
                });
            }

            // 4. Sync Course Description & Subtitle
            const desc = course.description || course.subtitle;
            if (desc) {
                // Hero Section description / subtitle
                document.querySelectorAll('.lp-hero-sub, .lp-hero-desc').forEach(el => {
                    el.textContent = desc;
                });
                // Curriculum header subtitle
                const csSub = document.getElementById('cs-subtitle');
                if (csSub) {
                    csSub.textContent = (course.title ? course.title + ' — ' : '') + desc;
                }
                // SEO meta tags
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) metaDesc.setAttribute('content', desc);
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc) ogDesc.setAttribute('content', desc);
            }

            // 5. Sync Course Title & Breadcrumbs
            if (course.title) {
                const breadcrumbActive = document.querySelector('.lp-breadcrumb .active');
                if (breadcrumbActive) breadcrumbActive.textContent = course.title;
                const pricingTitle = document.querySelector('.lp-pricing-title');
                if (pricingTitle) pricingTitle.textContent = course.title;
            }

            // 6. Sync Course Badge
            if (course.badge) {
                document.querySelectorAll('.lp-badge-tag').forEach(el => {
                    el.textContent = course.badge;
                });
            }

            // 7. Sync Curriculum Modules & Lessons
            if (Array.isArray(course.modules) && course.modules.length) {
                const modulesList = document.getElementById('cs-modules-list');
                if (modulesList) {
                    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    const parseDur = d => { if (!d) return 0; const p = String(d).split(':'); return parseInt(p[0] || 0, 10); };
                    let totalLessons = 0, totalMins = 0;
                    course.modules.forEach(m => {
                        (m.lessons || []).forEach(l => { totalLessons++; totalMins += parseDur(l.duration); });
                    });
                    const hrs = Math.floor(totalMins / 60);
                    const durStr = course.duration || (hrs + ' Hour' + (hrs !== 1 ? 's' : ''));

                    const badgeEl = document.getElementById('cs-badge-text');
                    const subEl = document.getElementById('cs-subtitle');
                    const modStat = document.getElementById('cs-stat-modules');
                    const lesStat = document.getElementById('cs-stat-lessons');
                    const durStat = document.getElementById('cs-stat-duration');

                    if (badgeEl) badgeEl.textContent = (course.badge ? course.badge + ' • ' : '') + course.modules.length + ' MODULES • ' + totalLessons + ' SESSIONS';
                    if (subEl) subEl.textContent = (course.title ? course.title + ' — ' : '') + (course.subtitle || course.description || 'Comprehensive step-by-step curriculum.');
                    if (modStat) modStat.textContent = course.modules.length;
                    if (lesStat) lesStat.textContent = totalLessons + '+';
                    if (durStat) durStat.textContent = durStr;

                    modulesList.innerHTML = course.modules.map((mod, index) => {
                        const isFirst = index === 0;
                        const lessons = (mod.lessons || []).map(les => {
                            const res = (les.resources && les.resources.length) ? '<span class="cs-lesson-resource-tag" title="Includes downloadable resources">&#128206;</span>' : '';
                            return `<li class="cs-lesson-item"><div class="cs-lesson-left"><span class="cs-lesson-bullet"></span><div class="cs-lesson-details"><span class="cs-lesson-title">${esc(les.title)}</span>${les.summary ? `<span class="cs-lesson-desc">${esc(les.summary)}</span>` : ''}</div></div><div class="cs-lesson-right">${res}${les.duration ? `<span class="cs-lesson-dur">${esc(les.duration)}</span>` : ''}</div></li>`;
                        }).join('');
                        const numStr = String(index + 1).padStart(2, '0');
                        return `<details class="cs-mod-card"${isFirst ? ' open' : ''}><summary class="cs-mod-summary"><div class="cs-mod-left"><span class="cs-mod-num">Module ${numStr}</span><div class="cs-mod-title-group"><div class="cs-mod-title">${esc(mod.title)}</div><div class="cs-mod-meta"><span>${(mod.lessons || []).length} Lesson${(mod.lessons || []).length !== 1 ? 's' : ''}</span></div></div></div><div class="cs-mod-right"><span class="cs-chevron" aria-hidden="true">+</span></div></summary><div class="cs-mod-body"><ul class="cs-lessons-list">${lessons}</ul></div></details>`;
                    }).join('');

                    const banner = document.getElementById('cs-action-banner');
                    const actTitle = document.getElementById('cs-action-title');
                    if (banner) banner.style.display = '';
                    if (actTitle && course.title) actTitle.textContent = 'Ready to Master this Complete ' + course.title + '?';
                }
            }
        }

        function formatCourseDuration(raw) {
            if (!raw) return '';
            const str = String(raw).trim();
            const numMatch = str.match(/\d+/);
            if (!numMatch) return str;
            const num = numMatch[0];
            if (/^\d+$/.test(str) || /^\d+\s*(?:hours?|hrs?)$/i.test(str)) {
                return num + '+ Hours';
            }
            return str;
        }

        function applyCoursesToHub(coursesList) {
            if (!Array.isArray(coursesList) || !coursesList.length) return;
            const map = {};
            coursesList.forEach(c => { if (c && c.id) map[c.id] = c; });

            document.querySelectorAll('.hub-card').forEach(card => {
                const enrollLink = card.querySelector('a.hub-btn-enroll[href*="enroll="]');
                if (!enrollLink) return;
                const match = enrollLink.href.match(/enroll=([^&#]+)/);
                if (!match) return;
                const cId = match[1];
                const course = map[cId];
                if (!course) return;

                // Sync Thumbnail
                if (course.thumbnail) {
                    const img = card.querySelector('.hub-card-thumb-wrap img');
                    if (img) img.src = resolveAssetUrl(course.thumbnail);
                }

                // Sync Duration Badge
                if (course.duration) {
                    const durStr = formatCourseDuration(course.duration);
                    card.querySelectorAll('.hub-thumb-pill').forEach(pill => {
                        if (pill.textContent.includes('Hours') || pill.textContent.includes('⏱️')) {
                            pill.textContent = '⏱️ ' + durStr;
                        }
                    });
                }

                // Sync Price
                if (course.price) {
                    const salePrice = Number(course.price);
                    const origPrice = Number(course.originalPrice || (salePrice * 2));
                    const curPriceEl = card.querySelector('.hub-cur-price');
                    const origPriceEl = card.querySelector('.hub-orig-price');
                    const badgeEl = card.querySelector('.hub-discount-badge');

                    if (curPriceEl) curPriceEl.textContent = '₹' + salePrice.toLocaleString('en-IN');
                    if (origPriceEl) origPriceEl.textContent = '₹' + origPrice.toLocaleString('en-IN');
                    if (badgeEl && origPrice > salePrice) {
                        const discountPct = Math.round(((origPrice - salePrice) / origPrice) * 100);
                        badgeEl.textContent = `${discountPct}% OFF`;
                    }
                }

                // Sync Title
                if (course.title) {
                    const titleEl = card.querySelector('.hub-card-title');
                    if (titleEl) titleEl.textContent = course.title;
                }

                // Sync Description
                const desc = course.description || course.subtitle;
                if (desc) {
                    const descEl = card.querySelector('.hub-card-desc');
                    if (descEl) descEl.textContent = desc;
                }

                // Sync Badge
                if (course.badge) {
                    const badgeEl = card.querySelector('.hub-card-badge');
                    if (badgeEl) badgeEl.textContent = course.badge.toUpperCase();
                }

                // Sync Skill Level
                if (course.level) {
                    const levelEl = card.querySelector('.hub-card-level');
                    if (levelEl) levelEl.textContent = course.level;
                }
            });

            // Sync Total Hours in Hub Trust Strip
            let totalHours = 0;
            coursesList.forEach(c => {
                if (c && c.duration) {
                    const m = String(c.duration).match(/(\d+)/);
                    if (m) totalHours += parseInt(m[1], 10);
                }
            });
            if (totalHours > 0) {
                document.querySelectorAll('.hub-trust-item').forEach(item => {
                    const lbl = item.querySelector('.hub-trust-lbl');
                    const num = item.querySelector('.hub-trust-num');
                    if (lbl && lbl.textContent.includes('Hours Content') && num) {
                        num.textContent = totalHours + '+';
                    }
                });
            }
        }

        const courseId = landingSection ? landingSection.dataset.courseId : null;

        // 1. Instant check from localStorage
        if (courseId) {
            try {
                const cached = localStorage.getItem('qaa_course_' + courseId);
                if (cached) applyCourseToLanding(JSON.parse(cached));
            } catch (_) {}
        } else if (isHubPage) {
            try {
                const localList = JSON.parse(localStorage.getItem('qaa_local_courses') || '[]');
                if (localList.length) applyCoursesToHub(localList);
            } catch (_) {}
        }

        // 2. Fetch live data from courses.json
        const jsonPath = resolveAssetUrl('data/courses.json') + '?_=' + Date.now();
        fetch(jsonPath)
            .then(res => { if (!res.ok) throw new Error(res.statusText); return res.json(); })
            .then(courses => {
                if (!Array.isArray(courses)) return;
                if (courseId) {
                    const found = courses.find(c => c.id === courseId || c.slug === courseId);
                    if (found) applyCourseToLanding(found);
                }
                if (isHubPage) {
                    applyCoursesToHub(courses);
                }
            })
            .catch(err => console.debug('Live course sync fetch notice:', err));

        // 3. Real-time Cross-tab Sync via Storage Event
        window.addEventListener('storage', (e) => {
            if (!e.key || !e.newValue) return;
            try {
                if (courseId && e.key === 'qaa_course_' + courseId) {
                    applyCourseToLanding(JSON.parse(e.newValue));
                } else if (isHubPage && e.key === 'qaa_local_courses') {
                    applyCoursesToHub(JSON.parse(e.newValue));
                }
            } catch (_) {}
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runSync);
    } else {
        runSync();
    }
})();

// Luxury Course Feature Badges Dynamic Enhancer
(() => {
    const enhanceHighlightBadges = () => {
        document.querySelectorAll('.lp-h-item, .lp-chip').forEach(item => {
            if (item.querySelector('.lp-h-icon')) return;
            const raw = item.innerHTML.trim();
            const match = raw.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\uFE00-\uFE0F]|⚡|✓|📷|🎨|🎬|📈|🌐|🤖|📖|🖨️|🏆|♾️|✨|📐)\s*(.+)$/u);
            if (match) {
                item.innerHTML = '<span class="lp-h-icon">' + match[1] + '</span><span class="lp-h-text">' + match[2] + '</span>';
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceHighlightBadges);
    } else {
        enhanceHighlightBadges();
    }
})();

// Animated Number Counter on Scroll (Stats Bar Countdown/Count-up Effect)
(() => {
    const initStatsCounter = () => {
        const statEls = document.querySelectorAll('.lp-stat-val, .lp-stat-num, .cs-stat-val');
        if (!statEls.length) return;

        // Ensure all stat elements have full opacity and proper transform by default
        statEls.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });

        const items = [];
        statEls.forEach(el => {
            const raw = el.textContent.trim();
            if (!raw || raw === '-' || raw === '—' || raw === 'Loading...') return;

            // Match leading text, numbers (with optional commas/decimals), and trailing text
            const match = raw.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
            if (match) {
                const prefix = match[1] || '';
                const numStr = match[2].replace(/,/g, '');
                const suffix = match[3] || '';
                const target = parseFloat(numStr);
                if (isNaN(target)) return;
                const hasComma = match[2].includes(',');
                const hasDot = numStr.includes('.');
                const decimals = hasDot ? (numStr.split('.')[1] || '').length : 0;

                const counterItem = {
                    el,
                    raw,
                    prefix,
                    target,
                    suffix,
                    hasComma,
                    decimals,
                    started: false
                };
                items.push(counterItem);
                el._counterItem = counterItem;

                // Set initial visual state to 0 so when page loads it starts from 0
                const initialFormatted = hasComma ? '0' : (decimals > 0 ? (0).toFixed(decimals) : '0');
                el.textContent = prefix + initialFormatted + suffix;
            }
        });

        if (!items.length) return;

        const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

        const runCounter = item => {
            if (item.started) return;
            item.started = true;
            let startTime = null;
            const duration = 1400; // 1.4s smooth countdown/count-up effect

            const step = timestamp => {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = easeOutExpo(progress);
                const current = item.target * eased;

                let formattedNum;
                if (item.decimals > 0) {
                    formattedNum = current.toFixed(item.decimals);
                } else {
                    const rounded = Math.round(current);
                    formattedNum = item.hasComma ? rounded.toLocaleString('en-IN') : String(rounded);
                }

                item.el.textContent = item.prefix + formattedNum + item.suffix;

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    item.el.textContent = item.raw;
                }
            };

            requestAnimationFrame(step);
        };

        const revealNonNumeric = () => {
            statEls.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
        };

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        items.forEach(item => runCounter(item));
                        revealNonNumeric();
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });

            const container = document.querySelector('.lp-stats-bar, .cs-stats-bar, .lp-stats-grid');
            if (container) {
                observer.observe(container);
            } else {
                statEls.forEach(el => observer.observe(el));
            }
        } else {
            items.forEach(runCounter);
            revealNonNumeric();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStatsCounter);
    } else {
        initStatsCounter();
    }

    // ═════════════════════════════════════════════════════════════════════
    // Universal Smooth Scroll Reveal & High-Performance Page Speed Boost
    // ═════════════════════════════════════════════════════════════════════
    const initPagePolish = () => {
        if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const revealObserver = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('qa-revealed');
                        obs.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });

            document.querySelectorAll(
                '.hub-card, .qa-road-card, .lp-stat-item, .lp-feature-card, .qa-feature-card, .glass-dark, .qa-road-step, .course-decor-card, .hub-review-card'
            ).forEach(el => {
                el.classList.add('qa-reveal-item');
                revealObserver.observe(el);
            });
        }

        // Instant Navigation: Prefetch internal links on desktop hover
        if ('connection' in navigator && (navigator.connection.saveData || /(2|3)g/.test(navigator.connection.effectiveType))) {
            return;
        }
        const prefetchedUrls = new Set();
        document.addEventListener('pointerenter', event => {
            if (event.pointerType === 'touch') return; // Bypass prefetch on mobile touch to preserve INP
            const link = event.target?.closest?.('a[href]');
            if (!link) return;
            const url = link.href;
            if (url && url.startsWith(location.origin) && !url.includes('#') && !url.endsWith('.pdf') && !prefetchedUrls.has(url)) {
                prefetchedUrls.add(url);
                const prefetch = document.createElement('link');
                prefetch.rel = 'prefetch';
                prefetch.href = url;
                document.head.appendChild(prefetch);
            }
        }, { passive: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPagePolish);
    } else {
        initPagePolish();
    }
})();


