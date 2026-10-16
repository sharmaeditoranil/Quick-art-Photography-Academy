<?php
// api/lms.php — Student Learning Management System (LMS) API
// Quick Art Photography Academy

require_once __DIR__ . '/_helpers.php';
send_cors();

if (!defined('LMS_COURSES_FILE'))  define('LMS_COURSES_FILE', DATA_DIR . '/courses.json');
if (!defined('LMS_STUDENTS_FILE')) define('LMS_STUDENTS_FILE', DATA_DIR . '/students.json');
if (!defined('LMS_SETTINGS_FILE')) define('LMS_SETTINGS_FILE', DATA_DIR . '/lms-settings.json');
$isLocalHost = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1']) || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1']);
if (!defined('LMS_OTPS_FILE'))     define('LMS_OTPS_FILE', $isLocalHost ? (sys_get_temp_dir() . '/quickart-otps.json') : (DATA_DIR . '/otps.json'));
if (!defined('LMS_SESSIONS_FILE')) define('LMS_SESSIONS_FILE', $isLocalHost ? (sys_get_temp_dir() . '/quickart-sessions.json') : (DATA_DIR . '/student-sessions.json'));
if (!defined('LMS_COUPONS_FILE'))  define('LMS_COUPONS_FILE', DATA_DIR . '/coupons.json');
if (!defined('LMS_TRANSACTIONS_FILE')) define('LMS_TRANSACTIONS_FILE', DATA_DIR . '/transactions.json');
if (!defined('LMS_LIVE_CLASSES_FILE')) define('LMS_LIVE_CLASSES_FILE', DATA_DIR . '/live-classes.json');
if (!defined('LMS_LIVE_CHAT_FILE'))    define('LMS_LIVE_CHAT_FILE', DATA_DIR . '/live-chat.json');

// ---------- Helper Functions ----------

function get_all_live_classes() {
    if (!file_exists(LMS_LIVE_CLASSES_FILE)) return [];
    return json_decode(file_get_contents(LMS_LIVE_CLASSES_FILE), true) ?: [];
}

function load_student_sessions() {
    if (!defined('LMS_SESSIONS_FILE') || !file_exists(LMS_SESSIONS_FILE)) return [];
    return json_decode(file_get_contents(LMS_SESSIONS_FILE), true) ?: [];
}

function get_all_live_chats() {
    if (!file_exists(LMS_LIVE_CHAT_FILE)) return [];
    return json_decode(file_get_contents(LMS_LIVE_CHAT_FILE), true) ?: [];
}

function save_all_live_chats($chats) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_LIVE_CHAT_FILE, json_encode($chats, JSON_PRETTY_PRINT), LOCK_EX);
}

function load_coupons() {
    if (!file_exists(LMS_COUPONS_FILE)) return [];
    return json_decode(file_get_contents(LMS_COUPONS_FILE), true) ?: [];
}

function save_coupons($coupons) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_COUPONS_FILE, json_encode($coupons, JSON_PRETTY_PRINT), LOCK_EX);
}

function evaluate_coupon($code, $courseId, $coursePrice) {
    $coupons = load_coupons();
    $code = strtoupper(trim((string)$code));
    if (!$code) return ['valid' => false, 'message' => 'Please enter a coupon code'];

    $matched = null;
    $matchedIndex = -1;
    foreach ($coupons as $idx => $c) {
        if (strtoupper($c['code']) === $code) {
            $matched = $c;
            $matchedIndex = $idx;
            break;
        }
    }

    if (!$matched) {
        return ['valid' => false, 'message' => "Coupon code '{$code}' is invalid"];
    }

    if (isset($matched['active']) && !$matched['active']) {
        return ['valid' => false, 'message' => "This coupon is no longer active"];
    }

    if (!empty($matched['expiry']) && strtotime($matched['expiry']) < strtotime(date('Y-m-d'))) {
        return ['valid' => false, 'message' => "This coupon expired on " . date('d M Y', strtotime($matched['expiry']))];
    }

    if (!empty($matched['courseId']) && $matched['courseId'] !== 'all' && $matched['courseId'] !== $courseId) {
        return ['valid' => false, 'message' => "This coupon is not valid for the selected course"];
    }

    $minAmount = intval($matched['minAmount'] ?? 0);
    if ($coursePrice < $minAmount) {
        return ['valid' => false, 'message' => "Minimum order amount of ₹{$minAmount} required for this coupon"];
    }

    $discount = 0;
    if (($matched['type'] ?? 'percent') === 'percent') {
        $pct = floatval($matched['discount'] ?? 0);
        $discount = round(($coursePrice * $pct) / 100);
        if (!empty($matched['maxDiscount']) && $discount > intval($matched['maxDiscount'])) {
            $discount = intval($matched['maxDiscount']);
        }
    } else {
        $discount = intval($matched['discount'] ?? 0);
    }

    $discount = min($discount, $coursePrice);
    $finalPrice = max(0, $coursePrice - $discount);

    return [
        'valid' => true,
        'code' => $matched['code'],
        'type' => $matched['type'] ?? 'percent',
        'discount' => $matched['discount'],
        'discountAmount' => $discount,
        'originalPrice' => $coursePrice,
        'finalPrice' => $finalPrice,
        'description' => $matched['description'] ?? "Savings of ₹{$discount}",
        'matchedIndex' => $matchedIndex
    ];
}

function load_courses() {
    if (!file_exists(LMS_COURSES_FILE)) return [];
    return json_decode(file_get_contents(LMS_COURSES_FILE), true) ?: [];
}

function load_students() {
    if (!file_exists(LMS_STUDENTS_FILE)) return [];
    return json_decode(file_get_contents(LMS_STUDENTS_FILE), true) ?: [];
}

function save_students($students) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_STUDENTS_FILE, json_encode($students, JSON_PRETTY_PRINT), LOCK_EX);
}

if (!function_exists('get_all_students')) {
    function get_all_students() {
        return load_students();
    }
}
if (!function_exists('save_all_students')) {
    function save_all_students($students) {
        return save_students($students);
    }
}

if (!function_exists('clean_phone')) {
    function clean_phone($p) {
        $num = preg_replace('/[^0-9]/', '', (string)$p);
        if (strlen($num) === 12 && substr($num, 0, 2) === '91') {
            $num = substr($num, 2);
        } elseif (strlen($num) === 11 && substr($num, 0, 1) === '0') {
            $num = substr($num, 1);
        }
        return $num;
    }
}

// Helper to map offline admission program to LMS Course ID
function map_offline_course_id($courseTitle) {
    $t = strtolower(trim((string)$courseTitle));
    if (!$t) return 'course-offline-masterclass';

    // 1. Direct ID or exact title match in courses.json
    $courses = load_courses();
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

function extract_youtube_id($input) {
    if (empty($input) || !is_string($input)) return '';
    $input = trim($input);
    if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i', $input, $m)) {
        return $m[1];
    }
    if (preg_match('/^[a-zA-Z0-9_-]{11}$/', $input) && strpos($input, 'demo-') !== 0 && strpos($input, 'les-') !== 0) {
        return $input;
    }
    return '';
}

function extract_bunny_video_id($input) {
    if (empty($input) || !is_string($input)) return '';
    $input = trim($input);
    if (preg_match('/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i', $input, $m)) {
        return $m[0];
    }
    return '';
}

// Student Token Sessions
function create_student_session($phone) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    $sessions = file_exists(LMS_SESSIONS_FILE) ? json_decode(file_get_contents(LMS_SESSIONS_FILE), true) : [];
    if (!is_array($sessions)) $sessions = [];

    $token = bin2hex(random_bytes(32));
    $sessions[$token] = [
        'phone' => $phone,
        'createdAt' => time(),
        'expiresAt' => time() + (30 * 86400) // 30 days
    ];
    file_put_contents(LMS_SESSIONS_FILE, json_encode($sessions, JSON_PRETTY_PRINT), LOCK_EX);
    return $token;
}

// Confirm a Razorpay payment with Razorpay itself (not just the browser's word):
// valid signature + payment belongs to this order + payment captured/authorized.
// Returns ['payment' => ..., 'order' => ..., 'notes' => [...]] or stops with an error.
function razorpay_confirm_payment($orderId, $paymentId, $signature) {
    $settings = load_lms_settings();
    $keyId = trim($settings['razorpayKeyId'] ?? '');
    $keySecret = trim($settings['razorpayKeySecret'] ?? '');
    if (!$keyId || !$keySecret) json_err('Online payment abhi active nahi hai. Support: +91 9939800780', 503);
    if (!$orderId || !$paymentId || !$signature) json_err('Incomplete payment verification payload', 400);
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $keySecret);
    if (!hash_equals($expected, $signature)) json_err('Payment verification failed: Signature mismatch', 400);

    $get = function ($path) use ($keyId, $keySecret) {
        $ch = curl_init('https://api.razorpay.com/v1' . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD        => $keyId . ':' . $keySecret,
            CURLOPT_TIMEOUT        => 12,
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$code, json_decode((string)$raw, true) ?: []];
    };
    [$pc, $payment] = $get('/payments/' . rawurlencode($paymentId));
    if ($pc !== 200 || ($payment['order_id'] ?? '') !== $orderId || !in_array($payment['status'] ?? '', ['captured', 'authorized'], true)) {
        json_err('Payment Razorpay se confirm nahi hua. Payment ID: ' . $paymentId . ' — Support: +91 9939800780', 400);
    }
    [$oc, $order] = $get('/orders/' . rawurlencode($orderId));
    if ($oc !== 200) json_err('Payment order verify nahi ho paya. Support: +91 9939800780', 502);
    return ['payment' => $payment, 'order' => $order, 'notes' => is_array($order['notes'] ?? null) ? $order['notes'] : []];
}

// Student token from header / bearer (no query string) — null if missing/expired
function current_student_phone_from_token() {
    $token = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? '';
    if (!$token) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) $token = trim($m[1]);
    }
    if (!$token || !file_exists(LMS_SESSIONS_FILE)) return null;
    $sessions = json_decode(file_get_contents(LMS_SESSIONS_FILE), true) ?: [];
    if (!isset($sessions[$token]) || ($sessions[$token]['expiresAt'] ?? 0) < time()) return null;
    return clean_phone($sessions[$token]['phone'] ?? '');
}

// Phone was OTP-verified in the last hour (admission / checkout flows)
function phone_recently_verified($phone) {
    $f = DATA_DIR . '/verified-admissions.json';
    $list = file_exists($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
    return !empty($list['phones'][$phone]) && ($list['phones'][$phone]['expiresAt'] ?? 0) >= time();
}

// Simple file-based limiter: max $max hits per $windowSec for a key
function rate_limit_hit($bucket, $key, $max, $windowSec) {
    $f = DATA_DIR . '/ratelimit-' . preg_replace('/[^a-z0-9_-]/i', '', $bucket) . '.json';
    $fp = @fopen($f, 'c+');
    if (!$fp) return true;
    flock($fp, LOCK_EX);
    $data = json_decode(stream_get_contents($fp), true) ?: [];
    $now = time();
    foreach ($data as $k => $arr) {
        $data[$k] = array_values(array_filter((array)$arr, fn($t) => $t > $now - $windowSec));
        if (!$data[$k]) unset($data[$k]);
    }
    $allowed = count($data[$key] ?? []) < $max;
    if ($allowed) $data[$key][] = $now;
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data));
    flock($fp, LOCK_UN); fclose($fp);
    return $allowed;
}

function require_student() {
    $token = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? '';
    if (!$token) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) {
            $token = trim($m[1]);
        }
    }
    if (!$token) {
        $token = $_GET['token'] ?? '';
    }

    if (!$token || !file_exists(LMS_SESSIONS_FILE)) {
        json_err('Please login to continue', 401);
    }
    $sessions = json_decode(file_get_contents(LMS_SESSIONS_FILE), true);
    if (!isset($sessions[$token]) || $sessions[$token]['expiresAt'] < time()) {
        json_err('Session expired, please login again', 401);
    }

    $sessionIdentifier = strtolower(trim((string)$sessions[$token]['phone']));
    $students = load_students();
    foreach ($students as $stu) {
        $stuPhone = strtolower(trim((string)($stu['phone'] ?? '')));
        $stuEmail = strtolower(trim((string)($stu['email'] ?? '')));
        if (($stuPhone && $stuPhone === $sessionIdentifier) || ($stuEmail && $stuEmail === $sessionIdentifier)) {
            return $stu;
        }
    }
    json_err('Student account not found', 404);
}

// Generate Bunny.net Token Authenticated Embed URL if keys exist
function generate_bunny_video_url($libraryId, $videoId, $tokenKey) {
    if (empty($libraryId) || empty($videoId)) return '';
    if (empty($tokenKey)) {
        // Standard Bunny iframe embed
        return "https://iframe.mediadelivery.net/embed/{$libraryId}/{$videoId}";
    }

    // Token authentication
    $expires = time() + 3600 * 6; // 6 hours
    $hashString = $tokenKey . $videoId . $expires;
    $token = hash('sha256', $hashString);
    return "https://iframe.mediadelivery.net/embed/{$libraryId}/{$videoId}?token={$token}&expires={$expires}";
}

/**
 * Automatically transforms submitted offline admissions into live alumni profiles.
 * Any student who submits the admission form will automatically appear on the alumni page.
 */
function sync_offline_admissions_to_alumni() {
    $admissionsFile = DATA_DIR . '/offline-admissions.json';
    $admissions = file_exists($admissionsFile) ? json_decode(file_get_contents($admissionsFile), true) : [];
    if (!is_array($admissions)) $admissions = [];

    // Deduplicate by 10-digit phone (keep latest submission with valid details/photo)
    $byPhone = [];
    foreach ($admissions as $adm) {
        $name = trim($adm['fullName'] ?? '');
        $phone = preg_replace('/[^0-9]/', '', $adm['phone'] ?? '');
        if (empty($name) || strlen($name) < 2) continue;
        if (empty($phone) || strlen($phone) < 10) continue;
        // Skip incomplete blank test submissions
        if (empty($adm['photoUrl']) && empty($adm['city']) && empty($adm['studioName'])) continue;
        
        $key = substr($phone, -10);
        if (!isset($byPhone[$key])) {
            $byPhone[$key] = $adm;
        } else {
            $hasPhotoNow = !empty($adm['photoUrl']);
            $hasPhotoPrev = !empty($byPhone[$key]['photoUrl']);
            $tNow = strtotime($adm['createdAt'] ?? '2020-01-01');
            $tPrev = strtotime($byPhone[$key]['createdAt'] ?? '2020-01-01');
            // Prefer submission with photo, or newest
            if (($hasPhotoNow && !$hasPhotoPrev) || ($tNow >= $tPrev)) {
                $byPhone[$key] = $adm;
            }
        }
    }

    // Sort newest submission first
    uasort($byPhone, function($a, $b) {
        $tA = strtotime($a['createdAt'] ?? '2026-01-01');
        $tB = strtotime($b['createdAt'] ?? '2026-01-01');
        return $tB <=> $tA;
    });

    $alumni = [];
    foreach ($byPhone as $adm) {
        $photo = trim($adm['photoUrl'] ?? '');
        if (!empty($photo) && $photo[0] !== '/' && !str_starts_with($photo, 'http')) {
            $photo = '/' . $photo;
        }
        if (empty($photo)) {
            $photo = '/home-assets/6a62e4eb3643ad.jpeg';
        }

        $studio = trim($adm['studioName'] ?? '');
        if (empty($studio)) {
            $studio = 'Independent Creative Studio';
        }

        $role = trim($adm['currentRole'] ?? '');
        if (empty($role) || strtolower($role) === 'student / beginner' || strtolower($role) === 'student / complete beginner') {
            $role = 'Creative Video Editor & Filmmaker';
        }

        $city = trim($adm['city'] ?? '');
        if (empty($city)) {
            $city = trim($adm['workCity'] ?? 'Bihar');
        }

        $state = trim($adm['state'] ?? 'Bihar');
        $course = trim($adm['courseTitle'] ?? 'Wedding Filmmaking & Video Editing');
        $createdTime = strtotime($adm['createdAt'] ?? 'now');
        $batch = 'Studio Batch ' . date('Y', $createdTime);
        $highlight = trim($adm['careerGoal'] ?? '');
        if (empty($highlight)) {
            $highlight = $studio . ' — Quick Art Photography Academy certified video editor & filmmaker.';
        }

        $alumni[] = [
            'id'          => $adm['id'] ?? ('QAA-' . rand(1000, 9999)),
            'name'        => trim($adm['fullName']),
            'photo'       => $photo,
            'studioName'  => $studio,
            'role'        => $role,
            'city'        => $city,
            'state'       => $state,
            'batch'       => $batch,
            'course'      => $course,
            'certId'      => $adm['id'] ?? ('QAA-' . rand(1000, 9999)),
            'instagram'   => trim($adm['instagram'] ?? ''),
            'highlight'   => $highlight,
            'featured'    => !empty($adm['photoUrl']),
            'createdAt'   => $adm['createdAt'] ?? date('c')
        ];
    }

    // Save to data/alumni.json for caching & static fallback
    $alumniFile = DATA_DIR . '/alumni.json';
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents($alumniFile, json_encode($alumni, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    return $alumni;
}

// ---------- Request Routing ----------

$action = $_GET['action'] ?? '';

// Robust parser: Handle actions that include query parameters (e.g. course-details&id=xyz)
if (strpos($action, '&') !== false) {
    parse_str($action, $parsedActionParams);
    if (!empty($parsedActionParams)) {
        foreach ($parsedActionParams as $k => $v) {
            if (!isset($_GET[$k]) || $_GET[$k] === '') {
                $_GET[$k] = $v;
            }
        }
        $parts = explode('&', $action, 2);
        $action = $parts[0];
    }
}
$action = trim($action);
$method = $_SERVER['REQUEST_METHOD'];

// 1. Send OTP
if ($action === 'send-otp' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);

    if (strlen($phone) < 10) {
        json_err('Please enter a valid 10-digit mobile number', 400);
    }

    $settings = load_lms_settings();
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);
    $demoMode = !empty($settings['otpDemoMode']);
    $defaultOtp = $settings['defaultOtp'] ?? '123456';

    // Anti-abuse: max 5 OTPs per number and 20 per IP per hour
    if (!$isLocal && (!rate_limit_hit('otp-phone', $phone, 5, 3600) || !rate_limit_hit('otp-ip', $clientIp, 20, 3600))) {
        json_err('Bahut zyada OTP request ho gaye. 1 ghante baad try karein ya WhatsApp support se baat karein.', 429);
    }
    // Academy's own number can't receive WhatsApp from itself: show its OTP only to a logged-in admin
    $adminTok = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    $isAdminCaller = $adminTok && is_valid_session($adminTok);

    // Generate 6 digit OTP
    $otp = $demoMode ? $defaultOtp : strval(random_int(100000, 999999));

    // Save OTP with 10-min expiration
    $otps = file_exists(LMS_OTPS_FILE) ? json_decode(file_get_contents(LMS_OTPS_FILE), true) : [];
    if (!is_array($otps)) $otps = [];
    $otps[$phone] = [
        'otp' => $otp,
        'expiresAt' => time() + 600
    ];
    file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);

    $isSenderOwnNumber = ($phone === '9939800780'); // WhatsApp Cloud API disallows sending from number to itself
    if ($isSenderOwnNumber && !$isAdminCaller && !$demoMode && !$isLocal) {
        json_err('Is number ke liye pehle isi browser me Admin Panel me login karein, phir OTP mangwayein.', 403);
    }

    // Direct WhatsApp OTP via AIbotflow (Official Meta WhatsApp Cloud API)
    if (!$demoMode && !$isSenderOwnNumber && !empty($settings['aibotflowApiKey'])) {
        $sendRes = send_aibotflow_whatsapp_otp($phone, $otp, $settings['aibotflowApiKey'], $settings['aibotflowOtpTemplate'] ?? 'quickart_login_otp');
        if (!$sendRes['ok']) {
            error_log("AIbotflow WhatsApp OTP delivery failure for {$phone}: " . ($sendRes['error'] ?? 'Unknown error'));
            // Never show the OTP on screen — that let anyone log in to any number
            json_err('WhatsApp OTP abhi nahi ja paya. Thodi der baad try karein ya Email OTP / WhatsApp support (+91 9939800780) use karein.', 503);
        }
    } elseif (!$demoMode && !$isSenderOwnNumber && empty($settings['aibotflowApiKey'])) {
        error_log("WhatsApp OTP Gateway (AIbotflow) is not configured for phone: {$phone}");
        json_err('WhatsApp OTP service abhi configured nahi hai. Email se login karein.', 503);
    }

    json_ok([
        'message' => $isSenderOwnNumber ? 'Admin number recognized. OTP generated.' : 'OTP sent successfully to your WhatsApp',
        'phone' => $phone,
        'devOtp' => ($demoMode || $isLocal || ($isSenderOwnNumber && $isAdminCaller)) ? $otp : null
    ]);
}

