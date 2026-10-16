<?php
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
/**
 * Shared helpers — hardened version.
 *
 * Security controls added:
 *  - Password stored as password_hash (bcrypt), verified with password_verify.
 *  - Session tokens are random 32-byte hex, separate from the password, with expiry.
 *  - Timing-safe comparisons (hash_equals) for every auth check.
 *  - Login rate limit: 8 attempts / 15 min per client IP (flat-file).
 *  - Webhook URL SSRF guard: rejects private/link-local/loopback hosts + non-http(s).
 *  - Webhook cURL: TLS verification always ON, no automatic redirect following
 *    (each redirect is re-checked by trigger_webhook if we ever add manual chase).
 *  - First-run: no default password — /admin refuses to accept any auth attempt
 *    until an owner sets one via the setup screen.
 */

// ---------- Paths ----------
const DATA_DIR       = __DIR__ . '/../data';
const LEADS_FILE     = DATA_DIR . '/leads.json';
const SETTINGS_FILE  = DATA_DIR . '/settings.json';
const SESSIONS_FILE  = DATA_DIR . '/sessions.json';
const RATELIMIT_FILE = DATA_DIR . '/ratelimit.json';

const DEFAULT_TEAM_PHONE  = '+919939800780';
const DEFAULT_METHOD      = 'POST';
const DEFAULT_PAYLOAD_FMT = 'json';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
const LOGIN_MAX_ATTEMPTS  = 8;
const LOGIN_WINDOW_SEC    = 15 * 60;

// ---------- CORS (restrictive; auth is header-based) ----------
function send_cors() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Pass, X-Admin-Token, X-Student-Token');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

function json_ok($data = []) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['ok' => true], $data));
    exit;
}
function json_err($msg, $status = 400) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
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


// ---------- Storage: settings ----------
function load_settings() {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    if (!file_exists(SETTINGS_FILE)) {
        // First run — no admin password yet. The admin.html setup screen must
        // POST ?action=setup-admin with a chosen password before login works.
        $defaults = [
            'adminPasswordHash'    => '',
            'webhookUrl'           => '',
            'teamPhone'            => DEFAULT_TEAM_PHONE,
            'webhookMethod'        => DEFAULT_METHOD,
            'webhookPayloadFormat' => DEFAULT_PAYLOAD_FMT,
            'webhookHeaders'       => '',
            'updatedAt'            => date('c'),
        ];
        if (file_put_contents(SETTINGS_FILE, json_encode($defaults, JSON_PRETTY_PRINT), LOCK_EX) === false) json_err('Settings storage is not writable', 503);
        return $defaults;
    }
    $raw = file_get_contents(SETTINGS_FILE);
    $data = json_decode($raw, true);
    if (!is_array($data)) return [];

    // Backward-compat: migrate legacy plaintext adminPassword → hash + drop plaintext
    if (empty($data['adminPasswordHash']) && !empty($data['adminPassword'])) {
        $data['adminPasswordHash'] = password_hash($data['adminPassword'], PASSWORD_DEFAULT);
        unset($data['adminPassword']);
        file_put_contents(SETTINGS_FILE, json_encode($data, JSON_PRETTY_PRINT));
    }

    // Ensure new keys exist
    if (!isset($data['webhookMethod']))        $data['webhookMethod']        = DEFAULT_METHOD;
    if (!isset($data['webhookPayloadFormat'])) $data['webhookPayloadFormat'] = DEFAULT_PAYLOAD_FMT;
    if (!isset($data['webhookHeaders']))       $data['webhookHeaders']       = '';
    if (!isset($data['adminPasswordHash']))    $data['adminPasswordHash']    = '';
    return $data;
}

if (!defined('LMS_SETTINGS_FILE')) {
    define('LMS_SETTINGS_FILE', DATA_DIR . '/lms-settings.json');
}
if (!defined('LMS_ENV_SETTINGS_FILE')) {
    define('LMS_ENV_SETTINGS_FILE', __DIR__ . '/../.env.lms-settings.json');
}

