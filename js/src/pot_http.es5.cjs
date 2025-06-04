// Example input:
// var embeddedInputData = {
//     "port": 12345,
//     "content_bindings": ["dQw4w9WgXcQ"]
// };
// embeddedInputData.ytAtR = JSON.parse('\x7b\x7d');

// yt-dlp's PhantomJSwrapper relies on
// `'phantom.exit();' in jscode`
// phantom.exit();

var globalObj = (typeof globalThis !== 'undefined') ? globalThis :
    (typeof global !== 'undefined') ? global :
        (typeof window !== 'undefined') ? window :
            (typeof self !== 'undefined') ? self :
                this;

var writeError, writeDebug, writeLog, nop = function () {}, exit;
if (typeof phantomInnerAPI !== 'undefined') {
    exit = phantomInnerAPI.exit;
    writeError = phantomInnerAPI.writeError;
    writeLog = phantomInnerAPI.writeLog;
    if (embeddedInputData.NDEBUG) {
        writeDebug = nop;
        phantomInnerAPI.disableConsoleMsg();
    } else {
        writeDebug = phantomInnerAPI.writeDebug;
    }
} else {
    writeError = function () { return console.trace.apply(console, arguments); };
    writeDebug = embeddedInputData.NDEBUG ? nop : function () { return console.debug.apply(console, arguments); };
    writeLog = function () { return console.log.apply(console, arguments); };
    if (typeof phantom !== 'undefined')
        exit = function () { return phantom.exit.apply(phantom, arguments); };
    else if (typeof process !== 'undefined') {
        exit = function () { return process.exit.apply(process, arguments); };
        var JSDOM = require('jsdom').JSDOM;
        var dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
            url: 'https://www.youtube.com/',
            referrer: 'https://www.youtube.com/',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)'
        });

        Object.assign(globalObj, {
            window: dom.window,
            document: dom.window.document,
            location: dom.window.location,
            origin: dom.window.origin
        });

        if (!Reflect.has(globalObj, 'navigator'))
            Object.defineProperty(globalObj, 'navigator', { value: dom.window.navigator });
        // for debugging
        embeddedInputData.port = process.args && process.args[2] || 3200;
    }
    else
        exit = nop;
}

// Currently, we only support fetch for a custom UA
// TODO: do requests natively
var doRequestsNatively = typeof fetch === 'function';

function compatFetch(resolve, reject, url, req) {
    req = req || {};
    req.method = req.method ? req.method.toUpperCase() : (req.body ? 'POST' : 'GET');
    req.headers = req.headers || {};
    req.body = req.body || null;
    if (typeof fetch === 'function') {
        writeDebug('FETCH', url);
        fetch(url, req).then(function (response) {
            return {
                ok: response.ok,
                status: response.status,
                url: response.url,
                text: function (resolveInner, rejectInner) {
                    response.text().then(resolveInner).catch(rejectInner);
                },
                json: function (resolveInner, rejectInner) {
                    response.json().then(resolveInner).catch(rejectInner);
                },
                headers: {
                    get: response.headers.get,
                    _raw: response.headers
                }
            };
        }).then(resolve).catch(reject);
    } else if (typeof XMLHttpRequest !== 'undefined') {
        writeDebug('XHR', url);
        xhr = new XMLHttpRequest();
        xhr.open(req.method, url, true);
        for (var hdr in req.headers) {
            if (hdr.toLowerCase() === 'user-agent') return reject('UA not supported');
            xhr.setRequestHeader(hdr, req.headers[hdr]);
        }
        var doneCallbacks = [];
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 2) {
                resolve({
                    ok: (xhr.status >= 200 && xhr.status < 300),
                    status: xhr.status,
                    url: xhr.responseUrl,
                    text: function (resolveInner, rejectInner) {
                        doneCallbacks.push(resolveInner);
                    },
                    json: function (resolveInner, rejectInner) {
                        doneCallbacks.push(function (responseText) {
                            var parsed;
                            try {
                                parsed = JSON.parse(responseText);
                            } catch (err) {
                                return rejectInner(err);
                            }
                            resolveInner(parsed);
                        });
                    },
                    headers: {
                        get: function (name) {
                            return xhr.getResponseHeader(name);
                        },
                        _raw: xhr.getAllResponseHeaders()
                    }
                });
            } else if (xhr.readyState === 4) {
                doneCallbacks = doneCallbacks.filter(function (x) {
                    if (typeof x === 'function')
                        x(xhr.responseText);
                    return false;
                });
            }
        };
        xhr.onerror = function () {
            reject(new Error('XHR failed'));
        };

        if (req && typeof req.timeout === 'number') {
            xhr.timeout = req.timeout;
        }

        xhr.ontimeout = function () {
            reject(new Error('XHR timed out'));
        };

        try {
            xhr.send(req.body);
        } catch (err) {
            reject(err);
        }
    } else {
        reject(new Error('Could not find available networking API.'));
    }
}

