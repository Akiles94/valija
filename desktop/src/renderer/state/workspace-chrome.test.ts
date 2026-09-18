import { describe, expect, it } from "vitest";
import { workspaceChrome } from "./workspace-chrome.js";
import type { WorkspaceView } from "./workspace-nav.js";

describe("workspaceChrome", () => {
  it("dashboard: sidebar shown, dashboard active, no breadcrumb", () => {
    expect(workspaceChrome({ screen: "dashboard" })).toEqual({
      sidebar: true,
      active: "dashboard",
      trail: [],
    });
  });

  it("search: sidebar shown, search active, no breadcrumb", () => {
    expect(workspaceChrome({ screen: "search" })).toEqual({
      sidebar: true,
      active: "search",
      trail: [],
    });
  });

  it("connect-tools: sidebar shown, connect-tools active, no breadcrumb", () => {
    expect(workspaceChrome({ screen: "connect-tools" })).toEqual({
      sidebar: true,
      active: "connect-tools",
      trail: [],
    });
  });

  it("sync: sidebar shown, sync active, no breadcrumb", () => {
    expect(workspaceChrome({ screen: "sync" })).toEqual({
      sidebar: true,
      active: "sync",
      trail: [],
    });
  });

  it("project: sidebar shown, no active nav entry, trail is Dashboard -> project name", () => {
    expect(workspaceChrome({ screen: "project", project: "acme" })).toEqual({
      sidebar: true,
      active: null,
      trail: [
        { label: { key: "dashboard.title" }, target: { screen: "dashboard" } },
        { label: { raw: "acme" }, target: null },
      ],
    });
  });

  it("pack-preview: sidebar shown, no active nav entry, trail is Dashboard -> project name -> Context pack", () => {
    expect(workspaceChrome({ screen: "pack-preview", project: "acme" })).toEqual({
      sidebar: true,
      active: null,
      trail: [
        { label: { key: "dashboard.title" }, target: { screen: "dashboard" } },
        { label: { raw: "acme" }, target: { screen: "project", project: "acme" } },
        { label: { key: "pack.title" }, target: null },
      ],
    });
  });

  it("import: sidebar shown, no active nav entry, trail is Dashboard -> Import", () => {
    expect(workspaceChrome({ screen: "import" })).toEqual({
      sidebar: true,
      active: null,
      trail: [
        { label: { key: "dashboard.title" }, target: { screen: "dashboard" } },
        { label: { key: "import.title" }, target: null },
      ],
    });
  });

  it("diagnostics: sidebar shown, no active nav entry, trail is Dashboard -> Diagnostics", () => {
    expect(workspaceChrome({ screen: "diagnostics" })).toEqual({
      sidebar: true,
      active: null,
      trail: [
        { label: { key: "dashboard.title" }, target: { screen: "dashboard" } },
        { label: { key: "diagnostics.title" }, target: null },
      ],
    });
  });

  it("relocate-vault: no sidebar, no active nav entry, no breadcrumb", () => {
    expect(workspaceChrome({ screen: "relocate-vault" })).toEqual({
      sidebar: false,
      active: null,
      trail: [],
    });
  });

  it("every non-final breadcrumb segment has a target; every final segment has none", () => {
    const views: WorkspaceView[] = [
      { screen: "dashboard" },
      { screen: "search" },
      { screen: "connect-tools" },
      { screen: "sync" },
      { screen: "project", project: "acme" },
      { screen: "pack-preview", project: "acme" },
      { screen: "import" },
      { screen: "diagnostics" },
      { screen: "relocate-vault" },
    ];

    for (const view of views) {
      const { trail } = workspaceChrome(view);
      trail.forEach((segment, index) => {
        const isFinal = index === trail.length - 1;
        if (isFinal) {
          expect(segment.target).toBeNull();
        } else {
          expect(segment.target).not.toBeNull();
        }
      });
    }
  });
});