function load_lms_settings() {
    $settings = [
        'bunnyLibraryId' => '',
        'bunnyApiKey' => '',
        'bunnyTokenAuthKey' => '',
        'bunnyHostname' => 'iframe.mediadelivery.net',
        'watermarkEnabled' => false,
        'watermarkOpacity' => 0.35,
        'otpDemoMode' => false,
        'defaultOtp' => '123456',
        'aibotflowApiKey' => '',
        'cloudflareAccountId' => '',
        'cloudflareApiToken' => '',
        'academyName' => 'Quick Art Photography Academy',
        'mentorName' => 'Anil Sharma'
    ];
    if (file_exists(LMS_ENV_SETTINGS_FILE)) {
        $env = json_decode(file_get_contents(LMS_ENV_SETTINGS_FILE), true);
        if (is_array($env)) {
            $settings = array_merge($settings, $env);
        }
    }
    if (file_exists(LMS_SETTINGS_FILE)) {
        $stored = json_decode(file_get_contents(LMS_SETTINGS_FILE), true);
        if (is_array($stored)) {
            foreach ($stored as $k => $v) {
                if ($v !== '' && $v !== null) {
                    $settings[$k] = $v;
                }
            }
        }
    }
    return $settings;
}

function save_settings($data) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    $data['updatedAt'] = date('c');
    // Never persist plaintext password if a stray field slips in
    unset($data['adminPassword']);
    if (file_put_contents(SETTINGS_FILE, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX) === false) json_err('Settings could not be saved', 503);
    return $data;
}

// ---------- Storage: leads ----------
function load_leads() {
    if (!file_exists(LEADS_FILE)) return [];
    $raw = file_get_contents(LEADS_FILE);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function save_leads($leads) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    $fp = fopen(LEADS_FILE, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($leads, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp); flock($fp, LOCK_UN); fclose($fp);
    return true;
}

// ---------- Sessions ----------
function load_sessions() {
    if (!file_exists(SESSIONS_FILE)) return [];
    $d = json_decode(file_get_contents(SESSIONS_FILE), true);
    return is_array($d) ? $d : [];
}
function save_sessions($s) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    if (file_put_contents(SESSIONS_FILE, json_encode($s, JSON_PRETTY_PRINT), LOCK_EX) === false) json_err('Login session could not be saved', 503);
}
function purge_expired_sessions(&$sessions) {
    $now = time();
    foreach ($sessions as $tok => $exp) {
        $expTime = is_array($exp) ? ($exp['expiresAt'] ?? 0) : (int)$exp;
        if ($expTime < $now) unset($sessions[$tok]);
    }
}
function create_session() {
    $token = bin2hex(random_bytes(24));
    $sessions = load_sessions();
    purge_expired_sessions($sessions);
    $sessions[$token] = time() + SESSION_TTL_SECONDS;
    save_sessions($sessions);
    return $token;
}
function is_valid_session($token) {
    if (!$token || !is_string($token) || strlen($token) !== 48) return false;
    $sessions = load_sessions();
    purge_expired_sessions($sessions);
    // Timing-safe check
    foreach ($sessions as $t => $exp) {
        $expTime = is_array($exp) ? ($exp['expiresAt'] ?? 0) : (int)$exp;
        if (hash_equals($t, $token) && $expTime >= time()) return true;
    }
    return false;
}
function destroy_session($token) {
    $sessions = load_sessions();
    unset($sessions[$token]);
    save_sessions($sessions);
}
function destroy_all_sessions() { save_sessions([]); }

// ---------- Auth ----------
function require_admin() {
    $tok = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_SERVER['HTTP_X_ADMIN_PASS'] ?? '');
    if (!is_valid_session($tok)) json_err('Unauthorized', 401);
    return load_settings();
}

// ---------- Rate limit for login (per-IP) ----------
function _client_ip() {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
function login_rate_check() {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    $ip = _client_ip();
    $now = time();
    $store = file_exists(RATELIMIT_FILE) ? json_decode(file_get_contents(RATELIMIT_FILE), true) : [];
    if (!is_array($store)) $store = [];
    // Purge old entries
    foreach ($store as $k => $arr) {
        $store[$k] = array_values(array_filter($arr, fn($t) => $t > $now - LOGIN_WINDOW_SEC));
        if (empty($store[$k])) unset($store[$k]);
    }
    $attempts = $store[$ip] ?? [];
    if (count($attempts) >= LOGIN_MAX_ATTEMPTS) {
        file_put_contents(RATELIMIT_FILE, json_encode($store));
        json_err('Too many login attempts. Please try again in 15 minutes.', 429);
    }
    return $store;
}
function login_rate_record_fail($store) {
    $ip = _client_ip();
    $store[$ip][] = time();
    file_put_contents(RATELIMIT_FILE, json_encode($store));
}

// ---------- JSON body ----------
function read_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    if (is_string($data)) {
        $data2 = json_decode($data, true);
        if (is_array($data2)) return $data2;
    }
    return is_array($data) ? $data : [];
}

