<?php
// api/lms-admin.php — LMS Admin Console API
// Quick Art Photography Academy
// Requires Admin Authentication (X-Admin-Pass or X-Admin-Token)

require_once __DIR__ . '/_helpers.php';
send_cors();

if (!defined('LMS_COURSES_FILE'))  define('LMS_COURSES_FILE', DATA_DIR . '/courses.json');
if (!defined('LMS_STUDENTS_FILE')) define('LMS_STUDENTS_FILE', DATA_DIR . '/students.json');
if (!defined('LMS_SETTINGS_FILE')) define('LMS_SETTINGS_FILE', DATA_DIR . '/lms-settings.json');
if (!defined('LMS_COUPONS_FILE'))  define('LMS_COUPONS_FILE', DATA_DIR . '/coupons.json');
if (!defined('LMS_TRANSACTIONS_FILE')) define('LMS_TRANSACTIONS_FILE', DATA_DIR . '/transactions.json');
if (!defined('LMS_LIVE_CLASSES_FILE')) define('LMS_LIVE_CLASSES_FILE', DATA_DIR . '/live-classes.json');
if (!defined('LMS_LIVE_CHAT_FILE'))    define('LMS_LIVE_CHAT_FILE', DATA_DIR . '/live-chat.json');

// Helper functions for Live Classes & Chat
function get_all_live_classes() {
    if (!file_exists(LMS_LIVE_CLASSES_FILE)) return [];
    return json_decode(file_get_contents(LMS_LIVE_CLASSES_FILE), true) ?: [];
}

function save_all_live_classes($classes) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_LIVE_CLASSES_FILE, json_encode($classes, JSON_PRETTY_PRINT), LOCK_EX);
}

function get_all_live_chats() {
    if (!file_exists(LMS_LIVE_CHAT_FILE)) return [];
    return json_decode(file_get_contents(LMS_LIVE_CHAT_FILE), true) ?: [];
}

function save_all_live_chats($chats) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_LIVE_CHAT_FILE, json_encode($chats, JSON_PRETTY_PRINT), LOCK_EX);
}

// Ensure admin is logged in (via session token or direct admin password)
// Session token only. (Sending the raw admin password here bypassed the login
// rate-limit, allowing unlimited password guessing.)
$tok = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_SERVER['HTTP_X_ADMIN_PASS'] ?? '');
if (!is_valid_session($tok)) {
    json_err('Unauthorized', 401);
}
$settings = load_settings();

$action = trim($_GET['action'] ?? ($_POST['action'] ?? ''));
if (strpos($action, '&') !== false) {
    parse_str($action, $extraParams);
    if (!empty($extraParams['action'])) {
        $action = trim($extraParams['action']);
    }
    foreach ($extraParams as $k => $v) {
        if (!isset($_GET[$k])) $_GET[$k] = $v;
        if (!isset($_REQUEST[$k])) $_REQUEST[$k] = $v;
    }
}
$method = $_SERVER['REQUEST_METHOD'];

// Helper functions
function get_all_courses() {
    if (!file_exists(LMS_COURSES_FILE)) return [];
    return json_decode(file_get_contents(LMS_COURSES_FILE), true) ?: [];
}

function save_all_courses($courses) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_COURSES_FILE, json_encode($courses, JSON_PRETTY_PRINT), LOCK_EX);
}

function get_all_students() {
    if (!file_exists(LMS_STUDENTS_FILE)) return [];
    return json_decode(file_get_contents(LMS_STUDENTS_FILE), true) ?: [];
}

function save_all_students($students) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_STUDENTS_FILE, json_encode($students, JSON_PRETTY_PRINT), LOCK_EX);
}

function get_all_coupons() {
    if (!file_exists(LMS_COUPONS_FILE)) return [];
    return json_decode(file_get_contents(LMS_COUPONS_FILE), true) ?: [];
}

function save_all_coupons($coupons) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_COUPONS_FILE, json_encode($coupons, JSON_PRETTY_PRINT), LOCK_EX);
}

// Helper to map offline admission program to LMS Course ID (respects internal admission courses)
function map_offline_course_id($courseTitle) {
    $t = strtolower(trim((string)$courseTitle));
    if (!$t) return 'course-cinematic-wedding';

    // 1. Direct ID or exact title match in courses.json
    $courses = get_all_courses();
    foreach ($courses as $c) {
        if ($c['id'] === $courseTitle || strtolower($c['title'] ?? '') === $t) {
            return $c['id'];
        }
    }

    // 1.5 Match by batch number (e.g. "batch 114" or "batch-114" or "114")
    if (preg_match('/batch\s*[-_]?\s*(\d+)/i', $t, $m)) {
        $bNum = $m[1];
        foreach ($courses as $c) {
            if (stripos($c['title'] ?? '', "batch $bNum") !== false || 
                stripos($c['id'] ?? '', "batch-$bNum") !== false || 
                stripos($c['id'] ?? '', "batch$bNum") !== false) {
                return $c['id'];
            }
        }
    }

    // 2. Program keywords mapping
    if (strpos($t, 'advance video') !== false || strpos($t, 'video editing') !== false || strpos($t, 'premiere') !== false) {
        return 'course-premiere-pro';
    }
    if (strpos($t, 'album') !== false) {
        return 'course-album-design';
    }
    if (strpos($t, 'filmmaking') !== false || strpos($t, 'post-production') !== false || strpos($t, 'wedding') !== false || strpos($t, 'cinematic') !== false || strpos($t, '14-week') !== false || strpos($t, 'master') !== false || strpos($t, 'offline') !== false) {
        return 'course-offline-masterclass';
    }
    if (strpos($t, 'marketing') !== false || strpos($t, 'studio') !== false) {
        return 'course-digital-marketing';
    }

    // 3. Check for any internal admission course
    foreach ($courses as $c) {
        if (!empty($c['isInternalOnly']) || !empty($c['isAdmissionCourse'])) {
            return $c['id'];
        }
    }

    return 'course-offline-masterclass';
}

// 1. Get Courses List
if ($action === 'get-courses' && $method === 'GET') {
    json_ok(['courses' => get_all_courses()]);
}

// 2. Save Course (Create / Edit)
if ($action === 'save-course' && $method === 'POST') {
    $body = read_json_body();
    $course = $body['course'] ?? null;
    if (!is_array($course) || empty($course['title'])) {
        json_err('Course title is required', 400);
    }

    $courses = get_all_courses();
    $id = !empty($course['id']) ? $course['id'] : ('course-' . substr(md5(uniqid($course['title'], true)), 0, 8));
    $course['id'] = $id;
    if (empty($course['slug'])) {
        $course['slug'] = preg_replace('/[^a-z0-9]+/', '-', strtolower($course['title']));
    }

    $found = false;
    foreach ($courses as &$c) {
        if ($c['id'] === $id) {
            $c = $course;
            $found = true;
            break;
        }
    }
    unset($c);

    if (!$found) {
        $courses[] = $course;
    }

    save_all_courses($courses);
    json_ok(['course' => $course]);
}

// 3. Delete Course
if ($action === 'delete-course' && $method === 'POST') {
    $body = read_json_body();
    $id = $body['id'] ?? '';
    if (!$id) json_err('Course ID required', 400);

    $courses = get_all_courses();
    $filtered = array_values(array_filter($courses, function($c) use ($id) {
        return $c['id'] !== $id;
    }));

    save_all_courses($filtered);
    json_ok(['deleted' => true, 'id' => $id]);
}

// 4. Get Students List
if ($action === 'get-students' && $method === 'GET') {
    $students = get_all_students();
    $courses = get_all_courses();
    $courseMap = [];
    foreach ($courses as $c) {
        $courseMap[$c['id']] = $c['title'];
    }

    // Load offline admissions data for cross-referencing
    $admFile = DATA_DIR . '/offline-admissions.json';
    $allAdms = file_exists($admFile) ? json_decode(file_get_contents($admFile), true) ?: [] : [];
    $admByPhone = [];
    $admById = [];
    foreach ($allAdms as $adm) {
        $p = clean_phone($adm['phone'] ?? '');
        if ($p) $admByPhone[$p] = $adm;
        if (!empty($adm['id'])) $admById[$adm['id']] = $adm;
    }

    $existingPhones = [];

    // Augment students with progress metrics & offline application data
    foreach ($students as &$stu) {
        $pClean = clean_phone($stu['phone'] ?? '');
        if ($pClean) $existingPhones[$pClean] = true;

        $enrolledNames = [];
        foreach ($stu['enrolledCourses'] ?? [] as $cid) {
            if (isset($courseMap[$cid])) $enrolledNames[] = $courseMap[$cid];
        }
        $stu['enrolledCourseNames'] = $enrolledNames;

        $totalCompleted = 0;
        foreach ($stu['completedLessons'] ?? [] as $lesList) {
            $totalCompleted += count($lesList);
        }
        $stu['totalCompletedLessons'] = $totalCompleted;

        // Cross-reference with offline admission records
        $admRec = $admByPhone[$pClean] ?? ($admById[$stu['offlineAdmissionId'] ?? ''] ?? null);
        if ($admRec) {
            $stu['isOfflineStudent'] = true;
            $stu['offlineAdmissionId'] = $admRec['id'] ?? ($stu['offlineAdmissionId'] ?? '');
            $stu['offlineData'] = $admRec;
            if (empty($stu['appliedCourse'])) $stu['appliedCourse'] = $admRec['courseTitle'] ?? ($admRec['courseName'] ?? '');
            if (empty($stu['studioName'])) $stu['studioName'] = $admRec['studioName'] ?? '';
            if (empty($stu['workCity'])) $stu['workCity'] = $admRec['workCity'] ?? ($admRec['city'] ?? '');
            if (empty($stu['bloodGroup'])) $stu['bloodGroup'] = $admRec['bloodGroup'] ?? '';
            if (empty($stu['fatherName'])) $stu['fatherName'] = $admRec['fatherName'] ?? '';
            if (empty($stu['address'])) $stu['address'] = $admRec['address'] ?? ($admRec['permanentAddress'] ?? '');
            if (isset($admRec['hostelNeeded'])) $stu['hostelNeeded'] = $admRec['hostelNeeded'];
            if (!empty($admRec['photoUrl'])) {
                $stu['photoUrl'] = $admRec['photoUrl'];
                $stu['avatar'] = $admRec['photoUrl'];
                $stu['avatarUrl'] = $admRec['photoUrl'];
            }
            if (!empty($admRec['aadhaarUrl'])) $stu['aadhaarUrl'] = $admRec['aadhaarUrl'];
            if (!empty($admRec['certUrl'])) $stu['certUrl'] = $admRec['certUrl'];
            if (!empty($admRec['paymentMode'])) $stu['paymentMode'] = $admRec['paymentMode'];
            if (!empty($admRec['feeAmount'])) $stu['feeAmount'] = $admRec['feeAmount'];
            if (($admRec['paymentStatus'] ?? '') === 'paid') {
                $stu['isPaid500'] = true;
                $stu['paymentStatus'] = 'paid';
            }
            if (($admRec['status'] ?? '') === 'approved' || ($admRec['status'] ?? '') === 'active') {
                $stu['isApproved'] = true;
            }
            if (!empty($admRec['alumniApproved']) || ($admRec['status'] ?? '') === 'approved_alumni') {
                $stu['alumniApproved'] = true;
            }
            if (empty($stu['status']) || $stu['status'] === 'pending_payment') {
                $stu['status'] = $admRec['status'] ?? ($stu['status'] ?? 'pending_approval');
            }
        }

        // Online Batch Detection
        $appliedCourse = $stu['appliedCourse'] ?? '';
        $courseNamesStr = implode(' ', $stu['enrolledCourseNames'] ?? []);
        if (!empty($stu['isOnlineBatch']) || (!empty($admRec) && !empty($admRec['isOnlineBatch'])) ||
            preg_match('/batch\s*[-_]?\s*(\d+)/i', $appliedCourse . ' ' . $courseNamesStr, $bm)) {
            $stu['isOnlineBatch'] = true;
            if (!empty($bm[1])) $stu['batchNumber'] = $bm[1];
        }
    }
    unset($stu);

    // Course from the admission form (used by Admin certificate view)
    foreach ($students as &$stu) {
        if (!empty($stu['appliedCourse'])) $stu['formCourseId'] = map_offline_course_id($stu['appliedCourse']);
    }
    unset($stu);

    // If any offline applicant is not yet present in students array, synthesize them so admin sees every applicant
    foreach ($allAdms as $adm) {
        $p = clean_phone($adm['phone'] ?? '');
        if ($p && empty($existingPhones[$p])) {
            $existingPhones[$p] = true;
            $isPaid = ($adm['paymentStatus'] ?? '') === 'paid';
            $isAppr = ($adm['status'] ?? '') === 'approved' || ($adm['status'] ?? '') === 'active';
            $cId = !empty($adm['batchCourseId']) ? $adm['batchCourseId'] : map_offline_course_id($adm['courseTitle'] ?? '');
            $enrolledCourses = ($isAppr && $cId) ? [$cId] : [];
            $enrolledNames = [];
            foreach ($enrolledCourses as $cid) {
                if (isset($courseMap[$cid])) $enrolledNames[] = $courseMap[$cid];
            }
            $isBatch = !empty($adm['isOnlineBatch']) || (bool)preg_match('/batch\s*[-_]?\s*(\d+)/i', $adm['courseTitle'] ?? '');
            $students[] = [
                'id' => 'stu_' . substr(md5(uniqid($p, true)), 0, 8),
                'phone' => $p,
                'name' => $adm['fullName'] ?? 'Applicant',
                'email' => $adm['email'] ?? '',
                'city' => $adm['city'] ?? '',
                'enrolledAt' => $adm['createdAt'] ?? date('c'),
                'enrolledCourses' => $enrolledCourses,
                'enrolledCourseNames' => $enrolledNames,
                'formCourseId' => $cId,
                'completedLessons' => [],
                'totalCompletedLessons' => 0,
                'lastActive' => $adm['createdAt'] ?? date('c'),
                'isOfflineStudent' => true,
                'isOnlineBatch' => $isBatch,
                'offlineAdmissionId' => $adm['id'] ?? '',
                'appliedCourse' => $adm['courseTitle'] ?? '',
                'studioName' => $adm['studioName'] ?? '',
                'workCity' => $adm['workCity'] ?? '',
                'bloodGroup' => $adm['bloodGroup'] ?? '',
                'fatherName' => $adm['fatherName'] ?? '',
                'address' => $adm['address'] ?? '',
                'hostelNeeded' => $adm['hostelNeeded'] ?? false,
                'avatar' => $adm['photoUrl'] ?? '',
                'avatarUrl' => $adm['photoUrl'] ?? '',
                'photoUrl' => $adm['photoUrl'] ?? '',
                'aadhaarUrl' => $adm['aadhaarUrl'] ?? '',
                'certUrl' => $adm['certUrl'] ?? '',
                'paymentMode' => $adm['paymentMode'] ?? 'cash',
                'feeAmount' => $adm['feeAmount'] ?? 500,
                'paymentStatus' => $adm['paymentStatus'] ?? 'pending_campus',
                'isPaid500' => $isPaid,
                'isApproved' => $isAppr,
                'alumniApproved' => !empty($adm['alumniApproved']) || ($adm['status'] ?? '') === 'approved_alumni',
                'status' => $adm['status'] ?? ($isPaid ? 'active' : 'pending_approval'),
                'offlineData' => $adm
            ];
        }
    }

    json_ok(['students' => $students, 'courses' => $courses, 'offlineAdmissions' => array_values($allAdms)]);
}

