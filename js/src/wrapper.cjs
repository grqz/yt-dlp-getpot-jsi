(function () {
    'use strict';
    if (typeof phantom === 'undefined')
        throw new Error('This script must be run in phantomjs');
    var UA =
        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
    var page = require('webpage').create();

    // method: "method name",
    // args: variadic: Array or single argument
    page.onCallback = function (method, args) {
        args = Array.isArray(args) ? args : [args];
        var ret = {};
        if (typeof method !== 'string') {
            ret.result = 'error';
            ret.error = 'method is not a string';
            console.log('onCallback error: ' + ret.error);
            return ret;
        }
        var fnMap = {
            exit: function (code) { return phantom.exit(code); },
            writeError: function () { return console.trace.apply(console, arguments); },
            writeDebug: function () { return console.debug.apply(console, arguments); },
            writeLog: function () { return console.log.apply(console, arguments); },
            disableDebugging: function () {
                page.onConsoleMessage = undefined;
            },
            index: function () { return Object.keys(this); },
            setUA: function (ua) {
                return page.settings.userAgent = page.customHeaders['User-Agent'] = ua;
            }
        };
        var obj = fnMap[method];
        ret.objType = typeof obj;
        if (typeof obj === 'function') {
            ret.result = 'success';
            ret.value = obj.apply(fnMap, args);
            return ret;
        } else if (typeof obj === 'undefined') {
            ret.result = 'error';
            ret.error = 'object is undefined';
            console.log('onCallback error: ' + ret.error);
            return ret;
        } else {
            ret.result = 'error';
            ret.error = 'unknown object type: ' + typeof obj;
            console.log('onCallback error: ' + ret.error);
            return ret;
        }
    };

    page.onConsoleMessage = function (msg) {
        console.log('CONSOLE: ' + msg);
    };

    page.customHeaders['User-Agent'] = page.settings.userAgent = UA;

    page.open('about:blank', function (status) {
        if (status !== 'success') {
            console.error('Failed to load the page');
            phantom.exit();
            return;
        }
        page.setContent(
            '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
            'https://www.youtube.com/');

        page.evaluate(function () {
            'use strict';
            function callHost(method) {
                var res = callHost.callPhantom.call(window, method, Array.prototype.slice.call(arguments, 1));
                if (res.result === 'error')
                    throw new Error('callPhantom failure: ' + res.error);
                else if (res.result === 'success')
                    return res.value;
                else
                    throw new Error('callPhanton unknown result: ' + res.result);
            }
            if (typeof window.callPhantom !== 'function')
                throw new Error('Could not find window.callPhantom');
            callHost.callPhantom = window.callPhantom;
            delete window.callPhantom;
            var phantomInnerAPI = {};
            callHost('index').forEach(
                function (method) {
                    phantomInnerAPI[method] = function () {
                        return callHost.apply(null, [method].concat(Array.prototype.slice.call(arguments)));
                    };
                }
            );
/*__PLACEHOLDER_REPLACE_WITH_SCRIPT_CONTENT__*/
        });
    });
})();
