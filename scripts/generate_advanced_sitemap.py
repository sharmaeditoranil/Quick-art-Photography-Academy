from xml.sax.saxutils import escape
import os

sitemap_data = [
    {
        "loc": "https://quickartphotography.in/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "1.0",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Video Editing Course in Siwan Bihar - Practical Timeline Training",
                "caption": "Hands-on video editing studio training at Quick Art Photography Academy in Siwan, Bihar"
            },
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Official Logo",
                "caption": "Quick Art Photography Academy Siwan"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/master-class/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.95",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/sample-certificate-demo.png",
                "title": "Master Class Certificate of Completion",
                "caption": "Official ISO 9001:2015 accredited video editing certification"
            },
            {
                "loc": "https://quickartphotography.in/assets/anil-sharma.webp",
                "title": "Anil Sharma - Founder & Lead Instructor",
                "caption": "Anil Sharma mentor at Quick Art Photography Academy"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/about-us/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/edius-classroom.webp",
                "title": "Quick Art Academy Classroom & Studio Training in Siwan",
                "caption": "Live studio classroom training at Siwan studio, Bihar"
            },
            {
                "loc": "https://quickartphotography.in/assets/anil-sharma.webp",
                "title": "Anil Sharma - Founder of Quick Art Photography Academy",
                "caption": "Anil Sharma mentor portrait"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/contact-us/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Campus Location",
                "caption": "Campus in Ayodhya Puri, Near Lalit Bus Stand, Siwan, Bihar"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.95",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-premiere-pro-hindi.webp",
                "title": "Adobe Premiere Pro Course in Hindi",
                "caption": "Complete online video editing masterclass in Hindi"
            },
            {
                "loc": "https://quickartphotography.in/assets/course-davinci-resolve-hindi.webp",
                "title": "DaVinci Resolve Course in Hindi",
                "caption": "DaVinci Resolve Color Grading & Editing course in Hindi"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/premiere-pro-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-premiere-pro-hindi.webp",
                "title": "Adobe Premiere Pro Video Editing Masterclass in Hindi",
                "caption": "Master Premiere Pro workflows, cuts, transitions and color correction"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/davinci-resolve-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-davinci-resolve-hindi.webp",
                "title": "DaVinci Resolve Color Grading & Video Editing Course",
                "caption": "Professional color grading, HDR nodes and Fairlight audio in Hindi"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/edius-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-edius-pro-hindi.webp",
                "title": "EDIUS Pro Fast Wedding Video Editing Course in Hindi",
                "caption": "Fast wedding video cutting, song projects and quick turnaround editing"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/album-design-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-photoshop-album.webp",
                "title": "Photoshop Wedding Album Design & Retouching Course",
                "caption": "Master modern wedding album layout design and portrait retouching"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/pre-wedding-shoot-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Pre-Wedding Shoot & Direction Masterclass",
                "caption": "Creative camera angles, couple poses and cinematic lighting masterclass"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/cinematic-editing-course/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-example-landscape.webp",
                "title": "Cinematic Wedding Filmmaking & Teaser Editing Course",
                "caption": "Storytelling, sound design and high-end cinematic wedding teaser cuts"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/automation-course/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-studio-automation.webp",
                "title": "Studio Automation & AI CRM Course for Photographers",
                "caption": "Automated client followups, contracts and studio management"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/website-design-course/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-website-design-hindi.webp",
                "title": "Website Design Course for Photography Studios",
                "caption": "Build fast, modern portfolio websites to book premium wedding clients"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/online/digital-marketing-course/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-digital-marketing-hindi.webp",
                "title": "Digital Marketing & Ads Course for Photographers",
                "caption": "Generate consistent wedding booking leads through targeted ads"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/courses/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Offline Filmmaking & Video Editing Courses in Siwan",
                "caption": "Classroom courses with workstation and hostel facility in Siwan"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/courses/video-editing/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.95",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Offline Video Editing Course in Siwan Bihar",
                "caption": "14-week practical video editing training in Siwan studio"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/courses/album-design/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-photoshop-album.webp",
                "title": "Offline Wedding Album Design Course in Siwan",
                "caption": "Practical Photoshop album design and retouching in classroom"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/courses/ai-wedding-filmmaking/",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.9",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-studio-automation.webp",
                "title": "AI Wedding Filmmaking Course in Siwan Bihar",
                "caption": "AI-powered editing, color workflows and automated delivery"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/",
        "lastmod": "2026-09-21",
        "changefreq": "daily",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Quick Art Photography Academy Blog",
                "caption": "Video editing guides, tutorials and photography industry insights"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/best-video-editing-software-in-2026/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-premiere-pro-hindi.webp",
                "title": "Best Video Editing Software in 2026: Premiere Pro vs DaVinci Resolve vs EDIUS",
                "caption": "Comparison of top video editing software for wedding videographers"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/freelance-video-editor-earn-in-bihar/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "How to Earn ₹30,000 to ₹1,00,000 as a Freelance Video Editor in Bihar",
                "caption": "Practical guide to monetizing video editing skills in Bihar"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/how-ai-is-changing-wedding-filmmaking-2026/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/course-studio-automation.webp",
                "title": "How AI is Changing Wedding Filmmaking in 2026",
                "caption": "AI tools for faster wedding film edits and automated color matching"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/top-10-photography-studios-in-chapra/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-example-landscape.webp",
                "title": "Top 10 Photography Studios in Chapra (Saran)",
                "caption": "Comprehensive guide to wedding photography studios in Chapra"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/top-5-editing-course-academies-in-patna/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/edius-classroom.webp",
                "title": "Top 5 Video Editing Course Academies in Patna (2026 Ranking)",
                "caption": "Best institutes for video editing training in Patna and Bihar"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/video-editing-course-in-gaya/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.8",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/editing-timeline.jpg",
                "title": "Video Editing Course in Gaya: Fees, Syllabus & Career Opportunities",
                "caption": "Practical video editing guide for students in Gaya, Bihar"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/cinematic-wedding-video-editing-course/",
        "lastmod": "2026-09-25",
        "changefreq": "weekly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/blog-cinematic-wedding-video-editing-course-hero.webp",
                "title": "Cinematic Wedding Video Editing Course",
                "caption": "6 Weeks offline practical training in Premiere Pro, DaVinci Resolve, EDIUS with free hostel"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/blog/best-video-editing-course-in-gopalganj/",
        "lastmod": "2026-09-27",
        "changefreq": "weekly",
        "priority": "0.85",
        "images": [
            {
                "loc": "https://quickartphotography.in/assets/best-video-editing-course-in-gopalganj-quick-art.webp",
                "title": "Best Video Editing Course in Gopalganj",
                "caption": "Professional video editing, wedding filmmaking, album design & color grading training near Gopalganj"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/privacy-policy/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.5",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Privacy Policy",
                "caption": "Privacy policy document"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/refund-policy/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.5",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Refund Policy",
                "caption": "Refund and cancellation policy"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/shipping-policy/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.5",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Shipping & Delivery Policy",
                "caption": "Digital course delivery policy"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/terms-and-conditions/",
        "lastmod": "2026-09-21",
        "changefreq": "monthly",
        "priority": "0.5",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy Terms and Conditions",
                "caption": "Terms of service"
            }
        ]
    },
    {
        "loc": "https://quickartphotography.in/sitemap.html",
        "lastmod": "2026-09-21",
        "changefreq": "weekly",
        "priority": "0.6",
        "images": [
            {
                "loc": "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp",
                "title": "Quick Art Photography Academy HTML Sitemap",
                "caption": "HTML sitemap of all courses and academy pages"
            }
        ]
    }
]

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ''
]

for item in sitemap_data:
    url = item["loc"]
    lastmod = item["lastmod"]
    changefreq = item["changefreq"]
    priority = item["priority"]
    lines.append('  <url>')
    lines.append(f'    <loc>{url}</loc>')
    lines.append(f'    <lastmod>{lastmod}</lastmod>')
    lines.append(f'    <changefreq>{changefreq}</changefreq>')
    lines.append(f'    <priority>{priority}</priority>')
    for img in item.get("images", []):
        img_loc = img["loc"]
        img_title = escape(img["title"])
        img_caption = escape(img["caption"])
        lines.append('    <image:image>')
        lines.append(f'      <image:loc>{img_loc}</image:loc>')
        lines.append(f'      <image:title>{img_title}</image:title>')
        lines.append(f'      <image:caption>{img_caption}</image:caption>')
        lines.append('    </image:image>')
    lines.append('  </url>')

lines.append('</urlset>')
lines.append('')

workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(workspace, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Generated advanced sitemap.xml with {len(sitemap_data)} URLs and Google Image Sitemap extension.")