// 2. Verify OTP
if ($action === 'verify-otp' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);
    $userOtp = trim($body['otp'] ?? '');

    if (empty($phone) || empty($userOtp)) {
        json_err('Mobile number and OTP are required', 400);
    }

    $otps = file_exists(LMS_OTPS_FILE) ? json_decode(file_get_contents(LMS_OTPS_FILE), true) : [];
    $record = $otps[$phone] ?? null;

    $settings = load_lms_settings();
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);
    $isDemoMatch = ((!empty($settings['otpDemoMode']) || $isLocal) && $userOtp === ($settings['defaultOtp'] ?? '123456'));

    // Max 5 wrong attempts per OTP, then it is discarded (stops brute force)
    if (!$isDemoMatch && $record && ($record['attempts'] ?? 0) >= 5) {
        unset($otps[$phone]);
        file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);
        json_err('Bahut zyada galat OTP. Naya OTP mangwayein.', 429);
    }
    if (!$isDemoMatch && (!$record || $record['expiresAt'] < time() || !hash_equals((string)$record['otp'], $userOtp))) {
        if ($record) {
            $otps[$phone]['attempts'] = ($record['attempts'] ?? 0) + 1;
            file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);
        }
        json_err('Invalid or expired OTP. Please try again.', 401);
    }

    // Clear used OTP
    unset($otps[$phone]);
    file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);

    // Get or create student
    $students = load_students();
    $currentStudent = null;
    $found = false;

    foreach ($students as &$stu) {
        if (clean_phone($stu['phone'] ?? '') === $phone) {
            $stu['lastActive'] = date('c');
            $currentStudent = &$stu;
            $found = true;
            break;
        }
    }
    unset($stu);

    // Cross-reference offline admissions data to enrich profile & avatar
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

    if (!$found) {
        $newStudent = [
            'id' => 'stu_' . substr(md5(uniqid($phone, true)), 0, 8),
            'phone' => $phone,
            'name' => ($admRec && !empty($admRec['fullName'])) ? $admRec['fullName'] : ('Student ' . substr($phone, -4)),
            'email' => $admRec['email'] ?? '',
            'city' => $admRec['city'] ?? '',
            'enrolledAt' => date('c'),
            'enrolledCourses' => [],
            'completedLessons' => [],
            'lastActive' => date('c')
        ];
        if ($admRec) {
            if (!empty($admRec['photoUrl'])) {
                $newStudent['avatar'] = $admRec['photoUrl'];
                $newStudent['avatarUrl'] = $admRec['photoUrl'];
                $newStudent['photoUrl'] = $admRec['photoUrl'];
            }
            if (!empty($admRec['id'])) {
                $newStudent['offlineAdmissionId'] = $admRec['id'];
                $newStudent['enrollmentNo'] = $admRec['id'];
            }
            if (!empty($admRec['courseTitle'])) {
                $newStudent['appliedCourse'] = $admRec['courseTitle'];
            }
            if (!empty($admRec['bloodGroup'])) $newStudent['bloodGroup'] = $admRec['bloodGroup'];
            if (!empty($admRec['studioName'])) $newStudent['studioName'] = $admRec['studioName'];
            if (!empty($admRec['address'])) $newStudent['address'] = $admRec['address'];
            $newStudent['isOfflineStudent'] = true;
        }
        $students[] = $newStudent;
        $currentStudent = $newStudent;
    } else if ($admRec && $currentStudent) {
        if (empty($currentStudent['avatar']) && !empty($admRec['photoUrl'])) {
            $currentStudent['avatar'] = $admRec['photoUrl'];
            $currentStudent['avatarUrl'] = $admRec['photoUrl'];
            $currentStudent['photoUrl'] = $admRec['photoUrl'];
        }
        if (empty($currentStudent['offlineAdmissionId']) && !empty($admRec['id'])) {
            $currentStudent['offlineAdmissionId'] = $admRec['id'];
            $currentStudent['enrollmentNo'] = $admRec['id'];
        }
        if (empty($currentStudent['appliedCourse']) && !empty($admRec['courseTitle'])) {
            $currentStudent['appliedCourse'] = $admRec['courseTitle'];
        }
        if (empty($currentStudent['bloodGroup']) && !empty($admRec['bloodGroup'])) $currentStudent['bloodGroup'] = $admRec['bloodGroup'];
        if (empty($currentStudent['studioName']) && !empty($admRec['studioName'])) $currentStudent['studioName'] = $admRec['studioName'];
        if (empty($currentStudent['address']) && !empty($admRec['address'])) $currentStudent['address'] = $admRec['address'];
        $currentStudent['isOfflineStudent'] = true;
    }

    save_students($students);
    $token = create_student_session($phone);

    json_ok([
        'token' => $token,
        'student' => [
            'id' => $currentStudent['id'],
            'phone' => $currentStudent['phone'],
            'name' => $currentStudent['name'],
            'email' => $currentStudent['email'] ?? '',
            'city' => $currentStudent['city'] ?? '',
            'avatar' => $currentStudent['avatar'] ?? ($currentStudent['photoUrl'] ?? ''),
            'avatarUrl' => $currentStudent['avatarUrl'] ?? ($currentStudent['photoUrl'] ?? ''),
            'photoUrl' => $currentStudent['photoUrl'] ?? ($currentStudent['avatar'] ?? ''),
            'enrollmentNo' => $currentStudent['offlineAdmissionId'] ?? ($currentStudent['enrollmentNo'] ?? ('QAA-' . date('Y') . '-' . substr(preg_replace('/[^0-9]/', '', $currentStudent['phone'] ?? '9999'), -4))),
            'enrolledCourses' => $currentStudent['enrolledCourses'] ?? [],
            'appliedCourse' => $currentStudent['appliedCourse'] ?? '',
            'studioName' => $currentStudent['studioName'] ?? '',
            'bloodGroup' => $currentStudent['bloodGroup'] ?? 'B+'
        ]
    ]);
}

// 2.2 Verify Phone OTP (Without Login, for Admission Form Verification)
if ($action === 'verify-phone-otp' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);
    $userOtp = trim($body['otp'] ?? '');

    if (empty($phone) || empty($userOtp)) {
        json_err('Mobile number aur OTP enter karna mandatory hai', 400);
    }

    $otps = file_exists(LMS_OTPS_FILE) ? json_decode(file_get_contents(LMS_OTPS_FILE), true) : [];
    $record = $otps[$phone] ?? null;

    $settings = load_lms_settings();
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);
    $isDemoMatch = ((!empty($settings['otpDemoMode']) || $isLocal) && $userOtp === ($settings['defaultOtp'] ?? '123456'));

    // Max 5 wrong attempts per OTP, then it is discarded (stops brute force)
    if (!$isDemoMatch && $record && ($record['attempts'] ?? 0) >= 5) {
        unset($otps[$phone]);
        file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);
        json_err('Bahut zyada galat OTP. Naya OTP mangwayein.', 429);
    }
    if (!$isDemoMatch && (!$record || $record['expiresAt'] < time() || !hash_equals((string)$record['otp'], $userOtp))) {
        if ($record) {
            $otps[$phone]['attempts'] = ($record['attempts'] ?? 0) + 1;
            file_put_contents(LMS_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);
        }
        json_err('Galat ya expired OTP code enter kiya hai. Kripya naya OTP mangwayein.', 401);
    }

    // Mark verified for admission verification (valid for 1 hour)
    $verifiedFile = DATA_DIR . '/verified-admissions.json';
    $verifiedList = file_exists($verifiedFile) ? json_decode(file_get_contents($verifiedFile), true) : [];
    if (!is_array($verifiedList)) $verifiedList = [];
    if (!isset($verifiedList['phones']) || !is_array($verifiedList['phones'])) $verifiedList['phones'] = [];
    $verifiedList['phones'][$phone] = [
        'verifiedAt' => time(),
        'expiresAt'  => time() + 3600
    ];
    file_put_contents($verifiedFile, json_encode($verifiedList, JSON_PRETTY_PRINT), LOCK_EX);

    json_ok([
        'verified' => true,
        'phone'    => $phone,
        'message'  => 'WhatsApp number successfully verified!'
    ]);
}

// 2.5 Send Email OTP (Registration, Admission & Forgot Password)
if ($action === 'send-email-otp' && $method === 'POST') {
    $body = read_json_body();
    $email = strtolower(trim($body['email'] ?? ''));
    $purpose = trim($body['purpose'] ?? 'register'); // 'register', 'admission', or 'forgot-password'

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_err('Valid email address darj karein', 400);
    }

    $students = load_students();
    $exists = false;
    foreach ($students as $s) {
        if (!empty($s['email']) && strtolower($s['email']) === $email) {
            $exists = true;
            break;
        }
    }

    if ($purpose === 'register' && $exists) {
        json_err('Is email se pehle se account registered hai. Login karein.', 409);
    }

    if ($purpose === 'forgot-password' && !$exists) {
        json_err('Is email se koi student account registered nahi mila.', 404);
    }

    $ipAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!in_array($ipAddr, ['127.0.0.1', '::1']) && (!rate_limit_hit('otp-email', $email, 5, 3600) || !rate_limit_hit('otp-ip', $ipAddr, 20, 3600))) {
        json_err('Bahut zyada OTP request ho gaye. 1 ghante baad try karein.', 429);
    }

    $otp = strval(random_int(100000, 999999));
    $settings = load_lms_settings();
    $sendRes = send_email_otp($email, $otp, $purpose, $settings);

    if (!$sendRes['ok']) {
        error_log("Email OTP delivery failure for {$email}: " . ($sendRes['error'] ?? 'Unknown error'));
        // Never show the OTP on screen — that allowed password resets of any account
        json_err('Email OTP abhi nahi ja paya. Thodi der baad try karein ya WhatsApp support (+91 9939800780) se baat karein.', 503);
    }

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);
    $demoMode = !empty($settings['otpDemoMode']);

    json_ok([
        'message' => 'OTP aapke email address par bhej diya gaya hai.',
        'email'   => $email,
        'purpose' => $purpose,
        'devOtp'  => ($demoMode || $isLocal) ? $otp : null
    ]);
}

// 2.6 Verify Email OTP
if ($action === 'verify-email-otp' && $method === 'POST') {
    $body = read_json_body();
    $email = strtolower(trim($body['email'] ?? ''));
    $otp = trim($body['otp'] ?? '');
    $purpose = trim($body['purpose'] ?? '');
    $settings = load_lms_settings();

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);
    $isDemoMatch = ((!empty($settings['otpDemoMode']) || $isLocal) && $otp === ($settings['defaultOtp'] ?? '123456'));

    $v = verify_email_otp($email, $otp, $purpose, $settings);
    if (!$v['ok'] && !$isDemoMatch) {
        json_err($v['error'], 400);
    }

    // Mark email verified in verified-admissions.json as well
    $verifiedFile = DATA_DIR . '/verified-admissions.json';
    $verifiedList = file_exists($verifiedFile) ? json_decode(file_get_contents($verifiedFile), true) : [];
    if (!is_array($verifiedList)) $verifiedList = [];
    if (!isset($verifiedList['emails']) || !is_array($verifiedList['emails'])) $verifiedList['emails'] = [];
    $verifiedList['emails'][$email] = [
        'verifiedAt' => time(),
        'expiresAt'  => time() + 3600
    ];
    file_put_contents($verifiedFile, json_encode($verifiedList, JSON_PRETTY_PRINT), LOCK_EX);

    json_ok(['verified' => true, 'message' => 'Email successfully verified!']);
}

// 2.7 Reset Password via Email OTP
if ($action === 'email-reset-password' && $method === 'POST') {
    $body = read_json_body();
    $email = strtolower(trim($body['email'] ?? ''));
    $otp = trim($body['otp'] ?? '');
    $newPassword = trim($body['newPassword'] ?? '');

    if (strlen($newPassword) < 6) {
        json_err('Naya password kam se kam 6 characters ka hona chahiye', 400);
    }

    $settings = load_lms_settings();
    $v = verify_email_otp($email, $otp, 'forgot-password', $settings);
    if (!$v['ok']) {
        json_err($v['error'], 400);
    }

    $students = load_students();
    $found = false;
    $studentPhone = null;
    foreach ($students as &$s) {
        if (!empty($s['email']) && strtolower($s['email']) === $email) {
            $s['passwordHash'] = password_hash($newPassword, PASSWORD_DEFAULT);
            $studentPhone = $s['phone'];
            $found = true;
            break;
        }
    }
    unset($s);

    if (!$found) {
        json_err('Student account nahi mila', 404);
    }

    save_students($students);
    consume_email_otp($email);

    $token = create_student_session($studentPhone);
    json_ok([
        'message' => 'Password successfully reset ho gaya hai!',
        'token' => $token
    ]);
}

// 3. Email + Password Sign Up (Self-Registration with OTP verification)
if ($action === 'email-signup' && $method === 'POST') {
    $body     = read_json_body();
    $name     = trim($body['name'] ?? '');
    $rawPhone = $body['phone'] ?? '';
    $phone    = clean_phone($rawPhone);
    $email    = strtolower(trim($body['email'] ?? ''));
    $password = trim($body['password'] ?? '');
    $emailOtp = trim($body['otp'] ?? '');

    if (!$name)                                     json_err('Naam required hai', 400);
    if (strlen($phone) < 10)                        json_err('Valid 10-digit mobile number darj karein', 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Valid email address darj karein', 400);
    if (strlen($password) < 6)                      json_err('Password kam se kam 6 characters ka hona chahiye', 400);

    // Verify email OTP
    $settings = load_lms_settings();
    if ($emailOtp) {
        $v = verify_email_otp($email, $emailOtp, 'register', $settings);
        if (!$v['ok']) json_err($v['error'], 400);
        consume_email_otp($email);
    } else {
        $otps = load_email_otps();
        $rec = $otps[$email] ?? null;
        if (!$rec || empty($rec['verified']) || $rec['expiresAt'] < time()) {
            json_err('Pehle email OTP verify karein', 400);
        }
        consume_email_otp($email);
    }

    $students = load_students();

    // Check for duplicate phone or email
    foreach ($students as $s) {
        if ($s['phone'] === $phone) {
            json_err('Is mobile number se pehle se account hai. Login karein ya OTP use karein.', 409);
        }
        if (!empty($s['email']) && strtolower($s['email']) === $email) {
            json_err('Is email se pehle se account registered hai. Login tab use karein.', 409);
        }
    }

    $settings       = load_lms_settings();
    $allCourses     = load_courses();
    // New signup gets no courses by default (admin assigns later)
    $newStudent = [
        'id'              => 'stu_' . substr(md5(uniqid($phone, true)), 0, 8),
        'phone'           => $phone,
        'name'            => $name,
        'email'           => $email,
        'passwordHash'    => password_hash($password, PASSWORD_DEFAULT),
        'city'            => '',
        'enrolledAt'      => date('c'),
        'enrolledCourses' => [],
        'completedLessons'=> [],
        'lastActive'      => date('c'),
        'signupMethod'    => 'email'
    ];
    $students[] = $newStudent;
    save_students($students);

    $token = create_student_session($phone);

    json_ok([
        'token'   => $token,
        'student' => [
            'id'             => $newStudent['id'],
            'phone'          => $newStudent['phone'],
            'name'           => $newStudent['name'],
            'email'          => $newStudent['email'],
            'enrolledCourses'=> []
        ]
    ]);
}

// 3.1 Supabase Auto-Login after email link confirmation
if ($action === 'supabase-auto-login' && $method === 'POST') {
    $body = read_json_body();
    // The email must come from Supabase itself (verified access token), never from the browser
    $accessToken = trim((string)($body['accessToken'] ?? ''));
    $sbSettings = load_lms_settings();
    $sbUrl = rtrim($sbSettings['supabaseUrl'] ?? '', '/');
    $sbKey = $sbSettings['supabaseAnonKey'] ?? '';
    if (!$accessToken || !$sbUrl || !$sbKey) json_err('Email link login verify nahi ho paya. Dobara login karein.', 401);
    $ch = curl_init($sbUrl . '/auth/v1/user');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['apikey: ' . $sbKey, 'Authorization: Bearer ' . $accessToken],
        CURLOPT_TIMEOUT => 8
    ]);
    $sbRaw = curl_exec($ch);
    $sbCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $sbUser = json_decode((string)$sbRaw, true) ?: [];
    $email = strtolower(trim($sbUser['email'] ?? ''));
    if ($sbCode !== 200 || !filter_var($email, FILTER_VALIDATE_EMAIL) || empty($sbUser['email_confirmed_at'] ?? ($sbUser['confirmed_at'] ?? ''))) {
        json_err('Email link login verify nahi ho paya. Dobara login karein.', 401);
    }

    $students = load_students();
    $matched = null;
    foreach ($students as $s) {
        if (!empty($s['email']) && strtolower($s['email']) === $email) {
            $matched = $s;
            break;
        }
    }

    if (!$matched) {
        $matched = [
            'id'              => 'stu_' . substr(md5(uniqid($email, true)), 0, 8),
            'phone'           => '',
            'name'            => explode('@', $email)[0],
            'email'           => $email,
            'passwordHash'    => '',
            'city'            => '',
            'enrolledAt'      => date('c'),
            'enrolledCourses' => [],
            'completedLessons'=> [],
            'lastActive'      => date('c'),
            'signupMethod'    => 'supabase-email'
        ];
        $students[] = $matched;
        save_students($students);
    }

    $token = create_student_session($matched['phone'] ?: $matched['email']);
    json_ok([
        'token'   => $token,
        'student' => [
            'id'             => $matched['id'],
            'phone'          => $matched['phone'],
            'name'           => $matched['name'],
            'email'          => $matched['email'],
            'enrolledCourses'=> $matched['enrolledCourses'] ?? []
        ]
    ]);
}

// ─── Discussion / Comments API ────────────────────────────────────────────────
define('LMS_DISCUSSIONS_FILE', DATA_DIR . '/discussions.json');

function load_discussions() {
    if (!file_exists(LMS_DISCUSSIONS_FILE)) return [];
    return json_decode(file_get_contents(LMS_DISCUSSIONS_FILE), true) ?: [];
}

