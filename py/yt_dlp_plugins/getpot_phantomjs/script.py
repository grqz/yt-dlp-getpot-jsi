import json

from ._script import SCRIPT

SCRIPT_PHANOTOM_MINVER = '1.9.0'
INPUT_DATA_TEMPL = r'''
var embeddedInputData = {input_json};
embeddedInputData.ytAtR = JSON.parse({raw_challenge});
'''


def make_script(input_dict, raw_challenge_data):
    return INPUT_DATA_TEMPL.format(
        input_json=json.dumps(input_dict),
        raw_challenge=raw_challenge_data or '\'null\'',
    ) + SCRIPT


__all__ = [
    'SCRIPT_PHANOTOM_MINVER',
    'make_script',
]
