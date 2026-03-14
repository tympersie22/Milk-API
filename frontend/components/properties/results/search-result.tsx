"use client";

import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { IconCheck, IconMap, IconShield } from "../../ui/icons";

type PropertyData = {
  id: string;
  title_number: string;
  region: string;
  district: string;
  area_name?: string | null;
  land_type: string;
  is_verified: boolean;
};

type SearchResultProps = {
  property: PropertyData;
  onSelect?: () => void;
};

export function SearchResult({ property, onSelect }: SearchResultProps) {
  return (
    <Card padding="md" className="animate-slideUp" onClick={onSelect} style={{ cursor: onSelect ? "pointer" : undefined }}>
      <div className="flex items-start gap-4">
        {/* Map icon */}
        <div style={{
          width: 48, height: 48, borderRadius: "var(--radius-md)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: property.region === "zanzibar" ? "var(--color-bg-info)" : "var(--color-bg-subtle)",
          color: property.region === "zanzibar" ? "var(--color-info)" : "var(--color-text-secondary)",
          flexShrink: 0,
        }}>
          <IconMap size={22} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium" style={{ fontSize: 15 }}>{property.title_number}</span>
            {property.is_verified && (
              <Badge variant="success"><IconShield size={10} /> Verified</Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-secondary mb-2">
            <Badge variant={property.region === "zanzibar" ? "info" : "neutral"}>
              {property.region === "zanzibar" ? "Zanzibar" : "Mainland"}
            </Badge>
            <span>{property.district}</span>
            {property.area_name && <span>{property.area_name}</span>}
          </div>

          <div className="flex items-center gap-4 text-xs text-secondary">
            <span>Land Type: <strong>{property.land_type.replace(/_/g, " ")}</strong></span>
            <span className="font-mono" style={{ opacity: 0.6 }}>ID: {property.id.slice(0, 8)}...</span>
          </div>
        </div>

        {onSelect && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--color-primary)", color: "white",
            flexShrink: 0,
          }}>
            <IconCheck size={16} />
          </div>
        )}
      </div>
    </Card>
  );
}
