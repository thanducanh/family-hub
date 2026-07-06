"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type DbHealthStatus = "checking" | "online" | "offline";
type RetryStatus = "idle" | "checking" | "failed";
type DbHealthContextValue = {
  status: DbHealthStatus;
  offline: boolean;
  cacheOnly: boolean;
  lastCheckedAt: string | null;
  checkNow: () => Promise<boolean>;
  showNotice: () => void;
};

const DbHealthContext = createContext<DbHealthContextValue | null>(null);
const HEALTH_URL = "/api/health/db";
const OFFLINE_TITLE = "Mất kết nối cơ sở dữ liệu";
const OFFLINE_BODY = "Dữ liệu hiện chỉ có thể xem. Thêm, sửa, xóa sẽ tạm khóa cho đến khi kết nối lại.";
const CACHE_MESSAGE = "Đang xem dữ liệu đã lưu lần cuối";
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CACHEABLE_PATHS = new Set(["/api/members", "/api/tasks", "/api/transactions", "/api/events", "/api/notes"]);
const WRITE_LABEL_PATTERN = /(thêm|sửa|xóa|xoá|lưu|thanh toán|tạo mới|đồng bộ|reset|import|nạp|áp dụng|cập nhật|trích xuất)/i;

function requestMethod(init?: RequestInit) {
  return String(init?.method || "GET").toUpperCase();
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function requestPath(url: string) {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split("?")[0] || url;
  }
}

function cacheKey(url: string) {
  const parsed = new URL(url, window.location.origin);
  return `family-hub:readonly-cache:${parsed.pathname}${parsed.search}`;
}

function isApiWrite(url: string, method: string) {
  const path = requestPath(url);
  return path.startsWith("/api/") && path !== HEALTH_URL && WRITE_METHODS.has(method);
}

function isCacheableGet(url: string, method: string) {
  return method === "GET" && CACHEABLE_PATHS.has(requestPath(url));
}

function cachedResponse(url: string) {
  try {
    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const cached = JSON.parse(raw) as { body: string; status: number; headers?: Record<string, string>; savedAt: string };
    window.dispatchEvent(new CustomEvent("family-hub:db-cache-used", { detail: { savedAt: cached.savedAt } }));
    return new Response(cached.body, {
      status: cached.status || 200,
      headers: {
        "Content-Type": cached.headers?.["content-type"] || cached.headers?.["Content-Type"] || "application/json",
        "X-FamilyHub-Cache": "readonly",
        "X-FamilyHub-Cache-Saved-At": cached.savedAt,
      },
    });
  } catch {
    return null;
  }
}

async function saveCache(url: string, response: Response) {
  try {
    const clone = response.clone();
    const body = await clone.text();
    if (!body) return;
    localStorage.setItem(cacheKey(url), JSON.stringify({
      body,
      status: clone.status,
      headers: { "content-type": clone.headers.get("content-type") || "application/json" },
      savedAt: new Date().toISOString(),
    }));
  } catch {}
}