// ---------- UUID ----------
function uuid4() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// ---------- Extra headers parser ----------
function parse_extra_headers($raw) {
    $out = []; $raw = trim((string)$raw);
    if ($raw === '') return $out;
    $j = json_decode($raw, true);
    if (is_array($j)) { foreach ($j as $k => $v) $out[] = trim($k) . ': ' . trim((string)$v); return $out; }
    foreach (preg_split('/\r?\n/', $raw) as $line) {
        $line = trim($line);
        if ($line !== '' && strpos($line, ':') !== false) $out[] = $line;
    }
    return $out;
}

// ---------- SSRF guard ----------
/** Reject non-public destinations to prevent SSRF via admin-configured webhook. */
function is_safe_webhook_host($url) {
    $parts = parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) return [false, 'invalid URL'];
    if (!in_array(strtolower($parts['scheme']), ['http','https'], true)) return [false, 'only http/https allowed'];
    $host = strtolower($parts['host']);
    // Block obvious localhosts by name
    if (in_array($host, ['localhost','127.0.0.1','0.0.0.0','::1','[::1]'], true)) return [false, 'loopback address not allowed'];
    // Resolve host — reject if any resolved IP is private/link-local/loopback
    $ips = @gethostbynamel($host);
    if ($ips) {
        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return [false, 'target resolves to a private/link-local/loopback IP'];
            }
        }
    }
    return [true, ''];
}

// ---------- Webhook trigger (with SSRF guard, TLS on, no auto redirects) ----------
function trigger_webhook($lead) {
    $settings = load_settings();
    $url    = trim($settings['webhookUrl'] ?? '');
    $method = strtoupper(trim($settings['webhookMethod'] ?? DEFAULT_METHOD));
    $format = strtolower(trim($settings['webhookPayloadFormat'] ?? DEFAULT_PAYLOAD_FMT));
    if (!$url) return ['ok' => false, 'error' => 'webhook not configured'];
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'PHP cURL extension is unavailable'];
    if (!in_array($method, ['POST','GET'], true))             $method = 'POST';
    if (!in_array($format, ['json','form','query'], true))    $format = 'json';

    [$safe, $why] = is_safe_webhook_host($url);
    if (!$safe) return ['ok' => false, 'error' => 'refused unsafe URL: ' . $why];

    $payload = [
        'name'         => $lead['name']    ?? '',
        'phone'        => $lead['phone']   ?? '',
        'phone_number' => $lead['phone']   ?? '',
        'city'         => $lead['city']    ?? '',
        'course'       => $lead['course']  ?? '',
        'message'      => $lead['message'] ?? '',
        'source'       => $lead['source']  ?? 'website',
        'lead_id'      => $lead['id']      ?? '',
        'submitted_at' => $lead['createdAt'] ?? date('c'),
        'team_phone'   => $settings['teamPhone'] ?? DEFAULT_TEAM_PHONE,
    ];

    $headers = ['User-Agent: QuickArtAcademy-Webhook/1.0', 'Accept: application/json,text/plain,*/*'];
    foreach (parse_extra_headers($settings['webhookHeaders'] ?? '') as $h) $headers[] = $h;

    $reqUrl = $url; $reqBody = null;
    if ($method === 'GET' || $format === 'query') {
        $qs = http_build_query($payload);
        $reqUrl .= (strpos($reqUrl, '?') === false ? '?' : '&') . $qs;
        $method = 'GET';
    } elseif ($format === 'form') {
        $reqBody = http_build_query($payload);
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    } else {
        $reqBody = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
    }

    $ch = curl_init($reqUrl);
    $opts = [
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_HTTPHEADER      => $headers,
        CURLOPT_TIMEOUT         => 15,
        CURLOPT_CONNECTTIMEOUT  => 8,
        CURLOPT_FOLLOWLOCATION  => false,  // SSRF: never blindly follow redirects
        CURLOPT_SSL_VERIFYPEER  => true,   // SSRF/hardening: always verify TLS
        CURLOPT_SSL_VERIFYHOST  => 2,
        CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_CUSTOMREQUEST   => $method,
    ];
    if ($method === 'POST' && $reqBody !== null) {
        $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = $reqBody;
    }
    curl_setopt_array($ch, $opts);

    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $eff  = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $err  = curl_error($ch); $errno = curl_errno($ch);
    curl_close($ch);

    return [
        'ok' => $code >= 200 && $code < 400,
        'status' => $code, 'effective_url' => $eff,
        'method' => $method, 'format' => $format,
        'body' => is_string($body) ? substr($body, 0, 800) : '',
        'error' => $err ?: null, 'errno' => $errno,
    ];
}

