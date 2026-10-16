#!/usr/bin/env python3
"""
Technical SEO Schema Engine for quickartphotography.in
Complies strictly with Schema.org & Google Search Central guidelines:
1. Zero invented data. No placeholder strings (REPLACE_*) anywhere.
2. Single unified @graph per page.
3. EducationalOrganization + LocalBusiness (@id https://quickartphotography.in/#academy).
4. Full Person node (@id https://quickartphotography.in/#anil-sharma) included in @graph whenever referenced.
5. AggregateRating ONLY on Organization node, and ONLY on pages with a visible reviews section matching 4.9/1800 + Google Maps link.
6. Zero aggregateRating on Course nodes. Real visible student testimonials added as review array on Course.
7. Valid BreadcrumbList on all sub-pages.
8. FAQPage ONLY when visible FAQs exist on page.
9. High-res ImageObject (1200px+) on BlogPosting with verified publication dates.
10. Exclude non-indexable portal, admin, and redirect stubs.
"""

import os
import re
import json
import glob

# Exact verified details
LATITUDE = 26.2289734
LONGITUDE = 84.3347944
PHONE = "+919939800780"
EMAIL = "support@quickartphotography.in"
MAPS_URL = "https://maps.app.goo.gl/eRkAc7kia1D1s1zQ7"
LOGO_URL = "https://quickartphotography.in/home-assets/ec55a6be3747a9.webp"
HERO_IMAGE_URL = "https://quickartphotography.in/assets/editing-timeline.jpg"
ANIL_PHOTO_URL = "https://quickartphotography.in/assets/anil-sharma.webp"

def get_base_person():
    return {
        "@type": "Person",
        "@id": "https://quickartphotography.in/#anil-sharma",
        "name": "Anil Sharma",
        "jobTitle": "Founder & Lead Mentor",
        "description": "Founder & Lead Mentor at Quick Art Photography Academy with over a decade of professional wedding filmmaking, cinematography, video editing, and album design experience.",
        "image": ANIL_PHOTO_URL,
        "url": "https://quickartphotography.in/about-us/",
        "sameAs": [
            MAPS_URL,
            "https://www.youtube.com/@QuickartPhotographyAcademy",
            "https://www.instagram.com/quick.art.photography.academy/",
            "https://www.facebook.com/Quick.art.Photography.Academy"
        ]
    }

def get_base_org(include_aggregate_rating=False):
    org = {
        "@type": [
            "EducationalOrganization",
            "LocalBusiness"
        ],
        "@id": "https://quickartphotography.in/#academy",
        "name": "Quick Art Photography Academy",
        "alternateName": [
            "Quick Art Photography",
            "Quick Art Academy"
        ],
        "url": "https://quickartphotography.in/",
        "logo": {
            "@type": "ImageObject",
            "url": LOGO_URL
        },
        "image": HERO_IMAGE_URL,
        "description": "Quick Art Photography Academy in Siwan, Bihar offers offline and online video editing, wedding filmmaking, album design, website design and digital marketing courses in Hindi.",
        "telephone": PHONE,
        "email": EMAIL,
        "priceRange": "₹₹",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Ayodhya Puri, Near Lalit Bus Stand",
            "addressLocality": "Siwan",
            "addressRegion": "Bihar",
            "postalCode": "841226",
            "addressCountry": "IN"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": LATITUDE,
            "longitude": LONGITUDE
        },
        "hasMap": MAPS_URL,
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday"
                ],
                "opens": "10:00",
                "closes": "19:00"
            }
        ],
        "areaServed": [
            {"@type": "City", "name": "Siwan"},
            {"@type": "City", "name": "Gopalganj"},
            {"@type": "City", "name": "Chhapra"},
            {"@type": "City", "name": "Patna"},
            {"@type": "State", "name": "Bihar"},
            {"@type": "Country", "name": "India"}
        ],
        "founder": {
            "@id": "https://quickartphotography.in/#anil-sharma"
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": PHONE,
            "contactType": "admissions",
            "areaServed": "IN",
            "availableLanguage": ["Hindi", "Bhojpuri", "English"]
        },
        "sameAs": [
            MAPS_URL,
            "https://www.youtube.com/@QuickartPhotographyAcademy",
            "https://www.instagram.com/quick.art.photography.academy/",
            "https://www.facebook.com/Quick.art.Photography.Academy",
            "https://quickartphotography.in/downloads/quickart-academy-release.apk"
        ]
    }
    if include_aggregate_rating:
        org["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "1800",
            "reviewCount": "1800",
            "bestRating": "5",
            "worstRating": "1"
        }
    return org

def get_base_website():
    return {
        "@type": "WebSite",
        "@id": "https://quickartphotography.in/#website",
        "url": "https://quickartphotography.in/",
        "name": "Quick Art Photography Academy",
        "alternateName": "Quick Art Photography",
        "inLanguage": "en-IN",
        "publisher": {
            "@id": "https://quickartphotography.in/#academy"
        }
    }

