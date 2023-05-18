const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');

const { exec } = require('@actions/exec');

const {
  RUNNER_TEMP: runnerTempDir = os.tmpdir(),
  GITHUB_RUN_ID: ghaRunId,
  GITHUB_REPOSITORY_OWNER: ghaRepoOrg,
  GITHUB_REPOSITORY: ghaRepo,
} = process.env;

const opensslSubjSpecialRegex = /[/+]/giu;

/** @param {string} value */
function escapeDNComponentValue(value) {
  return value.replace(opensslSubjSpecialRegex, (ch) => `\\${ch}`);
}

const ghaCertSubject = `/CN=GitHub Actions Workflow Run ${ghaRunId}/O=${escapeDNComponentValue(
  ghaRepoOrg || ''
)}/OU=${escapeDNComponentValue(ghaRepo || '')}`;

module.exports = {
  async generateCertificate() {
    const uuid = crypto.randomUUID();
    const prvKeyPath = path.join(runnerTempDir, `${uuid}.key`);
    const pubCerPath = path.join(runnerTempDir, `${uuid}.cer`);
    await exec('openssl', [
      'req',
      '-x509',
      '-noenc',
      '-newkey',
      'rsa:2048',
      '-subj',
      ghaCertSubject,
      '-days',
      '30',
      '-out',
      pubCerPath,
      '-keyout',
      prvKeyPath,
    ]);
    const prvKeyPem = await fs.readFile(prvKeyPath, 'ascii');
    await fs.rm(prvKeyPath, { force: true });
    const pubCerPem = await fs.readFile(pubCerPath, 'ascii');
    await fs.rm(pubCerPath, { force: true });
    const x509 = new crypto.X509Certificate(pubCerPem);
    return {
      uuid,
      privateKey: prvKeyPem,
      certificate: pubCerPem,
      commonName: x509.subject,
      thumbprint: x509.fingerprint256,
    };
  },
};