// 4b. Admin: view / issue a student's certificate for one course.
// Idempotent — returns the existing certificate ID if one was already issued
// (by the portal or by admin). The ID is stored so the QR on it verifies, and the
// student later gets the same ID in the portal once they finish the course.
if ($action === 'admin-certificate' && $method === 'POST') {
    $body = read_json_body() ?: [];
    $phone = clean_phone($body['phone'] ?? '');
    $courseId = trim($body['courseId'] ?? '');
    if (strlen($phone) < 10 || !$courseId) json_err('phone and courseId required', 400);

    $course = null;
    foreach (get_all_courses() as $c) {
        if (($c['id'] ?? '') === $courseId) { $course = $c; break; }
    }
    $courseTitle = $course['title'] ?? trim($body['courseTitle'] ?? '');
    if (!$courseTitle) json_err('Course not found', 404);

    // Student / admission details
    $students = get_all_students();
    $stuIdx = null;
    foreach ($students as $i => $st) {
        if (clean_phone($st['phone'] ?? '') === $phone) { $stuIdx = $i; break; }
    }
    $adm = null;
    $admFile = DATA_DIR . '/offline-admissions.json';
    foreach ((file_exists($admFile) ? (json_decode(file_get_contents($admFile), true) ?: []) : []) as $a) {
        if (clean_phone($a['phone'] ?? '') === $phone) { $adm = $a; break; }
    }
    $stu = $stuIdx !== null ? $students[$stuIdx] : [];
    $name = trim($stu['name'] ?? '') ?: trim($adm['fullName'] ?? '') ?: 'Student';
    $enrollNo = ($stu['offlineAdmissionId'] ?? '') ?: (($stu['enrollmentNo'] ?? '') ?: (($adm['id'] ?? '') ?: ('QAA-' . date('Y') . '-' . substr($phone, -4))));

    $issuedFile = DATA_DIR . '/issued-certificates.json';
    $issued = file_exists($issuedFile) ? (json_decode(file_get_contents($issuedFile), true) ?: []) : [];

    // Existing certificate? (portal-issued first, then admin-issued)
    $cert = $stu['certificates'][$courseId] ?? null;
    if (!$cert) {
        foreach ($issued as $ic) {
            if (($ic['phone'] ?? '') === $phone && ($ic['courseId'] ?? '') === $courseId) {
                $cert = ['id' => $ic['id'], 'issuedDate' => $ic['issuedDate'], 'courseTitle' => $ic['courseTitle']];
                break;
            }
        }
    }

    if (!$cert) {
        $cid = strtolower($courseId);
        $code = 'GEN';
        foreach (['pre-wedding' => 'PW', 'album' => 'AD', 'premiere' => 'PR', 'edius' => 'ED', 'davinci' => 'DR', 'resolve' => 'DR',
                  'cinematic' => 'CE', 'wedding' => 'CW', 'website' => 'WD', 'marketing' => 'DM', 'automation' => 'AU'] as $needle => $cc) {
            if (strpos($cid, $needle) !== false) { $code = $cc; break; }
        }
        $cert = [
            'id' => 'QAA-' . date('Y') . '-' . $code . '-' . strtoupper(bin2hex(random_bytes(3))),
            'issuedDate' => date('Y-m-d'),
            'courseTitle' => $courseTitle,
        ];
        $issued[] = [
            'id' => $cert['id'], 'phone' => $phone, 'name' => $name, 'courseId' => $courseId,
            'courseTitle' => $courseTitle, 'enrollmentNo' => $enrollNo,
            'issuedDate' => $cert['issuedDate'], 'issuedBy' => 'admin', 'createdAt' => date('c')
        ];
        file_put_contents($issuedFile, json_encode($issued, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        if ($stuIdx !== null) {
            $students[$stuIdx]['certificates'][$courseId] = $cert;
            save_all_students($students);
        }
    }

    json_ok(['certificate' => [
        'id' => $cert['id'],
        'issuedDate' => $cert['issuedDate'] ?? date('Y-m-d'),
        'courseId' => $courseId,
        'courseTitle' => $courseTitle,
        'studentName' => $name,
        'enrollmentNo' => $enrollNo,
        'verifyUrl' => 'https://quickartphotography.in/portal/?verify=' . urlencode($cert['id'])
    ]]);
}

// 5. Enroll / Create Student (Manual Enrollment from Admin)
if ($action === 'enroll-student' && $method === 'POST') {
    $body = read_json_body();
    $phone = clean_phone($body['phone'] ?? '');

    if (strlen($phone) < 10) {
        json_err('Valid 10-digit mobile number required', 400);
    }

    $name = trim($body['name'] ?? ('Student ' . substr($phone, -4)));
    $email = trim($body['email'] ?? '');
    $city = trim($body['city'] ?? '');
    $coursesToEnroll = $body['enrolledCourses'] ?? [];
    $paymentMethod = trim($body['paymentMethod'] ?? 'Manual Admin');
    $amountPaid = isset($body['amountPaid']) ? intval($body['amountPaid']) : 0;
    $notes = trim($body['notes'] ?? '');

    // Cross-reference offline admissions data to link photo & admission dossier
    $admFile = DATA_DIR . '/offline-admissions.json';
    $admRec = null;
    if (file_exists($admFile)) {
        $allAdms = json_decode(file_get_contents($admFile), true) ?: [];
        foreach ($allAdms as $a) {
            if (clean_phone($a['phone'] ?? '') === $phone) {
                $admRec = $a;
                break;
            }
        }
    }

    $rawPhoto = $body['photo'] ?? ($body['avatar'] ?? ($_FILES['photo'] ?? ($_FILES['avatar'] ?? null)));
    $photoUrl = '';
    if ($rawPhoto) {
        $photoUrl = save_student_avatar_image($rawPhoto, $phone);
    }

    $students = get_all_students();
    $found = false;
    $targetStudent = null;

    foreach ($students as &$stu) {
        if (clean_phone($stu['phone'] ?? '') === $phone) {
            $stu['name'] = $name;
            if ($email) $stu['email'] = $email;
            if ($city) $stu['city'] = $city;
            $stu['enrolledCourses'] = array_values(array_unique(array_merge($stu['enrolledCourses'] ?? [], $coursesToEnroll)));
            $stu['lastActive'] = date('c');

            if ($photoUrl) {
                $stu['avatar'] = $photoUrl;
                $stu['avatarUrl'] = $photoUrl;
                $stu['photoUrl'] = $photoUrl;
            }

            // Preserve or link photo and admission dossier
            if ($admRec) {
                if (empty($stu['avatar']) && !empty($admRec['photoUrl'])) {
                    $stu['avatar'] = $admRec['photoUrl'];
                    $stu['avatarUrl'] = $admRec['photoUrl'];
                    $stu['photoUrl'] = $admRec['photoUrl'];
                }
                if (empty($stu['offlineAdmissionId']) && !empty($admRec['id'])) {
                    $stu['offlineAdmissionId'] = $admRec['id'];
                    $stu['enrollmentNo'] = $admRec['id'];
                }
                if (empty($stu['appliedCourse']) && !empty($admRec['courseTitle'])) {
                    $stu['appliedCourse'] = $admRec['courseTitle'];
                }
                if (empty($stu['fatherName']) && !empty($admRec['fatherName'])) $stu['fatherName'] = $admRec['fatherName'];
                if (empty($stu['bloodGroup']) && !empty($admRec['bloodGroup'])) $stu['bloodGroup'] = $admRec['bloodGroup'];
                if (empty($stu['studioName']) && !empty($admRec['studioName'])) $stu['studioName'] = $admRec['studioName'];
                if (empty($stu['address']) && !empty($admRec['address'])) $stu['address'] = $admRec['address'];
                $stu['isOfflineStudent'] = true;
            }

            $targetStudent = $stu;
            $found = true;
            break;
        }
    }
    unset($stu);

    if (!$found) {
        $targetStudent = [
            'id' => 'stu_' . substr(md5(uniqid($phone, true)), 0, 8),
            'phone' => $phone,
            'name' => $name,
            'email' => $email,
            'city' => $city,
            'enrolledAt' => date('c'),
            'enrolledCourses' => $coursesToEnroll,
            'completedLessons' => [],
            'lastActive' => date('c')
        ];
        if ($photoUrl) {
            $targetStudent['avatar'] = $photoUrl;
            $targetStudent['avatarUrl'] = $photoUrl;
            $targetStudent['photoUrl'] = $photoUrl;
        }
        if ($admRec) {
            if (empty($targetStudent['avatar'])) {
                $targetStudent['avatar'] = $admRec['photoUrl'] ?? '';
                $targetStudent['avatarUrl'] = $admRec['photoUrl'] ?? '';
                $targetStudent['photoUrl'] = $admRec['photoUrl'] ?? '';
            }
            $targetStudent['offlineAdmissionId'] = $admRec['id'] ?? '';
            $targetStudent['enrollmentNo'] = $admRec['id'] ?? '';
            $targetStudent['appliedCourse'] = $admRec['courseTitle'] ?? '';
            $targetStudent['fatherName'] = $admRec['fatherName'] ?? '';
            $targetStudent['bloodGroup'] = $admRec['bloodGroup'] ?? '';
            $targetStudent['studioName'] = $admRec['studioName'] ?? '';
            $targetStudent['address'] = $admRec['address'] ?? '';
            $targetStudent['isOfflineStudent'] = true;
        }
        $students[] = $targetStudent;
    }

    save_all_students($students);

    // Record Transaction in transactions.json
    $courses = get_all_courses();
    $courseTitles = [];
    foreach ($courses as $c) {
        if (in_array($c['id'], $coursesToEnroll)) {
            $courseTitles[] = $c['title'];
        }
    }
    $courseTitleStr = !empty($courseTitles) ? implode(', ', $courseTitles) : 'Manual Enrollment';

    $txs = file_exists(LMS_TRANSACTIONS_FILE) ? json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) : [];
    if (!is_array($txs)) $txs = [];
    $newTx = [
        'id' => 'tx_adm_' . substr(md5(uniqid(microtime(), true)), 0, 8),
        'courseId' => implode(',', $coursesToEnroll),
        'courseTitle' => $courseTitleStr,
        'amount' => $amountPaid,
        'studentName' => $name,
        'studentPhone' => $phone,
        'paymentMethod' => $paymentMethod,
        'notes' => $notes,
        'status' => 'completed',
        'date' => date('c')
    ];
    $txs[] = $newTx;
    file_put_contents(LMS_TRANSACTIONS_FILE, json_encode($txs, JSON_PRETTY_PRINT), LOCK_EX);

    // Generate WhatsApp Welcome Link with direct portal access info
    $waMsg = "Namaste {$name}! 🙏\n\nWelcome to *Quick Art Photography Academy*!\n\nAapko successfully enroll kar diya gaya hai:\n📚 *Course:* {$courseTitleStr}\n💳 *Payment Status:* Confirmed ({$paymentMethod})\n\nApna course shuru karne ke liye neeche diye gaye link par click karein:\n🔗 *Student Portal:* https://www.quickartphotography.in/portal/\n📱 *Login Mobile:* {$phone}\n🔑 *Login OTP:* 123456\n\nKisi bhi help ke liye aap hume isi WhatsApp number par sampark kar sakte hain.\nHappy Learning! 📸🎬\n- Anil Sharma, Director";

    $waLink = "https://wa.me/91{$phone}?text=" . rawurlencode($waMsg);

    json_ok([
        'student' => $targetStudent,
        'transaction' => $newTx,
        'waLink' => $waLink
    ]);
}

// 5.1 Update Student Photo / ID Card Picture (Admin Direct Upload)
if ($action === 'update-student-photo' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $phone = clean_phone($body['phone'] ?? ($_POST['phone'] ?? ''));
    if (strlen($phone) < 10) {
        json_err('Valid 10-digit mobile number required', 400);
    }

    $rawPhoto = $body['photo'] ?? ($body['avatar'] ?? ($_FILES['photo'] ?? ($_FILES['avatar'] ?? null)));
    if (!$rawPhoto) {
        json_err('Photo data or file required', 400);
    }

    $photoUrl = save_student_avatar_image($rawPhoto, $phone);
    if (!$photoUrl) {
        json_err('Photo save nahi ho saki. Valid image file (JPG, PNG, WebP) select karein.', 400);
    }

    // 1. Update in students.json
    $students = get_all_students();
    $foundStudent = false;
    foreach ($students as &$s) {
        if (clean_phone($s['phone'] ?? '') === $phone) {
            $s['photoUrl']  = $photoUrl;
            $s['avatar']    = $photoUrl;
            $s['avatarUrl'] = $photoUrl;
            $foundStudent = true;
            break;
        }
    }
    unset($s);
    if ($foundStudent) {
        save_all_students($students);
    }

    // 2. Update in offline-admissions.json
    $admFile = DATA_DIR . '/offline-admissions.json';
    $adms = file_exists($admFile) ? json_decode(file_get_contents($admFile), true) ?: [] : [];
    $foundAdm = false;
    foreach ($adms as &$a) {
        if (clean_phone($a['phone'] ?? '') === $phone) {
            $a['photoUrl'] = $photoUrl;
            $foundAdm = true;
            break;
        }
    }
    unset($a);
    if ($foundAdm) {
        file_put_contents($admFile, json_encode($adms, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    // Auto sync to alumni directory
    if (function_exists('sync_offline_admissions_to_alumni')) {
        sync_offline_admissions_to_alumni();
    }

    json_ok([
        'ok'       => true,
        'phone'    => $phone,
        'photoUrl' => $photoUrl,
        'message'  => 'Photo successfully updated and linked to Student ID Card!'
    ]);
}

// 6. Delete Student (From Both LMS Students and Offline Admissions Registry)

if ($action === 'delete-student' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? ($body['id'] ?? '');
    if (!$rawPhone) json_err('Phone or ID required', 400);

    $cleanPhone = preg_replace('/[^0-9]/', '', (string)$rawPhone);
    if (strlen($cleanPhone) === 12 && substr($cleanPhone, 0, 2) === '91') $cleanPhone = substr($cleanPhone, 2);

    // 1. Remove from students.json
    $students = get_all_students();
    $filteredStudents = array_values(array_filter($students, function($s) use ($cleanPhone, $rawPhone) {
        $p = preg_replace('/[^0-9]/', '', (string)($s['phone'] ?? ''));
        if (strlen($p) === 12 && substr($p, 0, 2) === '91') $p = substr($p, 2);
        if ($cleanPhone && $p === $cleanPhone) return false;
        if (!empty($s['offlineAdmissionId']) && ($s['offlineAdmissionId'] === $rawPhone || $s['offlineAdmissionId'] === $cleanPhone)) return false;
        if (!empty($s['id']) && ($s['id'] === $rawPhone || $s['id'] === $cleanPhone)) return false;
        return true;
    }));
    save_all_students($filteredStudents);

    // 2. Remove from offline-admissions.json as well
    $admFile = DATA_DIR . '/offline-admissions.json';
    if (file_exists($admFile)) {
        $allAdms = json_decode(file_get_contents($admFile), true) ?: [];
        if (is_array($allAdms)) {
            $filteredAdms = array_values(array_filter($allAdms, function($a) use ($cleanPhone, $rawPhone) {
                $p = preg_replace('/[^0-9]/', '', (string)($a['phone'] ?? ''));
                if (strlen($p) === 12 && substr($p, 0, 2) === '91') $p = substr($p, 2);
                if ($cleanPhone && $p === $cleanPhone) return false;
                if (!empty($a['id']) && ($a['id'] === $rawPhone || $a['id'] === $cleanPhone)) return false;
                return true;
            }));
            file_put_contents($admFile, json_encode($filteredAdms, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }

    json_ok(['deleted' => true, 'phone' => $rawPhone]);
}

// 6.1 Set / Update Student Email & Password (Admin)
if ($action === 'set-student-password' && $method === 'POST') {
    $body     = read_json_body();
    $phone    = preg_replace('/[^0-9]/', '', (string)($body['phone'] ?? ''));
    if (strlen($phone) === 12 && substr($phone, 0, 2) === '91') $phone = substr($phone, 2);
    $email    = strtolower(trim($body['email'] ?? ''));
    $password = trim($body['password'] ?? '');

    if (strlen($phone) < 10) json_err('Valid phone number required', 400);
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Valid email required', 400);
    if (strlen($password) < 6) json_err('Password must be at least 6 characters', 400);

    // Check email not used by another student
    $students = get_all_students();
    foreach ($students as $s) {
        if (strtolower($s['email'] ?? '') === $email && $s['phone'] !== $phone) {
            json_err('Yeh email kisi aur student ke saath registered hai', 409);
        }
    }

    $found = false;
    foreach ($students as &$stu) {
        if ($stu['phone'] === $phone) {
            $stu['email']        = $email;
            $stu['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);
            unset($stu['password']); // remove any legacy plain-text
            $found = true;
            break;
        }
    }
    unset($stu);

    if (!$found) json_err('Student not found', 404);

    save_all_students($students);
    json_ok(['ok' => true, 'message' => 'Email aur password set ho gaya']);
}



// 7. Get LMS Settings
if ($action === 'get-lms-settings' && $method === 'GET') {
    $settings = load_lms_settings();
    json_ok(['settings' => $settings]);
}

// 8. Save LMS Settings
if ($action === 'save-lms-settings' && $method === 'POST') {
    $body = read_json_body();
    $currSettings = load_lms_settings();
    if (!is_array($currSettings)) $currSettings = [];

    $newSettings = [
        'bunnyLibraryId' => isset($body['bunnyLibraryId']) ? trim($body['bunnyLibraryId']) : ($currSettings['bunnyLibraryId'] ?? '755385'),
        'bunnyApiKey' => isset($body['bunnyApiKey']) ? trim($body['bunnyApiKey']) : ($currSettings['bunnyApiKey'] ?? '50179050-0bf6-4266-bc61fb984600-4b08-47e3'),
        'bunnyTokenAuthKey' => isset($body['bunnyTokenAuthKey']) ? trim($body['bunnyTokenAuthKey']) : ($currSettings['bunnyTokenAuthKey'] ?? '436c7112-8150-409c-b5f3-d29a1856b06b'),
        'bunnyHostname' => isset($body['bunnyHostname']) ? trim($body['bunnyHostname']) : ($currSettings['bunnyHostname'] ?? 'iframe.mediadelivery.net'),
        'bunnyAccountApiKey' => isset($body['bunnyAccountApiKey']) ? trim($body['bunnyAccountApiKey']) : ($currSettings['bunnyAccountApiKey'] ?? '174c5167-ecb1-4d9d-9b47-d085ebf2e098dd0da2e5-9071-45ad-b088-9683075c7ed1'),
        'cloudflareAccountId' => isset($body['cloudflareAccountId']) ? trim($body['cloudflareAccountId']) : ($currSettings['cloudflareAccountId'] ?? ''),
        'cloudflareApiToken' => isset($body['cloudflareApiToken']) ? trim($body['cloudflareApiToken']) : ($currSettings['cloudflareApiToken'] ?? ''),
        'razorpayEnabled' => isset($body['razorpayEnabled']) ? !empty($body['razorpayEnabled']) : ($currSettings['razorpayEnabled'] ?? false),
        'razorpayKeyId' => isset($body['razorpayKeyId']) ? trim($body['razorpayKeyId']) : ($currSettings['razorpayKeyId'] ?? ''),
        'razorpayKeySecret' => isset($body['razorpayKeySecret']) ? trim($body['razorpayKeySecret']) : ($currSettings['razorpayKeySecret'] ?? ''),
        'razorpayWebhookSecret' => isset($body['razorpayWebhookSecret']) ? trim($body['razorpayWebhookSecret']) : ($currSettings['razorpayWebhookSecret'] ?? ''),
        'razorpayMode' => isset($body['razorpayMode']) ? trim($body['razorpayMode']) : ($currSettings['razorpayMode'] ?? 'live'),
        'watermarkEnabled' => isset($body['watermarkEnabled']) ? !empty($body['watermarkEnabled']) : ($currSettings['watermarkEnabled'] ?? true),
        'watermarkOpacity' => isset($body['watermarkOpacity']) ? floatval($body['watermarkOpacity']) : ($currSettings['watermarkOpacity'] ?? 0.35),
        'otpDemoMode' => isset($body['otpDemoMode']) ? !empty($body['otpDemoMode']) : ($currSettings['otpDemoMode'] ?? false),
        'defaultOtp' => isset($body['defaultOtp']) ? trim($body['defaultOtp']) : ($currSettings['defaultOtp'] ?? '123456'),
        'aibotflowApiKey' => isset($body['aibotflowApiKey']) ? trim($body['aibotflowApiKey']) : ($currSettings['aibotflowApiKey'] ?? ''),
        'aibotflowOtpTemplate' => isset($body['aibotflowOtpTemplate']) ? trim($body['aibotflowOtpTemplate']) : ($currSettings['aibotflowOtpTemplate'] ?? 'quickart_login_otp'),
        'supabaseUrl' => isset($body['supabaseUrl']) ? rtrim(trim($body['supabaseUrl']), '/') : ($currSettings['supabaseUrl'] ?? ''),
        'supabaseAnonKey' => isset($body['supabaseAnonKey']) ? trim($body['supabaseAnonKey']) : ($currSettings['supabaseAnonKey'] ?? ''),
        'supabaseSecretKey' => isset($body['supabaseSecretKey']) ? trim($body['supabaseSecretKey']) : ($currSettings['supabaseSecretKey'] ?? ''),
        'emailSender' => isset($body['emailSender']) ? trim($body['emailSender']) : ($currSettings['emailSender'] ?? 'support@quickartphotography.in'),
        'emailSenderName' => isset($body['emailSenderName']) ? trim($body['emailSenderName']) : ($currSettings['emailSenderName'] ?? 'Quick Art Photography Academy'),
        'emailSubjectTemplate' => isset($body['emailSubjectTemplate']) ? trim($body['emailSubjectTemplate']) : ($currSettings['emailSubjectTemplate'] ?? 'Your Quick Art Academy Verification OTP: {otp}'),
        'emailMessageCustom' => isset($body['emailMessageCustom']) ? trim($body['emailMessageCustom']) : ($currSettings['emailMessageCustom'] ?? "Dear Student,\n\nYour Quick Art Photography Academy portal verification code is: {otp}\n\nValid for 10 minutes. Please do not share this OTP with anyone.\n\nWarm regards,\nAnil Sharma\nQuick Art Photography Academy\nHelpline: 9939800780"),
        'brevoApiKey' => isset($body['brevoApiKey']) ? trim($body['brevoApiKey']) : ($currSettings['brevoApiKey'] ?? ''),
        'smtpHost' => isset($body['smtpHost']) ? trim($body['smtpHost']) : ($currSettings['smtpHost'] ?? ''),
        'smtpPort' => isset($body['smtpPort']) ? intval($body['smtpPort']) : ($currSettings['smtpPort'] ?? 587),
        'smtpUser' => isset($body['smtpUser']) ? trim($body['smtpUser']) : ($currSettings['smtpUser'] ?? 'support@quickartphotography.in'),
        'smtpPass' => isset($body['smtpPass']) ? trim($body['smtpPass']) : ($currSettings['smtpPass'] ?? ''),
        'collections' => $currSettings['collections'] ?? [
            'course-premiere-pro' => 'e8c9044d-a305-465c-86ca-297e4e71436d',
            'course-edius-pro' => '22652727-657c-4280-8d97-08504a594235',
            'course-davinci-resolve' => '43e2437d-d1ac-4665-ad2b-15b5276d87b6',
            'course-cinematic-wedding' => 'e7173751-87b3-4662-b85a-a481500acded',
            'course-album-design' => '6a818a59-8758-4b3e-9d9f-0a33b8ff2d0e',
            'course-pre-wedding' => 'ed57f97b-fb42-42de-893e-862aa9e9b744',
            'course-website-design' => '9eb90731-0f25-42ee-91ae-190888872929',
            'course-digital-marketing' => '23e69417-3b15-436e-bc23-52066132738f',
            'course-automation' => 'e84c2f96-2763-490d-a250-111f8c7886e9'
        ],
        'academyName' => 'Quick Art Photography Academy',
        'mentorName' => 'Anil Sharma',
        'updatedAt' => date('c')
    ];

    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_SETTINGS_FILE, json_encode($newSettings, JSON_PRETTY_PRINT), LOCK_EX);

    json_ok(['settings' => $newSettings]);
}

// 8.1 Test Bunny.net Connection Handshake
if ($action === 'test-bunny' && ($method === 'GET' || $method === 'POST')) {
    $settings = file_exists(LMS_SETTINGS_FILE) ? json_decode(file_get_contents(LMS_SETTINGS_FILE), true) : [];
    $libraryId = $settings['bunnyLibraryId'] ?? '755385';
    $accountKey = $settings['bunnyAccountApiKey'] ?? '174c5167-ecb1-4d9d-9b47-d085ebf2e098dd0da2e5-9071-45ad-b088-9683075c7ed1';

    $ch = curl_init("https://api.bunny.net/videolibrary/{$libraryId}");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "AccessKey: {$accountKey}",
        "Accept: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $lib = json_decode($res, true);
        json_ok([
            'connected' => true,
            'libraryId' => $lib['Id'] ?? $libraryId,
            'libraryName' => $lib['Name'] ?? 'Quick Art Academy Stream',
            'videoCount' => $lib['VideoCount'] ?? 0,
            'storageUsage' => round(($lib['StorageUsage'] ?? 0) / (1024 * 1024), 2) . ' MB',
            'trafficUsage' => round(($lib['TrafficUsage'] ?? 0) / (1024 * 1024), 2) . ' MB',
            'pullZoneId' => $lib['PullZoneId'] ?? 6632506,
            'status' => 'Active & Secure',
            'trialBalance' => '$50.00'
        ]);
    } else {
        json_ok([
            'connected' => false,
            'message' => 'Bunny.net API response code: ' . $httpCode
        ]);
    }
}

// 8.1B Test Cloudflare Stream Connection Handshake
if ($action === 'test-cloudflare' && ($method === 'GET' || $method === 'POST')) {
    $body = read_json_body();
    $settings = file_exists(LMS_SETTINGS_FILE) ? json_decode(file_get_contents(LMS_SETTINGS_FILE), true) : [];

    $accId = trim($body['cloudflareAccountId'] ?? ($settings['cloudflareAccountId'] ?? ''));
    $apiToken = trim($body['cloudflareApiToken'] ?? ($settings['cloudflareApiToken'] ?? ''));

    if (!$accId || !$apiToken) {
        json_ok([
            'connected' => false,
            'message' => 'Cloudflare Account ID ya API Token field khali hai. Kripya dono daalein.'
        ]);
    }

    $ch = curl_init("https://api.cloudflare.com/client/v4/accounts/{$accId}/stream/live_inputs");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$apiToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = $res ? json_decode($res, true) : null;
    if ($httpCode >= 200 && $httpCode < 300 && !empty($json['success'])) {
        $inputs = $json['result'] ?? [];
        json_ok([
            'connected' => true,
            'accountId' => $accId,
            'liveInputsCount' => count($inputs),
            'status' => 'Active & Live Ready'
        ]);
    } else {
        $errMsg = $json['errors'][0]['message'] ?? ('HTTP ' . $httpCode);
        json_ok([
            'connected' => false,
            'message' => 'Cloudflare Error: ' . $errMsg
        ]);
    }
}

// 8.2 Test Razorpay Connection Handshake
if ($action === 'test-razorpay' && ($method === 'GET' || $method === 'POST')) {
    $body = read_json_body();
    $settings = file_exists(LMS_SETTINGS_FILE) ? json_decode(file_get_contents(LMS_SETTINGS_FILE), true) : [];

    $keyId = trim($body['razorpayKeyId'] ?? ($settings['razorpayKeyId'] ?? ''));
    $keySecret = trim($body['razorpayKeySecret'] ?? ($settings['razorpayKeySecret'] ?? ''));

    if (!$keyId || !$keySecret) {
        json_err('Please provide both Razorpay Key ID and Key Secret to test connection', 400);
    }

    $ch = curl_init("https://api.razorpay.com/v1/payments?count=1");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "{$keyId}:{$keySecret}");
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $isTest = (strpos($keyId, 'test') !== false);
        json_ok([
            'connected' => true,
            'keyId' => $keyId,
            'mode' => $isTest ? 'Test Sandbox' : 'Live Production',
            'message' => 'Razorpay API credentials verified successfully! Ready to accept UPI & cards.'
        ]);
    } else {
        $data = json_decode($res, true);
        $errMsg = $data['error']['description'] ?? "HTTP {$httpCode} Unauthorized / Invalid credentials";
        json_err("Razorpay connection failed: {$errMsg}", 400);
    }
}

// 8.3 Test AIbotflow WhatsApp Live OTP Delivery
if ($action === 'test-whatsapp-otp' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $testPhone = preg_replace('/[^0-9]/', '', (string)$rawPhone);
    if (strlen($testPhone) === 12 && substr($testPhone, 0, 2) === '91') {
        $testPhone = substr($testPhone, 2);
    }

    $settings = file_exists(LMS_SETTINGS_FILE) ? json_decode(file_get_contents(LMS_SETTINGS_FILE), true) : [];
    $apiKey = trim($body['apiKey'] ?? ($settings['aibotflowApiKey'] ?? ''));
    $template = trim($body['template'] ?? ($settings['aibotflowOtpTemplate'] ?? 'quickart_login_otp'));

    if (empty($apiKey)) {
        json_err('AIbotflow WhatsApp API Key darj karein pehle', 400);
    }
    if (strlen($testPhone) < 10) {
        json_err('Valid 10-digit mobile number enter karein', 400);
    }

    $testOtp = strval(random_int(100000, 999999));
    $sendRes = send_aibotflow_whatsapp_otp($testPhone, $testOtp, $apiKey, $template);

    if ($sendRes['ok']) {
        json_ok([
            'success' => true,
            'message' => "Live Test OTP [{$testOtp}] successfully delivered to WhatsApp (+91 {$testPhone})!",
            'response' => $sendRes['response'] ?? []
        ]);
    } else {
        json_err("WhatsApp OTP error: " . ($sendRes['error'] ?? 'Delivery failed'), 400);
    }
}

// 8.5 Test Brevo Live Email Delivery
if ($action === 'test-brevo' && $method === 'POST') {
    $body = read_json_body();
    $testEmail = strtolower(trim($body['email'] ?? ''));
    $apiKey = trim($body['apiKey'] ?? '');
    $settings = file_exists(LMS_SETTINGS_FILE) ? json_decode(file_get_contents(LMS_SETTINGS_FILE), true) : [];

    if (empty($apiKey)) {
        $apiKey = trim($settings['brevoApiKey'] ?? '');
    }
    if (empty($apiKey)) {
        json_err('Brevo API Key darj karein pehle', 400);
    }
    if (!filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
        json_err('Valid email address enter karein', 400);
    }

    $testOtp = strval(random_int(100000, 999999));
    $senderEmail = !empty($settings['emailSender']) ? trim($settings['emailSender']) : 'support@quickartphotography.in';
    $senderName = !empty($settings['emailSenderName']) ? trim($settings['emailSenderName']) : 'Quick Art Photography Academy';
    $subject = "Your Quick Art Academy Verification OTP: {$testOtp}";

    $customMsg = !empty($settings['emailMessageCustom'])
        ? str_replace(['{otp}', '{email}'], [$testOtp, $testEmail], $settings['emailMessageCustom'])
        : "Dear Student,\n\nYour Quick Art Photography Academy portal verification code is: {$testOtp}\n\nValid for 10 minutes. Please do not share this OTP with anyone.\n\nWarm regards,\nAnil Sharma\nQuick Art Photography Academy\nHelpline: 9939800780";

    $html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:30px;margin:0;">'
          . '<div style="max-width:540px;margin:0 auto;background:#161b22;border:1px solid rgba(216,161,83,0.35);border-radius:14px;padding:32px;text-align:center;">'
          . '<div style="display:inline-block;padding:4px 12px;background:rgba(216,161,83,0.15);border:1px solid rgba(216,161,83,0.3);border-radius:9999px;font-size:11px;font-weight:700;color:#d8a153;letter-spacing:1px;margin-bottom:12px;">STUDENT LEARNING PORTAL</div>'
          . '<h2 style="color:#d8a153;margin:0 0 8px;font-size:22px;letter-spacing:0.5px;">Quick Art Photography Academy</h2>'
          . '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:24px 20px;margin-bottom:24px;">'
          . '<p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 18px;white-space:pre-line;">' . htmlspecialchars($customMsg) . '</p>'
          . '<div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#d8a153;background:rgba(216,161,83,0.1);padding:16px 24px;border-radius:8px;display:inline-block;border:1px solid rgba(216,161,83,0.35);">' . htmlspecialchars($testOtp) . '</div>'
          . '<p style="color:#f87171;font-size:12px;margin:18px 0 0;">Valid for 10 minutes. Do not share this OTP with anyone.</p>'
          . '</div>'
          . '</div></body></html>';

    $res = send_brevo_email($testEmail, $subject, $html, $apiKey, $senderEmail, $senderName);
    if ($res['ok']) {
        json_ok(['message' => "Test OTP [{$testOtp}] successfully delivered to {$testEmail} via Brevo!"]);
    } else {
        json_err("Brevo delivery failed: " . ($res['error'] ?? 'Unknown error'), 400);
    }
}

// 9. Get Transactions / Orders
if ($action === 'get-transactions' && $method === 'GET') {
    $txs = file_exists(LMS_TRANSACTIONS_FILE) ? json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) : [];
    if (!is_array($txs)) $txs = [];
    $totalRevenue = 0;
    foreach ($txs as $t) {
        $totalRevenue += intval($t['amount'] ?? 0);
    }
    json_ok([
        'transactions' => array_reverse($txs),
        'totalRevenue' => $totalRevenue,
        'count' => count($txs)
    ]);
}

// 10. List Bunny.net Uploaded Videos
if ($action === 'list-bunny-videos' && $method === 'GET') {
    $settings = load_lms_settings();
    $libraryId = $settings['bunnyLibraryId'] ?? '755385';
    $apiKey = $settings['bunnyApiKey'] ?? '';
    $collectionMap = array_flip($settings['collections'] ?? []);

    $ch = curl_init("https://video.bunnycdn.com/library/{$libraryId}/videos?page=1&itemsPerPage=100");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "AccessKey: {$apiKey}",
        "Accept: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $data = json_decode($res, true);
        $items = $data['items'] ?? [];
        foreach ($items as &$item) {
            $colId = $item['collectionId'] ?? '';
            $item['courseKey'] = $collectionMap[$colId] ?? '';
        }
        unset($item);
        json_ok(['videos' => $items, 'total' => $data['totalItems'] ?? count($items)]);
    } else {
        json_ok(['videos' => [], 'total' => 0]);
    }
}

// 11. List Bunny.net Course Collections
if ($action === 'list-bunny-collections' && $method === 'GET') {
    $settings = load_lms_settings();
    $libraryId = $settings['bunnyLibraryId'] ?? '755385';
    $apiKey = $settings['bunnyApiKey'] ?? '';

    $ch = curl_init("https://video.bunnycdn.com/library/{$libraryId}/collections?page=1&itemsPerPage=50");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "AccessKey: {$apiKey}",
        "Accept: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $res = curl_exec($ch);
    curl_close($ch);

    $data = $res ? json_decode($res, true) : null;
    json_ok(['collections' => $data['items'] ?? []]);
}

// 12. Create Video Object in Bunny Stream (Ready for Upload)
if ($action === 'create-bunny-video' && $method === 'POST') {
    $body = read_json_body();
    $title = trim($body['title'] ?? 'New Lesson Video');
    $collectionId = trim($body['collectionId'] ?? '');

    $settings = load_lms_settings();
    $libraryId = $settings['bunnyLibraryId'] ?? '755385';
    $apiKey = $settings['bunnyApiKey'] ?? '';

    $postData = ['title' => $title];
    if ($collectionId) {
        $postData['collectionId'] = $collectionId;
    }

    $ch = curl_init("https://video.bunnycdn.com/library/{$libraryId}/videos");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "AccessKey: {$apiKey}",
        "Content-Type: application/json",
        "Accept: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $video = json_decode($res, true);
        json_ok([
            'created' => true,
            'videoId' => $video['guid'] ?? '',
            'libraryId' => $libraryId,
            'uploadApiKey' => $apiKey,
            'title' => $video['title'] ?? $title
        ]);
    } else {
        json_err('Failed to create video on Bunny.net (HTTP ' . $httpCode . ')', 500);
    }
}

// 12B. Create Cloudflare Stream Live Input via API (Automatic DVR & OBS Stream Key)
if ($action === 'create-cloudflare-live-input' && $method === 'POST') {
    $body = read_json_body();
    $title = trim($body['title'] ?? 'Live Masterclass');

    $settings = load_lms_settings();
    $accId = trim($settings['cloudflareAccountId'] ?? '');
    $apiToken = trim($settings['cloudflareApiToken'] ?? '');

    if (!$accId || !$apiToken) {
        json_err('Cloudflare Account ID ya API Token LMS Settings me configured nahi hai. Kripya Admin Settings me daalein ya Cloudflare Dashboard se Live Input banayein.', 400);
    }

    $ch = curl_init("https://api.cloudflare.com/client/v4/accounts/{$accId}/stream/live_inputs");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'meta' => ['name' => $title],
        'recording' => [
            'mode' => 'automatic',
            'timeoutSeconds' => 300,
            'requireSignedURLs' => false
        ]
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$apiToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = $res ? json_decode($res, true) : null;
    if ($httpCode >= 200 && $httpCode < 300 && !empty($json['success']) && !empty($json['result'])) {
        $r = $json['result'];
        json_ok([
            'created' => true,
            'videoId' => $r['uid'] ?? '',
            'streamKey' => $r['rtmps']['streamKey'] ?? '',
            'rtmpsUrl' => $r['rtmps']['url'] ?? 'rtmps://live.cloudflare.com:443/live/',
            'webrtcUrl' => $r['webRTC']['url'] ?? ''
        ]);
    } else {
        $errMsg = $json['errors'][0]['message'] ?? ('HTTP ' . $httpCode);
        json_err('Cloudflare Live Input Creation Failed: ' . $errMsg, 400);
    }
}

// 13. Assign Bunny Video to Course Lesson
if ($action === 'assign-lesson-video' && $method === 'POST') {
    $body = read_json_body();
    $courseId = trim($body['courseId'] ?? '');
    $lessonId = trim($body['lessonId'] ?? '');
    $videoId  = trim($body['videoId'] ?? '');
    $duration = trim($body['duration'] ?? '');

    if (!$courseId || !$lessonId || !$videoId) {
        json_err('courseId, lessonId, and videoId are required', 400);
    }

    $courses = get_all_courses();
    $updated = false;
    foreach ($courses as &$c) {
        if ($c['id'] === $courseId) {
            foreach ($c['modules'] as &$m) {
                foreach ($m['lessons'] as &$l) {
                    if ($l['id'] === $lessonId) {
                        $l['videoId'] = $videoId;
                        if (preg_match('/^https?:\/\//i', $videoId)) {
                            $l['videoUrl'] = $videoId;
                        }
                        if ($duration) $l['duration'] = $duration;
                        $updated = true;
                        break 3;
                    }
                }
            }
        }
    }
    unset($c, $m, $l);

    if (!$updated) {
        json_err('Course or Lesson not found', 404);
    }

    save_all_courses($courses);
    json_ok(['updated' => true, 'message' => "Video {$videoId} successfully assigned to {$lessonId}"]);
}

// 14. Get Signed Bunny Video Preview for Admin
if ($action === 'get-bunny-preview' && ($method === 'GET' || $method === 'POST')) {
    $videoId = trim($_GET['videoId'] ?? ($_POST['videoId'] ?? ''));
    if (!$videoId) {
        $body = read_json_body();
        $videoId = trim($body['videoId'] ?? '');
    }
    if (!$videoId) json_err('videoId is required', 400);

    if (preg_match('/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i', $videoId, $m)) {
        $videoId = $m[0];
    }

    $settings = load_lms_settings();
    $libraryId = $settings['bunnyLibraryId'] ?? '755385';
    $tokenKey  = $settings['bunnyTokenAuthKey'] ?? '';

    $expires = time() + 3600 * 4; // 4 hours
    $hashString = $tokenKey . $videoId . $expires;
    $token = hash('sha256', $hashString);
    $embedUrl = "https://iframe.mediadelivery.net/embed/{$libraryId}/{$videoId}?token={$token}&expires={$expires}";

    json_ok([
        'videoId' => $videoId,
        'embedUrl' => $embedUrl,
        'expires' => $expires
    ]);
}

// 15. Get All Coupons
if ($action === 'get-coupons' && $method === 'GET') {
    $coupons = get_all_coupons();
    json_ok(['coupons' => $coupons]);
}

// 16. Save / Create Coupon
if ($action === 'save-coupon' && $method === 'POST') {
    $body = read_json_body();
    $coupon = $body['coupon'] ?? null;
    if (!is_array($coupon) || empty($coupon['code'])) {
        json_err('Coupon code is required', 400);
    }

    $coupon['code'] = strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', trim($coupon['code'])));
    $coupon['discount'] = floatval($coupon['discount'] ?? 0);
    $coupon['type'] = in_array($coupon['type'] ?? '', ['flat', 'percent']) ? $coupon['type'] : 'percent';
    $coupon['maxDiscount'] = !empty($coupon['maxDiscount']) ? intval($coupon['maxDiscount']) : null;
    $coupon['minAmount'] = !empty($coupon['minAmount']) ? intval($coupon['minAmount']) : 0;
    $coupon['courseId'] = trim($coupon['courseId'] ?? 'all') ?: 'all';
    $coupon['expiry'] = trim($coupon['expiry'] ?? date('Y-12-31'));
    $coupon['active'] = !isset($coupon['active']) || !empty($coupon['active']);
    $coupon['uses'] = intval($coupon['uses'] ?? 0);
    $coupon['description'] = trim($coupon['description'] ?? '');

    $coupons = get_all_coupons();
    $found = false;
    foreach ($coupons as &$c) {
        if (strtoupper($c['code']) === $coupon['code']) {
            $coupon['uses'] = $c['uses'] ?? $coupon['uses']; // preserve uses count
            $c = $coupon;
            $found = true;
            break;
        }
    }
    unset($c);

    if (!$found) {
        $coupons[] = $coupon;
    }

    save_all_coupons($coupons);
    json_ok(['coupon' => $coupon]);
}

// 17. Delete Coupon
if ($action === 'delete-coupon' && $method === 'POST') {
    $body = read_json_body();
    $code = strtoupper(trim($body['code'] ?? ''));
    if (!$code) json_err('Coupon code is required', 400);

    $coupons = get_all_coupons();
    $filtered = array_values(array_filter($coupons, function($c) use ($code) {
        return strtoupper($c['code'] ?? '') !== $code;
    }));

    save_all_coupons($filtered);
    json_ok(['deleted' => true, 'code' => $code]);
}

// 18. Upload Practice File / Resource Attachment
if ($action === 'upload-resource' && $method === 'POST') {
    if (empty($_FILES['file'])) {
        json_err('No file uploaded', 400);
    }
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        json_err('Upload error code: ' . $file['error'], 400);
    }

    $uploadDir = __DIR__ . '/../uploads/practice-files';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $origName = basename($file['name']);
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $dangerous = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'phps', 'cgi', 'pl', 'py', 'sh', 'bash', 'exe', 'bat', 'cmd', 'vbs', 'js', 'jar', 'htaccess', 'shtml'];
    if (in_array($ext, $dangerous, true)) {
        json_err('Executable scripts and program files are strictly prohibited.', 400);
    }
    $safeName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
    $finalName = $safeName . '_' . substr(md5(uniqid()), 0, 6) . ($ext ? '.' . $ext : '');
    $dest = $uploadDir . '/' . $finalName;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_err('Failed to save uploaded file to disk', 500);
    }

    json_ok([
        'url'  => '/uploads/practice-files/' . $finalName,
        'name' => $origName,
        'size' => $sizeFormatted,
        'type' => $ext
    ]);
}