var base64urlToBase64Map = {
    '-': '+',
    _: '/',
    '.': '='
};

var base64urlCharRegex = /[-_.]/g;

function b64ToUTF8Arr(b64) {
    var b64Mod;

    if (base64urlCharRegex.test(b64)) {
        b64Mod = base64.replace(base64urlCharRegex, function (match) {
            return base64urlToBase64Map[match];
        });
    } else {
        b64Mod = b64;
    }
    var b64Mod = atob(b64Mod);
    var ret = [];
    b64Mod.split('').forEach(function (chr) {
        ret.push(chr.charCodeAt(0));
    });
    return ret;
}

function UTF8ArrToB64(u8, b64Url) {
    b64Url = (typeof b64Url === 'undefined') ? false : b64Url;
    var str = '';
    Array.prototype.forEach.call(u8, function (chrCode) {
        str += String.fromCharCode(chrCode);
    });
    var result = btoa(str);
    if (b64Url) {
        return result
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
    return result;
}

function encodeASCII(str) {
    var ret = [];
    str.split('').forEach(function (chr) {
        ret.push(chr.charCodeAt(0));
    });
    return ret;
}

function buildPOTServerURL(path) {
    return 'http://127.0.0.1:'.concat(embeddedInputData.port, path);
}

function fetchChallenge(resolve, reject) {
    if (embeddedInputData.ytAtR !== null) {
        var interpUrl = embeddedInputData.ytAtR.bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
        compatFetch(function (respRaw) {
            if (!respRaw.ok)
                return reject(new Error('Could not get challenge'));
            respRaw.text(function (respText) {
                var bgChallenge = embeddedInputData.ytAtR.bgChallenge;
                resolve({
                    ijs: respText,
                    uie: bgChallenge.userInteractionElement,
                    vmn: bgChallenge.globalName,
                    prg: bgChallenge.program
                });
            }, reject);
        }, reject, 'https:'.concat(interpUrl));
    } else {
        compatFetch(function (respRaw) {
            if (!respRaw.ok)
                return reject(new Error('Could not get challenge'));;
            respRaw.json(function (respJson) {
                if (!respJson || respJson.error)
                    return reject(new Error('Could not get challenge' + (respJson && respJson.error && ': '.concat(respJson.error)) || ''));
                resolve({
                    ijs: respJson.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue,
                    uie: respJson.userInteractionElement,
                    vmn: respJson.globalName,
                    prg: respJson.program
                });
            }, reject);
        }, reject, buildPOTServerURL('/descrambled'));
    }
}

function load(resolve, reject, vm, program, userInteractionElement) {
    if (!vm)
        reject(new Error('VM not found'));
    if (!vm.a)
        reject(new Error('VM init function not found'));
    var vmFns;
    var asyncResolved = false;
    var syncResolved = false;
    var syncSnapshotFunction;
    function maybeDone() {
        if (asyncResolved && syncResolved) {
            resolve({
                syncSnapshotFunction: syncSnapshotFunction,
                vmFns: vmFns,
            });
        }
    }
    function vmFunctionsCallback(asyncSnapshotFunction, shutdownFunction, passEventFunction, checkCameraFunction) {
        vmFns = {
            asyncSnapshotFunction: asyncSnapshotFunction,
            shutdownFunction: shutdownFunction,
            passEventFunction: passEventFunction,
            checkCameraFunction: checkCameraFunction
        };
        asyncResolved = true;
        maybeDone();
    }
    syncSnapshotFunction = vm.a(program, vmFunctionsCallback, true, userInteractionElement, nop, [[], []])[0];
    syncResolved = true;
    maybeDone();
}

function snapshot(resolve, reject, vmFns, args, timeout) {
    timeout = (typeof timeout === 'undefined') ? 3000 : timeout;
    if (!vmFns.asyncSnapshotFunction)
        return reject(new Error('Asynchronous snapshot function not found'));
    var timeoutId;
    var resolved = false;
    function resolveWrapped(x) {
        if (resolved) return writeDebug('SSHOT_MULTICB RESOLVE');
        resolved = true;
        clearTimeout(timeoutId);
        writeDebug('TYPEOF_WPSO', typeof args.webPoSignalOutput[0]);
        resolve(x);
    }
    function rejectWrapped(x) {
        if (resolved) return writeDebug('SSHOT_MULTICB REJECT');
        resolved = true;
        clearTimeout(timeoutId);
        reject(x);
    }
    timeoutId = setTimeout(function () {
        rejectWrapped(new Error('VM operation timed out'));
    }, timeout);
    vmFns.asyncSnapshotFunction(resolveWrapped, [
        args.contentBinding,
        args.signedTimestamp,
        args.webPoSignalOutput,
        args.skipPrivacyBuffer
    ]);
}

function getWebSafeMinter(resolve, reject, integrityTokenData, webPoSignalOutput) {
    var getMinter = webPoSignalOutput[0];
    if (!getMinter)
        reject(new Error('PMD:Undefined'));
    if (!integrityTokenData.integrityToken)
        reject(new Error('No integrity token provided'));
    var mintCallback = getMinter(b64ToUTF8Arr(integrityTokenData.integrityToken));
    if (typeof mintCallback !== 'function')
        reject(new Error('APF:Failed'));
    resolve(function (resolveInner, rejectInner, identifier) {
        var result = mintCallback(encodeASCII(identifier));
        if (!result)
            rejectInner(new Error('YNJ:Undefined'));
        if (!(result instanceof Uint8Array))
            rejectInner(new Error('ODM:Invalid'));
        resolveInner(UTF8ArrToB64(result, true));
    });
}

(function () {
    writeDebug('FUNC');
    var identifiers = embeddedInputData.content_bindings;
    if (!identifiers.length) {
        writeLog('[]');
        exit(0);
    }
    fetchChallenge(function (chl) {
        writeDebug('CHL');
        if (chl.ijs) {
            new Function(chl.ijs)();
        } else {
            writeError('Could not load VM');
            exit(1);
        }
        writeDebug('VM_LOADED', JSON.stringify(globalObj[chl.vmn]));
        writeDebug('VM_INIT_FN', globalObj[chl.vmn] && typeof globalObj[chl.vmn].a);
        load(function (bg) {
            writeDebug('LD');
            var webPoSignalOutput = [];
            snapshot(function (botguardResponse) {
                writeDebug('SSHOT', botguardResponse);
                compatFetch(function (integrityTokenResponse) {
                    writeDebug('IT');
                    integrityTokenResponse.json(function (integrityTokenJson) {
                        writeDebug('ITJ', JSON.stringify(integrityTokenJson));
                        if (!integrityTokenResponse.ok || !integrityTokenJson) {
                            writeError('Failed to get integrity token response:', (integrityTokenResponse && integrityTokenResponse.error) || '')
                            exit(1);
                        }
                        if (typeof integrityTokenJson.integrityToken !== 'string') {
                            writeError('Could not get integrity token');
                            exit(1);
                        }
                        getWebSafeMinter(function (webSafeMinter) {
                            var pots = [];
                            function exitIfCompleted() {
                                if (Object.keys(pots).length == identifiers.length) {
                                    writeLog(JSON.stringify(pots));
                                    exit(+(pots.indexOf(null) !== -1));
                                }
                            }
                            identifiers.forEach(function (identifier, idx) {
                                webSafeMinter(function (pot) {
                                    pots[idx] = pot;
                                    exitIfCompleted();
                                }, function (err) {
                                    writeError(
                                        'Failed to mint web-safe POT for identifier '.concat(identifier, ':'), err);
                                    pots[idx] = null;
                                    exitIfCompleted();
                                }, identifier);
                            });
                        }, function (err) {
                            writeError('Failed to get web-safe minter:', err);
                            exit(1);
                        }, integrityTokenJson, webPoSignalOutput);
                    }, function (err) {
                        writeError('Failed to parse JSON:', err);
                        exit(1);
                    });
                }, function (err) {
                    writeError('Failed to fetch integrity token response:', err);
                    exit(1);
                }, buildPOTServerURL('/genit'), {
                    method: 'POST',
                    body: JSON.stringify(botguardResponse)
                });
            }, function (err) {
                writeError('Snapshot failed:', err);
                exit(1);
            }, bg.vmFns, {
                webPoSignalOutput: webPoSignalOutput
            });
        }, function (err) {
            writeError('Error loading VM', err);
            exit(1);
        }, globalObj[chl.vmn], chl.prg, chl.uie);
    }, function (err) {
        writeError('Failed to parse challenge:', err);
        exit(1);
    });
})();
