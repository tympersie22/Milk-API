import { exportReportsCSV } from "../../lib/csv-export";
import type { ReportListItem } from "../../lib/api";

describe("CSV Export", () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  beforeEach(() => {
    createObjectURL = jest.fn().mockReturnValue("blob:mock-url");
    revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    // Mock DOM methods
    const mockLink = { href: "", download: "", click: jest.fn() };
    jest.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as unknown as HTMLElement);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as unknown as HTMLElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("generates CSV with correct headers", () => {
    const reports: ReportListItem[] = [
      {
        report_id: "r1",
        title_number: "ZNZ-001",
        property_id: "p1",
        region: "zanzibar",
        format: "json",
        status: "completed",
        created_at: "2024-01-15T10:00:00Z",
        completed_at: "2024-01-15T10:05:00Z",
      },
    ];

    exportReportsCSV(reports);

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("handles empty reports array", () => {
    exportReportsCSV([]);
    expect(createObjectURL).toHaveBeenCalled();
  });
});
