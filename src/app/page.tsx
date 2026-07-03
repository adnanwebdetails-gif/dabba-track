"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { 
  Search, RefreshCw, Download, Edit2, Trash2, ShieldAlert, CheckCircle2, AlertTriangle, ArrowUpRight, TrendingUp, Landmark, MapPin,
  Copy, Check, Plus, Calendar, User, Clock, X, ChevronRight, FileText, Settings, LogOut, Info
} from "lucide-react";

interface Parcel {
  id: string;
  trackingNumber: string;
  customerName: string | null;
  address: string | null;
  city: string | null;
  codAmount: number | null;
  orderNo: string | null;
  courierCode: string | null;
  status: string;
  lastCheckpoint: string | null;
  eta: string | null;
  checkpointsJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  
  // Action Loading States
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkTracking, setBulkTracking] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ succeeded: number; failed: number; message: string } | null>(null);
  
  // Hydration safety for Recharts
  const [mounted, setMounted] = useState(false);

  // Advanced features states
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [newCheckpointLoc, setNewCheckpointLoc] = useState("");
  const [newCheckpointDesc, setNewCheckpointDesc] = useState("");
  const [newCheckpointStatus, setNewCheckpointStatus] = useState("in_transit");
  const [newCheckpointDate, setNewCheckpointDate] = useState("");
  const [isAddingCheckpoint, setIsAddingCheckpoint] = useState(false);

  // Authentication & Settings states
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  const [personalKeyMasked, setPersonalKeyMasked] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setSessionUser(data.user);
      setHasPersonalKey(data.user.hasApiKey);
      setPersonalKeyMasked(data.user.apiKeyMasked || "");
      
      // Load parcels
      fetchParcels();
    } catch (err) {
      router.push("/login");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Logout failed");
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingmoreApiKey: apiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update API Key");
      
      setHasPersonalKey(data.user.hasApiKey);
      setPersonalKeyMasked(data.user.apiKeyMasked || "");
      setShowSettingsModal(false);
      setApiKeyInput("");
      alert("Service Activation Key updated successfully! You have received 50 new tracking credits.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchParcels = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/parcels");
      if (!res.ok) throw new Error("Failed to fetch parcels");
      const data = await res.json();
      setParcels(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load parcels from database.");
    } finally {
      setLoading(false);
    }
  };

  // Status badge style helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "logged":
        return "bg-deep-teal/10 text-deep-teal border border-deep-teal/20";
      case "in_transit":
        return "bg-mustard/10 text-mustard border border-mustard/20 font-medium";
      case "out_for_delivery":
        return "bg-terracotta/10 text-terracotta border border-terracotta/20 font-medium";
      case "delivered":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold";
      case "rto":
        return "bg-rose-100 text-rose-800 border border-rose-200 font-semibold";
      case "exception":
        return "bg-purple-100 text-purple-800 border border-purple-200 font-semibold";
      default:
        return "bg-stone-100 text-stone-800 border border-stone-200";
    }
  };

  // Format Status for display
  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").toUpperCase();
  };

  // Handle Manual Status Override
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/parcels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      
      setParcels(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete Parcel handler
  const handleDeleteParcel = async (id: string, trackingNo: string) => {
    if (!confirm(`Are you sure you want to delete parcel ${trackingNo}?`)) return;
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/parcels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete parcel");
      setParcels(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Refresh single tracking status
  const handleRefreshStatus = async (id: string, trackingNumber: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/track/${trackingNumber}`, { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update tracking");
      }
      
      setParcels(prev => prev.map(p => p.id === id ? data : p));
    } catch (err: any) {
      alert(`Tracking Error for ${trackingNumber}: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Bulk tracking refresh
  const handleBulkRefresh = async () => {
    try {
      setBulkTracking(true);
      setBulkSummary(null);
      
      const pendingIds = parcels
        .filter(p => !["delivered", "rto"].includes(p.status))
        .map(p => p.id);
        
      if (pendingIds.length === 0) {
        alert("No in-flight parcels to refresh status.");
        setBulkTracking(false);
        return;
      }

      const res = await fetch("/api/track/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed bulk update");
      
      setBulkSummary({
        succeeded: data.succeeded,
        failed: data.failed,
        message: data.message,
      });

      // Fetch all parcels again to refresh table
      await fetchParcels();
    } catch (err: any) {
      alert("Bulk Refresh Error: " + err.message);
    } finally {
      setBulkTracking(false);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = [
      "Tracking Number", "Customer Name", "Address", "City", 
      "COD Amount", "Order No", "Courier Code", "Status", 
      "Last Checkpoint", "ETA", "Created At"
    ];
    
    const rows = parcels.map(p => [
      p.trackingNumber,
      p.customerName || "",
      p.address || "",
      p.city || "",
      p.codAmount || 0,
      p.orderNo || "",
      p.courierCode || "",
      p.status,
      p.lastCheckpoint || "",
      p.eta ? new Date(p.eta).toISOString() : "",
      new Date(p.createdAt).toISOString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DabbaTrack_Parcels_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delayed parcel checker
  const isParcelDelayed = (parcel: Parcel): boolean => {
    if (['delivered', 'rto'].includes(parcel.status)) return false;
    
    if (parcel.eta) {
      const etaDate = new Date(parcel.eta);
      const now = new Date();
      etaDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      return etaDate < now;
    }
    
    const createdDate = new Date(parcel.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 4;
  };

  const getETADisplay = (parcel: Parcel) => {
    if (parcel.status === 'delivered') {
      return { text: "Delivered", style: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (parcel.status === 'rto') {
      return { text: "Returned to Origin", style: "bg-rose-100 text-rose-800 border-rose-200" };
    }
    
    if (!parcel.eta) {
      if (isParcelDelayed(parcel)) {
        return { text: "Delayed (>4 days) 🚨", style: "bg-rose-100 text-rose-800 border border-rose-300 font-bold" };
      }
      return { text: "No ETA set", style: "bg-stone-100 text-stone-600 border border-stone-200" };
    }
    
    const etaDate = new Date(parcel.eta);
    const now = new Date();
    etaDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = etaDate.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        text: `Delayed by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} 🚨`, 
        style: "bg-rose-100 text-rose-800 border border-rose-300 font-bold" 
      };
    } else if (diffDays === 0) {
      return { 
        text: "Due Today ⚠️", 
        style: "bg-mustard/15 text-mustard border border-mustard/35 font-semibold animate-pulse" 
      };
    } else {
      return { 
        text: `${diffDays} day${diffDays > 1 ? 's' : ''} left`, 
        style: "bg-deep-teal/10 text-deep-teal border border-deep-teal/20 font-medium" 
      };
    }
  };

  // Filtered parcels list
  const filteredParcels = parcels.filter(p => {
    const matchesSearch = 
      p.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.customerName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (p.city?.toLowerCase() || "").includes(search.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesDelayed = !showDelayedOnly || isParcelDelayed(p);
    return matchesSearch && matchesStatus && matchesDelayed;
  });

  interface Checkpoint {
    date: string;
    location: string;
    description: string;
    status: string;
  }

  // Parse checkpoints or generate simulated checkpoints
  const getCheckpoints = (parcel: Parcel): Checkpoint[] => {
    if (parcel.checkpointsJson) {
      try {
        const parsed = JSON.parse(parcel.checkpointsJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
      } catch (e) {
        console.error("Error parsing checkpointsJson", e);
      }
    }

    // Generate simulated checkpoints based on status and dates
    const createdDate = new Date(parcel.createdAt);
    const city = parcel.city || "Destination";
    const list: Checkpoint[] = [
      {
        date: createdDate.toISOString(),
        location: "Surat",
        description: `Parcel logged & booked at Surat Warehouse${parcel.orderNo ? ` for Order #${parcel.orderNo}` : ''}`,
        status: "logged"
      }
    ];

    if (parcel.status === "logged") {
      return list;
    }

    // Add transit checkpoints
    const transitDate = new Date(createdDate.getTime() + 6 * 3600 * 1000); // +6 hours
    list.push({
      date: transitDate.toISOString(),
      location: "Surat Sorting Hub",
      description: "Dispatched from Surat sorting terminal, in transit",
      status: "in_transit"
    });

    if (parcel.status === "in_transit") {
      const nearDestDate = new Date(createdDate.getTime() + 18 * 3600 * 1000); // +18 hours
      list.push({
        date: nearDestDate.toISOString(),
        location: `${city} Outer Hub`,
        description: `Arrived at intermediate sorting facility near ${city}`,
        status: "in_transit"
      });
      return list;
    }

    // Out for delivery
    const destHubDate = new Date(createdDate.getTime() + 24 * 3600 * 1000);
    list.push({
      date: destHubDate.toISOString(),
      location: `${city} Delivery Branch`,
      description: `Arrived at delivery center at ${city}`,
      status: "in_transit"
    });

    const ofdDate = new Date(createdDate.getTime() + 28 * 3600 * 1000);
    list.push({
      date: ofdDate.toISOString(),
      location: `${city} Hub`,
      description: `Dispatched for delivery with agent to customer address`,
      status: "out_for_delivery"
    });

    if (parcel.status === "out_for_delivery") {
      return list;
    }

    // Delivered
    if (parcel.status === "delivered") {
      const deliveredDate = parcel.eta ? new Date(parcel.eta) : new Date(createdDate.getTime() + 32 * 3600 * 1000);
      list.push({
        date: deliveredDate.toISOString(),
        location: city,
        description: `Successfully delivered. COD Paid: ₹${parcel.codAmount || 0}.`,
        status: "delivered"
      });
      return list;
    }

    // RTO or Exception
    if (parcel.status === "rto") {
      const rtoDate = new Date(createdDate.getTime() + 36 * 3600 * 1000);
      list.push({
        date: rtoDate.toISOString(),
        location: "Surat Return Center",
        description: "Returned to Origin (RTO) - Shipment returned to sender.",
        status: "rto"
      });
    } else if (parcel.status === "exception") {
      const exceptionDate = new Date(createdDate.getTime() + 24 * 3600 * 1000);
      list.push({
        date: exceptionDate.toISOString(),
        location: `${city} Hub`,
        description: parcel.lastCheckpoint || "Delivery failed due to customer unavailable / address issue.",
        status: "exception"
      });
    }

    return list;
  };

  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getShareMessage = (parcel: Parcel, type: string, extraData?: any) => {
    const customer = parcel.customerName || "Customer";
    const awb = parcel.trackingNumber;
    const cod = parcel.codAmount !== null && parcel.codAmount > 0 ? `₹${parcel.codAmount.toLocaleString("en-IN")}` : "₹0 (Prepaid)";
    const address = parcel.address || "";
    const city = parcel.city || "";
    
    switch (type) {
      case 'logged':
        return `Hello ${customer},\n\nYour parcel (AWB: ${awb}) has been successfully booked at Surat warehouse. It will be dispatched soon. COD amount: ${cod}. Thank you for shopping with us! - Dabba Track`;
      case 'in_transit':
        const lastLoc = extraData?.location || parcel.lastCheckpoint || "Surat Hub";
        const desc = extraData?.description || "In transit to destination";
        return `Hello ${customer},\n\nYour parcel (AWB: ${awb}) is currently in transit. It has reached ${lastLoc} (${desc}). It is moving safely towards ${city}. - Dabba Track`;
      case 'out_for_delivery':
        return `Hello ${customer},\n\nYour parcel (AWB: ${awb}) is OUT FOR DELIVERY today! It will be delivered to your address: ${address}, ${city}. COD amount to pay: ${cod}. Please keep the cash ready. Our agent will call you. - Dabba Track`;
      case 'delivered':
        return `Hello ${customer},\n\nYour parcel (AWB: ${awb}) has been successfully delivered. Thank you for choosing Dabba Track! We hope to serve you again soon.`;
      case 'checkpoint':
        const cpLoc = extraData?.location || "Transit Point";
        const cpDesc = extraData?.description || "Processing at sorting center";
        return `Hello ${customer},\n\nUpdate on your parcel (AWB: ${awb}): It has reached ${cpLoc} (${cpDesc}) and is in transit. - Dabba Track`;
      default:
        return `Hello ${customer},\n\nStatus update for your parcel (AWB: ${awb}): Status is ${parcel.status.toUpperCase()}. Last checkpoint: ${parcel.lastCheckpoint || 'N/A'}. - Dabba Track`;
    }
  };

  const handleAddCheckpoint = async (parcelId: string) => {
    if (!newCheckpointLoc.trim() || !newCheckpointDesc.trim()) {
      alert("Please fill in location and description.");
      return;
    }

    try {
      setIsAddingCheckpoint(true);
      const targetParcel = parcels.find(p => p.id === parcelId);
      if (!targetParcel) return;

      const currentList = getCheckpoints(targetParcel);
      
      const newCP = {
        date: newCheckpointDate ? new Date(newCheckpointDate).toISOString() : new Date().toISOString(),
        location: newCheckpointLoc.trim(),
        description: newCheckpointDesc.trim(),
        status: newCheckpointStatus
      };

      const updatedList = [...currentList, newCP].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const updatedJson = JSON.stringify(updatedList);

      const res = await fetch(`/api/parcels/${parcelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointsJson: updatedJson,
          lastCheckpoint: `${newCP.description} (${newCP.location})`,
          status: newCheckpointStatus !== targetParcel.status ? newCheckpointStatus : undefined
        })
      });

      if (!res.ok) throw new Error("Failed to add checkpoint");
      const updatedParcel = await res.json();

      setParcels(prev => prev.map(p => p.id === parcelId ? updatedParcel : p));
      setSelectedParcel(updatedParcel);

      setNewCheckpointLoc("");
      setNewCheckpointDesc("");
      setNewCheckpointStatus("in_transit");
      setNewCheckpointDate("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsAddingCheckpoint(false);
    }
  };

  const handleResetCheckpoints = async (parcelId: string) => {
    if (!confirm("Are you sure you want to clear custom checkpoints and reset this parcel's history?")) return;
    try {
      setIsAddingCheckpoint(true);
      const res = await fetch(`/api/parcels/${parcelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointsJson: null,
          lastCheckpoint: "Logged at Surat Warehouse"
        })
      });
      if (!res.ok) throw new Error("Failed to reset checkpoints");
      const updatedParcel = await res.json();
      setParcels(prev => prev.map(p => p.id === parcelId ? updatedParcel : p));
      setSelectedParcel(updatedParcel);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsAddingCheckpoint(false);
    }
  };

  // Calculate metrics
  const totalParcels = parcels.length;
  const totalCODValue = parcels.reduce((sum, p) => sum + (p.codAmount || 0), 0);
  const deliveredCount = parcels.filter(p => p.status === "delivered").length;
  const rtoCount = parcels.filter(p => p.status === "rto").length;
  const inTransitCount = parcels.filter(p => p.status === "in_transit").length;
  const exceptionCount = parcels.filter(p => p.status === "exception").length;
  const delayedParcelsCount = parcels.filter(p => isParcelDelayed(p)).length;
  
  const successRate = totalParcels > 0 
    ? ((deliveredCount / totalParcels) * 100).toFixed(1) 
    : "0";

  // Recharts Data Prep: Last 14 Days COD Trend
  const getTrendData = () => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    const dailyCOD = last14Days.reduce((acc, date) => {
      acc[date] = { date: new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }), amount: 0 };
      return acc;
    }, {} as Record<string, { date: string; amount: number }>);

    parcels.forEach(p => {
      const pDate = p.createdAt.split("T")[0];
      if (dailyCOD[pDate]) {
        dailyCOD[pDate].amount += p.codAmount || 0;
      }
    });

    return Object.values(dailyCOD);
  };

  // Recharts Data Prep: Top Cities
  const getCityData = () => {
    const cityCOD: Record<string, number> = {};
    parcels.forEach(p => {
      const city = p.city ? p.city.trim().toUpperCase() : "UNKNOWN";
      cityCOD[city] = (cityCOD[city] || 0) + (p.codAmount || 0);
    });

    return Object.entries(cityCOD)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  };

  return (
    <div className="space-y-8">
      {/* Header and User Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-bg/60 border border-text-ink/10 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs text-text-ink/75 font-medium">Logged in as: <strong className="text-text-ink">{sessionUser?.email || "User"}</strong></span>
          </div>
          {sessionUser?.creditsLeft !== undefined && (
            <div className="flex items-center gap-1.5 bg-deep-teal/10 text-deep-teal border border-deep-teal/20 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              🔋 Credits Left: {sessionUser.creditsLeft} / 50
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-kraft-bg hover:bg-kraft-bg/85 border border-text-ink/10 text-text-ink px-3 py-1.5 rounded-md transition-all cursor-pointer"
          >
            <Settings className="h-4 w-4 text-text-ink/60" />
            <span>Settings</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-md transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Warning Notice if personal API Key is missing */}
      {!hasPersonalKey && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Service Activation Key Needed ⚠️</h4>
            <p className="text-xs mt-0.5">
              You haven't added your Service Activation Key yet. Live tracking sync won't work until you add it. 
              Click <button onClick={() => setShowSettingsModal(true)} className="font-bold underline text-amber-900 hover:text-amber-950">Settings</button> above to save your key and get 50 tracking credits.
            </p>
          </div>
        </div>
      )}

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-ink font-display">Dashboard</h1>
          <p className="text-sm text-text-ink/65">
            Real-time tracking status & COD financials overview
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBulkRefresh}
            disabled={bulkTracking || loading}
            className="flex items-center gap-1.5 bg-deep-teal hover:bg-deep-teal/90 text-card-bg font-medium px-4 py-2 rounded-md shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${bulkTracking ? "animate-spin" : ""}`} />
            <span>{bulkTracking ? "Syncing..." : "Refresh Live Status"}</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={parcels.length === 0}
            className="flex items-center gap-1.5 bg-card-bg hover:bg-stone-50 border border-text-ink/15 text-text-ink font-medium px-4 py-2 rounded-md shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Bulk Status Alert */}
      {bulkSummary && (
        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-deep-teal flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-text-ink text-sm">Bulk Sync Finished</h4>
            <p className="text-sm text-text-ink/75 mt-0.5">{bulkSummary.message}</p>
          </div>
          <button 
            onClick={() => setBulkSummary(null)}
            className="text-text-ink/40 hover:text-text-ink text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start text-text-ink/60">
            <span className="text-xs font-bold uppercase tracking-wider">Total COD Value</span>
            <Landmark className="h-4 w-4 text-terracotta" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-ink font-display">
            ₹{totalCODValue.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 flex items-center text-xs text-text-ink/50">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 mr-1" />
            <span>From all active parcels</span>
          </div>
        </div>

        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start text-text-ink/60">
            <span className="text-xs font-bold uppercase tracking-wider">Total Parcels</span>
            <ArrowUpRight className="h-4 w-4 text-deep-teal" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-ink font-display">{totalParcels}</div>
          <div className="mt-1 text-xs text-text-ink/50">Inwarded log records</div>
        </div>

        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start text-text-ink/60">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-ink font-display">{deliveredCount}</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">Successfully completed</div>
        </div>

        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start text-text-ink/60">
            <span className="text-xs font-bold uppercase tracking-wider">RTO Parcels</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-ink font-display">{rtoCount}</div>
          <div className="mt-1 text-xs text-rose-500 font-medium font-display">Returned to origin</div>
        </div>

        <div 
          onClick={() => setShowDelayedOnly(!showDelayedOnly)}
          className={`border rounded-lg p-5 shadow-sm hover:shadow-md cursor-pointer transition-all ${
            showDelayedOnly 
              ? "bg-rose-100/70 border-rose-400 ring-2 ring-rose-400/20" 
              : "bg-card-bg border-text-ink/10 hover:border-rose-300"
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Delayed Parcels</span>
            <ShieldAlert className={`h-4 w-4 ${delayedParcelsCount > 0 ? "text-rose-600 animate-bounce" : "text-rose-450"}`} />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700 font-display">
            {delayedParcelsCount}
          </div>
          <div className="mt-1 text-xs text-rose-600 font-medium">
            {showDelayedOnly ? "⚠️ Showing only delayed" : "Click to view delayed"}
          </div>
        </div>

        <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start text-text-ink/60">
            <span className="text-xs font-bold uppercase tracking-wider">Success Rate</span>
            <TrendingUp className="h-4 w-4 text-mustard" />
          </div>
          <div className="mt-2 text-2xl font-bold text-text-ink font-display">{successRate}%</div>
          <div className="mt-1 text-xs text-text-ink/50">Delivered ratio to total</div>
        </div>
      </div>

      {/* Analytics Charts */}
      {mounted && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-card-bg border border-text-ink/10 rounded-lg p-6 shadow-sm">
            <h3 className="font-display font-semibold text-lg text-text-ink mb-4 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-terracotta" />
              Daily COD Trend (Last 14 Days)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getTrendData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#241C14/10" vertical={false} />
                  <XAxis dataKey="date" stroke="#241C14" fontSize={11} tickLine={false} />
                  <YAxis stroke="#241C14" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#FFFDF8", borderColor: "#241C14/15", color: "#241C14" }}
                    formatter={(value) => [value !== undefined && value !== null ? `₹${Number(value).toLocaleString("en-IN")}` : "₹0", "COD Value"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#B4551E" 
                    strokeWidth={2.5} 
                    dot={{ fill: "#B4551E", r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Cities */}
          <div className="bg-card-bg border border-text-ink/10 rounded-lg p-6 shadow-sm">
            <h3 className="font-display font-semibold text-lg text-text-ink mb-4 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-deep-teal" />
              Top Cities by COD Value
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getCityData()} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#241C14/10" vertical={false} />
                  <XAxis dataKey="name" stroke="#241C14" fontSize={10} tickLine={false} />
                  <YAxis stroke="#241C14" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#FFFDF8", borderColor: "#241C14/15", color: "#241C14" }}
                    formatter={(value) => [value !== undefined && value !== null ? `₹${Number(value).toLocaleString("en-IN")}` : "₹0", "COD Total"]}
                  />
                  <Bar dataKey="amount" fill="#124C48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-card-bg border border-text-ink/10 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-text-ink/40" />
            <input
              type="text"
              placeholder="Search by Tracking Number, Customer Name, City..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-text-ink/15 rounded-md bg-kraft-bg/25 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta text-sm placeholder-text-ink/40"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase font-bold tracking-wider text-text-ink/60">Filter Status:</span>
            {["all", "logged", "in_transit", "out_for_delivery", "delivered", "rto", "exception"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  statusFilter === status
                    ? "bg-text-ink border-text-ink text-card-bg shadow-sm"
                    : "bg-kraft-bg/40 border-text-ink/10 text-text-ink hover:bg-kraft-bg hover:text-text-ink"
                }`}
              >
                {status.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Parcels Table */}
        <div className="overflow-x-auto rounded-md border border-text-ink/10">
          <table className="min-w-full divide-y divide-text-ink/10 text-left text-sm">
            <thead className="bg-kraft-bg/40 text-text-ink/75 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Tracking Details</th>
                <th className="px-4 py-3">Customer Details</th>
                <th className="px-4 py-3">COD Amount</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-text-ink/10 bg-card-bg">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-ink/50">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-terracotta" />
                    Fetching parcels...
                  </td>
                </tr>
              ) : filteredParcels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-ink/50 font-display">
                    No parcels found matching search or filter constraints.
                  </td>
                </tr>
              ) : (
                filteredParcels.map((parcel) => (
                  <tr 
                    key={parcel.id} 
                    className="hover:bg-kraft-bg/10 transition-colors cursor-pointer"
                    onClick={() => setSelectedParcel(parcel)}
                  >
                    {/* AWB & Order & Courier */}
                    <td className="px-4 py-3.5 space-y-1">
                      <div className="font-mono font-bold text-text-ink text-sm flex items-center gap-1.5">
                        {parcel.trackingNumber}
                        <span className="text-xxs tracking-normal font-sans font-normal text-text-ink/40 uppercase bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                          {parcel.courierCode || "N/A"}
                        </span>
                      </div>
                      <div className="text-xs text-text-ink/60 flex flex-col">
                        {parcel.orderNo && <span>Order: #{parcel.orderNo}</span>}
                        {parcel.lastCheckpoint && (
                          <span className="text-xxs italic text-terracotta truncate max-w-xs" title={parcel.lastCheckpoint}>
                            {parcel.lastCheckpoint}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="px-4 py-3.5 space-y-0.5">
                      <div className="font-medium text-text-ink">{parcel.customerName || "—"}</div>
                      <div className="text-xs text-text-ink/60">
                        {parcel.address && <span>{parcel.address}, </span>}
                        {parcel.city && <span className="font-semibold">{parcel.city}</span>}
                      </div>
                    </td>

                    {/* COD Amount */}
                    <td className="px-4 py-3.5 font-bold text-text-ink text-sm">
                      {parcel.codAmount !== null && parcel.codAmount > 0 
                        ? `₹${parcel.codAmount.toLocaleString("en-IN")}` 
                        : "₹0 (Prepaid)"
                      }
                    </td>

                    {/* ETA */}
                    <td className="px-4 py-3.5 text-xs">
                      {(() => {
                        const eta = getETADisplay(parcel);
                        return (
                          <span className={`px-2 py-1 rounded text-xxs font-semibold inline-block border ${eta.style}`}>
                            {eta.text}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Live & Override Status */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`px-2 py-0.5 text-xxs font-bold uppercase rounded-full self-start ${getStatusBadgeClass(parcel.status)}`}>
                          {formatStatus(parcel.status)}
                        </span>
                        
                        {/* Status Manual Override */}
                        <select
                          value={parcel.status}
                          disabled={updatingId === parcel.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(parcel.id, e.target.value)}
                          className="text-xs border border-text-ink/15 rounded bg-card-bg py-0.5 px-1 text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta"
                        >
                          <option value="logged">Logged</option>
                          <option value="in_transit">In Transit</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="rto">RTO</option>
                          <option value="exception">Exception</option>
                        </select>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRefreshStatus(parcel.id, parcel.trackingNumber); }}
                          disabled={updatingId === parcel.id || bulkTracking}
                          title="Refresh status from API"
                          className="p-1 rounded text-deep-teal hover:bg-deep-teal/10 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${updatingId === parcel.id ? "animate-spin" : ""}`} />
                        </button>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteParcel(parcel.id, parcel.trackingNumber); }}
                          disabled={updatingId === parcel.id || bulkTracking}
                          title="Delete parcel"
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedParcel && (
        <div 
          className="fixed inset-0 bg-text-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelectedParcel(null)}
        >
          <div 
            className="bg-card-bg border border-text-ink/15 shadow-2xl rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-text-ink/10 flex justify-between items-center bg-kraft-bg/25">
              <div>
                <span className="text-xxs font-bold uppercase tracking-wider text-terracotta">Parcel Details</span>
                <h2 className="font-display font-bold text-xl text-text-ink flex items-center gap-2">
                  {selectedParcel.trackingNumber}
                  <span className="text-xs font-sans font-normal text-text-ink/50 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded uppercase">
                    {selectedParcel.courierCode || "N/A"}
                  </span>
                </h2>
              </div>
              <button 
                onClick={() => setSelectedParcel(null)}
                className="p-1 rounded-md hover:bg-kraft-bg/60 text-text-ink/50 hover:text-text-ink transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Delay Warning Banner */}
              {isParcelDelayed(selectedParcel) && (
                <div className="bg-rose-50 border border-rose-300 rounded-lg p-4 flex items-start gap-3 text-rose-850">
                  <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">Delivery Delayed 🚨</h4>
                    <p className="text-xs mt-0.5">
                      This parcel has exceeded its expected delivery date or has been inactive for too long. Check the journey timeline below or copy the transit status message to update the customer.
                    </p>
                  </div>
                </div>
              )}
              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-text-ink/10 pb-6">
                {/* Col 1: Customer */}
                <div className="space-y-2">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-text-ink/50 flex items-center gap-1">
                    <User className="h-3 w-3" /> Customer Details
                  </h4>
                  <div className="bg-kraft-bg/15 p-3 rounded-md border border-text-ink/5 space-y-1">
                    <div className="font-semibold">{selectedParcel.customerName || "No Name"}</div>
                    <div className="text-xs text-text-ink/75">{selectedParcel.address || "No Address"}</div>
                    {selectedParcel.city && <div className="text-xs font-semibold">{selectedParcel.city}</div>}
                  </div>
                </div>

                {/* Col 2: Order & Finance */}
                <div className="space-y-2">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-text-ink/50 flex items-center gap-1">
                    <Landmark className="h-3 w-3" /> Order & COD
                  </h4>
                  <div className="bg-kraft-bg/15 p-3 rounded-md border border-text-ink/5 space-y-1">
                    <div>Order No: <span className="font-mono font-semibold">#{selectedParcel.orderNo || "—"}</span></div>
                    <div className="text-sm">
                      COD Amount: <span className="font-bold text-terracotta">₹{selectedParcel.codAmount !== null ? selectedParcel.codAmount.toLocaleString("en-IN") : "0 (Prepaid)"}</span>
                    </div>
                  </div>
                </div>

                {/* Col 3: Status & ETA */}
                <div className="space-y-2">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-text-ink/50 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Status & ETA
                  </h4>
                  <div className="bg-kraft-bg/15 p-3 rounded-md border border-text-ink/5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      Status: 
                      <span className={`px-2 py-0.5 text-xxs font-bold uppercase rounded-full ${getStatusBadgeClass(selectedParcel.status)}`}>
                        {formatStatus(selectedParcel.status)}
                      </span>
                    </div>
                    <div className="text-xs text-text-ink/75">
                      ETA: <span className="font-semibold">{selectedParcel.eta ? new Date(selectedParcel.eta).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Not Available"}</span>
                    </div>
                    <div className="text-xxs text-text-ink/50 mt-1">
                      Created: {new Date(selectedParcel.createdAt).toLocaleDateString("en-IN", { hour: "numeric", minute: "numeric", month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Messages Section */}
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-base text-text-ink">Copy Customer Status Text</h3>
                <p className="text-xs text-text-ink/65">Click any button below to copy formatted updates for WhatsApp/SMS.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyText(getShareMessage(selectedParcel, 'logged'), 'share-logged')}
                    className={`flex items-center justify-between p-2.5 rounded-md border border-text-ink/10 text-xs font-medium transition-all ${
                      copiedField === 'share-logged' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-card-bg hover:bg-stone-50 text-text-ink'
                    }`}
                  >
                    <span>1. Booking Confirmation Msg</span>
                    {copiedField === 'share-logged' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={() => handleCopyText(getShareMessage(selectedParcel, 'in_transit'), 'share-transit')}
                    className={`flex items-center justify-between p-2.5 rounded-md border border-text-ink/10 text-xs font-medium transition-all ${
                      copiedField === 'share-transit' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-card-bg hover:bg-stone-50 text-text-ink'
                    }`}
                  >
                    <span>2. In Transit Location Msg</span>
                    {copiedField === 'share-transit' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={() => handleCopyText(getShareMessage(selectedParcel, 'out_for_delivery'), 'share-ofd')}
                    className={`flex items-center justify-between p-2.5 rounded-md border text-xs font-medium transition-all ${
                      copiedField === 'share-ofd' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : selectedParcel.status === 'out_for_delivery'
                          ? 'bg-terracotta/10 text-terracotta border-terracotta/30 hover:bg-terracotta/20 animate-pulse'
                          : 'bg-card-bg hover:bg-stone-50 border-text-ink/10 text-text-ink'
                    }`}
                  >
                    <span className="font-semibold">3. Out For Delivery Msg (Today)</span>
                    {copiedField === 'share-ofd' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={() => handleCopyText(getShareMessage(selectedParcel, 'delivered'), 'share-delivered')}
                    className={`flex items-center justify-between p-2.5 rounded-md border border-text-ink/10 text-xs font-medium transition-all ${
                      copiedField === 'share-delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-card-bg hover:bg-stone-50 text-text-ink'
                    }`}
                  >
                    <span>4. Delivered Confirmation Msg</span>
                    {copiedField === 'share-delivered' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Message Preview Box */}
                <div className="bg-stone-50 rounded-md p-3 border border-text-ink/5 mt-2">
                  <div className="text-xxs font-bold uppercase tracking-wider text-text-ink/40 mb-1">Active Message Preview:</div>
                  <pre className="text-xs text-text-ink/80 font-sans whitespace-pre-wrap leading-relaxed bg-white p-2 border border-text-ink/5 rounded max-h-24 overflow-y-auto">
                    {getShareMessage(selectedParcel, selectedParcel.status)}
                  </pre>
                  <div className="mt-1 flex justify-end">
                    <button
                      onClick={() => handleCopyText(getShareMessage(selectedParcel, selectedParcel.status), 'share-preview')}
                      className="flex items-center gap-1 text-xxs font-bold text-deep-teal hover:underline"
                    >
                      {copiedField === 'share-preview' ? (
                        <>
                          <Check className="h-3 w-3" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy Active Status Msg
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Transit Journey Timeline */}
              <div className="space-y-4 pt-2 border-t border-text-ink/10">
                <div className="flex justify-between items-center">
                  <h3 className="font-display font-semibold text-base text-text-ink">Transit Journey Timeline</h3>
                  {selectedParcel.checkpointsJson && (
                    <button 
                      onClick={() => handleResetCheckpoints(selectedParcel.id)}
                      className="text-xxs text-rose-600 hover:underline font-semibold"
                    >
                      Reset Timeline
                    </button>
                  )}
                </div>

                <div className="relative pl-6 space-y-5 border-l-2 border-text-ink/15 ml-3 pt-2">
                  {getCheckpoints(selectedParcel).map((cp, idx) => (
                    <div key={idx} className="relative">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[31px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border bg-card-bg ${
                        cp.status === 'delivered' 
                          ? 'border-emerald-600 text-emerald-600'
                          : cp.status === 'out_for_delivery'
                            ? 'border-terracotta text-terracotta'
                            : 'border-deep-teal text-deep-teal'
                      }`}>
                        <span className={`h-2 w-2 rounded-full ${
                          cp.status === 'delivered'
                            ? 'bg-emerald-600'
                            : cp.status === 'out_for_delivery'
                              ? 'bg-terracotta'
                              : 'bg-deep-teal'
                        }`} />
                      </span>

                      {/* Content */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-kraft-bg/10 p-2.5 rounded border border-text-ink/5 hover:border-text-ink/15 transition-all">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-ink">{cp.location}</span>
                            <span className="text-xxs text-text-ink/40 uppercase bg-stone-100 px-1 py-0.2 rounded font-mono font-medium">
                              {cp.status}
                            </span>
                          </div>
                          <p className="text-xs text-text-ink/75">{cp.description}</p>
                          <span className="text-xxs text-text-ink/40 font-mono block">
                            {new Date(cp.date).toLocaleDateString("en-IN", { 
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" 
                            })}
                          </span>
                        </div>

                        {/* Copy details for this checkpoint */}
                        <div className="flex items-center self-end sm:self-center">
                          <button
                            onClick={() => handleCopyText(getShareMessage(selectedParcel, 'checkpoint', cp), `cp-${idx}`)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xxs font-semibold border transition-all ${
                              copiedField === `cp-${idx}` 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                : 'bg-card-bg hover:bg-stone-50 border-text-ink/10 text-text-ink'
                            }`}
                          >
                            {copiedField === `cp-${idx}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Copied Msg</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-text-ink/50" />
                                <span>Copy City Msg</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Checkpoint Form */}
              <div className="bg-kraft-bg/15 p-4 rounded-lg border border-text-ink/10 space-y-3 pt-3">
                <h4 className="font-display font-semibold text-sm text-text-ink flex items-center gap-1">
                  <Plus className="h-4 w-4 text-terracotta" /> Add Custom Transit Checkpoint
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-xxs font-bold uppercase tracking-wider text-text-ink/60 mb-1">
                      Location / City *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vadodara Sorting Center"
                      value={newCheckpointLoc}
                      onChange={(e) => setNewCheckpointLoc(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-text-ink/15 rounded bg-card-bg text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-bold uppercase tracking-wider text-text-ink/60 mb-1">
                      Status for Checkpoint
                    </label>
                    <select
                      value={newCheckpointStatus}
                      onChange={(e) => setNewCheckpointStatus(e.target.value)}
                      className="w-full px-2 py-1.5 border border-text-ink/15 rounded bg-card-bg text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta text-xs"
                    >
                      <option value="in_transit">In Transit</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="logged">Logged</option>
                      <option value="rto">RTO</option>
                      <option value="exception">Exception</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xxs font-bold uppercase tracking-wider text-text-ink/60 mb-1">
                      Checkpoint Status Update Text *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Left warehouse towards destination"
                      value={newCheckpointDesc}
                      onChange={(e) => setNewCheckpointDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-text-ink/15 rounded bg-card-bg text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-bold uppercase tracking-wider text-text-ink/60 mb-1">
                      Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newCheckpointDate}
                      onChange={(e) => setNewCheckpointDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-text-ink/15 rounded bg-card-bg text-text-ink focus:outline-none focus:ring-1 focus:ring-terracotta text-xs"
                    />
                  </div>

                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => handleAddCheckpoint(selectedParcel.id)}
                      disabled={isAddingCheckpoint}
                      className="flex items-center justify-center gap-1.5 bg-deep-teal hover:bg-deep-teal/90 text-card-bg px-4 py-2 rounded-md font-semibold text-xs transition-all disabled:opacity-50 w-full sm:w-auto shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Journey Timeline</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-text-ink/10 flex justify-end bg-kraft-bg/10">
              <button 
                onClick={() => setSelectedParcel(null)}
                className="bg-card-bg hover:bg-stone-50 border border-text-ink/15 text-text-ink font-medium px-4 py-2 rounded-md text-xs transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settings Modal Overlay */}
      {showSettingsModal && (
        <div 
          className="fixed inset-0 bg-text-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div 
            className="bg-card-bg border border-text-ink/15 shadow-2xl rounded-xl max-w-md w-full p-6 space-y-4 text-text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-text-ink/10 pb-3">
              <h3 className="font-display font-bold text-lg flex items-center gap-1.5">
                <Settings className="h-5 w-5 text-terracotta" />
                Portal Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded hover:bg-kraft-bg text-text-ink/50 hover:text-text-ink transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveApiKey} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-xxs uppercase tracking-wider text-text-ink/60">
                  Service Activation Key
                </label>
                
                {hasPersonalKey ? (
                  <div className="bg-emerald-50 text-emerald-850 border border-emerald-200 p-2.5 rounded text-xxs font-medium mb-2 flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between">
                      <span>Active Key: <strong>{personalKeyMasked}</strong></span>
                      <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[9px] uppercase font-bold">Configured</span>
                    </div>
                    {sessionUser?.creditsLeft !== undefined && (
                      <div className="text-emerald-800">
                        <strong>{sessionUser.creditsLeft}</strong> Tracking Credits Remaining
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 p-2.5 rounded text-xxs font-medium mb-2">
                    No Activation Key saved yet. Sync won't work without this.
                  </div>
                )}

                <input
                  type="password"
                  placeholder={hasPersonalKey ? "Enter new Activation Key to get 50 more credits" : "Enter your Service Activation Key"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 border border-text-ink/15 rounded-md bg-kraft-bg/25 text-text-ink text-sm focus:outline-none focus:ring-1 focus:ring-terracotta placeholder-text-ink/35"
                />
                
                <p className="text-[10px] text-text-ink/50 mt-1 leading-relaxed">
                  Your API key is stored securely in your private cloud account database and used only for sync requests from your dashboard.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-text-ink/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setApiKeyInput("");
                  }}
                  className="bg-card-bg hover:bg-stone-50 border border-text-ink/15 text-text-ink px-4 py-2 rounded-md font-semibold text-xxs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings || !apiKeyInput.trim()}
                  className="bg-terracotta hover:bg-terracotta/90 text-card-bg px-4 py-2 rounded-md font-bold text-xxs transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {savingSettings ? "Saving..." : "Save API Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
