// ==========================================================================
// Quick Art Photography Academy LMS — Mobile App Engine
// Unified Student Credentials & Real-Time Sync with Website LMS
// ==========================================================================

let currentStudent = null;
let enrolledCourses = [];
let allLiveClasses = [];
let activeCourse = null;
let activeLesson = null;
let notificationsList = [];
let liveCheckInterval = null;


// ==========================================================================
// 1. SMART API CLIENT (ZERO JSON CRASHES, AUTO-FALLBACK & CORS COMPATIBLE)
// ==========================================================================

function getLmsApiBase() {
  const isStaticLocal = ['5500', '5501', '5502', '3000', '5173', '8080'].includes(window.location.port)
    || window.location.protocol === 'file:'
    || (window.location.hostname === 'localhost' && !window.location.port.startsWith('80'));

  // If running in local static preview or file protocol, use live backend
  if (isStaticLocal) {
    return 'https://quickartphotography.in/api/lms.php';
  }
  return '../api/lms.php';
}

/**
 * Robust API fetcher:
 * - Automatically falls back to live domain if local server doesn't execute PHP
 * - Safely parses text before JSON to eliminate 'Unexpected end of JSON input'
 * - Injects 'X-Student-Token' seamlessly
 */
async function apiFetch(action, opts = {}) {
  let base = getLmsApiBase();
  let url = `${base}?action=${action}`;

  const token = localStorage.getItem('qaa_student_token') || '';
  const headers = Object.assign({
    'Content-Type': 'application/json',
    'X-Student-Token': token
  }, opts.headers || {});
  // Academy's own number: server shows its OTP only to a logged-in admin (same browser)
  if (action === 'send-otp') {
    try { const at = localStorage.getItem('qa_admin_token'); if (at) headers['X-Admin-Token'] = at; } catch (_) {}
  }

  const fetchOptions = {
    method: opts.method || 'GET',
    headers: headers
  };

  if (opts.body) {
    fetchOptions.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }

  let res;
  let usedLiveFallback = false;

  try {
    res = await fetch(url, fetchOptions);
  } catch (netErr) {
    // If local relative request failed (CORS/offline/network), fallback to production API
    if (!url.startsWith('https://quickartphotography.in')) {
      url = `https://quickartphotography.in/api/lms.php?action=${action}`;
      usedLiveFallback = true;
      res = await fetch(url, fetchOptions);
    } else {
      throw new Error('Network error. Please check your internet connection.');
    }
  }

  const rawText = await res.text();
  let data = null;

  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    // If local server returned empty or non-JSON (e.g. VS Code Live Server static file), try live API
    if (!usedLiveFallback && !url.startsWith('https://quickartphotography.in')) {
      const fallbackUrl = `https://quickartphotography.in/api/lms.php?action=${action}`;
      try {
        const fbRes = await fetch(fallbackUrl, fetchOptions);
        const fbText = await fbRes.text();
        data = JSON.parse(fbText);
      } catch (e2) {
        throw new Error('Server returned invalid response. Please try again.');
      }
    } else {
      throw new Error(rawText || 'Server error occurred');
    }
  }

  if (!data || !data.ok) {
    throw new Error((data && data.error) || 'Request failed');
  }

  return data;
}

// Alias for legacy calls
const callLmsApi = apiFetch;

// ==========================================================================
// 2. INITIALIZATION & SESSION VALIDATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initAppSession();
  setupURLRouter();
});

// Register Service Worker for Background Push Notifications
async function initServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    try {
      const reg = await navigator.serviceWorker.register('sw.js?v=20261002_02');
      console.log('QAA LMS ServiceWorker registered successfully:', reg.scope);

      // Check if already subscribed to push
      if ('PushManager' in window) {
        const sub = await reg.pushManager.getSubscription();
        if (sub && currentStudent) {
          syncPushSubscriptionWithServer(sub);
        }
      }
    } catch (err) {
      console.warn('ServiceWorker registration error:', err);
    }
  }
}

// Request and enable Live Class Push Notifications
async function requestPushNotificationPermission() {
  if (!('Notification' in window)) {
    toast('Notifications are not supported on this browser/device', false);
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    toast('🔔 Live Class Push Notifications Activated!');
    document.getElementById('push-permission-strip')?.classList.add('hidden');

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZ_WJJn52SkqdG3W5NA10DWDV73W4nKPuhbUxio')
          }).catch(async () => {
            return await reg.pushManager.subscribe({ userVisibleOnly: true }).catch(() => null);
          });
        }
        if (sub) {
          await syncPushSubscriptionWithServer(sub);
        }
      } catch (err) {
        console.warn('Push subscribe error:', err);
      }
    }
  } else {
    toast('Notification permission was dismissed or blocked in settings.', false);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function syncPushSubscriptionWithServer(subscription) {
  const student = currentStudent || JSON.parse(localStorage.getItem('qaa_student_info') || '{}');
  try {
    await apiFetch('save-push-subscription', {
      method: 'POST',
      body: {
        subscription: subscription,
        studentId: student.id || '',
        phone: student.phone || '',
        courses: student.enrolledCourses || []
      }
    });
  } catch (err) {
    console.warn('Failed to sync push subscription:', err);
  }
}

// Session Validation (Shared with Website LMS)
async function initAppSession() {
  const splash = document.getElementById('app-splash');
  const token = localStorage.getItem('qaa_student_token');

  if (!token) {
    // No session -> Show Login Screen
    setTimeout(() => {
      splash.classList.add('splash-hide');
      showAuthGate();
    }, 800);
    return;
  }

  try {
    const res = await apiFetch('me');
    if (res && res.student) {
      currentStudent = res.student;
      localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));

      // Successfully authenticated
      setTimeout(() => {
        splash.classList.add('splash-hide');
        enterAppView();
      }, 700);
    } else {
      throw new Error('Invalid session');
    }
  } catch (err) {
    console.warn('Session verification failed, requesting login:', err);
    localStorage.removeItem('qaa_student_token');
    setTimeout(() => {
      splash.classList.add('splash-hide');
      showAuthGate();
    }, 800);
  }
}