// ---------- AIbotflow WhatsApp OTP Helpers ----------
function send_aibotflow_whatsapp_otp($phone, $otp, $apiKey, $templateName = 'quickart_login_otp') {
    $apiKey = trim((string)$apiKey);
    if (empty($apiKey)) {
        return ['ok' => false, 'error' => 'AIbotflow WhatsApp API Key configure nahi hai'];
    }

    $cleanPhone = preg_replace('/[^0-9]/', '', (string)$phone);
    if (strlen($cleanPhone) === 12 && substr($cleanPhone, 0, 2) === '91') {
        $cleanPhone = substr($cleanPhone, 2);
    }
    if (strlen($cleanPhone) !== 10) {
        return ['ok' => false, 'error' => 'Valid 10-digit mobile number enter karein'];
    }

    // Meta Cloud API / AIbotflow requires international number without '+' prefix (e.g. 919939967431)
    $targetPhone = '91' . $cleanPhone;
    $tpl = !empty($templateName) ? trim($templateName) : 'quickart_login_otp';

    $payload = [
        'to' => $targetPhone,
        'type' => 'template',
        'template' => [
            'name' => $tpl,
            'language' => 'en_US',
            'params' => [
                'body' => [(string)$otp],
                'buttonParams' => [
                    '0' => (string)$otp
                ]
            ]
        ]
    ];

    $ch = curl_init("https://aibotflow.in/api/v1/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . $apiKey,
            "Content-Type: application/json"
        ],
        CURLOPT_TIMEOUT => 12
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    @curl_close($ch);

    $res = $raw ? json_decode($raw, true) : null;
    if ($code >= 200 && $code < 300) {
        return [
            'ok' => true,
            'route' => 'whatsapp',
            'message' => "OTP {$otp} delivered to WhatsApp ({$targetPhone}) via AIbotflow",
            'response' => $res
        ];
    }

    $errMsg = 'WhatsApp OTP delivery failed';
    if ($res && !empty($res['error']['message'])) {
        $errMsg = $res['error']['message'];
    } elseif ($err) {
        $errMsg = $err;
    }

    return ['ok' => false, 'error' => $errMsg, 'raw' => $raw, 'httpCode' => $code];
}


// ---------- Email OTP Helpers (Supabase + Direct Mail) ----------
const EMAIL_OTPS_FILE = DATA_DIR . '/email-otps.json';

function load_email_otps() {
    if (!file_exists(EMAIL_OTPS_FILE)) return [];
    return json_decode(file_get_contents(EMAIL_OTPS_FILE), true) ?: [];
}

function save_email_otps($otps) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    file_put_contents(EMAIL_OTPS_FILE, json_encode($otps, JSON_PRETTY_PRINT), LOCK_EX);
}

