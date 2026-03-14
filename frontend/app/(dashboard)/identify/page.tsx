"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, type IdentifyCandidate, type IdentifyResponse } from "../../../lib/api";
import { extractGpsFromExif, formatCoords, type GpsCoords } from "../../../lib/exif";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
  IconCamera,
  IconCrosshair,
  IconImage,
  IconLoader,
  IconMap,
  IconMapPin,
  IconSearch,
  IconShield,
  IconShieldOff,
  IconUpload,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from "../../../components/ui/icons";

type Step = "upload" | "locate" | "analyzing" | "results";

export default function IdentifyPage() {
  const { apiKey } = useAuth();

  // Flow state
  const [step, setStep] = useState<Step>("upload");

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState("");

  // Location state
  const [coords, setCoords] = useState<GpsCoords | null>(null);
  const [coordSource, setCoordSource] = useState<"exif" | "gps" | "map" | "manual" | null>(null);
  const [radius, setRadius] = useState(100);

  // Manual coordinate entry
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  // Results state
  const [results, setResults] = useState<IdentifyResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  // --- Image handling ---
  const handleImageSelect = useCallback(async (file: File) => {
    setImageFile(file);
    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Try extracting GPS from EXIF
    const gps = await extractGpsFromExif(file);
    if (gps) {
      setCoords(gps);
      setCoordSource("exif");
      setManualLat(gps.latitude.toFixed(6));
      setManualLng(gps.longitude.toFixed(6));
    }

    setStep("locate");
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageSelect(file);
    }
  }, [handleImageSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  // --- GPS from device ---
  const requestDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCoords(gps);
        setCoordSource("gps");
        setManualLat(gps.latitude.toFixed(6));
        setManualLng(gps.longitude.toFixed(6));
        setError("");
      },
      (err) => setError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  // --- Manual coordinate entry ---
  const applyManualCoords = useCallback(() => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setError("Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.");
      return;
    }
    setCoords({ latitude: lat, longitude: lng });
    setCoordSource("manual");
    setError("");
  }, [manualLat, manualLng]);

  // --- Interactive map (Leaflet) ---
  useEffect(() => {
    if (step !== "locate" || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as Record<string, any>).L as any;
    if (!L) return;

    const defaultCenter = coords
      ? [coords.latitude, coords.longitude] as [number, number]
      : [-6.792, 39.208] as [number, number]; // Dar es Salaam

    const map = L.map(mapContainerRef.current).setView(defaultCenter, coords ? 16 : 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Add click handler for pin drop
    map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng;
      setCoords({ latitude: lat, longitude: lng });
      setCoordSource("map");
      setManualLat(lat.toFixed(6));
      setManualLng(lng.toFixed(6));
      setError("");

      // Move marker
      if (markerRef.current) {
        (markerRef.current as { setLatLng: (coords: [number, number]) => void }).setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng]).addTo(map);
        markerRef.current = marker;
      }
    });

    // Place initial marker if we have coords
    if (coords) {
      const marker = L.marker([coords.latitude, coords.longitude]).addTo(map);
      markerRef.current = marker;
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Update marker when coords change from non-map sources
  useEffect(() => {
    if (!mapInstanceRef.current || !coords || coordSource === "map") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as Record<string, any>).L as any;
    if (!L) return;

    const map = mapInstanceRef.current as { setView: (c: [number, number], z: number) => void };
    map.setView([coords.latitude, coords.longitude], 16);

    if (markerRef.current) {
      (markerRef.current as { setLatLng: (c: [number, number]) => void }).setLatLng([coords.latitude, coords.longitude]);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = L.marker([coords.latitude, coords.longitude]).addTo(mapInstanceRef.current as any);
      markerRef.current = marker;
    }
  }, [coords, coordSource]);

  // --- Run identification ---
  const runIdentify = useCallback(async () => {
    if (!coords) {
      setError("Please set coordinates first");
      return;
    }
    if (!apiKey) {
      setError("You need an API key to identify properties. Generate one in Settings.");
      return;
    }

    setStep("analyzing");
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest("/property/identify", {
        method: "POST",
        apiKey,
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius_meters: radius,
          image_description: imageDescription || null,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as IdentifyResponse;
        setResults(data);
        setStep("results");
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as Record<string, unknown>)?.detail ||
          ((errData as Record<string, unknown>)?.error as Record<string, unknown>)?.message ||
          `Request failed (${res.status})`;
        setError(String(msg));
        setStep("locate");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStep("locate");
    } finally {
      setLoading(false);
    }
  }, [coords, apiKey, radius, imageDescription]);

  // --- Reset flow ---
  const resetFlow = useCallback(() => {
    setStep("upload");
    setImageFile(null);
    setImagePreview(null);
    setImageDescription("");
    setCoords(null);
    setCoordSource(null);
    setManualLat("");
    setManualLng("");
    setResults(null);
    setError("");
    setRadius(100);
    mapInstanceRef.current = null;
    markerRef.current = null;
  }, []);

  // --- Confidence color ---
  const confidenceColor = (c: number) => {
    if (c >= 0.7) return "success" as const;
    if (c >= 0.4) return "warning" as const;
    return "error" as const;
  };

  return (
    <>
      <PageHeader
        title="Identify Property"
        description="Upload a photo or drop a pin on the map to identify a property."
      />

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6">
        {(["upload", "locate", "results"] as const).map((s, i) => {
          const labels = ["Upload Photo", "Set Location", "View Results"];
          const isActive = step === s || (step === "analyzing" && s === "results");
          const isDone =
            (s === "upload" && step !== "upload") ||
            (s === "locate" && (step === "analyzing" || step === "results"));
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div style={{
                  width: 40, height: 2,
                  background: isDone ? "var(--color-primary)" : "var(--color-border)",
                }} />
              )}
              <div
                className="flex items-center gap-2 text-sm"
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  background: isActive ? "var(--color-primary)" : isDone ? "var(--color-bg-success)" : "var(--color-bg-subtle)",
                  color: isActive ? "white" : isDone ? "var(--color-text-success)" : "var(--color-text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {isDone ? <IconCheck size={14} /> : (i + 1)}
                <span>{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3 mb-4" style={{
          background: "var(--color-bg-error)",
          color: "var(--color-text-error)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-danger)",
          fontSize: 14,
        }}>
          <IconAlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* ===== STEP 1: Upload ===== */}
      {step === "upload" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Image Upload */}
          <Card padding="md">
            <h3 className="card-title flex items-center gap-2 mb-3">
              <IconCamera size={16} /> Upload a Photo
            </h3>
            <p className="text-sm text-secondary mb-4">
              Take a photo of the property, land, or plot. If your photo has GPS data (most phone cameras do),
              we'll extract the coordinates automatically.
            </p>

            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: "var(--color-bg-subtle)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            >
              <IconUpload size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <p className="font-medium mb-1">Drop image here or click to browse</p>
              <p className="text-xs text-secondary">Supports JPEG, PNG, WebP. Max 20MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
            </div>
          </Card>

          {/* Skip to map */}
          <Card padding="md">
            <h3 className="card-title flex items-center gap-2 mb-3">
              <IconMapPin size={16} /> Use Map Instead
            </h3>
            <p className="text-sm text-secondary mb-4">
              No photo? You can skip the image and locate the property directly on the map,
              use your device's GPS, or enter coordinates manually.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                icon={<IconMap size={16} />}
                onClick={() => setStep("locate")}
                style={{ width: "100%" }}
              >
                Open Map to Drop Pin
              </Button>
              <Button
                variant="outline"
                icon={<IconCrosshair size={16} />}
                onClick={() => {
                  requestDeviceGps();
                  setStep("locate");
                }}
                style={{ width: "100%" }}
              >
                Use My Current Location
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== STEP 2: Locate ===== */}
      {step === "locate" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 16 }}>
          {/* Map */}
          <Card padding="md">
            <div className="card-header mb-2">
              <h3 className="card-title flex items-center gap-2">
                <IconMap size={16} /> Click map to set location
              </h3>
              {coords && (
                <Badge variant="info">
                  <IconMapPin size={12} /> {formatCoords(coords.latitude, coords.longitude)}
                  {coordSource && ` (${coordSource})`}
                </Badge>
              )}
            </div>
            <div
              ref={mapContainerRef}
              style={{
                height: 400,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)",
              }}
            />
          </Card>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {/* Image preview */}
            {imagePreview && (
              <Card padding="sm">
                <div className="card-header mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-1">
                    <IconImage size={14} /> Your Photo
                  </h4>
                </div>
                <img
                  src={imagePreview}
                  alt="Uploaded property"
                  style={{
                    width: "100%",
                    borderRadius: "var(--radius-md)",
                    maxHeight: 180,
                    objectFit: "cover",
                  }}
                />
                {coordSource === "exif" && (
                  <div className="mt-2 p-2 text-xs" style={{
                    background: "var(--color-bg-success)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text-success)",
                  }}>
                    <IconCheck size={12} style={{ display: "inline", marginRight: 4 }} />
                    GPS extracted from photo EXIF data
                  </div>
                )}
              </Card>
            )}

            {/* Manual coordinates */}
            <Card padding="sm">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <IconCrosshair size={14} /> Coordinates
              </h4>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="text-xs text-secondary">Latitude</label>
                  <input
                    type="text"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="-6.7920"
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 8px" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-secondary">Longitude</label>
                  <input
                    type="text"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="39.2080"
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 8px" }}
                  />
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={applyManualCoords} style={{ width: "100%" }}>
                Apply Coordinates
              </Button>
            </Card>

            {/* Image description (for AI matching) */}
            <Card padding="sm">
              <h4 className="text-sm font-medium mb-2">Describe the Property (optional)</h4>
              <p className="text-xs text-secondary mb-2">
                Help the AI match better — describe what you see (e.g. "residential house with blue roof near main road").
              </p>
              <textarea
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                placeholder="e.g. Large residential plot with a concrete fence, near the market area..."
                rows={3}
                className="form-input"
                style={{ fontSize: 13, resize: "vertical" }}
              />
            </Card>

            {/* Search radius */}
            <Card padding="sm">
              <h4 className="text-sm font-medium mb-2">Search Radius</h4>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={2000}
                  step={10}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span className="text-sm font-medium" style={{ minWidth: 60 }}>
                  {radius}m
                </span>
              </div>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetFlow} style={{ flex: 1 }}>
                <IconX size={14} /> Start Over
              </Button>
              <Button
                onClick={runIdentify}
                disabled={!coords || !apiKey}
                loading={loading}
                icon={<IconSearch size={16} />}
                style={{ flex: 2 }}
              >
                Identify Property
              </Button>
            </div>

            {!apiKey && (
              <p className="text-xs text-secondary" style={{ textAlign: "center" }}>
                <IconAlertTriangle size={12} style={{ display: "inline" }} /> You need an API key.
                Go to Settings to generate one.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== STEP 3: Analyzing (loading) ===== */}
      {step === "analyzing" && (
        <Card padding="lg">
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <IconLoader size={40} style={{ margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <h3 className="font-medium mb-2">Analyzing...</h3>
            <p className="text-sm text-secondary">
              Searching for properties within {radius}m of your location.
              {imageDescription && " Using your description to refine matches."}
            </p>
          </div>
        </Card>
      )}

      {/* ===== STEP 4: Results ===== */}
      {step === "results" && results && (
        <div>
          {/* Summary */}
          <Card padding="md" className="mb-4">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <IconMapPin size={16} /> Search Results
              </h3>
              <Badge variant={results.candidates.length > 0 ? "success" : "neutral"}>
                {results.candidates.length} match{results.candidates.length !== 1 ? "es" : ""} found
              </Badge>
            </div>
            <p className="text-sm text-secondary mt-2">
              Searched {results.total_searched} properties within {results.radius_meters}m of{" "}
              {formatCoords(results.search_center.lat, results.search_center.lng)}.
            </p>
          </Card>

          {/* Candidates */}
          {results.candidates.length === 0 ? (
            <Card padding="md">
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <IconAlertTriangle size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                <h3 className="font-medium mb-2">No Properties Found</h3>
                <p className="text-sm text-secondary mb-4">
                  No registered properties were found within {radius}m of this location.
                  Try increasing the search radius or adjusting the pin.
                </p>
                <Button variant="outline" onClick={() => setStep("locate")}>
                  Adjust Location
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {results.candidates.map((candidate, index) => (
                <CandidateCard key={candidate.property_id} candidate={candidate} rank={index + 1} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <Button variant="ghost" onClick={() => setStep("locate")}>
              <IconMap size={14} /> Adjust & Retry
            </Button>
            <Button variant="outline" onClick={resetFlow}>
              <IconCamera size={14} /> New Search
            </Button>
          </div>
        </div>
      )}

      {/* Beta Notice */}
      <div className="mt-6 p-3 text-xs text-secondary" style={{
        background: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
      }}>
        <strong>Beta Feature:</strong> Property identification uses GPS coordinates and available
        property records. Accuracy depends on data coverage in the selected area. Results should
        be verified through official channels. AI image analysis will be enhanced in future updates.
      </div>
    </>
  );
}

// --- Candidate Card Component ---
function CandidateCard({ candidate, rank }: { candidate: IdentifyCandidate; rank: number }) {
  const confidenceColor = (c: number) => {
    if (c >= 0.7) return "success" as const;
    if (c >= 0.4) return "warning" as const;
    return "error" as const;
  };

  const confidencePercent = Math.round(candidate.confidence * 100);

  return (
    <Card padding="md">
      <div className="flex items-start gap-4">
        {/* Rank badge */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: rank === 1 ? "var(--color-primary)" : "var(--color-bg-subtle)",
          color: rank === 1 ? "white" : "var(--color-text-secondary)",
          fontWeight: 700, fontSize: 16, flexShrink: 0,
        }}>
          #{rank}
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{candidate.title_number}</span>
            {candidate.is_verified && (
              <Badge variant="success"><IconShield size={10} /> Verified</Badge>
            )}
            {candidate.owner_anonymous && (
              <Badge variant="neutral"><IconShieldOff size={10} /> Owner Private</Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-secondary mb-2">
            <span>{candidate.district}, {candidate.region === "zanzibar" ? "Zanzibar" : "Mainland"}</span>
            {candidate.area_name && <span>{candidate.area_name}</span>}
            <span>{candidate.land_type.replace(/_/g, " ")}</span>
          </div>

          {/* Match reasons */}
          <div className="flex flex-wrap gap-1 mb-2">
            {candidate.match_reasons.map((reason, i) => (
              <span key={i} className="text-xs" style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                background: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border)",
              }}>
                {reason}
              </span>
            ))}
          </div>
        </div>

        {/* Confidence + Distance */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <Badge variant={confidenceColor(candidate.confidence)}>
            {confidencePercent}% match
          </Badge>
          <div className="text-xs text-secondary mt-1">
            {candidate.distance_meters < 1000
              ? `${candidate.distance_meters.toFixed(0)}m away`
              : `${(candidate.distance_meters / 1000).toFixed(1)}km away`}
          </div>
          {/* Confidence bar */}
          <div style={{
            width: 80, height: 4, marginTop: 6,
            background: "var(--color-bg-subtle)",
            borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              width: `${confidencePercent}%`,
              height: "100%",
              background: candidate.confidence >= 0.7
                ? "var(--color-primary)"
                : candidate.confidence >= 0.4
                ? "var(--color-accent)"
                : "var(--color-danger)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      </div>
    </Card>
  );
}
