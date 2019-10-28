module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845934, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

var Key = require('./key');
var Fingerprint = require('./fingerprint');
var Signature = require('./signature');
var PrivateKey = require('./private-key');
var Certificate = require('./certificate');
var Identity = require('./identity');
var errs = require('./errors');

module.exports = {
	/* top-level classes */
	Key: Key,
	parseKey: Key.parse,
	Fingerprint: Fingerprint,
	parseFingerprint: Fingerprint.parse,
	Signature: Signature,
	parseSignature: Signature.parse,
	PrivateKey: PrivateKey,
	parsePrivateKey: PrivateKey.parse,
	generatePrivateKey: PrivateKey.generate,
	Certificate: Certificate,
	parseCertificate: Certificate.parse,
	createSelfSignedCertificate: Certificate.createSelfSigned,
	createCertificate: Certificate.create,
	Identity: Identity,
	identityFromDN: Identity.parseDN,
	identityForHost: Identity.forHost,
	identityForUser: Identity.forUser,
	identityForEmail: Identity.forEmail,
	identityFromArray: Identity.fromArray,

	/* errors */
	FingerprintFormatError: errs.FingerprintFormatError,
	InvalidAlgorithmError: errs.InvalidAlgorithmError,
	KeyParseError: errs.KeyParseError,
	SignatureParseError: errs.SignatureParseError,
	KeyEncryptedError: errs.KeyEncryptedError,
	CertificateParseError: errs.CertificateParseError
};

}, function(modId) {var map = {"./key":1572231845935,"./fingerprint":1572231845937,"./signature":1572231845940,"./private-key":1572231845939,"./certificate":1572231845954,"./identity":1572231845955,"./errors":1572231845938}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845935, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = Key;

var assert = require('assert-plus');
var algs = require('./algs');
var crypto = require('crypto');
var Fingerprint = require('./fingerprint');
var Signature = require('./signature');
var DiffieHellman = require('./dhe').DiffieHellman;
var errs = require('./errors');
var utils = require('./utils');
var PrivateKey = require('./private-key');
var edCompat;

try {
	edCompat = require('./ed-compat');
} catch (e) {
	/* Just continue through, and bail out if we try to use it. */
}

var InvalidAlgorithmError = errs.InvalidAlgorithmError;
var KeyParseError = errs.KeyParseError;

var formats = {};
formats['auto'] = require('./formats/auto');
formats['pem'] = require('./formats/pem');
formats['pkcs1'] = require('./formats/pkcs1');
formats['pkcs8'] = require('./formats/pkcs8');
formats['rfc4253'] = require('./formats/rfc4253');
formats['ssh'] = require('./formats/ssh');
formats['ssh-private'] = require('./formats/ssh-private');
formats['openssh'] = formats['ssh-private'];
formats['dnssec'] = require('./formats/dnssec');
formats['putty'] = require('./formats/putty');
formats['ppk'] = formats['putty'];

function Key(opts) {
	assert.object(opts, 'options');
	assert.arrayOfObject(opts.parts, 'options.parts');
	assert.string(opts.type, 'options.type');
	assert.optionalString(opts.comment, 'options.comment');

	var algInfo = algs.info[opts.type];
	if (typeof (algInfo) !== 'object')
		throw (new InvalidAlgorithmError(opts.type));

	var partLookup = {};
	for (var i = 0; i < opts.parts.length; ++i) {
		var part = opts.parts[i];
		partLookup[part.name] = part;
	}

	this.type = opts.type;
	this.parts = opts.parts;
	this.part = partLookup;
	this.comment = undefined;
	this.source = opts.source;

	/* for speeding up hashing/fingerprint operations */
	this._rfc4253Cache = opts._rfc4253Cache;
	this._hashCache = {};

	var sz;
	this.curve = undefined;
	if (this.type === 'ecdsa') {
		var curve = this.part.curve.data.toString();
		this.curve = curve;
		sz = algs.curves[curve].size;
	} else if (this.type === 'ed25519' || this.type === 'curve25519') {
		sz = 256;
		this.curve = 'curve25519';
	} else {
		var szPart = this.part[algInfo.sizePart];
		sz = szPart.data.length;
		sz = sz * 8 - utils.countZeros(szPart.data);
	}
	this.size = sz;
}

Key.formats = formats;

Key.prototype.toBuffer = function (format, options) {
	if (format === undefined)
		format = 'ssh';
	assert.string(format, 'format');
	assert.object(formats[format], 'formats[format]');
	assert.optionalObject(options, 'options');

	if (format === 'rfc4253') {
		if (this._rfc4253Cache === undefined)
			this._rfc4253Cache = formats['rfc4253'].write(this);
		return (this._rfc4253Cache);
	}

	return (formats[format].write(this, options));
};

Key.prototype.toString = function (format, options) {
	return (this.toBuffer(format, options).toString());
};

Key.prototype.hash = function (algo, type) {
	assert.string(algo, 'algorithm');
	assert.optionalString(type, 'type');
	if (type === undefined)
		type = 'ssh';
	algo = algo.toLowerCase();
	if (algs.hashAlgs[algo] === undefined)
		throw (new InvalidAlgorithmError(algo));

	var cacheKey = algo + '||' + type;
	if (this._hashCache[cacheKey])
		return (this._hashCache[cacheKey]);

	var buf;
	if (type === 'ssh') {
		buf = this.toBuffer('rfc4253');
	} else if (type === 'spki') {
		buf = formats.pkcs8.pkcs8ToBuffer(this);
	} else {
		throw (new Error('Hash type ' + type + ' not supported'));
	}
	var hash = crypto.createHash(algo).update(buf).digest();
	this._hashCache[cacheKey] = hash;
	return (hash);
};

Key.prototype.fingerprint = function (algo, type) {
	if (algo === undefined)
		algo = 'sha256';
	if (type === undefined)
		type = 'ssh';
	assert.string(algo, 'algorithm');
	assert.string(type, 'type');
	var opts = {
		type: 'key',
		hash: this.hash(algo, type),
		algorithm: algo,
		hashType: type
	};
	return (new Fingerprint(opts));
};

Key.prototype.defaultHashAlgorithm = function () {
	var hashAlgo = 'sha1';
	if (this.type === 'rsa')
		hashAlgo = 'sha256';
	if (this.type === 'dsa' && this.size > 1024)
		hashAlgo = 'sha256';
	if (this.type === 'ed25519')
		hashAlgo = 'sha512';
	if (this.type === 'ecdsa') {
		if (this.size <= 256)
			hashAlgo = 'sha256';
		else if (this.size <= 384)
			hashAlgo = 'sha384';
		else
			hashAlgo = 'sha512';
	}
	return (hashAlgo);
};

Key.prototype.createVerify = function (hashAlgo) {
	if (hashAlgo === undefined)
		hashAlgo = this.defaultHashAlgorithm();
	assert.string(hashAlgo, 'hash algorithm');

	/* ED25519 is not supported by OpenSSL, use a javascript impl. */
	if (this.type === 'ed25519' && edCompat !== undefined)
		return (new edCompat.Verifier(this, hashAlgo));
	if (this.type === 'curve25519')
		throw (new Error('Curve25519 keys are not suitable for ' +
		    'signing or verification'));

	var v, nm, err;
	try {
		nm = hashAlgo.toUpperCase();
		v = crypto.createVerify(nm);
	} catch (e) {
		err = e;
	}
	if (v === undefined || (err instanceof Error &&
	    err.message.match(/Unknown message digest/))) {
		nm = 'RSA-';
		nm += hashAlgo.toUpperCase();
		v = crypto.createVerify(nm);
	}
	assert.ok(v, 'failed to create verifier');
	var oldVerify = v.verify.bind(v);
	var key = this.toBuffer('pkcs8');
	var curve = this.curve;
	var self = this;
	v.verify = function (signature, fmt) {
		if (Signature.isSignature(signature, [2, 0])) {
			if (signature.type !== self.type)
				return (false);
			if (signature.hashAlgorithm &&
			    signature.hashAlgorithm !== hashAlgo)
				return (false);
			if (signature.curve && self.type === 'ecdsa' &&
			    signature.curve !== curve)
				return (false);
			return (oldVerify(key, signature.toBuffer('asn1')));

		} else if (typeof (signature) === 'string' ||
		    Buffer.isBuffer(signature)) {
			return (oldVerify(key, signature, fmt));

		/*
		 * Avoid doing this on valid arguments, walking the prototype
		 * chain can be quite slow.
		 */
		} else if (Signature.isSignature(signature, [1, 0])) {
			throw (new Error('signature was created by too old ' +
			    'a version of sshpk and cannot be verified'));

		} else {
			throw (new TypeError('signature must be a string, ' +
			    'Buffer, or Signature object'));
		}
	};
	return (v);
};

Key.prototype.createDiffieHellman = function () {
	if (this.type === 'rsa')
		throw (new Error('RSA keys do not support Diffie-Hellman'));

	return (new DiffieHellman(this));
};
Key.prototype.createDH = Key.prototype.createDiffieHellman;

Key.parse = function (data, format, options) {
	if (typeof (data) !== 'string')
		assert.buffer(data, 'data');
	if (format === undefined)
		format = 'auto';
	assert.string(format, 'format');
	if (typeof (options) === 'string')
		options = { filename: options };
	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	assert.optionalString(options.filename, 'options.filename');
	if (options.filename === undefined)
		options.filename = '(unnamed)';

	assert.object(formats[format], 'formats[format]');

	try {
		var k = formats[format].read(data, options);
		if (k instanceof PrivateKey)
			k = k.toPublic();
		if (!k.comment)
			k.comment = options.filename;
		return (k);
	} catch (e) {
		if (e.name === 'KeyEncryptedError')
			throw (e);
		throw (new KeyParseError(options.filename, format, e));
	}
};

Key.isKey = function (obj, ver) {
	return (utils.isCompatible(obj, Key, ver));
};

/*
 * API versions for Key:
 * [1,0] -- initial ver, may take Signature for createVerify or may not
 * [1,1] -- added pkcs1, pkcs8 formats
 * [1,2] -- added auto, ssh-private, openssh formats
 * [1,3] -- added defaultHashAlgorithm
 * [1,4] -- added ed support, createDH
 * [1,5] -- first explicitly tagged version
 * [1,6] -- changed ed25519 part names
 * [1,7] -- spki hash types
 */
Key.prototype._sshpkApiVersion = [1, 7];

Key._oldVersionDetect = function (obj) {
	assert.func(obj.toBuffer);
	assert.func(obj.fingerprint);
	if (obj.createDH)
		return ([1, 4]);
	if (obj.defaultHashAlgorithm)
		return ([1, 3]);
	if (obj.formats['auto'])
		return ([1, 2]);
	if (obj.formats['pkcs1'])
		return ([1, 1]);
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./fingerprint":1572231845937,"./signature":1572231845940,"./dhe":1572231845943,"./errors":1572231845938,"./utils":1572231845941,"./private-key":1572231845939,"./ed-compat":1572231845944,"./formats/auto":1572231845945,"./formats/pem":1572231845946,"./formats/pkcs1":1572231845947,"./formats/pkcs8":1572231845948,"./formats/rfc4253":1572231845950,"./formats/ssh":1572231845951,"./formats/ssh-private":1572231845949,"./formats/dnssec":1572231845952,"./formats/putty":1572231845953}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845936, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

var Buffer = require('safer-buffer').Buffer;

var algInfo = {
	'dsa': {
		parts: ['p', 'q', 'g', 'y'],
		sizePart: 'p'
	},
	'rsa': {
		parts: ['e', 'n'],
		sizePart: 'n'
	},
	'ecdsa': {
		parts: ['curve', 'Q'],
		sizePart: 'Q'
	},
	'ed25519': {
		parts: ['A'],
		sizePart: 'A'
	}
};
algInfo['curve25519'] = algInfo['ed25519'];

var algPrivInfo = {
	'dsa': {
		parts: ['p', 'q', 'g', 'y', 'x']
	},
	'rsa': {
		parts: ['n', 'e', 'd', 'iqmp', 'p', 'q']
	},
	'ecdsa': {
		parts: ['curve', 'Q', 'd']
	},
	'ed25519': {
		parts: ['A', 'k']
	}
};
algPrivInfo['curve25519'] = algPrivInfo['ed25519'];

var hashAlgs = {
	'md5': true,
	'sha1': true,
	'sha256': true,
	'sha384': true,
	'sha512': true
};

/*
 * Taken from
 * http://csrc.nist.gov/groups/ST/toolkit/documents/dss/NISTReCur.pdf
 */
var curves = {
	'nistp256': {
		size: 256,
		pkcs8oid: '1.2.840.10045.3.1.7',
		p: Buffer.from(('00' +
		    'ffffffff 00000001 00000000 00000000' +
		    '00000000 ffffffff ffffffff ffffffff').
		    replace(/ /g, ''), 'hex'),
		a: Buffer.from(('00' +
		    'FFFFFFFF 00000001 00000000 00000000' +
		    '00000000 FFFFFFFF FFFFFFFF FFFFFFFC').
		    replace(/ /g, ''), 'hex'),
		b: Buffer.from((
		    '5ac635d8 aa3a93e7 b3ebbd55 769886bc' +
		    '651d06b0 cc53b0f6 3bce3c3e 27d2604b').
		    replace(/ /g, ''), 'hex'),
		s: Buffer.from(('00' +
		    'c49d3608 86e70493 6a6678e1 139d26b7' +
		    '819f7e90').
		    replace(/ /g, ''), 'hex'),
		n: Buffer.from(('00' +
		    'ffffffff 00000000 ffffffff ffffffff' +
		    'bce6faad a7179e84 f3b9cac2 fc632551').
		    replace(/ /g, ''), 'hex'),
		G: Buffer.from(('04' +
		    '6b17d1f2 e12c4247 f8bce6e5 63a440f2' +
		    '77037d81 2deb33a0 f4a13945 d898c296' +
		    '4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16' +
		    '2bce3357 6b315ece cbb64068 37bf51f5').
		    replace(/ /g, ''), 'hex')
	},
	'nistp384': {
		size: 384,
		pkcs8oid: '1.3.132.0.34',
		p: Buffer.from(('00' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff ffffffff fffffffe' +
		    'ffffffff 00000000 00000000 ffffffff').
		    replace(/ /g, ''), 'hex'),
		a: Buffer.from(('00' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE' +
		    'FFFFFFFF 00000000 00000000 FFFFFFFC').
		    replace(/ /g, ''), 'hex'),
		b: Buffer.from((
		    'b3312fa7 e23ee7e4 988e056b e3f82d19' +
		    '181d9c6e fe814112 0314088f 5013875a' +
		    'c656398d 8a2ed19d 2a85c8ed d3ec2aef').
		    replace(/ /g, ''), 'hex'),
		s: Buffer.from(('00' +
		    'a335926a a319a27a 1d00896a 6773a482' +
		    '7acdac73').
		    replace(/ /g, ''), 'hex'),
		n: Buffer.from(('00' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff c7634d81 f4372ddf' +
		    '581a0db2 48b0a77a ecec196a ccc52973').
		    replace(/ /g, ''), 'hex'),
		G: Buffer.from(('04' +
		    'aa87ca22 be8b0537 8eb1c71e f320ad74' +
		    '6e1d3b62 8ba79b98 59f741e0 82542a38' +
		    '5502f25d bf55296c 3a545e38 72760ab7' +
		    '3617de4a 96262c6f 5d9e98bf 9292dc29' +
		    'f8f41dbd 289a147c e9da3113 b5f0b8c0' +
		    '0a60b1ce 1d7e819d 7a431d7c 90ea0e5f').
		    replace(/ /g, ''), 'hex')
	},
	'nistp521': {
		size: 521,
		pkcs8oid: '1.3.132.0.35',
		p: Buffer.from((
		    '01ffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffff').replace(/ /g, ''), 'hex'),
		a: Buffer.from(('01FF' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF' +
		    'FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFC').
		    replace(/ /g, ''), 'hex'),
		b: Buffer.from(('51' +
		    '953eb961 8e1c9a1f 929a21a0 b68540ee' +
		    'a2da725b 99b315f3 b8b48991 8ef109e1' +
		    '56193951 ec7e937b 1652c0bd 3bb1bf07' +
		    '3573df88 3d2c34f1 ef451fd4 6b503f00').
		    replace(/ /g, ''), 'hex'),
		s: Buffer.from(('00' +
		    'd09e8800 291cb853 96cc6717 393284aa' +
		    'a0da64ba').replace(/ /g, ''), 'hex'),
		n: Buffer.from(('01ff' +
		    'ffffffff ffffffff ffffffff ffffffff' +
		    'ffffffff ffffffff ffffffff fffffffa' +
		    '51868783 bf2f966b 7fcc0148 f709a5d0' +
		    '3bb5c9b8 899c47ae bb6fb71e 91386409').
		    replace(/ /g, ''), 'hex'),
		G: Buffer.from(('04' +
		    '00c6 858e06b7 0404e9cd 9e3ecb66 2395b442' +
		         '9c648139 053fb521 f828af60 6b4d3dba' +
		         'a14b5e77 efe75928 fe1dc127 a2ffa8de' +
		         '3348b3c1 856a429b f97e7e31 c2e5bd66' +
		    '0118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9' +
		         '98f54449 579b4468 17afbd17 273e662c' +
		         '97ee7299 5ef42640 c550b901 3fad0761' +
		         '353c7086 a272c240 88be9476 9fd16650').
		    replace(/ /g, ''), 'hex')
	}
};

module.exports = {
	info: algInfo,
	privInfo: algPrivInfo,
	hashAlgs: hashAlgs,
	curves: curves
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845937, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = Fingerprint;

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var algs = require('./algs');
var crypto = require('crypto');
var errs = require('./errors');
var Key = require('./key');
var PrivateKey = require('./private-key');
var Certificate = require('./certificate');
var utils = require('./utils');

var FingerprintFormatError = errs.FingerprintFormatError;
var InvalidAlgorithmError = errs.InvalidAlgorithmError;

function Fingerprint(opts) {
	assert.object(opts, 'options');
	assert.string(opts.type, 'options.type');
	assert.buffer(opts.hash, 'options.hash');
	assert.string(opts.algorithm, 'options.algorithm');

	this.algorithm = opts.algorithm.toLowerCase();
	if (algs.hashAlgs[this.algorithm] !== true)
		throw (new InvalidAlgorithmError(this.algorithm));

	this.hash = opts.hash;
	this.type = opts.type;
	this.hashType = opts.hashType;
}

Fingerprint.prototype.toString = function (format) {
	if (format === undefined) {
		if (this.algorithm === 'md5' || this.hashType === 'spki')
			format = 'hex';
		else
			format = 'base64';
	}
	assert.string(format);

	switch (format) {
	case 'hex':
		if (this.hashType === 'spki')
			return (this.hash.toString('hex'));
		return (addColons(this.hash.toString('hex')));
	case 'base64':
		if (this.hashType === 'spki')
			return (this.hash.toString('base64'));
		return (sshBase64Format(this.algorithm,
		    this.hash.toString('base64')));
	default:
		throw (new FingerprintFormatError(undefined, format));
	}
};

Fingerprint.prototype.matches = function (other) {
	assert.object(other, 'key or certificate');
	if (this.type === 'key' && this.hashType !== 'ssh') {
		utils.assertCompatible(other, Key, [1, 7], 'key with spki');
		if (PrivateKey.isPrivateKey(other)) {
			utils.assertCompatible(other, PrivateKey, [1, 6],
			    'privatekey with spki support');
		}
	} else if (this.type === 'key') {
		utils.assertCompatible(other, Key, [1, 0], 'key');
	} else {
		utils.assertCompatible(other, Certificate, [1, 0],
		    'certificate');
	}

	var theirHash = other.hash(this.algorithm, this.hashType);
	var theirHash2 = crypto.createHash(this.algorithm).
	    update(theirHash).digest('base64');

	if (this.hash2 === undefined)
		this.hash2 = crypto.createHash(this.algorithm).
		    update(this.hash).digest('base64');

	return (this.hash2 === theirHash2);
};

/*JSSTYLED*/
var base64RE = /^[A-Za-z0-9+\/=]+$/;
/*JSSTYLED*/
var hexRE = /^[a-fA-F0-9]+$/;

Fingerprint.parse = function (fp, options) {
	assert.string(fp, 'fingerprint');

	var alg, hash, enAlgs;
	if (Array.isArray(options)) {
		enAlgs = options;
		options = {};
	}
	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	if (options.enAlgs !== undefined)
		enAlgs = options.enAlgs;
	if (options.algorithms !== undefined)
		enAlgs = options.algorithms;
	assert.optionalArrayOfString(enAlgs, 'algorithms');

	var hashType = 'ssh';
	if (options.hashType !== undefined)
		hashType = options.hashType;
	assert.string(hashType, 'options.hashType');

	var parts = fp.split(':');
	if (parts.length == 2) {
		alg = parts[0].toLowerCase();
		if (!base64RE.test(parts[1]))
			throw (new FingerprintFormatError(fp));
		try {
			hash = Buffer.from(parts[1], 'base64');
		} catch (e) {
			throw (new FingerprintFormatError(fp));
		}
	} else if (parts.length > 2) {
		alg = 'md5';
		if (parts[0].toLowerCase() === 'md5')
			parts = parts.slice(1);
		parts = parts.map(function (p) {
			while (p.length < 2)
				p = '0' + p;
			if (p.length > 2)
				throw (new FingerprintFormatError(fp));
			return (p);
		});
		parts = parts.join('');
		if (!hexRE.test(parts) || parts.length % 2 !== 0)
			throw (new FingerprintFormatError(fp));
		try {
			hash = Buffer.from(parts, 'hex');
		} catch (e) {
			throw (new FingerprintFormatError(fp));
		}
	} else {
		if (hexRE.test(fp)) {
			hash = Buffer.from(fp, 'hex');
		} else if (base64RE.test(fp)) {
			hash = Buffer.from(fp, 'base64');
		} else {
			throw (new FingerprintFormatError(fp));
		}

		switch (hash.length) {
		case 32:
			alg = 'sha256';
			break;
		case 16:
			alg = 'md5';
			break;
		case 20:
			alg = 'sha1';
			break;
		case 64:
			alg = 'sha512';
			break;
		default:
			throw (new FingerprintFormatError(fp));
		}

		/* Plain hex/base64: guess it's probably SPKI unless told. */
		if (options.hashType === undefined)
			hashType = 'spki';
	}

	if (alg === undefined)
		throw (new FingerprintFormatError(fp));

	if (algs.hashAlgs[alg] === undefined)
		throw (new InvalidAlgorithmError(alg));

	if (enAlgs !== undefined) {
		enAlgs = enAlgs.map(function (a) { return a.toLowerCase(); });
		if (enAlgs.indexOf(alg) === -1)
			throw (new InvalidAlgorithmError(alg));
	}

	return (new Fingerprint({
		algorithm: alg,
		hash: hash,
		type: options.type || 'key',
		hashType: hashType
	}));
};

function addColons(s) {
	/*JSSTYLED*/
	return (s.replace(/(.{2})(?=.)/g, '$1:'));
}

function base64Strip(s) {
	/*JSSTYLED*/
	return (s.replace(/=*$/, ''));
}

function sshBase64Format(alg, h) {
	return (alg.toUpperCase() + ':' + base64Strip(h));
}

Fingerprint.isFingerprint = function (obj, ver) {
	return (utils.isCompatible(obj, Fingerprint, ver));
};

/*
 * API versions for Fingerprint:
 * [1,0] -- initial ver
 * [1,1] -- first tagged ver
 * [1,2] -- hashType and spki support
 */
Fingerprint.prototype._sshpkApiVersion = [1, 2];

Fingerprint._oldVersionDetect = function (obj) {
	assert.func(obj.toString);
	assert.func(obj.matches);
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./errors":1572231845938,"./key":1572231845935,"./private-key":1572231845939,"./certificate":1572231845954,"./utils":1572231845941}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845938, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

var assert = require('assert-plus');
var util = require('util');

function FingerprintFormatError(fp, format) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, FingerprintFormatError);
	this.name = 'FingerprintFormatError';
	this.fingerprint = fp;
	this.format = format;
	this.message = 'Fingerprint format is not supported, or is invalid: ';
	if (fp !== undefined)
		this.message += ' fingerprint = ' + fp;
	if (format !== undefined)
		this.message += ' format = ' + format;
}
util.inherits(FingerprintFormatError, Error);

function InvalidAlgorithmError(alg) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, InvalidAlgorithmError);
	this.name = 'InvalidAlgorithmError';
	this.algorithm = alg;
	this.message = 'Algorithm "' + alg + '" is not supported';
}
util.inherits(InvalidAlgorithmError, Error);

function KeyParseError(name, format, innerErr) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, KeyParseError);
	this.name = 'KeyParseError';
	this.format = format;
	this.keyName = name;
	this.innerErr = innerErr;
	this.message = 'Failed to parse ' + name + ' as a valid ' + format +
	    ' format key: ' + innerErr.message;
}
util.inherits(KeyParseError, Error);

function SignatureParseError(type, format, innerErr) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, SignatureParseError);
	this.name = 'SignatureParseError';
	this.type = type;
	this.format = format;
	this.innerErr = innerErr;
	this.message = 'Failed to parse the given data as a ' + type +
	    ' signature in ' + format + ' format: ' + innerErr.message;
}
util.inherits(SignatureParseError, Error);

function CertificateParseError(name, format, innerErr) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, CertificateParseError);
	this.name = 'CertificateParseError';
	this.format = format;
	this.certName = name;
	this.innerErr = innerErr;
	this.message = 'Failed to parse ' + name + ' as a valid ' + format +
	    ' format certificate: ' + innerErr.message;
}
util.inherits(CertificateParseError, Error);

function KeyEncryptedError(name, format) {
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, KeyEncryptedError);
	this.name = 'KeyEncryptedError';
	this.format = format;
	this.keyName = name;
	this.message = 'The ' + format + ' format key ' + name + ' is ' +
	    'encrypted (password-protected), and no passphrase was ' +
	    'provided in `options`';
}
util.inherits(KeyEncryptedError, Error);

