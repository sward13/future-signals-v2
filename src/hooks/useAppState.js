/**
 * useAppState — single source of truth for all app state.
 * Returns state object and action dispatchers.
 */
import { useState, useCallback, useRef } from "react";
import { DEFAULT_SEEDED_INPUTS, SAMPLE_PROJECTS, SAMPLE_CLUSTERS, SAMPLE_SCENARIOS } from "../data/seeds.js";

function uuid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
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
  const [scenarios] = useState(SAMPLE_SCENARIOS);
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeScreen, setActiveScreen] = useState("inbox");
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inputDetailId, setInputDetailId] = useState(null);
  const [clusterDetailId, setClusterDetailId] = useState(null);
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

  const updateInput = useCallback((id, fields) => {
    setInputs((prev) => prev.map((inp) => inp.id === id ? { ...inp, ...fields } : inp));
  }, []);

  const updateCluster = useCallback((id, fields) => {
    setClusters((prev) => prev.map((cl) => cl.id === id ? { ...cl, ...fields } : cl));
  }, []);

  const dismissInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
  }, []);

  const saveInputToProject = useCallback((id, projectId) => {
    setInputs((prev) =>
      prev.map((inp) => (inp.id === id ? { ...inp, project_id: projectId } : inp))
    );
  }, []);

  const saveInputsToProject = useCallback((ids, projectId) => {
    const idSet = new Set(ids);
    setInputs((prev) =>
      prev.map((inp) => idSet.has(inp.id) ? { ...inp, project_id: projectId } : inp)
    );
  }, []);

  return {
    user,
    inputs,
    clusters,
    scenarios,
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
    addInput,
    addCluster,
    assignInputToCluster,
    removeInputFromCluster,
    inputDetailId,
    clusterDetailId,
    openInputDetail,
    closeInputDetail,
    openClusterDetail,
    closeClusterDetail,
    updateInput,
    updateCluster,
    dismissInput,
    saveInputToProject,
    saveInputsToProject,
    showToast,
  };
}
