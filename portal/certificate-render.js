/*
 * Quick Art Photography Academy — Certificate renderer
 *
 * Draws the certificate directly on an A4-landscape canvas at 300 DPI
 * (3508 × 2480 px), so the on-screen preview, the PNG download and the
 * printed copy are pixel-identical and print-ready for framing.
 *
 * Used by both the student portal (/portal/) and the mobile app (/app/).
 *
 *   QACertificate.render({ studentName, courseTitle, certificateId,
 *                          issuedDate, verifyUrl, enrollmentNo })
 *     -> Promise<HTMLCanvasElement>
 *   QACertificate.download(canvas, studentName)
 *   QACertificate.print(canvas)
 */
(function () {
  'use strict';

  // Layout is designed on a 1123 × 794 grid (A4 landscape @ 96 DPI) and
  // scaled up to 300 DPI when drawn.
  var W = 1123;
  var H = 794;
  var SCALE = 3508 / W;

  var INK = '#1b1916';
  var INK_SOFT = '#5b4f3e';
  var GOLD = '#b8862f';
  var GOLD_DEEP = '#8a5a14';
  var PAPER = '#fbf7ee';

  var FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;1,500&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap';

  var fontSheetReady = null;

  function loadFontSheet() {
    if (fontSheetReady) return fontSheetReady;
    fontSheetReady = new Promise(function (resolve) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_LINK;
      link.setAttribute('data-qa-cert-fonts', '1');
      link.onload = function () { resolve(); };
      link.onerror = function () { resolve(); };
      document.head.appendChild(link);
      setTimeout(resolve, 5000);
    });
    return fontSheetReady;
  }

  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return loadFontSheet();
    return loadFontSheet().then(loadFaces);
  }

  function loadFaces() {
    var specs = [
      '700 30px "Cinzel"', '800 60px "Cinzel"', '600 16px "Cinzel"',
      '70px "Great Vibes"', 'italic 500 18px "Playfair Display"',
      '600 12px "Plus Jakarta Sans"', '700 12px "Plus Jakarta Sans"'
    ];
    var loads = specs.map(function (s) { return document.fonts.load(s).catch(function () {}); });
    var timeout = new Promise(function (r) { setTimeout(r, 6000); });
    return Promise.race([Promise.all(loads), timeout]);
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function makeQr(text) {
    if (typeof QRCode === 'undefined' || !text) return null;
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(holder);
    try {
      new QRCode(holder, {
        text: text, width: 480, height: 480,
        colorDark: INK, colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0
      });
      return holder.querySelector('canvas');
    } catch (e) {
      return null;
    } finally {
      setTimeout(function () { holder.remove(); }, 0);
    }
  }

  function formatDate(value) {
    var d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Shrink a font until text fits the given width.
  function fitFont(ctx, text, weightFamily, startSize, maxWidth, minSize) {
    var size = startSize;
    ctx.font = weightFamily.replace('{s}', size);
    while (ctx.measureText(text).width > maxWidth && size > minSize) {
      size -= 1;
      ctx.font = weightFamily.replace('{s}', size);
    }
    return size;
  }

  function wrapLines(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function spacedText(ctx, text, x, y, spacing) {
    // Centered text with manual letter-spacing (canvas letterSpacing is not universal).
    var chars = String(text).split('');
    var total = chars.reduce(function (sum, c) { return sum + ctx.measureText(c).width; }, 0) + spacing * (chars.length - 1);
    var cx = x - total / 2;
    var prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    chars.forEach(function (c) {
      ctx.fillText(c, cx, y);
      cx += ctx.measureText(c).width + spacing;
    });
    ctx.textAlign = prevAlign;
    return total;
  }

  function goldGradient(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#8a5a14');
    g.addColorStop(0.3, '#d9a74f');
    g.addColorStop(0.5, '#f3d48b');
    g.addColorStop(0.7, '#c99236');
    g.addColorStop(1, '#8a5a14');
    return g;
  }

  function drawPaper(ctx) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // Soft warm vignette
    var v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 720);
    v.addColorStop(0, 'rgba(255,255,255,0.55)');
    v.addColorStop(1, 'rgba(201,160,90,0.10)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // Guilloche waves (security-print feel), very light
    ctx.save();
    ctx.strokeStyle = 'rgba(184,134,47,0.07)';
    ctx.lineWidth = 0.6;
    for (var i = 0; i < 26; i++) {
      ctx.beginPath();
      for (var x = 40; x <= W - 40; x += 4) {
        var y = 110 + i * 22 + Math.sin(x / 38 + i * 0.6) * 9 + Math.sin(x / 91) * 6;
        if (x === 40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Large faint logo watermark text
    ctx.save();
    ctx.fillStyle = 'rgba(184,134,47,0.045)';
    ctx.font = '800 230px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QAA', W / 2, H / 2 + 40);
    ctx.restore();
  }

  function drawCornerOrnament(ctx, x, y, sx, sy) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(0, 12);
    ctx.quadraticCurveTo(0, 0, 12, 0);
    ctx.lineTo(70, 0);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(8, 56);
    ctx.bezierCurveTo(8, 22, 22, 8, 56, 8);
    ctx.stroke();
    // diamond
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(22, 14); ctx.lineTo(30, 22); ctx.lineTo(22, 30); ctx.lineTo(14, 22); ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(40, 10, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 40, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBorders(ctx) {
    // Outer dark frame
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 18);
    ctx.fillRect(0, H - 18, W, 18);
    ctx.fillRect(0, 0, 18, H);
    ctx.fillRect(W - 18, 0, 18, H);

    // Gold rule inside dark frame
    ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // Inner double gold line
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = GOLD;
    ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(43, 43, W - 86, H - 86);

    drawCornerOrnament(ctx, 50, 50, 1, 1);
    drawCornerOrnament(ctx, W - 50, 50, -1, 1);
    drawCornerOrnament(ctx, 50, H - 50, 1, -1);
    drawCornerOrnament(ctx, W - 50, H - 50, -1, -1);
  }

  function drawSeal(ctx, cx, cy, r) {
    ctx.save();
    // Ribbons
    ctx.fillStyle = '#7a1f1f';
    [[-1, 1], [1, 1]].forEach(function (d) {
      ctx.beginPath();
      ctx.moveTo(cx + d[0] * 14, cy + r * 0.55);
      ctx.lineTo(cx + d[0] * 34, cy + r + 40);
      ctx.lineTo(cx + d[0] * 22, cy + r + 32);
      ctx.lineTo(cx + d[0] * 12, cy + r + 44);
      ctx.lineTo(cx + d[0] * 2, cy + r * 0.6);
      ctx.closePath();
      ctx.fill();
    });

    // Scalloped starburst
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.35, '#f0c766');
    g.addColorStop(0.75, '#c08a2e');
    g.addColorStop(1, '#7c5210');
    ctx.fillStyle = g;
    ctx.beginPath();
    var points = 36;
    for (var i = 0; i <= points * 2; i++) {
      var a = (Math.PI * i) / points;
      var rr = i % 2 === 0 ? r : r * 0.9;
      var px = cx + Math.cos(a) * rr;
      var py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Rings
    ctx.strokeStyle = 'rgba(90,56,10,0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.53, 0, Math.PI * 2); ctx.stroke();

    // Circular text
    ctx.fillStyle = '#4a2f06';
    ctx.font = '700 7.2px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var label = 'QUICK ART PHOTOGRAPHY ACADEMY  ★  ';
    var chars = label.split('');
    var tr = r * 0.655;
    for (var k = 0; k < chars.length; k++) {
      var ang = -Math.PI / 2 + (k / chars.length) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * tr, cy + Math.sin(ang) * tr);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillText(chars[k], 0, 0);
      ctx.restore();
    }

    // Center mark
    ctx.font = '800 17px "Cinzel", serif';
    ctx.fillText('QAA', cx, cy - 3);
    ctx.font = '700 5.6px "Cinzel", serif';
    ctx.fillText('★ CERTIFIED ★', cx, cy + 10);
    ctx.restore();
  }

  function render(data) {
    data = data || {};
    var name = (data.studentName || 'Student Name').trim();
    var course = (data.courseTitle || 'Professional Course').trim();
    var certId = data.certificateId || '';
    var issued = formatDate(data.issuedDate);
    var verifyUrl = data.verifyUrl || ('https://quickartphotography.in/portal/?verify=' + encodeURIComponent(certId));

    var logoSrc = data.logoSrc || '/assets/quick-art-logo.png';

    return Promise.all([ensureFonts(), loadImage(logoSrc)]).then(function (res) {
      var logo = res[1];
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(W * SCALE);
      canvas.height = Math.round(H * SCALE);
      var ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.textBaseline = 'alphabetic';

      drawPaper(ctx);
      drawBorders(ctx);

      var cx = W / 2;
      ctx.textAlign = 'center';

      // Logo
      if (logo) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 8;
        ctx.drawImage(logo, cx - 41, 64, 82, 82);
        ctx.restore();
      }

      // Academy name
      ctx.fillStyle = INK;
      ctx.font = '700 25px "Cinzel", serif';
      spacedText(ctx, 'QUICK ART PHOTOGRAPHY ACADEMY', cx, 178, 3);

      ctx.fillStyle = INK_SOFT;
      ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
      spacedText(ctx, 'AN ISO 9001:2015 CERTIFIED INSTITUTION  •  GOVT. OF INDIA MSME REGISTERED (UDYAM-BR-35-0027860)', cx, 199, 0.8);

      // Title
      ctx.fillStyle = goldGradient(ctx, cx - 360, 225, cx + 360, 290);
      ctx.font = '800 74px "Cinzel", serif';
      spacedText(ctx, 'CERTIFICATE', cx, 286, 8);

      ctx.fillStyle = GOLD_DEEP;
      ctx.font = '600 15px "Cinzel", serif';
      var ofW = spacedText(ctx, 'OF COMPLETION', cx, 316, 7);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - ofW / 2 - 140, 311); ctx.lineTo(cx - ofW / 2 - 18, 311);
      ctx.moveTo(cx + ofW / 2 + 18, 311); ctx.lineTo(cx + ofW / 2 + 140, 311);
      ctx.stroke();

      // Presented to
      ctx.fillStyle = INK_SOFT;
      ctx.font = 'italic 500 17px "Playfair Display", serif';
      ctx.fillText('This is proudly presented to', cx, 354);

      // Student name
      ctx.fillStyle = INK;
      fitFont(ctx, name, '{s}px "Great Vibes", cursive', 66, 720, 34);
      ctx.fillText(name, cx, 420);
      var nameLine = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
      nameLine.addColorStop(0, 'rgba(184,134,47,0)');
      nameLine.addColorStop(0.5, 'rgba(184,134,47,1)');
      nameLine.addColorStop(1, 'rgba(184,134,47,0)');
      ctx.strokeStyle = nameLine;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 300, 436); ctx.lineTo(cx + 300, 436); ctx.stroke();

      // Citation
      ctx.fillStyle = INK_SOFT;
      ctx.font = 'italic 500 15.5px "Playfair Display", serif';
      ctx.fillText('for successfully completing every lesson and the final assessment of', cx, 466);

      // Course title (wraps to two lines if long)
      ctx.fillStyle = GOLD_DEEP;
      var cSize = fitFont(ctx, course, '700 {s}px "Cinzel", serif', 27, 820, 20);
      var lines = wrapLines(ctx, course, 820).slice(0, 2);
      var ly = lines.length > 1 ? 500 : 506;
      lines.forEach(function (l, i) { ctx.fillText(l, cx, ly + i * (cSize + 6)); });

      ctx.fillStyle = INK_SOFT;
      ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Awarded on ' + issued + '  •  Siwan, Bihar, India', cx, lines.length > 1 ? 564 : 538);

      // Footer: QR + ID (left), seal (center), signature (right)
      var fy = 625;

      var qr = makeQr(verifyUrl);
      if (qr) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(96, fy - 34, 92, 92);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1;
        ctx.strokeRect(96, fy - 34, 92, 92);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qr, 100, fy - 30, 84, 84);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = INK_SOFT;
      ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('CERTIFICATE ID', 200, fy - 10);
      ctx.fillStyle = INK;
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(certId || '—', 200, fy + 8);
      ctx.fillStyle = INK_SOFT;
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Scan the QR or visit', 200, fy + 28);
      ctx.fillText('quickartphotography.in/portal', 200, fy + 41);
      ctx.fillText('to verify this certificate', 200, fy + 54);

      drawSeal(ctx, cx, fy + 6, 54);

      // Signature
      ctx.textAlign = 'center';
      var sx = W - 230;
      ctx.fillStyle = '#1f2a44';
      ctx.font = '40px "Great Vibes", cursive';
      ctx.fillText('Anil Sharma', sx, fy + 6);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(sx - 110, fy + 18); ctx.lineTo(sx + 110, fy + 18); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('ANIL SHARMA', sx, fy + 36);
      ctx.fillStyle = INK_SOFT;
      ctx.font = '500 10.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Founder & Director, Quick Art Photography Academy', sx, fy + 52);

      // Bottom line
      ctx.fillStyle = 'rgba(91,79,62,0.75)';
      ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';
      spacedText(ctx, 'QUICKARTPHOTOGRAPHY.IN  •  AYODHYA PURI, SIWAN, BIHAR 841226', cx, H - 58, 1.2);

      return canvas;
    });
  }

  function download(canvas, studentName) {
    var clean = String(studentName || 'Student').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    var filename = 'QuickArt_Certificate_' + (clean || 'Student') + '.png';
    return new Promise(function (resolve) {
      var finish = function (href, revoke) {
        var a = document.createElement('a');
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
        resolve(filename);
      };
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) finish(URL.createObjectURL(blob), true);
          else finish(canvas.toDataURL('image/png'), false);
        }, 'image/png');
      } else {
        finish(canvas.toDataURL('image/png'), false);
      }
    });
  }

  function print(canvas) {
    var src = canvas.toDataURL('image/png');
    var w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>Quick Art Certificate</title>' +
      '<style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}' +
      'img{display:block;width:297mm;height:210mm;object-fit:contain}' +
      '@media screen{body{display:flex;justify-content:center;background:#333}img{width:100%;height:auto;max-width:1123px}}</style>' +
      '</head><body><img src="' + src + '" alt="Certificate"></body></html>'
    );
    w.document.close();
    var img = w.document.querySelector('img');
    var go = function () { w.focus(); w.print(); };
    if (img.complete) setTimeout(go, 250); else img.onload = function () { setTimeout(go, 250); };
    return true;
  }

  window.QACertificate = { render: render, download: download, print: print };
})();