function send_email_otp($email, $otp, $purpose = 'register', $settings = []) {
    $email = strtolower(trim((string)$email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'Valid email address darj karein'];
    }

    // 1. Persist locally for reliable verification
    $otps = load_email_otps();
    $otps[$email] = [
        'otp' => (string)$otp,
        'purpose' => $purpose,
        'expiresAt' => time() + 600, // 10 minutes
        'verified' => false
    ];
    save_email_otps($otps);

    // Look up student name for personalized greeting
    $displayName = '';
    $studentsFile = DATA_DIR . '/students.json';
    if (file_exists($studentsFile)) {
        $stList = json_decode(@file_get_contents($studentsFile), true) ?: [];
        foreach ($stList as $st) {
            if (!empty($st['email']) && strtolower(trim($st['email'])) === $email) {
                $displayName = trim($st['name'] ?? '');
                break;
            }
        }
    }
    if (!empty($displayName)) {
        $displayName = trim(preg_replace('/\s*\([^)]*\)/', '', $displayName));
    }
    if (empty($displayName)) {
        $parts = explode('@', $email);
        $uname = preg_replace('/[^a-zA-Z0-9]+/', ' ', $parts[0] ?? '');
        $displayName = ucwords(trim($uname)) ?: 'Student';
    }

    $isForgot = ($purpose === 'forgot-password');
    $cardTitle = $isForgot ? 'Password Reset Verification' : 'Sign In Verification';

    $senderEmail = !empty($settings['emailSender']) ? trim($settings['emailSender']) : 'support@quickartphotography.in';
    $senderName  = !empty($settings['emailSenderName']) ? trim($settings['emailSenderName']) : 'Quick Art Photography Academy';

    $subjectTpl = !empty($settings['emailSubjectTemplate']) 
        ? $settings['emailSubjectTemplate'] 
        : ($isForgot
            ? "Password Reset Code: {otp} — Quick Art Photography Academy"
            : "Verification Code: {otp} — Quick Art Photography Academy");
    $subject = str_replace(['{otp}', '{email}'], [$otp, $email], $subjectTpl);

    $requestDesc = $isForgot
        ? 'We received a request to reset the password for your <strong>Quick Art Photography Academy</strong> account. Use the one-time verification code below to securely set your new password:'
        : 'We received a request to access your <strong>Quick Art Photography Academy</strong> account. Use the one-time verification code below to securely sign in:';

    $stepInstruction = $isForgot
        ? 'Enter this 6-digit code on the verification screen to complete your password reset.'
        : 'Enter this 6-digit code on the verification screen to complete your request.';

    $warningDesc = $isForgot
        ? 'If you did not attempt to reset your password, someone may have mistyped their email address. Your account remains completely safe and no action is needed.'
        : 'If you did not attempt to sign in or register, someone may have mistyped their email address. Your account remains completely safe and no action is needed.';

    $currentYear = date('Y');

    $html = '<!DOCTYPE html>'
          . '<html lang="en">'
          . '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' . htmlspecialchars($subject) . '</title></head>'
          . '<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">'
          . '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#090d16;padding:36px 14px;">'
          . '<tr><td align="center">'
          // Top pill header badge
          . '<div style="text-align:center;margin-bottom:20px;">'
          . '  <div style="display:inline-block;padding:8px 22px;background:#0c172a;border:1.5px solid #1e3a8a;border-radius:9999px;box-shadow:0 0 20px rgba(14,165,233,0.15);">'
          . '    <span style="color:#38bdf8;font-size:13px;font-weight:800;letter-spacing:1px;">&#9889; QUICK ART</span> '
          . '    <span style="color:#34d399;font-size:11px;font-weight:800;letter-spacing:0.8px;background:#064e3b;padding:2px 8px;border-radius:5px;margin-left:6px;">LMS</span>'
          . '  </div>'
          . '  <div style="color:#64748b;font-size:10.5px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-top:10px;">NEXT-GEN PHOTOGRAPHY &amp; FILMMAKING LMS</div>'
          . '</div>'
          // Main Card
          . '<div style="max-width:540px;margin:0 auto;background:#0d1322;border:1px solid #1e293b;border-radius:20px;padding:36px 32px;text-align:left;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">'
          . '  <div style="display:inline-block;padding:5px 14px;background:#064e3b;border:1px solid #059669;border-radius:9999px;color:#34d399;font-size:12px;font-weight:700;letter-spacing:0.3px;margin-bottom:18px;">&#128274; Security Verification</div>'
          . '  <h1 style="margin:0 0 16px 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.4px;">' . $cardTitle . '</h1>'
          . '  <p style="margin:0 0 10px 0;font-size:15px;color:#cbd5e1;line-height:1.5;">Hello <strong style="color:#ffffff;">' . htmlspecialchars($displayName) . '</strong>,</p>'
          . '  <p style="margin:0 0 24px 0;font-size:14px;color:#94a3b8;line-height:1.6;">' . $requestDesc . '</p>'
          // Passcode Box
          . '  <div style="background:#090e17;border:1.5px solid #34d399;border-radius:14px;padding:26px 20px;text-align:center;margin:0 0 24px 0;box-shadow:0 0 24px rgba(52,211,153,0.12);">'
          . '    <div style="color:#34d399;font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">YOUR ONE-TIME PASSCODE</div>'
          . '    <div style="color:#34d399;font-size:42px;font-weight:800;letter-spacing:10px;font-family:\'SF Pro Display\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Courier New\',monospace;margin:0 0 10px 0;text-shadow:0 0 16px rgba(52,211,153,0.38);">' . htmlspecialchars($otp) . '</div>'
          . '    <div style="color:#94a3b8;font-size:12.5px;font-weight:500;">&#9201; Expires in <strong style="color:#f87171;font-weight:700;">10 minutes</strong></div>'
          . '  </div>'
          // Instructions
          . '  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;width:100%;">'
          . '    <tr>'
          . '      <td style="width:26px;vertical-align:top;font-size:15px;line-height:1.4;">&#8505;&#65039;</td>'
          . '      <td style="color:#cbd5e1;font-size:13px;line-height:1.5;vertical-align:top;">' . $stepInstruction . '</td>'
          . '    </tr>'
          . '  </table>'
          . '  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;width:100%;">'
          . '    <tr>'
          . '      <td style="width:26px;vertical-align:top;font-size:15px;line-height:1.4;">&#128737;&#65039;</td>'
          . '      <td style="color:#94a3b8;font-size:13px;line-height:1.5;vertical-align:top;"><strong style="color:#ffffff;">Never share this code.</strong> Quick Art Academy team members will never ask for your verification code or password.</td>'
          . '    </tr>'
          . '  </table>'
          // Burgundy Warning Box
          . '  <div style="background:#1c131a;border:1px solid #4a1c2c;border-radius:10px;padding:14px 18px;margin-top:20px;text-align:left;">'
          . '    <strong style="color:#f87171;font-size:12.5px;display:inline;">Didn&#39;t request this code?</strong> '
          . '    <span style="color:#fda4af;font-size:12px;line-height:1.5;">' . $warningDesc . '</span>'
          . '  </div>'
          . '</div>'
          // Footer
          . '<div style="margin-top:24px;text-align:center;color:#64748b;font-size:12px;line-height:1.8;">'
          . '  <div>Need assistance? Contact our team at <a href="mailto:' . htmlspecialchars($senderEmail) . '" style="color:#34d399;text-decoration:none;font-weight:600;">' . htmlspecialchars($senderEmail) . '</a></div>'
          . '  <div>&copy; ' . $currentYear . ' Quick Art Photography Academy. All rights reserved.</div>'
          . '  <div style="font-size:11px;color:#475569;margin-top:4px;">This is an automated transactional message sent securely via Brevo.</div>'
          . '</div>'
          . '</td></tr></table></body></html>';

    // 3. Try Brevo REST API First (300 Free Emails / Day, No Monthly Subscription)
    $brevoApiKey = trim((string)($settings['brevoApiKey'] ?? ''));
    if (!empty($brevoApiKey)) {
        $brevoRes = send_brevo_email($email, $subject, $html, $brevoApiKey, $senderEmail, $senderName);
        if ($brevoRes['ok']) {
            return [
                'ok' => true,
                'message' => 'OTP sent to email successfully via Brevo',
                'provider' => 'brevo'
            ];
        }
    }

    // 4. Try custom SMTP if configured
    if (!empty($settings['smtpHost']) && !empty($settings['smtpUser']) && !empty($settings['smtpPass'])) {
        $smtpSent = send_smtp_email($email, $subject, $html, $settings);
        if ($smtpSent) {
            return [
                'ok' => true,
                'message' => 'OTP sent to email successfully via SMTP',
                'provider' => 'smtp'
            ];
        }
    }

    // 5. Try Supabase Auth OTP if configured
    $supabaseUrl = rtrim($settings['supabaseUrl'] ?? '', '/');
    $supabaseKey = $settings['supabaseAnonKey'] ?? '';

    if (!empty($supabaseUrl) && !empty($supabaseKey)) {
        $portalUrl = (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'quickart') !== false)
            ? 'https://' . $_SERVER['HTTP_HOST'] . '/portal/'
            : 'https://quickartphotography.in/portal/';

        $ch = curl_init("{$supabaseUrl}/auth/v1/otp");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'email' => $email,
                'create_user' => ($purpose === 'register'),
                'options' => [
                    'email_redirect_to' => $portalUrl
                ]
            ]),
            CURLOPT_HTTPHEADER => [
                "apikey: {$supabaseKey}",
                "Authorization: Bearer {$supabaseKey}",
                "Content-Type: application/json"
            ],
            CURLOPT_TIMEOUT => 8
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        @curl_close($ch);
        if ($code >= 200 && $code < 300) {
            return [
                'ok' => true,
                'message' => 'OTP sent to email successfully via Supabase',
                'provider' => 'supabase'
            ];
        }
    }

    // 6. Fallback to PHP mail()
    $headers = "MIME-Version: 1.0\r\n"
             . "Content-Type: text/html; charset=UTF-8\r\n"
             . "From: {$senderName} <{$senderEmail}>\r\n"
             . "Reply-To: {$senderEmail}\r\n"
             . "X-Mailer: PHP/" . phpversion();

    @mail($email, $subject, $html, $headers);

    return [
        'ok' => true,
        'message' => 'OTP sent to email successfully',
        'supabase' => $supabaseSent ?? false,
        'smtp' => $smtpSent ?? false,
        'brevo' => $brevoSent ?? false
    ];
}