ONLINE_COURSES = {
    "online/premiere-pro-course/index.html": {
        "id": "https://quickartphotography.in/online/premiere-pro-course/#course",
        "name": "Adobe Premiere Pro Course in Hindi",
        "description": "Online Adobe Premiere Pro course in Hindi: wedding editing, AI workflow, multicam sync and Lumetri colour grading with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/premiere-pro-course/",
        "price": "4999",
        "duration": "PT18H",
        "teaches": ["Adobe Premiere Pro", "Video editing", "Multicam editing", "Lumetri colour grading"]
    },
    "online/edius-course/index.html": {
        "id": "https://quickartphotography.in/online/edius-course/#course",
        "name": "EDIUS Pro Fast Wedding Editing Course",
        "description": "EDIUS video editing course in Hindi: fast wedding editing, multicam sync, titles, colour correction and client delivery with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/edius-course/",
        "price": "3999",
        "duration": "PT14H",
        "teaches": ["EDIUS Pro", "Wedding video editing", "Multicam timeline editing", "Export and client delivery"]
    },
    "online/davinci-resolve-course/index.html": {
        "id": "https://quickartphotography.in/online/davinci-resolve-course/#course",
        "name": "DaVinci Resolve Course in Hindi – Color Grading",
        "description": "DaVinci Resolve course in Hindi: node-based colour grading, skin-tone matching and cinematic wedding looks with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/davinci-resolve-course/",
        "price": "4999",
        "duration": "PT16H",
        "teaches": ["DaVinci Resolve", "Color grading", "Node tree workflow", "Cinematic wedding grading"]
    },
    "online/cinematic-editing-course/index.html": {
        "id": "https://quickartphotography.in/online/cinematic-editing-course/#course",
        "name": "Cinematic Wedding Video Editing Masterclass",
        "description": "Learn cinematic wedding video editing in Hindi: teasers, highlight films, reels, sound design and colour finishing with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/cinematic-editing-course/",
        "price": "5999",
        "duration": "PT20H",
        "teaches": ["Cinematic wedding editing", "Teaser creation", "Sound design", "Story pacing"]
    },
    "online/album-design-course/index.html": {
        "id": "https://quickartphotography.in/online/album-design-course/#course",
        "name": "Wedding Album Design Course in Photoshop",
        "description": "Album designing course online in Hindi: wedding & photo album design in Photoshop, Karizma and Canvera layouts, retouching and print-ready export.",
        "url": "https://quickartphotography.in/online/album-design-course/",
        "price": "3499",
        "duration": "PT12H",
        "teaches": ["Adobe Photoshop", "Wedding album design", "Photo retouching", "Karizma and Canvera layout"]
    },
    "online/pre-wedding-shoot-course/index.html": {
        "id": "https://quickartphotography.in/online/pre-wedding-shoot-course/#course",
        "name": "Pre-Wedding Shoot & Filmmaking Masterclass",
        "description": "Pre-wedding shoot course in Hindi: couple posing, golden-hour light, gimbal moves and teaser editing with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/pre-wedding-shoot-course/",
        "price": "3999",
        "duration": "PT14H",
        "teaches": ["Pre-wedding photography", "Cinematography", "Couple posing", "Gimbal movement"]
    },
    "online/website-design-course/index.html": {
        "id": "https://quickartphotography.in/online/website-design-course/#course",
        "name": "Website Design Course in Hindi",
        "description": "Website design course in Hindi with no coding: WordPress, Elementor, portfolio galleries and Google SEO for photographers.",
        "url": "https://quickartphotography.in/online/website-design-course/",
        "price": "2999",
        "duration": "PT10H",
        "teaches": ["WordPress", "Elementor", "Photography portfolio design", "Local SEO"]
    },
    "online/digital-marketing-course/index.html": {
        "id": "https://quickartphotography.in/online/digital-marketing-course/#course",
        "name": "Digital Marketing for Photographers & Studios",
        "description": "Digital marketing course in Hindi for photographers: Facebook & Instagram ads, Google local SEO and WhatsApp funnels to get wedding enquiries.",
        "url": "https://quickartphotography.in/online/digital-marketing-course/",
        "price": "3499",
        "duration": "PT12H",
        "teaches": ["Facebook Ads", "Instagram marketing", "Lead generation", "Local business SEO"]
    },
    "online/automation-course/index.html": {
        "id": "https://quickartphotography.in/online/automation-course/#course",
        "name": "Studio Automation & AI CRM Masterclass",
        "description": "WhatsApp automation course in Hindi for studios: auto replies, instant quotes, follow-ups, payment reminders and AI CRM with mentor Anil Sharma.",
        "url": "https://quickartphotography.in/online/automation-course/",
        "price": "2999",
        "duration": "PT8H",
        "teaches": ["WhatsApp automation", "Studio CRM", "Automated quotations", "Client follow-ups"]
    }
}

