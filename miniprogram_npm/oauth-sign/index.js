module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845904, function(require, module, exports) {
var crypto = require('crypto')

function sha (key, body, algorithm) {
  return crypto.createHmac(algorithm, key).update(body).digest('base64')
}

function rsa (key, body) {
  return crypto.createSign('RSA-SHA1').update(body).sign(key, 'base64')
}

function rfc3986 (str) {
  return encodeURIComponent(str)
    .replace(/!/g,'%21')
    .replace(/\*/g,'%2A')
    .replace(/\(/g,'%28')
    .replace(/\)/g,'%29')
    .replace(/'/g,'%27')
}

// Maps object to bi-dimensional array
// Converts { foo: 'A', bar: [ 'b', 'B' ]} to
// [ ['foo', 'A'], ['bar', 'b'], ['bar', 'B'] ]
function map (obj) {
  var key, val, arr = []
  for (key in obj) {
    val = obj[key]
    if (Array.isArray(val))
      for (var i = 0; i < val.length; i++)
        arr.push([key, val[i]])
    else if (typeof val === 'object')
      for (var prop in val)
        arr.push([key + '[' + prop + ']', val[prop]])
    else
      arr.push([key, val])
  }
  return arr
}

// Compare function for sort
function compare (a, b) {
  return a > b ? 1 : a < b ? -1 : 0
}

function generateBase (httpMethod, base_uri, params) {
  // adapted from https://dev.twitter.com/docs/auth/oauth and 
  // https://dev.twitter.com/docs/auth/creating-signature

  // Parameter normalization
  // http://tools.ietf.org/html/rfc5849#section-3.4.1.3.2
  var normalized = map(params)
  // 1.  First, the name and value of each parameter are encoded
  .map(function (p) {
    return [ rfc3986(p[0]), rfc3986(p[1] || '') ]
  })
  // 2.  The parameters are sorted by name, using ascending byte value
  //     ordering.  If two or more parameters share the same name, they
  //     are sorted by their value.
  .sort(function (a, b) {
    return compare(a[0], b[0]) || compare(a[1], b[1])
  })
  // 3.  The name of each parameter is concatenated to its corresponding
  //     value using an "=" character (ASCII code 61) as a separator, even
  //     if the value is empty.
  .map(function (p) { return p.join('=') })
   // 4.  The sorted name/value pairs are concatenated together into a
   //     single string by using an "&" character (ASCII code 38) as
   //     separator.
  .join('&')

  var base = [
    rfc3986(httpMethod ? httpMethod.toUpperCase() : 'GET'),
    rfc3986(base_uri),
    rfc3986(normalized)
  ].join('&')

  return base
}

function hmacsign (httpMethod, base_uri, params, consumer_secret, token_secret) {
  var base = generateBase(httpMethod, base_uri, params)
  var key = [
    consumer_secret || '',
    token_secret || ''
  ].map(rfc3986).join('&')

  return sha(key, base, 'sha1')
}

function hmacsign256 (httpMethod, base_uri, params, consumer_secret, token_secret) {
  var base = generateBase(httpMethod, base_uri, params)
  var key = [
    consumer_secret || '',
    token_secret || ''
  ].map(rfc3986).join('&')

  return sha(key, base, 'sha256')
}

function rsasign (httpMethod, base_uri, params, private_key, token_secret) {
  var base = generateBase(httpMethod, base_uri, params)
  var key = private_key || ''

  return rsa(key, base)
}

function plaintext (consumer_secret, token_secret) {
  var key = [
    consumer_secret || '',
    token_secret || ''
  ].map(rfc3986).join('&')

  return key
}

function sign (signMethod, httpMethod, base_uri, params, consumer_secret, token_secret) {
  var method
  var skipArgs = 1

  switch (signMethod) {
    case 'RSA-SHA1':
      method = rsasign
      break
    case 'HMAC-SHA1':
      method = hmacsign
      break
    case 'HMAC-SHA256':
      method = hmacsign256
      break
    case 'PLAINTEXT':
      method = plaintext
      skipArgs = 4
      break
    default:
     throw new Error('Signature method not supported: ' + signMethod)
  }

  return method.apply(null, [].slice.call(arguments, skipArgs))
}

exports.hmacsign = hmacsign
exports.hmacsign256 = hmacsign256
exports.rsasign = rsasign
exports.plaintext = plaintext
exports.sign = sign
exports.rfc3986 = rfc3986
exports.generateBase = generateBase
}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845904);
})()
//# sourceMappingURL=index.js.map