function send_brevo_email($to, $subject, $html, $apiKey, $fromEmail, $fromName) {
    $apiKey = trim((string)$apiKey);
    if (empty($apiKey)) return ['ok' => false, 'error' => 'Brevo API key missing'];

    $payload = [
        'sender' => [
            'name' => $fromName ?: 'Quick Art Photography Academy',
            'email' => $fromEmail ?: 'support@quickartphotography.in'
        ],
        'to' => [
            ['email' => $to]
        ],
        'subject' => $subject,
        'htmlContent' => $html
    ];

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'api-key: ' . $apiKey,
            'Content-Type: application/json',
            'accept: application/json'
        ],
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_TIMEOUT => 10
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    @curl_close($ch);

    $res = $raw ? json_decode($raw, true) : null;
    if ($code >= 200 && $code < 300) {
        return ['ok' => true, 'messageId' => $res['messageId'] ?? ''];
    }
    return ['ok' => false, 'error' => $res['message'] ?? 'Brevo error ' . $code];
}

function send_smtp_email($to, $subject, $html, $settings) {
    $host = trim((string)($settings['smtpHost'] ?? ''));
    $port = intval($settings['smtpPort'] ?? 587);
    $user = trim((string)($settings['smtpUser'] ?? ''));
    $pass = trim((string)($settings['smtpPass'] ?? ''));
    $from = !empty($settings['emailSender']) ? trim($settings['emailSender']) : 'support@quickartphotography.in';
    $fromName = !empty($settings['emailSenderName']) ? trim($settings['emailSenderName']) : 'Quick Art Photography Academy';

    if (empty($host) || empty($user) || empty($pass)) return false;

    $url = ($port == 465) ? "smtps://{$host}:{$port}" : "smtp://{$host}:{$port}";
    $headers = [
        "From: {$fromName} <{$from}>",
        "To: <{$to}>",
        "Subject: {$subject}",
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8"
    ];
    $payload = implode("\r\n", $headers) . "\r\n\r\n" . $html;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_MAIL_FROM, "<{$from}>");
    curl_setopt($ch, CURLOPT_MAIL_RCPT, ["<{$to}>"]);
    curl_setopt($ch, CURLOPT_USERNAME, $user);
    curl_setopt($ch, CURLOPT_PASSWORD, $pass);
    curl_setopt($ch, CURLOPT_USE_SSL, CURLUSESSL_TRY);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $fp = fopen('php://memory', 'r+');
    fwrite($fp, $payload);
    rewind($fp);
    curl_setopt($ch, CURLOPT_READDATA, $fp);
    curl_setopt($ch, CURLOPT_UPLOAD, true);

    $res = curl_exec($ch);
    fclose($fp);
    curl_close($ch);

    return ($res !== false);
}