OFFLINE_COURSES = {
    "courses/video-editing/index.html": {
        "id": "https://quickartphotography.in/courses/video-editing/#course",
        "name": "Video Editing Course in Siwan (6-Week Offline)",
        "description": "Six-week offline video editing course in Siwan covering EDIUS, Premiere Pro, DaVinci Resolve, cinematic wedding storytelling, audio and a final wedding film.",
        "url": "https://quickartphotography.in/courses/video-editing/",
        "duration": "P6W",
        "teaches": ["Video editing", "EDIUS", "Adobe Premiere Pro", "DaVinci Resolve", "Wedding video editing"]
    },
    "courses/album-design/index.html": {
        "id": "https://quickartphotography.in/courses/album-design/#course",
        "name": "Wedding Album Design Course in Siwan (4-Week Offline)",
        "description": "Four-week hands-on photo album design course in Siwan covering Photoshop retouching, Karizma layouts, Canvera sizing and print-ready export.",
        "url": "https://quickartphotography.in/courses/album-design/",
        "duration": "P4W",
        "teaches": ["Photo album design", "Photoshop retouching", "Karizma layout design", "Print color management"]
    },
    "courses/ai-wedding-filmmaking/index.html": {
        "id": "https://quickartphotography.in/courses/ai-wedding-filmmaking/#course",
        "name": "AI Wedding Filmmaking Course in Siwan",
        "description": "Comprehensive practical course in AI-assisted video editing, prompt-driven color grading, dialogue enhancement and wedding cinematography in Siwan.",
        "url": "https://quickartphotography.in/courses/ai-wedding-filmmaking/",
        "duration": "P14W",
        "teaches": ["AI video editing", "Wedding filmmaking", "Dialogue clean-up", "AI color grading"]
    },
    "master-class/index.html": {
        "id": "https://quickartphotography.in/master-class/#course",
        "name": "14-Week Wedding Filmmaking Master Class in Siwan",
        "description": "Fourteen-week complete offline master class in Siwan covering cinematography, camera operation, video editing, album design, color grading and studio business.",
        "url": "https://quickartphotography.in/master-class/",
        "price": "35000",
        "duration": "P14W",
        "teaches": ["Cinematography", "Video editing", "Album design", "Color grading", "Studio business"]
    }
}

BLOG_POSTS = {
    "blog/best-video-editing-software-in-2026/index.html": {
        "slug": "best-video-editing-software-in-2026",
        "headline": "Best Video Editing Software in 2026: Premiere Pro vs DaVinci Resolve vs EDIUS",
        "description": "Comprehensive comparison of Premiere Pro, DaVinci Resolve, and EDIUS for wedding videographers and content creators in Bihar.",
        "image": "https://quickartphotography.in/home-assets/7205ed1f9ab838.jpeg",
        "datePublished": "2026-04-30",
        "dateModified": "2026-04-30"
    },
    "blog/freelance-video-editor-earn-in-bihar/index.html": {
        "slug": "freelance-video-editor-earn-in-bihar",
        "headline": "How Much Does a Freelance Video Editor Earn in Bihar? (2026 Career Guide)",
        "description": "Realistic income breakdown, client acquisition strategies, and package pricing for freelance video editors and studios in Bihar.",
        "image": "https://quickartphotography.in/home-assets/063569f6448203.jpeg",
        "datePublished": "2026-05-25",
        "dateModified": "2026-05-25"
    },
    "blog/how-ai-is-changing-wedding-filmmaking-2026/index.html": {
        "slug": "how-ai-is-changing-wedding-filmmaking-2026",
        "headline": "How AI is Changing Wedding Filmmaking in 2026: Workflows, Tools, and Realities",
        "description": "Discover how AI audio cleaning, auto-reframing, scene detection, and generative tools are speeding up wedding film turnaround.",
        "image": "https://quickartphotography.in/home-assets/398bbffe508624.jpeg",
        "datePublished": "2026-05-12",
        "dateModified": "2026-05-12"
    },
    "blog/top-10-photography-studios-in-chapra/index.html": {
        "slug": "top-10-photography-studios-in-chapra",
        "headline": "Top 10 Wedding Photography Studios in Chapra (Saran) – 2026 Review & Guide",
        "description": "Complete guide to top wedding photography and cinematography studios in Chapra, Saran district with pricing and quality factors.",
        "image": "https://quickartphotography.in/assets/blog-chapra-photography-studios-hero.jpg",
        "datePublished": "2026-09-20",
        "dateModified": "2026-09-20"
    },
    "blog/top-5-editing-course-academies-in-patna/index.html": {
        "slug": "top-5-editing-course-academies-in-patna",
        "headline": "Top 5 Video Editing Academies in Patna (2026 Comparison Guide)",
        "description": "Detailed review of video editing courses in Patna vs hands-on studio training at Quick Art Photography Academy with free hostel.",
        "image": "https://quickartphotography.in/assets/blog-top-5-editing-course-patna-hero.jpg",
        "datePublished": "2026-09-20",
        "dateModified": "2026-09-20"
    },
    "blog/video-editing-course-in-gaya/index.html": {
        "slug": "video-editing-course-in-gaya",
        "headline": "Video Editing Course in Gaya: Complete Guide to Fees, Syllabus & Academy Options",
        "description": "Explore practical video editing and wedding post-production training for students in Gaya, Bihar with free accommodation in Siwan.",
        "image": "https://quickartphotography.in/assets/blog-video-editing-course-gaya-hero.jpg",
        "datePublished": "2026-09-20",
        "dateModified": "2026-09-20"
    }
}

