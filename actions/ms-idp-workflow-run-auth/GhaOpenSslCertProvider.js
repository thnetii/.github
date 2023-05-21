const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');

const ghaCore = require('@actions/core');
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
    ghaCore.info('Generating temporary self-signed certificate . . .');
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
      '-verbose',
    ]);
    ghaCore.debug('Reading generated private key file contents.');
    const prvKeyPem = await fs.readFile(prvKeyPath, 'ascii');
    ghaCore.debug('Deleting generated private key file.');
    await fs.rm(prvKeyPath, { force: true });
    ghaCore.debug('Reading generated certificate PEM file.');
    const pubCerPem = await fs.readFile(pubCerPath, 'ascii');
    ghaCore.debug('Deleting generated certificate PEM file.');
    await fs.rm(pubCerPath, { force: true });
    const x509 = new crypto.X509Certificate(pubCerPem);
    const thumbprint = Buffer.from(
      x509.fingerprint256.replaceAll(':', ''),
      'hex'
    );
    ghaCore.info(
      `Generated certificate with thumbprint: ${thumbprint.toString('base64')}`
    );
    return {
      uuid,
      privateKey: prvKeyPem,
      certificate: pubCerPem,
      thumbprint,
      x509,
    };
  },
};
