// alumni/alumni.js — Official Alumni Directory & Video Testimonials Script

var currentAlumniList = [];
var activeCourseCategory = 'all';

document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('alm-cards-grid');
  var countMeta = document.getElementById('alm-count-meta');
  var searchInput = document.getElementById('alm-search-input');
  var cityFilter = document.getElementById('alm-city-filter');
  var categoryTabs = document.querySelectorAll('.alm-tab-btn');

  // Fetch verified alumni from API / JSON
  function fetchAlumni() {
    fetch('../api/lms.php?action=get-alumni')
      .then(function (res) {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then(function (data) {
        if (data.ok && Array.isArray(data.alumni) && data.alumni.length > 0) {
          currentAlumniList = data.alumni;
          renderAlumni();
          renderHeroMarquee(currentAlumniList);
        } else {
          loadFallbackAlumni();
        }
      })
      .catch(function () {
        loadFallbackAlumni();
      });
  }

  function loadFallbackAlumni() {
    fetch('../data/alumni.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0) {
          currentAlumniList = data;
        } else {
          currentAlumniList = getDefaultAlumniList();
        }
        renderAlumni();
        renderHeroMarquee(currentAlumniList);
      })
      .catch(function () {
        currentAlumniList = getDefaultAlumniList();
        renderAlumni();
        renderHeroMarquee(currentAlumniList);
      });
  }

  function renderAlumni() {
    var query = (searchInput ? searchInput.value.trim().toLowerCase() : '');
    var selectedCity = (cityFilter ? cityFilter.value : 'all');

    var filtered = currentAlumniList.filter(function (alm) {
      // 1. Text Search matching
      var nameMatch = (alm.name || '').toLowerCase().indexOf(query) !== -1;
      var studioMatch = (alm.studioName || '').toLowerCase().indexOf(query) !== -1;
      var cityMatch = (alm.city || '').toLowerCase().indexOf(query) !== -1;
      var roleMatch = (alm.role || '').toLowerCase().indexOf(query) !== -1;
      var matchesSearch = !query || nameMatch || studioMatch || cityMatch || roleMatch;

      // 2. City Filter
      var matchesCity = (selectedCity === 'all') || 
                        ((alm.city || '').toLowerCase().indexOf(selectedCity.toLowerCase()) !== -1) ||
                        ((alm.state || '').toLowerCase().indexOf(selectedCity.toLowerCase()) !== -1);

      // 3. Category Tab Filter
      var matchesCategory = true;
      if (activeCourseCategory !== 'all') {
        var catLower = activeCourseCategory.toLowerCase();
        var courseStr = (alm.course || '').toLowerCase();
        var roleStr = (alm.role || '').toLowerCase();
        var batchStr = (alm.batch || '').toLowerCase();
        matchesCategory = courseStr.indexOf(catLower) !== -1 || roleStr.indexOf(catLower) !== -1 || batchStr.indexOf(catLower) !== -1;
      }

      return matchesSearch && matchesCity && matchesCategory;
    });

    if (countMeta) {
      countMeta.textContent = 'Showing ' + filtered.length + ' certified ' + (filtered.length === 1 ? 'alumnus' : 'alumni');
    }

    if (!grid) return;
    grid.innerHTML = '';

    if (filtered.length === 0) {
      showEmptyState('No graduates match your search criteria. Try a different city or category.');
      return;
    }

    filtered.forEach(function (alm) {
      var card = document.createElement('div');
      card.className = 'alm-card';

      var photoSrc = alm.photo || '../home-assets/6a62e4eb3643ad.jpeg';
      var studioText = alm.studioName ? escapeHtml(alm.studioName) : 'Independent Creative Studio';
      var roleText = alm.role ? escapeHtml(alm.role) : 'Certified Editor';
      var cityText = (alm.city ? escapeHtml(alm.city) : 'Siwan') + (alm.state ? ', ' + escapeHtml(alm.state) : '');
      var batchText = alm.batch ? escapeHtml(alm.batch) : '14-Week Studio Batch';
      var certId = alm.certId || 'QAA-2025-VERIFIED';
      var highlight = alm.highlight ? escapeHtml(alm.highlight) : 'Specialized in 4K wedding post-production & cinematic skin tone color wheels.';

      var featuredBadgeHtml = alm.featured ? '<span class="alm-card-featured-badge">⭐ FEATURED</span>' : '';
      var igUrl = /^https?:\/\//i.test(String(alm.instagram || '').trim()) ? String(alm.instagram).trim() : '';
      var igHtml = igUrl ? '<a href="' + escapeHtml(igUrl) + '" target="_blank" rel="noopener noreferrer" class="alm-social-btn">Instagram ↗</a>' : '';

      card.innerHTML =
        featuredBadgeHtml +
        '<div class="alm-card-header">' +
          '<div class="alm-avatar-wrap">' +
            '<img src="' + escapeHtml(/^\s*(javascript|vbscript|data:text)/i.test(photoSrc) ? '../home-assets/6a62e4eb3643ad.jpeg' : photoSrc) + '" alt="' + escapeHtml(alm.name) + '" width="72" height="72" loading="lazy" onerror="this.src=\'../assets/anil-sharma.webp\'">' +
          '</div>' +
          '<div class="alm-card-meta">' +
            '<h3>' + escapeHtml(alm.name) + '</h3>' +
            '<div class="alm-studio-tag">🎬 ' + studioText + '</div>' +
            '<div class="alm-role-tag">' + roleText + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="alm-badges-row">' +
          '<span class="alm-loc-badge">📍 ' + cityText + '</span>' +
          '<span class="alm-batch-badge">🎓 ' + batchText + '</span>' +
        '</div>' +
        '<div class="alm-highlight-quote">“' + highlight + '”</div>' +
        '<div class="alm-card-footer">' +
          '<a href="../portal/?cert=' + encodeURIComponent(certId) + '" class="alm-cert-pill" title="Verify ISO Certificate">' +
            '<span>🛡️ ' + escapeHtml(certId) + '</span>' +
          '</a>' +
          igHtml +
        '</div>';

      grid.appendChild(card);
    });
  }

  function showEmptyState(msg) {
    if (!grid) return;
    grid.innerHTML =
      '<div class="alm-empty-card">' +
        '<div style="font-size:36px;margin-bottom:12px;">🔍</div>' +
        '<p style="font-size:15px;color:#cbd5e1;margin:0 0 10px 0;font-weight:700;">No Alumni Found</p>' +
        '<p style="font-size:13.5px;color:#94a3b8;margin:0;">' + escapeHtml(msg) + '</p>' +
      '</div>';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Dynamically populate Hero Section 3-column marquee from live alumni data
  function renderHeroMarquee(list) {
    var col1Track = document.getElementById('alm-hero-track-1');
    var col2Track = document.getElementById('alm-hero-track-2');
    var col3Track = document.getElementById('alm-hero-track-3');
    if (!col1Track || !col2Track || !col3Track || !list || list.length === 0) return;

    var c1 = [], c2 = [], c3 = [];
    list.forEach(function (alm, idx) {
      if (idx % 3 === 0) c1.push(alm);
      else if (idx % 3 === 1) c2.push(alm);
      else c3.push(alm);
    });

    function createCardHtml(alm, isAccent) {
      var photo = alm.photo || '../home-assets/6a62e4eb3643ad.jpeg';
      var name = escapeHtml(alm.name || 'Alumnus');
      var studio = escapeHtml(alm.studioName || 'Creative Studio');
      var loc = escapeHtml(alm.city || 'Bihar');
      return '<div class="alm-hero-card' + (isAccent ? ' alm-hero-card-accent' : '') + '">' +
               '<span class="alm-hero-card-name">' + name + '</span>' +
               '<div class="alm-hero-card-img-wrap">' +
                 '<img src="' + photo + '" alt="' + name + '" width="116" height="116" loading="lazy" onerror="this.src=\'../home-assets/6a62e4eb3643ad.jpeg\'">' +
               '</div>' +
               '<div class="alm-hero-card-footer">' +
                 '<span class="alm-hero-card-studio">' + studio + '</span>' +
                 '<span class="alm-hero-card-loc">📍 ' + loc + '</span>' +
               '</div>' +
             '</div>';
    }

    function buildTrack(items, isAccent) {
      if (!items || items.length === 0) return '';
      var expanded = items.slice();
      while (expanded.length < 4) {
        expanded = expanded.concat(items);
      }
      var cardsHtml = expanded.map(function(item) {
        return createCardHtml(item, isAccent);
      }).join('');
      // Duplicate set for seamless continuous marquee loop (0% to -50%)
      return cardsHtml + cardsHtml;
    }

    col1Track.innerHTML = buildTrack(c1, false);
    col2Track.innerHTML = buildTrack(c2, true);
    col3Track.innerHTML = buildTrack(c3, false);
  }

  // Category Tabs click listeners
  if (categoryTabs) {
    categoryTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        categoryTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        activeCourseCategory = tab.getAttribute('data-course') || 'all';
        renderAlumni();
      });
    });
  }

  // Search Input listener
  if (searchInput) {
    searchInput.addEventListener('input', renderAlumni);
  }

  // City Filter listener
  if (cityFilter) {
    cityFilter.addEventListener('change', renderAlumni);
  }

  // Initialize
  fetchAlumni();
});

