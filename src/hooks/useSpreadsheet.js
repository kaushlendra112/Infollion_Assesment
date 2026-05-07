import { useState, useCallback, useRef } from 'react';

const COLS = 10; // A-J
const ROWS = 10; // 1-10

const colLabel = (i) => String.fromCharCode(65 + i); // 0→A, 9→J

/**
 * Generate all cell IDs (A1 … J10)
 */
function generateCellIds() {
  const ids = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ids.push(`${colLabel(c)}${r + 1}`);
    }
  }
  return ids;
}

const ALL_CELL_IDS = generateCellIds();
const CELL_REF_REGEX = /\b([A-J](?:[1-9]|10))\b/gi;

/**
 * Check if a value is a valid cell reference
 */
function isValidCellRef(ref) {
  return ALL_CELL_IDS.includes(ref.toUpperCase());
}

/**
 * Extract cell references from a formula string
 */
function extractRefs(formula) {
  const refs = new Set();
  let match;
  const regex = new RegExp(CELL_REF_REGEX.source, 'gi');
  while ((match = regex.exec(formula)) !== null) {
    const ref = match[1].toUpperCase();
    if (isValidCellRef(ref)) {
      refs.add(ref);
    }
  }
  return refs;
}

/**
 * Detect circular references using DFS from a starting cell.
 * Returns true if a cycle is found.
 */
function hasCircular(startCell, deps) {
  const visited = new Set();
  const stack = [startCell];

  while (stack.length > 0) {
    const current = stack.pop();
    const currentDeps = deps.get(current);
    if (!currentDeps) continue;

    for (const dep of currentDeps) {
      if (dep === startCell) return true;
      if (!visited.has(dep)) {
        visited.add(dep);
        stack.push(dep);
      }
    }
  }
  return false;
}

/**
 * Topological sort of cells that depend on a changed cell.
 * Returns an ordered list of cell IDs to recalculate.
 */
function getRecalcOrder(changedCell, reverseDeps) {
  const order = [];
  const visited = new Set();

  function dfs(cellId) {
    if (visited.has(cellId)) return;
    visited.add(cellId);
    const dependents = reverseDeps.get(cellId);
    if (dependents) {
      for (const dep of dependents) {
        dfs(dep);
      }
    }
    order.push(cellId);
  }

  // Start from dependents of the changed cell
  const directDependents = reverseDeps.get(changedCell);
  if (directDependents) {
    for (const dep of directDependents) {
      dfs(dep);
    }
  }

  return order.reverse();
}

/**
 * Safely evaluate a formula expression after substituting cell references.
 */
function safeEval(expression) {
  try {
    // Only allow numbers, operators, parentheses, spaces, and decimal points
    const sanitized = expression.replace(/\s/g, '');
    if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
      return { value: '#ERROR', error: true };
    }
    // Use Function constructor for sandboxed eval
    const result = new Function(`"use strict"; return (${sanitized});`)();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { value: '#ERROR', error: true };
    }
    // Round to avoid floating point noise
    return { value: Math.round(result * 1e10) / 1e10, error: false };
  } catch {
    return { value: '#ERROR', error: true };
  }
}

/**
 * Evaluate a single cell's formula given current computed values.
 */
function evaluateFormula(formula, computedValues) {
  const expression = formula.substring(1); // remove leading "="
  if (expression.trim() === '') return { value: '#ERROR', error: true };

  // Replace cell references with their computed values
  let substituted = expression.replace(
    new RegExp(CELL_REF_REGEX.source, 'gi'),
    (match) => {
      const ref = match.toUpperCase();
      if (!isValidCellRef(ref)) return 'NaN';
      const val = computedValues[ref];
      if (val === undefined || val === '' || val === null) return '0';
      if (typeof val === 'string' && val.startsWith('#')) return 'NaN';
      const num = Number(val);
      return isNaN(num) ? 'NaN' : `(${num})`;
    }
  );

  return safeEval(substituted);
}

/**
 * Main spreadsheet hook
 */