// 19. Upload Course Thumbnail / Poster Image
if ($action === 'upload-thumbnail' && $method === 'POST') {
    if (empty($_FILES['file'])) {
        json_err('No image file uploaded', 400);
    }
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        json_err('Upload error code: ' . $file['error'], 400);
    }

    $uploadDir = __DIR__ . '/../uploads/thumbnails';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $origName = basename($file['name']);
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowed)) {
        json_err('Invalid image format. Allowed: JPG, PNG, WEBP', 400);
    }

    $finalName = 'thumb_' . substr(md5(uniqid()), 0, 8) . '.' . $ext;
    $dest = $uploadDir . '/' . $finalName;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_err('Failed to save uploaded image to disk', 500);
    }

    json_ok([
        'url'  => 'uploads/thumbnails/' . $finalName,
        'name' => $origName
    ]);
}

// =======================================================
// 20. Live Classes & Masterclasses Management (Admin)
// =======================================================

// 20.1 Get All Live Classes
if ($action === 'get-live-classes' && $method === 'GET') {
    $classes = get_all_live_classes();
    // Sort so 'live' sessions are on top, then 'scheduled', then 'completed'
    usort($classes, function($a, $b) {
        $priority = ['live' => 0, 'scheduled' => 1, 'completed' => 2];
        $pA = $priority[$a['status'] ?? 'scheduled'] ?? 1;
        $pB = $priority[$b['status'] ?? 'scheduled'] ?? 1;
        if ($pA !== $pB) return $pA - $pB;
        return strcmp($b['scheduledAt'] ?? '', $a['scheduledAt'] ?? '');
    });
    json_ok(['liveClasses' => $classes]);
}