function showAuthGate() {
  document.getElementById('view-auth-gate').classList.remove('hidden');
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('app-viewport').classList.add('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
}

function enterAppView() {
  document.getElementById('view-auth-gate').classList.add('hidden');
  document.getElementById('app-header').classList.remove('hidden');
  document.getElementById('app-viewport').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');

  updateHeaderUI();

  // Default to 'mycourses' tab on open as requested
  const params = new URLSearchParams(window.location.search);
  const targetTab = params.get('tab') || 'mycourses';
  switchTab(targetTab);

  startLiveWatcher();
  loadNotifications();
}

function updateHeaderUI() {
  if (!currentStudent) return;
  const name = currentStudent.name || 'Student';
  const avatar = currentStudent.photoUrl || currentStudent.avatar || currentStudent.avatarUrl || '';
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const imgEl = document.getElementById('header-avatar-img');
  const initEl = document.getElementById('header-avatar-initials');

  if (avatar) {
    imgEl.src = avatar;
    imgEl.classList.remove('hidden');
    initEl.classList.add('hidden');
  } else {
    initEl.textContent = initials;
    initEl.classList.remove('hidden');
    imgEl.classList.add('hidden');
  }
}

// ==========================================================================
// 3. AUTHENTICATION (SAME STUDENT CREDENTIALS AS WEBSITE)
// ==========================================================================
function switchAuthTab(type) {
  const tabWa = document.getElementById('tab-btn-whatsapp');
  const tabEm = document.getElementById('tab-btn-email');
  const panelWa = document.getElementById('auth-panel-whatsapp');
  const panelEm = document.getElementById('auth-panel-email');

  if (type === 'whatsapp') {
    tabWa.classList.add('active');
    tabEm.classList.remove('active');
    panelWa.classList.remove('hidden');
    panelEm.classList.add('hidden');
  } else {
    tabEm.classList.add('active');
    tabWa.classList.remove('active');
    panelEm.classList.remove('hidden');
    panelWa.classList.add('hidden');
  }
}

// WhatsApp OTP: Send Step
let currentPhoneTarget = '';

async function handleSendPhoneOtp(e) {
  e.preventDefault();
  const phoneInput = document.getElementById('login-phone');
  const rawPhone = phoneInput.value.replace(/[^0-9]/g, '');
  const btn = document.getElementById('btn-send-whatsapp-otp');

  if (rawPhone.length < 10) {
    toast('Valid 10-digit mobile number enter karein', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending WhatsApp OTP…';

  try {
    const data = await apiFetch('send-otp', {
      method: 'POST',
      body: { phone: rawPhone }
    });

    currentPhoneTarget = rawPhone;
    document.getElementById('wa-display-phone').textContent = rawPhone;
    document.getElementById('form-phone-step').classList.add('hidden');
    document.getElementById('form-otp-step').classList.remove('hidden');
    document.getElementById('login-otp').value = '';
    document.getElementById('login-otp').focus();

    // Dev/Demo OTP banner if available
    if (data.devOtp) {
      document.getElementById('demo-otp-slot').classList.remove('hidden');
      document.getElementById('demo-otp-val').textContent = data.devOtp;
    } else {
      document.getElementById('demo-otp-slot').classList.add('hidden');
    }

    toast('💬 OTP aapke WhatsApp par bhej diya gaya hai!');
  } catch (err) {
    toast(err.message || 'OTP delivery me issue aaya. Dobara try karein.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send WhatsApp OTP 💬';
  }
}

// WhatsApp OTP: Verify Step
async function handleVerifyPhoneOtp(e) {
  e.preventDefault();
  const otpInput = document.getElementById('login-otp');
  const otpVal = otpInput.value.trim();
  const btn = document.getElementById('btn-verify-whatsapp-otp');

  if (otpVal.length < 6) {
    toast('6-digit OTP code enter karein', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying OTP…';

  try {
    const data = await apiFetch('verify-otp', {
      method: 'POST',
      body: { phone: currentPhoneTarget, otp: otpVal }
    });

    // Save Unified Token & Student Object
    localStorage.setItem('qaa_student_token', data.token);
    currentStudent = data.student || {};
    localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));

    toast('🎉 Welcome to Quick Art Photography Academy!');
    enterAppView();
  } catch (err) {
    toast(err.message || 'Galat OTP code. Dobara check karein.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify & Enter Classroom ✓';
  }
}

function resetToPhoneInput() {
  document.getElementById('form-phone-step').classList.remove('hidden');
  document.getElementById('form-otp-step').classList.add('hidden');
}

function resendPhoneOtp() {
  handleSendPhoneOtp({ preventDefault: () => {} });
}

// Email + Password Login
async function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-submit-email-login');

  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    const data = await apiFetch('email-login', {
      method: 'POST',
      body: { email, password }
    });

    localStorage.setItem('qaa_student_token', data.token);
    currentStudent = data.student || {};
    localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));

    toast('🎉 Login successful! Welcome back.');
    enterAppView();
  } catch (err) {
    toast(err.message || 'Email ya Password galat hai.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login & Enter App →';
  }
}

// Forgot Password Flow
function openForgotPasswordSheet() {
  document.getElementById('modal-forgot-pw').classList.add('active');
  document.getElementById('fp-step-1').classList.remove('hidden');
  document.getElementById('fp-step-2').classList.add('hidden');
}

function closeForgotPasswordSheet() {
  document.getElementById('modal-forgot-pw').classList.remove('active');
}

async function sendForgotEmailOtp() {
  const email = document.getElementById('fp-email').value.trim();
  const btn = document.getElementById('btn-fp-send-otp');
  if (!email || !email.includes('@')) {
    toast('Valid registered email enter karein', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending Email OTP…';

  try {
    await apiFetch('send-email-otp', {
      method: 'POST',
      body: { email, purpose: 'reset' }
    });

    document.getElementById('fp-step-1').classList.add('hidden');
    document.getElementById('fp-step-2').classList.remove('hidden');
    toast('✉️ 6-digit OTP aapke email par bhej diya gaya hai!');
  } catch (err) {
    toast(err.message || 'OTP send failed', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send 6-Digit Email OTP ✉️';
  }
}

async function submitPasswordReset() {
  const email = document.getElementById('fp-email').value.trim();
  const otp = document.getElementById('fp-otp').value.trim();
  const newPassword = document.getElementById('fp-new-password').value;
  const btn = document.getElementById('btn-fp-verify-reset');

  if (otp.length < 6 || newPassword.length < 6) {
    toast('Valid 6-digit OTP and min 6 chars password required', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Updating Password…';

  try {
    const data = await apiFetch('email-reset-password', {
      method: 'POST',
      body: { email, otp, newPassword }
    });

    closeForgotPasswordSheet();
    if (data.token) {
      localStorage.setItem('qaa_student_token', data.token);
      currentStudent = data.student || {};
      toast('🔒 Password updated! Logging in…');
      enterAppView();
    } else {
      toast('🔒 Password updated! Ab naye password se login karein.');
    }
  } catch (err) {
    toast(err.message || 'Reset failed', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Set New Password & Login ➔';
  }
}

// Registration Flow (New Student)
function openRegistrationSheet() {
  document.getElementById('modal-register').classList.add('active');
}

function closeRegistrationSheet() {
  document.getElementById('modal-register').classList.remove('active');
}

async function sendRegistrationEmailOtp() {
  const email = document.getElementById('reg-email').value.trim();
  const btn = document.getElementById('btn-reg-send-otp');
  if (!email || !email.includes('@')) {
    toast('Valid email address required', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    await apiFetch('send-email-otp', {
      method: 'POST',
      body: { email, purpose: 'signup' }
    });

    document.getElementById('reg-otp-group').classList.remove('hidden');
    toast('✉️ 6-digit verification code sent to your email!');
  } catch (err) {
    toast(err.message || 'Could not send OTP', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send OTP';
  }
}

async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.replace(/[^0-9]/g, '');
  const email = document.getElementById('reg-email').value.trim();
  const otp = document.getElementById('reg-otp').value.trim();
  const password = document.getElementById('reg-password').value;
  const btn = document.getElementById('btn-submit-register');

  btn.disabled = true;
  btn.textContent = 'Creating Account…';

  try {
    const data = await apiFetch('email-signup', {
      method: 'POST',
      body: { name, phone, email, otp, password }
    });

    closeRegistrationSheet();
    localStorage.setItem('qaa_student_token', data.token);
    currentStudent = data.student || {};
    localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));

    toast('🎉 Account created successfully! Welcome to the Academy.');
    enterAppView();
  } catch (err) {
    toast(err.message || 'Registration failed', false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Student Account ✓';
  }
}

function handleStudentLogout() {
  if (confirm('Kya aap Quick Art LMS Mobile App se logout karna chahte hain?')) {
    localStorage.removeItem('qaa_student_token');
    localStorage.removeItem('qaa_student_info');
    currentStudent = null;
    toast('Logged out successfully.');
    showAuthGate();
  }
}

function togglePasswordVisibility(inputId, triggerBtn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.type === 'password') {
    el.type = 'text';
    triggerBtn.textContent = '🙈';
  } else {
    el.type = 'password';
    triggerBtn.textContent = '👁️';
  }
}

// ==========================================================================
// 4. BOTTOM NAVIGATION (4 CLEAN TABS)
// ==========================================================================
let currentTab = 'dashboard';

function switchTab(tabName, fromPopstate = false) {
  if (!['dashboard', 'mycourses', 'live', 'profile'].includes(tabName)) return;
  const prevTab = currentTab;
  currentTab = tabName;

  ['dashboard', 'mycourses', 'live', 'profile'].forEach(t => {
    const btn = document.getElementById(`nav-btn-${t}`);
    const panel = document.getElementById(`tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (panel) panel.classList.toggle('active-tab', t === tabName);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabName === 'dashboard') loadDashboardData();
  if (tabName === 'mycourses') loadCoursesTab();
  if (tabName === 'live') {
    currentLiveSubTab = 'upcoming';
    switchLiveSubTab('upcoming');
    loadLiveClassesTab();
  }
  if (tabName === 'profile') loadProfileData();

  if (!fromPopstate && tabName !== 'dashboard' && tabName !== prevTab) {
    pushNavState({ screen: 'tab', tab: tabName });
  }
}

function setupURLRouter() {
  const params = new URLSearchParams(window.location.search);
  const hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  const targetTab = params.get('tab') || (['dashboard', 'mycourses', 'live', 'profile'].includes(hash) ? hash : null);
  const targetId = params.get('id');

  if (targetTab && ['dashboard', 'mycourses', 'live', 'profile'].includes(targetTab)) {
    switchTab(targetTab);
    setTimeout(() => {
      switchTab(targetTab);
      if (targetTab === 'live' && targetId) {
        openLiveClassPlayerById(targetId);
      }
    }, 400);
  }
}

// ==========================================================================
// 5. TAB 1: DASHBOARD ENGINE
// ==========================================================================
async function loadDashboardData() {
  if (!currentStudent) return;

  // 1. Fill Profile Card
  document.getElementById('dash-student-name').textContent = `Namaste, ${currentStudent.name || 'Student'}!`;
  document.getElementById('dash-student-id').textContent = `ID: ${currentStudent.enrollmentNo || currentStudent.id || 'QAA-STUDENT'}`;

  const avatar = currentStudent.photoUrl || currentStudent.avatar || currentStudent.avatarUrl || '';
  const initials = (currentStudent.name || 'Student').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const avatarImg = document.getElementById('dash-avatar-img');
  const avatarFb = document.getElementById('dash-avatar-fallback');

  if (avatar) {
    avatarImg.src = avatar;
    avatarImg.classList.remove('hidden');
    avatarFb.classList.add('hidden');
  } else {
    avatarFb.textContent = initials;
    avatarFb.classList.remove('hidden');
    avatarImg.classList.add('hidden');
  }

  // 2. Fetch Enrolled Courses & Calculate Progress
  try {
    const res = await apiFetch('my-courses');
    enrolledCourses = res.courses || [];

    let totalLessons = 0;
    let completedLessons = 0;
    let certCount = 0;

    enrolledCourses.forEach(c => {
      const tot = c.totalLessons || (c.modules ? c.modules.reduce((a, m) => a + (m.lessons?.length || 0), 0) : 0);
      const done = c.completedCount || 0;
      totalLessons += tot;
      completedLessons += done;
      if (tot > 0 && done >= tot) certCount++;
    });

    const avgProg = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    document.getElementById('kpi-enrolled-count').textContent = enrolledCourses.length;
    document.getElementById('kpi-completed-lessons').textContent = completedLessons;
    document.getElementById('kpi-cert-count').textContent = certCount;
    document.getElementById('kpi-avg-progress').textContent = `${avgProg}%`;

    renderContinueLearningCard();
  } catch (err) {
    console.warn('Dashboard courses fetch failed:', err);
  }

  checkLiveClassStatus();
  renderAnnouncementsFeed();
  loadDashboardAllCourses();
}

function renderContinueLearningCard() {
  const card = document.getElementById('dash-resume-card');
  if (!enrolledCourses || !enrolledCourses.length) {
    card.classList.add('hidden');
    return;
  }

  const activeC = enrolledCourses.find(c => {
    const done = c.completedCount || 0;
    const tot = c.totalLessons || 1;
    return done > 0 && done < tot;
  }) || enrolledCourses[0];

  if (!activeC) {
    card.classList.add('hidden');
    return;
  }

  const tot = activeC.totalLessons || 1;
  const done = activeC.completedCount || 0;
  const pct = Math.round((done / tot) * 100);

  document.getElementById('resume-course-title').textContent = activeC.title;
  document.getElementById('resume-thumb').src = activeC.thumbnail ? `../${activeC.thumbnail}` : '../assets/course-premiere-pro-hindi.webp';
  document.getElementById('resume-lesson-title').textContent = activeC.lastLessonTitle || `Next: Lesson ${done + 1}`;
  document.getElementById('resume-lesson-sub').textContent = `${pct}% Complete • ${done}/${tot} Done`;
  document.getElementById('resume-progress-fill').style.width = `${pct}%`;

  document.getElementById('btn-resume-lesson').onclick = () => {
    openClassroomPlayer(activeC.id, activeC.lastLessonId || null);
  };

  card.classList.remove('hidden');
}

// ==========================================================================
// ALL ACADEMY COURSES ENGINE (ENROLLED + AVAILABLE PROGRAMS)
// ==========================================================================
let allAcademyCourses = [];
let currentCatalogFilter = 'all';

function safeCourseHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadDashboardAllCourses() {
  const stripEl = document.getElementById('dash-all-courses-strip');
  if (!stripEl) return;

  try {
    if (!allAcademyCourses.length) {
      let list = [];
      try {
        const res = await apiFetch('catalog');
        if (res && Array.isArray(res.catalog) && res.catalog.length) {
          list = res.catalog;
        }
      } catch (_) {}

      if (!list.length) {
        const res = await fetch('../data/courses.json');
        list = await res.json();
      }
      allAcademyCourses = Array.isArray(list) ? list : [];
    }

    renderDashboardAllCoursesStrip();
  } catch (err) {
    if (stripEl) {
      stripEl.innerHTML = '<div style="padding:14px; font-size:11.5px; color:var(--text-muted); text-align:center; width:100%;">Academy curriculum synced.</div>';
    }
  }
}

function isStudentEnrolledIn(course) {
  if (!enrolledCourses || !enrolledCourses.length) return false;
  return enrolledCourses.some(e => {
    if (e.id && course.id && e.id === course.id) return true;
    if (e.slug && course.slug && e.slug === course.slug) return true;
    if (e.title && course.title && e.title.toLowerCase().trim() === course.title.toLowerCase().trim()) return true;
    return false;
  });
}

function getEnrolledCourseData(course) {
  if (!enrolledCourses || !enrolledCourses.length) return null;
  return enrolledCourses.find(e => {
    if (e.id && course.id && e.id === course.id) return true;
    if (e.slug && course.slug && e.slug === course.slug) return true;
    if (e.title && course.title && e.title.toLowerCase().trim() === course.title.toLowerCase().trim()) return true;
    return false;
  });
}

function renderDashboardAllCoursesStrip() {
  const stripEl = document.getElementById('dash-all-courses-strip');
  if (!stripEl) return;

  if (!allAcademyCourses.length) {
    stripEl.innerHTML = '<div style="padding:14px; font-size:12px; color:var(--text-muted); text-align:center; width:100%;">No courses available.</div>';
    return;
  }

  // Sort enrolled courses first, then other available courses
  const sorted = [...allAcademyCourses].sort((a, b) => {
    const aEnrolled = isStudentEnrolledIn(a) ? 1 : 0;
    const bEnrolled = isStudentEnrolledIn(b) ? 1 : 0;
    return bEnrolled - aEnrolled;
  });

  stripEl.innerHTML = sorted.map(c => {
    const enrolled = isStudentEnrolledIn(c);
    const enrolledData = enrolled ? getEnrolledCourseData(c) : null;
    const thumb = c.thumbnail ? (c.thumbnail.startsWith('http') || c.thumbnail.startsWith('/') ? c.thumbnail : `../${c.thumbnail}`) : '../assets/course-premiere-pro-hindi.webp';
    const duration = c.duration || '60+ Hours';
    const price = c.price ? `₹${Number(c.price).toLocaleString('en-IN')}` : '₹4,999';

    if (enrolled) {
      const tot = (enrolledData && enrolledData.totalLessons) || 1;
      const done = (enrolledData && enrolledData.completedCount) || 0;
      const pct = Math.round((done / tot) * 100);

      return `
        <div class="dash-course-strip-card" onclick="openClassroomPlayer('${c.id}')">
          <div class="dash-strip-thumb-wrap">
            <img src="${thumb}" alt="${safeCourseHtml(c.title)}" class="dash-strip-thumb-img" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
            <span class="dash-strip-badge enrolled">✓ Enrolled (${pct}%)</span>
          </div>
          <div class="dash-strip-content">
            <div class="dash-strip-title">${safeCourseHtml(c.title)}</div>
            <div class="dash-strip-meta">
              <span>⏱ ${safeCourseHtml(duration)}</span>
              <span style="color:#34d399; font-weight:700;">Enrolled</span>
            </div>
            <button type="button" class="dash-strip-btn btn-continue" onclick="event.stopPropagation(); openClassroomPlayer('${c.id}')">
              ▶ Continue Course
            </button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="dash-course-strip-card" onclick="openCourseCheckoutModal('${c.id}')">
          <div class="dash-strip-thumb-wrap">
            <img src="${thumb}" alt="${safeCourseHtml(c.title)}" class="dash-strip-thumb-img" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
            <span class="dash-strip-badge available">⭐ Available • ${price}</span>
          </div>
          <div class="dash-strip-content">
            <div class="dash-strip-title">${safeCourseHtml(c.title)}</div>
            <div class="dash-strip-meta">
              <span>⏱ ${safeCourseHtml(duration)}</span>
              <span style="color:var(--gold); font-weight:700;">${price}</span>
            </div>
            <button type="button" class="dash-strip-btn btn-enroll" onclick="event.stopPropagation(); openCourseCheckoutModal('${c.id}')">
              Enroll / Details ➔
            </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

function updateCatalogTabCounts() {
  const allCount = allAcademyCourses.length;
  const enrolledCount = allAcademyCourses.filter(c => isStudentEnrolledIn(c)).length;
  const availableCount = Math.max(0, allCount - enrolledCount);

  const bAll = document.getElementById('badge-cat-all');
  const bEnrolled = document.getElementById('badge-cat-enrolled');
  const bAvailable = document.getElementById('badge-cat-available');

  if (bAll) bAll.textContent = allCount;
  if (bEnrolled) bEnrolled.textContent = enrolledCount;
  if (bAvailable) bAvailable.textContent = availableCount;
}

function openAllCoursesModal() {
  pushNavState({ screen: 'modal', modal: 'allcourses' });
  const modal = document.getElementById('modal-all-courses');
  if (modal) modal.classList.add('active');
  if (!allAcademyCourses.length) {
    loadDashboardAllCourses().then(() => {
      updateCatalogTabCounts();
      renderCatalogModalList();
    });
  } else {
    updateCatalogTabCounts();
    renderCatalogModalList();
  }
}

function closeAllCoursesModal(fromPopstate = false) {
  const modal = document.getElementById('modal-all-courses');
  if (modal) modal.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'allcourses') {
    try { window.history.back(); } catch (e) {}
  }
}

function filterCatalogModal(filter) {
  currentCatalogFilter = filter;
  document.getElementById('chip-cat-all')?.classList.toggle('active', filter === 'all');
  document.getElementById('chip-cat-enrolled')?.classList.toggle('active', filter === 'enrolled');
  document.getElementById('chip-cat-available')?.classList.toggle('active', filter === 'available');
  renderCatalogModalList();
}

function renderCatalogModalList() {
  updateCatalogTabCounts();
  const listEl = document.getElementById('modal-catalog-list');
  if (!listEl) return;

  let filtered = allAcademyCourses;
  if (currentCatalogFilter === 'enrolled') {
    filtered = allAcademyCourses.filter(c => isStudentEnrolledIn(c));
  } else if (currentCatalogFilter === 'available') {
    filtered = allAcademyCourses.filter(c => !isStudentEnrolledIn(c));
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:35px 16px; color:var(--text-muted);">
        <div style="font-size:28px; margin-bottom:8px;">📚</div>
        <div style="color:#fff; font-weight:700; margin-bottom:4px;">Koi course nahi mila</div>
        <div style="font-size:12px;">Is category me abhi koi program nahi hai.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const enrolled = isStudentEnrolledIn(c);
    const thumb = c.thumbnail ? (c.thumbnail.startsWith('http') || c.thumbnail.startsWith('/') ? c.thumbnail : `../${c.thumbnail}`) : '../assets/course-premiere-pro-hindi.webp';
    const duration = c.duration || '60+ Hours';
    const price = c.price ? `₹${Number(c.price).toLocaleString('en-IN')}` : '₹4,999';

    if (enrolled) {
      return `
        <div class="modal-course-card" onclick="closeAllCoursesModal(); openClassroomPlayer('${c.id}');">
          <img src="${thumb}" alt="${safeCourseHtml(c.title)}" class="modal-course-thumb" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
          <div class="modal-course-info">
            <span class="modal-course-tag enrolled">✓ Enrolled</span>
            <div class="modal-course-title">${safeCourseHtml(c.title)}</div>
            <div class="modal-course-sub">⏱ ${safeCourseHtml(duration)} • Active Classroom</div>
          </div>
          <button type="button" class="modal-course-btn" style="background:var(--gold-gradient); color:#090d18;" onclick="event.stopPropagation(); closeAllCoursesModal(); openClassroomPlayer('${c.id}');">
            Study ➔
          </button>
        </div>
      `;
    } else {
      return `
        <div class="modal-course-card" onclick="openCourseCheckoutModal('${c.id}');">
          <img src="${thumb}" alt="${safeCourseHtml(c.title)}" class="modal-course-thumb" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
          <div class="modal-course-info">
            <span class="modal-course-tag available">⭐ Available • ${price}</span>
            <div class="modal-course-title">${safeCourseHtml(c.title)}</div>
            <div class="modal-course-sub">⏱ ${safeCourseHtml(duration)} • Full Lifetime Access</div>
          </div>
          <button type="button" class="modal-course-btn" style="background:rgba(216,161,83,0.18); border:1px solid rgba(216,161,83,0.35); color:var(--gold);" onclick="event.stopPropagation(); openCourseCheckoutModal('${c.id}');">
            Enroll ➔
          </button>
        </div>
      `;
    }
  }).join('');
}

// ==========================================================================
// 8.5 IN-APP COURSE CHECKOUT & RAZORPAY PAYMENT GATEWAY SYSTEM
// ==========================================================================
let activeCheckoutCourse = null;
let activeCheckoutCoupon = null;

function openCourseCheckoutModal(courseId) {
  let course = allAcademyCourses.find(c => c.id === courseId);
  if (!course && enrolledCourses) {
    course = enrolledCourses.find(c => c.id === courseId);
  }

  if (!course) {
    toast('Course details load ho rahe hain...', false);
    loadDashboardAllCourses().then(() => {
      const found = allAcademyCourses.find(c => c.id === courseId);
      if (found) openCourseCheckoutModal(courseId);
      else toast('Course information uplabdh nahi hai. Helpline par sampark karein.', false);
    });
    return;
  }

  // If student is already enrolled in this course, directly open classroom player!
  if (isStudentEnrolledIn(course)) {
    closeAllCoursesModal();
    openClassroomPlayer(course.id);
    return;
  }

  activeCheckoutCourse = course;
  activeCheckoutCoupon = null;

  // Prefill student details from current student account if logged in
  const nameInp = document.getElementById('checkout-user-name');
  const phoneInp = document.getElementById('checkout-user-phone');
  const verifiedBadge = document.getElementById('checkout-verified-badge');

  if (currentStudent && currentStudent.phone) {
    if (nameInp) nameInp.value = currentStudent.name || '';
    if (phoneInp) phoneInp.value = String(currentStudent.phone).replace(/\D/g, '').slice(-10);
    if (verifiedBadge) {
      verifiedBadge.textContent = '✓ Verified Student';
      verifiedBadge.style.display = 'inline-flex';
    }
  } else {
    const cachedName = localStorage.getItem('qaa_cached_name') || '';
    const cachedPhone = localStorage.getItem('qaa_cached_phone') || '';
    if (nameInp) nameInp.value = cachedName;
    if (phoneInp) phoneInp.value = cachedPhone;
    if (verifiedBadge) {
      verifiedBadge.textContent = '⚡ Instant Access';
      verifiedBadge.style.display = 'inline-flex';
    }
  }

  // Reset coupon state
  const couponInp = document.getElementById('checkout-coupon-code');
  if (couponInp) couponInp.value = '';
  const couponStatus = document.getElementById('checkout-coupon-status');
  if (couponStatus) {
    couponStatus.textContent = '';
    couponStatus.className = 'checkout-coupon-status';
    couponStatus.style.display = 'none';
  }

  // Render course details & prices
  renderCheckoutCourseDetails();

  // Push navigation state & display sheet
  pushNavState({ screen: 'modal', modal: 'coursecheckout' });
  const modal = document.getElementById('modal-course-checkout');
  if (modal) modal.classList.add('active');
}

function closeCourseCheckoutModal(fromPopstate = false) {
  const modal = document.getElementById('modal-course-checkout');
  if (modal) modal.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'coursecheckout') {
    try { window.history.back(); } catch (e) {}
  }
}

function renderCheckoutCourseDetails() {
  if (!activeCheckoutCourse) return;
  const c = activeCheckoutCourse;
  const thumb = c.thumbnail ? (c.thumbnail.startsWith('http') || c.thumbnail.startsWith('/') ? c.thumbnail : `../${c.thumbnail}`) : '../assets/course-premiere-pro-hindi.webp';
  const duration = c.duration || '60+ Hours';
  const basePrice = Number(c.price) || 4999;
  const originalPrice = Number(c.originalPrice) || Math.round(basePrice * 2);

  const heroEl = document.getElementById('checkout-course-hero');
  if (heroEl) {
    heroEl.innerHTML = `
      <div class="checkout-course-hero-inner">
        <img src="${thumb}" alt="${safeCourseHtml(c.title)}" class="checkout-hero-thumb" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
        <div class="checkout-hero-info">
          <div class="checkout-hero-badge">⭐ Certified Academy Masterclass</div>
          <div class="checkout-hero-title">${safeCourseHtml(c.title)}</div>
          <div class="checkout-hero-sub">⏱ ${safeCourseHtml(duration)} • 4K Full HD Video • Lifetime</div>
        </div>
      </div>
      <div class="checkout-hero-perks">
        <span class="perk-chip">✓ Lifetime Access</span>
        <span class="perk-chip">✓ RAW Project Files</span>
        <span class="perk-chip">✓ QR-Verified Certificate</span>
        <span class="perk-chip">✓ Doubt Support</span>
      </div>
    `;
  }

  // Pricing calculation
  let discount = 0;
  if (activeCheckoutCoupon && activeCheckoutCoupon.valid) {
    discount = Number(activeCheckoutCoupon.discountAmount) || 0;
  }
  const finalPrice = Math.max(0, basePrice - discount);

  const pOrig = document.getElementById('checkout-price-original');
  const pBase = document.getElementById('checkout-price-base');
  const pTotal = document.getElementById('checkout-price-total');
  const btnLabel = document.getElementById('checkout-btn-label');
  const discountRow = document.getElementById('checkout-row-discount');
  const pDiscount = document.getElementById('checkout-price-discount');

  if (pOrig) pOrig.textContent = `₹${originalPrice.toLocaleString('en-IN')}`;
  if (pBase) pBase.textContent = `₹${basePrice.toLocaleString('en-IN')}`;

  if (discount > 0 && discountRow && pDiscount) {
    discountRow.style.display = 'flex';
    pDiscount.textContent = `-₹${discount.toLocaleString('en-IN')}`;
  } else if (discountRow) {
    discountRow.style.display = 'none';
  }

  if (pTotal) pTotal.textContent = `₹${finalPrice.toLocaleString('en-IN')}`;
  if (btnLabel) btnLabel.innerHTML = `Pay ₹${finalPrice.toLocaleString('en-IN')} &amp; Unlock Instantly ➔`;
}

async function handleApplyCheckoutCoupon() {
  if (!activeCheckoutCourse) return;
  const codeInp = document.getElementById('checkout-coupon-code');
  const code = (codeInp?.value || '').trim();
  const statusEl = document.getElementById('checkout-coupon-status');
  const btn = document.getElementById('btn-checkout-coupon');

  if (!code) {
    if (statusEl) {
      statusEl.textContent = 'Kripya promo ya coupon code enter karein.';
      statusEl.className = 'checkout-coupon-status error';
      statusEl.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '...';
  }

  try {
    const basePrice = Number(activeCheckoutCourse.price) || 4999;
    const res = await apiFetch('apply-coupon', {
      method: 'POST',
      body: {
        code: code,
        courseId: activeCheckoutCourse.id,
        price: basePrice
      }
    });

    if (!res.valid) {
      throw new Error(res.error || 'Invalid ya expired coupon code.');
    }

    activeCheckoutCoupon = res;
    if (statusEl) {
      statusEl.textContent = `✓ '${res.code}' applied! Flat ₹${Number(res.discountAmount).toLocaleString('en-IN')} discount mila.`;
      statusEl.className = 'checkout-coupon-status success';
      statusEl.style.display = 'block';
    }
    renderCheckoutCourseDetails();
    toast(`🎉 Coupon code applied! Discount: ₹${Number(res.discountAmount).toLocaleString('en-IN')}`);

  } catch (err) {
    activeCheckoutCoupon = null;
    if (statusEl) {
      statusEl.textContent = `✕ ${err.message || 'Invalid coupon code.'}`;
      statusEl.className = 'checkout-coupon-status error';
      statusEl.style.display = 'block';
    }
    renderCheckoutCourseDetails();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Apply';
    }
  }
}

async function startCourseCheckoutPayment() {
  if (!activeCheckoutCourse) {
    toast('Koi course chuna nahi gaya.', false);
    return;
  }

  const nameInp = document.getElementById('checkout-user-name');
  const phoneInp = document.getElementById('checkout-user-phone');
  const btn = document.getElementById('btn-checkout-pay');

  const name = (nameInp ? nameInp.value : (currentStudent?.name || '')).trim();
  const rawPhone = phoneInp ? phoneInp.value : (currentStudent?.phone || '');
  const phone = String(rawPhone).replace(/\D/g, '').slice(-10);

  if (!name || name.length < 2) {
    toast('Kripya apna poora naam darj karein.', false);
    nameInp?.focus();
    return;
  }

  if (!phone || phone.length !== 10) {
    toast('Kripya 10-digit mobile number darj karein.', false);
    phoneInp?.focus();
    return;
  }

  localStorage.setItem('qaa_cached_name', name);
  localStorage.setItem('qaa_cached_phone', phone);

  const courseId = activeCheckoutCourse.id;
  const courseTitle = activeCheckoutCourse.title || 'Quick Art Photography Academy Program';
  const couponCode = activeCheckoutCoupon && activeCheckoutCoupon.valid ? activeCheckoutCoupon.code : '';

  if (typeof Razorpay === 'undefined') {
    toast('Payment gateway load ho raha hai, kripya 2 second intazaar karein...', false);
    return;
  }

  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="pay-icon">⏳</span><span class="pay-text">Connecting Payment Gateway...</span>`;
  }

  try {
    // 1. Create Razorpay Order on LMS Server
    const orderRes = await apiFetch('create-razorpay-order', {
      method: 'POST',
      body: {
        courseId,
        name,
        phone,
        email: currentStudent?.email || `${phone}@quickartstudent.in`,
        couponCode
      }
    });

    if (!orderRes.ok || !orderRes.orderId) {
      throw new Error(orderRes.error || orderRes.message || 'Payment order create karne me dikkat aayi.');
    }

    // 2. Open Razorpay Checkout Sheet
    const rzpOptions = {
      key: orderRes.keyId,
      amount: orderRes.amount,
      currency: orderRes.currency || 'INR',
      name: 'Quick Art Photography Academy',
      description: orderRes.courseTitle || courseTitle,
      order_id: orderRes.orderId,
      prefill: {
        name: name,
        contact: phone,
        email: currentStudent?.email || `${phone}@quickartstudent.in`
      },
      readonly: {
        contact: true,
        name: true
      },
      theme: { color: '#d8a153' },
      modal: {
        ondismiss: () => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
          }
          toast('Payment cancel kiya gaya. Dubara koshish kar sakte hain.', false);
        }
      },
      handler: async (response) => {
        if (btn) {
          btn.innerHTML = `<span class="pay-icon">⚡</span><span class="pay-text">Verifying Payment &amp; Unlocking...</span>`;
        }
        try {
          const verifyRes = await apiFetch('verify-razorpay-payment', {
            method: 'POST',
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId,
              name,
              phone,
              email: currentStudent?.email || `${phone}@quickartstudent.in`,
              couponCode
            }
          });

          if (!verifyRes.ok || !verifyRes.verified) {
            throw new Error(verifyRes.error || 'Payment verification failed');
          }

          // Auto-login / update session
          if (verifyRes.token) {
            localStorage.setItem('qaa_student_token', verifyRes.token);
            localStorage.setItem('qa_student_token', verifyRes.token);
          }
          if (verifyRes.student) {
            currentStudent = verifyRes.student;
            localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));
          }

          // Close all checkout modals
          closeCourseCheckoutModal();
          closeAllCoursesModal();

          // Refresh dashboard data
          await loadDashboardData();
          await loadDashboardAllCourses();

          toast(`🎉 Badhai ho ${name}! '${courseTitle}' successfully unlock ho gaya.`);

          // Seamless transition directly into the course classroom!
          setTimeout(() => {
            openClassroomPlayer(courseId);
          }, 350);

        } catch (verifyErr) {
          console.error('Verify error:', verifyErr);
          toast(`Verification error: ${verifyErr.message}. Payment ID: ${response.razorpay_payment_id}`, false);
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
          }
        }
      }
    };

    const rzp = new Razorpay(rzpOptions);
    rzp.open();

  } catch (err) {
    console.error('Order creation error:', err);
    toast(err.message || 'Payment initiation failed. Kripya helpline par sampark karein.', false);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}

function openWhatsAppCheckoutQuery() {
  const courseTitle = activeCheckoutCourse ? activeCheckoutCourse.title : 'Quick Art Photography Course';
  const name = (document.getElementById('checkout-user-name')?.value || currentStudent?.name || '').trim();
  const text = `Namaste Anil Sir! Mujhe Quick Art Academy ke '${courseTitle}' program me admission/enrollment lena hai.${name ? ` Mera naam ${name} hai.` : ''} Kripya details provide karein.`;
  const url = `https://wa.me/919939800780?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function handleExploreCourse(courseId) {
  openCourseCheckoutModal(courseId);
}

// Live Class Watcher
function startLiveWatcher() {
  if (liveCheckInterval) clearInterval(liveCheckInterval);
  checkLiveClassStatus();
  liveCheckInterval = setInterval(checkLiveClassStatus, 15000);
}

function isStudentEnrolledInLive(c) {
  if (!currentStudent || !c) return false;
  if (c.isAuthorized === true) return true;

  const enrolledIds = currentStudent.enrolledCourses || [];
  if (enrolledIds.includes('all-access')) return true;
  if (c.id && enrolledIds.includes(c.id)) return true;
  if (c.courseId && c.courseId !== 'all' && enrolledIds.includes(c.courseId)) return true;

  if (c.type === 'workshop') {
    return enrolledIds.includes('masterclass-live') || enrolledIds.includes('live_demo_01') || (c.id && enrolledIds.includes(c.id));
  }

  return false;
}

async function checkLiveClassStatus() {
  try {
    const res = await apiFetch('get-live-classes');
    allLiveClasses = res.liveClasses || [];

    const liveNow = allLiveClasses.find(c => c.status === 'live' && isStudentEnrolledInLive(c));
    const headerLiveBtn = document.getElementById('header-live-btn');
    const navLiveDot = document.getElementById('nav-live-dot');
    const dashLiveBanner = document.getElementById('dash-live-banner');

    if (liveNow) {
      headerLiveBtn?.classList.remove('hidden');
      navLiveDot?.classList.remove('hidden');

      if (dashLiveBanner) {
        dashLiveBanner.classList.remove('hidden');
        document.getElementById('dash-live-title').textContent = liveNow.title;
        document.getElementById('dash-live-sub').textContent = liveNow.description || 'Mentor Anil Sharma is broadcasting live on timeline. Tap to enter live classroom.';
      }
    } else {
      headerLiveBtn?.classList.add('hidden');
      navLiveDot?.classList.add('hidden');
      dashLiveBanner?.classList.add('hidden');
    }

    const upcoming = allLiveClasses.filter(c => c.status === 'scheduled' && isStudentEnrolledInLive(c));
    const schedCard = document.getElementById('dash-scheduled-card');
    if (upcoming.length && !liveNow) {
      const next = upcoming[0];
      schedCard?.classList.remove('hidden');
      document.getElementById('sched-class-title').textContent = next.title;
      if (next.scheduledAt) {
        const dt = new Date(next.scheduledAt);
        const schedMonthEl = document.getElementById('sched-cal-month');
        if (schedMonthEl) schedMonthEl.textContent = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const schedDayEl = document.getElementById('sched-cal-day');
        if (schedDayEl) schedDayEl.textContent = String(dt.getDate()).padStart(2, '0');
        const schedTimeEl = document.getElementById('sched-class-time');
        if (schedTimeEl) schedTimeEl.textContent = dt.toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST';
      }
    } else {
      schedCard?.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Live class status check error:', err);
  }
}

function renderAnnouncementsFeed() {
  const container = document.getElementById('dash-announcements-container');
  if (!container) return;

  const defaultAnnouncements = [
    {
      title: '🌟 4K Cinematic Practice RAW Footage Added',
      body: 'Haldi, Sangeet aur Wedding Varmala ke raw dual-camera 10-bit clips downloads section me upload ho gaye hain.',
      date: 'Latest Update',
      badge: 'PRACTICE ASSETS'
    },
    {
      title: '💬 Weekly Live Doubt Clearance Sessions',
      body: 'Har Sunday sham 7:00 PM Mentor Anil Sharma timeline live screen-share doubts solve karenge.',
      date: 'Weekly',
      badge: 'LIVE CLASS'
    }
  ];

  container.innerHTML = defaultAnnouncements.map(a => `
    <div class="announcement-card">
      <div class="announcement-meta">
        <span class="announcement-badge">${escHtml(a.badge)}</span>
        <span class="announcement-date">${escHtml(a.date)}</span>
      </div>
      <div class="announcement-title">${escHtml(a.title)}</div>
      <div class="announcement-body">${escHtml(a.body)}</div>
    </div>
  `).join('');
}

// ==========================================================================
// 6. TAB 2: MY COURSES ENGINE
// ==========================================================================
async function loadCoursesTab() {
  const listEl = document.getElementById('app-courses-list');
  listEl.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Loading your courses…</div>';

  try {
    const res = await apiFetch('my-courses');
    enrolledCourses = res.courses || [];
    window.offlinePendingData = res.offlinePending || null;
    filterCourses('all');
  } catch (err) {
    listEl.innerHTML = `
      <div style="text-align:center; padding: 30px; color: var(--text-muted);">
        Courses load nahi ho paaye. Check your internet connection.<br /><br />
        <button class="btn-primary" onclick="loadCoursesTab()" style="width:auto; margin:0 auto;">Retry</button>
      </div>`;
  }
}

function filterCourses(filter) {
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
  });

  const listEl = document.getElementById('app-courses-list');
  let filtered = enrolledCourses;

  if (filter === 'in-progress') {
    filtered = enrolledCourses.filter(c => {
      const done = c.completedCount || 0;
      const tot = c.totalLessons || 1;
      return done < tot;
    });
  } else if (filter === 'completed') {
    filtered = enrolledCourses.filter(c => {
      const done = c.completedCount || 0;
      const tot = c.totalLessons || 1;
      return tot > 0 && done >= tot;
    });
  }

  if (!filtered.length) {
    if (window.offlinePendingData && window.offlinePendingData.isPendingApproval) {
      listEl.innerHTML = `
        <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:14px; padding:24px 18px; text-align:center; margin:16px 0;">
          <div style="font-size:36px; margin-bottom:8px;">⏳</div>
          <div style="font-size:16px; font-weight:700; color:#fde68a; margin-bottom:6px;">Admission Application Under Review</div>
          <div style="font-size:13px; color:#cbd5e1; line-height:1.5; max-width:440px; margin:0 auto 12px;">
            Aapka <strong>${escHtml(window.offlinePendingData.appliedCourse || 'Course')}</strong> admission form submit ho chuka hai. Academy Admin dwara verification ke baad aapka complete Classroom aur lessons access active ho jayega.
          </div>
          <div style="font-size:12px; color:#94a3b8;">
            🪪 Official ID Card dekhne ke liye <strong>"My Profile"</strong> tab par jayein.
          </div>
        </div>`;
      return;
    }
    listEl.innerHTML = `
      <div style="text-align:center; padding: 40px 16px; color: var(--text-muted);">
        <div style="font-size: 32px; margin-bottom: 8px;">🎓</div>
        <div style="font-size: 15px; font-weight:700; color:#fff; margin-bottom:4px;">Koi course nahi mila</div>
        <div style="font-size: 12.5px;">Aapke enrolled programs yahan dikhai denge.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const tot = c.totalLessons || (c.modules ? c.modules.reduce((a, m) => a + (m.lessons?.length || 0), 0) : 0);
    const done = c.completedCount || 0;
    const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
    const thumb = c.thumbnail ? `../${c.thumbnail}` : '../assets/course-premiere-pro-hindi.webp';

    return `
      <div class="course-card">
        <div class="course-card-thumb-wrap" onclick="openClassroomPlayer('${c.id}')">
          <img src="${thumb}" alt="${escHtml(c.title)}" class="course-card-thumb" onerror="this.src='../assets/course-premiere-pro-hindi.webp'" />
          <span class="course-card-badge">${pct >= 100 ? 'COMPLETED 🎓' : `${pct}% COMPLETED`}</span>
        </div>
        <div class="course-card-content">
          <h3 class="course-card-title">${escHtml(c.title)}</h3>
          <div class="course-card-stats">
            <span>⏱ ${escHtml(c.duration || 'Full Course')}</span>
            <span>📹 ${done}/${tot} Lessons</span>
            <span>🏆 Certificate</span>
          </div>
          <div class="course-card-progress">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
            <span class="progress-pct">${pct}%</span>
          </div>
          <button type="button" class="btn-open-classroom" onclick="openClassroomPlayer('${c.id}')">
            ▶ Enter Classroom
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 7. CLASSROOM PLAYER ENGINE (SEAMLESS IN-APP EXPERIENCE)
// ==========================================================================
async function openClassroomPlayer(courseId, initialLessonId = null) {
  pushNavState({ screen: 'classroom', courseId });
  const playerView = document.getElementById('view-classroom-player');
  playerView.classList.remove('hidden');

  try {
    const res = await apiFetch(`course-details&courseId=${encodeURIComponent(courseId)}`);
    activeCourse = res.course;

    const titleEl = document.getElementById('cr-course-title');
    if (titleEl) titleEl.textContent = activeCourse.title;

    renderDrawerLessons(activeCourse);

    let targetLesson = null;
    if (initialLessonId) {
      activeCourse.modules?.forEach(m => {
        const found = m.lessons?.find(l => l.id === initialLessonId);
        if (found) targetLesson = found;
      });
    }
    if (!targetLesson && activeCourse.modules?.[0]?.lessons?.[0]) {
      targetLesson = activeCourse.modules[0].lessons[0];
    }

    if (targetLesson) {
      loadLessonToPlayer(courseId, targetLesson.id);
    }
  } catch (err) {
    toast('Course open karne me problem aayi: ' + err.message, false);
    closeClassroomPlayer();
  }
}

function closeClassroomPlayer(fromPopstate = false) {
  document.getElementById('view-classroom-player').classList.add('hidden');
  document.getElementById('cr-video-mount').innerHTML = '';
  closeAllLessonsDrawer();
  if (!fromPopstate && window.history.state && window.history.state.screen === 'classroom') {
    try { window.history.back(); } catch (e) {}
  }
}

function renderClassroomModules(course) {
  const container = document.getElementById('cr-modules-container');
  if (!container || !course.modules) return;

  const completedList = (currentStudent && currentStudent.completedLessons && currentStudent.completedLessons[course.id]) || [];

  container.innerHTML = course.modules.map((m, mIdx) => `
    <div class="module-group">
      <div class="module-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <span>${escHtml(m.title)}</span>
        <span style="font-size:11px; color:var(--text-muted);">${m.lessons?.length || 0} Lessons ▾</span>
      </div>
      <div class="module-lessons-container">
        ${(m.lessons || []).map(l => {
          const isDone = completedList.includes(l.id);
          return `
            <div id="cr-les-row-${l.id}" class="lesson-row-item ${isDone ? 'completed' : ''}" onclick="loadLessonToPlayer('${course.id}', '${l.id}')">
              <div class="lesson-row-left">
                <span class="lesson-status-icon">${isDone ? '✓' : '○'}</span>
                <span class="lesson-row-title">${escHtml(l.title)}</span>
              </div>
              <span class="lesson-row-time">${escHtml(l.duration || '')}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

async function loadLessonToPlayer(courseId, lessonId) {
  try {
    const res = await apiFetch(`get-lesson&courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`);
    activeLesson = res.lesson;

    // Highlight row in active lists
    document.querySelectorAll('.lesson-row-item, .drawer-lesson-item').forEach(r => r.classList.remove('active', 'playing'));
    document.getElementById(`cr-les-row-${lessonId}`)?.classList.add('active');
    const drawerRow = document.getElementById(`drawer-les-row-${lessonId}`);
    if (drawerRow) {
      drawerRow.classList.add('playing');
    }

    document.getElementById('cr-lesson-title').textContent = activeLesson.title || 'Lesson';
    const durBadge = document.getElementById('cr-lesson-dur-badge');
    if (durBadge) {
      durBadge.textContent = `⏱ ${activeLesson.duration || 'Video'}`;
    }

    const completedList = (currentStudent && currentStudent.completedLessons && currentStudent.completedLessons[courseId]) || [];
    const isDone = Boolean(activeLesson.isCompleted || completedList.includes(lessonId));
    updatePlayerCompleteButton(isDone);

    const mount = document.getElementById('cr-video-mount');
    const streamUrl = activeLesson.streamUrl || activeLesson.videoUrl || activeLesson.bunnyIframeUrl || activeLesson.embedUrl || activeLesson.url || '';
    const rawAll = [
      activeLesson.youtubeId,
      activeLesson.videoId,
      activeLesson.streamUrl,
      activeLesson.videoUrl,
      activeLesson.bunnyIframeUrl,
      activeLesson.embedUrl,
      activeLesson.url
    ].filter(Boolean).join(' ');

    let ytId = activeLesson.youtubeId || '';
    if (!ytId) {
      const match = rawAll.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (match) ytId = match[1];
    }

    let bunnyId = activeLesson.bunnyVideoId || '';
    if (!bunnyId) {
      const bMatch = rawAll.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
      if (bMatch) bunnyId = bMatch[0];
    }

    const isYt = !!ytId || activeLesson.videoType === 'youtube';
    const isBunny = !isYt && (
      activeLesson.videoType === 'bunny_stream' ||
      activeLesson.videoType === 'bunny' ||
      !!bunnyId ||
      rawAll.includes('iframe.mediadelivery.net') ||
      rawAll.includes('video.bunnycdn.com')
    );

    if (isBunny) {
      let bunnyUrl = '';
      if (streamUrl && streamUrl.includes('iframe.mediadelivery.net')) {
        bunnyUrl = streamUrl.replace('/play/', '/embed/');
      } else if (bunnyId) {
        bunnyUrl = `https://iframe.mediadelivery.net/embed/755385/${encodeURIComponent(bunnyId)}?autoplay=true&preload=true&responsive=true`;
      } else {
        bunnyUrl = streamUrl;
      }

      const sep = bunnyUrl.includes('?') ? '&' : '?';
      const cleanUrl = bunnyUrl.includes('_t=') ? bunnyUrl : (bunnyUrl + sep + '_t=' + Date.now() + '&autoplay=true');
      mount.innerHTML = `<iframe id="cr-video-iframe" src="${cleanUrl}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="width:100%;height:100%;border:none;pointer-events:auto !important;"></iframe>`;
      
      // Listen for bunny end event
      window._bunnyEndedListener && window.removeEventListener('message', window._bunnyEndedListener);
      window._bunnyEndedListener = (e) => {
        try {
          const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (d?.event === 'ended' || d?.type === 'ended') {
            handleLessonVideoEnded();
          }
        } catch (_) {}
      };
      window.addEventListener('message', window._bunnyEndedListener);

    } else if (isYt && ytId) {
      const yUrl = `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=1&fs=1`;
      mount.innerHTML = `<iframe id="cr-video-iframe" src="${yUrl}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen style="width:100%;height:100%;border:none;pointer-events:auto !important;"></iframe>`;

    } else if (streamUrl) {
      mount.innerHTML = `<video id="main-video-el" src="${streamUrl}" controls playsinline style="width:100%;height:100%;object-fit:contain;background:#000;pointer-events:auto !important;"></video>`;
      const vidEl = document.getElementById('main-video-el');
      if (vidEl) {
        vidEl.addEventListener('ended', handleLessonVideoEnded);
      }
    } else {
      mount.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#cbd5e1;padding:20px;text-align:center;">
        <span style="font-size:32px;margin-bottom:8px;">🎬</span>
        <div style="font-size:14px;font-weight:600;color:#fff;">Video lecture is being prepared</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Please check notes and practice files in the meantime.</div>
      </div>`;
    }

    renderLessonResources(activeLesson);
    renderLessonNotes(activeLesson);
    renderLessonQuiz(activeLesson);
    renderLessonAssignment(activeLesson);
    loadLessonComments(courseId, lessonId);

    // Default to 'doubts' (Comment tab) directly under video player!
    switchClassroomSubtab('doubts');
  } catch (err) {
    toast('Lesson load failed: ' + err.message, false);
  }
}

function updatePlayerCompleteButton(isDone) {
  const completeBtn = document.getElementById('btn-toggle-complete');
  if (!completeBtn) return;
  completeBtn.classList.toggle('done', isDone);
  const icon = document.getElementById('complete-icon');
  const text = document.getElementById('complete-text');
  if (icon) icon.textContent = isDone ? '✓' : '○';
  if (text) text.textContent = isDone ? 'Completed' : 'Mark as Complete';
}

function handleLessonVideoEnded() {
  if (activeCourse && activeLesson && !activeLesson.isCompleted) {
    toggleCurrentLessonComplete();
  }
}

function replayCurrentLesson() {
  const video = document.getElementById('main-video-el');
  if (video) {
    video.currentTime = 0;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    toast('↺ Video restarted');
    return;
  }
  const iframe = document.getElementById('cr-video-iframe');
  if (iframe && activeLesson && activeLesson.streamUrl) {
    const sep = activeLesson.streamUrl.includes('?') ? '&' : '?';
    iframe.src = activeLesson.streamUrl + sep + '_t=' + Date.now() + '&autoplay=true';
    toast('↺ Video reloaded');
    return;
  }
  if (activeCourse && activeLesson) {
    loadLessonToPlayer(activeCourse.id, activeLesson.id);
  }
}

function getAppCourseLessonStats(course) {
  if (!course || !course.modules) return { total: 0, done: 0, pct: 0 };
  const completedList = (currentStudent && currentStudent.completedLessons && currentStudent.completedLessons[course.id]) || [];
  let total = 0;
  let done = 0;
  course.modules.forEach(m => {
    (m.lessons || []).forEach(l => {
      total++;
      if (completedList.includes(l.id) || l.isCompleted) done++;
    });
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

function isAppCourseQuizPassed(courseId) {
  if (!courseId) return false;
  const stu = currentStudent || JSON.parse(localStorage.getItem('qaa_student_info') || '{}');
  const stuPhone = stu.phone || '';
  const localPassed = localStorage.getItem(`qaa_quiz_passed_${stuPhone}_${courseId}`) === 'true' ||
                      localStorage.getItem(`qaa_quiz_passed_${courseId}`) === 'true';
  const stuPassed = Boolean(stu.passedQuizzes && stu.passedQuizzes[courseId]);
  return localPassed || stuPassed;
}

async function toggleCurrentLessonComplete() {
  if (!activeCourse || !activeLesson) return;
  const courseId = activeCourse.id;
  const lessonId = activeLesson.id;
  const alreadyDone = Boolean(currentStudent && currentStudent.completedLessons &&
    (currentStudent.completedLessons[courseId] || []).includes(lessonId));

  try {
    await apiFetch('update-progress', {
      method: 'POST',
      body: { courseId, lessonId, isCompleted: !alreadyDone }
    });

    if (!currentStudent.completedLessons) currentStudent.completedLessons = {};
    if (!currentStudent.completedLessons[courseId]) currentStudent.completedLessons[courseId] = [];

    const idx = currentStudent.completedLessons[courseId].indexOf(lessonId);
    let nowDone = false;
    if (idx > -1) {
      currentStudent.completedLessons[courseId].splice(idx, 1);
    } else {
      currentStudent.completedLessons[courseId].push(lessonId);
      nowDone = true;
    }
    activeLesson.isCompleted = nowDone;
    localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));

    updatePlayerCompleteButton(nowDone);

    const row = document.getElementById(`cr-les-row-${lessonId}`);
    if (row) {
      row.classList.toggle('completed', nowDone);
      const icon = row.querySelector('.lesson-status-icon');
      if (icon) icon.textContent = nowDone ? '✓' : '○';
    }

    const drawerRow = document.getElementById(`drawer-les-row-${lessonId}`);
    if (drawerRow) {
      drawerRow.classList.toggle('completed', nowDone);
      const icon = drawerRow.querySelector('.drawer-lesson-icon');
      if (icon) icon.textContent = drawerRow.classList.contains('playing') ? '▶' : (nowDone ? '✓' : '○');
    }

    if (nowDone) {
      const stats = getAppCourseLessonStats(activeCourse);
      if (stats.pct >= 100) {
        const quizDone = isAppCourseQuizPassed(activeCourse.id);
        if (quizDone) {
          toast('🎓 Outstanding! Course lessons & test 100% completed!');
        } else {
          toast('🎉 Sabhi lessons poore ho gaye! Certificate unlock karne ke liye Quiz tab me Test complete karein.');
          switchClassroomSubtab('quiz');
        }
      } else {
        toast('🎉 Lesson marked as completed!');
      }
    } else {
      toast('Lesson status updated.');
    }
  } catch (err) {
    toast('Progress update failed', false);
  }
}

function goToNextLesson() {
  if (!activeCourse || !activeLesson) return;
  let foundCurrent = false;
  let nextLesson = null;

  for (const mod of activeCourse.modules || []) {
    for (const les of mod.lessons || []) {
      if (foundCurrent) {
        nextLesson = les;
        break;
      }
      if (les.id === activeLesson.id) {
        foundCurrent = true;
      }
    }
    if (nextLesson) break;
  }

  if (nextLesson) {
    loadLessonToPlayer(activeCourse.id, nextLesson.id);
  } else {
    const stats = getAppCourseLessonStats(activeCourse);
    if (stats.pct >= 100) {
      const quizDone = isAppCourseQuizPassed(activeCourse.id);
      if (quizDone) {
        toast('🎓 Congratulations! You reached the end of this course!');
      } else {
        toast('🎉 Sabhi lessons poore ho gaye! Certificate paane ke liye Certification Quiz / Test paas karein.');
        switchClassroomSubtab('quiz');
      }
    } else {
      toast('Aapne is module ke sabhi lessons dekh liye hain.');
    }
  }
}

function openAllLessonsDrawer() {
  if (!activeCourse) return;
  const drawer = document.getElementById('modal-all-lessons');
  if (!drawer) return;

  renderDrawerLessons(activeCourse);
  drawer.classList.add('active');
}

function closeAllLessonsDrawer() {
  const drawer = document.getElementById('modal-all-lessons');
  if (drawer) drawer.classList.remove('active');
}

function renderDrawerLessons(course) {
  const container = document.getElementById('drawer-modules-container');
  if (!container || !course.modules) return;

  const completedList = (currentStudent && currentStudent.completedLessons && currentStudent.completedLessons[course.id]) || [];
  
  let totalCount = 0;
  let doneCount = 0;
  course.modules.forEach(m => {
    (m.lessons || []).forEach(l => {
      totalCount++;
      if (completedList.includes(l.id)) doneCount++;
    });
  });
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const nameEl = document.getElementById('drawer-course-name');
  if (nameEl) nameEl.textContent = course.title || 'Course Curriculum';
  const statEl = document.getElementById('drawer-course-stat');
  if (statEl) statEl.textContent = `${doneCount} of ${totalCount} Lessons Completed (${pct}%)`;
  const barEl = document.getElementById('drawer-prog-bar');
  if (barEl) barEl.style.width = `${pct}%`;

  container.innerHTML = course.modules.map((m, mIdx) => `
    <div class="drawer-module-group">
      <div class="drawer-module-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <span class="drawer-module-title">${escHtml(m.title)}</span>
        <span class="drawer-module-count">${m.lessons?.length || 0} Lessons ▾</span>
      </div>
      <div class="drawer-module-lessons">
        ${(m.lessons || []).map(l => {
          const isDone = completedList.includes(l.id);
          const isPlaying = activeLesson && activeLesson.id === l.id;
          return `
            <div id="drawer-les-row-${l.id}" class="drawer-lesson-item ${isPlaying ? 'playing' : ''} ${isDone ? 'completed' : ''}" onclick="selectLessonFromDrawer('${course.id}', '${l.id}')">
              <div class="drawer-lesson-left">
                <span class="drawer-lesson-icon">${isPlaying ? '▶' : (isDone ? '✓' : '○')}</span>
                <div class="drawer-lesson-details">
                  <div class="drawer-lesson-name">${escHtml(l.title)}</div>
                  <div class="drawer-lesson-meta">
                    ${isPlaying ? '<span class="now-playing-tag">NOW PLAYING</span> • ' : ''}
                    <span>⏱ ${escHtml(l.duration || 'Video')}</span>
                  </div>
                </div>
              </div>
              <span class="drawer-lesson-arrow">›</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function selectLessonFromDrawer(courseId, lessonId) {
  closeAllLessonsDrawer();
  loadLessonToPlayer(courseId, lessonId);
}

function openAvatarQuickMenu() {
  if (!currentStudent) return;
  const drawer = document.getElementById('sheet-avatar-quickmenu');
  if (!drawer) return;

  const name = currentStudent.name || 'Student';
  const phone = currentStudent.phone ? `+91 ${currentStudent.phone}` : (currentStudent.email || '');
  const enrollNo = currentStudent.enrollmentNo || currentStudent.id || 'QAA-STUDENT';
  const avatar = currentStudent.photoUrl || currentStudent.avatar || currentStudent.avatarUrl || '';
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  document.getElementById('quickmenu-name').textContent = name;
  document.getElementById('quickmenu-phone').textContent = phone;
  document.getElementById('quickmenu-id-badge').textContent = `ID: ${enrollNo}`;

  const roleBadge = document.getElementById('quickmenu-role-badge');
  if (roleBadge) {
    const isOnlineBatch = !!currentStudent.isOnlineBatch || (currentStudent.offlineAdmissionId && String(currentStudent.offlineAdmissionId).includes('-ON-')) || /batch\s*[-_]?\s*\d+/i.test(currentStudent.appliedCourse || '');
    if (isOnlineBatch) {
      roleBadge.textContent = 'ONLINE BATCH ADMISSION';
      roleBadge.style.color = '#38bdf8';
    } else if (currentStudent.isOfflineStudent || currentStudent.offlineAdmissionId) {
      roleBadge.textContent = 'OFFLINE ADMISSION';
      roleBadge.style.color = '#fde68a';
    } else {
      roleBadge.textContent = 'VERIFIED STUDENT';
      roleBadge.style.color = '#34d399';
    }
  }

  const avatarImg = document.getElementById('quickmenu-avatar-img');
  const avatarFb = document.getElementById('quickmenu-avatar-fallback');
  if (avatar) {
    avatarImg.src = avatar;
    avatarImg.classList.remove('hidden');
    avatarFb.classList.add('hidden');
  } else {
    avatarFb.textContent = initials;
    avatarFb.classList.remove('hidden');
    avatarImg.classList.add('hidden');
  }

  // Calculate course stats
  const count = (enrolledCourses || []).length;
  document.getElementById('quickmenu-course-count').textContent = count;
  
  let certCount = 0;
  (enrolledCourses || []).forEach(c => {
    const tot = c.totalLessons || (c.modules ? c.modules.reduce((a, m) => a + (m.lessons?.length || 0), 0) : 0);
    const done = c.completedCount || 0;
    if (tot > 0 && done >= tot) certCount++;
  });
  document.getElementById('quickmenu-cert-count').textContent = certCount;

  drawer.classList.add('active');
  pushNavState({ screen: 'modal', modal: 'avatar' });
}

function closeAvatarQuickMenu(fromPopstate = false) {
  const drawer = document.getElementById('sheet-avatar-quickmenu');
  if (drawer) drawer.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'avatar') {
    try { window.history.back(); } catch (e) {}
  }
}

function switchClassroomSubtab(tabKey) {
  document.querySelectorAll('.lesson-subtab').forEach(t => {
    const isActive = t.getAttribute('data-sub') === tabKey;
    t.classList.toggle('active', isActive);
    if (isActive) {
      t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
  ['curriculum', 'resources', 'notes', 'doubts', 'quiz', 'assignment', 'support'].forEach(k => {
    const el = document.getElementById(`cr-sub-${k}`);
    if (el) el.classList.toggle('hidden', k !== tabKey);
  });
}

function renderLessonResources(lesson) {
  const container = document.getElementById('cr-resources-list');
  if (!container) return;
  const resources = lesson.resources || [];
  if (!resources.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:12.5px;">Is lesson ke liye koi downloadable practice files nahi hain.</div>`;
    return;
  }
  container.innerHTML = resources.map(r => `
    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div>
        <div style="font-weight:700;color:#fff;font-size:13px;">${escHtml(r.name || r.title || 'Practice File')}</div>
        <div style="font-size:11px;color:var(--text-dim);">${escHtml(r.size || 'Downloadable Asset')}</div>
      </div>
      <a href="${r.url ? (r.url.startsWith('http') ? r.url : `../${r.url}`) : '#'}" download target="_blank" class="btn-primary" style="width:auto;padding:6px 12px;font-size:11.5px;text-decoration:none;">
        Download ⬇
      </a>
    </div>
  `).join('');
}

function renderLessonNotes(lesson) {
  const container = document.getElementById('cr-notes-content');
  if (!container) return;
  container.innerHTML = lesson.summary || lesson.notes || 'Is lecture ke practical points aur keyboard shortcuts mentor ke dwara study notes me shamil hain.';
}

const APP_DEFAULT_QUIZ = [
  {
    question: "Video editing me Timeline pe clip ko cut ya split karne ke liye default shortcut tool kaun sa hota hai?",
    options: ["Selection Tool (V)", "Razor Tool (C)", "Pen Tool (P)", "Hand Tool (H)"],
    answer: 1
  },
  {
    question: "Final video export karte samay standard web aur mobile playback ke liye best universal format kaun sa hai?",
    options: ["AVI Uncompressed", "H.264 / MP4", "QuickTime Animation", "WMV"],
    answer: 1
  },
  {
    question: "Color Grading karte samay contrast aur exposure balance karne ke liye kis panel/tool ka upyog kiya jata hai?",
    options: ["Lumetri Curves & Wheels", "Crop Effect", "Audio Gain", "Speed/Duration"],
    answer: 0
  }
];

function renderLessonQuiz(lesson) {
  const container = document.getElementById('cr-quiz-container');
  if (!container) return;

  const quiz = (activeCourse && activeCourse.quiz && activeCourse.quiz.length) ? activeCourse.quiz : APP_DEFAULT_QUIZ;
  const isPassed = isAppCourseQuizPassed(activeCourse?.id);

  container.innerHTML = `
    <div style="background:var(--bg-card);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h4 style="font-size:14px;font-weight:700;margin:0;color:#fff;">📝 Certification Knowledge Check</h4>
        <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${isPassed ? 'rgba(16,185,129,0.15)' : 'rgba(216,161,83,0.15)'};color:${isPassed ? '#34d399' : '#d8a153'};font-weight:700;">
          ${isPassed ? '✓ Passed (70%+)' : 'Required for Certificate'}
        </span>
      </div>
      <div id="app-quiz-result-banner" class="${isPassed ? '' : 'hidden'}" style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:${isPassed ? 'rgba(16,185,129,0.15);border:1px solid #10b981;color:#34d399;' : 'rgba(239,68,68,0.15);border:1px solid #ef4444;color:#fca5a5;'}font-size:12px;line-height:1.4;">
        ${isPassed ? '🎉 Aapne yeh Certification Test paas kar liya hai!' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${quiz.map((q, qIdx) => `
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:10px;">${qIdx + 1}. ${escHtml(q.question)}</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${q.options.map((opt, oIdx) => `
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#cbd5e1;cursor:pointer;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02);">
                  <input type="radio" name="app_quiz_q_${qIdx}" value="${oIdx}" style="accent-color:var(--gold);" />
                  <span>${escHtml(opt)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn-primary" onclick="submitAppQuiz()" style="width:100%;margin-top:14px;padding:12px;font-weight:700;">
        Submit Quiz Answers ➔
      </button>
    </div>
  `;
}

function submitAppQuiz() {
  if (!activeCourse) return;
  const quiz = (activeCourse.quiz && activeCourse.quiz.length) ? activeCourse.quiz : APP_DEFAULT_QUIZ;
  let correctCount = 0;
  let allAnswered = true;

  quiz.forEach((q, qIdx) => {
    const selected = document.querySelector(`input[name="app_quiz_q_${qIdx}"]:checked`);
    const expected = typeof q.answer === 'number' ? q.answer : (typeof q.correct === 'number' ? q.correct : 0);
    if (!selected) {
      allAnswered = false;
    } else if (parseInt(selected.value, 10) === expected) {
      correctCount++;
    }
  });

  if (!allAnswered) {
    toast('Kripya sabhi sawalon ke jawab select karein!', false);
    return;
  }

  const total = quiz.length;
  const scorePct = Math.round((correctCount / total) * 100);
  const banner = document.getElementById('app-quiz-result-banner');

  if (scorePct >= 70) {
    if (banner) {
      banner.className = '';
      banner.style.cssText = 'margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(16,185,129,0.15);border:1px solid #10b981;color:#34d399;font-size:12px;';
      banner.innerHTML = `🎉 Badhai ho! Aapne ${correctCount}/${total} (${scorePct}%) score kiya aur certification test paas kar liya!`;
    }
    const stuPhone = (currentStudent && currentStudent.phone) || '';
    localStorage.setItem(`qaa_quiz_passed_${stuPhone}_${activeCourse.id}`, 'true');
    localStorage.setItem(`qaa_quiz_passed_${activeCourse.id}`, 'true');
    if (!currentStudent) currentStudent = {};
    if (!currentStudent.passedQuizzes) currentStudent.passedQuizzes = {};
    currentStudent.passedQuizzes[activeCourse.id] = true;
    try {
      localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));
    } catch (_) {}
    apiFetch('record-quiz-pass', { method: 'POST', body: { courseId: activeCourse.id, scorePct } })
      .catch(err => console.warn('Quiz result sync failed:', err));

    const stats = getAppCourseLessonStats(activeCourse);
    if (stats.pct >= 100) {
      toast('🎓 Outstanding! Course lessons aur quiz 100% complete! Certificate unlocked in Profile.');
    } else {
      toast(`🎉 Quiz Passed (${scorePct}%)! Baaki lessons complete karne ke baad certificate unlock hoga.`);
    }
  } else {
    if (banner) {
      banner.className = '';
      banner.style.cssText = 'margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#fca5a5;font-size:12px;';
      banner.innerHTML = `Aapka score ${correctCount}/${total} (${scorePct}%) raha. Passing score 70% hai. Kripya dobara try karein.`;
    }
    toast('Score 70% se kam hai. Dobara test attempt karein!', false);
  }
}

function renderLessonAssignment(lesson) {
  const container = document.getElementById('cr-assignment-container');
  if (!container) return;
  container.innerHTML = `
    <div style="background:var(--bg-card);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
      <h4 style="font-size:14px;font-weight:700;margin-bottom:6px;color:#fff;">📤 Practical Assignment Submission</h4>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
        Apna edited timeline export (Google Drive / WeTransfer / YouTube Unlisted link) submit karein. Mentor Anil Sharma review karke feedback denge.
      </p>
      <input type="url" id="cr-assign-link" class="app-input" placeholder="https://drive.google.com/..." style="margin-bottom:10px;" />
      <button type="button" class="btn-primary" onclick="submitLessonAssignment()">
        Submit Project for Review ➔
      </button>
    </div>
  `;
}

async function submitLessonAssignment() {
  const link = document.getElementById('cr-assign-link')?.value.trim();
  if (!link) {
    toast('Submission link enter karein (e.g. Google Drive link)', false);
    return;
  }
  try {
    await apiFetch('submit-assignment', {
      method: 'POST',
      body: {
        courseId: activeCourse.id,
        assignmentId: activeLesson.id,
        assignmentTitle: activeLesson.title,
        submissionUrl: link,
        notes: 'Submitted via Mobile App'
      }
    });
    toast('🎉 Assignment submitted successfully! Mentor review karenge.');
    document.getElementById('cr-assign-link').value = '';
  } catch (err) {
    toast(err.message || 'Submission error', false);
  }
}

async function loadLessonComments(courseId, lessonId) {
  const container = document.getElementById('cr-comments-list');
  if (!container) return;
  try {
    const res = await apiFetch(`discussion-list&courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`);
    const comments = res.comments || [];
    if (!comments.length) {
      container.innerHTML = `<div style="font-size:12.5px;color:var(--text-muted);text-align:center;padding:22px 10px;background:rgba(255,255,255,0.02);border-radius:var(--radius-md);">
        <span style="font-size:24px;display:block;margin-bottom:6px;">💬</span>
        Abhi tak is lesson par koi comment nahi hai.<br><span style="font-size:11px;color:var(--text-dim);">Apna sawaal ya feedback pehle puchiye!</span>
      </div>`;
      return;
    }
    container.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-item-hdr">
          <span class="comment-author">👤 ${escHtml(c.authorName || c.userName || 'Student')}</span>
          <span class="comment-time">${escHtml(c.time || c.createdAt || 'Recent')}</span>
        </div>
        <div class="comment-text">${escHtml(c.text || '')}</div>
      </div>
    `).join('');
  } catch (_) {}
}

async function handlePostLessonComment(e) {
  e.preventDefault();
  const input = document.getElementById('cr-comment-input');
  const text = input.value.trim();
  if (!text || !activeCourse || !activeLesson) return;

  try {
    await apiFetch('discussion-post', {
      method: 'POST',
      body: {
        courseId: activeCourse.id,
        lessonId: activeLesson.id,
        text: text
      }
    });
    input.value = '';
    loadLessonComments(activeCourse.id, activeLesson.id);
    toast('💬 Comment posted successfully!');
  } catch (_) {
    toast('Could not post comment', false);
  }
}

function shareCurrentLesson() {
  if (navigator.share && activeCourse) {
    navigator.share({
      title: activeCourse.title,
      text: `Learning ${activeLesson?.title || 'video editing'} on Quick Art Academy App!`,
      url: window.location.href
    }).catch(() => {});
  } else {
    toast('Link copied to clipboard!');
  }
}

let currentLiveSubTab = 'upcoming';

function switchLiveSubTab(tab = 'upcoming') {
  currentLiveSubTab = tab;
  const btnUpcoming = document.getElementById('btn-live-tab-upcoming');
  const btnCompleted = document.getElementById('btn-live-tab-completed');
  const panelUpcoming = document.getElementById('panel-live-upcoming');
  const panelCompleted = document.getElementById('panel-live-completed');

  if (tab === 'upcoming') {
    if (btnUpcoming) {
      btnUpcoming.classList.add('active');
      btnUpcoming.setAttribute('aria-selected', 'true');
    }
    if (btnCompleted) {
      btnCompleted.classList.remove('active');
      btnCompleted.setAttribute('aria-selected', 'false');
    }
    if (panelUpcoming) panelUpcoming.style.display = 'block';
    if (panelCompleted) panelCompleted.style.display = 'none';
  } else {
    if (btnUpcoming) {
      btnUpcoming.classList.remove('active');
      btnUpcoming.setAttribute('aria-selected', 'false');
    }
    if (btnCompleted) {
      btnCompleted.classList.add('active');
      btnCompleted.setAttribute('aria-selected', 'true');
    }
    if (panelUpcoming) panelUpcoming.style.display = 'none';
    if (panelCompleted) panelCompleted.style.display = 'block';
  }
}

// ==========================================================================
// 8. TAB 3: LIVE SESSIONS (PAID ENROLLED ONLY)
// ==========================================================================
async function loadLiveClassesTab() {
  const pill = document.getElementById('live-tab-status-pill');
  const activeMount = document.getElementById('live-active-mount');
  const paidListEl = document.getElementById('paid-live-classes-list');
  const pastListEl = document.getElementById('past-recordings-list');

  try {
    const res = await apiFetch('get-live-classes');
    allLiveClasses = res.liveClasses || [];

    // STRICT: Filter to only live classes for the current student's PAID enrolled courses
    const paidEnrolledClasses = allLiveClasses.filter(c => isStudentEnrolledInLive(c));
    const activeLive = paidEnrolledClasses.find(c => c.status === 'live');
    const scheduled = paidEnrolledClasses.filter(c => c.status === 'scheduled');
    const past = paidEnrolledClasses.filter(c => (c.status === 'completed' || c.replayUrl));

    // Update Sub-Tab Badges
    const upcomingCount = (activeLive ? 1 : 0) + scheduled.length;
    const completedCount = past.length;

    const upcomingBadge = document.getElementById('live-upcoming-count-badge');
    if (upcomingBadge) upcomingBadge.textContent = upcomingCount;

    const completedBadge = document.getElementById('live-completed-count-badge');
    if (completedBadge) completedBadge.textContent = completedCount;

    // Apply active subtab (defaults to 'upcoming')
    switchLiveSubTab(currentLiveSubTab || 'upcoming');

    // 1. ACTIVE LIVE CLASS MOUNT (Only shown if student has a paid class live RIGHT NOW)
    if (activeLive && activeMount) {
      if (pill) {
        pill.textContent = '🔴 1 Class Live Now';
        pill.style.color = '#ef4444';
      }
      activeMount.classList.remove('hidden');
      activeMount.innerHTML = `
        <div class="paid-live-card active-live-border">
          <div class="paid-live-header">
            <span class="paid-live-course-tag">🎓 ${escHtml(getCourseTitleById(activeLive.courseId))}</span>
            <span class="paid-live-status-tag live">🔴 LIVE BROADCASTING NOW</span>
          </div>
          <div class="paid-live-title" style="font-size:17px;">${escHtml(activeLive.title)}</div>
          ${activeLive.description ? `<div class="paid-live-desc">${escHtml(activeLive.description)}</div>` : ''}
          <div class="paid-live-meta-grid">
            <div class="paid-live-meta-item">
              <span class="paid-live-meta-lbl">Session Status</span>
              <span class="paid-live-meta-val" style="color:#ef4444;font-weight:700;">● Active Streaming</span>
            </div>
            <div class="paid-live-meta-item">
              <span class="paid-live-meta-lbl">Mentor</span>
              <span class="paid-live-meta-val">👨‍🏫 Anil Sharma</span>
            </div>
          </div>
          <div style="margin-top:14px;">
            <button type="button" class="btn-primary" onclick="openLiveClassroom('${activeLive.id}')" style="width:100%; padding:14px; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
              🔴 Enter Live Classroom (Full Screen &amp; Live Chat) →
            </button>
          </div>
        </div>
      `;
    } else if (activeMount) {
      activeMount.classList.add('hidden');
      activeMount.innerHTML = '';
      if (pill) {
        pill.textContent = '🎓 Paid Enrolled Access';
        pill.style.color = '#94a3b8';
      }
    }

    // 2. PAID ENROLLED SCHEDULED SESSIONS (UPCOMING TAB)
    if (paidListEl) {
      if (!scheduled.length) {
        const enrolledNames = (enrolledCourses || []).map(c => c.title || c.name || c.id);
        paidListEl.innerHTML = `
          <div class="empty-paid-live-card">
            <div class="empty-paid-live-icon">🎓</div>
            <div class="empty-paid-live-title">Paid Mentorship &amp; Live Doubt Sessions</div>
            <p class="empty-paid-live-sub">
              Mentor Anil Sharma dwara aapke enrolled courses ke liye advanced video editing, album design aur doubt clearing live classes schedule kiye jate hain.
            </p>
            ${enrolledNames.length ? `
              <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:6px; letter-spacing:0.04em;">Aapke Active Courses (Live Access Granted):</div>
              <div class="enrolled-courses-pills">
                ${enrolledNames.map(name => `<span class="enrolled-course-pill">✓ ${escHtml(name)}</span>`).join('')}
              </div>
            ` : (currentStudent && (!currentStudent.isApproved || currentStudent.status === 'pending_approval') && (currentStudent.isOfflineStudent || currentStudent.appliedCourse) ? `
              <div class="empty-paid-live-tip" style="color:#fde68a; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); padding:12px; border-radius:10px; font-size:13px; line-height:1.5; margin-bottom:10px;">
                ⏳ <strong>Batch Admission Application Under Review</strong><br>
                Aapka admission form receive ho chuka hai (Course: <strong>${escHtml(currentStudent.appliedCourse || 'Live Batch')}</strong>). Academy Admin dwara verify &amp; approve hone ke baad Live Interactive Classroom unlock ho jayega.
                <div style="margin-top:6px; font-size:11.5px; color:#cbd5e1;">
                  🪪 <em>Aap apna official ID Card profile tab ("👤 My Profile") me jakar dekh aur download kar sakte hain.</em>
                </div>
              </div>
            ` : `
              <div class="empty-paid-live-tip" style="color:#fca5a5; background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.2);">
                ⚠️ Aapka koi paid course active nahi mila. Courses tab me jakar enroll karein.
              </div>
            `)}
            <div class="empty-paid-live-tip">
              📌 Agli live class schedule hote hi uski date, time aur join button yahin update ho jayegi.
            </div>
            ${past.length ? `
              <div style="margin-top:14px; text-align:center;">
                <button type="button" class="btn btn-outline" onclick="switchLiveSubTab('completed')" style="width:auto; padding:9px 18px; font-size:12.5px; margin:0 auto; display:inline-flex; align-items:center; gap:6px; border-color:#38bdf8; color:#38bdf8;">
                  <span>📼 Pichli Class Recordings Dekhein (${past.length}) →</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        paidListEl.innerHTML = scheduled.map(c => renderPaidLiveCard(c)).join('');
        startLiveCountdowns();
      }
    }

    // 3. PAST CLASS RECORDINGS (COMPLETED REPLAYS TAB)
    if (pastListEl) {
      if (!past.length) {
        pastListEl.innerHTML = `
          <div class="empty-paid-live-card">
            <div class="empty-paid-live-icon">📼</div>
            <div class="empty-paid-live-title">No Completed Recordings Yet</div>
            <p class="empty-paid-live-sub">
              Aapke enrolled courses ki live classes complete hone ke turant baad unki 4K masterclass recording yahan automatically add ho jayegi.
            </p>
            <div class="empty-paid-live-tip">
              💡 Upcoming schedule dekhne ke liye upar <b>Upcoming Live</b> tab par click karein.
            </div>
          </div>
        `;
      } else {
        pastListEl.innerHTML = past.map(c => {
          const courseLabel = getCourseTitleById(c.courseId);
          const dt = c.scheduledAt ? new Date(c.scheduledAt) : null;
          const timeStr = dt ? dt.toLocaleString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }) + ' IST' : 'Completed Session';

          return `
            <div class="paid-live-card" onclick="openLiveRecording('${c.id}')" style="cursor:pointer; margin-bottom:14px;">
              <div class="paid-live-header">
                <span class="paid-live-course-tag">🎓 ${escHtml(courseLabel)}</span>
                <span class="paid-live-status-tag" style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.35);">
                  ✓ RECORDING UNLOCKED
                </span>
              </div>
              <div class="paid-live-title" style="font-size:15px; margin-top:4px;">${escHtml(c.title)}</div>
              ${c.description ? `<div class="paid-live-desc">${escHtml(c.description)}</div>` : ''}

              <div class="paid-live-meta-grid" style="margin-top:10px;">
                <div class="paid-live-meta-item">
                  <span class="paid-live-meta-lbl">Broadcast Date</span>
                  <span class="paid-live-meta-val">📅 ${escHtml(timeStr)}</span>
                </div>
                <div class="paid-live-meta-item">
                  <span class="paid-live-meta-lbl">Mentor</span>
                  <span class="paid-live-meta-val">👨‍🏫 Anil Sharma</span>
                </div>
                <div class="paid-live-meta-item">
                  <span class="paid-live-meta-lbl">Duration</span>
                  <span class="paid-live-meta-val">⏱️ ${escHtml(c.duration || '90 Mins')}</span>
                </div>
                <div class="paid-live-meta-item">
                  <span class="paid-live-meta-lbl">Quality</span>
                  <span class="paid-live-meta-val" style="color:#38bdf8;">🎥 1080p 60fps</span>
                </div>
              </div>

              <div style="margin-top:12px;">
                <button type="button" class="btn btn-outline" style="width:100%; border-color:#38bdf8; color:#38bdf8; background:rgba(56,189,248,0.06); font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px 16px; border-radius:10px;">
                  <span>▶</span> <span>Watch 4K Replay Studio ➔</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Live classes tab load failed:', err);
  }
}

function getCourseTitleById(courseId) {
  if (!courseId) return 'All-Access Mentorship';
  const c = (enrolledCourses || []).find(x => x.id === courseId);
  return c?.title || c?.name || courseId.replace('course-', '').replace(/-/g, ' ').toUpperCase();
}

function renderPaidLiveCard(c) {
  const courseLabel = getCourseTitleById(c.courseId);
  const dt = c.scheduledAt ? new Date(c.scheduledAt) : null;
  const timeStr = dt ? dt.toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) + ' IST' : 'Scheduled Soon';

  return `
    <div class="paid-live-card">
      <div class="paid-live-header">
        <span class="paid-live-course-tag">🎓 ${escHtml(courseLabel)}</span>
        <span class="paid-live-status-tag scheduled">⏳ Scheduled</span>
      </div>
      <div class="paid-live-title">${escHtml(c.title)}</div>
      ${c.description ? `<div class="paid-live-desc">${escHtml(c.description)}</div>` : ''}

      ${c.scheduledAt ? `
        <div class="live-countdown-container" data-countdown-target="${c.scheduledAt}">
          <div class="live-countdown-badge">⏳ LIVE CLASS STARTS IN</div>
          <div class="live-countdown-clock">
            <div class="cd-box"><span class="cd-val cd-days">00</span><span class="cd-tag">DAYS</span></div>
            <span class="cd-colon">:</span>
            <div class="cd-box"><span class="cd-val cd-hours">00</span><span class="cd-tag">HRS</span></div>
            <span class="cd-colon">:</span>
            <div class="cd-box"><span class="cd-val cd-mins">00</span><span class="cd-tag">MINS</span></div>
            <span class="cd-colon">:</span>
            <div class="cd-box"><span class="cd-val cd-secs">00</span><span class="cd-tag">SECS</span></div>
          </div>
        </div>
      ` : ''}

      <div class="paid-live-meta-grid">
        <div class="paid-live-meta-item">
          <span class="paid-live-meta-lbl">Session Timing</span>
          <span class="paid-live-meta-val">📅 ${escHtml(timeStr)}</span>
        </div>
        <div class="paid-live-meta-item">
          <span class="paid-live-meta-lbl">Mentor</span>
          <span class="paid-live-meta-val">👨‍🏫 Anil Sharma</span>
        </div>
        <div class="paid-live-meta-item">
          <span class="paid-live-meta-lbl">Duration</span>
          <span class="paid-live-meta-val">⏱️ ${escHtml(c.duration || '90 Mins')}</span>
        </div>
        <div class="paid-live-meta-item">
          <span class="paid-live-meta-lbl">Access Status</span>
          <span class="paid-live-meta-val" style="color:#34d399;">✓ Verified Paid Access</span>
        </div>
      </div>
      ${c.status === 'live' ? `
        <div style="margin-top:12px; margin-bottom:12px;">
          <button type="button" class="btn-primary" onclick="openLiveClassroom('${c.id}')" style="width:100%; padding:12px; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
            🔴 Join Live Classroom Now →
          </button>
        </div>
      ` : ''}
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <button type="button" class="btn-primary" onclick="requestPushNotificationPermission()" style="width:auto; padding:8px 14px; font-size:12px;">
          🔔 Set Class Reminder
        </button>
        <a href="https://wa.me/919939800780?text=${encodeURIComponent('Namaste Sir, I have a doubt regarding live class: ' + c.title)}" target="_blank" rel="noopener" class="btn-secondary" style="width:auto; padding:8px 14px; font-size:12px; text-decoration:none;">
          💬 Ask Doubt on WhatsApp
        </a>
      </div>
    </div>
  `;
}

let liveCountdownInterval = null;
function startLiveCountdowns() {
  if (liveCountdownInterval) clearInterval(liveCountdownInterval);

  function updateAll() {
    const nodes = document.querySelectorAll('[data-countdown-target]');
    if (!nodes.length) return;

    const now = Date.now();
    nodes.forEach(el => {
      const targetStr = el.getAttribute('data-countdown-target');
      if (!targetStr) return;
      const targetTime = new Date(targetStr).getTime();
      const diff = targetTime - now;

      const daysEl = el.querySelector('.cd-days');
      const hoursEl = el.querySelector('.cd-hours');
      const minsEl = el.querySelector('.cd-mins');
      const secsEl = el.querySelector('.cd-secs');

      if (diff <= 0) {
        if (daysEl) daysEl.textContent = '00';
        if (hoursEl) hoursEl.textContent = '00';
        if (minsEl) minsEl.textContent = '00';
        if (secsEl) secsEl.textContent = '00';
        const badge = el.querySelector('.live-countdown-badge');
        if (badge) {
          badge.innerHTML = '🔴 STARTING NOW';
          badge.style.color = '#ef4444';
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
      if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
      if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
      if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');
    });
  }

  updateAll();
  liveCountdownInterval = setInterval(updateAll, 1000);
}

// ==========================================================================
// 8.5 DEDICATED LIVE CLASSROOM ENGINE (FULL SCREEN, CHAT & ANTI-PIRACY DRM)
// ==========================================================================
// ==========================================================================
// 8.5 DEDICATED LIVE CINEMA STUDIO ENGINE (EXACT SAME AS WEBSITE PORTAL)
// ==========================================================================
let currentLiveSession = null;
let currentAppLiveSession = null;
let liveDoubtsPollTimer = null;
let liveWatermarkInterval = null;
let liveAttendeesTimer = null;
let currentLiveAttendeesCount = 428;
let liveOverlayHideTimeout = null;
let livePingTimer = null;
let isStudentHandRaised = false;
window._isLiveInitialIntro = false;

function cleanYouTubeVideoId(input) {
  if (!input) return '';
  input = String(input).trim();
  if (input.startsWith('rtmp://') || input.startsWith('rtmps://')) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const mLive = input.match(/(?:youtube\.com\/live\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (mLive) return mLive[1];
  const mShort = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (mShort) return mShort[1];
  const mV = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (mV) return mV[1];
  const mEmbed = input.match(/embed\/([a-zA-Z0-9_-]{11})/i);
  if (mEmbed) return mEmbed[1];
  const mAny = input.match(/([a-zA-Z0-9_-]{11})/);
  if (mAny && input.includes('youtube')) return mAny[1];
  return input;
}

async function sendStudentLivePing() {
  if (!currentLiveSession || !currentLiveSession.id) return;
  try {
    const res = await apiFetch('live-ping&sessionId=' + encodeURIComponent(currentLiveSession.id), {
      method: 'POST',
      body: {
        sessionId: currentLiveSession.id,
        handRaised: isStudentHandRaised
      }
    });

    if (res && (res.status === 'completed' || res.status === 'ended') && !window._isCurrentReplaySession) {
      handleAppLiveBroadcastEnded();
      return;
    }

    // Update Viewer Count Display (Classroom Mode vs Stealth Webinar Mode)
    const pill = document.getElementById('live-attendees-pill-mini');
    if (pill) {
      if (res.showViewerCount) {
        pill.style.display = 'inline-flex';
        if (typeof res.viewerCount === 'number') {
          updateLiveAttendeesDisplay(res.viewerCount, false);
        }
      } else {
        pill.style.display = 'none';
      }
    }

    // Save Stage Session Details
    if (res.stageGuestUrl) window._currentStageGuestUrl = res.stageGuestUrl;
    if (res.stageRoom) window._currentStageRoom = res.stageRoom;

    // 2-Way Stage Interaction Mic Alert & Live Connect
    const micBanner = document.getElementById('live-mic-permission-banner');
    if (res.micAllowed || res.screenAllowed) {
      if (!window._isStudentOnStage) {
        if (micBanner) micBanner.classList.remove('hidden');
      }
    } else {
      if (micBanner) micBanner.classList.add('hidden');
      if (window._isStudentOnStage) {
        disconnectLiveStage(true);
        toast('🎙️ Live stage ended by mentor');
      }
    }
  } catch (e) {}
}

function connectLiveStage(mode = 'mic') {
  if (!window._currentStageGuestUrl && currentLiveSession) {
    const stageRoom = 'qaa_stage_' + (currentLiveSession.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const stuPhone = (currentStudent && currentStudent.phone) || 'guest';
    const stuName = (currentStudent && currentStudent.name) || 'Student';
    window._currentStageGuestUrl = `https://vdo.ninja/?room=${stageRoom}&push=${encodeURIComponent(stuPhone)}&label=${encodeURIComponent(stuName)}`;
  }

  if (!window._currentStageGuestUrl) {
    toast('Stage link not ready yet. Please try again in 5 seconds.');
    return;
  }

  window._isStudentOnStage = true;
  const micBanner = document.getElementById('live-mic-permission-banner');
  if (micBanner) micBanner.classList.add('hidden');

  const stageDock = document.getElementById('live-stage-active-dock');
  if (stageDock) stageDock.classList.remove('hidden');

  const modeLabel = document.getElementById('live-stage-mode-label');
  const frameContainer = document.getElementById('live-stage-frame-container');

  let targetUrl = window._currentStageGuestUrl;
  if (mode === 'screen') {
    if (modeLabel) modeLabel.textContent = '🖥️ SCREEN / TIMELINE LIVE';
    targetUrl += '&screenshare=1&webcam=0&mic=1&darkmode=1&transparent=1&cleanoutput=1';
    if (frameContainer) {
      frameContainer.style.display = 'block';
      frameContainer.innerHTML = `<iframe id="live-stage-iframe" src="${targetUrl}" allow="camera; microphone; display-capture; autoplay; clipboard-write" style="width:100%; height:260px; border:none; border-radius:10px;" allowfullscreen></iframe>`;
    }
    toast('🖥️ Screen Share Stage Active! Select your editing window to share.');
  } else {
    if (modeLabel) modeLabel.textContent = '🎙️ MIC CONNECTED & LIVE';
    targetUrl += '&webcam=0&mic=1&darkmode=1&transparent=1&cleanoutput=1';
    if (frameContainer) {
      frameContainer.style.display = 'block';
      frameContainer.innerHTML = `<iframe id="live-stage-iframe" src="${targetUrl}" allow="camera; microphone; display-capture; autoplay; clipboard-write" style="width:100%; height:110px; border:none; border-radius:10px;" allowfullscreen></iframe>`;
    }
    toast('🎙️ Microphone Live! Aap bol sakte hain.');
  }
}

function disconnectLiveStage(byMentor = false) {
  window._isStudentOnStage = false;
  const frameContainer = document.getElementById('live-stage-frame-container');
  if (frameContainer) {
    frameContainer.innerHTML = '';
    frameContainer.style.display = 'none';
  }

  const stageDock = document.getElementById('live-stage-active-dock');
  if (stageDock) stageDock.classList.add('hidden');

  const micBanner = document.getElementById('live-mic-permission-banner');
  if (micBanner) micBanner.classList.add('hidden');

  if (!byMentor) {
    isStudentHandRaised = false;
    const btn = document.getElementById('live-raise-hand-btn');
    if (btn) {
      btn.classList.remove('hand-active');
      btn.title = 'Raise Hand / Request to Speak';
    }
    sendStudentLivePing();
    toast('⏹️ Live stage disconnected. Aap mute ho gaye hain.');
  }
}

function declineLiveStage() {
  const micBanner = document.getElementById('live-mic-permission-banner');
  if (micBanner) micBanner.classList.add('hidden');
  isStudentHandRaised = false;
  const btn = document.getElementById('live-raise-hand-btn');
  if (btn) {
    btn.classList.remove('hand-active');
    btn.title = 'Raise Hand / Request to Speak';
  }
  sendStudentLivePing();
  toast('Stage request declined');
}

function toggleLiveRaiseHand() {
  isStudentHandRaised = !isStudentHandRaised;
  const btn = document.getElementById('live-raise-hand-btn');
  if (btn) {
    if (isStudentHandRaised) {
      btn.classList.add('hand-active');
      btn.title = 'Hand Raised (Click to lower)';
      toast('✋ Hand raised! Mentor Anil Sharma ko request bhej di gayi hai.');
    } else {
      btn.classList.remove('hand-active');
      btn.title = 'Raise Hand / Request to Speak';
      toast('✋ Hand lowered');
    }
  }
  sendStudentLivePing();
}

async function openLiveStudio(liveId, forceReplay = false) {
  if (!liveId || liveId === 'masterclass-live') {
    liveId = 'live_demo_01';
  }

  const classroom = document.getElementById('view-live-classroom');
  const viewport = document.getElementById('app-viewport');
  const bottomNav = document.getElementById('bottom-nav');

  if (!classroom) return;

  const session = (allLiveClasses || []).find(c => c.id === liveId);
  if (session && !isStudentEnrolledInLive(session)) {
    toast('Aap is session ke liye enrolled nahi hain. Yeh class paid batch ke liye reserved hai.');
    return;
  }

  // Switch view immediately
  classroom.classList.remove('hidden');
  if (viewport) viewport.classList.add('hidden');
  if (bottomNav) bottomNav.classList.add('hidden');
  classroom.scrollTop = 0;

  // Initialize and run dynamic realistic live attendee counter (300-800)
  startLiveAttendeesCounter();

  const mount = document.getElementById('live-video-mount');
  if (mount) {
    mount.innerHTML = `
      <div class="live-placeholder">
        <div class="live-pulse-ring"></div>
        <div style="font-weight:700;font-size:16px;margin-top:16px;color:#fff;">Connecting to Live Studio…</div>
        <div class="muted" style="font-size:13px;margin-top:4px;">1080p 60fps High-Definition Feed</div>
      </div>
    `;
  }

  try {
    const res = await apiFetch(`get-live-session&liveId=${encodeURIComponent(liveId)}`);
    currentLiveSession = res;
    currentAppLiveSession = res;

    // Detect if this session is a Recording Replay or a Pure Live Broadcast
    const isReplay = forceReplay ||
                     res.status === 'completed' ||
                     res.status === 'ended' ||
                     Boolean(res.replayUrl && res.replayUrl.trim()) ||
                     Boolean(res.bunnyVideoId && res.bunnyVideoId.trim()) ||
                     (res.status !== 'live' && res.scheduledAt && new Date(res.scheduledAt).getTime() < Date.now());
    window._isCurrentReplaySession = isReplay;

    // Update Header
    const titleEl = document.getElementById('live-player-title');
    if (titleEl) titleEl.textContent = res.title || 'Live Masterclass Studio';

    const descTitle = document.getElementById('live-desc-title');
    if (descTitle) descTitle.textContent = res.title || 'Live Masterclass Studio';

    const descSchedule = document.getElementById('live-desc-schedule');
    if (descSchedule && res.scheduledAt) {
      const dt = new Date(res.scheduledAt).toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      descSchedule.textContent = isReplay ? `Archived Session • Duration: ${res.duration || '90 Mins'}` : `Broadcast: ${dt} • Duration: ${res.duration || '90 Mins'}`;
    }

    const descBody = document.getElementById('live-desc-body');
    if (descBody) descBody.textContent = res.description || 'Hands-on timeline session with Lead Mentor Anil Sharma.';

    // Mode-Specific Badge & Controls
    const broadcastBadge = document.querySelector('.live-broadcast-badge');
    const replayControls = document.getElementById('live-replay-controls');
    const raiseHandBtn = document.getElementById('live-raise-hand-btn');
    const shield = document.getElementById('live-full-shield');
    const startMask = document.getElementById('live-start-mask');

    if (isReplay) {
      if (broadcastBadge) {
        broadcastBadge.style.background = 'rgba(216,161,83,0.18)';
        broadcastBadge.style.border = '1px solid rgba(216,161,83,0.4)';
        broadcastBadge.innerHTML = '<span>📼</span><span class="live-broadcast-text" style="color:var(--gold,#d8a153)">REPLAY</span>';
      }
      if (replayControls) replayControls.style.display = 'inline-flex';
      if (raiseHandBtn) raiseHandBtn.style.display = 'none';
      if (shield) {
        shield.style.display = 'none';
        shield.style.pointerEvents = 'none';
      }
      if (startMask) startMask.style.display = 'none';
    } else {
      if (broadcastBadge) {
        broadcastBadge.style.background = '';
        broadcastBadge.style.border = '';
        broadcastBadge.innerHTML = '<span class="live-blink-circle"></span><span class="live-broadcast-text">LIVE</span>';
      }
      if (replayControls) replayControls.style.display = 'none';
      if (raiseHandBtn) raiseHandBtn.style.display = 'inline-flex';
      if (shield) {
        shield.style.display = 'block';
        shield.style.pointerEvents = 'auto';
      }
      if (startMask) {
        startMask.style.display = 'block';
        revealLiveOverlayControls(5000, true);
      }
    }

    // Resources
    const resList = document.getElementById('live-resources-list');
    if (resList) {
      if (Array.isArray(res.resources) && res.resources.length) {
        resList.innerHTML = res.resources.map(r => `
          <a href="${escHtml(r.url)}" target="_blank" rel="noopener" class="live-resource-item">
            <span>📦 ${escHtml(r.title)}</span>
            <span style="font-weight:700;color:var(--gold,#d8a153);">Download ⬇</span>
          </a>
        `).join('');
      } else {
        resList.innerHTML = '<div class="muted" style="font-size:12.5px;">Practice files will be unlocked during the live stream.</div>';
      }
    }

    // Classroom Mode vs Stealth Webinar Mode: Viewer pill visibility
    const pill = document.getElementById('live-attendees-pill-mini');
    if (pill) {
      if (res.showViewerCountToStudents !== false) {
        pill.style.display = 'inline-flex';
        const count = (typeof res.viewerCount === 'number' && res.viewerCount > 10) ? res.viewerCount : (isReplay ? 747 : currentLiveAttendeesCount);
        updateLiveAttendeesDisplay(count, false);
      } else {
        pill.style.display = 'none';
      }
    }

    // Embed Video Stream with Anti-Leak Protection & Bunny Replay VOD Support
    embedLiveStream(res.streamId, res.replayUrl, res.status, res.bunnyVideoId, isReplay);

    // Start Live Doubts Polling
    pollLiveDoubtsStudent();
    if (liveDoubtsPollTimer) clearInterval(liveDoubtsPollTimer);
    liveDoubtsPollTimer = setInterval(pollLiveDoubtsStudent, 3500);

    // Start Real-Time Live Ping ONLY for LIVE broadcast (not for completed recordings)
    if (!isReplay) {
      if (livePingTimer) clearInterval(livePingTimer);
      sendStudentLivePing();
      livePingTimer = setInterval(sendStudentLivePing, 15000);
      try {
        if (typeof startLiveAttendeesCounter === 'function') {
          startLiveAttendeesCounter();
        }
      } catch (cntErr) {
        console.warn('Live counter init:', cntErr);
      }
    } else {
      if (livePingTimer) { clearInterval(livePingTimer); livePingTimer = null; }
      try {
        if (typeof stopLiveAttendeesCounter === 'function') {
          stopLiveAttendeesCounter();
        }
      } catch (_) {}
    }

    toast(isReplay ? `📼 Opened Recording: ${res.title}` : `🔴 Joined Live: ${res.title}`);
  } catch (err) {
    toast('Live access failed: ' + (err.message || 'Restricted'), false);
    exitLiveStudio();
  }
}

// Aliases for compatibility
function openLiveClassroom(classId) {
  openLiveStudio(classId);
}
function launchLiveSession(classId) {
  openLiveStudio(classId);
}
function openLiveClassPlayerById(classId) {
  openLiveStudio(classId);
}
function closeLiveClassroom() {
  exitLiveStudio();
}

function revealLiveOverlayControls(duration = 5000, isInitial = false) {
  const box = document.getElementById('live-video-box');
  if (!box) return;

  box.classList.add('show-controls');

  const startMask = document.getElementById('live-start-mask');
  if (startMask && isInitial) {
    startMask.classList.remove('faded');
  }

  if (isInitial) {
    window._isLiveInitialIntro = true;
  }

  if (liveOverlayHideTimeout) {
    clearTimeout(liveOverlayHideTimeout);
    liveOverlayHideTimeout = null;
  }

  liveOverlayHideTimeout = setTimeout(() => {
    window._isLiveInitialIntro = false;
    const drawer = document.getElementById('fs-chat-drawer');
    const isChatOpen = drawer && !drawer.classList.contains('hidden');
    if (!isChatOpen) {
      box.classList.remove('show-controls');
    }
    if (startMask) {
      startMask.classList.add('faded');
    }
  }, duration);
}

function hideLiveOverlayControls() {
  if (window._isLiveInitialIntro) return;
  const box = document.getElementById('live-video-box');
  if (!box) return;
  const drawer = document.getElementById('fs-chat-drawer');
  const isChatOpen = drawer && !drawer.classList.contains('hidden');
  if (!isChatOpen) {
    box.classList.remove('show-controls');
  }
}

window.handleProtectedPlayerClick = function(e) {
  if (e) {
    try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
  }
  toast('🔒 Quick Art Academy: Video classroom me hi chalega (External YouTube navigation restricted)');
};

function handleLiveShieldClick(e) {
  if (typeof window.unmuteLiveStream === 'function') {
    window.unmuteLiveStream();
  }
  revealLiveOverlayControls(5000);
}

let lastLiveShieldTouchTime = 0;
function handleLiveShieldTouch(e) {
  const now = Date.now();
  if (now - lastLiveShieldTouchTime < 320) {
    if (e && e.preventDefault) e.preventDefault();
    toggleLiveCinemaFullscreen();
    lastLiveShieldTouchTime = 0;
    return;
  }
  lastLiveShieldTouchTime = now;
  if (typeof window.unmuteLiveStream === 'function') {
    window.unmuteLiveStream();
  }
  revealLiveOverlayControls(5000);
}

function embedLiveStream(streamId, replayUrl, status, bunnyVideoId, isReplay = false) {
  const mount = document.getElementById('live-video-mount');
  const shield = document.getElementById('live-full-shield');
  const startMask = document.getElementById('live-start-mask');
  if (!mount) return;

  const session = (typeof currentLiveSession !== 'undefined') ? currentLiveSession : null;
  const isCompleted = isReplay || status === 'completed';

  // Toggle click shield: In LIVE mode shield prevents pausing and seeking. In COMPLETED replay mode, user has full playback controls!
  if (shield) {
    if (isCompleted) {
      shield.style.display = 'none';
      shield.style.pointerEvents = 'none';
    } else {
      shield.style.display = 'block';
      shield.style.pointerEvents = 'auto';
    }
  }

  // Live class has NO pause/play/seek controls. Recorded replays use native player controls!
  const liveBox = document.getElementById('live-video-box');
  if (liveBox) liveBox.classList.toggle('is-replay', isCompleted);
  const liveDock = document.getElementById('live-cinema-control-dock');
  if (liveDock) liveDock.style.display = 'none';
  const liveBottomDeck = document.getElementById('live-cinema-bottom-deck');
  if (liveBottomDeck) liveBottomDeck.style.display = 'none';

  if (startMask && isCompleted) {
    startMask.style.display = 'none';
  }

  // ── 0A. GOOGLE MEET 2-WAY LIVE CLASSROOM ──
  const meetUrl = (session && session.meetUrl) || (session && session.streamType === 'google_meet' ? (session.streamId || '') : '') || (streamId && streamId.includes('meet.google.com') ? streamId : '');
  if ((session && session.streamType === 'google_meet') || (meetUrl && meetUrl.includes('meet.google.com'))) {
    if (shield) { shield.style.display = 'none'; shield.style.pointerEvents = 'none'; }
    if (startMask) { startMask.style.display = 'none'; }
    if (liveBox) liveBox.classList.remove('is-zoom', 'yt-live', 'is-protected-stream');
    const exitBtn = document.getElementById('live-fs-exit-btn');
    if (exitBtn) exitBtn.remove();

    const studentName = (typeof currentStudent !== 'undefined' && currentStudent && currentStudent.name)
      ? currentStudent.name
      : (localStorage.getItem('qa_user_name') || localStorage.getItem('qaa_student_name') || 'Student');

    mount.innerHTML = `
      <div class="two-way-meeting-card meet-theme" style="width:100%;height:100%;min-height:430px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;box-sizing:border-box;background:radial-gradient(circle at top center, rgba(34,197,94,0.22), #060a14 75%);text-align:center;color:#fff;position:relative;overflow:hidden;border-radius:12px">
        <div style="width:68px;height:68px;border-radius:22px;background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.4);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:14px;box-shadow:0 8px 30px rgba(34,197,94,0.25)">
          🟢
        </div>
        <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#86efac;padding:5px 14px;border-radius:20px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);margin-bottom:12px;display:inline-flex;align-items:center;gap:6px">
          <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e"></span>
          2-Way Interactive Classroom Live
        </div>
        <h2 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 6px 0;max-width:540px;line-height:1.3">
          ${escapeHtml(session?.title || 'Interactive Live Doubt Session')}
        </h2>
        <div style="font-size:13px;color:#86efac;font-weight:600;margin-bottom:8px">
          Lead Mentor Anil Sharma • Quick Art Photography Academy
        </div>
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:4px 12px;border-radius:15px;font-size:12px;color:#cbd5e1;margin-bottom:18px">
          <span>👤 Student:</span>
          <strong style="color:#86efac">${escapeHtml(studentName)}</strong>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:440px;margin-bottom:14px">
          <a href="${escapeHtml(meetUrl)}" target="_blank" rel="noopener noreferrer" style="background:linear-gradient(135deg, #22c55e 0%, #16a34a 100%);color:#fff;font-size:16px;font-weight:800;padding:16px 36px;border-radius:14px;display:inline-flex;align-items:center;gap:12px;text-decoration:none;box-shadow:0 12px 35px rgba(34,197,94,0.45);border:1px solid rgba(134,239,172,0.4);cursor:pointer;max-width:92%">
            <span style="font-size:22px">🚀</span>
            <span style="display:flex;flex-direction:column;align-items:flex-start;text-align:left">
              <span style="font-size:16px;font-weight:800;line-height:1.2">Click Karke Google Meet Join Karein</span>
              <span style="font-size:11.5px;font-weight:500;color:#dcfce7;line-height:1.3">⚡ Zero Form: Meeting code ya password kuch nahi dalna padega</span>
            </span>
            <span style="font-size:20px;margin-left:4px">➔</span>
          </a>
        </div>

        <div style="font-size:12px;color:#94a3b8;margin-bottom:14px;max-width:460px;line-height:1.5">
          ✓ <strong>Instant 1-Click Entry:</strong> Button click karte hi Google Meet app ya browser me direct class connect ho jayegi. Mic aur screen share dono active hain.
        </div>

        <div style="margin-bottom:14px">
          <button type="button" onclick="copyText('${escapeHtml(meetUrl)}', 'Google Meet Link')" style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);color:#86efac;font-size:12px;font-weight:600;padding:6px 16px;border-radius:20px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <span>📋 Copy Meet Link</span>
          </button>
        </div>

        <div style="display:flex;gap:16px;font-size:11.5px;color:#94a3b8;flex-wrap:wrap;justify-content:center">
          <span>🎤 Mic Unmute</span>
          <span>•</span>
          <span>🖥️ Student Screen Share</span>
          <span>•</span>
          <span>⚡ 100% Free &amp; Instant Join</span>
        </div>
      </div>
    `;

    // Stream toolbar for Google Meet
    const streamBar = document.querySelector('.live-stream-bar');
    if (streamBar) {
      streamBar.style.display = 'flex';
      streamBar.className = 'live-stream-bar meet-classroom-bar';
      streamBar.innerHTML = `
        <div class="live-stream-status" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="live-broadcast-badge" style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.45);color:#86efac;padding:5px 12px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:0.5px">
            <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e"></span>
            <span>GOOGLE MEET LIVE</span>
          </span>
        </div>
        <div class="live-stream-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <a href="${escapeHtml(meetUrl)}" target="_blank" rel="noopener noreferrer" class="live-btn-fs-preview" style="text-decoration:none;background:linear-gradient(135deg, #22c55e, #16a34a);color:#fff;display:inline-flex;align-items:center;gap:6px;font-weight:800;padding:9px 18px;border-radius:9px" title="Join Google Meet">
            <span style="font-size:15px">🚀</span>
            <span>Join Google Meet (1-Click)</span>
          </a>
          <button type="button" class="live-icon-btn" onclick="handleCommentButtonClick()" title="Live Doubts &amp; Comments" aria-label="Doubts" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;width:36px;height:36px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </button>
        </div>
      `;
    }
    return;
  }

  // ── 0B. ZOOM CLASS: joins inside the website via Zoom Meeting SDK ──
  // Meeting ID / passcode / link never reach this page's UI; the server hands a signed
  // join token only after it has checked the student's enrollment (see qaJoinZoomClass).
  const isZoomSession = !!(session && (session.isZoom || session.streamType === 'zoom'));

  if (isZoomSession) {
    if (shield) { shield.style.display = 'none'; shield.style.pointerEvents = 'none'; }
    if (startMask) { startMask.style.display = 'none'; }
    ['live-center-pause-cue', 'live-cinema-control-dock', 'live-cinema-bottom-deck', 'watermark-overlay'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    document.getElementById('live-watermark-text')?.remove();
    document.getElementById('live-watermark-layer')?.remove();
    if (liveBox) liveBox.classList.add('is-zoom');

    const zEsc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const sessionTitle = (session && session.title) || 'Live Class';
    window._qaZoomSession = session;

    mount.innerHTML = `
      <div class="qa-zoom-stage" style="position:relative;width:100%;height:100%;min-height:440px;background:radial-gradient(circle at center,#0f1c3f 0%,#060a14 100%);display:flex;align-items:center;justify-content:center;overflow:hidden">
        <div id="qa-zoom-root" style="position:absolute;inset:0;display:none"></div>
        <div id="qa-zoom-panel" style="text-align:center;padding:28px;max-width:520px">
          <div style="font-size:42px;margin-bottom:10px">🎥</div>
          <div style="font-size:12px;letter-spacing:.16em;color:#93c5fd;font-weight:700;text-transform:uppercase">Live Zoom Class</div>
          <h3 style="color:#fff;font-size:20px;margin:8px 0 6px">${zEsc(sessionTitle)}</h3>
          <p style="color:#94a3b8;font-size:13.5px;line-height:1.6;margin:0 0 18px">Join dabate hi class isi page par khul jayegi — koi Meeting ID ya Passcode daalne ki zaroorat nahi.</p>
          <button type="button" id="btn-qa-zoom-join" onclick="qaJoinZoomClass()" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:0;border-radius:12px;padding:14px 26px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(37,99,235,.4)">▶ Join Class</button>
          <div id="qa-zoom-status" style="margin-top:12px;color:#cbd5e1;font-size:13px;min-height:18px"></div>
        </div>
      </div>`;

    const streamBar = document.querySelector('.live-stream-bar');
    if (streamBar) {
      streamBar.style.display = 'flex';
      streamBar.className = 'live-stream-bar zoom-classroom-bar';
      streamBar.innerHTML = `
        <div class="live-stream-status" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="live-broadcast-badge" style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.45);color:#fca5a5;padding:5px 12px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700">
            <span class="live-blink-circle" style="width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444"></span>
            <span>LIVE CLASSROOM</span>
          </span>
        </div>
        <div class="live-stream-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="live-btn-fs-preview" onclick="qaZoomToggleFullscreen()" title="Full Screen" aria-label="Full Screen">⛶ <span>Full Screen</span></button>
          <button type="button" class="live-icon-btn" onclick="handleCommentButtonClick()" title="Live Doubts &amp; Comments" aria-label="Doubts" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:10px;padding:8px 10px;cursor:pointer">💬</button>
        </div>`;
    }
    return;
  } else {
    if (liveBox) liveBox.classList.remove('is-zoom');
    const exitBtn = document.getElementById('live-fs-exit-btn');
    if (exitBtn) exitBtn.remove();
    const streamBar = document.querySelector('.live-stream-bar');
    if (streamBar) {
      streamBar.classList.remove('zoom-classroom-bar');
      streamBar.style.display = '';
    }
  }

  // 1. CHECK FOR CLOUDFLARE STREAM (BOTH LIVE & REPLAY • 100% PRIVATE • ZERO YOUTUBE)
  const isCfSession = (session && session.streamType === 'cloudflare') ||
                      (session && session.cloudflareVideoId) ||
                      (streamId && (streamId.includes('videodelivery.net') || streamId.includes('cloudflarestream.com') || /^[a-zA-Z0-9]{32}$/.test(streamId))) ||
                      (replayUrl && (replayUrl.includes('videodelivery.net') || replayUrl.includes('cloudflarestream.com')));

  if (isCfSession) {
    if (shield) {
      shield.style.display = 'none';
      shield.style.pointerEvents = 'none';
    }
    if (startMask) {
      startMask.style.display = 'none';
    }

    let cfUid = (session && session.cloudflareVideoId) ? session.cloudflareVideoId : (streamId || replayUrl || '');
    const mCf = (cfUid || '').match(/videodelivery\.net\/([a-zA-Z0-9]{32})/i) || (cfUid || '').match(/cloudflarestream\.com\/([a-zA-Z0-9]{32})/i);
    if (mCf) cfUid = mCf[1];
    cfUid = (cfUid || '').trim();

    const cfEmbedUrl = `https://iframe.videodelivery.net/${encodeURIComponent(cfUid)}?autoplay=true&preload=true&responsive=true&controls=true`;
    mount.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#000;">
        <button type="button" class="live-zoom-float-fs-btn" onclick="toggleLiveCinemaFullscreen()" title="Full Screen Preview (Press F)" aria-label="Full Screen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          <span>Full Screen</span>
        </button>
        <iframe 
          id="live-stream-iframe"
          src="${cfEmbedUrl}" 
          loading="lazy" 
          style="border:0;width:100%;height:100%;pointer-events:auto !important;" 
          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen" 
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true">
        </iframe>
      </div>
    `;
    renderStandardStreamBar(isCompleted);
    return;
  }

  // 2. CHECK FOR BUNNY.NET STREAM (BOTH LIVE & REPLAY • ZERO YOUTUBE)
  let bunnyUrl = '';
  const isBunnySession = (session && session.streamType === 'bunny') || 
                         (bunnyVideoId && /^[a-zA-Z0-9_-]{36}$/.test(bunnyVideoId)) ||
                         (streamId && (streamId.includes('iframe.mediadelivery.net') || streamId.includes('video.bunnycdn.com') || /^[a-zA-Z0-9_-]{36}$/.test(streamId))) ||
                         (replayUrl && (replayUrl.includes('iframe.mediadelivery.net') || replayUrl.includes('video.bunnycdn.com')));

  if (isBunnySession) {
    if (shield) {
      shield.style.display = 'none';
      shield.style.pointerEvents = 'none';
    }
    if (startMask) {
      startMask.style.display = 'none';
    }

    if (replayUrl && (replayUrl.includes('iframe.mediadelivery.net') || replayUrl.includes('video.bunnycdn.com'))) {
      bunnyUrl = replayUrl;
    } else if (bunnyVideoId && /^[a-zA-Z0-9_-]{36}$/.test(bunnyVideoId)) {
      bunnyUrl = `https://iframe.mediadelivery.net/embed/755385/${encodeURIComponent(bunnyVideoId)}?autoplay=true&preload=true&responsive=true`;
    } else if (streamId && (streamId.includes('iframe.mediadelivery.net') || streamId.includes('video.bunnycdn.com'))) {
      bunnyUrl = streamId;
    } else if (streamId && /^[a-zA-Z0-9_-]{36}$/.test(streamId)) {
      bunnyUrl = `https://iframe.mediadelivery.net/embed/755385/${encodeURIComponent(streamId)}?autoplay=true&preload=true&responsive=true`;
    } else if (replayUrl && /^[a-zA-Z0-9_-]{36}$/.test(replayUrl)) {
      bunnyUrl = `https://iframe.mediadelivery.net/embed/755385/${encodeURIComponent(replayUrl)}?autoplay=true&preload=true&responsive=true`;
    }

    if (bunnyUrl) {
      mount.innerHTML = `
        <div style="position:relative;width:100%;height:100%;background:#000;">
          <button type="button" class="live-zoom-float-fs-btn" onclick="toggleLiveCinemaFullscreen()" title="Full Screen Preview (Press F)" aria-label="Full Screen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
            <span>Full Screen</span>
          </button>
          <iframe 
            id="live-stream-iframe"
            src="${bunnyUrl}" 
            loading="lazy" 
            style="border:0;width:100%;height:100%;pointer-events:auto !important;" 
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen" 
            allowfullscreen="true"
            webkitallowfullscreen="true"
            mozallowfullscreen="true">
          </iframe>
        </div>
      `;
      renderStandardStreamBar(isCompleted);
      return;
    }
  }

  // LIVE OR YOUTUBE STREAM
  let rawId = streamId;
  if (isCompleted && replayUrl) {
    rawId = replayUrl;
  }

  const videoId = cleanYouTubeVideoId(rawId);

  if (!videoId) {
    const isRtmp = rawId && (rawId.startsWith('rtmp://') || rawId.startsWith('rtmps://'));
    mount.innerHTML = `
      <div class="live-placeholder">
        <div style="font-size:36px;margin-bottom:12px;">${isRtmp ? '⚠️' : '⏳'}</div>
        <div style="font-weight:700;font-size:16px;color:#fff;">${isRtmp ? 'RTMP Server URL Detected' : 'Stream Starting Soon'}</div>
        <div class="muted" style="font-size:13px;margin-top:6px;max-width:480px;line-height:1.5;">
          ${isRtmp 
            ? 'Admin Panel me OBS ka RTMP Server link daala gaya hai. Web browser me live stream dekhne ke liye YouTube Studio me jakar Live Video ka Watch Link (jaise https://youtube.com/live/xxxx ya Video ID) daalna zaroori hai.' 
            : 'Mentor Anil Sharma will start broadcasting shortly. Please stay on this screen.'}
        </div>
      </div>
    `;
    renderStandardStreamBar(isCompleted);
    return;
  }

  const originStr = encodeURIComponent(window.location.origin);
  if (liveBox) {
    liveBox.classList.remove('is-zoom');
    liveBox.classList.add('yt-live', 'is-protected-stream');
  }

  if (isCompleted) {
    // Replay Mode: Controls enabled, seekbar active, pause/play enabled, keyboard seek enabled, fullscreen enabled
    const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1&enablejsapi=1&fs=0&origin=${originStr}&widget_referrer=${originStr}`;
    mount.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#000;overflow:hidden;" oncontextmenu="return false;" ondragstart="return false;">
        <!-- YouTube Anti-Leak Shields (Prevents navigating away to YouTube.com) -->
        <div class="live-yt-shield-top" onclick="revealLiveOverlayControls(4000)" title="Quick Art Photography Academy Protected Classroom"></div>
        <div class="live-yt-shield-logo" onclick="handleProtectedPlayerClick(event)" title="Quick Art Photography Academy Protected Classroom"></div>

        <!-- 5-Second Zero-Leak Connection Curtain: Covers YouTube bootstrap so no YouTube logo is seen -->
        <div class="live-curtain-loader" id="live-curtain-loader">
          <div class="live-curtain-spinner-ring"></div>
          <div class="live-curtain-text">
            <span class="live-curtain-title">Now Loading...</span>
            <span class="live-curtain-sub">Connecting To Secure Live Classroom</span>
          </div>
          <div class="live-curtain-progress-track">
            <div class="live-curtain-progress-bar"></div>
          </div>
        </div>

        <iframe 
          id="live-stream-iframe"
          src="${embedUrl}" 
          title="Quick Art Photography Academy Masterclass Replay" 
          frameborder="0" 
          style="width:100%;height:100%;border:none;pointer-events:auto !important;"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; display-capture" 
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true">
        </iframe>
      </div>
    `;
    renderStandardStreamBar(true);
    startLiveZeroLeakCurtain();
  } else {
    // Pure Live Mode: 100% Autoplay with mobile-safe mute + instant touch-to-unmute
    const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1&enablejsapi=1&fs=0&origin=${originStr}&widget_referrer=${originStr}`;
    mount.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#000;overflow:hidden;" oncontextmenu="return false;" ondragstart="return false;">
        <!-- YouTube Anti-Leak Shields (Prevents navigating away to YouTube.com) -->
        <div class="live-yt-shield-top" onclick="revealLiveOverlayControls(4000)" title="Quick Art Photography Academy Protected Classroom"></div>
        <div class="live-yt-shield-logo" onclick="handleProtectedPlayerClick(event)" title="Quick Art Photography Academy Protected Classroom"></div>

        <!-- 5-Second Zero-Leak Connection Curtain: Covers YouTube bootstrap so no YouTube logo is seen -->
        <div class="live-curtain-loader" id="live-curtain-loader">
          <div class="live-curtain-spinner-ring"></div>
          <div class="live-curtain-text">
            <span class="live-curtain-title">Now Loading...</span>
            <span class="live-curtain-sub">Connecting To Secure Live Classroom</span>
          </div>
          <div class="live-curtain-progress-track">
            <div class="live-curtain-progress-bar"></div>
          </div>
        </div>

        <iframe 
          id="live-stream-iframe"
          src="${embedUrl}" 
          title="Quick Art Photography Academy Live Stream" 
          frameborder="0" 
          style="width:100%;height:100%;border:none;pointer-events:none !important;"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; display-capture" 
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true">
        </iframe>
        <!-- Floating Sound Helper Badge on Mobile -->
        <button id="live-unmute-tap-badge" type="button" onclick="unmuteLiveStream()" style="position:absolute;bottom:16px;left:16px;z-index:20;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:8px 16px;border-radius:30px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.6);font-family:inherit">
          <span>🔊</span>
          <span>Awaaz Kholein (Tap For Sound)</span>
        </button>
      </div>
    `;

    renderStandardStreamBar(false);
    startLiveZeroLeakCurtain();

    // Global gesture listener: On mobile, student's first tap anywhere un-mutes automatically
    const autoUnmuteOnFirstTouch = () => {
      if (typeof window.unmuteLiveStream === 'function') window.unmuteLiveStream();
      window.removeEventListener('touchstart', autoUnmuteOnFirstTouch, { capture: true });
      window.removeEventListener('click', autoUnmuteOnFirstTouch, { capture: true });
    };
    window.addEventListener('touchstart', autoUnmuteOnFirstTouch, { capture: true, once: true });
    window.addEventListener('click', autoUnmuteOnFirstTouch, { capture: true, once: true });

    // Also attempt un-mute after 1.5s in case browser policy permits
    setTimeout(() => {
      try {
        const iframe = document.getElementById('live-stream-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
        }
      } catch (e) {}
    }, 1500);

    revealLiveOverlayControls(6500, true);
  }
}

function renderStandardStreamBar(isCompletedSession = false) {
  const streamBar = document.querySelector('.live-stream-bar');
  if (!streamBar) return;
  streamBar.style.display = 'flex';
  streamBar.className = 'live-stream-bar';
  streamBar.innerHTML = `
    <div class="live-stream-status">
      <span class="live-broadcast-badge ${isCompletedSession ? 'is-recorded' : ''}">
        ${isCompletedSession ? '<span>📼</span>' : '<span class="live-blink-circle"></span>'}
        <span>${isCompletedSession ? 'RECORDED' : 'LIVE'}</span>
      </span>
      <span class="live-watching-badge" id="live-attendees-pill-mini">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span id="live-viewer-count-mini" class="attendees-num">${typeof currentLiveAttendeesCount === 'number' ? currentLiveAttendeesCount : 420}</span>
        <span class="watching-word">Watching</span>
      </span>
    </div>

    <div class="live-stream-actions">
      <button type="button" class="live-btn-fs-preview" onclick="toggleLiveCinemaFullscreen()" title="Full Screen (Press F)" aria-label="Full Screen">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span>Full Screen</span>
      </button>

      <button type="button" class="live-btn-chat-toggle" onclick="handleCommentButtonClick()" title="Live Doubts &amp; Comments" aria-label="Live Doubts">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span>Live Doubts</span>
      </button>

      ${!isCompletedSession ? `
        <button type="button" class="live-icon-btn" id="live-sound-btn" onclick="toggleLiveAudioMute()" title="Audio Mute/Unmute" aria-label="Audio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
}

function startLiveZeroLeakCurtain() {
  setTimeout(() => {
    const curtain = document.getElementById('live-curtain-loader');
    if (curtain) {
      curtain.classList.add('fade-out');
      setTimeout(() => {
        try { curtain.remove(); } catch (_) {}
      }, 650);
    }
  }, 8000);
}

window.unmuteLiveStream = function() {
  const iframe = document.getElementById('live-stream-iframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute' }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
    } catch (e) {}
  }
  const badge = document.getElementById('live-unmute-tap-badge');
  if (badge) {
    badge.style.opacity = '0';
    badge.style.pointerEvents = 'none';
    setTimeout(() => badge.remove(), 300);
  }
};

window._isAppLiveEndedActive = false;

function handleAppLiveBroadcastEnded() {
  if (window._isAppLiveEndedActive) return;
  window._isAppLiveEndedActive = true;

  if (typeof livePingTimer !== 'undefined' && livePingTimer) { clearInterval(livePingTimer); livePingTimer = null; }
  if (typeof liveDoubtsPollTimer !== 'undefined' && liveDoubtsPollTimer) { clearInterval(liveDoubtsPollTimer); liveDoubtsPollTimer = null; }

  const iframe = document.getElementById('live-stream-iframe');
  if (iframe) {
    try {
      iframe.src = 'about:blank';
      iframe.style.display = 'none';
    } catch (_) {}
  }
  const video = document.getElementById('main-video-el');
  if (video) {
    try { video.pause(); } catch (_) {}
  }

  const mount = document.getElementById('live-video-mount');
  const box = document.getElementById('live-video-box');
  const targetContainer = mount || box;

  if (targetContainer) {
    let curtain = document.getElementById('live-ended-curtain');
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'live-ended-curtain';
      curtain.className = 'live-ended-curtain active';
      targetContainer.appendChild(curtain);
    } else {
      curtain.classList.add('active');
    }

    let countdown = 4;
    curtain.innerHTML = `
      <div class="live-ended-card">
        <div class="live-ended-badge">
          <span>🔴 BROADCAST ENDED</span>
        </div>
        <h2 class="live-ended-title">Live Class Has Ended</h2>
        <p class="live-ended-desc">
          Session END — Thank you for watching and participating! Recording jald hi Replay section me upload kar di jayegi.
        </p>
        <div class="live-ended-countdown">
          Redirecting to My Courses in <span id="live-ended-seconds">${countdown}</span>s...
        </div>
        <button type="button" class="live-ended-btn" onclick="redirectAfterAppLiveEnd()">
          📚 Go to My Courses Now ➔
        </button>
      </div>
    `;

    const timer = setInterval(() => {
      countdown--;
      const secEl = document.getElementById('live-ended-seconds');
      if (secEl) secEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(timer);
        redirectAfterAppLiveEnd();
      }
    }, 1000);
  } else {
    redirectAfterAppLiveEnd();
  }
}

function redirectAfterAppLiveEnd() {
  window._isAppLiveEndedActive = false;
  const curtain = document.getElementById('live-ended-curtain');
  if (curtain) curtain.remove();
  closeLiveStudio();
  switchTab('courses');
  toast('📚 Returned to My Courses');
}

// Zero-Pause Continuous Broadcast Guard & Live Ended Detection:
window.addEventListener('message', (event) => {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && data.event === 'onStateChange') {
      if (data.info === 1) {
        revealLiveOverlayControls(4200, true);
      } else if (data.info === 2) {
        // ONLY force-play in pure LIVE mode! If it is a recorded class/replay, allow student to pause freely!
        if (!window._isCurrentReplaySession && currentLiveSession && currentLiveSession.status === 'live') {
          const liveStudio = document.getElementById('view-live-classroom');
          if (liveStudio && !liveStudio.classList.contains('hidden')) {
            const iframe = document.getElementById('live-stream-iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
            }
          }
        }
      } else if (data.info === 0) {
        // YouTube State 0 = ENDED: Trigger instant black curtain & auto redirect
        if (!window._isCurrentReplaySession) {
          handleAppLiveBroadcastEnded();
        }
      }
    }
  } catch (e) {}
});

// Anti-Download & Security Protection for mobile app
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.closest && e.target.closest('#zmmtg-root')) return; // keys inside the Zoom classroom belong to Zoom
  if ((e.ctrlKey || e.metaKey) && ['s', 'S', 'u', 'U', 'p', 'P'].includes(e.key)) {
    const inClassroom = document.getElementById('view-classroom') && !document.getElementById('view-classroom').classList.contains('hidden');
    const inLive = document.getElementById('view-live-classroom') && !document.getElementById('view-live-classroom').classList.contains('hidden');
    if (inClassroom || inLive) {
      e.preventDefault();
      e.stopPropagation();
      toast('🔒 Video download is restricted by Quick Art Photography Academy');
      return false;
    }
  }
}, { capture: true });

document.addEventListener('contextmenu', (e) => {
  if (e.target && (e.target.tagName === 'VIDEO' || e.target.closest('#cr-video-box') || e.target.closest('#live-video-box') || e.target.closest('#cr-video-mount') || e.target.closest('#live-video-mount'))) {
    e.preventDefault();
    return false;
  }
}, { capture: true });

// Dedicated Replay Controls (⏪ 10s Backward, ⏯️ Pause/Play, ⏩ 10s Forward, Speed)
let liveReplayCurrentEstTime = 0;
let liveReplayIsPlaying = true;

function seekLiveReplay(deltaSeconds) {
  const iframe = document.getElementById('live-stream-iframe');
  const mount = document.getElementById('live-video-mount');
  const vid = mount ? mount.querySelector('video') : null;

  if (vid) {
    vid.currentTime = Math.max(0, vid.currentTime + deltaSeconds);
    toast(deltaSeconds < 0 ? `⏪ ${Math.abs(deltaSeconds)}s Pichhe` : `⏩ ${deltaSeconds}s Aage`);
    return;
  }

  if (iframe && iframe.contentWindow) {
    liveReplayCurrentEstTime = Math.max(0, liveReplayCurrentEstTime + deltaSeconds);
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'seekTo',
      args: [liveReplayCurrentEstTime, true]
    }), '*');
    toast(deltaSeconds < 0 ? `⏪ ${Math.abs(deltaSeconds)}s Pichhe` : `⏩ ${deltaSeconds}s Aage`);
  }
}

function toggleLiveReplayPlayPause() {
  const iframe = document.getElementById('live-stream-iframe');
  const mount = document.getElementById('live-video-mount');
  const vid = mount ? mount.querySelector('video') : null;
  const btn = document.getElementById('btn-replay-play-pause');

  if (vid) {
    if (vid.paused) {
      vid.play();
      if (btn) btn.innerHTML = '⏸️';
      toast('▶ Playing');
    } else {
      vid.pause();
      if (btn) btn.innerHTML = '▶';
      toast('⏸ Paused');
    }
    return;
  }

  if (iframe && iframe.contentWindow) {
    if (liveReplayIsPlaying) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
      liveReplayIsPlaying = false;
      if (btn) btn.innerHTML = '▶';
      toast('⏸ Paused');
    } else {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
      liveReplayIsPlaying = true;
      if (btn) btn.innerHTML = '⏸️';
      toast('▶ Playing');
    }
  }
}

function setLiveReplaySpeed(rate) {
  const speed = parseFloat(rate) || 1;
  const iframe = document.getElementById('live-stream-iframe');
  const mount = document.getElementById('live-video-mount');
  const vid = mount ? mount.querySelector('video') : null;

  if (vid) vid.playbackRate = speed;
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'setPlaybackRate',
      args: [speed]
    }), '*');
  }
  toast(`⚡ Speed: ${speed}x`);
}