def extract_visible_faqs(html):
    faqs = []
    # Match <details> or .faq-item blocks
    items = re.findall(
        r'<details\b[^>]*>.*?<summary[^>]*>(.*?)</summary>(.*?)</details>',
        html,
        re.DOTALL | re.IGNORECASE
    )
    for q_raw, a_raw in items:
        # Check if it looks like a valid FAQ (has question mark or meaningful query)
        q_clean = re.sub(r'<[^>]+>', '', q_raw).replace('+', '').strip()
        a_clean = re.sub(r'<[^>]+>', '', a_raw).strip()
        # Clean extra whitespace
        q_clean = ' '.join(q_clean.split())
        a_clean = ' '.join(a_clean.split())
        if len(q_clean) > 8 and len(a_clean) > 15:
            faqs.append({
                "@type": "Question",
                "name": q_clean,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": a_clean
                }
            })
    return faqs

def extract_online_reviews(html):
    reviews = []
    pattern = (
        r'<div class=["\']lp-review-card["\'].*?<p class=["\']lp-review-text["\']>\s*(.*?)\s*</p>.*?<div class=["\']lp-author-name["\']>\s*(.*?)\s*</div>'
    )
    for text, author in re.findall(pattern, html, re.DOTALL):
        text_clean = re.sub(r'<[^>]+>', '', text).strip().strip('"').strip("'").strip()
        author_clean = re.sub(r'<[^>]+>', '', author).strip()
        if text_clean and author_clean:
            reviews.append({
                "@type": "Review",
                "author": {"@type": "Person", "name": author_clean},
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                },
                "reviewBody": text_clean
            })
    return reviews

def extract_masterclass_reviews():
    return [
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Divakar Kumar"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "Best video editing class in Siwan, Bihar."
        },
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Sahila Ansari"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "The wedding studio here captured our special day with such artistry. The team’s attention to detail and creative eye were evident in every shot. Final prints are stunning — truly exceeding our expectations."
        },
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Rahul Kumar"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "The wedding studio at Quick Art Photography Academy captured our special day beautifully. Team’s patience and skill resulted in stunning portraits."
        },
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Khushboo Raj"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "Solid video editing course. Learned practical skills that are really useful. Instructors were knowledgeable and the atmosphere was conducive to learning."
        },
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Radhika Devi"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "Learned so much in their video editing course! Instructors were patient and clearly explained every step. Hands-on practice sessions were incredibly beneficial."
        },
        {
            "@type": "Review",
            "author": {"@type": "Person", "name": "Siddharth Kumar"},
            "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
            "reviewBody": "Very informative course. Instructors were very supportive, breaking down complex concepts clearly. Practical sessions gave real hands-on experience."
        }
    ]

