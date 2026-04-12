// 强强 — Ultra-thin Win32 + WebView2 shell
// Single-file C++ shell with full native API surface.
//
// Build:
//   cl /EHsc /O2 /std:c++20 /utf-8 main.cpp
//      /I<webview2_include> /I<json_include>
//      /Fe:app.exe /link /SUBSYSTEM:WINDOWS <WebView2LoaderStatic.lib>
//
// Usage:
//   app.exe                              -> Production (virtual host -> dist/)
//   app.exe --dev http://localhost:3000  -> Dev mode

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0A00

#include <windows.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <wrl.h>
#include <WebView2.h>
#include <string>
#include <functional>
#include <unordered_map>
#include <filesystem>
#include <fstream>
#include <dwmapi.h>
#include <windowsx.h>
#include <winhttp.h>
#include <mutex>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "winhttp.lib")

#ifdef SINGLE_EXE
#include "resource.h"
#endif

#include "json.hpp"
using json = nlohmann::json;
using namespace Microsoft::WRL;
namespace fspath = std::filesystem;

// ================================================================
//  String helpers
// ================================================================

static std::string W2U(const wchar_t* w, int len = -1) {
    if (!w || !*w) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, w, len, nullptr, 0, nullptr, nullptr);
    std::string s(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w, len, s.data(), n, nullptr, nullptr);
    if (len == -1 && !s.empty() && s.back() == '\0') s.pop_back();
    return s;
}
static std::string W2U(const std::wstring& w) { return W2U(w.c_str(), (int)w.size()); }

static std::wstring U2W(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), w.data(), n);
    return w;
}

static std::wstring exe_dir() {
    wchar_t p[MAX_PATH];
    GetModuleFileNameW(nullptr, p, MAX_PATH);
    PathRemoveFileSpecW(p);
    return p;
}

// ================================================================
//  Global state
// ================================================================

static HWND                              g_hwnd;
static ComPtr<ICoreWebView2Environment>  g_env;
static ComPtr<ICoreWebView2Controller>   g_ctrl;
static ComPtr<ICoreWebView2>             g_view;
static std::wstring                      g_devUrl;

// Config
static json g_cfg;
static bool g_frameless    = false;
static int  g_titleBarH    = 0;
static int  g_borderSize   = 6;

// Tray
#define WM_TRAYICON (WM_USER + 1)
static NOTIFYICONDATAW g_nid = {};
static bool            g_trayActive = false;

// File watchers
struct FileWatcher {
    HANDLE hDir;
    HANDLE hThread;
    std::wstring path;
    int id;
    bool active;
};
static std::unordered_map<int, FileWatcher*> g_watchers;
static int g_nextWatchId = 1;

#define WM_FILE_CHANGED (WM_USER + 2)

// Splash window
static HWND g_splash = nullptr;

// Logging
static std::wstring g_logFile;
static std::mutex   g_logMtx;

// Background brush for frameless border area
static HBRUSH g_bgBrush = nullptr;

// ================================================================
//  Embedded resource loader (single-exe mode)
// ================================================================

#ifdef SINGLE_EXE
static std::string loadResource(int id) {
    HRSRC hRes = FindResourceW(nullptr, MAKEINTRESOURCE(id), RT_RCDATA);
    if (!hRes) return {};
    HGLOBAL hData = LoadResource(nullptr, hRes);
    if (!hData) return {};
    DWORD sz = SizeofResource(nullptr, hRes);
    auto* ptr = (const char*)LockResource(hData);
    return std::string(ptr, sz);
}
#endif

// ================================================================
//  Config loader
// ================================================================

static COLORREF parseHexColor(const std::string& hex, COLORREF def = RGB(26,26,46)) {
    if (hex.size() < 7 || hex[0] != '#') return def;
    try {
        int r = std::stoi(hex.substr(1,2), nullptr, 16);
        int g = std::stoi(hex.substr(3,2), nullptr, 16);
        int b = std::stoi(hex.substr(5,2), nullptr, 16);
        return RGB(r, g, b);
    } catch (...) { return def; }
}

static json loadConfig(const std::wstring& dir) {
    for (auto& name : { L"\\app.config.json", L"\\..\\app.config.json" }) {
        auto path = dir + name;
        std::ifstream f(path);
        if (f) { json j; f >> j; return j; }
    }
#ifdef SINGLE_EXE
    auto cfg = loadResource(IDR_CONFIG);
    if (!cfg.empty()) {
        try { return json::parse(cfg); } catch (...) {}
    }
#endif
    return json::object();
}

// ================================================================
//  IPC bridge
// ================================================================

using IpcFn = std::function<json(const json&)>;
static std::unordered_map<std::string, IpcFn> g_cmds;

static void ipc_on(const std::string& cmd, IpcFn fn) {
    g_cmds[cmd] = std::move(fn);
}

static void ipc_emit(const std::string& ev, const json& data = {}) {
    if (!g_view) return;
    json m = {{"event", ev}, {"data", data}};
    g_view->PostWebMessageAsJson(U2W(m.dump()).c_str());
}

static void ipc_dispatch(LPCWSTR raw) {
    try {
        auto req = json::parse(W2U(raw));
        json resp;
        resp["id"] = req.value("id", -1);
        auto cmd  = req.value("cmd", std::string{});
        auto args = req.value("args", json::object());

        if (auto it = g_cmds.find(cmd); it != g_cmds.end()) {
            try { resp["result"] = it->second(args); }
            catch (const std::exception& e) { resp["error"] = e.what(); }
        } else {
            resp["error"] = "unknown: " + cmd;
        }
        g_view->PostWebMessageAsJson(U2W(resp.dump()).c_str());
    } catch (...) {}
}

// ================================================================
//  Commands: Window
// ================================================================

