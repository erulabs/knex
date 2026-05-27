
const { performance } = require('perf_hooks');

const SIZE = 15000;
const values = new Array(SIZE).fill(0).map((_, i) => i);
const bindingsHolder = { bindings: [] };

function originalParameterize(values, notSetValue, builder, bindingsHolder) {
    if (typeof values === 'function') return;
    values = Array.isArray(values) ? values : [values];

    if (values.length === 0) {
      return '';
    }

    const params = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      let value = values[i];
      if (value === undefined) {
        value = notSetValue;
      }

      const type = typeof value;
      // Fast path for primitives
      if (type !== 'object' && type !== 'function' && type !== 'symbol') {
        bindingsHolder.bindings.push(value);
        params[i] = '?';
        continue;
      }
      if (value === null) {
        bindingsHolder.bindings.push(value);
        params[i] = '?';
        continue;
      }

      // Mock parameter call
      bindingsHolder.bindings.push(value);
      params[i] = '?';
    }
    return params.join(', ');
}

function optimizedParameterize(values, notSetValue, builder, bindingsHolder) {
    if (typeof values === 'function') return;
    values = Array.isArray(values) ? values : [values];

    const len = values.length;
    if (len === 0) return '';

    const bindings = bindingsHolder.bindings;

    // Check if we can use fast path
    let allPrimitives = true;
    for (let i = 0; i < len; i++) {
       let value = values[i];
       const type = typeof value;
       if (type === 'object' || type === 'function' || type === 'symbol') {
           if (value !== null) {
               allPrimitives = false;
               break;
           }
       }
    }

    if (allPrimitives) {
        for(let i=0; i<len; i++) {
             let value = values[i];
             bindings.push(value === undefined ? notSetValue : value);
        }
        if (len === 1) return '?';
        // '?, '.repeat(15000) creates 45000 char string.
        return '?, '.repeat(len - 1) + '?';
    }

    const params = new Array(len);
    for (let i = 0; i < len; i++) {
      let value = values[i];
      if (value === undefined) {
        value = notSetValue;
      }

      const type = typeof value;
      if (type !== 'object' && type !== 'function' && type !== 'symbol') {
        bindings.push(value);
        params[i] = '?';
        continue;
      }
      if (value === null) {
        bindings.push(value);
        params[i] = '?';
        continue;
      }

      bindings.push(value);
      params[i] = '?';
    }
    return params.join(', ');
}

const ITER = 10000;

console.log(`Benchmarking ${SIZE} items over ${ITER} iterations...`);

let start = performance.now();
for(let i=0; i<ITER; i++) {
    bindingsHolder.bindings.length = 0;
    originalParameterize(values, undefined, undefined, bindingsHolder);
}
let end = performance.now();
const originalTime = end - start;
console.log('Original:', originalTime.toFixed(2), 'ms');

start = performance.now();
for(let i=0; i<ITER; i++) {
    bindingsHolder.bindings.length = 0;
    optimizedParameterize(values, undefined, undefined, bindingsHolder);
}
end = performance.now();
const optimizedTime = end - start;
console.log('Optimized:', optimizedTime.toFixed(2), 'ms');

console.log('Speedup:', (originalTime / optimizedTime).toFixed(2) + 'x');

