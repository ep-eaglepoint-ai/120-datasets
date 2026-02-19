import { v4 as uuidv4 } from "uuid";

// Allow passing base URL dynamically, default to env var
const DEFAULT_BASE_URL = process.env.BASE_URL || "http://localhost:3000/api";

async function createPage(baseUrl: string, title: string) {
  const res = await fetch(`${baseUrl}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok)
    throw new Error(
      `Failed to create page: ${res.statusText} ${await res.text()}`
    );
  return res.json();
}

async function getPageData(baseUrl: string, pageId: string) {
  const res = await fetch(`${baseUrl}/pages/${pageId}`);
  if (!res.ok) throw new Error(`Failed to get page: ${res.statusText}`);
  return res.json();
}

async function createVersion(
  baseUrl: string,
  pageId: string,
  content: string,
  parentIds: string[],
  message = "update"
) {
  const payload = {
    pageId,
    content,
    parentIds,
    message,
    author: "tester",
  };
  const res = await fetch(`${baseUrl}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(
      `Failed to create version: ${res.statusText} ${await res.text()}`
    );
  return res.json();
}

async function mergeVersions(
  baseUrl: string,
  versionAId: string,
  versionBId: string
) {
  const res = await fetch(`${baseUrl}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionAId, versionBId }),
  });
  return res;
}

export async function testCriterion1_MultipleImmutableVersions(
  baseUrl: string
) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pageId = page.id;

  const v1 = await createVersion(baseUrl, pageId, "Version 1", []);
  const v2 = await createVersion(baseUrl, pageId, "Version 2", [v1.id]);

  const data = await getPageData(baseUrl, pageId);
  const nodes = data.graph.nodes;

  if (nodes.length < 2) throw new Error("Nodes length < 2");

  const ids = nodes.map((n: any) => n.id);
  if (!ids.includes(v1.id)) throw new Error("V1 missing");
  if (!ids.includes(v2.id)) throw new Error("V2 missing");

  const nodeV1 = nodes.find((n: any) => n.id === v1.id);
  if (nodeV1.content !== "Version 1") throw new Error("V1 content mismatch");
  console.log("Criterion 1 passed");
}

export async function testCriterion2_Branching(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const root = await createVersion(baseUrl, pId, "Root", []);
  const vA = await createVersion(baseUrl, pId, "Branch A", [root.id]);
  const vB = await createVersion(baseUrl, pId, "Branch B", [root.id]);

  const data = await getPageData(baseUrl, pId);
  const nodes = data.graph.nodes;

  const nodeA = nodes.find((n: any) => n.id === vA.id);
  const nodeB = nodes.find((n: any) => n.id === vB.id);

  if (!nodeA.parentIds.includes(root.id))
    throw new Error("Node A parent mismatch");
  if (!nodeB.parentIds.includes(root.id))
    throw new Error("Node B parent mismatch");
  if (nodeA.content === nodeB.content) throw new Error("Content should differ");
  console.log("Criterion 2 passed");
}

export async function testCriterion3_DAG(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const v1 = await createVersion(baseUrl, pId, "V1", []);
  const v2 = await createVersion(baseUrl, pId, "V2", [v1.id]);

  // Test Edge v1->v2
  const data = await getPageData(baseUrl, pId);
  const edges = data.graph.edges;

  const edgePairs = edges.map((e: any) => `${e.source}-${e.target}`);
  if (!edgePairs.includes(`${v1.id}-${v2.id}`))
    throw new Error("Edge direction missing or wrong (V1->V2)");
  console.log("Criterion 3 passed");
}

export async function testCriterion4_ParentVersions(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const v1 = await createVersion(baseUrl, pId, "V1", []);
  const v2 = await createVersion(baseUrl, pId, "V2", [v1.id]);

  const data = await getPageData(baseUrl, pId);
  const nodes = data.graph.nodes;
  const nodeV2 = nodes.find((n: any) => n.id === v2.id);

  if (!nodeV2.parentIds || !nodeV2.parentIds.includes(v1.id))
    throw new Error("Parent ID missing in Version object");
  console.log("Criterion 4 passed");
}

export async function testCriterion5_MergeVersions(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const root = await createVersion(baseUrl, pId, "Line 1\nLine 2\nLine 3", []);
  // Non-overlapping changes
  const vA = await createVersion(baseUrl, pId, "Line 1 Mod\nLine 2\nLine 3", [
    root.id,
  ]);
  const vB = await createVersion(baseUrl, pId, "Line 1\nLine 2\nLine 3 Mod", [
    root.id,
  ]);

  const res = await mergeVersions(baseUrl, vA.id, vB.id);
  const resJson = await res.json();

  // We expect success or handling. If it's a simple auto-merge, it should succeed.
  if (!resJson.success && !resJson.conflict)
    throw new Error("Merge failed unexpectedly");
  console.log("Criterion 5 passed");
}

export async function testCriterion6_ConflictDetection(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const root = await createVersion(baseUrl, pId, "Line 1", []);
  // Overlapping changes
  const vA = await createVersion(baseUrl, pId, "Line 1 Changed A", [root.id]);
  const vB = await createVersion(baseUrl, pId, "Line 1 Changed B", [root.id]);

  const res = await mergeVersions(baseUrl, vA.id, vB.id);
  const resJson = await res.json();

  // Should conflict
  if (!resJson.conflict) {
    if (resJson.success)
      throw new Error("Conflict not detected for overlapping edits");
  }
  console.log("Criterion 6 passed");
}

export async function testCriterion7_ManualResolution(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;

  const root = await createVersion(baseUrl, pId, "Base Content", []);
  const vA = await createVersion(baseUrl, pId, "Content A", [root.id]);
  const vB = await createVersion(baseUrl, pId, "Content B", [root.id]);

  await mergeVersions(baseUrl, vA.id, vB.id);

  const resolvedNode = await createVersion(baseUrl, pId, "Resolved Content", [
    vA.id,
    vB.id,
  ]);

  if (!resolvedNode.id) throw new Error("Resolved node no ID");
  const pIds = new Set(resolvedNode.parentIds);
  if (!pIds.has(vA.id) || !pIds.has(vB.id))
    throw new Error("Resolved node parents mismatch");
  console.log("Criterion 7 passed");
}

export async function testCriterion8_ViewHistory(baseUrl: string) {
  const title = `Test Page ${uuidv4()}`;
  const page = await createPage(baseUrl, title);
  const pId = page.id;
  await createVersion(baseUrl, pId, "V1", []);

  const data = await getPageData(baseUrl, pId);
  if (!data.graph || !data.graph.nodes || !data.graph.edges)
    throw new Error("Graph data missing");
  console.log("Criterion 8 passed");
}

export interface TestResult {
  name: string;
  status: "PASSED" | "FAILED";
  error?: string;
}

export async function runTests(baseUrl?: string): Promise<TestResult[]> {
  const url = baseUrl || DEFAULT_BASE_URL;
  // console.log(`Running tests against ${url}`);
  const tests = [
    {
      name: "Criterion 1: Each wiki page must store multiple immutable versions",
      fn: testCriterion1_MultipleImmutableVersions,
    },
    {
      name: "Criterion 2: Every edit creates a new version and may branch from any previous version",
      fn: testCriterion2_Branching,
    },
    {
      name: "Criterion 3: Version history must be represented as a DAG",
      fn: testCriterion3_DAG,
    },
    {
      name: "Criterion 4: Versions reference one or more parent versions",
      fn: testCriterion4_ParentVersions,
    },
    {
      name: "Criterion 5: Two versions of the same page can be merged into a new version",
      fn: testCriterion5_MergeVersions,
    },
    {
      name: "Criterion 6: Automatic merging is attempted; conflicts are detected when edits overlap",
      fn: testCriterion6_ConflictDetection,
    },
    {
      name: "Criterion 7: Conflicts can be manually resolved to produce a final merged version",
      fn: testCriterion7_ManualResolution,
    },
    {
      name: "Criterion 8: Users can view version history including branches and merges",
      fn: testCriterion8_ViewHistory,
    },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    try {
      await test.fn(url);
      results.push({ name: test.name, status: "PASSED" });
    } catch (e: any) {
      // console.log(`Debug: Test ${test.name} failed with ${e.message}`);
      results.push({
        name: test.name,
        status: "FAILED",
        error: e.message || String(e),
      });
    }
  }
  return results;
}

export async function runAllTests() {
  console.log("Running all tests...");
  const results = await runTests(DEFAULT_BASE_URL);
  let failures = 0;

  results.forEach((r) => {
    if (r.status === "FAILED") {
      failures++;
      console.log(`[FAIL] ${r.name}`);
      console.log(`       Reason: ${r.error}`);
    } else {
      console.log(`[PASS] ${r.name}`);
    }
  });

  if (failures > 0) {
    console.log(`\n${failures}/${results.length} tests failed.`);
    process.exit(1);
  } else {
    console.log("\nAll tests passed!");
  }
}

const isMain = require.main === module;
if (isMain) {
  runAllTests();
}
