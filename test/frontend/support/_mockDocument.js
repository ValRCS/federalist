class Document {

  static querySelectorAll(queryStr) {
    if (queryStr === 'meta[name="accessToken"]') {
      return [{ content: 'accessToken' }];
    }
    return [];
  }

  static createElement(str) {
    /* eslint-disable no-unused-vars */
    return {};
  }
}

module.exports = Document;