// Course Lesson Video Controls (⏪ 10s, ⏯️ Pause/Play, ⏩ 10s)
let lessonVideoEstTime = 0;
let lessonVideoIsPlaying = true;

function seekLessonVideo(deltaSeconds) {
  const vid = document.getElementById('main-video-el');
  const iframe = document.getElementById('cr-video-iframe');

  if (vid) {
    vid.currentTime = Math.max(0, vid.currentTime + deltaSeconds);
    toast(deltaSeconds < 0 ? `⏪ ${Math.abs(deltaSeconds)}s Pichhe` : `⏩ ${deltaSeconds}s Aage`);
    return;
  }

  if (iframe && iframe.contentWindow) {
    lessonVideoEstTime = Math.max(0, lessonVideoEstTime + deltaSeconds);
    // YouTube
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'seekTo',
      args: [lessonVideoEstTime, true]
    }), '*');
    // Bunny.net
    iframe.contentWindow.postMessage(JSON.stringify({
      method: 'setCurrentTime',
      value: lessonVideoEstTime
    }), '*');
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'setCurrentTime',
      time: lessonVideoEstTime
    }), '*');
    toast(deltaSeconds < 0 ? `⏪ ${Math.abs(deltaSeconds)}s Pichhe` : `⏩ ${deltaSeconds}s Aage`);
  }
}

