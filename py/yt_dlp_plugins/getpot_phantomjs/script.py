import json

from ._script import SCRIPT, SCRIPT_WRAPPER

SCRIPT_PHANOTOM_MINVER = '1.9.0'
INPUT_DATA_TEMPL = r'''
/* eslint-disable quotes */
var embeddedInputData = {input_json};
embeddedInputData.ytAtR = JSON.parse({raw_challenge});
/* eslint-enable quotes */
'''
SCRIPT_WRAPPER_PLACEHOLDER = r'''/*__PLACEHOLDER_REPLACE_WITH_SCRIPT_CONTENT__*/'''


def make_script(input_dict, raw_challenge_data, pjs_wrap=True):
    script_ = INPUT_DATA_TEMPL.format(
        input_json=json.dumps(input_dict),
        raw_challenge=raw_challenge_data or '\'null\'',
    ) + SCRIPT
    if pjs_wrap:
        return SCRIPT_WRAPPER.replace(SCRIPT_WRAPPER_PLACEHOLDER, script_)
    else:
        return script_


__all__ = [
    'SCRIPT_PHANOTOM_MINVER',
    'make_script',
]
