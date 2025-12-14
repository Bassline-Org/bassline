import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

// Re-export new hooks
export { useTmpState } from './hooks/useTmpState.js'
export { usePlumberRule } from './hooks/usePlumberRule.js'
export { useCell } from './hooks/useCell.js'
export const useLiveResource = (uri) => {};

export const BasslineContext = createContext(null)

export function BasslineProvider({ value, children }) {
  return <BasslineContext.Provider value={value}>{children}</BasslineContext.Provider>
}

/**
 * Hook to access the Bassline instance
 *
 * @returns {import('@bassline/core').Bassline}
 *
 * @example
 * function MyComponent() {
 *   const bl = useBassline()
 *
 *   async function handleClick() {
 *     const data = await bl.get('bl:///data/users/alice')
 *     console.log(data)
 *   }
 *
 *   return <button onClick={handleClick}>Load</button>
 * }
 */
export function useBassline() {
  const bl = useContext(BasslineContext)
  if (!bl) {
    throw new Error('useBassline must be used within a BasslineProvider')
  }
  return bl
}

const removeLeadingSlash = (path) => path.trim().replace(/^\//, '');
const removeLeadingDot = (path) => path.trim().replace(/^\./, '');
const cleanPath = (path) => removeLeadingSlash(removeLeadingDot(path));
const cleanBase = (base) => {
  let clean = base.trim().replace(/^\/+/, '');
  if (!clean.startsWith('bl:///')) {
    clean = `bl:///${clean}`;
  }
  return clean
}

export const joinPath = (base, path) => {
  const clean = cleanPath(path);
  if (base.endsWith('/')) {
    return base + clean;
  }
  return base + '/' + clean;
}

export function useGet(resourceUri) {
  const uri = cleanBase(resourceUri);
  const bl = useBassline();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const fetch = useCallback(async (headers = {}) => {
    setStatus('loading');
    setError(null);
    try {
      const result = await bl.get(uri, headers);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setStatus('idle');
    }
  }, [bl, uri]);

  return { data, status, error, fetch };
}

export function usePut(resourceUri) {
  const uri = cleanBase(resourceUri);
  const bl = useBassline();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const fetch = useCallback(async (headers = {}, body = {}) => {
    try {
      const result = await bl.put(uri, headers, body);
      setData(result);
      setStatus('success');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, [bl, uri]);

  return { data, status, error, fetch };
}

export function useResource(uri) {
  const get = useGet(uri);
  const put = usePut(uri);
  return [get, put]
}