function save_discussions($data) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(LMS_DISCUSSIONS_FILE, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

// GET: List comments for a lesson
if ($action === 'discussion-list') {
    $stu      = require_student();
    $courseId = trim($_GET['courseId'] ?? '');
    $lessonId = trim($_GET['lessonId'] ?? '');
    if (!$courseId || !$lessonId) json_err('courseId and lessonId required', 400);

    $all      = load_discussions();
    $key      = $courseId . '::' . $lessonId;
    $comments = $all[$key] ?? [];

    // Return in chronological order
    json_ok(['comments' => array_values($comments)]);
}

// POST: Post a new comment
if ($action === 'discussion-post' && $method === 'POST') {
    $stu  = require_student();
    $body = read_json_body();

    $courseId = trim($body['courseId'] ?? '');
    $lessonId = trim($body['lessonId'] ?? '');
    $text     = trim($body['text'] ?? '');

    if (!$courseId || !$lessonId) json_err('courseId and lessonId required', 400);
    if (strlen($text) < 2)       json_err('Comment bahut chota hai', 400);
    if (strlen($text) > 1000)    json_err('Comment 1000 characters se zyada nahi ho sakta', 400);

    $all = load_discussions();
    $key = $courseId . '::' . $lessonId;
    if (!isset($all[$key])) $all[$key] = [];

    $comment = [
        'id'         => 'cmt_' . substr(md5(uniqid($stu['phone'], true)), 0, 10),
        'authorName' => $stu['name'] ?? 'Student',
        'authorId'   => $stu['id']   ?? '',
        'isMentor'   => false,
        'text'       => $text,
        'likes'      => 0,
        'createdAt'  => date('c'),
    ];
    $all[$key][] = $comment;
    save_discussions($all);

    json_ok(['comment' => $comment]);
}

// POST: Like / unlike a comment
if ($action === 'discussion-like' && $method === 'POST') {
    $stu  = require_student();
    $body = read_json_body();

    $commentId = trim($body['commentId'] ?? '');
    $act       = trim($body['action'] ?? 'like');  // 'like' | 'unlike'
    if (!$commentId) json_err('commentId required', 400);

    $all = load_discussions();
    $found = false;
    foreach ($all as $key => &$comments) {
        foreach ($comments as &$c) {
            if ($c['id'] === $commentId) {
                $c['likes'] = max(0, ($c['likes'] ?? 0) + ($act === 'unlike' ? -1 : 1));
                $found = true;
                break 2;
            }
        }
    }
    unset($c, $comments);
    if ($found) save_discussions($all);

    json_ok(['ok' => true]);
}
// ─────────────────────────────────────────────────────────────────────────────

// 4. Email + Password Login
if ($action === 'email-login' && $method === 'POST') {
    $body = read_json_body();
    $email    = strtolower(trim($body['email'] ?? ''));
    $password = trim($body['password'] ?? '');

    if (empty($email) || empty($password)) {
        json_err('Email aur password dono required hain', 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_err('Valid email address darj karein', 400);
    }

    $students = load_students();
    $matched  = null;

    foreach ($students as &$stu) {
        $stuEmail = strtolower(trim($stu['email'] ?? ''));
        if ($stuEmail === $email) {
            // If passwordHash exists, verify it; else check plain-text legacy password
            if (!empty($stu['passwordHash'])) {
                if (password_verify($password, $stu['passwordHash'])) {
                    $stu['lastActive'] = date('c');
                    $matched = &$stu;
                    break;
                }
            } elseif (!empty($stu['password'])) {
                // Legacy plain-text (migrate on success)
                if ($stu['password'] === $password) {
                    $stu['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);
                    unset($stu['password']);
                    $stu['lastActive'] = date('c');
                    $matched = &$stu;
                    break;
                }
            }
            // Email found but password wrong
            json_err('Galat password. Dobara try karein ya OTP se login karein.', 401);
        }
    }
    unset($stu);

    if (!$matched) {
        json_err('Is email se koi student account nahi mila. Phone OTP se login try karein.', 404);
    }

    save_students($students);
    $token = create_student_session($matched['phone']);

    json_ok([
        'token'   => $token,
        'student' => [
            'id'             => $matched['id'],
            'phone'          => $matched['phone'],
            'name'           => $matched['name'],
            'email'          => $matched['email'],
            'enrolledCourses'=> $matched['enrolledCourses'] ?? []
        ]
    ]);
}

// 4. Current Student Info
if ($action === 'me' && $method === 'GET') {
    $student = require_student();

    // Cross-reference offline admissions to enrich student profile and ID card details
    $admFile = DATA_DIR . '/offline-admissions.json';
    if (file_exists($admFile)) {
        $allAdms = json_decode(file_get_contents($admFile), true) ?: [];
        $pClean = clean_phone($student['phone'] ?? '');
        foreach ($allAdms as $a) {
            if (clean_phone($a['phone'] ?? '') === $pClean) {
                if (empty($student['offlineAdmissionId'])) $student['offlineAdmissionId'] = $a['id'] ?? '';
                if (empty($student['enrollmentNo'])) $student['enrollmentNo'] = $a['id'] ?? '';
                if (empty($student['bloodGroup'])) $student['bloodGroup'] = $a['bloodGroup'] ?? 'B+';
                if (empty($student['studioName'])) $student['studioName'] = $a['studioName'] ?? '';
                if (empty($student['workCity'])) $student['workCity'] = $a['workCity'] ?? ($a['city'] ?? '');
                if (empty($student['appliedCourse'])) $student['appliedCourse'] = $a['courseTitle'] ?? '';
                if (!empty($a['photoUrl'])) {
                    $student['avatar'] = $a['photoUrl'];
                    $student['avatarUrl'] = $a['photoUrl'];
                    $student['photoUrl'] = $a['photoUrl'];
                }
                $isAdmApproved = (!empty($a['isApproved']) || ($a['status'] ?? '') === 'approved' || ($a['status'] ?? '') === 'active') && (($a['status'] ?? '') !== 'pending_approval');
                if ($isAdmApproved) {
                    $student['isApproved'] = true;
                    $student['status'] = 'active';
                    if (($a['paymentStatus'] ?? '') === 'paid') {
                        $student['isPaid500'] = true;
                        $student['paymentStatus'] = 'paid';
                    }
                } else {
                    if (empty($student['isApproved'])) {
                        $student['isApproved'] = false;
                        $student['status'] = 'pending_approval';
                    }
                }
                break;
            }
        }
    }

    if (empty($student['enrollmentNo'])) {
        $student['enrollmentNo'] = $student['offlineAdmissionId'] ?? ('QAA-' . date('Y') . '-' . substr(preg_replace('/[^0-9]/', '', $student['phone'] ?? '9999'), -4));
    }
    $allCourses = load_courses();

    $enrolledCount = count($student['enrolledCourses'] ?? []);
    $completedLessonsCount = 0;
    if (!empty($student['completedLessons'])) {
        foreach ($student['completedLessons'] as $cList) {
            $completedLessonsCount += count($cList);
        }
    }

    json_ok([
        'student' => $student,
        'stats' => [
            'enrolledCoursesCount' => $enrolledCount,
            'completedLessonsCount' => $completedLessonsCount
        ]
    ]);
}

// 4. Student Enrolled Courses
if ($action === 'my-courses' && $method === 'GET') {
    $student = require_student();

    $enrolledIds = $student['enrolledCourses'] ?? [];
    if (!is_array($enrolledIds)) $enrolledIds = [];

    $isOffline = !empty($student['isOfflineStudent']) || !empty($student['offlineAdmissionId']) || !empty($student['appliedCourse']);
    $isApproved = !empty($student['isApproved']) && in_array($student['status'] ?? '', ['active', 'approved']);
    $appliedCourseTitle = trim($student['appliedCourse'] ?? '');

    // Admission Form Course Rules (Applies to both Offline & Online Batch forms):
    // 1. MUST BE APPROVED BY ADMIN to unlock applied course in enrolledCourses.
    // 2. If NOT approved, any course mapped from the form is locked/stripped.
    // 3. BUT direct recorded online courses (purchased via Razorpay) and workshop tickets (₹21) ALWAYS remain active!
    if ($isOffline && !empty($appliedCourseTitle)) {
        $formCourseId = map_offline_course_id($appliedCourseTitle);
        if ($isApproved) {
            if (!in_array($formCourseId, $enrolledIds)) {
                $enrolledIds[] = $formCourseId;
                $student['enrolledCourses'] = $enrolledIds;
                $allStudents = load_students();
                foreach ($allStudents as &$s) {
                    if (clean_phone($s['phone'] ?? '') === clean_phone($student['phone'] ?? '')) {
                        $s['enrolledCourses'] = $enrolledIds;
                        $s['isApproved'] = true;
                        $s['status'] = 'active';
                        break;
                    }
                }
                unset($s);
                save_students($allStudents);
            }
        } else {
            // NOT APPROVED by Admin yet: strip the form course from active list so it cannot be accessed
            $enrolledIds = array_values(array_filter($enrolledIds, function($id) use ($formCourseId) {
                return $id !== $formCourseId;
            }));
        }
    }

    // Reconcile with transactions to guarantee access if a payment was completed
    $stuPhone = clean_phone($student['phone'] ?? '');
    $txList = file_exists(LMS_TRANSACTIONS_FILE) ? (json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) ?: []) : [];
    $dirty = false;
    foreach ($txList as $tx) {
        if (clean_phone($tx['studentPhone'] ?? '') === $stuPhone && in_array(strtoupper($tx['status'] ?? ''), ['SUCCESS', 'COMPLETED', 'PAID'])) {
            if (!empty($tx['liveId']) && !in_array($tx['liveId'], $enrolledIds)) {
                $enrolledIds[] = $tx['liveId'];
                $dirty = true;
            }
            if (!empty($tx['courseId'])) {
                $cIds = explode(',', $tx['courseId']);
                foreach ($cIds as $cid) {
                    $cid = trim($cid);
                    if ($cid && !in_array($cid, $enrolledIds)) {
                        $enrolledIds[] = $cid;
                        $dirty = true;
                    }
                }
            }
        }
    }
    if ($dirty) {
        $student['enrolledCourses'] = $enrolledIds;
        $allStudents = load_students();
        foreach ($allStudents as &$s) {
            if (clean_phone($s['phone'] ?? '') === $stuPhone) {
                $s['enrolledCourses'] = $enrolledIds;
                break;
            }
        }
        unset($s);
        save_students($allStudents);
    }

    $allCourses = load_courses();
    $result = [];

    foreach ($allCourses as $c) {
        // Enrolled courses include:
        // - Online courses bought by the student
        // - Courses manually created & assigned by admin
        // - Offline courses unlocked after ₹500 fee confirmation
        if (in_array($c['id'], $enrolledIds)) {
            $totalLessons = 0;
            if (!empty($c['modules'])) {
                foreach ($c['modules'] as $m) {
                    $totalLessons += count($m['lessons'] ?? []);
                }
            }

            $completed = $student['completedLessons'][$c['id']] ?? [];
            $completedCount = count($completed);
            $progressPercent = $totalLessons > 0 ? round(($completedCount / $totalLessons) * 100) : 0;

            $result[] = [
                'id' => $c['id'],
                'slug' => $c['slug'],
                'title' => $c['title'],
                'subtitle' => $c['subtitle'] ?? '',
                'category' => $c['category'] ?? '',
                'level' => $c['level'] ?? '',
                'duration' => $c['duration'] ?? '',
                'thumbnail' => $c['thumbnail'] ?? '',
                'badge' => $c['badge'] ?? '',
                'totalLessons' => $totalLessons,
                'completedCount' => $completedCount,
                'progressPercent' => $progressPercent,
                'isCompleted' => ($totalLessons > 0 && $completedCount >= $totalLessons),
                'quizPassed' => !empty($student['passedQuizzes'][$c['id']]),
                'certificateEligible' => cert_eligibility($student, $c)['eligible'],
                // Admin may pre-issue an ID; the student only sees it once eligible
                'certificate' => cert_eligibility($student, $c)['eligible'] ? ($student['certificates'][$c['id']] ?? null) : null
            ];
        }
    }

    // Include enrolled Live Workshops / Masterclasses as real course cards
    $allLive = get_all_live_classes();
    foreach ($allLive as $live) {
        $liveId = $live['id'];
        $courseRef = $live['courseId'] ?? '';
        $liveType = $live['type'] ?? 'workshop';

        $isLiveEnrolled = false;
        if ($stuPhone === '9939800780') {
            $isLiveEnrolled = true;
        } elseif ($liveType === 'course') {
            // STRICT: Must be enrolled in this specific course/batch or have explicit liveId
            $isBatchClass = (bool)preg_match('/batch\s*[-_]?\s*\d+/i', ($live['title'] ?? '') . ' ' . $liveId);
            $hasRealCourse = false;
            foreach ($enrolledIds as $eid) {
                if (str_starts_with($eid, 'course-')) {
                    $hasRealCourse = true;
                    break;
                }
            }

            // If it's a batch class and courseRef is empty or 'all', auto-resolve to the batch course ID
            $effCourseRef = $courseRef;
            if ($isBatchClass && (empty($effCourseRef) || $effCourseRef === 'all')) {
                $effCourseRef = map_offline_course_id($live['title'] ?? '');
            }

            if (in_array('all-access', $enrolledIds)) {
                $isLiveEnrolled = true;
            } elseif (in_array($liveId, $enrolledIds)) {
                $isLiveEnrolled = true;
            } elseif (!empty($effCourseRef) && $effCourseRef !== 'all' && in_array($effCourseRef, $enrolledIds)) {
                $isLiveEnrolled = true;
            } elseif ($effCourseRef === 'all' && !$isBatchClass && $hasRealCourse) {
                $isLiveEnrolled = true;
            }
        } else {
            // Workshop (e.g. ₹21 masterclass) - strictly restricted to the specific workshop liveId or all-access
            if (in_array($liveId, $enrolledIds) || in_array('all-access', $enrolledIds)) {
                $isLiveEnrolled = true;
            }
        }

        // Also check completed transactions
        if (!$isLiveEnrolled && !empty($stuPhone)) {
            foreach ($txList as $tx) {
                if (clean_phone($tx['studentPhone'] ?? '') === $stuPhone && in_array(strtoupper($tx['status'] ?? ''), ['SUCCESS', 'COMPLETED', 'PAID'])) {
                    if (($tx['liveId'] ?? '') === $liveId) {
                        $isLiveEnrolled = true;
                        break;
                    } elseif ($liveType === 'workshop' && !empty($tx['liveId'])) {
                        $isLiveEnrolled = true;
                        break;
                    }
                }
            }
        }

        if ($isLiveEnrolled) {
            $isLiveNow = ($live['status'] ?? '') === 'live';
            $isCompleted = ($live['status'] ?? '') === 'completed';
            $result[] = [
                'id'              => $live['id'],
                'slug'            => 'live-' . $live['id'],
                'title'           => $live['title'],
                'subtitle'        => $live['description'] ?? 'Practical Hands-on Session with Lead Mentor Anil Sharma.',
                'category'        => ($liveType === 'course' ? 'BATCH MASTERCLASS' : 'LIVE WORKSHOP'),
                'level'           => 'Practical / All Levels',
                'duration'        => $live['duration'] ?? ($liveType === 'course' ? '90 Mins' : 'Live Workshop'),
                'thumbnail'       => 'assets/editing-timeline.jpg',
                'badge'           => $isLiveNow ? '🔴 LIVE NOW' : ($isCompleted ? '✓ REPLAY UNLOCKED' : ($liveType === 'course' ? '🎓 BATCH CLASS' : 'LIVE WORKSHOP')),
                'totalLessons'    => 2,
                'completedCount'  => $isCompleted ? 2 : ($isLiveNow ? 1 : 0),
                'progressPercent' => $isCompleted ? 100 : ($isLiveNow ? 50 : 0),
                'isCompleted'     => $isCompleted,
                'isLiveWorkshop'  => true,
                'liveType'        => $liveType,
                'courseId'        => $courseRef,
                'liveSessionId'   => $live['id'],
                'liveStatus'      => $live['status'] ?? 'scheduled',
                'scheduledAt'     => $live['scheduledAt'] ?? '',
                'streamId'        => $live['streamId'] ?? '',
                'chatEnabled'     => !empty($live['chatEnabled'])
            ];
        }
    }

    $response = ['courses' => $result];

    // If student applied via admission form (offline or online batch) and is NOT yet approved by admin
    if ($isOffline && !$isApproved && !empty($appliedCourseTitle)) {
        $response['offlinePending'] = [
            'hasPendingOffline' => true,
            'isPendingApproval' => true,
            'isOnlineBatch'     => !empty($student['isOnlineBatch']),
            'appliedCourse'     => $appliedCourseTitle,
            'admissionId'       => $student['offlineAdmissionId'] ?? '',
            'feeAmount'         => !empty($student['isOnlineBatch']) ? 0 : 500,
            'paymentStatus'     => $student['paymentStatus'] ?? 'pending_approval'
        ];
    }

    json_ok($response);
}

// 5a. PUBLIC Course Structure for Landing Pages (no auth required)
if ($action === 'public-course-structure' && $method === 'GET') {
    $courseId = $_GET['id'] ?? $_GET['courseId'] ?? '';
    if (!$courseId) json_err('Course ID required', 400);

    // CORS: allow landing pages to call this
    header('Access-Control-Allow-Origin: *');
    header('Cache-Control: public, max-age=300'); // 5 min cache

    $allCourses = load_courses();
    $course = null;
    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId || $c['slug'] === $courseId) {
            $course = $c;
            break;
        }
    }
    if (!$course) json_err('Course not found', 404);
    if (!empty($course['isInternalOnly']) || !empty($course['isAdmissionCourse'])) {
        json_err('Course details are only accessible to enrolled students', 403);
    }

    // Return only public-safe fields (no videoUrls, no student data)
    $totalLessons = 0;
    $totalDurationMins = 0;
    $publicModules = [];

    foreach (($course['modules'] ?? []) as $mod) {
        $publicLessons = [];
        foreach (($mod['lessons'] ?? []) as $les) {
            $totalLessons++;
            // Parse duration "MM:SS" -> minutes
            if (!empty($les['duration'])) {
                $parts = explode(':', $les['duration']);
                $totalDurationMins += intval($parts[0]);
            }
            $publicLessons[] = [
                'id'       => $les['id'],
                'title'    => $les['title'],
                'duration' => $les['duration'] ?? '',
                'summary'  => $les['summary'] ?? '',
                'hasResources' => !empty($les['resources']),
            ];
        }
        $publicModules[] = [
            'id'      => $mod['id'],
            'title'   => $mod['title'],
            'lessons' => $publicLessons,
            'lessonCount' => count($publicLessons),
        ];
    }

    $hours = floor($totalDurationMins / 60);
    $mins  = $totalDurationMins % 60;

    json_ok([
        'courseId'      => $course['id'],
        'title'         => $course['title'],
        'subtitle'      => $course['subtitle'] ?? '',
        'duration'      => $course['duration'] ?? ($hours . ' Hours ' . ($mins ? $mins . ' Mins' : '')),
        'totalModules'  => count($publicModules),
        'totalLessons'  => $totalLessons,
        'totalDurationMins' => $totalDurationMins,
        'badge'         => $course['badge'] ?? '',
        'modules'       => $publicModules,
    ]);
}

// 5. Course Details & Curriculum

if ($action === 'course-details' && $method === 'GET') {
    $student = require_student();
    $courseId = $_GET['id'] ?? ($_GET['courseId'] ?? '');

    $enrolled = $student['enrolledCourses'] ?? [];
    $isOffline = !empty($student['isOfflineStudent']) || !empty($student['offlineAdmissionId']) || !empty($student['appliedCourse']);
    // Admission-form course unlocks only after Admin approval (payment alone is not enough)
    $isApproved = !empty($student['isApproved']) && in_array($student['status'] ?? '', ['active', 'approved']);
    $appliedCourseTitle = trim($student['appliedCourse'] ?? '');

    if (!in_array($courseId, $enrolled)) {
        if ($isOffline && $isApproved && !empty($appliedCourseTitle) && map_offline_course_id($appliedCourseTitle) === $courseId) {
            $enrolled[] = $courseId;
            $student['enrolledCourses'] = $enrolled;
        } else {
            json_err('You are not enrolled in this course', 403);
        }
    }

    // Handle Live Workshops requested as course-details
    if (str_starts_with($courseId, 'live_') || $courseId === 'masterclass-live') {
        $allLive = get_all_live_classes();
        $targetLive = null;
        foreach ($allLive as $lc) {
            if ($lc['id'] === $courseId) {
                $targetLive = $lc;
                break;
            } elseif ($courseId === 'masterclass-live' && (($lc['type'] ?? '') === 'workshop' || $lc['id'] === 'live_demo_01')) {
                $targetLive = $lc;
                break;
            }
        }
        if ($targetLive) {
            $landingFile = DATA_DIR . '/masterclass-landing.json';
            $lp = file_exists($landingFile) ? (json_decode(file_get_contents($landingFile), true) ?: []) : [];
            $modulesData = $lp['modules'] ?? [
                ['day' => 'Day 01', 'title' => 'Day 1: 1-Click AI Wedding Photo Editing & 500+ RAW Retouching', 'desc' => 'Poori wedding ki 500+ RAW photos ko 15 min me 1-click bulk color grade aur retouch karna.'],
                ['day' => 'Day 02', 'title' => 'Day 2: AI Se Professional Video Editing & Teaser Workflow', 'desc' => 'Premiere Pro & DaVinci me AI Beat Sync se 30 min me Cinematic Wedding Teaser cut karna.']
            ];
            $synthModules = [];
            foreach ($modulesData as $idx => $m) {
                $synthModules[] = [
                    'id' => 'mod-live-' . ($idx + 1),
                    'title' => $m['title'] ?? ($m['day'] ?? 'Live Session'),
                    'lessons' => [
                        [
                            'id' => 'les-live-' . ($idx + 1),
                            'title' => $m['title'] ?? 'Interactive Practical Session',
                            'duration' => '90 Mins',
                            'summary' => $m['desc'] ?? 'Live session with Mentor Anil Sharma.',
                            'isCompleted' => ($targetLive['status'] === 'completed'),
                            'isLive' => true
                        ]
                    ]
                ];
            }
            $course = [
                'id' => $targetLive['id'],
                'slug' => 'live-' . $targetLive['id'],
                'title' => $targetLive['title'],
                'subtitle' => $targetLive['description'] ?? '',
                'category' => 'LIVE MASTERCLASS',
                'level' => 'All Levels',
                'duration' => $targetLive['duration'] ?? '2 Days Live',
                'thumbnail' => 'assets/editing-timeline.jpg',
                'badge' => '🔴 LIVE PASS',
                'modules' => $synthModules,
                'totalLessons' => count($synthModules),
                'completedCount' => ($targetLive['status'] === 'completed' ? count($synthModules) : 0),
                'progressPercent' => ($targetLive['status'] === 'completed' ? 100 : 0),
                'isLiveWorkshop' => true,
                'liveSessionId' => $targetLive['id']
            ];
            json_ok(['course' => $course]);
        }
    }

    $allCourses = load_courses();
    $course = null;
    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId) {
            $course = $c;
            break;
        }
    }

    if (!$course) json_err('Course not found', 404);

    $completed = $student['completedLessons'][$courseId] ?? [];
    $totalLessons = 0;
    $completedCount = 0;

    // Attach completion status to each lesson
    if (!empty($course['modules'])) {
        foreach ($course['modules'] as &$mod) {
            if (!empty($mod['lessons'])) {
                foreach ($mod['lessons'] as &$les) {
                    $totalLessons++;
                    $isDone = in_array($les['id'], $completed);
                    if ($isDone) $completedCount++;
                    $les['isCompleted'] = $isDone;
                }
            }
        }
    }

    $course['totalLessons'] = $totalLessons;
    $course['completedCount'] = $completedCount;
    $course['progressPercent'] = $totalLessons > 0 ? round(($completedCount / $totalLessons) * 100) : 0;

    json_ok(['course' => $course]);
}

// 6. Get Lesson with Secure Video Player & Anti-Piracy Watermark
if ($action === 'get-lesson' && $method === 'GET') {
    $student = require_student();
    $courseId = $_GET['courseId'] ?? '';
    $lessonId = $_GET['lessonId'] ?? '';

    $enrolled = $student['enrolledCourses'] ?? [];
    $isOffline = !empty($student['isOfflineStudent']) || !empty($student['offlineAdmissionId']) || !empty($student['appliedCourse']);
    // Admission-form course unlocks only after Admin approval (payment alone is not enough)
    $isApproved = !empty($student['isApproved']) && in_array($student['status'] ?? '', ['active', 'approved']);
    $appliedCourseTitle = trim($student['appliedCourse'] ?? '');

    if (!in_array($courseId, $enrolled)) {
        if ($isOffline && $isApproved && !empty($appliedCourseTitle) && map_offline_course_id($appliedCourseTitle) === $courseId) {
            $enrolled[] = $courseId;
            $student['enrolledCourses'] = $enrolled;
        } else {
            json_err('You are not enrolled in this course', 403);
        }
    }

    $allCourses = load_courses();
    $targetLesson = null;
    $targetCourse = null;

    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId) {
            $targetCourse = $c;
            foreach ($c['modules'] ?? [] as $m) {
                foreach ($m['lessons'] ?? [] as $les) {
                    if ($les['id'] === $lessonId) {
                        $targetLesson = $les;
                        break 2;
                    }
                }
            }
        }
    }

    if (!$targetLesson) json_err('Lesson not found', 404);

    $settings = load_lms_settings();

    // Video URL resolution (YouTube vs Bunny.net Stream vs Direct/Fallback)
    $videoType = 'mp4';
    $streamUrl = $targetLesson['videoUrl'] ?? '';
    $rawVideoId = $targetLesson['videoId'] ?? '';
    $ytId = extract_youtube_id($rawVideoId) ?: extract_youtube_id($streamUrl);
    $bunnyId = '';

    if ($ytId) {
        $videoType = 'youtube';
        // youtube-nocookie embed with privacy, full player controls, fullscreen enabled, and jsapi enabled
        $streamUrl = "https://www.youtube-nocookie.com/embed/{$ytId}?enablejsapi=1&rel=0&modestbranding=1&iv_load_policy=3&controls=1&showinfo=0&disablekb=0&playsinline=1&fs=1";
    } else {
        $bunnyId = extract_bunny_video_id($rawVideoId) ?: extract_bunny_video_id($streamUrl);
        if ($bunnyId) {
            $videoType = 'bunny_stream';
            $streamUrl = generate_bunny_video_url(
                $settings['bunnyLibraryId'] ?: '755385',
                $bunnyId,
                $settings['bunnyTokenAuthKey'] ?? ''
            );
        } elseif (strpos($streamUrl, 'iframe.mediadelivery.net') !== false || strpos($streamUrl, 'video.bunnycdn.com') !== false) {
            $videoType = 'bunny_stream';
        }
    }

    $completed = $student['completedLessons'][$courseId] ?? [];

    json_ok([
        'lesson' => [
            'id' => $targetLesson['id'],
            'title' => $targetLesson['title'],
            'duration' => $targetLesson['duration'] ?? '',
            'summary' => $targetLesson['summary'] ?? '',
            'resources' => $targetLesson['resources'] ?? [],
            'videoType' => $videoType,
            'streamUrl' => $streamUrl,
            'youtubeId' => $ytId ?: '',
            'bunnyVideoId' => $bunnyId ?: '',
            'isCompleted' => in_array($targetLesson['id'], $completed)
        ],
        'watermark' => [
            'enabled' => false,
            'text' => '',
            'opacity' => 0
        ]
    ]);
}