export function useSpreadsheet() {
  // rawValues: what the user typed (formulas or plain values)
  const [rawValues, setRawValues] = useState(() => {
    const init = {};
    ALL_CELL_IDS.forEach((id) => (init[id] = ''));
    return init;
  });

  // computedValues: evaluated results for display
  const [computedValues, setComputedValues] = useState(() => {
    const init = {};
    ALL_CELL_IDS.forEach((id) => (init[id] = ''));
    return init;
  });

  // errors: cells with errors
  const [errors, setErrors] = useState(() => {
    const init = {};
    ALL_CELL_IDS.forEach((id) => (init[id] = false));
    return init;
  });

  // deps: cellId -> Set of cell IDs it depends on (forward deps)
  const depsRef = useRef(new Map());
  // reverseDeps: cellId -> Set of cell IDs that depend on it
  const reverseDepsRef = useRef(new Map());

  const setCellValue = useCallback((cellId, value) => {
    setRawValues((prevRaw) => {
      const newRaw = { ...prevRaw, [cellId]: value };
      const deps = depsRef.current;
      const reverseDeps = reverseDepsRef.current;

      // ── 1. Update dependency graph ──
      // Remove old forward deps for this cell
      const oldDeps = deps.get(cellId);
      if (oldDeps) {
        for (const oldDep of oldDeps) {
          const rev = reverseDeps.get(oldDep);
          if (rev) {
            rev.delete(cellId);
            if (rev.size === 0) reverseDeps.delete(oldDep);
          }
        }
      }

      // Compute new deps
      const isFormula = typeof value === 'string' && value.startsWith('=');
      if (isFormula) {
        const refs = extractRefs(value);
        deps.set(cellId, refs);
        for (const ref of refs) {
          if (!reverseDeps.has(ref)) reverseDeps.set(ref, new Set());
          reverseDeps.get(ref).add(cellId);
        }
      } else {
        deps.delete(cellId);
      }

      // ── 2. Circular reference check ──
      const newErrors = {};
      ALL_CELL_IDS.forEach((id) => (newErrors[id] = false));

      if (isFormula && hasCircular(cellId, deps)) {
        newErrors[cellId] = '#CIRCULAR';
      }

      // ── 3. Evaluate this cell ──
      const newComputed = {};
      ALL_CELL_IDS.forEach((id) => (newComputed[id] = ''));

      // First, compute all non-formula cells
      for (const id of ALL_CELL_IDS) {
        const raw = newRaw[id];
        if (typeof raw === 'string' && raw.startsWith('=')) {
          // skip formulas for now
        } else {
          newComputed[id] = raw;
        }
      }

      // Build evaluation order via topological sort for all formula cells
      // We need to evaluate formulas in dependency order
      const formulaCells = ALL_CELL_IDS.filter(
        (id) => typeof newRaw[id] === 'string' && newRaw[id].startsWith('=')
      );

      // Topological sort of formula cells
      const inDegree = new Map();
      const adjList = new Map();

      for (const fc of formulaCells) {
        if (!inDegree.has(fc)) inDegree.set(fc, 0);
        if (!adjList.has(fc)) adjList.set(fc, []);
      }

      for (const fc of formulaCells) {
        const cellDeps = deps.get(fc);
        if (cellDeps) {
          for (const dep of cellDeps) {
            if (formulaCells.includes(dep)) {
              if (!adjList.has(dep)) adjList.set(dep, []);
              adjList.get(dep).push(fc);
              inDegree.set(fc, (inDegree.get(fc) || 0) + 1);
            }
          }
        }
      }

      // Kahn's algorithm
      const queue = [];
      for (const [node, deg] of inDegree) {
        if (deg === 0) queue.push(node);
      }

      const evalOrder = [];
      while (queue.length > 0) {
        const node = queue.shift();
        evalOrder.push(node);
        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
          inDegree.set(neighbor, inDegree.get(neighbor) - 1);
          if (inDegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }

      // Cells not in evalOrder are part of cycles
      const inCycle = new Set(
        formulaCells.filter((fc) => !evalOrder.includes(fc))
      );

      // Evaluate in topological order
      for (const fc of evalOrder) {
        if (newErrors[fc]) {
          newComputed[fc] = newErrors[fc];
          continue;
        }
        const result = evaluateFormula(newRaw[fc], newComputed);
        if (result.error) {
          newErrors[fc] = result.value;
          newComputed[fc] = result.value;
        } else {
          newComputed[fc] = result.value;
        }
      }

      // Mark circular cells
      for (const fc of inCycle) {
        newErrors[fc] = '#CIRCULAR';
        newComputed[fc] = '#CIRCULAR';
      }

      setComputedValues(newComputed);
      setErrors(newErrors);

      return newRaw;
    });
  }, []);

  return {
    rawValues,
    computedValues,
    errors,
    setCellValue,
    COLS,
    ROWS,
    colLabel,
  };
}
