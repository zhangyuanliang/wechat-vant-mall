module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1572231845867, function(require, module, exports) {
/*
 * Copyright 2016, Joyent, Inc. All rights reserved.
 * Author: Alex Wilson <alex.wilson@joyent.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
*/

module.exports = {
	getPass: getPass
};

const mod_tty = require('tty');
const mod_fs = require('fs');
const mod_assert = require('assert-plus');

var BACKSPACE = String.fromCharCode(127);
var CTRLC = '\u0003';
var CTRLD = '\u0004';

function getPass(opts, cb) {
	if (typeof (opts) === 'function' && cb === undefined) {
		cb = opts;
		opts = {};
	}
	mod_assert.object(opts, 'options');
	mod_assert.func(cb, 'callback');

	mod_assert.optionalString(opts.prompt, 'options.prompt');
	if (opts.prompt === undefined)
		opts.prompt = 'Password';

	openTTY(function (err, rfd, wfd, rtty, wtty) {
		if (err) {
			cb(err);
			return;
		}

		wtty.write(opts.prompt + ':');
		rtty.resume();
		rtty.setRawMode(true);
		rtty.resume();
		rtty.setEncoding('utf8');

		var pw = '';
		rtty.on('data', onData);

		function onData(data) {
			var str = data.toString('utf8');
			for (var i = 0; i < str.length; ++i) {
				var ch = str[i];
				switch (ch) {
				case '\r':
				case '\n':
				case CTRLD:
					cleanup();
					cb(null, pw);
					return;
				case CTRLC:
					cleanup();
					cb(new Error('Aborted'));
					return;
				case BACKSPACE:
					pw = pw.slice(0, pw.length - 1);
					break;
				default:
					pw += ch;
					break;
				}
			}
		}

		function cleanup() {
			wtty.write('\r\n');
			rtty.setRawMode(false);
			rtty.pause();
			rtty.removeListener('data', onData);
			if (wfd !== undefined && wfd !== rfd) {
				wtty.end();
				mod_fs.closeSync(wfd);
			}
			if (rfd !== undefined) {
				rtty.end();
				mod_fs.closeSync(rfd);
			}
		}
	});
}

function openTTY(cb) {
	mod_fs.open('/dev/tty', 'r+', function (err, rttyfd) {
		if ((err && (err.code === 'ENOENT' || err.code === 'EACCES')) ||
		    (process.version.match(/^v0[.][0-8][.]/))) {
			cb(null, undefined, undefined, process.stdin,
			    process.stdout);
			return;
		}
		var rtty = new mod_tty.ReadStream(rttyfd);
		mod_fs.open('/dev/tty', 'w+', function (err3, wttyfd) {
			var wtty = new mod_tty.WriteStream(wttyfd);
			if (err3) {
				cb(err3);
				return;
			}
			cb(null, rttyfd, wttyfd, rtty, wtty);
		});
	});
}

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1572231845867);
})()
//# sourceMappingURL=index.js.map