static void reg_window() {
    ipc_on("window.setTitle", [](const json& a) -> json {
        SetWindowTextW(g_hwnd, U2W(a.value("title", std::string{})).c_str());
        return true;
    });
    ipc_on("window.minimize", [](const json&) -> json {
        ShowWindow(g_hwnd, SW_MINIMIZE); return true;
    });
    ipc_on("window.maximize", [](const json&) -> json {
        WINDOWPLACEMENT wp{sizeof(wp)};
        GetWindowPlacement(g_hwnd, &wp);
        ShowWindow(g_hwnd, wp.showCmd == SW_MAXIMIZE ? SW_RESTORE : SW_MAXIMIZE);
        return true;
    });
    ipc_on("window.restore", [](const json&) -> json {
        ShowWindow(g_hwnd, SW_RESTORE); return true;
    });
    ipc_on("window.close", [](const json&) -> json {
        PostMessageW(g_hwnd, WM_CLOSE, 0, 0); return true;
    });
    ipc_on("window.show", [](const json&) -> json {
        ShowWindow(g_hwnd, SW_SHOW);
        SetForegroundWindow(g_hwnd);
        return true;
    });
    ipc_on("window.hide", [](const json&) -> json {
        ShowWindow(g_hwnd, SW_HIDE); return true;
    });
    ipc_on("window.size", [](const json&) -> json {
        RECT r; GetClientRect(g_hwnd, &r);
        return {{"w", r.right}, {"h", r.bottom}};
    });
    ipc_on("window.setSize", [](const json& a) -> json {
        int w = a.value("w", 0), h = a.value("h", 0);
        if (w <= 0 || h <= 0) return false;
        RECT cr, wr;
        GetClientRect(g_hwnd, &cr);
        GetWindowRect(g_hwnd, &wr);
        int fw = (wr.right - wr.left) - cr.right + w;
        int fh = (wr.bottom - wr.top) - cr.bottom + h;
        SetWindowPos(g_hwnd, nullptr, 0, 0, fw, fh, SWP_NOMOVE | SWP_NOZORDER);
        return true;
    });
    ipc_on("window.position", [](const json&) -> json {
        RECT r; GetWindowRect(g_hwnd, &r);
        return {{"x", r.left}, {"y", r.top}};
    });
    ipc_on("window.setPosition", [](const json& a) -> json {
        SetWindowPos(g_hwnd, nullptr, a.value("x", 0), a.value("y", 0), 0, 0,
                     SWP_NOSIZE | SWP_NOZORDER);
        return true;
    });
    ipc_on("window.center", [](const json&) -> json {
        RECT wr; GetWindowRect(g_hwnd, &wr);
        int ww = wr.right - wr.left, wh = wr.bottom - wr.top;
        HMONITOR mon = MonitorFromWindow(g_hwnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi{sizeof(mi)};
        GetMonitorInfoW(mon, &mi);
        int x = mi.rcWork.left + (mi.rcWork.right - mi.rcWork.left - ww) / 2;
        int y = mi.rcWork.top + (mi.rcWork.bottom - mi.rcWork.top - wh) / 2;
        SetWindowPos(g_hwnd, nullptr, x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER);
        return true;
    });
    ipc_on("window.setAlwaysOnTop", [](const json& a) -> json {
        HWND z = a.value("top", true) ? HWND_TOPMOST : HWND_NOTOPMOST;
        SetWindowPos(g_hwnd, z, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
        return true;
    });
    ipc_on("window.isMaximized", [](const json&) -> json {
        WINDOWPLACEMENT wp{sizeof(wp)};
        GetWindowPlacement(g_hwnd, &wp);
        return wp.showCmd == SW_MAXIMIZE;
    });
}

// ================================================================
//  Commands: Dialogs
// ================================================================

static json show_file_dialog(bool save, const json& a) {
    ComPtr<IFileDialog> dlg;
    HRESULT hr;
    if (save)
        hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_ALL, IID_PPV_ARGS(&dlg));
    else
        hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_ALL, IID_PPV_ARGS(&dlg));
    if (FAILED(hr)) throw std::runtime_error("Failed to create file dialog");

    FILEOPENDIALOGOPTIONS opts;
    dlg->GetOptions(&opts);
    bool multi  = !save && a.value("multiple", false);
    bool folder = a.value("folder", false);
    if (multi)  opts |= FOS_ALLOWMULTISELECT;
    if (folder) opts |= FOS_PICKFOLDERS;
    dlg->SetOptions(opts);

    // Filters
    std::vector<COMDLG_FILTERSPEC> specs;
    std::vector<std::wstring> names, pats;
    if (a.contains("filters") && a["filters"].is_array()) {
        for (auto& f : a["filters"]) {
            names.push_back(U2W(f.value("name", "")));
            std::string p;
            for (auto& ext : f["extensions"]) {
                if (!p.empty()) p += ";";
                auto e = ext.get<std::string>();
                p += (e == "*") ? "*.*" : ("*." + e);
            }
            pats.push_back(U2W(p));
        }
        for (size_t i = 0; i < names.size(); i++)
            specs.push_back({names[i].c_str(), pats[i].c_str()});
        dlg->SetFileTypes((UINT)specs.size(), specs.data());
    }

    if (a.contains("defaultName"))
        dlg->SetFileName(U2W(a["defaultName"].get<std::string>()).c_str());

    if (FAILED(dlg->Show(g_hwnd))) return nullptr; // cancelled

    if (multi) {
        ComPtr<IFileOpenDialog> od;
        dlg.As(&od);
        ComPtr<IShellItemArray> items;
        od->GetResults(&items);
        DWORD count; items->GetCount(&count);
        json arr = json::array();
        for (DWORD i = 0; i < count; i++) {
            ComPtr<IShellItem> item;
            items->GetItemAt(i, &item);
            LPWSTR path; item->GetDisplayName(SIGDN_FILESYSPATH, &path);
            arr.push_back(W2U(path));
            CoTaskMemFree(path);
        }
        return arr;
    } else {
        ComPtr<IShellItem> item;
        dlg->GetResult(&item);
        LPWSTR path; item->GetDisplayName(SIGDN_FILESYSPATH, &path);
        auto result = W2U(path);
        CoTaskMemFree(path);
        return result;
    }
}

static void reg_dialog() {
    ipc_on("dialog.openFile", [](const json& a) -> json {
        return show_file_dialog(false, a);
    });
    ipc_on("dialog.saveFile", [](const json& a) -> json {
        return show_file_dialog(true, a);
    });
    ipc_on("dialog.openFolder", [](const json& a) -> json {
        json arg = a.is_null() ? json::object() : a;
        arg["folder"] = true;
        return show_file_dialog(false, arg);
    });
    ipc_on("dialog.message", [](const json& a) -> json {
        auto title   = a.value("title", std::string{"Message"});
        auto message = a.value("message", std::string{});
        auto type    = a.value("type", std::string{"info"});
        UINT flags = MB_OK;
        if (type == "warning")     flags |= MB_ICONWARNING;
        else if (type == "error")  flags |= MB_ICONERROR;
        else                       flags |= MB_ICONINFORMATION;
        MessageBoxW(g_hwnd, U2W(message).c_str(), U2W(title).c_str(), flags);
        return true;
    });
    ipc_on("dialog.confirm", [](const json& a) -> json {
        auto title   = a.value("title", std::string{"Confirm"});
        auto message = a.value("message", std::string{});
        return MessageBoxW(g_hwnd, U2W(message).c_str(), U2W(title).c_str(),
                           MB_YESNO | MB_ICONQUESTION) == IDYES;
    });
}

// ================================================================
//  Commands: File system
// ================================================================

