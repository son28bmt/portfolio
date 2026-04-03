const { spawn } = require('child_process');
const path = require('path');

const runPythonScript = (scriptPath, inputData) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [scriptPath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      cwd: path.dirname(scriptPath)
    });
    let stdout = '';
    let stderr = '';

    // Send input as JSON to stdin
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      let parsedOut = null;

      const parseLastJsonLine = (text) => {
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const line = lines[i];
          const isJsonObject = line.startsWith('{') && line.endsWith('}');
          const isJsonArray = line.startsWith('[') && line.endsWith(']');
          if (!isJsonObject && !isJsonArray) continue;

          try {
            return JSON.parse(line);
          } catch (e) {}
        }

        return null;
      };

      const tryParseByRange = (startChar, endChar) => {
        const startIdx = stdout.indexOf(startChar);
        const endIdx = stdout.lastIndexOf(endChar);
        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
          try {
            return JSON.parse(stdout.substring(startIdx, endIdx + 1));
          } catch (e) {}
        }

        return null;
      };

      parsedOut = parseLastJsonLine(stdout) || tryParseByRange('[', ']') || tryParseByRange('{', '}');

      if (code === 0) {
        if (parsedOut) {
          resolve(parsedOut);
        } else {
          resolve(stdout.trim());
        }
      } else {
        // If we have a parsed JSON error from the script, use its 'error' field if it exists.
        const scriptError = parsedOut && parsedOut.error ? parsedOut.error : null;
        const errorMessage = scriptError || stderr.trim() || stdout.trim() || `Python process exited with code ${code}`;
        reject(new Error(errorMessage));
      }
    });
  });
};

module.exports = { runPythonScript };
