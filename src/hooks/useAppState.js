/**
 * useAppState — single source of truth for all app state.
 * Accepts workspaceId and session from App.jsx auth layer.
 * Projects and inputs are persisted to Supabase; all other entities
 * (clusters, scenarios, canvas nodes, relationships, analyses) remain
 * in-memory for Sprint 1 and will be migrated in later sprints.
 * @param {string|null} workspaceId
 * @param {object|null} session  — Supabase auth session
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState(workspaceId = null, session = null) {

  // ── Auth-derived user ────────────────────────────────────────────────────
  const authUser = session?.user ?? null;
  const user = {
    name: authUser?.user_metadata?.full_name
       || authUser?.user_metadata?.name
       || authUser?.email?.split("@")[0]
       || "User",
    email:   authUser?.email   || "",
    level:   "advanced",
    domains: [],
    purpose: "strategy",
  };

  // ── Core data (projects + inputs from Supabase; rest in-memory) ──────────
  const [projects,  setProjects]  = useState([]);
  const [inputs,    setInputs]    = useState([]);
  const [clusters,  setClusters]  = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [analyses,  setAnalyses]  = useState([]);

  // Canvas / system map (in-memory)
  const [nodePositions,  setNodePositions]  = useState({});
  const [connections,    setConnections]    = useState([]);
  const [canvasNodes,    setCanvasNodes]    = useState([]);
  const [relationships,  setRelationships]  = useState([]);

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeProjectId,  setActiveProjectId]  = useState(null);
  const [activeScreen,     setActiveScreen]     = useState("dashboard");
  const [drawer,           setDrawer]           = useState(null);
  const [toast,            setToast]            = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inputDetailId,    setInputDetailId]    = useState(null);
  const [clusterDetailId,  setClusterDetailId]  = useState(null);
  const [scenarioDetailId, setScenarioDetailId] = useState(null);

  const toastTimer = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // ── Supabase data fetching ────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setInputs([]);
      return;
    }

    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setProjects(data);
      } catch {
        showToast("Failed to load projects", "error");
      }
    };

    const fetchInputs = async () => {
      try {
        const { data, error } = await supabase
          .from("inputs")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setInputs(data);
      } catch {
        showToast("Failed to load inputs", "error");
      }
    };

    fetchProjects();
    fetchInputs();
  }, [workspaceId, showToast]);

  // ── Drawers / modal ───────────────────────────────────────────────────────
  const openDrawer  = useCallback((type, data = {}) => setDrawer({ type, data }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openProjectModal  = useCallback(() => setProjectModalOpen(true), []);
  const closeProjectModal = useCallback(() => setProjectModalOpen(false), []);

  /** Navigate into a project — sets activeProjectId and switches screen. */
  const openProject = useCallback((id) => {
    setActiveProjectId(id);
    setActiveScreen("project");
  }, []);

  // ── Projects ──────────────────────────────────────────────────────────────

  const addProject = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const newProject = {
      id,
      workspace_id: workspaceId,
      name:         fields.name,
      domain:       fields.domain       || "",
      question:     fields.question     || "",
      unit:         fields.unit         || "",
      geo:          fields.geo          || "",
      mode:         fields.mode         || "quick_scan",
      h1_start:     fields.h1_start     || "",
      h1_end:       fields.h1_end       || "",
      h2_start:     fields.h2_start     || "",
      h2_end:       fields.h2_end       || "",
      h3_start:     fields.h3_start     || "",
      h3_end:       fields.h3_end       || "",
      assumptions:  fields.assumptions  || "",
      stakeholders: fields.stakeholders || "",
      created_at:   now,
    };

    // Optimistic local update — returns synchronously so callers can use the id immediately
    setProjects((prev) => [newProject, ...prev]);

    // Persist then refetch to sync server state
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase.from("projects").insert(newProject);
          if (error) throw error;
          // Refetch to confirm server state
          const { data, error: fetchError } = await supabase
            .from("projects")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false });
          if (fetchError) throw fetchError;
          setProjects(data);
        } catch {
          setProjects((prev) => prev.filter((p) => p.id !== id));
          showToast("Failed to save project", "error");
        }
      })();
    }

    return newProject;
  }, [workspaceId, showToast]);

  const updateProject = useCallback((id, fields) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...fields } : p));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("projects")
            .update(fields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update project", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  // ── Inputs ────────────────────────────────────────────────────────────────

  const addInput = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const newInput = {
      id,
      workspace_id:      workspaceId,
      name:              fields.name,
      description:       fields.description       || "",
      source_url:        fields.source_url        || "",
      subtype:           fields.subtype           || "signal",
      steepled:          fields.steepled          || [],
      strength:          fields.strength          || null,
      horizon:           fields.horizon           || null,
      project_id:        fields.project_id        || null,
      is_seeded:         false,
      source_confidence: fields.source_confidence || null,
      metadata:          fields.metadata          || {},
      created_at:        now,
    };

    // Optimistic local update
    setInputs((prev) => [newInput, ...prev]);

    // Persist to Supabase (fire-and-forget)
    if (workspaceId) {
      supabase.from("inputs").insert(newInput).then(({ error }) => {
        if (error) {
          setInputs((prev) => prev.filter((i) => i.id !== id));
          showToast("Failed to save input", "error");
        }
      });
    }

    return newInput;
  }, [workspaceId, showToast]);

  const updateInput = useCallback((id, fields) => {
    setInputs((prev) => prev.map((inp) => inp.id === id ? { ...inp, ...fields } : inp));
    if (workspaceId) {
      supabase.from("inputs").update(fields).eq("id", id).eq("workspace_id", workspaceId)
        .then(({ error }) => {
          if (error) showToast("Failed to update input", "error");
        });
    }
  }, [workspaceId, showToast]);

  const saveInputToProject = useCallback((id, projectId) => {
    setInputs((prev) =>
      prev.map((inp) => inp.id === id ? { ...inp, project_id: projectId } : inp)
    );
    if (workspaceId) {
      supabase.from("inputs").update({ project_id: projectId }).eq("id", id).eq("workspace_id", workspaceId)
        .then(({ error }) => {
          if (error) showToast("Failed to assign input", "error");
        });
    }
  }, [workspaceId, showToast]);

  const saveInputsToProject = useCallback((ids, projectId) => {
    const idSet = new Set(ids);
    setInputs((prev) =>
      prev.map((inp) => idSet.has(inp.id) ? { ...inp, project_id: projectId } : inp)
    );
    if (workspaceId) {
      supabase.from("inputs").update({ project_id: projectId }).in("id", ids).eq("workspace_id", workspaceId)
        .then(({ error }) => {
          if (error) showToast("Failed to assign inputs", "error");
        });
    }
  }, [workspaceId, showToast]);

  const dismissInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
  }, []);

  /** Delete an input and strip it from all cluster input_ids. */
  const deleteInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
    setClusters((prev) =>
      prev.map((cl) => ({ ...cl, input_ids: cl.input_ids.filter((iid) => iid !== id) }))
    );
    if (workspaceId) {
      supabase.from("inputs").delete().eq("id", id).eq("workspace_id", workspaceId)
        .then(({ error }) => {
          if (error) showToast("Failed to delete input", "error");
        });
    }
  }, [workspaceId, showToast]);

  // ── Clusters (in-memory for Sprint 1) ────────────────────────────────────

  const addCluster = useCallback((fields) => {
    const newCluster = {
      id:          newId(),
      name:        fields.name,
      subtype:     fields.subtype     || "Trend",
      horizon:     fields.horizon     || "H1",
      likelihood:  fields.likelihood  || "Possible",
      description: fields.description || "",
      project_id:  fields.project_id  || null,
      input_ids:   fields.input_ids   || [],
      created_at:  new Date().toISOString().slice(0, 10),
    };
    setClusters((prev) => [...prev, newCluster]);
    return newCluster;
  }, []);

  const updateCluster = useCallback((id, fields) => {
    setClusters((prev) => prev.map((cl) => cl.id === id ? { ...cl, ...fields } : cl));
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

  // ── Scenarios (in-memory for Sprint 1) ───────────────────────────────────

  const addScenario = useCallback((fields) => {
    const newScenario = {
      id:          newId(),
      name:        fields.name,
      archetype:   fields.archetype  || "Continuation",
      horizon:     fields.horizon    || "H2",
      narrative:   fields.narrative  || "",
      cluster_ids: fields.cluster_ids || [],
      project_id:  fields.project_id  || null,
      created_at:  new Date().toISOString().slice(0, 10),
    };
    setScenarios((prev) => [...prev, newScenario]);
    return newScenario;
  }, []);

  const updateScenario = useCallback((id, fields) => {
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, ...fields } : s));
  }, []);

  // ── Analyses (in-memory for Sprint 1) ────────────────────────────────────

  /** Create or update the single analysis record for a project. */
  const upsertAnalysis = useCallback((projectId, fields) => {
    setAnalyses((prev) => {
      const exists = prev.some((a) => a.project_id === projectId);
      if (exists) {
        return prev.map((a) => a.project_id === projectId ? { ...a, ...fields } : a);
      }
      return [...prev, { id: newId(), project_id: projectId, ...fields }];
    });
  }, []);

  /** Delete the analysis record for a project. */
  const deleteAnalysis = useCallback((projectId) => {
    setAnalyses((prev) => prev.filter((a) => a.project_id !== projectId));
  }, []);

  // ── Canvas / System Map (in-memory for Sprint 1) ─────────────────────────

  const updateNodePosition = useCallback((nodeId, pos) => {
    setNodePositions((prev) => ({ ...prev, [nodeId]: pos }));
  }, []);

  const addConnection = useCallback((fields) => {
    const exists = connectionsRef.current.some(
      (c) => c.clusterId === fields.clusterId && c.scenarioId === fields.scenarioId
    );
    if (exists) return null;
    const newConn = {
      id:               newId(),
      clusterId:        fields.clusterId,
      scenarioId:       fields.scenarioId,
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
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, ...fields } : c));
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

  const addCanvasNode = useCallback((fields) => {
    const node = {
      id:        newId(),
      projectId: fields.projectId,
      clusterId: fields.clusterId,
      x:         fields.x ?? 120,
      y:         fields.y ?? 120,
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
      id:            newId(),
      projectId:     fields.projectId,
      fromClusterId: fields.fromClusterId,
      toClusterId:   fields.toClusterId,
      type:          fields.type       || "Drives",
      evidence:      fields.evidence   || "",
      confidence:    fields.confidence || "Medium",
      created_at:    new Date().toISOString().slice(0, 10),
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

  /** Delete all canvas nodes and relationships for a project (System Map reset). */
  const deleteSystemMap = useCallback((projectId) => {
    setCanvasNodes((prev)    => prev.filter((n) => n.projectId    !== projectId));
    setRelationships((prev)  => prev.filter((r) => r.projectId    !== projectId));
  }, []);

  // ── Delete project (cascade) ──────────────────────────────────────────────

  const deleteProject = useCallback((id) => {
    const scenarioIdSet = new Set(scenarios.filter((s) => s.project_id === id).map((s) => s.id));
    setProjects((prev)      => prev.filter((p)   => p.id           !== id));
    setInputs((prev)        => prev.filter((inp) => inp.project_id  !== id));
    setClusters((prev)      => prev.filter((cl)  => cl.project_id   !== id));
    setScenarios((prev)     => prev.filter((s)   => s.project_id    !== id));
    setAnalyses((prev)      => prev.filter((a)   => a.project_id    !== id));
    setCanvasNodes((prev)   => prev.filter((n)   => n.projectId     !== id));
    setRelationships((prev) => prev.filter((r)   => r.projectId     !== id));
    setConnections((prev)   => prev.filter((c)   => !scenarioIdSet.has(c.scenarioId)));

    if (workspaceId) {
      (async () => {
        try {
          // Delete inputs first (FK constraint), then the project row
          const { error: inputsError } = await supabase
            .from("inputs")
            .delete()
            .eq("project_id", id)
            .eq("workspace_id", workspaceId);
          if (inputsError) throw inputsError;

          const { error: projectError } = await supabase
            .from("projects")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (projectError) throw projectError;

          // Refetch to confirm server state
          const { data, error: fetchError } = await supabase
            .from("projects")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false });
          if (fetchError) throw fetchError;
          setProjects(data);
        } catch {
          showToast("Failed to delete project", "error");
        }
      })();
    }
  }, [scenarios, workspaceId, showToast]);

  // ── Detail drawers ────────────────────────────────────────────────────────
  const openInputDetail    = useCallback((id) => setInputDetailId(id),    []);
  const closeInputDetail   = useCallback(() => setInputDetailId(null),    []);
  const openClusterDetail  = useCallback((id) => setClusterDetailId(id),  []);
  const closeClusterDetail = useCallback(() => setClusterDetailId(null),  []);
  const openScenarioDetail = useCallback((id) => setScenarioDetailId(id), []);
  const closeScenarioDetail= useCallback(() => setScenarioDetailId(null), []);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    user,
    workspaceId,
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