// 20.2 Save Live Class (Create / Update)
if ($action === 'save-live-class' && $method === 'POST') {
    $body = read_json_body();
    $item = $body['liveClass'] ?? null;
    if (!is_array($item) || empty($item['title'])) {
        json_err('Title is required for live class', 400);
    }

    $classes = get_all_live_classes();
    $id = !empty($item['id']) ? trim($item['id']) : ('live_' . substr(md5(uniqid($item['title'], true)), 0, 8));
    
    // Extract stream ID if user pasted a full YouTube link
    $rawStream = trim($item['streamId'] ?? '');
    if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i', $rawStream, $matches)) {
        $rawStream = $matches[1];
    }

    $cId = trim($item['courseId'] ?? '');
    $liveType = in_array($item['type'] ?? '', ['course', 'workshop']) ? $item['type'] : 'workshop';
    if ($liveType === 'course' && (empty($cId) || $cId === 'all')) {
        if (preg_match('/batch\s*[-_]?\s*(\d+)/i', trim($item['title'] ?? ''), $bm)) {
            $mappedCid = map_offline_course_id(trim($item['title']));
            if ($mappedCid && $mappedCid !== 'course-offline-masterclass') {
                $cId = $mappedCid;
            }
        }
    }

    $record = [
        'id'            => $id,
        'title'         => trim($item['title']),
        'description'   => trim($item['description'] ?? ''),
        'type'          => $liveType,
        'courseId'      => $cId,
        'ticketPrice'   => (int)($item['ticketPrice'] ?? 0),
        'originalPrice'             => (int)($item['originalPrice'] ?? 0),
        'scheduledAt'               => trim($item['scheduledAt'] ?? date('c')),
        'duration'                  => trim($item['duration'] ?? '90 Mins'),
        'status'                    => in_array($item['status'] ?? '', ['scheduled', 'live', 'completed']) ? $item['status'] : 'scheduled',
        'streamType'                => trim($item['streamType'] ?? (!empty($item['bunnyVideoId']) && empty($rawStream) ? 'bunny' : 'cloudflare')),
        'streamId'                  => $rawStream,
        'replayUrl'                 => trim($item['replayUrl'] ?? ''),
        'bunnyVideoId'              => trim($item['bunnyVideoId'] ?? ''),
        'cloudflareVideoId'         => trim($item['cloudflareVideoId'] ?? ''),
        'cloudflareStreamKey'       => trim($item['cloudflareStreamKey'] ?? ''),
        'meetUrl'                   => trim($item['meetUrl'] ?? ''),
        'zoomUrl'                   => trim($item['zoomUrl'] ?? ''),
        'zoomMeetingId'             => trim($item['zoomMeetingId'] ?? ''),
        'zoomPasscode'              => trim($item['zoomPasscode'] ?? ''),
        'zoomEmbedMode'             => ($item['zoomEmbedMode'] ?? true) !== false,
        'showViewerCountToStudents' => !empty($item['showViewerCountToStudents']),
        'allowStudentMic'           => !empty($item['allowStudentMic']),
        'allowStudentScreen'        => !empty($item['allowStudentScreen']),
        'chatEnabled'               => !empty($item['chatEnabled']),
        'resources'                 => is_array($item['resources'] ?? null) ? $item['resources'] : [],
        'updatedAt'                 => date('c')
    ];

    // If Bunny Video ID specified, auto-resolve replay URL
    if (!empty($record['bunnyVideoId']) && empty($record['replayUrl'])) {
        $lmsSettings = load_lms_settings();
        $libId = $lmsSettings['bunnyLibraryId'] ?? '755385';
        $tokenKey = $lmsSettings['bunnyTokenAuthKey'] ?? '';
        $record['replayUrl'] = generate_bunny_video_url($libId, $record['bunnyVideoId'], $tokenKey);
    }

    $found = false;
    foreach ($classes as $idx => $c) {
        if ($c['id'] === $id) {
            $record['createdAt'] = $c['createdAt'] ?? date('c');
            $classes[$idx] = $record;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $record['createdAt'] = date('c');
        array_unshift($classes, $record);
    }

    save_all_live_classes($classes);

    // Keep masterclass landing settings in sync if editing a workshop
    if ($record['type'] === 'workshop') {
        $landingFile = DATA_DIR . '/masterclass-landing.json';
        if (file_exists($landingFile)) {
            $landingData = json_decode(file_get_contents($landingFile), true) ?: [];
            if ($record['ticketPrice'] > 0) {
                $landingData['ticketPrice'] = $record['ticketPrice'];
                if (!empty($landingData['topAnnouncement'])) {
                    $landingData['topAnnouncement'] = preg_replace('/₹\d+/', '₹' . $record['ticketPrice'], $landingData['topAnnouncement']);
                }
                if (!empty($landingData['seatsRemaining'])) {
                    $landingData['seatsRemaining'] = preg_replace('/₹\d+/', '₹' . $record['ticketPrice'], $landingData['seatsRemaining']);
                }
            }
            if ($record['originalPrice'] > 0) {
                $landingData['originalPrice'] = $record['originalPrice'];
            }
            file_put_contents($landingFile, json_encode($landingData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }

    if (($record['status'] ?? '') === 'live' && function_exists('send_live_class_push_notification')) {
        send_live_class_push_notification($record);
    }

    json_ok(['saved' => true, 'liveClass' => $record]);
}

// 20.3 Delete Live Class
if ($action === 'delete-live-class' && $method === 'POST') {
    $body = read_json_body();
    $id = trim($body['id'] ?? '');
    if (!$id) json_err('Class ID required', 400);

    $classes = get_all_live_classes();
    $filtered = array_values(array_filter($classes, function($c) use ($id) {
        return $c['id'] !== $id;
    }));
    save_all_live_classes($filtered);
    json_ok(['deleted' => true]);
}

// 20.4 Toggle Live Status (Quick Action: Scheduled <-> Live Now <-> Completed)
if ($action === 'update-live-status' && $method === 'POST') {
    $body = read_json_body();
    $id = trim($body['id'] ?? '');
    $status = trim($body['status'] ?? '');
    if (!$id || !in_array($status, ['scheduled', 'live', 'completed'])) {
        json_err('Valid ID and Status (scheduled, live, completed) required', 400);
    }

    $classes = get_all_live_classes();
    $updatedClass = null;
    foreach ($classes as &$c) {
        if ($c['id'] === $id) {
            $c['status'] = $status;
            $c['updatedAt'] = date('c');
            $updatedClass = $c;
            break;
        }
    }
    unset($c);

    if (!$updatedClass) json_err('Live class not found', 404);
    save_all_live_classes($classes);

    // Auto-dispatch push notification when Admin starts class LIVE
    $notifInfo = null;
    if ($status === 'live' && function_exists('send_live_class_push_notification')) {
        $notifInfo = send_live_class_push_notification($updatedClass);
    }

    json_ok([
        'updated' => true,
        'liveClass' => $updatedClass,
        'pushSent' => ($notifInfo && !empty($notifInfo['ok'])) ? true : false,
        'recipientCount' => $notifInfo['recipientCount'] ?? 0
    ]);
}

// 20.5 Get Real-Time Live Viewers & Attendees (Admin Control Room)
if ($action === 'get-live-viewers' && ($method === 'GET' || $method === 'POST')) {
    $sessionId = trim($_GET['sessionId'] ?? ($_POST['sessionId'] ?? ''));
    if (!$sessionId) json_err('Session ID required', 400);

    $attendanceFile = DATA_DIR . '/live-viewers-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId) . '.json';
    $data = file_exists($attendanceFile) ? (json_decode(file_get_contents($attendanceFile), true) ?: []) : [];

    $now = time();
    $viewers = $data['viewers'] ?? [];
    $activeMap = [];

    foreach ($viewers as $p => $v) {
        $pClean = clean_phone($p);
        if (!$pClean) $pClean = (string)$p;
        if (($now - ($v['lastSeen'] ?? 0)) <= 60) {
            $v['isOnline'] = true;
            $v['phone'] = $pClean;
            $activeMap[$pClean] = $v;
        }
    }

    $allClasses = get_all_live_classes();
    $targetClass = null;
    foreach ($allClasses as $c) {
        if ($c['id'] === $sessionId) { $targetClass = $c; break; }
    }

    // Load registered & enrolled students
    $studentsFile = LMS_STUDENTS_FILE;
    $allStudents = file_exists($studentsFile) ? (json_decode(file_get_contents($studentsFile), true) ?: []) : [];
    $offFile = DATA_DIR . '/offline-admissions.json';
    $offAdmissions = file_exists($offFile) ? (json_decode(file_get_contents($offFile), true) ?: []) : [];

    $targetCourseId = $targetClass['courseId'] ?? '';
    $isWorkshop = ($targetClass['type'] ?? 'workshop') === 'workshop';
    $includeOffline = !empty($_GET['includeOffline']);

    // Calculate total enrolled count
    $enrolledCount = 0;
    foreach ($allStudents as $st) {
        $p = clean_phone($st['phone'] ?? '');
        if (!$p) continue;
        $courses = $st['enrolledCourses'] ?? [];
        if ($p === '9939800780' || $isWorkshop || in_array($sessionId, $courses) || ($targetCourseId && in_array($targetCourseId, $courses))) {
            $enrolledCount++;
        }
    }
    $enrolledCount += count($offAdmissions);

    $rosterMap = [];

    // Add only active online pingers by default
    foreach ($activeMap as $p => $v) {
        $rosterMap[$p] = $v;
    }

    // Only add offline/registered students if explicitly requested
    if ($includeOffline) {
        foreach ($allStudents as $st) {
            $p = clean_phone($st['phone'] ?? '');
            if (!$p) continue;

            $courses = $st['enrolledCourses'] ?? [];
            $isEnrolled = false;

            if ($p === '9939800780') {
                $isEnrolled = true;
            } elseif ($isWorkshop) {
                $isEnrolled = in_array($sessionId, $courses) || in_array('masterclass-live', $courses) || in_array('live_demo_01', $courses) || count($courses) > 0;
            } else {
                $isEnrolled = in_array($sessionId, $courses) || ($targetCourseId && in_array($targetCourseId, $courses));
            }

            if ($isEnrolled && !isset($rosterMap[$p])) {
                $rosterMap[$p] = [
                    'phone'         => $p,
                    'name'          => $st['name'] ?? 'Student',
                    'city'          => $st['city'] ?? ($st['workCity'] ?? 'India'),
                    'isOnline'      => false,
                    'handRaised'    => false,
                    'micAllowed'    => false,
                    'screenAllowed' => false,
                    'joinedAt'      => $st['enrolledAt'] ?? ($st['registeredAt'] ?? ''),
                    'status'        => 'registered'
                ];
            }
        }

        foreach ($offAdmissions as $adm) {
            $p = clean_phone($adm['phone'] ?? '');
            if (!$p) continue;
            if (!isset($rosterMap[$p])) {
                $rosterMap[$p] = [
                    'phone'         => $p,
                    'name'          => $adm['name'] ?? 'Offline Student',
                    'city'          => $adm['city'] ?? ($adm['workCity'] ?? 'India'),
                    'isOnline'      => false,
                    'handRaised'    => false,
                    'micAllowed'    => false,
                    'screenAllowed' => false,
                    'joinedAt'      => $adm['registeredAt'] ?? '',
                    'status'        => 'registered'
                ];
            }
        }
    }

    $rosterList = array_values($rosterMap);

    // Sort: Hand Raised first, then Online Watching
    usort($rosterList, function($a, $b) {
        if (!empty($a['handRaised']) !== !empty($b['handRaised'])) {
            return !empty($b['handRaised']) ? 1 : -1;
        }
        if (!empty($a['isOnline']) !== !empty($b['isOnline'])) {
            return !empty($b['isOnline']) ? 1 : -1;
        }
        return strcmp($b['joinedAt'] ?? '', $a['joinedAt'] ?? '');
    });

    $activeCount = count($activeMap);

    $stageRoom = 'qaa_stage_' . substr(md5('qaa_stage_salt_' . $sessionId), 0, 12);
    $stageObsUrl = "https://vdo.ninja/?room={$stageRoom}&view={$stageRoom}&transparent=1&cleanoutput=1&audioonly=0";
    $stageDirectorUrl = "https://vdo.ninja/?director={$stageRoom}";

    json_ok([
        'totalViewers'              => $activeCount,
        'activeCount'               => $activeCount,
        'enrolledCount'             => $enrolledCount,
        'viewers'                   => $rosterList,
        'showViewerCountToStudents' => !isset($targetClass['showViewerCountToStudents']) || !empty($targetClass['showViewerCountToStudents']),
        'allowStudentMic'           => !empty($targetClass['allowStudentMic']),
        'allowStudentScreen'        => !empty($targetClass['allowStudentScreen']),
        'stageRoom'                 => $stageRoom,
        'stageObsUrl'               => $stageObsUrl,
        'stageDirectorUrl'          => $stageDirectorUrl,
        'status'                    => $targetClass['status'] ?? 'scheduled',
        'bunnyVideoId'              => $targetClass['bunnyVideoId'] ?? '',
        'replayUrl'                 => $targetClass['replayUrl'] ?? ''
    ]);
}

// 20.6 Toggle Viewer Count Visibility (Classroom Mode vs Stealth Webinar Mode)
if ($action === 'toggle-live-viewer-mode' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $sessionId = trim($body['sessionId'] ?? '');
    $showToStudents = !empty($body['showViewerCountToStudents']);

    if (!$sessionId) json_err('Session ID required', 400);

    $classes = get_all_live_classes();
    $updated = false;
    foreach ($classes as &$c) {
        if ($c['id'] === $sessionId) {
            $c['showViewerCountToStudents'] = $showToStudents;
            $c['updatedAt'] = date('c');
            $updated = true;
            break;
        }
    }
    unset($c);

    if ($updated) {
        save_all_live_classes($classes);
        json_ok(['updated' => true, 'showViewerCountToStudents' => $showToStudents]);
    }
    json_err('Live session not found', 404);
}

// 20.7 Set Student Live Media Permission (Allow Mic, Allow Screen, Lower Hand)
if ($action === 'set-student-media-permission' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $sessionId = trim($body['sessionId'] ?? '');
    $phone = clean_phone($body['phone'] ?? '');
    $permission = trim($body['permission'] ?? 'mic'); // 'mic', 'screen', 'lower_hand'
    $allowed = !empty($body['allowed']);

    if (!$sessionId || !$phone) json_err('Session ID and phone required', 400);

    $attendanceFile = DATA_DIR . '/live-viewers-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId) . '.json';
    $data = file_exists($attendanceFile) ? (json_decode(file_get_contents($attendanceFile), true) ?: []) : [];

    if (isset($data['viewers'][$phone])) {
        if ($permission === 'mic') {
            $data['viewers'][$phone]['micAllowed'] = $allowed;
            if ($allowed) $data['viewers'][$phone]['handRaised'] = false;
        } elseif ($permission === 'screen') {
            $data['viewers'][$phone]['screenAllowed'] = $allowed;
            if ($allowed) $data['viewers'][$phone]['handRaised'] = false;
        } elseif ($permission === 'lower_hand') {
            $data['viewers'][$phone]['handRaised'] = false;
        }
        file_put_contents($attendanceFile, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
        json_ok(['updated' => true, 'viewer' => $data['viewers'][$phone]]);
    }
    json_err('Viewer not found in active session', 404);
}

// 20.4b Admin Manual Push Announcement & Class Reminder
if ($action === 'send-admin-announcement' && $method === 'POST') {
    $body = read_json_body();
    $title     = trim($body['title'] ?? '');
    $msg       = trim($body['message'] ?? ($body['body'] ?? ''));
    $courseId  = trim($body['courseId'] ?? 'all');
    $targetUrl = trim($body['url'] ?? '/app/');
    $type      = trim($body['type'] ?? 'announcement'); // 'announcement' or 'reminder'

    if (!$title || !$msg) {
        json_err('Title and message are required for announcement', 400);
    }

    if (function_exists('send_custom_push_announcement')) {
        $res = send_custom_push_announcement($title, $msg, $courseId, $targetUrl, $type);
        json_ok([
            'delivered' => true,
            'recipients' => $res['recipientCount'] ?? 0,
            'notification' => $res['notification'] ?? null
        ]);
    } else {
        json_err('Push notification service unavailable', 500);
    }
}

// 20.4c Get Push Notification Devices Count
if ($action === 'get-push-subscribers-count' && ($method === 'GET' || $method === 'POST')) {
    $subs = function_exists('load_push_subscriptions') ? load_push_subscriptions() : [];
    $notifs = function_exists('load_notifications') ? load_notifications() : [];
    json_ok([
        'subscribersCount' => count($subs),
        'notificationsCount' => count($notifs)
    ]);
}


// 20.5 Get Live Chat / Doubts for Admin
if ($action === 'get-admin-live-chat' && ($method === 'GET' || $method === 'POST')) {
    $liveId = trim($_GET['liveId'] ?? ($_POST['liveId'] ?? ''));
    if (!$liveId) json_err('liveId required', 400);

    $chats = get_all_live_chats();
    $messages = $chats[$liveId] ?? [];
    json_ok(['messages' => $messages]);
}

// 20.6 Reply to Doubt as Mentor / Send Admin Announcement
if ($action === 'reply-live-doubt' && $method === 'POST') {
    $body = read_json_body() ?: [];
    $liveId = trim($body['liveId'] ?? ($_POST['liveId'] ?? ''));
    $msg = trim($body['message'] ?? ($_POST['message'] ?? ($_POST['reply'] ?? '')));
    if (!$liveId || !$msg) json_err('Live ID and message required', 400);

    $chats = get_all_live_chats();
    if (!isset($chats[$liveId])) $chats[$liveId] = [];

    $newMsg = [
        'id'          => 'msg_' . substr(md5(uniqid(microtime(), true)), 0, 8),
        'studentId'   => 'admin_mentor',
        'studentName' => $settings['mentorName'] ?? 'Anil Sharma (Lead Mentor)',
        'message'     => $msg,
        'isMentor'    => true,
        'timestamp'   => date('c')
    ];

    $chats[$liveId][] = $newMsg;
    // Keep max 200 messages in chat per live session
    if (count($chats[$liveId]) > 200) {
        $chats[$liveId] = array_slice($chats[$liveId], -200);
    }
    save_all_live_chats($chats);
    json_ok(['sent' => true, 'message' => $newMsg]);
}

// 20.7 Clear Live Chat (Admin only)
if ($action === 'clear-live-chat' && $method === 'POST') {
    $body = read_json_body();
    $liveId = trim($body['liveId'] ?? '');
    if (!$liveId) json_err('Live ID required', 400);

    $chats = get_all_live_chats();
    $chats[$liveId] = [];
    save_all_live_chats($chats);
    json_ok(['cleared' => true]);
}

// 20.8 Get Masterclass Landing Page Settings (Admin)
if ($action === 'get-masterclass-landing' && ($method === 'GET' || $method === 'POST')) {
    $landingFile = DATA_DIR . '/masterclass-landing.json';
    $data = file_exists($landingFile) ? json_decode(file_get_contents($landingFile), true) : [];
    json_ok(['landing' => $data]);
}

// 20.9 Save Masterclass Landing Page Settings (Admin)
if ($action === 'save-masterclass-landing' && $method === 'POST') {
    $body = read_json_body() ?: [];
    if (empty($body) && !empty($_POST)) {
        $body = $_POST;
    }

    $landingFile = DATA_DIR . '/masterclass-landing.json';
    $current = file_exists($landingFile) ? json_decode(file_get_contents($landingFile), true) : [];
    if (!is_array($current)) $current = [];

    // Merge incoming changes
    foreach ($body as $k => $v) {
        if ($k !== 'action') {
            $current[$k] = $v;
        }
    }

    if (isset($body['ticketPrice'])) {
        $tp = (int)$body['ticketPrice'];
        $current['ticketPrice'] = $tp;
        if (!empty($current['topAnnouncement'])) {
            $current['topAnnouncement'] = preg_replace('/₹\d+/', '₹' . $tp, $current['topAnnouncement']);
        }
        if (!empty($current['seatsRemaining'])) {
            $current['seatsRemaining'] = preg_replace('/₹\d+/', '₹' . $tp, $current['seatsRemaining']);
        }
    }

    file_put_contents($landingFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    // Keep active workshop in live-classes.json in sync with price and title
    if (!empty($current['title']) || !empty($current['ticketPrice'])) {
        $classes = get_all_live_classes();
        $changed = false;
        foreach ($classes as &$c) {
            if (($c['type'] ?? '') === 'workshop') {
                if (!empty($current['title'])) $c['title'] = $current['title'];
                if (!empty($current['subtitle'])) $c['description'] = $current['subtitle'];
                if (!empty($current['ticketPrice'])) $c['ticketPrice'] = (int)$current['ticketPrice'];
                if (!empty($current['originalPrice'])) $c['originalPrice'] = (int)$current['originalPrice'];
                if (!empty($current['scheduledAt'])) $c['scheduledAt'] = $current['scheduledAt'];
                if (!empty($current['duration'])) $c['duration'] = $current['duration'];
                $changed = true;
                break;
            }
        }
        unset($c);
        if ($changed) {
            save_all_live_classes($classes);
        }
    }

    json_ok(['saved' => true, 'landing' => $current]);
}

// 23. Get all offline admissions
if ($action === 'get-offline-admissions' && ($method === 'GET' || $method === 'POST')) {
    $admissionsFile = DATA_DIR . '/offline-admissions.json';
    $admissions = file_exists($admissionsFile) ? json_decode(file_get_contents($admissionsFile), true) : [];
    if (!is_array($admissions)) $admissions = [];
    json_ok(['admissions' => array_reverse($admissions)]);
}

// 24. Approve offline admission & mark payment
if ($action === 'approve-offline-admission' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $admissionId = trim($body['id'] ?? '');
    $phone = clean_phone($body['phone'] ?? '');
    $markPaid = !empty($body['markPaid']);

    $admissionsFile = DATA_DIR . '/offline-admissions.json';
    $admissions = file_exists($admissionsFile) ? json_decode(file_get_contents($admissionsFile), true) : [];
    $found = false;

    foreach ($admissions as &$adm) {
        $admPhone = clean_phone($adm['phone'] ?? '');
        if ((!empty($admissionId) && $adm['id'] === $admissionId) || (!empty($phone) && $admPhone === $phone)) {
            $adm['status'] = 'approved';
            $adm['isApproved'] = true;
            $adm['paymentStatus'] = 'paid';
            $adm['paidAt'] = date('c');

            // Update student record in students.json
            $students = get_all_students();
            $admCleanPhone = !empty($admPhone) ? $admPhone : $phone;
            $foundStu = false;
            $cId = !empty($adm['batchCourseId']) ? $adm['batchCourseId'] : map_offline_course_id($adm['courseTitle'] ?? '');

            foreach ($students as &$stu) {
                if ((!empty($admCleanPhone) && clean_phone($stu['phone'] ?? '') === $admCleanPhone) ||
                    (!empty($adm['id']) && (($stu['offlineAdmissionId'] ?? '') === $adm['id'] || ($stu['enrollmentNo'] ?? '') === $adm['id']))) {
                    $stu['status'] = 'active';
                    $stu['isApproved'] = true;
                    $stu['isPaid500'] = true;
                    $stu['paymentStatus'] = 'paid';
                    $stu['appliedCourse'] = $adm['courseTitle'] ?? ($stu['appliedCourse'] ?? '');
                    if (!empty($adm['isOnlineBatch'])) {
                        $stu['isOnlineBatch'] = true;
                    }

                    if (!isset($stu['enrolledCourses']) || !is_array($stu['enrolledCourses'])) {
                        $stu['enrolledCourses'] = [];
                    }
                    if ($cId && !in_array($cId, $stu['enrolledCourses'])) {
                        $stu['enrolledCourses'][] = $cId;
                    }
                    $foundStu = true;
                    break;
                }
            }
            unset($stu);

            if (!$foundStu && !empty($admCleanPhone)) {
                $students[] = [
                    'id'                 => 'stu_' . time() . '_' . substr(md5($admCleanPhone), 0, 4),
                    'name'               => $adm['fullName'] ?? 'Student',
                    'phone'              => $admCleanPhone,
                    'email'              => $adm['email'] ?? '',
                    'avatar'             => $adm['photoUrl'] ?? '',
                    'avatarUrl'          => $adm['photoUrl'] ?? '',
                    'photoUrl'           => $adm['photoUrl'] ?? '',
                    'enrolledCourses'    => $cId ? [$cId] : [],
                    'isOfflineStudent'   => true,
                    'isOnlineBatch'      => !empty($adm['isOnlineBatch']),
                    'offlineAdmissionId' => $admissionId ?: ($adm['id'] ?? ''),
                    'enrollmentNo'       => $admissionId ?: ($adm['id'] ?? ''),
                    'appliedCourse'      => $adm['courseTitle'] ?? '',
                    'paymentStatus'      => 'paid',
                    'isPaid500'          => true,
                    'isApproved'         => true,
                    'status'             => 'active',
                    'registeredAt'       => date('c')
                ];
            }
            save_all_students($students);

            $found = true;
            break;
        }
    }
    unset($adm);

    if ($found) {
        file_put_contents($admissionsFile, json_encode($admissions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        json_ok(['approved' => true, 'id' => $admissionId, 'phone' => $phone]);
    }

    // Fallback: If not in offline-admissions.json, directly approve in students.json
    if (!empty($phone)) {
        $students = get_all_students();
        foreach ($students as &$stu) {
            if (clean_phone($stu['phone'] ?? '') === $phone || (!empty($admissionId) && (($stu['offlineAdmissionId'] ?? '') === $admissionId || ($stu['enrollmentNo'] ?? '') === $admissionId))) {
                $stu['status'] = 'active';
                $stu['isApproved'] = true;
                $stu['isPaid500'] = true;
                $stu['paymentStatus'] = 'paid';
                $cId = map_offline_course_id($stu['appliedCourse'] ?? '');
                if (!isset($stu['enrolledCourses']) || !is_array($stu['enrolledCourses'])) {
                    $stu['enrolledCourses'] = [];
                }
                if ($cId && !in_array($cId, $stu['enrolledCourses'])) {
                    $stu['enrolledCourses'][] = $cId;
                }
                $found = true;
                break;
            }
        }
        unset($stu);
        if ($found) {
            save_all_students($students);
            json_ok(['approved' => true, 'phone' => $phone]);
        }
    }

    json_err('Admission not found', 404);
}

// 25. Approve graduate student to live Alumni page
if ($action === 'approve-to-alumni' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $studentPhone = trim($body['phone'] ?? '');

    $students = get_all_students();
    $targetStudent = null;
    foreach ($students as &$s) {
        if (($s['phone'] ?? '') === $studentPhone) {
            $s['alumniApproved'] = true;
            $s['alumniPendingApproval'] = false;
            $targetStudent = $s;
            break;
        }
    }
    unset($s);

    if (!$targetStudent) {
        // Fallback check in offline-admissions.json
        $offFile = DATA_DIR . '/offline-admissions.json';
        $offList = file_exists($offFile) ? json_decode(file_get_contents($offFile), true) : [];
        if (is_array($offList)) {
            foreach ($offList as &$adm) {
                $pClean = preg_replace('/[^0-9]/', '', (string)($adm['phone'] ?? ''));
                if ($pClean === preg_replace('/[^0-9]/', '', $studentPhone) || ($adm['id'] ?? '') === $studentPhone) {
                    $adm['alumniApproved'] = true;
                    $adm['status'] = 'approved';
                    $targetStudent = [
                        'phone' => $pClean,
                        'name' => $adm['fullName'] ?? 'Alumnus',
                        'studioName' => $adm['studioName'] ?? 'Creative Studio',
                        'currentRole' => $adm['currentRole'] ?? ($adm['currentWork'] ?? 'Senior Video Editor'),
                        'workCity' => $adm['workCity'] ?? ($adm['city'] ?? 'Siwan'),
                        'avatar' => $adm['photoUrl'] ?? '',
                        'certId' => 'QAA-' . date('Y') . '-ALM'
                    ];
                    break;
                }
            }
            unset($adm);
            if ($targetStudent) {
                file_put_contents($offFile, json_encode($offList, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
        }
    }

    if (!$targetStudent) {
        json_err('Student record not found', 404);
    }
    save_all_students($students);

    // Add to alumni.json
    $alumniFile = DATA_DIR . '/alumni.json';
    $alumni = file_exists($alumniFile) ? json_decode(file_get_contents($alumniFile), true) : [];
    if (!is_array($alumni)) $alumni = [];

    // Check if already in alumni
    $exists = false;
    foreach ($alumni as &$alm) {
        if (($alm['phone'] ?? '') === $studentPhone || ($alm['certId'] ?? '') === ($targetStudent['certId'] ?? '')) {
            $alm['name'] = $targetStudent['name'] ?? $alm['name'];
            $alm['studioName'] = $targetStudent['studioName'] ?? $alm['studioName'];
            $alm['role'] = $targetStudent['currentRole'] ?? $alm['role'];
            $alm['city'] = $targetStudent['workCity'] ?? $alm['city'];
            $alm['photo'] = $targetStudent['avatar'] ?? $alm['photo'];
            $exists = true;
            break;
        }
    }
    unset($alm);

    if (!$exists) {
        $alumni[] = [
            'id'          => 'alm_' . time() . '_' . substr(md5($studentPhone), 0, 4),
            'phone'       => $studentPhone,
            'name'        => $targetStudent['name'] ?? 'Alumnus',
            'photo'       => $targetStudent['avatar'] ?? '/assets/anil-sharma.webp',
            'studioName'  => $targetStudent['studioName'] ?? 'Creative Studio',
            'role'        => $targetStudent['currentRole'] ?? 'Senior Video Editor',
            'city'        => $targetStudent['workCity'] ?? 'Siwan',
            'state'       => 'Bihar',
            'batch'       => 'Batch ' . date('Y'),
            'course'      => '14-Week Master Class',
            'certId'      => $targetStudent['certId'] ?? ('QAA-' . date('Y') . '-ALM'),
            'instagram'   => '',
            'highlight'   => 'Certified Professional Editor from Quick Art Photography Academy.',
            'featured'    => true
        ];
    }

    file_put_contents($alumniFile, json_encode($alumni, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    json_ok(['success' => true, 'message' => 'Student successfully published to Alumni Directory!']);
}

// 26. Manage Daily Tasks
if ($action === 'save-daily-task' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $tasksFile = DATA_DIR . '/daily-tasks.json';
    $tasks = file_exists($tasksFile) ? json_decode(file_get_contents($tasksFile), true) : [];
    if (!is_array($tasks)) $tasks = [];

    $id = trim($body['id'] ?? ('task_' . time()));
    $taskItem = [
        'id'          => $id,
        'dayNumber'   => (int)($body['dayNumber'] ?? (count($tasks) + 1)),
        'title'       => trim($body['title'] ?? 'Studio Editing Challenge'),
        'description' => trim($body['description'] ?? ''),
        'resource'    => trim($body['resource'] ?? ''),
        'deadline'    => trim($body['deadline'] ?? ''),
        'courseId'    => trim($body['courseId'] ?? 'master-class')
    ];

    $updated = false;
    foreach ($tasks as &$t) {
        if ($t['id'] === $id) {
            $t = $taskItem;
            $updated = true;
            break;
        }
    }
    unset($t);

    if (!$updated) {
        $tasks[] = $taskItem;
    }

    file_put_contents($tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    json_ok(['saved' => true, 'task' => $taskItem]);
}

// 27. Manage Offline Recordings
if ($action === 'save-offline-recording' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $recFile = DATA_DIR . '/offline-recordings.json';
    $recordings = file_exists($recFile) ? json_decode(file_get_contents($recFile), true) : [];
    if (!is_array($recordings)) $recordings = [];

    $id = trim($body['id'] ?? ('rec_' . time()));
    $recItem = [
        'id'          => $id,
        'title'       => trim($body['title'] ?? ''),
        'mentor'      => trim($body['mentor'] ?? 'Anil Sharma'),
        'duration'    => trim($body['duration'] ?? ''),
        'videoUrl'    => trim($body['videoUrl'] ?? ''),
        'notes'       => trim($body['notes'] ?? ''),
        'date'        => trim($body['date'] ?? date('Y-m-d'))
    ];

    $updated = false;
    foreach ($recordings as &$r) {
        if ($r['id'] === $id) {
            $r = $recItem;
            $updated = true;
            break;
        }
    }
    unset($r);

    if (!$updated) {
        $recordings[] = $recItem;
    }

    file_put_contents($recFile, json_encode($recordings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    json_ok(['saved' => true, 'recording' => $recItem]);
}

json_err('Unknown action', 404);