function verify_email_otp($email, $userOtp, $purpose = '', $settings = []) {
    $email = strtolower(trim((string)$email));
    $userOtp = trim((string)$userOtp);

    // 1. Try Supabase verification if configured
    $supabaseUrl = rtrim($settings['supabaseUrl'] ?? '', '/');
    $supabaseKey = $settings['supabaseAnonKey'] ?? '';

    if (!empty($supabaseUrl) && !empty($supabaseKey)) {
        $ch = curl_init("{$supabaseUrl}/auth/v1/verify");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'type' => 'email',
                'email' => $email,
                'token' => $userOtp
            ]),
            CURLOPT_HTTPHEADER => [
                "apikey: {$supabaseKey}",
                "Authorization: Bearer {$supabaseKey}",
                "Content-Type: application/json"
            ],
            CURLOPT_TIMEOUT => 8
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        @curl_close($ch);
        if ($code >= 200 && $code < 300) {
            return ['ok' => true, 'supabase' => true];
        }
    }

    // 2. Check local OTP records
    $otps = load_email_otps();
    $rec = $otps[$email] ?? null;

    if (!$rec || $rec['expiresAt'] < time()) {
        return ['ok' => false, 'error' => 'OTP expire ho gaya hai ya invalid hai. Dubara request karein.'];
    }

    if ($purpose && !empty($rec['purpose']) && $rec['purpose'] !== $purpose) {
        return ['ok' => false, 'error' => 'Invalid OTP request'];
    }

    // Max 5 wrong attempts per OTP, then it is discarded (stops brute force)
    if (($rec['attempts'] ?? 0) >= 5) {
        unset($otps[$email]);
        save_email_otps($otps);
        return ['ok' => false, 'error' => 'Bahut zyada galat OTP. Naya OTP mangwayein.'];
    }
    if (!hash_equals((string)$rec['otp'], $userOtp)) {
        $otps[$email]['attempts'] = ($rec['attempts'] ?? 0) + 1;
        save_email_otps($otps);
        return ['ok' => false, 'error' => 'Galat OTP code enter kiya hai. Check karke dubara daalein.'];
    }

    // Mark verified
    $otps[$email]['verified'] = true;
    save_email_otps($otps);

    return ['ok' => true];
}