static void reg_fs() {
    ipc_on("fs.readTextFile", [](const json& a) -> json {
        auto path = a.value("path", std::string{});
        std::ifstream f(U2W(path), std::ios::binary);
        if (!f) throw std::runtime_error("Cannot open: " + path);
        return std::string((std::istreambuf_iterator<char>(f)), {});
    });
    ipc_on("fs.writeTextFile", [](const json& a) -> json {
        auto path    = a.value("path", std::string{});
        auto content = a.value("content", std::string{});
        std::ofstream f(U2W(path), std::ios::binary);
        if (!f) throw std::runtime_error("Cannot write: " + path);
        f.write(content.data(), content.size());
        return true;
    });
    ipc_on("fs.exists", [](const json& a) -> json {
        return fspath::exists(U2W(a.value("path", std::string{})));
    });
    ipc_on("fs.readDir", [](const json& a) -> json {
        auto path = a.value("path", std::string{});
        json entries = json::array();
        for (auto& e : fspath::directory_iterator(U2W(path))) {
            entries.push_back({
                {"name",   W2U(e.path().filename().wstring())},
                {"isDir",  e.is_directory()},
                {"isFile", e.is_regular_file()},
            });
        }
        return entries;
    });
    ipc_on("fs.mkdir", [](const json& a) -> json {
        fspath::create_directories(U2W(a.value("path", std::string{})));
        return true;
    });
    ipc_on("fs.remove", [](const json& a) -> json {
        fspath::remove_all(U2W(a.value("path", std::string{})));
        return true;
    });
    ipc_on("fs.rename", [](const json& a) -> json {
        fspath::rename(U2W(a.value("from", std::string{})),
                       U2W(a.value("to", std::string{})));
        return true;
    });
    ipc_on("fs.stat", [](const json& a) -> json {
        auto path = a.value("path", std::string{});
        WIN32_FILE_ATTRIBUTE_DATA d;
        if (!GetFileAttributesExW(U2W(path).c_str(), GetFileExInfoStandard, &d))
            throw std::runtime_error("Not found: " + path);
        ULARGE_INTEGER sz; sz.HighPart = d.nFileSizeHigh; sz.LowPart = d.nFileSizeLow;
        ULARGE_INTEGER ft; ft.HighPart = d.ftLastWriteTime.dwHighDateTime;
        ft.LowPart = d.ftLastWriteTime.dwLowDateTime;
        int64_t ts = (ft.QuadPart - 116444736000000000LL) / 10000000LL;
        bool isDir = (d.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        return {{"size", sz.QuadPart}, {"modified", ts}, {"isDir", isDir}, {"isFile", !isDir}};
    });
}

// ================================================================
//  Commands: Clipboard
// ================================================================

static void reg_clipboard() {
    ipc_on("clipboard.readText", [](const json&) -> json {
        if (!OpenClipboard(g_hwnd)) return nullptr;
        HANDLE h = GetClipboardData(CF_UNICODETEXT);
        if (!h) { CloseClipboard(); return nullptr; }
        auto text = W2U(static_cast<LPCWSTR>(GlobalLock(h)));
        GlobalUnlock(h);
        CloseClipboard();
        return text;
    });
    ipc_on("clipboard.writeText", [](const json& a) -> json {
        auto text = U2W(a.value("text", std::string{}));
        if (!OpenClipboard(g_hwnd)) return false;
        EmptyClipboard();
        size_t bytes = (text.size() + 1) * sizeof(wchar_t);
        HGLOBAL h = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if (h) {
            memcpy(GlobalLock(h), text.c_str(), bytes);
            GlobalUnlock(h);
            SetClipboardData(CF_UNICODETEXT, h);
        }
        CloseClipboard();
        return true;
    });
}

// ================================================================
//  Commands: Shell & App
// ================================================================

static void reg_shell_app() {
    ipc_on("shell.open", [](const json& a) -> json {
        auto url = a.value("url", std::string{});
        if (url.empty()) return false;
        ShellExecuteW(nullptr, L"open", U2W(url).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        return true;
    });
    ipc_on("shell.execute", [](const json& a) -> json {
        auto program = a.value("program", std::string{});
        if (program.empty()) throw std::runtime_error("program is required");
        std::wstring args;
        if (a.contains("args") && a["args"].is_array()) {
            for (auto& arg : a["args"]) {
                if (!args.empty()) args += L' ';
                auto s = U2W(arg.get<std::string>());
                if (s.find(L' ') != std::wstring::npos)
                    args += L'"' + s + L'"';
                else
                    args += s;
            }
        }
        auto ret = (INT_PTR)ShellExecuteW(nullptr, nullptr, U2W(program).c_str(),
                                          args.empty() ? nullptr : args.c_str(),
                                          nullptr, SW_SHOWNORMAL);
        return ret > 32;
    });
    ipc_on("app.exit", [](const json& a) -> json {
        PostQuitMessage(a.value("code", 0));
        return true;
    });
    ipc_on("app.dataDir", [](const json&) -> json {
        return W2U(exe_dir() + L"\\data");
    });
    ipc_on("window.startDrag", [](const json&) -> json {
        ReleaseCapture();
        SendMessageW(g_hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
        return true;
    });
    ipc_on("window.getConfig", [](const json&) -> json {
        return g_cfg;
    });
    ipc_on("window.isFrameless", [](const json&) -> json {
        return g_frameless;
    });
}

// ================================================================
//  Commands: Environment variables
// ================================================================

static void reg_env() {
    ipc_on("env.get", [](const json& a) -> json {
        auto name = a.value("name", std::string{});
        wchar_t buf[32768];
        DWORD len = GetEnvironmentVariableW(U2W(name).c_str(), buf, 32768);
        if (len == 0) return nullptr;
        return W2U(buf);
    });
    ipc_on("env.getAll", [](const json&) -> json {
        json result = json::object();
        auto env = GetEnvironmentStringsW();
        if (!env) return result;
        for (auto p = env; *p; p += wcslen(p) + 1) {
            auto s = W2U(p);
            auto eq = s.find('=');
            if (eq != std::string::npos && eq > 0)
                result[s.substr(0, eq)] = s.substr(eq + 1);
        }
        FreeEnvironmentStringsW(env);
        return result;
    });
}

// ================================================================
//  Commands: Global hotkeys
// ================================================================

static void reg_hotkey() {
    ipc_on("hotkey.register", [](const json& a) -> json {
        int id  = a.value("id", 0);
        int mod = a.value("modifiers", 0); // MOD_ALT=1, MOD_CONTROL=2, MOD_SHIFT=4, MOD_WIN=8
        int key = a.value("key", 0);       // Virtual key code
        bool ok = RegisterHotKey(g_hwnd, id, mod | MOD_NOREPEAT, key);
        return ok;
    });
    ipc_on("hotkey.unregister", [](const json& a) -> json {
        return (bool)UnregisterHotKey(g_hwnd, a.value("id", 0));
    });
    ipc_on("hotkey.unregisterAll", [](const json&) -> json {
        // Unregister IDs 1..100
        for (int i = 1; i <= 100; i++) UnregisterHotKey(g_hwnd, i);
        return true;
    });
}

// ================================================================
//  Commands: Notifications
// ================================================================

static void reg_notification() {
    ipc_on("notification.show", [](const json& a) -> json {
        auto title = U2W(a.value("title", std::string{"通知"}));
        auto body  = U2W(a.value("body", std::string{}));
        // Use tray balloon if tray is active
        if (g_trayActive) {
            g_nid.uFlags |= NIF_INFO;
            wcsncpy_s(g_nid.szInfoTitle, title.c_str(), _TRUNCATE);
            wcsncpy_s(g_nid.szInfo, body.c_str(), _TRUNCATE);
            g_nid.dwInfoFlags = NIIF_INFO;
            Shell_NotifyIconW(NIM_MODIFY, &g_nid);
            return true;
        }
        // Create temporary tray icon for notification
        NOTIFYICONDATAW nid{sizeof(nid)};
        nid.hWnd  = g_hwnd;
        nid.uID   = 99;
        nid.uFlags = NIF_ICON | NIF_INFO;
        nid.hIcon  = LoadIconW(nullptr, IDI_APPLICATION);
        wcsncpy_s(nid.szInfoTitle, title.c_str(), _TRUNCATE);
        wcsncpy_s(nid.szInfo, body.c_str(), _TRUNCATE);
        nid.dwInfoFlags = NIIF_INFO;
        Shell_NotifyIconW(NIM_ADD, &nid);
        // Remove after a delay (fire-and-forget via timer)
        SetTimer(g_hwnd, 99, 5000, [](HWND h, UINT, UINT_PTR id, DWORD) {
            NOTIFYICONDATAW nid{sizeof(nid)};
            nid.hWnd = h; nid.uID = 99;
            Shell_NotifyIconW(NIM_DELETE, &nid);
            KillTimer(h, id);
        });
        return true;
    });
}

// ================================================================
//  Commands: Context menu
// ================================================================

static void reg_menu() {
    ipc_on("menu.popup", [](const json& a) -> json {
        if (!a.contains("items") || !a["items"].is_array()) return nullptr;
        HMENU hMenu = CreatePopupMenu();
        int idx = 1;
        for (auto& item : a["items"]) {
            if (item.is_string() && item.get<std::string>() == "-") {
                AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);
            } else if (item.is_object()) {
                auto label = U2W(item.value("label", std::string{""}));
                UINT flags = MF_STRING;
                if (item.value("disabled", false)) flags |= MF_GRAYED;
                if (item.value("checked", false))  flags |= MF_CHECKED;
                AppendMenuW(hMenu, flags, idx, label.c_str());
            }
            idx++;
        }
        POINT pt;
        GetCursorPos(&pt);
        SetForegroundWindow(g_hwnd);
        int cmd = TrackPopupMenuEx(hMenu, TPM_RETURNCMD | TPM_NONOTIFY,
                                    pt.x, pt.y, g_hwnd, nullptr);
        DestroyMenu(hMenu);
        if (cmd == 0) return nullptr; // cancelled
        return cmd - 1; // 0-based index
    });
}

// ================================================================
//  Commands: HTTP client
// ================================================================

static void reg_http() {
    ipc_on("http.request", [](const json& a) -> json {
        auto url    = a.value("url", std::string{});
        auto method = a.value("method", std::string{"GET"});
        auto body   = a.value("body", std::string{});
        auto hdrs   = a.value("headers", json::object());

        if (url.empty()) throw std::runtime_error("url is required");

        // Parse URL
        auto wUrl = U2W(url);
        URL_COMPONENTS uc{sizeof(uc)};
        wchar_t host[256]{}, path[2048]{};
        uc.lpszHostName  = host;   uc.dwHostNameLength  = 256;
        uc.lpszUrlPath   = path;   uc.dwUrlPathLength   = 2048;
        if (!WinHttpCrackUrl(wUrl.c_str(), 0, 0, &uc))
            throw std::runtime_error("Invalid URL");

        bool https = (uc.nScheme == INTERNET_SCHEME_HTTPS);
        HINTERNET hSession = WinHttpOpen(L"QQ/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                          WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        if (!hSession) throw std::runtime_error("WinHttpOpen failed");

        HINTERNET hConnect = WinHttpConnect(hSession, host, uc.nPort, 0);
        if (!hConnect) { WinHttpCloseHandle(hSession); throw std::runtime_error("WinHttpConnect failed"); }

        auto wMethod = U2W(method);
        HINTERNET hRequest = WinHttpOpenRequest(hConnect, wMethod.c_str(), path,
                                                 nullptr, WINHTTP_NO_REFERER,
                                                 WINHTTP_DEFAULT_ACCEPT_TYPES,
                                                 https ? WINHTTP_FLAG_SECURE : 0);
        if (!hRequest) {
            WinHttpCloseHandle(hConnect);
            WinHttpCloseHandle(hSession);
            throw std::runtime_error("WinHttpOpenRequest failed");
        }

        // Add custom headers
        std::wstring allHeaders;
        for (auto& [k, v] : hdrs.items()) {
            allHeaders += U2W(k) + L": " + U2W(v.get<std::string>()) + L"\r\n";
        }
        if (!allHeaders.empty())
            WinHttpAddRequestHeaders(hRequest, allHeaders.c_str(), (DWORD)-1, WINHTTP_ADDREQ_FLAG_ADD);

        // Send
        LPVOID bodyPtr = body.empty() ? WINHTTP_NO_REQUEST_DATA : (LPVOID)body.data();
        DWORD bodyLen  = body.empty() ? 0 : (DWORD)body.size();
        if (!WinHttpSendRequest(hRequest, WINHTTP_NO_ADDITIONAL_HEADERS, 0, bodyPtr, bodyLen, bodyLen, 0) ||
            !WinHttpReceiveResponse(hRequest, nullptr)) {
            WinHttpCloseHandle(hRequest);
            WinHttpCloseHandle(hConnect);
            WinHttpCloseHandle(hSession);
            throw std::runtime_error("HTTP request failed");
        }

        // Status code
        DWORD statusCode = 0, sz = sizeof(statusCode);
        WinHttpQueryHeaders(hRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &sz, WINHTTP_NO_HEADER_INDEX);

        // Response headers
        DWORD hdrSize = 0;
        WinHttpQueryHeaders(hRequest, WINHTTP_QUERY_RAW_HEADERS_CRLF,
                            WINHTTP_HEADER_NAME_BY_INDEX, nullptr, &hdrSize, WINHTTP_NO_HEADER_INDEX);
        std::wstring respHdrs(hdrSize / sizeof(wchar_t), 0);
        WinHttpQueryHeaders(hRequest, WINHTTP_QUERY_RAW_HEADERS_CRLF,
                            WINHTTP_HEADER_NAME_BY_INDEX, respHdrs.data(), &hdrSize, WINHTTP_NO_HEADER_INDEX);

        // Response body
        std::string respBody;
        DWORD available, read;
        while (WinHttpQueryDataAvailable(hRequest, &available) && available > 0) {
            std::string chunk(available, 0);
            WinHttpReadData(hRequest, chunk.data(), available, &read);
            chunk.resize(read);
            respBody += chunk;
        }

        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);

        return json{{"status", statusCode}, {"headers", W2U(respHdrs)}, {"body", respBody}};
    });
}

// ================================================================
//  Commands: Special directories & OS info
// ================================================================

static std::wstring getKnownFolder(REFKNOWNFOLDERID id) {
    PWSTR p = nullptr;
    if (SUCCEEDED(SHGetKnownFolderPath(id, 0, nullptr, &p))) {
        std::wstring s(p);
        CoTaskMemFree(p);
        return s;
    }
    return {};
}

static void reg_os() {
    ipc_on("os.platform", [](const json&) -> json { return "windows"; });
    ipc_on("os.arch", [](const json&) -> json {
        SYSTEM_INFO si; GetNativeSystemInfo(&si);
        switch (si.wProcessorArchitecture) {
            case PROCESSOR_ARCHITECTURE_AMD64: return "x64";
            case PROCESSOR_ARCHITECTURE_ARM64: return "arm64";
            case PROCESSOR_ARCHITECTURE_INTEL: return "x86";
            default: return "unknown";
        }
    });
    ipc_on("os.version", [](const json&) -> json {
        OSVERSIONINFOEXW vi{sizeof(vi)};
        // Use RtlGetVersion to bypass deprecation
        using RtlGetVersionFn = LONG(WINAPI*)(OSVERSIONINFOEXW*);
        auto fn = (RtlGetVersionFn)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
        if (fn) fn(&vi);
        return std::to_string(vi.dwMajorVersion) + "." +
               std::to_string(vi.dwMinorVersion) + "." +
               std::to_string(vi.dwBuildNumber);
    });
    ipc_on("os.hostname", [](const json&) -> json {
        wchar_t buf[256]; DWORD sz = 256;
        GetComputerNameW(buf, &sz);
        return W2U(buf);
    });
    ipc_on("os.username", [](const json&) -> json {
        wchar_t buf[256]; DWORD sz = 256;
        GetUserNameW(buf, &sz);
        return W2U(buf);
    });
    ipc_on("os.locale", [](const json&) -> json {
        wchar_t buf[85]; GetUserDefaultLocaleName(buf, 85);
        return W2U(buf);
    });

    // Special folders
    ipc_on("path.home", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_Profile));
    });
    ipc_on("path.documents", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_Documents));
    });
    ipc_on("path.desktop", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_Desktop));
    });
    ipc_on("path.downloads", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_Downloads));
    });
    ipc_on("path.appData", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_RoamingAppData));
    });
    ipc_on("path.localAppData", [](const json&) -> json {
        return W2U(getKnownFolder(FOLDERID_LocalAppData));
    });
    ipc_on("path.temp", [](const json&) -> json {
        wchar_t buf[MAX_PATH]; GetTempPathW(MAX_PATH, buf);
        return W2U(buf);
    });
}

