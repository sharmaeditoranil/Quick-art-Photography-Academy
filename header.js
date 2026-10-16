(() => {
 const header=document.getElementById('qaaHeader');if(!header?.classList.contains('ref-header'))return;
 // Keep shared navigation consistent across the static course pages.
  const online=header.querySelector('#ref-online');
  const album=header.querySelector('#ref-courses a[href*="album-design"]');
  if(online&&album){
   const label='Video Editing Course <small class="ref-ai-label">AI Powered</small>';
   const tab0 = online.querySelector('#ref-online-tab-0');
   if (tab0) tab0.innerHTML='<span class="ref-category-label">'+label+'</span><span aria-hidden="true">›</span>';
   const p0 = online.querySelector('#ref-online-panel-0 :is(h2, .ref-panel-title)');
   if (p0) p0.innerHTML=label;
   const design=online.querySelector('#ref-online-panel-2');
   if (design) {
     const marketing=design.cloneNode(true);marketing.id='ref-online-panel-3';marketing.setAttribute('aria-labelledby','ref-online-tab-3');
     const mTitle = marketing.querySelector(':is(h2, .ref-panel-title)');
     if (mTitle) mTitle.textContent='Digital Marketing';
     design.after(marketing);
     const onlineSample=online.querySelector('a[href*="premiere-pro-course"]')||online.querySelector('a[href*="edius-course"]')||online.querySelector('a');
     let onlineAlbumHref='online/album-design-course/';
     if(onlineSample){
      const s=onlineSample.getAttribute('href');
      if(s.includes('premiere-pro-course/'))onlineAlbumHref=s.replace('premiere-pro-course/','album-design-course/').replace('index.html','');
      else if(s.includes('edius-course/'))onlineAlbumHref=s.replace('edius-course/','album-design-course/').replace('index.html','');
      else onlineAlbumHref=s.replace(/[^/]+\/?$/,'album-design-course/').replace('index.html','');
     }
     const onlineAlbumCard=document.createElement('a');onlineAlbumCard.className='ref-course';onlineAlbumCard.href=onlineAlbumHref;
     onlineAlbumCard.innerHTML='<span class="ref-course-icon" aria-hidden="true">Ad</span><span>Wedding Album Design</span>';
     const dTitle = design.querySelector(':is(h2, .ref-panel-title)');
     if (dTitle) dTitle.textContent='Graphics Design Course';
     const dGrid = design.querySelector('.ref-card-grid');
     if (dGrid) dGrid.replaceChildren(onlineAlbumCard);
     const tab=online.querySelector('#ref-online-tab-2');
     if (tab) {
       tab.innerHTML='Graphics Design Course<span aria-hidden="true">›</span>';
       const next=tab.cloneNode(true);next.id='ref-online-tab-3';next.setAttribute('aria-controls','ref-online-panel-3');next.innerHTML='Digital Marketing<span aria-hidden="true">›</span>';tab.after(next);
     }
     const mobileOnline=header.querySelector('#ref-mobile details, .ref-mobile details, .ref-mobile-nav details');
     if(mobileOnline){
       const groups=mobileOnline.querySelectorAll('.ref-mobile-group');
       if(groups[0])groups[0].innerHTML=label;
       if(groups[2]){groups[2].textContent='Graphics Design Course';const card=onlineAlbumCard.cloneNode(true);groups[2].after(card);const heading=document.createElement('p');heading.className='ref-mobile-group';heading.textContent='Digital Marketing';card.after(heading);}
     }
     let onlineAutomationHref='online/automation-course/';
     if(onlineSample){
      const s=onlineSample.getAttribute('href');
      if(s.includes('premiere-pro-course/'))onlineAutomationHref=s.replace('premiere-pro-course/','automation-course/').replace('index.html','');
      else if(s.includes('edius-course/'))onlineAutomationHref=s.replace('edius-course/','automation-course/').replace('index.html','');
      else if(s.includes('online/'))onlineAutomationHref=s.replace(/online\/.*$/,'online/automation-course/').replace('index.html','');
      else onlineAutomationHref=s.replace(/[^/]+\/?$/,'automation-course/').replace('index.html','');
     }
     const marketingCard=marketing.querySelector('a[href*="digital-marketing-course/"]');
     if (marketingCard) {
       const marketingCards=['Google and Facebook Ads Course','SEO Course','GMB Profile Course'].map((title,i)=>{const card=marketingCard.cloneNode(true);const icon = card.querySelector('.ref-course-icon'); if (icon) icon.textContent=['Ads','SEO','GMB'][i];const span = card.querySelector('span:last-child'); if (span) span.textContent=title;return card;});
       const automationCard=marketingCard.cloneNode(true);
       automationCard.href=onlineAutomationHref;
       const aIcon = automationCard.querySelector('.ref-course-icon');
       if (aIcon) aIcon.textContent='AI';
       const aSpan = automationCard.querySelector('span:last-child');
       if (aSpan) aSpan.textContent='Studio Automation & AI CRM';
       const mGrid = marketing.querySelector('.ref-card-grid');
       if (mGrid) mGrid.replaceChildren(...marketingCards, automationCard);
       if(mobileOnline){
         mobileOnline.querySelectorAll('a[href*="website-design-course/"],a[href*="automation-course/"]').forEach(card=>card.remove());
         const oldMobileMarketing=mobileOnline.querySelector('a[href*="digital-marketing-course/"]');
         if(oldMobileMarketing){oldMobileMarketing.replaceWith(...marketingCards.map(card=>card.cloneNode(true)), automationCard.cloneNode(true));}
       }
     }
   }
  }

  // Ensure "View All Online Programs" is prominently present in all online panels & mobile nav
  if(online){
   let onlineHubHref = 'online/';
   const sampleOnline = online.querySelector('a[href*="premiere-pro-course"]') || online.querySelector('a[href*="edius-course"]');
   if(sampleOnline){
    const s = sampleOnline.getAttribute('href');
    if(s.includes('online/')){
     onlineHubHref = s.replace(/online\/.*$/, 'online/').replace('index.html','');
    } else {
     onlineHubHref = s.replace(/[^/]+\/?.*$/, './').replace('index.html','');
    }
   }

   online.querySelectorAll('.ref-panels > [role="tabpanel"]').forEach(panel => {
    let allLink = panel.querySelector('.ref-all-online');
    if(!allLink){
     allLink = document.createElement('a');
     allLink.className = 'ref-all ref-all-online';
     panel.append(allLink);
    }
    allLink.href = onlineHubHref;
    allLink.innerHTML = 'View all online programs →';
   });

   const mobileOnline = header.querySelector('#ref-mobile details, .ref-mobile details, .ref-mobile-nav details');
   if(mobileOnline){
    let allMobileLink = mobileOnline.querySelector('.ref-mobile-all-online');
    if(!allMobileLink){
     allMobileLink = document.createElement('a');
     allMobileLink.className = 'ref-mobile-all-online';
     allMobileLink.innerHTML = 'View all online programs →';
     allMobileLink.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:6px 0;margin:12px 0 6px;background:none;border:none;color:#8c5f20;font-weight:600;font-size:13px;text-decoration:none;';
     mobileOnline.append(allMobileLink);
    }
    allMobileLink.href = onlineHubHref;
   }
  }

 const mobileNav=header.querySelector('#ref-mobile, .ref-mobile, .ref-mobile-nav');
 const campus=header.querySelector('#ref-courses');
 if(campus){
  const vCard=campus.querySelector('a[href*="courses/video-editing/"]');
  const gCard=campus.querySelector('a[href*="album-design/"]');
  const wCard=campus.querySelector('a[href*="ai-wedding-filmmaking/"]');
  if (vCard && gCard && wCard) {
    const video=vCard.cloneNode(true);
    const graphics=gCard.cloneNode(true);
    const wedding=wCard.cloneNode(true);
    const vSpan = video.querySelector('span:last-child');
    if (vSpan) vSpan.innerHTML='Video Editing Course<small class="ref-ai-label">AI Powered</small>';
    const gSpan = graphics.querySelector('span:last-child');
    if (gSpan) gSpan.textContent='Wedding Album Design';
    const wSpan = wedding.querySelector('span:last-child');
    if (wSpan) wSpan.textContent='Wedding Filmmaking Course';
    const categories=campus.querySelector('.ref-categories'),panels=campus.querySelector('.ref-panels');
    if (categories && panels) {
      categories.replaceChildren();panels.replaceChildren();
      const aiMarketing=wedding.cloneNode(true);
      const rawHref = wedding.getAttribute('href') || '';
      if (rawHref.includes('ai-wedding-filmmaking/')) {
        aiMarketing.href = rawHref.replace('ai-wedding-filmmaking/', 'ai-digital-marketing/');
      } else if (rawHref.includes('video-editing/')) {
        aiMarketing.href = rawHref.replace('video-editing/', 'ai-digital-marketing/');
      } else if (rawHref.includes('album-design/')) {
        aiMarketing.href = rawHref.replace('album-design/', 'ai-digital-marketing/');
      } else {
        aiMarketing.href = 'courses/ai-digital-marketing/';
      }
      const aiSpan = aiMarketing.querySelector('span:last-child');
      if (aiSpan) aiSpan.textContent='AI Marketing Course (Free)';
      const aiIcon = aiMarketing.querySelector('.ref-course-icon');
      if (aiIcon) aiIcon.textContent='AI';
      const entries=[['Video Editing Course',video,true],['Graphics Design',graphics,false],['Wedding Filmmaking Course',wedding,false],['AI Marketing Course (Free)',aiMarketing,false]];
      entries.forEach(([name,card,ai],i)=>{
       const tab=document.createElement('button');tab.type='button';tab.id='ref-courses-tab-'+i;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','ref-courses-panel-'+i);tab.setAttribute('aria-selected',String(i===0));tab.tabIndex=i===0?0:-1;
       tab.innerHTML='<span class="ref-category-label">'+name+(ai?'<small class="ref-ai-label">AI Powered</small>':'')+'</span><span aria-hidden="true">›</span>';categories.append(tab);
       const panel=document.createElement('div');panel.id='ref-courses-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.hidden=i!==0;
       const heading=document.createElement('div');heading.className='ref-panel-title';heading.textContent=name;const grid=document.createElement('div');grid.className='ref-card-grid';grid.append(card);panel.append(heading,grid);panels.append(panel);
      });
      if (mobileNav) {
        const mobileCampus=[...mobileNav.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.trim()==='On Campus Programs');
        if(mobileCampus){const summary=mobileCampus.querySelector('summary');mobileCampus.replaceChildren(summary,video.cloneNode(true));const heading=document.createElement('p');heading.className='ref-mobile-group';heading.textContent='Graphics Design';mobileCampus.append(heading,graphics.cloneNode(true),wedding.cloneNode(true),aiMarketing.cloneNode(true));}
      }
    }
  }
 }
 const contact=header.querySelector('.ref-nav>a[href*="contact-us"]');
 if(mobileNav&&contact){const cta=document.createElement('a');cta.className='ref-demo-cta';cta.href=contact.href;cta.textContent='Book Free Demo';mobileNav.append(cta);}

 // ── Remove Admission from header (moved to footer as "Apply Admission Form") ──
 header.querySelectorAll('a[href*="admission"]').forEach(a => a.remove());

 // ── Seamless Alumni & About Us Navigation ──
 const sampleNav = header.querySelector('.ref-nav a[href*="about-us"], .ref-nav a[href*="master-class"], .ref-nav a[href*="contact-us"]');
 let navPrefix = '';
 if (sampleNav) {
   const href = sampleNav.getAttribute('href') || '';
   if (href.startsWith('../../')) navPrefix = '../../';
   else if (href.startsWith('../')) navPrefix = '../';
   else navPrefix = '';
 }

 const desktopNav = header.querySelector('.ref-nav');
 const freeResPanel = header.querySelector('#ref-resources');

 // 1. Move "About Us" into "Free Resources" dropdown (remove from main top-level navbar)
 if (desktopNav) {
   const topAboutLinks = Array.from(desktopNav.children).filter(el => {
     return el.tagName === 'A' && (el.getAttribute('href') || '').toLowerCase().includes('about-us');
   });
   topAboutLinks.forEach(a => a.remove());

   // 2. Ensure "Alumni" is present on the main top-level navbar
   const topLevelAlumni = Array.from(desktopNav.children).filter(el => {
     if (el.tagName !== 'A') return false;
     const h = (el.getAttribute('href') || '').toLowerCase();
     const t = el.textContent.trim().toLowerCase();
     return h.includes('alumni') || t === 'alumni';
   });

   if (topLevelAlumni.length === 0) {
     const contactLink = Array.from(desktopNav.children).find(el => el.tagName === 'A' && (el.getAttribute('href') || '').includes('contact-us'));
     const freeResEl = desktopNav.querySelector('.ref-resources') || desktopNav.querySelector('.ref-dropdown:last-of-type');
     const alumniA = document.createElement('a');
     alumniA.href = `${navPrefix}alumni/`;
     alumniA.className = 'ref-alumni-nav-link';
     alumniA.textContent = 'Alumni';

     if (contactLink) {
       desktopNav.insertBefore(alumniA, contactLink);
     } else if (freeResEl && freeResEl.nextSibling) {
       desktopNav.insertBefore(alumniA, freeResEl.nextSibling);
     } else {
       desktopNav.append(alumniA);
     }
   } else if (topLevelAlumni.length > 1) {
     const activeLink = topLevelAlumni.find(a => a.classList.contains('ref-active-page') || a.style.color === '#f59e0b') || topLevelAlumni[0];
     topLevelAlumni.forEach(a => {
       if (a !== activeLink) a.remove();
     });
   }

    // 3. Build sleek Free Resources dropdown matching the icon-box + label row layout and website color theme
    if (freeResPanel) {
      const currentPath = (window.location.pathname || '').toLowerCase();
      const resItems = [
        {
          href: `${navPrefix}about-us/`,
          title: 'About Us',
          iconColor: '#f3d695',
          isActive: currentPath.includes('/about-us'),
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-3"></path><path d="M9 9h1"></path><path d="M9 13h1"></path><path d="M9 17h1"></path></svg>'
        },
        {
          href: `${navPrefix}blog/`,
          title: 'Blog',
          iconColor: '#38bdf8',
          isActive: currentPath.includes('/blog'),
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8V6Z"></path></svg>'
        },
        {
          href: `${navPrefix}curriculum/`,
          title: 'Course Curriculum (14-Weeks)',
          iconColor: '#a78bfa',
          isActive: currentPath.includes('/curriculum'),
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
        },
        {
          href: `${navPrefix}downloads/course-details.pdf`,
          title: 'Download Course Details PDF',
          iconColor: '#f87171',
          target: '_blank',
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>'
        },
        {
          href: 'https://www.youtube.com/@QuickartPhotographyAcademy/videos',
          title: 'YouTube · Free Courses',
          iconColor: '#fb7185',
          target: '_blank',
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon></svg>'
        },
        {
          href: `${navPrefix}alumni/`,
          title: 'Alumni Directory & Hall of Fame',
          iconColor: '#fbbf24',
          isActive: currentPath.includes('/alumni'),
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>'
        },
        {
          href: `${navPrefix}downloads/quickart-academy-release.apk`,
          title: 'Download Our App (APK)',
          iconColor: '#34d399',
          download: 'quickart-academy.apk',
          svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'
        }
      ];

      freeResPanel.innerHTML = `
        <div class="ref-res-list">
          ${resItems.map(item => `
            <a href="${item.href}" class="ref-res-item${item.isActive ? ' ref-res-active' : ''}"${item.target ? ` target="${item.target}" rel="noopener noreferrer"` : ''}${item.download ? ` download="${item.download}"` : ''}>
              <span class="ref-res-icon-box" style="color:${item.iconColor};">
                ${item.svg}
              </span>
              <span class="ref-res-label">${item.title}</span>
            </a>
          `).join('')}
        </div>
      `;
    }
 }

 // 3. Mobile Navigation: Move About Us into Free Resources accordion, ensure Alumni in main list
 if (mobileNav) {
   const mobTopAbout = Array.from(mobileNav.children).filter(el => {
     return el.tagName === 'A' && (el.getAttribute('href') || '').toLowerCase().includes('about-us');
   });
   mobTopAbout.forEach(a => a.remove());

   const mobileResources = [...mobileNav.querySelectorAll('details')].find(detail => detail.querySelector('summary')?.textContent.trim() === 'Free Resources');
   if (mobileResources && !mobileResources.querySelector('a[href*="about-us"]')) {
     const mobAboutA = document.createElement('a');
     mobAboutA.className = 'ref-course';
     mobAboutA.href = `${navPrefix}about-us/`;
     mobAboutA.innerHTML = '<span class="ref-course-icon" aria-hidden="true">Ab</span><span>About Us &amp; Mentors</span>';
     const firstCourseInRes = mobileResources.querySelector('.ref-course');
     if (firstCourseInRes) {
       mobileResources.insertBefore(mobAboutA, firstCourseInRes);
     } else {
       mobileResources.append(mobAboutA);
     }
   }

   // Ensure Course Curriculum (14-Weeks) and Download Course Details (PDF) in mobile Free Resources
   if (mobileResources && !mobileResources.querySelector('a[href*="curriculum"]')) {
     const mobCurrA = document.createElement('a');
     mobCurrA.className = 'ref-course';
     mobCurrA.href = `${navPrefix}curriculum/`;
     mobCurrA.innerHTML = '<span class="ref-course-icon" aria-hidden="true">Cu</span><span>Course Curriculum (14-Weeks)</span>';
     const brochureMobA = mobileResources.querySelector('a[href*="course-details.pdf"]');
     if (brochureMobA) {
       mobileResources.insertBefore(mobCurrA, brochureMobA);
     } else {
       mobileResources.append(mobCurrA);
     }
   }
   const brochureMobA = mobileResources.querySelector('a[href*="course-details.pdf"]');
   if (brochureMobA) {
     const labelSpan = brochureMobA.querySelector('span:last-child');
     if (labelSpan) labelSpan.textContent = 'Download Course Details (PDF)';
     brochureMobA.href = `${navPrefix}downloads/course-details.pdf`;
     brochureMobA.setAttribute('target', '_blank');
     brochureMobA.setAttribute('rel', 'noopener noreferrer');
   } else {
     const mobPdfA = document.createElement('a');
     mobPdfA.className = 'ref-course';
     mobPdfA.href = `${navPrefix}downloads/course-details.pdf`;
     mobPdfA.setAttribute('target', '_blank');
     mobPdfA.setAttribute('rel', 'noopener noreferrer');
     mobPdfA.innerHTML = '<span class="ref-course-icon" aria-hidden="true">Pd</span><span>Download Course Details (PDF)</span>';
     mobileResources.append(mobPdfA);
   }

   const topLevelMobAlumni = Array.from(mobileNav.children).filter(el => {
     if (el.tagName !== 'A') return false;
     const h = (el.getAttribute('href') || '').toLowerCase();
     const t = el.textContent.toLowerCase();
     return h.includes('alumni') || t.includes('alumni');
   });

   if (topLevelMobAlumni.length === 0) {
     const mobContact = Array.from(mobileNav.children).find(el => el.tagName === 'A' && (el.getAttribute('href') || '').includes('contact-us'));
     const mobAlumniA = document.createElement('a');
     mobAlumniA.href = `${navPrefix}alumni/`;
     mobAlumniA.textContent = 'Alumni Hall of Fame';

     if (mobContact) {
       mobileNav.insertBefore(mobAlumniA, mobContact);
     } else {
       mobileNav.append(mobAlumniA);
     }
   } else if (topLevelMobAlumni.length > 1) {
     for (let i = 1; i < topLevelMobAlumni.length; i++) {
       topLevelMobAlumni[i].remove();
     }
   }

   if (mobileResources && !mobileResources.querySelector('a[href*="alumni"]')) {
     const mobAlumniCourse = document.createElement('a');
     mobAlumniCourse.className = 'ref-course';
     mobAlumniCourse.href = `${navPrefix}alumni/`;
     mobAlumniCourse.innerHTML = '<span class="ref-course-icon" aria-hidden="true">Al</span><span>Alumni Directory &amp; Hall of Fame</span>';
     const appLink = mobileResources.querySelector('a[href*="play.google.com"]');
     if (appLink) {
       mobileResources.insertBefore(mobAlumniCourse, appLink);
     } else {
       mobileResources.append(mobAlumniCourse);
     }
   }
 }

 // 4. Highlight Active Page
 const currentPath = window.location.pathname.toLowerCase();
 const currentHref = window.location.href.toLowerCase();
 if (currentPath.includes('/alumni') || currentHref.includes('/alumni')) {
   header.querySelectorAll('a').forEach(a => {
     const h = (a.getAttribute('href') || '').toLowerCase();
     const t = a.textContent.trim().toLowerCase();
     if ((h.includes('alumni') || t === 'alumni' || t === 'alumni hall of fame') && !a.closest('#ref-resources') && !a.closest('details')) {
       a.classList.add('ref-active-page');
       a.style.color = '#f59e0b';
       a.style.fontWeight = '700';
     }
   });
 } else if (currentPath.includes('/about-us') || currentHref.includes('/about-us')) {
   const freeResToggle = header.querySelector('.ref-resources .ref-toggle');
   // Class (not inline colour) so the open/expanded gold button keeps its dark text like every other page
   if (freeResToggle) freeResToggle.classList.add('ref-parent-active');
 }


 const drops=[...header.querySelectorAll('.ref-dropdown')];
 header.querySelectorAll('#ref-online-tab-1,#ref-online-panel-1 :is(h2, .ref-panel-title),#ref-mobile .ref-mobile-group').forEach(label=>{
  if(label.textContent.replace('›','').trim()!=='Wedding Filmmaking')return;
  if(label.id==='ref-online-tab-1')label.firstChild.textContent='Wedding Filmmaking Course';
  else label.textContent='Wedding Filmmaking Course';
 });
 const appLink=document.createElement('a');appLink.href=`${navPrefix}downloads/quickart-academy-release.apk`;appLink.setAttribute('download','quickart-academy.apk');appLink.textContent='Download Our App (APK)';
 const resources=header.querySelector('#ref-resources');if(resources&&!resources.querySelector('a[href*="quickart-academy"]'))resources.append(appLink);
 const mobileResources=[...header.querySelectorAll('#ref-mobile details')].find(detail=>detail.querySelector('summary')?.textContent.trim()==='Free Resources');
 if(mobileResources&&!mobileResources.querySelector('a[href*="quickart-academy"]')){
   const mobileAppLink=document.createElement('a');
   mobileAppLink.className='ref-course';
   mobileAppLink.href=`${navPrefix}downloads/quickart-academy-release.apk`;
   mobileAppLink.setAttribute('download','quickart-academy.apk');
   mobileAppLink.innerHTML='<span class="ref-course-icon" aria-hidden="true">Ap</span><span>Download Our App (APK)</span>';
   mobileResources.append(mobileAppLink);
 }
 header.querySelectorAll('.ref-ai-label').forEach(label=>label.classList.add('ref-highlight-badge'));
 header.querySelectorAll('#ref-courses .ref-category-label,#ref-courses :is(h2, .ref-panel-title),#ref-mobile .ref-mobile-group').forEach(label=>{
  if(label.textContent.trim()!=='Graphics Design')return;
  const note=document.createElement('small');note.className='ref-highlight-badge ref-course-update';note.textContent='Updated Course';label.append(note);
 });
 header.querySelectorAll('#ref-online-tab-2,#ref-online-panel-2 :is(h2, .ref-panel-title),#ref-mobile .ref-mobile-group').forEach(label=>{
  if(!label.textContent.startsWith('Graphics Design Course'))return;
  const update=document.createElement('small');update.className='ref-highlight-badge ref-updated-label';update.textContent='Updated';
  if(label.id==='ref-online-tab-2'){const title=document.createElement('span');title.className='ref-category-label';title.textContent='Graphics Design Course';title.append(update);label.replaceChild(title,label.firstChild);}else label.append(update);
 });
 header.querySelectorAll('#ref-courses .ref-category-label,#ref-courses :is(h2, .ref-panel-title),#ref-courses .ref-course>span:last-child,#ref-mobile .ref-course>span:last-child').forEach(label=>{
  if(label.textContent.trim()==='AI Marketing Course (Free)'){
   label.replaceChildren(document.createTextNode('AI Marketing Course '));
   const badge=document.createElement('small');badge.className='ref-highlight-badge ref-free-badge';badge.textContent='Free';label.append(badge);
  }
 });
   let isAnyDropdownOpen = false;
   function set(drop,open){
     const button=drop.querySelector('.ref-toggle');
     if(!button) return;
     const panel=document.getElementById(button.getAttribute('aria-controls'));
     if(!panel) return;
     button.setAttribute('aria-expanded',String(open));
     panel.hidden=!open;
     panel.style.display = open ? '' : 'none';
     if (open) isAnyDropdownOpen = true;
   }
   function closeAll(){
     if (!isAnyDropdownOpen) return;
     drops.forEach(d => set(d, false));
     isAnyDropdownOpen = false;
   }
   let hoverTimer = null;

  drops.forEach(drop => {
    const toggle = drop.querySelector('.ref-toggle');
    if (!toggle) return;

    // Desktop Mouse Hover: Open megamenu on mouse hover
    drop.addEventListener('mouseenter', () => {
      if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      drops.forEach(d => { if (d !== drop) set(d, false); });
      set(drop, true);
    });

    // Desktop Mouse Hover: Close megamenu when mouse leaves with comfortable 180ms buffer
    drop.addEventListener('mouseleave', () => {
      if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        set(drop, false);
      }, 180);
    });

    // Click behavior (works for touch/mobile devices or manual clicks)
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      closeAll();
      set(drop, open);
    });

    drop.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        set(drop, false);
        toggle.focus();
      }
    });

    drop.addEventListener('focusout', event => {
      if (!drop.contains(event.relatedTarget)) set(drop, false);
    });

   const tabs=[...drop.querySelectorAll('[role=tab]')];
   function select(tab){
    tabs.forEach(t=>{
      const active=t===tab;
      t.setAttribute('aria-selected',String(active));
      t.tabIndex=active?0:-1;
      const targetPanel = document.getElementById(t.getAttribute('aria-controls'));
      if(targetPanel) {
        targetPanel.hidden=!active;
        targetPanel.style.display = active ? '' : 'none';
      }
    });
   }
   tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')select(tab);});
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowDown')next=(i+1)%tabs.length;
      else if(event.key==='ArrowUp')next=(i+tabs.length-1)%tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      else return;
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus();
    });
   });
  });

  // Close open dropdowns immediately when hovering over other top links or brand
  header.querySelectorAll('.ref-nav > a, .ref-brand, .ref-login').forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      closeAll();
    });
  });

  // Ensure all dropdowns are strictly closed by default on initial page load
  closeAll();
  const menu = header.querySelector('#ref-mobile, .ref-mobile, .ref-mobile-nav');
  if (menu) {
    if (!menu.id) menu.id = 'ref-mobile';
    if (!menu.classList.contains('ref-mobile')) menu.classList.add('ref-mobile');
    const originalLogin = header.querySelector('.ref-login');
    const loginHref = originalLogin ? (originalLogin.getAttribute('href') || 'portal/') : 'portal/';

    // Check student logged in status from portal
    const studentToken = localStorage.getItem('qaa_student_token') || '';
    const isStudentLoggedIn = !!studentToken;

    function handleQaaLogout(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!confirm('Kya aap Quick Art Academy student portal se logout karna chahte hain?')) return;
      try {
        const token = localStorage.getItem('qaa_student_token');
        if (token) {
          const logoutApi = ['5500', '5501', '5502', '3000', '5173'].includes(window.location.port)
            ? 'http://127.0.0.1:8000/api/lms.php?action=logout'
            : '/api/lms.php?action=logout';
          fetch(logoutApi, {
            method: 'POST',
            headers: { 'X-Student-Token': token }
          }).catch(() => {});
        }
      } catch (err) {}
      localStorage.removeItem('qaa_student_token');
      localStorage.removeItem('qa_user_phone');
      localStorage.removeItem('qa_user_name');
      localStorage.removeItem('qaa_student_data');
      window.location.reload();
    }
    window.qaaStudentLogout = handleQaaLogout;

    // Desktop Login / Logout State
    if (originalLogin) {
      originalLogin.removeAttribute('target');
      if (isStudentLoggedIn) {
        const authContainer = document.createElement('div');
        authContainer.className = 'ref-auth-container';
        authContainer.style.cssText = 'display:inline-flex;align-items:center;gap:8px;flex-shrink:0;';

        const classroomLink = document.createElement('a');
        classroomLink.className = 'ref-login ref-btn-classroom';
        classroomLink.href = loginHref;
        classroomLink.textContent = 'My Course →';
        classroomLink.title = 'Access My Course';
        classroomLink.style.cssText = 'background:linear-gradient(110deg,#f3d695,#d8a447);color:#17120b;border-color:#d8a447;font-weight:700;padding:0 14px;';
        classroomLink.removeAttribute('target');

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'ref-login ref-btn-logout';
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.cssText = 'border-color:rgba(244,63,94,0.5);color:#fda4af;background:rgba(244,63,94,0.08);padding:0 14px;cursor:pointer;';
        logoutBtn.title = 'Logout from Student Account';
        logoutBtn.onclick = handleQaaLogout;

        authContainer.append(classroomLink, logoutBtn);
        originalLogin.replaceWith(authContainer);
      }
    }

    let mobileLogin = header.querySelector('.ref-mobile-login');
    let mobileClassroomWrap = header.querySelector('.ref-mobile-classroom-wrap');
    const oldMenuBtn = header.querySelector('.ref-menu-button');
    if (oldMenuBtn) oldMenuBtn.remove();

    let isClassroomOpen = false;
    function toggleClassroomMenu(open) {
      if (!mobileClassroomWrap) return;
      const toggle = mobileClassroomWrap.querySelector('#ref-mobile-classroom-toggle');
      const dropdown = mobileClassroomWrap.querySelector('#ref-mobile-classroom-dropdown');
      if (!toggle || !dropdown) return;

      const shouldOpen = open !== undefined ? open : dropdown.hidden;
      isClassroomOpen = shouldOpen;
      if (shouldOpen) {
        closeMobile();
        closeAll();
        dropdown.hidden = false;
        dropdown.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        dropdown.hidden = true;
        dropdown.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      }
    }

    if (isStudentLoggedIn) {
      if (mobileLogin) {
        mobileLogin.remove();
        mobileLogin = null;
      }

      function makePortalUrl(view) {
        const base = loginHref.endsWith('/') || loginHref.endsWith('.html') ? loginHref : loginHref + '/';
        return base.includes('?') ? `${base}&view=${view}` : `${base}?view=${view}`;
      }
      const certHref = makePortalUrl('certificates');
      const profileHref = makePortalUrl('profile');
      const settingsHref = makePortalUrl('settings');

      const contact = header.querySelector('.ref-nav>a[href*="contact-us"]');
      const contactHref = contact ? (contact.getAttribute('href') || 'contact-us/') : 'contact-us/';

      let studentAvatarUrl = '';
      let studentName = localStorage.getItem('qa_user_name') || '';
      let studentPhone = localStorage.getItem('qa_user_phone') || '';
      try {
        const data = JSON.parse(localStorage.getItem('qaa_student_data') || '{}');
        if (data.name && !studentName) studentName = data.name;
        if (data.phone && !studentPhone) studentPhone = data.phone;
        if (data.avatarUrl) studentAvatarUrl = data.avatarUrl;
        if (data.id && localStorage.getItem('qaa_avatar_' + data.id)) {
          studentAvatarUrl = localStorage.getItem('qaa_avatar_' + data.id);
        }
      } catch (e) {}

      const initials = studentName.trim()
        ? studentName.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
        : 'QA';

      if (!mobileClassroomWrap) {
        mobileClassroomWrap = document.createElement('div');
        mobileClassroomWrap.className = 'ref-mobile-classroom-wrap';
        mobileClassroomWrap.innerHTML = `
          <button type="button" class="ref-mobile-classroom-btn user-menu-trigger" id="ref-mobile-classroom-toggle" aria-expanded="false" aria-label="Student Account Menu" title="${studentName ? studentName + ' Account' : 'Student Account'}">
            <div class="nav-avatar-wrap">
              ${studentAvatarUrl ? `<img src="${studentAvatarUrl}" class="nav-avatar-img" alt="${studentName}">` : ''}
              <div class="nav-avatar-initials">${initials}</div>
            </div>
          </button>
          <div class="ref-mobile-classroom-menu" id="ref-mobile-classroom-dropdown" hidden aria-hidden="true">
            <div class="ref-classroom-user-header">
              <div class="ref-classroom-avatar-lg">
                ${studentAvatarUrl ? `<img src="${studentAvatarUrl}" class="ref-avatar-img-lg" alt="${studentName}">` : ''}
                <div class="ref-avatar-initials-lg">${initials}</div>
              </div>
              <div class="ref-classroom-user-details">
                <div class="ref-classroom-user-name">${studentName || 'Student'}</div>
                <div class="ref-classroom-user-phone">${studentPhone ? `+91 ${studentPhone.replace(/(\d{5})(\d{5})/, '$1 •••••')}` : 'Enrolled Student'}</div>
              </div>
            </div>

            <div class="ref-classroom-sep"></div>

            <!-- Section: Learning -->
            <div class="ref-classroom-section-label">LEARNING</div>
            <div class="ref-classroom-menu-items">
              <a href="${loginHref}" class="ref-classroom-action" id="ref-action-mycourse">
                <span class="ref-action-ico">🎓</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">My Courses</span>
                  <span class="ref-action-desc">Enrolled lectures & projects</span>
                </span>
                <span class="ref-action-arrow">›</span>
              </a>
              <a href="${certHref}" class="ref-classroom-action" id="ref-action-cert">
                <span class="ref-action-ico">🏆</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">My Certificates</span>
                  <span class="ref-action-desc">ISO 9001:2015 Accredited</span>
                </span>
                <span class="ref-action-arrow">›</span>
              </a>
            </div>

            <div class="ref-classroom-sep"></div>

            <!-- Section: Account -->
            <div class="ref-classroom-section-label">ACCOUNT</div>
            <div class="ref-classroom-menu-items">
              <a href="${profileHref}" class="ref-classroom-action" id="ref-action-profile">
                <span class="ref-action-ico">👤</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">My Profile</span>
                  <span class="ref-action-desc">Personal info & photo</span>
                </span>
                <span class="ref-action-arrow">›</span>
              </a>
              <a href="${settingsHref}" class="ref-classroom-action" id="ref-action-settings">
                <span class="ref-action-ico">⚙️</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">Settings</span>
                  <span class="ref-action-desc">Playback & preferences</span>
                </span>
                <span class="ref-action-arrow">›</span>
              </a>
            </div>

            <div class="ref-classroom-sep"></div>

            <!-- Section: Support -->
            <div class="ref-classroom-section-label">SUPPORT</div>
            <div class="ref-classroom-menu-items">
              <a href="https://wa.me/919939800780" target="_blank" rel="noopener noreferrer" class="ref-classroom-action" id="ref-action-help">
                <span class="ref-action-ico">💬</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">Help &amp; Support</span>
                  <span class="ref-action-desc">Live chat on WhatsApp</span>
                </span>
                <span class="ref-action-ext">↗</span>
              </a>
              <a href="${contactHref}" class="ref-classroom-action" id="ref-action-contact">
                <span class="ref-action-ico">📞</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">Contact Academy</span>
                  <span class="ref-action-desc">Phone & campus address</span>
                </span>
                <span class="ref-action-arrow">›</span>
              </a>
            </div>

            <div class="ref-classroom-sep"></div>

            <div class="ref-classroom-menu-items">
              <button type="button" class="ref-classroom-action ref-action-logout" id="ref-action-logout">
                <span class="ref-action-ico">🚪</span>
                <span class="ref-action-body">
                  <span class="ref-action-title">Logout</span>
                  <span class="ref-action-desc">Sign out of student account</span>
                </span>
              </button>
            </div>
          </div>
        `;
        header.querySelector('.ref-bar')?.append(mobileClassroomWrap);
      }

      const toggleBtn = mobileClassroomWrap.querySelector('#ref-mobile-classroom-toggle');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleClassroomMenu();
        };
      }

      const logoutAction = mobileClassroomWrap.querySelector('#ref-action-logout');
      if (logoutAction) {
        logoutAction.onclick = (e) => {
          toggleClassroomMenu(false);
          handleQaaLogout(e);
        };
      }

      mobileClassroomWrap.querySelectorAll('a').forEach(link => {
        link.onclick = () => {
          toggleClassroomMenu(false);
        };
      });

    } else {
      if (mobileClassroomWrap) {
        mobileClassroomWrap.remove();
        mobileClassroomWrap = null;
      }
      const loginIconHtml = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>';
      if (!mobileLogin) {
        mobileLogin = document.createElement('a');
        mobileLogin.className = 'ref-mobile-login';
        mobileLogin.href = loginHref;
        mobileLogin.setAttribute('aria-label', 'Login');
        mobileLogin.title = 'Login';
        mobileLogin.innerHTML = loginIconHtml;
        header.querySelector('.ref-bar')?.append(mobileLogin);
      } else {
        mobileLogin.className = 'ref-mobile-login';
        mobileLogin.href = loginHref;
        mobileLogin.removeAttribute('target');
        mobileLogin.setAttribute('aria-label', 'Login');
        mobileLogin.title = 'Login';
        mobileLogin.innerHTML = loginIconHtml;
      }
    }

    let programsBtn = header.querySelector('.ref-mobile-programs');
    if (!programsBtn) {
      programsBtn = document.createElement('button');
      programsBtn.type = 'button';
      programsBtn.className = 'ref-mobile-programs';
      programsBtn.setAttribute('aria-label', 'Explore Programs');
      programsBtn.innerHTML = '<span>Programs</span><svg class="ref-programs-arrow" width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5"></path></svg>';
      if (mobileClassroomWrap) {
        mobileClassroomWrap.before(programsBtn);
      } else if (mobileLogin) {
        mobileLogin.before(programsBtn);
      } else {
        header.querySelector('.ref-bar')?.append(programsBtn);
      }
    } else {
      if (!programsBtn.querySelector('.ref-programs-arrow')) {
        programsBtn.innerHTML = '<span>Programs</span><svg class="ref-programs-arrow" width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5"></path></svg>';
      }
      if (mobileClassroomWrap && programsBtn.nextSibling !== mobileClassroomWrap) {
        mobileClassroomWrap.before(programsBtn);
      } else if (mobileLogin && programsBtn.nextSibling !== mobileLogin) {
        mobileLogin.before(programsBtn);
      }
    }

    if (!menu.querySelector('.ref-drawer-head')) {
      const drawerHead = document.createElement('div');
      drawerHead.className = 'ref-drawer-head';
      const brandImg = header.querySelector('.ref-brand img');
      const imgSrc = brandImg ? brandImg.getAttribute('src') : 'home-assets/qa-logo-96.webp';
      drawerHead.innerHTML = `<div class="ref-drawer-title"><img src="${imgSrc}" width="30" height="30" alt="Quick Art" style="object-fit:contain;border-radius:6px;"><span>Quick <b>Art</b> <small>ACADEMY</small></span></div><button type="button" class="ref-drawer-close" aria-label="Close navigation"><span aria-hidden="true">✕</span></button>`;
      
      let studentCard = null;
      if (isStudentLoggedIn) {
        studentCard = document.createElement('div');
        studentCard.className = 'ref-drawer-student-card';
        studentCard.innerHTML = `
          <div class="ref-drawer-student-top">
            <span class="ref-drawer-student-badge">
              <span class="ref-student-online-dot"></span>
              Enrolled Student
            </span>
          </div>
        `;
      }

      const drawerBody = document.createElement('div');
      drawerBody.className = 'ref-drawer-body';
      
      const drawerActions = document.createElement('div');
      drawerActions.className = 'ref-drawer-actions';
      
      const demo = menu.querySelector('.ref-demo-cta');
      if (isStudentLoggedIn) {
        const mClassroom = document.createElement('a');
        mClassroom.className = 'ref-login ref-drawer-login ref-drawer-mycourse';
        mClassroom.href = loginHref;
        mClassroom.textContent = 'My Course →';
        mClassroom.style.cssText = 'background:linear-gradient(110deg,#f3d695,#d8a447);color:#17120b;font-weight:700;border:none;border-radius:999px;';
        
        const mLogout = document.createElement('button');
        mLogout.type = 'button';
        mLogout.className = 'ref-login ref-drawer-logout';
        mLogout.textContent = 'Logout';
        mLogout.style.cssText = 'border:1px solid rgba(244,63,94,0.45);color:#fda4af;background:rgba(244,63,94,0.12);width:100%;cursor:pointer;border-radius:999px;font-weight:700;';
        mLogout.onclick = handleQaaLogout;

        drawerActions.append(mClassroom, mLogout);
      } else {
        if (originalLogin) {
          const login = originalLogin.cloneNode(true);
          login.classList.add('ref-drawer-login');
          login.removeAttribute('target');
          login.textContent = 'Login';
          drawerActions.append(login);
        }
        if (demo) drawerActions.append(demo);
      }

      // Remove any legacy student portal button so all pages have the identical clean mobile drawer as homepage
      menu.querySelectorAll('.ref-mobile-lms').forEach(el => el.remove());

      while (menu.firstChild) drawerBody.append(menu.firstChild);
      
      if (studentCard) {
        menu.append(drawerHead, studentCard, drawerBody, drawerActions);
      } else {
        menu.append(drawerHead, drawerBody, drawerActions);
      }
    }

    let backdrop = document.querySelector('.ref-drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'ref-drawer-backdrop';
      backdrop.hidden = true;
      backdrop.setAttribute('hidden', '');
      backdrop.style.display = 'none';
      document.body.appendChild(backdrop);
    }
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }

    // Ensure all accordions start closed initially
    menu.querySelectorAll('details').forEach(d => { d.open = false; });

    let isMobileOpen = false;
    function drawerState(open) {
      isMobileOpen = open;
      backdrop.hidden = !open;
      if (open) {
        backdrop.removeAttribute('hidden');
        backdrop.style.display = 'block';
        document.body.classList.add('ref-nav-locked');
      } else {
        backdrop.setAttribute('hidden', '');
        backdrop.style.display = 'none';
        document.body.classList.remove('ref-nav-locked');
      }
    }

    function openMobile() {
      if (isMobileOpen) return;
      toggleClassroomMenu(false);
      menu.hidden = false;
      menu.removeAttribute('hidden');
      menu.classList.add('ref-mobile-open');
      drawerState(true);
      if (programsBtn) {
        programsBtn.setAttribute('aria-expanded', 'true');
      }
      closeAll();
      requestAnimationFrame(() => {
        menu.querySelectorAll('details').forEach(d => { d.open = false; });
        const drawerBody = menu.querySelector('.ref-drawer-body');
        if (drawerBody) drawerBody.scrollTop = 0;
      });
    }

    function closeMobile() {
      if (!isMobileOpen) return;
      menu.hidden = true;
      menu.setAttribute('hidden', '');
      menu.classList.remove('ref-mobile-open');
      drawerState(false);
      if (programsBtn) {
        programsBtn.setAttribute('aria-expanded', 'false');
      }
      requestAnimationFrame(() => {
        menu.querySelectorAll('details').forEach(d => { d.open = false; });
      });
    }

    function toggleMobile(e) {
      if (e) {
        e.stopPropagation();
      }
      if (!isMobileOpen) {
        openMobile();
      } else {
        closeMobile();
      }
    }

    if (programsBtn) {
      programsBtn.onclick = toggleMobile;
    }

    backdrop.onclick = (e) => {
      e?.stopPropagation();
      closeMobile();
    };

    const closeBtn = menu.querySelector('.ref-drawer-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e?.stopPropagation();
        closeMobile();
      };
    }

    // Stop click events inside drawer from bubbling to document (prevents drawer closing on + / -)
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    menu.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
      if (detail.open) menu.querySelectorAll('details').forEach(other => {
        if (other !== detail) other.open = false;
      });
    }));

    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      if (a.getAttribute('href') && a.getAttribute('href') !== '#') {
        closeMobile();
      }
    }));

    header.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        toggleClassroomMenu(false);
        if (!menu.hidden) {
          closeMobile();
          programsBtn?.focus();
        }
      }
    });

    document.addEventListener('click', event => {
      if (isClassroomOpen && mobileClassroomWrap && !mobileClassroomWrap.contains(event.target)) {
        toggleClassroomMenu(false);
      }
      if (isAnyDropdownOpen || isMobileOpen) {
        if (!header.contains(event.target) && !menu.contains(event.target) && !backdrop.contains(event.target)) {
          if (isAnyDropdownOpen) closeAll();
          if (isMobileOpen) closeMobile();
        }
      }
    }, { passive: true });

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(min-width:1151px)');
      mq?.addEventListener?.('change', () => {
        closeAll();
        closeMobile();
        toggleClassroomMenu(false);
      });
    }

    // Dynamic header style on scroll (transitions from dark hero header to frosted light-glass over light page backgrounds)
    let scrollTicking = false;
    function updateHeaderScroll() {
      const scrolled = (window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0) > 20;
      header.classList.toggle('ref-scrolled', scrolled);
      scrollTicking = false;
    }
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(updateHeaderScroll);
        scrollTicking = true;
      }
    }, { passive: true });
    updateHeaderScroll();
  }
})();
