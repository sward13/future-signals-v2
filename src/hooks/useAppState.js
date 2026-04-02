/**
 * useAppState — single source of truth for all app state.
 * Returns state object and action dispatchers.
 */
import { useState, useCallback, useRef } from "react";
import { DEFAULT_SEEDED_INPUTS, SAMPLE_PROJECTS, SAMPLE_CLUSTERS, SAMPLE_SCENARIOS, SAMPLE_CANVAS_NODES, SAMPLE_RELATIONSHIPS } from "../data/seeds.js";

function uuid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function seedConnections(scenarios) {
  const conns = [];
  for (const sc of scenarios) {
    for (const clusterId of (sc.cluster_ids || [])) {
      conns.push({ id: `conn-${sc.id}-${clusterId}`, clusterId, scenarioId: sc.id, relationshipType: "Drives" });
    }
  }
  return conns;
}

export function useAppState() {
  const [user] = useState({
    name: "Sam",
    email: "sam@aldermanandward.com",
    level: "advanced",
    domains: ["tech", "climate", "health", "gov"],
    purpose: "strategy",
  });

  const [inputs, setInputs] = useState(DEFAULT_SEEDED_INPUTS);
  const [clusters, setClusters] = useState(SAMPLE_CLUSTERS);
  const [scenarios, setScenarios] = useState(SAMPLE_SCENARIOS);
  const [analyses, setAnalyses] = useState([]);
  const [nodePositions, setNodePositions] = useState({});
  const [connections, setConnections] = useState(() => seedConnections(SAMPLE_SCENARIOS));
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const [canvasNodes, setCanvasNodes] = useState(SAMPLE_CANVAS_NODES);
  const [relationships, setRelationships] = useState(SAMPLE_RELATIONSHIPS);
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inputDetailId, setInputDetailId] = useState(null);
  const [clusterDetailId, setClusterDetailId] = useState(null);
  const [scenarioDetailId, setScenarioDetailId] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const openDrawer = useCallback((type, data = {}) => {
    setDrawer({ type, data });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
  }, []);

  const openProjectModal = useCallback(() => {
    setProjectModalOpen(true);
  }, []);

  const closeProjectModal = useCallback(() => {
    setProjectModalOpen(false);
  }, []);

  /** Navigate into a specific project — sets activeProjectId and switches screen. */
  const openProject = useCallback((id) => {
    setActiveProjectId(id);
    setActiveScreen("project");
  }, []);

  const addProject = useCallback((fields) => {
    const newProject = {
      id: uuid(),
      name: fields.name,
      domain: fields.domain || "",
      question: fields.question || "",
      unit: fields.unit || "",
      geo: fields.geo || "",
      mode: fields.mode || "quick_scan",
      h1_start: fields.h1_start || "",
      h1_end: fields.h1_end || "",
      h2_start: fields.h2_start || "",
      h2_end: fields.h2_end || "",
      h3_start: fields.h3_start || "",
      h3_end: fields.h3_end || "",
      assumptions: fields.assumptions || "",
      stakeholders: fields.stakeholders || "",
      created_at: new Date().toISOString().slice(0, 10),
    };
    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  }, []);

  const updateProject = useCallback((id, fields) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...fields } : p));
  }, []);

  const addInput = useCallback((fields) => {
    const newInput = {
      id: uuid(),
      name: fields.name,
      description: fields.description || "",
      source_url: fields.source_url || "",
      subtype: fields.subtype || "signal",
      steepled: fields.steepled || [],
      strength: fields.strength || null,
      horizon: fields.horizon || null,
      project_id: fields.project_id || null,
      created_at: new Date().toISOString().slice(0, 10),
      is_seeded: false,
      source_confidence: fields.source_confidence || null,
      metadata: fields.metadata || {},
    };
    setInputs((prev) => [newInput, ...prev]);
    return newInput;
  }, []);

  const addCluster = useCallback((fields) => {
    const newCluster = {
      id: uuid(),
      name: fields.name,
      subtype: fields.subtype || "Trend",
      horizon: fields.horizon || "H1",
      likelihood: fields.likelihood || "Possible",
      description: fields.description || "",
      project_id: fields.project_id || null,
      input_ids: fields.input_ids || [],
      created_at: new Date().toISOString().slice(0, 10),
    };
    setClusters((prev) => [...prev, newCluster]);
    return newCluster;
  }, []);

  const assignInputToCluster = useCallback((inputId, clusterId) => {
    setClusters((prev) =>
      prev.map((cl) =>
        cl.id === clusterId && !cl.input_ids.includes(inputId)
          ? { ...cl, input_ids: [...cl.input_ids, inputId] }
          : cl
      )
    );
  }, []);

  const removeInputFromCluster = useCallback((inputId, clusterId) => {
    setClusters((prev) =>
      prev.map((cl) =>
        cl.id === clusterId
          ? { ...cl, input_ids: cl.input_ids.filter((id) => id !== inputId) }
          : cl
      )
    );
  }, []);

  const openInputDetail = useCallback((id) => setInputDetailId(id), []);
  const closeInputDetail = useCallback(() => setInputDetailId(null), []);
  const openClusterDetail = useCallback((id) => setClusterDetailId(id), []);
  const closeClusterDetail = useCallback(() => setClusterDetailId(null), []);
  const openScenarioDetail = useCallback((id) => setScenarioDetailId(id), []);
  const closeScenarioDetail = useCallback(() => setScenarioDetailId(null), []);

  const updateInput = useCallback((id, fields) => {
    setInputs((prev) => prev.map((inp) => inp.id === id ? { ...inp, ...fields } : inp));
  }, []);

  const updateCluster = useCallback((id, fields) => {
    setClusters((prev) => prev.map((cl) => cl.id === id ? { ...cl, ...fields } : cl));
  }, []);

  const dismissInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
  }, []);

  /** Delete an input and strip it from all cluster input_ids. */
  const deleteInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
    setClusters((prev) =>
      prev.map((cl) => ({ ...cl, input_ids: cl.input_ids.filter((iid) => iid !== id) }))
    );
  }, []);

  /** Delete a cluster and its junction rows. Inputs are preserved. */
  const deleteCluster = useCallback((id) => {
    setClusters((prev) => prev.filter((cl) => cl.id !== id));
    setScenarios((prev) =>
      prev.map((s) => ({ ...s, cluster_ids: s.cluster_ids.filter((cid) => cid !== id) }))
    );
    setConnections((prev) => prev.filter((c) => c.clusterId !== id));
    setCanvasNodes((prev) => prev.filter((n) => n.clusterId !== id));
    setRelationships((prev) => prev.filter((r) => r.fromClusterId !== id && r.toClusterId !== id));
  }, []);

  /** Delete all canvas nodes and relationships for a project (System Map reset). */
  const deleteSystemMap = useCallback((projectId) => {
    setCanvasNodes((prev) => prev.filter((n) => n.projectId !== projectId));
    setRelationships((prev) => prev.filter((r) => r.projectId !== projectId));
  }, []);

  /** Delete the analysis record for a project. */
  const deleteAnalysis = useCallback((projectId) => {
    setAnalyses((prev) => prev.filter((a) => a.project_id !== projectId));
  }, []);

  const saveInputToProject = useCallback((id, projectId) => {
    setInputs((prev) =>
      prev.map((inp) => (inp.id === id ? { ...inp, project_id: projectId } : inp))
    );
  }, []);

  const addScenario = useCallback((fields) => {
    const newScenario = {
      id: uuid(),
      name: fields.name,
      archetype: fields.archetype || "Continuation",
      horizon: fields.horizon || "H2",
      narrative: fields.narrative || "",
      cluster_ids: fields.cluster_ids || [],
      project_id: fields.project_id || null,
      created_at: new Date().toISOString().slice(0, 10),
    };
    setScenarios((prev) => [...prev, newScenario]);
    return newScenario;
  }, []);

  const updateScenario = useCallback((id, fields) => {
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, ...fields } : s));
  }, []);

  /** Create or update the single analysis record for a project. */
  const upsertAnalysis = useCallback((projectId, fields) => {
    setAnalyses((prev) => {
      const exists = prev.some((a) => a.project_id === projectId);
      if (exists) {
        return prev.map((a) => a.project_id === projectId ? { ...a, ...fields } : a);
      }
      return [...prev, { id: uuid(), project_id: projectId, ...fields }];
    });
  }, []);

  const updateNodePosition = useCallback((nodeId, pos) => {
    setNodePositions((prev) => ({ ...prev, [nodeId]: pos }));
  }, []);

  const addConnection = useCallback((fields) => {
    const exists = connectionsRef.current.some(
      (c) => c.clusterId === fields.clusterId && c.scenarioId === fields.scenarioId
    );
    if (exists) return null;
    const newConn = {
      id: uuid(),
      clusterId: fields.clusterId,
      scenarioId: fields.scenarioId,
      relationshipType: fields.relationshipType || "Drives",
    };
    setConnections((prev) => [...prev, newConn]);
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === fields.scenarioId && !s.cluster_ids.includes(fields.clusterId)
          ? { ...s, cluster_ids: [...s.cluster_ids, fields.clusterId] }
          : s
      )
    );
    return newConn;
  }, []);

  const updateConnection = useCallback((id, fields) => {
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  }, []);

  const removeConnection = useCallback((id) => {
    const conn = connectionsRef.current.find((c) => c.id === id);
    if (!conn) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === conn.scenarioId
          ? { ...s, cluster_ids: s.cluster_ids.filter((cid) => cid !== conn.clusterId) }
          : s
      )
    );
  }, []);

  const saveInputsToProject = useCallback((ids, projectId) => {
    const idSet = new Set(ids);
    setInputs((prev) =>
      prev.map((inp) => idSet.has(inp.id) ? { ...inp, project_id: projectId } : inp)
    );
  }, []);

  const addCanvasNode = useCallback((fields) => {
    const node = {
      id: uuid(),
      projectId: fields.projectId,
      clusterId: fields.clusterId,
      x: fields.x ?? 120,
      y: fields.y ?? 120,
    };
    setCanvasNodes((prev) => [...prev, node]);
    return node;
  }, []);

  const removeCanvasNode = useCallback((nodeId) => {
    setCanvasNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }, []);

  const updateCanvasNodePos = useCallback((nodeId, pos) => {
    setCanvasNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, x: pos.x, y: pos.y } : n)
    );
  }, []);

  const addRelationship = useCallback((fields) => {
    const rel = {
      id: uuid(),
      projectId: fields.projectId,
      fromClusterId: fields.fromClusterId,
      toClusterId: fields.toClusterId,
      type: fields.type || "Drives",
      evidence: fields.evidence || "",
      confidence: fields.confidence || "Medium",
      created_at: new Date().toISOString().slice(0, 10),
    };
    setRelationships((prev) => [...prev, rel]);
    return rel;
  }, []);

  const updateRelationship = useCallback((id, fields) => {
    setRelationships((prev) =>
      prev.map((r) => r.id === id ? { ...r, ...fields } : r)
    );
  }, []);

  const removeRelationship = useCallback((id) => {
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** Delete a project and all its child records. */
  const deleteProject = useCallback((id) => {
    const scenarioIdSet = new Set(scenarios.filter((s) => s.project_id === id).map((s) => s.id));
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setInputs((prev) => prev.filter((inp) => inp.project_id !== id));
    setClusters((prev) => prev.filter((cl) => cl.project_id !== id));
    setScenarios((prev) => prev.filter((s) => s.project_id !== id));
    setAnalyses((prev) => prev.filter((a) => a.project_id !== id));
    setCanvasNodes((prev) => prev.filter((n) => n.projectId !== id));
    setRelationships((prev) => prev.filter((r) => r.projectId !== id));
    setConnections((prev) => prev.filter((c) => !scenarioIdSet.has(c.scenarioId)));
  }, [scenarios]);

  return {
    user,
    inputs,
    clusters,
    scenarios,
    nodePositions,
    connections,
    projects,
    activeProjectId,
    activeScreen,
    drawer,
    toast,
    projectModalOpen,
    setActiveScreen,
    setActiveProjectId,
    openDrawer,
    closeDrawer,
    openProjectModal,
    closeProjectModal,
    openProject,
    addProject,
    updateProject,
    addInput,
    addCluster,
    assignInputToCluster,
    removeInputFromCluster,
    inputDetailId,
    clusterDetailId,
    scenarioDetailId,
    openInputDetail,
    closeInputDetail,
    openClusterDetail,
    closeClusterDetail,
    openScenarioDetail,
    closeScenarioDetail,
    updateInput,
    updateCluster,
    dismissInput,
    saveInputToProject,
    saveInputsToProject,
    analyses,
    upsertAnalysis,
    addScenario,
    updateScenario,
    updateNodePosition,
    addConnection,
    updateConnection,
    removeConnection,
    canvasNodes,
    relationships,
    addCanvasNode,
    removeCanvasNode,
    updateCanvasNodePos,
    addRelationship,
    updateRelationship,
    removeRelationship,
    deleteInput,
    deleteCluster,
    deleteSystemMap,
    deleteAnalysis,
    deleteProject,
    showToast,
  };
}