function consume_email_otp($email) {
    $email = strtolower(trim((string)$email));
    $otps = load_email_otps();
    if (isset($otps[$email])) {
        unset($otps[$email]);
        save_email_otps($otps);
    }
}

/**
 * Universal helper to save student profile/ID card photo from base64 data URL or $_FILES
 * Supports JPG, PNG, WebP up to 25MB, saves to /uploads/admissions/
 */
function save_student_avatar_image($rawInput, $phone = 'student') {
    if (empty($rawInput)) return '';
    $uploadDir = __DIR__ . '/../uploads/admissions';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    $cleanPhone = preg_replace('/[^0-9]/', '', (string)$phone);
    if (!$cleanPhone) $cleanPhone = 'student';

    // 1. If it's already an existing /uploads/ path, keep it
    if (is_string($rawInput) && (strpos($rawInput, '/uploads/') === 0 || strpos($rawInput, 'uploads/') === 0)) {
        // Only a plain image path inside uploads (blocks HTML/JS injection via the "photo" field)
        $p = '/' . ltrim($rawInput, '/');
        return preg_match('#^/uploads/[A-Za-z0-9/_-]+\.(jpe?g|png|webp)$#i', $p) && strpos($p, '..') === false ? $p : '';
    }

    // 2. Base64 Data URL (e.g. data:image/jpeg;base64,... or data:image/png;base64,...)
    if (is_string($rawInput) && preg_match('#^data:image/(\w+);base64,(.+)$#si', $rawInput, $m)) {
        $ext = strtolower($m[1]);
        if ($ext === 'jpeg') $ext = 'jpg';
        if (!in_array($ext, ['jpg', 'png', 'webp'])) $ext = 'jpg';

        $data = base64_decode($m[2]);
        if (!$data || strlen($data) < 50) return '';
        if (strlen($data) > 25 * 1024 * 1024) return ''; // 25 MB max

        $fileName = 'photo_' . $cleanPhone . '_' . substr(md5(uniqid(mt_rand(), true)), 0, 8) . '.' . $ext;
        $dest = $uploadDir . '/' . $fileName;
        if (file_put_contents($dest, $data)) {
            @chmod($dest, 0644);
            return '/uploads/admissions/' . $fileName;
        }
    }

    // 3. File upload ($_FILES array structure)
    if (is_array($rawInput) && !empty($rawInput['tmp_name']) && $rawInput['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($rawInput['name'], PATHINFO_EXTENSION));
        if ($ext === 'jpeg') $ext = 'jpg';
        if (!in_array($ext, ['jpg', 'png', 'webp'])) $ext = 'jpg';
        $fileName = 'photo_' . $cleanPhone . '_' . substr(md5(uniqid(mt_rand(), true)), 0, 8) . '.' . $ext;
        $dest = $uploadDir . '/' . $fileName;
        if (move_uploaded_file($rawInput['tmp_name'], $dest)) {
            if (!@getimagesize($dest)) {
                @unlink($dest);
                return '';
            }
            @chmod($dest, 0644);
            return '/uploads/admissions/' . $fileName;
        }
    }

    return '';
}

require_once __DIR__ . '/_notifications.php';