// 7. Update Progress (Mark Completed)
// ---------------------------------------------------------------------------
// Certificate eligibility (server is the single source of truth)
// A certificate is issued only when EVERY lesson of the course is completed
// AND the course quiz is passed (>= 70%). Live workshops / courses without
// lessons never auto-issue a certificate.
// ---------------------------------------------------------------------------
function cert_course_code($courseId) {
    $id = strtolower((string)$courseId);
    $map = [
        'pre-wedding' => 'PW', 'album' => 'AD', 'premiere' => 'PR', 'edius' => 'ED',
        'davinci' => 'DR', 'resolve' => 'DR', 'cinematic' => 'CE', 'wedding' => 'CW',
        'website' => 'WD', 'marketing' => 'DM', 'automation' => 'AU',
    ];
    foreach ($map as $needle => $code) {
        if (strpos($id, $needle) !== false) return $code;
    }
    return 'GEN';
}

function cert_find_course($courseId) {
    foreach (load_courses() as $c) {
        if (($c['id'] ?? '') === $courseId) return $c;
    }
    return null;
}

function cert_eligibility($student, $course) {
    $courseId = $course['id'] ?? '';
    $total = 0;
    $lessonIds = [];
    foreach (($course['modules'] ?? []) as $m) {
        foreach (($m['lessons'] ?? []) as $l) {
            $total++;
            if (isset($l['id'])) $lessonIds[] = $l['id'];
        }
    }
    $completed = $student['completedLessons'][$courseId] ?? [];
    if (!is_array($completed)) $completed = [];
    $done = count(array_intersect($lessonIds, $completed));
    $quiz = $student['passedQuizzes'][$courseId] ?? null;
    $quizPassed = !empty($quiz);
    $enrolled = in_array($courseId, $student['enrolledCourses'] ?? [], true);
    return [
        'courseId'   => $courseId,
        'enrolled'   => $enrolled,
        'total'      => $total,
        'done'       => $done,
        'pct'        => $total > 0 ? (int)round($done / $total * 100) : 0,
        'quizPassed' => $quizPassed,
        'eligible'   => $enrolled && $total > 0 && $done >= $total && $quizPassed,
    ];
}

// Record a passed course quiz (score >= 70) against the logged-in student.
if ($action === 'record-quiz-pass' && $method === 'POST') {
    $student = require_student();
    $body = read_json_body() ?: [];
    $courseId = trim($body['courseId'] ?? '');
    $score = (int)($body['scorePct'] ?? 0);
    if (!$courseId) json_err('courseId required', 400);
    if (!in_array($courseId, $student['enrolledCourses'] ?? [], true)) json_err('Not enrolled in this course', 403);
    if ($score < 70) json_err('Passing score is 70%', 400);

    $students = load_students();
    foreach ($students as &$stu) {
        if (($stu['phone'] ?? '') === ($student['phone'] ?? '')) {
            $stu['passedQuizzes'][$courseId] = ['score' => $score, 'date' => date('c')];
            break;
        }
    }
    unset($stu);
    save_students($students);
    json_ok(['recorded' => true]);
}

// Certificate status for one course. Issues a permanent certificate ID the
// first time the student becomes eligible.
if ($action === 'certificate-status' && $method === 'GET') {
    $student = require_student();
    $courseId = trim($_GET['courseId'] ?? '');
    if (!$courseId) json_err('courseId required', 400);
    $course = cert_find_course($courseId);
    if (!$course) json_ok(['eligible' => false, 'reason' => 'no-course', 'total' => 0, 'done' => 0, 'pct' => 0, 'quizPassed' => false]);

    $st = cert_eligibility($student, $course);
    if (!$st['eligible']) {
        $st['reason'] = !$st['enrolled'] ? 'not-enrolled' : ($st['total'] === 0 ? 'no-lessons' : ($st['done'] < $st['total'] ? 'lessons' : 'quiz'));
        json_ok($st);
    }

    $cert = $student['certificates'][$courseId] ?? null;
    if (!$cert) {
        // Reuse an ID the Admin already issued for this course, so both copies match
        $issuedFile = DATA_DIR . '/issued-certificates.json';
        foreach ((file_exists($issuedFile) ? (json_decode(file_get_contents($issuedFile), true) ?: []) : []) as $ic) {
            if (($ic['phone'] ?? '') === clean_phone($student['phone'] ?? '') && ($ic['courseId'] ?? '') === $courseId) {
                $cert = ['id' => $ic['id'], 'issuedDate' => $ic['issuedDate'] ?? date('Y-m-d'), 'courseTitle' => $ic['courseTitle'] ?? ($course['title'] ?? '')];
                break;
            }
        }
    }
    if (!$cert) {
        $cert = [
            'id' => 'QAA-' . date('Y') . '-' . cert_course_code($courseId) . '-' . strtoupper(bin2hex(random_bytes(3))),
            'issuedDate' => date('Y-m-d'),
            'courseTitle' => $course['title'] ?? '',
        ];
        $students = load_students();
        foreach ($students as &$stu) {
            if (($stu['phone'] ?? '') === ($student['phone'] ?? '')) {
                $stu['certificates'][$courseId] = $cert;
                break;
            }
        }
        unset($stu);
        save_students($students);
    }
    $st['certificate'] = $cert;
    json_ok($st);
}

if ($action === 'update-progress' && $method === 'POST') {
    $student = require_student();
    $body = read_json_body();
    $courseId = $body['courseId'] ?? '';
    $lessonId = $body['lessonId'] ?? '';
    if (!$courseId || !$lessonId) {
        json_err('courseId and lessonId required', 400);
    }
    // Older app builds send no isCompleted flag: treat as a toggle of the stored state.
    if (array_key_exists('isCompleted', $body)) {
        $completedState = !empty($body['isCompleted']);
    } else {
        $already = $student['completedLessons'][$courseId] ?? [];
        $completedState = !in_array($lessonId, is_array($already) ? $already : []);
    }

    $students = load_students();
    $updatedStudent = null;

    foreach ($students as &$stu) {
        if ($stu['phone'] === $student['phone']) {
            if (!isset($stu['completedLessons'][$courseId])) {
                $stu['completedLessons'][$courseId] = [];
            }
            if ($completedState) {
                if (!in_array($lessonId, $stu['completedLessons'][$courseId])) {
                    $stu['completedLessons'][$courseId][] = $lessonId;
                }
            } else {
                $stu['completedLessons'][$courseId] = array_values(
                    array_diff($stu['completedLessons'][$courseId], [$lessonId])
                );
            }
            $stu['lastActive'] = date('c');
            $updatedStudent = $stu;
            break;
        }
    }
    unset($stu);

    save_students($students);

    json_ok([
        'ok' => true,
        'completedLessons' => $updatedStudent['completedLessons'][$courseId] ?? []
    ]);
}

// 8. Logout
if ($action === 'logout' && $method === 'POST') {
    $token = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? '';
    if ($token && file_exists(LMS_SESSIONS_FILE)) {
        $sessions = json_decode(file_get_contents(LMS_SESSIONS_FILE), true);
        unset($sessions[$token]);
        file_put_contents(LMS_SESSIONS_FILE, json_encode($sessions, JSON_PRETTY_PRINT), LOCK_EX);
    }
    json_ok(['loggedOut' => true]);
}

// 9. Course Catalog (Public)
if ($action === 'catalog' && $method === 'GET') {
    $courses = load_courses();
    $publicList = [];
    foreach ($courses as $c) {
        if (!empty($c['isInternalOnly']) || !empty($c['isAdmissionCourse'])) {
            continue; // Private admission-only courses are unlisted from public catalog
        }
        $publicList[] = [
            'id' => $c['id'],
            'slug' => $c['slug'] ?? '',
            'title' => $c['title'],
            'subtitle' => $c['subtitle'] ?? '',
            'category' => $c['category'] ?? '',
            'level' => $c['level'] ?? '',
            'duration' => $c['duration'] ?? '',
            'price' => $c['price'] ?? 4999,
            'originalPrice' => $c['originalPrice'] ?? 9999,
            'thumbnail' => $c['thumbnail'] ?? '',
            'badge' => $c['badge'] ?? '',
            'modulesCount' => count($c['modules'] ?? [])
        ];
    }
    json_ok(['catalog' => $publicList]);
}

// 9.1 Apply & Validate Coupon (Public)
if ($action === 'apply-coupon' && ($method === 'GET' || $method === 'POST')) {
    $code = trim($_GET['code'] ?? ($_GET['couponCode'] ?? ''));
    $courseId = trim($_GET['courseId'] ?? '');
    $price = isset($_GET['price']) ? intval($_GET['price']) : null;

    if ($method === 'POST') {
        $body = read_json_body();
        $code = trim($body['code'] ?? ($body['couponCode'] ?? $code));
        $courseId = trim($body['courseId'] ?? $courseId);
        if (isset($body['price'])) $price = intval($body['price']);
    }

    if (!$code) json_err('Please provide a coupon code', 400);

    if ($courseId && $price === null) {
        $courses = load_courses();
        foreach ($courses as $c) {
            if ($c['id'] === $courseId) {
                $price = intval($c['price'] ?? 4999);
                break;
            }
        }
    }
    if ($price === null) $price = 4999;

    $eval = evaluate_coupon($code, $courseId, $price);
    if (!$eval['valid']) {
        json_err($eval['message'], 400);
    }

    json_ok([
        'valid' => true,
        'code' => $eval['code'],
        'type' => $eval['type'],
        'discount' => $eval['discount'],
        'discountAmount' => $eval['discountAmount'],
        'originalPrice' => $eval['originalPrice'],
        'finalPrice' => $eval['finalPrice'],
        'description' => $eval['description']
    ]);
}

// 10. Instant Course Checkout & Auto-Enrollment (Public)
if ($action === 'checkout-enroll' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);
    $name = trim($body['name'] ?? '');
    $email = trim($body['email'] ?? '');
    $courseId = trim($body['courseId'] ?? '');
    $couponCode = trim($body['couponCode'] ?? ($body['coupon'] ?? ''));
    $paymentMethod = trim($body['paymentMethod'] ?? 'UPI');

    if (strlen($phone) < 10) json_err('Valid 10-digit mobile number required', 400);
    if (!$courseId) json_err('Course selection is required', 400);
    // Free enrollment logs the user in, so the phone must belong to the caller
    if (current_student_phone_from_token() !== $phone && !phone_recently_verified($phone)) {
        json_err('Pehle apna mobile number OTP se verify karein.', 401);
    }

    $allCourses = load_courses();
    $selectedCourse = null;
    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId) {
            $selectedCourse = $c;
            break;
        }
    }
    if (!$selectedCourse) json_err('Course not found', 404);
    if (!empty($selectedCourse['isInternalOnly']) || !empty($selectedCourse['isAdmissionCourse'])) {
        json_err('This offline course is only accessible via the admission form at /admission/.', 403);
    }

    $basePrice = intval($selectedCourse['price'] ?? 4999);
    $finalAmount = $basePrice;
    $discountApplied = 0;
    $appliedCouponCode = '';

    // Evaluate coupon if provided
    if ($couponCode) {
        $eval = evaluate_coupon($couponCode, $courseId, $basePrice);
        if ($eval['valid']) {
            $discountApplied = $eval['discountAmount'];
            $finalAmount = $eval['finalPrice'];
            $appliedCouponCode = $eval['code'];

            // Increment coupon usage count
            $coupons = load_coupons();
            if (isset($eval['matchedIndex']) && isset($coupons[$eval['matchedIndex']])) {
                $coupons[$eval['matchedIndex']]['uses'] = ($coupons[$eval['matchedIndex']]['uses'] ?? 0) + 1;
                save_coupons($coupons);
            }
        }
    }

    // Disallow unverified direct enrollment for paid courses (payment must go through Razorpay)
    if ($finalAmount > 0) {
        json_err('Direct checkout is disabled for paid courses. Online payment via Razorpay is required.', 403);
    }

    // Save/Update student account
    $students = load_students();
    $targetStudent = null;
    $found = false;

    foreach ($students as &$stu) {
        if (clean_phone($stu['phone'] ?? '') === $phone) {
            if ($name) $stu['name'] = $name;
            if ($email) $stu['email'] = $email;
            if (!in_array($courseId, $stu['enrolledCourses'] ?? [])) {
                $stu['enrolledCourses'][] = $courseId;
            }
            $stu['lastActive'] = date('c');
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
            'name' => $name ?: ('Student ' . substr($phone, -4)),
            'email' => $email,
            'city' => '',
            'enrolledAt' => date('c'),
            'enrolledCourses' => [$courseId],
            'completedLessons' => [],
            'lastActive' => date('c')
        ];
        $students[] = $targetStudent;
    }
    save_students($students);

    // Record Transaction
    $txs = file_exists(LMS_TRANSACTIONS_FILE) ? json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) : [];
    if (!is_array($txs)) $txs = [];

    $newTx = [
        'id' => 'tx_' . substr(md5(uniqid(microtime(), true)), 0, 10),
        'courseId' => $courseId,
        'courseTitle' => $selectedCourse['title'],
        'amount' => $finalAmount,
        'originalPrice' => $basePrice,
        'discount' => $discountApplied,
        'couponCode' => $appliedCouponCode,
        'studentName' => $targetStudent['name'],
        'studentPhone' => $phone,
        'paymentMethod' => $paymentMethod,
        'status' => 'completed',
        'date' => date('c')
    ];
    $txs[] = $newTx;
    file_put_contents(LMS_TRANSACTIONS_FILE, json_encode($txs, JSON_PRETTY_PRINT), LOCK_EX);

    // Create student session so they are logged in immediately!
    $token = create_student_session($phone);

    json_ok([
        'message' => 'Enrollment successful! Access granted.',
        'token' => $token,
        'student' => $targetStudent,
        'course' => $selectedCourse,
        'transaction' => $newTx
    ]);
}

// 10.1 Get Public Payment Gateway Configuration
if ($action === 'get-payment-config' && $method === 'GET') {
    $settings = load_lms_settings();
    $enabled = !empty($settings['razorpayEnabled']) && !empty($settings['razorpayKeyId']) && !empty($settings['razorpayKeySecret']);
    json_ok([
        'razorpayEnabled' => $enabled,
        'razorpayKeyId' => $enabled ? ($settings['razorpayKeyId'] ?? '') : '',
        'razorpayMode' => $settings['razorpayMode'] ?? 'live',
        'currency' => 'INR',
        'academyName' => 'Quick Art Photography Academy'
    ]);
}

// 10.2 Create Razorpay Order
if ($action === 'create-razorpay-order' && $method === 'POST') {
    $body = read_json_body();
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);
    $name = trim($body['name'] ?? '');
    $email = trim($body['email'] ?? '');
    $courseId = trim($body['courseId'] ?? '');
    $couponCode = trim($body['couponCode'] ?? ($body['coupon'] ?? ''));

    if (strlen($phone) < 10) json_err('Valid 10-digit mobile number required', 400);
    if (!$courseId) json_err('Course selection is required', 400);

    $settings = load_lms_settings();
    $keyId = trim($settings['razorpayKeyId'] ?? '');
    $keySecret = trim($settings['razorpayKeySecret'] ?? '');
    $razorpayEnabled = !empty($settings['razorpayEnabled']) && !empty($keyId) && !empty($keySecret);

    if (!$razorpayEnabled) {
        json_ok(['razorpayEnabled' => false, 'message' => 'Razorpay is not active. Use direct enrollment.']);
    }

    $allCourses = load_courses();
    $selectedCourse = null;
    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId) {
            $selectedCourse = $c;
            break;
        }
    }
    if (!$selectedCourse) json_err('Course not found', 404);
    if (!empty($selectedCourse['isInternalOnly']) || !empty($selectedCourse['isAdmissionCourse'])) {
        json_err('This offline course is only accessible via the admission form at /admission/.', 403);
    }

    $basePrice = intval($selectedCourse['price'] ?? 4999);
    $finalAmount = $basePrice;
    $discountApplied = 0;
    $appliedCouponCode = '';

    if ($couponCode) {
        $eval = evaluate_coupon($couponCode, $courseId, $basePrice);
        if ($eval['valid']) {
            $discountApplied = $eval['discountAmount'];
            $finalAmount = $eval['finalPrice'];
            $appliedCouponCode = $eval['code'];
        }
    }

    $amountInPaise = intval(round($finalAmount * 100));
    $receipt = 'rcpt_' . substr(md5(uniqid($phone, true)), 0, 14);

    $payload = json_encode([
        'amount' => $amountInPaise,
        'currency' => 'INR',
        'receipt' => $receipt,
        'notes' => [
            'courseId' => $courseId,
            'courseTitle' => substr($selectedCourse['title'], 0, 40),
            'studentPhone' => $phone,
            'studentName' => substr($name ?: 'Student', 0, 40),
            'coupon' => $appliedCouponCode
        ]
    ]);

    $ch = curl_init('https://api.razorpay.com/v1/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_USERPWD, "{$keyId}:{$keySecret}");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($response, true);
    if ($httpCode >= 200 && $httpCode < 300 && !empty($resData['id'])) {
        json_ok([
            'razorpayEnabled' => true,
            'orderId' => $resData['id'],
            'amount' => $amountInPaise,
            'currency' => 'INR',
            'keyId' => $keyId,
            'courseId' => $courseId,
            'courseTitle' => $selectedCourse['title'],
            'finalPrice' => $finalAmount,
            'studentName' => $name,
            'studentPhone' => $phone,
            'studentEmail' => $email
        ]);
    } else {
        $errMsg = $resData['error']['description'] ?? "Razorpay order creation failed (HTTP {$httpCode})";
        json_err($errMsg, 400);
    }
}

// 10.3 Verify Razorpay Payment Signature & Instant Enrollment
if ($action === 'verify-razorpay-payment' && $method === 'POST') {
    $body = read_json_body();
    $orderId = trim($body['razorpay_order_id'] ?? '');
    $paymentId = trim($body['razorpay_payment_id'] ?? '');
    $signature = trim($body['razorpay_signature'] ?? '');
    $courseId = trim($body['courseId'] ?? '');
    $rawPhone = $body['phone'] ?? '';
    $phone = clean_phone($rawPhone);
    $name = trim($body['name'] ?? '');
    $email = trim($body['email'] ?? '');
    $couponCode = trim($body['couponCode'] ?? '');

    // Confirm with Razorpay; course & phone come from the paid order, never from the browser
    $rp = razorpay_confirm_payment($orderId, $paymentId, $signature);
    $orderCourse = trim((string)($rp['notes']['courseId'] ?? ''));
    $orderPhone  = clean_phone($rp['notes']['studentPhone'] ?? '');
    if (!$orderCourse || strlen($orderPhone) < 10) json_err('Payment order details incomplete. Support: +91 9939800780', 400);
    if (($courseId && $courseId !== $orderCourse) || (strlen($phone) >= 10 && $phone !== $orderPhone)) {
        json_err('Payment is order ke course/phone se match nahi karta.', 400);
    }
    $courseId = $orderCourse;
    $phone = $orderPhone;
    $couponCode = trim((string)($rp['notes']['coupon'] ?? ''));
    $alreadyRecorded = false;
    foreach ((file_exists(LMS_TRANSACTIONS_FILE) ? (json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) ?: []) : []) as $t) {
        if (($t['razorpayPaymentId'] ?? '') === $paymentId) { $alreadyRecorded = true; break; }
    }

    $allCourses = load_courses();
    $selectedCourse = null;
    foreach ($allCourses as $c) {
        if ($c['id'] === $courseId) {
            $selectedCourse = $c;
            break;
        }
    }
    if (!$selectedCourse) json_err('Course not found', 404);

    $basePrice = intval($selectedCourse['price'] ?? 4999);
    $finalAmount = $basePrice;
    $discountApplied = 0;
    $appliedCouponCode = '';

    if ($couponCode) {
        $eval = evaluate_coupon($couponCode, $courseId, $basePrice);
        if ($eval['valid']) {
            $discountApplied = $eval['discountAmount'];
            $finalAmount = $eval['finalPrice'];
            $appliedCouponCode = $eval['code'];

            $coupons = load_coupons();
            if (!$alreadyRecorded && isset($eval['matchedIndex']) && isset($coupons[$eval['matchedIndex']])) {
                $coupons[$eval['matchedIndex']]['uses'] = ($coupons[$eval['matchedIndex']]['uses'] ?? 0) + 1;
                save_coupons($coupons);
            }
        }
    }
    $finalAmount = isset($rp['payment']['amount']) ? ((int)$rp['payment']['amount']) / 100 : $finalAmount;

    // Save/Update student account
    $students = load_students();
    $targetStudent = null;
    $found = false;

    foreach ($students as &$stu) {
        if (clean_phone($stu['phone'] ?? '') === $phone) {
            if ($name) $stu['name'] = $name;
            if ($email) $stu['email'] = $email;
            if (!in_array($courseId, $stu['enrolledCourses'] ?? [])) {
                $stu['enrolledCourses'][] = $courseId;
            }
            $stu['lastActive'] = date('c');
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
            'name' => $name ?: ('Student ' . substr($phone, -4)),
            'email' => $email,
            'city' => '',
            'enrolledAt' => date('c'),
            'enrolledCourses' => [$courseId],
            'completedLessons' => [],
            'lastActive' => date('c')
        ];
        $students[] = $targetStudent;
    }
    save_students($students);

    // Record verified transaction
    $txs = file_exists(LMS_TRANSACTIONS_FILE) ? json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) : [];
    if (!is_array($txs)) $txs = [];

    $newTx = [
        'id' => 'tx_rzp_' . substr(md5($paymentId), 0, 10),
        'courseId' => $courseId,
        'courseTitle' => $selectedCourse['title'],
        'amount' => $finalAmount,
        'originalPrice' => $basePrice,
        'discount' => $discountApplied,
        'couponCode' => $appliedCouponCode,
        'studentName' => $targetStudent['name'],
        'studentPhone' => $phone,
        'paymentMethod' => 'Razorpay (Online)',
        'razorpayOrderId' => $orderId,
        'razorpayPaymentId' => $paymentId,
        'status' => 'completed',
        'date' => date('c')
    ];
    if (!$alreadyRecorded) $txs[] = $newTx;
    file_put_contents(LMS_TRANSACTIONS_FILE, json_encode($txs, JSON_PRETTY_PRINT), LOCK_EX);

    // Create session token for immediate classroom access
    $token = create_student_session($phone);

    json_ok([
        'verified' => true,
        'message' => 'Payment verified! Course unlocked successfully.',
        'token' => $token,
        'student' => $targetStudent,
        'course' => $selectedCourse,
        'transaction' => $newTx
    ]);
}

