import os
import re
import glob

def generate_footer(prefix):
    return f"""    <footer role="contentinfo" class="qa-footer">
        <div class="container qa-footer-grid">
            <div class="qa-footer-brand-col">
                <a class="qa-brand" href="https://quickartphotography.in/" aria-label="Quick Art Photography Academy Home">
                    <img src="{prefix}home-assets/ec55a6be3747a9.webp" width="48" height="48" alt="Quick Art Photography Academy logo" loading="lazy">
                    <span>Quick <b>Art</b><small>PHOTOGRAPHY ACADEMY</small></span>
                </a>
                <p class="qa-footer-brand-desc">Practical training in wedding filmmaking, cinematography, video editing, and album design. Build a high-earning creative career with mentor Anil Sharma in Siwan, Bihar.</p>
                <div class="qa-footer-badges">
                    <a href="https://maps.app.goo.gl/eRkAc7kia1D1s1zQ7" target="_blank" rel="noopener" class="qa-footer-badge-pill" style="text-decoration:none;display:inline-block;">4.9/5 · 1,800+ student reviews</a>
                    <span class="qa-footer-badge-pill">Free Hostel &amp; Stay for Outstation Students</span>
                    <span class="qa-footer-badge-pill">100% Practical Studio Lab</span>
                </div>
                <div class="qa-footer-contacts">
                    <a href="tel:+919939800780" class="qa-contact-link" aria-label="Call Quick Art Academy">
                        <span>Call: +91 99398 00780</span>
                    </a>
                    <a href="https://wa.me/919939800780" class="qa-contact-link" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
                        WhatsApp: +91 99398 00780
                    </a>
                    <a href="mailto:support@quickartphotography.in" class="qa-contact-link" aria-label="Email Quick Art Academy">
                        <span>support@quickartphotography.in</span>
                    </a>
                    <a href="https://maps.app.goo.gl/eRkAc7kia1D1s1zQ7" class="qa-contact-link" target="_blank" rel="noopener" aria-label="Quick Art Photography Academy on Google Maps">
                        Quick Art Photography Academy on Google Maps
                    </a>
                </div>
                <div class="qa-footer-address">
                    <p><strong>Campus:</strong> Ayodhya Puri, Near Lalit Bus Stand, Siwan, Bihar - 841226, India</p>
                    <p class="qa-footer-hours">Mon – Sat: 10:00 AM – 7:00 PM (Sunday by appointment)</p>
                </div>
            </div>
            <div>
                <h3 class="qa-footer-heading">On-Campus Courses</h3>
                <ul class="qa-footer-links-list">
                    <li><a href="{prefix}courses/video-editing/index.html">Video Editing Course in Siwan</a></li>
                    <li><a href="{prefix}courses/album-design/index.html">Wedding Album Design Course</a></li>
                    <li><a href="{prefix}courses/ai-wedding-filmmaking/index.html">AI Wedding Filmmaking Course</a></li>
                    <li><a href="{prefix}master-class/index.html">14-Week Master Class in Siwan</a></li>
                    <li><a href="{prefix}admission/index.html" class="qa-footer-highlight-link" style="color: #f59e0b; font-weight: 700;">Apply Admission Form</a></li>
                    <li><a href="{prefix}courses/index.html">All On-Campus Courses Overview</a></li>
                    <li><a href="{prefix}contact-us/index.html" class="qa-footer-highlight-link">Book Free 1-on-1 Demo Class</a></li>
                    <li><a href="{prefix}downloads/course-details.pdf" target="_blank" rel="noopener noreferrer">Download Syllabus (PDF)</a></li>
                </ul>
            </div>
            <div>
                <h3 class="qa-footer-heading">Popular Online Courses</h3>
                <ul class="qa-footer-links-list">
                    <li><a href="{prefix}online/premiere-pro-course/index.html">Adobe Premiere Pro Course in Hindi</a></li>
                    <li><a href="{prefix}online/davinci-resolve-course/index.html">DaVinci Resolve Course in Hindi</a></li>
                    <li><a href="{prefix}online/edius-course/index.html">EDIUS Fast Wedding Editing Course</a></li>
                    <li><a href="{prefix}online/cinematic-editing-course/index.html">Cinematic Wedding Video Editing Course</a></li>
                    <li><a href="{prefix}online/pre-wedding-shoot-course/index.html">Pre-Wedding Shoot Course in Hindi</a></li>
                    <li><a href="{prefix}online/album-design-course/index.html">Album Designing Course Online in Hindi</a></li>
                    <li><a href="{prefix}online/website-design-course/index.html">Website Design Course in Hindi</a></li>
                    <li><a href="{prefix}online/digital-marketing-course/index.html">Digital Marketing Course in Hindi</a></li>
                    <li><a href="{prefix}online/automation-course/index.html">Studio Automation &amp; AI CRM</a></li>
                    <li><a href="{prefix}online/index.html">All Online Video Editing Courses</a></li>
                </ul>
            </div>
            <div>
                <h3 class="qa-footer-heading">Student &amp; Academy</h3>
                <ul class="qa-footer-links-list">
                    <li><a href="{prefix}blog/top-10-video-editing-institutes-in-india/index.html" style="color: #f59e0b; font-weight: 700;">Top 10 Video Editing Institutes in India</a></li>
                    <li><a href="{prefix}admission/index.html" class="qa-footer-highlight-link" style="color: #f59e0b; font-weight: 700;">Apply Admission Form</a></li>
                    <li><a href="{prefix}alumni/index.html">Alumni Directory &amp; Hall of Fame</a></li>
                    <li><a href="{prefix}portal/index.html" class="qa-footer-highlight-link">Student Portal Login</a></li>
                    <li><a href="{prefix}online/index.html">Online Course Catalog</a></li>
                    <li><a href="{prefix}about-us/index.html">About Anil Sharma &amp; Mentors</a></li>
                    <li><a href="{prefix}contact-us/index.html">Contact Us &amp; Campus Visit</a></li>
                    <li><a href="{prefix}blog/index.html">Editing Blogs &amp; Tutorials</a></li>
                    <li><a href="{prefix}blog/best-video-editing-software-in-2026/index.html">Best Video Editing Software in 2026</a></li>
                    <li><a href="{prefix}blog/freelance-video-editor-earn-in-bihar/index.html">Freelance Video Editor in Bihar</a></li>
                    <li><a href="{prefix}blog/how-ai-is-changing-wedding-filmmaking-2026/index.html">AI in Wedding Filmmaking 2026</a></li>
                    <li><a href="{prefix}sitemap.html">Complete Website Sitemap</a></li>
                </ul>
            </div>
            <div>
                <h3 class="qa-footer-heading">Connect &amp; Policies</h3>
                <ul class="qa-footer-links-list">
                    <li><a href="https://www.youtube.com/@QuickartPhotographyAcademy/videos" target="_blank" rel="noopener noreferrer me">YouTube Channel</a></li>
                    <li><a href="https://www.instagram.com/quick.art.photography.academy/" target="_blank" rel="noopener noreferrer me">Instagram Profile</a></li>
                    <li><a href="https://www.facebook.com/Quick.art.Photography.Academy" target="_blank" rel="noopener noreferrer me">Facebook Page</a></li>
                    <li><a href="https://wa.me/919939800780" target="_blank" rel="noopener noreferrer">WhatsApp Helpdesk</a></li>
                    <li><a href="{prefix}privacy-policy/index.html">Privacy Policy</a></li>
                    <li><a href="{prefix}terms-and-conditions/index.html">Terms &amp; Conditions</a></li>
                    <li><a href="{prefix}refund-policy/index.html">Refund Policy</a></li>
                    <li><a href="{prefix}shipping-policy/index.html">Shipping Policy</a></li>
                </ul>
            </div>
        </div>
        <div class="container qa-footer-seo-strip">
            <p style="margin:0;color:#94a3b8;font-size:13.5px;line-height:1.6;">Students from Siwan, Gopalganj, Chhapra and Patna attend our offline classes; online courses are available across India.</p>
        </div>
        <div class="container qa-footer-base">
            <div>© <span data-year>2026</span> Quick Art Photography Academy. All Rights Reserved. | Managed by Anil Sharma</div>
            <div class="qa-footer-base-links">
                <a href="{prefix}portal/index.html">Student Login</a> ·
                <a href="{prefix}about-us/index.html">About</a> ·
                <a href="{prefix}courses/index.html">Courses</a> ·
                <a href="{prefix}online/index.html">Online Courses</a> ·
                <a href="{prefix}contact-us/index.html">Contact</a> ·
                <a href="{prefix}privacy-policy/index.html">Privacy</a> ·
                <a href="{prefix}terms-and-conditions/index.html">Terms</a> ·
                <a href="{prefix}refund-policy/index.html">Refunds</a> ·
                <a href="{prefix}shipping-policy/index.html">Shipping</a> ·
                <a href="{prefix}sitemap.html">Sitemap</a>
            </div>
        </div>
    </footer>"""

