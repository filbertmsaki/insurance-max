function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getTag(xml, tagName) {
  const text = String(xml || '');

  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = text.match(regex);

  if (!match) {
    return null;
  }

  return unescapeXml(match[1].trim());
}

function hasTag(xml, tagName) {
  return new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i').test(
    String(xml || ''),
  );
}

function extractContentXml(xml) {
  const text = String(xml || '');
  const match = text.match(/<Content[^>]*>([\s\S]*?)<\/Content>/i);

  if (!match) {
    return text;
  }

  return unescapeXml(match[1].trim());
}

function getRoot(xml) {
  const text = String(xml || '').trim();
  const match = text.match(/<([A-Za-z0-9_:-]+)(\s|>)/);

  if (!match) {
    return null;
  }

  const root = match[1];

  if (root !== 'TiraMsg') {
    return root;
  }

  const innerMatch = text.match(/<TiraMsg[^>]*>([\s\S]*)<\/TiraMsg>/i);
  const inner = (innerMatch?.[1] || '').trim();

  if (!inner) {
    return root;
  }

  const contentXml = extractContentXml(text);

  if (contentXml && contentXml !== text) {
    const contentRoot = getRoot(contentXml);

    if (contentRoot && contentRoot !== 'TiraMsg') {
      return contentRoot;
    }
  }

  const childMatches = [...inner.matchAll(/<([A-Za-z0-9_:-]+)(\s|>)/g)];

  for (const childMatch of childMatches) {
    const childRoot = childMatch[1];

    if (
      childRoot !== 'MsgSignature' &&
      childRoot !== 'Signature' &&
      childRoot !== 'Content'
    ) {
      return childRoot;
    }
  }

  return root;
}

function safeXmlPreview(xml, limit = 1000) {
  return String(xml || '').slice(0, limit);
}

module.exports = {
  getRoot,
  getTag,
  hasTag,
  extractContentXml,
  escapeXml,
  unescapeXml,
  safeXmlPreview,
};
