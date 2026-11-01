import zlib from 'zlib';

/**
 * Extracts plain text from a .docx file buffer (without external dependencies)
 * A .docx file is a zip archive containing word/document.xml
 */
export function extractTextFromDocx(buffer: Buffer): string {
  try {
    let pos = 0;
    while (pos < buffer.length - 30) {
      // Local file header signature: 0x04034b50
      if (buffer.readUInt32LE(pos) === 0x04034b50) {
        const fnLen = buffer.readUInt16LE(pos + 26);
        const extraLen = buffer.readUInt16LE(pos + 28);
        const compSize = buffer.readUInt32LE(pos + 18);
        const fn = buffer.toString('utf8', pos + 30, pos + 30 + fnLen);
        const dataStart = pos + 30 + fnLen + extraLen;

        if (fn === 'word/document.xml') {
          const compData = buffer.slice(dataStart, dataStart + compSize);
          const uncomp = zlib.inflateRawSync(compData);
          // Strip XML tags and normalize whitespace
          return uncomp
            .toString('utf8')
            .replace(/<w:p[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s+/g, '\n')
            .trim();
        }
        pos = dataStart + compSize;
      } else {
        pos++;
      }
    }
  } catch (err) {
    console.error('Error extracting text from docx:', err);
  }
  return '';
}
