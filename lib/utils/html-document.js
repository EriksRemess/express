/*!
 * express
 * MIT Licensed
 */

/**
 * Create a minimal HTML document that renders the provided body inside `<pre>`.
 *
 * The `body` argument is expected to already be escaped or intentionally contain
 * the markup that should be rendered inside the `<pre>` block.
 *
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
export default function createHtmlDocument(title, body) {
  return '<!DOCTYPE html>\n'
    + '<html lang="en">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + `<title>${title}</title>\n`
    + '</head>\n'
    + '<body>\n'
    + `<pre>${body}</pre>\n`
    + '</body>\n'
    + '</html>\n';
}
