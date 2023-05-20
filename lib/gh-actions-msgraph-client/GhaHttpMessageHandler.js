const { isArrayBuffer, isArrayBufferView } = require('node:util/types');
const { Readable } = require('node:stream');
const { Response } = require('node-fetch');

const httpClientSym = Symbol('#httpClient');

/**
 * @param {import('node-fetch').BodyInit | Buffer | undefined} [body]
 * @returns {Parameters<import('@actions/http-client').HttpClient['request']>[2]}
 */
function bodyInitToData(body) {
  if (typeof body === 'undefined') return null;
  if (typeof body === 'string') return body;
  if (body instanceof Buffer) {
    return Readable.from(body);
  }
  if (isArrayBuffer(body)) {
    return Readable.from(Buffer.from(body));
  }
  if (isArrayBufferView(body)) {
    const { buffer, byteOffset, byteLength } = body;
    const byteEnd = byteOffset + byteLength;
    return Readable.from(Buffer.from(buffer.slice(byteOffset, byteEnd)));
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  const data = /** @type {Exclude<typeof body, ArrayBufferView>} */ (body);
  return data;
}

/**
 * @param {import('node-fetch').HeaderInit} [headers]
 * @returns {Parameters<import('@actions/http-client').HttpClient['request']>[3]}
 */
function headersInitToOutgoingHeaders(headers) {
  if (typeof headers === 'undefined') return undefined;
  if (Array.isArray(headers)) {
    /** @type {import('node:http').OutgoingHttpHeaders} */
    const outHeaders = Object.fromEntries(
      headers.map(([key, ...values]) => [key, values.join('\n')])
    );
    return outHeaders;
  }
  if (typeof headers.raw === 'function') {
    return headers.raw();
  }
  const outHeadersLike =
    /** @type {Exclude<typeof headers, import('node-fetch').Headers>} */ (
      headers
    );
  return outHeadersLike;
}

/**
 * @param {import('@actions/http-client').HttpClientResponse} response
 * @returns {import('node-fetch').Response}
 */
function httpClientResponseToFetchResponse(response) {
  const {
    message: body,
    message: { headers, statusCode, statusMessage, url },
  } = response;
  /** @type {[string, string][]} */
  const headersArray = [];
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const singleValue of value) headersArray.push([name, singleValue]);
    } else headersArray.push([name, value || '']);
  }
  /** @type {import('node-fetch').ResponseInit} */
  const respInit = {
    headers: headersArray,
    status: statusCode,
    statusText: statusMessage,
    size: headers['content-length']
      ? parseInt(headers['content-length'], 10)
      : undefined,
    url,
  };
  return new Response(body, respInit);
}

/** @typedef {import('@microsoft/microsoft-graph-client').Middleware} IMiddleware */
/** @implements IMiddleware */
class GhaHttpMessageHandler {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   */
  constructor(httpClient) {
    this[httpClientSym] = httpClient;
  }

  /** @type {IMiddleware['execute']} */
  async execute(context) {
    const httpClient = this[httpClientSym];
    /**
     * @type {{
     *  request: import('node-fetch').RequestInfo;
     *  options?: import('node-fetch').RequestInit;
     * }}
     */
    const { request: url, options } = context;
    const { method = 'GET', body, headers: requHeaders } = options || {};
    const requData = bodyInitToData(body);
    const resp = await httpClient.request(
      method,
      url.toString(),
      requData,
      headersInitToOutgoingHeaders(requHeaders)
    );
    context.response = httpClientResponseToFetchResponse(resp);
  }
}

module.exports = {
  GhaHttpMessageHandler,
};
