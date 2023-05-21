const ghaCore = require('@actions/core');

module.exports = {
  /** @param {string} token */
  onJwtToken(token) {
    if (!token) return;
    ghaCore.setSecret(token);
    const [, body, signature] = token.split('.', 3);
    // Special protection for the token signature.
    // Without it the rest of the token is safe to be displayed.
    if (signature) ghaCore.setSecret(signature);
    if (ghaCore.isDebug()) {
      if (body) {
        try {
          const bodyDecoded = Buffer.from(body, 'base64url').toString('utf-8');
          ghaCore.debug(`JWT: ${bodyDecoded}`);
        } catch {
          ghaCore.debug(`JWT-ish (body is not Base64 encoded): ${body}`);
        }
      } else {
        ghaCore.debug('Non JWT received.');
      }
    }
  },

  /**
   * @param {string | undefined} [audience]
   */
  async getGithubActionsToken(audience) {
    ghaCore.debug(
      `Requesting GitHub Actions ID token for audience: '${audience}'`
    );
    const idToken = await ghaCore.getIDToken(audience);
    module.exports.onJwtToken(idToken);
    return idToken;
  },
};
