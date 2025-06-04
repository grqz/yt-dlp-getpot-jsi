#!/usr/bin/env python3
import pathlib

JS_PATH = r'pot_http.es5.cjs'
JS_WRAPPER_PATH = r'wrapper.cjs'
PY_DEST_PATH = r'getpot_phantomjs/_script.py'

TEMPLATE = r'''# Generated from {js_path}
SCRIPT = {script_quoted}
# Generated from {js_wrapper_path}
SCRIPT_WRAPPER = {script_wrapper_quoted}
'''


def main():
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    script_quoted = ''
    with open(repo_root / 'js/src' / JS_PATH) as js_file:
        script_quoted = repr(js_file.read())
    script_wrapper_quoted = ''
    with open(repo_root / 'js/src' / JS_WRAPPER_PATH) as js_file:
        script_wrapper_quoted = repr(js_file.read())
    with open(repo_root / 'py/yt_dlp_plugins' / PY_DEST_PATH, 'w') as py_file:
        py_file.write(TEMPLATE.format(
            js_path=JS_PATH, script_quoted=script_quoted,
            js_wrapper_path=JS_WRAPPER_PATH, script_wrapper_quoted=script_wrapper_quoted))


if __name__ == '__main__':
    main()