function togglePlayPauseLessonVideo() {
  const vid = document.getElementById('main-video-el');
  const iframe = document.getElementById('cr-video-iframe');
  const btn = document.getElementById('btn-lesson-play-pause');

  if (vid) {
    if (vid.paused) {
      vid.play();
      if (btn) btn.innerHTML = '⏸️';
      toast('▶ Playing');
    } else {
      vid.pause();
      if (btn) btn.innerHTML = '▶';
      toast('⏸ Paused');
    }
    return;
  }

  if (iframe && iframe.contentWindow) {
    if (lessonVideoIsPlaying) {
      // YouTube
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
      // Bunny.net
      iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'pause' }), '*');
      lessonVideoIsPlaying = false;
      if (btn) btn.innerHTML = '▶';
      toast('⏸ Paused');
    } else {
      // YouTube
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
      // Bunny.net
      iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'play' }), '*');
      lessonVideoIsPlaying = true;
      if (btn) btn.innerHTML = '⏸️';
      toast('▶ Playing');
    }
  }
}

function setLessonVideoSpeed(speed) {
  const rate = parseFloat(speed) || 1;
  const vid = document.getElementById('main-video-el');
  const iframe = document.getElementById('cr-video-iframe');

  if (vid) {
    vid.playbackRate = rate;
  }
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [rate] }), '*');
    iframe.contentWindow.postMessage(JSON.stringify({ method: 'setPlaybackRate', value: rate }), '*');
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'setPlaybackRate', rate: rate }), '*');
  }
  toast(`⚡ Speed: ${rate}x`);
}

