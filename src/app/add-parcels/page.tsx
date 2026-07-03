"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertCircle, Trash2, Save, FileText, Loader2 } from "lucide-react";

interface ExtractionItem {
  id: string;
  fileName: string;
  status: "pending" | "extracting" | "success" | "failed";
  error?: string;
  trackingNumber: string;
  customerName: string;
  address: string;
  city: string;
  codAmount: number;
  orderNo: string;
  courierCode: string;
}

export default function AddParcels() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          router.push("/login");
        }
      } catch (err) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  const handleFiles = async (files: FileList) => {
    const newItems: ExtractionItem[] = [];
    const validFiles: { id: string; file: File }[] = [];
    
    Array.from(files).forEach((file) => {
      // Basic image check
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} is not an image file.`);
        return;
      }

      const uniqueId = Math.random().toString(36).substring(2, 9);
      const item: ExtractionItem = {
        id: uniqueId,
        fileName: file.name,
        status: "pending",
        trackingNumber: "",
        customerName: "",
        address: "",
        city: "",
        codAmount: 0,
        orderNo: "",
        courierCode: "",
      };

      newItems.push(item);
      validFiles.push({ id: uniqueId, file });
    });

    // Update UI immediately with pending items
    setItems((prev) => [...prev, ...newItems]);

    // Process files sequentially to respect Gemini API rate limits (Free tier: 15 RPM)
    for (const { id, file } of validFiles) {
      await extractLabelData(id, file);
      // Wait for 4.5 seconds before sending the next request
      await new Promise((resolve) => setTimeout(resolve, 4500));
    }
  };

  // Drag and Drop events
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
      handleFiles(e.dataTransfer.files);
    }
  };

  // Perform AI extraction per file
  const extractLabelData = async (id: string, file: File) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "extracting" } : item))
    );

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      // Populate extracted values
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "success",
                trackingNumber: data.tracking_number || "",
                customerName: data.customer_name || "",
                address: data.address || "",
                city: data.city || "",
                codAmount: data.cod_amount || 0,
                orderNo: data.order_no || "",
                courierCode: data.courier ? data.courier.toLowerCase() : "",
              }
            : item
        )
      );
    } catch (err: any) {
      console.error("Extraction error:", err);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "failed", error: err.message || "Failed to parse" }
            : item
        )
      );
    }
  };

  // Update item field from review table
  const handleFieldChange = (id: string, field: keyof ExtractionItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Delete item from queue
  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Bulk save all items to Database
  const handleSaveAll = async () => {
    setSaveError(null);
    const validItems = items.filter((item) => item.status === "success");

    if (validItems.length === 0) {
      alert("No successfully extracted parcels to save.");
      return;
    }

    // Double check that all tracking numbers are filled
    const missingTracking = validItems.some((item) => !item.trackingNumber.trim());
    if (missingTracking) {
      alert("Please ensure all parcels have a Tracking Number before saving.");
      return;
    }

    try {
      setSaving(true);
      
      const payload = validItems.map((item) => ({
        trackingNumber: item.trackingNumber.trim(),
        customerName: item.customerName || null,
        address: item.address || null,
        city: item.city || null,
        codAmount: item.codAmount || 0,
        orderNo: item.orderNo || null,
        courierCode: item.courierCode || null,
        status: "logged",
      }));

      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save parcels");
      }

      // Success - Redirect to dashboard
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "An error occurred while saving. Please check for duplicate AWB numbers.");
    } finally {
      setSaving(false);
    }
  };

  const clearQueue = () => {
    if (confirm("Are you sure you want to clear the upload queue?")) {
      setItems([]);
      setSaveError(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-ink font-display">Add Parcels</h1>
        <p className="text-sm text-text-ink/65">
          Upload shipping label photos. Our AI will automatically extract tracking numbers, addresses, and financials.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-terracotta bg-terracotta/5"
            : "border-text-ink/20 bg-card-bg hover:border-terracotta/50 hover:bg-stone-50/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-kraft-bg p-4 text-terracotta">
            <UploadCloud className="h-8 w-8" />
          </div>
          <div>
            <p className="font-semibold text-text-ink">Drag and drop parcel labels here</p>
            <p className="text-xs text-text-ink/50 mt-1">or click to browse from device (JPEG, PNG)</p>
          </div>
        </div>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Bachao! Save Failed</h4>
            <p className="text-sm text-red-700/90 mt-0.5">{saveError}</p>
          </div>
        </div>
      )}

      {/* Upload Progress Queue */}
      {items.length > 0 && (
        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-text-ink/10 pb-3">
            <h2 className="font-display font-semibold text-lg text-text-ink">
              Extraction Queue ({items.length} file{items.length > 1 ? "s" : ""})
            </h2>
            
            <button
              onClick={clearQueue}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Clear Queue
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 border border-text-ink/10 rounded-md bg-kraft-bg/10"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-text-ink/50" />
                  <div>
                    <p className="font-medium text-sm text-text-ink truncate max-w-xs">{item.fileName}</p>
                    {item.status === "failed" && (
                      <p className="text-xs text-rose-600 font-medium">Error: {item.error}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.status === "extracting" && (
                    <span className="flex items-center gap-1 text-xs text-mustard font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Gemini OCR Extracting...
                    </span>
                  )}
                  {item.status === "success" && (
                    <span className="flex items-center gap-1 text-xs text-deep-teal font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Extracted Successfully
                    </span>
                  )}
                  {item.status === "failed" && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  )}

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-text-ink/40 hover:text-rose-600 rounded transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review & Edit Table */}
      {items.some((item) => item.status === "success") && (
        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-text-ink/10 pb-3">
            <h2 className="font-display font-semibold text-lg text-text-ink">Review Extracted Data</h2>
            <p className="text-xs text-text-ink/65 mt-0.5">
              Double-check details before committing. Correct any misread letters or missing fields.
            </p>
          </div>

          <div className="overflow-x-auto rounded border border-text-ink/10">
            <table className="min-w-full divide-y divide-text-ink/10 text-left text-xs">
              <thead className="bg-kraft-bg/40 text-text-ink/75 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">File Name</th>
                  <th className="px-3 py-2.5">AWB / Tracking No *</th>
                  <th className="px-3 py-2.5">Customer Name</th>
                  <th className="px-3 py-2.5">City</th>
                  <th className="px-3 py-2.5">Address</th>
                  <th className="px-3 py-2.5">COD Amount (₹)</th>
                  <th className="px-3 py-2.5">Order No</th>
                  <th className="px-3 py-2.5">Courier Code</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-text-ink/10">
                {items
                  .filter((item) => item.status === "success")
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-kraft-bg/10">
                      <td className="px-3 py-2.5 font-medium max-w-xxs truncate text-text-ink/60" title={item.fileName}>
                        {item.fileName}
                      </td>
                      
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          required
                          value={item.trackingNumber}
                          onChange={(e) => handleFieldChange(item.id, "trackingNumber", e.target.value)}
                          className="w-28 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.customerName}
                          onChange={(e) => handleFieldChange(item.id, "customerName", e.target.value)}
                          className="w-28 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.city}
                          onChange={(e) => handleFieldChange(item.id, "city", e.target.value)}
                          className="w-20 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.address}
                          onChange={(e) => handleFieldChange(item.id, "address", e.target.value)}
                          className="w-40 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={item.codAmount}
                          onChange={(e) => handleFieldChange(item.id, "codAmount", parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink font-bold focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.orderNo}
                          onChange={(e) => handleFieldChange(item.id, "orderNo", e.target.value)}
                          className="w-20 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.courierCode}
                          placeholder="e.g. ekart, delhivery"
                          onChange={(e) => handleFieldChange(item.id, "courierCode", e.target.value.toLowerCase())}
                          className="w-24 px-2 py-1 border border-text-ink/15 rounded bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta"
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 bg-terracotta hover:bg-terracotta/90 text-card-bg font-medium px-5 py-2.5 rounded-md shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving to DB...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save All Parcels</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