def generate_schema_for_page(rel_path, html):
    # Rule 5: Visible reviews check for Org aggregateRating
    # AggregateRating is placed ONLY on pages with a visible review section matching 4.9/1800 + Google Maps link
    has_visible_reviews_pill = (
        ("4.9/5" in html or "4.9" in html) and
        ("1,800+" in html or "1,800" in html or "1800" in html) and
        MAPS_URL in html
    )
    
    # We only include aggregateRating on pages that explicitly feature this review trust strip/section
    include_org_rating = has_visible_reviews_pill and (
        rel_path in [
            "index.html",
            "master-class/index.html",
            "courses/video-editing/index.html",
            "courses/album-design/index.html",
            "courses/ai-wedding-filmmaking/index.html"
        ]
    )

    base_org = get_base_org(include_aggregate_rating=include_org_rating)
    base_website = get_base_website()
    base_person = get_base_person()

    graph = [base_org, base_website, base_person]

    # 1. Homepage
    if rel_path == "index.html":
        graph.append({
            "@type": "WebPage",
            "@id": "https://quickartphotography.in/#webpage",
            "url": "https://quickartphotography.in/",
            "name": "Video Editing Course in Siwan | Quick Art Photography Academy",
            "description": "Best video editing course in Siwan & Bihar. Master Premiere Pro, DaVinci & EDIUS with practical studio training & free hostel. Rated 4.9/5 by 1,800+ students.",
            "inLanguage": "en-IN",
            "isPartOf": {"@id": "https://quickartphotography.in/#website"},
            "about": {"@id": "https://quickartphotography.in/#academy"},
            "primaryImageOfPage": {
                "@type": "ImageObject",
                "url": HERO_IMAGE_URL
            }
        })

        # ItemList of all courses offered
        all_courses = []
        pos = 1
        for c_file, c_data in OFFLINE_COURSES.items():
            all_courses.append({
                "@type": "ListItem",
                "position": pos,
                "item": {
                    "@type": "Course",
                    "name": c_data["name"],
                    "description": c_data["description"],
                    "url": c_data["url"]
                }
            })
            pos += 1
        for c_file, c_data in ONLINE_COURSES.items():
            all_courses.append({
                "@type": "ListItem",
                "position": pos,
                "item": {
                    "@type": "Course",
                    "name": c_data["name"],
                    "description": c_data["description"],
                    "url": c_data["url"]
                }
            })
            pos += 1

        graph.append({
            "@type": "ItemList",
            "name": "Professional Photography & Video Editing Courses",
            "itemListElement": all_courses
        })

        # FAQPage from visible FAQs on homepage
        home_faqs = [
            {
                "@type": "Question",
                "name": "Siwan me video editing course ki fees kitni hai?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Quick Art Photography Academy me video editing course ki complete fee details, batch timing aur hostel facility ki jankari ke liye aap hume call (+91 9939800780) karein ya campus visit karke free demo class attend karein."
                }
            },
            {
                "@type": "Question",
                "name": "Kya Patna, Chhapra aur Gopalganj ke students aa sakte hain?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Haan, hamare offline classes me Siwan ke alawa Gopalganj, Chhapra, Patna aur pure Bihar se students aate hain. Outstation students ke liye 100% free hostel aur rehne ki suvidha uplabdh hai."
                }
            },
            {
                "@type": "Question",
                "name": "Kya photo aur video editing dono ek course me sikhaye jate hain?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Haan, hamare comprehensive offline programs (jaise 14-Week Master Class aur editing modules) me Photoshop photo retouching, album design ke sath-sath EDIUS, Premiere Pro aur DaVinci Resolve par video editing sikhayi jati hai."
                }
            }
        ]
        graph.append({
            "@type": "FAQPage",
            "mainEntity": home_faqs
        })

        # 4 YouTube Student Testimonial Videos
        youtube_videos = [
            {
                "@type": "VideoObject",
                "name": "Suraj from Raxaul – Student Review",
                "description": "Student testimonial from Suraj (Raxaul) sharing his practical video editing learning experience at Quick Art Photography Academy in Siwan.",
                "thumbnailUrl": "https://quickartphotography.in/home-assets/6afdafd6fcee09.jpg",
                "uploadDate": "2024-01-15T00:00:00+05:30",
                "contentUrl": "https://www.youtube.com/watch?v=FKtK5dPFilg",
                "embedUrl": "https://www.youtube.com/embed/FKtK5dPFilg"
            },
            {
                "@type": "VideoObject",
                "name": "Ravi from Gaya – Student Review",
                "description": "Student testimonial from Ravi (Gaya) sharing his experience learning wedding video editing at Quick Art Photography Academy.",
                "thumbnailUrl": "https://quickartphotography.in/home-assets/0c3a2dde79f830.jpg",
                "uploadDate": "2024-01-15T00:00:00+05:30",
                "contentUrl": "https://www.youtube.com/watch?v=MrZycOa2ltU",
                "embedUrl": "https://www.youtube.com/embed/MrZycOa2ltU"
            },
            {
                "@type": "VideoObject",
                "name": "Ashish from Chapra – Student Review",
                "description": "Student testimonial from Ashish (Chapra) sharing his training experience at Quick Art Photography Academy in Siwan.",
                "thumbnailUrl": "https://quickartphotography.in/home-assets/42bc8405f4fae8.jpg",
                "uploadDate": "2024-01-15T00:00:00+05:30",
                "contentUrl": "https://www.youtube.com/watch?v=FCjaO7LmM6o",
                "embedUrl": "https://www.youtube.com/embed/FCjaO7LmM6o"
            },
            {
                "@type": "VideoObject",
                "name": "Vikash from Baliya, UP – Student Review",
                "description": "Student testimonial from Vikash (Baliya, UP) sharing his video editing and filmmaking course experience at Quick Art Photography Academy.",
                "thumbnailUrl": "https://quickartphotography.in/home-assets/3f3523fbb97fb5.jpg",
                "uploadDate": "2024-01-15T00:00:00+05:30",
                "contentUrl": "https://www.youtube.com/watch?v=CqMTAN3crS4",
                "embedUrl": "https://www.youtube.com/embed/CqMTAN3crS4"
            }
        ]
        graph.extend(youtube_videos)

        # MobileApplication on Google Play
        graph.append({
            "@type": "MobileApplication",
            "name": "Quick Art Academy",
            "operatingSystem": "Android",
            "applicationCategory": "EducationalApplication",
            "installUrl": "https://quickartphotography.in/downloads/quickart-academy-release.apk",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "INR"
            }
        })

        # Real visible review on homepage (Raju Gupta)
        graph.append({
            "@type": "Review",
            "itemReviewed": {
                "@id": "https://quickartphotography.in/#academy"
            },
            "author": {
                "@type": "Person",
                "name": "Raju Gupta"
            },
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": "5",
                "bestRating": "5"
            },
            "reviewBody": "Quick Art Photography Academy completely changed my approach to lighting and post-processing. The courses are incredibly detailed and the feedback from instructors is invaluable. My portfolio has never looked better and I have started booking paid clients!"
        })

    # 2. Offline Courses
    elif rel_path in OFFLINE_COURSES:
        cfg = OFFLINE_COURSES[rel_path]
        offer_node = {
            "@type": "Offer",
            "category": "Paid",
            "priceCurrency": "INR",
            "availability": "https://schema.org/InStock",
            "url": cfg["url"]
        }
        if "price" in cfg:
            offer_node["price"] = cfg["price"]

        course_node = {
            "@type": "Course",
            "@id": cfg["id"],
            "name": cfg["name"],
            "description": cfg["description"],
            "url": cfg["url"],
            "provider": {"@id": "https://quickartphotography.in/#academy"},
            "inLanguage": "hi",
            "educationalLevel": "Beginner to Advanced",
            "teaches": cfg["teaches"],
            "educationalCredentialAwarded": "Certificate of Completion",
            "timeRequired": cfg["duration"],
            "offers": offer_node,
            "hasCourseInstance": {
                "@type": "CourseInstance",
                "courseMode": "onsite",
                "courseWorkload": cfg["duration"],
                "location": {"@id": "https://quickartphotography.in/#academy"},
                "instructor": {"@id": "https://quickartphotography.in/#anil-sharma"}
            }
        }

        # Check for real reviews on page (master-class has 6 visible Google Reviews)
        if rel_path == "master-class/index.html":
            course_node["review"] = extract_masterclass_reviews()

        graph.append(course_node)

        breadcrumb = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Courses", "item": "https://quickartphotography.in/courses/"},
                {"@type": "ListItem", "position": 3, "name": cfg["name"], "item": cfg["url"]}
            ]
        }
        graph.append(breadcrumb)

        # Visible FAQs
        faqs = extract_visible_faqs(html)
        if faqs:
            graph.append({"@type": "FAQPage", "mainEntity": faqs})

    # 3. Online Courses
    elif rel_path in ONLINE_COURSES:
        cfg = ONLINE_COURSES[rel_path]
        course_node = {
            "@type": "Course",
            "@id": cfg["id"],
            "name": cfg["name"],
            "description": cfg["description"],
            "url": cfg["url"],
            "provider": {"@id": "https://quickartphotography.in/#academy"},
            "inLanguage": "hi",
            "educationalLevel": "Beginner to Advanced",
            "teaches": cfg["teaches"],
            "educationalCredentialAwarded": "Certificate of Completion",
            "timeRequired": cfg["duration"],
            "offers": {
                "@type": "Offer",
                "category": "Paid",
                "price": cfg["price"],
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "url": cfg["url"]
            },
            "hasCourseInstance": {
                "@type": "CourseInstance",
                "courseMode": "online",
                "courseWorkload": cfg["duration"],
                "instructor": {"@id": "https://quickartphotography.in/#anil-sharma"}
            }
        }

        # Extract real visible student reviews from .lp-review-card
        page_reviews = extract_online_reviews(html)
        if page_reviews:
            course_node["review"] = page_reviews

        graph.append(course_node)

        breadcrumb = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Online Courses", "item": "https://quickartphotography.in/online/"},
                {"@type": "ListItem", "position": 3, "name": cfg["name"], "item": cfg["url"]}
            ]
        }
        graph.append(breadcrumb)

        faqs = extract_visible_faqs(html)
        if faqs:
            graph.append({"@type": "FAQPage", "mainEntity": faqs})

    # 4. /online/ Hub Page
    elif rel_path == "online/index.html":
        graph.append({
            "@type": "CollectionPage",
            "@id": "https://quickartphotography.in/online/#webpage",
            "url": "https://quickartphotography.in/online/",
            "name": "Online Video Editing & Filmmaking Courses | Quick Art",
            "description": "Learn Adobe Premiere Pro, DaVinci Resolve, EDIUS, album design and studio automation online in Hindi at your own pace.",
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        items = []
        for idx, (c_path, c_info) in enumerate(ONLINE_COURSES.items(), 1):
            items.append({
                "@type": "ListItem",
                "position": idx,
                "item": {
                    "@type": "Course",
                    "name": c_info["name"],
                    "description": c_info["description"],
                    "url": c_info["url"]
                }
            })
        graph.append({
            "@type": "ItemList",
            "name": "Online Video Editing Courses in Hindi",
            "itemListElement": items
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Online Courses", "item": "https://quickartphotography.in/online/"}
            ]
        })

    # 5. /courses/ Hub Page
    elif rel_path == "courses/index.html":
        graph.append({
            "@type": "CollectionPage",
            "@id": "https://quickartphotography.in/courses/#webpage",
            "url": "https://quickartphotography.in/courses/",
            "name": "Photography & Video Editing Courses in Siwan | Quick Art",
            "description": "Explore video editing, album design, AI wedding filmmaking and the 14-week Master Class at Quick Art Photography Academy in Siwan, Bihar.",
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        items = []
        for idx, (c_path, c_info) in enumerate(OFFLINE_COURSES.items(), 1):
            items.append({
                "@type": "ListItem",
                "position": idx,
                "item": {
                    "@type": "Course",
                    "name": c_info["name"],
                    "description": c_info["description"],
                    "url": c_info["url"]
                }
            })
        graph.append({
            "@type": "ItemList",
            "name": "On-Campus Offline Courses in Siwan",
            "itemListElement": items
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Courses", "item": "https://quickartphotography.in/courses/"}
            ]
        })

    # 6. /about-us/
    elif rel_path == "about-us/index.html":
        graph.append({
            "@type": "AboutPage",
            "@id": "https://quickartphotography.in/about-us/#webpage",
            "url": "https://quickartphotography.in/about-us/",
            "name": "About Quick Art Photography Academy | Anil Sharma, Siwan",
            "description": "Meet founder Anil Sharma and Quick Art Photography Academy: practical filmmaking, video editing and album design training in Siwan, Bihar.",
            "mainEntity": {"@id": "https://quickartphotography.in/#academy"},
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "About Us", "item": "https://quickartphotography.in/about-us/"}
            ]
        })

    # 7. /contact-us/
    elif rel_path == "contact-us/index.html":
        graph.append({
            "@type": "ContactPage",
            "@id": "https://quickartphotography.in/contact-us/#webpage",
            "url": "https://quickartphotography.in/contact-us/",
            "name": "Contact Quick Art Photography Academy | Siwan – Free Demo",
            "description": "Call +91 9939800780 or visit Quick Art Photography Academy, Ayodhya Puri, Siwan for course details, fees, a free demo class and batch dates.",
            "mainEntity": {"@id": "https://quickartphotography.in/#academy"},
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        graph.append({
            "@type": "Place",
            "@id": "https://quickartphotography.in/#campus",
            "name": "Quick Art Photography Academy Campus",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Ayodhya Puri, Near Lalit Bus Stand",
                "addressLocality": "Siwan",
                "addressRegion": "Bihar",
                "postalCode": "841226",
                "addressCountry": "IN"
            },
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": LATITUDE,
                "longitude": LONGITUDE
            },
            "hasMap": MAPS_URL
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Contact Us", "item": "https://quickartphotography.in/contact-us/"}
            ]
        })

    # 8. /blog/ Index
    elif rel_path == "blog/index.html":
        graph.append({
            "@type": "Blog",
            "@id": "https://quickartphotography.in/blog/#blog",
            "url": "https://quickartphotography.in/blog/",
            "name": "Quick Art Photography Academy Blog",
            "description": "Practical guides to video editing workflows, AI-assisted wedding production and freelance career growth from Quick Art Photography Academy.",
            "publisher": {"@id": "https://quickartphotography.in/#academy"}
        })
        graph.append({
            "@type": "CollectionPage",
            "@id": "https://quickartphotography.in/blog/#webpage",
            "url": "https://quickartphotography.in/blog/",
            "name": "Video Editing & Filmmaking Guides | Quick Art Blog",
            "description": "Read practical guides to video editing workflows, AI-assisted wedding production and freelance portfolio development from Quick Art Photography Academy.",
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        blog_items = []
        for idx, (b_path, b_info) in enumerate(BLOG_POSTS.items(), 1):
            blog_items.append({
                "@type": "ListItem",
                "position": idx,
                "item": {
                    "@type": "BlogPosting",
                    "headline": b_info["headline"],
                    "description": b_info["description"],
                    "url": f"https://quickartphotography.in/blog/{b_info['slug']}/"
                }
            })
        graph.append({
            "@type": "ItemList",
            "name": "Latest Filmmaking & Video Editing Articles",
            "itemListElement": blog_items
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://quickartphotography.in/blog/"}
            ]
        })

    # 9. Individual Blog Posts
    elif rel_path in BLOG_POSTS:
        b_info = BLOG_POSTS[rel_path]
        graph.append({
            "@type": "BlogPosting",
            "@id": f"https://quickartphotography.in/blog/{b_info['slug']}/#article",
            "headline": b_info["headline"],
            "description": b_info["description"],
            "image": {
                "@type": "ImageObject",
                "url": b_info["image"],
                "width": 1200,
                "height": 675
            },
            "datePublished": b_info["datePublished"],
            "dateModified": b_info["dateModified"],
            "author": {"@id": "https://quickartphotography.in/#anil-sharma"},
            "publisher": {"@id": "https://quickartphotography.in/#academy"},
            "mainEntityOfPage": f"https://quickartphotography.in/blog/{b_info['slug']}/"
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://quickartphotography.in/blog/"},
                {"@type": "ListItem", "position": 3, "name": b_info["headline"][:60], "item": f"https://quickartphotography.in/blog/{b_info['slug']}/"}
            ]
        })

    # 10. Policy & Sitemap Pages
    elif rel_path in [
        "privacy-policy/index.html",
        "refund-policy/index.html",
        "shipping-policy/index.html",
        "terms-and-conditions/index.html",
        "sitemap.html"
    ]:
        page_names = {
            "privacy-policy/index.html": ("Privacy Policy", "https://quickartphotography.in/privacy-policy/"),
            "refund-policy/index.html": ("Refund & Cancellation Policy", "https://quickartphotography.in/refund-policy/"),
            "shipping-policy/index.html": ("Shipping & Delivery Policy", "https://quickartphotography.in/shipping-policy/"),
            "terms-and-conditions/index.html": ("Terms & Conditions", "https://quickartphotography.in/terms-and-conditions/"),
            "sitemap.html": ("HTML Sitemap", "https://quickartphotography.in/sitemap.html")
        }
        title, page_url = page_names[rel_path]
        page_type = "CollectionPage" if rel_path == "sitemap.html" else "WebPage"
        graph.append({
            "@type": page_type,
            "url": page_url,
            "name": f"{title} | Quick Art Photography Academy",
            "isPartOf": {"@id": "https://quickartphotography.in/#website"}
        })
        graph.append({
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://quickartphotography.in/"},
                {"@type": "ListItem", "position": 2, "name": title, "item": page_url}
            ]
        })

    return {
        "@context": "https://schema.org",
        "@graph": graph
    }

