import type { ReportListItem } from "./api";
import { formatDate } from "./utils";

/**
 * Export report list to a CSV file and trigger download.
 */
export function exportReportsCSV(reports: ReportListItem[], filename = "milki-reports.csv") {
  const headers = ["Report ID", "Title Number", "Property ID", "Region", "Format", "Status", "Created", "Completed"];

  const rows = reports.map(r => [
    r.report_id,
    r.title_number,
    r.property_id,
    r.region,
    r.format,
    r.status,
    formatDate(r.created_at),
    r.completed_at ? formatDate(r.completed_at) : "",
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