// Video Modal Player logic
function openAlumniVideo(videoId, title) {
  var modal = document.getElementById('alm-video-modal');
  var container = document.getElementById('alm-video-frame-container');
  var titleEl = document.getElementById('alm-modal-video-title');

  if (!modal || !container) return;

  if (titleEl && title) {
    titleEl.textContent = title;
  }

  container.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAlumniVideo() {
  var modal = document.getElementById('alm-video-modal');
  var container = document.getElementById('alm-video-frame-container');

  if (modal) modal.style.display = 'none';
  if (container) container.innerHTML = '';
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeAlumniVideo();
  }
});

// Real admitted student alumni records
function getDefaultAlumniList() {
  return [
    {
      id: "QAA-OFF-2026-B6D2C",
      name: "Vivek Kumar",
      photo: "/uploads/admissions/photo_0441ed2e48.jpg",
      studioName: "Vivek visual Studio",
      role: "Wedding Videographer / Cameraman",
      city: "Banka",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-B6D2C",
      instagram: "https://www.instagram.com/vivekvisualstudio?stkn=MTIxMHNrMnRscHR5Zw=",
      highlight: "I want to learn professional photography, videography, video editing, and cinematic shooting from Quick Art Academy and develop my skills for a successful career in the creative field.",
      featured: true
    },
    {
      id: "QAA-OFF-2026-DB3F8",
      name: "Santosh kumar mahto",
      photo: "/uploads/admissions/photo_878dc7e226.jpg",
      studioName: "Viraj Film 🎥",
      role: "Wedding Videographer / Cameraman",
      city: "Muzaffarpur",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-DB3F8",
      instagram: "https://www.instagram.com/santosh_chaudhary_86?stkn=dHdyenU3NmlubTJ1",
      highlight: "Viraj Film ko next level tak le jana hai",
      featured: true
    },
    {
      id: "QAA-OFF-2026-9131C",
      name: "Ibadat Hussian",
      photo: "/uploads/admissions/photo_13e9901e5d.jpg",
      studioName: "Vision2hell",
      role: "Creative Video Editor & Filmmaker",
      city: "Hathua Gopalganj",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-9131C",
      instagram: "https://www.instagram.com/ibadattt____47?stkn=dzlvMnl3aTNxdHly&utm_source=qr",
      highlight: "My career goal is to become a professional Video Editor and Cinematographer, creating high-quality, creative and impactful visual content while continuously improving my technical and creative skills.",
      featured: true
    },
    {
      id: "QAA-OFF-2026-7D0F5",
      name: "ADITYA KUMAR DUBEY",
      photo: "/uploads/admissions/photo_034ec0dec5.jpg",
      studioName: "DUBEY STUDIO",
      role: "Wedding Videographer / Cameraman",
      city: "HATHUA",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-7D0F5",
      instagram: "https://www.instagram.com/bittu_dubey_33?stkn=MWVoOWxqaDFmdDQyaw==",
      highlight: "Me yaha se complete photography ka kam sikhna chahta hu photo editing video editing etc.",
      featured: true
    },
    {
      id: "QAA-OFF-2026-16431",
      name: "Aditya Kumar",
      photo: "/uploads/admissions/photo_2631dbb6ef.jpg",
      studioName: "Divya Films",
      role: "Studio Owner / Founder",
      city: "Gopalganj",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-16431",
      instagram: "https://www.instagram.com/divya_films_1?igsh=amR6eDJhN2owMHE5",
      highlight: "Divya Films Photography Ko Bihar Ka best Photography/Filmmaking Studio Banana h",
      featured: true
    },
    {
      id: "QAA-OFF-2026-68143",
      name: "Raj Aryan Gupta",
      photo: "/uploads/admissions/photo_7a5fecc291.jpg",
      studioName: "Sanam Film Siwan",
      role: "Wedding Videographer / Cameraman",
      city: "Siwan",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-68143",
      instagram: "https://www.instagram.com/sanam_films_siwan09?stkn=MWMycGc5bmxpcXEx",
      highlight: "Sanam FIlm Ko Bihar ke Best Wedding Photography Company Bana Hai",
      featured: true
    },
    {
      id: "QAA-OFF-2026-06BEC",
      name: "Subhash Kumar",
      photo: "/uploads/admissions/photo_638fd8481a.jpg",
      studioName: "Maa sharda wedding film's",
      role: "Creative Video Editor & Filmmaker",
      city: "Jamui",
      state: "Bihar",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-06BEC",
      instagram: "https://www.instagram.com/m.s_weddings_films?stkn=MTJzYm42cXBqY3l3bA==",
      highlight: "Cinematic video editing.album designing",
      featured: true
    },
    {
      id: "QAA-OFF-2026-50C77",
      name: "Vipin",
      photo: "/uploads/admissions/photo_0e4e54bcce.jpg",
      studioName: "Vipnesh films production",
      role: "Freelance Video Editor",
      city: "Faizabad ayodhya",
      state: "Uttar Pradesh",
      batch: "Studio Batch 2026",
      course: "Wedding Filmmaking & Post-Production Course",
      certId: "QAA-OFF-2026-50C77",
      instagram: "https://www.instagram.com/official.vipnesh01?stkn=bzZpcXFrM3didWdl",
      highlight: "Mujhe academy se yahi sikhna chahta hun music video editing professional colour grading client manage karna",
      featured: true
    }
  ];
}