function toggleLiveAudioMute() {
  const iframe = document.getElementById('live-stream-iframe');
  if (!iframe || !iframe.contentWindow) return;
  const soundBtn = document.getElementById('live-sound-btn');
  const isMuted = soundBtn && soundBtn.getAttribute('data-muted') === '1';

  if (isMuted) {
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute' }), '*');
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
    if (soundBtn) {
      soundBtn.setAttribute('data-muted', '0');
      soundBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
      soundBtn.title = "Mute Audio";
    }
    toast('🔊 Audio unmuted');
  } else {
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute' }), '*');
    if (soundBtn) {
      soundBtn.setAttribute('data-muted', '1');
      soundBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      `;
      soundBtn.title = "Unmute Audio";
    }
    toast('🔇 Audio muted');
  }
}

function handleCommentButtonClick() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  if (isFullscreen) {
    toggleFullscreenChatDrawer();
  } else {
    const chatCard = document.querySelector('.live-chat-card');
    const doubtInp = document.getElementById('live-doubt-input');
    if (chatCard) {
      chatCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (doubtInp) doubtInp.focus();
    } else {
      toggleFullscreenChatDrawer();
    }
  }
}

function toggleFullscreenChatDrawer() {
  const drawer = document.getElementById('fs-chat-drawer');
  if (!drawer) return;
  const isHidden = drawer.classList.contains('hidden');
  if (isHidden) {
    drawer.classList.remove('hidden');
    revealLiveOverlayControls();
    const msgBox = document.getElementById('fs-live-chat-messages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    const inp = document.getElementById('fs-live-doubt-input');
    if (inp) inp.focus();
  } else {
    drawer.classList.add('hidden');
    revealLiveOverlayControls();
  }
}

async function sendLiveDoubtFullscreen() {
  if (!currentLiveSession || !currentLiveSession.id) return;
  const input = document.getElementById('fs-live-doubt-input');
  const btn = document.getElementById('btn-fs-live-send');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;

  input.value = '';
  if (btn) btn.disabled = true;

  try {
    await apiFetch('send-live-doubt', {
      method: 'POST',
      body: { liveId: currentLiveSession.id, message: msg }
    });
    pollLiveDoubtsStudent();
    toast('✓ Question sent to Mentor');
  } catch (err) {
    toast(err.message, false);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function isLiveFullscreenActive() {
  const box = document.getElementById('live-video-box');
  const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  const isCss = box ? box.classList.contains('is-fullscreen') : false;
  return isNative || isCss;
}

function toggleLiveCinemaFullscreen() {
  // Zoom classroom lives outside the live box: full-screen the whole page instead
  const zBox = document.getElementById('live-video-box');
  if (window._qaZoomSession && ((zBox && zBox.classList.contains('is-zoom')) || document.getElementById('zmmtg-root'))) {
    window.qaZoomToggleFullscreen();
    return;
  }
  const box = document.getElementById('live-video-box');
  const iframe = document.getElementById('live-stream-iframe');
  if (!box) return;

  // Ensure Floating Exit Fullscreen Button exists inside video box for all stream types (YouTube, Meet, Zoom)
  let exitBtn = document.getElementById('live-fs-exit-btn');
  if (!exitBtn) {
    exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.id = 'live-fs-exit-btn';
    exitBtn.className = 'live-fs-exit-btn';
    exitBtn.setAttribute('title', 'Exit Fullscreen (Esc / Press F)');
    exitBtn.setAttribute('aria-label', 'Exit Fullscreen');
    exitBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="live-fs-exit-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="live-fs-exit-word">Exit</span><span class="live-fs-exit-desktop-text">&nbsp;Full Screen</span>`;
    exitBtn.onclick = function(e) {
      e.stopPropagation();
      toggleLiveCinemaFullscreen();
    };
    box.appendChild(exitBtn);
  }

  const isFs = isLiveFullscreenActive();

  if (!isFs) {
    // 1. Immediately activate CSS Fullscreen (works on 100% of devices: iOS Safari, Android Webview, Desktop)
    box.classList.add('is-fullscreen');
    document.body.classList.add('live-fs-open');

    // 2. Also invoke native fullscreen API on container or iframe
    const targetEl = box;
    try {
      const p = targetEl.requestFullscreen
        ? targetEl.requestFullscreen()
        : (targetEl.webkitRequestFullscreen
          ? targetEl.webkitRequestFullscreen()
          : (targetEl.mozRequestFullScreen
            ? targetEl.mozRequestFullScreen()
            : (targetEl.msRequestFullscreen
              ? targetEl.msRequestFullscreen()
              : null)));
      if (p && p.catch) {
        p.catch(() => {
          // If container requestFullscreen fails or is blocked, try direct iframe fullscreen
          if (iframe) {
            try {
              if (iframe.requestFullscreen) iframe.requestFullscreen().catch(() => {});
              else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
            } catch (_) {}
          }
        });
      }
    } catch (_) {}

    // 3. For mobile / tablet: lock to landscape orientation for cinema view if supported
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) {}

    revealLiveOverlayControls(4000);
  } else {
    // Exit fullscreen
    box.classList.remove('is-fullscreen');
    document.body.classList.remove('live-fs-open');

    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch (_) {}

    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (_) {}
  }

  updateLiveFullscreenUI();
}

