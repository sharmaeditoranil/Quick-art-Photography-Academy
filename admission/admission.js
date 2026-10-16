// admission/admission.js — Offline Admission Form Script
// 28-Sep-2026: Facebook + Google conversion tracking (qaTrackAdmission) add kiya + inputPhone fix

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('offline-admission-form');
  var submitBtn = document.getElementById('btn-submit-admission');
  var statusBox = document.getElementById('adm-status-msg');

  var previewImg = document.getElementById('photo-preview-img');
  var inputName = document.getElementById('adm-name');
  var inputPhoto = document.getElementById('adm-photo');
  var inputAadhaar = document.getElementById('adm-aadhaar');
  var inputCert = document.getElementById('adm-cert');
  var inputPhone = document.getElementById('adm-phone');
  var inputEmail = document.getElementById('adm-email');
  var inputStudio = document.getElementById('adm-studio');
  var inputCity = document.getElementById('adm-city');
  var inputBlood = document.getElementById('adm-bloodgroup');

  // File size limits: Allow smartphone camera photos up to 25 MB (Auto-compressed via canvas to under 150 KB)
  var MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB
  var MAX_DOC_BYTES = 25 * 1024 * 1024;   // 25 MB

  // In-memory optimized Blobs for upload
  var processedPhotoFile = null;
  var processedAadhaarFile = null;
  var processedCertFile = null;
  var studentUploadedPhotoDataUrl = null;

  // Verification state flags
  var isPhoneVerified = false;
  var isEmailVerified = false;

  // 🚀 Dynamic Batch Enrollment Handler (?batch=114, ?b=115, ?course=...)
  function initDynamicBatchMode() {
    try {
      var params = new URLSearchParams(window.location.search);
      var rawBatch = params.get('batch') || params.get('b') || params.get('course') || params.get('c');
      if (!rawBatch) return;

      rawBatch = rawBatch.trim();
      var batchNum = '';
      var numMatch = rawBatch.match(/\b(\d+)\b/);
      if (numMatch) {
        batchNum = numMatch[1];
      }

      var formattedTitle = rawBatch;
      if (/^\d+$/.test(rawBatch)) {
        formattedTitle = 'Advanced Wedding Filmmaking – Batch ' + rawBatch;
      } else if (!rawBatch.match(/wedding|filmmaking|editing|photography|cinematography|masterclass/i) && batchNum) {
        formattedTitle = 'Advanced Wedding Filmmaking – Batch ' + batchNum;
      }

      // Update Course Select element
      var courseSelect = document.getElementById('adm-course');
      if (courseSelect) {
        // Check if option already exists
        var exists = false;
        for (var i = 0; i < courseSelect.options.length; i++) {
          if (courseSelect.options[i].value.toLowerCase() === formattedTitle.toLowerCase()) {
            courseSelect.selectedIndex = i;
            exists = true;
            break;
          }
        }
        if (!exists) {
          var opt = document.createElement('option');
          opt.value = formattedTitle;
          opt.textContent = '⭐ ' + formattedTitle + ' (Exclusive Enrolled Batch)';
          opt.selected = true;
          courseSelect.insertBefore(opt, courseSelect.firstChild);
          courseSelect.selectedIndex = 0;
        }
        // Lock select visually but keep enabled for form submission
        courseSelect.style.pointerEvents = 'none';
        courseSelect.style.background = 'rgba(217, 119, 6, 0.12)';
        courseSelect.style.borderColor = 'rgba(217, 119, 6, 0.55)';
        courseSelect.style.color = '#fbbf24';
        courseSelect.style.fontWeight = '700';
      }

      // Show and populate Batch Hero Banner
      var batchHero = document.getElementById('adm-batch-hero');
      var batchTitleEl = document.getElementById('adm-batch-hero-title');
      var batchPillEl = document.getElementById('adm-batch-pill');
      var batchSubEl = document.getElementById('adm-batch-hero-sub');

      if (batchHero) {
        batchHero.style.display = 'flex';
      }
      if (batchTitleEl) {
        batchTitleEl.textContent = formattedTitle;
      }
      if (batchPillEl) {
        batchPillEl.textContent = batchNum ? ('BATCH #' + batchNum) : 'ONLINE BATCH';
      }
      if (batchSubEl) {
        batchSubEl.textContent = 'Official Direct Batch Admission. Form submit hone ke baad Academy Admin approval milte hi Live Batch Classroom & ID Card unlock ho jayega.';
      }

      // Update Form Titles & Kicker for Online batch context
      var kicker = document.getElementById('adm-kicker-label');
      if (kicker) kicker.textContent = 'OFFICIAL ONLINE BATCH ENROLLMENT';

      var mainTitle = document.getElementById('adm-main-title');
      if (mainTitle) mainTitle.textContent = formattedTitle + ' — Registration';

      var mainDesc = document.getElementById('adm-main-desc');
      if (mainDesc) mainDesc.textContent = 'Please enter accurate student details for official Identity Card, Roll Number & Student Portal access.';

      // Hide campus hostel question since this is an online batch
      var hostelSelect = document.getElementById('adm-hostel');
      if (hostelSelect) {
        hostelSelect.value = 'no';
        var hostelField = hostelSelect.closest('.adm-field');
        if (hostelField) {
          hostelField.style.display = 'none';
        }
      }

      // Update trust badges strip for online live batches
      var trustStrip = document.querySelector('.adm-trust-badges-bar');
      if (trustStrip) {
        var items = trustStrip.querySelectorAll('.adm-trust-badge-item');
        if (items && items.length >= 3) {
          items[2].innerHTML = '<span class="adm-trust-icon">📡</span><div><strong>100% Online Live Class</strong><span>Attend Live on Mobile / PC</span></div>';
        }
      }

      // Mark online batch mode for KYC & ID card issuance
      window.isOnlineBatchMode = true;
      window.dynamicBatchNum = batchNum || '';

      // Update Section 5 payment / enrollment title & options for online batch context
      var payBlock = document.querySelector('.adm-payment-block');
      if (payBlock) {
        var pTitle = payBlock.querySelector('h3');
        if (pTitle) pTitle.textContent = 'Batch KYC Registration & PVC Identity Card';
        var pSub = payBlock.querySelector('small');
        if (pSub) pSub.textContent = 'Form submit hone par Admin approval ke baad aapka Live Batch Classroom aur ID Card unlock hoga.';
      }

      var feeCard = document.querySelector('.adm-fee-summary-card');
      if (feeCard) {
        feeCard.innerHTML = `
          <div class="adm-fee-row">
            <span>Official Batch Enrollment Status:</span>
            <strong style="color:#10b981;">CONFIRMED / VERIFIED BATCH</strong>
          </div>
          <div class="adm-fee-row adm-fee-muted">
            <span>Classroom Access &amp; ID Card:</span>
            <span style="color:#fbbf24;">Admin Approval ke baad unlock</span>
          </div>
        `;
      }

      var payOptions = document.querySelector('.adm-pay-options');
      if (payOptions) {
        payOptions.innerHTML = `
          <label class="adm-pay-choice">
            <input type="radio" name="paymentMode" value="online_batch_direct" checked>
            <div class="adm-choice-box">
              <div class="adm-choice-header">
                <strong>⚡ Batch Registration (Pending Admin Approval)</strong>
                <span class="adm-badge-instant">OFFICIAL BATCH</span>
              </div>
              <p>Registration submit hone ke baad Academy Admin approval dete hi aapka Live Class &amp; Official ID Card activate hoga.</p>
            </div>
          </label>
          <label class="adm-pay-choice">
            <input type="radio" name="paymentMode" value="already_paid">
            <div class="adm-choice-box">
              <div class="adm-choice-header">
                <strong>💬 Fee Already Paid to Academy (UPI / QR / WhatsApp)</strong>
              </div>
              <p>Course fee WhatsApp / Bank transfer se pehle hi pay ho chuki hai. Details verify karke official Roll Number issue karein.</p>
            </div>
          </label>
        `;
      }

      // Optional URL parameter for custom registration fee e.g. ?fee=0 or ?fee=500
      var paramFee = params.get('fee');
      if (paramFee !== null) {
        var feeVal = parseInt(paramFee, 10);
        if (!isNaN(feeVal)) {
          var feeBadgeVal = document.getElementById('adm-fee-badge-val');
          if (feeBadgeVal) feeBadgeVal.textContent = feeVal > 0 ? ('₹' + feeVal) : 'FREE';
        }
      }

    } catch (e) {
      if (window.console) console.warn('Error in initDynamicBatchMode:', e);
    }
  }

  // Execute dynamic batch setup on load
  initDynamicBatchMode();

  // Helper: Auto-compress high-res mobile images to lightweight JPEG under 300 KB
  function compressImage(file, maxDimension, quality, callback) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0 || file.type === 'image/svg+xml') {
      callback(file);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (blob && (blob.size < file.size || file.size > 800 * 1024)) {
            var compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            callback(compressedFile);
          } else {
            callback(file);
          }
        }, 'image/jpeg', quality || 0.85);
      };
      img.onerror = function () { callback(file); };
      img.src = e.target.result;
    };
    reader.onerror = function () { callback(file); };
    reader.readAsDataURL(file);
  }

  // 1. Photo file preview with instant base64 reader & auto-compression (Under 120 KB)
  if (inputPhoto) {
    inputPhoto.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        var file = this.files[0];
        if (file.size > MAX_PHOTO_BYTES) {
          alert('Photo ka size 25 MB se adhik hai (' + Math.round(file.size / (1024 * 1024)) + ' MB)। Kripya 25 MB se chhota photo select karein.');
          this.value = '';
          return;
        }

        // 0. Synchronously set preview immediately (0ms) so there is zero delay
        try {
          var objectUrl = URL.createObjectURL(file);
          if (previewImg) previewImg.src = objectUrl;
          var issuedPhotoSync = document.getElementById('issued-id-photo');
          if (issuedPhotoSync) issuedPhotoSync.src = objectUrl;
        } catch (e) {}

        // 1. Immediately read user photo as base64 DataURL for instant live preview on UI & ID card
        var instantReader = new FileReader();
        instantReader.onload = function (e) {
          studentUploadedPhotoDataUrl = e.target.result;
          if (previewImg) previewImg.src = e.target.result;
          var issuedPhoto = document.getElementById('issued-id-photo');
          if (issuedPhoto) issuedPhoto.src = e.target.result;
          try {
            localStorage.setItem('qaa_student_avatar', e.target.result);
          } catch (err) {}
        };
        instantReader.readAsDataURL(file);

        // 2. Also compress in background for ultra-lightweight server upload (~80-120 KB)
        compressImage(file, 640, 0.78, function (compressed) {
          processedPhotoFile = compressed;
        });
      }
    });
  }

  // 2. Document file size checks (Max 2 MB) with auto-compression for Aadhaar & Certificate (~150-200 KB)
  function attachFileSizeCheck(inputEl, labelId, docName, setProcessed) {
    if (!inputEl) return;
    inputEl.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        var file = this.files[0];
        if (file.size > MAX_DOC_BYTES) {
          alert(docName + ' ka file size 25 MB se bada hai (' + (file.size / (1024 * 1024)).toFixed(1) + ' MB)। Kripya 25 MB se chhota photo ya PDF upload karein.');
          this.value = '';
          var label = document.getElementById(labelId);
          if (label) label.textContent = 'Click to upload ' + docName + ' (Max 25 MB)';
          return;
        }
        var label = document.getElementById(labelId);
        if (file.type && file.type.indexOf('image/') === 0) {
          if (label) label.textContent = '⏳ Optimizing ' + docName + '…';
          compressImage(file, 1200, 0.75, function (compressed) {
            setProcessed(compressed);
            if (label) label.textContent = '✓ ' + file.name + ' (' + Math.round(compressed.size / 1024) + ' KB ready)';
          });
        } else {
          setProcessed(file);
          if (label) label.textContent = '✓ ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
        }
      }
    });
  }
  attachFileSizeCheck(inputAadhaar, 'aadhaar-label', 'Aadhaar Card', function (f) { processedAadhaarFile = f; });
  attachFileSizeCheck(inputCert, 'cert-label', 'Education Certificate', function (f) { processedCertFile = f; });

  // --- 3. WhatsApp Number OTP Verification ---
  var btnSendPhoneOtp = document.getElementById('btn-send-phone-otp');
  var boxPhoneOtp = document.getElementById('box-phone-otp');
  var inputPhoneOtp = document.getElementById('adm-phone-otp');
  var btnSubmitPhoneOtp = document.getElementById('btn-submit-phone-otp');
  var btnResendPhoneOtp = document.getElementById('btn-resend-phone-otp');
  var phoneOtpMsg = document.getElementById('phone-otp-msg');
  var badgePhoneVerified = document.getElementById('badge-phone-verified');
  var devPhoneOtpPill = document.getElementById('dev-phone-otp-pill');
  var devPhoneOtpVal = document.getElementById('dev-phone-otp-val');

  function sendPhoneOtp() {
    var phone = inputPhone ? inputPhone.value.trim().replace(/\D/g, '') : '';
    if (phone.length !== 10) {
      alert('Kripya 10-digit valid WhatsApp mobile number enter karein.');
      if (inputPhone) inputPhone.focus();
      return;
    }

    if (btnSendPhoneOtp) {
      btnSendPhoneOtp.disabled = true;
      btnSendPhoneOtp.textContent = 'Sending OTP…';
    }
    if (phoneOtpMsg) {
      phoneOtpMsg.textContent = 'Sending OTP to WhatsApp…';
      phoneOtpMsg.className = 'adm-otp-msg';
    }

    fetch('../api/lms.php?action=send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          throw new Error(data.error || 'WhatsApp OTP bhejne me dikkat aayi.');
        }
        if (boxPhoneOtp) boxPhoneOtp.style.display = 'flex';
        if (inputPhoneOtp) {
          inputPhoneOtp.value = '';
          inputPhoneOtp.focus();
        }

        if (data.devOtp && devPhoneOtpPill && devPhoneOtpVal) {
          devPhoneOtpVal.textContent = data.devOtp;
          devPhoneOtpPill.style.display = 'inline-block';
          if (inputPhoneOtp) inputPhoneOtp.value = data.devOtp;
        }

        if (phoneOtpMsg) {
          phoneOtpMsg.textContent = '✓ OTP WhatsApp (+91 ' + phone + ') par bhej diya gaya hai!';
          phoneOtpMsg.className = 'adm-otp-msg is-success';
        }
        startPhoneResendTimer();
      })
      .catch(function (err) {
        if (phoneOtpMsg) {
          phoneOtpMsg.textContent = '✕ ' + err.message;
          phoneOtpMsg.className = 'adm-otp-msg is-error';
        }
        alert(err.message);
      })
      .finally(function () {
        if (btnSendPhoneOtp) {
          btnSendPhoneOtp.disabled = false;
          btnSendPhoneOtp.textContent = isPhoneVerified ? '✓ Verified' : 'Verify WhatsApp';
        }
      });
  }

  function startPhoneResendTimer() {
    if (!btnResendPhoneOtp) return;
    var sec = 30;
    btnResendPhoneOtp.disabled = true;
    btnResendPhoneOtp.textContent = 'Resend (' + sec + 's)';
    var interval = setInterval(function () {
      sec--;
      if (sec <= 0) {
        clearInterval(interval);
        btnResendPhoneOtp.disabled = false;
        btnResendPhoneOtp.textContent = 'Resend';
      } else {
        btnResendPhoneOtp.textContent = 'Resend (' + sec + 's)';
      }
    }, 1000);
  }

  if (btnSendPhoneOtp) btnSendPhoneOtp.addEventListener('click', sendPhoneOtp);
  if (btnResendPhoneOtp) btnResendPhoneOtp.addEventListener('click', sendPhoneOtp);

  if (btnSubmitPhoneOtp) {
    btnSubmitPhoneOtp.addEventListener('click', function () {
      var phone = inputPhone ? inputPhone.value.trim().replace(/\D/g, '') : '';
      var otp = inputPhoneOtp ? inputPhoneOtp.value.trim() : '';
      if (otp.length < 4) {
        alert('Kripya 6-digit OTP code enter karein.');
        if (inputPhoneOtp) inputPhoneOtp.focus();
        return;
      }

      btnSubmitPhoneOtp.disabled = true;
      btnSubmitPhoneOtp.textContent = 'Verifying…';

      fetch('../api/lms.php?action=verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, otp: otp })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.ok) {
            throw new Error(data.error || 'Galat ya expired OTP code.');
          }
          isPhoneVerified = true;
          if (boxPhoneOtp) boxPhoneOtp.style.display = 'none';
          if (badgePhoneVerified) badgePhoneVerified.style.display = 'inline-flex';
          if (inputPhone) {
            inputPhone.readOnly = true;
            inputPhone.style.background = '#f0fdf4';
          }
          if (btnSendPhoneOtp) {
            btnSendPhoneOtp.disabled = true;
            btnSendPhoneOtp.classList.add('is-verified');
            btnSendPhoneOtp.textContent = '✓ Verified';
          }
          if (phoneOtpMsg) phoneOtpMsg.textContent = '';
          showStatus('WhatsApp Number successfully verified!', 'info');
        })
        .catch(function (err) {
          if (phoneOtpMsg) {
            phoneOtpMsg.textContent = '✕ ' + err.message;
            phoneOtpMsg.className = 'adm-otp-msg is-error';
          }
          alert(err.message);
        })
        .finally(function () {
          btnSubmitPhoneOtp.disabled = false;
          btnSubmitPhoneOtp.textContent = 'Submit OTP';
        });
    });
  }

  // --- 4. Email OTP Verification ---
  var btnSendEmailOtp = document.getElementById('btn-send-email-otp');
  var boxEmailOtp = document.getElementById('box-email-otp');
  var inputEmailOtp = document.getElementById('adm-email-otp');
  var btnSubmitEmailOtp = document.getElementById('btn-submit-email-otp');
  var btnResendEmailOtp = document.getElementById('btn-resend-email-otp');
  var emailOtpMsg = document.getElementById('email-otp-msg');
  var badgeEmailVerified = document.getElementById('badge-email-verified');
  var devEmailOtpPill = document.getElementById('dev-email-otp-pill');
  var devEmailOtpVal = document.getElementById('dev-email-otp-val');

  function sendEmailOtp() {
    var email = inputEmail ? inputEmail.value.trim().toLowerCase() : '';
    if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
      alert('Kripya valid Email Address enter karein.');
      if (inputEmail) inputEmail.focus();
      return;
    }

    if (btnSendEmailOtp) {
      btnSendEmailOtp.disabled = true;
      btnSendEmailOtp.textContent = 'Sending OTP…';
    }
    if (emailOtpMsg) {
      emailOtpMsg.textContent = 'Sending OTP to email…';
      emailOtpMsg.className = 'adm-otp-msg';
    }

    fetch('../api/lms.php?action=send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, purpose: 'admission' })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          throw new Error(data.error || 'Email OTP bhejne me error aaya.');
        }
        if (boxEmailOtp) boxEmailOtp.style.display = 'flex';
        if (inputEmailOtp) {
          inputEmailOtp.value = '';
          inputEmailOtp.focus();
        }

        if (data.devOtp && devEmailOtpPill && devEmailOtpVal) {
          devEmailOtpVal.textContent = data.devOtp;
          devEmailOtpPill.style.display = 'inline-block';
          if (inputEmailOtp) inputEmailOtp.value = data.devOtp;
        }

        if (emailOtpMsg) {
          emailOtpMsg.textContent = '✓ OTP aapke email (' + email + ') par bhej diya gaya hai!';
          emailOtpMsg.className = 'adm-otp-msg is-success';
        }
        startEmailResendTimer();
      })
      .catch(function (err) {
        if (emailOtpMsg) {
          emailOtpMsg.textContent = '✕ ' + err.message;
          emailOtpMsg.className = 'adm-otp-msg is-error';
        }
        alert(err.message);
      })
      .finally(function () {
        if (btnSendEmailOtp) {
          btnSendEmailOtp.disabled = false;
          btnSendEmailOtp.textContent = isEmailVerified ? '✓ Verified' : 'Verify Email';
        }
      });
  }

  function startEmailResendTimer() {
    if (!btnResendEmailOtp) return;
    var sec = 30;
    btnResendEmailOtp.disabled = true;
    btnResendEmailOtp.textContent = 'Resend (' + sec + 's)';
    var interval = setInterval(function () {
      sec--;
      if (sec <= 0) {
        clearInterval(interval);
        btnResendEmailOtp.disabled = false;
        btnResendEmailOtp.textContent = 'Resend';
      } else {
        btnResendEmailOtp.textContent = 'Resend (' + sec + 's)';
      }
    }, 1000);
  }

  if (btnSendEmailOtp) btnSendEmailOtp.addEventListener('click', sendEmailOtp);
  if (btnResendEmailOtp) btnResendEmailOtp.addEventListener('click', sendEmailOtp);

  if (btnSubmitEmailOtp) {
    btnSubmitEmailOtp.addEventListener('click', function () {
      var email = inputEmail ? inputEmail.value.trim().toLowerCase() : '';
      var otp = inputEmailOtp ? inputEmailOtp.value.trim() : '';
      if (otp.length < 4) {
        alert('Kripya 6-digit OTP code enter karein.');
        if (inputEmailOtp) inputEmailOtp.focus();
        return;
      }

      btnSubmitEmailOtp.disabled = true;
      btnSubmitEmailOtp.textContent = 'Verifying…';

      fetch('../api/lms.php?action=verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, otp: otp, purpose: 'admission' })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.ok) {
            throw new Error(data.error || 'Galat ya expired OTP code.');
          }
          isEmailVerified = true;
          if (boxEmailOtp) boxEmailOtp.style.display = 'none';
          if (badgeEmailVerified) badgeEmailVerified.style.display = 'inline-flex';
          if (inputEmail) {
            inputEmail.readOnly = true;
            inputEmail.style.background = '#f0fdf4';
          }
          if (btnSendEmailOtp) {
            btnSendEmailOtp.disabled = true;
            btnSendEmailOtp.classList.add('is-verified');
            btnSendEmailOtp.textContent = '✓ Verified';
          }
          if (emailOtpMsg) emailOtpMsg.textContent = '';
          showStatus('Email Address successfully verified!', 'info');
        })
        .catch(function (err) {
          if (emailOtpMsg) {
            emailOtpMsg.textContent = '✕ ' + err.message;
            emailOtpMsg.className = 'adm-otp-msg is-error';
          }
          alert(err.message);
        })
        .finally(function () {
          btnSubmitEmailOtp.disabled = false;
          btnSubmitEmailOtp.textContent = 'Submit OTP';
        });
    });
  }

  // --- 5. Form submission handler ---
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var userPhone = inputPhone ? inputPhone.value.trim().replace(/\D/g, '') : '';
      if (userPhone.length !== 10) {
        alert('Kripya 10-digit valid WhatsApp mobile number enter karein.');
        if (inputPhone) inputPhone.focus();
        return;
      }

      var userEmail = inputEmail ? inputEmail.value.trim().toLowerCase() : '';
      if (!userEmail || userEmail.indexOf('@') === -1 || userEmail.indexOf('.') === -1) {
        alert('Kripya valid Email Address enter karein.');
        if (inputEmail) inputEmail.focus();
        return;
      }

      showStatus('Submitting your admission form & documents...', 'info');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Processing Application...';
      }

      var filePhoto = inputPhoto && inputPhoto.files && inputPhoto.files[0];
      var sendAdmission = function () {
        var formData = new FormData(form);
        if (processedPhotoFile) {
          formData.set('photo_file', processedPhotoFile, processedPhotoFile.name);
        }
        if (processedAadhaarFile) {
          formData.set('aadhaar_file', processedAadhaarFile, processedAadhaarFile.name);
        }
        if (processedCertFile) {
          formData.set('cert_file', processedCertFile, processedCertFile.name);
        }
        if (window.isOnlineBatchMode) {
          formData.set('isOnlineBatch', '1');
          formData.set('batchNumber', window.dynamicBatchNum || '');
        }

        fetch('../api/lms.php?action=submit-offline-admission', {
          method: 'POST',
          body: formData
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data.ok) {
              throw new Error(data.error || 'Submission failed. Please check your data.');
            }

            if (data.token) {
              try {
                localStorage.setItem('qaa_student_token', data.token);
                localStorage.setItem('qa_student_token', data.token);
              } catch (e) {}
            }
            if (data.photoUrl || studentUploadedPhotoDataUrl) {
              try {
                localStorage.setItem('qaa_student_avatar', data.photoUrl || studentUploadedPhotoDataUrl);
              } catch (e) {}
            }

            // If Razorpay order returned for online payment (and not direct batch confirmation)
            if (data.paymentMode === 'online' && data.razorpay && window.Razorpay && !data.isOnlineBatch) {
              handleRazorpayPayment(data);
            } else {
              // Form submitted (Batch or Offline) - Show ID Card and Confirmation
              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '✓ Form Submitted Successfully!';
              }
              showStatus('✓ Admission Form safalta se submit ho gaya hai! Aapka Student ID Card issue ho gaya hai.', 'success');
              showSuccessModal(data, false);
            }
          })
          .catch(function (err) {
            showStatus(err.message, 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = 'Submit Admission Form <span aria-hidden="true">→</span>';
            }
          });
      };

      if (filePhoto && !processedPhotoFile) {
        compressImage(filePhoto, 640, 0.78, function (comp) {
          processedPhotoFile = comp;
          sendAdmission();
        });
      } else {
        sendAdmission();
      }
    });
  }

  // Razorpay payment integration
  function handleRazorpayPayment(admissionData) {
    var rp = admissionData.razorpay;
    var options = {
      key: rp.keyId,
      amount: rp.amount,
      currency: rp.currency,
      name: rp.name,
      description: rp.description,
      order_id: rp.orderId,
      prefill: rp.prefill,
      theme: { color: '#d97706' },
      handler: function (response) {
        showStatus('Verifying payment signature with academy server...', 'info');

        fetch('../api/lms.php?action=verify-offline-admission-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admissionId: admissionData.admissionId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          })
        })
          .then(function (res) { return res.json(); })
          .then(function (verifyData) {
            if (verifyData.ok) {
              if (verifyData.token) {
                try {
                  localStorage.setItem('qaa_student_token', verifyData.token);
                  localStorage.setItem('qa_student_token', verifyData.token);
                } catch (e) { }
              }
              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '✓ Payment Successful!';
              }
              showStatus('✓ Payment verify ho gaya hai! Aapka Student ID Card issue ho gaya hai.', 'success');
              showSuccessModal(admissionData, true);
            } else {
              showStatus('Payment verification failed. Please contact academy support: +91 9939800780', 'error');
            }
          })
          .catch(function (e) {
            showStatus('Network error verifying payment. Your payment ID is: ' + response.razorpay_payment_id, 'error');
          });
      },
      modal: {
        ondismiss: function () {
          showStatus('Payment was not completed. You can pay ₹500 at campus on arrival or retry.', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🎓 Retry Online Payment (₹500) →';
          }
        }
      }
    };

    var rzp1 = new Razorpay(options);
    rzp1.open();
  }

  function showStatus(msg, type) {
    if (!statusBox) return;
    statusBox.textContent = msg;
    statusBox.className = 'adm-status-box ' + (type === 'error' ? 'error' : (type === 'success' ? 'success' : ''));
    statusBox.style.display = 'block';
  }

  // ===== Conversion tracking (Facebook + Google) =====
  // Admission successful hone par ek virtual "thank-you" page view bhejta hai:
  // - Facebook custom conversion "Website Lead - Thank You Page" (URL contains "thank-you") isse count karega
  // - GA4 generate_lead (page_location contains "/thank-you/") -> Google Ads "Website Lead - Thank You Page" count karega
  // Student ka flow bilkul same rehta hai (ID card popup + portal). Ek admission sirf ek baar count hota hai.
  function qaTrackAdmission(data, isPaid) {
    try {
      var admId = (data && data.admissionId) || ('adm_' + Date.now());
      try {
        var key = 'qa_adm_tracked_' + admId;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
      } catch (e) { }

      var origin = window.location.origin;
      var thankYouUrl = origin + '/thank-you/?type=offline-admission' + (isPaid ? '&fee=paid' : '&fee=cash');

      // Facebook Pixel
      if (typeof fbq === 'function') {
        fbq('track', 'PageView');
        fbq('track', 'Lead', {
          content_name: 'Offline Admission Form',
          content_category: 'Offline',
          currency: 'INR',
          value: isPaid ? 500 : 0
        }, { eventID: 'adm_' + admId });
      }

      // Google Analytics 4 (G-H6DKT8Y659)
      if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', {
          event_category: 'Offline Admission',
          event_label: admId,
          value: isPaid ? 500 : 0,
          currency: 'INR'
        });
        gtag('event', 'page_view', {
          page_location: thankYouUrl,
          page_path: '/thank-you/',
          page_title: 'Admission Thank You'
        });
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'offline_admission_submit', admission_id: admId, fee_paid: !!isPaid });
    } catch (err) {
      if (window.console) console.warn('Admission tracking error', err);
    }
  }

  function showSuccessModal(data, isPaid) {
    qaTrackAdmission(data, isPaid);

    var modal = document.getElementById('adm-success-modal');
    if (!modal) return;

    var inputNameEl = inputName || document.getElementById('adm-name');
    var inputPhoneEl = inputPhone || document.getElementById('adm-phone');
    var inputStudioEl = inputStudio || document.getElementById('adm-studio');
    var inputCityEl = inputCity || document.getElementById('adm-city');
    var inputBloodEl = inputBlood || document.getElementById('adm-bloodgroup');

    var sName = (data && data.fullName) || (inputNameEl ? inputNameEl.value.trim() : '') || 'Student';
    var sId = (data && data.admissionId) || 'QAA-OFF-2026-LIVE';
    var sPhone = (data && data.phone) || (inputPhoneEl ? inputPhoneEl.value.trim() : '');
    var sCourse = (document.getElementById('adm-course') ? document.getElementById('adm-course').value : '') || 'Wedding Filmmaking & Post-Production Course';
    var sStudio = (inputStudioEl ? inputStudioEl.value.trim() : '') || 'Independent Studio';
    var sCity = (inputCityEl ? inputCityEl.value.trim() : '') || 'Siwan, Bihar';

    var sBlood = (data && data.bloodGroup) || (inputBloodEl ? inputBloodEl.value : '') || 'B+';

    var idEl = document.getElementById('modal-app-id');
    var nameEl = document.getElementById('modal-student-name');
    var courseEl = document.getElementById('modal-student-course');
    var phoneEl = document.getElementById('modal-student-phone');
    var studioEl = document.getElementById('modal-student-studio');
    var cityEl = document.getElementById('modal-student-city');
    var bloodEl = document.getElementById('modal-student-blood');
    var backBloodEl = document.getElementById('modal-back-blood');
    var backCityEl = document.getElementById('modal-back-city');
    var backBarcodeEl = document.getElementById('modal-back-barcode');
    var backIdTextEl = document.getElementById('modal-back-id-text');
    var issuedPhoto = document.getElementById('issued-id-photo');
    var qrImg = document.getElementById('issued-id-qr');

    if (idEl) idEl.textContent = sId;
    if (nameEl) nameEl.textContent = sName;
    if (courseEl) courseEl.textContent = sCourse;
    if (phoneEl) phoneEl.textContent = sPhone ? '+91 ' + sPhone : '+91 9939800780';
    if (studioEl) studioEl.textContent = sStudio;
    if (cityEl) cityEl.textContent = sCity;
    if (bloodEl) bloodEl.textContent = sBlood;
    if (backBloodEl) {
      if (sBlood === 'N/A' || sBlood === 'NA') {
        backBloodEl.textContent = 'N/A';
      } else if (sBlood.indexOf('+') !== -1) {
        backBloodEl.textContent = sBlood + ' (Positive)';
      } else if (sBlood.indexOf('-') !== -1) {
        backBloodEl.textContent = sBlood + ' (Negative)';
      } else {
        backBloodEl.textContent = sBlood;
      }
    }
    if (backCityEl) backCityEl.textContent = sCity + ' (IN)';
    if (backBarcodeEl && !backBarcodeEl.querySelector('svg') && backBarcodeEl.tagName !== 'svg') {
      backBarcodeEl.textContent = '*' + sId.replace(/[^a-zA-Z0-9-]/g, '') + '*';
    }
    if (backIdTextEl) backIdTextEl.textContent = '*' + sId + '*';

    // Set student photo on the issued ID Card
    if (issuedPhoto) {
      var photoSource = studentUploadedPhotoDataUrl ||
                        (data && (data.photoUrl || data.avatar || data.avatarUrl)) ||
                        localStorage.getItem('qaa_student_avatar') ||
                        (previewImg && previewImg.src && previewImg.src.indexOf('default-student-avatar') === -1 && previewImg.src.indexOf('anil-sharma') === -1 ? previewImg.src : '') ||
                        '../assets/default-student-avatar.svg';
      issuedPhoto.src = photoSource;
      try {
        if (studentUploadedPhotoDataUrl) {
          localStorage.setItem('qaa_student_avatar', studentUploadedPhotoDataUrl);
        } else if (data && (data.photoUrl || data.avatar)) {
          localStorage.setItem('qaa_student_avatar', data.photoUrl || data.avatar);
        }
      } catch (e) {}
    }

    // Generate Verification URL & Scannable QR Code
    var verifyUrl = 'https://quickartphotography.in/admission/verify.html?id=' + encodeURIComponent(sId) +
                    '&name=' + encodeURIComponent(sName) +
                    '&course=' + encodeURIComponent(sCourse) +
                    '&studio=' + encodeURIComponent(sStudio) +
                    '&city=' + encodeURIComponent(sCity) +
                    '&blood=' + encodeURIComponent(sBlood);
    if (sPhone) {
      verifyUrl += '&phone=' + encodeURIComponent(sPhone);
    }
    if (photoSource && photoSource.indexOf('data:') === -1 && photoSource.indexOf('default-student-avatar') === -1) {
      verifyUrl += '&photo=' + encodeURIComponent(photoSource);
    }


    if (qrImg) {
      var qrApi = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=1&data=' + encodeURIComponent(verifyUrl);
      qrImg.src = qrApi;
    }

    // Dynamic ID card status badge & notification based on Campus Cash Approval
    var isPendingApproval = (data.paymentMode === 'cash') || (data.status === 'pending_approval') || (!isPaid && data.paymentMode !== 'online');
    var statusPill = document.getElementById('modal-card-status-pill');
    var topTagText = document.getElementById('modal-top-tag-text');
    var mainTitle = document.getElementById('modal-main-title');
    var mainSub = document.getElementById('modal-main-sub');
    var photoRibbon = document.getElementById('modal-photo-ribbon');

    if (isPendingApproval) {
      if (statusPill) {
        statusPill.textContent = 'PENDING APPROVAL';
        statusPill.style.background = 'rgba(245, 158, 11, 0.2)';
        statusPill.style.color = '#fbbf24';
        statusPill.style.borderColor = 'rgba(245, 158, 11, 0.6)';
      }
      if (topTagText) topTagText.textContent = 'APPLICATION REGISTERED • PENDING CAMPUS APPROVAL';
      if (mainTitle) mainTitle.textContent = 'Admission Form Registered! (Pending Approval)';
      if (mainSub) {
        var payNote;
        if (isPaid) {
          payNote = 'Aapka <strong>₹500 online payment receive ho gaya hai</strong>.';
        } else if (data.isOnlineBatch) {
          payNote = 'Aapka <strong>Online Batch admission form</strong> receive ho gaya hai.';
        } else if (data.paymentMode === 'cash') {
          payNote = 'Aapne <strong>Pay at Siwan Campus / Cash on Arrival</strong> select kiya hai.';
        } else {
          payNote = 'Aapka <strong>₹500 registration fee abhi pending hai</strong> (online ya campus par pay karein).';
        }
        mainSub.innerHTML = 'Aapka admission submit ho gaya hai. ' + payNote + '<br><span style="color:#fbbf24; font-weight:600;">🏛️ Note:</span> Payment online ho ya offline, Admin approval ke baad hi aapka official ID Card, LMS Portal aur Course access active kiya jayega.';
      }
      if (photoRibbon) {
        photoRibbon.textContent = 'PROVISIONAL';
        photoRibbon.style.background = '#d97706';
      }
    } else {
      if (statusPill) {
        statusPill.textContent = 'ACTIVE';
        statusPill.style.background = 'rgba(16, 185, 129, 0.2)';
        statusPill.style.color = '#34d399';
        statusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }
      if (topTagText) topTagText.textContent = 'OFFICIALLY ISSUED • VERIFIED ADMISSION 2026';
      if (mainTitle) mainTitle.textContent = 'Official Student ID Card Issued!';
      if (mainSub) {
        mainSub.textContent = 'Aapka admission register ho gaya hai. Niche aapka verifiable QR Scanner ID Card issue kar diya gaya hai:';
      }
      if (photoRibbon) {
        photoRibbon.textContent = 'STUDENT';
        photoRibbon.style.background = '#10b981';
      }
    }

    modal.style.display = 'flex';
  }

  // 📥 Download Issued ID Card as High-Res PNG (Front or Back)
  window.downloadIssuedIdCard = function (side) {
    side = side || 'front';
    var targetId = side === 'back' ? 'issued-id-card-back' : 'issued-id-card-front';
    var card = document.getElementById(targetId) || document.getElementById('issued-id-card-to-download');
    if (!card) return;

    var sId = (document.getElementById('modal-app-id') ? document.getElementById('modal-app-id').textContent.trim() : '') || 'QAA-STUDENT-ID';
    var btn = side === 'back' ? document.getElementById('btn-dl-back') : document.getElementById('btn-dl-front');
    if (btn) btn.innerHTML = '⏳ Generating High-Res ' + side.toUpperCase() + '...';

    var dlModal = document.getElementById('adm-success-modal');
    if (dlModal) dlModal.classList.add('adm-dl-mode');
    var endDlMode = function () { if (dlModal) dlModal.classList.remove('adm-dl-mode'); };

    if (window.html2canvas) {
      window.html2canvas(card, {
        scale: 3, // 300 DPI high resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0d14'
      }).then(function (canvas) {
        var a = document.createElement('a');
        a.download = 'QAA_Student_ID_' + sId.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + side.toUpperCase() + '.png';
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        endDlMode();
        if (btn) btn.innerHTML = '✓ ' + side.toUpperCase() + ' Downloaded! 📥';
        setTimeout(function () {
          if (btn) btn.innerHTML = '<span>📥 Download ' + (side === 'front' ? 'Front' : 'Back') + ' Side (PNG)</span>';
        }, 3000);
      }).catch(function (err) {
        console.error('html2canvas error:', err);
        endDlMode();
        window.print();
        if (btn) btn.innerHTML = '<span>📥 Download ' + (side === 'front' ? 'Front' : 'Back') + ' Side (PNG)</span>';
      });
    } else {
      endDlMode();
      window.print();
    }
  };

  // 🖨️ Print ID Card
  window.printIssuedIdCard = function () {
    window.print();
  };

  window.closeAdmissionModal = function () {
    var modal = document.getElementById('adm-success-modal');
    if (modal) modal.style.display = 'none';
    window.location.href = '/portal/';
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