// ================================================================
//  Commands: File watcher
// ================================================================

static DWORD WINAPI watchThread(LPVOID param) {
    auto* w = (FileWatcher*)param;
    BYTE buf[4096];
    while (w->active) {
        DWORD bytes = 0;
        if (ReadDirectoryChangesW(w->hDir, buf, sizeof(buf), TRUE,
            FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_DIR_NAME |
            FILE_NOTIFY_CHANGE_SIZE | FILE_NOTIFY_CHANGE_LAST_WRITE |
            FILE_NOTIFY_CHANGE_CREATION,
            &bytes, nullptr, nullptr))
        {
            auto* info = (FILE_NOTIFY_INFORMATION*)buf;
            while (info && w->active) {
                std::wstring name(info->FileName, info->FileNameLength / sizeof(wchar_t));
                const char* action = "unknown";
                switch (info->Action) {
                    case FILE_ACTION_ADDED:            action = "created"; break;
                    case FILE_ACTION_REMOVED:          action = "deleted"; break;
                    case FILE_ACTION_MODIFIED:         action = "modified"; break;
                    case FILE_ACTION_RENAMED_OLD_NAME: action = "renamed"; break;
                    case FILE_ACTION_RENAMED_NEW_NAME: action = "renamed"; break;
                }
                // Post to main thread
                PostMessageW(g_hwnd, WM_FILE_CHANGED, w->id, (LPARAM)new json{
                    {"id", w->id}, {"action", action}, {"path", W2U(name)}
                });
                if (info->NextEntryOffset == 0) break;
                info = (FILE_NOTIFY_INFORMATION*)((BYTE*)info + info->NextEntryOffset);
            }
        } else {
            break;
        }
    }
    return 0;
}