def update_footer_in_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    orig_content = content
    if "<footer" not in content:
        return False

    rel_path = os.path.relpath(file_path).replace("\\", "/")
    depth = rel_path.count("/")
    if depth == 0:
        prefix = ""
    elif depth == 1:
        prefix = "../"
    elif depth == 2:
        prefix = "../../"
    else:
        prefix = "../" * depth

    new_footer = generate_footer(prefix)
    content = re.sub(r'<footer\b[^>]*>.*?</footer>', new_footer, content, flags=re.DOTALL)

    # D7: ensure Home breadcrumbs link to https://quickartphotography.in/
    # Match breadcrumb home links like <a href="..." ...>Home</a> or <a href="..."><span>Home</span></a>
    content = re.sub(r'(<ol class="breadcrumb"[^>]*>.*?<a\s+href=)["\'][^"\']*["\']([^>]*>.*?Home.*?</a>)',
                     r'\1"https://quickartphotography.in/"\2', content, flags=re.DOTALL)
    # Also generic breadcrumb pattern
    content = re.sub(r'(<nav[^>]*aria-label="Breadcrumb"[^>]*>.*?<a\s+href=)["\'][^"\']*["\']([^>]*>.*?Home.*?</a>)',
                     r'\1"https://quickartphotography.in/"\2', content, flags=re.DOTALL)

    # D4: Replace https://maps.google.com/?q=Quick+Art+Photography+Academy+Siwan everywhere
    content = content.replace("https://maps.google.com/?q=Quick+Art+Photography+Academy+Siwan", "https://maps.app.goo.gl/eRkAc7kia1D1s1zQ7")

    # D2: Replace portal/index.html?catalog=1 -> /online/ (or prefix + online/index.html)
    content = re.sub(r'href=["\'][^"\']*portal/index\.html\?catalog=1["\']', f'href="{prefix}online/index.html"', content)

    # D3: Replace contact enquiry URLs in non-CTA contexts
    content = re.sub(r'href=["\'][^"\']*contact-us/index\.html\?course=[^"\']*#enquiry["\']', f'href="{prefix}contact-us/index.html"', content)
    content = re.sub(r'href=["\'][^"\']*contact-us/index\.html#enquiry["\']', f'href="{prefix}contact-us/index.html"', content)

    if content != orig_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False

if __name__ == "__main__":
    files = sorted(glob.glob("**/*.html", recursive=True))
    count = 0
    for f in files:
        if update_footer_in_file(f):
            print(f"Updated footer in {f}")
            count += 1
    print(f"Footer update complete. Modified {count} files.")
