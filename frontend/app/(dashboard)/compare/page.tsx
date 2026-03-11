"use client";

import { useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, runApi, type ApiEnvelope, type Region, type RiskResponse } from "../../../lib/api";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { useToast } from "../../../components/ui/toast";
import { IconSearch, IconColumns, IconPlus, IconTrash, IconAlertTriangle, IconShield } from "../../../components/ui/icons";

type CompareProperty = {
  id: string;
  title_number: string;
  region: string;
  district?: string;
  area_name?: string;
  land_type?: string;
  is_verified?: boolean;
  risk?: RiskResponse | null;
  [key: string]: unknown;
};

type SearchSlot = {
  titleNumber: string;
  region: Region;
  property: CompareProperty | null;
  loading: boolean;
};

const emptySlot = (): SearchSlot => ({
  titleNumber: "",
  region: "mainland",
  property: null,
  loading: false,
});

export default function ComparePage() {
  const { apiKey } = useAuth();
  const { toast } = useToast();
  const [slots, setSlots] = useState<SearchSlot[]>([emptySlot(), emptySlot()]);

  const updateSlot = (idx: number, update: Partial<SearchSlot>) => {
    setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, ...update } : s)));
  };

  const searchProperty = async (idx: number) => {
    const slot = slots[idx];
    if (!apiKey) { toast("Set up an API key first.", "error"); return; }
    if (!slot.titleNumber) return;

    updateSlot(idx, { loading: true });
    const q = `/property/search?title_number=${encodeURIComponent(slot.titleNumber)}&region=${encodeURIComponent(slot.region)}`;
    const payload = await runApi(() => apiRequest(q, { apiKey }));
    if (payload && typeof payload.status === "number" && payload.status < 300) {
      const rows = ((payload.data.data as CompareProperty[]) || []);
      if (rows[0]?.id) {
        // Also fetch risk
        let risk: RiskResponse | null = null;
        try {
          const riskRes = await apiRequest(`/property/${rows[0].id}/risk`, { apiKey });
          if (riskRes.ok) risk = (await riskRes.json()) as RiskResponse;
        } catch { /* best effort */ }
        updateSlot(idx, { property: { ...rows[0], risk }, loading: false });
        toast(`Found: ${rows[0].title_number}`, "success");
        return;
      }
    }
    updateSlot(idx, { property: null, loading: false });
    toast("No property found.", "error");
  };

  const addSlot = () => {
    if (slots.length >= 3) return;
    setSlots(prev => [...prev, emptySlot()]);
  };

  const removeSlot = (idx: number) => {
    if (slots.length <= 2) return;
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const properties = slots.map(s => s.property).filter(Boolean) as CompareProperty[];

  const riskColor = (level?: string) => {
    if (level === "low") return "success" as const;
    if (level === "medium") return "warning" as const;
    if (level === "high" || level === "critical") return "error" as const;
    return "neutral" as const;
  };

  return (
    <>
      <PageHeader
        title="Compare Properties"
        description="Search and compare up to 3 properties side by side."
        actions={
          slots.length < 3 ? (
            <Button variant="secondary" size="sm" onClick={addSlot} icon={<IconPlus size={14} />}>
              Add Property
            </Button>
          ) : undefined
        }
      />

      {/* Search Slots */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${slots.length}, 1fr)`, gap: 16 }} className="mb-6">
        {slots.map((slot, idx) => (
          <Card key={idx} padding="md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Property {idx + 1}</h4>
              {slots.length > 2 && (
                <Button variant="ghost" size="sm" onClick={() => removeSlot(idx)}>
                  <IconTrash size={14} />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                value={slot.titleNumber}
                onChange={e => updateSlot(idx, { titleNumber: e.target.value })}
                placeholder="Title number..."
              />
              <select
                value={slot.region}
                onChange={e => updateSlot(idx, { region: e.target.value as Region })}
              >
                <option value="mainland">Mainland</option>
                <option value="zanzibar">Zanzibar</option>
              </select>
              <Button
                size="sm"
                onClick={() => searchProperty(idx)}
                loading={slot.loading}
                disabled={!slot.titleNumber}
                icon={<IconSearch size={14} />}
              >
                Search
              </Button>
            </div>
            {slot.property && (
              <div className="mt-3 p-3" style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                <div className="font-medium">{slot.property.title_number}</div>
                <div className="text-sm text-secondary mt-1">
                  {slot.property.district || "N/A"} &middot; {slot.property.area_name || "N/A"}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      {properties.length >= 2 ? (
        <Card padding="sm">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  {properties.map(p => (
                    <th key={p.id}>{p.title_number}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Region</td>
                  {properties.map(p => (
                    <td key={p.id}>
                      <Badge variant={p.region === "zanzibar" ? "info" : "neutral"}>
                        {p.region === "zanzibar" ? "Zanzibar" : "Mainland"}
                      </Badge>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">District</td>
                  {properties.map(p => (
                    <td key={p.id}>{(p.district as string) || "N/A"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Area</td>
                  {properties.map(p => (
                    <td key={p.id}>{(p.area_name as string) || "N/A"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Land Type</td>
                  {properties.map(p => (
                    <td key={p.id}>{(p.land_type as string) || "N/A"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Verified</td>
                  {properties.map(p => (
                    <td key={p.id}>
                      <Badge variant={p.is_verified ? "success" : "warning"}>
                        {p.is_verified ? "Yes" : "No"}
                      </Badge>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">
                    <span className="flex items-center gap-1"><IconAlertTriangle size={14} /> Risk Level</span>
                  </td>
                  {properties.map(p => (
                    <td key={p.id}>
                      {p.risk ? (
                        <Badge variant={riskColor(p.risk.risk_level)}>
                          {p.risk.risk_level.charAt(0).toUpperCase() + p.risk.risk_level.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-tertiary">N/A</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">
                    <span className="flex items-center gap-1"><IconShield size={14} /> Risk Score</span>
                  </td>
                  {properties.map(p => (
                    <td key={p.id}>
                      {p.risk ? (
                        <span className="font-mono">{p.risk.overall_score}/100</span>
                      ) : (
                        <span className="text-tertiary">N/A</span>
                      )}
                    </td>
                  ))}
                </tr>
                {/* Risk factor rows */}
                {properties.some(p => p.risk?.factors) && (
                  <>
                    <tr>
                      <td colSpan={properties.length + 1} className="font-medium" style={{ background: "var(--color-bg-subtle)" }}>
                        Risk Factor Breakdown
                      </td>
                    </tr>
                    {(() => {
                      const allFactors = new Set<string>();
                      properties.forEach(p => {
                        if (p.risk?.factors) Object.keys(p.risk.factors).forEach(f => allFactors.add(f));
                      });
                      return Array.from(allFactors).map(factor => (
                        <tr key={factor}>
                          <td className="text-sm">{factor.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</td>
                          {properties.map(p => (
                            <td key={p.id} className="font-mono text-sm">
                              {p.risk?.factors?.[factor]
                                ? `${p.risk.factors[factor].score}/100`
                                : "—"}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card padding="lg">
          <EmptyState
            icon={<IconColumns size={24} />}
            title="Search at least 2 properties"
            description="Use the search forms above to find properties, then compare them side by side."
          />
        </Card>
      )}
    </>
  );
}
