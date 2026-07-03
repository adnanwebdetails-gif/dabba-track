"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2, ArrowRightLeft, RefreshCw } from "lucide-react";

interface Parcel {
  id: string;
  trackingNumber: string;
  customerName: string | null;
  codAmount: number | null;
  status: string;
  city: string | null;
  createdAt: string;
}

interface FileRow {
  [key: string]: any;
}

interface MatchItem {
  dbParcel: Parcel;
  fileStatus: string;
  fileCodAmount: number;
  statusDiscrepancy: boolean;
  amountDiscrepancy: boolean;
}

interface UnloggedItem {
  trackingNumber: string;
  status: string;
  codAmount: number;
}

export default function Reconcile() {
  const router = useRouter();
  const [dbParcels, setDbParcels] = useState<Parcel[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<FileRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Mapping columns
  const [awbCol, setAwbCol] = useState<string>("");
  const [statusCol, setStatusCol] = useState<string>("");
  const [codCol, setCodCol] = useState<string>("");

  // Buckets
  const [matched, setMatched] = useState<MatchItem[]>([]);
  const [missingInFile, setMissingInFile] = useState<Parcel[]>([]);
  const [unlogged, setUnlogged] = useState<UnloggedItem[]>([]);
  const [activeTab, setActiveTab] = useState<"matched" | "missing" | "unlogged">("matched");

  // Selection & Update Actions
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        fetchDbParcels();
      } catch (err) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  const fetchDbParcels = async () => {
    try {
      setLoadingDb(true);
      const res = await fetch("/api/parcels");
      if (!res.ok) throw new Error("Failed to fetch parcels");
      const data = await res.json();
      setDbParcels(data);
    } catch (err) {
      console.error("Error loading DB parcels:", err);
    } finally {
      setLoadingDb(false);
    }
  };

  // Process uploaded sheet
  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    setApplyResult(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse rows as raw JSON containing header mapping
        const json = XLSX.utils.sheet_to_json<FileRow>(worksheet, { defval: "" });
        
        if (json.length === 0) {
          alert("The uploaded spreadsheet is empty.");
          return;
        }

        // Get headers
        const parsedHeaders = Object.keys(json[0]);
        setHeaders(parsedHeaders);
        setSheetRows(json);

        // Perform best-effort fuzzy header matching
        autoDetectColumns(parsedHeaders);
      } catch (err: any) {
        alert("Error parsing file: " + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Drag-and-Drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Header detection helper
  const autoDetectColumns = (parsedHeaders: string[]) => {
    const awbRegex = /awb|tracking|waybill|cn\s*no|consignment|lr\s*no/i;
    const statusRegex = /status|delivery|state|stage/i;
    const codRegex = /cod|amount|cash|value|collect/i;

    const matchedAwb = parsedHeaders.find(h => awbRegex.test(h)) || "";
    const matchedStatus = parsedHeaders.find(h => statusRegex.test(h)) || "";
    const matchedCod = parsedHeaders.find(h => codRegex.test(h)) || "";

    setAwbCol(matchedAwb);
    setStatusCol(matchedStatus);
    setCodCol(matchedCod);
  };

  // Reconcile when columns mapping or rows change
  useEffect(() => {
    if (sheetRows.length === 0 || !awbCol) return;

    // Index DB parcels for O(1) lookup
    const dbMap = new Map<string, Parcel>();
    dbParcels.forEach(p => {
      dbMap.set(p.trackingNumber.trim().toUpperCase(), p);
    });

    const fileAwbSet = new Set<string>();
    const tempMatched: MatchItem[] = [];
    const tempUnlogged: UnloggedItem[] = [];

    sheetRows.forEach((row) => {
      const awbVal = String(row[awbCol] || "").trim().toUpperCase();
      if (!awbVal) return;

      fileAwbSet.add(awbVal);

      // Extract status and COD from columns if mapped
      const fileRawStatus = statusCol ? String(row[statusCol] || "").trim() : "";
      const fileCodVal = codCol ? parseFloat(row[codCol]) || 0 : 0;

      // Map file status slug to internal DB status
      let fileStatusMapped = "logged";
      if (fileRawStatus) {
        const s = fileRawStatus.toLowerCase();
        if (s.includes("deliver")) fileStatusMapped = "delivered";
        else if (s.includes("rt") || s.includes("return")) fileStatusMapped = "rto";
        else if (s.includes("transit") || s.includes("route")) fileStatusMapped = "in_transit";
        else if (s.includes("out") || s.includes("delivery")) fileStatusMapped = "out_for_delivery";
        else if (s.includes("except") || s.includes("fail") || s.includes("undeliver")) fileStatusMapped = "exception";
      }

      const matchingDbParcel = dbMap.get(awbVal);

      if (matchingDbParcel) {
        const statusDiscrepancy = matchingDbParcel.status !== fileStatusMapped;
        const amountDiscrepancy = 
          matchingDbParcel.codAmount !== null && 
          Math.abs((matchingDbParcel.codAmount || 0) - fileCodVal) > 1; // permit ₹1 precision float differences

        tempMatched.push({
          dbParcel: matchingDbParcel,
          fileStatus: fileStatusMapped,
          fileCodAmount: fileCodVal,
          statusDiscrepancy,
          amountDiscrepancy
        });
      } else {
        tempUnlogged.push({
          trackingNumber: awbVal,
          status: fileStatusMapped,
          codAmount: fileCodVal
        });
      }
    });

    // DB parcels missing from file
    const tempMissing = dbParcels.filter(p => !fileAwbSet.has(p.trackingNumber.trim().toUpperCase()));

    setMatched(tempMatched);
    setUnlogged(tempUnlogged);
    setMissingInFile(tempMissing);

    // Initialize checked list for matched statuses that differ
    const initSelected: Record<string, boolean> = {};
    tempMatched.forEach(item => {
      if (item.statusDiscrepancy) {
        initSelected[item.dbParcel.id] = true;
      }
    });
    setSelectedIds(initSelected);

  }, [sheetRows, awbCol, statusCol, codCol, dbParcels]);

  // Handle select toggle
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const hasDiscrepancies = matched.filter(item => item.statusDiscrepancy);
    const allChecked = hasDiscrepancies.every(item => selectedIds[item.dbParcel.id]);
    
    const nextSelected: Record<string, boolean> = {};
    hasDiscrepancies.forEach(item => {
      nextSelected[item.dbParcel.id] = !allChecked;
    });
    setSelectedIds(nextSelected);
  };

  // Submit bulk reconciliation updates
  const handleApplyUpdates = async () => {
    const payload = Object.entries(selectedIds)
      .filter(([_, checked]) => checked)
      .map(([id]) => {
        const item = matched.find(m => m.dbParcel.id === id);
        return {
          id,
          status: item?.fileStatus || "logged"
        };
      });

    if (payload.length === 0) {
      alert("No parcels selected for status reconciliation.");
      return;
    }

    try {
      setApplying(true);
      const res = await fetch("/api/parcels/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed updates");

      setApplyResult(data.message);
      setSelectedIds({});
      // Refresh local database parcels view
      await fetchDbParcels();
    } catch (err: any) {
      alert("Reconcile Error: " + err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-ink font-display">Reconcile Statements</h1>
        <p className="text-sm text-text-ink/65">
          Upload month-end sheets (CSV/XLSX) from couriers like Delhivery or Ekart. Verify COD collections and matching statuses.
        </p>
      </div>

      {/* File Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center bg-card-bg transition-all ${
          dragActive ? "border-terracotta bg-terracotta/5" : "border-text-ink/20"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-kraft-bg p-3.5 text-deep-teal">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold text-text-ink text-sm">
              {fileName ? `File Selected: ${fileName}` : "Drag and drop courier CSV or Excel sheet"}
            </p>
            <p className="text-xs text-text-ink/50 mt-1">Accepts CSV, XLSX, XLS files</p>
          </div>
          
          <label className="bg-deep-teal hover:bg-deep-teal/90 text-card-bg font-medium px-4 py-1.5 rounded-md text-xs cursor-pointer shadow-sm transition-all">
            Browse File
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Reconcile Area */}
      {sheetRows.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          
          {/* Columns Selector Mapping */}
          <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-text-ink/10 pb-3">
              <ArrowRightLeft className="h-5 w-5 text-terracotta" />
              <h2 className="font-display font-semibold text-lg text-text-ink">Fuzzy Columns Mapping</h2>
            </div>
            
            <p className="text-xs text-text-ink/65">
              Verify which columns from the spreadsheet represent key data. If auto-detection is incorrect, choose manually.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-ink/70">Tracking Number / AWB *</label>
                <select
                  value={awbCol}
                  onChange={(e) => setAwbCol(e.target.value)}
                  className="w-full text-sm border border-text-ink/15 rounded bg-kraft-bg/25 p-2 text-text-ink focus:ring-1 focus:ring-terracotta"
                >
                  <option value="">-- Choose Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-ink/70">Delivery Status</label>
                <select
                  value={statusCol}
                  onChange={(e) => setStatusCol(e.target.value)}
                  className="w-full text-sm border border-text-ink/15 rounded bg-kraft-bg/25 p-2 text-text-ink focus:ring-1 focus:ring-terracotta"
                >
                  <option value="">-- Choose Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-ink/70">COD / Cash Amount</label>
                <select
                  value={codCol}
                  onChange={(e) => setCodCol(e.target.value)}
                  className="w-full text-sm border border-text-ink/15 rounded bg-kraft-bg/25 p-2 text-text-ink focus:ring-1 focus:ring-terracotta"
                >
                  <option value="">-- Choose Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Reconciliation Result Notification */}
          {applyResult && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold">{applyResult}</span>
            </div>
          )}

          {/* Buckets tabs container */}
          <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm space-y-4">
            
            {/* Tabs Header */}
            <div className="flex border-b border-text-ink/10 pb-1 gap-4">
              <button
                onClick={() => setActiveTab("matched")}
                className={`pb-2.5 text-sm font-semibold font-display border-b-2 transition-all ${
                  activeTab === "matched"
                    ? "border-terracotta text-terracotta"
                    : "border-transparent text-text-ink/60 hover:text-text-ink"
                }`}
              >
                Matched in both ({matched.length})
              </button>

              <button
                onClick={() => setActiveTab("missing")}
                className={`pb-2.5 text-sm font-semibold font-display border-b-2 transition-all ${
                  activeTab === "missing"
                    ? "border-terracotta text-terracotta"
                    : "border-transparent text-text-ink/60 hover:text-text-ink"
                }`}
              >
                Missing in File ({missingInFile.length})
              </button>

              <button
                onClick={() => setActiveTab("unlogged")}
                className={`pb-2.5 text-sm font-semibold font-display border-b-2 transition-all ${
                  activeTab === "unlogged"
                    ? "border-terracotta text-terracotta"
                    : "border-transparent text-text-ink/60 hover:text-text-ink"
                }`}
              >
                Unlogged AWB in File ({unlogged.length})
              </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === "matched" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-kraft-bg/10 p-3 rounded border border-text-ink/5">
                  <p className="text-xs text-text-ink/75">
                    Select parcels with status differences and apply updates. Red values indicate discrepancy.
                  </p>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={toggleSelectAll}
                      disabled={matched.filter(i => i.statusDiscrepancy).length === 0}
                      className="px-2.5 py-1 text-xs border border-text-ink/20 rounded hover:bg-stone-50 text-text-ink font-semibold"
                    >
                      Toggle All Discrepancies
                    </button>

                    <button
                      onClick={handleApplyUpdates}
                      disabled={applying || Object.values(selectedIds).filter(Boolean).length === 0}
                      className="flex items-center gap-1 bg-deep-teal hover:bg-deep-teal/90 text-card-bg px-3 py-1 text-xs font-semibold rounded shadow-sm transition-all disabled:opacity-50"
                    >
                      {applying ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Applying...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          <span>Reconcile Selected ({Object.values(selectedIds).filter(Boolean).length})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded border border-text-ink/10 text-xs">
                  <table className="min-w-full divide-y divide-text-ink/10 text-left">
                    <thead className="bg-kraft-bg/40 text-text-ink/75 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-center w-10">Reconcile</th>
                        <th className="px-3 py-2">Tracking No / AWB</th>
                        <th className="px-3 py-2">DB Status</th>
                        <th className="px-3 py-2">File Status</th>
                        <th className="px-3 py-2">DB Amount</th>
                        <th className="px-3 py-2">File Amount</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-text-ink/10 bg-card-bg">
                      {matched.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-text-ink/40">No matched parcels found.</td>
                        </tr>
                      ) : (
                        matched.map((item) => (
                          <tr key={item.dbParcel.id} className="hover:bg-kraft-bg/10">
                            <td className="px-3 py-2.5 text-center">
                              {item.statusDiscrepancy ? (
                                <input
                                  type="checkbox"
                                  checked={!!selectedIds[item.dbParcel.id]}
                                  onChange={() => toggleSelect(item.dbParcel.id)}
                                  className="h-3.5 w-3.5 rounded border-text-ink/20 focus:ring-terracotta"
                                />
                              ) : (
                                <span className="text-emerald-600 font-bold" title="Matches perfectly">✓</span>
                              )}
                            </td>
                            
                            <td className="px-3 py-2.5 font-mono font-semibold text-text-ink">
                              {item.dbParcel.trackingNumber}
                            </td>

                            <td className="px-3 py-2.5 uppercase font-medium">
                              {item.dbParcel.status}
                            </td>

                            <td className={`px-3 py-2.5 uppercase font-bold ${
                              item.statusDiscrepancy ? "text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded border border-rose-100" : "text-emerald-700"
                            }`}>
                              {item.fileStatus}
                            </td>

                            <td className="px-3 py-2.5 font-semibold">
                              ₹{(item.dbParcel.codAmount || 0).toLocaleString()}
                            </td>

                            <td className={`px-3 py-2.5 font-bold ${
                              item.amountDiscrepancy ? "text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded border border-rose-100" : "text-emerald-700"
                            }`}>
                              ₹{item.fileCodAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "missing" && (
              <div className="space-y-3">
                <p className="text-xs text-text-ink/65 italic">
                  Parcels logged inside DabbaTrack database but completely missing from the uploaded courier statement file.
                </p>

                <div className="overflow-x-auto rounded border border-text-ink/10 text-xs">
                  <table className="min-w-full divide-y divide-text-ink/10 text-left">
                    <thead className="bg-kraft-bg/40 text-text-ink/75 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Tracking No / AWB</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">City</th>
                        <th className="px-3 py-2">DB Status</th>
                        <th className="px-3 py-2">DB Amount</th>
                        <th className="px-3 py-2">Created At</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-text-ink/10 bg-card-bg">
                      {missingInFile.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-text-ink/40">No missing database parcels.</td>
                        </tr>
                      ) : (
                        missingInFile.map((p) => (
                          <tr key={p.id} className="hover:bg-kraft-bg/10">
                            <td className="px-3 py-2.5 font-mono font-semibold text-text-ink">{p.trackingNumber}</td>
                            <td className="px-3 py-2.5">{p.customerName || "—"}</td>
                            <td className="px-3 py-2.5">{p.city || "—"}</td>
                            <td className="px-3 py-2.5 uppercase font-medium">{p.status}</td>
                            <td className="px-3 py-2.5 font-semibold">₹{(p.codAmount || 0).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-text-ink/65">{new Date(p.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "unlogged" && (
              <div className="space-y-3">
                <p className="text-xs text-text-ink/65 italic flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-mustard" />
                  AWB numbers found inside the courier statement file that do NOT exist in the DabbaTrack database (Unlogged entries).
                </p>

                <div className="overflow-x-auto rounded border border-text-ink/10 text-xs">
                  <table className="min-w-full divide-y divide-text-ink/10 text-left">
                    <thead className="bg-kraft-bg/40 text-text-ink/75 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Tracking No / AWB</th>
                        <th className="px-3 py-2">File Status</th>
                        <th className="px-3 py-2">File Amount</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-text-ink/10 bg-card-bg">
                      {unlogged.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-text-ink/40">No unlogged entries.</td>
                        </tr>
                      ) : (
                        unlogged.map((item, idx) => (
                          <tr key={idx} className="hover:bg-kraft-bg/10">
                            <td className="px-3 py-2.5 font-mono font-semibold text-text-ink">{item.trackingNumber}</td>
                            <td className="px-3 py-2.5 uppercase font-medium">{item.status}</td>
                            <td className="px-3 py-2.5 font-semibold">₹{item.codAmount.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