function updateLiveFullscreenUI() {
  const isFs = isLiveFullscreenActive();

  const fsPreviewBtn = document.querySelector('.live-btn-fs-preview');
  if (fsPreviewBtn) {
    if (isFs) {
      fsPreviewBtn.classList.add('active-fs');
      fsPreviewBtn.style.background = 'rgba(220,38,38,0.92)';
      fsPreviewBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg><span>Exit Full Screen</span>`;
    } else {
      fsPreviewBtn.classList.remove('active-fs');
      fsPreviewBtn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
      fsPreviewBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg><span>Full Screen</span>`;
    }
  }

  const btns = document.querySelectorAll('.live-fs-btn');
  btns.forEach(btn => {
    if (btn.classList.contains('live-video-overlay-fs')) {
      btn.innerHTML = isFs ? '✕' : '⛶';
      btn.title = isFs ? 'Exit Fullscreen (Esc / Press F)' : 'Fullscreen Mode (Press F)';
      if (isFs) btn.classList.add('active-fs');
      else btn.classList.remove('active-fs');
    } else if (btn.classList.contains('live-icon-btn')) {
      btn.title = isFs ? 'Exit Fullscreen (Esc / Press F)' : 'Fullscreen Mode (Press F)';
      if (isFs) {
        btn.classList.add('active-fs');
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>`;
      } else {
        btn.classList.remove('active-fs');
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
      }
    } else {
      btn.innerHTML = isFs ? '<span>⤶</span> Exit Fullscreen' : '<span>⛶</span> Fullscreen';
      if (isFs) btn.classList.add('active-fs');
      else btn.classList.remove('active-fs');
    }
  });
}

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
  document.addEventListener(evt, () => {
    const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const box = document.getElementById('live-video-box');
    if (!isNative && box) {
      box.classList.remove('is-fullscreen');
      document.body.classList.remove('live-fs-open');
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      } catch (_) {}
    } else if (isNative && box) {
      box.classList.add('is-fullscreen');
      document.body.classList.add('live-fs-open');
    }
    updateLiveFullscreenUI();
  });
});

function initOrganicLiveAttendees() {
  if (typeof startLiveAttendeesCounter === 'function') startLiveAttendeesCounter();
}
window.initOrganicLiveAttendees = initOrganicLiveAttendees;

function startLiveAttendeesCounter() {
  stopLiveAttendeesCounter();
  try {
    const saved = parseInt(sessionStorage.getItem('qa_live_attendees'), 10);
    if (saved && saved >= 300 && saved <= 800) {
      currentLiveAttendeesCount = saved;
    } else {
      currentLiveAttendeesCount = Math.floor(Math.random() * (530 - 380 + 1)) + 380;
    }
  } catch (e) {
    currentLiveAttendeesCount = Math.floor(Math.random() * (530 - 380 + 1)) + 380;
  }

  updateLiveAttendeesDisplay(currentLiveAttendeesCount, false);
  scheduleNextAttendeeFluctuation();
}

function scheduleNextAttendeeFluctuation() {
  if (liveAttendeesTimer) clearTimeout(liveAttendeesTimer);
  const nextDelayMs = Math.floor(Math.random() * 3800) + 4000;
  liveAttendeesTimer = setTimeout(() => {
    fluctuateLiveAttendees();
    scheduleNextAttendeeFluctuation();
  }, nextDelayMs);
}

function fluctuateLiveAttendees() {
  let delta = 0;
  const rand = Math.random();

  if (currentLiveAttendeesCount < 330) {
    delta = Math.floor(Math.random() * 4) + 2;
  } else if (currentLiveAttendeesCount > 770) {
    delta = -(Math.floor(Math.random() * 4) + 2);
  } else {
    if (rand < 0.46) {
      delta = Math.floor(Math.random() * 3) + 1;
    } else if (rand < 0.84) {
      delta = -(Math.floor(Math.random() * 3) + 1);
    } else if (rand < 0.94) {
      delta = Math.floor(Math.random() * 4) + 3;
    } else {
      delta = 0;
    }
  }

  currentLiveAttendeesCount += delta;
  if (currentLiveAttendeesCount < 308) currentLiveAttendeesCount = 308 + Math.floor(Math.random() * 12);
  if (currentLiveAttendeesCount > 794) currentLiveAttendeesCount = 794 - Math.floor(Math.random() * 12);

  try {
    sessionStorage.setItem('qa_live_attendees', currentLiveAttendeesCount.toString());
  } catch (e) {}

  updateLiveAttendeesDisplay(currentLiveAttendeesCount, delta !== 0);
}

function updateLiveAttendeesDisplay(count, animated = true) {
  const isReplay = !!(typeof currentLiveSession !== 'undefined' && currentLiveSession && (currentLiveSession.status === 'completed' || currentLiveSession.replayUrl));
  const formatted = count.toLocaleString('en-IN');
  const countEl = document.getElementById('live-viewer-count-mini');
  if (countEl) {
    countEl.textContent = formatted;
    if (animated && !isReplay) {
      countEl.classList.remove('count-bump');
      void countEl.offsetWidth;
      countEl.classList.add('count-bump');
    }
  }

  const words = document.querySelectorAll('.watching-word');
  words.forEach(w => {
    if (w) w.textContent = isReplay ? 'Attended' : 'Watching';
  });

  const pill = document.getElementById('live-attendees-pill-mini');
  if (pill) {
    if (isReplay) {
      pill.classList.remove('pulse-pill');
      pill.style.background = 'rgba(216, 161, 83, 0.12)';
      pill.style.borderColor = 'rgba(216, 161, 83, 0.28)';
      pill.style.color = '#d8a153';
    } else {
      pill.style.background = '';
      pill.style.borderColor = '';
      pill.style.color = '';
      if (animated) {
        pill.classList.remove('pulse-pill');
        void pill.offsetWidth;
        pill.classList.add('pulse-pill');
      }
    }
  }
}

function stopLiveAttendeesCounter() {
  if (liveAttendeesTimer) {
    clearTimeout(liveAttendeesTimer);
    liveAttendeesTimer = null;
  }
}

async function pollLiveDoubtsStudent() {
  if (!currentLiveSession || !currentLiveSession.id) return;
  const container = document.getElementById('live-chat-messages');
  const fsContainer = document.getElementById('fs-live-chat-messages');
  if (!container && !fsContainer) return;

  try {
    const res = await apiFetch(`fetch-live-doubts&liveId=${encodeURIComponent(currentLiveSession.id)}`);
    const messages = res.messages || [];

    const emptyHtml = `
      <div class="chat-empty-state">
        <span>💬</span>
        <p>Live doubts chat is open. Ask your editing doubts or color grading questions below.</p>
      </div>
    `;

    if (!messages.length) {
      if (container) container.innerHTML = emptyHtml;
      if (fsContainer) fsContainer.innerHTML = emptyHtml;
      return;
    }

    const messagesHtml = messages.map(m => {
      const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      if (m.isMentor) {
        return `
          <div class="chat-msg-bubble mentor">
            <div class="chat-msg-hdr">
              <span>⭐ ${escHtml(m.studentName || 'Mentor Anil Sharma')}</span>
              <span class="chat-msg-time">${timeStr}</span>
            </div>
            <div class="chat-msg-text">${escHtml(m.message)}</div>
          </div>
        `;
      }
      return `
        <div class="chat-msg-bubble student">
          <div class="chat-msg-hdr">
            <span>🎓 ${escHtml(m.studentName || 'Student')}</span>
            <span class="chat-msg-time">${timeStr}</span>
          </div>
          <div class="chat-msg-text">${escHtml(m.message)}</div>
        </div>
      `;
    }).join('');

    if (container) {
      container.innerHTML = messagesHtml;
      container.scrollTop = container.scrollHeight;
    }
    if (fsContainer) {
      fsContainer.innerHTML = messagesHtml;
      fsContainer.scrollTop = fsContainer.scrollHeight;
    }
  } catch(e) {}
}

async function sendLiveDoubtStudent() {
  if (!currentLiveSession || !currentLiveSession.id) return;
  const input = document.getElementById('live-doubt-input');
  const btn = document.getElementById('btn-live-send');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;

  input.value = '';
  if (btn) btn.disabled = true;

  try {
    await apiFetch('send-live-doubt', {
      method: 'POST',
      body: { liveId: currentLiveSession.id, message: msg }
    });
    pollLiveDoubtsStudent();
    toast('✓ Question sent to Mentor');
  } catch (err) {
    toast(err.message, false);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function exitLiveStudio() {
  stopLiveAttendeesCounter();

  if (liveOverlayHideTimeout) {
    clearTimeout(liveOverlayHideTimeout);
    liveOverlayHideTimeout = null;
  }
  const box = document.getElementById('live-video-box');
  if (box) {
    box.classList.remove('show-controls');
    box.classList.remove('is-fullscreen');
    box.classList.remove('is-zoom');
  }
  const exitBtn = document.getElementById('live-fs-exit-btn');
  if (exitBtn) exitBtn.remove();
  const streamBar = document.querySelector('.live-stream-bar');
  if (streamBar) {
    streamBar.classList.remove('zoom-classroom-bar');
    streamBar.style.display = '';
  }
  document.body.classList.remove('live-fs-open');
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(_) {}

  if (liveDoubtsPollTimer) {
    clearInterval(liveDoubtsPollTimer);
    liveDoubtsPollTimer = null;
  }
  if (liveWatermarkInterval) {
    clearInterval(liveWatermarkInterval);
    liveWatermarkInterval = null;
  }
  if (livePingTimer) {
    clearInterval(livePingTimer);
    livePingTimer = null;
  }
  isStudentHandRaised = false;
  const handBtn = document.getElementById('live-raise-hand-btn');
  if (handBtn) {
    handBtn.classList.remove('hand-active');
    handBtn.title = 'Raise Hand / Request to Speak';
  }
  if (window._isStudentOnStage) {
    disconnectLiveStage(true);
  }
  const micBanner = document.getElementById('live-mic-permission-banner');
  if (micBanner) micBanner.classList.add('hidden');

  const mount = document.getElementById('live-video-mount');
  if (mount) mount.innerHTML = '';
  currentLiveSession = null;
  currentAppLiveSession = null;

  const classroom = document.getElementById('view-live-classroom');
  const viewport = document.getElementById('app-viewport');
  const bottomNav = document.getElementById('bottom-nav');
  if (classroom) classroom.classList.add('hidden');
  if (viewport) viewport.classList.remove('hidden');
  if (bottomNav) bottomNav.classList.remove('hidden');
}

async function openLiveRecording(classId) {
  const session = allLiveClasses.find(c => c.id === classId);
  if (!session) return;
  if (!isStudentEnrolledInLive(session)) {
    toast('Aap is recording ke liye enrolled nahi hain.', false);
    return;
  }
  // Open directly in the high-definition In-App Cinema Studio with full replay playback controls
  openLiveStudio(classId, true);
}

// ==========================================================================
// 9. TAB 4: MY PROFILE ENGINE
// ==========================================================================
// Student ID Card is only for admission-form students (offline / online batch).
// Online course buyers get instant course access + certificate, but no ID card.
function isAdmissionStudent(stu) {
  return !!(stu && (stu.offlineAdmissionId || stu.isOfflineStudent || stu.isOnlineBatch));
}

function loadProfileData() {
  if (!currentStudent) return;
  const idTile = document.getElementById('prof-id-tile');
  if (idTile) idTile.style.display = isAdmissionStudent(currentStudent) ? '' : 'none';
  const nameEl = document.getElementById('prof-name');
  if (nameEl) nameEl.textContent = currentStudent.name || 'Student Name';

  const idEl = document.getElementById('prof-student-id');
  if (idEl) {
    const rawId = currentStudent.enrollmentNo || currentStudent.id || 'QAA-STUDENT';
    idEl.textContent = rawId.startsWith('ID:') || rawId.startsWith('QAA') ? rawId : `ID: ${rawId}`;
  }

  const roleEl = document.getElementById('prof-role-badge');
  if (roleEl) {
    roleEl.textContent = currentStudent.role === 'admin' ? 'ACADEMY ADMIN' : 'VERIFIED STUDENT';
  }

  const phoneEl = document.getElementById('prof-phone');
  if (phoneEl) {
    const rawPhone = String(currentStudent.phone || '').trim();
    if (!rawPhone || rawPhone === '••••••••••') {
      phoneEl.textContent = '+91 ••••••••••';
    } else if (rawPhone.startsWith('+')) {
      phoneEl.textContent = rawPhone;
    } else if (rawPhone.startsWith('91') && rawPhone.length === 12) {
      phoneEl.textContent = `+${rawPhone}`;
    } else {
      phoneEl.textContent = `+91 ${rawPhone}`;
    }
  }

  const emailEl = document.getElementById('prof-email');
  if (emailEl) emailEl.textContent = currentStudent.email || 'student@quickart.in';

  const cityEl = document.getElementById('prof-city');
  if (cityEl) cityEl.textContent = currentStudent.city || currentStudent.workCity || 'India';

  // Live Stats: Courses & Certificates
  const courseCountEl = document.getElementById('prof-course-count');
  if (courseCountEl) {
    courseCountEl.textContent = Array.isArray(enrolledCourses) ? enrolledCourses.length : 0;
  }

  const certCountEl = document.getElementById('prof-cert-count');
  if (certCountEl) {
    const certCount = Array.isArray(enrolledCourses)
      ? enrolledCourses.filter(c => c.certificateEligible || c.certificate).length
      : 0;
    certCountEl.textContent = certCount;
  }

  const avatar = currentStudent.photoUrl || currentStudent.avatar || currentStudent.avatarUrl || '';
  const initials = (currentStudent.name || 'Student')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'QA';

  const imgEl = document.getElementById('prof-avatar-img');
  const fbEl = document.getElementById('prof-avatar-fallback');

  if (avatar && imgEl && fbEl) {
    imgEl.src = avatar;
    imgEl.classList.remove('hidden');
    fbEl.classList.add('hidden');
  } else if (fbEl && imgEl) {
    fbEl.textContent = initials;
    fbEl.classList.remove('hidden');
    imgEl.classList.add('hidden');
  }
}

function triggerAvatarUpload() {
  document.getElementById('file-avatar-input')?.click();
}

function handleProfilePhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const img = new Image();
    img.onload = async () => {
      const maxDim = 1200;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);

      if (currentStudent) {
        currentStudent.avatar = dataUrl;
        currentStudent.avatarUrl = dataUrl;
        currentStudent.photoUrl = dataUrl;
        localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));
        loadProfileData();
        updateHeaderUI();

        // Update ID card photo preview if element exists
        const idCardPhoto = document.getElementById('idcard-photo');
        if (idCardPhoto) idCardPhoto.src = dataUrl;

        toast('Photo updated successfully! Syncing…');

        try {
          const res = await apiFetch('update-profile', {
            method: 'POST',
            body: { avatar: dataUrl, name: currentStudent.name || '' }
          });
          if (res && res.photoUrl) {
            currentStudent.photoUrl = res.photoUrl;
            currentStudent.avatar = res.photoUrl;
            currentStudent.avatarUrl = res.photoUrl;
            localStorage.setItem('qaa_student_info', JSON.stringify(currentStudent));
            if (idCardPhoto) idCardPhoto.src = res.photoUrl;
          }
          toast('Photo & ID Card updated on server! 🎉');
        } catch (_) {}
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}


// ==========================================================================
// 9.4 OFFICIAL STUDENT ID CARD (CR80 PVC) - IDENTICAL TO WEBSITE PORTAL
// ==========================================================================
let currentAppIdCardSide = 'front';

function openStudentIdCardModal() {
  const stu = currentStudent || JSON.parse(localStorage.getItem('qaa_student_info') || '{}');
  if (!stu || (!stu.phone && !stu.name)) {
    toast('Please log in to view your official Student ID Card', false);
    return;
  }
  if (!isAdmissionStudent(stu)) {
    toast('Student ID Card sirf Admission Form wale students ke liye hai.', false);
    return;
  }
  const approved = !!stu.isApproved && ['active', 'approved'].includes(stu.status);
  const ribbonEl = document.getElementById('app-idcard-ribbon');
  if (ribbonEl) {
    ribbonEl.textContent = approved ? 'VERIFIED STUDENT' : 'PROVISIONAL';
    ribbonEl.style.background = approved ? '' : '#d97706';
  }
  const pillEl = document.getElementById('app-idcard-pill');
  if (pillEl) {
    pillEl.textContent = approved ? 'ACTIVE' : 'PENDING APPROVAL';
    pillEl.style.cssText = approved ? '' : 'background:rgba(245,158,11,0.2); color:#fbbf24; border-color:rgba(245,158,11,0.6);';
  }

  const stuId = stu.offlineAdmissionId || stu.enrollmentNo || stu.id || ('QAA-2026-' + (stu.phone ? String(stu.phone).slice(-4) : 'ADM'));
  const stuName = stu.name || 'Verified Student';
  const rawPhone = stu.phone ? String(stu.phone).replace(/\D/g, '').slice(-10) : '9939800780';
  const stuPhone = '+91 ' + rawPhone;
  const stuCourse = stu.appliedCourse || 'Master Photography & Filmmaking Diploma';
  const stuStudio = stu.studioName || 'Quick Art Photography';
  const stuCity = stu.workCity || stu.city || 'Patna, Bihar';
  const stuBlood = stu.bloodGroup || 'O+';
  const stuAvatar = stu.avatar || stu.avatarUrl || stu.photoUrl || localStorage.getItem('qaa_avatar_' + (stu.id || '')) || '../assets/default-student-avatar.svg';

  // Front elements
  const nameEl = document.getElementById('app-idcard-name');
  const courseEl = document.getElementById('app-idcard-course');
  const idEl = document.getElementById('app-idcard-id');
  const phoneEl = document.getElementById('app-idcard-phone');
  const studioEl = document.getElementById('app-idcard-studio');
  const cityEl = document.getElementById('app-idcard-city');
  const bloodEl = document.getElementById('app-idcard-blood');
  const photoEl = document.getElementById('app-idcard-photo');
  const qrEl = document.getElementById('app-idcard-qr');
  const barcodeValEl = document.getElementById('app-idcard-barcode-val');

  if (nameEl) nameEl.textContent = stuName;
  if (courseEl) courseEl.textContent = stuCourse;
  if (idEl) idEl.textContent = stuId;
  if (phoneEl) phoneEl.textContent = stuPhone;
  if (studioEl) studioEl.textContent = stuStudio;
  if (cityEl) cityEl.textContent = stuCity;
  if (bloodEl) bloodEl.textContent = stuBlood;
  if (photoEl) {
    photoEl.src = stuAvatar;
    photoEl.alt = stuName;
  }

  // Live QR Verification Link (Identical to Website Portal)
  const verifyUrl = `https://quickartphotography.in/admission/verify.html?id=${encodeURIComponent(stuId)}&phone=${encodeURIComponent(rawPhone)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`;
  if (qrEl) qrEl.src = qrUrl;

  if (barcodeValEl) barcodeValEl.textContent = `* ${stuId} *`;

  // Reset to front side
  switchAppIdCardSide('front');

  const modal = document.getElementById('modal-id-card');
  if (modal) modal.classList.add('active');
  pushNavState({ screen: 'modal', modal: 'idcard' });
}

function closeStudentIdCardModal(fromPopstate = false) {
  const modal = document.getElementById('modal-id-card');
  if (modal) modal.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'idcard') {
    try { window.history.back(); } catch (e) {}
  }
}

function switchAppIdCardSide(side = 'front') {
  currentAppIdCardSide = side;
  const frontEl = document.getElementById('app-idcard-front');
  const backEl = document.getElementById('app-idcard-back');
  const frontTab = document.getElementById('btn-idcard-front-tab');
  const backTab = document.getElementById('btn-idcard-back-tab');

  if (side === 'front') {
    if (frontEl) frontEl.style.display = 'block';
    if (backEl) backEl.style.display = 'none';
    if (frontTab) frontTab.classList.add('active');
    if (backTab) backTab.classList.remove('active');
  } else {
    if (frontEl) frontEl.style.display = 'none';
    if (backEl) backEl.style.display = 'block';
    if (frontTab) frontTab.classList.remove('active');
    if (backTab) backTab.classList.add('active');
  }
}

async function downloadAppIdCard(side = 'front') {
  const targetId = `app-idcard-${side}`;
  const el = document.getElementById(targetId);
  if (!el) {
    toast('ID card element not found', false);
    return;
  }

  // Ensure element is visible during capture
  const prevDisplay = el.style.display;
  el.style.display = 'block';

  const stu = currentStudent || JSON.parse(localStorage.getItem('qaa_student_info') || '{}');
  const cleanName = (stu.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `QAA_ID_Card_${side.toUpperCase()}_${cleanName}.png`;

  toast(`Generating High-Resolution ${side.toUpperCase()} ID Card…`);

  if (typeof html2canvas === 'function') {
    try {
      const canvas = await html2canvas(el, {
        scale: 3, // 300 DPI high-definition PVC print quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0c13',
        logging: false
      });
      el.style.display = prevDisplay;

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(`✅ ${side.toUpperCase()} ID Card downloaded!`);
      return;
    } catch (err) {
      el.style.display = prevDisplay;
      console.warn('html2canvas download error:', err);
      toast('Download error. Please take a screenshot.', false);
    }
  } else {
    el.style.display = prevDisplay;
    toast('Library loading. Please try again in a moment.', false);
  }
}

function printAppIdCard() {
  const front = document.getElementById('app-idcard-front');
  const back = document.getElementById('app-idcard-back');
  if (!front || !back) return;

  const printWin = window.open('', '_blank', 'width=880,height=750');
  if (!printWin) {
    toast('Please allow popups to print ID card', false);
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Quick Art Photography Academy - Student ID Card</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="app.css">
        <style>
          @page { size: auto; margin: 15mm; }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0;
            padding: 20px;
            font-family: 'Outfit', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .print-container {
            display: flex;
            flex-wrap: wrap;
            gap: 30px;
            justify-content: center;
          }
          .adm-issued-id-card {
            box-shadow: 0 4px 15px rgba(0,0,0,0.15) !important;
            border: 1px solid rgba(0,0,0,0.2) !important;
            display: block !important;
            page-break-inside: avoid;
          }
          .print-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .print-header h2 { margin: 0 0 4px; font-size: 18px; color: #0a0c13; }
          .print-header p { margin: 0; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h2>QUICK ART PHOTOGRAPHY ACADEMY</h2>
          <p>Official Student Identification Card (CR80 PVC Front &amp; Back)</p>
        </div>
        <div class="print-container">
          ${front.outerHTML}
          ${back.outerHTML}
        </div>
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        <\/script>
      </body>
    </html>
  `);
  printWin.document.close();
}

// ==========================================================================
// 9.4B OFFICIAL ACCREDITED CERTIFICATE - IDENTICAL TO WEBSITE PORTAL
// ==========================================================================
let activeAppCertData = null;

function getCourseCodeForCert(courseId) {
  if (!courseId) return 'PR';
  const id = String(courseId).toLowerCase();
  if (id.includes('pre-wedding')) return 'PW';
  if (id.includes('album')) return 'AD';
  if (id.includes('premiere')) return 'PR';
  if (id.includes('edius')) return 'ED';
  if (id.includes('davinci') || id.includes('resolve')) return 'DR';
  if (id.includes('cinematic') || id.includes('wedding')) return 'CE';
  if (id.includes('website') || id.includes('web')) return 'WD';
  if (id.includes('marketing') || id.includes('digital')) return 'DM';
  if (id.includes('auto')) return 'AU';
  return 'GEN';
}

function generateAppCertificateId(courseId, phone) {
  const code = getCourseCodeForCert(courseId);
  const enroll = currentStudent && (currentStudent.offlineAdmissionId || currentStudent.enrollmentNo);
  if (enroll) {
    const parts = String(enroll).split('-');
    const suffix = parts[parts.length - 1];
    return `QAA-2026-${code}-${suffix}`;
  }
  const rawPhone = String(phone || (currentStudent ? currentStudent.phone : '0780')).replace(/\D/g, '');
  const suffix = rawPhone.slice(-4) || '0780';
  return `QAA-2026-${code}-${suffix}`;
}

async function openCertificatesModal(courseId) {
  const stu = currentStudent || JSON.parse(localStorage.getItem('qaa_student_info') || '{}');
  if (!stu || (!stu.phone && !stu.name)) {
    toast('Please log in to view your Certificates', false);
    return;
  }

  // Get enrolled courses list if available
  let enrolledList = Array.isArray(enrolledCourses) && enrolledCourses.length ? enrolledCourses : [];
  if (!enrolledList.length && Array.isArray(allAcademyCourses) && allAcademyCourses.length && Array.isArray(stu.enrolledCourses)) {
    enrolledList = allAcademyCourses.filter(c => stu.enrolledCourses.includes(c.id));
  }

  // Determine active course
  let selectedCourse = null;
  if (courseId) {
    selectedCourse = enrolledList.find(c => c.id === courseId) || 
                     (Array.isArray(allAcademyCourses) ? allAcademyCourses.find(c => c.id === courseId) : null);
  }
  if (!selectedCourse && enrolledList.length > 0) {
    selectedCourse = enrolledList[0];
  }
  if (!selectedCourse) {
    toast('🎓 Abhi koi course enroll nahi hai. Course poora karne ke baad certificate milega.', false);
    return;
  }

  // Render course picker pills if multiple enrolled courses
  const pickerRow = document.getElementById('cert-course-picker-row');
  if (pickerRow) {
    if (enrolledList.length > 1) {
      pickerRow.style.display = 'flex';
      pickerRow.innerHTML = enrolledList.map(c => `
        <button type="button" class="cert-course-pill ${c.id === selectedCourse.id ? 'active' : ''}" 
                onclick="openCertificatesModal('${c.id}')"
                style="padding:6px 14px; font-size:12px; font-weight:600; border-radius:20px; white-space:nowrap; border:1px solid ${c.id === selectedCourse.id ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}; background:${c.id === selectedCourse.id ? 'rgba(216,161,83,0.2)' : 'rgba(255,255,255,0.05)'}; color:${c.id === selectedCourse.id ? '#ecc779' : 'var(--text-muted)'}; cursor:pointer;">
          ${c.title}
        </button>
      `).join('');
    } else {
      pickerRow.style.display = 'none';
      pickerRow.innerHTML = '';
    }
  }

  // Server is the source of truth: all lessons done + quiz passed
  let status;
  try {
    status = await apiFetch(`certificate-status&courseId=${encodeURIComponent(selectedCourse.id)}`);
  } catch (err) {
    toast('Certificate status check nahi ho paya. Internet check karke dobara try karein.', false);
    return;
  }
  if (!status.eligible) {
    if (status.reason === 'lessons') {
      toast(`🔒 Certificate locked: ${status.done}/${status.total} lessons (${status.pct}%) poore hue hain. Saare lessons poore karein.`, false);
    } else if (status.reason === 'quiz') {
      toast('🔒 Certificate locked: Saare lessons ho gaye! Ab Quiz tab me test paas karein (min 70%).', false);
    } else {
      toast('🔒 Is course ka certificate poora course aur test complete hone ke baad hi milega.', false);
    }
    return;
  }

  populateAppCertificateUI(stu, selectedCourse, status.certificate);

  const modal = document.getElementById('modal-certificate');
  if (modal) modal.classList.add('active');
  pushNavState({ screen: 'modal', modal: 'certificate' });
}

function populateAppCertificateUI(stu, course, issued) {
  const name = stu.name || 'Verified Student';
  const cTitle = (course && course.title) || stu.appliedCourse || 'Master Video Editing & Filmmaking Diploma';
  const cId = (course && course.id) || 'master-class';
  const certId = (issued && issued.id) || generateAppCertificateId(cId, stu.phone);
  const enrollNo = stu.offlineAdmissionId || stu.enrollmentNo || ('QAA-2026-' + (stu.phone ? String(stu.phone).slice(-4) : '8842'));

  const issuedOn = issued && issued.issuedDate ? new Date(issued.issuedDate) : new Date();
  const today = issuedOn.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const nameEl = document.getElementById('app-cert-student-name');
  const courseEl = document.getElementById('app-cert-course-name');
  const enrollCodeEl = document.getElementById('app-cert-enroll-code');
  const certIdEl = document.getElementById('app-cert-id-val');
  const dateEl = document.getElementById('app-cert-date-val');
  const qrEl = document.getElementById('app-cert-qr-img');

  if (nameEl) nameEl.textContent = name;
  if (courseEl) courseEl.textContent = cTitle;
  if (enrollCodeEl) enrollCodeEl.textContent = enrollNo;
  if (certIdEl) certIdEl.textContent = `ID: ${certId}`;
  if (dateEl) dateEl.textContent = today;

  // Verification URL identical to website portal
  const verifyUrl = `https://quickartphotography.in/portal/?verify=${encodeURIComponent(certId)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}&margin=4`;
  if (qrEl) {
    qrEl.crossOrigin = 'anonymous';
    qrEl.src = qrUrl;
    qrEl.alt = `Verify ${certId}`;
  }

  activeAppCertData = {
    studentName: name,
    courseTitle: cTitle,
    courseId: cId,
    certificateId: certId,
    issuedDate: (issued && issued.issuedDate) || new Date().toISOString(),
    verifyUrl: verifyUrl
  };
  renderAppCertificatePreview();
}

function closeCertificateModal(fromPopstate = false) {
  const modal = document.getElementById('modal-certificate');
  if (modal) modal.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'certificate') {
    try { window.history.back(); } catch (e) {}
  }
}

// Certificate image is drawn by /portal/certificate-render.js (A4 landscape, 300 DPI)
let activeAppCertCanvas = null;

function renderAppCertificatePreview() {
  const img = document.getElementById('qa-cert-preview');
  const loading = document.getElementById('qa-cert-loading');
  activeAppCertCanvas = null;
  if (!activeAppCertData || typeof QACertificate === 'undefined') return Promise.resolve(null);
  if (img) img.style.opacity = '0';
  if (loading) loading.style.display = 'block';
  return QACertificate.render(activeAppCertData).then(canvas => {
    activeAppCertCanvas = canvas;
    if (img) {
      img.src = canvas.toDataURL('image/jpeg', 0.9);
      img.style.opacity = '1';
    }
    if (loading) loading.style.display = 'none';
    return canvas;
  });
}

async function getAppCertCanvas() {
  return activeAppCertCanvas || await renderAppCertificatePreview();
}

async function downloadAppCertificatePNG() {
  if (!activeAppCertData) {
    toast('Certificate not ready', false);
    return;
  }
  toast('HD certificate taiyaar ho raha hai…');
  const canvas = await getAppCertCanvas();
  if (!canvas) {
    toast('Certificate ban nahi paya. Dobara try karein.', false);
    return;
  }
  const cleanName = (activeAppCertData.studentName || 'Student').replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `QuickArt_Certificate_${cleanName}.png`;

  // Android app: save straight to the Gallery through the native bridge
  if (window.QAAndroid && typeof window.QAAndroid.saveImage === 'function') {
    const result = window.QAAndroid.saveImage(canvas.toDataURL('image/png'), filename);
    if (result === 'permission') {
      toast('Storage permission dijiye, phir Download dobara dabaiye.', false);
    } else if (result !== 'ok') {
      toast('Save nahi ho paya. Dobara try karein.', false);
    }
    return;
  }
  if (/QuickArtAcademyApp/.test(navigator.userAgent)) {
    toast('Download ke liye app update kariye, ya website ke Student Portal se download kariye.', false);
    return;
  }
  await QACertificate.download(canvas, activeAppCertData.studentName);
  toast('🎓 Certificate download ho gaya (A4, 300 DPI)!');
}

async function printAppCertificate() {
  if (!activeAppCertData) return;
  const canvas = await getAppCertCanvas();
  if (!canvas) return;
  if (!QACertificate.print(canvas)) {
    toast('Print ke liye popup allow kariye, ya Download karke print kariye.', false);
  }
}

function shareAppCertificateWhatsApp() {
  if (!activeAppCertData) return;
  const stuName = activeAppCertData.studentName || 'Student';
  const cTitle = activeAppCertData.courseTitle || 'Masterclass';
  const verifyUrl = activeAppCertData.verifyUrl;
  const text = `🎓 Proud to announce that I have successfully completed the *${cTitle}* from *Quick Art Photography Academy* (ISO 9001:2015 & Govt. MSME Certified)!\n\nVerify my credential online:\n🔗 ${verifyUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

function openDownloadsModal() {
  switchTab('mycourses');
  toast('Practice files are inside each course classroom under Practice Files tab');
}

function openChangePasswordModal() {
  openForgotPasswordSheet();
}

// ==========================================================================
// 9.5 APP INSTALL & APK DOWNLOAD ENGINE (ONLY IN AVATAR MENU)
// ==========================================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const pwaBtn = document.getElementById('btn-pwa-install-action');
  if (pwaBtn) pwaBtn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  toast('🎉 Quick Art Academy App Installed Successfully!');
});

function openInstallModal() {
  const isWebView = /FBAN|FBAV|Instagram|WhatsApp|wv/i.test(navigator.userAgent);
  const warningEl = document.getElementById('inapp-browser-warning');
  if (warningEl) {
    if (isWebView) warningEl.classList.remove('hidden');
    else warningEl.classList.add('hidden');
  }

  const pwaBtn = document.getElementById('btn-pwa-install-action');
  if (pwaBtn) {
    pwaBtn.style.display = 'flex';
  }

  const modal = document.getElementById('modal-install-app');
  if (modal) modal.classList.add('active');
  pushNavState({ screen: 'modal', modal: 'install' });
}

function closeInstallModal(fromPopstate = false) {
  const modal = document.getElementById('modal-install-app');
  if (modal) modal.classList.remove('active');
  if (!fromPopstate && window.history.state && window.history.state.modal === 'install') {
    try { window.history.back(); } catch (e) {}
  }
}

function handleApkDownloadClick(event) {
  const isWebView = /FBAN|FBAV|Instagram|WhatsApp|wv/i.test(navigator.userAgent);
  if (isWebView) {
    if (event) event.preventDefault();
    toast('⚠️ WhatsApp/Instagram me APK download block hota hai. Upar 3 dots dabakar "Open in Chrome" karein!', false);
    openInstallModal();
    return;
  }

  toast('⬇ Downloading Quick Art Academy APK (4.7 MB)…');
  // Auto open guide after 1 second so student knows how to allow unknown source
  setTimeout(() => {
    openInstallModal();
  }, 1000);
}

function triggerApkDownload() {
  handleApkDownloadClick();
  const link = document.createElement('a');
  link.href = '/downloads/quickart-academy.apk';
  link.setAttribute('download', 'quickart-academy.apk');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      toast('Installing Quick Art LMS App…');
      closeInstallModal();
    }
    deferredInstallPrompt = null;
  } else {
    toast('📱 Phone browser menu (⋮) me jakar "Add to Home screen" / "Install App" chunein.');
  }
}

// ==========================================================================
// 9.9 UNIVERSAL NAVIGATION & HARDWARE BACK BUTTON HANDLER
// ==========================================================================
function pushNavState(state) {
  try {
    window.history.pushState(state, '', window.location.href);
  } catch (e) {
    console.warn('pushState error:', e);
  }
}

function handleAppBack() {
  // 1. If All Lessons drawer inside classroom is open
  const lessonsDrawer = document.getElementById('cr-lessons-drawer');
  if (lessonsDrawer && !lessonsDrawer.classList.contains('hidden')) {
    closeAllLessonsDrawer();
    return true;
  }

  // 2. If Install modal is open
  const installModal = document.getElementById('modal-install-app');
  if (installModal && installModal.classList.contains('active')) {
    closeInstallModal(true);
    return true;
  }

  // 2.5 If Course Checkout modal is open
  const checkoutModal = document.getElementById('modal-course-checkout');
  if (checkoutModal && checkoutModal.classList.contains('active')) {
    closeCourseCheckoutModal(true);
    return true;
  }

  // 3. If All Courses modal is open
  const coursesModal = document.getElementById('modal-all-courses');
  if (coursesModal && coursesModal.classList.contains('active')) {
    closeAllCoursesModal(true);
    return true;
  }

  // 4. If Student ID Card modal is open
  const idModal = document.getElementById('modal-id-card');
  if (idModal && idModal.classList.contains('active')) {
    closeStudentIdCardModal(true);
    return true;
  }

  // 4.5 If Certificate modal is open
  const certModal = document.getElementById('modal-certificate');
  if (certModal && certModal.classList.contains('active')) {
    closeCertificateModal(true);
    return true;
  }

  // 5. If Avatar Quick Menu is open
  const avatarMenu = document.getElementById('sheet-avatar-quickmenu');
  if (avatarMenu && avatarMenu.classList.contains('active')) {
    closeAvatarQuickMenu(true);
    return true;
  }

  // 6. If Notification Drawer is open
  const notifBackdrop = document.getElementById('notification-backdrop');
  if (notifBackdrop && notifBackdrop.classList.contains('active')) {
    toggleNotificationDrawer(true);
    return true;
  }

  // 7. If Registration or Forgot Password sheet is open
  const regModal = document.getElementById('modal-register');
  if (regModal && regModal.classList.contains('active')) {
    closeRegistrationSheet();
    return true;
  }
  const forgotSheet = document.getElementById('sheet-forgot-pw');
  if (forgotSheet && forgotSheet.classList.contains('active')) {
    closeForgotPasswordSheet();
    return true;
  }

  // 8. If Classroom Player is open -> close it!
  const player = document.getElementById('view-classroom-player');
  if (player && !player.classList.contains('hidden')) {
    closeClassroomPlayer(true);
    return true;
  }

  // 9. If not on Dashboard tab, navigate to Dashboard tab
  if (currentTab !== 'dashboard') {
    switchTab('dashboard', true);
    return true;
  }

  return false; // Already on dashboard and nothing open
}

// Global hook for Android WebView
window.handleNativeAppBack = handleAppBack;

// Browser / Mobile hardware/gesture back button listener
let lastBackToastTime = 0;
window.addEventListener('popstate', (e) => {
  const handled = handleAppBack();
  if (!handled) {
    const now = Date.now();
    if (now - lastBackToastTime > 2500) {
      toast('Tap back again to exit', false);
      lastBackToastTime = now;
      pushNavState({ screen: 'dashboard' });
    }
  }
});

// Seed initial history state
try {
  window.history.replaceState({ screen: 'dashboard' }, '', window.location.href);
  window.history.pushState({ screen: 'dashboard' }, '', window.location.href);
} catch (e) {}

// ==========================================================================
// 10. NOTIFICATION CENTER ENGINE
// ==========================================================================
function toggleNotificationDrawer(fromPopstate = false) {
  const backdrop = document.getElementById('notification-backdrop');
  backdrop.classList.toggle('active');
  if (backdrop.classList.contains('active')) {
    loadNotifications();
    pushNavState({ screen: 'modal', modal: 'notifications' });
  } else if (!fromPopstate && window.history.state && window.history.state.modal === 'notifications') {
    try { window.history.back(); } catch (e) {}
  }
}

async function loadNotifications() {
  const listEl = document.getElementById('notif-sheet-list');
  const badge = document.getElementById('notif-badge');

  try {
    const res = await apiFetch('get-notifications');
    notificationsList = res.notifications || [];
    const unread = res.unreadCount || 0;

    if (unread > 0) {
      badge.textContent = unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (!notificationsList.length) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color: var(--text-muted);">
          <div style="font-size:32px; margin-bottom:8px;">🔔</div>
          <div style="font-size:14px; font-weight:700; color:#fff;">No new notifications</div>
          <div style="font-size:12px; margin-top:4px;">Live classes aur academy updates yahan notify honge.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = notificationsList.map(n => `
      <div class="announcement-card" style="margin-bottom:8px; border-left: 3px solid ${n.type === 'live_class' ? '#ef4444' : '#d8a153'}; cursor:pointer;" onclick="handleNotificationTap('${n.id}', '${n.url || ''}')">
        <div class="announcement-meta">
          <span class="announcement-badge" style="${n.type === 'live_class' ? 'background:rgba(239,68,68,0.18);color:#fca5a5;border-color:rgba(239,68,68,0.3);' : ''}">
            ${escHtml(n.title)}
          </span>
          <span class="announcement-date">${n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Alert'}</span>
        </div>
        <div class="announcement-body" style="color:#e2e8f0;">${escHtml(n.body)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Notifications load failed:', err);
  }
}

async function handleNotificationTap(notifId, targetUrl) {
  toggleNotificationDrawer();

  try {
    await apiFetch('mark-notification-read', {
      method: 'POST',
      body: { id: notifId }
    });
  } catch (_) {}

  if (targetUrl) {
    if (targetUrl.includes('tab=live')) {
      switchTab('live');
    } else if (targetUrl.includes('tab=mycourses')) {
      switchTab('mycourses');
    }
  }
}

// ==========================================================================
// 11. SHARED HELPERS & TOAST
// ==========================================================================
function toast(msg, isSuccess = true) {
  const toastEl = document.getElementById('app-toast');
  const textEl = document.getElementById('toast-text');
  const iconEl = document.getElementById('toast-icon');

  if (!toastEl) return;
  textEl.textContent = msg;
  iconEl.textContent = isSuccess ? '⚡' : '⚠️';
  toastEl.classList.add('active');

  setTimeout(() => {
    toastEl.classList.remove('active');
  }, 3200);
}

window.copyText = function(txt, label) {
  if (!txt) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      toast((label || '📋 Copied') + ' ✅');
    }).catch(() => {
      prompt('Copy:', txt);
    });
  } else {
    prompt('Copy:', txt);
  }
};

window.toggleZoomInBrowser = function(showEmbed) {
  const card = document.getElementById('zoom-card-view');
  const embed = document.getElementById('zoom-embed-view');
  const iframe = document.getElementById('zoom-web-iframe');
  if (card && embed) {
    if (showEmbed) {
      card.style.display = 'none';
      embed.style.display = 'flex';
      if (iframe && iframe.dataset.src && (!iframe.src || iframe.src === 'about:blank')) {
        iframe.src = iframe.dataset.src;
      }
    } else {
      card.style.display = 'flex';
      embed.style.display = 'none';
    }
  }
};

// Alias used by live-class renderers (Meet / Zoom); without it they threw "escapeHtml is not defined"
function escapeHtml(str) {
  return escHtml(str);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Zoom in-page join (Meeting SDK Client View: full Zoom-style classroom in this tab) ──
const QA_ZOOM_SDK_VER = '3.11.2';
function qaLoadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-qa-src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src; el.async = false; el.dataset.qaSrc = src;
    el.onload = resolve; el.onerror = () => reject(new Error('Zoom load nahi hua. Internet check karke dobara try karein.'));
    document.head.appendChild(el);
  });
}
async function qaLoadZoomClientSdk() {
  if (window.ZoomMtg) return;
  const base = `https://source.zoom.us/${QA_ZOOM_SDK_VER}`;
  // Zoom's own stylesheets are only added at join time so they never affect the portal
  ['bootstrap.css', 'react-select.css'].forEach(f => {
    if (document.querySelector(`link[data-qa-zoom="${f}"]`)) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `${base}/css/${f}`; l.dataset.qaZoom = f; document.head.appendChild(l);
  });
  if (!document.getElementById('qa-zoom-layer-fix')) {
    const st = document.createElement('style'); st.id = 'qa-zoom-layer-fix';
    st.textContent = '#zmmtg-root{z-index:2147483000!important}';
    document.head.appendChild(st);
  }
  for (const f of ['react.min.js', 'react-dom.min.js', 'redux.min.js', 'redux-thunk.min.js', 'lodash.min.js']) {
    await qaLoadScript(`${base}/lib/vendor/${f}`);
  }
  await qaLoadScript(`https://source.zoom.us/zoom-meeting-${QA_ZOOM_SDK_VER}.min.js`);
}
// Full screen for the Zoom classroom: always the whole page, because Zoom's Client View
// lives in its own layer (#zmmtg-root) outside the live video box.
function qaFsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function qaEnterPageFs() {
  const d = document.documentElement;
  const req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (req) { try { const r = req.call(d); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
}
function qaExitFs() {
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  if (ex) { try { const r = ex.call(document); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
}
window.qaZoomToggleFullscreen = function () {
  const fs = qaFsElement();
  if (fs === document.documentElement) return qaExitFs();
  if (fs) { qaExitFs(); setTimeout(qaEnterPageFs, 60); return; }
  qaEnterPageFs();
};
function qaAddZoomFsButton() {
  if (document.getElementById('qa-zoom-fs')) return;
  const b = document.createElement('button');
  b.id = 'qa-zoom-fs'; b.type = 'button';
  b.setAttribute('aria-label', 'Full Screen');
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483001;background:rgba(15,23,42,.82);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:8px 12px;font:600 13px system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px)';
  const label = () => { b.textContent = qaFsElement() ? '✕ Exit Full Screen' : '⛶ Full Screen'; };
  b.onclick = () => { window.qaZoomToggleFullscreen(); };
  document.addEventListener('fullscreenchange', label);
  document.addEventListener('webkitfullscreenchange', label);
  label();
  document.body.appendChild(b);
}

window.qaJoinZoomClass = async function () {
  const session = window._qaZoomSession;
  const btn = document.getElementById('btn-qa-zoom-join');
  const status = document.getElementById('qa-zoom-status');
  const say = (t) => { if (status) status.textContent = t; };
  if (!session || !session.id) return;
  // A full-screen live box would hide Zoom's classroom layer; switch to whole-page full screen now (user gesture)
  const curFs = qaFsElement();
  if (curFs && curFs !== document.documentElement) { qaExitFs(); setTimeout(qaEnterPageFs, 60); }
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }
  try {
    say('Class se connect ho raha hai…');
    const res = await apiFetch(`get-live-session&id=${encodeURIComponent(session.id)}&zoomJoin=1`);
    const j = (res && res.zoomJoin) || {};
    if (j.mode === 'app' && j.joinUrl) {
      window.open(j.joinUrl, '_blank', 'noopener');
      say('Zoom app me class khul rahi hai…');
      if (btn) { btn.disabled = false; btn.textContent = '▶ Join Class'; }
      return;
    }
    if (j.mode !== 'sdk') throw new Error('Class join nahi ho payi. Thodi der baad try karein.');
    say('Classroom load ho raha hai…');
    await qaLoadZoomClientSdk();
    ZoomMtg.setZoomJSLib(`https://source.zoom.us/${QA_ZOOM_SDK_VER}/lib`, '/av');
    ZoomMtg.preLoadWasm();
    ZoomMtg.prepareWebSDK();
    try { ZoomMtg.i18n.load('en-US'); } catch (_) {}
    await new Promise((resolve, reject) => ZoomMtg.init({
      leaveUrl: window.location.href.split('#')[0],
      patchJsMedia: true,
      defaultView: 'speaker',
      showMeetingHeader: false,                                   // header shows the meeting number
      meetingInfo: ['topic', 'host', 'participant', 'dc', 'enctype'], // no ID / passcode / invite link
      disableInvite: true,
      disableCallOut: true,
      disableRecord: true,
      isSupportChat: true,
      screenShare: !!session.allowStudentScreen,
      success: resolve,
      error: (e) => reject(new Error((e && (e.errorMessage || e.reason)) || 'Zoom start nahi hua'))
    }));
    await new Promise((resolve, reject) => ZoomMtg.join({
      signature: j.signature, sdkKey: j.sdkKey, meetingNumber: j.meetingNumber, passWord: j.password,
      userName: j.userName, userEmail: j.userEmail || '',
      success: resolve,
      error: (e) => reject(new Error((e && (e.errorMessage || e.reason)) || 'Class join nahi ho payi'))
    }));
    say('');
    qaAddZoomFsButton();
  } catch (err) {
    say((err && err.message) || 'Class join nahi ho payi.');
    if (btn) { btn.disabled = false; btn.textContent = '▶ Join Class'; }
  }
};
