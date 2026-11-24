import sys
import zipfile
import xml.etree.ElementTree as ET


def docx_to_text(path: str) -> str:
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read("word/document.xml")
        tree = ET.fromstring(xml_content)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        text_parts = []
        for paragraph in tree.findall(".//w:p", ns):
            texts = paragraph.findall(".//w:t", ns)
            if texts:
                text_parts.append("".join(t.text or "" for t in texts))
        return "\n".join(text_parts)
    except Exception as e:
        return f"Error reading {path}: {e}"


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read_docx.py <file_path>")
        raise SystemExit(2)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(docx_to_text(sys.argv[1]))