static void reg_watcher() {
    ipc_on("watcher.start", [](const json& a) -> json {
        auto path = a.value("path", std::string{});
        if (path.empty()) throw std::runtime_error("path is required");
        auto wpath = U2W(path);
        HANDLE hDir = CreateFileW(wpath.c_str(), FILE_LIST_DIRECTORY,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr);
        if (hDir == INVALID_HANDLE_VALUE)
            throw std::runtime_error("Cannot watch: " + path);

        int id = g_nextWatchId++;
        auto* w = new FileWatcher{hDir, nullptr, wpath, id, true};
        w->hThread = CreateThread(nullptr, 0, watchThread, w, 0, nullptr);
        g_watchers[id] = w;
        return id;
    });
    ipc_on("watcher.stop", [](const json& a) -> json {
        int id = a.value("id", 0);
        auto it = g_watchers.find(id);
        if (it == g_watchers.end()) return false;
        auto* w = it->second;
        w->active = false;
        CancelIoEx(w->hDir, nullptr);
        WaitForSingleObject(w->hThread, 1000);
        CloseHandle(w->hThread);
        CloseHandle(w->hDir);
        delete w;
        g_watchers.erase(it);
        return true;
    });
}

// ================================================================
//  Commands: Window state persistence
// ================================================================

static std::wstring g_stateFile;

static void saveWindowState() {
    if (g_stateFile.empty()) return;
    WINDOWPLACEMENT wp{sizeof(wp)};
    GetWindowPlacement(g_hwnd, &wp);
    json state = {
        {"x",         wp.rcNormalPosition.left},
        {"y",         wp.rcNormalPosition.top},
        {"w",         wp.rcNormalPosition.right - wp.rcNormalPosition.left},
        {"h",         wp.rcNormalPosition.bottom - wp.rcNormalPosition.top},
        {"maximized", wp.showCmd == SW_MAXIMIZE},
    };
    std::ofstream f(g_stateFile, std::ios::binary);
    if (f) f << state.dump(2);
}

static json loadWindowState() {
    if (g_stateFile.empty()) return {};
    std::ifstream f(g_stateFile);
    if (!f) return {};
    try { json j; f >> j; return j; }
    catch (...) { return {}; }
}

static void reg_state() {
    ipc_on("window.saveState", [](const json&) -> json {
        saveWindowState();
        return true;
    });
    ipc_on("window.loadState", [](const json&) -> json {
        return loadWindowState();
    });
}

// ================================================================
//  DevTools toggle
// ================================================================

static void reg_devtools() {
    ipc_on("devtools.open", [](const json&) -> json {
        if (g_view) g_view->OpenDevToolsWindow();
        return true;
    });
    ipc_on("devtools.close", [](const json&) -> json {
        // WebView2 doesn't have a direct close devtools API
        // but opening when already open just focuses
        return true;
    });
}

// ================================================================
//  Commands: System tray
// ================================================================

static void reg_tray() {
    ipc_on("tray.create", [](const json& a) -> json {
        if (g_trayActive) return true;
        g_nid.cbSize           = sizeof(g_nid);
        g_nid.hWnd             = g_hwnd;
        g_nid.uID              = 1;
        g_nid.uFlags           = NIF_ICON | NIF_TIP | NIF_MESSAGE;
        g_nid.uCallbackMessage = WM_TRAYICON;
        g_nid.hIcon            = LoadIconW(nullptr, IDI_APPLICATION);
        auto tip = U2W(a.value("tooltip", std::string{"App"}));
        wcsncpy_s(g_nid.szTip, tip.c_str(), _TRUNCATE);
        Shell_NotifyIconW(NIM_ADD, &g_nid);
        g_trayActive = true;
        return true;
    });
    ipc_on("tray.setTooltip", [](const json& a) -> json {
        if (!g_trayActive) return false;
        auto tip = U2W(a.value("tooltip", std::string{"App"}));
        wcsncpy_s(g_nid.szTip, tip.c_str(), _TRUNCATE);
        Shell_NotifyIconW(NIM_MODIFY, &g_nid);
        return true;
    });
    ipc_on("tray.remove", [](const json&) -> json {
        if (!g_trayActive) return false;
        Shell_NotifyIconW(NIM_DELETE, &g_nid);
        g_trayActive = false;
        return true;
    });
}

// ================================================================
//  Commands: Registry
// ================================================================

static HKEY parseRootKey(const std::string& root) {
    if (root == "HKCU" || root == "HKEY_CURRENT_USER")   return HKEY_CURRENT_USER;
    if (root == "HKLM" || root == "HKEY_LOCAL_MACHINE")   return HKEY_LOCAL_MACHINE;
    if (root == "HKCR" || root == "HKEY_CLASSES_ROOT")    return HKEY_CLASSES_ROOT;
    if (root == "HKU"  || root == "HKEY_USERS")           return HKEY_USERS;
    return HKEY_CURRENT_USER;
}

