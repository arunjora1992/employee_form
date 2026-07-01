// Client-side ID card renderer — draws the same layout as the server PDF
// (backend/src/exporters.js) onto a canvas so it can be downloaded as a JPG/PNG.
// Branding comes from /api/config (getConfig), employee info from the record.

(function () {
  // Logical card size (points, matching the PDF) scaled up for a crisp raster.
  const W = 216, H = 342, S = 4;

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function employeeCode(employee, shopName) {
    const prefix = (String(shopName || 'SC').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()) || 'SC';
    const hex = String(employee.id || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 8).toUpperCase();
    return `${prefix}-${hex || '00000000'}`;
  }

  function ymd(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  }

  // Draw an image cover-cropped to fill (dx,dy,dw,dh) preserving aspect ratio.
  function drawCover(ctx, img, dx, dy, dw, dh) {
    const ir = img.width / img.height, br = dw / dh;
    let sw, sh, sx, sy;
    if (ir > br) { sh = img.height; sw = sh * br; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / br; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // Shrink font until `text` fits `maxW` (logical px). Returns the size used.
  function fitFont(ctx, text, weight, size, maxW) {
    let s = size;
    do {
      ctx.font = `${weight} ${s * S}px Helvetica, Arial, sans-serif`;
      if (ctx.measureText(text).width <= maxW * S) break;
      s -= 0.5;
    } while (s > 6);
    return s;
  }

  function ellipsize(ctx, text, weight, size, maxW) {
    ctx.font = `${weight} ${size * S}px Helvetica, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxW * S) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW * S) t = t.slice(0, -1);
    return t + '…';
  }

  // Render the card to a canvas and return it.
  async function renderCard(employee, cfg) {
    cfg = cfg || {};
    const shopName = cfg.shopName || 'Sekar & Co';
    const header = cfg.headerColor || '#1b3a5b';
    const accent = cfg.primaryColor || '#f5a623';

    const canvas = document.createElement('canvas');
    canvas.width = W * S; canvas.height = H * S;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';

    // Background + border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W * S, H * S);
    ctx.strokeStyle = '#d8dee8';
    ctx.lineWidth = 1 * S;
    ctx.strokeRect(0.5 * S, 0.5 * S, (W - 1) * S, (H - 1) * S);

    // Header band
    const headerH = 66;
    ctx.fillStyle = header;
    ctx.fillRect(0, 0, W * S, headerH * S);

    // Logo (uploaded image or accent circle + shop initial)
    const [logoImg, photoImg] = await Promise.all([
      loadImage(cfg.logoPath || null),
      loadImage(employee.photo_path || null),
    ]);
    const logoD = 38, logoX = 14, logoY = (headerH - logoD) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc((logoX + logoD / 2) * S, (logoY + logoD / 2) * S, (logoD / 2) * S, 0, Math.PI * 2);
    ctx.clip();
    if (logoImg) {
      drawCover(ctx, logoImg, logoX * S, logoY * S, logoD * S, logoD * S);
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(logoX * S, logoY * S, logoD * S, logoD * S);
      ctx.fillStyle = header;
      ctx.font = `bold ${20 * S}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText((shopName[0] || 'S').toUpperCase(), (logoX + logoD / 2) * S, (logoY + 8) * S);
    }
    ctx.restore();

    // Company name + tagline
    const txtX = logoX + logoD + 10;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    const nameSize = fitFont(ctx, shopName, 'bold', 13, W - txtX - 12);
    ctx.font = `bold ${nameSize * S}px Helvetica, Arial, sans-serif`;
    ctx.fillText(shopName, txtX * S, 16 * S);
    if (cfg.tagline) {
      ctx.fillStyle = accent;
      ctx.font = `italic ${7 * S}px Helvetica, Arial, sans-serif`;
      ctx.fillText(ellipsize(ctx, cfg.tagline, 'italic', 7, W - txtX - 12), txtX * S, (16 + nameSize + 4) * S);
    }

    // Photo frame
    const pw = 94, ph = 112, px = (W - pw) / 2, py = headerH + 16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 * S;
    ctx.strokeRect((px - 2) * S, (py - 2) * S, (pw + 4) * S, (ph + 4) * S);
    if (photoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(px * S, py * S, pw * S, ph * S);
      ctx.clip();
      drawCover(ctx, photoImg, px * S, py * S, pw * S, ph * S);
      ctx.restore();
    } else {
      ctx.fillStyle = header;
      ctx.fillRect(px * S, py * S, pw * S, ph * S);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${34 * S}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(initials(employee.full_name), (px + pw / 2) * S, (py + ph / 2 - 22) * S);
    }

    // Name + role (centered)
    ctx.textAlign = 'center';
    ctx.fillStyle = header;
    const nmSize = fitFont(ctx, employee.full_name || 'Employee', 'bold', 15, W - 20);
    ctx.font = `bold ${nmSize * S}px Helvetica, Arial, sans-serif`;
    ctx.fillText(employee.full_name || 'Employee', (W / 2) * S, 200 * S);
    const role = [employee.designation, employee.division].filter(Boolean).join(' · ');
    if (role) {
      ctx.fillStyle = '#5b6b7a';
      ctx.font = `normal ${8.5 * S}px Helvetica, Arial, sans-serif`;
      ctx.fillText(ellipsize(ctx, role, 'normal', 8.5, W - 20), (W / 2) * S, 220 * S);
    }

    // Divider
    const dividerY = 238;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    ctx.moveTo(16 * S, dividerY * S);
    ctx.lineTo((W - 16) * S, dividerY * S);
    ctx.stroke();

    // Detail rows
    const rows = [
      ['ID No', employeeCode(employee, shopName)],
      ['Blood Group', employee.blood_group],
      ['Phone', employee.personal_phone],
      ['Date of Birth', employee.date_of_birth ? ymd(employee.date_of_birth) : ''],
      ['Emergency', [employee.emergency_contact_person, employee.emergency_contact_no].filter(Boolean).join(' · ')],
    ];
    const labelW = 74, rowsStart = 247, rowH = 13;
    ctx.textAlign = 'left';
    rows.forEach(([label, value], i) => {
      const y = rowsStart + i * rowH;
      ctx.fillStyle = '#8794a3';
      ctx.font = `bold ${8 * S}px Helvetica, Arial, sans-serif`;
      ctx.fillText(label.toUpperCase(), 16 * S, y * S);
      ctx.fillStyle = '#1b2733';
      const v = value ? String(value) : '—';
      ctx.font = `normal ${8 * S}px Helvetica, Arial, sans-serif`;
      ctx.fillText(ellipsize(ctx, v, 'normal', 8, W - 32 - labelW), (16 + labelW) * S, y * S);
    });

    // Footer band
    const footerH = 26;
    ctx.fillStyle = accent;
    ctx.fillRect(0, (H - footerH) * S, W * S, footerH * S);
    ctx.fillStyle = header;
    ctx.textAlign = 'center';
    ctx.font = `bold ${7.5 * S}px Helvetica, Arial, sans-serif`;
    const caption = (cfg.idCardFooter || 'Employee Identity Card').toUpperCase();
    ctx.fillText(ellipsize(ctx, caption, 'bold', 7.5, W - 24), (W / 2) * S, (H - footerH + 5) * S);
    const office = cfg.contact && cfg.contact.headOffice && cfg.contact.headOffice.label;
    if (office) {
      ctx.font = `normal ${6 * S}px Helvetica, Arial, sans-serif`;
      ctx.fillText(ellipsize(ctx, office, 'normal', 6, W - 24), (W / 2) * S, (H - footerH + 15) * S);
    }

    return canvas;
  }

  function safeFileName(name) {
    return String(name || 'employee').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  }

  // Public: render + trigger a JPG (default) or PNG download of the ID card.
  window.downloadIdCardImage = async function (employee, type = 'jpg') {
    const cfg = (typeof getConfig === 'function') ? await getConfig() : {};
    const canvas = await renderCard(employee, cfg);
    const mime = type === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safeFileName(employee.full_name)}-id-card.${type === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a); a.click(); a.remove();
  };
})();
