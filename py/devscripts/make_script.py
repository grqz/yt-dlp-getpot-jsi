#!/usr/bin/env python3
import pathlib

JS_PATH = r'pot_http.es5.cjs'
PY_DEST_PATH = r'getpot_phantomjs/_script.py'

TEMPLATE = r'''# Generated from {js_path}
SCRIPT = {script_quoted}
'''


def main():
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    with open(repo_root / 'js/src' / JS_PATH) as js_file:
        with open(repo_root / 'py/yt_dlp_plugins' / PY_DEST_PATH, 'w') as py_file:
            py_file.write(TEMPLATE.format(script_quoted=repr(js_file.read()), js_path=JS_PATH))


if __name__ == '__main__':
    main()
