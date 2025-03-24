import subprocess
from yt_dlp.utils import shell_quote, format_field, ExtractorError, Popen
from yt_dlp.extractor.openload import PhantomJSwrapper


class PhantomJSWrapperWithCustomArgs(PhantomJSwrapper):
    def execute(self, jscode, video_id=None, *, note='Executing JS', phantom_args=None, script_args=None):
        """Execute JS file and return stdout"""
        if 'phantom.exit();' not in jscode:
            jscode += ';\nphantom.exit();'
        jscode = self._BASE_JS + jscode

        with open(self._TMP_FILES['script'].name, 'w', encoding='utf-8') as f:
            f.write(jscode)

        self.extractor.to_screen(f'{format_field(video_id, None, "%s: ")}{note}')

        cmd = [
            self.exe,
            *(phantom_args if phantom_args is not None else ['--ssl-protocol=any']),
            self._TMP_FILES['script'].name,
            *(script_args or []),
        ]
        self.extractor.write_debug(f'PhantomJS command line: {shell_quote(cmd)}')
        try:
            stdout, stderr, returncode = Popen.run(cmd, timeout=self.options['timeout'] / 1000,
                                                   text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception as e:
            raise ExtractorError(f'{note} failed: Unable to run PhantomJS binary', cause=e)
        if returncode:
            raise ExtractorError(f'{note} failed with returncode {returncode}:\n{stdout.strip()}')

        return stdout
