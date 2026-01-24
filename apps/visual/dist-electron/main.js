import require$$1, { app, shell, Menu, nativeImage, BrowserWindow, ipcMain, Notification } from "electron";
import path, { join } from "path";
import fs, { existsSync, readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import require$$0 from "constants";
import require$$0$1 from "stream";
import require$$4, { promisify } from "util";
import require$$5 from "assert";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { getFonts } from "font-list";
import { exec } from "child_process";
import { homedir } from "os";
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var polyfills;
var hasRequiredPolyfills;
function requirePolyfills() {
  if (hasRequiredPolyfills) return polyfills;
  hasRequiredPolyfills = 1;
  var constants = require$$0;
  var origCwd = process.cwd;
  var cwd = null;
  var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
  process.cwd = function() {
    if (!cwd)
      cwd = origCwd.call(process);
    return cwd;
  };
  try {
    process.cwd();
  } catch (er) {
  }
  if (typeof process.chdir === "function") {
    var chdir = process.chdir;
    process.chdir = function(d) {
      cwd = null;
      chdir.call(process, d);
    };
    if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
  }
  polyfills = patch;
  function patch(fs2) {
    if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
      patchLchmod(fs2);
    }
    if (!fs2.lutimes) {
      patchLutimes(fs2);
    }
    fs2.chown = chownFix(fs2.chown);
    fs2.fchown = chownFix(fs2.fchown);
    fs2.lchown = chownFix(fs2.lchown);
    fs2.chmod = chmodFix(fs2.chmod);
    fs2.fchmod = chmodFix(fs2.fchmod);
    fs2.lchmod = chmodFix(fs2.lchmod);
    fs2.chownSync = chownFixSync(fs2.chownSync);
    fs2.fchownSync = chownFixSync(fs2.fchownSync);
    fs2.lchownSync = chownFixSync(fs2.lchownSync);
    fs2.chmodSync = chmodFixSync(fs2.chmodSync);
    fs2.fchmodSync = chmodFixSync(fs2.fchmodSync);
    fs2.lchmodSync = chmodFixSync(fs2.lchmodSync);
    fs2.stat = statFix(fs2.stat);
    fs2.fstat = statFix(fs2.fstat);
    fs2.lstat = statFix(fs2.lstat);
    fs2.statSync = statFixSync(fs2.statSync);
    fs2.fstatSync = statFixSync(fs2.fstatSync);
    fs2.lstatSync = statFixSync(fs2.lstatSync);
    if (fs2.chmod && !fs2.lchmod) {
      fs2.lchmod = function(path2, mode, cb) {
        if (cb) process.nextTick(cb);
      };
      fs2.lchmodSync = function() {
      };
    }
    if (fs2.chown && !fs2.lchown) {
      fs2.lchown = function(path2, uid, gid, cb) {
        if (cb) process.nextTick(cb);
      };
      fs2.lchownSync = function() {
      };
    }
    if (platform === "win32") {
      fs2.rename = typeof fs2.rename !== "function" ? fs2.rename : (function(fs$rename) {
        function rename(from, to, cb) {
          var start = Date.now();
          var backoff = 0;
          fs$rename(from, to, function CB(er) {
            if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
              setTimeout(function() {
                fs2.stat(to, function(stater, st) {
                  if (stater && stater.code === "ENOENT")
                    fs$rename(from, to, CB);
                  else
                    cb(er);
                });
              }, backoff);
              if (backoff < 100)
                backoff += 10;
              return;
            }
            if (cb) cb(er);
          });
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
        return rename;
      })(fs2.rename);
    }
    fs2.read = typeof fs2.read !== "function" ? fs2.read : (function(fs$read) {
      function read(fd, buffer, offset, length, position, callback_) {
        var callback;
        if (callback_ && typeof callback_ === "function") {
          var eagCounter = 0;
          callback = function(er, _, __) {
            if (er && er.code === "EAGAIN" && eagCounter < 10) {
              eagCounter++;
              return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
            }
            callback_.apply(this, arguments);
          };
        }
        return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
      }
      if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
      return read;
    })(fs2.read);
    fs2.readSync = typeof fs2.readSync !== "function" ? fs2.readSync : /* @__PURE__ */ (function(fs$readSync) {
      return function(fd, buffer, offset, length, position) {
        var eagCounter = 0;
        while (true) {
          try {
            return fs$readSync.call(fs2, fd, buffer, offset, length, position);
          } catch (er) {
            if (er.code === "EAGAIN" && eagCounter < 10) {
              eagCounter++;
              continue;
            }
            throw er;
          }
        }
      };
    })(fs2.readSync);
    function patchLchmod(fs22) {
      fs22.lchmod = function(path2, mode, callback) {
        fs22.open(
          path2,
          constants.O_WRONLY | constants.O_SYMLINK,
          mode,
          function(err, fd) {
            if (err) {
              if (callback) callback(err);
              return;
            }
            fs22.fchmod(fd, mode, function(err2) {
              fs22.close(fd, function(err22) {
                if (callback) callback(err2 || err22);
              });
            });
          }
        );
      };
      fs22.lchmodSync = function(path2, mode) {
        var fd = fs22.openSync(path2, constants.O_WRONLY | constants.O_SYMLINK, mode);
        var threw = true;
        var ret;
        try {
          ret = fs22.fchmodSync(fd, mode);
          threw = false;
        } finally {
          if (threw) {
            try {
              fs22.closeSync(fd);
            } catch (er) {
            }
          } else {
            fs22.closeSync(fd);
          }
        }
        return ret;
      };
    }
    function patchLutimes(fs22) {
      if (constants.hasOwnProperty("O_SYMLINK") && fs22.futimes) {
        fs22.lutimes = function(path2, at, mt, cb) {
          fs22.open(path2, constants.O_SYMLINK, function(er, fd) {
            if (er) {
              if (cb) cb(er);
              return;
            }
            fs22.futimes(fd, at, mt, function(er2) {
              fs22.close(fd, function(er22) {
                if (cb) cb(er2 || er22);
              });
            });
          });
        };
        fs22.lutimesSync = function(path2, at, mt) {
          var fd = fs22.openSync(path2, constants.O_SYMLINK);
          var ret;
          var threw = true;
          try {
            ret = fs22.futimesSync(fd, at, mt);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs22.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs22.closeSync(fd);
            }
          }
          return ret;
        };
      } else if (fs22.futimes) {
        fs22.lutimes = function(_a, _b, _c, cb) {
          if (cb) process.nextTick(cb);
        };
        fs22.lutimesSync = function() {
        };
      }
    }
    function chmodFix(orig) {
      if (!orig) return orig;
      return function(target, mode, cb) {
        return orig.call(fs2, target, mode, function(er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chmodFixSync(orig) {
      if (!orig) return orig;
      return function(target, mode) {
        try {
          return orig.call(fs2, target, mode);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function chownFix(orig) {
      if (!orig) return orig;
      return function(target, uid, gid, cb) {
        return orig.call(fs2, target, uid, gid, function(er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chownFixSync(orig) {
      if (!orig) return orig;
      return function(target, uid, gid) {
        try {
          return orig.call(fs2, target, uid, gid);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function statFix(orig) {
      if (!orig) return orig;
      return function(target, options, cb) {
        if (typeof options === "function") {
          cb = options;
          options = null;
        }
        function callback(er, stats) {
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          if (cb) cb.apply(this, arguments);
        }
        return options ? orig.call(fs2, target, options, callback) : orig.call(fs2, target, callback);
      };
    }
    function statFixSync(orig) {
      if (!orig) return orig;
      return function(target, options) {
        var stats = options ? orig.call(fs2, target, options) : orig.call(fs2, target);
        if (stats) {
          if (stats.uid < 0) stats.uid += 4294967296;
          if (stats.gid < 0) stats.gid += 4294967296;
        }
        return stats;
      };
    }
    function chownErOk(er) {
      if (!er)
        return true;
      if (er.code === "ENOSYS")
        return true;
      var nonroot = !process.getuid || process.getuid() !== 0;
      if (nonroot) {
        if (er.code === "EINVAL" || er.code === "EPERM")
          return true;
      }
      return false;
    }
  }
  return polyfills;
}
var legacyStreams;
var hasRequiredLegacyStreams;
function requireLegacyStreams() {
  if (hasRequiredLegacyStreams) return legacyStreams;
  hasRequiredLegacyStreams = 1;
  var Stream = require$$0$1.Stream;
  legacyStreams = legacy;
  function legacy(fs2) {
    return {
      ReadStream,
      WriteStream
    };
    function ReadStream(path2, options) {
      if (!(this instanceof ReadStream)) return new ReadStream(path2, options);
      Stream.call(this);
      var self2 = this;
      this.path = path2;
      this.fd = null;
      this.readable = true;
      this.paused = false;
      this.flags = "r";
      this.mode = 438;
      this.bufferSize = 64 * 1024;
      options = options || {};
      var keys = Object.keys(options);
      for (var index = 0, length = keys.length; index < length; index++) {
        var key = keys[index];
        this[key] = options[key];
      }
      if (this.encoding) this.setEncoding(this.encoding);
      if (this.start !== void 0) {
        if ("number" !== typeof this.start) {
          throw TypeError("start must be a Number");
        }
        if (this.end === void 0) {
          this.end = Infinity;
        } else if ("number" !== typeof this.end) {
          throw TypeError("end must be a Number");
        }
        if (this.start > this.end) {
          throw new Error("start must be <= end");
        }
        this.pos = this.start;
      }
      if (this.fd !== null) {
        process.nextTick(function() {
          self2._read();
        });
        return;
      }
      fs2.open(this.path, this.flags, this.mode, function(err, fd) {
        if (err) {
          self2.emit("error", err);
          self2.readable = false;
          return;
        }
        self2.fd = fd;
        self2.emit("open", fd);
        self2._read();
      });
    }
    function WriteStream(path2, options) {
      if (!(this instanceof WriteStream)) return new WriteStream(path2, options);
      Stream.call(this);
      this.path = path2;
      this.fd = null;
      this.writable = true;
      this.flags = "w";
      this.encoding = "binary";
      this.mode = 438;
      this.bytesWritten = 0;
      options = options || {};
      var keys = Object.keys(options);
      for (var index = 0, length = keys.length; index < length; index++) {
        var key = keys[index];
        this[key] = options[key];
      }
      if (this.start !== void 0) {
        if ("number" !== typeof this.start) {
          throw TypeError("start must be a Number");
        }
        if (this.start < 0) {
          throw new Error("start must be >= zero");
        }
        this.pos = this.start;
      }
      this.busy = false;
      this._queue = [];
      if (this.fd === null) {
        this._open = fs2.open;
        this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
        this.flush();
      }
    }
  }
  return legacyStreams;
}
var clone_1;
var hasRequiredClone;
function requireClone() {
  if (hasRequiredClone) return clone_1;
  hasRequiredClone = 1;
  clone_1 = clone;
  var getPrototypeOf = Object.getPrototypeOf || function(obj) {
    return obj.__proto__;
  };
  function clone(obj) {
    if (obj === null || typeof obj !== "object")
      return obj;
    if (obj instanceof Object)
      var copy = { __proto__: getPrototypeOf(obj) };
    else
      var copy = /* @__PURE__ */ Object.create(null);
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
    });
    return copy;
  }
  return clone_1;
}
var gracefulFs;
var hasRequiredGracefulFs;
function requireGracefulFs() {
  if (hasRequiredGracefulFs) return gracefulFs;
  hasRequiredGracefulFs = 1;
  var fs$1 = fs;
  var polyfills2 = requirePolyfills();
  var legacy = requireLegacyStreams();
  var clone = requireClone();
  var util = require$$4;
  var gracefulQueue;
  var previousSymbol;
  if (typeof Symbol === "function" && typeof Symbol.for === "function") {
    gracefulQueue = /* @__PURE__ */ Symbol.for("graceful-fs.queue");
    previousSymbol = /* @__PURE__ */ Symbol.for("graceful-fs.previous");
  } else {
    gracefulQueue = "___graceful-fs.queue";
    previousSymbol = "___graceful-fs.previous";
  }
  function noop() {
  }
  function publishQueue(context, queue2) {
    Object.defineProperty(context, gracefulQueue, {
      get: function() {
        return queue2;
      }
    });
  }
  var debug = noop;
  if (util.debuglog)
    debug = util.debuglog("gfs4");
  else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
    debug = function() {
      var m = util.format.apply(util, arguments);
      m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
      console.error(m);
    };
  if (!fs$1[gracefulQueue]) {
    var queue = commonjsGlobal[gracefulQueue] || [];
    publishQueue(fs$1, queue);
    fs$1.close = (function(fs$close) {
      function close(fd, cb) {
        return fs$close.call(fs$1, fd, function(err) {
          if (!err) {
            resetQueue();
          }
          if (typeof cb === "function")
            cb.apply(this, arguments);
        });
      }
      Object.defineProperty(close, previousSymbol, {
        value: fs$close
      });
      return close;
    })(fs$1.close);
    fs$1.closeSync = (function(fs$closeSync) {
      function closeSync(fd) {
        fs$closeSync.apply(fs$1, arguments);
        resetQueue();
      }
      Object.defineProperty(closeSync, previousSymbol, {
        value: fs$closeSync
      });
      return closeSync;
    })(fs$1.closeSync);
    if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
      process.on("exit", function() {
        debug(fs$1[gracefulQueue]);
        require$$5.equal(fs$1[gracefulQueue].length, 0);
      });
    }
  }
  if (!commonjsGlobal[gracefulQueue]) {
    publishQueue(commonjsGlobal, fs$1[gracefulQueue]);
  }
  gracefulFs = patch(clone(fs$1));
  if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs$1.__patched) {
    gracefulFs = patch(fs$1);
    fs$1.__patched = true;
  }
  function patch(fs2) {
    polyfills2(fs2);
    fs2.gracefulify = patch;
    fs2.createReadStream = createReadStream;
    fs2.createWriteStream = createWriteStream;
    var fs$readFile = fs2.readFile;
    fs2.readFile = readFile;
    function readFile(path2, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$readFile(path2, options, cb);
      function go$readFile(path22, options2, cb2, startTime) {
        return fs$readFile(path22, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$readFile, [path22, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$writeFile = fs2.writeFile;
    fs2.writeFile = writeFile;
    function writeFile(path2, data, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$writeFile(path2, data, options, cb);
      function go$writeFile(path22, data2, options2, cb2, startTime) {
        return fs$writeFile(path22, data2, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$writeFile, [path22, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$appendFile = fs2.appendFile;
    if (fs$appendFile)
      fs2.appendFile = appendFile;
    function appendFile(path2, data, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$appendFile(path2, data, options, cb);
      function go$appendFile(path22, data2, options2, cb2, startTime) {
        return fs$appendFile(path22, data2, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$appendFile, [path22, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$copyFile = fs2.copyFile;
    if (fs$copyFile)
      fs2.copyFile = copyFile;
    function copyFile(src, dest, flags, cb) {
      if (typeof flags === "function") {
        cb = flags;
        flags = 0;
      }
      return go$copyFile(src, dest, flags, cb);
      function go$copyFile(src2, dest2, flags2, cb2, startTime) {
        return fs$copyFile(src2, dest2, flags2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$readdir = fs2.readdir;
    fs2.readdir = readdir;
    var noReaddirOptionVersions = /^v[0-5]\./;
    function readdir(path2, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path22, options2, cb2, startTime) {
        return fs$readdir(path22, fs$readdirCallback(
          path22,
          options2,
          cb2,
          startTime
        ));
      } : function go$readdir2(path22, options2, cb2, startTime) {
        return fs$readdir(path22, options2, fs$readdirCallback(
          path22,
          options2,
          cb2,
          startTime
        ));
      };
      return go$readdir(path2, options, cb);
      function fs$readdirCallback(path22, options2, cb2, startTime) {
        return function(err, files) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([
              go$readdir,
              [path22, options2, cb2],
              err,
              startTime || Date.now(),
              Date.now()
            ]);
          else {
            if (files && files.sort)
              files.sort();
            if (typeof cb2 === "function")
              cb2.call(this, err, files);
          }
        };
      }
    }
    if (process.version.substr(0, 4) === "v0.8") {
      var legStreams = legacy(fs2);
      ReadStream = legStreams.ReadStream;
      WriteStream = legStreams.WriteStream;
    }
    var fs$ReadStream = fs2.ReadStream;
    if (fs$ReadStream) {
      ReadStream.prototype = Object.create(fs$ReadStream.prototype);
      ReadStream.prototype.open = ReadStream$open;
    }
    var fs$WriteStream = fs2.WriteStream;
    if (fs$WriteStream) {
      WriteStream.prototype = Object.create(fs$WriteStream.prototype);
      WriteStream.prototype.open = WriteStream$open;
    }
    Object.defineProperty(fs2, "ReadStream", {
      get: function() {
        return ReadStream;
      },
      set: function(val) {
        ReadStream = val;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(fs2, "WriteStream", {
      get: function() {
        return WriteStream;
      },
      set: function(val) {
        WriteStream = val;
      },
      enumerable: true,
      configurable: true
    });
    var FileReadStream = ReadStream;
    Object.defineProperty(fs2, "FileReadStream", {
      get: function() {
        return FileReadStream;
      },
      set: function(val) {
        FileReadStream = val;
      },
      enumerable: true,
      configurable: true
    });
    var FileWriteStream = WriteStream;
    Object.defineProperty(fs2, "FileWriteStream", {
      get: function() {
        return FileWriteStream;
      },
      set: function(val) {
        FileWriteStream = val;
      },
      enumerable: true,
      configurable: true
    });
    function ReadStream(path2, options) {
      if (this instanceof ReadStream)
        return fs$ReadStream.apply(this, arguments), this;
      else
        return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
    }
    function ReadStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function(err, fd) {
        if (err) {
          if (that.autoClose)
            that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
          that.read();
        }
      });
    }
    function WriteStream(path2, options) {
      if (this instanceof WriteStream)
        return fs$WriteStream.apply(this, arguments), this;
      else
        return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
    }
    function WriteStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function(err, fd) {
        if (err) {
          that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
        }
      });
    }
    function createReadStream(path2, options) {
      return new fs2.ReadStream(path2, options);
    }
    function createWriteStream(path2, options) {
      return new fs2.WriteStream(path2, options);
    }
    var fs$open = fs2.open;
    fs2.open = open;
    function open(path2, flags, mode, cb) {
      if (typeof mode === "function")
        cb = mode, mode = null;
      return go$open(path2, flags, mode, cb);
      function go$open(path22, flags2, mode2, cb2, startTime) {
        return fs$open(path22, flags2, mode2, function(err, fd) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$open, [path22, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    return fs2;
  }
  function enqueue(elem) {
    debug("ENQUEUE", elem[0].name, elem[1]);
    fs$1[gracefulQueue].push(elem);
    retry();
  }
  var retryTimer;
  function resetQueue() {
    var now = Date.now();
    for (var i = 0; i < fs$1[gracefulQueue].length; ++i) {
      if (fs$1[gracefulQueue][i].length > 2) {
        fs$1[gracefulQueue][i][3] = now;
        fs$1[gracefulQueue][i][4] = now;
      }
    }
    retry();
  }
  function retry() {
    clearTimeout(retryTimer);
    retryTimer = void 0;
    if (fs$1[gracefulQueue].length === 0)
      return;
    var elem = fs$1[gracefulQueue].shift();
    var fn = elem[0];
    var args = elem[1];
    var err = elem[2];
    var startTime = elem[3];
    var lastTime = elem[4];
    if (startTime === void 0) {
      debug("RETRY", fn.name, args);
      fn.apply(null, args);
    } else if (Date.now() - startTime >= 6e4) {
      debug("TIMEOUT", fn.name, args);
      var cb = args.pop();
      if (typeof cb === "function")
        cb.call(null, err);
    } else {
      var sinceAttempt = Date.now() - lastTime;
      var sinceStart = Math.max(lastTime - startTime, 1);
      var desiredDelay = Math.min(sinceStart * 1.2, 100);
      if (sinceAttempt >= desiredDelay) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args.concat([startTime]));
      } else {
        fs$1[gracefulQueue].push(elem);
      }
    }
    if (retryTimer === void 0) {
      retryTimer = setTimeout(retry, 0);
    }
  }
  return gracefulFs;
}
var jsonfile_1;
var hasRequiredJsonfile;
function requireJsonfile() {
  if (hasRequiredJsonfile) return jsonfile_1;
  hasRequiredJsonfile = 1;
  var _fs;
  try {
    _fs = requireGracefulFs();
  } catch (_) {
    _fs = fs;
  }
  function readFile(file, options, callback) {
    if (callback == null) {
      callback = options;
      options = {};
    }
    if (typeof options === "string") {
      options = { encoding: options };
    }
    options = options || {};
    var fs2 = options.fs || _fs;
    var shouldThrow = true;
    if ("throws" in options) {
      shouldThrow = options.throws;
    }
    fs2.readFile(file, options, function(err, data) {
      if (err) return callback(err);
      data = stripBom(data);
      var obj;
      try {
        obj = JSON.parse(data, options ? options.reviver : null);
      } catch (err2) {
        if (shouldThrow) {
          err2.message = file + ": " + err2.message;
          return callback(err2);
        } else {
          return callback(null, null);
        }
      }
      callback(null, obj);
    });
  }
  function readFileSync2(file, options) {
    options = options || {};
    if (typeof options === "string") {
      options = { encoding: options };
    }
    var fs2 = options.fs || _fs;
    var shouldThrow = true;
    if ("throws" in options) {
      shouldThrow = options.throws;
    }
    try {
      var content = fs2.readFileSync(file, options);
      content = stripBom(content);
      return JSON.parse(content, options.reviver);
    } catch (err) {
      if (shouldThrow) {
        err.message = file + ": " + err.message;
        throw err;
      } else {
        return null;
      }
    }
  }
  function stringify(obj, options) {
    var spaces;
    var EOL = "\n";
    if (typeof options === "object" && options !== null) {
      if (options.spaces) {
        spaces = options.spaces;
      }
      if (options.EOL) {
        EOL = options.EOL;
      }
    }
    var str = JSON.stringify(obj, options ? options.replacer : null, spaces);
    return str.replace(/\n/g, EOL) + EOL;
  }
  function writeFile(file, obj, options, callback) {
    if (callback == null) {
      callback = options;
      options = {};
    }
    options = options || {};
    var fs2 = options.fs || _fs;
    var str = "";
    try {
      str = stringify(obj, options);
    } catch (err) {
      if (callback) callback(err, null);
      return;
    }
    fs2.writeFile(file, str, options, callback);
  }
  function writeFileSync(file, obj, options) {
    options = options || {};
    var fs2 = options.fs || _fs;
    var str = stringify(obj, options);
    return fs2.writeFileSync(file, str, options);
  }
  function stripBom(content) {
    if (Buffer.isBuffer(content)) content = content.toString("utf8");
    content = content.replace(/^\uFEFF/, "");
    return content;
  }
  var jsonfile = {
    readFile,
    readFileSync: readFileSync2,
    writeFile,
    writeFileSync
  };
  jsonfile_1 = jsonfile;
  return jsonfile_1;
}
var mkdirp;
var hasRequiredMkdirp;
function requireMkdirp() {
  if (hasRequiredMkdirp) return mkdirp;
  hasRequiredMkdirp = 1;
  var path$1 = path;
  var fs$1 = fs;
  var _0777 = parseInt("0777", 8);
  mkdirp = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
  function mkdirP(p, opts, f, made) {
    if (typeof opts === "function") {
      f = opts;
      opts = {};
    } else if (!opts || typeof opts !== "object") {
      opts = { mode: opts };
    }
    var mode = opts.mode;
    var xfs = opts.fs || fs$1;
    if (mode === void 0) {
      mode = _0777;
    }
    if (!made) made = null;
    var cb = f || /* istanbul ignore next */
    function() {
    };
    p = path$1.resolve(p);
    xfs.mkdir(p, mode, function(er) {
      if (!er) {
        made = made || p;
        return cb(null, made);
      }
      switch (er.code) {
        case "ENOENT":
          if (path$1.dirname(p) === p) return cb(er);
          mkdirP(path$1.dirname(p), opts, function(er2, made2) {
            if (er2) cb(er2, made2);
            else mkdirP(p, opts, cb, made2);
          });
          break;
        // In the case of any other error, just see if there's a dir
        // there already.  If so, then hooray!  If not, then something
        // is borked.
        default:
          xfs.stat(p, function(er2, stat) {
            if (er2 || !stat.isDirectory()) cb(er, made);
            else cb(null, made);
          });
          break;
      }
    });
  }
  mkdirP.sync = function sync(p, opts, made) {
    if (!opts || typeof opts !== "object") {
      opts = { mode: opts };
    }
    var mode = opts.mode;
    var xfs = opts.fs || fs$1;
    if (mode === void 0) {
      mode = _0777;
    }
    if (!made) made = null;
    p = path$1.resolve(p);
    try {
      xfs.mkdirSync(p, mode);
      made = made || p;
    } catch (err0) {
      switch (err0.code) {
        case "ENOENT":
          made = sync(path$1.dirname(p), opts, made);
          sync(p, opts, made);
          break;
        // In the case of any other error, just see if there's a dir
        // there already.  If so, then hooray!  If not, then something
        // is borked.
        default:
          var stat;
          try {
            stat = xfs.statSync(p);
          } catch (err1) {
            throw err0;
          }
          if (!stat.isDirectory()) throw err0;
          break;
      }
    }
    return made;
  };
  return mkdirp;
}
var electronWindowState;
var hasRequiredElectronWindowState;
function requireElectronWindowState() {
  if (hasRequiredElectronWindowState) return electronWindowState;
  hasRequiredElectronWindowState = 1;
  const path$1 = path;
  const electron = require$$1;
  const jsonfile = requireJsonfile();
  const mkdirp2 = requireMkdirp();
  electronWindowState = function(options) {
    const app2 = electron.app || electron.remote.app;
    const screen = electron.screen || electron.remote.screen;
    let state;
    let winRef;
    let stateChangeTimer;
    const eventHandlingDelay = 100;
    const config = Object.assign({
      file: "window-state.json",
      path: app2.getPath("userData"),
      maximize: true,
      fullScreen: true
    }, options);
    const fullStoreFileName = path$1.join(config.path, config.file);
    function isNormal(win) {
      return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen();
    }
    function hasBounds() {
      return state && Number.isInteger(state.x) && Number.isInteger(state.y) && Number.isInteger(state.width) && state.width > 0 && Number.isInteger(state.height) && state.height > 0;
    }
    function resetStateToDefault() {
      const displayBounds = screen.getPrimaryDisplay().bounds;
      state = {
        width: config.defaultWidth || 800,
        height: config.defaultHeight || 600,
        x: 0,
        y: 0,
        displayBounds
      };
    }
    function windowWithinBounds(bounds) {
      return state.x >= bounds.x && state.y >= bounds.y && state.x + state.width <= bounds.x + bounds.width && state.y + state.height <= bounds.y + bounds.height;
    }
    function ensureWindowVisibleOnSomeDisplay() {
      const visible = screen.getAllDisplays().some((display) => {
        return windowWithinBounds(display.bounds);
      });
      if (!visible) {
        return resetStateToDefault();
      }
    }
    function validateState() {
      const isValid = state && (hasBounds() || state.isMaximized || state.isFullScreen);
      if (!isValid) {
        state = null;
        return;
      }
      if (hasBounds() && state.displayBounds) {
        ensureWindowVisibleOnSomeDisplay();
      }
    }
    function updateState(win) {
      win = win || winRef;
      if (!win) {
        return;
      }
      try {
        const winBounds = win.getBounds();
        if (isNormal(win)) {
          state.x = winBounds.x;
          state.y = winBounds.y;
          state.width = winBounds.width;
          state.height = winBounds.height;
        }
        state.isMaximized = win.isMaximized();
        state.isFullScreen = win.isFullScreen();
        state.displayBounds = screen.getDisplayMatching(winBounds).bounds;
      } catch (err) {
      }
    }
    function saveState(win) {
      if (win) {
        updateState(win);
      }
      try {
        mkdirp2.sync(path$1.dirname(fullStoreFileName));
        jsonfile.writeFileSync(fullStoreFileName, state);
      } catch (err) {
      }
    }
    function stateChangeHandler() {
      clearTimeout(stateChangeTimer);
      stateChangeTimer = setTimeout(updateState, eventHandlingDelay);
    }
    function closeHandler() {
      updateState();
    }
    function closedHandler() {
      unmanage();
      saveState();
    }
    function manage(win) {
      if (config.maximize && state.isMaximized) {
        win.maximize();
      }
      if (config.fullScreen && state.isFullScreen) {
        win.setFullScreen(true);
      }
      win.on("resize", stateChangeHandler);
      win.on("move", stateChangeHandler);
      win.on("close", closeHandler);
      win.on("closed", closedHandler);
      winRef = win;
    }
    function unmanage() {
      if (winRef) {
        winRef.removeListener("resize", stateChangeHandler);
        winRef.removeListener("move", stateChangeHandler);
        clearTimeout(stateChangeTimer);
        winRef.removeListener("close", closeHandler);
        winRef.removeListener("closed", closedHandler);
        winRef = null;
      }
    }
    try {
      state = jsonfile.readFileSync(fullStoreFileName);
    } catch (err) {
    }
    validateState();
    state = Object.assign({
      width: config.defaultWidth || 800,
      height: config.defaultHeight || 600
    }, state);
    return {
      get x() {
        return state.x;
      },
      get y() {
        return state.y;
      },
      get width() {
        return state.width;
      },
      get height() {
        return state.height;
      },
      get displayBounds() {
        return state.displayBounds;
      },
      get isMaximized() {
        return state.isMaximized;
      },
      get isFullScreen() {
        return state.isFullScreen;
      },
      saveState,
      unmanage,
      manage,
      resetStateToDefault
    };
  };
  return electronWindowState;
}
var electronWindowStateExports = requireElectronWindowState();
const windowStateKeeper = /* @__PURE__ */ getDefaultExportFromCjs(electronWindowStateExports);
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { data: {}, body: content };
  }
  const [, frontmatterStr, body] = frontmatterMatch;
  const data = {};
  for (const line of frontmatterStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      data[key] = value;
    }
  }
  return { data, body };
}
function extractSections(markdown) {
  const sections = {};
  const lines = markdown.split("\n");
  let currentSection = "";
  let currentContent = [];
  for (const line of lines) {
    const headerMatch = line.match(/^#\s+(.+)$/);
    if (headerMatch) {
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join("\n").trim();
      }
      currentSection = headerMatch[1];
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join("\n").trim();
  }
  return sections;
}
function parseSemanticDoc(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const { data: frontmatter, body } = parseFrontmatter(content);
  if (!frontmatter.id) {
    console.warn(`[seedDocs] Skipping ${filePath}: missing 'id' in frontmatter`);
    return null;
  }
  const sections = extractSections(body);
  return {
    id: frontmatter.id,
    name: frontmatter.name || frontmatter.id,
    summary: frontmatter.summary || "",
    description: sections.description || "",
    usage: sections.usage || "",
    examples: sections.examples || ""
  };
}
function loadSemanticDocs(docsDir) {
  const docs = /* @__PURE__ */ new Map();
  if (!existsSync(docsDir)) {
    console.warn(`[seedDocs] Docs directory not found: ${docsDir}`);
    return docs;
  }
  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const doc = parseSemanticDoc(join(docsDir, file));
    if (doc) {
      docs.set(doc.id, doc);
    }
  }
  return docs;
}
function seedSemanticDocs(db2, docsDir) {
  const docs = loadSemanticDocs(docsDir);
  if (docs.size === 0) {
    console.log("[seedDocs] No semantic docs found to seed");
    return;
  }
  console.log("[seedDocs] Seeding semantic documentation...");
  const insertDoc = db2.prepare(`
    INSERT OR REPLACE INTO semantic_docs (id, name, summary, description, usage, examples, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  for (const [id, doc] of docs) {
    insertDoc.run(id, doc.name, doc.summary, doc.description, doc.usage, doc.examples, now);
    console.log(`[seedDocs]   ✓ ${doc.name}`);
  }
  console.log("[seedDocs] Updating existing semantics with missing docs...");
  const semanticEntities = db2.prepare(`
    SELECT DISTINCT a.entity_id, a.string_value as semantic_type
    FROM attrs a
    WHERE a.key = 'semantic.type'
    AND NOT EXISTS (
      SELECT 1 FROM attrs h
      WHERE h.entity_id = a.entity_id
      AND h.key = 'help.summary'
    )
  `).all();
  const insertAttr = db2.prepare(`
    INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
    VALUES (?, ?, 'string', ?, NULL, NULL, NULL)
  `);
  let updated = 0;
  for (const { entity_id, semantic_type } of semanticEntities) {
    const doc = docs.get(semantic_type);
    if (doc) {
      if (doc.summary) insertAttr.run(entity_id, "help.summary", doc.summary);
      if (doc.description) insertAttr.run(entity_id, "help.description", doc.description);
      if (doc.usage) insertAttr.run(entity_id, "help.usage", doc.usage);
      if (doc.examples) insertAttr.run(entity_id, "help.examples", doc.examples);
      updated++;
      console.log(`[seedDocs]   ✓ Updated ${semantic_type} entity ${entity_id.slice(0, 8)}...`);
    }
  }
  console.log(`[seedDocs] Complete. Seeded ${docs.size} docs, updated ${updated} existing semantics.`);
}
function columnExists(db2, table, column) {
  const cols = db2.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}
function runMigrations(db2, dataDir) {
  const schemaDir = join(dataDir, "schema");
  db2.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const applied = new Set(
    db2.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
  );
  if (!applied.has("005_port_columns.sql") && columnExists(db2, "relationships", "from_port")) {
    db2.prepare("INSERT INTO _migrations (name) VALUES (?)").run("005_port_columns.sql");
    applied.add("005_port_columns.sql");
  }
  console.log("[migrations] Running migrations...");
  if (existsSync(schemaDir)) {
    const schemaFiles = readdirSync(schemaDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of schemaFiles) {
      if (applied.has(file)) {
        console.log(`[migrations]   - ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(schemaDir, file), "utf-8");
      db2.exec(sql);
      db2.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
      console.log(`[migrations]   ✓ ${file}`);
    }
  }
  console.log("[migrations] Complete.");
}
function seed(db2, dataDir) {
  const themesDir = join(dataDir, "themes");
  const tokensFile = join(dataDir, "tokens.json");
  console.log("[seed] Loading token definitions...");
  if (existsSync(tokensFile)) {
    const tokenData = JSON.parse(readFileSync(tokensFile, "utf-8"));
    const tokens = tokenData.tokens;
    const tokenIds = new Set(tokens.map((t) => t.id));
    const insertToken = db2.prepare(`
      INSERT OR REPLACE INTO token_definitions (id, category, label, description)
      VALUES (?, ?, ?, ?)
    `);
    for (const token of tokens) {
      insertToken.run(token.id, token.category, token.label, token.description);
    }
    console.log(`[seed]   ✓ ${tokens.length} tokens defined`);
    console.log("[seed] Loading themes...");
    if (existsSync(themesDir)) {
      const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith(".json"));
      const insertTheme = db2.prepare(`
        INSERT OR REPLACE INTO themes (id, name, description, author, is_system)
        VALUES (?, ?, ?, ?, 1)
      `);
      const insertColor = db2.prepare(`
        INSERT OR REPLACE INTO theme_colors (theme_id, token_id, value)
        VALUES (?, ?, ?)
      `);
      for (const file of themeFiles) {
        const theme = JSON.parse(readFileSync(join(themesDir, file), "utf-8"));
        const colorTokenIds = [...tokenIds].filter((id) => !id.startsWith("font-"));
        const missing = colorTokenIds.filter((id) => !(id in theme.colors));
        if (missing.length > 0) {
          console.warn(`[seed]   ⚠ ${file}: missing tokens: ${missing.join(", ")}`);
        }
        insertTheme.run(theme.id, theme.name, theme.description || "", theme.author || "system");
        for (const [tokenId, value] of Object.entries(theme.colors)) {
          if (tokenIds.has(tokenId)) {
            insertColor.run(theme.id, tokenId, value);
          } else {
            console.warn(`[seed]   ⚠ ${file}: unknown token: ${tokenId}`);
          }
        }
        if (theme.typography) {
          for (const [tokenId, value] of Object.entries(theme.typography)) {
            if (tokenIds.has(tokenId)) {
              insertColor.run(theme.id, tokenId, value);
            } else {
              console.warn(`[seed]   ⚠ ${file}: unknown typography token: ${tokenId}`);
            }
          }
        }
        const typoCount = theme.typography ? Object.keys(theme.typography).length : 0;
        console.log(`[seed]   ✓ ${theme.name} (${Object.keys(theme.colors).length} colors, ${typoCount} typography)`);
      }
    }
  }
  console.log("[seed] Setting defaults...");
  db2.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run("active_theme", "dark");
  const semanticDocsDir = join(dataDir, "../docs/semantics");
  if (existsSync(semanticDocsDir)) {
    seedSemanticDocs(db2, semanticDocsDir);
  }
  console.log("[seed] Complete.");
}
const __filename$2 = fileURLToPath(import.meta.url);
const __dirname$2 = path.dirname(__filename$2);
function deserializeAttr(row) {
  switch (row.type) {
    case "number":
      return row.number_value ?? 0;
    case "json":
      try {
        return row.json_value ? JSON.parse(row.json_value) : {};
      } catch {
        return {};
      }
    case "blob":
      return row.blob_value ?? new ArrayBuffer(0);
    default:
      return row.string_value ?? "";
  }
}
function serializeAttr(value, type) {
  return {
    string_value: type === "string" ? String(value) : null,
    number_value: type === "number" ? Number(value) : null,
    json_value: type === "json" ? JSON.stringify(value) : null,
    blob_value: type === "blob" ? Buffer.from(value) : null
  };
}
function inferAttrType(value) {
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) {
    if (value instanceof ArrayBuffer || Buffer.isBuffer(value)) return "blob";
    return "json";
  }
  return "string";
}
function deserializeStampAttr(value, type) {
  if (value === null) return "";
  const attrType = type || "string";
  switch (attrType) {
    case "number":
      return parseFloat(value) || 0;
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    default:
      return value;
  }
}
let database = null;
function getDb() {
  if (!database) {
    const dbPath = path.join(app.getPath("userData"), "visual.db");
    database = new Database(dbPath);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
  }
  return database;
}
const db = {
  init() {
    const db2 = getDb();
    const dataDir = app.isPackaged ? path.join(process.resourcesPath, "data") : path.join(__dirname$2, "../data");
    runMigrations(db2, dataDir);
    this.cards._initSchema();
    this.cards._seedExamples();
    seed(db2, dataDir);
  },
  // =========================================================================
  // Projects
  // =========================================================================
  projects: {
    list() {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM projects WHERE id != '_stamps' ORDER BY modified_at DESC").all();
    },
    get(id) {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM projects WHERE id = ?").get(id) || null;
    },
    create(name) {
      const db2 = getDb();
      const id = randomUUID();
      const now = Date.now();
      db2.prepare("INSERT INTO projects (id, name, created_at, modified_at) VALUES (?, ?, ?, ?)").run(id, name, now, now);
      db2.prepare("INSERT INTO ui_state (project_id) VALUES (?)").run(id);
      return { id, name, created_at: now, modified_at: now };
    },
    delete(id) {
      const db2 = getDb();
      db2.prepare("DELETE FROM projects WHERE id = ?").run(id);
    },
    touch(id) {
      const db2 = getDb();
      db2.prepare("UPDATE projects SET modified_at = ? WHERE id = ?").run(Date.now(), id);
    },
    update(id, data) {
      const db2 = getDb();
      const updates = [];
      const values = [];
      if (data.name !== void 0) {
        updates.push("name = ?");
        values.push(data.name);
      }
      if (updates.length > 0) {
        updates.push("modified_at = ?");
        values.push(Date.now());
        values.push(id);
        db2.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      }
      return this.get(id);
    }
  },
  // =========================================================================
  // Entities
  // =========================================================================
  entities: {
    list(projectId) {
      const db2 = getDb();
      const entities = db2.prepare("SELECT * FROM entities WHERE project_id = ?").all(projectId);
      const entityIds = entities.map((e) => e.id);
      if (entityIds.length === 0) return [];
      const placeholders = entityIds.map(() => "?").join(",");
      const attrRows = db2.prepare(
        `SELECT entity_id, key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id IN (${placeholders})`
      ).all(...entityIds);
      const attrsByEntity = {};
      for (const row of attrRows) {
        if (!attrsByEntity[row.entity_id]) attrsByEntity[row.entity_id] = {};
        attrsByEntity[row.entity_id][row.key] = deserializeAttr(row);
      }
      return entities.map((e) => ({
        ...e,
        attrs: {
          id: e.id,
          // Inject entity id into attrs
          ...attrsByEntity[e.id] || {}
        }
      }));
    },
    get(id) {
      const db2 = getDb();
      const entity = db2.prepare("SELECT * FROM entities WHERE id = ?").get(id);
      if (!entity) return null;
      const attrRows = db2.prepare(
        "SELECT key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id = ?"
      ).all(id);
      const attrs = { id: entity.id };
      for (const row of attrRows) {
        attrs[row.key] = deserializeAttr({ entity_id: id, ...row });
      }
      return { ...entity, attrs };
    },
    create(projectId) {
      const db2 = getDb();
      const id = randomUUID();
      const now = Date.now();
      db2.prepare("INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)").run(id, projectId, now, now);
      this._touchProject(projectId);
      return { id, project_id: projectId, created_at: now, modified_at: now };
    },
    /** Create entity with a specific ID (used for undo/restore) */
    createWithId(projectId, id, timestamps) {
      const db2 = getDb();
      const now = Date.now();
      const created_at = timestamps?.created_at ?? now;
      const modified_at = timestamps?.modified_at ?? now;
      db2.prepare("INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)").run(id, projectId, created_at, modified_at);
      this._touchProject(projectId);
      return { id, project_id: projectId, created_at, modified_at };
    },
    delete(id) {
      const db2 = getDb();
      const entity = db2.prepare("SELECT project_id FROM entities WHERE id = ?").get(id);
      if (entity) {
        db2.prepare("DELETE FROM entities WHERE id = ?").run(id);
        this._touchProject(entity.project_id);
      }
    },
    _touchProject(projectId) {
      const db2 = getDb();
      db2.prepare("UPDATE projects SET modified_at = ? WHERE id = ?").run(Date.now(), projectId);
    }
  },
  // =========================================================================
  // Stamps (dedicated table)
  // =========================================================================
  stamps: {
    /** List all stamps with optional filtering */
    list(filter) {
      const db2 = getDb();
      let sql = "SELECT * FROM stamps";
      const conditions = [];
      const params = [];
      if (filter?.kind) {
        conditions.push("kind = ?");
        params.push(filter.kind);
      }
      if (filter?.category) {
        conditions.push("category = ?");
        params.push(filter.category);
      }
      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY modified_at DESC";
      const stamps = db2.prepare(sql).all(...params);
      if (stamps.length === 0) return [];
      const stampIds = stamps.map((s) => s.id);
      const placeholders = stampIds.map(() => "?").join(",");
      const attrRows = db2.prepare(
        `SELECT stamp_id, key, value, type FROM stamp_attrs WHERE stamp_id IN (${placeholders})`
      ).all(...stampIds);
      const attrsByStamp = {};
      for (const row of attrRows) {
        if (!attrsByStamp[row.stamp_id]) attrsByStamp[row.stamp_id] = {};
        if (row.value !== null) attrsByStamp[row.stamp_id][row.key] = deserializeStampAttr(row.value, row.type);
      }
      return stamps.map((s) => ({
        ...s,
        kind: s.kind,
        attrs: attrsByStamp[s.id] || {}
      }));
    },
    /** Get a stamp with all its members and relationships */
    get(id) {
      const db2 = getDb();
      const stamp = db2.prepare("SELECT * FROM stamps WHERE id = ?").get(id);
      if (!stamp) return null;
      const attrRows = db2.prepare("SELECT key, value, type FROM stamp_attrs WHERE stamp_id = ?").all(id);
      const attrs = {};
      for (const row of attrRows) {
        if (row.value !== null) attrs[row.key] = deserializeStampAttr(row.value, row.type);
      }
      const members = db2.prepare("SELECT * FROM stamp_members WHERE stamp_id = ?").all(id);
      const memberIds = members.map((m) => m.id);
      const memberAttrs = {};
      if (memberIds.length > 0) {
        const placeholders = memberIds.map(() => "?").join(",");
        const memberAttrRows = db2.prepare(
          `SELECT member_id, key, value, type FROM stamp_member_attrs WHERE member_id IN (${placeholders})`
        ).all(...memberIds);
        for (const row of memberAttrRows) {
          if (!memberAttrs[row.member_id]) memberAttrs[row.member_id] = {};
          if (row.value !== null) memberAttrs[row.member_id][row.key] = deserializeStampAttr(row.value, row.type);
        }
      }
      const relationships = db2.prepare("SELECT * FROM stamp_relationships WHERE stamp_id = ?").all(id);
      return {
        ...stamp,
        kind: stamp.kind,
        attrs,
        members: members.map((m) => ({
          ...m,
          attrs: memberAttrs[m.id] || {}
        })),
        relationships
      };
    },
    /** Create a stamp, optionally from an existing entity */
    create(data) {
      const db2 = getDb();
      const now = Date.now();
      const stampId = randomUUID();
      const kind = data.kind || "template";
      const transaction = db2.transaction(() => {
        db2.prepare(`
          INSERT INTO stamps (id, name, description, category, kind, created_at, modified_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(stampId, data.name, data.description || null, data.category || null, kind, now, now);
        if (data.sourceEntityId) {
          const sourceEntity = db2.prepare("SELECT project_id FROM entities WHERE id = ?").get(data.sourceEntityId);
          if (!sourceEntity) throw new Error("Source entity not found");
          const attrs = db2.prepare(
            "SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?"
          ).all(data.sourceEntityId);
          const excludeKeysRoot = /* @__PURE__ */ new Set(["x", "y", "name"]);
          const excludeKeysMember = /* @__PURE__ */ new Set(["x", "y"]);
          const attrStmt = db2.prepare("INSERT INTO stamp_attrs (stamp_id, key, value, type) VALUES (?, ?, ?, ?)");
          for (const attr of attrs) {
            let stringValue = null;
            if (attr.type === "string") stringValue = attr.string_value;
            else if (attr.type === "number" && attr.number_value !== null) stringValue = String(attr.number_value);
            else if (attr.type === "json") stringValue = attr.json_value;
            if (!excludeKeysRoot.has(attr.key) && stringValue !== null) {
              attrStmt.run(stampId, attr.key, stringValue, attr.type);
            }
          }
          const localIdMap = /* @__PURE__ */ new Map();
          localIdMap.set(data.sourceEntityId, "root");
          const getChildren = (entityId) => {
            return db2.prepare(`
              SELECT to_entity FROM relationships
              WHERE from_entity = ? AND project_id = ? AND kind = 'contains'
            `).all(entityId, sourceEntity.project_id);
          };
          const copyMember = (entityId, _parentLocalId) => {
            const memberId = randomUUID();
            const localId = `member_${localIdMap.size}`;
            localIdMap.set(entityId, localId);
            db2.prepare("INSERT INTO stamp_members (id, stamp_id, local_id) VALUES (?, ?, ?)").run(memberId, stampId, localId);
            const memberAttrs = db2.prepare(
              "SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?"
            ).all(entityId);
            const memberAttrStmt = db2.prepare("INSERT INTO stamp_member_attrs (member_id, key, value, type) VALUES (?, ?, ?, ?)");
            for (const attr of memberAttrs) {
              let stringValue = null;
              if (attr.type === "string") stringValue = attr.string_value;
              else if (attr.type === "number" && attr.number_value !== null) stringValue = String(attr.number_value);
              else if (attr.type === "json") stringValue = attr.json_value;
              if (!excludeKeysMember.has(attr.key) && stringValue !== null) {
                memberAttrStmt.run(memberId, attr.key, stringValue, attr.type);
              }
            }
            for (const child of getChildren(entityId)) {
              copyMember(child.to_entity);
            }
          };
          for (const child of getChildren(data.sourceEntityId)) {
            copyMember(child.to_entity);
          }
          const allSourceIds = Array.from(localIdMap.keys());
          if (allSourceIds.length > 1) {
            const placeholders = allSourceIds.map(() => "?").join(",");
            const relationships = db2.prepare(`
              SELECT from_entity, to_entity, kind, label, binding_name, from_port, to_port
              FROM relationships
              WHERE project_id = ? AND from_entity IN (${placeholders}) AND to_entity IN (${placeholders})
            `).all(sourceEntity.project_id, ...allSourceIds, ...allSourceIds);
            const relStmt = db2.prepare(`
              INSERT INTO stamp_relationships (id, stamp_id, from_local_id, to_local_id, kind, label, binding_name, from_port, to_port)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const rel of relationships) {
              const fromLocalId = localIdMap.get(rel.from_entity);
              const toLocalId = localIdMap.get(rel.to_entity);
              if (fromLocalId && toLocalId) {
                const fromId = fromLocalId === "root" ? null : fromLocalId;
                const toId = toLocalId === "root" ? null : toLocalId;
                relStmt.run(randomUUID(), stampId, fromId, toId, rel.kind, rel.label, rel.binding_name, rel.from_port, rel.to_port);
              }
            }
          }
        }
        return stampId;
      });
      return transaction();
    },
    /** Apply stamp to target entity - copies attrs and creates children */
    apply(stampId, targetEntityId) {
      const db2 = getDb();
      const now = Date.now();
      const targetEntity = db2.prepare("SELECT project_id FROM entities WHERE id = ?").get(targetEntityId);
      if (!targetEntity) throw new Error("Target entity not found");
      const stamp = this.get(stampId);
      if (!stamp) throw new Error("Stamp not found");
      const previousAttrs = {};
      const currentAttrRows = db2.prepare(
        "SELECT key, type, string_value, number_value, json_value FROM attrs WHERE entity_id = ?"
      ).all(targetEntityId);
      for (const row of currentAttrRows) {
        previousAttrs[row.key] = deserializeAttr({ entity_id: targetEntityId, blob_value: null, ...row });
      }
      const createdEntityIds = [];
      const createdRelationshipIds = [];
      const appliedAttrs = { ...stamp.attrs };
      const localToEntityId = /* @__PURE__ */ new Map();
      localToEntityId.set(null, targetEntityId);
      const transaction = db2.transaction(() => {
        const attrStmt = db2.prepare(`
          INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [key, value] of Object.entries(stamp.attrs)) {
          const attrType = inferAttrType(value);
          const serialized = serializeAttr(value, attrType);
          attrStmt.run(targetEntityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value);
        }
        for (const member of stamp.members) {
          const newId = randomUUID();
          localToEntityId.set(member.local_id, newId);
          createdEntityIds.push(newId);
          db2.prepare("INSERT INTO entities (id, project_id, created_at, modified_at) VALUES (?, ?, ?, ?)").run(newId, targetEntity.project_id, now, now);
          for (const [key, value] of Object.entries(member.attrs)) {
            const attrType = inferAttrType(value);
            const serialized = serializeAttr(value, attrType);
            attrStmt.run(newId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value);
          }
        }
        const relStmt = db2.prepare(`
          INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const rel of stamp.relationships) {
          const fromId = localToEntityId.get(rel.from_local_id);
          const toId = localToEntityId.get(rel.to_local_id);
          if (fromId && toId) {
            const relId = randomUUID();
            relStmt.run(relId, targetEntity.project_id, fromId, toId, rel.kind, rel.label || null, rel.binding_name || null, rel.from_port || null, rel.to_port || null);
            createdRelationshipIds.push(relId);
          }
        }
        db2.prepare("INSERT OR REPLACE INTO entity_stamps (entity_id, stamp_id, applied_at) VALUES (?, ?, ?)").run(targetEntityId, stampId, now);
        db2.prepare("UPDATE entities SET modified_at = ? WHERE id = ?").run(now, targetEntityId);
      });
      transaction();
      return { createdEntityIds, createdRelationshipIds, appliedAttrs, previousAttrs };
    },
    /** Update stamp metadata */
    update(id, data) {
      const db2 = getDb();
      const updates = [];
      const values = [];
      for (const [key, value] of Object.entries(data)) {
        if (value !== void 0) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (updates.length > 0) {
        updates.push("modified_at = ?");
        values.push(Date.now());
        values.push(id);
        db2.prepare(`UPDATE stamps SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      }
    },
    /** Delete a stamp */
    delete(stampId) {
      const db2 = getDb();
      const transaction = db2.transaction(() => {
        const result = db2.prepare("DELETE FROM stamps WHERE id = ?").run(stampId);
        db2.prepare("DELETE FROM attrs WHERE entity_id = ?").run(stampId);
        db2.prepare("DELETE FROM entities WHERE id = ? AND project_id = ?").run(stampId, "_stamps");
        return { deleted: result.changes > 0 };
      });
      return transaction();
    }
  },
  // =========================================================================
  // Attrs
  // =========================================================================
  attrs: {
    get(entityId) {
      const db2 = getDb();
      const rows = db2.prepare(
        "SELECT key, type, string_value, number_value, json_value, blob_value FROM attrs WHERE entity_id = ?"
      ).all(entityId);
      const attrs = {};
      for (const row of rows) {
        attrs[row.key] = deserializeAttr({ entity_id: entityId, ...row });
      }
      return attrs;
    },
    set(entityId, key, value, type) {
      const db2 = getDb();
      const attrType = type ?? inferAttrType(value);
      const serialized = serializeAttr(value, attrType);
      db2.prepare(`
        INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(entityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value);
      db2.prepare("UPDATE entities SET modified_at = ? WHERE id = ?").run(Date.now(), entityId);
    },
    delete(entityId, key) {
      const db2 = getDb();
      db2.prepare("DELETE FROM attrs WHERE entity_id = ? AND key = ?").run(entityId, key);
      db2.prepare("UPDATE entities SET modified_at = ? WHERE id = ?").run(Date.now(), entityId);
    },
    setBatch(entityId, attrs, types) {
      const db2 = getDb();
      const stmt = db2.prepare(`
        INSERT OR REPLACE INTO attrs (entity_id, key, type, string_value, number_value, json_value, blob_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const transaction = db2.transaction(() => {
        for (const [key, value] of Object.entries(attrs)) {
          const attrType = types?.[key] ?? inferAttrType(value);
          const serialized = serializeAttr(value, attrType);
          stmt.run(entityId, key, attrType, serialized.string_value, serialized.number_value, serialized.json_value, serialized.blob_value);
        }
        db2.prepare("UPDATE entities SET modified_at = ? WHERE id = ?").run(Date.now(), entityId);
      });
      transaction();
    }
  },
  // =========================================================================
  // Relationships
  // =========================================================================
  relationships: {
    list(projectId) {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM relationships WHERE project_id = ?").all(projectId);
    },
    create(projectId, data) {
      const db2 = getDb();
      const id = randomUUID();
      const { from_entity, to_entity, kind, label = null, binding_name = null, from_port = null, to_port = null } = data;
      db2.prepare(`
        INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port);
      this._touchProject(projectId);
      return { id, project_id: projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port };
    },
    /** Create relationship with a specific ID (used for undo/restore) */
    createWithId(projectId, id, data) {
      const db2 = getDb();
      const { from_entity, to_entity, kind, label = null, binding_name = null, from_port = null, to_port = null } = data;
      db2.prepare(`
        INSERT INTO relationships (id, project_id, from_entity, to_entity, kind, label, binding_name, from_port, to_port)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port);
      this._touchProject(projectId);
      return { id, project_id: projectId, from_entity, to_entity, kind, label, binding_name, from_port, to_port };
    },
    /** Get a relationship by ID */
    get(id) {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM relationships WHERE id = ?").get(id);
    },
    delete(id) {
      const db2 = getDb();
      const rel = db2.prepare("SELECT project_id FROM relationships WHERE id = ?").get(id);
      if (rel) {
        db2.prepare("DELETE FROM relationships WHERE id = ?").run(id);
        this._touchProject(rel.project_id);
      }
    },
    _touchProject(projectId) {
      const db2 = getDb();
      db2.prepare("UPDATE projects SET modified_at = ? WHERE id = ?").run(Date.now(), projectId);
    }
  },
  // =========================================================================
  // UI State
  // =========================================================================
  uiState: {
    get(projectId) {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM ui_state WHERE project_id = ?").get(projectId) || {
        project_id: projectId,
        viewport_x: 0,
        viewport_y: 0,
        viewport_zoom: 1,
        selected_entity: null
      };
    },
    update(projectId, data) {
      const db2 = getDb();
      const updates = [];
      const values = [];
      for (const [key, value] of Object.entries(data)) {
        if (value !== void 0) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (updates.length > 0) {
        values.push(projectId);
        db2.prepare(`UPDATE ui_state SET ${updates.join(", ")} WHERE project_id = ?`).run(...values);
      }
      return this.get(projectId);
    }
  },
  // =========================================================================
  // Themes
  // =========================================================================
  themes: {
    list() {
      const db2 = getDb();
      return db2.prepare("SELECT id, name, description, author, is_system FROM themes ORDER BY name").all();
    },
    get(id) {
      const db2 = getDb();
      const theme = db2.prepare("SELECT id, name, description, author, is_system FROM themes WHERE id = ?").get(id);
      if (!theme) return null;
      const valueRows = db2.prepare("SELECT token_id, value FROM theme_colors WHERE theme_id = ?").all(id);
      const colors = {};
      const typography = {};
      for (const row of valueRows) {
        if (row.token_id.startsWith("font-")) {
          typography[row.token_id] = row.value;
        } else {
          colors[row.token_id] = row.value;
        }
      }
      return {
        ...theme,
        isSystem: theme.is_system === 1,
        colors,
        typography
      };
    },
    create(name, basedOn) {
      const db2 = getDb();
      const id = randomUUID();
      db2.prepare("INSERT INTO themes (id, name, description, author, is_system) VALUES (?, ?, ?, ?, 0)").run(id, name, "", "user");
      const sourceThemeId = basedOn || "dark";
      db2.prepare(`
        INSERT INTO theme_colors (theme_id, token_id, value)
        SELECT ?, token_id, value FROM theme_colors WHERE theme_id = ?
      `).run(id, sourceThemeId);
      return this.get(id);
    },
    updateColor(themeId, tokenId, value) {
      const db2 = getDb();
      db2.prepare(`
        INSERT OR REPLACE INTO theme_colors (theme_id, token_id, value)
        VALUES (?, ?, ?)
      `).run(themeId, tokenId, value);
      db2.prepare("UPDATE themes SET modified_at = ? WHERE id = ?").run(Date.now(), themeId);
    },
    delete(id) {
      const db2 = getDb();
      const theme = db2.prepare("SELECT is_system FROM themes WHERE id = ?").get(id);
      if (theme && theme.is_system === 0) {
        db2.prepare("DELETE FROM themes WHERE id = ?").run(id);
      }
    },
    getTokens() {
      const db2 = getDb();
      return db2.prepare("SELECT id, category, label, description FROM token_definitions ORDER BY category, id").all();
    }
  },
  // =========================================================================
  // Settings
  // =========================================================================
  settings: {
    get(key) {
      const db2 = getDb();
      const result = db2.prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return result?.value || null;
    },
    set(key, value) {
      const db2 = getDb();
      db2.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    }
  },
  // =========================================================================
  // Semantic Docs
  // =========================================================================
  semanticDocs: {
    get(id) {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM semantic_docs WHERE id = ?").get(id);
    },
    list() {
      const db2 = getDb();
      return db2.prepare("SELECT * FROM semantic_docs").all();
    }
  },
  // =========================================================================
  // Cards (Borth source code units)
  // =========================================================================
  cards: {
    /** Initialize card tables (called from db.init) */
    _initSchema() {
      const db2 = getDb();
      db2.exec(`
        CREATE TABLE IF NOT EXISTS card_sets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      db2.exec(`
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          set_id TEXT REFERENCES card_sets(id),
          head_version INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `);
      db2.exec(`
        CREATE TABLE IF NOT EXISTS card_versions (
          card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          source TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (card_id, version)
        )
      `);
    },
    /** Seed example card sets (idempotent - only runs if no sets exist) */
    _seedExamples() {
      const db2 = getDb();
      const existing = db2.prepare("SELECT COUNT(*) as count FROM card_sets").get();
      if (existing.count > 0) return;
      const exampleSets = [
        {
          name: "Core Basics",
          cards: [
            `( Square a number )
: square dup * ;
( 5 square -> 25 )`,
            `( Even/Odd predicates )
: is-even 2 mod 0 = ;
: is-odd is-even not ;`,
            `( Factorial - recursive )
: factorial
  dup 1 <= if drop 1 exit then
  dup 1 - factorial * ;`,
            `( Fibonacci sequence )
: fib
  dup 1 <= if exit then
  dup 1 - fib swap 2 - fib + ;`,
            `( Max and Min of two values )
: max 2dup < if swap then drop ;
: min 2dup > if swap then drop ;`
          ]
        },
        {
          name: "Collections",
          cards: [
            `( Sum and Product of a list )
: sum 0 swap [ + ] fold ;
: product 1 swap [ * ] fold ;`,
            `( List transformations )
: double-all [ 2 * ] map ;
: square-all [ dup * ] map ;`,
            `( Filtering lists )
: evens [ 2 mod 0 = ] filter ;
: positives [ 0 > ] filter ;`,
            `( Find and Count helpers )
: contains swap [ = ] each-while not ;
: count-if 0 swap rot [ swap 1 + swap ] when each drop ;`
          ]
        },
        {
          name: "Graph Patterns",
          cards: [
            `( Create a social network graph )
in: social ; using: graph ;

variable g  g <graph> .write
variable alice  variable bob

alice g .read [ " Alice" ] [ ' name ] structure .add-node .write
bob g .read [ " Bob" ] [ ' name ] structure .add-node .write`,
            `( Connection helpers )
in: social ; using: graph ;

: follow swap .read swap .read " follows" .connect drop ;
: followers .incoming [ ' name .prop ] map ;
: following .outgoing [ ' name .prop ] map ;`,
            `( Graph traversal )
in: social ; using: graph ;

: print-network
  .read [ ' name .prop . ] .traverse ;`
          ]
        },
        {
          name: "UI Behaviors",
          cards: [
            `( Counter component )
in: ui ;

: counter/render
  self ' count .prop self .set-label ;

: counter/click
  self ' count .prop 1 + self ' count .prop! ;`,
            `( Toggle component )
in: ui ;

: toggle/render
  self ' active .prop
  if " ON" else " OFF" then
  self .set-label ;

: toggle/click
  self ' active .prop not self ' active .prop! ;`,
            `( Timer display component )
in: ui ;

: timer/render
  self ' seconds .prop
  " Time: " swap concat self .set-label ;

: timer/tick
  self ' seconds .prop 1 + self ' seconds .prop! ;`
          ]
        },
        {
          name: "Commands",
          cards: [
            `( Hello Command )
: hello ' success " Hello from Borth!" toast ;
cmd
doc{ Displays a friendly greeting }
key: C-h`,
            `( Save Command )
: save-all ' info " Saving..." toast ;
cmd
doc{ Save all open files }
key: C-x C-s
category: file`,
            `( Toggle Theme Command )
: toggle-theme
  current-theme " dark" =
  if " light" else " dark" then
  set-theme ;
cmd
doc{ Switch between light and dark themes }
key: C-t`
          ]
        }
      ];
      for (const set of exampleSets) {
        const setResult = this.createSet(set.name);
        for (const source of set.cards) {
          this.createCard(setResult.id, source);
        }
      }
    },
    // --- Set operations ---
    listSets() {
      const db2 = getDb();
      return db2.prepare("SELECT id, name, created_at FROM card_sets ORDER BY created_at DESC").all();
    },
    getSet(id) {
      const db2 = getDb();
      return db2.prepare("SELECT id, name, created_at FROM card_sets WHERE id = ?").get(id);
    },
    createSet(name) {
      const db2 = getDb();
      const id = randomUUID();
      const now = Date.now();
      db2.prepare("INSERT INTO card_sets (id, name, created_at) VALUES (?, ?, ?)").run(id, name, now);
      return { id, name, created_at: now };
    },
    deleteSet(id) {
      const db2 = getDb();
      db2.prepare("UPDATE cards SET set_id = NULL WHERE set_id = ?").run(id);
      db2.prepare("DELETE FROM card_sets WHERE id = ?").run(id);
    },
    getSetCardCount(setId) {
      const db2 = getDb();
      const result = db2.prepare("SELECT COUNT(*) as count FROM cards WHERE set_id = ?").get(setId);
      return result.count;
    },
    // --- Card operations ---
    listCards() {
      const db2 = getDb();
      return db2.prepare(`
        SELECT c.id, c.set_id, c.head_version, c.created_at, v.source
        FROM cards c
        JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
        ORDER BY c.created_at DESC
      `).all();
    },
    getSetCards(setId) {
      const db2 = getDb();
      return db2.prepare(`
        SELECT c.id, c.set_id, c.head_version, c.created_at, v.source
        FROM cards c
        JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
        WHERE c.set_id = ?
        ORDER BY c.created_at
      `).all(setId);
    },
    getCard(id) {
      const db2 = getDb();
      const card = db2.prepare("SELECT id, set_id, head_version, created_at FROM cards WHERE id = ?").get(id);
      return card;
    },
    getCardWithSource(id) {
      const db2 = getDb();
      return db2.prepare(`
        SELECT c.id, c.set_id, c.head_version, c.created_at, v.source
        FROM cards c
        JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
        WHERE c.id = ?
      `).get(id);
    },
    getCardSource(id) {
      const db2 = getDb();
      const result = db2.prepare(`
        SELECT v.source FROM cards c
        JOIN card_versions v ON c.id = v.card_id AND c.head_version = v.version
        WHERE c.id = ?
      `).get(id);
      return result?.source ?? null;
    },
    createCard(setId, source) {
      const db2 = getDb();
      const id = randomUUID();
      const now = Date.now();
      db2.prepare("INSERT INTO cards (id, set_id, head_version, created_at) VALUES (?, ?, 0, ?)").run(id, setId, now);
      db2.prepare("INSERT INTO card_versions (card_id, version, source, created_at) VALUES (?, 0, ?, ?)").run(id, source, now);
      return { id, set_id: setId, head_version: 0, created_at: now, source };
    },
    editCard(id, newSource) {
      const db2 = getDb();
      const card = db2.prepare("SELECT head_version FROM cards WHERE id = ?").get(id);
      if (!card) throw new Error(`Card not found: ${id}`);
      const newVersion = card.head_version + 1;
      const now = Date.now();
      db2.prepare("INSERT INTO card_versions (card_id, version, source, created_at) VALUES (?, ?, ?, ?)").run(id, newVersion, newSource, now);
      db2.prepare("UPDATE cards SET head_version = ? WHERE id = ?").run(newVersion, id);
      return newVersion;
    },
    deleteCard(id) {
      const db2 = getDb();
      db2.prepare("DELETE FROM cards WHERE id = ?").run(id);
    },
    moveCard(cardId, newSetId) {
      const db2 = getDb();
      db2.prepare("UPDATE cards SET set_id = ? WHERE id = ?").run(newSetId, cardId);
    }
  },
  // =========================================================================
  // Raw Query Support (parameterized for safety)
  // =========================================================================
  query: {
    all(sql, params = []) {
      const db2 = getDb();
      return db2.prepare(sql).all(...params);
    },
    run(sql, params = []) {
      const db2 = getDb();
      return db2.prepare(sql).run(...params);
    },
    get(sql, params = []) {
      const db2 = getDb();
      return db2.prepare(sql).get(...params);
    }
  }
};
let fontCache = null;
async function listSystemFonts() {
  if (!fontCache) {
    const fonts = await getFonts();
    fontCache = fonts.map((f) => f.replace(/^["']|["']$/g, "")).sort();
  }
  return fontCache;
}
function searchFonts(fonts, query) {
  if (!query.trim()) return fonts;
  const q = query.toLowerCase();
  return fonts.filter((f) => f.toLowerCase().includes(q));
}
const isMac$1 = process.platform === "darwin";
function createApplicationMenu(callbacks, recentProjects = []) {
  const recentProjectsSubmenu = recentProjects.length > 0 ? [
    ...recentProjects.slice(0, 10).map((project, index) => ({
      label: project.name || "Untitled Project",
      accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : void 0,
      click: () => callbacks.openProjectById(project.id)
    })),
    { type: "separator" },
    {
      label: "Clear Recent Projects",
      enabled: recentProjects.length > 0,
      click: callbacks.openProject
      // Just go to project list
    }
  ] : [{ label: "No Recent Projects", enabled: false }];
  const template = [
    // App menu (macOS only)
    ...isMac$1 ? [
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          {
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: callbacks.showSettings
          },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: callbacks.createProject
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: callbacks.openProject
        },
        { type: "separator" },
        {
          label: "Recent Projects",
          submenu: recentProjectsSubmenu
        },
        { type: "separator" },
        {
          label: "Export...",
          accelerator: "CmdOrCtrl+Shift+E",
          click: callbacks.exportProject
        },
        { type: "separator" },
        isMac$1 ? { role: "close" } : { role: "quit" }
      ]
    },
    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...isMac$1 ? [
          { role: "pasteAndMatchStyle" },
          { role: "delete" },
          { role: "selectAll" },
          { type: "separator" },
          {
            label: "Speech",
            submenu: [
              { role: "startSpeaking" },
              { role: "stopSpeaking" }
            ]
          }
        ] : [
          { role: "delete" },
          { type: "separator" },
          { role: "selectAll" }
        ]
      ]
    },
    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...isMac$1 ? [
          { type: "separator" },
          { role: "front" },
          { type: "separator" },
          { role: "window" }
        ] : [{ role: "close" }]
      ]
    },
    // Help menu
    {
      role: "help",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://github.com/bassline-org/bassline");
          }
        },
        {
          label: "Report Issue",
          click: async () => {
            await shell.openExternal("https://github.com/bassline-org/bassline/issues");
          }
        },
        { type: "separator" },
        {
          label: "View License",
          click: async () => {
            await shell.openExternal("https://github.com/bassline-org/bassline/blob/main/LICENSE");
          }
        }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}
function createDockMenu(callbacks, recentProjects = []) {
  const recentItems = recentProjects.slice(0, 5).map((project) => ({
    label: project.name || "Untitled Project",
    click: () => callbacks.openProjectById(project.id)
  }));
  return Menu.buildFromTemplate([
    {
      label: "New Project",
      click: callbacks.createProject
    },
    {
      label: "Open Project...",
      click: callbacks.openProject
    },
    ...recentItems.length > 0 ? [
      { type: "separator" },
      { label: "Recent Projects", enabled: false },
      ...recentItems
    ] : []
  ]);
}
const BASSLINE_TYPE = /* @__PURE__ */ Symbol("$BASSLINE_TYPE");
const JS_TYPES = {
  arr: "js/arr",
  obj: "js/obj",
  str: "js/str",
  num: "js/num",
  bigInt: "js/bigInt",
  null: "js/null",
  undefined: "js/undefined",
  bool: "js/boolean",
  fn: "js/function",
  sym: "js/symbol",
  error: "js/error"
};
const typed = (type, headers, body = null) => ({
  headers: { ...headers, type },
  body
});
const notFound = () => typed(JS_TYPES.error, { condition: "not-found" }, null);
const safe = (handler) => async (h, b) => {
  try {
    return await handler(h, b);
  } catch (e) {
    h?.kit?.put?.(
      { type: JS_TYPES.error, path: "/condition" },
      {
        error: e.message,
        stack: e.stack,
        context: { path: h?.path, params: h?.params }
      }
    ).catch(() => {
    });
    return { headers: { type: JS_TYPES.error, condition: "error" }, body: { error: e.message } };
  }
};
const detectType = (value) => {
  if (Array.isArray(value)) return JS_TYPES.arr;
  switch (typeof value) {
    case "number":
      return JS_TYPES.num;
    case "boolean":
      return JS_TYPES.bool;
    case "bigint":
      return JS_TYPES.bigInt;
    case "function":
      return JS_TYPES.fn;
    case "symbol":
      return JS_TYPES.sym;
    case "string":
      return JS_TYPES.str;
    case "undefined":
      return JS_TYPES.undefined;
    case "object": {
      if (value === null) return JS_TYPES.null;
      if (value instanceof Error) return JS_TYPES.error;
      if (value[BASSLINE_TYPE]) return value[BASSLINE_TYPE];
      return JS_TYPES.obj;
    }
  }
};
const resource = ({ get = notFound, put = notFound } = {}) => ({
  get: safe(get),
  put: safe(async (headers, body) => {
    if (!headers?.type) {
      headers.type = detectType(body);
    }
    return await put(headers, body);
  })
});
const splitPath = (path2) => {
  const [segment, ...rest] = (path2 ?? "/").split("/").filter(Boolean);
  return [segment, rest.length ? "/" + rest.join("/") : "/"];
};
const pathRoot = (headers) => {
  const [segment, remaining] = splitPath(headers.path);
  return [segment, { ...headers, path: remaining }];
};
const disp = (map, dispatchFn) => async (method, headers, body) => {
  const [key, rest] = await dispatchFn(headers);
  const target = map[key ?? ""] ?? map.unknown;
  if (!target) return notFound();
  const isUnknown = map[key] === void 0 && map.unknown !== void 0;
  if (isUnknown) {
    return target[method]?.(headers, body) ?? notFound();
  }
  return target[method]?.(rest, body) ?? notFound();
};
function routes(map, dispatchFn = pathRoot) {
  const dispatch = disp(map, dispatchFn);
  return resource({
    get: (h) => dispatch("get", h),
    put: (h, b) => dispatch("put", h, b)
  });
}
const bind = (name, target) => {
  const next = (h) => {
    const [segment, remaining] = splitPath(h.path);
    return { ...h, path: remaining, params: { ...h.params, [name]: segment } };
  };
  return resource({
    get: (h) => target.get(next(h)),
    put: (h, b) => target.put(next(h), b)
  });
};
function isCompound(entry) {
  return "operations" in entry;
}
const MAX_STACK = 100;
function createHistory() {
  const undoStack = [];
  const redoStack = [];
  let batchOperations = null;
  return routes({
    // GET /history - get undo/redo state
    "": resource({
      get: async () => ({
        headers: {},
        body: {
          canUndo: undoStack.length > 0,
          canRedo: redoStack.length > 0,
          undoCount: undoStack.length,
          redoCount: redoStack.length,
          inBatch: batchOperations !== null
        }
      })
    }),
    // PUT /history/push - record an undoable operation
    push: resource({
      put: async (_h, entry) => {
        if (batchOperations !== null) {
          batchOperations.push(entry);
          return { headers: {}, body: { pushed: true, batched: true } };
        }
        undoStack.push(entry);
        if (undoStack.length > MAX_STACK) {
          undoStack.shift();
        }
        redoStack.length = 0;
        return { headers: {}, body: { pushed: true } };
      }
    }),
    // PUT /history/beginBatch - start collecting operations into a batch
    beginBatch: resource({
      put: async () => {
        if (batchOperations !== null) {
          return { headers: { condition: "already-batching" }, body: null };
        }
        batchOperations = [];
        return { headers: {}, body: { started: true } };
      }
    }),
    // PUT /history/endBatch - finalize batch as single undo step
    endBatch: resource({
      put: async () => {
        if (batchOperations === null) {
          return { headers: { condition: "not-batching" }, body: null };
        }
        const operations = batchOperations;
        batchOperations = null;
        if (operations.length === 0) {
          return { headers: {}, body: { ended: true, operationCount: 0 } };
        }
        if (operations.length === 1) {
          undoStack.push(operations[0]);
        } else {
          undoStack.push({ operations });
        }
        if (undoStack.length > MAX_STACK) {
          undoStack.shift();
        }
        redoStack.length = 0;
        return { headers: {}, body: { ended: true, operationCount: operations.length } };
      }
    }),
    // PUT /history/cancelBatch - discard batch without pushing
    cancelBatch: resource({
      put: async () => {
        if (batchOperations === null) {
          return { headers: { condition: "not-batching" }, body: null };
        }
        const count = batchOperations.length;
        batchOperations = null;
        return { headers: {}, body: { cancelled: true, discardedCount: count } };
      }
    }),
    // PUT /history/undo - undo last operation
    undo: resource({
      put: async (h) => {
        const entry = undoStack.pop();
        if (!entry) {
          return { headers: { condition: "empty" }, body: null };
        }
        if (h.kit) {
          if (isCompound(entry)) {
            for (let i = entry.operations.length - 1; i >= 0; i--) {
              const op = entry.operations[i];
              await h.kit.put({ path: op.backward.path, skipHistory: true }, op.backward.body);
            }
          } else {
            await h.kit.put({ path: entry.backward.path, skipHistory: true }, entry.backward.body);
          }
        }
        redoStack.push(entry);
        return { headers: {}, body: { undone: true } };
      }
    }),
    // PUT /history/redo - redo last undone operation
    redo: resource({
      put: async (h) => {
        const entry = redoStack.pop();
        if (!entry) {
          return { headers: { condition: "empty" }, body: null };
        }
        if (h.kit) {
          if (isCompound(entry)) {
            for (const op of entry.operations) {
              await h.kit.put({ path: op.forward.path, skipHistory: true }, op.forward.body);
            }
          } else {
            await h.kit.put({ path: entry.forward.path, skipHistory: true }, entry.forward.body);
          }
        }
        undoStack.push(entry);
        return { headers: {}, body: { redone: true } };
      }
    }),
    // PUT /history/clear - clear all history
    clear: resource({
      put: async () => {
        undoStack.length = 0;
        redoStack.length = 0;
        return { headers: {}, body: { cleared: true } };
      }
    })
  });
}
function createProjectsResource(db2) {
  return routes({
    // GET /projects - list all projects
    // PUT /projects - create new project
    "": resource({
      get: async () => ({
        headers: { type: "js/arr" },
        body: db2.projects.list()
      }),
      put: async (_h, body) => {
        const project = db2.projects.create(body?.name || "Untitled Project");
        return { headers: { created: true }, body: project };
      }
    }),
    // GET /projects/:id - get project
    // PUT /projects/:id with null body - delete project
    unknown: bind("projectId", resource({
      get: async (h) => {
        const project = db2.projects.get(h.params?.projectId || "");
        if (!project) {
          return { headers: { condition: "not-found" }, body: null };
        }
        return { headers: {}, body: project };
      },
      put: async (h, body) => {
        const projectId = h.params?.projectId || "";
        if (body === null) {
          db2.projects.delete(projectId);
          return { headers: { deleted: true }, body: null };
        }
        if (body && typeof body === "object") {
          const data = body;
          const updated = db2.projects.update(projectId, data);
          return { headers: { updated: true }, body: updated };
        }
        return { headers: { condition: "not-implemented" }, body: null };
      }
    }))
  });
}
function createEntitiesResource(db2) {
  const createAttrsResource = (projectId, entityId) => routes({
    // GET /attrs - get all attrs
    // PUT /attrs - batch set attrs
    "": resource({
      get: async () => ({
        headers: { type: "js/obj" },
        body: db2.attrs.get(entityId)
      }),
      put: async (h, body) => {
        const prev = db2.attrs.get(entityId);
        db2.attrs.setBatch(entityId, body);
        if (h.kit && !h.skipHistory) {
          await h.kit.put(
            { path: "/history/push" },
            {
              forward: {
                path: `/projects/${projectId}/entities/${entityId}/attrs`,
                body
              },
              backward: {
                path: `/projects/${projectId}/entities/${entityId}/attrs`,
                body: prev
              }
            }
          );
        }
        return { headers: {}, body };
      }
    }),
    // GET/PUT/DELETE /attrs/:key - single attr
    unknown: bind("key", resource({
      get: async (h) => {
        const key = h.params?.key || "";
        const attrs = db2.attrs.get(entityId);
        const value = attrs[key];
        if (value === void 0) {
          return { headers: { condition: "not-found" }, body: null };
        }
        return { headers: {}, body: value };
      },
      put: async (h, body) => {
        const key = h.params?.key || "";
        const attrs = db2.attrs.get(entityId);
        const prev = attrs[key];
        const hadValue = key in attrs;
        if (body === null) {
          db2.attrs.delete(entityId, key);
          if (h.kit && hadValue && !h.skipHistory) {
            await h.kit.put(
              { path: "/history/push" },
              {
                forward: {
                  path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                  body: null
                },
                backward: {
                  path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                  body: prev
                }
              }
            );
          }
        } else {
          let value;
          let type;
          if (body && typeof body === "object" && "value" in body) {
            const typed2 = body;
            value = typed2.value;
            type = typed2.type;
          } else {
            value = body;
          }
          db2.attrs.set(entityId, key, value, type);
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: "/history/push" },
              {
                forward: {
                  path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                  body
                },
                backward: hadValue ? {
                  path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                  body: prev
                } : {
                  path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                  body: null
                }
              }
            );
          }
        }
        return { headers: {}, body };
      }
    }))
  });
  const createEntityResource = (projectId) => bind("entityId", routes({
    // GET /entities/:id - get entity with attrs
    // PUT /entities/:id with null - delete entity
    "": resource({
      get: async (h) => {
        const entityId = h.params?.entityId || "";
        const entity = db2.entities.get(entityId);
        if (!entity) {
          return { headers: { condition: "not-found" }, body: null };
        }
        return { headers: {}, body: entity };
      },
      put: async (h, body) => {
        const entityId = h.params?.entityId || "";
        const isCascadeDelete = body && typeof body === "object" && "cascade" in body && body.cascade;
        if (body === null || isCascadeDelete) {
          const entity = db2.entities.get(entityId);
          if (!entity) {
            return { headers: { condition: "not-found" }, body: null };
          }
          const allRels = db2.relationships.list(projectId);
          const entitiesToDelete = [];
          if (isCascadeDelete) {
            const findDescendants = (parentId) => {
              const children = allRels.filter((r) => r.kind === "contains" && r.from_entity === parentId).map((r) => r.to_entity);
              const descendants2 = [...children];
              for (const childId of children) {
                descendants2.push(...findDescendants(childId));
              }
              return descendants2;
            };
            const descendants = findDescendants(entityId);
            entitiesToDelete.push(...descendants.reverse(), entityId);
          } else {
            entitiesToDelete.push(entityId);
          }
          const deletedEntities = [];
          const deletedRelationships = [];
          for (const id of entitiesToDelete) {
            const e = db2.entities.get(id);
            if (e) {
              deletedEntities.push({
                entity: { id: e.id, created_at: e.created_at, modified_at: e.modified_at },
                attrs: e.attrs
              });
            }
          }
          const entitySet = new Set(entitiesToDelete);
          for (const rel of allRels) {
            if (entitySet.has(rel.from_entity) || entitySet.has(rel.to_entity)) {
              deletedRelationships.push(rel);
            }
          }
          for (const id of entitiesToDelete) {
            db2.entities.delete(id);
          }
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: "/history/push" },
              {
                forward: {
                  path: `/projects/${projectId}/entities/${entityId}`,
                  body: isCascadeDelete ? { cascade: true } : null
                },
                backward: {
                  path: `/projects/${projectId}/entities/${entityId}`,
                  body: {
                    _restoreBatch: true,
                    entities: deletedEntities,
                    relationships: deletedRelationships
                  }
                }
              }
            );
          }
          return { headers: { deleted: true, count: entitiesToDelete.length }, body: null };
        }
        if (body && typeof body === "object" && "_restore" in body) {
          const restore = body;
          db2.entities.createWithId(projectId, restore.entity.id, {
            created_at: restore.entity.created_at,
            modified_at: restore.entity.modified_at
          });
          if (Object.keys(restore.attrs).length > 0) {
            db2.attrs.setBatch(restore.entity.id, restore.attrs);
          }
          for (const rel of restore.relationships) {
            db2.relationships.createWithId(projectId, rel.id, {
              from_entity: rel.from_entity,
              to_entity: rel.to_entity,
              kind: rel.kind,
              label: rel.label,
              binding_name: rel.binding_name
            });
          }
          return { headers: { restored: true }, body: restore.entity };
        }
        if (body && typeof body === "object" && "_restoreBatch" in body) {
          const restore = body;
          for (const { entity, attrs } of [...restore.entities].reverse()) {
            db2.entities.createWithId(projectId, entity.id, {
              created_at: entity.created_at,
              modified_at: entity.modified_at
            });
            if (Object.keys(attrs).length > 0) {
              db2.attrs.setBatch(entity.id, attrs);
            }
          }
          for (const rel of restore.relationships) {
            db2.relationships.createWithId(projectId, rel.id, {
              from_entity: rel.from_entity,
              to_entity: rel.to_entity,
              kind: rel.kind,
              label: rel.label,
              binding_name: rel.binding_name,
              from_port: rel.from_port,
              to_port: rel.to_port
            });
          }
          return { headers: { restored: true, count: restore.entities.length }, body: restore.entities[0]?.entity };
        }
        return { headers: { condition: "not-implemented" }, body: null };
      }
    }),
    // /entities/:id/attrs/...
    attrs: resource({
      get: async (h) => {
        const entityId = h.params?.entityId || "";
        return createAttrsResource(projectId, entityId).get(h);
      },
      put: async (h, body) => {
        const entityId = h.params?.entityId || "";
        return createAttrsResource(projectId, entityId).put(h, body);
      }
    })
  }));
  return (projectId) => routes({
    // GET /entities - list all entities
    // PUT /entities - create new entity
    "": resource({
      get: async () => ({
        headers: { type: "js/arr" },
        body: db2.entities.list(projectId)
      }),
      put: async (h, body) => {
        const entity = db2.entities.create(projectId);
        if (body?.attrs && Object.keys(body.attrs).length > 0) {
          db2.attrs.setBatch(entity.id, body.attrs);
        }
        if (h.kit && !h.skipHistory) {
          await h.kit.put(
            { path: "/history/push" },
            {
              forward: {
                path: `/projects/${projectId}/entities`,
                body
              },
              backward: {
                path: `/projects/${projectId}/entities/${entity.id}`,
                body: null
              }
            }
          );
        }
        const entityWithAttrs = db2.entities.get(entity.id);
        return { headers: { created: true }, body: entityWithAttrs };
      }
    }),
    // /entities/:id/...
    unknown: createEntityResource(projectId)
  });
}
function createRelationshipsResource(db2) {
  return (projectId) => routes({
    // GET /relationships - list all relationships
    // PUT /relationships - create new relationship
    "": resource({
      get: async () => ({
        headers: { type: "js/arr" },
        body: db2.relationships.list(projectId)
      }),
      put: async (h, body) => {
        const rel = db2.relationships.create(projectId, {
          from_entity: body.from_entity,
          to_entity: body.to_entity,
          kind: body.kind,
          label: body.label ?? null,
          binding_name: body.binding_name ?? null,
          from_port: body.from_port ?? null,
          to_port: body.to_port ?? null
        });
        if (h.kit && !h.skipHistory) {
          await h.kit.put(
            { path: "/history/push" },
            {
              forward: {
                path: `/projects/${projectId}/relationships`,
                body
              },
              backward: {
                path: `/projects/${projectId}/relationships/${rel.id}`,
                body: null
              }
            }
          );
        }
        return { headers: { created: true }, body: rel };
      }
    }),
    // GET/DELETE /relationships/:id
    unknown: bind("relationshipId", resource({
      get: async (h) => {
        const relId = h.params?.relationshipId || "";
        const rel = db2.relationships.get(relId);
        if (!rel) {
          return { headers: { condition: "not-found" }, body: null };
        }
        return { headers: {}, body: rel };
      },
      put: async (h, body) => {
        const relId = h.params?.relationshipId || "";
        if (body === null) {
          const rel = db2.relationships.get(relId);
          if (!rel) {
            return { headers: { condition: "not-found" }, body: null };
          }
          db2.relationships.delete(relId);
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: "/history/push" },
              {
                forward: {
                  path: `/projects/${projectId}/relationships/${relId}`,
                  body: null
                },
                backward: {
                  path: `/projects/${projectId}/relationships/${relId}`,
                  body: {
                    _restore: true,
                    id: rel.id,
                    from_entity: rel.from_entity,
                    to_entity: rel.to_entity,
                    kind: rel.kind,
                    label: rel.label,
                    binding_name: rel.binding_name,
                    from_port: rel.from_port,
                    to_port: rel.to_port
                  }
                }
              }
            );
          }
          return { headers: { deleted: true }, body: null };
        }
        if (body && typeof body === "object" && "_restore" in body) {
          const restore = body;
          db2.relationships.createWithId(projectId, restore.id, {
            from_entity: restore.from_entity,
            to_entity: restore.to_entity,
            kind: restore.kind,
            label: restore.label,
            binding_name: restore.binding_name,
            from_port: restore.from_port,
            to_port: restore.to_port
          });
          return { headers: { restored: true }, body: restore };
        }
        return { headers: { condition: "not-implemented" }, body: null };
      }
    }))
  });
}
function createStampsResource(db2) {
  return routes({
    // GET /stamps - list all stamps
    // PUT /stamps - create new stamp
    "": resource({
      get: async (_h, body) => ({
        headers: { type: "js/arr" },
        body: db2.stamps.list(body)
      }),
      put: async (_h, body) => {
        const stampId = db2.stamps.create(body);
        const stamp = db2.stamps.get(stampId);
        return { headers: { created: true }, body: stamp };
      }
    }),
    // Individual stamp routes
    unknown: bind("stampId", routes({
      // GET /stamps/:id - get stamp with members
      // DELETE /stamps/:id - delete stamp
      "": resource({
        get: async (h) => {
          const stampId = h.params?.stampId || "";
          const stamp = db2.stamps.get(stampId);
          if (!stamp) {
            return { headers: { condition: "not-found" }, body: null };
          }
          return { headers: {}, body: stamp };
        },
        put: async (h, body) => {
          const stampId = h.params?.stampId || "";
          if (body === null) {
            db2.stamps.delete(stampId);
            return { headers: { deleted: true }, body: null };
          }
          if (body && typeof body === "object") {
            db2.stamps.update(stampId, body);
            const stamp = db2.stamps.get(stampId);
            return { headers: { updated: true }, body: stamp };
          }
          return { headers: { condition: "not-implemented" }, body: null };
        }
      }),
      // PUT /stamps/:id/apply/:targetEntityId - apply stamp to entity
      apply: bind("targetEntityId", resource({
        put: async (h) => {
          const stampId = h.params?.stampId || "";
          const targetEntityId = h.params?.targetEntityId || "";
          const targetEntity = db2.entities.get(targetEntityId);
          if (!targetEntity) {
            return { headers: { condition: "not-found" }, body: { error: "Target entity not found" } };
          }
          const projectId = targetEntity.project_id;
          const result = db2.stamps.apply(stampId, targetEntityId);
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: "/history/push" },
              {
                forward: {
                  path: `/stamps/${stampId}/apply/${targetEntityId}`,
                  body: null
                },
                backward: {
                  path: `/stamps/${stampId}/unapply/${targetEntityId}`,
                  body: {
                    projectId,
                    createdEntityIds: result.createdEntityIds,
                    createdRelationshipIds: result.createdRelationshipIds,
                    appliedAttrs: result.appliedAttrs,
                    previousAttrs: result.previousAttrs
                  }
                }
              }
            );
          }
          return { headers: { applied: true }, body: result };
        }
      })),
      // PUT /stamps/:id/unapply/:targetEntityId - undo stamp application
      unapply: bind("targetEntityId", resource({
        put: async (h, body) => {
          const targetEntityId = h.params?.targetEntityId || "";
          for (const id of [...body.createdRelationshipIds].reverse()) {
            db2.relationships.delete(id);
          }
          for (const id of [...body.createdEntityIds].reverse()) {
            db2.entities.delete(id);
          }
          for (const key of Object.keys(body.appliedAttrs)) {
            if (!(key in body.previousAttrs)) {
              db2.attrs.delete(targetEntityId, key);
            }
          }
          if (Object.keys(body.previousAttrs).length > 0) {
            db2.attrs.setBatch(targetEntityId, body.previousAttrs);
          }
          return { headers: { unapplied: true }, body: null };
        }
      }))
    }))
  });
}
function createUIStateResource(db2) {
  return (projectId) => resource({
    // GET /ui-state - get current UI state
    get: async () => ({
      headers: {},
      body: db2.uiState.get(projectId)
    }),
    // PUT /ui-state - update UI state (partial)
    put: async (_h, body) => {
      const updated = db2.uiState.update(projectId, body);
      return { headers: {}, body: updated };
    }
  });
}
function createThemesResource(db2) {
  return routes({
    // GET /themes - list all themes
    // PUT /themes - create new theme
    "": resource({
      get: async () => ({
        headers: { type: "js/arr" },
        body: db2.themes.list()
      }),
      put: async (_h, body) => {
        const theme = db2.themes.create(body.name, body.basedOn);
        return { headers: { created: true }, body: theme };
      }
    }),
    // Token definitions
    tokens: resource({
      get: async () => ({
        headers: { type: "js/arr" },
        body: db2.themes.getTokens()
      })
    }),
    // Individual theme routes
    unknown: bind("themeId", routes({
      // GET /themes/:id - get theme with colors
      // PUT /themes/:id with null - delete theme
      "": resource({
        get: async (h) => {
          const themeId = h.params?.themeId || "";
          const theme = db2.themes.get(themeId);
          if (!theme) {
            return { headers: { condition: "not-found" }, body: null };
          }
          return { headers: {}, body: theme };
        },
        put: async (h, body) => {
          const themeId = h.params?.themeId || "";
          if (body === null) {
            db2.themes.delete(themeId);
            return { headers: { deleted: true }, body: null };
          }
          return { headers: { condition: "not-implemented" }, body: null };
        }
      }),
      // PUT /themes/:id/colors/:tokenId - update color
      colors: bind("tokenId", resource({
        put: async (h, body) => {
          const themeId = h.params?.themeId || "";
          const tokenId = h.params?.tokenId || "";
          db2.themes.updateColor(themeId, tokenId, body);
          return { headers: { updated: true }, body };
        }
      }))
    }))
  });
}
function createSettingsResource(db2) {
  return bind("key", resource({
    // GET /settings/:key - get setting value
    get: async (h) => {
      const key = h.params?.key || "";
      const value = db2.settings.get(key);
      if (value === null) {
        return { headers: { condition: "not-found" }, body: null };
      }
      return { headers: {}, body: value };
    },
    // PUT /settings/:key - set setting value
    put: async (h, body) => {
      const key = h.params?.key || "";
      db2.settings.set(key, body);
      return { headers: { updated: true }, body };
    }
  }));
}
const execAsync = promisify(exec);
function expandTilde(path2) {
  if (path2.startsWith("~/")) {
    return homedir() + path2.slice(1);
  }
  if (path2 === "~") {
    return homedir();
  }
  return path2;
}
function createShellResource() {
  return resource({
    get: async () => ({
      headers: { type: "shell" },
      body: {
        description: "Execute shell commands",
        usage: 'PUT /shell { cmd: "...", cwd?: "...", timeout?: 30000 }'
      }
    }),
    put: async (_h, body) => {
      const { cmd, cwd, timeout = 3e4 } = body;
      if (!cmd) {
        return {
          headers: { condition: "error" },
          body: { error: "cmd is required" }
        };
      }
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: cwd ? expandTilde(cwd) : void 0,
          timeout,
          maxBuffer: 10 * 1024 * 1024
          // 10MB
        });
        return {
          headers: { status: "ok" },
          body: { stdout, stderr, code: 0 }
        };
      } catch (err) {
        const error = err;
        return {
          headers: { status: "error" },
          body: {
            stdout: error.stdout || "",
            stderr: error.stderr || error.message || "Unknown error",
            code: error.code || 1
          }
        };
      }
    }
  });
}
function createSemanticDocsResource(db2) {
  const singleDoc = resource({
    get: async (h) => {
      const id = h.params?.id;
      if (!id) {
        return { headers: { condition: "error" }, body: "Missing id" };
      }
      const doc = db2.semanticDocs.get(id);
      if (!doc) {
        return { headers: { condition: "not-found" }, body: null };
      }
      return { headers: {}, body: doc };
    },
    put: async () => {
      return { headers: { condition: "not-implemented" }, body: null };
    }
  });
  return routes({
    "": resource({
      get: async () => {
        const docs = db2.semanticDocs.list();
        return { headers: {}, body: docs };
      },
      put: async () => {
        return { headers: { condition: "not-implemented" }, body: null };
      }
    }),
    unknown: bind("id", singleDoc)
  });
}
function createCardsResource(db2) {
  const setsResource = routes({
    // GET /cards/sets - list all sets with card counts
    // PUT /cards/sets - create new set
    "": resource({
      get: async () => {
        const sets = db2.cards.listSets();
        const setsWithCounts = sets.map((set) => ({
          ...set,
          card_count: db2.cards.getSetCardCount(set.id)
        }));
        return { headers: { type: "js/arr" }, body: setsWithCounts };
      },
      put: async (_h, body) => {
        const set = db2.cards.createSet(body?.name || "Untitled Set");
        return { headers: { created: true }, body: set };
      }
    }),
    // GET /cards/sets/:setId - get set with card count
    // PUT /cards/sets/:setId with null - delete set
    unknown: bind("setId", routes({
      "": resource({
        get: async (h) => {
          const setId = h.params?.setId || "";
          const set = db2.cards.getSet(setId);
          if (!set) {
            return { headers: { condition: "not-found" }, body: null };
          }
          return {
            headers: {},
            body: {
              ...set,
              card_count: db2.cards.getSetCardCount(setId)
            }
          };
        },
        put: async (h, body) => {
          const setId = h.params?.setId || "";
          if (body === null) {
            db2.cards.deleteSet(setId);
            return { headers: { deleted: true }, body: null };
          }
          return { headers: { condition: "not-implemented" }, body: null };
        }
      }),
      // GET /cards/sets/:setId/cards - get cards in set
      cards: resource({
        get: async (h) => {
          const setId = h.params?.setId || "";
          const cards = db2.cards.getSetCards(setId);
          return { headers: { type: "js/arr" }, body: cards };
        }
      })
    }))
  });
  const cardResource = bind("cardId", resource({
    // GET /cards/:cardId - get card with source
    get: async (h) => {
      const cardId = h.params?.cardId || "";
      const card = db2.cards.getCardWithSource(cardId);
      if (!card) {
        return { headers: { condition: "not-found" }, body: null };
      }
      return { headers: {}, body: card };
    },
    // PUT /cards/:cardId with null - delete card
    // PUT /cards/:cardId with { source } - edit card
    put: async (h, body) => {
      const cardId = h.params?.cardId || "";
      if (body === null) {
        db2.cards.deleteCard(cardId);
        return { headers: { deleted: true }, body: null };
      }
      if (body && typeof body === "object" && "source" in body) {
        const newVersion = db2.cards.editCard(cardId, body.source);
        const updated = db2.cards.getCardWithSource(cardId);
        return { headers: { updated: true, version: newVersion }, body: updated };
      }
      return { headers: { condition: "not-implemented" }, body: null };
    }
  }));
  return routes({
    // GET /cards - list all cards
    // PUT /cards - create new card
    "": resource({
      get: async () => {
        const cards = db2.cards.listCards();
        return { headers: { type: "js/arr" }, body: cards };
      },
      put: async (_h, body) => {
        const card = db2.cards.createCard(body?.set_id ?? null, body?.source || "");
        return { headers: { created: true }, body: card };
      }
    }),
    // /cards/sets/*
    sets: setsResource,
    // /cards/:cardId
    unknown: cardResource
  });
}
function createVisualResources(db2) {
  const history = createHistory();
  const projects = createProjectsResource(db2);
  const entitiesFactory = createEntitiesResource(db2);
  const relationshipsFactory = createRelationshipsResource(db2);
  const uiStateFactory = createUIStateResource(db2);
  const stamps = createStampsResource(db2);
  const themes = createThemesResource(db2);
  const settings = createSettingsResource(db2);
  const projectScopedResource = bind("projectId", routes({
    "": resource({
      get: async (h) => {
        const projectId = h.params?.projectId || "";
        const project = db2.projects.get(projectId);
        if (!project) {
          return { headers: { condition: "not-found" }, body: null };
        }
        return { headers: {}, body: project };
      },
      put: async (h, body) => {
        const projectId = h.params?.projectId || "";
        if (body === null) {
          db2.projects.delete(projectId);
          return { headers: { deleted: true }, body: null };
        }
        return { headers: { condition: "not-implemented" }, body: null };
      }
    }),
    entities: resource({
      get: async (h) => {
        const projectId = h.params?.projectId || "";
        return entitiesFactory(projectId).get(h);
      },
      put: async (h, body) => {
        const projectId = h.params?.projectId || "";
        return entitiesFactory(projectId).put(h, body);
      }
    }),
    relationships: resource({
      get: async (h) => {
        const projectId = h.params?.projectId || "";
        return relationshipsFactory(projectId).get(h);
      },
      put: async (h, body) => {
        const projectId = h.params?.projectId || "";
        return relationshipsFactory(projectId).put(h, body);
      }
    }),
    "ui-state": resource({
      get: async (h) => {
        const projectId = h.params?.projectId || "";
        return uiStateFactory(projectId).get(h);
      },
      put: async (h, body) => {
        const projectId = h.params?.projectId || "";
        return uiStateFactory(projectId).put(h, body);
      }
    })
  }));
  const shell2 = createShellResource();
  const semanticDocs = createSemanticDocsResource(db2);
  const cards = createCardsResource(db2);
  const tree = routes({
    projects: routes({
      "": resource({
        get: async () => projects.get({ path: "/" }),
        put: async (h, body) => projects.put({ ...h, path: "/" }, body)
      }),
      unknown: projectScopedResource
    }),
    stamps,
    themes,
    settings,
    history,
    shell: shell2,
    "semantic-docs": semanticDocs,
    cards
  });
  const withKit = (res) => {
    const kit = {
      get: (h) => withKit(res).get(h),
      put: (h, b) => withKit(res).put(h, b)
    };
    return {
      get: async (h) => {
        return res.get({ ...h, kit });
      },
      put: async (h, body) => {
        return res.put({ ...h, kit }, body);
      }
    };
  };
  return withKit(tree);
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const isMac = process.platform === "darwin";
function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "data/icons/icon.png");
  }
  return path.join(__dirname$1, "../data/icons/icon.png");
}
let mainWindow = null;
let mainWindowState = null;
function createWindow() {
  const iconPath = getIconPath();
  mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800
  });
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    icon: iconPath,
    title: "HomeBass",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
      // Required for better-sqlite3
    }
  });
  mainWindowState.manage(mainWindow);
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
const menuCallbacks = {
  createProject: () => {
    mainWindow?.webContents.send("menu:create-project");
  },
  openProject: () => {
    mainWindow?.webContents.send("menu:open-project");
  },
  openProjectById: (id) => {
    mainWindow?.webContents.send("menu:open-project-by-id", id);
  },
  exportProject: () => {
    mainWindow?.webContents.send("menu:export-project");
  },
  showSettings: () => {
    mainWindow?.webContents.send("menu:show-settings");
  }
};
function refreshMenu() {
  const projects = db.projects.list();
  const sortedProjects = projects.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const appMenu = createApplicationMenu(menuCallbacks, sortedProjects);
  Menu.setApplicationMenu(appMenu);
  if (isMac && app.dock) {
    app.dock.setMenu(createDockMenu(menuCallbacks, sortedProjects));
  }
}
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}
app.whenReady().then(() => {
  app.setName("HomeBass");
  if (isMac && app.dock) {
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }
  db.init();
  refreshMenu();
  setupIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  app.addRecentDocument(filePath);
  if (mainWindow) {
    mainWindow.webContents.send("menu:open-file", filePath);
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
function setupIpcHandlers() {
  const resources = createVisualResources(db);
  ipcMain.handle("bl:get", async (_, headers) => {
    const result = await resources.get(headers);
    if (headers.path === "/projects") {
      refreshMenu();
    }
    return result;
  });
  ipcMain.handle("bl:put", async (_, headers, body) => {
    const result = await resources.put(headers, body);
    if (headers.path.startsWith("/projects")) {
      refreshMenu();
    }
    return result;
  });
  ipcMain.handle("fonts:list", async () => listSystemFonts());
  ipcMain.handle("fonts:search", async (_, query) => {
    const fonts = await listSystemFonts();
    return searchFonts(fonts, query);
  });
  ipcMain.handle("db:query", async (_, sql, params) => {
    try {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith("SELECT")) {
        return { data: db.query.all(sql, params || []) };
      } else {
        const result = db.query.run(sql, params || []);
        return { data: [], changes: result.changes };
      }
    } catch (error) {
      return { error: error.message };
    }
  });
  ipcMain.handle("app:notify", (_, title, body) => {
    showNotification(title, body);
  });
  ipcMain.handle("app:addRecentDocument", (_, filePath) => {
    app.addRecentDocument(filePath);
  });
  ipcMain.handle("app:clearRecentDocuments", () => {
    app.clearRecentDocuments();
  });
  ipcMain.handle("app:refreshMenu", () => {
    refreshMenu();
  });
  const getInitFilePath = () => path.join(app.getPath("home"), ".homebassrc");
  ipcMain.handle("blemacs:readInit", () => {
    const initPath = getInitFilePath();
    try {
      if (fs.existsSync(initPath)) {
        return fs.readFileSync(initPath, "utf-8");
      }
      return null;
    } catch (error) {
      console.error("Failed to read init file:", error);
      return null;
    }
  });
  ipcMain.handle("blemacs:writeInit", (_, content) => {
    const initPath = getInitFilePath();
    try {
      fs.writeFileSync(initPath, content, "utf-8");
      return { success: true };
    } catch (error) {
      console.error("Failed to write init file:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("blemacs:getInitPath", () => {
    return getInitFilePath();
  });
}
export {
  showNotification
};