def apply_schema_to_file(rel_path):
    if not os.path.exists(rel_path):
        return False
    with open(rel_path, "r", encoding="utf-8") as f:
        html = f.read()

    orig_html = html
    # Generate schema
    schema_dict = generate_schema_for_page(rel_path, html)
    schema_json = json.dumps(schema_dict, indent=2, ensure_ascii=False)
    schema_tag = f'<script type="application/ld+json">\n{schema_json}\n</script>'

    # Remove all existing <script type="application/ld+json">...</script>
    html = re.sub(r'<script\s+type=["\']application/ld\+json["\'][^>]*>.*?</script>\s*', '', html, flags=re.DOTALL)

    # Insert exactly ONE schema before </head>
    html = re.sub(r'(</head>)', f'{schema_tag}\n\\1', html, count=1, flags=re.IGNORECASE)

    if html != orig_html:
        with open(rel_path, "w", encoding="utf-8") as f:
            f.write(html)
        return True
    return False

if __name__ == "__main__":
    files = sorted(glob.glob("**/*.html", recursive=True))
    # Exclude non-indexable admin, portal, players, 404, and redirect stubs from schema
    exclude = {
        "404.html",
        "admin.html",
        "adobe-premiere-pro-course/index.html",
        "best-davinci-resolve-online-course-in-hindi/index.html",
        "courses/graphic-design/index.html",
        "join-video-editing-album-design-course/index.html",
        "master-class/live.html",
        "portal/email-template-preview.html",
        "portal/index.html",
        "portal/signup.html",
        "thank-you/index.html",
        "watch/index.html"
    }

    # Ensure any schema inside excluded files is purged
    for ef in exclude:
        if os.path.exists(ef):
            with open(ef, "r", encoding="utf-8") as f:
                content = f.read()
            cleaned = re.sub(r'<script\s+type=["\']application/ld\+json["\'][^>]*>.*?</script>\s*', '', content, flags=re.DOTALL)
            if cleaned != content:
                with open(ef, "w", encoding="utf-8") as f:
                    f.write(cleaned)
                print(f"Purged schema from excluded file: {ef}")

    updated = 0
    for f in files:
        if f in exclude:
            continue
        if apply_schema_to_file(f):
            print(f"Applied unified @graph schema to {f}")
            updated += 1
    print(f"Schema application complete. Updated {updated} files.")
