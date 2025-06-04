(function () {
    if (typeof phantom === 'undefined')
        throw new Error("This script must be run in phantomjs");
    var page = require('webpage').create();

    // {
    //   type: "method name",
    //   args: variadic: Array or single element,
    // }
    page.onCallback = function (data) {
        var ret = {};
        if (typeof data !== 'object' && !Array.isArray(data)) {
            ret.result = 'error';
            ret.error = 'data is not an object';
            console.log("onCallback error:", ret.error);
            return ret;
        }
        if (typeof data.type !== 'string') {
            ret.result = 'error';
            ret.error = 'data.type is not a string';
            console.log("onCallback error:", ret.error);
            return ret;
        }
        var fnMap = {
            exit: function (code) {
                if (typeof phantom !== 'undefined')
                    phantom.exit(code);
            },
            writeError: function () { return console.trace.apply(console, arguments); },
            writeDebug: function () { return console.debug.apply(console, arguments); },
            writeLog: function () { return console.log.apply(console, arguments); },
            disableConsoleMsg: function () {
                page.onConsoleMessage = undefined;
            }
        };
        var obj = fnMap[data.type];
        if (typeof obj === 'function') {
            ret.result = 'success';
            ret.objType = 'function';
            ret.value = obj.apply(fnMap, Array.isArray(data.args) ? data.args : [data.args]);
            return ret;
        } else if (typeof obj === 'undefined') {
            ret.result = 'error';
            ret.error = 'object is undefined';
            console.log("onCallback error:", ret.error);
            return ret;
        } else {
            ret.result = 'error';
            ret.error = 'unknown object type: '.concat(typeof obj);
            console.log("onCallback error:", ret.error);
            return ret;
        }
    };

    page.onConsoleMessage = function (msg) {
        console.log('CONSOLE: ' + msg);
    };

    page.open('about:blank', function (status) {
        if (status !== 'success') {
            console.error('Failed to load the page');
            phantom.exit();
            return;
        }
        page.setContent('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', 'https://www.youtube.com/');
        page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';

        page.evaluate(function () {
            var phantomInnerAPI = {};
            if (typeof window.callPhantom !== 'function')
                throw new Error("could not find window.callPhantom");
            phantomInnerAPI.callPhantom = window.callPhantom;
            delete window.callPhantom;
            function callHost(method) {
                var args = Array.prototype.slice.call(arguments, 1);
                var res = phantomInnerAPI.callPhantom({
                    'type': method,
                    'args': args
                });
                if (res.result === 'error')
                    throw new Error("callPhantom failure:".concat(res.error));
                else if (res.result === 'success')
                    return res.value;
                else
                    throw new Error("callPhanton unknown result: ".concat(res.result));
            }
            ['exit', 'writeError', 'writeDebug', 'writeLog', 'disableConsoleMsg'].forEach(
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
