module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845848, function(require, module, exports) {

/*!
 *  Copyright 2010 LearnBoost <dev@learnboost.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , parse = require('url').parse
  ;

/**
 * Valid keys.
 */

var keys = 
  [ 'acl'
  , 'location'
  , 'logging'
  , 'notification'
  , 'partNumber'
  , 'policy'
  , 'requestPayment'
  , 'torrent'
  , 'uploadId'
  , 'uploads'
  , 'versionId'
  , 'versioning'
  , 'versions'
  , 'website'
  ]

/**
 * Return an "Authorization" header value with the given `options`
 * in the form of "AWS <key>:<signature>"
 *
 * @param {Object} options
 * @return {String}
 * @api private
 */

function authorization (options) {
  return 'AWS ' + options.key + ':' + sign(options)
}

module.exports = authorization
module.exports.authorization = authorization

/**
 * Simple HMAC-SHA1 Wrapper
 *
 * @param {Object} options
 * @return {String}
 * @api private
 */ 

function hmacSha1 (options) {
  return crypto.createHmac('sha1', options.secret).update(options.message).digest('base64')
}

module.exports.hmacSha1 = hmacSha1

/**
 * Create a base64 sha1 HMAC for `options`. 
 * 
 * @param {Object} options
 * @return {String}
 * @api private
 */

function sign (options) {
  options.message = stringToSign(options)
  return hmacSha1(options)
}
module.exports.sign = sign

/**
 * Create a base64 sha1 HMAC for `options`. 
 *
 * Specifically to be used with S3 presigned URLs
 * 
 * @param {Object} options
 * @return {String}
 * @api private
 */

function signQuery (options) {
  options.message = queryStringToSign(options)
  return hmacSha1(options)
}
module.exports.signQuery= signQuery

/**
 * Return a string for sign() with the given `options`.
 *
 * Spec:
 * 
 *    <verb>\n
 *    <md5>\n
 *    <content-type>\n
 *    <date>\n
 *    [headers\n]
 *    <resource>
 *
 * @param {Object} options
 * @return {String}
 * @api private
 */

function stringToSign (options) {
  var headers = options.amazonHeaders || ''
  if (headers) headers += '\n'
  var r = 
    [ options.verb
    , options.md5
    , options.contentType
    , options.date ? options.date.toUTCString() : ''
    , headers + options.resource
    ]
  return r.join('\n')
}
module.exports.stringToSign = stringToSign

/**
 * Return a string for sign() with the given `options`, but is meant exclusively
 * for S3 presigned URLs
 *
 * Spec:
 * 
 *    <date>\n
 *    <resource>
 *
 * @param {Object} options
 * @return {String}
 * @api private
 */

function queryStringToSign (options){
  return 'GET\n\n\n' + options.date + '\n' + options.resource
}
module.exports.queryStringToSign = queryStringToSign

/**
 * Perform the following:
 *
 *  - ignore non-amazon headers
 *  - lowercase fields
 *  - sort lexicographically
 *  - trim whitespace between ":"
 *  - join with newline
 *
 * @param {Object} headers
 * @return {String}
 * @api private
 */

function canonicalizeHeaders (headers) {
  var buf = []
    , fields = Object.keys(headers)
    ;
  for (var i = 0, len = fields.length; i < len; ++i) {
    var field = fields[i]
      , val = headers[field]
      , field = field.toLowerCase()
      ;
    if (0 !== field.indexOf('x-amz')) continue
    buf.push(field + ':' + val)
  }
  return buf.sort().join('\n')
}
module.exports.canonicalizeHeaders = canonicalizeHeaders

/**
 * Perform the following:
 *
 *  - ignore non sub-resources
 *  - sort lexicographically
 *
 * @param {String} resource
 * @return {String}
 * @api private
 */

function canonicalizeResource (resource) {
  var url = parse(resource, true)
    , path = url.pathname
    , buf = []
    ;

  Object.keys(url.query).forEach(function(key){
    if (!~keys.indexOf(key)) return
    var val = '' == url.query[key] ? '' : '=' + encodeURIComponent(url.query[key])
    buf.push(key + val)
  })

  return path + (buf.length ? '?' + buf.sort().join('&') : '')
}
module.exports.canonicalizeResource = canonicalizeResource

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845848);
})()
//# sourceMappingURL=index.js.map