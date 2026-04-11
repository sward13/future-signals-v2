-- Returns all pairs of inputs within a project whose cosine similarity meets
-- the threshold. Runs entirely in Postgres using the ivfflat index — keeps
-- heavy vector math out of the Edge Function.

CREATE OR REPLACE FUNCTION find_similar_input_pairs(
  p_project_id uuid,
  p_threshold  float8 DEFAULT 0.72
)
RETURNS TABLE(id_a uuid, id_b uuid)
LANGUAGE sql STABLE AS $$
  SELECT a.id, b.id
  FROM   inputs a
  JOIN   inputs b ON a.id < b.id
  WHERE  a.project_id = p_project_id
    AND  b.project_id = p_project_id
    AND  a.embedding  IS NOT NULL
    AND  b.embedding  IS NOT NULL
    AND  1 - (a.embedding <=> b.embedding) >= p_threshold;
$$;
