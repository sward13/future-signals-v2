/**
 * useAppState — single source of truth for all app state.
 * Accepts workspaceId and session from App.jsx auth layer.
 * Projects, inputs, clusters, scenarios, canvas nodes, and relationships
 * are all persisted to Supabase. Junction tables:
 *   cluster_inputs  → input_ids derived array on each cluster
 *   scenario_clusters → cluster_ids derived array on each scenario
 * Analyses remain in-memory.
 * @param {string|null} workspaceId
 * @param {object|null} session      — Supabase auth session
 * @param {object}      preferences  — from workspace_settings (level, domains, purpose)
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState(workspaceId = null, session = null, preferences = {}) {

  // ── Auth-derived user ────────────────────────────────────────────────────
  const authUser = session?.user ?? null;
  const user = {
    name: authUser?.user_metadata?.full_name
      || authUser?.user_metadata?.name
      || authUser?.email?.split("@")[0]
      || "User",
    email: authUser?.email || "",
    level: preferences.level || "advanced",
    domains: preferences.domains || [],
    purpose: preferences.purpose || "",
  };

  // ── Core data (projects + inputs from Supabase; rest in-memory) ──────────
  const [projects, setProjects] = useState([]);
  const [inputs, setInputs] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [preferredFutures, setPreferredFutures] = useState([]);
  const [strategicOptions, setStrategicOptions] = useState([]);
  const [analyses, setAnalyses] = useState([]);

  // Workspace settings
  const [workspaceScanningEnabled, setWorkspaceScanningEnabled] = useState(true);

  // Canvas / system map (in-memory)
  const [nodePositions, setNodePositions] = useState({});
  const [connections, setConnections] = useState([]);
  const [canvasNodes, setCanvasNodes] = useState([]);
  const [relationships, setRelationships] = useState([]);

  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeScreen, setActiveScreen] = useState(
    () => localStorage.getItem("fs_active_screen") || "dashboard"
  );
  const [activeProjectId, setActiveProjectId] = useState(
    () => localStorage.getItem("fs_active_project") || null
  );
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inputDetailId, setInputDetailId] = useState(null);
  const [clusterDetailId, setClusterDetailId] = useState(null);
  const [scenarioDetailId, setScenarioDetailId] = useState(null);
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [activePFId, setActivePFId] = useState(null);
  const [inboxProjectFilter, setInboxProjectFilter] = useState(null);

  const toastTimer = useRef(null);
  const refreshInputsRef = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // ── Persist navigation state to localStorage ──────────────────────────────

  useEffect(() => {
    if (activeScreen) localStorage.setItem("fs_active_screen", activeScreen);
    if (activeProjectId) {
      localStorage.setItem("fs_active_project", activeProjectId);
    } else {
      localStorage.removeItem("fs_active_project");
    }
  }, [activeScreen, activeProjectId]);

  // ── Guard against stale restored project IDs ──────────────────────────────

  useEffect(() => {
    if (activeProjectId && projects.length > 0) {
      const exists = projects.some((p) => p.id === activeProjectId);
      if (!exists) {
        setActiveProjectId(null);
        setActiveScreen("dashboard");
      }
    }
  }, [projects, activeProjectId]);

  // ── Supabase data fetching ────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId) {
      setProjects([]);
      setInputs([]);
      setClusters([]);
      setScenarios([]);
      setPreferredFutures([]);
      setStrategicOptions([]);
      setAnalyses([]);
      setCanvasNodes([]);
      setRelationships([]);
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

    refreshInputsRef.current = fetchInputs;

    const fetchClusters = async () => {
      try {
        const { data, error } = await supabase
          .from("clusters")
          .select(`*, cluster_inputs (input_id)`)
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped = data.map((cl) => ({
          ...cl,
          input_ids: cl.cluster_inputs.map((ci) => ci.input_id),
        }));
        setClusters(mapped);
      } catch {
        showToast("Failed to load clusters", "error");
      }
    };

    const fetchScenarios = async () => {
      try {
        const { data, error } = await supabase
          .from("scenarios")
          .select(`*, scenario_clusters (cluster_id)`)
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped = data.map((s) => ({
          ...s,
          cluster_ids: s.scenario_clusters.map((sc) => sc.cluster_id),
        }));
        setScenarios(mapped);
      } catch {
        showToast("Failed to load scenarios", "error");
      }
    };

    const fetchCanvasNodes = async () => {
      try {
        const { data, error } = await supabase
          .from("canvas_nodes")
          .select("*")
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        setCanvasNodes(data.map((n) => ({
          id: n.id,
          projectId: n.project_id,
          clusterId: n.cluster_id,
          x: n.x,
          y: n.y,
        })));
      } catch {
        showToast("Failed to load canvas nodes", "error");
      }
    };

    const fetchRelationships = async () => {
      try {
        const { data, error } = await supabase
          .from("relationships")
          .select("*")
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        setRelationships(data.map((r) => ({
          id: r.id,
          projectId: r.project_id,
          fromClusterId: r.from_cluster_id,
          toClusterId: r.to_cluster_id,
          type: r.type,
          evidence: r.evidence || "",
          confidence: r.confidence || "Medium",
          sourceHandle: r.source_handle || null,
          targetHandle: r.target_handle || null,
          created_at: r.created_at,
        })));
      } catch {
        showToast("Failed to load relationships", "error");
      }
    };

    const fetchPreferredFutures = async () => {
      try {
        const { data, error } = await supabase
          .from("preferred_futures")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setPreferredFutures(data);
      } catch {
        showToast("Failed to load preferred futures", "error");
      }
    };

    const fetchStrategicOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("strategic_options")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setStrategicOptions(data);
      } catch {
        showToast("Failed to load strategic options", "error");
      }
    };

    const fetchAnalyses = async () => {
      try {
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        setAnalyses(data);
      } catch {
        showToast("Failed to load analyses", "error");
      }
    };

    const fetchWorkspaceScanning = async () => {
      try {
        const { data } = await supabase
          .from("workspace_settings")
          .select("scanning_enabled")
          .eq("workspace_id", workspaceId)
          .single();
        if (data) setWorkspaceScanningEnabled(data.scanning_enabled ?? true);
      } catch {
        // non-fatal — default stays true
      }
    };

    fetchProjects();
    fetchInputs();
    fetchClusters();
    fetchScenarios();
    fetchPreferredFutures();
    fetchStrategicOptions();
    fetchCanvasNodes();
    fetchRelationships();
    fetchAnalyses();
    fetchWorkspaceScanning();
  }, [workspaceId, showToast]);

  // ── Drawers / modal ───────────────────────────────────────────────────────
  const openDrawer = useCallback((type, data = {}) => setDrawer({ type, data }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openProjectModal = useCallback(() => setProjectModalOpen(true), []);
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
      name: fields.name,
      domain: fields.domain || "",
      question: fields.question || "",
      geo: fields.geo || "",
      focus: fields.focus || "",
      h1_start: fields.h1_start || "",
      h1_end: fields.h1_end || "",
      h2_start: fields.h2_start || "",
      h2_end: fields.h2_end || "",
      h3_start: fields.h3_start || "",
      h3_end: fields.h3_end || "",
      assumptions: fields.assumptions || "",
      stakeholders: fields.stakeholders || "",
      audience: fields.audience || "",
      scanning_enabled: fields.scanning_enabled !== false,
      created_at: now,
    };

    // Optimistic local update — returns synchronously so callers can use the id immediately
    setProjects((prev) => [newProject, ...prev]);

    // Persist then refetch to sync server state
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase.from("projects").insert(newProject);
          if (error) throw error;
          // Trigger scorer in background — non-blocking, silent fail
          fetch('/api/trigger-score', { method: 'POST' }).catch(() => {});
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

  const updateWorkspaceScanningEnabled = useCallback((enabled) => {
    setWorkspaceScanningEnabled(enabled);
    if (workspaceId) {
      supabase
        .from("workspace_settings")
        .update({ scanning_enabled: enabled })
        .eq("workspace_id", workspaceId)
        .then(({ error }) => {
          if (error) showToast("Failed to update scanning setting", "error");
        });
    }
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
      workspace_id: workspaceId,
      name: fields.name,
      description: fields.description || "",
      source_url: fields.source_url || "",
      subtype: fields.subtype || "signal",
      steepled: fields.steepled || [],
      horizon: fields.horizon || null,
      project_id: fields.project_id || null,
      is_seeded: false,
      signal_quality: fields.signal_quality || null,
      metadata: fields.metadata || {},
      created_at: now,
    };

    // Optimistic local update
    setInputs((prev) => [newInput, ...prev]);

    // Persist to Supabase
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase.from("inputs").insert(newInput);
          if (error) throw error;
          // Generate embedding asynchronously — fire and forget
          supabase.functions.invoke("embed-input", { body: { input_id: id } }).catch(() => {});
        } catch {
          setInputs((prev) => prev.filter((i) => i.id !== id));
          showToast("Failed to save input", "error");
        }
      })();
    }

    return newInput;
  }, [workspaceId, showToast]);

  const updateInput = useCallback((id, fields) => {
    let prevSnapshot;
    setInputs((prev) => {
      prevSnapshot = prev;
      return prev.map((inp) => inp.id === id ? { ...inp, ...fields } : inp);
    });
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("inputs")
            .update(fields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
          // Re-embed if the text content changed
          if (fields.name !== undefined || fields.description !== undefined) {
            supabase.functions.invoke("embed-input", { body: { input_id: id } }).catch(() => {});
          }
        } catch {
          // Roll back optimistic update so the row stays visible
          if (prevSnapshot) setInputs(prevSnapshot);
          showToast("Failed to update input", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const saveInputToProject = useCallback((id, projectId) => {
    setInputs((prev) =>
      prev.map((inp) => inp.id === id ? { ...inp, project_id: projectId } : inp)
    );
    if (workspaceId) {
      (async () => {
        try {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("inputs")
            .update({ project_id: projectId })
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
          // Step 5: stamp last_reviewed_at on the project (fire-and-forget)
          supabase
            .from("projects")
            .update({ last_reviewed_at: now })
            .eq("id", projectId)
            .then();
        } catch {
          showToast("Failed to assign input", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const saveInputsToProject = useCallback((ids, projectId) => {
    const idSet = new Set(ids);
    setInputs((prev) =>
      prev.map((inp) => idSet.has(inp.id) ? { ...inp, project_id: projectId } : inp)
    );
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("inputs")
            .update({ project_id: projectId })
            .in("id", ids)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to assign inputs", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const dismissInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
  }, []);

  const dismissSuggestedInput = useCallback(async (input) => {
    setInputs((prev) => prev.map((i) =>
      i.id === input.id ? { ...i, metadata: { ...i.metadata, dismissed: true } } : i
    ));
    if (workspaceId) {
      try {
        const now = new Date().toISOString();
        const suggestedProjects = input.metadata?.suggested_projects || [];
        for (const sp of suggestedProjects) {
          await supabase
            .from('project_candidates')
            .update({ user_action: 'dismissed', dismissal_reason: 'not_relevant' })
            .eq('candidate_id', input.metadata.candidate_id)
            .eq('project_id', sp.id);
        }
        await supabase
          .from('inputs')
          .update({
            metadata: {
              ...input.metadata,
              dismissed: true,
              dismissed_at: now,
            },
          })
          .eq('id', input.id);
        // Step 5: stamp last_reviewed_at on all suggested projects (fire-and-forget)
        if (suggestedProjects.length > 0) {
          supabase
            .from('projects')
            .update({ last_reviewed_at: now })
            .in('id', suggestedProjects.map((sp) => sp.id))
            .then();
        }
      } catch {
        showToast('Failed to dismiss signal', 'error');
      }
    }
  }, [workspaceId, showToast]);

  /** Delete an input and strip it from all cluster input_ids. */
  const deleteInput = useCallback((id) => {
    setInputs((prev) => prev.filter((inp) => inp.id !== id));
    setClusters((prev) =>
      prev.map((cl) => ({ ...cl, input_ids: cl.input_ids.filter((iid) => iid !== id) }))
    );
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("inputs")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete input", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  // ── Clusters ──────────────────────────────────────────────────────────────

  const addCluster = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const inputIds = fields.input_ids || [];
    const newCluster = {
      id,
      workspace_id: workspaceId,
      name: fields.name,
      subtype: fields.subtype || "Trend",
      horizon: fields.horizon || null,
      likelihood: fields.likelihood || null,
      description: fields.description || "",
      project_id: fields.project_id || null,
      input_ids: inputIds,
      created_at: now,
    };

    // Optimistic local update
    setClusters((prev) => [newCluster, ...prev]);

    if (workspaceId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("clusters")
            .insert({
              id,
              workspace_id: workspaceId,
              project_id: fields.project_id || null,
              name: fields.name,
              subtype: fields.subtype || "Trend",
              horizon: fields.horizon || null,
              description: fields.description || "",
              likelihood: fields.likelihood || null,
            })
            .select()
            .single();
          if (error) throw error;
          // Insert cluster_inputs rows after the cluster row is committed (avoids FK race)
          if (inputIds.length > 0) {
            const { error: ciError } = await supabase
              .from("cluster_inputs")
              .insert(inputIds.map((input_id) => ({ workspace_id: workspaceId, cluster_id: id, input_id })));
            if (ciError) throw ciError;
          }
          setClusters((prev) =>
            prev.map((cl) => cl.id === id ? { ...data, input_ids: inputIds } : cl)
          );
        } catch {
          setClusters((prev) => prev.filter((cl) => cl.id !== id));
          showToast("Failed to save cluster", "error");
        }
      })();
    }

    return newCluster;
  }, [workspaceId, showToast]);

  const updateCluster = useCallback((id, fields) => {
    // Strip input_ids from the Supabase update — membership lives in junction table
    const { input_ids: _ignored, ...dbFields } = fields;
    setClusters((prev) => prev.map((cl) => cl.id === id ? { ...cl, ...fields } : cl));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("clusters")
            .update(dbFields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update cluster", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const assignInputToCluster = useCallback((inputId, clusterId) => {
    // Optimistic update
    setClusters((prev) =>
      prev.map((cl) =>
        cl.id === clusterId && !cl.input_ids.includes(inputId)
          ? { ...cl, input_ids: [...cl.input_ids, inputId] }
          : cl
      )
    );
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("cluster_inputs")
            .insert({ workspace_id: workspaceId, cluster_id: clusterId, input_id: inputId });
          if (error) throw error;
        } catch {
          // Roll back
          setClusters((prev) =>
            prev.map((cl) =>
              cl.id === clusterId
                ? { ...cl, input_ids: cl.input_ids.filter((id) => id !== inputId) }
                : cl
            )
          );
          showToast("Failed to assign input to cluster", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const removeInputFromCluster = useCallback((inputId, clusterId) => {
    // Capture previous state for rollback
    let previous;
    setClusters((prev) => {
      previous = prev;
      return prev.map((cl) =>
        cl.id === clusterId
          ? { ...cl, input_ids: cl.input_ids.filter((id) => id !== inputId) }
          : cl
      );
    });
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("cluster_inputs")
            .delete()
            .eq("cluster_id", clusterId)
            .eq("input_id", inputId);
          if (error) throw error;
        } catch {
          setClusters(previous);
          showToast("Failed to remove input from cluster", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  /** Delete a cluster and its junction rows. Junction rows cascade on DB side. Inputs are preserved. */
  const deleteCluster = useCallback((id) => {
    setClusters((prev) => prev.filter((cl) => cl.id !== id));
    setScenarios((prev) =>
      prev.map((s) => ({ ...s, cluster_ids: s.cluster_ids.filter((cid) => cid !== id) }))
    );
    setConnections((prev) => prev.filter((c) => c.clusterId !== id));
    setCanvasNodes((prev) => prev.filter((n) => n.clusterId !== id));
    setRelationships((prev) => prev.filter((r) => r.fromClusterId !== id && r.toClusterId !== id));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("clusters")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete cluster", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  // ── Scenarios ─────────────────────────────────────────────────────────────

  const addScenario = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const newScenario = {
      id,
      workspace_id: workspaceId,
      project_id: fields.project_id || null,
      name: fields.name,
      archetype: fields.archetype || null,
      horizon: fields.horizon || null,
      description: fields.description || null,
      narrative: fields.narrative || null,
      key_differences: fields.key_differences || [],
      driving_forces: fields.driving_forces || [],
      suppressed_forces: fields.suppressed_forces || [],
      confidence: fields.confidence || null,
      geographic_scope: fields.geographic_scope || null,
      cluster_ids: [],
      created_at: now,
    };

    setScenarios((prev) => [newScenario, ...prev]);

    if (workspaceId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("scenarios")
            .insert({
              id,
              workspace_id: workspaceId,
              project_id: fields.project_id || null,
              name: fields.name,
              archetype: fields.archetype || null,
              horizon: fields.horizon || null,
              description: fields.description || null,
              narrative: fields.narrative || null,
              key_differences: fields.key_differences || [],
              driving_forces: fields.driving_forces || [],
              suppressed_forces: fields.suppressed_forces || [],
              confidence: fields.confidence || null,
              geographic_scope: fields.geographic_scope || null,
            })
            .select()
            .single();
          if (error) throw error;
          setScenarios((prev) =>
            prev.map((s) => s.id === id ? { ...data, cluster_ids: [] } : s)
          );
        } catch {
          setScenarios((prev) => prev.filter((s) => s.id !== id));
          showToast("Failed to save scenario", "error");
        }
      })();
    }

    return newScenario;
  }, [workspaceId, showToast]);

  const updateScenario = useCallback((id, fields) => {
    // Strip cluster_ids — membership lives in scenario_clusters junction table
    const { cluster_ids: _ignored, ...dbFields } = fields;
    setScenarios((prev) => prev.map((s) => s.id === id ? { ...s, ...fields } : s));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("scenarios")
            .update(dbFields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update scenario", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const deleteScenario = useCallback((id) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setConnections((prev) => prev.filter((c) => c.scenarioId !== id));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("scenarios")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete scenario", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const openScenario = useCallback((id) => {
    setActiveScenarioId(id);
    setActiveScreen("scenario-read");
  }, []);

  const openScenarioEdit = useCallback((id) => {
    setActiveScenarioId(id);
    setActiveScreen("scenario-edit");
  }, []);

  const openScenarioNew = useCallback(() => {
    setActiveScenarioId(null);
    setActiveScreen("scenario-new");
  }, []);

  // ── Preferred Futures ──────────────────────────────────────────────────────

  const addPreferredFuture = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const newPF = {
      id,
      workspace_id: workspaceId,
      project_id: fields.project_id,
      name: fields.name,
      description: fields.description || null,
      desired_outcomes: fields.desired_outcomes || null,
      guiding_principles: fields.guiding_principles || [],
      strategic_priorities: fields.strategic_priorities || [],
      indicators: fields.indicators || [],
      horizon: fields.horizon || null,
      scenario_ids: fields.scenario_ids || [],
      created_at: now,
      updated_at: now,
    };

    setPreferredFutures((prev) => [newPF, ...prev]);

    if (workspaceId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("preferred_futures")
            .insert({
              id,
              workspace_id: workspaceId,
              project_id: fields.project_id,
              name: fields.name,
              description: fields.description || null,
              desired_outcomes: fields.desired_outcomes || null,
              guiding_principles: fields.guiding_principles || [],
              strategic_priorities: fields.strategic_priorities || [],
              indicators: fields.indicators || [],
              horizon: fields.horizon || null,
              scenario_ids: fields.scenario_ids || [],
            })
            .select()
            .single();
          if (error) throw error;
          setPreferredFutures((prev) => prev.map((pf) => pf.id === id ? data : pf));
        } catch {
          setPreferredFutures((prev) => prev.filter((pf) => pf.id !== id));
          showToast("Failed to save preferred future", "error");
        }
      })();
    }

    return newPF;
  }, [workspaceId, showToast]);

  const updatePreferredFuture = useCallback((id, fields) => {
    setPreferredFutures((prev) => prev.map((pf) => pf.id === id ? { ...pf, ...fields } : pf));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("preferred_futures")
            .update(fields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update preferred future", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const deletePreferredFuture = useCallback((id) => {
    setPreferredFutures((prev) => prev.filter((pf) => pf.id !== id));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("preferred_futures")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete preferred future", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const openPreferredFuture = useCallback((id) => {
    setActivePFId(id);
    setActiveScreen("pf-read");
  }, []);

  const openPreferredFutureEdit = useCallback((id) => {
    setActivePFId(id);
    setActiveScreen("pf-edit");
  }, []);

  const openPreferredFutureNew = useCallback(() => {
    setActivePFId(null);
    setActiveScreen("pf-new");
  }, []);

  // ── Strategic Options ──────────────────────────────────────────────────────

  const [activeSOId, setActiveSOId] = useState(null);

  const addStrategicOption = useCallback((fields) => {
    const id = newId();
    const now = new Date().toISOString();
    const newOpt = {
      id,
      workspace_id: workspaceId,
      project_id: fields.project_id,
      name: fields.name,
      description: fields.description || null,
      intended_outcome: fields.intended_outcome || null,
      actions: fields.actions || null,
      implications: fields.implications || null,
      dependencies: fields.dependencies || null,
      risks: fields.risks || null,
      horizon: fields.horizon || null,
      feasibility: fields.feasibility || null,
      scenario_ids: fields.scenario_ids || [],
      created_at: now,
      updated_at: now,
    };

    setStrategicOptions((prev) => [newOpt, ...prev]);

    if (workspaceId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("strategic_options")
            .insert({
              id,
              workspace_id: workspaceId,
              project_id: fields.project_id,
              name: fields.name,
              description: fields.description || null,
              intended_outcome: fields.intended_outcome || null,
              actions: fields.actions || null,
              implications: fields.implications || null,
              dependencies: fields.dependencies || null,
              risks: fields.risks || null,
              horizon: fields.horizon || null,
              feasibility: fields.feasibility || null,
              scenario_ids: fields.scenario_ids || [],
            })
            .select()
            .single();
          if (error) throw error;
          setStrategicOptions((prev) => prev.map((o) => o.id === id ? data : o));
        } catch {
          setStrategicOptions((prev) => prev.filter((o) => o.id !== id));
          showToast("Failed to save strategic option", "error");
        }
      })();
    }

    return newOpt;
  }, [workspaceId, showToast]);

  const updateStrategicOption = useCallback((id, fields) => {
    setStrategicOptions((prev) => prev.map((o) => o.id === id ? { ...o, ...fields } : o));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("strategic_options")
            .update(fields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update strategic option", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const deleteStrategicOption = useCallback((id) => {
    setStrategicOptions((prev) => prev.filter((o) => o.id !== id));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("strategic_options")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete strategic option", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const openStrategicOption = useCallback((id) => {
    setActiveSOId(id);
    setActiveScreen("so-read");
  }, []);

  const openStrategicOptionEdit = useCallback((id) => {
    setActiveSOId(id);
    setActiveScreen("so-edit");
  }, []);

  const openStrategicOptionNew = useCallback(() => {
    setActiveSOId(null);
    setActiveScreen("so-new");
  }, []);

  // ── Analyses ──────────────────────────────────────────────────────────────

  /** Create or update the single analysis record for a project. */
  const upsertAnalysis = useCallback((projectId, fields) => {
    // Optimistic local update
    setAnalyses((prev) => {
      const exists = prev.some((a) => a.project_id === projectId);
      if (exists) return prev.map((a) => a.project_id === projectId ? { ...a, ...fields } : a);
      return [...prev, { id: newId(), workspace_id: workspaceId, project_id: projectId, ...fields }];
    });
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("analyses")
            .upsert(
              { workspace_id: workspaceId, project_id: projectId, ...fields },
              { onConflict: "project_id" }
            );
          if (error) throw error;
        } catch {
          showToast("Failed to save analysis", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  /** Delete the analysis record for a project. */
  const deleteAnalysis = useCallback((projectId) => {
    setAnalyses((prev) => prev.filter((a) => a.project_id !== projectId));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("analyses")
            .delete()
            .eq("project_id", projectId)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete analysis", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  // ── Canvas / System Map ───────────────────────────────────────────────────

  const updateNodePosition = useCallback((nodeId, pos) => {
    setNodePositions((prev) => ({ ...prev, [nodeId]: pos }));
  }, []);

  const addConnection = useCallback((fields) => {
    const exists = connectionsRef.current.some(
      (c) => c.clusterId === fields.clusterId && c.scenarioId === fields.scenarioId
    );
    if (exists) return null;
    const newConn = {
      id: newId(),
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
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("scenario_clusters")
            .insert({ workspace_id: workspaceId, scenario_id: fields.scenarioId, cluster_id: fields.clusterId });
          if (error) throw error;
        } catch {
          // Roll back local state
          setConnections((prev) => prev.filter((c) => c.id !== newConn.id));
          setScenarios((prev) =>
            prev.map((s) =>
              s.id === fields.scenarioId
                ? { ...s, cluster_ids: s.cluster_ids.filter((cid) => cid !== fields.clusterId) }
                : s
            )
          );
          showToast("Failed to link cluster to scenario", "error");
        }
      })();
    }
    return newConn;
  }, [workspaceId, showToast]);

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
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("scenario_clusters")
            .delete()
            .eq("scenario_id", conn.scenarioId)
            .eq("cluster_id", conn.clusterId);
          if (error) throw error;
        } catch {
          showToast("Failed to unlink cluster from scenario", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const addCanvasNode = useCallback((fields) => {
    const id = newId();
    const node = {
      id,
      projectId: fields.projectId,
      clusterId: fields.clusterId,
      x: fields.x ?? 120,
      y: fields.y ?? 120,
    };
    setCanvasNodes((prev) => [...prev, node]);
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("canvas_nodes")
            .upsert(
              {
                id,
                workspace_id: workspaceId,
                project_id: fields.projectId,
                cluster_id: fields.clusterId,
                x: fields.x ?? 120,
                y: fields.y ?? 120,
              },
              { onConflict: "project_id,cluster_id" }
            );
          if (error) throw error;
        } catch {
          setCanvasNodes((prev) => prev.filter((n) => n.id !== id));
          showToast("Failed to save canvas node", "error");
        }
      })();
    }
    return node;
  }, [workspaceId, showToast]);

  const removeCanvasNode = useCallback((nodeId) => {
    setCanvasNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("canvas_nodes")
            .delete()
            .eq("id", nodeId)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to remove canvas node", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const updateCanvasNodePos = useCallback((nodeId, pos) => {
    setCanvasNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, x: pos.x, y: pos.y } : n)
    );
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("canvas_nodes")
            .update({ x: pos.x, y: pos.y })
            .eq("id", nodeId)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to save node position", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const addRelationship = useCallback((fields) => {
    const id = newId();
    const rel = {
      id,
      projectId: fields.projectId,
      fromClusterId: fields.fromClusterId,
      toClusterId: fields.toClusterId,
      type: fields.type || "Drives",
      evidence: fields.evidence || "",
      confidence: fields.confidence || "Medium",
      sourceHandle: fields.sourceHandle || null,
      targetHandle: fields.targetHandle || null,
      created_at: new Date().toISOString(),
    };
    setRelationships((prev) => [...prev, rel]);
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("relationships")
            .insert({
              id,
              workspace_id: workspaceId,
              project_id: fields.projectId,
              from_cluster_id: fields.fromClusterId,
              to_cluster_id: fields.toClusterId,
              type: fields.type || "Drives",
              evidence: fields.evidence || "",
              confidence: fields.confidence || "Medium",
              source_handle: fields.sourceHandle || null,
              target_handle: fields.targetHandle || null,
            });
          if (error) throw error;
        } catch {
          setRelationships((prev) => prev.filter((r) => r.id !== id));
          showToast("Failed to save relationship", "error");
        }
      })();
    }
    return rel;
  }, [workspaceId, showToast]);

  const updateRelationship = useCallback((id, fields) => {
    setRelationships((prev) =>
      prev.map((r) => r.id === id ? { ...r, ...fields } : r)
    );
    if (workspaceId) {
      (async () => {
        try {
          // Map camelCase local fields to snake_case DB columns
          const dbFields = { ...fields };
          if (fields.fromClusterId !== undefined) { dbFields.from_cluster_id = fields.fromClusterId; delete dbFields.fromClusterId; }
          if (fields.toClusterId !== undefined) { dbFields.to_cluster_id = fields.toClusterId; delete dbFields.toClusterId; }
          if (fields.projectId !== undefined) { dbFields.project_id = fields.projectId; delete dbFields.projectId; }
          if (fields.sourceHandle !== undefined) { dbFields.source_handle = fields.sourceHandle; delete dbFields.sourceHandle; }
          if (fields.targetHandle !== undefined) { dbFields.target_handle = fields.targetHandle; delete dbFields.targetHandle; }
          const { error } = await supabase
            .from("relationships")
            .update(dbFields)
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to update relationship", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  const removeRelationship = useCallback((id) => {
    setRelationships((prev) => prev.filter((r) => r.id !== id));
    if (workspaceId) {
      (async () => {
        try {
          const { error } = await supabase
            .from("relationships")
            .delete()
            .eq("id", id)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
        } catch {
          showToast("Failed to delete relationship", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  /** Delete all canvas nodes and relationships for a project (System Map reset). */
  const deleteSystemMap = useCallback((projectId) => {
    setCanvasNodes((prev) => prev.filter((n) => n.projectId !== projectId));
    setRelationships((prev) => prev.filter((r) => r.projectId !== projectId));
    if (workspaceId) {
      (async () => {
        try {
          const [{ error: nodesError }, { error: relsError }] = await Promise.all([
            supabase.from("canvas_nodes").delete().eq("project_id", projectId).eq("workspace_id", workspaceId),
            supabase.from("relationships").delete().eq("project_id", projectId).eq("workspace_id", workspaceId),
          ]);
          if (nodesError) throw nodesError;
          if (relsError) throw relsError;
        } catch {
          showToast("Failed to reset system map", "error");
        }
      })();
    }
  }, [workspaceId, showToast]);

  // ── Delete project (cascade) ──────────────────────────────────────────────

  const deleteProject = useCallback((id) => {
    const scenarioIdSet = new Set(scenarios.filter((s) => s.project_id === id).map((s) => s.id));
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setInputs((prev) => prev.map((inp) =>
      inp.project_id === id ? { ...inp, project_id: null } : inp
    ));
    setClusters((prev) => prev.filter((cl) => cl.project_id !== id));
    setScenarios((prev) => prev.filter((s) => s.project_id !== id));
    setAnalyses((prev) => prev.filter((a) => a.project_id !== id));
    setCanvasNodes((prev) => prev.filter((n) => n.projectId !== id));
    setRelationships((prev) => prev.filter((r) => r.projectId !== id));
    setConnections((prev) => prev.filter((c) => !scenarioIdSet.has(c.scenarioId)));

    if (workspaceId) {
      (async () => {
        try {
          // Null out project_id on inputs (FK constraint)
          const { error: inputsError } = await supabase
            .from("inputs")
            .update({ project_id: null })
            .eq("project_id", id)
            .eq("workspace_id", workspaceId);
          if (inputsError) throw inputsError;

          // Delete clusters (junction rows cascade)
          const { error: clustersError } = await supabase
            .from("clusters")
            .delete()
            .eq("project_id", id)
            .eq("workspace_id", workspaceId);
          if (clustersError) throw clustersError;

          // Delete the project row
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
  const openInputDetail = useCallback((id) => setInputDetailId(id), []);
  const closeInputDetail = useCallback(() => setInputDetailId(null), []);
  const openClusterDetail = useCallback((id) => setClusterDetailId(id), []);
  const closeClusterDetail = useCallback(() => setClusterDetailId(null), []);
  const openScenarioDetail = useCallback((id) => setScenarioDetailId(id), []);
  const closeScenarioDetail = useCallback(() => setScenarioDetailId(null), []);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    user,
    workspaceId,
    workspaceScanningEnabled,
    updateWorkspaceScanningEnabled,
    inputs,
    clusters,
    scenarios,
    preferredFutures,
    strategicOptions,
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
    dismissSuggestedInput,
    refreshInputs: () => refreshInputsRef.current?.(),
    saveInputToProject,
    saveInputsToProject,
    analyses,
    upsertAnalysis,
    activeScenarioId,
    openScenario,
    openScenarioEdit,
    openScenarioNew,
    addScenario,
    updateScenario,
    deleteScenario,
    activePFId,
    openPreferredFuture,
    openPreferredFutureEdit,
    openPreferredFutureNew,
    addPreferredFuture,
    updatePreferredFuture,
    deletePreferredFuture,
    activeSOId,
    openStrategicOption,
    openStrategicOptionEdit,
    openStrategicOptionNew,
    addStrategicOption,
    updateStrategicOption,
    deleteStrategicOption,
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
    inboxProjectFilter,
    setInboxProjectFilter,
  };
}
