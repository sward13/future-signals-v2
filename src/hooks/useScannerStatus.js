import { useState, useEffect, useMemo, useRef } from 'react';

export function useScannerStatus(projectId, inputs) {
  const [isPolling, setIsPolling]   = useState(false);
  const [dismissed, setDismissed]   = useState(false);
  const pollRef      = useRef(null);
  const startTimeRef = useRef(null);

  // Reactively recomputes whenever inputs or projectId changes.
  // An input is "unactioned" for this project if it:
  //   - came from the scanner (is_seeded + metadata.source === 'scanner')
  //   - is suggested for this project
  //   - has not been accepted (project_id still null)
  //   - has not been dismissed (no metadata.dismissed flag)
  const unactionedCount = useMemo(() => {
    if (!projectId) return 0;
    return inputs.filter(i =>
      i.is_seeded &&
      i.metadata?.source === 'scanner' &&
      i.metadata?.suggested_projects?.some(p => p.id === projectId) &&
      i.project_id === null &&
      !i.metadata?.dismissed
    ).length;
  }, [inputs, projectId]);

  // Start polling when the project loads and there are no unactioned signals yet.
  useEffect(() => {
    if (!projectId) return;

    // Already have unactioned suggestions — skip polling entirely.
    if (unactionedCount > 0) return;

    setIsPolling(true);
    startTimeRef.current = Date.now();

    pollRef.current = setInterval(() => {
      if (Date.now() - startTimeRef.current > 90000) {
        setIsPolling(false);
        clearInterval(pollRef.current);
      }
    }, 8000);

    return () => {
      clearInterval(pollRef.current);
      setIsPolling(false);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop polling once results arrive.
  useEffect(() => {
    if (isPolling && unactionedCount > 0) {
      setIsPolling(false);
      clearInterval(pollRef.current);
    }
  }, [unactionedCount, isPolling]);

  // Reset dismissed flag when switching projects.
  useEffect(() => {
    setDismissed(false);
  }, [projectId]);

  let status;
  if (dismissed)              status = 'dismissed';
  else if (unactionedCount > 0) status = 'found';
  else if (isPolling)           status = 'scanning';
  else                          status = 'idle';

  return { status, foundCount: unactionedCount, dismiss: () => setDismissed(true) };
}