// 10.9 Public Student Admission & ID Card Verification
if ($action === 'verify-student-admission' && ($method === 'GET' || $method === 'POST')) {
    $searchId = trim($_GET['id'] ?? ($_POST['id'] ?? ''));
    $phone = clean_phone($_GET['phone'] ?? ($_POST['phone'] ?? ''));

    $admFile = DATA_DIR . '/offline-admissions.json';
    $allAdms = file_exists($admFile) ? json_decode(file_get_contents($admFile), true) ?: [] : [];
    $foundAdm = null;

    // Exact ID match only — looking up by phone let anyone get a stranger's name & photo
    if (!$searchId) json_err('Admission credential record not found', 404);
    foreach ($allAdms as $a) {
        if (($a['id'] ?? '') === $searchId || ($a['offlineAdmissionId'] ?? '') === $searchId) {
            $foundAdm = $a;
            break;
        }
    }

    if (!$foundAdm) {
        $students = load_students();
        foreach ($students as $s) {
            if (($s['offlineAdmissionId'] ?? '') === $searchId || ($s['enrollmentNo'] ?? '') === $searchId) {
                $foundAdm = $s;
                break;
            }
        }
    }

    if (!$foundAdm) {
        json_err('Admission credential record not found', 404);
    }

    $photo = $foundAdm['photoUrl'] ?? ($foundAdm['avatar'] ?? ($foundAdm['avatarUrl'] ?? ''));
    if ($photo && !preg_match('#^(https?://|data:|/)#', $photo)) {
        $photo = '/' . $photo;
    }
    $name = $foundAdm['fullName'] ?? ($foundAdm['name'] ?? 'Student');
    $course = $foundAdm['courseTitle'] ?? ($foundAdm['courseName'] ?? ($foundAdm['appliedCourse'] ?? ''));

    // If course title is empty or generic, resolve from enrolledCourses
    if (empty($course) || $course === 'Professional Photography Course') {
        if (!empty($foundAdm['enrolledCourses']) && is_array($foundAdm['enrolledCourses'])) {
            $cId = $foundAdm['enrolledCourses'][0] ?? '';
            $courseMap = [
                'course-8497f1e9'          => 'Advanced Wedding Filmmaking – Batch 114',
                'course-cinematic-wedding'  => 'Wedding Film-making Course',
                'course-premiere-pro'      => 'Advance Video Editing Course',
                'course-edius-pro'         => 'EDIUS Pro Fast Wedding Editing',
                'course-davinci-resolve'   => 'DaVinci Resolve Color Grading & Studio Finishing',
                'course-album-design'      => 'Album Design Course',
                'course-pre-wedding'       => 'Pre-Wedding Shoot & Filmmaking Masterclass',
                'course-digital-marketing' => 'Complete Studio Filmmaking & Marketing Course',
                'course-automation'        => 'Studio Automation & AI CRM Masterclass',
                'course-website-design'    => 'Website Design Course',
                'course-offline-masterclass' => 'Offline 14-Week Master Class'
            ];
            if (!empty($courseMap[$cId])) {
                $course = $courseMap[$cId];
            } else {
                $cFile = DATA_DIR . '/courses.json';
                if (file_exists($cFile)) {
                    $allCourses = json_decode(file_get_contents($cFile), true) ?: [];
                    foreach ($allCourses as $c) {
                        if (($c['id'] ?? '') === $cId) {
                            $course = $c['title'] ?? $course;
                            break;
                        }
                    }
                }
            }
        }
    }
    if (empty($course)) {
        $course = 'Professional Photography Course';
    }

    $id = $foundAdm['id'] ?? ($foundAdm['offlineAdmissionId'] ?? ($foundAdm['enrollmentNo'] ?? 'QAA-2026'));
    $studio = $foundAdm['studioName'] ?? 'Independent';
    $city = $foundAdm['city'] ?? ($foundAdm['workCity'] ?? 'Bihar');
    $blood = $foundAdm['bloodGroup'] ?? 'B+';

    json_ok([
        'id'            => $id,
        'name'          => $name,
        'course'        => $course,
        'studio'        => $studio,
        'city'          => $city,
        'blood'         => $blood,
        'photoUrl'      => $photo,
        'status'        => $foundAdm['status'] ?? 'active',
        'isOnlineBatch' => !empty($foundAdm['isOnlineBatch']) || strpos($id, '-ON-') !== false
    ]);
}


// 11. Certificate Verification (Public)
if ($action === 'verify-certificate' && $method === 'GET') {
    $certId = trim($_GET['id'] ?? '');
    if (!$certId) json_err('Certificate ID required', 400);

    $students = load_students();
    $found = false;
    $certData = null;

    // Course code map for fast accurate resolution
    $codeMap = [
        'PR' => 'course-premiere-pro',
        'ED' => 'course-edius-pro',
        'DR' => 'course-davinci-resolve',
        'DV' => 'course-davinci-resolve',
        'CE' => 'course-cinematic-editing',
        'CW' => 'course-cinematic-wedding',
        'AD' => 'course-album-design',
        'AL' => 'course-album-design',
        'PW' => 'course-pre-wedding',
        'MC' => 'course-cinematic-wedding',
        'WD' => 'course-website-design',
        'DM' => 'course-digital-marketing',
        'AU' => 'course-automation'
    ];

    $matchedCourseId = null;
    $upperCert = strtoupper($certId);

    // Public demo ID used on landing pages — clearly labelled as a sample.
    if ($upperCert === 'QAA-2026-PR-7431') {
        json_ok(['certificate' => [
            'valid' => true,
            'isSample' => true,
            'studentName' => 'Anil Ku Sharma (Verified Sample)',
            'courseTitle' => 'Adobe Premiere Pro Masterclass',
            'issuedDate' => '01 January 2026',
            'issuedBy' => 'Quick Art Photography Academy',
            'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
            'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
            'grade' => 'Distinction (Grade A+)',
            'status' => 'SAMPLE CERTIFICATE',
            'certificateId' => 'QAA-2026-PR-7431'
        ]]);
    }

    // 0) Certificates issued from the Admin panel
    $issuedFile = DATA_DIR . '/issued-certificates.json';
    foreach ((file_exists($issuedFile) ? (json_decode(file_get_contents($issuedFile), true) ?: []) : []) as $ic) {
        if (strtoupper($ic['id'] ?? '') !== $upperCert) continue;
        $nm = $ic['name'] ?? 'Verified Student';
        foreach ($students as $s) {
            if (clean_phone($s['phone'] ?? '') === ($ic['phone'] ?? '') && !empty($s['name'])) { $nm = $s['name']; break; }
        }
        json_ok(['certificate' => [
            'valid' => true,
            'studentName' => $nm,
            'studentPhoneMasked' => substr($ic['phone'] ?? '', 0, 2) . '******' . substr($ic['phone'] ?? '', -2),
            'enrollmentNo' => $ic['enrollmentNo'] ?? '',
            'courseId' => $ic['courseId'] ?? '',
            'courseTitle' => $ic['courseTitle'] ?? '',
            'issuedDate' => !empty($ic['issuedDate']) ? date('d F Y', strtotime($ic['issuedDate'])) : '',
            'issuedBy' => 'Quick Art Photography Academy',
            'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
            'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
            'status' => 'AUTHENTIC & VERIFIED',
            'certificateId' => $ic['id'],
            'verificationUrl' => 'https://quickartphotography.in/portal/index.html?verify=' . urlencode($ic['id'])
        ]]);
    }

    // 1) Certificates actually issued by the LMS (exact ID match)
    foreach ($students as $s) {
        $issued = [];
        foreach (($s['certificates'] ?? []) as $cid => $c) {
            if (is_array($c) && !empty($c['id'])) $issued[] = ['id' => $c['id'], 'courseId' => $cid, 'date' => $c['issuedDate'] ?? '', 'title' => $c['courseTitle'] ?? ''];
        }
        if (!empty($s['certId'])) $issued[] = ['id' => $s['certId'], 'courseId' => '', 'date' => $s['certDate'] ?? '', 'title' => $s['appliedCourse'] ?? 'Professional Diploma Program'];
        foreach ($issued as $ic) {
            if (strtoupper($ic['id']) === $upperCert) {
                $title = $ic['title'];
                if ($ic['courseId']) { $cc = cert_find_course($ic['courseId']); if ($cc) $title = $cc['title']; }
                json_ok(['certificate' => [
                    'valid' => true,
                    'studentName' => $s['name'] ?: 'Verified Student',
                    'studentPhoneMasked' => substr($s['phone'] ?? '', 0, 2) . '******' . substr($s['phone'] ?? '', -2),
                    'enrollmentNo' => $s['offlineAdmissionId'] ?? ($s['enrollmentNo'] ?? ''),
                    'courseId' => $ic['courseId'],
                    'courseTitle' => $title,
                    'issuedDate' => $ic['date'] ? date('d F Y', strtotime($ic['date'])) : '',
                    'issuedBy' => 'Quick Art Photography Academy',
                    'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
                    'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
                    'status' => 'AUTHENTIC & VERIFIED',
                    'certificateId' => $ic['id'],
                    'verificationUrl' => 'https://quickartphotography.in/portal/index.html?verify=' . urlencode($ic['id'])
                ]]);
            }
        }
    }
    // 2) Legacy portal certificates (IDs built in the browser before IDs were stored):
    //    QAA-2026-<COURSE CODE>-<enrollment suffix | phone last 4>.
    //    Must match that exact format AND the student must really have completed
    //    the course (all lessons + quiz). A bare phone/enrollment suffix no longer verifies.
    $legacyCode = function ($courseId) {
        $id = strtolower((string)$courseId);
        if (strpos($id, 'pre-wedding') !== false) return 'PW';
        if (strpos($id, 'album') !== false) return 'AD';
        if (strpos($id, 'premiere') !== false) return 'PR';
        if (strpos($id, 'edius') !== false) return 'ED';
        if (strpos($id, 'davinci') !== false || strpos($id, 'resolve') !== false) return 'DR';
        if (strpos($id, 'cinematic') !== false || strpos($id, 'wedding') !== false) return 'CE';
        if (strpos($id, 'website') !== false || strpos($id, 'web') !== false) return 'WD';
        if (strpos($id, 'marketing') !== false || strpos($id, 'digital') !== false) return 'DM';
        if (strpos($id, 'auto') !== false) return 'AU';
        return 'GEN';
    };
    if (!$found && preg_match('/^QAA-2026-[A-Z]+-[A-Z0-9]+$/', $upperCert)) {
        foreach ($students as $s) {
            $enroll = $s['offlineAdmissionId'] ?? ($s['enrollmentNo'] ?? '');
            $suffixes = [];
            if ($enroll) { $parts = explode('-', $enroll); $suffixes[] = strtoupper(end($parts)); }
            $phoneSuffix = substr(clean_phone($s['phone'] ?? ''), -4);
            if (strlen($phoneSuffix) === 4) $suffixes[] = $phoneSuffix;
            if (!$suffixes) continue;

            foreach (($s['enrolledCourses'] ?? []) as $cid) {
                $course = cert_find_course($cid);
                if (!$course || !cert_eligibility($s, $course)['eligible']) continue;
                foreach ($suffixes as $suf) {
                    if ($upperCert !== 'QAA-2026-' . $legacyCode($cid) . '-' . $suf) continue;
                    $found = true;
                    $certData = [
                        'valid' => true,
                        'studentName' => $s['name'] ?: 'Verified Student',
                        'studentPhoneMasked' => substr($s['phone'] ?? '', 0, 2) . '******' . substr($s['phone'] ?? '', -2),
                        'enrollmentNo' => $enroll ?: ('QAA-' . date('Y') . '-' . $phoneSuffix),
                        'courseId' => $course['id'],
                        'courseTitle' => $course['title'],
                        'courseSubtitle' => $course['subtitle'] ?? 'Professional Certification Program',
                        'category' => $course['category'] ?? 'Filmmaking & Photography',
                        'issuedDate' => date('d F Y'),
                        'issuedBy' => 'Quick Art Photography Academy',
                        'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
                        'centerCode' => 'PAT/QAA-800001',
                        'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
                        'grade' => 'Distinction (Grade A+)',
                        'status' => 'AUTHENTIC & VERIFIED',
                        'certificateId' => $certId,
                        'verificationUrl' => 'https://quickartphotography.in/portal/index.html?verify=' . urlencode($certId)
                    ];
                    break 3;
                }
            }
        }
    }

    // 3) Offline / batch certificates printed with the admission number as the certificate
    //    number (e.g. QAA-OFF-2026-B6D2C). Valid only for an exact match of an
    //    Admin-approved admission — pending applications never verify.
    if (!$found) {
        $admFile = DATA_DIR . '/offline-admissions.json';
        $allAdms = file_exists($admFile) ? (json_decode(file_get_contents($admFile), true) ?: []) : [];
        foreach ($allAdms as $a) {
            if (strtoupper($a['id'] ?? '') !== $upperCert) continue;
            $aStatus = $a['status'] ?? '';
            $admApproved = !empty($a['isApproved']) || in_array($aStatus, ['approved', 'active', 'approved_alumni'], true);
            $stuRec = null;
            foreach ($students as $s) {
                if (clean_phone($s['phone'] ?? '') === clean_phone($a['phone'] ?? '')) { $stuRec = $s; break; }
            }
            if ($stuRec && !empty($stuRec['isApproved']) && in_array($stuRec['status'] ?? '', ['active', 'approved'], true)) {
                $admApproved = true;
            }
            if (!$admApproved || $aStatus === 'pending_approval') break;

            $found = true;
            $certData = [
                'valid' => true,
                'studentName' => trim($a['fullName'] ?? '') ?: (($stuRec['name'] ?? '') ?: 'Verified Student'),
                'studentPhoneMasked' => substr(clean_phone($a['phone'] ?? ''), 0, 2) . '******' . substr(clean_phone($a['phone'] ?? ''), -2),
                'enrollmentNo' => $a['id'],
                'courseId' => map_offline_course_id($a['courseTitle'] ?? ''),
                'courseTitle' => ($a['courseTitle'] ?? '') ?: 'Professional Diploma Program',
                'issuedDate' => !empty($a['createdAt']) ? date('d F Y', strtotime($a['createdAt'])) : '',
                'issuedBy' => 'Quick Art Photography Academy',
                'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
                'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
                'status' => 'AUTHENTIC & VERIFIED',
                'certificateId' => $a['id'],
                'verificationUrl' => 'https://quickartphotography.in/portal/index.html?verify=' . urlencode($a['id'])
            ];
            break;
        }
    }

    // Former fallback validated ANY id containing a course code (e.g. "-PR-") using
    // an unrelated student's name. Disabled: only real certificates verify now.
    if (false && !$found && $matchedCourseId) {
        $courses = load_courses();
        $targetCourse = null;
        foreach ($courses as $c) {
            if ($c['id'] === $matchedCourseId) {
                $targetCourse = $c;
                break;
            }
        }
        if ($targetCourse) {
            $found = true;
            $certData = [
                'valid' => true,
                'studentName' => !empty($students[0]['name']) ? $students[0]['name'] : 'Anil Sharma (Mentor Demo)',
                'studentPhoneMasked' => '99******80',
                'courseId' => $targetCourse['id'],
                'courseTitle' => $targetCourse['title'],
                'courseSubtitle' => $targetCourse['subtitle'] ?? 'Professional Certification Program',
                'category' => $targetCourse['category'] ?? 'Filmmaking & Photography',
                'issuedDate' => date('d F Y'),
                'issuedBy' => 'Quick Art Photography Academy',
                'accreditation' => 'ISO 9001:2015 Certified Educational Institution | Govt. of India MSME Regd. (UDYAM-BR-35-0027860)',
                'centerCode' => 'PAT/QAA-800001',
                'mentor' => 'Anil Sharma (Founder & Lead Instructor)',
                'grade' => 'Distinction (Grade A+)',
                'status' => 'AUTHENTIC & VERIFIED',
                'certificateId' => $certId,
                'verificationUrl' => 'https://quickartphotography.in/portal/index.html?verify=' . urlencode($certId)
            ];
        }
    }

    if ($found) {
        if (strpos($upperCert, '7431') !== false || $upperCert === 'QAA-2026-PR-7431') {
            $certData['studentName'] = 'Anil Ku Sharma (Verified Sample)';
            $certData['grade'] = 'Distinction (Grade A+)';
            $certData['courseTitle'] = 'Adobe Premiere Pro Masterclass';
        }
        json_ok(['certificate' => $certData]);
    } else {
        json_ok(['certificate' => ['valid' => false, 'message' => 'Certificate ID not found or pending verification. Please check the serial code.']]);
    }
}

