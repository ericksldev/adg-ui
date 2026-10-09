export function renderTermsDocument(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withInline = (value: string): string =>
    value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const lines = escaped.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = (): void => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed === '---') {
      closeList();
      html.push('<hr />');
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeList();
      html.push(`<h3>${withInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeList();
      html.push(`<h2>${withInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      closeList();
      html.push(`<h1>${withInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${withInline(trimmed.slice(2))}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${withInline(trimmed)}</p>`);
  }

  closeList();
  return html.join('');
}
