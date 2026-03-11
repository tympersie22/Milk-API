import { renderHook, act } from "@testing-library/react";
import { useSearchHistory } from "../../hooks/use-search-history";

describe("useSearchHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with empty history", () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toHaveLength(0);
    expect(result.current.favorites).toHaveLength(0);
  });

  it("adds a search to history", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addSearch("ZNZ-001", "zanzibar", "p1");
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].title_number).toBe("ZNZ-001");
  });

  it("deduplicates by title_number + region", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addSearch("ZNZ-001", "zanzibar");
      result.current.addSearch("ZNZ-001", "zanzibar");
    });
    expect(result.current.history).toHaveLength(1);
  });

  it("toggles favorite", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addSearch("ZNZ-001", "zanzibar");
    });
    const id = result.current.history[0].id;
    act(() => {
      result.current.toggleFavorite(id);
    });
    expect(result.current.favorites).toHaveLength(1);

    act(() => {
      result.current.toggleFavorite(id);
    });
    expect(result.current.favorites).toHaveLength(0);
  });

  it("removes item", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addSearch("ZNZ-001", "zanzibar");
    });
    const id = result.current.history[0].id;
    act(() => {
      result.current.removeItem(id);
    });
    expect(result.current.history).toHaveLength(0);
  });

  it("clears all history", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addSearch("ZNZ-001", "zanzibar");
      result.current.addSearch("TZM-002", "mainland");
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toHaveLength(0);
  });
});
