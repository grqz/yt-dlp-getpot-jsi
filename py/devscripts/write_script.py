#!/usr/bin/env python3

# Allow direct execution
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from pathlib import Path

from devscripts.make_script import main as write_script_py


def main():
    write_script_py()
    write_script(Path(__file__).parent.parent.parent / 'tmp/generated/phantom.js')


def write_script(path: Path):
    from yt_dlp_plugins.getpot_phantomjs.script import make_script
    from yt_dlp_plugins.getpot_phantomjs.debug import NDEBUG
    with open(path, 'w') as f:
        f.write(make_script({
            'port': None,
            'content_bindings': ['dQw4w9WgXcQ'],
            'NDEBUG': NDEBUG,
        }, ''))
        print('Script generated at ' + path.name)


if __name__ == '__main__':
    main()
