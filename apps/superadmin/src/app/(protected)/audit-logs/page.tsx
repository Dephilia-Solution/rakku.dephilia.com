"use client";

import { useEffect, useState, useCallback } from "react";
import { showToast } from "@rakku/ui";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  Calendar,
} from "lucide-react";

interface AuditLog {
  id: string;
  company_id: string | null;
  outlet_id: string | null;
  user_id: string | null;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  companies?: { name: string } | null;
  users?: { name: string } | null;
  outlets?: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [successFilter, setSuccessFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Event types for filter
  const eventTypes = [
    { value: "company_login", label: "Company Login" },
    { value: "outlet_select", label: "Outlet Select" },
    { value: "account_select", label: "Account Select" },
    { value: "pin_verify", label: "PIN Verify" },
    { value: "shift_start", label: "Shift Start" },
    { value: "shift_end", label: "Shift End" },
    { value: "switch_user", label: "Switch User" },
  ];

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin/companies");
      const data = await res.json();
      setCompanies(data);
    } catch {
      showToast("error", "Gagal memuat data companies");
    }
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyFilter !== "all") params.append("company_id", companyFilter);
      if (eventTypeFilter !== "all") params.append("event_type", eventTypeFilter);
      if (successFilter !== "all") params.append("success", successFilter);
      if (dateFrom) params.append("start_date", dateFrom);
      if (dateTo) params.append("end_date", dateTo);

      const query = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/superadmin/audit-logs${query}`);

      if (!res.ok) {
        const error = await res.json();
        console.error("[AuditLogsPage] API Error:", error);
        showToast("error", error.error || "Gagal memuat audit logs");
        setLogs([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("[AuditLogsPage] Fetch error:", err);
      showToast("error", "Gagal memuat audit logs");
      setLogs([]);
    }
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters when filter values change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, eventTypeFilter, successFilter, dateFrom, dateTo]);

  const filtered = logs.filter((log) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const matches =
        log.event_type?.toLowerCase().includes(searchLower) ||
        log.companies?.name?.toLowerCase().includes(searchLower) ||
        log.users?.name?.toLowerCase().includes(searchLower) ||
        log.ip_address?.includes(search) ||
        log.failure_reason?.toLowerCase().includes(searchLower);
      if (!matches) return false;
    }
    return true;
  });

  const formatEventName = (eventType: string) => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">
          Audit Logs
        </h1>
        <button
          onClick={fetchLogs}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Search */}
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest"
          />
        </div>

        {/* Company filter */}
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Event type filter */}
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="all">All Events</option>
          {eventTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {/* Success filter */}
        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="all">All Status</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-forest"
              placeholder="From"
            />
          </div>
          <span className="text-neutral-400 text-sm">to</span>
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-forest"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-neutral-400">No audit logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  Timestamp
                </th>
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  Event
                </th>
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  Company
                </th>
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  IP Address
                </th>
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 text-sm text-neutral-500 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-neutral-900">
                      {formatEventName(log.event_type)}
                    </span>
                    {log.failure_reason && (
                      <div className="text-xs text-danger mt-1">
                        {log.failure_reason.replace(/_/g, " ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {log.companies?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {log.users?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500 font-mono text-xs">
                    {log.ip_address ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        log.success
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {log.success ? (
                        <>
                          <ShieldCheck size={12} />
                          Success
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={12} />
                          Failed
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Result count */}
      {!loading && filtered.length > 0 && (
        <div className="mt-3 text-sm text-neutral-400">
          Showing {filtered.length} of {logs.length} logs
        </div>
      )}
    </div>
  );
}
