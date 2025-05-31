// Example input:
// var embeddedInputData = {
//     "port": 12345,
//     "content_bindings": ["dQw4w9WgXcQ"]
// };
// embeddedInputData.ytAtR = JSON.parse('\x7b\x7d');
if (embeddedInputData.ytAtR !== null) {
    console.log('globalName:', embeddedInputData.ytAtR.bgChallenge.globalName);
}

var globalObj = (typeof globalThis !== 'undefined') ? globalThis :
    (typeof global !== 'undefined') ? global :
        (typeof window !== 'undefined') ? window :
            (typeof self !== 'undefined') ? self :
                this;

if ((typeof process !== 'undefined') &&
    (typeof process.versions.node !== 'undefined')) {
    var jsdom = require('jsdom');
    var dom = new jsdom.JSDOM();
    Object.assign(globalObj, {
        window: dom.window,
        document: dom.window.document
    });
}

function exit(code) {
    if (typeof phantom !== 'undefined') {
        // phantom.exit();
        phantom.exit(code);
        // yt-dlp's PhantomJSwrapper relies on
        // `'phantom.exit();' in jscode`
    } else if (typeof process !== 'undefined')
        process.exit(code);
}

function compatFetch(resolve, reject, url, req) {
    req = req || {};
    req.method = req.method ? req.method.toUpperCase() : (req.body ? 'POST' : 'GET');
    req.headers = req.headers || {};
    req.body = req.body || null;
    if (typeof fetch === 'function') {
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
        xhr = new XMLHttpRequest();
        xhr.open(req.method, url, true);
        for (var hdr in req.headers)
            xhr.setRequestHeader(hdr, req.headers[hdr]);
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
                    if (x)
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
    syncSnapshotFunction = vm.a(program, vmFunctionsCallback, true, userInteractionElement, function () { }, [[], []])[0];
    syncResolved = true;
    maybeDone();
}

function snapshot(resolve, reject, vmFns, args, timeout) {
    timeout = (typeof timeout === 'undefined') ? 3000 : timeout;
    var timeoutId;
    function resolveWrapped(x) {
        clearTimeout(timeoutId);
        resolve(x);
    }
    function rejectWrapped(x) {
        clearTimeout(timeoutId);
        reject(x);
    }
    timeoutId = setTimeout(function () {
        reject(new Error('VM operation timed out'));
    }, timeout);
    if (!vmFns.asyncSnapshotFunction)
        return rejectWrapped(new Error('Asynchronous snapshot function not found'));
    vmFns.asyncSnapshotFunction(function (response) { resolveWrapped(response) }, [
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
        // do we need to test if result is a U8arr?
        resolveInner(UTF8ArrToB64(result, true));
    });
}

function buildPOTServerURL(path) {
    return 'http://127.0.0.1:'.concat(embeddedInputData.port, path);
}

(function () {
    var identifiers = embeddedInputData.content_bindings;
    if (!identifiers.length) {
        console.log('[]');
        exit(0);
    }
    compatFetch(function (bgChallengeRaw) {
        bgChallengeRaw.json(function (bgChallenge) {
            if (!bgChallengeRaw.ok || !bgChallenge) {
                console.error('Could not get challenge:', (bgChallenge && bgChallenge.error) || '');
                exit(1);
            }

            var interpreterJavascript = bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
            if (interpreterJavascript) {
                new Function(interpreterJavascript)();
            } else {
                console.error('Could not load VM');
                exit(1);
            }

            load(
                function (bg) {
                    var webPoSignalOutput = [];
                    snapshot(function (botguardResponse) {
                        compatFetch(function (integrityTokenResponse) {
                            integrityTokenResponse.json(function (integrityTokenJson) {
                                if (!integrityTokenResponse.ok || !integrityTokenJson) {
                                    console.error('Failed to get integrity token response:', (integrityTokenResponse && integrityTokenResponse.error) || '')
                                    exit(1);
                                }
                                getWebSafeMinter(function (webSafeMinter) {
                                    var pots = [];
                                    function exitIfCompleted() {
                                        if (Object.keys(pots).length == identifiers.length) {
                                            console.log(JSON.stringify(pots));
                                            exit(+(pots.indexOf(null) !== -1));
                                        }
                                    }
                                    identifiers.forEach(function (identifier, idx) {
                                        webSafeMinter(function (pot) {
                                            pots[idx] = pot;
                                            exitIfCompleted();
                                        }, function (err) {
                                            console.error(
                                                'Failed to mint web-safe POT for identifier '.concat(identifier, ':'), err);
                                            pots[idx] = null;
                                            exitIfCompleted();
                                        }, identifier);
                                    });
                                }, function (err) {
                                    console.error('Failed to get web-safe minter:', err);
                                    exit(1);
                                }, integrityTokenJson, webPoSignalOutput);
                            }, function (err) {
                                console.error('Failed to parse JSON:', err);
                                exit(1);
                            });
                        }, function (err) {
                            console.error('Failed to fetch integrity token response:', err);
                            exit(1);
                        }, buildPOTServerURL('/genit'), {
                            method: 'POST',
                            body: JSON.stringify(botguardResponse)
                        });
                    }, function (err) {
                        console.error('snapshot failed:', err);
                        exit(1);
                    }, bg.vmFns, {
                        webPoSignalOutput: webPoSignalOutput
                    })
                }, function (err) {
                    console.error('Error loading VM', err);
                    exit(1);
                },
                globalObj[bgChallenge.globalName],
                bgChallenge.program, bgChallenge.userInteractionElement);
        }, function (err) {
            console.error('Failed to parse challenge:', err);
            exit(1);
        });
    }, function (err) {
        console.error('Failed to fetch challenge:', err);
        exit(1);
    }, buildPOTServerURL('/descrambled'));
})();