// Update student profile (name, email, city, avatar/photo)
if ($action === 'update-profile' && $method === 'POST') {
    $stu  = require_student();
    $body = read_json_body() ?: $_POST;

    $name  = trim($body['name']  ?? ($stu['name'] ?? ''));
    $email = strtolower(trim($body['email'] ?? ($stu['email'] ?? '')));
    $city  = trim($body['city']  ?? ($stu['city'] ?? ''));
    $rawPhoto = $body['avatar'] ?? ($body['photo'] ?? ($_FILES['avatar'] ?? ($_FILES['photo'] ?? null)));

    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_err('Valid email address darj karein', 400);
    }
    if ($email && $email !== strtolower(trim($stu['email'] ?? ''))) {
        foreach (load_students() as $other) {
            if (clean_phone($other['phone'] ?? '') !== clean_phone($stu['phone'] ?? '') && strtolower(trim($other['email'] ?? '')) === $email) {
                json_err('Ye email kisi doosre account se juda hua hai.', 409);
            }
        }
    }
    $name = mb_substr(strip_tags($name), 0, 80);
    $city = mb_substr(strip_tags($city), 0, 80);

    $photoUrl = '';
    if ($rawPhoto) {
        $photoUrl = save_student_avatar_image($rawPhoto, $stu['phone']);
    }

    $students = load_students();
    $updated  = false;
    foreach ($students as &$s) {
        if (clean_phone($s['phone'] ?? '') === clean_phone($stu['phone'])) {
            if ($name)  $s['name']  = $name;
            if ($email) $s['email'] = $email;
            if ($city)  $s['city']  = $city;
            if ($photoUrl) {
                $s['avatar']    = $photoUrl;
                $s['avatarUrl'] = $photoUrl;
                $s['photoUrl']  = $photoUrl;
            }
            $updated = true;
            break;
        }
    }
    unset($s);

    if ($updated) save_students($students);

    // Also update offline-admissions.json if an admission record exists for this phone
    if ($photoUrl) {
        $admFile = DATA_DIR . '/offline-admissions.json';
        if (file_exists($admFile)) {
            $adms = json_decode(file_get_contents($admFile), true) ?: [];
            $admUpdated = false;
            foreach ($adms as &$a) {
                if (clean_phone($a['phone'] ?? '') === clean_phone($stu['phone'])) {
                    $a['photoUrl'] = $photoUrl;
                    if ($name) $a['fullName'] = $name;
                    $admUpdated = true;
                    break;
                }
            }
            unset($a);
            if ($admUpdated) {
                file_put_contents($admFile, json_encode($adms, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
        }
    }

    json_ok([
        'updated'  => $updated,
        'photoUrl' => $photoUrl ?: ($stu['photoUrl'] ?? ($stu['avatar'] ?? '')),
        'avatar'   => $photoUrl ?: ($stu['avatar'] ?? '')
    ]);
}


// Change password
if ($action === 'change-password' && $method === 'POST') {
    $stu  = require_student();
    $body = read_json_body();
    $pw   = trim($body['password'] ?? '');
    if (strlen($pw) < 6) json_err('Password min. 6 characters ka hona chahiye', 400);

    $students = load_students();
    foreach ($students as &$s) {
        if ($s['phone'] === $stu['phone']) {
            $s['passwordHash'] = password_hash($pw, PASSWORD_DEFAULT);
            break;
        }
    }
    unset($s);
    save_students($students);
    json_ok(['updated' => true]);
}

// =======================================================
// 21. Live Classes & Masterclasses (Student & Public)
// =======================================================

// 21.1 List Live Classes (for Portal & Public Landing)
if ($action === 'get-live-classes' && $method === 'GET') {
    $stu = null;
    $token = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? ($_GET['token'] ?? '');
    if (!$token) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) {
            $token = trim($m[1]);
        }
    }
    if ($token && file_exists(LMS_SESSIONS_FILE)) {
        $sessions = load_student_sessions();
        $sess = $sessions[$token] ?? null;
        if ($sess && ($sess['expiresAt'] ?? 0) > time()) {
            $sessIdent = strtolower(trim((string)($sess['phone'] ?? '')));
            $students = load_students();
            foreach ($students as $s) {
                $sPhone = strtolower(trim((string)($s['phone'] ?? '')));
                $sEmail = strtolower(trim((string)($s['email'] ?? '')));
                if (($sPhone && $sPhone === $sessIdent) || ($sEmail && $sEmail === $sessIdent)) {
                    $stu = $s;
                    break;
                }
            }
        }
    }

    $allClasses = get_all_live_classes();
    $enrolledList = $stu['enrolledCourses'] ?? [];

    $results = [];
    foreach ($allClasses as $c) {
        $isAuth = false;
        $cType = $c['type'] ?? 'workshop';
        $courseRef = $c['courseId'] ?? '';

        if ($stu) {
            $stuPhone = clean_phone($stu['phone'] ?? '');

            if ($stuPhone === '9939800780') {
                $isAuth = true;
            } elseif ($cType === 'course') {
                // Course Specific Batch:
                // Strictly restricted to students enrolled in this course batch or all-access.
                // Workshop students (₹21 tickets) ARE NEVER AUTHORIZED!
                $isBatchClass = (bool)preg_match('/batch\s*[-_]?\s*\d+/i', ($c['title'] ?? '') . ' ' . ($c['id'] ?? ''));
                $hasRealCourse = false;
                foreach ($enrolledList as $eid) {
                    if (str_starts_with($eid, 'course-')) {
                        $hasRealCourse = true;
                        break;
                    }
                }

                $effCourseRef = $courseRef;
                if ($isBatchClass && (empty($effCourseRef) || $effCourseRef === 'all')) {
                    $effCourseRef = map_offline_course_id($c['title'] ?? '');
                }

                if (in_array('all-access', $enrolledList)) {
                    $isAuth = true;
                } elseif (in_array($c['id'], $enrolledList)) {
                    $isAuth = true;
                } elseif (!empty($effCourseRef) && $effCourseRef !== 'all' && in_array($effCourseRef, $enrolledList)) {
                    $isAuth = true;
                } elseif ($effCourseRef === 'all' && !$isBatchClass && $hasRealCourse) {
                    $isAuth = true;
                }
            } else {
                // Workshop (e.g. ₹21 masterclass) - strictly for this workshop or all-access
                if (in_array($c['id'], $enrolledList) || in_array('all-access', $enrolledList)) {
                    $isAuth = true;
                }
            }

            if (!$isAuth && !empty($stuPhone)) {
                $txList = file_exists(LMS_TRANSACTIONS_FILE) ? (json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) ?: []) : [];
                foreach ($txList as $tx) {
                    if (clean_phone($tx['studentPhone'] ?? '') === $stuPhone && in_array(strtoupper($tx['status'] ?? ''), ['SUCCESS', 'COMPLETED', 'PAID'])) {
                        if (($tx['liveId'] ?? '') === $c['id']) {
                            $isAuth = true;
                            break;
                        } elseif ($cType === 'workshop' && !empty($tx['liveId'])) {
                            $isAuth = true;
                            break;
                        }
                    }
                }
            }
        }

        // If student is logged in and not enrolled/authorized for this live class or workshop,
        // hide it completely so students ONLY see their enrolled live classes & webinars!
        if ($stu && !$isAuth) {
            continue;
        }

        $safeItem = [
            'id'            => $c['id'],
            'title'         => $c['title'],
            'description'   => $c['description'] ?? '',
            'type'          => $c['type'] ?? 'workshop',
            'courseId'      => $c['courseId'] ?? '',
            'ticketPrice'   => (int)($c['ticketPrice'] ?? 0),
            'originalPrice' => (int)($c['originalPrice'] ?? 0),
            'scheduledAt'   => $c['scheduledAt'] ?? '',
            'duration'      => $c['duration'] ?? '90 Mins',
            'status'        => $c['status'] ?? 'scheduled',
            'chatEnabled'   => !empty($c['chatEnabled']),
            'isAuthorized'  => $isAuth
        ];

        // Only reveal stream credentials, resources & replay url if authorized
        if ($isAuth) {
            $safeItem['streamType'] = $c['streamType'] ?? (!empty($c['bunnyVideoId']) ? 'bunny' : 'cloudflare');
            if (!empty($c['streamId'])) {
                $safeItem['streamId'] = $c['streamId'];
            }
            $safeItem['cloudflareVideoId'] = $c['cloudflareVideoId'] ?? '';
            $safeItem['bunnyVideoId'] = $c['bunnyVideoId'] ?? '';
            $safeItem['meetUrl'] = $c['meetUrl'] ?? '';
            $safeItem['zoomUrl'] = $c['zoomUrl'] ?? '';
            $safeItem['zoomMeetingId'] = $c['zoomMeetingId'] ?? '';
            $safeItem['zoomPasscode'] = $c['zoomPasscode'] ?? '';
            $safeItem['zoomEmbedMode'] = ($c['zoomEmbedMode'] ?? true) !== false;
            $safeItem['resources'] = $c['resources'] ?? [];
            if ($c['status'] === 'completed' && !empty($c['replayUrl'])) {
                $safeItem['replayUrl'] = $c['replayUrl'];
            }
        }

        $results[] = $safeItem;
    }

    json_ok([
        'liveClasses' => $results,
        'hasLiveNow'  => count(array_filter($results, function($item) { return $item['status'] === 'live'; })) > 0
    ]);
}

// 21.2 Enter Live Session (Student Access Verification + Anti-Leak Stream Credentials)
if ($action === 'get-live-session' && ($method === 'GET' || $method === 'POST')) {
    $stu = require_student();
    $liveId = trim($_GET['liveId'] ?? ($_GET['id'] ?? ($_POST['liveId'] ?? ($_POST['id'] ?? ''))));
    if (!$liveId) json_err('Live Class ID required', 400);

    $allClasses = get_all_live_classes();
    $target = null;
    foreach ($allClasses as $c) {
        if ($c['id'] === $liveId) {
            $target = $c;
            break;
        }
    }

    // Fallback if target not found by exact ID
    if (!$target && ($liveId === 'masterclass-live' || $liveId === 'live_demo_01' || $liveId === 'default' || str_starts_with($liveId, 'live_'))) {
        foreach ($allClasses as $c) {
            if (($c['type'] ?? '') === 'workshop') {
                $target = $c;
                break;
            }
        }
        if (!$target && !empty($allClasses) && ($allClasses[0]['type'] ?? '') === 'workshop') {
            $target = $allClasses[0];
        }
    }

    if (!$target) json_err('Live class session not found', 404);

    // Check authorization
    $enrolledList = $stu['enrolledCourses'] ?? [];
    $isAuth = false;
    $stuPhone = clean_phone($stu['phone'] ?? '');
    $targetType = $target['type'] ?? 'workshop';
    $targetCourseId = $target['courseId'] ?? '';

    if ($stuPhone === '9939800780') {
        $isAuth = true;
    } elseif ($targetType === 'course') {
        // STRICT COURSE BATCH AUTHORIZATION:
        // Must be an admin-approved student and enrolled in this course batch or have all-access.
        $isApprovedStu = !empty($stu['isApproved']) && in_array($stu['status'] ?? '', ['active', 'approved']);
        if (!$isApprovedStu) {
            json_err('Aapka Batch Admission Form review me hai. Admin approval ke baad Live Batch class unlock hogi.', 403);
        }

        $isBatchClass = (bool)preg_match('/batch\s*[-_]?\s*\d+/i', ($target['title'] ?? '') . ' ' . ($target['id'] ?? ''));
        $hasRealCourse = false;
        foreach ($enrolledList as $eid) {
            if (str_starts_with($eid, 'course-')) {
                $hasRealCourse = true;
                break;
            }
        }

        $effTargetCourseId = $targetCourseId;
        if ($isBatchClass && (empty($effTargetCourseId) || $effTargetCourseId === 'all')) {
            $effTargetCourseId = map_offline_course_id($target['title'] ?? '');
        }

        if (in_array('all-access', $enrolledList)) {
            $isAuth = true;
        } elseif (in_array($target['id'], $enrolledList)) {
            $isAuth = true;
        } elseif (!empty($effTargetCourseId) && $effTargetCourseId !== 'all' && in_array($effTargetCourseId, $enrolledList)) {
            $isAuth = true;
        } elseif ($effTargetCourseId === 'all' && !$isBatchClass && $hasRealCourse) {
            $isAuth = true;
        }
    } else {
        // Workshop (e.g. ₹21 masterclass)
        if (in_array($target['id'], $enrolledList) || in_array('all-access', $enrolledList)) {
            $isAuth = true;
        }
    }

    // Reconcile with completed transactions if not yet authorized
    if (!$isAuth && !empty($stuPhone)) {
        $txList = file_exists(LMS_TRANSACTIONS_FILE) ? (json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) ?: []) : [];
        foreach ($txList as $tx) {
            if (clean_phone($tx['studentPhone'] ?? '') === $stuPhone && in_array(strtoupper($tx['status'] ?? ''), ['SUCCESS', 'COMPLETED', 'PAID'])) {
                if (($tx['liveId'] ?? '') === $target['id']) {
                    $isAuth = true;
                    // Auto-sync into student enrolledCourses
                    if (!in_array($target['id'], $enrolledList)) {
                        $enrolledList[] = $target['id'];
                        $allStudents = load_students();
                        foreach ($allStudents as &$s) {
                            if (clean_phone($s['phone'] ?? '') === $stuPhone) {
                                if (!in_array($target['id'], $s['enrolledCourses'] ?? [])) {
                                    $s['enrolledCourses'][] = $target['id'];
                                }
                                break;
                            }
                        }
                        unset($s);
                        save_students($allStudents);
                    }
                    break;
                } elseif ($targetType === 'workshop' && !empty($tx['liveId'])) {
                    $isAuth = true;
                    // Auto-sync for workshop only
                    if (!in_array($target['id'], $enrolledList)) {
                        $enrolledList[] = $target['id'];
                        $allStudents = load_students();
                        foreach ($allStudents as &$s) {
                            if (clean_phone($s['phone'] ?? '') === $stuPhone) {
                                if (!in_array($target['id'], $s['enrolledCourses'] ?? [])) {
                                    $s['enrolledCourses'][] = $target['id'];
                                }
                                break;
                            }
                        }
                        unset($s);
                        save_students($allStudents);
                    }
                    break;
                }
            }
        }
    }

    if (!$isAuth) {
        if ($targetType === 'course') {
            json_err('Aap is Live Session ke liye enrolled nahi hain. Yeh live class sirf specific batch ke enrolled students ke liye hai.', 403);
        } else {
            json_err('Aap is Live Session ke liye enrolled nahi hain. Kripya workshop pass unlock karein.', 403);
        }
    }

    // Dynamic Anti-Piracy Watermark String
    $cleanName = !empty($stu['name']) ? $stu['name'] : 'Student';
    $watermarkText = "{$cleanName} | +91-{$stu['phone']} | " . ($stu['id'] ?? 'QA-STU');

    $bunnyVid = trim($target['bunnyVideoId'] ?? '');
    $finalReplayUrl = trim($target['replayUrl'] ?? '');
    if ($bunnyVid) {
        $lmsSettings = load_lms_settings();
        $libId = $lmsSettings['bunnyLibraryId'] ?? '755385';
        $tokenKey = $lmsSettings['bunnyTokenAuthKey'] ?? '';
        $finalReplayUrl = generate_bunny_video_url($libId, $bunnyVid, $tokenKey);
    }

    $showViewers = !isset($target['showViewerCountToStudents']) || !empty($target['showViewerCountToStudents']);
    $viewerCount = null;
    if ($showViewers) {
        $attendanceFile = DATA_DIR . '/live-viewers-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $target['id']) . '.json';
        if (file_exists($attendanceFile)) {
            $attData = json_decode(file_get_contents($attendanceFile), true) ?: [];
            $now = time();
            $cnt = 0;
            foreach ($attData['viewers'] ?? [] as $v) {
                if (($now - ($v['lastSeen'] ?? 0)) <= 35) $cnt++;
            }
            $viewerCount = max(1, $cnt);
        } else {
            $viewerCount = 1;
        }
    }

    json_ok([
        'id'                        => $target['id'],
        'title'                     => $target['title'],
        'description'               => $target['description'] ?? '',
        'type'                      => $target['type'] ?? 'workshop',
        'status'                    => $target['status'] ?? 'scheduled',
        'scheduledAt'               => $target['scheduledAt'] ?? '',
        'duration'                  => $target['duration'] ?? '90 Mins',
        'streamType'                => $target['streamType'] ?? (!empty($bunnyVid) ? 'bunny' : 'cloudflare'),
        'streamId'                  => $target['streamId'] ?? '',
        'replayUrl'                 => $finalReplayUrl,
        'bunnyVideoId'              => $bunnyVid,
        'cloudflareVideoId'         => $target['cloudflareVideoId'] ?? '',
        'meetUrl'                   => $target['meetUrl'] ?? '',
        'zoomUrl'                   => $target['zoomUrl'] ?? '',
        'zoomMeetingId'             => $target['zoomMeetingId'] ?? '',
        'zoomPasscode'              => $target['zoomPasscode'] ?? '',
        'zoomEmbedMode'             => ($target['zoomEmbedMode'] ?? true) !== false,
        'showViewerCountToStudents' => $showViewers,
        'viewerCount'               => $viewerCount,
        'allowStudentMic'           => !empty($target['allowStudentMic']),
        'allowStudentScreen'        => !empty($target['allowStudentScreen']),
        'chatEnabled'               => !empty($target['chatEnabled']),
        'resources'                 => $target['resources'] ?? [],
        'watermark'                 => $watermarkText,
        'student'                   => [
            'id'    => $stu['id'] ?? '',
            'name'  => $stu['name'] ?? '',
            'phone' => $stu['phone'] ?? ''
        ]
    ]);
}

// 21.3 Fetch Live Doubts / Chat Messages
if ($action === 'fetch-live-doubts' && ($method === 'GET' || $method === 'POST')) {
    $liveId = trim($_GET['liveId'] ?? ($_POST['liveId'] ?? ''));
    if (!$liveId) json_err('Live ID required', 400);

    $chats = get_all_live_chats();
    $messages = $chats[$liveId] ?? [];
    json_ok(['messages' => $messages]);
}

// 21.4 Send Live Doubt / Question (Student)
if ($action === 'send-live-doubt' && $method === 'POST') {
    $stu = require_student();
    $body = read_json_body() ?: [];
    $liveId = trim($body['liveId'] ?? ($_POST['liveId'] ?? ''));
    $msg = trim($body['message'] ?? ($_POST['message'] ?? ($_POST['question'] ?? '')));
    if (!$liveId || !$msg) json_err('Live ID aur question message required hai', 400);

    if (strlen($msg) > 300) {
        json_err('Sawal maximum 300 characters ka hona chahiye', 400);
    }

    $chats = get_all_live_chats();
    if (!isset($chats[$liveId])) $chats[$liveId] = [];

    $newMsg = [
        'id'          => 'msg_' . substr(md5(uniqid(microtime(), true)), 0, 8),
        'studentId'   => $stu['id'] ?? '',
        'studentName' => $stu['name'] ?? 'Student',
        'message'     => htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'),
        'isMentor'    => false,
        'timestamp'   => date('c')
    ];

    $chats[$liveId][] = $newMsg;
    // Keep max 200 messages in chat
    if (count($chats[$liveId]) > 200) {
        $chats[$liveId] = array_slice($chats[$liveId], -200);
    }
    save_all_live_chats($chats);
    json_ok(['sent' => true, 'message' => $newMsg]);
}

// 21.41 Student Live Attendance Heartbeat & Interactivity Ping
if ($action === 'live-ping' && ($method === 'POST' || $method === 'GET')) {
    $body = read_json_body() ?: $_POST;
    if (empty($body)) {
        $raw = file_get_contents('php://input');
        if ($raw) {
            $dec = json_decode($raw, true);
            if (is_array($dec)) $body = $dec;
            elseif (is_string($dec)) {
                $dec2 = json_decode($dec, true);
                if (is_array($dec2)) $body = $dec2;
            }
        }
    }
    $sessionId = trim($body['sessionId'] ?? ($_POST['sessionId'] ?? ($_GET['sessionId'] ?? '')));
    if (!$sessionId) {
        // Auto-detect currently live session
        foreach (get_all_live_classes() as $c) {
            if (($c['status'] ?? '') === 'live') {
                $sessionId = $c['id'];
                break;
            }
        }
    }
    if (!$sessionId) json_err('Session ID required', 400);

    // Identify student (authenticated or guest fallback)
    $token = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? ($_GET['token'] ?? '');
    if (!$token) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) $token = trim($m[1]);
    }

    $stu = null;
    if ($token && file_exists(LMS_SESSIONS_FILE)) {
        $sessions = json_decode(file_get_contents(LMS_SESSIONS_FILE), true);
        if (isset($sessions[$token]) && $sessions[$token]['expiresAt'] >= time()) {
            $sessionPhone = clean_phone($sessions[$token]['phone'] ?? '');
            $students = load_students();
            foreach ($students as $s) {
                if (clean_phone($s['phone'] ?? '') === $sessionPhone) {
                    $stu = $s;
                    break;
                }
            }
            if (!$stu) {
                $stu = [
                    'id'    => 'stu_' . substr(md5($sessionPhone), 0, 8),
                    'name'  => $sessions[$token]['name'] ?? 'Student',
                    'phone' => $sessionPhone,
                    'city'  => 'India'
                ];
            }
        }
    }

    if (!$stu) {
        $ipHash = substr(md5($_SERVER['REMOTE_ADDR'] ?? 'guest'), 0, 8);
        $stu = [
            'id'    => 'guest_' . $ipHash,
            'name'  => 'Guest Viewer',
            'phone' => 'guest_' . $ipHash,
            'city'  => 'Live Viewer'
        ];
    }

    $handRaised = !empty($body['handRaised']) || !empty($_POST['handRaised']);
    $stuPhone = clean_phone($stu['phone'] ?? '');
    if (!$stuPhone) $stuPhone = $stu['phone'] ?? ('guest_' . substr(md5(uniqid()), 0, 6));

    $attendanceFile = DATA_DIR . '/live-viewers-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId) . '.json';
    $data = file_exists($attendanceFile) ? (json_decode(file_get_contents($attendanceFile), true) ?: []) : [];

    $now = time();
    $viewers = $data['viewers'] ?? [];
    $activeViewers = [];

    // Prune viewers older than 60s
    foreach ($viewers as $p => $v) {
        if (($now - ($v['lastSeen'] ?? 0)) <= 60) {
            $activeViewers[$p] = $v;
        }
    }

    $existing = $activeViewers[$stuPhone] ?? [];
    $micAllowed = !empty($existing['micAllowed']);
    $cameraAllowed = !empty($existing['cameraAllowed']);
    $screenAllowed = !empty($existing['screenAllowed']);

    // If student manually toggled hand raise
    if (isset($body['handRaised']) || isset($_POST['handRaised'])) {
        $finalHandRaised = $handRaised;
    } else {
        $finalHandRaised = !empty($existing['handRaised']);
    }

    $activeViewers[$stuPhone] = [
        'phone'         => $stuPhone,
        'name'          => $stu['name'] ?? 'Student',
        'city'          => $stu['city'] ?? ($stu['workCity'] ?? 'India'),
        'avatar'        => $stu['photoUrl'] ?? ($stu['avatar'] ?? ''),
        'joinedAt'      => $existing['joinedAt'] ?? date('c'),
        'lastSeen'      => $now,
        'handRaised'    => $finalHandRaised,
        'micAllowed'    => $micAllowed,
        'cameraAllowed' => $cameraAllowed,
        'screenAllowed' => $screenAllowed
    ];

    $data['viewers'] = $activeViewers;
    $data['lastUpdated'] = date('c');
    file_put_contents($attendanceFile, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);

    // Get session settings
    $allClasses = get_all_live_classes();
    $targetClass = null;
    foreach ($allClasses as $c) {
        if ($c['id'] === $sessionId) {
            $targetClass = $c;
            break;
        }
    }

    $showViewerCount = !isset($targetClass['showViewerCountToStudents']) || !empty($targetClass['showViewerCountToStudents']);
    $totalCount = count($activeViewers);
    $stageRoom = 'qaa_stage_' . substr(md5('qaa_stage_salt_' . $sessionId), 0, 12);
    $stuName = $stu['name'] ?? 'Student';
    $stageGuestUrl = "https://vdo.ninja/?room={$stageRoom}&push=" . urlencode($stuPhone) . "&label=" . urlencode($stuName) . "&autostart=1&cleanoutput=1";

    json_ok([
        'showViewerCount' => $showViewerCount,
        'viewerCount'     => $showViewerCount ? $totalCount : null,
        'micAllowed'      => $micAllowed,
        'cameraAllowed'   => $cameraAllowed,
        'screenAllowed'   => $screenAllowed,
        'handRaised'      => $finalHandRaised,
        'stageRoom'       => $stageRoom,
        'stageGuestUrl'   => $stageGuestUrl,
        'status'          => $targetClass['status'] ?? 'live'
    ]);
}