static void reg_registry() {
    ipc_on("registry.read", [](const json& a) -> json {
        auto root = a.value("root", std::string{"HKCU"});
        auto path = a.value("path", std::string{});
        auto name = a.value("name", std::string{});
        HKEY hKey;
        if (RegOpenKeyExW(parseRootKey(root), U2W(path).c_str(), 0, KEY_READ, &hKey) != ERROR_SUCCESS)
            return nullptr;
        DWORD type, size = 0;
        auto wName = U2W(name);
        RegQueryValueExW(hKey, wName.c_str(), nullptr, &type, nullptr, &size);
        if (size == 0) { RegCloseKey(hKey); return nullptr; }
        std::vector<BYTE> buf(size);
        RegQueryValueExW(hKey, wName.c_str(), nullptr, &type, buf.data(), &size);
        RegCloseKey(hKey);
        switch (type) {
            case REG_SZ:
            case REG_EXPAND_SZ:
                return W2U(reinterpret_cast<wchar_t*>(buf.data()));
            case REG_DWORD:
                return (int)*reinterpret_cast<DWORD*>(buf.data());
            case REG_QWORD:
                return (int64_t)*reinterpret_cast<uint64_t*>(buf.data());
            default:
                return nullptr;
        }
    });
    ipc_on("registry.write", [](const json& a) -> json {
        auto root  = a.value("root", std::string{"HKCU"});
        auto path  = a.value("path", std::string{});
        auto name  = a.value("name", std::string{});
        auto value = a["value"];
        HKEY hKey;
        if (RegCreateKeyExW(parseRootKey(root), U2W(path).c_str(), 0, nullptr,
            0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
            throw std::runtime_error("Cannot open registry key");
        auto wName = U2W(name);
        LONG result;
        if (value.is_string()) {
            auto wVal = U2W(value.get<std::string>());
            result = RegSetValueExW(hKey, wName.c_str(), 0, REG_SZ,
                (const BYTE*)wVal.c_str(), (DWORD)((wVal.size()+1)*sizeof(wchar_t)));
        } else if (value.is_number_integer()) {
            DWORD dw = (DWORD)value.get<int>();
            result = RegSetValueExW(hKey, wName.c_str(), 0, REG_DWORD, (const BYTE*)&dw, sizeof(dw));
        } else {
            RegCloseKey(hKey);
            throw std::runtime_error("Unsupported value type");
        }
        RegCloseKey(hKey);
        return result == ERROR_SUCCESS;
    });
    ipc_on("registry.delete", [](const json& a) -> json {
        auto root = a.value("root", std::string{"HKCU"});
        auto path = a.value("path", std::string{});
        auto name = a.value("name", std::string{});
        if (name.empty()) {
            // Delete entire key
            return RegDeleteTreeW(parseRootKey(root), U2W(path).c_str()) == ERROR_SUCCESS;
        }
        HKEY hKey;
        if (RegOpenKeyExW(parseRootKey(root), U2W(path).c_str(), 0, KEY_WRITE, &hKey) != ERROR_SUCCESS)
            return false;
        auto result = RegDeleteValueW(hKey, U2W(name).c_str());
        RegCloseKey(hKey);
        return result == ERROR_SUCCESS;
    });
    ipc_on("registry.exists", [](const json& a) -> json {
        auto root = a.value("root", std::string{"HKCU"});
        auto path = a.value("path", std::string{});
        HKEY hKey;
        if (RegOpenKeyExW(parseRootKey(root), U2W(path).c_str(), 0, KEY_READ, &hKey) != ERROR_SUCCESS)
            return false;
        RegCloseKey(hKey);
        return true;
    });
}

// ================================================================
//  Commands: Deep link / URL protocol
// ================================================================

static void reg_protocol() {
    ipc_on("protocol.register", [](const json& a) -> json {
        auto scheme = a.value("scheme", std::string{});
        auto desc   = a.value("description", scheme + " Protocol");
        if (scheme.empty()) throw std::runtime_error("scheme is required");

        wchar_t exePath[MAX_PATH];
        GetModuleFileNameW(nullptr, exePath, MAX_PATH);

        auto wScheme = U2W(scheme);
        auto regPath = L"Software\\Classes\\" + wScheme;

        HKEY hKey;
        // Create scheme key
        if (RegCreateKeyExW(HKEY_CURRENT_USER, regPath.c_str(), 0, nullptr,
            0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
            throw std::runtime_error("Cannot register protocol");

        auto wDesc = U2W(desc);
        RegSetValueExW(hKey, nullptr, 0, REG_SZ, (BYTE*)wDesc.c_str(), (DWORD)((wDesc.size()+1)*sizeof(wchar_t)));
        auto urlProto = L"URL Protocol";
        RegSetValueExW(hKey, L"URL Protocol", 0, REG_SZ, (BYTE*)L"", sizeof(wchar_t));
        RegCloseKey(hKey);

        // Create shell\open\command key
        auto cmdPath = regPath + L"\\shell\\open\\command";
        if (RegCreateKeyExW(HKEY_CURRENT_USER, cmdPath.c_str(), 0, nullptr,
            0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
            throw std::runtime_error("Cannot register protocol command");

        auto cmd = L"\"" + std::wstring(exePath) + L"\" \"%1\"";
        RegSetValueExW(hKey, nullptr, 0, REG_SZ, (BYTE*)cmd.c_str(), (DWORD)((cmd.size()+1)*sizeof(wchar_t)));
        RegCloseKey(hKey);
        return true;
    });
    ipc_on("protocol.unregister", [](const json& a) -> json {
        auto scheme = a.value("scheme", std::string{});
        if (scheme.empty()) throw std::runtime_error("scheme is required");
        auto regPath = L"Software\\Classes\\" + U2W(scheme);
        return RegDeleteTreeW(HKEY_CURRENT_USER, regPath.c_str()) == ERROR_SUCCESS;
    });
}

// ================================================================
//  Commands: Logging
// ================================================================

static void writeLog(const std::string& level, const std::string& msg) {
    if (g_logFile.empty()) return;
    std::lock_guard<std::mutex> lock(g_logMtx);
    std::ofstream f(g_logFile, std::ios::app);
    if (!f) return;
    SYSTEMTIME st; GetLocalTime(&st);
    char ts[32];
    snprintf(ts, sizeof(ts), "%04d-%02d-%02d %02d:%02d:%02d.%03d",
             st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    f << "[" << ts << "] [" << level << "] " << msg << "\n";
}

static void reg_log() {
    ipc_on("log.setFile", [](const json& a) -> json {
        auto path = a.value("path", std::string{});
        if (path.empty()) {
            // Default to data/app.log
            g_logFile = exe_dir() + L"\\data\\app.log";
        } else {
            g_logFile = U2W(path);
        }
        // Ensure parent directory exists
        auto parent = fspath::path(g_logFile).parent_path();
        fspath::create_directories(parent);
        return W2U(g_logFile);
    });
    ipc_on("log.write", [](const json& a) -> json {
        auto level = a.value("level", std::string{"info"});
        auto msg   = a.value("message", std::string{});
        writeLog(level, msg);
        return true;
    });
    ipc_on("log.clear", [](const json&) -> json {
        if (g_logFile.empty()) return false;
        std::ofstream f(g_logFile, std::ios::trunc);
        return f.good();
    });
    ipc_on("log.getPath", [](const json&) -> json {
        return g_logFile.empty() ? nullptr : json(W2U(g_logFile));
    });
}

// ================================================================
//  Splash screen
// ================================================================

static LRESULT CALLBACK SplashProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    if (m == WM_PAINT) {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(h, &ps);
        RECT rc; GetClientRect(h, &rc);
        // Background
        auto bg = g_cfg.value("/window/backgroundColor"_json_pointer, std::string{"#1a1a2e"});
        int r=26,g=26,b=46;
        if (bg.size()>=7) { r=std::stoi(bg.substr(1,2),0,16); g=std::stoi(bg.substr(3,2),0,16); b=std::stoi(bg.substr(5,2),0,16); }
        HBRUSH brush = CreateSolidBrush(RGB(r,g,b));
        FillRect(hdc, &rc, brush);
        DeleteObject(brush);
        // Title text
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, RGB(200,200,200));
        auto title = U2W(g_cfg.value("/window/title"_json_pointer, std::string{"\xe5\xbc\xba\xe5\xbc\xba"}));
        HFONT hFont = CreateFontW(28, 0, 0, 0, FW_LIGHT, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
        auto old = SelectObject(hdc, hFont);
        DrawTextW(hdc, title.c_str(), -1, &rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        // "Loading..." below
        RECT rc2 = rc; rc2.top += 40;
        HFONT hSmall = CreateFontW(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
        SelectObject(hdc, hSmall);
        SetTextColor(hdc, RGB(120,120,140));
        DrawTextW(hdc, L"Loading...", -1, &rc2, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        SelectObject(hdc, old);
        DeleteObject(hFont);
        DeleteObject(hSmall);
        EndPaint(h, &ps);
        return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

static void showSplash(HINSTANCE hi, int w, int h) {
    if (!g_cfg.value("/window/splash"_json_pointer, false)) return;
    WNDCLASSEXW sc{sizeof(sc)};
    sc.lpfnWndProc  = SplashProc;
    sc.hInstance     = hi;
    sc.lpszClassName = L"QQ_Splash";
    sc.hCursor       = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassExW(&sc);

    HMONITOR mon = MonitorFromPoint({0,0}, MONITOR_DEFAULTTOPRIMARY);
    MONITORINFO mi{sizeof(mi)};
    GetMonitorInfoW(mon, &mi);
    int sw = 300, sh = 120;
    int sx = mi.rcWork.left + (mi.rcWork.right - mi.rcWork.left - sw) / 2;
    int sy = mi.rcWork.top + (mi.rcWork.bottom - mi.rcWork.top - sh) / 2;

    g_splash = CreateWindowExW(WS_EX_TOOLWINDOW, L"QQ_Splash", L"",
        WS_POPUP, sx, sy, sw, sh, nullptr, nullptr, hi, nullptr);
    // DWM shadow
    MARGINS m = {0,0,0,1};
    DwmExtendFrameIntoClientArea(g_splash, &m);
    ShowWindow(g_splash, SW_SHOW);
    UpdateWindow(g_splash);
}

static void closeSplash() {
    if (g_splash) {
        DestroyWindow(g_splash);
        g_splash = nullptr;
    }
}

// ================================================================
//  WebView2 initialization
// ================================================================

static void init_webview() {
    auto dataDir = exe_dir() + L"\\data";
    CreateCoreWebView2EnvironmentWithOptions(nullptr, dataDir.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
        [](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
            if (FAILED(hr)) {
                MessageBoxW(g_hwnd,
                    L"WebView2 \u521D\u59CB\u5316\u5931\u8D25\u3002\n\u8BF7\u5B89\u88C5 WebView2 Runtime:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    L"\u9519\u8BEF", MB_ICONERROR);
                PostQuitMessage(1);
                return hr;
            }
            g_env = env;
            return g_env->CreateCoreWebView2Controller(g_hwnd,
                Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                [](HRESULT hr, ICoreWebView2Controller* ctrl) -> HRESULT {
                    if (FAILED(hr)) { PostQuitMessage(1); return hr; }
                    g_ctrl = ctrl;
                    g_ctrl->get_CoreWebView2(&g_view);

                    RECT b; GetClientRect(g_hwnd, &b);
                    if (g_frameless) {
                        b.left += g_borderSize; b.top += g_borderSize;
                        b.right -= g_borderSize; b.bottom -= g_borderSize;
                    }
                    g_ctrl->put_Bounds(b);

                    // Background color from config
                    ComPtr<ICoreWebView2Controller2> ctrl2;
                    if (SUCCEEDED(g_ctrl.As(&ctrl2))) {
                        auto hex = g_cfg.value("/window/backgroundColor"_json_pointer, std::string{"#1a1a2e"});
                        int r=26,g=26,b=46;
                        if (hex.size()>=7) { r=std::stoi(hex.substr(1,2),0,16); g=std::stoi(hex.substr(3,2),0,16); b=std::stoi(hex.substr(5,2),0,16); }
                        ctrl2->put_DefaultBackgroundColor({0,(BYTE)r,(BYTE)g,(BYTE)b});
                    }

                    // Settings
                    ComPtr<ICoreWebView2Settings> s;
                    g_view->get_Settings(&s);
                    s->put_IsScriptEnabled(TRUE);
                    s->put_AreDefaultScriptDialogsEnabled(TRUE);
                    s->put_IsWebMessageEnabled(TRUE);
                    bool dev = !g_devUrl.empty();
                    s->put_AreDevToolsEnabled(dev ? TRUE : FALSE);
                    s->put_AreDefaultContextMenusEnabled(dev ? TRUE : FALSE);
                    s->put_IsStatusBarEnabled(FALSE);

                    // IPC handler
                    g_view->add_WebMessageReceived(
                        Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                        [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* a) -> HRESULT {
                            LPWSTR m; a->get_WebMessageAsJson(&m);
                            ipc_dispatch(m);
                            CoTaskMemFree(m);
                            return S_OK;
                        }).Get(), nullptr);

                    // Navigate
                    if (dev) {
                        g_view->Navigate(g_devUrl.c_str());
                    } else {
#ifdef SINGLE_EXE
                        // Try embedded HTML first, fallback to virtual host
                        auto embeddedHtml = loadResource(IDR_HTML);
                        if (!embeddedHtml.empty()) {
                            g_view->NavigateToString(U2W(embeddedHtml).c_str());
                        } else
#endif
                        {
                            auto dir = exe_dir();
                            ComPtr<ICoreWebView2_3> v3;
                            if (SUCCEEDED(g_view.As(&v3)))
                                v3->SetVirtualHostNameToFolderMapping(
                                    L"app.local", dir.c_str(),
                                    COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
                            g_view->Navigate(L"https://app.local/index.html");
                        }
                    }
                    // Close splash once WebView2 is ready
                    closeSplash();
                    return S_OK;
                }).Get());
        }).Get());
}

// ================================================================
//  Window procedure
// ================================================================

static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
    // ── Fill frameless border area with background color ──
    case WM_NCPAINT:
        if (g_frameless) return 0;
        break;
    case WM_NCACTIVATE:
        if (g_frameless) return TRUE;
        break;
    case WM_ERASEBKGND:
        if (g_frameless && g_bgBrush) {
            // Actually paint the background (the 6px border area needs this)
            HDC hdc = (HDC)w;
            RECT rc;
            GetClientRect(h, &rc);
            FillRect(hdc, &rc, g_bgBrush);
            return 1;
        }
        break;
    case WM_PAINT:
        if (g_frameless && g_bgBrush) {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(h, &ps);
            // Fill only the border strips (not the WebView2 area)
            FillRect(hdc, &ps.rcPaint, g_bgBrush);
            EndPaint(h, &ps);
            return 0;
        }
        break;

    case WM_SIZE:
        if (g_ctrl) {
            RECT b; GetClientRect(h, &b);
            if (g_frameless) {
                b.left += g_borderSize; b.top += g_borderSize;
                b.right -= g_borderSize; b.bottom -= g_borderSize;
            }
            g_ctrl->put_Bounds(b);
        }
        // Emit size events
        if (w == SIZE_MAXIMIZED)      ipc_emit("window.maximized");
        else if (w == SIZE_MINIMIZED) ipc_emit("window.minimized");
        else if (w == SIZE_RESTORED)  ipc_emit("window.restored");
        ipc_emit("window.resized", {{"w", (int)LOWORD(l)}, {"h", (int)HIWORD(l)}});
        return 0;
    case WM_MOVE:
        ipc_emit("window.moved", {{"x", (int)(short)LOWORD(l)}, {"y", (int)(short)HIWORD(l)}});
        return 0;
    case WM_SETFOCUS:
        ipc_emit("window.focus");
        return 0;
    case WM_KILLFOCUS:
        ipc_emit("window.blur");
        return 0;
    case WM_CLOSE:
        saveWindowState();
        ipc_emit("window.closing");
        if (g_trayActive) { ShowWindow(h, SW_HIDE); return 0; }
        DestroyWindow(h);
        return 0;
    case WM_DESTROY:
        // Cleanup watchers
        for (auto& [id, w] : g_watchers) {
            w->active = false;
            CancelIoEx(w->hDir, nullptr);
            WaitForSingleObject(w->hThread, 500);
            CloseHandle(w->hThread);
            CloseHandle(w->hDir);
            delete w;
        }
        g_watchers.clear();
        if (g_trayActive) Shell_NotifyIconW(NIM_DELETE, &g_nid);
        PostQuitMessage(0);
        return 0;
    case WM_HOTKEY:
        ipc_emit("hotkey.triggered", {{"id", (int)w}});
        return 0;
    case WM_FILE_CHANGED: {
        auto* data = reinterpret_cast<json*>(l);
        ipc_emit("watcher.changed", *data);
        delete data;
        return 0;
    }
    case WM_KEYDOWN:
        // F12 toggles DevTools in dev mode
        if (w == VK_F12 && !g_devUrl.empty()) {
            if (g_view) g_view->OpenDevToolsWindow();
            return 0;
        }
        break;
    case WM_DROPFILES: {
        HDROP hDrop = (HDROP)w;
        UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, nullptr, 0);
        json files = json::array();
        wchar_t path[MAX_PATH];
        for (UINT i = 0; i < count; i++) {
            DragQueryFileW(hDrop, i, path, MAX_PATH);
            files.push_back(W2U(path));
        }
        POINT pt;
        DragQueryPoint(hDrop, &pt);
        DragFinish(hDrop);
        ipc_emit("window.fileDrop", {{"files", files}, {"x", pt.x}, {"y", pt.y}});
        return 0;
    }
    case WM_TRAYICON:
        switch (LOWORD(l)) {
        case WM_LBUTTONUP:    ipc_emit("tray.click"); break;
        case WM_LBUTTONDBLCLK:
            ShowWindow(g_hwnd, SW_SHOW);
            SetForegroundWindow(g_hwnd);
            ipc_emit("tray.doubleClick");
            break;
        case WM_RBUTTONUP:    ipc_emit("tray.rightClick"); break;
        }
        return 0;

    // ── Frameless window handling ──
    case WM_NCCALCSIZE:
        if (g_frameless && w) {
            auto* p = reinterpret_cast<NCCALCSIZE_PARAMS*>(l);
            // When maximized, respect taskbar area
            WINDOWPLACEMENT wpl{sizeof(wpl)};
            GetWindowPlacement(h, &wpl);
            if (wpl.showCmd == SW_MAXIMIZE) {
                HMONITOR mon = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
                MONITORINFO mi{sizeof(mi)};
                GetMonitorInfoW(mon, &mi);
                p->rgrc[0] = mi.rcWork;
            }
            return 0;
        }
        break;

    case WM_NCHITTEST: {
        if (!g_frameless) break;
        POINT pt = { GET_X_LPARAM(l), GET_Y_LPARAM(l) };
        ScreenToClient(h, &pt);
        RECT rc; GetClientRect(h, &rc);
        int B = g_borderSize;
        // Resize borders
        if (pt.y < B) {
            if (pt.x < B) return HTTOPLEFT;
            if (pt.x > rc.right - B) return HTTOPRIGHT;
            return HTTOP;
        }
        if (pt.y > rc.bottom - B) {
            if (pt.x < B) return HTBOTTOMLEFT;
            if (pt.x > rc.right - B) return HTBOTTOMRIGHT;
            return HTBOTTOM;
        }
        if (pt.x < B) return HTLEFT;
        if (pt.x > rc.right - B) return HTRIGHT;
        // Title bar drag area (except right corner for window controls)
        if (g_titleBarH > 0 && pt.y < g_titleBarH && pt.x < rc.right - 140)
            return HTCAPTION;
        return HTCLIENT;
    }

    case WM_GETMINMAXINFO: {
        auto mw = g_cfg.value("/window/minWidth"_json_pointer, 200);
        auto mh = g_cfg.value("/window/minHeight"_json_pointer, 150);
        auto* mmi = reinterpret_cast<MINMAXINFO*>(l);
        mmi->ptMinTrackSize = { mw, mh };
        return 0;
    }
    }
    return DefWindowProcW(h, m, w, l);
}

// ================================================================
//  Entry point
// ================================================================

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE, LPWSTR, int ns) {
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // Parse --dev <url>
    int argc;
    auto argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    for (int i = 1; i + 1 < argc; i++) {
        if (wcscmp(argv[i], L"--dev") == 0) { g_devUrl = argv[i + 1]; break; }
    }
    LocalFree(argv);

    // Load config
    g_cfg = loadConfig(exe_dir());
    auto winCfg    = g_cfg.value("window", json::object());

    // Single instance lock
    bool singleInstance = winCfg.value("singleInstance", true);
    HANDLE hMutex = nullptr;
    if (singleInstance) {
        auto mutexName = U2W("QQ_" + winCfg.value("title", std::string{"app"}));
        hMutex = CreateMutexW(nullptr, FALSE, mutexName.c_str());
        if (GetLastError() == ERROR_ALREADY_EXISTS) {
            HWND existing = FindWindowW(L"QQ", nullptr);
            if (existing) {
                ShowWindow(existing, SW_SHOW);
                SetForegroundWindow(existing);
            }
            if (hMutex) CloseHandle(hMutex);
            CoUninitialize();
            return 0;
        }
    }
    auto title     = U2W(winCfg.value("title", std::string{"\xe5\xbc\xba\xe5\xbc\xba"}));
    int  width     = winCfg.value("width", 1024);
    int  height    = winCfg.value("height", 768);
    g_frameless    = winCfg.value("frameless", false);
    g_titleBarH    = winCfg.value("titleBarHeight", g_frameless ? 40 : 0);
    g_borderSize   = winCfg.value("borderSize", 6);
    auto bgHex     = winCfg.value("backgroundColor", std::string{"#1a1a2e"});
    COLORREF bgClr = parseHexColor(bgHex);

    // Window class
    WNDCLASSEXW wc{sizeof(wc)};
    wc.lpfnWndProc   = WndProc;
    wc.hInstance      = hi;
    wc.lpszClassName  = L"QQ";
    wc.hCursor        = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground  = CreateSolidBrush(bgClr);
    // Try custom icon from resource, fallback to default
    wc.hIcon   = LoadIconW(hi, L"IDI_APP");
    wc.hIconSm = LoadIconW(hi, L"IDI_APP");
    if (!wc.hIcon) {
        wc.hIcon   = LoadIconW(nullptr, IDI_APPLICATION);
        wc.hIconSm = LoadIconW(nullptr, IDI_APPLICATION);
    }
    RegisterClassExW(&wc);

    DWORD style = g_frameless
        ? (WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_POPUP | WS_CLIPCHILDREN)
        : (WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN);

    g_hwnd = CreateWindowExW(0, L"QQ", title.c_str(),
        style,
        CW_USEDEFAULT, CW_USEDEFAULT, width, height,
        nullptr, nullptr, hi, nullptr);

    // Window state persistence — restore previous position/size
    g_stateFile = exe_dir() + L"\\data\\window-state.json";
    fspath::create_directories(exe_dir() + L"\\data");
    auto prevState = loadWindowState();
    if (!prevState.empty()) {
        int sx = prevState.value("x", 0);
        int sy = prevState.value("y", 0);
        int sw = prevState.value("w", width);
        int sh = prevState.value("h", height);
        SetWindowPos(g_hwnd, nullptr, sx, sy, sw, sh, SWP_NOZORDER);
        if (prevState.value("maximized", false))
            ns = SW_MAXIMIZE;
    }

    // DWM attributes for frameless
    if (g_frameless) {
        // Windows 11: remove DWM-drawn 1px border
        // DWMWA_BORDER_COLOR = 34, DWMWA_COLOR_NONE = 0xFFFFFFFE
        COLORREF clrNone = 0xFFFFFFFE;
        DwmSetWindowAttribute(g_hwnd, 34, &clrNone, sizeof(clrNone));

        // Dark mode DWM rendering
        // DWMWA_USE_IMMERSIVE_DARK_MODE = 20
        BOOL darkMode = TRUE;
        DwmSetWindowAttribute(g_hwnd, 20, &darkMode, sizeof(darkMode));

        // Set DWM caption color to match background (Win11)
        // DWMWA_CAPTION_COLOR = 35
        DwmSetWindowAttribute(g_hwnd, 35, &bgClr, sizeof(bgClr));

        // Extend frame into client area for shadow effect
        MARGINS m = {0, 0, 0, 1};
        DwmExtendFrameIntoClientArea(g_hwnd, &m);

        // Save background brush for WM_ERASEBKGND / WM_PAINT
        g_bgBrush = CreateSolidBrush(bgClr);
    }

    // Enable file drag-drop
    DragAcceptFiles(g_hwnd, TRUE);

    ShowWindow(g_hwnd, ns);

    // Register all commands
    reg_window();
    reg_dialog();
    reg_fs();
    reg_clipboard();
    reg_shell_app();
    reg_tray();
    reg_env();
    reg_hotkey();
    reg_notification();
    reg_menu();
    reg_http();
    reg_os();
    reg_watcher();
    reg_state();
    reg_devtools();
    reg_registry();
    reg_protocol();
    reg_log();

    // Show splash while WebView2 loads
    showSplash(hi, width, height);

    init_webview();

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (hMutex) CloseHandle(hMutex);
    CoUninitialize();
    return (int)msg.wParam;
}