function offlineWriteResponse() {
  return new Response(JSON.stringify({
    ok: false,
    code: "DATABASE_OFFLINE",
    message: "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.",
  }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

function DbConnectionNotice({
  cacheOnly,
  retryStatus,
  onRetry,
  onClose,
}: {
  cacheOnly: boolean;
  retryStatus: RetryStatus;
  onRetry: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="db-connection-notice" role="alert" aria-live="polite">
      <div className="db-connection-notice__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3.5 21 19H3L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 8.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 16.8h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="db-connection-notice__content">
        <strong>{OFFLINE_TITLE}</strong>
        <p>{OFFLINE_BODY}</p>
        {cacheOnly && <span>{CACHE_MESSAGE}</span>}
        {retryStatus === "failed" && <span>Chưa kết nối lại được</span>}
      </div>
      <div className="db-connection-notice__actions">
        <button type="button" className="db-connection-notice__primary" onClick={() => void onRetry()} disabled={retryStatus === "checking"}>
          {retryStatus === "checking" ? "Đang thử..." : "Thử lại"}
        </button>
        <button type="button" className="db-connection-notice__secondary" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}

export function DbHealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DbHealthStatus>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [cacheOnly, setCacheOnly] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [retryStatus, setRetryStatus] = useState<RetryStatus>("idle");
  const statusRef = useRef(status);

  useEffect(() => { statusRef.current = status; }, [status]);

  const checkNow = useMemo(() => async () => {
    try {
      const response = await fetch(HEALTH_URL, { cache: "no-store" });
      const online = response.ok;
      setStatus(online ? "online" : "offline");
      if (online) {
        setCacheOnly(false);
        setNoticeOpen(false);
        setRetryStatus("idle");
      } else {
        setNoticeOpen(true);
      }
      return online;
    } catch {
      setStatus("offline");
      setNoticeOpen(true);
      return false;
    } finally {
      setLastCheckedAt(new Date().toISOString());
    }
  }, []);

  const retry = useMemo(() => async () => {
    setRetryStatus("checking");
    const online = await checkNow();
    setRetryStatus(online ? "idle" : "failed");
  }, [checkNow]);

  const showNotice = useMemo(() => () => {
    if (statusRef.current === "offline") setNoticeOpen(true);
  }, []);

  useEffect(() => {
    void checkNow();
    const timer = window.setInterval(() => void checkNow(), 12000);
    return () => window.clearInterval(timer);
  }, [checkNow]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(init);
      if (statusRef.current === "offline" && isApiWrite(url, method)) {
        setNoticeOpen(true);
        return offlineWriteResponse();
      }
      try {
        const response = await originalFetch(input, init);
        if (isCacheableGet(url, method) && response.ok) void saveCache(url, response);
        if (isCacheableGet(url, method) && !response.ok && statusRef.current === "offline") {
          const cached = cachedResponse(url);
          if (cached) {
            setCacheOnly(true);
            setNoticeOpen(true);
            return cached;
          }
        }
        return response;
      } catch (error) {
        if (isCacheableGet(url, method)) {
          const cached = cachedResponse(url);
          if (cached) {
            setStatus("offline");
            setCacheOnly(true);
            setNoticeOpen(true);
            return cached;
          }
        }
        throw error;
      }
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  useEffect(() => {
    const cacheListener = () => {
      setCacheOnly(true);
      setNoticeOpen(true);
    };
    window.addEventListener("family-hub:db-cache-used", cacheListener);
    return () => window.removeEventListener("family-hub:db-cache-used", cacheListener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dbOffline = status === "offline" ? "true" : "false";
    const handleClick = (event: MouseEvent) => {
      if (statusRef.current !== "offline") return;
      const button = (event.target as Element | null)?.closest?.("button");
      if (!button) return;
      const label = (button.textContent || button.getAttribute("aria-label") || button.getAttribute("title") || "").trim();
      if (!WRITE_LABEL_PATTERN.test(label)) return;
      event.preventDefault();
      event.stopPropagation();
      setNoticeOpen(true);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [status]);

  const value = useMemo<DbHealthContextValue>(() => ({
    status,
    offline: status === "offline",
    cacheOnly,
    lastCheckedAt,
    checkNow,
    showNotice,
  }), [cacheOnly, checkNow, lastCheckedAt, showNotice, status]);

  return (
    <DbHealthContext.Provider value={value}>
      {status === "offline" && noticeOpen && (
        <DbConnectionNotice
          cacheOnly={cacheOnly}
          retryStatus={retryStatus}
          onRetry={retry}
          onClose={() => setNoticeOpen(false)}
        />
      )}
      {children}
    </DbHealthContext.Provider>
  );
}

export function useDbHealth() {
  const value = useContext(DbHealthContext);
  if (!value) throw new Error("useDbHealth must be used inside DbHealthProvider");
  return value;
}