// 21.45 Get Masterclass Landing Page Customization (Public)
if ($action === 'get-masterclass-landing' && ($method === 'GET' || $method === 'POST')) {
    $landingFile = DATA_DIR . '/masterclass-landing.json';
    $data = file_exists($landingFile) ? json_decode(file_get_contents($landingFile), true) : [];
    if (!is_array($data)) $data = [];
    json_ok(['landing' => $data]);
}

// 21.5 Create Razorpay Order for Workshop / Masterclass Ticket
if ($action === 'create-workshop-order' && $method === 'POST') {
    $body = read_json_body() ?: [];
    $liveId = trim($body['liveId'] ?? ($body['workshopId'] ?? ($_POST['liveId'] ?? ($_POST['workshopId'] ?? ''))));
    $phone  = preg_replace('/[^0-9]/', '', $body['phone'] ?? ($_POST['phone'] ?? ''));
    $name   = trim($body['name'] ?? ($_POST['name'] ?? ''));
    $email  = strtolower(trim($body['email'] ?? ($_POST['email'] ?? '')));

    if (strlen($phone) === 12 && substr($phone, 0, 2) === '91') $phone = substr($phone, 2);
    if (strlen($phone) !== 10) json_err('Valid 10-digit mobile number daalein', 400);
    if (!$name) json_err('Aapka naam required hai', 400);

    $allClasses = get_all_live_classes();
    $target = null;
    if (!empty($liveId)) {
        foreach ($allClasses as $c) {
            if ($c['id'] === $liveId) {
                $target = $c;
                break;
            }
        }
    }
    // Fallback: pick first workshop (never fall back to a batch/course class)
    if (!$target && !empty($allClasses)) {
        foreach ($allClasses as $c) {
            if (($c['type'] ?? '') === 'workshop') {
                $target = $c;
                $liveId = $c['id'];
                break;
            }
        }
    }
    if (!$target) json_err('Workshop session not found', 404);

    $ticketPrice = (int)($target['ticketPrice'] ?? 21);
    $landingFile = DATA_DIR . '/masterclass-landing.json';
    if (file_exists($landingFile)) {
        $lpData = json_decode(file_get_contents($landingFile), true) ?: [];
        if (!empty($lpData['ticketPrice'])) {
            $ticketPrice = (int)$lpData['ticketPrice'];
        }
    }
    $settings = load_lms_settings();
    $keyId = trim($settings['razorpayKeyId'] ?? '');
    $keySecret = trim($settings['razorpayKeySecret'] ?? '');
    $hasValidKeys = !empty($keyId) && !empty($keySecret) && (str_starts_with($keyId, 'rzp_test_') || str_starts_with($keyId, 'rzp_live_'));
    $razorpayEnabled = (!empty($settings['razorpayEnabled']) || $hasValidKeys) && $hasValidKeys;

    if (!$razorpayEnabled) {
        // If razorpay is not active, allow instant confirmation in demo/offline mode
        json_ok([
            'razorpayEnabled' => false,
            'amount'          => $ticketPrice,
            'message'         => 'Direct enrollment mode active'
        ]);
    }

    $receiptId = 'rcpt_ws_' . substr(md5(uniqid(microtime(), true)), 0, 10);
    $payload = json_encode([
        'amount'   => $ticketPrice * 100, // paisa
        'currency' => 'INR',
        'receipt'  => $receiptId,
        'notes'    => [
            'type'      => 'masterclass_ticket',
            'liveId'    => $liveId,
            'title'     => $target['title'],
            'student'   => $name,
            'phone'     => $phone,
            'email'     => $email
        ]
    ]);

    $ch = curl_init('https://api.razorpay.com/v1/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "{$keyId}:{$keySecret}");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = $res ? json_decode($res, true) : null;
    if ($httpCode === 200 && !empty($resData['id'])) {
        json_ok([
            'razorpayEnabled' => true,
            'orderId'         => $resData['id'],
            'keyId'           => $keyId,
            'amount'          => $ticketPrice * 100,
            'currency'        => 'INR',
            'workshopTitle'   => $target['title'],
            'userName'        => $name,
            'userPhone'       => $phone,
            'userEmail'       => $email
        ]);
    } else {
        $errMsg = $resData['error']['description'] ?? "Razorpay order creation failed (HTTP {$httpCode})";
        json_err($errMsg, 500);
    }
}

// 21.6 Verify Razorpay Payment & Grant Instant Masterclass Access
if ($action === 'verify-workshop-payment' && $method === 'POST') {
    $body = read_json_body() ?: [];
    $liveId    = trim($body['liveId'] ?? ($body['workshopId'] ?? ($_POST['liveId'] ?? ($_POST['workshopId'] ?? ''))));
    $phone     = preg_replace('/[^0-9]/', '', $body['phone'] ?? ($_POST['phone'] ?? ''));
    $name      = trim($body['name'] ?? ($_POST['name'] ?? ''));
    $email     = strtolower(trim($body['email'] ?? ($_POST['email'] ?? '')));
    $orderId   = trim($body['razorpay_order_id'] ?? ($_POST['razorpay_order_id'] ?? ''));
    $paymentId = trim($body['razorpay_payment_id'] ?? ($_POST['razorpay_payment_id'] ?? ''));
    $signature = trim($body['razorpay_signature'] ?? ($_POST['razorpay_signature'] ?? ''));

    if (strlen($phone) === 12 && substr($phone, 0, 2) === '91') $phone = substr($phone, 2);
    if (strlen($phone) !== 10) json_err('Valid 10-digit phone required', 400);
    if (!$liveId) json_err('Live Class ID required', 400);

    // Always confirm with Razorpay; workshop & phone come from the paid order.
    // (Earlier a missing/"direct_" signature skipped this and handed out a login
    // token for any phone number.)
    $rp = razorpay_confirm_payment($orderId, $paymentId, $signature);
    $orderLive  = trim((string)($rp['notes']['liveId'] ?? ''));
    $orderPhone = clean_phone($rp['notes']['phone'] ?? '');
    if (!$orderLive || strlen($orderPhone) !== 10) json_err('Payment order details incomplete. Support: +91 9939800780', 400);
    if ($phone !== $orderPhone) json_err('Payment is phone number se match nahi karta.', 400);
    $liveId = $orderLive;

    $allClasses = get_all_live_classes();
    $target = null;
    foreach ($allClasses as $c) {
        if ($c['id'] === $liveId) {
            $target = $c;
            break;
        }
    }
    if (!$target) json_err('Workshop session not found', 404);

    $ticketPrice = (int)($target['ticketPrice'] ?? 21);
    $students = load_students();
    $student = null;
    $isNew = false;

    foreach ($students as &$s) {
        if (clean_phone($s['phone'] ?? '') === $phone) {
            $student = &$s;
            break;
        }
    }
    unset($s);

    if (!$student) {
        $isNew = true;
        $studentId = 'stu_' . substr(md5(uniqid($phone, true)), 0, 6);
        $student = [
            'id'               => $studentId,
            'phone'            => $phone,
            'name'             => $name ?: 'Student',
            'email'            => $email ?: '',
            'city'             => '',
            'enrolledAt'       => date('c'),
            'enrolledCourses'  => [$liveId],
            'completedLessons' => []
        ];
        $students[] = $student;
    } else {
        if (!is_array($student['enrolledCourses'])) $student['enrolledCourses'] = [];
        if (!in_array($liveId, $student['enrolledCourses'])) {
            $student['enrolledCourses'][] = $liveId;
        }
        if ($name && empty($student['name'])) $student['name'] = $name;
        if ($email && empty($student['email'])) $student['email'] = $email;
    }

    save_students($students);

    // Save transaction
    $transactions = file_exists(LMS_TRANSACTIONS_FILE) ? (json_decode(file_get_contents(LMS_TRANSACTIONS_FILE), true) ?: []) : [];
    $txId = 'tx_ws_' . substr(md5(uniqid(microtime(), true)), 0, 8);
    $transactions[] = [
        'id'            => $txId,
        'orderId'       => $orderId ?: ('offline_' . time()),
        'paymentId'     => $paymentId ?: ('pay_direct_' . time()),
        'studentPhone'  => $phone,
        'studentName'   => $name ?: ($student['name'] ?? ''),
        'liveId'        => $liveId,
        'title'         => $target ? $target['title'] : 'Masterclass Ticket',
        'amount'        => $ticketPrice,
        'currency'      => 'INR',
        'status'        => 'SUCCESS',
        'createdAt'     => date('c')
    ];
    file_put_contents(LMS_TRANSACTIONS_FILE, json_encode($transactions, JSON_PRETTY_PRINT), LOCK_EX);

    // Generate authenticated student session
    $sessionToken = create_student_session($phone);

    json_ok([
        'verified'     => true,
        'token'        => $sessionToken,
        'liveId'       => $liveId,
        'studentName'  => $student['name'],
        'redirectUrl'  => '/portal/index.html?token=' . urlencode($sessionToken) . '#live/' . urlencode($liveId),
        'message'      => 'Payment successful! Masterclass access granted.'
    ]);
}

// 22. Offline On-Campus Student Admission Flow
if ($action === 'submit-offline-admission' && $method === 'POST') {
    $uploadDir = __DIR__ . '/../uploads/admissions';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $fullName     = trim($_POST['fullName'] ?? '');
    $phone        = clean_phone($_POST['phone'] ?? '');
    $email        = trim($_POST['email'] ?? '');
    $dob          = trim($_POST['dob'] ?? '');
    $gender       = trim($_POST['gender'] ?? 'Male');
    $bloodGroup   = trim($_POST['bloodGroup'] ?? 'B+');
    $fatherName   = trim($_POST['fatherName'] ?? '');
    $address      = trim($_POST['address'] ?? '');
    $city         = trim($_POST['city'] ?? '');
    $state        = trim($_POST['state'] ?? 'Bihar');
    $pincode      = trim($_POST['pincode'] ?? '');
    $courseTitle  = trim($_POST['courseTitle'] ?? '14-Week Master Class (Offline Lab)');
    $hostelNeeded = !empty($_POST['hostelNeeded']) && $_POST['hostelNeeded'] === 'yes';
    $studioName   = trim($_POST['studioName'] ?? '');
    $currentRole  = trim($_POST['currentRole'] ?? 'Student / Beginner');
    $workCity     = trim($_POST['workCity'] ?? $city);
    $instagram    = trim($_POST['instagram'] ?? '');
    $careerGoal   = trim($_POST['careerGoal'] ?? '');
    $paymentMode  = trim($_POST['paymentMode'] ?? 'online'); // 'online', 'online_batch_direct', 'already_paid', or 'cash'

    // Detect if this is an Online Batch registration (?batch=114, ?b=115, etc.)
    $isOnlineBatch = !empty($_POST['isOnlineBatch']) ||
                     preg_match('/batch\s*[-_]?\s*(\d+)/i', $courseTitle) ||
                     in_array($paymentMode, ['online_batch_direct', 'already_paid']) ||
                     stripos($courseTitle, 'online') !== false;
    $batchCourseId = $isOnlineBatch ? map_offline_course_id($courseTitle) : null;

    if (!$fullName || strlen($phone) < 10) {
        json_err('Full Name aur valid 10-digit mobile number mandatory hai.', 400);
    }
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_err('Valid email address enter karna mandatory hai.', 400);
    }

    // Server-side check: Verify phone & email were OTP-verified
    $verifiedFile = DATA_DIR . '/verified-admissions.json';
    $verifiedList = file_exists($verifiedFile) ? json_decode(file_get_contents($verifiedFile), true) : [];
    $isPhoneVerified = !empty($verifiedList['phones'][$phone]) && $verifiedList['phones'][$phone]['expiresAt'] >= time();
    $isEmailVerified = !empty($verifiedList['emails'][strtolower($email)]) && $verifiedList['emails'][strtolower($email)]['expiresAt'] >= time();

    // Fallback to email-otps.json if present
    if (!$isEmailVerified && function_exists('load_email_otps')) {
        $eOtps = load_email_otps();
        if (!empty($eOtps[strtolower($email)]['verified'])) {
            $isEmailVerified = true;
        }
    }

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($clientIp, ['127.0.0.1', '::1']) || in_array($serverName, ['localhost', '127.0.0.1']);

    $phoneVerified = (bool)$isPhoneVerified;
    $emailVerified = (bool)$isEmailVerified;

    // Helper to upload files safely with size validation (up to 25 MB)
    $saveUploadedDoc = function($fieldKey, $prefix, $maxBytes = 0) use ($uploadDir) {
        if (empty($_FILES[$fieldKey]) || $_FILES[$fieldKey]['error'] !== UPLOAD_ERR_OK) {
            return '';
        }
        $file = $_FILES[$fieldKey];
        if ($maxBytes > 0 && $file['size'] > $maxBytes) {
            $limitMb = round($maxBytes / (1024 * 1024));
            json_err("File '{$fieldKey}' ka size {$limitMb} MB se zyada nahi ho sakta.", 400);
        }
        $origName = basename($file['name']);
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        if (!in_array($ext, $allowed)) {
            return '';
        }
        $fileName = $prefix . '_' . substr(md5(uniqid(mt_rand(), true)), 0, 10) . '.' . $ext;
        $dest = $uploadDir . '/' . $fileName;
        if (move_uploaded_file($file['tmp_name'], $dest)) {
            return '/uploads/admissions/' . $fileName;
        }
        return '';
    };

    $photoUrl = $saveUploadedDoc('photo_file', 'photo', 25 * 1024 * 1024); // 25 MB max limit
    $aadhaarUrl = $saveUploadedDoc('aadhaar_file', 'aadhaar', 25 * 1024 * 1024); // 25 MB max limit
    $certUrl = $saveUploadedDoc('cert_file', 'cert', 25 * 1024 * 1024); // 25 MB max limit

    $admissionsFile = DATA_DIR . '/offline-admissions.json';
    $admissions = file_exists($admissionsFile) ? json_decode(file_get_contents($admissionsFile), true) : [];
    if (!is_array($admissions)) $admissions = [];

    $idPrefix = $isOnlineBatch ? 'QAA-ON-' : 'QAA-OFF-';
    $admissionId = $idPrefix . date('Y') . '-' . strtoupper(substr(uniqid(), -5));
    $admissionFee = $isOnlineBatch ? 0 : 500; // Online batches enrolled directly

    $newAdmission = [
        'id'            => $admissionId,
        'fullName'      => $fullName,
        'phone'         => $phone,
        'email'         => $email,
        'dob'           => $dob,
        'gender'        => $gender,
        'bloodGroup'    => $bloodGroup,
        'fatherName'    => $fatherName,
        'address'       => $address,
        'city'          => $city,
        'state'         => $state,
        'pincode'       => $pincode,
        'courseTitle'   => $courseTitle,
        'isOnlineBatch' => $isOnlineBatch,
        'batchCourseId' => $batchCourseId,
        'hostelNeeded'  => $hostelNeeded,
        'studioName'    => $studioName,
        'currentRole'   => $currentRole,
        'workCity'      => $workCity,
        'instagram'     => $instagram,
        'careerGoal'    => $careerGoal,
        'photoUrl'      => $photoUrl,
        'aadhaarUrl'    => $aadhaarUrl,
        'certUrl'       => $certUrl,
        'paymentMode'   => $paymentMode,
        'feeAmount'     => $admissionFee,
        'paymentStatus' => $isOnlineBatch ? 'pending_verification' : (($paymentMode === 'cash') ? 'pending_campus' : 'awaiting_online_payment'),
        'status'        => 'pending_approval',
        'isApproved'    => false,
        'isPaid500'     => false,
        'phoneVerified' => $phoneVerified,
        'emailVerified' => $emailVerified,
        'verificationNote' => $phoneVerified ? 'Verified via WhatsApp OTP' : 'Direct Batch Registration',
        'createdAt'     => date('c')
    ];

    // If online payment chosen (and not already confirmed online batch), initialize Razorpay order
    $razorpayData = null;
    $settings = load_settings();
    $keyId = trim($settings['razorpayKeyId'] ?? '');
    $keySecret = trim($settings['razorpayKeySecret'] ?? '');
    $razorpayEnabled = !empty($settings['razorpayEnabled']) && !empty($keyId) && !empty($keySecret);

    if ($paymentMode === 'online' && !$isOnlineBatch && $razorpayEnabled) {
        $ch = curl_init('https://api.razorpay.com/v1/orders');
        $orderPayload = [
            'amount'          => $admissionFee * 100, // 50000 paise
            'currency'        => 'INR',
            'receipt'         => 'adm_' . substr($admissionId, -8),
            'payment_capture' => 1,
            'notes'           => [
                'admissionId' => $admissionId,
                'studentName' => $fullName,
                'phone'       => $phone,
                'type'        => 'offline_admission_fee'
            ]
        ];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($orderPayload),
            CURLOPT_USERPWD        => $keyId . ':' . $keySecret,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 15
        ]);
        $rpRes = curl_exec($ch);
        $rpHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($rpHttp === 200 && $rpRes) {
            $rpOrder = json_decode($rpRes, true);
            if (!empty($rpOrder['id'])) {
                $newAdmission['razorpayOrderId'] = $rpOrder['id'];
                $razorpayData = [
                    'orderId'   => $rpOrder['id'],
                    'keyId'     => $keyId,
                    'amount'    => $admissionFee * 100,
                    'currency'  => 'INR',
                    'name'      => 'Quick Art Photography Academy',
                    'description' => 'Offline On-Campus Admission Registration Fee',
                    'prefill'   => [
                        'name'    => $fullName,
                        'contact' => $phone,
                        'email'   => $email
                    ]
                ];
            }
        }
    }

    // Save admission record (or update existing submission by phone)
    $existingAdmIdx = -1;
    foreach ($admissions as $idx => $ea) {
        if (clean_phone($ea['phone'] ?? '') === $phone) {
            $existingAdmIdx = $idx;
            break;
        }
    }
    if ($existingAdmIdx >= 0) {
        // Keep existing documents if new upload was empty
        if (empty($photoUrl) && !empty($admissions[$existingAdmIdx]['photoUrl'])) {
            $newAdmission['photoUrl'] = $admissions[$existingAdmIdx]['photoUrl'];
            $photoUrl = $newAdmission['photoUrl'];
        }
        if (empty($aadhaarUrl) && !empty($admissions[$existingAdmIdx]['aadhaarUrl'])) {
            $newAdmission['aadhaarUrl'] = $admissions[$existingAdmIdx]['aadhaarUrl'];
        }
        $admissions[$existingAdmIdx] = array_merge($admissions[$existingAdmIdx], $newAdmission);
    } else {
        $admissions[] = $newAdmission;
    }
    file_put_contents($admissionsFile, json_encode($admissions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    // Auto-sync submitted admission to alumni showcase immediately
    sync_offline_admissions_to_alumni();

    // Auto-create or update student in students.json for portal & app access
    $students = get_all_students();
    $existingStudent = null;
    foreach ($students as &$s) {
        if (clean_phone($s['phone'] ?? '') === $phone) {
            $existingStudent = &$s;
            break;
        }
    }
    unset($s);

    // An unverified phone must not take over or edit someone else's existing account
    if ($existingStudent && !$phoneVerified) {
        unset($existingStudent);
        $existingStudent = null;
        $skipStudentWrite = true;
    }

    if ($existingStudent) {
        $existingStudent['name'] = $fullName;
        if ($email) $existingStudent['email'] = $email;
        if ($photoUrl) {
            $existingStudent['avatar'] = $photoUrl;
            $existingStudent['avatarUrl'] = $photoUrl;
            $existingStudent['photoUrl'] = $photoUrl;
        }
        $existingStudent['isOfflineStudent'] = true;
        $existingStudent['offlineAdmissionId'] = $admissionId;
        $existingStudent['enrollmentNo'] = $admissionId;
        $existingStudent['appliedCourse'] = $courseTitle;
        $existingStudent['studioName'] = $studioName;
        $existingStudent['currentRole'] = $currentRole;
        $existingStudent['workCity'] = $workCity;
        $existingStudent['fatherName'] = $fatherName;
        $existingStudent['bloodGroup'] = $bloodGroup;
        $existingStudent['address'] = $address;
        $existingStudent['city'] = $city;
        $existingStudent['state'] = $state;
        $existingStudent['pincode'] = $pincode;

        // ALL forms (Online Batch or Offline) require Admin Approval!
        // Preserve any previously active status or previous course enrollments if student was already approved
        if (empty($existingStudent['isApproved'])) {
            $existingStudent['isApproved'] = false;
            $existingStudent['status'] = 'pending_approval';
            $existingStudent['paymentStatus'] = $isOnlineBatch ? 'pending_verification' : (($paymentMode === 'cash') ? 'pay_at_campus' : 'unpaid');
            $existingStudent['isPaid500'] = false;
        }
        if ($isOnlineBatch) {
            $existingStudent['isOnlineBatch'] = true;
            if ($batchCourseId) {
                $existingStudent['pendingCourseId'] = $batchCourseId;
            }
        }
    } elseif (empty($skipStudentWrite)) {
        // New student registering via form: NO courses enrolled until Admin approval!
        $students[] = [
            'id'                 => 'stu_' . time() . '_' . substr(md5($phone), 0, 4),
            'name'               => $fullName,
            'phone'              => $phone,
            'email'              => $email,
            'avatar'             => $photoUrl,
            'avatarUrl'          => $photoUrl,
            'photoUrl'           => $photoUrl,
            'enrolledCourses'    => [],
            'isOfflineStudent'   => true,
            'isOnlineBatch'      => (bool)$isOnlineBatch,
            'offlineAdmissionId' => $admissionId,
            'enrollmentNo'       => $admissionId,
            'appliedCourse'      => $courseTitle,
            'pendingCourseId'    => $batchCourseId,
            'paymentStatus'      => $isOnlineBatch ? 'pending_verification' : (($paymentMode === 'cash') ? 'pay_at_campus' : 'unpaid'),
            'isPaid500'          => false,
            'isApproved'         => false,
            'status'             => 'pending_approval',
            'studioName'         => $studioName,
            'currentRole'        => $currentRole,
            'workCity'           => $workCity,
            'fatherName'         => $fatherName,
            'bloodGroup'         => $bloodGroup,
            'address'            => $address,
            'city'               => $city,
            'state'              => $state,
            'pincode'            => $pincode,
            'registeredAt'       => date('c')
        ];
    }
    save_all_students($students);

    // Login token only for an OTP-verified phone (otherwise anyone could get into any number's account)
    $sessionToken = $phoneVerified ? create_student_session($phone) : null;

    json_ok([
        'admissionId'   => $admissionId,
        'fullName'      => $fullName,
        'phone'         => $phone,
        'photoUrl'      => $photoUrl,
        'bloodGroup'    => $bloodGroup,
        'feeAmount'     => $admissionFee,
        'paymentMode'   => $paymentMode,
        'isOnlineBatch' => $isOnlineBatch,
        'status'        => 'pending_approval',
        'isApproved'    => false,
        'token'         => $sessionToken,
        'razorpay'      => $razorpayData,
        'message'       => $isOnlineBatch
            ? 'Online Batch Admission form successfully submit ho gaya hai! Admin team dwara verify aur approve hone ke baad aapka Portal aur Batch Classroom unlock hoga.'
            : (($paymentMode === 'cash')
                ? 'Admission form successfully submit ho gaya hai! ₹500 registration fee aap On-Campus Siwan aakar pay kar sakte hain. Admin approval ke baad access unlock hoga.'
                : 'Admission form successfully submit ho gaya hai! Kripya ₹500 registration fee pay karein.')
    ]);
}

// 23. Verify Offline Admission Razorpay Payment
if ($action === 'verify-offline-admission-payment' && $method === 'POST') {
    $body = read_json_body() ?: $_POST;
    $admissionId = trim($body['admissionId'] ?? '');
    $orderId     = trim($body['razorpay_order_id'] ?? '');
    $paymentId   = trim($body['razorpay_payment_id'] ?? '');
    $signature   = trim($body['razorpay_signature'] ?? '');

    // Always confirm with Razorpay (earlier, a missing signature marked any admission "paid"
    // and returned a login token for that student).
    $rp = razorpay_confirm_payment($orderId, $paymentId, $signature);
    if (($rp['notes']['admissionId'] ?? '') !== $admissionId) json_err('Payment is admission se match nahi karta.', 400);

    $admissionsFile = DATA_DIR . '/offline-admissions.json';
    $admissions = file_exists($admissionsFile) ? json_decode(file_get_contents($admissionsFile), true) : [];
    $matched = false;
    $studentPhone = '';
    $studentName = '';

    $admCourseTitle = '';

    $admRecord = null;
    foreach ($admissions as &$adm) {
        if ($adm['id'] === $admissionId && !empty($adm['razorpayOrderId']) && $adm['razorpayOrderId'] === $orderId) {
            $adm['paymentStatus'] = 'paid';
            $adm['isPaid500'] = true;
            $adm['isApproved'] = false; // Requires Admin approval
            $adm['status'] = 'paid_pending_approval';
            $adm['razorpayPaymentId'] = $paymentId;
            $adm['paidAt'] = date('c');
            $studentPhone = $adm['phone'];
            $studentName = $adm['fullName'];
            $admCourseTitle = $adm['courseTitle'] ?? '';
            $admRecord = $adm;
            $matched = true;
            break;
        }
    }
    unset($adm);

    if ($matched) {
        file_put_contents($admissionsFile, json_encode($admissions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        // Record transaction
        $transFile = DATA_DIR . '/transactions.json';
        $transactions = file_exists($transFile) ? json_decode(file_get_contents($transFile), true) : [];
        if (!is_array($transactions)) $transactions = [];
        $transactions[] = [
            'id'            => 'txn_' . time() . '_' . substr(md5(uniqid()), 0, 4),
            'orderId'       => $orderId ?: ('off_' . time()),
            'paymentId'     => $paymentId ?: ('pay_' . time()),
            'studentPhone'  => $studentPhone,
            'studentName'   => $studentName,
            'title'         => 'Offline On-Campus Admission Fee',
            'amount'        => 500,
            'currency'      => 'INR',
            'status'        => 'SUCCESS',
            'createdAt'     => date('c')
        ];
        file_put_contents($transFile, json_encode($transactions, JSON_PRETTY_PRINT), LOCK_EX);

        // Update student record (marked paid, but pending admin approval)
        $courseId = map_offline_course_id($admCourseTitle);
        $students = get_all_students();
        $foundStu = false;
        foreach ($students as &$stu) {
            if (clean_phone($stu['phone'] ?? '') === clean_phone($studentPhone)) {
                $stu['isPaid500'] = true;
                $stu['paymentStatus'] = 'paid';
                $stu['appliedCourse'] = $admCourseTitle;
                $stu['isApproved'] = false;
                $stu['status'] = 'pending_approval';
                if (!empty($admRecord['photoUrl'])) {
                    $stu['avatar'] = $admRecord['photoUrl'];
                    $stu['avatarUrl'] = $admRecord['photoUrl'];
                    $stu['photoUrl'] = $admRecord['photoUrl'];
                }
                $stu['isOfflineStudent'] = true;
                $stu['offlineAdmissionId'] = $admissionId;
                $stu['enrollmentNo'] = $admissionId;
                if (!empty($admRecord['fatherName'])) $stu['fatherName'] = $admRecord['fatherName'];
                if (!empty($admRecord['bloodGroup'])) $stu['bloodGroup'] = $admRecord['bloodGroup'];
                if (!empty($admRecord['studioName'])) $stu['studioName'] = $admRecord['studioName'];
                if (!empty($admRecord['city'])) $stu['city'] = $admRecord['city'];
                if (!empty($admRecord['address'])) $stu['address'] = $admRecord['address'];
                $foundStu = true;
                break;
            }
        }
        unset($stu);

        if (!$foundStu) {
            $students[] = [
                'id'                 => 'stu_' . time() . '_' . substr(md5($studentPhone), 0, 4),
                'name'               => $studentName,
                'phone'              => $studentPhone,
                'email'              => $admRecord['email'] ?? '',
                'avatar'             => $admRecord['photoUrl'] ?? '',
                'avatarUrl'          => $admRecord['photoUrl'] ?? '',
                'photoUrl'           => $admRecord['photoUrl'] ?? '',
                'enrolledCourses'    => [],
                'isOfflineStudent'   => true,
                'offlineAdmissionId' => $admissionId,
                'enrollmentNo'       => $admissionId,
                'appliedCourse'      => $admCourseTitle,
                'paymentStatus'      => 'paid',
                'isPaid500'          => true,
                'isApproved'         => false,
                'status'             => 'pending_approval',
                'studioName'         => $admRecord['studioName'] ?? '',
                'currentRole'        => $admRecord['currentRole'] ?? '',
                'workCity'           => $admRecord['workCity'] ?? '',
                'fatherName'         => $admRecord['fatherName'] ?? '',
                'bloodGroup'         => $admRecord['bloodGroup'] ?? '',
                'address'            => $admRecord['address'] ?? '',
                'city'               => $admRecord['city'] ?? '',
                'state'              => $admRecord['state'] ?? '',
                'pincode'            => $admRecord['pincode'] ?? '',
                'registeredAt'       => date('c')
            ];
        }
        save_all_students($students);

        $sessionToken = create_student_session($studentPhone);
        json_ok([
            'verified'    => true,
            'admissionId' => $admissionId,
            'token'       => $sessionToken,
            'studentName' => $studentName,
            'message'     => 'Payment verified successfully! Welcome to Quick Art Photography Academy.'
        ]);
    }

    json_err('Admission record nahi mila.', 404);
}

// 24. Public Alumni Showcase API (Driven dynamically by real admission submissions)
if ($action === 'get-alumni' && ($method === 'GET' || $method === 'POST')) {
    $alumni = sync_offline_admissions_to_alumni();
    json_ok(['alumni' => $alumni]);
}

// 25. Daily Tasks & Offline Lab Work for Students
if ($action === 'get-daily-tasks' && ($method === 'GET' || $method === 'POST')) {
    $tasksFile = DATA_DIR . '/daily-tasks.json';
    $tasks = file_exists($tasksFile) ? json_decode(file_get_contents($tasksFile), true) : [];

    if (!is_array($tasks) || empty($tasks)) {
        $tasks = [
            [
                'id'          => 'task_001',
                'dayNumber'   => 1,
                'title'       => 'Camera Rushes Ingestion & Bin Organization',
                'description' => 'Import raw 4K multi-cam wedding footage into DaVinci Resolve & Premiere Pro. Organize footage into Bins: Haldi, Sangeet, Jaimala, Bidaai with proper color tags.',
                'resource'    => 'Practice Wedding Footage Pack (1.2 GB)',
                'deadline'    => 'Submit project project file (.prproj / .drp)',
                'courseId'    => 'master-class'
            ],
            [
                'id'          => 'task_002',
                'dayNumber'   => 2,
                'title'       => 'Beat-Matched Teaser Rough Cut (60 Seconds)',
                'description' => 'Cut a 60-second high-energy wedding teaser on given background track. Align cut points strictly on beat markers without jump cuts.',
                'resource'    => 'Licensed Audio Stems & SFX Pack',
                'deadline'    => 'Export 1080p H.264 preview for mentor review',
                'courseId'    => 'master-class'
            ],
            [
                'id'          => 'task_003',
                'dayNumber'   => 3,
                'title'       => 'DaVinci Resolve Primary Wheels & S-Log3 Balance',
                'description' => 'Grade Sony S-Log3 footage using 4-node pipeline: Exposure Balance -> Color Space Transform -> Skin Tone Qualifier -> Warm Look.',
                'resource'    => 'Raw Sony FX3 S-Log3 Clip Set',
                'deadline'    => 'Export Still Stills Gallery (.drx / .jpg)',
                'courseId'    => 'master-class'
            ],
            [
                'id'          => 'task_004',
                'dayNumber'   => 4,
                'title'       => 'Canvera & Karizma 12x36 Album Spread Design',
                'description' => 'Create a 3-spread premium Karizma album design in Photoshop with proper bleed margin, golden highlights, and frequency separation on portrait shots.',
                'resource'    => 'Raw Wedding High-Res JPEGs',
                'deadline'    => 'PSD file 300 DPI layout',
                'courseId'    => 'master-class'
            ]
        ];
        if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
        file_put_contents($tasksFile, json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    json_ok(['tasks' => $tasks]);
}

// 26. Offline Class Recordings & Studio Archives
if ($action === 'get-offline-recordings' && ($method === 'GET' || $method === 'POST')) {
    $recFile = DATA_DIR . '/offline-recordings.json';
    $recordings = file_exists($recFile) ? json_decode(file_get_contents($recFile), true) : [];

    if (!is_array($recordings) || empty($recordings)) {
        $recordings = [
            [
                'id'          => 'rec_001',
                'title'       => 'Module 1: NLE Timeline Setup & Video Codecs Mastery',
                'mentor'      => 'Anil Sharma',
                'duration'    => '45 Mins',
                'videoUrl'    => 'https://www.youtube.com/embed/dQw4w9WgXcQ', // or academy stream
                'notes'       => 'Full breakdown of ProRes vs H.264, Timeline Framerates (24fps vs 50fps vs 120fps), and GPU acceleration setup.',
                'date'        => '2026-09-10'
            ],
            [
                'id'          => 'rec_002',
                'title'       => 'Module 2: DaVinci Resolve Color Grading Live Studio Breakdown',
                'mentor'      => 'Anil Sharma',
                'duration'    => '62 Mins',
                'videoUrl'    => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                'notes'       => 'Node graph hierarchy, skin-tone vector scope reading, and custom LUT generation for wedding highlights.',
                'date'        => '2026-09-15'
            ]
        ];
        if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
        file_put_contents($recFile, json_encode($recordings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    json_ok(['recordings' => $recordings]);
}

// 27. Course Completion Exam & Auto-Certificate Issuance
if ($action === 'submit-course-exam' && $method === 'POST') {
    $sessionStudent = require_student();
    $body = read_json_body() ?: $_POST;
    $studentPhone = (string)($sessionStudent['phone'] ?? '');
    $answers = $body['answers'] ?? []; // Map of question index => selected option index

    if (!$studentPhone || empty($answers)) {
        json_err('Answers mandatory hain.', 400);
    }

    // Offline certification exam is only for Admin-approved admission-form students
    $isAdmissionStu = !empty($sessionStudent['offlineAdmissionId']) || !empty($sessionStudent['isOfflineStudent']) || !empty($sessionStudent['isOnlineBatch']);
    $isApprovedStu = !empty($sessionStudent['isApproved']) && in_array($sessionStudent['status'] ?? '', ['active', 'approved']);
    if (!$isAdmissionStu || !$isApprovedStu) {
        json_err('Certification exam sirf Admin-approved admission students ke liye hai.', 403);
    }

    // 10 Official Certification Exam Questions with correct keys
    $examQuestions = [
        ['q' => 'DaVinci Resolve me Color Space Transform (CST) kyu use kiya jata hai?', 'ans' => 1],
        ['q' => 'Cinematic 24fps video record karte waqt shutter speed kya rakhni chahiye?', 'ans' => 2],
        ['q' => 'Karizma / Canvera 12x36 wedding album print karne ke liye standard DPI kya honi chahiye?', 'ans' => 0],
        ['q' => 'Premiere Pro me audio synchronization ke liye kaunsa tool sabse fast hai?', 'ans' => 1],
        ['q' => 'Sony S-Log3 footage me overexposure kitne stop tak safely recommend kiya jata hai?', 'ans' => 1],
        ['q' => 'Wedding teaser cut karte time pacing kispar depend karni chahiye?', 'ans' => 2],
        ['q' => 'DaVinci Resolve me serial node aur parallel node me primary difference kya hai?', 'ans' => 0],
        ['q' => 'Photoshop me skin retouching ke liye kaunsa high-end technique use hota hai?', 'ans' => 1],
        ['q' => 'L-Cut aur J-Cut editing techniques ka primary purpose kya hota hai?', 'ans' => 0],
        ['q' => 'LUT (Look-Up Table) apply karne se pehle exposure aur white balance fix karna zaroori hai?', 'ans' => 0]
    ];

    $score = 0;
    $total = count($examQuestions);
    foreach ($examQuestions as $idx => $eq) {
        if (isset($answers[$idx]) && (int)$answers[$idx] === $eq['ans']) {
            $score++;
        }
    }

    $percentage = round(($score / $total) * 100);
    $passed = $percentage >= 70;

    $certId = null;
    $certUrl = null;

    if ($passed) {
        $certId = 'QAA-' . date('Y') . '-' . strtoupper(substr(md5($studentPhone . time()), 0, 6));

        // Find student and update status
        $students = get_all_students();
        $studentName = 'Student';
        foreach ($students as &$s) {
            if (($s['phone'] ?? '') === $studentPhone) {
                $studentName = $s['name'] ?? 'Student';
                $s['examPassed'] = true;
                $s['examScore'] = $percentage;
                $s['certId'] = $certId;
                $s['certDate'] = date('Y-m-d');
                $s['alumniPendingApproval'] = true; // Flag for admin approval to Alumni directory
                break;
            }
        }
        unset($s);
        save_all_students($students);

        $certUrl = '/portal/?cert=' . $certId;
    }

    json_ok([
        'passed'      => $passed,
        'score'       => $score,
        'total'       => $total,
        'percentage'  => $percentage,
        'certId'      => $certId,
        'certUrl'     => $certUrl,
        'message'     => $passed
            ? "Badhaai ho! Aapne {$percentage}% score karke Certification Exam pass kar liya hai. Aapka Official Certificate generate ho gaya hai!"
            : "Aapka score {$percentage}% raha. Certificate ke liye kam se kam 70% chahiye. Kripya revision karke dobara test dein."
    ]);
}

// 26. Submit Student Assignment (Project / Link / Notes)
if ($action === 'submit-assignment' && $method === 'POST') {
    $student = require_student();
    $body = read_json_body() ?: $_POST;
    $courseId = trim($body['courseId'] ?? '');
    $assignmentId = trim($body['assignmentId'] ?? '');
    $projectUrl = trim($body['projectUrl'] ?? '');
    $notes = trim($body['notes'] ?? '');

    if (!$courseId || !$assignmentId) {
        json_err('Course ID aur Assignment ID mandatory hain.', 400);
    }
    if (!$projectUrl && !$notes) {
        json_err('Kripya apna project Google Drive/YouTube link ya submission details enter karein.', 400);
    }

    $assignFile = DATA_DIR . '/assignments.json';
    $assignments = file_exists($assignFile) ? json_decode(file_get_contents($assignFile), true) : [];
    if (!is_array($assignments)) $assignments = [];

    $stuId = $student['id'] ?? $student['phone'];
    $subKey = $stuId . '_' . $courseId . '_' . $assignmentId;
    $submission = [
        'id'           => 'sub_' . time() . '_' . substr(md5(uniqid()), 0, 4),
        'studentId'    => $stuId,
        'studentName'  => $student['name'] ?? 'Student',
        'studentPhone' => $student['phone'] ?? '',
        'courseId'     => $courseId,
        'assignmentId' => $assignmentId,
        'projectUrl'   => $projectUrl,
        'notes'        => $notes,
        'status'       => 'submitted',
        'submittedAt'  => date('c')
    ];
    $assignments[$subKey] = $submission;
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents($assignFile, json_encode($assignments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    json_ok([
        'message' => '🎉 Assignment successfully submit ho gaya hai! Mentor jald hi aapka project review karenge.',
        'submission' => $submission
    ]);
}

// 27. Get Student Assignment Submissions
if ($action === 'get-my-assignments' && $method === 'GET') {
    $student = require_student();
    $courseId = trim($_GET['courseId'] ?? '');

    $assignFile = DATA_DIR . '/assignments.json';
    $assignments = file_exists($assignFile) ? json_decode(file_get_contents($assignFile), true) : [];
    if (!is_array($assignments)) $assignments = [];

    $stuId = $student['id'] ?? '';
    $stuPhone = $student['phone'] ?? '';
    $mySubs = [];
    foreach ($assignments as $sub) {
        if (($sub['studentId'] === $stuId || $sub['studentPhone'] === $stuPhone) && (!$courseId || $sub['courseId'] === $courseId)) {
            $mySubs[$sub['assignmentId']] = $sub;
        }
    }

    json_ok(['submissions' => $mySubs]);
}

// 28. Save Push Subscription for Mobile App / PWA
if ($action === 'save-push-subscription' && $method === 'POST') {
    $body = read_json_body();
    $subData   = $body['subscription'] ?? [];
    $studentId = trim($body['studentId'] ?? '');
    $phone     = clean_phone($body['phone'] ?? '');
    $courses   = $body['courses'] ?? [];

    // Optional student validation via token if provided
    $authTok = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? ($body['token'] ?? '');
    if ($authTok && function_exists('get_student_from_token')) {
        $stu = get_student_from_token($authTok);
        if ($stu) {
            $studentId = $stu['id'];
            $phone = clean_phone($stu['phone']);
            $courses = $stu['enrolledCourses'] ?? [];
        }
    }

    if (empty($subData['endpoint'])) {
        json_err('Push subscription endpoint required', 400);
    }

    $ok = register_student_push_sub($studentId, $phone, $courses, $subData);
    json_ok([
        'registered' => $ok,
        'message' => 'Push notifications successfully registered'
    ]);
}

// 29. Get Notifications for Student
if ($action === 'get-notifications' && ($method === 'GET' || $method === 'POST')) {
    $authTok = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? ($_GET['token'] ?? '');
    $student = null;
    if ($authTok && function_exists('get_student_from_token')) {
        $student = get_student_from_token($authTok);
    }

    // Personal notifications only with a valid login; otherwise broadcast ones only
    $studentId = $student ? $student['id'] : '';
    $courses = $student ? ($student['enrolledCourses'] ?? []) : [];

    $notifications = get_student_notifications_list($studentId, $courses);
    $unreadCount = 0;
    foreach ($notifications as $n) {
        if (empty($n['isRead'])) $unreadCount++;
    }

    json_ok([
        'notifications' => $notifications,
        'unreadCount'   => $unreadCount
    ]);
}

// 30. Mark Notification as Read
if ($action === 'mark-notification-read' && $method === 'POST') {
    $body = read_json_body();
    $notifId = trim($body['id'] ?? ($body['notificationId'] ?? ''));
    $studentId = '';

    $authTok = $_SERVER['HTTP_X_STUDENT_TOKEN'] ?? '';
    if ($authTok && function_exists('get_student_from_token')) {
        $stu = get_student_from_token($authTok);
        if ($stu) $studentId = $stu['id'];
    }

    if ($notifId && $studentId) {
        $allNotifs = load_notifications();
        foreach ($allNotifs as &$n) {
            if ($n['id'] === $notifId) {
                if (!isset($n['readBy']) || !is_array($n['readBy'])) $n['readBy'] = [];
                if (!in_array($studentId, $n['readBy'])) {
                    $n['readBy'][] = $studentId;
                }
                break;
            }
        }
        unset($n);
        save_notifications($allNotifs);
    }

    json_ok(['updated' => true]);
}

json_err('Unknown LMS action', 404);




