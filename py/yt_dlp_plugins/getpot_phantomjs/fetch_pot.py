import json
import typing
from yt_dlp.utils.traversal import traverse_obj

from .script import SCRIPT_PHANOTOM_MINVER, make_script
from .phantom_jsi import PhantomJSWrapperWithCustomArgs
from .server import POTHTTPServer


def construct_jsi(ie, *args, **kwargs):
    return PhantomJSWrapperWithCustomArgs(
        ie, required_version=SCRIPT_PHANOTOM_MINVER, *args, **kwargs)


def dont_log(x): ...


def fetch_pots(ie, content_bindings, Request, urlopen, phantom_jsi=None, log=dont_log, challenge_data=None, *args, **kwargs):
    if phantom_jsi is None:
        phantom_jsi = construct_jsi(
            ie, content_bindings, *args, **kwargs)
    with POTHTTPServer(Request, urlopen, log) as pot_server:
        script = make_script({
            'port': pot_server.port,
            'content_bindings': content_bindings,
        }, challenge_data)
        with open('../tmp/script.js', 'w') as f:
            f.write(script)
        return traverse_obj(
            script, ({phantom_jsi.execute}, {lambda x: log(f'PhantomJS stdout: {x}') or x},
                     {str.splitlines}, -1, {str.strip}, {json.loads}))


@typing.overload
def fetch_pot(ie, content_binding, Request, urlopen, phantom_jsi=dont_log, log=None, challenge_data=None): ...


def fetch_pot(ie, content_binding, *args, **kwargs):
    return traverse_obj(fetch_pots(ie, [content_binding], *args, **kwargs), 0)
