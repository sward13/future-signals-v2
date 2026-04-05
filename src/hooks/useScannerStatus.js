import { useState, useEffect, useRef } from 'react';

export function useScannerStatus(projectId, inputs) {
  const [status, setStatus] = useState('scanning');
  // 'scanning' | 'found' | 'dismissed' | 'idle'
  const [foundCount, setFoundCount] = useState(0);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!projectId) return;

    // Check if there are already AI-suggested inputs for this project
    const existing = inputs.filter(i =>
      i.is_seeded &&
      i.metadata?.source === 'scanner' &&
      i.metadata?.suggested_projects?.some(p => p.id === projectId) &&
      !i.metadata?.dismissed
    );

    if (existing.length > 0) {
      // Already have signals — no need to scan
      setStatus('idle');
      return;
    }

    // Poll every 8 seconds for up to 90 seconds
    pollRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;

      const found = inputs.filter(i =>
        i.is_seeded &&
        i.metadata?.source === 'scanner' &&
        i.metadata?.suggested_projects?.some(p => p.id === projectId) &&
        !i.metadata?.dismissed
      );

      if (found.length > 0) {
        setFoundCount(found.length);
        setStatus('found');
        clearInterval(pollRef.current);
      } else if (elapsed > 90000) {
        // Give up after 90 seconds
        setStatus('idle');
        clearInterval(pollRef.current);
      }
    }, 8000);

    return () => clearInterval(pollRef.current);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check when inputs change
  useEffect(() => {
    if (status !== 'scanning') return;
    const found = inputs.filter(i =>
      i.is_seeded &&
      i.metadata?.source === 'scanner' &&
      i.metadata?.suggested_projects?.some(p => p.id === projectId) &&
      !i.metadata?.dismissed
    );
    if (found.length > 0) {
      setFoundCount(found.length);
      setStatus('found');
      clearInterval(pollRef.current);
    }
  }, [inputs, projectId, status]);

  const dismiss = () => setStatus('dismissed');

  return { status, foundCount, dismiss };
}
