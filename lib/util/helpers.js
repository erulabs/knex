const isPlainObject = require('lodash/isPlainObject');
const isTypedArray = require('lodash/isTypedArray');
const { CLIENT_ALIASES } = require('../constants');
const { isFunction } = require('./is');

// Check if the first argument is an array, otherwise uses all arguments as an
// array.
function normalizeArr(...args) {
  if (Array.isArray(args[0])) {
    return args[0];
  }

  return args;
}

function containsUndefined(mixed) {
  if (mixed === undefined) return true;
  if (mixed === null) return false;

  const type = typeof mixed;
  if (type !== 'object' && type !== 'function') return false;

  if (isTypedArray(mixed)) return false;

  // QueryBuilder or Raw will be validated during compile.
  if (isFunction(mixed.toSQL)) return false;

  if (Array.isArray(mixed)) {
    for (let i = 0; i < mixed.length; i++) {
      if (containsUndefined(mixed[i])) return true;
    }
    return false;
  }

  if (isPlainObject(mixed)) {
    const keys = Object.keys(mixed);
    for (let i = 0; i < keys.length; i++) {
      if (containsUndefined(mixed[keys[i]])) return true;
    }
    return false;
  }

  return false;
}

function getUndefinedIndices(mixed) {
  const indices = [];

  if (Array.isArray(mixed)) {
    mixed.forEach((item, index) => {
      if (containsUndefined(item)) {
        indices.push(index);
      }
    });
  } else if (isPlainObject(mixed)) {
    Object.keys(mixed).forEach((key) => {
      if (containsUndefined(mixed[key])) {
        indices.push(key);
      }
    });
  } else {
    indices.push(0);
  }

  return indices;
}

function addQueryContext(Target) {
  // Stores or returns (if called with no arguments) context passed to
  // wrapIdentifier and postProcessResponse hooks
  Target.prototype.queryContext = function (context) {
    if (context === undefined) {
      return this._queryContext;
    }
    this._queryContext = context;
    return this;
  };
}

function resolveClientNameWithAliases(clientName) {
  return CLIENT_ALIASES[clientName] || clientName;
}

function toNumber(val, fallback) {
  if (val === undefined || val === null) return fallback;
  const number = parseInt(val, 10);
  return isNaN(number) ? fallback : number;
}

module.exports = {
  addQueryContext,
  containsUndefined,
  getUndefinedIndices,
  normalizeArr,
  resolveClientNameWithAliases,
  toNumber,
};
