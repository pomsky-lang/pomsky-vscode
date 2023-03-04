"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPomsky = void 0;
const cp = require("node:child_process");
async function runPomsky(flavor, content) {
    return new Promise((resolve, reject) => {
        let ps;
        try {
            ps = cp.spawn('pomsky', ['-f', flavor, '--json', content]);
        }
        catch (e) {
            return reject(e);
        }
        let allOut = '';
        let allErr = '';
        ps.stdout.on('data', data => (allOut += data));
        ps.stderr.on('data', data => (allErr += data));
        ps.on('error', e => {
            if (e.message.includes('ENOENT')) {
                reject(new Error('Pomsky executable not found. Make sure the `pomsky` binary is in your PATH'));
            }
            else {
                reject(e);
            }
        });
        ps.on('close', (code) => {
            if (code !== 0 && code !== 1) {
                reject(new Error(`Pomsky exited with non-zero status code: ${code}\n\nSTDOUT: ${allOut}\nSTDERR: ${allErr}`));
            }
            else {
                try {
                    resolve(JSON.parse(allOut));
                }
                catch {
                    reject(new Error(`Pomsky returned invalid JSON: ${allOut}`));
                }
            }
        });
    });
}
exports.runPomsky = runPomsky;
//# sourceMappingURL=pomskyCli.js.map