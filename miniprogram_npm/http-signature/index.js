module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845889, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

var parser = require('./parser');
var signer = require('./signer');
var verify = require('./verify');
var utils = require('./utils');



///--- API

module.exports = {

  parse: parser.parseRequest,
  parseRequest: parser.parseRequest,

  sign: signer.signRequest,
  signRequest: signer.signRequest,
  createSigner: signer.createSigner,
  isSigner: signer.isSigner,

  sshKeyToPEM: utils.sshKeyToPEM,
  sshKeyFingerprint: utils.fingerprint,
  pemToRsaSSHKey: utils.pemToRsaSSHKey,

  verify: verify.verifySignature,
  verifySignature: verify.verifySignature,
  verifyHMAC: verify.verifyHMAC
};

}, function(modId) {var map = {"./parser":1572231845890,"./signer":1572231845892,"./verify":1572231845893,"./utils":1572231845891}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845890, function(require, module, exports) {
// Copyright 2012 Joyent, Inc.  All rights reserved.

var assert = require('assert-plus');
var util = require('util');
var utils = require('./utils');



///--- Globals

var HASH_ALGOS = utils.HASH_ALGOS;
var PK_ALGOS = utils.PK_ALGOS;
var HttpSignatureError = utils.HttpSignatureError;
var InvalidAlgorithmError = utils.InvalidAlgorithmError;
var validateAlgorithm = utils.validateAlgorithm;

var State = {
  New: 0,
  Params: 1
};

var ParamsState = {
  Name: 0,
  Quote: 1,
  Value: 2,
  Comma: 3
};


///--- Specific Errors


function ExpiredRequestError(message) {
  HttpSignatureError.call(this, message, ExpiredRequestError);
}
util.inherits(ExpiredRequestError, HttpSignatureError);


function InvalidHeaderError(message) {
  HttpSignatureError.call(this, message, InvalidHeaderError);
}
util.inherits(InvalidHeaderError, HttpSignatureError);


function InvalidParamsError(message) {
  HttpSignatureError.call(this, message, InvalidParamsError);
}
util.inherits(InvalidParamsError, HttpSignatureError);


function MissingHeaderError(message) {
  HttpSignatureError.call(this, message, MissingHeaderError);
}
util.inherits(MissingHeaderError, HttpSignatureError);

function StrictParsingError(message) {
  HttpSignatureError.call(this, message, StrictParsingError);
}
util.inherits(StrictParsingError, HttpSignatureError);

///--- Exported API

module.exports = {

  /**
   * Parses the 'Authorization' header out of an http.ServerRequest object.
   *
   * Note that this API will fully validate the Authorization header, and throw
   * on any error.  It will not however check the signature, or the keyId format
   * as those are specific to your environment.  You can use the options object
   * to pass in extra constraints.
   *
   * As a response object you can expect this:
   *
   *     {
   *       "scheme": "Signature",
   *       "params": {
   *         "keyId": "foo",
   *         "algorithm": "rsa-sha256",
   *         "headers": [
   *           "date" or "x-date",
   *           "digest"
   *         ],
   *         "signature": "base64"
   *       },
   *       "signingString": "ready to be passed to crypto.verify()"
   *     }
   *
   * @param {Object} request an http.ServerRequest.
   * @param {Object} options an optional options object with:
   *                   - clockSkew: allowed clock skew in seconds (default 300).
   *                   - headers: required header names (def: date or x-date)
   *                   - algorithms: algorithms to support (default: all).
   *                   - strict: should enforce latest spec parsing
   *                             (default: false).
   * @return {Object} parsed out object (see above).
   * @throws {TypeError} on invalid input.
   * @throws {InvalidHeaderError} on an invalid Authorization header error.
   * @throws {InvalidParamsError} if the params in the scheme are invalid.
   * @throws {MissingHeaderError} if the params indicate a header not present,
   *                              either in the request headers from the params,
   *                              or not in the params from a required header
   *                              in options.
   * @throws {StrictParsingError} if old attributes are used in strict parsing
   *                              mode.
   * @throws {ExpiredRequestError} if the value of date or x-date exceeds skew.
   */
  parseRequest: function parseRequest(request, options) {
    assert.object(request, 'request');
    assert.object(request.headers, 'request.headers');
    if (options === undefined) {
      options = {};
    }
    if (options.headers === undefined) {
      options.headers = [request.headers['x-date'] ? 'x-date' : 'date'];
    }
    assert.object(options, 'options');
    assert.arrayOfString(options.headers, 'options.headers');
    assert.optionalFinite(options.clockSkew, 'options.clockSkew');

    var authzHeaderName = options.authorizationHeaderName || 'authorization';

    if (!request.headers[authzHeaderName]) {
      throw new MissingHeaderError('no ' + authzHeaderName + ' header ' +
                                   'present in the request');
    }

    options.clockSkew = options.clockSkew || 300;


    var i = 0;
    var state = State.New;
    var substate = ParamsState.Name;
    var tmpName = '';
    var tmpValue = '';

    var parsed = {
      scheme: '',
      params: {},
      signingString: ''
    };

    var authz = request.headers[authzHeaderName];
    for (i = 0; i < authz.length; i++) {
      var c = authz.charAt(i);

      switch (Number(state)) {

      case State.New:
        if (c !== ' ') parsed.scheme += c;
        else state = State.Params;
        break;

      case State.Params:
        switch (Number(substate)) {

        case ParamsState.Name:
          var code = c.charCodeAt(0);
          // restricted name of A-Z / a-z
          if ((code >= 0x41 && code <= 0x5a) || // A-Z
              (code >= 0x61 && code <= 0x7a)) { // a-z
            tmpName += c;
          } else if (c === '=') {
            if (tmpName.length === 0)
              throw new InvalidHeaderError('bad param format');
            substate = ParamsState.Quote;
          } else {
            throw new InvalidHeaderError('bad param format');
          }
          break;

        case ParamsState.Quote:
          if (c === '"') {
            tmpValue = '';
            substate = ParamsState.Value;
          } else {
            throw new InvalidHeaderError('bad param format');
          }
          break;

        case ParamsState.Value:
          if (c === '"') {
            parsed.params[tmpName] = tmpValue;
            substate = ParamsState.Comma;
          } else {
            tmpValue += c;
          }
          break;

        case ParamsState.Comma:
          if (c === ',') {
            tmpName = '';
            substate = ParamsState.Name;
          } else {
            throw new InvalidHeaderError('bad param format');
          }
          break;

        default:
          throw new Error('Invalid substate');
        }
        break;

      default:
        throw new Error('Invalid substate');
      }

    }

    if (!parsed.params.headers || parsed.params.headers === '') {
      if (request.headers['x-date']) {
        parsed.params.headers = ['x-date'];
      } else {
        parsed.params.headers = ['date'];
      }
    } else {
      parsed.params.headers = parsed.params.headers.split(' ');
    }

    // Minimally validate the parsed object
    if (!parsed.scheme || parsed.scheme !== 'Signature')
      throw new InvalidHeaderError('scheme was not "Signature"');

    if (!parsed.params.keyId)
      throw new InvalidHeaderError('keyId was not specified');

    if (!parsed.params.algorithm)
      throw new InvalidHeaderError('algorithm was not specified');

    if (!parsed.params.signature)
      throw new InvalidHeaderError('signature was not specified');

    // Check the algorithm against the official list
    parsed.params.algorithm = parsed.params.algorithm.toLowerCase();
    try {
      validateAlgorithm(parsed.params.algorithm);
    } catch (e) {
      if (e instanceof InvalidAlgorithmError)
        throw (new InvalidParamsError(parsed.params.algorithm + ' is not ' +
          'supported'));
      else
        throw (e);
    }

    // Build the signingString
    for (i = 0; i < parsed.params.headers.length; i++) {
      var h = parsed.params.headers[i].toLowerCase();
      parsed.params.headers[i] = h;

      if (h === 'request-line') {
        if (!options.strict) {
          /*
           * We allow headers from the older spec drafts if strict parsing isn't
           * specified in options.
           */
          parsed.signingString +=
            request.method + ' ' + request.url + ' HTTP/' + request.httpVersion;
        } else {
          /* Strict parsing doesn't allow older draft headers. */
          throw (new StrictParsingError('request-line is not a valid header ' +
            'with strict parsing enabled.'));
        }
      } else if (h === '(request-target)') {
        parsed.signingString +=
          '(request-target): ' + request.method.toLowerCase() + ' ' +
          request.url;
      } else {
        var value = request.headers[h];
        if (value === undefined)
          throw new MissingHeaderError(h + ' was not in the request');
        parsed.signingString += h + ': ' + value;
      }

      if ((i + 1) < parsed.params.headers.length)
        parsed.signingString += '\n';
    }

    // Check against the constraints
    var date;
    if (request.headers.date || request.headers['x-date']) {
        if (request.headers['x-date']) {
          date = new Date(request.headers['x-date']);
        } else {
          date = new Date(request.headers.date);
        }
      var now = new Date();
      var skew = Math.abs(now.getTime() - date.getTime());

      if (skew > options.clockSkew * 1000) {
        throw new ExpiredRequestError('clock skew of ' +
                                      (skew / 1000) +
                                      's was greater than ' +
                                      options.clockSkew + 's');
      }
    }

    options.headers.forEach(function (hdr) {
      // Remember that we already checked any headers in the params
      // were in the request, so if this passes we're good.
      if (parsed.params.headers.indexOf(hdr.toLowerCase()) < 0)
        throw new MissingHeaderError(hdr + ' was not a signed header');
    });

    if (options.algorithms) {
      if (options.algorithms.indexOf(parsed.params.algorithm) === -1)
        throw new InvalidParamsError(parsed.params.algorithm +
                                     ' is not a supported algorithm');
    }

    parsed.algorithm = parsed.params.algorithm.toUpperCase();
    parsed.keyId = parsed.params.keyId;
    return parsed;
  }

};

}, function(modId) { var map = {"./utils":1572231845891}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845891, function(require, module, exports) {
// Copyright 2012 Joyent, Inc.  All rights reserved.

var assert = require('assert-plus');
var sshpk = require('sshpk');
var util = require('util');

var HASH_ALGOS = {
  'sha1': true,
  'sha256': true,
  'sha512': true
};

var PK_ALGOS = {
  'rsa': true,
  'dsa': true,
  'ecdsa': true
};

function HttpSignatureError(message, caller) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller || HttpSignatureError);

  this.message = message;
  this.name = caller.name;
}
util.inherits(HttpSignatureError, Error);

function InvalidAlgorithmError(message) {
  HttpSignatureError.call(this, message, InvalidAlgorithmError);
}
util.inherits(InvalidAlgorithmError, HttpSignatureError);

function validateAlgorithm(algorithm) {
  var alg = algorithm.toLowerCase().split('-');

  if (alg.length !== 2) {
    throw (new InvalidAlgorithmError(alg[0].toUpperCase() + ' is not a ' +
      'valid algorithm'));
  }

  if (alg[0] !== 'hmac' && !PK_ALGOS[alg[0]]) {
    throw (new InvalidAlgorithmError(alg[0].toUpperCase() + ' type keys ' +
      'are not supported'));
  }

  if (!HASH_ALGOS[alg[1]]) {
    throw (new InvalidAlgorithmError(alg[1].toUpperCase() + ' is not a ' +
      'supported hash algorithm'));
  }

  return (alg);
}

///--- API

module.exports = {

  HASH_ALGOS: HASH_ALGOS,
  PK_ALGOS: PK_ALGOS,

  HttpSignatureError: HttpSignatureError,
  InvalidAlgorithmError: InvalidAlgorithmError,

  validateAlgorithm: validateAlgorithm,

  /**
   * Converts an OpenSSH public key (rsa only) to a PKCS#8 PEM file.
   *
   * The intent of this module is to interoperate with OpenSSL only,
   * specifically the node crypto module's `verify` method.
   *
   * @param {String} key an OpenSSH public key.
   * @return {String} PEM encoded form of the RSA public key.
   * @throws {TypeError} on bad input.
   * @throws {Error} on invalid ssh key formatted data.
   */
  sshKeyToPEM: function sshKeyToPEM(key) {
    assert.string(key, 'ssh_key');

    var k = sshpk.parseKey(key, 'ssh');
    return (k.toString('pem'));
  },


  /**
   * Generates an OpenSSH fingerprint from an ssh public key.
   *
   * @param {String} key an OpenSSH public key.
   * @return {String} key fingerprint.
   * @throws {TypeError} on bad input.
   * @throws {Error} if what you passed doesn't look like an ssh public key.
   */
  fingerprint: function fingerprint(key) {
    assert.string(key, 'ssh_key');

    var k = sshpk.parseKey(key, 'ssh');
    return (k.fingerprint('md5').toString('hex'));
  },

  /**
   * Converts a PKGCS#8 PEM file to an OpenSSH public key (rsa)
   *
   * The reverse of the above function.
   */
  pemToRsaSSHKey: function pemToRsaSSHKey(pem, comment) {
    assert.equal('string', typeof (pem), 'typeof pem');

    var k = sshpk.parseKey(pem, 'pem');
    k.comment = comment;
    return (k.toString('ssh'));
  }
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845892, function(require, module, exports) {
// Copyright 2012 Joyent, Inc.  All rights reserved.

var assert = require('assert-plus');
var crypto = require('crypto');
var http = require('http');
var util = require('util');
var sshpk = require('sshpk');
var jsprim = require('jsprim');
var utils = require('./utils');

var sprintf = require('util').format;

var HASH_ALGOS = utils.HASH_ALGOS;
var PK_ALGOS = utils.PK_ALGOS;
var InvalidAlgorithmError = utils.InvalidAlgorithmError;
var HttpSignatureError = utils.HttpSignatureError;
var validateAlgorithm = utils.validateAlgorithm;

///--- Globals

var AUTHZ_FMT =
  'Signature keyId="%s",algorithm="%s",headers="%s",signature="%s"';

///--- Specific Errors

function MissingHeaderError(message) {
  HttpSignatureError.call(this, message, MissingHeaderError);
}
util.inherits(MissingHeaderError, HttpSignatureError);

function StrictParsingError(message) {
  HttpSignatureError.call(this, message, StrictParsingError);
}
util.inherits(StrictParsingError, HttpSignatureError);

/* See createSigner() */
function RequestSigner(options) {
  assert.object(options, 'options');

  var alg = [];
  if (options.algorithm !== undefined) {
    assert.string(options.algorithm, 'options.algorithm');
    alg = validateAlgorithm(options.algorithm);
  }
  this.rs_alg = alg;

  /*
   * RequestSigners come in two varieties: ones with an rs_signFunc, and ones
   * with an rs_signer.
   *
   * rs_signFunc-based RequestSigners have to build up their entire signing
   * string within the rs_lines array and give it to rs_signFunc as a single
   * concat'd blob. rs_signer-based RequestSigners can add a line at a time to
   * their signing state by using rs_signer.update(), thus only needing to
   * buffer the hash function state and one line at a time.
   */
  if (options.sign !== undefined) {
    assert.func(options.sign, 'options.sign');
    this.rs_signFunc = options.sign;

  } else if (alg[0] === 'hmac' && options.key !== undefined) {
    assert.string(options.keyId, 'options.keyId');
    this.rs_keyId = options.keyId;

    if (typeof (options.key) !== 'string' && !Buffer.isBuffer(options.key))
      throw (new TypeError('options.key for HMAC must be a string or Buffer'));

    /*
     * Make an rs_signer for HMACs, not a rs_signFunc -- HMACs digest their
     * data in chunks rather than requiring it all to be given in one go
     * at the end, so they are more similar to signers than signFuncs.
     */
    this.rs_signer = crypto.createHmac(alg[1].toUpperCase(), options.key);
    this.rs_signer.sign = function () {
      var digest = this.digest('base64');
      return ({
        hashAlgorithm: alg[1],
        toString: function () { return (digest); }
      });
    };

  } else if (options.key !== undefined) {
    var key = options.key;
    if (typeof (key) === 'string' || Buffer.isBuffer(key))
      key = sshpk.parsePrivateKey(key);

    assert.ok(sshpk.PrivateKey.isPrivateKey(key, [1, 2]),
      'options.key must be a sshpk.PrivateKey');
    this.rs_key = key;

    assert.string(options.keyId, 'options.keyId');
    this.rs_keyId = options.keyId;

    if (!PK_ALGOS[key.type]) {
      throw (new InvalidAlgorithmError(key.type.toUpperCase() + ' type ' +
        'keys are not supported'));
    }

    if (alg[0] !== undefined && key.type !== alg[0]) {
      throw (new InvalidAlgorithmError('options.key must be a ' +
        alg[0].toUpperCase() + ' key, was given a ' +
        key.type.toUpperCase() + ' key instead'));
    }

    this.rs_signer = key.createSign(alg[1]);

  } else {
    throw (new TypeError('options.sign (func) or options.key is required'));
  }

  this.rs_headers = [];
  this.rs_lines = [];
}

/**
 * Adds a header to be signed, with its value, into this signer.
 *
 * @param {String} header
 * @param {String} value
 * @return {String} value written
 */
RequestSigner.prototype.writeHeader = function (header, value) {
  assert.string(header, 'header');
  header = header.toLowerCase();
  assert.string(value, 'value');

  this.rs_headers.push(header);

  if (this.rs_signFunc) {
    this.rs_lines.push(header + ': ' + value);

  } else {
    var line = header + ': ' + value;
    if (this.rs_headers.length > 0)
      line = '\n' + line;
    this.rs_signer.update(line);
  }

  return (value);
};

/**
 * Adds a default Date header, returning its value.
 *
 * @return {String}
 */
RequestSigner.prototype.writeDateHeader = function () {
  return (this.writeHeader('date', jsprim.rfc1123(new Date())));
};

/**
 * Adds the request target line to be signed.
 *
 * @param {String} method, HTTP method (e.g. 'get', 'post', 'put')
 * @param {String} path
 */
RequestSigner.prototype.writeTarget = function (method, path) {
  assert.string(method, 'method');
  assert.string(path, 'path');
  method = method.toLowerCase();
  this.writeHeader('(request-target)', method + ' ' + path);
};

/**
 * Calculate the value for the Authorization header on this request
 * asynchronously.
 *
 * @param {Func} callback (err, authz)
 */
RequestSigner.prototype.sign = function (cb) {
  assert.func(cb, 'callback');

  if (this.rs_headers.length < 1)
    throw (new Error('At least one header must be signed'));

  var alg, authz;
  if (this.rs_signFunc) {
    var data = this.rs_lines.join('\n');
    var self = this;
    this.rs_signFunc(data, function (err, sig) {
      if (err) {
        cb(err);
        return;
      }
      try {
        assert.object(sig, 'signature');
        assert.string(sig.keyId, 'signature.keyId');
        assert.string(sig.algorithm, 'signature.algorithm');
        assert.string(sig.signature, 'signature.signature');
        alg = validateAlgorithm(sig.algorithm);

        authz = sprintf(AUTHZ_FMT,
          sig.keyId,
          sig.algorithm,
          self.rs_headers.join(' '),
          sig.signature);
      } catch (e) {
        cb(e);
        return;
      }
      cb(null, authz);
    });

  } else {
    try {
      var sigObj = this.rs_signer.sign();
    } catch (e) {
      cb(e);
      return;
    }
    alg = (this.rs_alg[0] || this.rs_key.type) + '-' + sigObj.hashAlgorithm;
    var signature = sigObj.toString();
    authz = sprintf(AUTHZ_FMT,
      this.rs_keyId,
      alg,
      this.rs_headers.join(' '),
      signature);
    cb(null, authz);
  }
};

///--- Exported API

module.exports = {
  /**
   * Identifies whether a given object is a request signer or not.
   *
   * @param {Object} object, the object to identify
   * @returns {Boolean}
   */
  isSigner: function (obj) {
    if (typeof (obj) === 'object' && obj instanceof RequestSigner)
      return (true);
    return (false);
  },

  /**
   * Creates a request signer, used to asynchronously build a signature
   * for a request (does not have to be an http.ClientRequest).
   *
   * @param {Object} options, either:
   *                   - {String} keyId
   *                   - {String|Buffer} key
   *                   - {String} algorithm (optional, required for HMAC)
   *                 or:
   *                   - {Func} sign (data, cb)
   * @return {RequestSigner}
   */
  createSigner: function createSigner(options) {
    return (new RequestSigner(options));
  },

  /**
   * Adds an 'Authorization' header to an http.ClientRequest object.
   *
   * Note that this API will add a Date header if it's not already set. Any
   * other headers in the options.headers array MUST be present, or this
   * will throw.
   *
   * You shouldn't need to check the return type; it's just there if you want
   * to be pedantic.
   *
   * The optional flag indicates whether parsing should use strict enforcement
   * of the version draft-cavage-http-signatures-04 of the spec or beyond.
   * The default is to be loose and support
   * older versions for compatibility.
   *
   * @param {Object} request an instance of http.ClientRequest.
   * @param {Object} options signing parameters object:
   *                   - {String} keyId required.
   *                   - {String} key required (either a PEM or HMAC key).
   *                   - {Array} headers optional; defaults to ['date'].
   *                   - {String} algorithm optional (unless key is HMAC);
   *                              default is the same as the sshpk default
   *                              signing algorithm for the type of key given
   *                   - {String} httpVersion optional; defaults to '1.1'.
   *                   - {Boolean} strict optional; defaults to 'false'.
   * @return {Boolean} true if Authorization (and optionally Date) were added.
   * @throws {TypeError} on bad parameter types (input).
   * @throws {InvalidAlgorithmError} if algorithm was bad or incompatible with
   *                                 the given key.
   * @throws {sshpk.KeyParseError} if key was bad.
   * @throws {MissingHeaderError} if a header to be signed was specified but
   *                              was not present.
   */
  signRequest: function signRequest(request, options) {
    assert.object(request, 'request');
    assert.object(options, 'options');
    assert.optionalString(options.algorithm, 'options.algorithm');
    assert.string(options.keyId, 'options.keyId');
    assert.optionalArrayOfString(options.headers, 'options.headers');
    assert.optionalString(options.httpVersion, 'options.httpVersion');

    if (!request.getHeader('Date'))
      request.setHeader('Date', jsprim.rfc1123(new Date()));
    if (!options.headers)
      options.headers = ['date'];
    if (!options.httpVersion)
      options.httpVersion = '1.1';

    var alg = [];
    if (options.algorithm) {
      options.algorithm = options.algorithm.toLowerCase();
      alg = validateAlgorithm(options.algorithm);
    }

    var i;
    var stringToSign = '';
    for (i = 0; i < options.headers.length; i++) {
      if (typeof (options.headers[i]) !== 'string')
        throw new TypeError('options.headers must be an array of Strings');

      var h = options.headers[i].toLowerCase();

      if (h === 'request-line') {
        if (!options.strict) {
          /**
           * We allow headers from the older spec drafts if strict parsing isn't
           * specified in options.
           */
          stringToSign +=
            request.method + ' ' + request.path + ' HTTP/' +
            options.httpVersion;
        } else {
          /* Strict parsing doesn't allow older draft headers. */
          throw (new StrictParsingError('request-line is not a valid header ' +
            'with strict parsing enabled.'));
        }
      } else if (h === '(request-target)') {
        stringToSign +=
          '(request-target): ' + request.method.toLowerCase() + ' ' +
          request.path;
      } else {
        var value = request.getHeader(h);
        if (value === undefined || value === '') {
          throw new MissingHeaderError(h + ' was not in the request');
        }
        stringToSign += h + ': ' + value;
      }

      if ((i + 1) < options.headers.length)
        stringToSign += '\n';
    }

    /* This is just for unit tests. */
    if (request.hasOwnProperty('_stringToSign')) {
      request._stringToSign = stringToSign;
    }

    var signature;
    if (alg[0] === 'hmac') {
      if (typeof (options.key) !== 'string' && !Buffer.isBuffer(options.key))
        throw (new TypeError('options.key must be a string or Buffer'));

      var hmac = crypto.createHmac(alg[1].toUpperCase(), options.key);
      hmac.update(stringToSign);
      signature = hmac.digest('base64');

    } else {
      var key = options.key;
      if (typeof (key) === 'string' || Buffer.isBuffer(key))
        key = sshpk.parsePrivateKey(options.key);

      assert.ok(sshpk.PrivateKey.isPrivateKey(key, [1, 2]),
        'options.key must be a sshpk.PrivateKey');

      if (!PK_ALGOS[key.type]) {
        throw (new InvalidAlgorithmError(key.type.toUpperCase() + ' type ' +
          'keys are not supported'));
      }

      if (alg[0] !== undefined && key.type !== alg[0]) {
        throw (new InvalidAlgorithmError('options.key must be a ' +
          alg[0].toUpperCase() + ' key, was given a ' +
          key.type.toUpperCase() + ' key instead'));
      }

      var signer = key.createSign(alg[1]);
      signer.update(stringToSign);
      var sigObj = signer.sign();
      if (!HASH_ALGOS[sigObj.hashAlgorithm]) {
        throw (new InvalidAlgorithmError(sigObj.hashAlgorithm.toUpperCase() +
          ' is not a supported hash algorithm'));
      }
      options.algorithm = key.type + '-' + sigObj.hashAlgorithm;
      signature = sigObj.toString();
      assert.notStrictEqual(signature, '', 'empty signature produced');
    }

    var authzHeaderName = options.authorizationHeaderName || 'Authorization';

    request.setHeader(authzHeaderName, sprintf(AUTHZ_FMT,
                                               options.keyId,
                                               options.algorithm,
                                               options.headers.join(' '),
                                               signature));

    return true;
  }

};

}, function(modId) { var map = {"./utils":1572231845891}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845893, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

var assert = require('assert-plus');
var crypto = require('crypto');
var sshpk = require('sshpk');
var utils = require('./utils');

var HASH_ALGOS = utils.HASH_ALGOS;
var PK_ALGOS = utils.PK_ALGOS;
var InvalidAlgorithmError = utils.InvalidAlgorithmError;
var HttpSignatureError = utils.HttpSignatureError;
var validateAlgorithm = utils.validateAlgorithm;

///--- Exported API

module.exports = {
  /**
   * Verify RSA/DSA signature against public key.  You are expected to pass in
   * an object that was returned from `parse()`.
   *
   * @param {Object} parsedSignature the object you got from `parse`.
   * @param {String} pubkey RSA/DSA private key PEM.
   * @return {Boolean} true if valid, false otherwise.
   * @throws {TypeError} if you pass in bad arguments.
   * @throws {InvalidAlgorithmError}
   */
  verifySignature: function verifySignature(parsedSignature, pubkey) {
    assert.object(parsedSignature, 'parsedSignature');
    if (typeof (pubkey) === 'string' || Buffer.isBuffer(pubkey))
      pubkey = sshpk.parseKey(pubkey);
    assert.ok(sshpk.Key.isKey(pubkey, [1, 1]), 'pubkey must be a sshpk.Key');

    var alg = validateAlgorithm(parsedSignature.algorithm);
    if (alg[0] === 'hmac' || alg[0] !== pubkey.type)
      return (false);

    var v = pubkey.createVerify(alg[1]);
    v.update(parsedSignature.signingString);
    return (v.verify(parsedSignature.params.signature, 'base64'));
  },

  /**
   * Verify HMAC against shared secret.  You are expected to pass in an object
   * that was returned from `parse()`.
   *
   * @param {Object} parsedSignature the object you got from `parse`.
   * @param {String} secret HMAC shared secret.
   * @return {Boolean} true if valid, false otherwise.
   * @throws {TypeError} if you pass in bad arguments.
   * @throws {InvalidAlgorithmError}
   */
  verifyHMAC: function verifyHMAC(parsedSignature, secret) {
    assert.object(parsedSignature, 'parsedHMAC');
    assert.string(secret, 'secret');

    var alg = validateAlgorithm(parsedSignature.algorithm);
    if (alg[0] !== 'hmac')
      return (false);

    var hashAlg = alg[1].toUpperCase();

    var hmac = crypto.createHmac(hashAlg, secret);
    hmac.update(parsedSignature.signingString);

    /*
     * Now double-hash to avoid leaking timing information - there's
     * no easy constant-time compare in JS, so we use this approach
     * instead. See for more info:
     * https://www.isecpartners.com/blog/2011/february/double-hmac-
     * verification.aspx
     */
    var h1 = crypto.createHmac(hashAlg, secret);
    h1.update(hmac.digest());
    h1 = h1.digest();
    var h2 = crypto.createHmac(hashAlg, secret);
    h2.update(new Buffer(parsedSignature.params.signature, 'base64'));
    h2 = h2.digest();

    /* Node 0.8 returns strings from .digest(). */
    if (typeof (h1) === 'string')
      return (h1 === h2);
    /* And node 0.10 lacks the .equals() method on Buffers. */
    if (Buffer.isBuffer(h1) && !h1.equals)
      return (h1.toString('binary') === h2.toString('binary'));

    return (h1.equals(h2));
  }
};

}, function(modId) { var map = {"./utils":1572231845891}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845889);
})()
//# sourceMappingURL=index.js.map