module.exports = {
	FingerprintFormatError: FingerprintFormatError,
	InvalidAlgorithmError: InvalidAlgorithmError,
	KeyParseError: KeyParseError,
	SignatureParseError: SignatureParseError,
	KeyEncryptedError: KeyEncryptedError,
	CertificateParseError: CertificateParseError
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845939, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = PrivateKey;

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var algs = require('./algs');
var crypto = require('crypto');
var Fingerprint = require('./fingerprint');
var Signature = require('./signature');
var errs = require('./errors');
var util = require('util');
var utils = require('./utils');
var dhe = require('./dhe');
var generateECDSA = dhe.generateECDSA;
var generateED25519 = dhe.generateED25519;
var edCompat = require('./ed-compat');
var nacl = require('tweetnacl');

var Key = require('./key');

var InvalidAlgorithmError = errs.InvalidAlgorithmError;
var KeyParseError = errs.KeyParseError;
var KeyEncryptedError = errs.KeyEncryptedError;

var formats = {};
formats['auto'] = require('./formats/auto');
formats['pem'] = require('./formats/pem');
formats['pkcs1'] = require('./formats/pkcs1');
formats['pkcs8'] = require('./formats/pkcs8');
formats['rfc4253'] = require('./formats/rfc4253');
formats['ssh-private'] = require('./formats/ssh-private');
formats['openssh'] = formats['ssh-private'];
formats['ssh'] = formats['ssh-private'];
formats['dnssec'] = require('./formats/dnssec');

function PrivateKey(opts) {
	assert.object(opts, 'options');
	Key.call(this, opts);

	this._pubCache = undefined;
}
util.inherits(PrivateKey, Key);

PrivateKey.formats = formats;

PrivateKey.prototype.toBuffer = function (format, options) {
	if (format === undefined)
		format = 'pkcs1';
	assert.string(format, 'format');
	assert.object(formats[format], 'formats[format]');
	assert.optionalObject(options, 'options');

	return (formats[format].write(this, options));
};

PrivateKey.prototype.hash = function (algo, type) {
	return (this.toPublic().hash(algo, type));
};

PrivateKey.prototype.fingerprint = function (algo, type) {
	return (this.toPublic().fingerprint(algo, type));
};

PrivateKey.prototype.toPublic = function () {
	if (this._pubCache)
		return (this._pubCache);

	var algInfo = algs.info[this.type];
	var pubParts = [];
	for (var i = 0; i < algInfo.parts.length; ++i) {
		var p = algInfo.parts[i];
		pubParts.push(this.part[p]);
	}

	this._pubCache = new Key({
		type: this.type,
		source: this,
		parts: pubParts
	});
	if (this.comment)
		this._pubCache.comment = this.comment;
	return (this._pubCache);
};

PrivateKey.prototype.derive = function (newType) {
	assert.string(newType, 'type');
	var priv, pub, pair;

	if (this.type === 'ed25519' && newType === 'curve25519') {
		priv = this.part.k.data;
		if (priv[0] === 0x00)
			priv = priv.slice(1);

		pair = nacl.box.keyPair.fromSecretKey(new Uint8Array(priv));
		pub = Buffer.from(pair.publicKey);

		return (new PrivateKey({
			type: 'curve25519',
			parts: [
				{ name: 'A', data: utils.mpNormalize(pub) },
				{ name: 'k', data: utils.mpNormalize(priv) }
			]
		}));
	} else if (this.type === 'curve25519' && newType === 'ed25519') {
		priv = this.part.k.data;
		if (priv[0] === 0x00)
			priv = priv.slice(1);

		pair = nacl.sign.keyPair.fromSeed(new Uint8Array(priv));
		pub = Buffer.from(pair.publicKey);

		return (new PrivateKey({
			type: 'ed25519',
			parts: [
				{ name: 'A', data: utils.mpNormalize(pub) },
				{ name: 'k', data: utils.mpNormalize(priv) }
			]
		}));
	}
	throw (new Error('Key derivation not supported from ' + this.type +
	    ' to ' + newType));
};

PrivateKey.prototype.createVerify = function (hashAlgo) {
	return (this.toPublic().createVerify(hashAlgo));
};

PrivateKey.prototype.createSign = function (hashAlgo) {
	if (hashAlgo === undefined)
		hashAlgo = this.defaultHashAlgorithm();
	assert.string(hashAlgo, 'hash algorithm');

	/* ED25519 is not supported by OpenSSL, use a javascript impl. */
	if (this.type === 'ed25519' && edCompat !== undefined)
		return (new edCompat.Signer(this, hashAlgo));
	if (this.type === 'curve25519')
		throw (new Error('Curve25519 keys are not suitable for ' +
		    'signing or verification'));

	var v, nm, err;
	try {
		nm = hashAlgo.toUpperCase();
		v = crypto.createSign(nm);
	} catch (e) {
		err = e;
	}
	if (v === undefined || (err instanceof Error &&
	    err.message.match(/Unknown message digest/))) {
		nm = 'RSA-';
		nm += hashAlgo.toUpperCase();
		v = crypto.createSign(nm);
	}
	assert.ok(v, 'failed to create verifier');
	var oldSign = v.sign.bind(v);
	var key = this.toBuffer('pkcs1');
	var type = this.type;
	var curve = this.curve;
	v.sign = function () {
		var sig = oldSign(key);
		if (typeof (sig) === 'string')
			sig = Buffer.from(sig, 'binary');
		sig = Signature.parse(sig, type, 'asn1');
		sig.hashAlgorithm = hashAlgo;
		sig.curve = curve;
		return (sig);
	};
	return (v);
};

PrivateKey.parse = function (data, format, options) {
	if (typeof (data) !== 'string')
		assert.buffer(data, 'data');
	if (format === undefined)
		format = 'auto';
	assert.string(format, 'format');
	if (typeof (options) === 'string')
		options = { filename: options };
	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	assert.optionalString(options.filename, 'options.filename');
	if (options.filename === undefined)
		options.filename = '(unnamed)';

	assert.object(formats[format], 'formats[format]');

	try {
		var k = formats[format].read(data, options);
		assert.ok(k instanceof PrivateKey, 'key is not a private key');
		if (!k.comment)
			k.comment = options.filename;
		return (k);
	} catch (e) {
		if (e.name === 'KeyEncryptedError')
			throw (e);
		throw (new KeyParseError(options.filename, format, e));
	}
};

PrivateKey.isPrivateKey = function (obj, ver) {
	return (utils.isCompatible(obj, PrivateKey, ver));
};

PrivateKey.generate = function (type, options) {
	if (options === undefined)
		options = {};
	assert.object(options, 'options');

	switch (type) {
	case 'ecdsa':
		if (options.curve === undefined)
			options.curve = 'nistp256';
		assert.string(options.curve, 'options.curve');
		return (generateECDSA(options.curve));
	case 'ed25519':
		return (generateED25519());
	default:
		throw (new Error('Key generation not supported with key ' +
		    'type "' + type + '"'));
	}
};

/*
 * API versions for PrivateKey:
 * [1,0] -- initial ver
 * [1,1] -- added auto, pkcs[18], openssh/ssh-private formats
 * [1,2] -- added defaultHashAlgorithm
 * [1,3] -- added derive, ed, createDH
 * [1,4] -- first tagged version
 * [1,5] -- changed ed25519 part names and format
 * [1,6] -- type arguments for hash() and fingerprint()
 */
PrivateKey.prototype._sshpkApiVersion = [1, 6];

PrivateKey._oldVersionDetect = function (obj) {
	assert.func(obj.toPublic);
	assert.func(obj.createSign);
	if (obj.derive)
		return ([1, 3]);
	if (obj.defaultHashAlgorithm)
		return ([1, 2]);
	if (obj.formats['auto'])
		return ([1, 1]);
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./fingerprint":1572231845937,"./signature":1572231845940,"./errors":1572231845938,"./utils":1572231845941,"./dhe":1572231845943,"./ed-compat":1572231845944,"./key":1572231845935,"./formats/auto":1572231845945,"./formats/pem":1572231845946,"./formats/pkcs1":1572231845947,"./formats/pkcs8":1572231845948,"./formats/rfc4253":1572231845950,"./formats/ssh-private":1572231845949,"./formats/dnssec":1572231845952}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845940, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = Signature;

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var algs = require('./algs');
var crypto = require('crypto');
var errs = require('./errors');
var utils = require('./utils');
var asn1 = require('asn1');
var SSHBuffer = require('./ssh-buffer');

var InvalidAlgorithmError = errs.InvalidAlgorithmError;
var SignatureParseError = errs.SignatureParseError;

function Signature(opts) {
	assert.object(opts, 'options');
	assert.arrayOfObject(opts.parts, 'options.parts');
	assert.string(opts.type, 'options.type');

	var partLookup = {};
	for (var i = 0; i < opts.parts.length; ++i) {
		var part = opts.parts[i];
		partLookup[part.name] = part;
	}

	this.type = opts.type;
	this.hashAlgorithm = opts.hashAlgo;
	this.curve = opts.curve;
	this.parts = opts.parts;
	this.part = partLookup;
}

Signature.prototype.toBuffer = function (format) {
	if (format === undefined)
		format = 'asn1';
	assert.string(format, 'format');

	var buf;
	var stype = 'ssh-' + this.type;

	switch (this.type) {
	case 'rsa':
		switch (this.hashAlgorithm) {
		case 'sha256':
			stype = 'rsa-sha2-256';
			break;
		case 'sha512':
			stype = 'rsa-sha2-512';
			break;
		case 'sha1':
		case undefined:
			break;
		default:
			throw (new Error('SSH signature ' +
			    'format does not support hash ' +
			    'algorithm ' + this.hashAlgorithm));
		}
		if (format === 'ssh') {
			buf = new SSHBuffer({});
			buf.writeString(stype);
			buf.writePart(this.part.sig);
			return (buf.toBuffer());
		} else {
			return (this.part.sig.data);
		}
		break;

	case 'ed25519':
		if (format === 'ssh') {
			buf = new SSHBuffer({});
			buf.writeString(stype);
			buf.writePart(this.part.sig);
			return (buf.toBuffer());
		} else {
			return (this.part.sig.data);
		}
		break;

	case 'dsa':
	case 'ecdsa':
		var r, s;
		if (format === 'asn1') {
			var der = new asn1.BerWriter();
			der.startSequence();
			r = utils.mpNormalize(this.part.r.data);
			s = utils.mpNormalize(this.part.s.data);
			der.writeBuffer(r, asn1.Ber.Integer);
			der.writeBuffer(s, asn1.Ber.Integer);
			der.endSequence();
			return (der.buffer);
		} else if (format === 'ssh' && this.type === 'dsa') {
			buf = new SSHBuffer({});
			buf.writeString('ssh-dss');
			r = this.part.r.data;
			if (r.length > 20 && r[0] === 0x00)
				r = r.slice(1);
			s = this.part.s.data;
			if (s.length > 20 && s[0] === 0x00)
				s = s.slice(1);
			if ((this.hashAlgorithm &&
			    this.hashAlgorithm !== 'sha1') ||
			    r.length + s.length !== 40) {
				throw (new Error('OpenSSH only supports ' +
				    'DSA signatures with SHA1 hash'));
			}
			buf.writeBuffer(Buffer.concat([r, s]));
			return (buf.toBuffer());
		} else if (format === 'ssh' && this.type === 'ecdsa') {
			var inner = new SSHBuffer({});
			r = this.part.r.data;
			inner.writeBuffer(r);
			inner.writePart(this.part.s);

			buf = new SSHBuffer({});
			/* XXX: find a more proper way to do this? */
			var curve;
			if (r[0] === 0x00)
				r = r.slice(1);
			var sz = r.length * 8;
			if (sz === 256)
				curve = 'nistp256';
			else if (sz === 384)
				curve = 'nistp384';
			else if (sz === 528)
				curve = 'nistp521';
			buf.writeString('ecdsa-sha2-' + curve);
			buf.writeBuffer(inner.toBuffer());
			return (buf.toBuffer());
		}
		throw (new Error('Invalid signature format'));
	default:
		throw (new Error('Invalid signature data'));
	}
};

Signature.prototype.toString = function (format) {
	assert.optionalString(format, 'format');
	return (this.toBuffer(format).toString('base64'));
};

Signature.parse = function (data, type, format) {
	if (typeof (data) === 'string')
		data = Buffer.from(data, 'base64');
	assert.buffer(data, 'data');
	assert.string(format, 'format');
	assert.string(type, 'type');

	var opts = {};
	opts.type = type.toLowerCase();
	opts.parts = [];

	try {
		assert.ok(data.length > 0, 'signature must not be empty');
		switch (opts.type) {
		case 'rsa':
			return (parseOneNum(data, type, format, opts));
		case 'ed25519':
			return (parseOneNum(data, type, format, opts));

		case 'dsa':
		case 'ecdsa':
			if (format === 'asn1')
				return (parseDSAasn1(data, type, format, opts));
			else if (opts.type === 'dsa')
				return (parseDSA(data, type, format, opts));
			else
				return (parseECDSA(data, type, format, opts));

		default:
			throw (new InvalidAlgorithmError(type));
		}

	} catch (e) {
		if (e instanceof InvalidAlgorithmError)
			throw (e);
		throw (new SignatureParseError(type, format, e));
	}
};

function parseOneNum(data, type, format, opts) {
	if (format === 'ssh') {
		try {
			var buf = new SSHBuffer({buffer: data});
			var head = buf.readString();
		} catch (e) {
			/* fall through */
		}
		if (buf !== undefined) {
			var msg = 'SSH signature does not match expected ' +
			    'type (expected ' + type + ', got ' + head + ')';
			switch (head) {
			case 'ssh-rsa':
				assert.strictEqual(type, 'rsa', msg);
				opts.hashAlgo = 'sha1';
				break;
			case 'rsa-sha2-256':
				assert.strictEqual(type, 'rsa', msg);
				opts.hashAlgo = 'sha256';
				break;
			case 'rsa-sha2-512':
				assert.strictEqual(type, 'rsa', msg);
				opts.hashAlgo = 'sha512';
				break;
			case 'ssh-ed25519':
				assert.strictEqual(type, 'ed25519', msg);
				opts.hashAlgo = 'sha512';
				break;
			default:
				throw (new Error('Unknown SSH signature ' +
				    'type: ' + head));
			}
			var sig = buf.readPart();
			assert.ok(buf.atEnd(), 'extra trailing bytes');
			sig.name = 'sig';
			opts.parts.push(sig);
			return (new Signature(opts));
		}
	}
	opts.parts.push({name: 'sig', data: data});
	return (new Signature(opts));
}

function parseDSAasn1(data, type, format, opts) {
	var der = new asn1.BerReader(data);
	der.readSequence();
	var r = der.readString(asn1.Ber.Integer, true);
	var s = der.readString(asn1.Ber.Integer, true);

	opts.parts.push({name: 'r', data: utils.mpNormalize(r)});
	opts.parts.push({name: 's', data: utils.mpNormalize(s)});

	return (new Signature(opts));
}

function parseDSA(data, type, format, opts) {
	if (data.length != 40) {
		var buf = new SSHBuffer({buffer: data});
		var d = buf.readBuffer();
		if (d.toString('ascii') === 'ssh-dss')
			d = buf.readBuffer();
		assert.ok(buf.atEnd(), 'extra trailing bytes');
		assert.strictEqual(d.length, 40, 'invalid inner length');
		data = d;
	}
	opts.parts.push({name: 'r', data: data.slice(0, 20)});
	opts.parts.push({name: 's', data: data.slice(20, 40)});
	return (new Signature(opts));
}

function parseECDSA(data, type, format, opts) {
	var buf = new SSHBuffer({buffer: data});

	var r, s;
	var inner = buf.readBuffer();
	var stype = inner.toString('ascii');
	if (stype.slice(0, 6) === 'ecdsa-') {
		var parts = stype.split('-');
		assert.strictEqual(parts[0], 'ecdsa');
		assert.strictEqual(parts[1], 'sha2');
		opts.curve = parts[2];
		switch (opts.curve) {
		case 'nistp256':
			opts.hashAlgo = 'sha256';
			break;
		case 'nistp384':
			opts.hashAlgo = 'sha384';
			break;
		case 'nistp521':
			opts.hashAlgo = 'sha512';
			break;
		default:
			throw (new Error('Unsupported ECDSA curve: ' +
			    opts.curve));
		}
		inner = buf.readBuffer();
		assert.ok(buf.atEnd(), 'extra trailing bytes on outer');
		buf = new SSHBuffer({buffer: inner});
		r = buf.readPart();
	} else {
		r = {data: inner};
	}

	s = buf.readPart();
	assert.ok(buf.atEnd(), 'extra trailing bytes');

	r.name = 'r';
	s.name = 's';

	opts.parts.push(r);
	opts.parts.push(s);
	return (new Signature(opts));
}

Signature.isSignature = function (obj, ver) {
	return (utils.isCompatible(obj, Signature, ver));
};

/*
 * API versions for Signature:
 * [1,0] -- initial ver
 * [2,0] -- support for rsa in full ssh format, compat with sshpk-agent
 *          hashAlgorithm property
 * [2,1] -- first tagged version
 */
Signature.prototype._sshpkApiVersion = [2, 1];

Signature._oldVersionDetect = function (obj) {
	assert.func(obj.toBuffer);
	if (obj.hasOwnProperty('hashAlgorithm'))
		return ([2, 0]);
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./errors":1572231845938,"./utils":1572231845941,"./ssh-buffer":1572231845942}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845941, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	bufferSplit: bufferSplit,
	addRSAMissing: addRSAMissing,
	calculateDSAPublic: calculateDSAPublic,
	calculateED25519Public: calculateED25519Public,
	calculateX25519Public: calculateX25519Public,
	mpNormalize: mpNormalize,
	mpDenormalize: mpDenormalize,
	ecNormalize: ecNormalize,
	countZeros: countZeros,
	assertCompatible: assertCompatible,
	isCompatible: isCompatible,
	opensslKeyDeriv: opensslKeyDeriv,
	opensshCipherInfo: opensshCipherInfo,
	publicFromPrivateECDSA: publicFromPrivateECDSA,
	zeroPadToLength: zeroPadToLength,
	writeBitString: writeBitString,
	readBitString: readBitString,
	pbkdf2: pbkdf2
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var PrivateKey = require('./private-key');
var Key = require('./key');
var crypto = require('crypto');
var algs = require('./algs');
var asn1 = require('asn1');

var ec = require('ecc-jsbn/lib/ec');
var jsbn = require('jsbn').BigInteger;
var nacl = require('tweetnacl');

var MAX_CLASS_DEPTH = 3;

function isCompatible(obj, klass, needVer) {
	if (obj === null || typeof (obj) !== 'object')
		return (false);
	if (needVer === undefined)
		needVer = klass.prototype._sshpkApiVersion;
	if (obj instanceof klass &&
	    klass.prototype._sshpkApiVersion[0] == needVer[0])
		return (true);
	var proto = Object.getPrototypeOf(obj);
	var depth = 0;
	while (proto.constructor.name !== klass.name) {
		proto = Object.getPrototypeOf(proto);
		if (!proto || ++depth > MAX_CLASS_DEPTH)
			return (false);
	}
	if (proto.constructor.name !== klass.name)
		return (false);
	var ver = proto._sshpkApiVersion;
	if (ver === undefined)
		ver = klass._oldVersionDetect(obj);
	if (ver[0] != needVer[0] || ver[1] < needVer[1])
		return (false);
	return (true);
}

function assertCompatible(obj, klass, needVer, name) {
	if (name === undefined)
		name = 'object';
	assert.ok(obj, name + ' must not be null');
	assert.object(obj, name + ' must be an object');
	if (needVer === undefined)
		needVer = klass.prototype._sshpkApiVersion;
	if (obj instanceof klass &&
	    klass.prototype._sshpkApiVersion[0] == needVer[0])
		return;
	var proto = Object.getPrototypeOf(obj);
	var depth = 0;
	while (proto.constructor.name !== klass.name) {
		proto = Object.getPrototypeOf(proto);
		assert.ok(proto && ++depth <= MAX_CLASS_DEPTH,
		    name + ' must be a ' + klass.name + ' instance');
	}
	assert.strictEqual(proto.constructor.name, klass.name,
	    name + ' must be a ' + klass.name + ' instance');
	var ver = proto._sshpkApiVersion;
	if (ver === undefined)
		ver = klass._oldVersionDetect(obj);
	assert.ok(ver[0] == needVer[0] && ver[1] >= needVer[1],
	    name + ' must be compatible with ' + klass.name + ' klass ' +
	    'version ' + needVer[0] + '.' + needVer[1]);
}

var CIPHER_LEN = {
	'des-ede3-cbc': { key: 24, iv: 8 },
	'aes-128-cbc': { key: 16, iv: 16 },
	'aes-256-cbc': { key: 32, iv: 16 }
};
var PKCS5_SALT_LEN = 8;

function opensslKeyDeriv(cipher, salt, passphrase, count) {
	assert.buffer(salt, 'salt');
	assert.buffer(passphrase, 'passphrase');
	assert.number(count, 'iteration count');

	var clen = CIPHER_LEN[cipher];
	assert.object(clen, 'supported cipher');

	salt = salt.slice(0, PKCS5_SALT_LEN);

	var D, D_prev, bufs;
	var material = Buffer.alloc(0);
	while (material.length < clen.key + clen.iv) {
		bufs = [];
		if (D_prev)
			bufs.push(D_prev);
		bufs.push(passphrase);
		bufs.push(salt);
		D = Buffer.concat(bufs);
		for (var j = 0; j < count; ++j)
			D = crypto.createHash('md5').update(D).digest();
		material = Buffer.concat([material, D]);
		D_prev = D;
	}

	return ({
	    key: material.slice(0, clen.key),
	    iv: material.slice(clen.key, clen.key + clen.iv)
	});
}

/* See: RFC2898 */
function pbkdf2(hashAlg, salt, iterations, size, passphrase) {
	var hkey = Buffer.alloc(salt.length + 4);
	salt.copy(hkey);

	var gen = 0, ts = [];
	var i = 1;
	while (gen < size) {
		var t = T(i++);
		gen += t.length;
		ts.push(t);
	}
	return (Buffer.concat(ts).slice(0, size));

	function T(I) {
		hkey.writeUInt32BE(I, hkey.length - 4);

		var hmac = crypto.createHmac(hashAlg, passphrase);
		hmac.update(hkey);

		var Ti = hmac.digest();
		var Uc = Ti;
		var c = 1;
		while (c++ < iterations) {
			hmac = crypto.createHmac(hashAlg, passphrase);
			hmac.update(Uc);
			Uc = hmac.digest();
			for (var x = 0; x < Ti.length; ++x)
				Ti[x] ^= Uc[x];
		}
		return (Ti);
	}
}

/* Count leading zero bits on a buffer */
function countZeros(buf) {
	var o = 0, obit = 8;
	while (o < buf.length) {
		var mask = (1 << obit);
		if ((buf[o] & mask) === mask)
			break;
		obit--;
		if (obit < 0) {
			o++;
			obit = 8;
		}
	}
	return (o*8 + (8 - obit) - 1);
}

function bufferSplit(buf, chr) {
	assert.buffer(buf);
	assert.string(chr);

	var parts = [];
	var lastPart = 0;
	var matches = 0;
	for (var i = 0; i < buf.length; ++i) {
		if (buf[i] === chr.charCodeAt(matches))
			++matches;
		else if (buf[i] === chr.charCodeAt(0))
			matches = 1;
		else
			matches = 0;

		if (matches >= chr.length) {
			var newPart = i + 1;
			parts.push(buf.slice(lastPart, newPart - matches));
			lastPart = newPart;
			matches = 0;
		}
	}
	if (lastPart <= buf.length)
		parts.push(buf.slice(lastPart, buf.length));

	return (parts);
}

function ecNormalize(buf, addZero) {
	assert.buffer(buf);
	if (buf[0] === 0x00 && buf[1] === 0x04) {
		if (addZero)
			return (buf);
		return (buf.slice(1));
	} else if (buf[0] === 0x04) {
		if (!addZero)
			return (buf);
	} else {
		while (buf[0] === 0x00)
			buf = buf.slice(1);
		if (buf[0] === 0x02 || buf[0] === 0x03)
			throw (new Error('Compressed elliptic curve points ' +
			    'are not supported'));
		if (buf[0] !== 0x04)
			throw (new Error('Not a valid elliptic curve point'));
		if (!addZero)
			return (buf);
	}
	var b = Buffer.alloc(buf.length + 1);
	b[0] = 0x0;
	buf.copy(b, 1);
	return (b);
}

function readBitString(der, tag) {
	if (tag === undefined)
		tag = asn1.Ber.BitString;
	var buf = der.readString(tag, true);
	assert.strictEqual(buf[0], 0x00, 'bit strings with unused bits are ' +
	    'not supported (0x' + buf[0].toString(16) + ')');
	return (buf.slice(1));
}

function writeBitString(der, buf, tag) {
	if (tag === undefined)
		tag = asn1.Ber.BitString;
	var b = Buffer.alloc(buf.length + 1);
	b[0] = 0x00;
	buf.copy(b, 1);
	der.writeBuffer(b, tag);
}

function mpNormalize(buf) {
	assert.buffer(buf);
	while (buf.length > 1 && buf[0] === 0x00 && (buf[1] & 0x80) === 0x00)
		buf = buf.slice(1);
	if ((buf[0] & 0x80) === 0x80) {
		var b = Buffer.alloc(buf.length + 1);
		b[0] = 0x00;
		buf.copy(b, 1);
		buf = b;
	}
	return (buf);
}

function mpDenormalize(buf) {
	assert.buffer(buf);
	while (buf.length > 1 && buf[0] === 0x00)
		buf = buf.slice(1);
	return (buf);
}

function zeroPadToLength(buf, len) {
	assert.buffer(buf);
	assert.number(len);
	while (buf.length > len) {
		assert.equal(buf[0], 0x00);
		buf = buf.slice(1);
	}
	while (buf.length < len) {
		var b = Buffer.alloc(buf.length + 1);
		b[0] = 0x00;
		buf.copy(b, 1);
		buf = b;
	}
	return (buf);
}

function bigintToMpBuf(bigint) {
	var buf = Buffer.from(bigint.toByteArray());
	buf = mpNormalize(buf);
	return (buf);
}

function calculateDSAPublic(g, p, x) {
	assert.buffer(g);
	assert.buffer(p);
	assert.buffer(x);
	g = new jsbn(g);
	p = new jsbn(p);
	x = new jsbn(x);
	var y = g.modPow(x, p);
	var ybuf = bigintToMpBuf(y);
	return (ybuf);
}

function calculateED25519Public(k) {
	assert.buffer(k);

	var kp = nacl.sign.keyPair.fromSeed(new Uint8Array(k));
	return (Buffer.from(kp.publicKey));
}

function calculateX25519Public(k) {
	assert.buffer(k);

	var kp = nacl.box.keyPair.fromSeed(new Uint8Array(k));
	return (Buffer.from(kp.publicKey));
}

function addRSAMissing(key) {
	assert.object(key);
	assertCompatible(key, PrivateKey, [1, 1]);

	var d = new jsbn(key.part.d.data);
	var buf;

	if (!key.part.dmodp) {
		var p = new jsbn(key.part.p.data);
		var dmodp = d.mod(p.subtract(1));

		buf = bigintToMpBuf(dmodp);
		key.part.dmodp = {name: 'dmodp', data: buf};
		key.parts.push(key.part.dmodp);
	}
	if (!key.part.dmodq) {
		var q = new jsbn(key.part.q.data);
		var dmodq = d.mod(q.subtract(1));

		buf = bigintToMpBuf(dmodq);
		key.part.dmodq = {name: 'dmodq', data: buf};
		key.parts.push(key.part.dmodq);
	}
}

function publicFromPrivateECDSA(curveName, priv) {
	assert.string(curveName, 'curveName');
	assert.buffer(priv);
	var params = algs.curves[curveName];
	var p = new jsbn(params.p);
	var a = new jsbn(params.a);
	var b = new jsbn(params.b);
	var curve = new ec.ECCurveFp(p, a, b);
	var G = curve.decodePointHex(params.G.toString('hex'));

	var d = new jsbn(mpNormalize(priv));
	var pub = G.multiply(d);
	pub = Buffer.from(curve.encodePointHex(pub), 'hex');

	var parts = [];
	parts.push({name: 'curve', data: Buffer.from(curveName)});
	parts.push({name: 'Q', data: pub});

	var key = new Key({type: 'ecdsa', curve: curve, parts: parts});
	return (key);
}

function opensshCipherInfo(cipher) {
	var inf = {};
	switch (cipher) {
	case '3des-cbc':
		inf.keySize = 24;
		inf.blockSize = 8;
		inf.opensslName = 'des-ede3-cbc';
		break;
	case 'blowfish-cbc':
		inf.keySize = 16;
		inf.blockSize = 8;
		inf.opensslName = 'bf-cbc';
		break;
	case 'aes128-cbc':
	case 'aes128-ctr':
	case 'aes128-gcm@openssh.com':
		inf.keySize = 16;
		inf.blockSize = 16;
		inf.opensslName = 'aes-128-' + cipher.slice(7, 10);
		break;
	case 'aes192-cbc':
	case 'aes192-ctr':
	case 'aes192-gcm@openssh.com':
		inf.keySize = 24;
		inf.blockSize = 16;
		inf.opensslName = 'aes-192-' + cipher.slice(7, 10);
		break;
	case 'aes256-cbc':
	case 'aes256-ctr':
	case 'aes256-gcm@openssh.com':
		inf.keySize = 32;
		inf.blockSize = 16;
		inf.opensslName = 'aes-256-' + cipher.slice(7, 10);
		break;
	default:
		throw (new Error(
		    'Unsupported openssl cipher "' + cipher + '"'));
	}
	return (inf);
}

}, function(modId) { var map = {"./private-key":1572231845939,"./key":1572231845935,"./algs":1572231845936}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845942, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = SSHBuffer;

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;

function SSHBuffer(opts) {
	assert.object(opts, 'options');
	if (opts.buffer !== undefined)
		assert.buffer(opts.buffer, 'options.buffer');

	this._size = opts.buffer ? opts.buffer.length : 1024;
	this._buffer = opts.buffer || Buffer.alloc(this._size);
	this._offset = 0;
}

SSHBuffer.prototype.toBuffer = function () {
	return (this._buffer.slice(0, this._offset));
};

SSHBuffer.prototype.atEnd = function () {
	return (this._offset >= this._buffer.length);
};

SSHBuffer.prototype.remainder = function () {
	return (this._buffer.slice(this._offset));
};

SSHBuffer.prototype.skip = function (n) {
	this._offset += n;
};

SSHBuffer.prototype.expand = function () {
	this._size *= 2;
	var buf = Buffer.alloc(this._size);
	this._buffer.copy(buf, 0);
	this._buffer = buf;
};

SSHBuffer.prototype.readPart = function () {
	return ({data: this.readBuffer()});
};

SSHBuffer.prototype.readBuffer = function () {
	var len = this._buffer.readUInt32BE(this._offset);
	this._offset += 4;
	assert.ok(this._offset + len <= this._buffer.length,
	    'length out of bounds at +0x' + this._offset.toString(16) +
	    ' (data truncated?)');
	var buf = this._buffer.slice(this._offset, this._offset + len);
	this._offset += len;
	return (buf);
};

SSHBuffer.prototype.readString = function () {
	return (this.readBuffer().toString());
};

SSHBuffer.prototype.readCString = function () {
	var offset = this._offset;
	while (offset < this._buffer.length &&
	    this._buffer[offset] !== 0x00)
		offset++;
	assert.ok(offset < this._buffer.length, 'c string does not terminate');
	var str = this._buffer.slice(this._offset, offset).toString();
	this._offset = offset + 1;
	return (str);
};

SSHBuffer.prototype.readInt = function () {
	var v = this._buffer.readUInt32BE(this._offset);
	this._offset += 4;
	return (v);
};

SSHBuffer.prototype.readInt64 = function () {
	assert.ok(this._offset + 8 < this._buffer.length,
	    'buffer not long enough to read Int64');
	var v = this._buffer.slice(this._offset, this._offset + 8);
	this._offset += 8;
	return (v);
};

SSHBuffer.prototype.readChar = function () {
	var v = this._buffer[this._offset++];
	return (v);
};

SSHBuffer.prototype.writeBuffer = function (buf) {
	while (this._offset + 4 + buf.length > this._size)
		this.expand();
	this._buffer.writeUInt32BE(buf.length, this._offset);
	this._offset += 4;
	buf.copy(this._buffer, this._offset);
	this._offset += buf.length;
};

SSHBuffer.prototype.writeString = function (str) {
	this.writeBuffer(Buffer.from(str, 'utf8'));
};

SSHBuffer.prototype.writeCString = function (str) {
	while (this._offset + 1 + str.length > this._size)
		this.expand();
	this._buffer.write(str, this._offset);
	this._offset += str.length;
	this._buffer[this._offset++] = 0;
};

SSHBuffer.prototype.writeInt = function (v) {
	while (this._offset + 4 > this._size)
		this.expand();
	this._buffer.writeUInt32BE(v, this._offset);
	this._offset += 4;
};

SSHBuffer.prototype.writeInt64 = function (v) {
	assert.buffer(v, 'value');
	if (v.length > 8) {
		var lead = v.slice(0, v.length - 8);
		for (var i = 0; i < lead.length; ++i) {
			assert.strictEqual(lead[i], 0,
			    'must fit in 64 bits of precision');
		}
		v = v.slice(v.length - 8, v.length);
	}
	while (this._offset + 8 > this._size)
		this.expand();
	v.copy(this._buffer, this._offset);
	this._offset += 8;
};

SSHBuffer.prototype.writeChar = function (v) {
	while (this._offset + 1 > this._size)
		this.expand();
	this._buffer[this._offset++] = v;
};

SSHBuffer.prototype.writePart = function (p) {
	this.writeBuffer(p.data);
};

SSHBuffer.prototype.write = function (buf) {
	while (this._offset + buf.length > this._size)
		this.expand();
	buf.copy(this._buffer, this._offset);
	this._offset += buf.length;
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845943, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = {
	DiffieHellman: DiffieHellman,
	generateECDSA: generateECDSA,
	generateED25519: generateED25519
};

var assert = require('assert-plus');
var crypto = require('crypto');
var Buffer = require('safer-buffer').Buffer;
var algs = require('./algs');
var utils = require('./utils');
var nacl = require('tweetnacl');

var Key = require('./key');
var PrivateKey = require('./private-key');

var CRYPTO_HAVE_ECDH = (crypto.createECDH !== undefined);

var ecdh = require('ecc-jsbn');
var ec = require('ecc-jsbn/lib/ec');
var jsbn = require('jsbn').BigInteger;

function DiffieHellman(key) {
	utils.assertCompatible(key, Key, [1, 4], 'key');
	this._isPriv = PrivateKey.isPrivateKey(key, [1, 3]);
	this._algo = key.type;
	this._curve = key.curve;
	this._key = key;
	if (key.type === 'dsa') {
		if (!CRYPTO_HAVE_ECDH) {
			throw (new Error('Due to bugs in the node 0.10 ' +
			    'crypto API, node 0.12.x or later is required ' +
			    'to use DH'));
		}
		this._dh = crypto.createDiffieHellman(
		    key.part.p.data, undefined,
		    key.part.g.data, undefined);
		this._p = key.part.p;
		this._g = key.part.g;
		if (this._isPriv)
			this._dh.setPrivateKey(key.part.x.data);
		this._dh.setPublicKey(key.part.y.data);

	} else if (key.type === 'ecdsa') {
		if (!CRYPTO_HAVE_ECDH) {
			this._ecParams = new X9ECParameters(this._curve);

			if (this._isPriv) {
				this._priv = new ECPrivate(
				    this._ecParams, key.part.d.data);
			}
			return;
		}

		var curve = {
			'nistp256': 'prime256v1',
			'nistp384': 'secp384r1',
			'nistp521': 'secp521r1'
		}[key.curve];
		this._dh = crypto.createECDH(curve);
		if (typeof (this._dh) !== 'object' ||
		    typeof (this._dh.setPrivateKey) !== 'function') {
			CRYPTO_HAVE_ECDH = false;
			DiffieHellman.call(this, key);
			return;
		}
		if (this._isPriv)
			this._dh.setPrivateKey(key.part.d.data);
		this._dh.setPublicKey(key.part.Q.data);

	} else if (key.type === 'curve25519') {
		if (this._isPriv) {
			utils.assertCompatible(key, PrivateKey, [1, 5], 'key');
			this._priv = key.part.k.data;
		}

	} else {
		throw (new Error('DH not supported for ' + key.type + ' keys'));
	}
}

DiffieHellman.prototype.getPublicKey = function () {
	if (this._isPriv)
		return (this._key.toPublic());
	return (this._key);
};

DiffieHellman.prototype.getPrivateKey = function () {
	if (this._isPriv)
		return (this._key);
	else
		return (undefined);
};
DiffieHellman.prototype.getKey = DiffieHellman.prototype.getPrivateKey;

DiffieHellman.prototype._keyCheck = function (pk, isPub) {
	assert.object(pk, 'key');
	if (!isPub)
		utils.assertCompatible(pk, PrivateKey, [1, 3], 'key');
	utils.assertCompatible(pk, Key, [1, 4], 'key');

	if (pk.type !== this._algo) {
		throw (new Error('A ' + pk.type + ' key cannot be used in ' +
		    this._algo + ' Diffie-Hellman'));
	}

	if (pk.curve !== this._curve) {
		throw (new Error('A key from the ' + pk.curve + ' curve ' +
		    'cannot be used with a ' + this._curve +
		    ' Diffie-Hellman'));
	}

	if (pk.type === 'dsa') {
		assert.deepEqual(pk.part.p, this._p,
		    'DSA key prime does not match');
		assert.deepEqual(pk.part.g, this._g,
		    'DSA key generator does not match');
	}
};

DiffieHellman.prototype.setKey = function (pk) {
	this._keyCheck(pk);

	if (pk.type === 'dsa') {
		this._dh.setPrivateKey(pk.part.x.data);
		this._dh.setPublicKey(pk.part.y.data);

	} else if (pk.type === 'ecdsa') {
		if (CRYPTO_HAVE_ECDH) {
			this._dh.setPrivateKey(pk.part.d.data);
			this._dh.setPublicKey(pk.part.Q.data);
		} else {
			this._priv = new ECPrivate(
			    this._ecParams, pk.part.d.data);
		}

	} else if (pk.type === 'curve25519') {
		var k = pk.part.k;
		if (!pk.part.k)
			k = pk.part.r;
		this._priv = k.data;
		if (this._priv[0] === 0x00)
			this._priv = this._priv.slice(1);
		this._priv = this._priv.slice(0, 32);
	}
	this._key = pk;
	this._isPriv = true;
};
DiffieHellman.prototype.setPrivateKey = DiffieHellman.prototype.setKey;

DiffieHellman.prototype.computeSecret = function (otherpk) {
	this._keyCheck(otherpk, true);
	if (!this._isPriv)
		throw (new Error('DH exchange has not been initialized with ' +
		    'a private key yet'));

	var pub;
	if (this._algo === 'dsa') {
		return (this._dh.computeSecret(
		    otherpk.part.y.data));

	} else if (this._algo === 'ecdsa') {
		if (CRYPTO_HAVE_ECDH) {
			return (this._dh.computeSecret(
			    otherpk.part.Q.data));
		} else {
			pub = new ECPublic(
			    this._ecParams, otherpk.part.Q.data);
			return (this._priv.deriveSharedSecret(pub));
		}

	} else if (this._algo === 'curve25519') {
		pub = otherpk.part.A.data;
		while (pub[0] === 0x00 && pub.length > 32)
			pub = pub.slice(1);
		var priv = this._priv;
		assert.strictEqual(pub.length, 32);
		assert.strictEqual(priv.length, 32);

		var secret = nacl.box.before(new Uint8Array(pub),
		    new Uint8Array(priv));

		return (Buffer.from(secret));
	}

	throw (new Error('Invalid algorithm: ' + this._algo));
};

DiffieHellman.prototype.generateKey = function () {
	var parts = [];
	var priv, pub;
	if (this._algo === 'dsa') {
		this._dh.generateKeys();

		parts.push({name: 'p', data: this._p.data});
		parts.push({name: 'q', data: this._key.part.q.data});
		parts.push({name: 'g', data: this._g.data});
		parts.push({name: 'y', data: this._dh.getPublicKey()});
		parts.push({name: 'x', data: this._dh.getPrivateKey()});
		this._key = new PrivateKey({
			type: 'dsa',
			parts: parts
		});
		this._isPriv = true;
		return (this._key);

	} else if (this._algo === 'ecdsa') {
		if (CRYPTO_HAVE_ECDH) {
			this._dh.generateKeys();

			parts.push({name: 'curve',
			    data: Buffer.from(this._curve)});
			parts.push({name: 'Q', data: this._dh.getPublicKey()});
			parts.push({name: 'd', data: this._dh.getPrivateKey()});
			this._key = new PrivateKey({
				type: 'ecdsa',
				curve: this._curve,
				parts: parts
			});
			this._isPriv = true;
			return (this._key);

		} else {
			var n = this._ecParams.getN();
			var r = new jsbn(crypto.randomBytes(n.bitLength()));
			var n1 = n.subtract(jsbn.ONE);
			priv = r.mod(n1).add(jsbn.ONE);
			pub = this._ecParams.getG().multiply(priv);

			priv = Buffer.from(priv.toByteArray());
			pub = Buffer.from(this._ecParams.getCurve().
			    encodePointHex(pub), 'hex');

			this._priv = new ECPrivate(this._ecParams, priv);

			parts.push({name: 'curve',
			    data: Buffer.from(this._curve)});
			parts.push({name: 'Q', data: pub});
			parts.push({name: 'd', data: priv});

			this._key = new PrivateKey({
				type: 'ecdsa',
				curve: this._curve,
				parts: parts
			});
			this._isPriv = true;
			return (this._key);
		}

	} else if (this._algo === 'curve25519') {
		var pair = nacl.box.keyPair();
		priv = Buffer.from(pair.secretKey);
		pub = Buffer.from(pair.publicKey);
		priv = Buffer.concat([priv, pub]);
		assert.strictEqual(priv.length, 64);
		assert.strictEqual(pub.length, 32);

		parts.push({name: 'A', data: pub});
		parts.push({name: 'k', data: priv});
		this._key = new PrivateKey({
			type: 'curve25519',
			parts: parts
		});
		this._isPriv = true;
		return (this._key);
	}

	throw (new Error('Invalid algorithm: ' + this._algo));
};
DiffieHellman.prototype.generateKeys = DiffieHellman.prototype.generateKey;

/* These are helpers for using ecc-jsbn (for node 0.10 compatibility). */

function X9ECParameters(name) {
	var params = algs.curves[name];
	assert.object(params);

	var p = new jsbn(params.p);
	var a = new jsbn(params.a);
	var b = new jsbn(params.b);
	var n = new jsbn(params.n);
	var h = jsbn.ONE;
	var curve = new ec.ECCurveFp(p, a, b);
	var G = curve.decodePointHex(params.G.toString('hex'));

	this.curve = curve;
	this.g = G;
	this.n = n;
	this.h = h;
}
X9ECParameters.prototype.getCurve = function () { return (this.curve); };
X9ECParameters.prototype.getG = function () { return (this.g); };
X9ECParameters.prototype.getN = function () { return (this.n); };
X9ECParameters.prototype.getH = function () { return (this.h); };

function ECPublic(params, buffer) {
	this._params = params;
	if (buffer[0] === 0x00)
		buffer = buffer.slice(1);
	this._pub = params.getCurve().decodePointHex(buffer.toString('hex'));
}

function ECPrivate(params, buffer) {
	this._params = params;
	this._priv = new jsbn(utils.mpNormalize(buffer));
}
ECPrivate.prototype.deriveSharedSecret = function (pubKey) {
	assert.ok(pubKey instanceof ECPublic);
	var S = pubKey._pub.multiply(this._priv);
	return (Buffer.from(S.getX().toBigInteger().toByteArray()));
};

function generateED25519() {
	var pair = nacl.sign.keyPair();
	var priv = Buffer.from(pair.secretKey);
	var pub = Buffer.from(pair.publicKey);
	assert.strictEqual(priv.length, 64);
	assert.strictEqual(pub.length, 32);

	var parts = [];
	parts.push({name: 'A', data: pub});
	parts.push({name: 'k', data: priv.slice(0, 32)});
	var key = new PrivateKey({
		type: 'ed25519',
		parts: parts
	});
	return (key);
}

/* Generates a new ECDSA private key on a given curve. */
function generateECDSA(curve) {
	var parts = [];
	var key;

	if (CRYPTO_HAVE_ECDH) {
		/*
		 * Node crypto doesn't expose key generation directly, but the
		 * ECDH instances can generate keys. It turns out this just
		 * calls into the OpenSSL generic key generator, and we can
		 * read its output happily without doing an actual DH. So we
		 * use that here.
		 */
		var osCurve = {
			'nistp256': 'prime256v1',
			'nistp384': 'secp384r1',
			'nistp521': 'secp521r1'
		}[curve];

		var dh = crypto.createECDH(osCurve);
		dh.generateKeys();

		parts.push({name: 'curve',
		    data: Buffer.from(curve)});
		parts.push({name: 'Q', data: dh.getPublicKey()});
		parts.push({name: 'd', data: dh.getPrivateKey()});

		key = new PrivateKey({
			type: 'ecdsa',
			curve: curve,
			parts: parts
		});
		return (key);
	} else {

		var ecParams = new X9ECParameters(curve);

		/* This algorithm taken from FIPS PUB 186-4 (section B.4.1) */
		var n = ecParams.getN();
		/*
		 * The crypto.randomBytes() function can only give us whole
		 * bytes, so taking a nod from X9.62, we round up.
		 */
		var cByteLen = Math.ceil((n.bitLength() + 64) / 8);
		var c = new jsbn(crypto.randomBytes(cByteLen));

		var n1 = n.subtract(jsbn.ONE);
		var priv = c.mod(n1).add(jsbn.ONE);
		var pub = ecParams.getG().multiply(priv);

		priv = Buffer.from(priv.toByteArray());
		pub = Buffer.from(ecParams.getCurve().
		    encodePointHex(pub), 'hex');

		parts.push({name: 'curve', data: Buffer.from(curve)});
		parts.push({name: 'Q', data: pub});
		parts.push({name: 'd', data: priv});

		key = new PrivateKey({
			type: 'ecdsa',
			curve: curve,
			parts: parts
		});
		return (key);
	}
}

}, function(modId) { var map = {"./algs":1572231845936,"./utils":1572231845941,"./key":1572231845935,"./private-key":1572231845939}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845944, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	Verifier: Verifier,
	Signer: Signer
};

var nacl = require('tweetnacl');
var stream = require('stream');
var util = require('util');
var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var Signature = require('./signature');

function Verifier(key, hashAlgo) {
	if (hashAlgo.toLowerCase() !== 'sha512')
		throw (new Error('ED25519 only supports the use of ' +
		    'SHA-512 hashes'));

	this.key = key;
	this.chunks = [];

	stream.Writable.call(this, {});
}
util.inherits(Verifier, stream.Writable);

Verifier.prototype._write = function (chunk, enc, cb) {
	this.chunks.push(chunk);
	cb();
};

Verifier.prototype.update = function (chunk) {
	if (typeof (chunk) === 'string')
		chunk = Buffer.from(chunk, 'binary');
	this.chunks.push(chunk);
};

Verifier.prototype.verify = function (signature, fmt) {
	var sig;
	if (Signature.isSignature(signature, [2, 0])) {
		if (signature.type !== 'ed25519')
			return (false);
		sig = signature.toBuffer('raw');

	} else if (typeof (signature) === 'string') {
		sig = Buffer.from(signature, 'base64');

	} else if (Signature.isSignature(signature, [1, 0])) {
		throw (new Error('signature was created by too old ' +
		    'a version of sshpk and cannot be verified'));
	}

	assert.buffer(sig);
	return (nacl.sign.detached.verify(
	    new Uint8Array(Buffer.concat(this.chunks)),
	    new Uint8Array(sig),
	    new Uint8Array(this.key.part.A.data)));
};

function Signer(key, hashAlgo) {
	if (hashAlgo.toLowerCase() !== 'sha512')
		throw (new Error('ED25519 only supports the use of ' +
		    'SHA-512 hashes'));

	this.key = key;
	this.chunks = [];

	stream.Writable.call(this, {});
}
util.inherits(Signer, stream.Writable);

Signer.prototype._write = function (chunk, enc, cb) {
	this.chunks.push(chunk);
	cb();
};

Signer.prototype.update = function (chunk) {
	if (typeof (chunk) === 'string')
		chunk = Buffer.from(chunk, 'binary');
	this.chunks.push(chunk);
};

Signer.prototype.sign = function () {
	var sig = nacl.sign.detached(
	    new Uint8Array(Buffer.concat(this.chunks)),
	    new Uint8Array(Buffer.concat([
		this.key.part.k.data, this.key.part.A.data])));
	var sigBuf = Buffer.from(sig);
	var sigObj = Signature.parse(sigBuf, 'ed25519', 'raw');
	sigObj.hashAlgorithm = 'sha512';
	return (sigObj);
};

}, function(modId) { var map = {"./signature":1572231845940}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845945, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = {
	read: read,
	write: write
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');

var pem = require('./pem');
var ssh = require('./ssh');
var rfc4253 = require('./rfc4253');
var dnssec = require('./dnssec');
var putty = require('./putty');

var DNSSEC_PRIVKEY_HEADER_PREFIX = 'Private-key-format: v1';

function read(buf, options) {
	if (typeof (buf) === 'string') {
		if (buf.trim().match(/^[-]+[ ]*BEGIN/))
			return (pem.read(buf, options));
		if (buf.match(/^\s*ssh-[a-z]/))
			return (ssh.read(buf, options));
		if (buf.match(/^\s*ecdsa-/))
			return (ssh.read(buf, options));
		if (buf.match(/^putty-user-key-file-2:/i))
			return (putty.read(buf, options));
		if (findDNSSECHeader(buf))
			return (dnssec.read(buf, options));
		buf = Buffer.from(buf, 'binary');
	} else {
		assert.buffer(buf);
		if (findPEMHeader(buf))
			return (pem.read(buf, options));
		if (findSSHHeader(buf))
			return (ssh.read(buf, options));
		if (findPuTTYHeader(buf))
			return (putty.read(buf, options));
		if (findDNSSECHeader(buf))
			return (dnssec.read(buf, options));
	}
	if (buf.readUInt32BE(0) < buf.length)
		return (rfc4253.read(buf, options));
	throw (new Error('Failed to auto-detect format of key'));
}

function findPuTTYHeader(buf) {
	var offset = 0;
	while (offset < buf.length &&
	    (buf[offset] === 32 || buf[offset] === 10 || buf[offset] === 9))
		++offset;
	if (offset + 22 <= buf.length &&
	    buf.slice(offset, offset + 22).toString('ascii').toLowerCase() ===
	    'putty-user-key-file-2:')
		return (true);
	return (false);
}

function findSSHHeader(buf) {
	var offset = 0;
	while (offset < buf.length &&
	    (buf[offset] === 32 || buf[offset] === 10 || buf[offset] === 9))
		++offset;
	if (offset + 4 <= buf.length &&
	    buf.slice(offset, offset + 4).toString('ascii') === 'ssh-')
		return (true);
	if (offset + 6 <= buf.length &&
	    buf.slice(offset, offset + 6).toString('ascii') === 'ecdsa-')
		return (true);
	return (false);
}

function findPEMHeader(buf) {
	var offset = 0;
	while (offset < buf.length &&
	    (buf[offset] === 32 || buf[offset] === 10))
		++offset;
	if (buf[offset] !== 45)
		return (false);
	while (offset < buf.length &&
	    (buf[offset] === 45))
		++offset;
	while (offset < buf.length &&
	    (buf[offset] === 32))
		++offset;
	if (offset + 5 > buf.length ||
	    buf.slice(offset, offset + 5).toString('ascii') !== 'BEGIN')
		return (false);
	return (true);
}

function findDNSSECHeader(buf) {
	// private case first
	if (buf.length <= DNSSEC_PRIVKEY_HEADER_PREFIX.length)
		return (false);
	var headerCheck = buf.slice(0, DNSSEC_PRIVKEY_HEADER_PREFIX.length);
	if (headerCheck.toString('ascii') === DNSSEC_PRIVKEY_HEADER_PREFIX)
		return (true);

	// public-key RFC3110 ?
	// 'domain.com. IN KEY ...' or 'domain.com. IN DNSKEY ...'
	// skip any comment-lines
	if (typeof (buf) !== 'string') {
		buf = buf.toString('ascii');
	}
	var lines = buf.split('\n');
	var line = 0;
	/* JSSTYLED */
	while (lines[line].match(/^\;/))
		line++;
	if (lines[line].toString('ascii').match(/\. IN KEY /))
		return (true);
	if (lines[line].toString('ascii').match(/\. IN DNSKEY /))
		return (true);
	return (false);
}

function write(key, options) {
	throw (new Error('"auto" format cannot be used for writing'));
}

}, function(modId) { var map = {"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946,"./ssh":1572231845951,"./rfc4253":1572231845950,"./dnssec":1572231845952,"./putty":1572231845953}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845946, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = {
	read: read,
	write: write
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var crypto = require('crypto');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');

var pkcs1 = require('./pkcs1');
var pkcs8 = require('./pkcs8');
var sshpriv = require('./ssh-private');
var rfc4253 = require('./rfc4253');

var errors = require('../errors');

var OID_PBES2 = '1.2.840.113549.1.5.13';
var OID_PBKDF2 = '1.2.840.113549.1.5.12';

var OID_TO_CIPHER = {
	'1.2.840.113549.3.7': '3des-cbc',
	'2.16.840.1.101.3.4.1.2': 'aes128-cbc',
	'2.16.840.1.101.3.4.1.42': 'aes256-cbc'
};
var CIPHER_TO_OID = {};
Object.keys(OID_TO_CIPHER).forEach(function (k) {
	CIPHER_TO_OID[OID_TO_CIPHER[k]] = k;
});

var OID_TO_HASH = {
	'1.2.840.113549.2.7': 'sha1',
	'1.2.840.113549.2.9': 'sha256',
	'1.2.840.113549.2.11': 'sha512'
};
var HASH_TO_OID = {};
Object.keys(OID_TO_HASH).forEach(function (k) {
	HASH_TO_OID[OID_TO_HASH[k]] = k;
});

/*
 * For reading we support both PKCS#1 and PKCS#8. If we find a private key,
 * we just take the public component of it and use that.
 */
function read(buf, options, forceType) {
	var input = buf;
	if (typeof (buf) !== 'string') {
		assert.buffer(buf, 'buf');
		buf = buf.toString('ascii');
	}

	var lines = buf.trim().split(/[\r\n]+/g);

	var m;
	var si = -1;
	while (!m && si < lines.length) {
		m = lines[++si].match(/*JSSTYLED*/
		    /[-]+[ ]*BEGIN ([A-Z0-9][A-Za-z0-9]+ )?(PUBLIC|PRIVATE) KEY[ ]*[-]+/);
	}
	assert.ok(m, 'invalid PEM header');

	var m2;
	var ei = lines.length;
	while (!m2 && ei > 0) {
		m2 = lines[--ei].match(/*JSSTYLED*/
		    /[-]+[ ]*END ([A-Z0-9][A-Za-z0-9]+ )?(PUBLIC|PRIVATE) KEY[ ]*[-]+/);
	}
	assert.ok(m2, 'invalid PEM footer');

	/* Begin and end banners must match key type */
	assert.equal(m[2], m2[2]);
	var type = m[2].toLowerCase();

	var alg;
	if (m[1]) {
		/* They also must match algorithms, if given */
		assert.equal(m[1], m2[1], 'PEM header and footer mismatch');
		alg = m[1].trim();
	}

	lines = lines.slice(si, ei + 1);

	var headers = {};
	while (true) {
		lines = lines.slice(1);
		m = lines[0].match(/*JSSTYLED*/
		    /^([A-Za-z0-9-]+): (.+)$/);
		if (!m)
			break;
		headers[m[1].toLowerCase()] = m[2];
	}

	/* Chop off the first and last lines */
	lines = lines.slice(0, -1).join('');
	buf = Buffer.from(lines, 'base64');

	var cipher, key, iv;
	if (headers['proc-type']) {
		var parts = headers['proc-type'].split(',');
		if (parts[0] === '4' && parts[1] === 'ENCRYPTED') {
			if (typeof (options.passphrase) === 'string') {
				options.passphrase = Buffer.from(
				    options.passphrase, 'utf-8');
			}
			if (!Buffer.isBuffer(options.passphrase)) {
				throw (new errors.KeyEncryptedError(
				    options.filename, 'PEM'));
			} else {
				parts = headers['dek-info'].split(',');
				assert.ok(parts.length === 2);
				cipher = parts[0].toLowerCase();
				iv = Buffer.from(parts[1], 'hex');
				key = utils.opensslKeyDeriv(cipher, iv,
				    options.passphrase, 1).key;
			}
		}
	}

	if (alg && alg.toLowerCase() === 'encrypted') {
		var eder = new asn1.BerReader(buf);
		var pbesEnd;
		eder.readSequence();

		eder.readSequence();
		pbesEnd = eder.offset + eder.length;

		var method = eder.readOID();
		if (method !== OID_PBES2) {
			throw (new Error('Unsupported PEM/PKCS8 encryption ' +
			    'scheme: ' + method));
		}

		eder.readSequence();	/* PBES2-params */

		eder.readSequence();	/* keyDerivationFunc */
		var kdfEnd = eder.offset + eder.length;
		var kdfOid = eder.readOID();
		if (kdfOid !== OID_PBKDF2)
			throw (new Error('Unsupported PBES2 KDF: ' + kdfOid));
		eder.readSequence();
		var salt = eder.readString(asn1.Ber.OctetString, true);
		var iterations = eder.readInt();
		var hashAlg = 'sha1';
		if (eder.offset < kdfEnd) {
			eder.readSequence();
			var hashAlgOid = eder.readOID();
			hashAlg = OID_TO_HASH[hashAlgOid];
			if (hashAlg === undefined) {
				throw (new Error('Unsupported PBKDF2 hash: ' +
				    hashAlgOid));
			}
		}
		eder._offset = kdfEnd;

		eder.readSequence();	/* encryptionScheme */
		var cipherOid = eder.readOID();
		cipher = OID_TO_CIPHER[cipherOid];
		if (cipher === undefined) {
			throw (new Error('Unsupported PBES2 cipher: ' +
			    cipherOid));
		}
		iv = eder.readString(asn1.Ber.OctetString, true);

		eder._offset = pbesEnd;
		buf = eder.readString(asn1.Ber.OctetString, true);

		if (typeof (options.passphrase) === 'string') {
			options.passphrase = Buffer.from(
			    options.passphrase, 'utf-8');
		}
		if (!Buffer.isBuffer(options.passphrase)) {
			throw (new errors.KeyEncryptedError(
			    options.filename, 'PEM'));
		}

		var cinfo = utils.opensshCipherInfo(cipher);

		cipher = cinfo.opensslName;
		key = utils.pbkdf2(hashAlg, salt, iterations, cinfo.keySize,
		    options.passphrase);
		alg = undefined;
	}

	if (cipher && key && iv) {
		var cipherStream = crypto.createDecipheriv(cipher, key, iv);
		var chunk, chunks = [];
		cipherStream.once('error', function (e) {
			if (e.toString().indexOf('bad decrypt') !== -1) {
				throw (new Error('Incorrect passphrase ' +
				    'supplied, could not decrypt key'));
			}
			throw (e);
		});
		cipherStream.write(buf);
		cipherStream.end();
		while ((chunk = cipherStream.read()) !== null)
			chunks.push(chunk);
		buf = Buffer.concat(chunks);
	}

	/* The new OpenSSH internal format abuses PEM headers */
	if (alg && alg.toLowerCase() === 'openssh')
		return (sshpriv.readSSHPrivate(type, buf, options));
	if (alg && alg.toLowerCase() === 'ssh2')
		return (rfc4253.readType(type, buf, options));

	var der = new asn1.BerReader(buf);
	der.originalInput = input;

	/*
	 * All of the PEM file types start with a sequence tag, so chop it
	 * off here
	 */
	der.readSequence();

	/* PKCS#1 type keys name an algorithm in the banner explicitly */
	if (alg) {
		if (forceType)
			assert.strictEqual(forceType, 'pkcs1');
		return (pkcs1.readPkcs1(alg, type, der));
	} else {
		if (forceType)
			assert.strictEqual(forceType, 'pkcs8');
		return (pkcs8.readPkcs8(alg, type, der));
	}
}

function write(key, options, type) {
	assert.object(key);

	var alg = {
	    'ecdsa': 'EC',
	    'rsa': 'RSA',
	    'dsa': 'DSA',
	    'ed25519': 'EdDSA'
	}[key.type];
	var header;

	var der = new asn1.BerWriter();

	if (PrivateKey.isPrivateKey(key)) {
		if (type && type === 'pkcs8') {
			header = 'PRIVATE KEY';
			pkcs8.writePkcs8(der, key);
		} else {
			if (type)
				assert.strictEqual(type, 'pkcs1');
			header = alg + ' PRIVATE KEY';
			pkcs1.writePkcs1(der, key);
		}

	} else if (Key.isKey(key)) {
		if (type && type === 'pkcs1') {
			header = alg + ' PUBLIC KEY';
			pkcs1.writePkcs1(der, key);
		} else {
			if (type)
				assert.strictEqual(type, 'pkcs8');
			header = 'PUBLIC KEY';
			pkcs8.writePkcs8(der, key);
		}

	} else {
		throw (new Error('key is not a Key or PrivateKey'));
	}

	var tmp = der.buffer.toString('base64');
	var len = tmp.length + (tmp.length / 64) +
	    18 + 16 + header.length*2 + 10;
	var buf = Buffer.alloc(len);
	var o = 0;
	o += buf.write('-----BEGIN ' + header + '-----\n', o);
	for (var i = 0; i < tmp.length; ) {
		var limit = i + 64;
		if (limit > tmp.length)
			limit = tmp.length;
		o += buf.write(tmp.slice(i, limit), o);
		buf[o++] = 10;
		i = limit;
	}
	o += buf.write('-----END ' + header + '-----\n', o);

	return (buf.slice(0, o));
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pkcs1":1572231845947,"./pkcs8":1572231845948,"./ssh-private":1572231845949,"./rfc4253":1572231845950,"../errors":1572231845938}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845947, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	read: read,
	readPkcs1: readPkcs1,
	write: write,
	writePkcs1: writePkcs1
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');

var Key = require('../key');
var PrivateKey = require('../private-key');
var pem = require('./pem');

var pkcs8 = require('./pkcs8');
var readECDSACurve = pkcs8.readECDSACurve;

function read(buf, options) {
	return (pem.read(buf, options, 'pkcs1'));
}

function write(key, options) {
	return (pem.write(key, options, 'pkcs1'));
}

/* Helper to read in a single mpint */
function readMPInt(der, nm) {
	assert.strictEqual(der.peek(), asn1.Ber.Integer,
	    nm + ' is not an Integer');
	return (utils.mpNormalize(der.readString(asn1.Ber.Integer, true)));
}

function readPkcs1(alg, type, der) {
	switch (alg) {
	case 'RSA':
		if (type === 'public')
			return (readPkcs1RSAPublic(der));
		else if (type === 'private')
			return (readPkcs1RSAPrivate(der));
		throw (new Error('Unknown key type: ' + type));
	case 'DSA':
		if (type === 'public')
			return (readPkcs1DSAPublic(der));
		else if (type === 'private')
			return (readPkcs1DSAPrivate(der));
		throw (new Error('Unknown key type: ' + type));
	case 'EC':
	case 'ECDSA':
		if (type === 'private')
			return (readPkcs1ECDSAPrivate(der));
		else if (type === 'public')
			return (readPkcs1ECDSAPublic(der));
		throw (new Error('Unknown key type: ' + type));
	case 'EDDSA':
	case 'EdDSA':
		if (type === 'private')
			return (readPkcs1EdDSAPrivate(der));
		throw (new Error(type + ' keys not supported with EdDSA'));
	default:
		throw (new Error('Unknown key algo: ' + alg));
	}
}

function readPkcs1RSAPublic(der) {
	// modulus and exponent
	var n = readMPInt(der, 'modulus');
	var e = readMPInt(der, 'exponent');

	// now, make the key
	var key = {
		type: 'rsa',
		parts: [
			{ name: 'e', data: e },
			{ name: 'n', data: n }
		]
	};

	return (new Key(key));
}

function readPkcs1RSAPrivate(der) {
	var version = readMPInt(der, 'version');
	assert.strictEqual(version[0], 0);

	// modulus then public exponent
	var n = readMPInt(der, 'modulus');
	var e = readMPInt(der, 'public exponent');
	var d = readMPInt(der, 'private exponent');
	var p = readMPInt(der, 'prime1');
	var q = readMPInt(der, 'prime2');
	var dmodp = readMPInt(der, 'exponent1');
	var dmodq = readMPInt(der, 'exponent2');
	var iqmp = readMPInt(der, 'iqmp');

	// now, make the key
	var key = {
		type: 'rsa',
		parts: [
			{ name: 'n', data: n },
			{ name: 'e', data: e },
			{ name: 'd', data: d },
			{ name: 'iqmp', data: iqmp },
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'dmodp', data: dmodp },
			{ name: 'dmodq', data: dmodq }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs1DSAPrivate(der) {
	var version = readMPInt(der, 'version');
	assert.strictEqual(version.readUInt8(0), 0);

	var p = readMPInt(der, 'p');
	var q = readMPInt(der, 'q');
	var g = readMPInt(der, 'g');
	var y = readMPInt(der, 'y');
	var x = readMPInt(der, 'x');

	// now, make the key
	var key = {
		type: 'dsa',
		parts: [
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'g', data: g },
			{ name: 'y', data: y },
			{ name: 'x', data: x }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs1EdDSAPrivate(der) {
	var version = readMPInt(der, 'version');
	assert.strictEqual(version.readUInt8(0), 1);

	// private key
	var k = der.readString(asn1.Ber.OctetString, true);

	der.readSequence(0xa0);
	var oid = der.readOID();
	assert.strictEqual(oid, '1.3.101.112', 'the ed25519 curve identifier');

	der.readSequence(0xa1);
	var A = utils.readBitString(der);

	var key = {
		type: 'ed25519',
		parts: [
			{ name: 'A', data: utils.zeroPadToLength(A, 32) },
			{ name: 'k', data: k }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs1DSAPublic(der) {
	var y = readMPInt(der, 'y');
	var p = readMPInt(der, 'p');
	var q = readMPInt(der, 'q');
	var g = readMPInt(der, 'g');

	var key = {
		type: 'dsa',
		parts: [
			{ name: 'y', data: y },
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'g', data: g }
		]
	};

	return (new Key(key));
}

function readPkcs1ECDSAPublic(der) {
	der.readSequence();

	var oid = der.readOID();
	assert.strictEqual(oid, '1.2.840.10045.2.1', 'must be ecPublicKey');

	var curveOid = der.readOID();

	var curve;
	var curves = Object.keys(algs.curves);
	for (var j = 0; j < curves.length; ++j) {
		var c = curves[j];
		var cd = algs.curves[c];
		if (cd.pkcs8oid === curveOid) {
			curve = c;
			break;
		}
	}
	assert.string(curve, 'a known ECDSA named curve');

	var Q = der.readString(asn1.Ber.BitString, true);
	Q = utils.ecNormalize(Q);

	var key = {
		type: 'ecdsa',
		parts: [
			{ name: 'curve', data: Buffer.from(curve) },
			{ name: 'Q', data: Q }
		]
	};

	return (new Key(key));
}

function readPkcs1ECDSAPrivate(der) {
	var version = readMPInt(der, 'version');
	assert.strictEqual(version.readUInt8(0), 1);

	// private key
	var d = der.readString(asn1.Ber.OctetString, true);

	der.readSequence(0xa0);
	var curve = readECDSACurve(der);
	assert.string(curve, 'a known elliptic curve');

	der.readSequence(0xa1);
	var Q = der.readString(asn1.Ber.BitString, true);
	Q = utils.ecNormalize(Q);

	var key = {
		type: 'ecdsa',
		parts: [
			{ name: 'curve', data: Buffer.from(curve) },
			{ name: 'Q', data: Q },
			{ name: 'd', data: d }
		]
	};

	return (new PrivateKey(key));
}

function writePkcs1(der, key) {
	der.startSequence();

	switch (key.type) {
	case 'rsa':
		if (PrivateKey.isPrivateKey(key))
			writePkcs1RSAPrivate(der, key);
		else
			writePkcs1RSAPublic(der, key);
		break;
	case 'dsa':
		if (PrivateKey.isPrivateKey(key))
			writePkcs1DSAPrivate(der, key);
		else
			writePkcs1DSAPublic(der, key);
		break;
	case 'ecdsa':
		if (PrivateKey.isPrivateKey(key))
			writePkcs1ECDSAPrivate(der, key);
		else
			writePkcs1ECDSAPublic(der, key);
		break;
	case 'ed25519':
		if (PrivateKey.isPrivateKey(key))
			writePkcs1EdDSAPrivate(der, key);
		else
			writePkcs1EdDSAPublic(der, key);
		break;
	default:
		throw (new Error('Unknown key algo: ' + key.type));
	}

	der.endSequence();
}

function writePkcs1RSAPublic(der, key) {
	der.writeBuffer(key.part.n.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.e.data, asn1.Ber.Integer);
}

function writePkcs1RSAPrivate(der, key) {
	var ver = Buffer.from([0]);
	der.writeBuffer(ver, asn1.Ber.Integer);

	der.writeBuffer(key.part.n.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.e.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.d.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	if (!key.part.dmodp || !key.part.dmodq)
		utils.addRSAMissing(key);
	der.writeBuffer(key.part.dmodp.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.dmodq.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.iqmp.data, asn1.Ber.Integer);
}

function writePkcs1DSAPrivate(der, key) {
	var ver = Buffer.from([0]);
	der.writeBuffer(ver, asn1.Ber.Integer);

	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.g.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.y.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.x.data, asn1.Ber.Integer);
}

function writePkcs1DSAPublic(der, key) {
	der.writeBuffer(key.part.y.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.g.data, asn1.Ber.Integer);
}

function writePkcs1ECDSAPublic(der, key) {
	der.startSequence();

	der.writeOID('1.2.840.10045.2.1'); /* ecPublicKey */
	var curve = key.part.curve.data.toString();
	var curveOid = algs.curves[curve].pkcs8oid;
	assert.string(curveOid, 'a known ECDSA named curve');
	der.writeOID(curveOid);

	der.endSequence();

	var Q = utils.ecNormalize(key.part.Q.data, true);
	der.writeBuffer(Q, asn1.Ber.BitString);
}

function writePkcs1ECDSAPrivate(der, key) {
	var ver = Buffer.from([1]);
	der.writeBuffer(ver, asn1.Ber.Integer);

	der.writeBuffer(key.part.d.data, asn1.Ber.OctetString);

	der.startSequence(0xa0);
	var curve = key.part.curve.data.toString();
	var curveOid = algs.curves[curve].pkcs8oid;
	assert.string(curveOid, 'a known ECDSA named curve');
	der.writeOID(curveOid);
	der.endSequence();

	der.startSequence(0xa1);
	var Q = utils.ecNormalize(key.part.Q.data, true);
	der.writeBuffer(Q, asn1.Ber.BitString);
	der.endSequence();
}

function writePkcs1EdDSAPrivate(der, key) {
	var ver = Buffer.from([1]);
	der.writeBuffer(ver, asn1.Ber.Integer);

	der.writeBuffer(key.part.k.data, asn1.Ber.OctetString);

	der.startSequence(0xa0);
	der.writeOID('1.3.101.112');
	der.endSequence();

	der.startSequence(0xa1);
	utils.writeBitString(der, key.part.A.data);
	der.endSequence();
}

function writePkcs1EdDSAPublic(der, key) {
	throw (new Error('Public keys are not supported for EdDSA PKCS#1'));
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946,"./pkcs8":1572231845948}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845948, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = {
	read: read,
	readPkcs8: readPkcs8,
	write: write,
	writePkcs8: writePkcs8,
	pkcs8ToBuffer: pkcs8ToBuffer,

	readECDSACurve: readECDSACurve,
	writeECDSACurve: writeECDSACurve
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');
var pem = require('./pem');

function read(buf, options) {
	return (pem.read(buf, options, 'pkcs8'));
}

function write(key, options) {
	return (pem.write(key, options, 'pkcs8'));
}

/* Helper to read in a single mpint */
function readMPInt(der, nm) {
	assert.strictEqual(der.peek(), asn1.Ber.Integer,
	    nm + ' is not an Integer');
	return (utils.mpNormalize(der.readString(asn1.Ber.Integer, true)));
}

function readPkcs8(alg, type, der) {
	/* Private keys in pkcs#8 format have a weird extra int */
	if (der.peek() === asn1.Ber.Integer) {
		assert.strictEqual(type, 'private',
		    'unexpected Integer at start of public key');
		der.readString(asn1.Ber.Integer, true);
	}

	der.readSequence();
	var next = der.offset + der.length;

	var oid = der.readOID();
	switch (oid) {
	case '1.2.840.113549.1.1.1':
		der._offset = next;
		if (type === 'public')
			return (readPkcs8RSAPublic(der));
		else
			return (readPkcs8RSAPrivate(der));
	case '1.2.840.10040.4.1':
		if (type === 'public')
			return (readPkcs8DSAPublic(der));
		else
			return (readPkcs8DSAPrivate(der));
	case '1.2.840.10045.2.1':
		if (type === 'public')
			return (readPkcs8ECDSAPublic(der));
		else
			return (readPkcs8ECDSAPrivate(der));
	case '1.3.101.112':
		if (type === 'public') {
			return (readPkcs8EdDSAPublic(der));
		} else {
			return (readPkcs8EdDSAPrivate(der));
		}
	case '1.3.101.110':
		if (type === 'public') {
			return (readPkcs8X25519Public(der));
		} else {
			return (readPkcs8X25519Private(der));
		}
	default:
		throw (new Error('Unknown key type OID ' + oid));
	}
}

function readPkcs8RSAPublic(der) {
	// bit string sequence
	der.readSequence(asn1.Ber.BitString);
	der.readByte();
	der.readSequence();

	// modulus
	var n = readMPInt(der, 'modulus');
	var e = readMPInt(der, 'exponent');

	// now, make the key
	var key = {
		type: 'rsa',
		source: der.originalInput,
		parts: [
			{ name: 'e', data: e },
			{ name: 'n', data: n }
		]
	};

	return (new Key(key));
}

function readPkcs8RSAPrivate(der) {
	der.readSequence(asn1.Ber.OctetString);
	der.readSequence();

	var ver = readMPInt(der, 'version');
	assert.equal(ver[0], 0x0, 'unknown RSA private key version');

	// modulus then public exponent
	var n = readMPInt(der, 'modulus');
	var e = readMPInt(der, 'public exponent');
	var d = readMPInt(der, 'private exponent');
	var p = readMPInt(der, 'prime1');
	var q = readMPInt(der, 'prime2');
	var dmodp = readMPInt(der, 'exponent1');
	var dmodq = readMPInt(der, 'exponent2');
	var iqmp = readMPInt(der, 'iqmp');

	// now, make the key
	var key = {
		type: 'rsa',
		parts: [
			{ name: 'n', data: n },
			{ name: 'e', data: e },
			{ name: 'd', data: d },
			{ name: 'iqmp', data: iqmp },
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'dmodp', data: dmodp },
			{ name: 'dmodq', data: dmodq }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs8DSAPublic(der) {
	der.readSequence();

	var p = readMPInt(der, 'p');
	var q = readMPInt(der, 'q');
	var g = readMPInt(der, 'g');

	// bit string sequence
	der.readSequence(asn1.Ber.BitString);
	der.readByte();

	var y = readMPInt(der, 'y');

	// now, make the key
	var key = {
		type: 'dsa',
		parts: [
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'g', data: g },
			{ name: 'y', data: y }
		]
	};

	return (new Key(key));
}

function readPkcs8DSAPrivate(der) {
	der.readSequence();

	var p = readMPInt(der, 'p');
	var q = readMPInt(der, 'q');
	var g = readMPInt(der, 'g');

	der.readSequence(asn1.Ber.OctetString);
	var x = readMPInt(der, 'x');

	/* The pkcs#8 format does not include the public key */
	var y = utils.calculateDSAPublic(g, p, x);

	var key = {
		type: 'dsa',
		parts: [
			{ name: 'p', data: p },
			{ name: 'q', data: q },
			{ name: 'g', data: g },
			{ name: 'y', data: y },
			{ name: 'x', data: x }
		]
	};

	return (new PrivateKey(key));
}

function readECDSACurve(der) {
	var curveName, curveNames;
	var j, c, cd;

	if (der.peek() === asn1.Ber.OID) {
		var oid = der.readOID();

		curveNames = Object.keys(algs.curves);
		for (j = 0; j < curveNames.length; ++j) {
			c = curveNames[j];
			cd = algs.curves[c];
			if (cd.pkcs8oid === oid) {
				curveName = c;
				break;
			}
		}

	} else {
		// ECParameters sequence
		der.readSequence();
		var version = der.readString(asn1.Ber.Integer, true);
		assert.strictEqual(version[0], 1, 'ECDSA key not version 1');

		var curve = {};

		// FieldID sequence
		der.readSequence();
		var fieldTypeOid = der.readOID();
		assert.strictEqual(fieldTypeOid, '1.2.840.10045.1.1',
		    'ECDSA key is not from a prime-field');
		var p = curve.p = utils.mpNormalize(
		    der.readString(asn1.Ber.Integer, true));
		/*
		 * p always starts with a 1 bit, so count the zeros to get its
		 * real size.
		 */
		curve.size = p.length * 8 - utils.countZeros(p);

		// Curve sequence
		der.readSequence();
		curve.a = utils.mpNormalize(
		    der.readString(asn1.Ber.OctetString, true));
		curve.b = utils.mpNormalize(
		    der.readString(asn1.Ber.OctetString, true));
		if (der.peek() === asn1.Ber.BitString)
			curve.s = der.readString(asn1.Ber.BitString, true);

		// Combined Gx and Gy
		curve.G = der.readString(asn1.Ber.OctetString, true);
		assert.strictEqual(curve.G[0], 0x4,
		    'uncompressed G is required');

		curve.n = utils.mpNormalize(
		    der.readString(asn1.Ber.Integer, true));
		curve.h = utils.mpNormalize(
		    der.readString(asn1.Ber.Integer, true));
		assert.strictEqual(curve.h[0], 0x1, 'a cofactor=1 curve is ' +
		    'required');

		curveNames = Object.keys(algs.curves);
		var ks = Object.keys(curve);
		for (j = 0; j < curveNames.length; ++j) {
			c = curveNames[j];
			cd = algs.curves[c];
			var equal = true;
			for (var i = 0; i < ks.length; ++i) {
				var k = ks[i];
				if (cd[k] === undefined)
					continue;
				if (typeof (cd[k]) === 'object' &&
				    cd[k].equals !== undefined) {
					if (!cd[k].equals(curve[k])) {
						equal = false;
						break;
					}
				} else if (Buffer.isBuffer(cd[k])) {
					if (cd[k].toString('binary')
					    !== curve[k].toString('binary')) {
						equal = false;
						break;
					}
				} else {
					if (cd[k] !== curve[k]) {
						equal = false;
						break;
					}
				}
			}
			if (equal) {
				curveName = c;
				break;
			}
		}
	}
	return (curveName);
}

function readPkcs8ECDSAPrivate(der) {
	var curveName = readECDSACurve(der);
	assert.string(curveName, 'a known elliptic curve');

	der.readSequence(asn1.Ber.OctetString);
	der.readSequence();

	var version = readMPInt(der, 'version');
	assert.equal(version[0], 1, 'unknown version of ECDSA key');

	var d = der.readString(asn1.Ber.OctetString, true);
	var Q;

	if (der.peek() == 0xa0) {
		der.readSequence(0xa0);
		der._offset += der.length;
	}
	if (der.peek() == 0xa1) {
		der.readSequence(0xa1);
		Q = der.readString(asn1.Ber.BitString, true);
		Q = utils.ecNormalize(Q);
	}

	if (Q === undefined) {
		var pub = utils.publicFromPrivateECDSA(curveName, d);
		Q = pub.part.Q.data;
	}

	var key = {
		type: 'ecdsa',
		parts: [
			{ name: 'curve', data: Buffer.from(curveName) },
			{ name: 'Q', data: Q },
			{ name: 'd', data: d }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs8ECDSAPublic(der) {
	var curveName = readECDSACurve(der);
	assert.string(curveName, 'a known elliptic curve');

	var Q = der.readString(asn1.Ber.BitString, true);
	Q = utils.ecNormalize(Q);

	var key = {
		type: 'ecdsa',
		parts: [
			{ name: 'curve', data: Buffer.from(curveName) },
			{ name: 'Q', data: Q }
		]
	};

	return (new Key(key));
}

function readPkcs8EdDSAPublic(der) {
	if (der.peek() === 0x00)
		der.readByte();

	var A = utils.readBitString(der);

	var key = {
		type: 'ed25519',
		parts: [
			{ name: 'A', data: utils.zeroPadToLength(A, 32) }
		]
	};

	return (new Key(key));
}

function readPkcs8X25519Public(der) {
	var A = utils.readBitString(der);

	var key = {
		type: 'curve25519',
		parts: [
			{ name: 'A', data: utils.zeroPadToLength(A, 32) }
		]
	};

	return (new Key(key));
}

function readPkcs8EdDSAPrivate(der) {
	if (der.peek() === 0x00)
		der.readByte();

	der.readSequence(asn1.Ber.OctetString);
	var k = der.readString(asn1.Ber.OctetString, true);
	k = utils.zeroPadToLength(k, 32);

	var A;
	if (der.peek() === asn1.Ber.BitString) {
		A = utils.readBitString(der);
		A = utils.zeroPadToLength(A, 32);
	} else {
		A = utils.calculateED25519Public(k);
	}

	var key = {
		type: 'ed25519',
		parts: [
			{ name: 'A', data: utils.zeroPadToLength(A, 32) },
			{ name: 'k', data: utils.zeroPadToLength(k, 32) }
		]
	};

	return (new PrivateKey(key));
}

function readPkcs8X25519Private(der) {
	if (der.peek() === 0x00)
		der.readByte();

	der.readSequence(asn1.Ber.OctetString);
	var k = der.readString(asn1.Ber.OctetString, true);
	k = utils.zeroPadToLength(k, 32);

	var A = utils.calculateX25519Public(k);

	var key = {
		type: 'curve25519',
		parts: [
			{ name: 'A', data: utils.zeroPadToLength(A, 32) },
			{ name: 'k', data: utils.zeroPadToLength(k, 32) }
		]
	};

	return (new PrivateKey(key));
}

function pkcs8ToBuffer(key) {
	var der = new asn1.BerWriter();
	writePkcs8(der, key);
	return (der.buffer);
}

function writePkcs8(der, key) {
	der.startSequence();

	if (PrivateKey.isPrivateKey(key)) {
		var sillyInt = Buffer.from([0]);
		der.writeBuffer(sillyInt, asn1.Ber.Integer);
	}

	der.startSequence();
	switch (key.type) {
	case 'rsa':
		der.writeOID('1.2.840.113549.1.1.1');
		if (PrivateKey.isPrivateKey(key))
			writePkcs8RSAPrivate(key, der);
		else
			writePkcs8RSAPublic(key, der);
		break;
	case 'dsa':
		der.writeOID('1.2.840.10040.4.1');
		if (PrivateKey.isPrivateKey(key))
			writePkcs8DSAPrivate(key, der);
		else
			writePkcs8DSAPublic(key, der);
		break;
	case 'ecdsa':
		der.writeOID('1.2.840.10045.2.1');
		if (PrivateKey.isPrivateKey(key))
			writePkcs8ECDSAPrivate(key, der);
		else
			writePkcs8ECDSAPublic(key, der);
		break;
	case 'ed25519':
		der.writeOID('1.3.101.112');
		if (PrivateKey.isPrivateKey(key))
			throw (new Error('Ed25519 private keys in pkcs8 ' +
			    'format are not supported'));
		writePkcs8EdDSAPublic(key, der);
		break;
	default:
		throw (new Error('Unsupported key type: ' + key.type));
	}

	der.endSequence();
}

function writePkcs8RSAPrivate(key, der) {
	der.writeNull();
	der.endSequence();

	der.startSequence(asn1.Ber.OctetString);
	der.startSequence();

	var version = Buffer.from([0]);
	der.writeBuffer(version, asn1.Ber.Integer);

	der.writeBuffer(key.part.n.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.e.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.d.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	if (!key.part.dmodp || !key.part.dmodq)
		utils.addRSAMissing(key);
	der.writeBuffer(key.part.dmodp.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.dmodq.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.iqmp.data, asn1.Ber.Integer);

	der.endSequence();
	der.endSequence();
}

function writePkcs8RSAPublic(key, der) {
	der.writeNull();
	der.endSequence();

	der.startSequence(asn1.Ber.BitString);
	der.writeByte(0x00);

	der.startSequence();
	der.writeBuffer(key.part.n.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.e.data, asn1.Ber.Integer);
	der.endSequence();

	der.endSequence();
}

function writePkcs8DSAPrivate(key, der) {
	der.startSequence();
	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.g.data, asn1.Ber.Integer);
	der.endSequence();

	der.endSequence();

	der.startSequence(asn1.Ber.OctetString);
	der.writeBuffer(key.part.x.data, asn1.Ber.Integer);
	der.endSequence();
}

function writePkcs8DSAPublic(key, der) {
	der.startSequence();
	der.writeBuffer(key.part.p.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.q.data, asn1.Ber.Integer);
	der.writeBuffer(key.part.g.data, asn1.Ber.Integer);
	der.endSequence();
	der.endSequence();

	der.startSequence(asn1.Ber.BitString);
	der.writeByte(0x00);
	der.writeBuffer(key.part.y.data, asn1.Ber.Integer);
	der.endSequence();
}

function writeECDSACurve(key, der) {
	var curve = algs.curves[key.curve];
	if (curve.pkcs8oid) {
		/* This one has a name in pkcs#8, so just write the oid */
		der.writeOID(curve.pkcs8oid);

	} else {
		// ECParameters sequence
		der.startSequence();

		var version = Buffer.from([1]);
		der.writeBuffer(version, asn1.Ber.Integer);

		// FieldID sequence
		der.startSequence();
		der.writeOID('1.2.840.10045.1.1'); // prime-field
		der.writeBuffer(curve.p, asn1.Ber.Integer);
		der.endSequence();

		// Curve sequence
		der.startSequence();
		var a = curve.p;
		if (a[0] === 0x0)
			a = a.slice(1);
		der.writeBuffer(a, asn1.Ber.OctetString);
		der.writeBuffer(curve.b, asn1.Ber.OctetString);
		der.writeBuffer(curve.s, asn1.Ber.BitString);
		der.endSequence();

		der.writeBuffer(curve.G, asn1.Ber.OctetString);
		der.writeBuffer(curve.n, asn1.Ber.Integer);
		var h = curve.h;
		if (!h) {
			h = Buffer.from([1]);
		}
		der.writeBuffer(h, asn1.Ber.Integer);

		// ECParameters
		der.endSequence();
	}
}

function writePkcs8ECDSAPublic(key, der) {
	writeECDSACurve(key, der);
	der.endSequence();

	var Q = utils.ecNormalize(key.part.Q.data, true);
	der.writeBuffer(Q, asn1.Ber.BitString);
}

function writePkcs8ECDSAPrivate(key, der) {
	writeECDSACurve(key, der);
	der.endSequence();

	der.startSequence(asn1.Ber.OctetString);
	der.startSequence();

	var version = Buffer.from([1]);
	der.writeBuffer(version, asn1.Ber.Integer);

	der.writeBuffer(key.part.d.data, asn1.Ber.OctetString);

	der.startSequence(0xa1);
	var Q = utils.ecNormalize(key.part.Q.data, true);
	der.writeBuffer(Q, asn1.Ber.BitString);
	der.endSequence();

	der.endSequence();
	der.endSequence();
}

function writePkcs8EdDSAPublic(key, der) {
	der.endSequence();

	utils.writeBitString(der, key.part.A.data);
}

function writePkcs8EdDSAPrivate(key, der) {
	der.endSequence();

	var k = utils.mpNormalize(key.part.k.data, true);
	der.startSequence(asn1.Ber.OctetString);
	der.writeBuffer(k, asn1.Ber.OctetString);
	der.endSequence();
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845949, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	read: read,
	readSSHPrivate: readSSHPrivate,
	write: write
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var crypto = require('crypto');

var Key = require('../key');
var PrivateKey = require('../private-key');
var pem = require('./pem');
var rfc4253 = require('./rfc4253');
var SSHBuffer = require('../ssh-buffer');
var errors = require('../errors');

var bcrypt;

function read(buf, options) {
	return (pem.read(buf, options));
}

var MAGIC = 'openssh-key-v1';

function readSSHPrivate(type, buf, options) {
	buf = new SSHBuffer({buffer: buf});

	var magic = buf.readCString();
	assert.strictEqual(magic, MAGIC, 'bad magic string');

	var cipher = buf.readString();
	var kdf = buf.readString();
	var kdfOpts = buf.readBuffer();

	var nkeys = buf.readInt();
	if (nkeys !== 1) {
		throw (new Error('OpenSSH-format key file contains ' +
		    'multiple keys: this is unsupported.'));
	}

	var pubKey = buf.readBuffer();

	if (type === 'public') {
		assert.ok(buf.atEnd(), 'excess bytes left after key');
		return (rfc4253.read(pubKey));
	}

	var privKeyBlob = buf.readBuffer();
	assert.ok(buf.atEnd(), 'excess bytes left after key');

	var kdfOptsBuf = new SSHBuffer({ buffer: kdfOpts });
	switch (kdf) {
	case 'none':
		if (cipher !== 'none') {
			throw (new Error('OpenSSH-format key uses KDF "none" ' +
			     'but specifies a cipher other than "none"'));
		}
		break;
	case 'bcrypt':
		var salt = kdfOptsBuf.readBuffer();
		var rounds = kdfOptsBuf.readInt();
		var cinf = utils.opensshCipherInfo(cipher);
		if (bcrypt === undefined) {
			bcrypt = require('bcrypt-pbkdf');
		}

		if (typeof (options.passphrase) === 'string') {
			options.passphrase = Buffer.from(options.passphrase,
			    'utf-8');
		}
		if (!Buffer.isBuffer(options.passphrase)) {
			throw (new errors.KeyEncryptedError(
			    options.filename, 'OpenSSH'));
		}

		var pass = new Uint8Array(options.passphrase);
		var salti = new Uint8Array(salt);
		/* Use the pbkdf to derive both the key and the IV. */
		var out = new Uint8Array(cinf.keySize + cinf.blockSize);
		var res = bcrypt.pbkdf(pass, pass.length, salti, salti.length,
		    out, out.length, rounds);
		if (res !== 0) {
			throw (new Error('bcrypt_pbkdf function returned ' +
			    'failure, parameters invalid'));
		}
		out = Buffer.from(out);
		var ckey = out.slice(0, cinf.keySize);
		var iv = out.slice(cinf.keySize, cinf.keySize + cinf.blockSize);
		var cipherStream = crypto.createDecipheriv(cinf.opensslName,
		    ckey, iv);
		cipherStream.setAutoPadding(false);
		var chunk, chunks = [];
		cipherStream.once('error', function (e) {
			if (e.toString().indexOf('bad decrypt') !== -1) {
				throw (new Error('Incorrect passphrase ' +
				    'supplied, could not decrypt key'));
			}
			throw (e);
		});
		cipherStream.write(privKeyBlob);
		cipherStream.end();
		while ((chunk = cipherStream.read()) !== null)
			chunks.push(chunk);
		privKeyBlob = Buffer.concat(chunks);
		break;
	default:
		throw (new Error(
		    'OpenSSH-format key uses unknown KDF "' + kdf + '"'));
	}

	buf = new SSHBuffer({buffer: privKeyBlob});

	var checkInt1 = buf.readInt();
	var checkInt2 = buf.readInt();
	if (checkInt1 !== checkInt2) {
		throw (new Error('Incorrect passphrase supplied, could not ' +
		    'decrypt key'));
	}

	var ret = {};
	var key = rfc4253.readInternal(ret, 'private', buf.remainder());

	buf.skip(ret.consumed);

	var comment = buf.readString();
	key.comment = comment;

	return (key);
}

function write(key, options) {
	var pubKey;
	if (PrivateKey.isPrivateKey(key))
		pubKey = key.toPublic();
	else
		pubKey = key;

	var cipher = 'none';
	var kdf = 'none';
	var kdfopts = Buffer.alloc(0);
	var cinf = { blockSize: 8 };
	var passphrase;
	if (options !== undefined) {
		passphrase = options.passphrase;
		if (typeof (passphrase) === 'string')
			passphrase = Buffer.from(passphrase, 'utf-8');
		if (passphrase !== undefined) {
			assert.buffer(passphrase, 'options.passphrase');
			assert.optionalString(options.cipher, 'options.cipher');
			cipher = options.cipher;
			if (cipher === undefined)
				cipher = 'aes128-ctr';
			cinf = utils.opensshCipherInfo(cipher);
			kdf = 'bcrypt';
		}
	}

	var privBuf;
	if (PrivateKey.isPrivateKey(key)) {
		privBuf = new SSHBuffer({});
		var checkInt = crypto.randomBytes(4).readUInt32BE(0);
		privBuf.writeInt(checkInt);
		privBuf.writeInt(checkInt);
		privBuf.write(key.toBuffer('rfc4253'));
		privBuf.writeString(key.comment || '');

		var n = 1;
		while (privBuf._offset % cinf.blockSize !== 0)
			privBuf.writeChar(n++);
		privBuf = privBuf.toBuffer();
	}

	switch (kdf) {
	case 'none':
		break;
	case 'bcrypt':
		var salt = crypto.randomBytes(16);
		var rounds = 16;
		var kdfssh = new SSHBuffer({});
		kdfssh.writeBuffer(salt);
		kdfssh.writeInt(rounds);
		kdfopts = kdfssh.toBuffer();

		if (bcrypt === undefined) {
			bcrypt = require('bcrypt-pbkdf');
		}
		var pass = new Uint8Array(passphrase);
		var salti = new Uint8Array(salt);
		/* Use the pbkdf to derive both the key and the IV. */
		var out = new Uint8Array(cinf.keySize + cinf.blockSize);
		var res = bcrypt.pbkdf(pass, pass.length, salti, salti.length,
		    out, out.length, rounds);
		if (res !== 0) {
			throw (new Error('bcrypt_pbkdf function returned ' +
			    'failure, parameters invalid'));
		}
		out = Buffer.from(out);
		var ckey = out.slice(0, cinf.keySize);
		var iv = out.slice(cinf.keySize, cinf.keySize + cinf.blockSize);

		var cipherStream = crypto.createCipheriv(cinf.opensslName,
		    ckey, iv);
		cipherStream.setAutoPadding(false);
		var chunk, chunks = [];
		cipherStream.once('error', function (e) {
			throw (e);
		});
		cipherStream.write(privBuf);
		cipherStream.end();
		while ((chunk = cipherStream.read()) !== null)
			chunks.push(chunk);
		privBuf = Buffer.concat(chunks);
		break;
	default:
		throw (new Error('Unsupported kdf ' + kdf));
	}

	var buf = new SSHBuffer({});

	buf.writeCString(MAGIC);
	buf.writeString(cipher);	/* cipher */
	buf.writeString(kdf);		/* kdf */
	buf.writeBuffer(kdfopts);	/* kdfoptions */

	buf.writeInt(1);		/* nkeys */
	buf.writeBuffer(pubKey.toBuffer('rfc4253'));

	if (privBuf)
		buf.writeBuffer(privBuf);

	buf = buf.toBuffer();

	var header;
	if (PrivateKey.isPrivateKey(key))
		header = 'OPENSSH PRIVATE KEY';
	else
		header = 'OPENSSH PUBLIC KEY';

	var tmp = buf.toString('base64');
	var len = tmp.length + (tmp.length / 70) +
	    18 + 16 + header.length*2 + 10;
	buf = Buffer.alloc(len);
	var o = 0;
	o += buf.write('-----BEGIN ' + header + '-----\n', o);
	for (var i = 0; i < tmp.length; ) {
		var limit = i + 70;
		if (limit > tmp.length)
			limit = tmp.length;
		o += buf.write(tmp.slice(i, limit), o);
		buf[o++] = 10;
		i = limit;
	}
	o += buf.write('-----END ' + header + '-----\n', o);

	return (buf.slice(0, o));
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946,"./rfc4253":1572231845950,"../ssh-buffer":1572231845942,"../errors":1572231845938}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845950, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	read: read.bind(undefined, false, undefined),
	readType: read.bind(undefined, false),
	write: write,
	/* semi-private api, used by sshpk-agent */
	readPartial: read.bind(undefined, true),

	/* shared with ssh format */
	readInternal: read,
	keyTypeToAlg: keyTypeToAlg,
	algToKeyType: algToKeyType
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');
var SSHBuffer = require('../ssh-buffer');

function algToKeyType(alg) {
	assert.string(alg);
	if (alg === 'ssh-dss')
		return ('dsa');
	else if (alg === 'ssh-rsa')
		return ('rsa');
	else if (alg === 'ssh-ed25519')
		return ('ed25519');
	else if (alg === 'ssh-curve25519')
		return ('curve25519');
	else if (alg.match(/^ecdsa-sha2-/))
		return ('ecdsa');
	else
		throw (new Error('Unknown algorithm ' + alg));
}

function keyTypeToAlg(key) {
	assert.object(key);
	if (key.type === 'dsa')
		return ('ssh-dss');
	else if (key.type === 'rsa')
		return ('ssh-rsa');
	else if (key.type === 'ed25519')
		return ('ssh-ed25519');
	else if (key.type === 'curve25519')
		return ('ssh-curve25519');
	else if (key.type === 'ecdsa')
		return ('ecdsa-sha2-' + key.part.curve.data.toString());
	else
		throw (new Error('Unknown key type ' + key.type));
}

function read(partial, type, buf, options) {
	if (typeof (buf) === 'string')
		buf = Buffer.from(buf);
	assert.buffer(buf, 'buf');

	var key = {};

	var parts = key.parts = [];
	var sshbuf = new SSHBuffer({buffer: buf});

	var alg = sshbuf.readString();
	assert.ok(!sshbuf.atEnd(), 'key must have at least one part');

	key.type = algToKeyType(alg);

	var partCount = algs.info[key.type].parts.length;
	if (type && type === 'private')
		partCount = algs.privInfo[key.type].parts.length;

	while (!sshbuf.atEnd() && parts.length < partCount)
		parts.push(sshbuf.readPart());
	while (!partial && !sshbuf.atEnd())
		parts.push(sshbuf.readPart());

	assert.ok(parts.length >= 1,
	    'key must have at least one part');
	assert.ok(partial || sshbuf.atEnd(),
	    'leftover bytes at end of key');

	var Constructor = Key;
	var algInfo = algs.info[key.type];
	if (type === 'private' || algInfo.parts.length !== parts.length) {
		algInfo = algs.privInfo[key.type];
		Constructor = PrivateKey;
	}
	assert.strictEqual(algInfo.parts.length, parts.length);

	if (key.type === 'ecdsa') {
		var res = /^ecdsa-sha2-(.+)$/.exec(alg);
		assert.ok(res !== null);
		assert.strictEqual(res[1], parts[0].data.toString());
	}

	var normalized = true;
	for (var i = 0; i < algInfo.parts.length; ++i) {
		var p = parts[i];
		p.name = algInfo.parts[i];
		/*
		 * OpenSSH stores ed25519 "private" keys as seed + public key
		 * concat'd together (k followed by A). We want to keep them
		 * separate for other formats that don't do this.
		 */
		if (key.type === 'ed25519' && p.name === 'k')
			p.data = p.data.slice(0, 32);

		if (p.name !== 'curve' && algInfo.normalize !== false) {
			var nd;
			if (key.type === 'ed25519') {
				nd = utils.zeroPadToLength(p.data, 32);
			} else {
				nd = utils.mpNormalize(p.data);
			}
			if (nd.toString('binary') !==
			    p.data.toString('binary')) {
				p.data = nd;
				normalized = false;
			}
		}
	}

	if (normalized)
		key._rfc4253Cache = sshbuf.toBuffer();

	if (partial && typeof (partial) === 'object') {
		partial.remainder = sshbuf.remainder();
		partial.consumed = sshbuf._offset;
	}

	return (new Constructor(key));
}

function write(key, options) {
	assert.object(key);

	var alg = keyTypeToAlg(key);
	var i;

	var algInfo = algs.info[key.type];
	if (PrivateKey.isPrivateKey(key))
		algInfo = algs.privInfo[key.type];
	var parts = algInfo.parts;

	var buf = new SSHBuffer({});

	buf.writeString(alg);

	for (i = 0; i < parts.length; ++i) {
		var data = key.part[parts[i]].data;
		if (algInfo.normalize !== false) {
			if (key.type === 'ed25519')
				data = utils.zeroPadToLength(data, 32);
			else
				data = utils.mpNormalize(data);
		}
		if (key.type === 'ed25519' && parts[i] === 'k')
			data = Buffer.concat([data, key.part.A.data]);
		buf.writeBuffer(data);
	}

	return (buf.toBuffer());
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"../ssh-buffer":1572231845942}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845951, function(require, module, exports) {
// Copyright 2015 Joyent, Inc.

module.exports = {
	read: read,
	write: write
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var rfc4253 = require('./rfc4253');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');

var sshpriv = require('./ssh-private');

/*JSSTYLED*/
var SSHKEY_RE = /^([a-z0-9-]+)[ \t]+([a-zA-Z0-9+\/]+[=]*)([ \t]+([^ \t][^\n]*[\n]*)?)?$/;
/*JSSTYLED*/
var SSHKEY_RE2 = /^([a-z0-9-]+)[ \t\n]+([a-zA-Z0-9+\/][a-zA-Z0-9+\/ \t\n=]*)([^a-zA-Z0-9+\/ \t\n=].*)?$/;

function read(buf, options) {
	if (typeof (buf) !== 'string') {
		assert.buffer(buf, 'buf');
		buf = buf.toString('ascii');
	}

	var trimmed = buf.trim().replace(/[\\\r]/g, '');
	var m = trimmed.match(SSHKEY_RE);
	if (!m)
		m = trimmed.match(SSHKEY_RE2);
	assert.ok(m, 'key must match regex');

	var type = rfc4253.algToKeyType(m[1]);
	var kbuf = Buffer.from(m[2], 'base64');

	/*
	 * This is a bit tricky. If we managed to parse the key and locate the
	 * key comment with the regex, then do a non-partial read and assert
	 * that we have consumed all bytes. If we couldn't locate the key
	 * comment, though, there may be whitespace shenanigans going on that
	 * have conjoined the comment to the rest of the key. We do a partial
	 * read in this case to try to make the best out of a sorry situation.
	 */
	var key;
	var ret = {};
	if (m[4]) {
		try {
			key = rfc4253.read(kbuf);

		} catch (e) {
			m = trimmed.match(SSHKEY_RE2);
			assert.ok(m, 'key must match regex');
			kbuf = Buffer.from(m[2], 'base64');
			key = rfc4253.readInternal(ret, 'public', kbuf);
		}
	} else {
		key = rfc4253.readInternal(ret, 'public', kbuf);
	}

	assert.strictEqual(type, key.type);

	if (m[4] && m[4].length > 0) {
		key.comment = m[4];

	} else if (ret.consumed) {
		/*
		 * Now the magic: trying to recover the key comment when it's
		 * gotten conjoined to the key or otherwise shenanigan'd.
		 *
		 * Work out how much base64 we used, then drop all non-base64
		 * chars from the beginning up to this point in the the string.
		 * Then offset in this and try to make up for missing = chars.
		 */
		var data = m[2] + (m[3] ? m[3] : '');
		var realOffset = Math.ceil(ret.consumed / 3) * 4;
		data = data.slice(0, realOffset - 2). /*JSSTYLED*/
		    replace(/[^a-zA-Z0-9+\/=]/g, '') +
		    data.slice(realOffset - 2);

		var padding = ret.consumed % 3;
		if (padding > 0 &&
		    data.slice(realOffset - 1, realOffset) !== '=')
			realOffset--;
		while (data.slice(realOffset, realOffset + 1) === '=')
			realOffset++;

		/* Finally, grab what we think is the comment & clean it up. */
		var trailer = data.slice(realOffset);
		trailer = trailer.replace(/[\r\n]/g, ' ').
		    replace(/^\s+/, '');
		if (trailer.match(/^[a-zA-Z0-9]/))
			key.comment = trailer;
	}

	return (key);
}

function write(key, options) {
	assert.object(key);
	if (!Key.isKey(key))
		throw (new Error('Must be a public key'));

	var parts = [];
	var alg = rfc4253.keyTypeToAlg(key);
	parts.push(alg);

	var buf = rfc4253.write(key);
	parts.push(buf.toString('base64'));

	if (key.comment)
		parts.push(key.comment);

	return (Buffer.from(parts.join(' ')));
}

}, function(modId) { var map = {"./rfc4253":1572231845950,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./ssh-private":1572231845949}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845952, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = {
	read: read,
	write: write
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var Key = require('../key');
var PrivateKey = require('../private-key');
var utils = require('../utils');
var SSHBuffer = require('../ssh-buffer');
var Dhe = require('../dhe');

var supportedAlgos = {
	'rsa-sha1' : 5,
	'rsa-sha256' : 8,
	'rsa-sha512' : 10,
	'ecdsa-p256-sha256' : 13,
	'ecdsa-p384-sha384' : 14
	/*
	 * ed25519 is hypothetically supported with id 15
	 * but the common tools available don't appear to be
	 * capable of generating/using ed25519 keys
	 */
};

var supportedAlgosById = {};
Object.keys(supportedAlgos).forEach(function (k) {
	supportedAlgosById[supportedAlgos[k]] = k.toUpperCase();
});

function read(buf, options) {
	if (typeof (buf) !== 'string') {
		assert.buffer(buf, 'buf');
		buf = buf.toString('ascii');
	}
	var lines = buf.split('\n');
	if (lines[0].match(/^Private-key-format\: v1/)) {
		var algElems = lines[1].split(' ');
		var algoNum = parseInt(algElems[1], 10);
		var algoName = algElems[2];
		if (!supportedAlgosById[algoNum])
			throw (new Error('Unsupported algorithm: ' + algoName));
		return (readDNSSECPrivateKey(algoNum, lines.slice(2)));
	}

	// skip any comment-lines
	var line = 0;
	/* JSSTYLED */
	while (lines[line].match(/^\;/))
		line++;
	// we should now have *one single* line left with our KEY on it.
	if ((lines[line].match(/\. IN KEY /) ||
	    lines[line].match(/\. IN DNSKEY /)) && lines[line+1].length === 0) {
		return (readRFC3110(lines[line]));
	}
	throw (new Error('Cannot parse dnssec key'));
}

function readRFC3110(keyString) {
	var elems = keyString.split(' ');
	//unused var flags = parseInt(elems[3], 10);
	//unused var protocol = parseInt(elems[4], 10);
	var algorithm = parseInt(elems[5], 10);
	if (!supportedAlgosById[algorithm])
		throw (new Error('Unsupported algorithm: ' + algorithm));
	var base64key = elems.slice(6, elems.length).join();
	var keyBuffer = Buffer.from(base64key, 'base64');
	if (supportedAlgosById[algorithm].match(/^RSA-/)) {
		// join the rest of the body into a single base64-blob
		var publicExponentLen = keyBuffer.readUInt8(0);
		if (publicExponentLen != 3 && publicExponentLen != 1)
			throw (new Error('Cannot parse dnssec key: ' +
			    'unsupported exponent length'));

		var publicExponent = keyBuffer.slice(1, publicExponentLen+1);
		publicExponent = utils.mpNormalize(publicExponent);
		var modulus = keyBuffer.slice(1+publicExponentLen);
		modulus = utils.mpNormalize(modulus);
		// now, make the key
		var rsaKey = {
			type: 'rsa',
			parts: []
		};
		rsaKey.parts.push({ name: 'e', data: publicExponent});
		rsaKey.parts.push({ name: 'n', data: modulus});
		return (new Key(rsaKey));
	}
	if (supportedAlgosById[algorithm] === 'ECDSA-P384-SHA384' ||
	    supportedAlgosById[algorithm] === 'ECDSA-P256-SHA256') {
		var curve = 'nistp384';
		var size = 384;
		if (supportedAlgosById[algorithm].match(/^ECDSA-P256-SHA256/)) {
			curve = 'nistp256';
			size = 256;
		}

		var ecdsaKey = {
			type: 'ecdsa',
			curve: curve,
			size: size,
			parts: [
				{name: 'curve', data: Buffer.from(curve) },
				{name: 'Q', data: utils.ecNormalize(keyBuffer) }
			]
		};
		return (new Key(ecdsaKey));
	}
	throw (new Error('Unsupported algorithm: ' +
	    supportedAlgosById[algorithm]));
}

function elementToBuf(e) {
	return (Buffer.from(e.split(' ')[1], 'base64'));
}

function readDNSSECRSAPrivateKey(elements) {
	var rsaParams = {};
	elements.forEach(function (element) {
		if (element.split(' ')[0] === 'Modulus:')
			rsaParams['n'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'PublicExponent:')
			rsaParams['e'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'PrivateExponent:')
			rsaParams['d'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'Prime1:')
			rsaParams['p'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'Prime2:')
			rsaParams['q'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'Exponent1:')
			rsaParams['dmodp'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'Exponent2:')
			rsaParams['dmodq'] = elementToBuf(element);
		else if (element.split(' ')[0] === 'Coefficient:')
			rsaParams['iqmp'] = elementToBuf(element);
	});
	// now, make the key
	var key = {
		type: 'rsa',
		parts: [
			{ name: 'e', data: utils.mpNormalize(rsaParams['e'])},
			{ name: 'n', data: utils.mpNormalize(rsaParams['n'])},
			{ name: 'd', data: utils.mpNormalize(rsaParams['d'])},
			{ name: 'p', data: utils.mpNormalize(rsaParams['p'])},
			{ name: 'q', data: utils.mpNormalize(rsaParams['q'])},
			{ name: 'dmodp',
			    data: utils.mpNormalize(rsaParams['dmodp'])},
			{ name: 'dmodq',
			    data: utils.mpNormalize(rsaParams['dmodq'])},
			{ name: 'iqmp',
			    data: utils.mpNormalize(rsaParams['iqmp'])}
		]
	};
	return (new PrivateKey(key));
}

function readDNSSECPrivateKey(alg, elements) {
	if (supportedAlgosById[alg].match(/^RSA-/)) {
		return (readDNSSECRSAPrivateKey(elements));
	}
	if (supportedAlgosById[alg] === 'ECDSA-P384-SHA384' ||
	    supportedAlgosById[alg] === 'ECDSA-P256-SHA256') {
		var d = Buffer.from(elements[0].split(' ')[1], 'base64');
		var curve = 'nistp384';
		var size = 384;
		if (supportedAlgosById[alg] === 'ECDSA-P256-SHA256') {
			curve = 'nistp256';
			size = 256;
		}
		// DNSSEC generates the public-key on the fly (go calculate it)
		var publicKey = utils.publicFromPrivateECDSA(curve, d);
		var Q = publicKey.part['Q'].data;
		var ecdsaKey = {
			type: 'ecdsa',
			curve: curve,
			size: size,
			parts: [
				{name: 'curve', data: Buffer.from(curve) },
				{name: 'd', data: d },
				{name: 'Q', data: Q }
			]
		};
		return (new PrivateKey(ecdsaKey));
	}
	throw (new Error('Unsupported algorithm: ' + supportedAlgosById[alg]));
}

function dnssecTimestamp(date) {
	var year = date.getFullYear() + ''; //stringify
	var month = (date.getMonth() + 1);
	var timestampStr = year + month + date.getUTCDate();
	timestampStr += '' + date.getUTCHours() + date.getUTCMinutes();
	timestampStr += date.getUTCSeconds();
	return (timestampStr);
}

function rsaAlgFromOptions(opts) {
	if (!opts || !opts.hashAlgo || opts.hashAlgo === 'sha1')
		return ('5 (RSASHA1)');
	else if (opts.hashAlgo === 'sha256')
		return ('8 (RSASHA256)');
	else if (opts.hashAlgo === 'sha512')
		return ('10 (RSASHA512)');
	else
		throw (new Error('Unknown or unsupported hash: ' +
		    opts.hashAlgo));
}

function writeRSA(key, options) {
	// if we're missing parts, add them.
	if (!key.part.dmodp || !key.part.dmodq) {
		utils.addRSAMissing(key);
	}

	var out = '';
	out += 'Private-key-format: v1.3\n';
	out += 'Algorithm: ' + rsaAlgFromOptions(options) + '\n';
	var n = utils.mpDenormalize(key.part['n'].data);
	out += 'Modulus: ' + n.toString('base64') + '\n';
	var e = utils.mpDenormalize(key.part['e'].data);
	out += 'PublicExponent: ' + e.toString('base64') + '\n';
	var d = utils.mpDenormalize(key.part['d'].data);
	out += 'PrivateExponent: ' + d.toString('base64') + '\n';
	var p = utils.mpDenormalize(key.part['p'].data);
	out += 'Prime1: ' + p.toString('base64') + '\n';
	var q = utils.mpDenormalize(key.part['q'].data);
	out += 'Prime2: ' + q.toString('base64') + '\n';
	var dmodp = utils.mpDenormalize(key.part['dmodp'].data);
	out += 'Exponent1: ' + dmodp.toString('base64') + '\n';
	var dmodq = utils.mpDenormalize(key.part['dmodq'].data);
	out += 'Exponent2: ' + dmodq.toString('base64') + '\n';
	var iqmp = utils.mpDenormalize(key.part['iqmp'].data);
	out += 'Coefficient: ' + iqmp.toString('base64') + '\n';
	// Assume that we're valid as-of now
	var timestamp = new Date();
	out += 'Created: ' + dnssecTimestamp(timestamp) + '\n';
	out += 'Publish: ' + dnssecTimestamp(timestamp) + '\n';
	out += 'Activate: ' + dnssecTimestamp(timestamp) + '\n';
	return (Buffer.from(out, 'ascii'));
}

function writeECDSA(key, options) {
	var out = '';
	out += 'Private-key-format: v1.3\n';

	if (key.curve === 'nistp256') {
		out += 'Algorithm: 13 (ECDSAP256SHA256)\n';
	} else if (key.curve === 'nistp384') {
		out += 'Algorithm: 14 (ECDSAP384SHA384)\n';
	} else {
		throw (new Error('Unsupported curve'));
	}
	var base64Key = key.part['d'].data.toString('base64');
	out += 'PrivateKey: ' + base64Key + '\n';

	// Assume that we're valid as-of now
	var timestamp = new Date();
	out += 'Created: ' + dnssecTimestamp(timestamp) + '\n';
	out += 'Publish: ' + dnssecTimestamp(timestamp) + '\n';
	out += 'Activate: ' + dnssecTimestamp(timestamp) + '\n';

	return (Buffer.from(out, 'ascii'));
}

function write(key, options) {
	if (PrivateKey.isPrivateKey(key)) {
		if (key.type === 'rsa') {
			return (writeRSA(key, options));
		} else if (key.type === 'ecdsa') {
			return (writeECDSA(key, options));
		} else {
			throw (new Error('Unsupported algorithm: ' + key.type));
		}
	} else if (Key.isKey(key)) {
		/*
		 * RFC3110 requires a keyname, and a keytype, which we
		 * don't really have a mechanism for specifying such
		 * additional metadata.
		 */
		throw (new Error('Format "dnssec" only supports ' +
		    'writing private keys'));
	} else {
		throw (new Error('key is not a Key or PrivateKey'));
	}
}

}, function(modId) { var map = {"../key":1572231845935,"../private-key":1572231845939,"../utils":1572231845941,"../ssh-buffer":1572231845942,"../dhe":1572231845943}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845953, function(require, module, exports) {
// Copyright 2018 Joyent, Inc.

module.exports = {
	read: read,
	write: write
};

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var rfc4253 = require('./rfc4253');
var Key = require('../key');

var errors = require('../errors');

function read(buf, options) {
	var lines = buf.toString('ascii').split(/[\r\n]+/);
	var found = false;
	var parts;
	var si = 0;
	while (si < lines.length) {
		parts = splitHeader(lines[si++]);
		if (parts &&
		    parts[0].toLowerCase() === 'putty-user-key-file-2') {
			found = true;
			break;
		}
	}
	if (!found) {
		throw (new Error('No PuTTY format first line found'));
	}
	var alg = parts[1];

	parts = splitHeader(lines[si++]);
	assert.equal(parts[0].toLowerCase(), 'encryption');

	parts = splitHeader(lines[si++]);
	assert.equal(parts[0].toLowerCase(), 'comment');
	var comment = parts[1];

	parts = splitHeader(lines[si++]);
	assert.equal(parts[0].toLowerCase(), 'public-lines');
	var publicLines = parseInt(parts[1], 10);
	if (!isFinite(publicLines) || publicLines < 0 ||
	    publicLines > lines.length) {
		throw (new Error('Invalid public-lines count'));
	}

	var publicBuf = Buffer.from(
	    lines.slice(si, si + publicLines).join(''), 'base64');
	var keyType = rfc4253.algToKeyType(alg);
	var key = rfc4253.read(publicBuf);
	if (key.type !== keyType) {
		throw (new Error('Outer key algorithm mismatch'));
	}
	key.comment = comment;
	return (key);
}

function splitHeader(line) {
	var idx = line.indexOf(':');
	if (idx === -1)
		return (null);
	var header = line.slice(0, idx);
	++idx;
	while (line[idx] === ' ')
		++idx;
	var rest = line.slice(idx);
	return ([header, rest]);
}

function write(key, options) {
	assert.object(key);
	if (!Key.isKey(key))
		throw (new Error('Must be a public key'));

	var alg = rfc4253.keyTypeToAlg(key);
	var buf = rfc4253.write(key);
	var comment = key.comment || '';

	var b64 = buf.toString('base64');
	var lines = wrap(b64, 64);

	lines.unshift('Public-Lines: ' + lines.length);
	lines.unshift('Comment: ' + comment);
	lines.unshift('Encryption: none');
	lines.unshift('PuTTY-User-Key-File-2: ' + alg);

	return (Buffer.from(lines.join('\n') + '\n'));
}

function wrap(txt, len) {
	var lines = [];
	var pos = 0;
	while (pos < txt.length) {
		lines.push(txt.slice(pos, pos + 64));
		pos += 64;
	}
	return (lines);
}

}, function(modId) { var map = {"./rfc4253":1572231845950,"../key":1572231845935,"../errors":1572231845938}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845954, function(require, module, exports) {
// Copyright 2016 Joyent, Inc.

module.exports = Certificate;

var assert = require('assert-plus');
var Buffer = require('safer-buffer').Buffer;
var algs = require('./algs');
var crypto = require('crypto');
var Fingerprint = require('./fingerprint');
var Signature = require('./signature');
var errs = require('./errors');
var util = require('util');
var utils = require('./utils');
var Key = require('./key');
var PrivateKey = require('./private-key');
var Identity = require('./identity');

var formats = {};
formats['openssh'] = require('./formats/openssh-cert');
formats['x509'] = require('./formats/x509');
formats['pem'] = require('./formats/x509-pem');

var CertificateParseError = errs.CertificateParseError;
var InvalidAlgorithmError = errs.InvalidAlgorithmError;

function Certificate(opts) {
	assert.object(opts, 'options');
	assert.arrayOfObject(opts.subjects, 'options.subjects');
	utils.assertCompatible(opts.subjects[0], Identity, [1, 0],
	    'options.subjects');
	utils.assertCompatible(opts.subjectKey, Key, [1, 0],
	    'options.subjectKey');
	utils.assertCompatible(opts.issuer, Identity, [1, 0], 'options.issuer');
	if (opts.issuerKey !== undefined) {
		utils.assertCompatible(opts.issuerKey, Key, [1, 0],
		    'options.issuerKey');
	}
	assert.object(opts.signatures, 'options.signatures');
	assert.buffer(opts.serial, 'options.serial');
	assert.date(opts.validFrom, 'options.validFrom');
	assert.date(opts.validUntil, 'optons.validUntil');

	assert.optionalArrayOfString(opts.purposes, 'options.purposes');

	this._hashCache = {};

	this.subjects = opts.subjects;
	this.issuer = opts.issuer;
	this.subjectKey = opts.subjectKey;
	this.issuerKey = opts.issuerKey;
	this.signatures = opts.signatures;
	this.serial = opts.serial;
	this.validFrom = opts.validFrom;
	this.validUntil = opts.validUntil;
	this.purposes = opts.purposes;
}

Certificate.formats = formats;

Certificate.prototype.toBuffer = function (format, options) {
	if (format === undefined)
		format = 'x509';
	assert.string(format, 'format');
	assert.object(formats[format], 'formats[format]');
	assert.optionalObject(options, 'options');

	return (formats[format].write(this, options));
};

Certificate.prototype.toString = function (format, options) {
	if (format === undefined)
		format = 'pem';
	return (this.toBuffer(format, options).toString());
};

Certificate.prototype.fingerprint = function (algo) {
	if (algo === undefined)
		algo = 'sha256';
	assert.string(algo, 'algorithm');
	var opts = {
		type: 'certificate',
		hash: this.hash(algo),
		algorithm: algo
	};
	return (new Fingerprint(opts));
};

Certificate.prototype.hash = function (algo) {
	assert.string(algo, 'algorithm');
	algo = algo.toLowerCase();
	if (algs.hashAlgs[algo] === undefined)
		throw (new InvalidAlgorithmError(algo));

	if (this._hashCache[algo])
		return (this._hashCache[algo]);

	var hash = crypto.createHash(algo).
	    update(this.toBuffer('x509')).digest();
	this._hashCache[algo] = hash;
	return (hash);
};

Certificate.prototype.isExpired = function (when) {
	if (when === undefined)
		when = new Date();
	return (!((when.getTime() >= this.validFrom.getTime()) &&
		(when.getTime() < this.validUntil.getTime())));
};

Certificate.prototype.isSignedBy = function (issuerCert) {
	utils.assertCompatible(issuerCert, Certificate, [1, 0], 'issuer');

	if (!this.issuer.equals(issuerCert.subjects[0]))
		return (false);
	if (this.issuer.purposes && this.issuer.purposes.length > 0 &&
	    this.issuer.purposes.indexOf('ca') === -1) {
		return (false);
	}

	return (this.isSignedByKey(issuerCert.subjectKey));
};

Certificate.prototype.getExtension = function (keyOrOid) {
	assert.string(keyOrOid, 'keyOrOid');
	var ext = this.getExtensions().filter(function (maybeExt) {
		if (maybeExt.format === 'x509')
			return (maybeExt.oid === keyOrOid);
		if (maybeExt.format === 'openssh')
			return (maybeExt.name === keyOrOid);
		return (false);
	})[0];
	return (ext);
};

Certificate.prototype.getExtensions = function () {
	var exts = [];
	var x509 = this.signatures.x509;
	if (x509 && x509.extras && x509.extras.exts) {
		x509.extras.exts.forEach(function (ext) {
			ext.format = 'x509';
			exts.push(ext);
		});
	}
	var openssh = this.signatures.openssh;
	if (openssh && openssh.exts) {
		openssh.exts.forEach(function (ext) {
			ext.format = 'openssh';
			exts.push(ext);
		});
	}
	return (exts);
};

Certificate.prototype.isSignedByKey = function (issuerKey) {
	utils.assertCompatible(issuerKey, Key, [1, 2], 'issuerKey');

	if (this.issuerKey !== undefined) {
		return (this.issuerKey.
		    fingerprint('sha512').matches(issuerKey));
	}

	var fmt = Object.keys(this.signatures)[0];
	var valid = formats[fmt].verify(this, issuerKey);
	if (valid)
		this.issuerKey = issuerKey;
	return (valid);
};

Certificate.prototype.signWith = function (key) {
	utils.assertCompatible(key, PrivateKey, [1, 2], 'key');
	var fmts = Object.keys(formats);
	var didOne = false;
	for (var i = 0; i < fmts.length; ++i) {
		if (fmts[i] !== 'pem') {
			var ret = formats[fmts[i]].sign(this, key);
			if (ret === true)
				didOne = true;
		}
	}
	if (!didOne) {
		throw (new Error('Failed to sign the certificate for any ' +
		    'available certificate formats'));
	}
};

Certificate.createSelfSigned = function (subjectOrSubjects, key, options) {
	var subjects;
	if (Array.isArray(subjectOrSubjects))
		subjects = subjectOrSubjects;
	else
		subjects = [subjectOrSubjects];

	assert.arrayOfObject(subjects);
	subjects.forEach(function (subject) {
		utils.assertCompatible(subject, Identity, [1, 0], 'subject');
	});

	utils.assertCompatible(key, PrivateKey, [1, 2], 'private key');

	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	assert.optionalObject(options.validFrom, 'options.validFrom');
	assert.optionalObject(options.validUntil, 'options.validUntil');
	var validFrom = options.validFrom;
	var validUntil = options.validUntil;
	if (validFrom === undefined)
		validFrom = new Date();
	if (validUntil === undefined) {
		assert.optionalNumber(options.lifetime, 'options.lifetime');
		var lifetime = options.lifetime;
		if (lifetime === undefined)
			lifetime = 10*365*24*3600;
		validUntil = new Date();
		validUntil.setTime(validUntil.getTime() + lifetime*1000);
	}
	assert.optionalBuffer(options.serial, 'options.serial');
	var serial = options.serial;
	if (serial === undefined)
		serial = Buffer.from('0000000000000001', 'hex');

	var purposes = options.purposes;
	if (purposes === undefined)
		purposes = [];

	if (purposes.indexOf('signature') === -1)
		purposes.push('signature');

	/* Self-signed certs are always CAs. */
	if (purposes.indexOf('ca') === -1)
		purposes.push('ca');
	if (purposes.indexOf('crl') === -1)
		purposes.push('crl');

	/*
	 * If we weren't explicitly given any other purposes, do the sensible
	 * thing and add some basic ones depending on the subject type.
	 */
	if (purposes.length <= 3) {
		var hostSubjects = subjects.filter(function (subject) {
			return (subject.type === 'host');
		});
		var userSubjects = subjects.filter(function (subject) {
			return (subject.type === 'user');
		});
		if (hostSubjects.length > 0) {
			if (purposes.indexOf('serverAuth') === -1)
				purposes.push('serverAuth');
		}
		if (userSubjects.length > 0) {
			if (purposes.indexOf('clientAuth') === -1)
				purposes.push('clientAuth');
		}
		if (userSubjects.length > 0 || hostSubjects.length > 0) {
			if (purposes.indexOf('keyAgreement') === -1)
				purposes.push('keyAgreement');
			if (key.type === 'rsa' &&
			    purposes.indexOf('encryption') === -1)
				purposes.push('encryption');
		}
	}

	var cert = new Certificate({
		subjects: subjects,
		issuer: subjects[0],
		subjectKey: key.toPublic(),
		issuerKey: key.toPublic(),
		signatures: {},
		serial: serial,
		validFrom: validFrom,
		validUntil: validUntil,
		purposes: purposes
	});
	cert.signWith(key);

	return (cert);
};

Certificate.create =
    function (subjectOrSubjects, key, issuer, issuerKey, options) {
	var subjects;
	if (Array.isArray(subjectOrSubjects))
		subjects = subjectOrSubjects;
	else
		subjects = [subjectOrSubjects];

	assert.arrayOfObject(subjects);
	subjects.forEach(function (subject) {
		utils.assertCompatible(subject, Identity, [1, 0], 'subject');
	});

	utils.assertCompatible(key, Key, [1, 0], 'key');
	if (PrivateKey.isPrivateKey(key))
		key = key.toPublic();
	utils.assertCompatible(issuer, Identity, [1, 0], 'issuer');
	utils.assertCompatible(issuerKey, PrivateKey, [1, 2], 'issuer key');

	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	assert.optionalObject(options.validFrom, 'options.validFrom');
	assert.optionalObject(options.validUntil, 'options.validUntil');
	var validFrom = options.validFrom;
	var validUntil = options.validUntil;
	if (validFrom === undefined)
		validFrom = new Date();
	if (validUntil === undefined) {
		assert.optionalNumber(options.lifetime, 'options.lifetime');
		var lifetime = options.lifetime;
		if (lifetime === undefined)
			lifetime = 10*365*24*3600;
		validUntil = new Date();
		validUntil.setTime(validUntil.getTime() + lifetime*1000);
	}
	assert.optionalBuffer(options.serial, 'options.serial');
	var serial = options.serial;
	if (serial === undefined)
		serial = Buffer.from('0000000000000001', 'hex');

	var purposes = options.purposes;
	if (purposes === undefined)
		purposes = [];

	if (purposes.indexOf('signature') === -1)
		purposes.push('signature');

	if (options.ca === true) {
		if (purposes.indexOf('ca') === -1)
			purposes.push('ca');
		if (purposes.indexOf('crl') === -1)
			purposes.push('crl');
	}

	var hostSubjects = subjects.filter(function (subject) {
		return (subject.type === 'host');
	});
	var userSubjects = subjects.filter(function (subject) {
		return (subject.type === 'user');
	});
	if (hostSubjects.length > 0) {
		if (purposes.indexOf('serverAuth') === -1)
			purposes.push('serverAuth');
	}
	if (userSubjects.length > 0) {
		if (purposes.indexOf('clientAuth') === -1)
			purposes.push('clientAuth');
	}
	if (userSubjects.length > 0 || hostSubjects.length > 0) {
		if (purposes.indexOf('keyAgreement') === -1)
			purposes.push('keyAgreement');
		if (key.type === 'rsa' &&
		    purposes.indexOf('encryption') === -1)
			purposes.push('encryption');
	}

	var cert = new Certificate({
		subjects: subjects,
		issuer: issuer,
		subjectKey: key,
		issuerKey: issuerKey.toPublic(),
		signatures: {},
		serial: serial,
		validFrom: validFrom,
		validUntil: validUntil,
		purposes: purposes
	});
	cert.signWith(issuerKey);

	return (cert);
};

Certificate.parse = function (data, format, options) {
	if (typeof (data) !== 'string')
		assert.buffer(data, 'data');
	if (format === undefined)
		format = 'auto';
	assert.string(format, 'format');
	if (typeof (options) === 'string')
		options = { filename: options };
	assert.optionalObject(options, 'options');
	if (options === undefined)
		options = {};
	assert.optionalString(options.filename, 'options.filename');
	if (options.filename === undefined)
		options.filename = '(unnamed)';

	assert.object(formats[format], 'formats[format]');

	try {
		var k = formats[format].read(data, options);
		return (k);
	} catch (e) {
		throw (new CertificateParseError(options.filename, format, e));
	}
};

Certificate.isCertificate = function (obj, ver) {
	return (utils.isCompatible(obj, Certificate, ver));
};

/*
 * API versions for Certificate:
 * [1,0] -- initial ver
 * [1,1] -- openssh format now unpacks extensions
 */
Certificate.prototype._sshpkApiVersion = [1, 1];

Certificate._oldVersionDetect = function (obj) {
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./fingerprint":1572231845937,"./signature":1572231845940,"./errors":1572231845938,"./utils":1572231845941,"./key":1572231845935,"./private-key":1572231845939,"./identity":1572231845955,"./formats/openssh-cert":1572231845956,"./formats/x509":1572231845957,"./formats/x509-pem":1572231845958}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845955, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = Identity;

var assert = require('assert-plus');
var algs = require('./algs');
var crypto = require('crypto');
var Fingerprint = require('./fingerprint');
var Signature = require('./signature');
var errs = require('./errors');
var util = require('util');
var utils = require('./utils');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;

/*JSSTYLED*/
var DNS_NAME_RE = /^([*]|[a-z0-9][a-z0-9\-]{0,62})(?:\.([*]|[a-z0-9][a-z0-9\-]{0,62}))*$/i;

var oids = {};
oids.cn = '2.5.4.3';
oids.o = '2.5.4.10';
oids.ou = '2.5.4.11';
oids.l = '2.5.4.7';
oids.s = '2.5.4.8';
oids.c = '2.5.4.6';
oids.sn = '2.5.4.4';
oids.postalCode = '2.5.4.17';
oids.serialNumber = '2.5.4.5';
oids.street = '2.5.4.9';
oids.x500UniqueIdentifier = '2.5.4.45';
oids.role = '2.5.4.72';
oids.telephoneNumber = '2.5.4.20';
oids.description = '2.5.4.13';
oids.dc = '0.9.2342.19200300.100.1.25';
oids.uid = '0.9.2342.19200300.100.1.1';
oids.mail = '0.9.2342.19200300.100.1.3';
oids.title = '2.5.4.12';
oids.gn = '2.5.4.42';
oids.initials = '2.5.4.43';
oids.pseudonym = '2.5.4.65';
oids.emailAddress = '1.2.840.113549.1.9.1';

var unoids = {};
Object.keys(oids).forEach(function (k) {
	unoids[oids[k]] = k;
});

function Identity(opts) {
	var self = this;
	assert.object(opts, 'options');
	assert.arrayOfObject(opts.components, 'options.components');
	this.components = opts.components;
	this.componentLookup = {};
	this.components.forEach(function (c) {
		if (c.name && !c.oid)
			c.oid = oids[c.name];
		if (c.oid && !c.name)
			c.name = unoids[c.oid];
		if (self.componentLookup[c.name] === undefined)
			self.componentLookup[c.name] = [];
		self.componentLookup[c.name].push(c);
	});
	if (this.componentLookup.cn && this.componentLookup.cn.length > 0) {
		this.cn = this.componentLookup.cn[0].value;
	}
	assert.optionalString(opts.type, 'options.type');
	if (opts.type === undefined) {
		if (this.components.length === 1 &&
		    this.componentLookup.cn &&
		    this.componentLookup.cn.length === 1 &&
		    this.componentLookup.cn[0].value.match(DNS_NAME_RE)) {
			this.type = 'host';
			this.hostname = this.componentLookup.cn[0].value;

		} else if (this.componentLookup.dc &&
		    this.components.length === this.componentLookup.dc.length) {
			this.type = 'host';
			this.hostname = this.componentLookup.dc.map(
			    function (c) {
				return (c.value);
			}).join('.');

		} else if (this.componentLookup.uid &&
		    this.components.length ===
		    this.componentLookup.uid.length) {
			this.type = 'user';
			this.uid = this.componentLookup.uid[0].value;

		} else if (this.componentLookup.cn &&
		    this.componentLookup.cn.length === 1 &&
		    this.componentLookup.cn[0].value.match(DNS_NAME_RE)) {
			this.type = 'host';
			this.hostname = this.componentLookup.cn[0].value;

		} else if (this.componentLookup.uid &&
		    this.componentLookup.uid.length === 1) {
			this.type = 'user';
			this.uid = this.componentLookup.uid[0].value;

		} else if (this.componentLookup.mail &&
		    this.componentLookup.mail.length === 1) {
			this.type = 'email';
			this.email = this.componentLookup.mail[0].value;

		} else if (this.componentLookup.cn &&
		    this.componentLookup.cn.length === 1) {
			this.type = 'user';
			this.uid = this.componentLookup.cn[0].value;

		} else {
			this.type = 'unknown';
		}
	} else {
		this.type = opts.type;
		if (this.type === 'host')
			this.hostname = opts.hostname;
		else if (this.type === 'user')
			this.uid = opts.uid;
		else if (this.type === 'email')
			this.email = opts.email;
		else
			throw (new Error('Unknown type ' + this.type));
	}
}

Identity.prototype.toString = function () {
	return (this.components.map(function (c) {
		var n = c.name.toUpperCase();
		/*JSSTYLED*/
		n = n.replace(/=/g, '\\=');
		var v = c.value;
		/*JSSTYLED*/
		v = v.replace(/,/g, '\\,');
		return (n + '=' + v);
	}).join(', '));
};

Identity.prototype.get = function (name, asArray) {
	assert.string(name, 'name');
	var arr = this.componentLookup[name];
	if (arr === undefined || arr.length === 0)
		return (undefined);
	if (!asArray && arr.length > 1)
		throw (new Error('Multiple values for attribute ' + name));
	if (!asArray)
		return (arr[0].value);
	return (arr.map(function (c) {
		return (c.value);
	}));
};

Identity.prototype.toArray = function (idx) {
	return (this.components.map(function (c) {
		return ({
			name: c.name,
			value: c.value
		});
	}));
};

/*
 * These are from X.680 -- PrintableString allowed chars are in section 37.4
 * table 8. Spec for IA5Strings is "1,6 + SPACE + DEL" where 1 refers to
 * ISO IR #001 (standard ASCII control characters) and 6 refers to ISO IR #006
 * (the basic ASCII character set).
 */
/* JSSTYLED */
var NOT_PRINTABLE = /[^a-zA-Z0-9 '(),+.\/:=?-]/;
/* JSSTYLED */
var NOT_IA5 = /[^\x00-\x7f]/;

Identity.prototype.toAsn1 = function (der, tag) {
	der.startSequence(tag);
	this.components.forEach(function (c) {
		der.startSequence(asn1.Ber.Constructor | asn1.Ber.Set);
		der.startSequence();
		der.writeOID(c.oid);
		/*
		 * If we fit in a PrintableString, use that. Otherwise use an
		 * IA5String or UTF8String.
		 *
		 * If this identity was parsed from a DN, use the ASN.1 types
		 * from the original representation (otherwise this might not
		 * be a full match for the original in some validators).
		 */
		if (c.asn1type === asn1.Ber.Utf8String ||
		    c.value.match(NOT_IA5)) {
			var v = Buffer.from(c.value, 'utf8');
			der.writeBuffer(v, asn1.Ber.Utf8String);

		} else if (c.asn1type === asn1.Ber.IA5String ||
		    c.value.match(NOT_PRINTABLE)) {
			der.writeString(c.value, asn1.Ber.IA5String);

		} else {
			var type = asn1.Ber.PrintableString;
			if (c.asn1type !== undefined)
				type = c.asn1type;
			der.writeString(c.value, type);
		}
		der.endSequence();
		der.endSequence();
	});
	der.endSequence();
};

function globMatch(a, b) {
	if (a === '**' || b === '**')
		return (true);
	var aParts = a.split('.');
	var bParts = b.split('.');
	if (aParts.length !== bParts.length)
		return (false);
	for (var i = 0; i < aParts.length; ++i) {
		if (aParts[i] === '*' || bParts[i] === '*')
			continue;
		if (aParts[i] !== bParts[i])
			return (false);
	}
	return (true);
}

Identity.prototype.equals = function (other) {
	if (!Identity.isIdentity(other, [1, 0]))
		return (false);
	if (other.components.length !== this.components.length)
		return (false);
	for (var i = 0; i < this.components.length; ++i) {
		if (this.components[i].oid !== other.components[i].oid)
			return (false);
		if (!globMatch(this.components[i].value,
		    other.components[i].value)) {
			return (false);
		}
	}
	return (true);
};

Identity.forHost = function (hostname) {
	assert.string(hostname, 'hostname');
	return (new Identity({
		type: 'host',
		hostname: hostname,
		components: [ { name: 'cn', value: hostname } ]
	}));
};

Identity.forUser = function (uid) {
	assert.string(uid, 'uid');
	return (new Identity({
		type: 'user',
		uid: uid,
		components: [ { name: 'uid', value: uid } ]
	}));
};

Identity.forEmail = function (email) {
	assert.string(email, 'email');
	return (new Identity({
		type: 'email',
		email: email,
		components: [ { name: 'mail', value: email } ]
	}));
};

Identity.parseDN = function (dn) {
	assert.string(dn, 'dn');
	var parts = [''];
	var idx = 0;
	var rem = dn;
	while (rem.length > 0) {
		var m;
		/*JSSTYLED*/
		if ((m = /^,/.exec(rem)) !== null) {
			parts[++idx] = '';
			rem = rem.slice(m[0].length);
		/*JSSTYLED*/
		} else if ((m = /^\\,/.exec(rem)) !== null) {
			parts[idx] += ',';
			rem = rem.slice(m[0].length);
		/*JSSTYLED*/
		} else if ((m = /^\\./.exec(rem)) !== null) {
			parts[idx] += m[0];
			rem = rem.slice(m[0].length);
		/*JSSTYLED*/
		} else if ((m = /^[^\\,]+/.exec(rem)) !== null) {
			parts[idx] += m[0];
			rem = rem.slice(m[0].length);
		} else {
			throw (new Error('Failed to parse DN'));
		}
	}
	var cmps = parts.map(function (c) {
		c = c.trim();
		var eqPos = c.indexOf('=');
		while (eqPos > 0 && c.charAt(eqPos - 1) === '\\')
			eqPos = c.indexOf('=', eqPos + 1);
		if (eqPos === -1) {
			throw (new Error('Failed to parse DN'));
		}
		/*JSSTYLED*/
		var name = c.slice(0, eqPos).toLowerCase().replace(/\\=/g, '=');
		var value = c.slice(eqPos + 1);
		return ({ name: name, value: value });
	});
	return (new Identity({ components: cmps }));
};

Identity.fromArray = function (components) {
	assert.arrayOfObject(components, 'components');
	components.forEach(function (cmp) {
		assert.object(cmp, 'component');
		assert.string(cmp.name, 'component.name');
		if (!Buffer.isBuffer(cmp.value) &&
		    !(typeof (cmp.value) === 'string')) {
			throw (new Error('Invalid component value'));
		}
	});
	return (new Identity({ components: components }));
};

Identity.parseAsn1 = function (der, top) {
	var components = [];
	der.readSequence(top);
	var end = der.offset + der.length;
	while (der.offset < end) {
		der.readSequence(asn1.Ber.Constructor | asn1.Ber.Set);
		var after = der.offset + der.length;
		der.readSequence();
		var oid = der.readOID();
		var type = der.peek();
		var value;
		switch (type) {
		case asn1.Ber.PrintableString:
		case asn1.Ber.IA5String:
		case asn1.Ber.OctetString:
		case asn1.Ber.T61String:
			value = der.readString(type);
			break;
		case asn1.Ber.Utf8String:
			value = der.readString(type, true);
			value = value.toString('utf8');
			break;
		case asn1.Ber.CharacterString:
		case asn1.Ber.BMPString:
			value = der.readString(type, true);
			value = value.toString('utf16le');
			break;
		default:
			throw (new Error('Unknown asn1 type ' + type));
		}
		components.push({ oid: oid, asn1type: type, value: value });
		der._offset = after;
	}
	der._offset = end;
	return (new Identity({
		components: components
	}));
};

Identity.isIdentity = function (obj, ver) {
	return (utils.isCompatible(obj, Identity, ver));
};

/*
 * API versions for Identity:
 * [1,0] -- initial ver
 */
Identity.prototype._sshpkApiVersion = [1, 0];

Identity._oldVersionDetect = function (obj) {
	return ([1, 0]);
};

}, function(modId) { var map = {"./algs":1572231845936,"./fingerprint":1572231845937,"./signature":1572231845940,"./errors":1572231845938,"./utils":1572231845941}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845956, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = {
	read: read,
	verify: verify,
	sign: sign,
	signAsync: signAsync,
	write: write,

	/* Internal private API */
	fromBuffer: fromBuffer,
	toBuffer: toBuffer
};

var assert = require('assert-plus');
var SSHBuffer = require('../ssh-buffer');
var crypto = require('crypto');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var Key = require('../key');
var PrivateKey = require('../private-key');
var Identity = require('../identity');
var rfc4253 = require('./rfc4253');
var Signature = require('../signature');
var utils = require('../utils');
var Certificate = require('../certificate');

function verify(cert, key) {
	/*
	 * We always give an issuerKey, so if our verify() is being called then
	 * there was no signature. Return false.
	 */
	return (false);
}

var TYPES = {
	'user': 1,
	'host': 2
};
Object.keys(TYPES).forEach(function (k) { TYPES[TYPES[k]] = k; });

var ECDSA_ALGO = /^ecdsa-sha2-([^@-]+)-cert-v01@openssh.com$/;

function read(buf, options) {
	if (Buffer.isBuffer(buf))
		buf = buf.toString('ascii');
	var parts = buf.trim().split(/[ \t\n]+/g);
	if (parts.length < 2 || parts.length > 3)
		throw (new Error('Not a valid SSH certificate line'));

	var algo = parts[0];
	var data = parts[1];

	data = Buffer.from(data, 'base64');
	return (fromBuffer(data, algo));
}

function fromBuffer(data, algo, partial) {
	var sshbuf = new SSHBuffer({ buffer: data });
	var innerAlgo = sshbuf.readString();
	if (algo !== undefined && innerAlgo !== algo)
		throw (new Error('SSH certificate algorithm mismatch'));
	if (algo === undefined)
		algo = innerAlgo;

	var cert = {};
	cert.signatures = {};
	cert.signatures.openssh = {};

	cert.signatures.openssh.nonce = sshbuf.readBuffer();

	var key = {};
	var parts = (key.parts = []);
	key.type = getAlg(algo);

	var partCount = algs.info[key.type].parts.length;
	while (parts.length < partCount)
		parts.push(sshbuf.readPart());
	assert.ok(parts.length >= 1, 'key must have at least one part');

	var algInfo = algs.info[key.type];
	if (key.type === 'ecdsa') {
		var res = ECDSA_ALGO.exec(algo);
		assert.ok(res !== null);
		assert.strictEqual(res[1], parts[0].data.toString());
	}

	for (var i = 0; i < algInfo.parts.length; ++i) {
		parts[i].name = algInfo.parts[i];
		if (parts[i].name !== 'curve' &&
		    algInfo.normalize !== false) {
			var p = parts[i];
			p.data = utils.mpNormalize(p.data);
		}
	}

	cert.subjectKey = new Key(key);

	cert.serial = sshbuf.readInt64();

	var type = TYPES[sshbuf.readInt()];
	assert.string(type, 'valid cert type');

	cert.signatures.openssh.keyId = sshbuf.readString();

	var principals = [];
	var pbuf = sshbuf.readBuffer();
	var psshbuf = new SSHBuffer({ buffer: pbuf });
	while (!psshbuf.atEnd())
		principals.push(psshbuf.readString());
	if (principals.length === 0)
		principals = ['*'];

	cert.subjects = principals.map(function (pr) {
		if (type === 'user')
			return (Identity.forUser(pr));
		else if (type === 'host')
			return (Identity.forHost(pr));
		throw (new Error('Unknown identity type ' + type));
	});

	cert.validFrom = int64ToDate(sshbuf.readInt64());
	cert.validUntil = int64ToDate(sshbuf.readInt64());

	var exts = [];
	var extbuf = new SSHBuffer({ buffer: sshbuf.readBuffer() });
	var ext;
	while (!extbuf.atEnd()) {
		ext = { critical: true };
		ext.name = extbuf.readString();
		ext.data = extbuf.readBuffer();
		exts.push(ext);
	}
	extbuf = new SSHBuffer({ buffer: sshbuf.readBuffer() });
	while (!extbuf.atEnd()) {
		ext = { critical: false };
		ext.name = extbuf.readString();
		ext.data = extbuf.readBuffer();
		exts.push(ext);
	}
	cert.signatures.openssh.exts = exts;

	/* reserved */
	sshbuf.readBuffer();

	var signingKeyBuf = sshbuf.readBuffer();
	cert.issuerKey = rfc4253.read(signingKeyBuf);

	/*
	 * OpenSSH certs don't give the identity of the issuer, just their
	 * public key. So, we use an Identity that matches anything. The
	 * isSignedBy() function will later tell you if the key matches.
	 */
	cert.issuer = Identity.forHost('**');

	var sigBuf = sshbuf.readBuffer();
	cert.signatures.openssh.signature =
	    Signature.parse(sigBuf, cert.issuerKey.type, 'ssh');

	if (partial !== undefined) {
		partial.remainder = sshbuf.remainder();
		partial.consumed = sshbuf._offset;
	}

	return (new Certificate(cert));
}

function int64ToDate(buf) {
	var i = buf.readUInt32BE(0) * 4294967296;
	i += buf.readUInt32BE(4);
	var d = new Date();
	d.setTime(i * 1000);
	d.sourceInt64 = buf;
	return (d);
}

function dateToInt64(date) {
	if (date.sourceInt64 !== undefined)
		return (date.sourceInt64);
	var i = Math.round(date.getTime() / 1000);
	var upper = Math.floor(i / 4294967296);
	var lower = Math.floor(i % 4294967296);
	var buf = Buffer.alloc(8);
	buf.writeUInt32BE(upper, 0);
	buf.writeUInt32BE(lower, 4);
	return (buf);
}

function sign(cert, key) {
	if (cert.signatures.openssh === undefined)
		cert.signatures.openssh = {};
	try {
		var blob = toBuffer(cert, true);
	} catch (e) {
		delete (cert.signatures.openssh);
		return (false);
	}
	var sig = cert.signatures.openssh;
	var hashAlgo = undefined;
	if (key.type === 'rsa' || key.type === 'dsa')
		hashAlgo = 'sha1';
	var signer = key.createSign(hashAlgo);
	signer.write(blob);
	sig.signature = signer.sign();
	return (true);
}

function signAsync(cert, signer, done) {
	if (cert.signatures.openssh === undefined)
		cert.signatures.openssh = {};
	try {
		var blob = toBuffer(cert, true);
	} catch (e) {
		delete (cert.signatures.openssh);
		done(e);
		return;
	}
	var sig = cert.signatures.openssh;

	signer(blob, function (err, signature) {
		if (err) {
			done(err);
			return;
		}
		try {
			/*
			 * This will throw if the signature isn't of a
			 * type/algo that can be used for SSH.
			 */
			signature.toBuffer('ssh');
		} catch (e) {
			done(e);
			return;
		}
		sig.signature = signature;
		done();
	});
}

function write(cert, options) {
	if (options === undefined)
		options = {};

	var blob = toBuffer(cert);
	var out = getCertType(cert.subjectKey) + ' ' + blob.toString('base64');
	if (options.comment)
		out = out + ' ' + options.comment;
	return (out);
}


function toBuffer(cert, noSig) {
	assert.object(cert.signatures.openssh, 'signature for openssh format');
	var sig = cert.signatures.openssh;

	if (sig.nonce === undefined)
		sig.nonce = crypto.randomBytes(16);
	var buf = new SSHBuffer({});
	buf.writeString(getCertType(cert.subjectKey));
	buf.writeBuffer(sig.nonce);

	var key = cert.subjectKey;
	var algInfo = algs.info[key.type];
	algInfo.parts.forEach(function (part) {
		buf.writePart(key.part[part]);
	});

	buf.writeInt64(cert.serial);

	var type = cert.subjects[0].type;
	assert.notStrictEqual(type, 'unknown');
	cert.subjects.forEach(function (id) {
		assert.strictEqual(id.type, type);
	});
	type = TYPES[type];
	buf.writeInt(type);

	if (sig.keyId === undefined) {
		sig.keyId = cert.subjects[0].type + '_' +
		    (cert.subjects[0].uid || cert.subjects[0].hostname);
	}
	buf.writeString(sig.keyId);

	var sub = new SSHBuffer({});
	cert.subjects.forEach(function (id) {
		if (type === TYPES.host)
			sub.writeString(id.hostname);
		else if (type === TYPES.user)
			sub.writeString(id.uid);
	});
	buf.writeBuffer(sub.toBuffer());

	buf.writeInt64(dateToInt64(cert.validFrom));
	buf.writeInt64(dateToInt64(cert.validUntil));

	var exts = sig.exts;
	if (exts === undefined)
		exts = [];

	var extbuf = new SSHBuffer({});
	exts.forEach(function (ext) {
		if (ext.critical !== true)
			return;
		extbuf.writeString(ext.name);
		extbuf.writeBuffer(ext.data);
	});
	buf.writeBuffer(extbuf.toBuffer());

	extbuf = new SSHBuffer({});
	exts.forEach(function (ext) {
		if (ext.critical === true)
			return;
		extbuf.writeString(ext.name);
		extbuf.writeBuffer(ext.data);
	});
	buf.writeBuffer(extbuf.toBuffer());

	/* reserved */
	buf.writeBuffer(Buffer.alloc(0));

	sub = rfc4253.write(cert.issuerKey);
	buf.writeBuffer(sub);

	if (!noSig)
		buf.writeBuffer(sig.signature.toBuffer('ssh'));

	return (buf.toBuffer());
}

function getAlg(certType) {
	if (certType === 'ssh-rsa-cert-v01@openssh.com')
		return ('rsa');
	if (certType === 'ssh-dss-cert-v01@openssh.com')
		return ('dsa');
	if (certType.match(ECDSA_ALGO))
		return ('ecdsa');
	if (certType === 'ssh-ed25519-cert-v01@openssh.com')
		return ('ed25519');
	throw (new Error('Unsupported cert type ' + certType));
}

function getCertType(key) {
	if (key.type === 'rsa')
		return ('ssh-rsa-cert-v01@openssh.com');
	if (key.type === 'dsa')
		return ('ssh-dss-cert-v01@openssh.com');
	if (key.type === 'ecdsa')
		return ('ecdsa-sha2-' + key.curve + '-cert-v01@openssh.com');
	if (key.type === 'ed25519')
		return ('ssh-ed25519-cert-v01@openssh.com');
	throw (new Error('Unsupported key type ' + key.type));
}

}, function(modId) { var map = {"../ssh-buffer":1572231845942,"../algs":1572231845936,"../key":1572231845935,"../private-key":1572231845939,"../identity":1572231845955,"./rfc4253":1572231845950,"../signature":1572231845940,"../utils":1572231845941,"../certificate":1572231845954}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845957, function(require, module, exports) {
// Copyright 2017 Joyent, Inc.

module.exports = {
	read: read,
	verify: verify,
	sign: sign,
	signAsync: signAsync,
	write: write
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');
var pem = require('./pem');
var Identity = require('../identity');
var Signature = require('../signature');
var Certificate = require('../certificate');
var pkcs8 = require('./pkcs8');

/*
 * This file is based on RFC5280 (X.509).
 */

/* Helper to read in a single mpint */
function readMPInt(der, nm) {
	assert.strictEqual(der.peek(), asn1.Ber.Integer,
	    nm + ' is not an Integer');
	return (utils.mpNormalize(der.readString(asn1.Ber.Integer, true)));
}

function verify(cert, key) {
	var sig = cert.signatures.x509;
	assert.object(sig, 'x509 signature');

	var algParts = sig.algo.split('-');
	if (algParts[0] !== key.type)
		return (false);

	var blob = sig.cache;
	if (blob === undefined) {
		var der = new asn1.BerWriter();
		writeTBSCert(cert, der);
		blob = der.buffer;
	}

	var verifier = key.createVerify(algParts[1]);
	verifier.write(blob);
	return (verifier.verify(sig.signature));
}

function Local(i) {
	return (asn1.Ber.Context | asn1.Ber.Constructor | i);
}

function Context(i) {
	return (asn1.Ber.Context | i);
}

var SIGN_ALGS = {
	'rsa-md5': '1.2.840.113549.1.1.4',
	'rsa-sha1': '1.2.840.113549.1.1.5',
	'rsa-sha256': '1.2.840.113549.1.1.11',
	'rsa-sha384': '1.2.840.113549.1.1.12',
	'rsa-sha512': '1.2.840.113549.1.1.13',
	'dsa-sha1': '1.2.840.10040.4.3',
	'dsa-sha256': '2.16.840.1.101.3.4.3.2',
	'ecdsa-sha1': '1.2.840.10045.4.1',
	'ecdsa-sha256': '1.2.840.10045.4.3.2',
	'ecdsa-sha384': '1.2.840.10045.4.3.3',
	'ecdsa-sha512': '1.2.840.10045.4.3.4',
	'ed25519-sha512': '1.3.101.112'
};
Object.keys(SIGN_ALGS).forEach(function (k) {
	SIGN_ALGS[SIGN_ALGS[k]] = k;
});
SIGN_ALGS['1.3.14.3.2.3'] = 'rsa-md5';
SIGN_ALGS['1.3.14.3.2.29'] = 'rsa-sha1';

var EXTS = {
	'issuerKeyId': '2.5.29.35',
	'altName': '2.5.29.17',
	'basicConstraints': '2.5.29.19',
	'keyUsage': '2.5.29.15',
	'extKeyUsage': '2.5.29.37'
};

function read(buf, options) {
	if (typeof (buf) === 'string') {
		buf = Buffer.from(buf, 'binary');
	}
	assert.buffer(buf, 'buf');

	var der = new asn1.BerReader(buf);

	der.readSequence();
	if (Math.abs(der.length - der.remain) > 1) {
		throw (new Error('DER sequence does not contain whole byte ' +
		    'stream'));
	}

	var tbsStart = der.offset;
	der.readSequence();
	var sigOffset = der.offset + der.length;
	var tbsEnd = sigOffset;

	if (der.peek() === Local(0)) {
		der.readSequence(Local(0));
		var version = der.readInt();
		assert.ok(version <= 3,
		    'only x.509 versions up to v3 supported');
	}

	var cert = {};
	cert.signatures = {};
	var sig = (cert.signatures.x509 = {});
	sig.extras = {};

	cert.serial = readMPInt(der, 'serial');

	der.readSequence();
	var after = der.offset + der.length;
	var certAlgOid = der.readOID();
	var certAlg = SIGN_ALGS[certAlgOid];
	if (certAlg === undefined)
		throw (new Error('unknown signature algorithm ' + certAlgOid));

	der._offset = after;
	cert.issuer = Identity.parseAsn1(der);

	der.readSequence();
	cert.validFrom = readDate(der);
	cert.validUntil = readDate(der);

	cert.subjects = [Identity.parseAsn1(der)];

	der.readSequence();
	after = der.offset + der.length;
	cert.subjectKey = pkcs8.readPkcs8(undefined, 'public', der);
	der._offset = after;

	/* issuerUniqueID */
	if (der.peek() === Local(1)) {
		der.readSequence(Local(1));
		sig.extras.issuerUniqueID =
		    buf.slice(der.offset, der.offset + der.length);
		der._offset += der.length;
	}

	/* subjectUniqueID */
	if (der.peek() === Local(2)) {
		der.readSequence(Local(2));
		sig.extras.subjectUniqueID =
		    buf.slice(der.offset, der.offset + der.length);
		der._offset += der.length;
	}

	/* extensions */
	if (der.peek() === Local(3)) {
		der.readSequence(Local(3));
		var extEnd = der.offset + der.length;
		der.readSequence();

		while (der.offset < extEnd)
			readExtension(cert, buf, der);

		assert.strictEqual(der.offset, extEnd);
	}

	assert.strictEqual(der.offset, sigOffset);

	der.readSequence();
	after = der.offset + der.length;
	var sigAlgOid = der.readOID();
	var sigAlg = SIGN_ALGS[sigAlgOid];
	if (sigAlg === undefined)
		throw (new Error('unknown signature algorithm ' + sigAlgOid));
	der._offset = after;

	var sigData = der.readString(asn1.Ber.BitString, true);
	if (sigData[0] === 0)
		sigData = sigData.slice(1);
	var algParts = sigAlg.split('-');

	sig.signature = Signature.parse(sigData, algParts[0], 'asn1');
	sig.signature.hashAlgorithm = algParts[1];
	sig.algo = sigAlg;
	sig.cache = buf.slice(tbsStart, tbsEnd);

	return (new Certificate(cert));
}

function readDate(der) {
	if (der.peek() === asn1.Ber.UTCTime) {
		return (utcTimeToDate(der.readString(asn1.Ber.UTCTime)));
	} else if (der.peek() === asn1.Ber.GeneralizedTime) {
		return (gTimeToDate(der.readString(asn1.Ber.GeneralizedTime)));
	} else {
		throw (new Error('Unsupported date format'));
	}
}

function writeDate(der, date) {
	if (date.getUTCFullYear() >= 2050 || date.getUTCFullYear() < 1950) {
		der.writeString(dateToGTime(date), asn1.Ber.GeneralizedTime);
	} else {
		der.writeString(dateToUTCTime(date), asn1.Ber.UTCTime);
	}
}

/* RFC5280, section 4.2.1.6 (GeneralName type) */
var ALTNAME = {
	OtherName: Local(0),
	RFC822Name: Context(1),
	DNSName: Context(2),
	X400Address: Local(3),
	DirectoryName: Local(4),
	EDIPartyName: Local(5),
	URI: Context(6),
	IPAddress: Context(7),
	OID: Context(8)
};

/* RFC5280, section 4.2.1.12 (KeyPurposeId) */
var EXTPURPOSE = {
	'serverAuth': '1.3.6.1.5.5.7.3.1',
	'clientAuth': '1.3.6.1.5.5.7.3.2',
	'codeSigning': '1.3.6.1.5.5.7.3.3',

	/* See https://github.com/joyent/oid-docs/blob/master/root.md */
	'joyentDocker': '1.3.6.1.4.1.38678.1.4.1',
	'joyentCmon': '1.3.6.1.4.1.38678.1.4.2'
};
var EXTPURPOSE_REV = {};
Object.keys(EXTPURPOSE).forEach(function (k) {
	EXTPURPOSE_REV[EXTPURPOSE[k]] = k;
});

var KEYUSEBITS = [
	'signature', 'identity', 'keyEncryption',
	'encryption', 'keyAgreement', 'ca', 'crl'
];

function readExtension(cert, buf, der) {
	der.readSequence();
	var after = der.offset + der.length;
	var extId = der.readOID();
	var id;
	var sig = cert.signatures.x509;
	if (!sig.extras.exts)
		sig.extras.exts = [];

	var critical;
	if (der.peek() === asn1.Ber.Boolean)
		critical = der.readBoolean();

	switch (extId) {
	case (EXTS.basicConstraints):
		der.readSequence(asn1.Ber.OctetString);
		der.readSequence();
		var bcEnd = der.offset + der.length;
		var ca = false;
		if (der.peek() === asn1.Ber.Boolean)
			ca = der.readBoolean();
		if (cert.purposes === undefined)
			cert.purposes = [];
		if (ca === true)
			cert.purposes.push('ca');
		var bc = { oid: extId, critical: critical };
		if (der.offset < bcEnd && der.peek() === asn1.Ber.Integer)
			bc.pathLen = der.readInt();
		sig.extras.exts.push(bc);
		break;
	case (EXTS.extKeyUsage):
		der.readSequence(asn1.Ber.OctetString);
		der.readSequence();
		if (cert.purposes === undefined)
			cert.purposes = [];
		var ekEnd = der.offset + der.length;
		while (der.offset < ekEnd) {
			var oid = der.readOID();
			cert.purposes.push(EXTPURPOSE_REV[oid] || oid);
		}
		/*
		 * This is a bit of a hack: in the case where we have a cert
		 * that's only allowed to do serverAuth or clientAuth (and not
		 * the other), we want to make sure all our Subjects are of
		 * the right type. But we already parsed our Subjects and
		 * decided if they were hosts or users earlier (since it appears
		 * first in the cert).
		 *
		 * So we go through and mutate them into the right kind here if
		 * it doesn't match. This might not be hugely beneficial, as it
		 * seems that single-purpose certs are not often seen in the
		 * wild.
		 */
		if (cert.purposes.indexOf('serverAuth') !== -1 &&
		    cert.purposes.indexOf('clientAuth') === -1) {
			cert.subjects.forEach(function (ide) {
				if (ide.type !== 'host') {
					ide.type = 'host';
					ide.hostname = ide.uid ||
					    ide.email ||
					    ide.components[0].value;
				}
			});
		} else if (cert.purposes.indexOf('clientAuth') !== -1 &&
		    cert.purposes.indexOf('serverAuth') === -1) {
			cert.subjects.forEach(function (ide) {
				if (ide.type !== 'user') {
					ide.type = 'user';
					ide.uid = ide.hostname ||
					    ide.email ||
					    ide.components[0].value;
				}
			});
		}
		sig.extras.exts.push({ oid: extId, critical: critical });
		break;
	case (EXTS.keyUsage):
		der.readSequence(asn1.Ber.OctetString);
		var bits = der.readString(asn1.Ber.BitString, true);
		var setBits = readBitField(bits, KEYUSEBITS);
		setBits.forEach(function (bit) {
			if (cert.purposes === undefined)
				cert.purposes = [];
			if (cert.purposes.indexOf(bit) === -1)
				cert.purposes.push(bit);
		});
		sig.extras.exts.push({ oid: extId, critical: critical,
		    bits: bits });
		break;
	case (EXTS.altName):
		der.readSequence(asn1.Ber.OctetString);
		der.readSequence();
		var aeEnd = der.offset + der.length;
		while (der.offset < aeEnd) {
			switch (der.peek()) {
			case ALTNAME.OtherName:
			case ALTNAME.EDIPartyName:
				der.readSequence();
				der._offset += der.length;
				break;
			case ALTNAME.OID:
				der.readOID(ALTNAME.OID);
				break;
			case ALTNAME.RFC822Name:
				/* RFC822 specifies email addresses */
				var email = der.readString(ALTNAME.RFC822Name);
				id = Identity.forEmail(email);
				if (!cert.subjects[0].equals(id))
					cert.subjects.push(id);
				break;
			case ALTNAME.DirectoryName:
				der.readSequence(ALTNAME.DirectoryName);
				id = Identity.parseAsn1(der);
				if (!cert.subjects[0].equals(id))
					cert.subjects.push(id);
				break;
			case ALTNAME.DNSName:
				var host = der.readString(
				    ALTNAME.DNSName);
				id = Identity.forHost(host);
				if (!cert.subjects[0].equals(id))
					cert.subjects.push(id);
				break;
			default:
				der.readString(der.peek());
				break;
			}
		}
		sig.extras.exts.push({ oid: extId, critical: critical });
		break;
	default:
		sig.extras.exts.push({
			oid: extId,
			critical: critical,
			data: der.readString(asn1.Ber.OctetString, true)
		});
		break;
	}

	der._offset = after;
}

var UTCTIME_RE =
    /^([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?Z$/;
function utcTimeToDate(t) {
	var m = t.match(UTCTIME_RE);
	assert.ok(m, 'timestamps must be in UTC');
	var d = new Date();

	var thisYear = d.getUTCFullYear();
	var century = Math.floor(thisYear / 100) * 100;

	var year = parseInt(m[1], 10);
	if (thisYear % 100 < 50 && year >= 60)
		year += (century - 1);
	else
		year += century;
	d.setUTCFullYear(year, parseInt(m[2], 10) - 1, parseInt(m[3], 10));
	d.setUTCHours(parseInt(m[4], 10), parseInt(m[5], 10));
	if (m[6] && m[6].length > 0)
		d.setUTCSeconds(parseInt(m[6], 10));
	return (d);
}

var GTIME_RE =
    /^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})?Z$/;
function gTimeToDate(t) {
	var m = t.match(GTIME_RE);
	assert.ok(m);
	var d = new Date();

	d.setUTCFullYear(parseInt(m[1], 10), parseInt(m[2], 10) - 1,
	    parseInt(m[3], 10));
	d.setUTCHours(parseInt(m[4], 10), parseInt(m[5], 10));
	if (m[6] && m[6].length > 0)
		d.setUTCSeconds(parseInt(m[6], 10));
	return (d);
}

function zeroPad(n, m) {
	if (m === undefined)
		m = 2;
	var s = '' + n;
	while (s.length < m)
		s = '0' + s;
	return (s);
}

function dateToUTCTime(d) {
	var s = '';
	s += zeroPad(d.getUTCFullYear() % 100);
	s += zeroPad(d.getUTCMonth() + 1);
	s += zeroPad(d.getUTCDate());
	s += zeroPad(d.getUTCHours());
	s += zeroPad(d.getUTCMinutes());
	s += zeroPad(d.getUTCSeconds());
	s += 'Z';
	return (s);
}

function dateToGTime(d) {
	var s = '';
	s += zeroPad(d.getUTCFullYear(), 4);
	s += zeroPad(d.getUTCMonth() + 1);
	s += zeroPad(d.getUTCDate());
	s += zeroPad(d.getUTCHours());
	s += zeroPad(d.getUTCMinutes());
	s += zeroPad(d.getUTCSeconds());
	s += 'Z';
	return (s);
}

function sign(cert, key) {
	if (cert.signatures.x509 === undefined)
		cert.signatures.x509 = {};
	var sig = cert.signatures.x509;

	sig.algo = key.type + '-' + key.defaultHashAlgorithm();
	if (SIGN_ALGS[sig.algo] === undefined)
		return (false);

	var der = new asn1.BerWriter();
	writeTBSCert(cert, der);
	var blob = der.buffer;
	sig.cache = blob;

	var signer = key.createSign();
	signer.write(blob);
	cert.signatures.x509.signature = signer.sign();

	return (true);
}

function signAsync(cert, signer, done) {
	if (cert.signatures.x509 === undefined)
		cert.signatures.x509 = {};
	var sig = cert.signatures.x509;

	var der = new asn1.BerWriter();
	writeTBSCert(cert, der);
	var blob = der.buffer;
	sig.cache = blob;

	signer(blob, function (err, signature) {
		if (err) {
			done(err);
			return;
		}
		sig.algo = signature.type + '-' + signature.hashAlgorithm;
		if (SIGN_ALGS[sig.algo] === undefined) {
			done(new Error('Invalid signing algorithm "' +
			    sig.algo + '"'));
			return;
		}
		sig.signature = signature;
		done();
	});
}

function write(cert, options) {
	var sig = cert.signatures.x509;
	assert.object(sig, 'x509 signature');

	var der = new asn1.BerWriter();
	der.startSequence();
	if (sig.cache) {
		der._ensure(sig.cache.length);
		sig.cache.copy(der._buf, der._offset);
		der._offset += sig.cache.length;
	} else {
		writeTBSCert(cert, der);
	}

	der.startSequence();
	der.writeOID(SIGN_ALGS[sig.algo]);
	if (sig.algo.match(/^rsa-/))
		der.writeNull();
	der.endSequence();

	var sigData = sig.signature.toBuffer('asn1');
	var data = Buffer.alloc(sigData.length + 1);
	data[0] = 0;
	sigData.copy(data, 1);
	der.writeBuffer(data, asn1.Ber.BitString);
	der.endSequence();

	return (der.buffer);
}

function writeTBSCert(cert, der) {
	var sig = cert.signatures.x509;
	assert.object(sig, 'x509 signature');

	der.startSequence();

	der.startSequence(Local(0));
	der.writeInt(2);
	der.endSequence();

	der.writeBuffer(utils.mpNormalize(cert.serial), asn1.Ber.Integer);

	der.startSequence();
	der.writeOID(SIGN_ALGS[sig.algo]);
	if (sig.algo.match(/^rsa-/))
		der.writeNull();
	der.endSequence();

	cert.issuer.toAsn1(der);

	der.startSequence();
	writeDate(der, cert.validFrom);
	writeDate(der, cert.validUntil);
	der.endSequence();

	var subject = cert.subjects[0];
	var altNames = cert.subjects.slice(1);
	subject.toAsn1(der);

	pkcs8.writePkcs8(der, cert.subjectKey);

	if (sig.extras && sig.extras.issuerUniqueID) {
		der.writeBuffer(sig.extras.issuerUniqueID, Local(1));
	}

	if (sig.extras && sig.extras.subjectUniqueID) {
		der.writeBuffer(sig.extras.subjectUniqueID, Local(2));
	}

	if (altNames.length > 0 || subject.type === 'host' ||
	    (cert.purposes !== undefined && cert.purposes.length > 0) ||
	    (sig.extras && sig.extras.exts)) {
		der.startSequence(Local(3));
		der.startSequence();

		var exts = [];
		if (cert.purposes !== undefined && cert.purposes.length > 0) {
			exts.push({
				oid: EXTS.basicConstraints,
				critical: true
			});
			exts.push({
				oid: EXTS.keyUsage,
				critical: true
			});
			exts.push({
				oid: EXTS.extKeyUsage,
				critical: true
			});
		}
		exts.push({ oid: EXTS.altName });
		if (sig.extras && sig.extras.exts)
			exts = sig.extras.exts;

		for (var i = 0; i < exts.length; ++i) {
			der.startSequence();
			der.writeOID(exts[i].oid);

			if (exts[i].critical !== undefined)
				der.writeBoolean(exts[i].critical);

			if (exts[i].oid === EXTS.altName) {
				der.startSequence(asn1.Ber.OctetString);
				der.startSequence();
				if (subject.type === 'host') {
					der.writeString(subject.hostname,
					    Context(2));
				}
				for (var j = 0; j < altNames.length; ++j) {
					if (altNames[j].type === 'host') {
						der.writeString(
						    altNames[j].hostname,
						    ALTNAME.DNSName);
					} else if (altNames[j].type ===
					    'email') {
						der.writeString(
						    altNames[j].email,
						    ALTNAME.RFC822Name);
					} else {
						/*
						 * Encode anything else as a
						 * DN style name for now.
						 */
						der.startSequence(
						    ALTNAME.DirectoryName);
						altNames[j].toAsn1(der);
						der.endSequence();
					}
				}
				der.endSequence();
				der.endSequence();
			} else if (exts[i].oid === EXTS.basicConstraints) {
				der.startSequence(asn1.Ber.OctetString);
				der.startSequence();
				var ca = (cert.purposes.indexOf('ca') !== -1);
				var pathLen = exts[i].pathLen;
				der.writeBoolean(ca);
				if (pathLen !== undefined)
					der.writeInt(pathLen);
				der.endSequence();
				der.endSequence();
			} else if (exts[i].oid === EXTS.extKeyUsage) {
				der.startSequence(asn1.Ber.OctetString);
				der.startSequence();
				cert.purposes.forEach(function (purpose) {
					if (purpose === 'ca')
						return;
					if (KEYUSEBITS.indexOf(purpose) !== -1)
						return;
					var oid = purpose;
					if (EXTPURPOSE[purpose] !== undefined)
						oid = EXTPURPOSE[purpose];
					der.writeOID(oid);
				});
				der.endSequence();
				der.endSequence();
			} else if (exts[i].oid === EXTS.keyUsage) {
				der.startSequence(asn1.Ber.OctetString);
				/*
				 * If we parsed this certificate from a byte
				 * stream (i.e. we didn't generate it in sshpk)
				 * then we'll have a ".bits" property on the
				 * ext with the original raw byte contents.
				 *
				 * If we have this, use it here instead of
				 * regenerating it. This guarantees we output
				 * the same data we parsed, so signatures still
				 * validate.
				 */
				if (exts[i].bits !== undefined) {
					der.writeBuffer(exts[i].bits,
					    asn1.Ber.BitString);
				} else {
					var bits = writeBitField(cert.purposes,
					    KEYUSEBITS);
					der.writeBuffer(bits,
					    asn1.Ber.BitString);
				}
				der.endSequence();
			} else {
				der.writeBuffer(exts[i].data,
				    asn1.Ber.OctetString);
			}

			der.endSequence();
		}

		der.endSequence();
		der.endSequence();
	}

	der.endSequence();
}

/*
 * Reads an ASN.1 BER bitfield out of the Buffer produced by doing
 * `BerReader#readString(asn1.Ber.BitString)`. That function gives us the raw
 * contents of the BitString tag, which is a count of unused bits followed by
 * the bits as a right-padded byte string.
 *
 * `bits` is the Buffer, `bitIndex` should contain an array of string names
 * for the bits in the string, ordered starting with bit #0 in the ASN.1 spec.
 *
 * Returns an array of Strings, the names of the bits that were set to 1.
 */
function readBitField(bits, bitIndex) {
	var bitLen = 8 * (bits.length - 1) - bits[0];
	var setBits = {};
	for (var i = 0; i < bitLen; ++i) {
		var byteN = 1 + Math.floor(i / 8);
		var bit = 7 - (i % 8);
		var mask = 1 << bit;
		var bitVal = ((bits[byteN] & mask) !== 0);
		var name = bitIndex[i];
		if (bitVal && typeof (name) === 'string') {
			setBits[name] = true;
		}
	}
	return (Object.keys(setBits));
}

/*
 * `setBits` is an array of strings, containing the names for each bit that
 * sould be set to 1. `bitIndex` is same as in `readBitField()`.
 *
 * Returns a Buffer, ready to be written out with `BerWriter#writeString()`.
 */
function writeBitField(setBits, bitIndex) {
	var bitLen = bitIndex.length;
	var blen = Math.ceil(bitLen / 8);
	var unused = blen * 8 - bitLen;
	var bits = Buffer.alloc(1 + blen); // zero-filled
	bits[0] = unused;
	for (var i = 0; i < bitLen; ++i) {
		var byteN = 1 + Math.floor(i / 8);
		var bit = 7 - (i % 8);
		var mask = 1 << bit;
		var name = bitIndex[i];
		if (name === undefined)
			continue;
		var bitVal = (setBits.indexOf(name) !== -1);
		if (bitVal) {
			bits[byteN] |= mask;
		}
	}
	return (bits);
}

}, function(modId) { var map = {"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946,"../identity":1572231845955,"../signature":1572231845940,"../certificate":1572231845954,"./pkcs8":1572231845948}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1572231845958, function(require, module, exports) {
// Copyright 2016 Joyent, Inc.

var x509 = require('./x509');

module.exports = {
	read: read,
	verify: x509.verify,
	sign: x509.sign,
	write: write
};

var assert = require('assert-plus');
var asn1 = require('asn1');
var Buffer = require('safer-buffer').Buffer;
var algs = require('../algs');
var utils = require('../utils');
var Key = require('../key');
var PrivateKey = require('../private-key');
var pem = require('./pem');
var Identity = require('../identity');
var Signature = require('../signature');
var Certificate = require('../certificate');

function read(buf, options) {
	if (typeof (buf) !== 'string') {
		assert.buffer(buf, 'buf');
		buf = buf.toString('ascii');
	}

	var lines = buf.trim().split(/[\r\n]+/g);

	var m;
	var si = -1;
	while (!m && si < lines.length) {
		m = lines[++si].match(/*JSSTYLED*/
		    /[-]+[ ]*BEGIN CERTIFICATE[ ]*[-]+/);
	}
	assert.ok(m, 'invalid PEM header');

	var m2;
	var ei = lines.length;
	while (!m2 && ei > 0) {
		m2 = lines[--ei].match(/*JSSTYLED*/
		    /[-]+[ ]*END CERTIFICATE[ ]*[-]+/);
	}
	assert.ok(m2, 'invalid PEM footer');

	lines = lines.slice(si, ei + 1);

	var headers = {};
	while (true) {
		lines = lines.slice(1);
		m = lines[0].match(/*JSSTYLED*/
		    /^([A-Za-z0-9-]+): (.+)$/);
		if (!m)
			break;
		headers[m[1].toLowerCase()] = m[2];
	}

	/* Chop off the first and last lines */
	lines = lines.slice(0, -1).join('');
	buf = Buffer.from(lines, 'base64');

	return (x509.read(buf, options));
}

function write(cert, options) {
	var dbuf = x509.write(cert, options);

	var header = 'CERTIFICATE';
	var tmp = dbuf.toString('base64');
	var len = tmp.length + (tmp.length / 64) +
	    18 + 16 + header.length*2 + 10;
	var buf = Buffer.alloc(len);
	var o = 0;
	o += buf.write('-----BEGIN ' + header + '-----\n', o);
	for (var i = 0; i < tmp.length; ) {
		var limit = i + 64;
		if (limit > tmp.length)
			limit = tmp.length;
		o += buf.write(tmp.slice(i, limit), o);
		buf[o++] = 10;
		i = limit;
	}
	o += buf.write('-----END ' + header + '-----\n', o);

	return (buf.slice(0, o));
}

}, function(modId) { var map = {"./x509":1572231845957,"../algs":1572231845936,"../utils":1572231845941,"../key":1572231845935,"../private-key":1572231845939,"./pem":1572231845946,"../identity":1572231845955,"../signature":1572231845940,"../certificate":1572231845954}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845934);
})()
//# sourceMappingURL=index.js.map