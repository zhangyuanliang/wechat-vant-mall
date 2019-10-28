module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845894, function(require, module, exports) {
module.exports      = isTypedArray
isTypedArray.strict = isStrictTypedArray
isTypedArray.loose  = isLooseTypedArray

var toString = Object.prototype.toString
var names = {
    '[object Int8Array]': true
  , '[object Int16Array]': true
  , '[object Int32Array]': true
  , '[object Uint8Array]': true
  , '[object Uint8ClampedArray]': true
  , '[object Uint16Array]': true
  , '[object Uint32Array]': true
  , '[object Float32Array]': true
  , '[object Float64Array]': true
}

function isTypedArray(arr) {
  return (
       isStrictTypedArray(arr)
    || isLooseTypedArray(arr)
  )
}

function isStrictTypedArray(arr) {
  return (
       arr instanceof Int8Array
    || arr instanceof Int16Array
    || arr instanceof Int32Array
    || arr instanceof Uint8Array
    || arr instanceof Uint8ClampedArray
    || arr instanceof Uint16Array
    || arr instanceof Uint32Array
    || arr instanceof Float32Array
    || arr instanceof Float64Array
  )
}

function isLooseTypedArray(arr) {
  return names[toString.call(arr)]
}

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845894);
})()
//# sourceMappingURL=index.js.map