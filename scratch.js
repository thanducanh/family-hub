const fs = require('fs');

const code = `    {settingsOpen && (
      <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-[#f8fafc] dark:bg-[var(--app-bg)] md:bg-black/45 md:p-4 animate-in fade-in duration-200">
        <div className="w-full h-full md:h-auto md:max-w-md md:max-h-[85vh] flex flex-col md:overflow-hidden md:rounded-2xl bg-[#f8fafc] dark:bg-[var(--app-bg)] md:bg-white md:dark:bg-slate-900 md:shadow-2xl animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-4 duration-300 relative">
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[var(--app-card)] border-b border-slate-200 dark:border-white/10 sticky top-0 z-20 shadow-sm">
            <button onClick={() => setSettingsOpen(false)} className="text-slate-500">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cài đặt</h2>
          </div>
          <div className="hidden md:flex items-center justify-between p-5 pb-0">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cài đặt</h2>
            <button onClick={() => setSettingsOpen(false)} className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 md:px-0">Ngôn ngữ</h3>
              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 dark:bg-[var(--app-card)] dark:border-white/10">
                {[{ id: 'vi', label: 'Tiếng Việt' }, { id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }].map(item => (
                  <button key={item.id} onClick={() => setLanguage && setLanguage(item.id)} className="flex w-full items-center justify-between px-4 py-4 text-left active:bg-slate-50 dark:active:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0">
                    <span className={\`text-sm font-medium \${language === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}\`}>{item.label}</span>
                    {language === item.id && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 md:px-0">Giao diện</h3>
              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 dark:bg-[var(--app-card)] dark:border-white/10">
                {[{ id: 'light', label: 'Sáng' }, { id: 'dark', label: 'Tối' }].map(item => (
                  <button key={item.id} onClick={() => setTheme && setTheme(item.id)} className="flex w-full items-center justify-between px-4 py-4 text-left active:bg-slate-50 dark:active:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0">
                    <span className={\`text-sm font-medium \${theme === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}\`}>{item.label}</span>
                    {theme === item.id && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 md:px-0">Thông báo thiết bị</h3>
              <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 dark:bg-[var(--app-card)] dark:border-white/10 p-4">
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Nhận thông báo push khi có sự kiện mới hoặc sắp tới. Yêu cầu trình duyệt hỗ trợ.</p>
                <div className="flex gap-2">
                  <button onClick={() => {
                    requestNotificationPermission().then(res => {
                      if (res) {
                        alert('Đã cấp quyền thông báo thành công!');
                        window.location.reload();
                      } else {
                        alert('Không thể đăng ký thông báo hoặc bạn đã từ chối.');
                      }
                    });
                  }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition">Bật thông báo</button>
                  <button onClick={() => {
                    fetch('/api/push/send-test', { method: 'POST' })
                      .then(res => res.json())
                      .then(data => alert(data.success ? 'Đã gửi thông báo thử nghiệm' : 'Lỗi: ' + data.error))
                      .catch(() => alert('Lỗi khi gửi test'));
                  }} className="px-3 py-2 bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition">Gửi thử</button>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={() => setLogoutConfirmOpen(true)} className="flex w-full items-center justify-center px-4 py-4 rounded-2xl bg-white border border-slate-200 dark:bg-[var(--app-card)] dark:border-white/10 active:bg-rose-50 dark:active:bg-rose-500/10">
                <span className="text-sm font-bold text-rose-500">Đăng xuất</span>
              </button>
            </div>
            <div className="h-20 md:hidden" />
          </div>
        </div>
      </div>
    )}`;

let content = fs.readFileSync('src/components/family-app.tsx', 'utf-8');
const lines = content.split('\n');

// Find and replace the settingsOpen section
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{settingsOpen && <Sheet close={() => setSettingsOpen(false)}>')) {
    startIdx = i;
    break;
  }
}

let endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('    {profileEditorOpen && <ProfileSheet user={profileUser}')) {
    endIdx = i - 1;
    while (lines[endIdx].trim() === '') endIdx--;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, code);
}

// Remove the standalone logout button block
let logoutStart = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<button onClick={() => setLogoutConfirmOpen(true)} className="flex w-full items-center justify-center px-4 py-4 text-center active:bg-rose-50 dark:active:bg-rose-500/10">')) {
        logoutStart = i - 2;
        break;
    }
}
if(logoutStart !== -1) {
    lines.splice(logoutStart, 5);
}

// Remove languageSheetOpen and themeSheetOpen variables and render blocks
let langStateIdx = lines.findIndex(l => l.includes('const [languageSheetOpen, setLanguageSheetOpen] = useState(false);'));
if(langStateIdx >= 0) lines.splice(langStateIdx, 1);
let themeStateIdx = lines.findIndex(l => l.includes('const [themeSheetOpen, setThemeSheetOpen] = useState(false);'));
if(themeStateIdx >= 0) lines.splice(themeStateIdx, 1);

let langSheetStart = lines.findIndex(l => l.includes('{languageSheetOpen && setLanguage && ('));
if(langSheetStart >= 0) {
    let langSheetEnd = langSheetStart;
    while(!lines[langSheetEnd].includes(')}')) langSheetEnd++;
    lines.splice(langSheetStart, langSheetEnd - langSheetStart + 1);
}

let themeSheetStart = lines.findIndex(l => l.includes('{themeSheetOpen && setTheme && ('));
if(themeSheetStart >= 0) {
    let themeSheetEnd = themeSheetStart;
    while(!lines[themeSheetEnd].includes(')}')) themeSheetEnd++;
    lines.splice(themeSheetStart, themeSheetEnd - themeSheetStart + 1);
}

// Fix Cài đặt (Ngôn ngữ, Giao diện)
let labelIdx = lines.findIndex(l => l.includes('Cài đặt (Ngôn ngữ, Giao diện)'));
if (labelIdx >= 0) {
    lines[labelIdx] = lines[labelIdx].replace('Cài đặt (Ngôn ngữ, Giao diện)', 'Cài đặt');
}

fs.writeFileSync('src/components/family-app.tsx', lines.join('\n'), 'utf-8');
console.log('Fixed settings UI');
