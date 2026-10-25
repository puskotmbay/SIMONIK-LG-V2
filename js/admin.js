'use strict';
/* ============================================================================
   SIMONIK-LG v2 — admin.js : modul baru untuk Admin/Kapus
   - WA & Notifikasi (gas-notifikasi-wa-crm): Konfigurasi + matriks event, Antrean, Blast WA
   - CRM Kontak: tabel + facet + detail timeline + impor/ekspor/gabung
   - Dokumen & Verifikasi (gas-doc-engine): template Google Docs, engine, daftar terbit, tarik
   - Migrasi Data (gas-migrasi-database): upgrade skema, impor v1, impor CSV, arsip tahunan
   - Keamanan (gas-rahasia-script-properties): status rahasia (tersamar), akses darurat, sesi
   Data tiap menu di-cache di S.adm → buka ulang menu = 0 ms, lalu disegarkan di latar.
   ============================================================================ */
S.adm = S.adm || {};

function admHead(title, desc, right) {
  return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div>${right || ''}</div>`;
}
function skelRows(n, h) { return Array.from({ length: n }, () => `<div class="skel mt-8" style="height:${h || 44}px"></div>`).join(''); }
function swRow(id, label, help, on) {
  return `<label class="row-between gap-12" style="padding:10px 0"><span><span class="fw-6">${label}</span>${help ? `<span class="help" style="display:block">${help}</span>` : ''}</span><span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></label>`;
}
async function admLoad(key, action, ...args) {
  try {
    const r = await api(action, S.token, ...args);
    if (r.success) { S.adm[key] = r.data; return r.data; }
    toast('error', 'Gagal memuat', r.message);
  } catch (e) { if (!e.auth) toast('warning', 'Tidak dapat terhubung', e.message); }
  return null;
}
async function admDo(btn, label, action, ...args) {
  if (btn) btnLoading(btn, true, label || 'Memproses…');
  try {
    const r = await api(action, S.token, ...args);
    if (!r.success) { toast('error', 'Gagal', r.message); return null; }
    if (r.message && r.message !== 'OK') toast('success', r.message);
    return r;
  } catch (e) { if (!e.auth) toast('error', 'Tidak dapat terhubung', e.message); return null; }
  finally { if (btn) btnLoading(btn, false); }
}
function onRoute(name) { return S.route === name; }
function admPill(s) {
  const m = { Terkirim: 'pill-diverifikasi', Antri: 'pill-pending', Gagal: 'pill-tidak', Batal: 'pill-tercatat', Berjalan: 'pill-berlangsung', Selesai: 'pill-selesai', Dihentikan: 'pill-tercatat',
    TERBIT: 'pill-diverifikasi', DITARIK: 'pill-tidak', Terdaftar: 'pill-diverifikasi', 'Tidak Terdaftar': 'pill-tidak' };
  return `<span class="pill ${m[s] || 'pill-tercatat'}">${esc(s || '—')}</span>`;
}

// ═══════════════════════════ WA & NOTIFIKASI ═══════════════════════════════
S.ui.notif = S.ui.notif || { tab: 'konfig', qStatus: '', qKanal: '' };
RENDER.notifikasi = function () {
  const st = S.ui.notif, el = $('#pg-notifikasi');
  const tabs = [['konfig', 'Konfigurasi'], ['antrean', 'Antrean Kirim'], ['blast', 'Blast WhatsApp']];
  el.innerHTML = admHead('WA &amp; Notifikasi', 'WhatsApp (Fonnte) dan email dikirim lewat antrean di latar — aplikasi tetap instan.',
    `<button class="btn btn-outline" id="nfProses">${ic('send')} Proses Antrean</button>`) +
    `<div class="tabs mb-16">${tabs.map(t => `<button class="tab ${st.tab === t[0] ? 'active' : ''}" data-nt="${t[0]}">${t[1]}</button>`).join('')}</div><div id="nfBody"></div>`;
  $$('[data-nt]', el).forEach(b => b.onclick = () => { st.tab = b.dataset.nt; RENDER.notifikasi(); });
  $('#nfProses').onclick = async e => { const r = await admDo(e.currentTarget, 'Memproses…', 'notifProsesSekarang'); if (r) { S.adm.queue = null; if (st.tab !== 'konfig') RENDER.notifikasi(); } };
  ({ konfig: nfKonfig, antrean: nfAntrean, blast: nfBlast })[st.tab]();
};

function nfKonfig() {
  const box = $('#nfBody'), c = S.adm.notif;
  if (!c) { box.innerHTML = skelRows(6, 60); admLoad('notif', 'notifConfig').then(d => d && onRoute('notifikasi') && nfKonfig()); return; }
  const m = c.matriks;
  box.innerHTML = `<div class="dash-grid two">
    <div class="stack-16">
      <div class="card stack-16"><h3 class="section-title">${ic('whatsapp')} WhatsApp (Fonnte)</h3>
        ${swRow('nfWa', 'Aktifkan notifikasi WhatsApp', 'Saklar utama. Bila mati, tidak ada WA yang dikirim.', c.waAktif)}
        <div class="field"><label for="nfTok">Token Fonnte</label>
          <div class="row gap-8"><input class="input mono grow" id="nfTok" type="password" autocomplete="off" placeholder="${c.token.ada ? 'Tersimpan: ' + esc(c.token.samar) + ' — isi untuk mengganti' : 'Tempel token dari fonnte.com → Device'}">
          ${c.token.ada ? `<button class="btn btn-outline btn-sm" id="nfTokDel" title="Hapus token">${ic('trash')}</button>` : ''}</div>
          <span class="help">${ic('shield-lock')} Disimpan di <b>Script Properties</b> server, tidak pernah di Sheets atau di halaman ini.</span></div>
        <div class="grid-2"><div class="field"><label for="nfBatch">Ukuran batch blast</label><select class="select" id="nfBatch">${[10, 20, 50].map(n => `<option ${c.batchDefault === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="field"><label for="nfJeda">Jeda antar pesan (detik)</label><input class="input mono" id="nfJeda" value="${esc(c.jeda)}" placeholder="5 atau 3-8"></div></div>
        ${swRow('nfDet', 'Deteksi otomatis nomor terdaftar WA', 'Nomor yang tidak terdaftar dilewati agar kuota tidak terbuang.', c.deteksiOtomatis)}
        <div class="row gap-8 wrap"><input class="input mono" id="nfTesNo" style="max-width:200px" placeholder="08xxxxxxxxxx" inputmode="tel"><button class="btn btn-soft btn-sm" id="nfTes">${ic('send')} Kirim WA uji</button><button class="btn btn-ghost btn-sm" id="nfDev">${ic('phone')} Cek perangkat</button></div>
        <div id="nfDevOut"></div>
      </div>
      <div class="card stack-16"><h3 class="section-title">${ic('envelope')} Email</h3>
        ${swRow('nfEm', 'Aktifkan notifikasi email', '', c.emailAktif)}
        <div class="field"><label for="nfNama">Nama pengirim</label><input class="input" id="nfNama" value="${esc(c.namaPengirim)}"></div>
        <div class="row-between text-sm"><span>Sisa kuota email hari ini</span><b class="mono">${c.kuotaEmail}</b></div>
        <div class="row gap-8"><input class="input" id="nfTesEm" type="email" placeholder="email@contoh.com"><button class="btn btn-soft btn-sm" id="nfTesE">${ic('send')} Uji</button></div>
      </div>
      <div class="card stack-16"><h3 class="section-title">${ic('link-45deg')} Umum</h3>
        <div class="field"><label for="nfUrl">Alamat aplikasi (GitHub Pages)</label><input class="input mono" id="nfUrl" value="${esc(c.appUrl || '')}" placeholder="${esc(location.origin + location.pathname)}"><span class="help">Dipakai untuk tautan di pesan dan QR verifikasi dokumen.</span></div>
        <div class="field"><label for="nfJam">Jam pengingat kegiatan belum selesai (WITA)</label><input class="input mono" id="nfJam" type="number" min="15" max="23" value="${c.pengingatJam}"></div>
      </div>
      <div class="card stack-16"><h3 class="section-title">${ic('alarm')} Jadwal pengingat otomatis</h3>
        <p class="text-sm muted">Dikirim oleh pekerja otomatis lewat kanal yang dicentang di matriks (event <b>Ringkasan harian</b> & <b>Pengingat mingguan</b>).</p>
        <div class="grid-2"><div class="field"><label for="nfRj">Ringkasan harian ke Kapus &amp; Admin</label><select class="select" id="nfRj"><option value="-1" ${c.ringkasanJam === -1 ? 'selected' : ''}>Mati</option>${[12, 13, 14, 15, 16, 17, 18, 19, 20].map(h => `<option value="${h}" ${c.ringkasanJam === h ? 'selected' : ''}>Pukul ${h}.00 WITA</option>`).join('')}</select></div>
          <div class="field"><label for="nfMh">Pengingat pegawai yang belum lapor</label><select class="select" id="nfMh">${['Mati', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((h, i) => `<option value="${i}" ${c.mingguanHari === i ? 'selected' : ''}>${i ? 'Setiap ' + h : h}</option>`).join('')}</select></div></div>
        <div class="field"><label for="nfMj">Jam pengingat mingguan</label><select class="select" id="nfMj">${[7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(h => `<option value="${h}" ${c.mingguanJam === h ? 'selected' : ''}>Pukul ${String(h).padStart(2, '0')}.00 WITA</option>`).join('')}</select></div>
        <div class="row wrap gap-8"><button class="btn btn-soft btn-sm" id="nfRjNow">${ic('send')} Kirim ringkasan sekarang</button><button class="btn btn-soft btn-sm" id="nfMhNow">${ic('send')} Kirim pengingat mingguan sekarang</button></div>
        <div class="row wrap gap-4"><span class="pill ${c.trigger ? 'pill-green' : 'pill-tidak'}">${ic(c.trigger ? 'check-circle' : 'x-circle')} Pekerja 1 menit ${c.trigger ? 'aktif' : 'belum aktif'}</span><span class="pill ${c.keepWarm ? 'pill-green' : 'pill-tercatat'}">${ic('fire')} Pemanasan server ${c.keepWarm ? 'aktif' : 'mati'}</span></div>
      </div>
    </div>
    <div class="card stack-16"><h3 class="section-title">${ic('grid-3x3-gap')} Matriks Event × Kanal</h3>
      <p class="text-sm muted">Pilih kejadian yang dikirim lewat WA dan/atau email. Klik <b>Ubah teks</b> untuk menyesuaikan pesan. Variabel: <span class="mono">{nama} {institusi} {link}</span> dan variabel khusus event.</p>
      <div class="table-wrap"><table class="tbl compact"><thead><tr><th>Kejadian</th><th style="width:60px">WA</th><th style="width:60px">Email</th><th style="width:90px"></th></tr></thead><tbody>
      ${Object.values(m).map(e => `<tr style="cursor:default"><td class="text-sm">${esc(e.label)}</td><td><label class="switch"><input type="checkbox" data-mw="${e.kode}" ${e.wa ? 'checked' : ''}><span></span></label></td><td><label class="switch"><input type="checkbox" data-me="${e.kode}" ${e.email ? 'checked' : ''}><span></span></label></td><td><button class="btn btn-ghost btn-sm" data-mt="${e.kode}">Ubah teks</button></td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </div>
  <div class="row mt-16" style="justify-content:flex-end"><button class="btn btn-primary btn-lg" id="nfSave">${ic('check2')} Simpan Konfigurasi</button></div>`;
  const kumpul = () => {
    const matriks = {};
    Object.values(m).forEach(e => { matriks[e.kode] = { wa: $(`[data-mw="${e.kode}"]`).checked, email: $(`[data-me="${e.kode}"]`).checked, pesan: e.pesan, subjek: e.subjek }; });
    return { waAktif: $('#nfWa').checked, emailAktif: $('#nfEm').checked, token: $('#nfTok').value.trim(), batchDefault: +$('#nfBatch').value, jeda: $('#nfJeda').value.trim(),
      deteksiOtomatis: $('#nfDet').checked, namaPengirim: $('#nfNama').value.trim(), appUrl: $('#nfUrl').value.trim(), pengingatJam: +$('#nfJam').value,
      ringkasanJam: +$('#nfRj').value, mingguanHari: +$('#nfMh').value, mingguanJam: +$('#nfMj').value, matriks };
  };
  $('#nfSave').onclick = async e => { const r = await admDo(e.currentTarget, 'Menyimpan…', 'notifSimpanConfig', kumpul()); if (r) { S.adm.notif = r.data; nfKonfig(); } };
  if ($('#nfTokDel')) $('#nfTokDel').onclick = async e => {
    if (!await confirmDialog({ title: 'Hapus token Fonnte?', message: 'WhatsApp otomatis berhenti sampai token baru diisi.', danger: true, okText: 'Hapus' })) return;
    const r = await admDo(e.currentTarget, '…', 'simpanRahasia', 'FONNTE_TOKEN', '__HAPUS__'); if (r) { S.adm.notif = null; nfKonfig(); }
  };
  $('#nfTes').onclick = e => admDo(e.currentTarget, 'Mengirim…', 'waTest', $('#nfTesNo').value.trim());
  $('#nfRjNow').onclick = e => admDo(e.currentTarget, 'Mengirim…', 'kirimRingkasanSekarang');
  $('#nfMhNow').onclick = async e => { if (await confirmDialog({ title: 'Kirim pengingat mingguan?', message: 'Pegawai yang belum ada kegiatan sejak Senin akan menerima pengingat WhatsApp.', okText: 'Kirim' })) admDo(e.currentTarget, 'Mengirim…', 'kirimPengingatMingguanSekarang'); };
  $('#nfTesE').onclick = e => admDo(e.currentTarget, 'Mengirim…', 'emailTest', $('#nfTesEm').value.trim());
  $('#nfDev').onclick = async e => {
    const r = await admDo(e.currentTarget, 'Memeriksa…', 'waDevice');
    if (r) $('#nfDevOut').innerHTML = `<div class="notice ${r.data.status === 'connect' ? 'green' : 'warn'}">${ic('phone')}<span>Perangkat <b class="mono">${esc(r.data.nomor || '-')}</b> · status <b>${esc(r.data.status || '-')}</b> · kuota ${esc(r.data.kuota || '-')} ${r.data.kedaluwarsa ? '· aktif s.d. ' + esc(r.data.kedaluwarsa) : ''}</span></div>`;
  };
  $$('[data-mt]', box).forEach(b => b.onclick = () => {
    const e = m[b.dataset.mt];
    openModal({ title: e.label, size: 'lg', body: `<div class="stack-16"><div class="field"><label>Subjek email</label><input class="input" id="mtS" value="${esc(e.subjek)}"></div>
      <div class="field"><label>Isi pesan (WA memakai *tebal*)</label><textarea class="textarea mono" id="mtP" rows="9">${esc(e.pesan)}</textarea></div></div>`,
      foot: `<button class="btn btn-ghost" id="mtD">Kembalikan bawaan</button><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="mtOk">Terapkan</button>`,
      onOpen: mm => {
        mm.$('#mtD').onclick = () => { mm.$('#mtS').value = e.subjekDefault; mm.$('#mtP').value = e.pesanDefault; };
        mm.$('#mtOk').onclick = () => { e.subjek = mm.$('#mtS').value; e.pesan = mm.$('#mtP').value; mm.close(); toast('info', 'Teks diterapkan', 'Klik "Simpan Konfigurasi" untuk menyimpan.'); };
      } });
  });
}

function nfAntrean() {
  const st = S.ui.notif, box = $('#nfBody'), q = S.adm.queue;
  const draw = d => {
    const r = d.ringkas;
    box.innerHTML = `<div class="grid-4 mb-16">${kpi('hourglass-split', 'ic-amber', r.Antri || 0, 'Antri')}${kpi('check2-circle', 'ic-green', r.Terkirim || 0, 'Terkirim')}${kpi('x-octagon', 'ic-red', r.Gagal || 0, 'Gagal')}${kpi('slash-circle', 'ic-sky', r.Batal || 0, 'Batal')}</div>
      <div class="card mb-16"><div class="filter-bar"><select class="select" id="aqS"><option value="">Semua status</option>${['Antri', 'Terkirim', 'Gagal', 'Batal'].map(x => `<option ${st.qStatus === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select class="select" id="aqK"><option value="">Semua kanal</option>${['WA', 'EMAIL'].map(x => `<option ${st.qKanal === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button class="btn btn-outline" id="aqRetry" ${r.Gagal ? '' : 'disabled'}>${ic('arrow-repeat')} Ulangi yang gagal</button><button class="btn btn-ghost" id="aqRef">${ic('arrow-clockwise')}</button></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Kanal</th><th>Penerima</th><th>Event</th><th>Pesan</th><th>Status</th></tr></thead><tbody>
      ${d.rows.filter(x => (!st.qStatus || x.Status === st.qStatus) && (!st.qKanal || x.Kanal === st.qKanal)).slice(0, 200).map(x => `<tr style="cursor:default"><td class="mono text-xs">${esc((x.DikirimPada || x.DibuatPada).slice(5, 16))}</td><td>${x.Kanal === 'WA' ? ic('whatsapp') : ic('envelope')}</td>
        <td class="text-sm"><b>${esc(x.NamaPenerima)}</b><div class="mono text-xs muted">${esc(x.Tujuan)}</div></td><td class="text-xs">${esc(x.Event)}</td><td class="text-xs clamp2" style="max-width:320px">${esc(x.Pesan)}</td>
        <td>${admPill(x.Status)}${x.Status === 'Gagal' ? `<div class="text-xs muted">${esc(String(x.Respon).slice(0, 60))}</div>` : ''}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('inbox', 'Antrean kosong')}</td></tr>`}
      </tbody></table></div>`;
    $('#aqS').onchange = e => { st.qStatus = e.target.value; draw(d); };
    $('#aqK').onchange = e => { st.qKanal = e.target.value; draw(d); };
    $('#aqRef').onclick = () => { S.adm.queue = null; nfAntrean(); };
    $('#aqRetry').onclick = async e => { if (await admDo(e.currentTarget, '…', 'notifRetry', [])) { S.adm.queue = null; nfAntrean(); } };
  };
  if (q) draw(q); else box.innerHTML = skelRows(6);
  admLoad('queue', 'notifQueue', {}).then(d => d && onRoute('notifikasi') && st.tab === 'antrean' && draw(d));
}

function nfBlast() {
  const box = $('#nfBody'), L = S.adm.blasts;
  const st = S.ui.blast = S.ui.blast || { sumber: 'crm', segmen: '', tag: '', statusWA: '', manual: '', aud: null, hanyaTerdaftar: true };
  const listHtml = l => !l ? skelRows(3) : (l.length ? l.map(b => `<div class="card-tint mb-8"><div class="row-between gap-8"><div class="grow"><b>${esc(b.judul)}</b><div class="text-xs muted">${esc(b.tanggal)} · ${esc(b.oleh)} · batch ${b.batch} · jeda ${esc(b.jeda)} dtk</div></div>${admPill(b.status)}</div>
      <div class="progress mt-8"><i style="width:${b.persen}%"></i></div><div class="row-between text-xs mt-4"><span>${b.terkirim} terkirim · ${b.gagal} gagal · ${b.sisa} sisa dari ${b.total}</span>
      <span class="row gap-4">${b.status === 'Berjalan' ? `<button class="btn btn-soft btn-sm" data-bp="${b.id}">${ic('play')} Kirim batch</button><button class="btn btn-ghost btn-sm" data-bs="${b.id}">${ic('stop')} Hentikan</button>` : ''}</span></div></div>`).join('') : `<p class="text-sm muted">Belum ada blast.</p>`);
  const segmen = ['', 'Pegawai Lapangan', 'Pimpinan', 'Admin', 'Kader', 'Mitra'];
  box.innerHTML = `<div class="dash-grid two">
    <div class="card stack-16"><h3 class="section-title">${ic('megaphone')} Blast Baru</h3>
      ${S.adm.notif && !S.adm.notif.waAktif ? `<div class="notice warn">${ic('exclamation-triangle')}<span>WhatsApp belum aktif. Isi token & aktifkan di tab Konfigurasi.</span></div>` : ''}
      <div class="field"><label for="blJ">Judul (internal)</label><input class="input" id="blJ" placeholder="Mis. Undangan Rapat Lokmin Oktober"></div>
      <div class="field"><label for="blP">Isi pesan</label><textarea class="textarea" id="blP" rows="6" placeholder="Yth. {nama},&#10;…&#10;— {institusi}"></textarea><span class="help">Variabel: {nama} {institusi} {link}. Gunakan *teks* untuk tebal.</span></div>
      <div class="segmented"><button class="${st.sumber === 'crm' ? 'active' : ''}" data-src="crm">Dari CRM</button><button class="${st.sumber === 'manual' ? 'active' : ''}" data-src="manual">Daftar manual</button></div>
      ${st.sumber === 'crm' ? `<div class="grid-3"><select class="select" id="blSeg">${segmen.map(x => `<option value="${x}" ${st.segmen === x ? 'selected' : ''}>${x || 'Semua segmen'}</option>`).join('')}</select>
        <input class="input" id="blTag" placeholder="Tag (opsional)" value="${esc(st.tag)}"><select class="select" id="blWa"><option value="">Semua status WA</option>${['Terdaftar', 'Tidak Terdaftar'].map(x => `<option ${st.statusWA === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`
        : `<textarea class="textarea mono" id="blMan" rows="4" placeholder="081234567890|Nama&#10;081298765432|Nama lain">${esc(st.manual)}</textarea>`}
      <button class="btn btn-outline" id="blAud">${ic('people')} Hitung penerima</button>
      <div id="blAudOut"></div>
      <div class="grid-2"><div class="field"><label>Ukuran batch</label><select class="select" id="blB">${[10, 20, 50].map(n => `<option ${(S.adm.notif ? S.adm.notif.batchDefault : 20) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>Jeda (detik)</label><input class="input mono" id="blD" value="${esc(S.adm.notif ? S.adm.notif.jeda : '5')}"></div></div>
      <label class="check"><input type="checkbox" id="blHT" ${st.hanyaTerdaftar ? 'checked' : ''}> Lewati nomor yang tidak terdaftar WhatsApp</label>
      <button class="btn btn-primary btn-lg" id="blGo" disabled>${ic('send')} Buat Blast</button>
    </div>
    <div class="card"><div class="row-between mb-8"><h3 class="section-title">Riwayat Blast</h3><button class="btn btn-ghost btn-sm" id="blRef">${ic('arrow-clockwise')}</button></div><div id="blList">${listHtml(L)}</div></div>
  </div>`;
  const bindList = () => {
    $$('[data-bp]', box).forEach(b => b.onclick = async e => { const r = await admDo(e.currentTarget, 'Mengirim…', 'waBlastProcess', b.dataset.bp); if (r) { S.adm.blasts = r.data; $('#blList').innerHTML = listHtml(r.data); bindList(); } });
    $$('[data-bs]', box).forEach(b => b.onclick = async e => { if (!await confirmDialog({ title: 'Hentikan blast?', message: 'Pesan yang belum terkirim dibatalkan.', danger: true, okText: 'Hentikan' })) return; const r = await admDo(e.currentTarget, '…', 'waBlastStop', b.dataset.bs); if (r) { S.adm.blasts = r.data; $('#blList').innerHTML = listHtml(r.data); bindList(); } });
  };
  bindList();
  if (!S.adm.notif) admLoad('notif', 'notifConfig');
  admLoad('blasts', 'waBlastList').then(d => { if (d && onRoute('notifikasi') && $('#blList')) { $('#blList').innerHTML = listHtml(d); bindList(); } });
  $$('[data-src]', box).forEach(b => b.onclick = () => { st.sumber = b.dataset.src; st.aud = null; nfBlast(); });
  $('#blRef').onclick = () => admLoad('blasts', 'waBlastList').then(d => { if (d) { $('#blList').innerHTML = listHtml(d); bindList(); } });
  $('#blAud').onclick = async e => {
    const f = st.sumber === 'crm' ? { sumber: 'crm', segmen: (st.segmen = $('#blSeg').value), tag: (st.tag = $('#blTag').value.trim()), statusWA: (st.statusWA = $('#blWa').value) } : { sumber: 'manual', manual: (st.manual = $('#blMan').value) };
    const r = await admDo(e.currentTarget, 'Menghitung…', 'waAudience', f);
    if (!r) return;
    st.aud = r.data; const g = r.data.ringkas;
    $('#blAudOut').innerHTML = `<div class="notice green">${ic('people-fill')}<span><b>${g.valid}</b> nomor valid dari ${g.total} · ${g.tidakValid} tidak valid · ${g.ganda} ganda · ${g.optOut} opt-out · ${g.terdaftarWA} terdaftar WA</span></div>`;
    $('#blGo').disabled = !g.valid;
  };
  $('#blGo').onclick = async e => {
    const aud = st.aud; if (!aud) return;
    const penerima = aud.rows.filter(x => x.valid && !x.ganda && !x.optOut).map(x => ({ nama: x.nama, hp: x.hp, statusWA: x.statusWA }));
    const ok = await confirmDialog({ title: 'Kirim blast?', message: `${penerima.length} pesan akan masuk antrean dan dikirim bertahap (batch ${$('#blB').value}).`, okText: 'Ya, buat blast' });
    if (!ok) return;
    const r = await admDo(e.currentTarget, 'Membuat…', 'waBlastCreate', { judul: $('#blJ').value.trim(), pesan: $('#blP').value, ukuranBatch: +$('#blB').value, jeda: $('#blD').value.trim(), sasaran: st.sumber === 'crm' ? (st.segmen || 'Semua') + (st.tag ? ' #' + st.tag : '') : 'Manual', penerima, hanyaTerdaftar: $('#blHT').checked });
    if (r) { st.aud = null; S.adm.blasts = null; nfBlast(); }
  };
}

// ═══════════════════════════════ CRM KONTAK ═════════════════════════════════
S.ui.crm = S.ui.crm || { cari: '', segmen: '', sumber: '', statusWA: '', tag: '', duplikat: false, halaman: 1, sel: new Set() };
RENDER.crm = function () {
  const st = S.ui.crm, el = $('#pg-crm'), d = S.adm.crm, s = S.adm.crmStats;
  const filt = () => ({ cari: st.cari, segmen: st.segmen, sumber: st.sumber, statusWA: st.statusWA, tag: st.tag, duplikat: st.duplikat, halaman: st.halaman, per: 50 });
  const facet = (k, label) => d ? `<select class="select" data-cf="${k}"><option value="">${label}</option>${Object.entries(d.facet[k] || {}).map(([v, n]) => `<option value="${esc(v)}" ${st[k] === v ? 'selected' : ''}>${esc(v)} (${n})</option>`).join('')}</select>` : '';
  el.innerHTML = admHead('CRM Kontak', 'Nama · Email · WhatsApp seluruh pegawai (sinkron otomatis) dan kontak mitra seperti kader & kepala desa.',
    `<div class="row gap-8"><button class="btn btn-outline" id="crSync">${ic('arrow-repeat')} Sinkron</button><button class="btn btn-outline" id="crImp">${ic('upload')} Impor</button><button class="btn btn-outline" id="crExp">${ic('download')} Ekspor</button></div>`) +
    `<div class="grid-4 mb-16">${s ? kpi('people', 'ic-green', s.total, 'Total kontak', s.baru7 + ' baru 7 hari') + kpi('whatsapp', 'ic-green', s.terdaftarWA, 'Terdaftar WA', s.belumCek + ' belum dicek') + kpi('envelope-check', 'ic-sky', s.emailValid, 'Email valid') + kpi('exclamation-diamond', 'ic-amber', s.duplikat, 'Duplikat', s.optOut + ' opt-out · ' + s.tidakBisa + ' tak terjangkau') : skelRows(1, 96)}</div>
    <div class="card mb-16"><div class="filter-bar"><div class="input-icon">${ic('search')}<input class="input" id="crQ" placeholder="Cari nama, NIP, email, nomor" value="${esc(st.cari)}"></div>
      ${facet('segmen', 'Semua segmen')}${facet('statusWA', 'Semua status WA')}${facet('sumber', 'Semua sumber')}
      <label class="check"><input type="checkbox" id="crDup" ${st.duplikat ? 'checked' : ''}> Hanya duplikat</label></div></div>
    <div class="bulk-bar" id="crBulk" ${st.sel.size ? '' : 'hidden'}><b>${st.sel.size} dipilih</b><button class="btn btn-soft btn-sm" data-cb="tag">${ic('tag')} Tag</button><button class="btn btn-soft btn-sm" data-cb="untag">Lepas tag</button><button class="btn btn-soft btn-sm" data-cb="optout">${ic('bell-slash')} Opt-out</button><button class="btn btn-soft btn-sm" data-cb="optin">Opt-in</button>${st.sel.size > 1 ? `<button class="btn btn-soft btn-sm" data-cb="merge">${ic('union')} Gabung</button>` : ''}<button class="btn btn-ghost btn-sm" data-cb="hapusManual">${ic('trash')} Hapus (manual)</button></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input type="checkbox" id="crAll"></th><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Segmen</th><th>Tag</th><th>Pesan</th></tr></thead><tbody id="crBody">
    ${!d ? `<tr><td colspan="7">${skelRows(5, 28)}</td></tr>` : d.rows.map(k => `<tr data-ck="${k.id}"><td onclick="event.stopPropagation()"><input type="checkbox" data-cs="${k.id}" ${st.sel.has(k.id) ? 'checked' : ''}></td>
      <td><b>${esc(k.nama)}</b>${k.duplikat ? ' <span class="pill pill-flag">duplikat</span>' : ''}<div class="text-xs muted">${esc(k.info.Jabatan || '')}${k.info.Unit ? ' · ' + esc(k.info.Unit) : ''}${k.sumber === 'manual' ? 'Kontak manual' : ''}</div></td>
      <td><span class="mono text-sm">${esc(k.wa || '—')}</span> ${k.wa ? admPill(k.statusWA || 'Belum dicek') : ''}${k.optOut ? ' <span class="pill pill-tidak">opt-out</span>' : ''}</td>
      <td class="text-sm">${esc(k.email || '—')}${k.email && k.emailValid === 'TIDAK' ? ' <span class="pill pill-tidak">tidak valid</span>' : ''}</td><td class="text-sm">${esc(k.segmen)}</td>
      <td class="text-xs">${esc(k.tag)}</td><td class="mono text-sm">${k.jumlahPesan}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('person-x', 'Tidak ada kontak')}</td></tr>`}
    </tbody></table></div>
    ${d && d.total > d.per ? `<div class="pager mt-16">${pageButtons(d.halaman, Math.ceil(d.total / d.per))}</div>` : ''}
    <p class="text-xs muted mt-8">${d ? `${d.total} kontak · sinkron terakhir ${d.sinkronTerakhir ? new Date(d.sinkronTerakhir).toLocaleString('id-ID') : '-'}` : ''}</p>`;
  const reload = () => admLoad('crm', 'crmList', filt()).then(x => x && onRoute('crm') && RENDER.crm());
  $('#crQ').oninput = debounce(e => { st.cari = e.target.value; st.halaman = 1; reload(); }, 300);
  $$('[data-cf]', el).forEach(x => x.onchange = () => { st[x.dataset.cf] = x.value; st.halaman = 1; reload(); });
  $('#crDup').onchange = e => { st.duplikat = e.target.checked; reload(); };
  $$('[data-pg]', el).forEach(b => b.onclick = () => { st.halaman = +b.dataset.pg; reload(); });
  $$('[data-cs]', el).forEach(c => c.onchange = () => { c.checked ? st.sel.add(c.dataset.cs) : st.sel.delete(c.dataset.cs); RENDER.crm(); });
  $('#crAll').onchange = e => { (d ? d.rows : []).forEach(k => e.target.checked ? st.sel.add(k.id) : st.sel.delete(k.id)); RENDER.crm(); };
  $$('[data-ck]', el).forEach(tr => tr.onclick = () => crmDetailDrawer(tr.dataset.ck));
  $('#crSync').onclick = async e => { if (await admDo(e.currentTarget, 'Sinkron…', 'crmSync')) { S.adm.crmStats = null; reload(); admLoad('crmStats', 'crmStats'); } };
  $('#crExp').onclick = async e => {
    const r = await admDo(e.currentTarget, 'Mengekspor…', 'crmExport', filt()); if (!r) return;
    const head = ['Nama', 'WhatsApp', 'StatusWA', 'Email', 'Segmen', 'Sumber', 'Tag', 'OptOut', 'NIP', 'Jabatan', 'Unit', 'JumlahPesan', 'TerakhirDihubungi'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [head.join(',')].concat(r.data.rows.map(k => [k.nama, k.wa, k.statusWA, k.email, k.segmen, k.sumber, k.tag, k.optOut ? 'YA' : 'TIDAK', k.info.NIP, k.info.Jabatan, k.info.Unit, k.jumlahPesan, k.terakhir].map(q).join(','))).join('\n');
    downloadBase64(btoa(unescape(encodeURIComponent('﻿' + csv))), 'CRM_Kontak_' + todayStr() + '.csv', 'text/csv');
  };
  $('#crImp').onclick = crmImporModal;
  $$('[data-cb]', el).forEach(b => b.onclick = async e => {
    const aksi = b.dataset.cb, ids = Array.from(st.sel);
    if (aksi === 'merge') return crmMergeModal(ids);
    let nilai = '';
    if (aksi === 'tag' || aksi === 'untag') { nilai = prompt('Nama tag:'); if (!nilai) return; }
    if (aksi === 'hapusManual' && !await confirmDialog({ title: 'Hapus kontak manual?', message: 'Hanya kontak bersumber manual yang dihapus. Kontak pegawai tidak terpengaruh.', danger: true, okText: 'Hapus' })) return;
    if (await admDo(e.currentTarget, '…', 'crmBulk', ids, aksi, nilai)) { st.sel.clear(); S.adm.crmStats = null; reload(); admLoad('crmStats', 'crmStats'); }
  });
  if (!d) reload();
  if (!s) admLoad('crmStats', 'crmStats').then(x => x && onRoute('crm') && RENDER.crm());
};

async function crmDetailDrawer(id) {
  const dr = openDrawer({ title: 'Detail Kontak', body: skelRows(5) });
  const r = await admLoad('crmDetail', 'crmDetail', id);
  if (!r) return dr.close();
  const k = r.kontak;
  const body = `<div class="stack-16">
    <div class="row gap-12"><div class="avatar lg">${esc(initials(k.nama))}</div><div class="grow"><div class="fw-7 text-lg">${esc(k.nama)}</div><div class="text-sm muted">${esc(k.segmen)} · ${esc(k.sumber)}${k.info.NIP ? ' · NIP ' + esc(k.info.NIP) : ''}</div></div></div>
    <div class="row gap-8 wrap">${k.wa ? `<a class="btn btn-soft btn-sm" href="https://wa.me/${esc(k.wa.replace(/^0/, '62'))}" target="_blank" rel="noopener">${ic('whatsapp')} Chat WA</a>` : ''}${k.email ? `<a class="btn btn-soft btn-sm" href="mailto:${esc(k.email)}">${ic('envelope')} Email</a>` : ''}</div>
    <div class="grid-2"><div class="field"><label>No. WhatsApp</label><input class="input mono" id="cdW" value="${esc(k.wa)}"></div><div class="field"><label>Email</label><input class="input" id="cdE" value="${esc(k.email)}"></div></div>
    <div class="field"><label>Tag (pisahkan koma)</label><input class="input" id="cdT" value="${esc(k.tag)}"></div>
    <div class="field"><label>Catatan</label><textarea class="textarea" id="cdC" rows="3">${esc(k.catatan)}</textarea></div>
    ${swRow('cdO', 'Opt-out (tidak menerima blast)', '', k.optOut)}
    ${k.sumber === 'pegawai' ? `<p class="help">${ic('info-circle')} Perubahan nama/WA/email ikut memperbarui data pegawai.</p>` : ''}
    <div class="card-tint stack"><b class="text-sm">Catat interaksi</b><div class="row gap-8"><select class="select" id="cdK" style="max-width:140px">${['Telepon', 'WA Manual', 'Kunjungan', 'Catatan'].map(x => `<option>${x}</option>`).join('')}</select><input class="input grow" id="cdR" placeholder="Ringkasan…"><button class="btn btn-soft" id="cdAdd">${ic('plus')}</button></div></div>
    <div><b class="text-sm">Timeline</b><div class="timeline mt-8" id="cdTl">${tl(r.timeline)}</div></div></div>`;
  function tl(t) { return t.length ? t.map(x => `<div class="row gap-8" style="padding:8px 0;border-bottom:1px solid var(--border);align-items:flex-start">${ic(x.jenis === 'pesan' ? (x.kanal === 'WA' ? 'whatsapp' : 'envelope') : 'chat-left-text')}<div class="grow"><div class="text-sm">${esc(x.ringkasan)}</div><div class="text-xs muted mono">${esc(x.waktu)} · ${esc(x.kanal)}${x.oleh ? ' · ' + esc(x.oleh) : ''}${x.status ? ' · ' + esc(x.status) : ''}</div></div></div>`).join('') : '<p class="text-sm muted">Belum ada interaksi.</p>'; }
  dr.el.querySelector('.drawer-body, .modal-body') && (dr.el.querySelector('.drawer-body, .modal-body').innerHTML = body);
  const foot = dr.el.querySelector('.drawer-foot, .modal-foot');
  if (foot) foot.innerHTML = `<button class="btn btn-outline" data-close>Tutup</button><button class="btn btn-primary" id="cdSave">${ic('check2')} Simpan</button>`;
  dr.$('#cdAdd').onclick = async e => { const x = await admDo(e.currentTarget, '…', 'crmInteraksi', id, dr.$('#cdK').value, dr.$('#cdR').value.trim()); if (x) { dr.$('#cdR').value = ''; dr.$('#cdTl').innerHTML = tl(x.data.timeline); } };
  const save = dr.$('#cdSave');
  if (save) save.onclick = async e => {
    const x = await admDo(e.currentTarget, 'Menyimpan…', 'crmSave', { id, wa: dr.$('#cdW').value.trim(), email: dr.$('#cdE').value.trim(), tag: dr.$('#cdT').value.trim(), catatan: dr.$('#cdC').value, optOut: dr.$('#cdO').checked });
    if (x) { dr.close(); S.adm.crmStats = null; admLoad('crm', 'crmList', Object.assign({}, S.ui.crm, { sel: undefined })).then(() => onRoute('crm') && RENDER.crm()); }
  };
}

function crmImporModal() {
  openModal({ title: 'Impor Kontak Mitra', size: 'lg', body: `<div class="stack-16"><p class="text-sm muted">Untuk kader posyandu, kepala desa, guru UKS, dan mitra lain di luar daftar pegawai. Satu baris per kontak:</p>
    <pre class="card-tint mono text-xs" style="margin:0">Nama;No WA;Email;Segmen;Tag\nMaria Kader;081234567890;;Kader;Posyandu Melati</pre>
    <textarea class="textarea mono" id="ciT" rows="8" placeholder="Tempel dari Excel (kolom dipisah Tab, ; atau ,)"></textarea>
    <p class="help">${ic('shield-check')} Nomor ganda otomatis dilewati — aman diimpor berulang.</p></div>`,
    foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="ciGo">${ic('upload')} Impor</button>`,
    onOpen: m => m.$('#ciGo').onclick = async e => {
      const rows = m.$('#ciT').value.split(/\r?\n/).map(l => l.split(/\t|;|,/).map(x => x.trim())).filter(p => p[0] && !/^nama$/i.test(p[0]))
        .map(p => ({ nama: p[0], wa: p[1] || '', email: p[2] || '', segmen: p[3] || 'Mitra', tag: p[4] || '' }));
      if (!rows.length) return toast('warning', 'Tidak ada baris yang bisa dibaca');
      if (await admDo(e.currentTarget, 'Mengimpor…', 'crmImport', rows)) { m.close(); S.adm.crm = null; S.adm.crmStats = null; RENDER.crm(); }
    } });
}
function crmMergeModal(ids) {
  const rows = (S.adm.crm ? S.adm.crm.rows : []).filter(k => ids.includes(k.id));
  openModal({ title: 'Gabung Kontak Duplikat', body: `<p class="text-sm muted mb-8">Pilih kontak UTAMA. Tag, catatan, dan jumlah pesan kontak lain digabung ke kontak utama.</p>
    ${rows.map((k, i) => `<label class="check card-tint mb-8"><input type="radio" name="mu" value="${k.id}" ${i ? '' : 'checked'}> <span><b>${esc(k.nama)}</b> · <span class="mono">${esc(k.wa)}</span> · ${esc(k.sumber)}</span></label>`).join('')}`,
    foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="mgGo">${ic('union')} Gabungkan</button>`,
    onOpen: m => m.$('#mgGo').onclick = async e => {
      const utama = m.el.querySelector('input[name=mu]:checked').value;
      if (await admDo(e.currentTarget, '…', 'crmMerge', utama, ids.filter(x => x !== utama))) { m.close(); S.ui.crm.sel.clear(); S.adm.crm = null; S.adm.crmStats = null; RENDER.crm(); }
    } });
}

// ═════════════════════════ DOKUMEN & VERIFIKASI ════════════════════════════
S.ui.dok = S.ui.dok || { cari: '', status: '', halaman: 1 };
RENDER.dokumen = function () {
  const el = $('#pg-dokumen'), st = S.ui.dok, ds = S.adm.deStatus, dl = S.adm.deDaftar, admin = isAdmin();
  const tplCard = !ds ? skelRows(3) : `<div class="stack-16">
    <div class="stack"><span class="fw-6">Mesin dokumen</span><div class="segmented">${[['docs', 'Template Google Docs'], ['html', 'HTML bawaan']].map(([v, l]) => `<button class="${ds.engine === v ? 'active' : ''}" data-eng="${v}" ${admin ? '' : 'disabled'}>${l}</button>`).join('')}</div></div>
    ${ds.template && !ds.template.error ? `<div class="card-tint row gap-12"><span style="font-size:28px;color:var(--accent)">${ic('file-earmark-word-fill')}</span><div class="grow"><b class="text-sm">${esc(ds.template.nama)}</b><div class="text-xs muted">versi ${esc(ds.versi || '1')} · diubah ${esc(ds.template.diubah || '-')}</div></div>
      <a class="btn btn-outline btn-sm" href="${esc(ds.template.url)}" target="_blank" rel="noopener">${ic('pencil-square')} Edit di Docs</a></div>` : `<div class="notice warn">${ic('exclamation-triangle')}<span>${ds.template ? esc(ds.template.error) : 'Template belum ada.'}</span></div>`}
    ${admin ? `<div class="row gap-8 wrap"><button class="btn btn-soft btn-sm" id="dePind">${ic('upc-scan')} Pindai placeholder</button><button class="btn btn-ghost btn-sm" id="deBaru">${ic('file-earmark-plus')} Buat template bawaan</button><button class="btn btn-ghost btn-sm" id="deSendiri">${ic('link')} Pakai Docs sendiri</button></div>` : ''}
    <details ${(ds.bidang || []).some(b => !b.dikenal) ? 'open' : ''}><summary class="text-sm fw-6" style="cursor:pointer">Placeholder di template (${(ds.bidang || []).length})${(ds.bidang || []).some(b => !b.dikenal) ? ' · <span style="color:var(--flag-text)">ada yang tidak dikenal</span>' : ' · semua dikenal ✓'}</summary>
      <div class="row wrap gap-4 mt-8">${(ds.bidang || []).map(b => `<span class="pill ${b.dikenal ? 'pill-green' : 'pill-flag'} mono" title="${esc(b.arti)}">{{${esc(b.kunci)}}}</span>`).join('')}</div></details>
    <details><summary class="text-sm fw-6" style="cursor:pointer">Daftar placeholder yang tersedia</summary><div class="text-xs mt-8 stack">
      ${[['Teks', ds.placeholder.teks], ['Baris tabel (diulang per kegiatan, tandai baris dengan {{#KEGIATAN}})', ds.placeholder.baris], ['Gambar', ds.placeholder.gambar]].map(([t, o]) => `<div><b>${t}</b><div class="row wrap gap-4 mt-4">${Object.entries(o).map(([k, v]) => `<span class="pill pill-tercatat mono" title="${esc(v)}">{{${k}}}</span>`).join('')}</div></div>`).join('')}</div></details>
  </div>`;
  el.innerHTML = admHead('Dokumen &amp; Verifikasi', 'Setiap laporan PDF bernomor, ber-QR, dan tercatat. Siapa pun dapat memindai QR untuk memastikan keasliannya.',
    `<button class="btn btn-primary" data-go="laporan">${ic('file-earmark-pdf')} Buat Laporan</button>`) +
    `<div class="grid-4 mb-16">${ds ? kpi('patch-check', 'ic-green', ds.terbit, 'Dokumen terbit') + kpi('x-octagon', 'ic-red', ds.ditarik, 'Ditarik') + kpi('gear', 'ic-sky', ds.engine === 'docs' ? 'Docs' : 'HTML', 'Mesin aktif') + kpi('qr-code', 'ic-amber', '#/cek', 'Halaman verifikasi', '', `onclick="window.open(location.pathname+'#/cek','_blank')"`) : skelRows(1, 96)}</div>
    <div class="dash-grid two"><div class="card"><h3 class="section-title mb-8">Template Laporan</h3>${tplCard}</div>
      <div class="card"><div class="filter-bar mb-8"><div class="input-icon">${ic('search')}<input class="input" id="dkQ" placeholder="Cari nomor, kode, pegawai" value="${esc(st.cari)}"></div><select class="select" id="dkS"><option value="">Semua</option><option ${st.status === 'TERBIT' ? 'selected' : ''}>TERBIT</option><option ${st.status === 'DITARIK' ? 'selected' : ''}>DITARIK</option></select></div>
        <div id="dkList">${!dl ? skelRows(4) : dl.rows.map(x => `<div class="row gap-12" style="padding:10px 0;border-bottom:1px solid var(--border)"><span style="font-size:22px;color:${x.status === 'TERBIT' ? 'var(--primary)' : 'var(--danger)'}">${ic(x.status === 'TERBIT' ? 'patch-check-fill' : 'x-octagon-fill')}</span>
          <div class="grow" style="min-width:0"><div class="text-sm fw-6 ellipsis">${esc(x.pegawai)} — ${esc(x.periode)}</div><div class="mono text-xs muted ellipsis">${esc(x.nomor)} · ${esc(x.kode)}</div>${x.alasanTarik ? `<div class="text-xs" style="color:var(--danger-text)">${esc(x.alasanTarik)}</div>` : ''}</div>
          ${admPill(x.status)}<button class="icon-btn" data-dkdl="${esc(x.berkasId)}" title="Unduh">${ic('download')}</button>${x.status === 'TERBIT' ? `<button class="icon-btn" data-dkt="${x.id}" title="Tarik">${ic('slash-circle')}</button>` : ''}</div>`).join('') || emptyState('file-earmark', 'Belum ada dokumen')}</div>
        ${dl && dl.total > 25 ? `<div class="pager mt-8">${pageButtons(dl.halaman, Math.ceil(dl.total / 25))}</div>` : ''}</div></div>`;
  const loadList = () => admLoad('deDaftar', 'deDaftar', st).then(x => x && onRoute('dokumen') && RENDER.dokumen());
  $('#dkQ').oninput = debounce(e => { st.cari = e.target.value; st.halaman = 1; loadList(); }, 300);
  $('#dkS').onchange = e => { st.status = e.target.value; loadList(); };
  $$('[data-pg]', el).forEach(b => b.onclick = () => { st.halaman = +b.dataset.pg; loadList(); });
  $$('[data-eng]', el).forEach(b => b.onclick = async e => { const r = await admDo(e.currentTarget, '…', 'deSimpanEngine', b.dataset.eng, ''); if (r) { S.adm.deStatus = r.data; RENDER.dokumen(); } });
  if ($('#dePind')) $('#dePind').onclick = async e => { if (await admDo(e.currentTarget, 'Memindai…', 'dePindai')) admLoad('deStatus', 'deStatus').then(() => RENDER.dokumen()); };
  if ($('#deBaru')) $('#deBaru').onclick = async e => {
    if (!await confirmDialog({ title: 'Buat template bawaan baru?', message: 'Template lama tetap tersimpan di Drive, tetapi aplikasi akan memakai template baru.', okText: 'Buat' })) return;
    const r = await admDo(e.currentTarget, 'Membuat…', 'deBuatTemplate'); if (r) { S.adm.deStatus = r.data; RENDER.dokumen(); }
  };
  if ($('#deSendiri')) $('#deSendiri').onclick = () => openModal({ title: 'Pakai Google Docs sendiri', body: `<div class="stack-16"><p class="text-sm muted">Salin template bawaan, ubah sesuka hati di Google Docs (kop, kalimat, tata letak), lalu tempel URL-nya di sini. Wajib ada satu baris tabel berisi <span class="mono">{{#KEGIATAN}}</span>.</p>
      <input class="input mono" id="dsU" placeholder="https://docs.google.com/document/d/…/edit"></div>`, foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="dsGo">Pakai template</button>`,
    onOpen: m => m.$('#dsGo').onclick = async e => { const r = await admDo(e.currentTarget, 'Memeriksa…', 'deSimpanEngine', 'docs', m.$('#dsU').value.trim()); if (r) { S.adm.deStatus = r.data; m.close(); RENDER.dokumen(); } } });
  $$('[data-dkdl]', el).forEach(b => b.onclick = async () => { b.innerHTML = '<span class="spin"></span>'; try { const x = await api('unduhLaporan', S.token, b.dataset.dkdl); if (x.success) downloadBase64(x.data.base64, x.data.name, 'application/pdf'); else toast('error', 'Gagal', x.message); } catch (e) { toast('error', 'Tidak dapat terhubung', e.message); } b.innerHTML = ic('download'); });
  $$('[data-dkt]', el).forEach(b => b.onclick = () => openModal({ title: 'Tarik Dokumen', body: `<div class="stack-16"><div class="notice danger">${ic('exclamation-octagon')}<span>Setelah ditarik, pemindaian QR dokumen ini akan menampilkan status <b>DITARIK</b>. Tindakan ini tercatat di log.</span></div><div class="field"><label>Alasan</label><textarea class="textarea" id="tkA" rows="3"></textarea></div></div>`,
    foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-danger-solid" id="tkGo">Tarik Dokumen</button>`,
    onOpen: m => m.$('#tkGo').onclick = async e => { if (await admDo(e.currentTarget, '…', 'deTarik', b.dataset.dkt, m.$('#tkA').value.trim())) { m.close(); S.adm.deStatus = null; loadList(); admLoad('deStatus', 'deStatus'); } } }));
  if (!ds) admLoad('deStatus', 'deStatus').then(x => x && onRoute('dokumen') && RENDER.dokumen());
  if (!dl) loadList();
};

// ═════════════════════════════ MIGRASI DATA ═════════════════════════════════
RENDER.migrasi = function () {
  const el = $('#pg-migrasi'), d = S.adm.mig, thn = +todayStr().slice(0, 4);
  el.innerHTML = admHead('Migrasi Data', 'Pindahkan data SIMONIK-LG v1 atau rekap manual lama ke database ini. Semua langkah bisa diuji coba dulu (dry-run) dan aman diulang.') +
    `<div class="grid-4 mb-16">${d ? kpi('diagram-3', 'ic-green', 'v' + d.skema, 'Versi skema', d.skema < d.skemaApp ? 'Perlu upgrade ke v' + d.skemaApp : 'Terbaru') + kpi('people', 'ic-sky', d.jumlah.Pegawai, 'Pegawai') + kpi('clipboard-data', 'ic-amber', d.jumlah.Kegiatan, 'Kegiatan aktif', d.rentang ? tglIndo(d.rentang.dari, 1) + ' – ' + tglIndo(d.rentang.sampai, 1) : '') + kpi('archive', 'ic-orange', d.arsip.length, 'Arsip tahunan') : skelRows(1, 96)}</div>
    <div class="dash-grid two"><div class="stack-16">
      <div class="card stack-16"><h3 class="section-title">${ic('1-circle')} Upgrade skema</h3><p class="text-sm muted">Menambah sheet/kolom baru (No_HP, CRM, antrean, dokumen) tanpa menghapus data lama.</p><button class="btn btn-soft" id="mgSk">${ic('arrow-up-circle')} Periksa &amp; upgrade skema</button></div>
      <div class="card stack-16"><h3 class="section-title">${ic('2-circle')} Impor dari SIMONIK-LG v1</h3>
        <div class="field"><label for="mgSrc">URL / ID spreadsheet DB_SIMONIK_LG lama</label><input class="input mono" id="mgSrc" placeholder="https://docs.google.com/spreadsheets/d/…"></div>
        <div class="row wrap gap-8">${['Pegawai', 'Kegiatan', 'Master_Lokasi', 'Master_Jenis_Kegiatan', 'Pengaturan', 'Log_Hapus'].map(x => `<label class="check"><input type="checkbox" data-ms="${x}" ${['Pegawai', 'Kegiatan', 'Master_Lokasi', 'Master_Jenis_Kegiatan'].includes(x) ? 'checked' : ''}> ${x.replace(/_/g, ' ')}</label>`).join('')}</div>
        <label class="check"><input type="checkbox" id="mgTimpa"> Timpa data yang sudah ada (bila berbeda)</label>
        <label class="check"><input type="checkbox" id="mgDelta"> Delta: hanya yang berubah sejak impor terakhir</label>
        <div class="notice">${ic('info-circle')}<span>Jalankan dengan akun Google yang sama dengan pemilik v1 agar foto/berkas di Drive tetap terbuka. Kata sandi lama tetap berlaku dan otomatis ditingkatkan saat pegawai login.</span></div>
        <div class="row gap-8"><button class="btn btn-outline" id="mgDry">${ic('eye')} Uji coba</button><button class="btn btn-primary" id="mgRun">${ic('database-down')} Impor sekarang</button></div><div id="mgOut"></div></div>
    </div><div class="stack-16">
      <div class="card stack-16"><h3 class="section-title">${ic('3-circle')} Impor rekap manual (CSV)</h3>
        <p class="text-sm muted">Kolom yang dikenali: <span class="mono">Tanggal, NIP/Nama, Desa/Lokasi, Tempat, Jenis, Uraian, Jam Mulai, Jam Selesai, Keterangan</span>. Tanggal boleh 07/03/2025, 2025-03-07, atau 7 Maret 2025.</p>
        <input type="file" id="mgCsv" accept=".csv,text/csv" class="input"><div id="mgCsvOut"></div>
        <div class="row gap-8"><button class="btn btn-outline" id="mgCDry" disabled>${ic('eye')} Uji coba</button><button class="btn btn-primary" id="mgCRun" disabled>${ic('upload')} Impor CSV</button></div></div>
      <div class="card stack-16"><h3 class="section-title">${ic('4-circle')} Arsip tahunan</h3>
        <p class="text-sm muted">Memindahkan kegiatan tahun lama ke spreadsheet arsip terpisah agar aplikasi tetap cepat. Laporan tahun lama tetap bisa dicetak.</p>
        <div class="row gap-8"><select class="select" id="mgTh" style="max-width:140px">${[1, 2, 3, 4, 5].map(i => `<option>${thn - i}</option>`).join('')}</select><button class="btn btn-outline" id="mgADry">${ic('eye')} Uji coba</button><button class="btn btn-soft" id="mgARun">${ic('archive')} Arsipkan</button></div>
        ${d && d.arsip.length ? d.arsip.map(a => `<div class="row-between text-sm"><span>${ic('archive')} Tahun <b>${a.tahun}</b> · ${a.jumlah} kegiatan</span><a href="${esc(a.url)}" target="_blank" rel="noopener">Buka</a></div>`).join('') : ''}</div>
      <div class="card"><h3 class="section-title mb-8">Riwayat migrasi</h3>${d ? (d.log.map(l => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="row-between"><b class="text-sm">${esc(l.Jenis)}</b><span class="mono text-xs muted">${esc(l.Waktu)}</span></div><div class="text-xs muted">${l.DryRun === 'YA' ? '<span class="pill pill-tercatat">uji coba</span> ' : ''}${esc(l.Ringkasan)}</div></div>`).join('') || '<p class="text-sm muted">Belum ada.</p>') : skelRows(3)}</div>
    </div></div>`;
  const reload = () => admLoad('mig', 'migrasiStatus').then(x => x && onRoute('migrasi') && RENDER.migrasi());
  const opt = dry => ({ sumber: $('#mgSrc').value.trim(), sheets: $$('[data-ms]', el).filter(c => c.checked).map(c => c.dataset.ms), dryRun: dry, timpa: $('#mgTimpa').checked, delta: $('#mgDelta').checked });
  const hasil = (r, box) => { if (!r) return; const h = r.data.hasil; box.innerHTML = `<div class="notice ${r.data.dryRun ? '' : 'green'} mt-8">${ic(r.data.dryRun ? 'eye' : 'check-circle')}<div class="text-sm">${h ? Object.entries(h).map(([k, v]) => `<div><b>${k.replace(/_/g, ' ')}</b>: ${v.lewati ? esc(v.lewati) : `+${v.tambah} baru · ${v.ubah} diperbarui · ${v.sama} sama${v.cacat ? ' · ' + v.cacat + ' tanpa kunci' : ''}`}</div>`).join('') : esc(r.message)}</div></div>`; };
  $('#mgSk').onclick = async e => { if (await admDo(e.currentTarget, 'Memeriksa…', 'migrasiSkema')) reload(); };
  $('#mgDry').onclick = async e => hasil(await admDo(e.currentTarget, 'Menguji…', 'migrasiImport', opt(true)), $('#mgOut'));
  $('#mgRun').onclick = async e => {
    if (!await confirmDialog({ title: 'Impor data v1?', message: 'Data akan ditulis ke database aktif. Proses aman diulang (tidak membuat data ganda).', okText: 'Impor' })) return;
    const r = await admDo(e.currentTarget, 'Mengimpor…', 'migrasiImport', opt(false)); hasil(r, $('#mgOut')); if (r) { reload(); syncNow(false); }
  };
  let csvRows = null;
  $('#mgCsv').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    csvRows = parseCsv(await f.text());
    $('#mgCsvOut').innerHTML = `<p class="text-sm">${ic('filetype-csv')} ${csvRows.length} baris terbaca · kolom: <span class="mono text-xs">${esc(Object.keys(csvRows[0] || {}).join(', '))}</span></p>`;
    $('#mgCDry').disabled = $('#mgCRun').disabled = !csvRows.length;
  };
  const csvOut = r => { if (!r) return; const d2 = r.data; $('#mgCsvOut').innerHTML = `<div class="notice ${d2.dryRun ? '' : 'green'}">${ic('info-circle')}<div class="text-sm">${esc(r.message)}${d2.galat.length ? `<div class="text-xs mt-4">${d2.galat.slice(0, 8).map(g => `Baris ${g.baris}: ${esc(g.alasan)}`).join('<br>')}${d2.jumlahGalat > 8 ? '<br>…' : ''}</div>` : ''}</div></div>`; };
  $('#mgCDry').onclick = async e => csvOut(await admDo(e.currentTarget, 'Menguji…', 'migrasiImportCsv', csvRows, true));
  $('#mgCRun').onclick = async e => { const r = await admDo(e.currentTarget, 'Mengimpor…', 'migrasiImportCsv', csvRows, false); csvOut(r); if (r) { reload(); syncNow(false); } };
  $('#mgADry').onclick = e => admDo(e.currentTarget, 'Menghitung…', 'migrasiArsip', $('#mgTh').value, true);
  $('#mgARun').onclick = async e => {
    if (!await confirmDialog({ title: 'Arsipkan tahun ' + $('#mgTh').value + '?', message: 'Kegiatan tahun tersebut dipindah ke spreadsheet arsip (diverifikasi dahulu sebelum dihapus dari database utama).', okText: 'Arsipkan' })) return;
    if (await admDo(e.currentTarget, 'Mengarsipkan…', 'migrasiArsip', $('#mgTh').value, false)) reload();
  };
  if (!d) reload();
};
/** Parser CSV kecil (tanda kutip, koma/titik koma, BOM). */
function parseCsv(txt) {
  txt = txt.replace(/^﻿/, '');
  const delim = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

// ═══════════════════════════════ KEAMANAN ═══════════════════════════════════
RENDER.keamanan = function () {
  const el = $('#pg-keamanan'), d = S.adm.sec;
  const ok = (b, t, f) => `<div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="text-sm">${t}</span><span class="pill ${b ? 'pill-green' : 'pill-tidak'}">${ic(b ? 'check-circle' : 'x-circle')} ${b ? 'Aman' : (f || 'Belum ada')}</span></div>`;
  const perf = API.perf.slice(-20).reverse();
  el.innerHTML = admHead('Keamanan', 'Semua rahasia disimpan di Script Properties server — tidak pernah di kode, Sheets, atau halaman ini.') +
    `<div class="dash-grid two"><div class="stack-16">
      <div class="card"><h3 class="section-title mb-8">${ic('shield-lock')} Status rahasia</h3>${d ? ok(d.sessionSecret, 'Kunci tanda tangan sesi (SESSION_SECRET)') + ok(d.pepper, 'Pepper hash kata sandi (PEPPER)') + ok(d.darurat, 'Akses darurat (hash, bukan teks asli)') + ok(d.fonnte.ada, 'Token Fonnte ' + (d.fonnte.ada ? `<span class="mono">${esc(d.fonnte.samar)}</span>` : ''), 'Belum diisi') +
        `<div class="row-between text-sm mt-8"><span>Penggunaan Script Properties</span><b class="mono">${Math.round(d.ukuranProperties / 1024)} / ${Math.round(d.batasProperties / 1024)} KB</b></div><div class="progress mt-4"><i style="width:${Math.min(100, d.ukuranProperties / d.batasProperties * 100)}%"></i></div>
        <div class="row-between text-sm mt-8"><span>Token logout yang dicabut (aktif)</span><b class="mono">${d.tokenDicabut}</b></div>${d.daruratTerkunci ? `<div class="notice danger mt-8">${ic('lock')}<span>Akses darurat sedang terkunci karena percobaan gagal berulang.</span></div>` : ''}` : skelRows(4)}</div>
      <div class="card stack-16"><h3 class="section-title">${ic('key')} Ganti kata sandi akses darurat</h3><p class="text-sm muted">Akses darurat dipakai bila semua akun Admin terkunci. Buka <span class="mono">#/darurat</span> di alamat aplikasi.</p>
        <input class="input" id="sdP" type="password" autocomplete="new-password" placeholder="Kata sandi darurat baru (min. 12 karakter)"><button class="btn btn-outline" id="sdGo">${ic('check2')} Simpan</button></div>
    </div><div class="stack-16">
      <div class="card stack-16"><h3 class="section-title">${ic('box-arrow-right')} Keluarkan pengguna dari semua perangkat</h3><p class="text-sm muted">Gunakan bila HP pegawai hilang atau kata sandi bocor.</p>
        <div class="row gap-8"><select class="select grow" id="scP">${S.pegawai.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map(p => `<option value="${p.id}">${esc(p.nama)} — ${esc(p.peran)}</option>`).join('')}</select><button class="btn btn-danger" id="scGo">Cabut sesi</button></div></div>
      <div class="card"><h3 class="section-title mb-8">${ic('lightning-charge')} Performa API (perangkat ini)</h3>
        ${perf.length ? `<div class="table-wrap"><table class="tbl compact"><thead><tr><th>Aksi</th><th>Waktu</th><th>Hasil</th></tr></thead><tbody>${perf.map(p => `<tr style="cursor:default"><td class="mono text-xs">${esc(p.action)}</td><td class="mono text-xs" style="color:${p.ms > 3000 ? 'var(--danger)' : p.ms > 1500 ? 'var(--warn)' : 'var(--primary-text)'}">${p.ms} ms</td><td>${p.ok ? ic('check-circle') : ic('x-circle')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-sm muted">Belum ada data.</p>'}
        <p class="help mt-8">Rotasi SESSION_SECRET (mengeluarkan semua pengguna) dijalankan dari editor Apps Script: fungsi <span class="mono">rotasiSecretSesi</span>.</p></div>
    </div></div>`;
  $('#sdGo').onclick = async e => { const v = $('#sdP').value; if (v.length < 12) return toast('warning', 'Minimal 12 karakter'); if (await admDo(e.currentTarget, 'Menyimpan…', 'gantiSandiDarurat', v)) $('#sdP').value = ''; };
  $('#scGo').onclick = async e => { const id = $('#scP').value; if (!await confirmDialog({ title: 'Cabut semua sesi?', message: 'Pengguna harus login ulang di semua perangkat.', danger: true, okText: 'Cabut' })) return; admDo(e.currentTarget, '…', 'cabutSesiPengguna', id); };
  admLoad('sec', 'statusKeamanan').then(x => x && onRoute('keamanan') && !d && RENDER.keamanan());
};

// ═══════════════════════════════ REKAP BULANAN ══════════════════════════════
/* Dihitung di perangkat dari data yang sudah dimuat → ganti bulan/urutan/cari 0 ms.
   Bulan lama dimuat sekali lewat ensureRange(). PDF resmi & Excel dibuat server. */
S.ui.rekap = S.ui.rekap || { bulan: '', q: '', urut: 'nama', nol: false };
function akhirBulan(b) { return b + '-' + String(new Date(+b.slice(0, 4), +b.slice(5, 7), 0).getDate()).padStart(2, '0'); }
function bulanSebelum(b) { const y = +b.slice(0, 4), m = +b.slice(5, 7); return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0'); }
function menitKeg(r) { if (!r.Jam_Mulai || !r.Jam_Selesai) return 0; const a = r.Jam_Mulai.split(':'), b = r.Jam_Selesai.split(':'); return Math.max(0, (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1])); }
function singkatJenis(j) { return ({ 'Kunjungan Rumah': 'Kunj. Rumah', 'Skrining Kesehatan Masyarakat': 'Skrining Masy.', 'Skrining Kesehatan Anak Sekolah': 'Skrining Sekolah' })[j] || j; }

function rekapLokal(bulan) {
  const from = bulan + '-01', to = akhirBulan(bulan);
  const rows = liveRows().filter(r => r.Tanggal >= from && r.Tanggal <= to);
  const jenis = S.master.jenis.filter(j => j.aktif).map(j => j.nama);
  rows.forEach(r => { const j = r.Jenis_Kegiatan || 'Lainnya'; if (!jenis.includes(j)) jenis.push(j); });
  const per = new Map();
  const baru = p => ({ p, total: 0, verif: 0, selesai: 0, hari: new Set(), menit: 0, jenis: {} });
  S.pegawai.filter(p => p.peran === 'Pegawai' && p.status === 'Aktif').forEach(p => per.set(p.id, baru(p)));
  const desa = {}, jml = {};
  let verif = 0, selesai = 0, tidak = 0, menit = 0;
  rows.forEach(r => {
    if (!per.has(r.ID_Pegawai)) per.set(r.ID_Pegawai, baru(S.pegawai.find(p => p.id === r.ID_Pegawai) || { id: r.ID_Pegawai, nama: r.Nama, nip: r.NIP, jabatan: r.Jabatan }));
    const s = per.get(r.ID_Pegawai), j = r.Jenis_Kegiatan || 'Lainnya', m = menitKeg(r);
    s.total++; s.hari.add(r.Tanggal); s.menit += m; s.jenis[j] = (s.jenis[j] || 0) + 1; menit += m;
    if (r.Status_Verifikasi === 'Diverifikasi') { s.verif++; verif++; }
    if (r.Status_Kegiatan === 'Selesai') { s.selesai++; selesai++; } else if (r.Status_Kegiatan !== 'Berlangsung') tidak++;
    const d = lokasiLabel(r); desa[d] = (desa[d] || 0) + 1;
    const jl = jenisLabel(r); jml[jl] = (jml[jl] || 0) + 1;
  });
  const urut = o => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const list = [...per.values()];
  return { from, to, rows, jenis, per: list, pDesa: urut(desa), pJenis: urut(jml),
    r: { total: rows.length, verif, selesai, tidak, jam: Math.round(menit / 6) / 10, pegawai: list.length, turun: list.filter(x => x.total).length, desa: Object.keys(desa).length } };
}

RENDER.rekap = async function () {
  const st = S.ui.rekap, el = $('#pg-rekap'), today = todayStr();
  if (!st.bulan) st.bulan = today.slice(0, 7);
  const from = st.bulan + '-01';
  if (S.loadedFrom && from < S.loadedFrom) {
    el.innerHTML = admHead('Rekap Bulanan', 'Memuat data ' + BULAN[+st.bulan.slice(5) - 1] + ' ' + st.bulan.slice(0, 4) + '…') + skelRows(5, 60);
    try { await ensureRange(bulanSebelum(st.bulan) + '-01'); } catch (e) { /* tampilkan yang ada */ }
    if (S.route !== 'rekap') return;
  }
  const d = rekapLokal(st.bulan);
  const prev = rekapLokal(bulanSebelum(st.bulan)).r.total;
  const tren = prev ? Math.round((d.r.total - prev) / prev * 100) : null;
  const nDesa = S.master.lokasi.filter(l => l.aktif && l.tipe !== 'Lainnya').length;
  const nama = BULAN[+st.bulan.slice(5) - 1] + ' ' + st.bulan.slice(0, 4);
  const q = st.q.toLowerCase();
  let per = d.per.filter(x => (!q || (x.p.nama + ' ' + x.p.nip + ' ' + (x.p.jabatan || '')).toLowerCase().includes(q)) && (!st.nol || !x.total));
  per.sort(st.urut === 'banyak' ? (a, b) => b.total - a.total || a.p.nama.localeCompare(b.p.nama) : st.urut === 'sedikit' ? (a, b) => a.total - b.total || a.p.nama.localeCompare(b.p.nama) : (a, b) => a.p.nama.localeCompare(b.p.nama));
  const maxJ = d.pJenis.length ? d.pJenis[0][1] : 1, maxD = d.pDesa.length ? d.pDesa[0][1] : 1;
  const warna = {}; S.master.jenis.forEach(j => warna[j.nama] = j.warna);
  const bar = (k, n, max, c) => `<div class="lp-bar"><span class="lp-bar-l ellipsis" title="${esc(k)}">${esc(k)}</span><span class="lp-bar-t"><i style="width:${Math.max(3, n / max * 100)}%;${c ? 'background:' + c : ''}"></i></span><b class="mono">${n}</b></div>`;
  const totJ = d.jenis.map(j => d.per.reduce((n, x) => n + (x.jenis[j] || 0), 0));
  el.innerHTML = admHead('Rekap Bulanan', 'Kegiatan luar gedung seluruh pegawai per bulan. Angka dihitung langsung dari data terbaru di perangkat ini.',
    `<div class="row wrap gap-8"><input class="input" type="month" id="rkBulan" value="${st.bulan}" max="${today.slice(0, 7)}" style="width:auto;min-height:44px" aria-label="Pilih bulan">
      <button class="btn btn-outline" id="rkXls" ${S.online ? '' : 'disabled'}>${ic('file-earmark-excel')} Excel</button>
      <button class="btn btn-primary" id="rkPdf" ${S.online ? '' : 'disabled'}>${ic('file-earmark-pdf')} Cetak PDF Rekap</button></div>`) +
    `<div class="grid-4 mb-16">
      ${kpi('clipboard2-pulse', 'ic-green', d.r.total, 'Total kegiatan', tren == null ? nama : `${tren >= 0 ? '▲ +' : '▼ '}${tren}% vs bulan lalu (${prev})`)}
      ${kpi('patch-check', 'ic-sky', d.r.total ? Math.round(d.r.verif / d.r.total * 100) + '%' : '0%', 'Sudah diverifikasi', `${d.r.verif} terverifikasi · ${d.r.total - d.r.verif} belum`, d.r.total - d.r.verif ? 'data-go="verifikasi"' : '')}
      ${kpi('people', 'ic-amber', `${d.r.turun}<span class="text-sm muted"> / ${d.r.pegawai}</span>`, 'Pegawai turun lapangan', `${d.r.pegawai - d.r.turun} belum ada kegiatan`)}
      ${kpi('geo-alt', 'ic-orange', `${d.r.desa}<span class="text-sm muted"> / ${nDesa}</span>`, 'Desa/kelurahan terjangkau', `${String(d.r.jam).replace('.', ',')} jam di lapangan`)}
    </div>
    <div class="dash-grid two mb-16">
      <div class="card"><h3 class="section-title mb-12">Per jenis kegiatan</h3>${d.pJenis.map(([k, n]) => bar(k, n, maxJ, warna[k])).join('') || '<p class="text-sm muted">Belum ada kegiatan bulan ini.</p>'}</div>
      <div class="card"><h3 class="section-title mb-12">Per desa/kelurahan</h3>${d.pDesa.map(([k, n]) => bar(k, n, maxD)).join('') || '<p class="text-sm muted">Belum ada kegiatan bulan ini.</p>'}</div>
    </div>
    <div class="card mb-16"><div class="filter-bar"><div class="input-icon">${ic('search')}<input class="input" id="rkQ" placeholder="Cari nama, NIP, jabatan" value="${esc(st.q)}"></div>
      <select class="select" id="rkUrut"><option value="nama" ${st.urut === 'nama' ? 'selected' : ''}>Urut nama</option><option value="banyak" ${st.urut === 'banyak' ? 'selected' : ''}>Kegiatan terbanyak</option><option value="sedikit" ${st.urut === 'sedikit' ? 'selected' : ''}>Kegiatan paling sedikit</option></select>
      <label class="check"><input type="checkbox" id="rkNol" ${st.nol ? 'checked' : ''}> Hanya yang belum ada kegiatan</label></div></div>
    <div class="table-wrap"><table class="tbl rk"><thead><tr><th style="width:36px">No</th><th style="text-align:left">Pegawai</th>${d.jenis.map(j => `<th class="c" title="${esc(j)}">${esc(singkatJenis(j))}</th>`).join('')}<th>Total</th><th>Diverif.</th><th>Hari</th><th>Jam</th></tr></thead><tbody>
      ${per.map((x, i) => `<tr data-rkp="${esc(x.p.id)}"><td class="mono text-xs">${i + 1}</td><td class="rk-nama"><div class="fw-6">${esc(x.p.nama)}</div><div class="mono text-xs muted">${esc(x.p.nip || '')}</div>${x.p.jabatan ? `<div class="text-xs muted">${esc(x.p.jabatan)}</div>` : ''}</td>
        ${d.jenis.map(j => `<td class="mono" style="text-align:center">${x.jenis[j] || '<span class="subtle">·</span>'}</td>`).join('')}
        <td class="mono fw-6" style="text-align:center">${x.total ? x.total : '<span class="pill pill-tidak">0</span>'}</td><td class="mono" style="text-align:center">${x.verif}</td><td class="mono" style="text-align:center">${x.hari.size}</td><td class="mono" style="text-align:center">${String(Math.round(x.menit / 6) / 10).replace('.', ',')}</td></tr>`).join('')
        || `<tr><td colspan="${d.jenis.length + 6}">${emptyState('people', 'Tidak ada pegawai yang cocok')}</td></tr>`}
      ${!q && !st.nol && per.length ? `<tr style="cursor:default;background:var(--surface-2)"><td></td><td class="fw-7">JUMLAH</td>${totJ.map(n => `<td class="mono fw-6" style="text-align:center">${n}</td>`).join('')}<td class="mono fw-7" style="text-align:center">${d.r.total}</td><td class="mono fw-6" style="text-align:center">${d.r.verif}</td><td></td><td class="mono fw-6" style="text-align:center">${String(d.r.jam).replace('.', ',')}</td></tr>` : ''}
    </tbody></table></div>
    <p class="text-xs muted mt-8">${ic('info-circle')} Klik baris pegawai untuk melihat daftar kegiatannya. Data tersinkron ${esc(S.lastSync ? S.lastSync.slice(11, 16) + ' WITA' : '-')}.</p>`;
  $('#rkBulan').onchange = e => { if (e.target.value) { st.bulan = e.target.value; RENDER.rekap(); } };
  $('#rkQ').oninput = debounce(e => { st.q = e.target.value; RENDER.rekap(); setTimeout(() => { const i = $('#rkQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 250);
  $('#rkUrut').onchange = e => { st.urut = e.target.value; RENDER.rekap(); };
  $('#rkNol').onchange = e => { st.nol = e.target.checked; RENDER.rekap(); };
  $$('[data-rkp]', el).forEach(tr => tr.onclick = () => { Object.assign(S.ui.data, { pegawai: tr.dataset.rkp, from: d.from, to: d.to > today ? today : d.to, tab: 'semua', page: 1, q: '' }); go('data'); });
  $('#rkXls').onclick = e => unduhExcel(e.currentTarget, { bulan: st.bulan, idPegawai: '' });
  $('#rkPdf').onclick = () => rekapPdfModal(st.bulan, nama, d.r.total);
};

function rekapPdfModal(bulan, nama, total) {
  openModal({ title: 'Cetak PDF Rekap ' + nama, body: `<div class="stack-16">
      <div class="notice green">${ic('file-earmark-pdf')}<span>Dokumen resmi berkop surat: ringkasan, rekap per pegawai × jenis kegiatan, per jenis, sebaran per desa, tanda tangan Kepala Puskesmas, dan QR verifikasi. ${total} kegiatan.</span></div>
      <div class="field"><label for="rpNo">Nomor surat</label><input class="input mono" id="rpNo" placeholder="Memuat nomor otomatis…" maxlength="80"><span class="help" id="rpNoHelp">Kosongkan untuk memakai nomor otomatis. Format diatur Admin di Pengaturan → Penomoran Surat.</span></div>
      <div class="field"><label for="rpCat">Catatan / analisis (opsional)</label><textarea class="textarea" id="rpCat" rows="4" maxlength="1500" placeholder="Mis. capaian Posyandu naik; perlu penguatan STBM di Desa Olaia."></textarea></div>
      <label class="check"><input type="checkbox" id="rpDesa" checked> Sertakan tabel sebaran per desa/kelurahan</label></div>`,
    foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="rpGo">${ic('file-earmark-pdf')} Buat PDF</button>`,
    onOpen: m => {
      api('nomorPratinjau', S.token, 'REKAP_BULANAN').then(r => { if (r.success && r.data && m.$('#rpNo')) m.$('#rpNo').placeholder = 'Otomatis: ' + r.data.contoh; }).catch(() => {});
      m.$('#rpGo').onclick = async ev => {
        const btn = ev.currentTarget; btnLoading(btn, true, 'Menyusun PDF…');
        try {
          const v = await siapkanVerifikasi();
          const r = await api('buatRekapBulanan', S.token, { bulan, nomor: m.$('#rpNo').value.trim(), catatan: m.$('#rpCat').value.trim(), desa: m.$('#rpDesa').checked, kode: v.kode, qr: v.qr, appUrl: v.appUrl });
          if (!r.success) { toast('error', 'Gagal membuat rekap', r.message); return; }
          m.close();
          toast('success', 'Rekap siap · ' + r.data.nomor, `${r.data.jumlah} kegiatan · kode verifikasi ${r.data.kode}`);
          tampilPeringatan(r.data.peringatan);
          previewModal(r.data.name, b64ToUrl(r.data.base64, 'application/pdf'), 'application/pdf');
          S.arsip = null; S.adm.deDaftar = null; S.adm.deStatus = null;
        } catch (x) { if (!x.auth) toast('error', 'Tidak dapat terhubung', x.message); }
        finally { btnLoading(btn, false); }
      };
    } });
}

// ══════════════════════ PENGATURAN → PENOMORAN SURAT ═══════════════════════
const NOMOR_PH = [['{NO}', 'nomor urut (dengan nol di depan)'], ['{NO_ASLI}', 'nomor urut tanpa nol'], ['{ROMAWI}', 'bulan romawi I–XII'], ['{BULAN}', 'bulan 01–12'], ['{TAHUN}', 'tahun 2026'], ['{TAHUN2}', 'tahun 26'], ['{TANGGAL}', 'tanggal 01–31']];
function formatNomorLokal(fmt, n, digit) {
  const t = todayStr(), bl = +t.slice(5, 7), rom = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][bl - 1];
  const map = { NO: String(n).padStart(digit, '0'), NO_ASLI: String(n), BULAN: t.slice(5, 7), ROMAWI: rom, TAHUN: t.slice(0, 4), TAHUN2: t.slice(2, 4), TANGGAL: t.slice(8, 10) };
  return String(fmt || '').replace(/\{(NO_ASLI|NO|BULAN|ROMAWI|TAHUN2|TAHUN|TANGGAL)\}/g, (m, k) => map[k]);
}
function nomorCard() {
  const box = $('#nomorWrap'); if (!box) return;
  const c = S.adm.nomor;
  if (!c) { box.innerHTML = `<div class="card">${skelRows(3, 44)}</div>`; admLoad('nomor', 'nomorConfig').then(x => x && S.route === 'pengaturan' && nomorCard()); return; }
  box.innerHTML = `<div class="card stack-16"><div class="row-between wrap gap-8"><div><h3 class="section-title">Penomoran Surat</h3><p class="text-sm muted">Format nomor otomatis untuk laporan PDF. Nomor urut naik sendiri setiap dokumen dibuat.</p></div>
      <button class="btn btn-primary" id="nmSave">${ic('check2')} Simpan Penomoran</button></div>
    <div class="grid-2"><div class="field"><label for="nmDigit">Jumlah digit nomor urut</label><select class="select" id="nmDigit">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${c.digit === n ? 'selected' : ''}>${n} digit (${'1'.padStart(n, '0')})</option>`).join('')}</select></div>
      <div class="field"><label for="nmReset">Nomor urut kembali ke 1</label><select class="select" id="nmReset">${Object.entries(c.pilihanReset).map(([k, l]) => `<option value="${k}" ${c.reset === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>
    ${c.jenis.map(j => `<div class="card-tint stack" data-nj="${j.kode}"><div class="row-between wrap gap-8"><b class="text-sm">${esc(j.label)}</b><button class="btn btn-ghost btn-sm" data-nmdef="${j.kode}">Kembalikan bawaan</button></div>
      <div class="grid-2"><div class="field"><label for="nmF_${j.kode}">Format nomor</label><input class="input mono" id="nmF_${j.kode}" value="${esc(j.format)}" maxlength="80" data-nmf="${j.kode}"></div>
        <div class="field"><label for="nmN_${j.kode}">Nomor urut berikutnya</label><input class="input mono" id="nmN_${j.kode}" type="number" min="1" max="999999" value="${j.berikutnya}" data-nmn="${j.kode}"></div></div>
      <div class="row gap-8 wrap"><span class="text-sm muted">Surat berikutnya:</span><b class="mono" id="nmC_${j.kode}">${esc(j.contoh)}</b></div></div>`).join('')}
    <div class="stack"><span class="text-sm fw-6">Kode yang bisa dipakai (klik untuk menyisipkan ke kolom format yang terakhir dipilih)</span>
      <div class="row wrap gap-4">${NOMOR_PH.map(([k, t]) => `<button type="button" class="chip" data-nph="${k}" title="${esc(t)}" style="min-height:32px"><span class="mono">${k}</span><span class="text-xs muted">${esc(t)}</span></button>`).join('')}</div>
      <p class="help">${ic('info-circle')} Contoh format umum: <span class="mono">440/{NO}/PKM-KOTA/{ROMAWI}/{TAHUN}</span>. Nomor yang diketik manual saat membuat laporan tidak menaikkan nomor urut.</p></div>
  </div>`;
  let fokus = c.jenis[0].kode;
  const pratinjau = () => c.jenis.forEach(j => { const f = $('#nmF_' + j.kode).value, n = +$('#nmN_' + j.kode).value || 1; $('#nmC_' + j.kode).textContent = /\{NO(_ASLI)?\}/.test(f) ? formatNomorLokal(f, n, +$('#nmDigit').value) : 'Format wajib memuat {NO}'; });
  $$('[data-nmf]', box).forEach(i => { i.oninput = pratinjau; i.onfocus = () => fokus = i.dataset.nmf; });
  $$('[data-nmn]', box).forEach(i => i.oninput = pratinjau);
  $('#nmDigit').onchange = pratinjau;
  $$('[data-nph]', box).forEach(b => b.onclick = () => {
    const i = $('#nmF_' + fokus), a = i.selectionStart ?? i.value.length, z = i.selectionEnd ?? i.value.length;
    i.value = i.value.slice(0, a) + b.dataset.nph + i.value.slice(z); i.focus(); i.setSelectionRange(a + b.dataset.nph.length, a + b.dataset.nph.length); pratinjau();
  });
  $$('[data-nmdef]', box).forEach(b => b.onclick = () => { const j = c.jenis.find(x => x.kode === b.dataset.nmdef); $('#nmF_' + j.kode).value = j.bawaan; pratinjau(); });
  $('#nmSave').onclick = async e => {
    const format = {}, berikutnya = {};
    c.jenis.forEach(j => { format[j.kode] = $('#nmF_' + j.kode).value.trim(); berikutnya[j.kode] = +$('#nmN_' + j.kode).value; });
    const r = await admDo(e.currentTarget, 'Menyimpan…', 'nomorSimpan', { digit: +$('#nmDigit').value, reset: $('#nmReset').value, format, berikutnya });
    if (r) { S.adm.nomor = r.data; nomorCard(); }
  };
}

// ═══════════════════════════════ PUSAT TUGAS ════════════════════════════════
/* Beranda Admin. Butir dari data kegiatan & pegawai dihitung di perangkat (0 ms);
   butir server (sistem, antrean, cadangan) dimuat di latar dan di-cache di S.adm.tugas. */
function seninIni(t) { const d = new Date(t + 'T12:00:00Z'), w = (d.getUTCDay() + 6) % 7; return addDays(t, -w); }
function tugasLokal() {
  const today = todayStr(), out = [], senin = seninIni(today);
  const vq = verifQueue();
  if (vq.length) {
    const tertua = vq.reduce((m, r) => r.Tanggal < m ? r.Tanggal : m, today);
    const umur = Math.round((Date.parse(today) - Date.parse(tertua)) / 864e5);
    out.push({ kode: 'verif', tingkat: umur > 7 ? 'tinggi' : 'sedang', ikon: 'patch-check', judul: vq.length + ' kegiatan menunggu verifikasi', detail: 'Tertua ' + (umur ? umur + ' hari lalu' : 'hari ini') + '. Verifikasi bisa dilakukan sekaligus banyak.', aksi: [{ label: 'Buka Verifikasi', go: 'verifikasi' }] });
  }
  const tidak = liveRows().filter(r => r.Status_Kegiatan === 'Tidak Diselesaikan' && r.Tanggal >= addDays(today, -7));
  if (tidak.length) out.push({ kode: 'tidak', tingkat: 'sedang', ikon: 'exclamation-octagon', judul: tidak.length + ' kegiatan tidak diselesaikan (7 hari)', detail: 'Ditutup otomatis pukul 23.55. Mungkin perlu klarifikasi ke pegawai.', aksi: [{ label: 'Lihat', fn: () => { Object.assign(S.ui.data, { tab: 'tidak', from: addDays(today, -7), to: today, pegawai: '', page: 1 }); go('data'); } }] });
  const aktif = S.pegawai.filter(p => p.status === 'Aktif' && p.peran === 'Pegawai');
  const adaMinggu = new Set(liveRows().filter(r => r.Tanggal >= senin).map(r => r.ID_Pegawai));
  const belum = aktif.filter(p => !adaMinggu.has(p.id));
  const hariKe = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;   // 0=Senin
  if (belum.length && hariKe >= 2) out.push({ kode: 'belumlapor', tingkat: hariKe >= 4 ? 'sedang' : 'info', ikon: 'person-exclamation', judul: belum.length + ' pegawai belum ada kegiatan minggu ini', detail: belum.slice(0, 5).map(p => p.nama).join(', ') + (belum.length > 5 ? ', dan ' + (belum.length - 5) + ' lainnya' : '') + '.',
    aksi: [{ label: 'Kirim pengingat WA', api: 'kirimPengingatMingguanSekarang', konfirmasi: 'Kirim pengingat WhatsApp ke ' + belum.length + ' pegawai yang belum ada kegiatan minggu ini?' }, { label: 'Lihat rekap', go: 'rekap' }] });
  const belumLogin = aktif.filter(p => !p.loginTerakhir);
  if (belumLogin.length) out.push({ kode: 'belumlogin', tingkat: 'sedang', ikon: 'key', judul: belumLogin.length + ' pegawai belum pernah masuk aplikasi', detail: belumLogin.slice(0, 5).map(p => p.nama).join(', ') + (belumLogin.length > 5 ? ', …' : '') + '. Kirim ulang akun dengan sandi baru (lewat WA bila nomor tersedia).',
    aksi: [{ label: 'Kirim ulang akun', fn: () => kirimUlangAkun(belumLogin) }] });
  const tanpaWa = S.pegawai.filter(p => p.status === 'Aktif' && p.peran !== 'Admin' && !p.noHp);
  if (tanpaWa.length) out.push({ kode: 'tanpawa', tingkat: 'info', ikon: 'whatsapp', judul: tanpaWa.length + ' pegawai belum punya nomor WhatsApp', detail: 'Notifikasi & pengingat tidak bisa dikirim ke mereka. Isi lewat Kelola Pegawai atau Impor Massal.', aksi: [{ label: 'Kelola Pegawai', go: 'pegawai' }] });
  const tgl = +today.slice(8, 10);
  if (tgl <= 7) { const b = bulanSebelum(today.slice(0, 7)); out.push({ kode: 'rekapbulan', tingkat: 'info', ikon: 'calendar3', judul: 'Rekap ' + BULAN[+b.slice(5) - 1] + ' ' + b.slice(0, 4) + ' siap dicetak', detail: 'Awal bulan: saatnya mencetak rekap bulanan resmi bulan lalu.', aksi: [{ label: 'Buka Rekap', fn: () => { S.ui.rekap.bulan = b; go('rekap'); } }] }); }
  return out;
}
function tugasServer() {
  const d = S.adm.tugas; if (!d) return [];
  const out = [];
  d.sistem.forEach(x => out.push({ kode: 'sis_' + x.kode, tingkat: x.status === 'galat' ? 'tinggi' : 'sedang', ikon: 'heart-pulse', judul: x.judul, detail: x.pesan,
    aksi: [x.perbaiki ? { label: 'Perbaiki', api: 'perbaikiSistem', arg: x.perbaiki, konfirmasi: x.perbaiki === 'datacontoh' ? 'Hapus semua kegiatan bertanda (data contoh)?' : '' } : null, x.route ? { label: 'Buka', go: x.route } : null].filter(Boolean) }));
  if (d.blastBerjalan) out.push({ kode: 'blast', tingkat: 'info', ikon: 'megaphone', judul: d.blastBerjalan + ' blast WA sedang berjalan', detail: 'Dikirim bertahap oleh pekerja otomatis.', aksi: [{ label: 'Pantau', fn: () => { S.ui.notif.tab = 'blast'; go('notifikasi'); } }] });
  return out;
}
function jumlahTugasPenting() {
  if (!S.user || !isAdmin()) return 0;
  return tugasLokal().concat(tugasServer()).filter(t => t.tingkat === 'tinggi' || t.tingkat === 'sedang').length;
}
async function kirimUlangAkun(list) {
  const ok = await confirmDialog({ title: 'Kirim ulang akun?', message: `${list.length} pegawai akan mendapat <b>kata sandi baru</b> (sandi lama tidak berlaku). Sandi dikirim lewat WhatsApp/email bila aktif, dan ditampilkan untuk Anda salin.`, okText: 'Buat sandi baru' });
  if (!ok) return;
  const r = await admDo(null, '', 'resetSandiMassal', list.map(p => p.id));
  if (r) credModal('Akun dikirim ulang', r.data.akun);
}
function tugasAksi(a) {
  if (a.go) return go(a.go);
  if (a.fn) return a.fn();
}
RENDER.tugas = function () {
  const el = $('#pg-tugas'), today = todayStr(), u = S.user;
  const semua = tugasLokal().concat(tugasServer());
  const urut = { tinggi: 0, sedang: 1, info: 2 };
  semua.sort((a, b) => urut[a.tingkat] - urut[b.tingkat]);
  const n = { tinggi: semua.filter(t => t.tingkat === 'tinggi').length, sedang: semua.filter(t => t.tingkat === 'sedang').length, info: semua.filter(t => t.tingkat === 'info').length };
  const warna = { tinggi: 'var(--danger)', sedang: 'var(--warn)', info: 'var(--accent)' };
  const label = { tinggi: 'Segera', sedang: 'Perlu perhatian', info: 'Info' };
  const pill = { tinggi: 'pill-tidak', sedang: 'pill-berlangsung', info: 'pill-accent' };
  const bulanIni = liveRows().filter(r => r.Tanggal >= today.slice(0, 8) + '01');
  const hariIni = liveRows().filter(r => r.Tanggal === today);
  const sedang = hariIni.filter(r => r.Status_Kegiatan === 'Berlangsung').length;
  const cadT = S.adm.tugas && S.adm.tugas.cadanganTerakhir;
  window.__tugas = semua;
  el.innerHTML = admHead(greetWord() + ', ' + esc(u.nama.split(/[ ,]/)[0]), 'Pusat Tugas Admin · ' + hariOf(today) + ', ' + tglIndo(today) + '. Semua yang perlu ditindaklanjuti ada di sini.',
    `<button class="btn btn-outline" id="tgRef">${ic('arrow-clockwise')} Periksa ulang</button>`) +
    `<div class="grid-4 mb-16">
      ${kpi('exclamation-diamond', 'ic-red', n.tinggi + n.sedang, 'Perlu tindakan', n.tinggi ? n.tinggi + ' segera' : 'Tidak ada yang mendesak')}
      ${kpi('calendar-check', 'ic-green', hariIni.length, 'Kegiatan hari ini', sedang + ' sedang berlangsung', 'data-go="dashboard"')}
      ${kpi('calendar3', 'ic-sky', bulanIni.length, 'Kegiatan bulan ini', 'Lihat rekap bulanan', 'data-go="rekap"')}
      ${kpi('cloud-check', cadT && Date.now() - cadT < 8 * 864e5 ? 'ic-green' : 'ic-amber', cadT ? Math.max(0, Math.floor((Date.now() - cadT) / 864e5)) + ' hari' : (S.adm.tugas ? 'Belum' : '…'), 'Cadangan terakhir', cadT ? new Date(cadT).toLocaleDateString('id-ID') : 'Buat cadangan pertama', 'data-go="sistem"')}
    </div>
    <div class="card mb-16"><div class="row-between wrap gap-8 mb-8"><h3 class="section-title">Aksi cepat</h3></div>
      <div class="row wrap gap-8">
        <button class="btn btn-soft" id="qaPeg">${ic('person-plus')} Tambah pegawai</button>
        <button class="btn btn-soft" data-go="verifikasi">${ic('patch-check')} Verifikasi</button>
        <button class="btn btn-soft" data-go="rekap">${ic('calendar3')} Rekap bulanan</button>
        <button class="btn btn-soft" data-go="laporan">${ic('file-earmark-pdf')} Laporan PDF</button>
        <button class="btn btn-soft" id="qaBlast">${ic('megaphone')} Blast WA</button>
        <button class="btn btn-soft" id="qaCad">${ic('cloud-arrow-up')} Cadangkan sekarang</button>
      </div></div>
    <div class="stack" id="tgList">
      ${semua.length ? semua.map((t, i) => `<div class="card row gap-12" style="align-items:flex-start;border-left:4px solid ${warna[t.tingkat]}">
          <span class="kpi ic" style="width:42px;height:42px;padding:0;border:0;box-shadow:none;flex:none;background:var(--surface-2);color:${warna[t.tingkat]}">${ic(t.ikon)}</span>
          <div class="grow" style="min-width:0"><div class="row gap-8 wrap"><b>${esc(t.judul)}</b><span class="pill ${pill[t.tingkat]}">${label[t.tingkat]}</span></div><p class="text-sm muted mt-4">${esc(t.detail)}</p>
            <div class="row wrap gap-8 mt-8">${t.aksi.map((a, j) => `<button class="btn ${j ? 'btn-ghost' : 'btn-outline'} btn-sm" data-ta="${i}:${j}">${esc(a.label)}</button>`).join('')}</div></div></div>`).join('')
        : `<div class="card">${emptyState('check2-all', 'Semua beres', 'Tidak ada pekerjaan yang tertunda. Mantap!')}</div>`}
      ${!S.adm.tugas ? `<div class="card">${skelRows(2, 40)}<p class="text-xs muted mt-8">Memeriksa sistem…</p></div>` : ''}
    </div>
    <p class="text-xs muted mt-8">${S.adm.tugas ? 'Sistem diperiksa ' + esc(S.adm.tugas.waktu.slice(11, 16)) + ' WITA.' : ''} Butir data kegiatan dihitung langsung dari perangkat.</p>`;
  $$('[data-ta]', el).forEach(b => b.onclick = async e => {
    const [i, j] = b.dataset.ta.split(':').map(Number), a = semua[i].aksi[j];
    if (a.api) {
      if (a.konfirmasi && !await confirmDialog({ title: a.label, message: a.konfirmasi, okText: 'Ya, lanjutkan' })) return;
      const r = await admDo(e.currentTarget, 'Memproses…', a.api, ...(a.arg ? [a.arg] : []));
      if (r) { S.adm.tugas = null; S.adm.sis = null; RENDER.tugas(); muatTugas(); }
      return;
    }
    tugasAksi(a);
  });
  $('#tgRef').onclick = () => { S.adm.tugas = null; RENDER.tugas(); muatTugas(true); syncNow(false); };
  $('#qaPeg').onclick = () => { go('pegawai'); setTimeout(() => pegawaiDrawer(null), 50); };
  $('#qaBlast').onclick = () => { S.ui.notif.tab = 'blast'; go('notifikasi'); };
  $('#qaCad').onclick = async e => { const r = await admDo(e.currentTarget, 'Mencadangkan…', 'cadangkanSekarang'); if (r) { S.adm.cad = r.data; S.adm.tugas = null; muatTugas(); } };
  if (!S.adm.tugas) muatTugas();
};
async function muatTugas(paksa) {
  if (paksa) { try { await api('cekSistem', S.token); } catch (e) { /* lanjut */ } }
  const d = await admLoad('tugas', 'adminTugas');
  if (d) { renderNavState(); if (S.route === 'tugas') RENDER.tugas(); }
}

// ═══════════════════════════ SISTEM & CADANGAN ══════════════════════════════
RENDER.sistem = function () {
  const el = $('#pg-sistem'), d = S.adm.sis, cad = (d && d.cadangan) || S.adm.cad;
  const ikon = { ok: ['check-circle-fill', 'var(--primary)'], peringatan: ['exclamation-triangle-fill', 'var(--warn)'], galat: ['x-octagon-fill', 'var(--danger)'], info: ['info-circle-fill', 'var(--accent)'] };
  const kel = {};
  (d ? d.hasil : []).forEach(x => (kel[x.kategori] = kel[x.kategori] || []).push(x));
  const jml = s => (d ? d.hasil : []).filter(x => x.status === s).length;
  el.innerHTML = admHead('Sistem &amp; Cadangan', 'Pemeriksaan kesehatan aplikasi dan cadangan database. Masalah yang bisa diperbaiki otomatis punya tombol <b>Perbaiki</b>.',
    `<button class="btn btn-outline" id="ssRef">${ic('arrow-clockwise')} Periksa ulang</button>`) +
    `<div class="grid-4 mb-16">${d ? kpi('check-circle', 'ic-green', jml('ok'), 'Baik') + kpi('exclamation-triangle', 'ic-amber', jml('peringatan'), 'Perlu perhatian') + kpi('x-octagon', 'ic-red', jml('galat'), 'Galat') + kpi('info-circle', 'ic-sky', jml('info'), 'Info', 'Versi ' + esc(d.versi)) : skelRows(1, 96)}</div>
    <div class="dash-grid two">
      <div class="stack-16">${d ? Object.keys(kel).map(k => `<div class="card"><h3 class="section-title mb-8">${esc(k)}</h3>${kel[k].map(x => `<div class="row gap-12" style="padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">
          <span style="font-size:18px;color:${ikon[x.status][1]};flex:none">${ic(ikon[x.status][0])}</span>
          <div class="grow" style="min-width:0"><div class="fw-6 text-sm">${esc(x.judul)}</div><div class="text-xs muted">${esc(x.pesan)}</div></div>
          <div class="row gap-4" style="flex:none">${x.perbaiki && x.status !== 'ok' ? `<button class="btn btn-soft btn-sm" data-fix="${x.kode}" data-fixk="${x.perbaiki}">Perbaiki</button>` : ''}${x.route && x.status !== 'ok' ? `<button class="btn btn-ghost btn-sm" data-go="${x.route}">Buka</button>` : ''}</div></div>`).join('')}</div>`).join('') : `<div class="card">${skelRows(6, 36)}</div>`}</div>
      <div class="stack-16">
        <div class="card stack-16"><h3 class="section-title">${ic('cloud-arrow-up')} Cadangan database</h3>
          <p class="text-sm muted">Salinan lengkap spreadsheet database di folder Drive <span class="mono">SIMONIK-LG/Cadangan</span>. Foto & berkas tetap di Drive dan tidak perlu disalin.</p>
          <div class="notice green">${ic('lightbulb')}<span><b>Sebelum update kode</b>, klik <b>Cadangkan sebelum update</b>. Bila versi baru bermasalah, data bisa dipulihkan dari sini.</span></div>
          <div class="row wrap gap-8"><button class="btn btn-primary" id="cdNow">${ic('cloud-arrow-up')} Cadangkan sekarang</button><button class="btn btn-outline" id="cdUpd">${ic('arrow-up-circle')} Cadangkan sebelum update</button></div>
          ${cad ? `${swRow('cdAuto', 'Cadangan otomatis', 'Dibuat pukul 01.00–05.00 WITA saat jatuh tempo.', cad.otomatis)}
            <div class="grid-2"><div class="field"><label for="cdHari">Setiap (hari)</label><input class="input mono" id="cdHari" type="number" min="1" max="31" value="${cad.hari}"></div>
              <div class="field"><label for="cdMaks">Simpan cadangan terbaru</label><input class="input mono" id="cdMaks" type="number" min="3" max="60" value="${cad.maks}"></div></div>
            <button class="btn btn-ghost btn-sm" id="cdSave" style="justify-self:start">${ic('check2')} Simpan jadwal</button>
            <div><b class="text-sm">Daftar cadangan</b>${cad.daftar.length ? cad.daftar.map(f => `<div class="row gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--primary)">${ic('file-earmark-spreadsheet')}</span>
              <div class="grow" style="min-width:0"><div class="text-sm fw-6">${esc(f.dibuat)} WITA</div><div class="text-xs muted">${esc({ MANUAL: 'Manual', MINGGUAN: 'Otomatis', SEBELUM_PULIH: 'Sebelum pemulihan', SEBELUM_UPDATE: 'Sebelum update' }[f.jenis] || f.jenis)}</div></div>
              <a class="btn btn-ghost btn-sm" href="${esc(f.url)}" target="_blank" rel="noopener">Buka</a><button class="btn btn-ghost btn-sm" data-pul="${f.id}" data-pult="${esc(f.dibuat)}">Pulihkan</button></div>`).join('') : '<p class="text-sm muted mt-4">Belum ada cadangan.</p>'}</div>` : skelRows(3)}
        </div>
      </div>
    </div>`;
  const muat = () => admLoad('sis', 'cekSistem').then(x => { if (x) { S.adm.cad = x.cadangan; if (S.route === 'sistem') RENDER.sistem(); } });
  $('#ssRef').onclick = () => { S.adm.sis = null; RENDER.sistem(); muat(); };
  $$('[data-fix]', el).forEach(b => b.onclick = async e => {
    if (b.dataset.fixk === 'datacontoh' && !await confirmDialog({ title: 'Hapus data contoh?', message: 'Semua kegiatan bertanda "(data contoh)" dihapus permanen. Data asli tidak tersentuh.', danger: true, okText: 'Hapus' })) return;
    const r = await admDo(e.currentTarget, 'Memperbaiki…', 'perbaikiSistem', b.dataset.fixk);
    if (r) { S.adm.sis = r.data; S.adm.cad = r.data.cadangan; S.adm.tugas = null; RENDER.sistem(); if (b.dataset.fixk === 'datacontoh') syncNow(false); }
  });
  const cadangkan = async (btn, jenis) => { const r = await admDo(btn, 'Mencadangkan…', 'cadangkanSekarang', jenis); if (r) { S.adm.cad = r.data; if (S.adm.sis) S.adm.sis.cadangan = r.data; S.adm.tugas = null; muat(); RENDER.sistem(); } };
  $('#cdNow').onclick = e => cadangkan(e.currentTarget, 'MANUAL');
  $('#cdUpd').onclick = e => cadangkan(e.currentTarget, 'SEBELUM_UPDATE');
  if ($('#cdSave')) $('#cdSave').onclick = async e => { const r = await admDo(e.currentTarget, 'Menyimpan…', 'cadanganAtur', { otomatis: $('#cdAuto').checked, hari: +$('#cdHari').value, maks: +$('#cdMaks').value }); if (r) { S.adm.cad = r.data; if (S.adm.sis) S.adm.sis.cadangan = r.data; RENDER.sistem(); } };
  $$('[data-pul]', el).forEach(b => b.onclick = () => openModal({ title: 'Pulihkan cadangan ' + b.dataset.pult, body: `<div class="stack-16">
      <div class="notice danger">${ic('exclamation-octagon')}<span>Aplikasi akan memakai data dari cadangan ini. Perubahan setelah ${esc(b.dataset.pult)} WITA tidak akan terlihat. Database yang sekarang <b>tidak dihapus</b>: otomatis disimpan sebagai cadangan "Sebelum pemulihan".</span></div>
      <div class="field"><label for="pulK">Ketik <b class="mono">PULIHKAN</b> untuk konfirmasi</label><input class="input mono" id="pulK" autocomplete="off"></div></div>`,
    foot: `<button class="btn btn-outline" data-close>Batal</button><button class="btn btn-danger-solid" id="pulGo">Pulihkan</button>`,
    onOpen: m => m.$('#pulGo').onclick = async e => {
      const r = await admDo(e.currentTarget, 'Memulihkan…', 'pulihkanCadangan', b.dataset.pul, m.$('#pulK').value);
      if (r) { m.close(); toast('success', r.message); await DB.clear('kv'); setTimeout(() => location.reload(), 1200); }
    } }));
  if (!d) muat();
};
